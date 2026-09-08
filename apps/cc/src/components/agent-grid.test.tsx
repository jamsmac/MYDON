import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SkipReason } from "@mydon/shared";
import type { AgentStatusRow } from "../lib/core";
import { AgentGrid } from "./agent-grid";

const row = (over: Partial<AgentStatusRow> & { name: string }): AgentStatusRow => ({
  business: "vendhub",
  passportStatus: "active",
  state: "idle",
  reason: "ещё не запускался: в журнале прогонов нет ни одной записи",
  ...over,
});

/** Обычный день: кто-то работает, кто-то молчит, один выключен в карточке. */
const обычныйДень: AgentStatusRow[] = [
  row({
    name: "vendhub-ops",
    state: "working",
    reason: "выполняет задачу (навык «monitor-stock»)",
    skill: "monitor-stock",
  }),
  row({
    name: "chief-of-staff",
    reason: "последний прогон пропущен — повода нет",
    lastRun: {
      at: "2026-09-06T03:00:00.000Z",
      outcome: "skipped",
      skipReason: "no_signal",
      reason: "предлагать нечего",
    },
  }),
  row({
    name: "coach-agent",
    reason: "последний прогон пропущен — модель не ответила",
    lastRun: {
      at: "2026-09-06T03:00:00.000Z",
      outcome: "skipped",
      skipReason: "llm_failed",
      reason: "провайдер вернул 500",
    },
  }),
  row({
    name: "globerent-sales",
    state: "paused",
    passportStatus: "paused",
    reason: "агент выключен в карточке (статус paused)",
  }),
];

const безПаузы = { schedules: false, tasks: false };

/**
 * Момент, от которого считается давность (`row.since`).
 *
 * Фиксированный: «сегодня» у `runWhen` считается от него, и тест на живых
 * часах протух бы через сутки (урок ветки про даты в фикстурах).
 */
const NOW = new Date("2026-09-06T09:00:00.000Z");

describe("Сетка агентов: сводка", () => {
  it("печатает, сколько работают, молчат и стоят на паузе", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    expect(screen.getByText(/работают 1 · молчат 2 · на паузе 1/)).toBeInTheDocument();
  });

  it("затыки называет отдельно — их не прячут в «молчат»", () => {
    render(
      <AgentGrid
        rows={[row({ name: "knowledge-curator", state: "blocked", reason: "Core остановил задачу" })]}
        paused={безПаузы}
        now={NOW}
      />,
    );
    expect(screen.getByText(/в затыке 1/)).toBeInTheDocument();
  });
});

