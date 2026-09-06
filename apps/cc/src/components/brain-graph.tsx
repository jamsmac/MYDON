"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { previewDoc, type DocPreview } from "../app/brain/actions";
import {
  countByKind,
  edgeStyle,
  kindLabel,
  matchesQuery,
  styleOf,
  subgraph,
} from "../lib/brain-layout";
import type { DocsGraph, GraphEdgeKind, GraphNode } from "../lib/core";

/** Узел в симуляции: d3 дописывает сюда x/y/vx/vy и наши fx/fy при перетаскивании. */
interface SimNode extends SimulationNodeDatum {
  id: string;
  node: GraphNode;
}

/** Ребро симуляции; d3 подменяет строки `source`/`target` на сами узлы. */
interface SimLink extends SimulationLinkDatum<SimNode> {
  kind: GraphEdgeKind;
}

/** Размер холста, пока ResizeObserver не сказал настоящий (SSR и jsdom). */
const FALLBACK_SIZE = { w: 860, h: 560 };
/** Границы масштаба: дальше 0,5 граф — пыль, ближе 3 — экран одного узла. */
const ZOOM = { min: 0.5, max: 3 };
/** Сколько узлов показывает список результатов: он читаемая опись, а не дамп. */
const MAX_RESULTS = 30;
/** Подписи у всех узлов читаемы только на маленьком графе. */
const LABELS_ALL_BELOW = 40;
/** Сколько тиков прогнать разом, когда анимация выключена в системе. */
const SETTLE_TICKS = 240;
/**
 * Сколько пикселей считать дрожанием руки, а не перетаскиванием.
 *
 * Без порога любой клик по узлу с микросдвигом мыши читался как «тащил», и
 * карточка не открывалась — попасть по узлу удавалось не с первого раза.
 */
const DRAG_SLOP = 4;

/**
 * Экран «Мозг»: граф знаний репозитория (R-M-6).
 *
 * Canvas, а не SVG: 219 узлов и 522 ребра в DOM — это 741 элемент, которые
 * браузер пересобирает на каждом тике симуляции. Но canvas не читается ни
 * скринридером, ни клавиатурой, поэтому рядом всегда живёт список результатов
 * — тот же граф словами, и через него доступны все действия карточки.
 *
 * Цвета берём токенами из `getComputedStyle` в момент отрисовки: тему выбирает
 * браузер (`prefers-color-scheme`) или `data-theme`, и зашитый в код `#6d4bb8`
 * протёк бы мимо палитры.
 */