describe("Сетка агентов: системная пауза", () => {
  it("говорит отдельной строкой, что это настройка системы, а не состояние агентов", () => {
    // Под паузой задач плитки живут своей жизнью (перепроверка прода, корень 1):
    // занятый агент работает, свободному — «на паузе». Строка объясняет тумблер,
    // не подменяя состояний.
    const все = [
      ...обычныйДень.filter((a) => a.state === "working"),
      ...обычныйДень
        .filter((a) => a.state === "idle")
        .map((a) => ({
          ...a,
          state: "paused" as const,
          reason:
            "назначенные задачи на паузе (это настройка системы, а не агента); cron-прогоны этой паузой не остановлены",
        })),
    ];
    const { container } = render(<AgentGrid rows={все} paused={{ schedules: false, tasks: true }} now={NOW} />);
    const строка = container.querySelector(".notice");
    expect(строка).not.toBeNull();
    expect(строка).toHaveTextContent(/настройка системы/i);
    expect(строка).toHaveTextContent(/AGENTS_TASKS_PAUSED/);
    // По факту рантайма: пауза останавливает порученные задачи, cron-прогоны
    // идут. Прежний текст «ни один из них не возьмёт задачу» спорил бы с
    // «Ближайшими 24 ч» на том же экране.
    expect(строка).toHaveTextContent(/прогоны по cron-расписанию идут/);
    expect(строка).not.toHaveTextContent(/ни один из них не возьмёт/);
    // Работающий агент под этой паузой остаётся «работает»: строка — не состояние.
    expect(screen.getByText("работает")).toBeInTheDocument();
  });

  it("без системной паузы строки нет — иначе она перестанет что-либо значить", () => {
    const { container } = render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("пауза расписаний названа своим именем, а не общей паузой", () => {
    const { container } = render(
      <AgentGrid rows={обычныйДень} paused={{ schedules: true, tasks: false }} now={NOW} />,
    );
    expect(container.querySelector(".notice")).toHaveTextContent(/AGENTS_SCHEDULES_PAUSED/);
  });
});

describe("Сетка агентов: плитка", () => {
  it("несёт имя, состояние словом и причину", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    expect(screen.getByText("vendhub-ops")).toBeInTheDocument();
    expect(screen.getByText("работает")).toBeInTheDocument();
    expect(screen.getByText("выполняет задачу (навык «monitor-stock»)")).toBeInTheDocument();
  });

  it("ведёт на карточку агента", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    expect(screen.getByRole("link", { name: /vendhub-ops/ })).toHaveAttribute(
      "href",
      "/agents/vendhub-ops",
    );
  });

  it("выключенный агент НЕ рисуется классом «всё в норме»", () => {
    // Дефект витрины навыков (`skills-deck.tsx`): paused → `.led.idle`, то есть
    // зелёный. В сетке из двенадцати плиток взгляд ловит цвет, и ряд зелёных
    // ламп читается как «всё хорошо» над выключенной системой.
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    const лампа = screen.getByText("на паузе");
    expect(лампа).not.toHaveClass("idle");
    expect(лампа.closest(".agtile")).toHaveAttribute("data-state", "paused");
  });

  it("молчание из-за поломки весит больше, чем «повода нет»", () => {
    // Ревью задачи 1: «модель не ответила» — это не спокойное молчание.
    // Причина из Core уже называет поломку, но вес на экране обязан отличаться.
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} now={NOW} />);
    const поломка = screen.getByText("последний прогон пропущен — модель не ответила");
    const спокойно = screen.getByText("последний прогон пропущен — повода нет");
    expect(поломка.closest(".agtile")).toHaveAttribute("data-attention", "true");
    expect(спокойно.closest(".agtile")).not.toHaveAttribute("data-attention");
  });

  it("работающему агенту прошлый сбой полосы не рисует — у него своё состояние", () => {
    // Полоса «поломки» объясняется словами причины, а причина работающего
    // агента говорит про текущую задачу. Полоса без объяснения — шум.
    render(
      <AgentGrid
        rows={[
          row({
            name: "vendhub-ops",
            state: "working",
            reason: "выполняет задачу (навык «monitor-stock»)",
            lastRun: {
              at: "2026-09-06T03:00:00.000Z",
              outcome: "failed",
              skipReason: null,
              reason: "провайдер вернул 500",
            },
          }),
        ]}
        paused={безПаузы}
        now={NOW}
      />,
    );
    expect(screen.getByText("работает").closest(".agtile")).not.toHaveAttribute("data-attention");
  });
});

/*
 * Затемнение паузы живёт в CSS, а jsdom стилей не применяет — поэтому сторожим
 * сам файл. НО ПО СМЫСЛУ, А НЕ ПО ЛИТЕРАЛУ (круг починок, A-4): прежний сторож
 * искал в тексте подстроку `.agr`, и правило, переписанное через РОДИТЕЛЯ
 * (`.agtile[data-state="paused"] .agb`), гасило бы причину, а тест молчал бы.
 * Поэтому селекторы вынимаются из файла разбором, а проверяются НА НАСТОЯЩЕМ
 * ДЕРЕВЕ плитки: ни сама причина, ни один её предок не должны попасть под
 * гасящее правило (`closest` проверяет и элемент, и всех предков сразу).
 */
describe("Сетка агентов: затемнение паузы в globals.css", () => {
  const css = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app/globals.css"),
    "utf8",
  );

  /**
   * Правила файла, гасящие прозрачность (`opacity` меньше единицы), — селектор
   * за селектором. Скобочный сканер, а не регулярка по всему тексту: правила
   * внутри `@media` иначе склеились бы с условием медиазапроса.
   */
  function гасящиеСелекторы(source: string): string[] {
    const без = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const правила: { selector: string; body: string }[] = [];
    const стек: string[] = [];
    let буфер = "";
    for (const ch of без) {
      if (ch === "{") {
        стек.push(буфер.trim());
        буфер = "";
      } else if (ch === "}") {
        const selector = стек.pop() ?? "";
        правила.push({ selector, body: буфер });
        буфер = "";
      } else буфер += ch;
    }
    return правила
      .filter((r) => гаситПрозрачность(r.body))
      .flatMap((r) => r.selector.split(",").map((sel) => sel.trim()))
      .filter((sel) => sel.includes(".agtile"));
  }

  /**
   * Гасит ли тело правила прозрачность — ПО ЧИСЛУ, а не по форме записи
   * (круг починок 2, Ф-3).
   *
   * Прежний фильтр требовал `;` или конец тела сразу после числа и потому не
   * видел НИ `opacity: 0.55 !important`, НИ `opacity: 55%`. Обе формы гасят
   * ровно так же — вместе с текстом причины, — а сторож на них молчал, то
   * есть был слеп именно к самым вероятным правкам вручную.
   */
  function гаситПрозрачность(body: string): boolean {
    for (const m of body.matchAll(/(?:^|[;\s])opacity\s*:\s*([^;{}]+?)\s*(?=;|$)/gi)) {
      const значение = (m[1] ?? "").replace(/!\s*important$/i, "").trim();
      const проценты = значение.endsWith("%");
      const число = Number.parseFloat(проценты ? значение.slice(0, -1) : значение);
      // Вычисляемое значение (`var(--a, 1)`) числом не разбирается: судить о
      // нём в тексте нечем, и выдуманный вердикт хуже честного пропуска.
      if (Number.isFinite(число) && (проценты ? число / 100 : число) < 1) return true;
    }
    return false;
  }

  it("гасящее правило паузы адресует только части плитки — литеральный второй пояс", () => {
    // ДВА НЕЗАВИСИМЫХ СТОРОЖА ЛУЧШЕ ОДНОГО УМНОГО (Ф-3). Разборщик выше судит
    // по смыслу и потому сильнее, но любая его слепота (форма числа,
    // `!important`, вложенность правил) снимает сторожа ЦЕЛИКОМ и молча.
    // Литерал ловит самую вероятную форму регресса — правило, повешенное на
    // саму плитку или на её общего родителя `.agb`, — независимо от значения
    // и от того, чем оно записано.
    const без = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(без, "правило повешено на саму плитку — погаснет и текст причины").not.toMatch(
      /\.agtile\[data-state="paused"\]\s*\{/,
    );
    const хвосты = [...без.matchAll(/\.agtile\[data-state="paused"\]([^,{]*)[,{]/g)].map((m) =>
      (m[1] ?? "").trim(),
    );
    expect(хвосты.length).toBeGreaterThan(0);
    for (const хвост of хвосты) {
      expect(
        [".av8", ".agn", ".agled"],
        `правило «.agtile[data-state="paused"] ${хвост}» гасит группу, в которую входит причина`,
      ).toContain(хвост);
    }
  });

  it("гасящие правила плитки вообще есть — и это общее число 0.55", () => {
    // Прецеденты файла — 0.55 (`.crons-table tr.is-paused`, `.ph[data-state="skip"]`,
    // `.btn:disabled`), своего числа у плитки быть не должно.
    const селекторы = гасящиеСелекторы(css);
    expect(селекторы.length).toBeGreaterThan(0);
    expect(css).toMatch(/\.agtile\[data-state="paused"\][^{]*\{[^}]*opacity:\s*0\.55/);
  });

  it("НИ ОДИН предок текста причины не гаснет — проверено на дереве, а не в тексте", () => {
    const { container } = render(
      <AgentGrid
        rows={[
          row({
            name: "globerent-sales",
            state: "paused",
            passportStatus: "paused",
            reason: "агент выключен в карточке (статус paused)",
          }),
        ]}
        paused={безПаузы}
        now={NOW}
      />,
    );
    const причина = screen.getByText(/агент выключен в карточке/);
    const плитка = причина.closest(".agtile");
    expect(плитка).not.toBeNull();

    const селекторы = гасящиеСелекторы(css);
    for (const sel of селекторы) {
      expect(
        причина.closest(sel),
        `правило «${sel}» гасит причину: прозрачность применяется к группе целиком, ` +
          "и дочерним opacity: 1 её не вернуть",
      ).toBeNull();
    }
    // И при этом гасящие правила ДЕЙСТВИТЕЛЬНО попадают в плитку — иначе тест
    // выше проходил бы на селекторах, которые ни к чему не относятся.
    const попадают = селекторы.filter((sel) => container.querySelector(sel) !== null);
    expect(попадают.length).toBeGreaterThan(0);
  });
});

/*
 * Р-1: в массиве ПОЛОМКА четыре причины, и каждая обязана быть закрыта своим
 * прогоном — иначе удаление любой из них не уронит ни одного теста.
 */
describe("Сетка агентов: все причины поломки", () => {
  const молчит = (skipReason: SkipReason, reason: string): AgentStatusRow =>
    row({
      name: `agent-${skipReason}`,
      reason: `последний прогон пропущен — ${reason}`,
      lastRun: {
        at: "2026-09-06T03:00:00.000Z",
        outcome: "skipped",
        skipReason,
        reason,
      },
    });

  const поломки: [SkipReason, string][] = [
    ["llm_failed", "модель не ответила"],
    ["ledger_unavailable", "LLM-ledger недоступен"],
    ["execution_unknown", "исход неизвестен"],
    ["hook_blocked", "остановлено хуком"],
  ];

  it.each(поломки)("«%s» весит больше спокойного молчания", (skipReason, reason) => {
    render(<AgentGrid rows={[молчит(skipReason, reason)]} paused={безПаузы} now={NOW} />);

    const плитка = screen.getByText(`последний прогон пропущен — ${reason}`).closest(".agtile");
    expect(плитка).toHaveAttribute("data-attention", "true");
  });

  const спокойные: [SkipReason, string][] = [
    ["no_signal", "повода нет"],
    ["no_change", "без изменений"],
    ["capped", "потолок действий"],
  ];

  it.each(спокойные)("«%s» поломкой не считается — делать нечего", (skipReason, reason) => {
    // Граница списка: если в ПОЛОМКА попадёт лишнее, полоса перестанет
    // что-либо значить — ею будет отмечен каждый молчащий агент.
    render(<AgentGrid rows={[молчит(skipReason, reason)]} paused={безПаузы} now={NOW} />);

    const плитка = screen.getByText(`последний прогон пропущен — ${reason}`).closest(".agtile");
    expect(плитка).not.toHaveAttribute("data-attention");
    // И слово состояния остаётся обычным молчанием: спокойный пропуск не
    // получает ни полосы, ни чужого веса.
    expect(плитка).toHaveAttribute("data-state", "idle");
  });
});

describe("Сетка агентов: давность состояния (круг починок, C-3)", () => {
  const молчун = (name: string, since: string): AgentStatusRow =>
    row({
      name,
      state: "idle",
      reason: "последний прогон — выполнено",
      since,
      lastRun: { at: since, outcome: "executed", skipReason: null, reason: "сделано" },
    });

  it("два агента с ОДИНАКОВОЙ причиной и разным `since` различимы", () => {
    // Дефект: у агента со снятым расписанием последний прогон был 12 июня, а
    // плитка печатала ровно тот же текст, что у отработавшего час назад.
    render(
      <AgentGrid
        rows={[молчун("stale-agent", "2026-06-12T03:00:00.000Z"), молчун("fresh-agent", "2026-09-06T03:00:00.000Z")]}
        paused={безПаузы}
        now={NOW}
      />,
    );
    const текст = (name: string): string =>
      screen.getByText(name).closest(".agtile")?.querySelector(".agr")?.textContent ?? "";
    expect(текст("stale-agent")).not.toEqual(текст("fresh-agent"));
    expect(текст("stale-agent")).toMatch(/12\.06/);
    expect(текст("fresh-agent")).toMatch(/сегодня/);
  });

  it("без `since` давность не выдумывается", () => {
    render(
      <AgentGrid
        rows={[row({ name: "new-agent", reason: "ещё не запускался: в журнале прогонов нет ни одной записи" })]}
        paused={безПаузы}
        now={NOW}
      />,
    );
    const причина = screen.getByText(/ещё не запускался/);
    expect(причина.querySelector(".agw")).toBeNull();
  });
});

describe("Сетка агентов: состояние не прочиталось (круг починок, C-2)", () => {
  it("раздел ОСТАЁТСЯ и называет причину — пропажа читается как «агентов нет»", () => {
    const { container } = render(
      <AgentGrid rows={[]} paused={безПаузы} now={NOW} error="HTTP 500 на /agents/status" />,
    );
    expect(screen.getByRole("heading", { name: "Агенты" })).toBeInTheDocument();
    expect(container.querySelector(".notice")).toHaveTextContent(/не прочиталось/i);
    expect(container.querySelector(".notice")).toHaveTextContent(/HTTP 500 на \/agents\/status/);
  });

  it("не выдаёт «Core не назвал ни одного агента»: пустой список и отказ — разные вещи", () => {
    const { container } = render(
      <AgentGrid rows={[]} paused={безПаузы} now={NOW} error="таймаут" />,
    );
    expect(container.querySelector(".empty")).toBeNull();
  });

  it("не печатает сводку и системные паузы: их тоже не прочитали", () => {
    const { container } = render(
      <AgentGrid
        rows={обычныйДень}
        paused={{ schedules: true, tasks: true }}
        now={NOW}
        error="таймаут"
      />,
    );
    expect(container.querySelector(".hint")).toBeNull();
    expect(container.querySelectorAll(".agtile")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/AGENTS_TASKS_PAUSED/);
  });
});

describe("Сетка агентов: пусто", () => {
  it("пустой список говорит, что делать, а не молчит", () => {
    const { container } = render(<AgentGrid rows={[]} paused={безПаузы} now={NOW} />);
    expect(container.querySelector(".empty")).toHaveTextContent(/не назвал ни одного агента/i);
  });
});