export function BrainGraph({ graph, focus }: { graph: DocsGraph; focus?: string }) {
  // Поиск приходит из «Документов» (`?focus=`) уже готовым запросом: владелец
  // пришёл смотреть на конкретный документ, а не на весь граф.
  const [query, setQuery] = useState(focus ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? null);
  const [preview, setPreview] = useState<DocPreview | "loading" | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Выбранный узел нужен отрисовке (кольцо), но перерисовывать граф ради него
  // нельзя: пересоздание симуляции на каждый клик раскидывало бы узлы заново.
  const selectedRef = useRef<string | null>(selectedId);
  const redrawRef = useRef<(() => void) | null>(null);
  /**
   * Камера и координаты узлов ЖИВУТ ВНЕ эффекта.
   *
   * Эффект симуляции пересоздаётся на каждое изменение подграфа, то есть на
   * каждую букву в поиске. Держи их внутри — и набор «vendhub» шесть раз
   * сбрасывал бы масштаб к единице и раскидывал уже разложенный граф заново.
   */
  const cameraRef = useRef({ k: 1, x: 0, y: 0 });
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());

  // Тяжёлую часть (пересборку графа и симуляции) откладываем — так поле ввода
  // остаётся отзывчивым на графе в две сотни узлов, а список результатов
  // сужается сразу, без задержки таймера.
  const deferredQuery = useDeferredValue(query);
  const view = useMemo(() => subgraph(graph, deferredQuery), [graph, deferredQuery]);

  // Список — это СОВПАДЕНИЯ, без соседей: соседи нужны графу, чтобы объяснить
  // узел связями, а в списке они читались бы как «нашлось не то».
  const matched = useMemo(() => graph.nodes.filter((n) => matchesQuery(n, query)), [graph, query]);
  const results = useMemo(() => matched.slice(0, MAX_RESULTS), [matched]);
  const matchedCount = matched.length;
  const legend = useMemo(() => countByKind(view.nodes), [view]);

  // Узел ищем в ПОЛНОМ графе: сузив поиск, владелец не должен терять открытую
  // карточку. `?focus=` на несуществующий путь просто не откроет ничего.
  const selected = useMemo(
    () => (selectedId === null ? null : (graph.nodes.find((n) => n.id === selectedId) ?? null)),
    [graph, selectedId],
  );

  useEffect(() => {
    selectedRef.current = selectedId;
    redrawRef.current?.();
  }, [selectedId]);

  // Esc закрывает карточку — на графе это единственный способ «отойти назад»
  // без мыши: список результатов остаётся на месте, уходит только карточка.
  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Предпросмотр документа: только у узлов с файлом. У домена, типа
  // инструмента и навыка без файла читать нечего — и запроса не будет.
  const selectedPath = selected?.path;
  useEffect(() => {
    if (selectedPath === undefined) {
      setPreview(null);
      return;
    }
    let alive = true;
    setPreview("loading");
    previewDoc(selectedPath)
      .then((res) => {
        if (alive) setPreview(res);
      })
      .catch(() => {
        if (alive) setPreview({ ok: false, reason: "core" });
      });
    return () => {
      alive = false;
    };
  }, [selectedPath]);

  // ── Симуляция и отрисовка ────────────────────────────────────────────────
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Узлы садим на ПРЕЖНИЕ координаты: те же узлы после сужения поиска
    // должны остаться там, где владелец их видел, а не прыгать по экрану.
    const nodes: SimNode[] = view.nodes.map((n) => {
      const prev = positionsRef.current.get(n.id);
      return prev ? { id: n.id, node: n, x: prev.x, y: prev.y } : { id: n.id, node: n };
    });
    const fresh = nodes.filter((n) => typeof n.x !== "number").length;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = view.edges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, kind: e.kind }));

    let size = { w: box.clientWidth || FALLBACK_SIZE.w, h: box.clientHeight || FALLBACK_SIZE.h };
    const camera = cameraRef.current;

    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(40),
      )
      .force("charge", forceManyBody().strength(-80))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force("collide", forceCollide(10));
    // Тики гоняем сами: свой цикл умеет останавливаться на осевшем графе и
    // соблюдать `prefers-reduced-motion`, а встроенный таймер d3 — нет.
    sim.stop();
    // Все узлы пришли с координатами — греем чуть-чуть, только чтобы
    // подтянулись новые связи. Иначе d3 стартует с alpha = 1 и раскидывает
    // разложенный граф на каждой букве поиска.
    sim.alpha(fresh === 0 ? 0.15 : 1);

    const css = getComputedStyle(document.documentElement);
    // Запасной цвет — не литерал, а вычисленный цвет текста страницы: он сам
    // приезжает из токена темы, и «нового цвета» тут не появляется.
    const fallback = css.color;
    const color = (token: string): string => css.getPropertyValue(token).trim() || fallback;
    // Шрифт подписей берём ВЫЧИСЛЕННЫМ у самого холста: `ctx.font` — не CSS,
    // и строка вида `11px var(--fu)` там молча игнорируется, оставляя подписи
    // системным 10px sans-serif мимо Golos.
    const labelFont = `11px ${getComputedStyle(box).fontFamily || "sans-serif"}`;

    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.k, camera.k);

      for (const link of links) {
        // d3 подменяет строковые source/target на сами узлы при первом тике;
        // до него координат ещё нет — рисовать линию «в ноль» нельзя.
        const a = link.source as SimNode;
        const b = link.target as SimNode;
        if (typeof a?.x !== "number" || typeof a.y !== "number") continue;
        if (typeof b?.x !== "number" || typeof b.y !== "number") continue;
        const style = edgeStyle(link.kind);
        ctx.globalAlpha = style.alpha;
        ctx.strokeStyle = color(style.token);
        ctx.lineWidth = style.width;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      const withLabels = nodes.length <= LABELS_ALL_BELOW;
      for (const item of nodes) {
        if (typeof item.x !== "number" || typeof item.y !== "number") continue;
        const style = styleOf(item.node.kind);
        ctx.fillStyle = color(style.token);
        ctx.beginPath();
        ctx.arc(item.x, item.y, style.r, 0, Math.PI * 2);
        ctx.fill();
        if (item.id === selectedRef.current) {
          // Выбранный узел — кольцо, а не другой цвет: цвет здесь уже занят
          // видом узла, и перекрасить его значило бы соврать про вид.
          ctx.strokeStyle = color("--tx");
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(item.x, item.y, style.r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Подписи — только у крупных узлов (корень, направление, агент) либо
        // на маленьком графе: 219 подписей превращают экран в кашу.
        if (withLabels || style.r >= 7 || item.id === selectedRef.current) {
          ctx.fillStyle = color("--tx-2");
          ctx.font = labelFont;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(item.node.label, item.x, item.y + style.r + 3);
        }
      }
    };

    let frame: number | null = null;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const loop = (): void => {
      sim.tick();
      draw();
      // Осевший граф не перерисовываем: бесконечный rAF ради неподвижной
      // картинки жёг бы батарею всё время, пока экран открыт.
      frame = sim.alpha() > 0.01 ? requestAnimationFrame(loop) : null;
    };
    const kick = (): void => {
      if (frame !== null) return;
      frame = requestAnimationFrame(loop);
    };
    /**
     * Разложить граф заново.
     *
     * При `prefers-reduced-motion` анимации нет вовсе: прогоняем тики разом и
     * рисуем ОДИН кадр. Иначе владелец, который выключил анимацию в системе,
     * получил бы на весь экран трясущуюся паутину.
     */
    const settle = (): void => {
      if (!reduced) {
        kick();
        return;
      }
      for (let i = 0; i < SETTLE_TICKS; i += 1) sim.tick();
      draw();
    };

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const w = box.clientWidth || FALLBACK_SIZE.w;
      const h = box.clientHeight || FALLBACK_SIZE.h;
      const changed = w !== size.w || h !== size.h;
      size = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sim.force("center", forceCenter(w / 2, h / 2));
      // Перегреваем симуляцию только при НАСТОЯЩЕМ изменении холста:
      // ResizeObserver зовёт колбэк и сразу после observe(), то есть на каждом
      // пересоздании эффекта, — без этой проверки любая буква в поиске снова
      // раскидывала бы граф, и посадка узлов на прежние места была бы напрасной.
      if (changed) sim.alpha(Math.max(sim.alpha(), 0.3));
      settle();
    };

    // Отрисовка нужна и снаружи эффекта: выбор узла из списка меняет только
    // кольцо, а на осевшем графе цикла кадров уже нет — без этого кольцо
    // появлялось бы лишь после следующего движения мыши.
    redrawRef.current = draw;
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(box);

    // ── Мышь и палец ──
    const toGraph = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - camera.x) / camera.k,
        y: (e.clientY - rect.top - camera.y) / camera.k,
      };
    };
    const nodeAt = (p: { x: number; y: number }): SimNode | null => {
      let best: SimNode | null = null;
      let bestDist = Infinity;
      for (const item of nodes) {
        if (typeof item.x !== "number" || typeof item.y !== "number") continue;
        const d = Math.hypot(item.x - p.x, item.y - p.y);
        // Порог — радиус плюс запас: попасть пальцем в круг 4 px нельзя.
        if (d < styleOf(item.node.kind).r + 6 && d < bestDist) {
          best = item;
          bestDist = d;
        }
      }
      return best;
    };

    let dragging: SimNode | null = null;
    let panFrom: { x: number; y: number } | null = null;
    let downAt: { x: number; y: number } | null = null;
    let moved = false;

    /** Ушли ли дальше дрожания руки — только тогда это перетаскивание. */
    const past = (e: PointerEvent): boolean =>
      downAt !== null && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > DRAG_SLOP;

    const onDown = (e: PointerEvent): void => {
      moved = false;
      downAt = { x: e.clientX, y: e.clientY };
      const hit = nodeAt(toGraph(e));
      canvas.setPointerCapture(e.pointerId);
      if (hit) {
        dragging = hit;
        // При выключенной анимации цикл кадров не запускаем и здесь: узел
        // поедет за пальцем покадрово в onMove, соседи — одним тиком на шаг.
        if (!reduced) {
          sim.alphaTarget(0.25);
          kick();
        }
      } else {
        panFrom = { x: e.clientX - camera.x, y: e.clientY - camera.y };
        canvas.style.cursor = "grabbing";
      }
    };
    const onMove = (e: PointerEvent): void => {
      if (dragging) {
        if (!moved && !past(e)) return;
        moved = true;
        const p = toGraph(e);
        dragging.fx = p.x;
        dragging.fy = p.y;
        if (reduced) {
          sim.tick();
          draw();
        } else kick();
        return;
      }
      if (panFrom) {
        if (!moved && !past(e)) return;
        moved = true;
        camera.x = e.clientX - panFrom.x;
        camera.y = e.clientY - panFrom.y;
        draw();
        return;
      }
      // Мышь просто гуляет по холсту: курсор говорит, что под ней — узел
      // (нажми) или пустое место (тащи холст).
      canvas.style.cursor = nodeAt(toGraph(e)) ? "pointer" : "grab";
    };
    const onUp = (e: PointerEvent): void => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (dragging) {
        // Клик без движения — это выбор узла, а не перетаскивание: карточка
        // должна открываться и с холста, не только из списка.
        if (!moved) setSelectedId(dragging.id);
        dragging.fx = null;
        dragging.fy = null;
        dragging = null;
        sim.alphaTarget(0);
      } else if (panFrom && !moved) {
        setSelectedId(null);
      }
      panFrom = null;
      downAt = null;
      canvas.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent): void => {
      // Слушатель нативный и НЕ пассивный: React вешает wheel пассивно, и
      // preventDefault из onWheel не сработал бы — страница скроллилась бы
      // вместе с масштабированием графа.
      e.preventDefault();
      const p = { x: e.clientX, y: e.clientY };
      const rect = canvas.getBoundingClientRect();
      const before = toGraph(e);
      const next = Math.min(ZOOM.max, Math.max(ZOOM.min, camera.k * Math.exp(-e.deltaY * 0.001)));
      camera.k = next;
      // Держим точку под курсором на месте — иначе граф уезжает из-под мыши.
      camera.x = p.x - rect.left - before.x * next;
      camera.y = p.y - rect.top - before.y * next;
      draw();
    };

    /**
     * Смена темы — перерисовать холст.
     *
     * `getComputedStyle` возвращает ЖИВОЙ объект: значения токенов он отдаёт
     * уже новые сам. Не хватает только кадра — на осевшем графе цикла нет, и
     * после переключения темы граф остался бы нарисованным старой палитрой.
     * Слушаем оба источника: `data-theme` на <html> (явный выбор,
     * <ConsoleTheme/>) и системную настройку.
     */
    const themeWatcher = new MutationObserver(draw);
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const scheme =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const onScheme = (): void => draw();
    scheme?.addEventListener("change", onScheme);

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      redrawRef.current = null;
      // Запоминаем, где узлы осели: следующий прогон эффекта (буква в поиске)
      // посадит их туда же, и граф не прыгнет.
      for (const item of nodes) {
        if (typeof item.x === "number" && typeof item.y === "number") {
          positionsRef.current.set(item.id, { x: item.x, y: item.y });
        }
      }
      sim.stop();
      observer.disconnect();
      themeWatcher.disconnect();
      scheme?.removeEventListener("change", onScheme);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [view]);

  return (
    <div className="brain-layout">
      <div className="brain-main">
        <div className="search brain-search">
          <input
            type="search"
            aria-label="Поиск по графу"
            placeholder="Узел, путь или направление"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Не `.chips`: тот примитив — ряд ФИЛЬТРОВ (курсор-палец, перекраска
            при наведении), а легенда ключ цветов и ни на что не нажимается —
            обещать клик, которого нет, хуже, чем не иметь наведения вовсе. */}
        <div className="brain-legend" role="group" aria-label="Виды узлов">
          {legend.map(([kind, n]) => (
            <span key={kind} className="chip brain-kind" data-kind={kind}>
              {kindLabel(kind)} <b className="num">{n}</b>
            </span>
          ))}
        </div>

        <div className="brain-canvas" ref={boxRef}>
          {/* Холст — картинка графа; читаемый его двойник живёт ниже списком. */}
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>

        <p className="eyebrow brain-results-title">
          {query.trim().length === 0 ? "Все узлы" : `Найдено: ${matchedCount}`}
        </p>
        {results.length === 0 ? (
          <div className="empty">
            <b>Ничего не нашлось</b>
            Сотри часть запроса — поиск идёт по заголовку узла и по пути файла.
          </div>
        ) : (
          <div className="rows brain-results">
            {results.map((n) => (
              <button
                key={n.id}
                type="button"
                className="row"
                aria-current={n.id === selectedId ? "true" : undefined}
                onClick={() => setSelectedId(n.id)}
              >
                <span className="t">
                  <b>{n.label}</b>
                  {/* Адрес узла: путь файла либо идентификатор синтетического
                      узла — по нему владелец и узнаёт, «тот ли это самый». */}
                  <small className="mono">{n.path ?? n.id}</small>
                </span>
                <span className="chip brain-kind" data-kind={n.kind}>
                  {kindLabel(n.kind)}
                </span>
              </button>
            ))}
          </div>
        )}
        {matchedCount > results.length && (
          <p className="brain-more">
            Показаны первые {results.length} из {matchedCount} — уточни запрос.
          </p>
        )}
      </div>

      {selected && (
        <aside className="panel console brain-card" aria-label="Узел графа">
          <div className="brain-card-head">
            <p className="eyebrow">{kindLabel(selected.kind)}</p>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => setSelectedId(null)}
              aria-label="Закрыть карточку узла"
            >
              Закрыть
            </button>
          </div>
          <b className="brain-card-title">{selected.label}</b>
          <small className="mono brain-card-path">{selected.path ?? selected.id}</small>

          <div className="brain-card-links">
            {selected.path && (
              <Link className="btn sm" href={`/docs?path=${encodeURIComponent(selected.path)}`}>
                Читать документ
              </Link>
            )}
            {selected.href === "/skills" && (
              <Link className="btn sm" href="/skills">
                Витрина навыков
              </Link>
            )}
            {selected.href && selected.href !== "/skills" && (
              <Link className="btn sm" href={selected.href}>
                Карточка агента
              </Link>
            )}
          </div>

          <NodePreview preview={preview} hasPath={selected.path !== undefined} />
        </aside>
      )}
    </div>
  );
}

/** Первые строки документа под карточкой — или честная причина, почему их нет. */
function NodePreview({
  preview,
  hasPath,
}: {
  preview: DocPreview | "loading" | null;
  hasPath: boolean;
}) {
  if (!hasPath) {
    return (
      <p className="brain-preview-note">
        Узел собран из данных, а не из файла: читать нечего — смотри связи на графе.
      </p>
    );
  }
  if (preview === null || preview === "loading") {
    return <p className="brain-preview-note">Читаем документ…</p>;
  }
  if (!preview.ok) {
    const text =
      preview.reason === "forbidden"
        ? "Личный документ — доступен только владельцу."
        : preview.reason === "missing"
          ? "Файл в графе есть, а на диске образа его нет — проверь сборку."
          : "Core не ответил — предпросмотр недоступен, сам документ открой ссылкой выше.";
    return <p className="brain-preview-note">{text}</p>;
  }
  return (
    <>
      <p className="eyebrow">Первые строки</p>
      <pre className="brain-preview">{preview.lines.join("\n")}</pre>
    </>
  );
}
