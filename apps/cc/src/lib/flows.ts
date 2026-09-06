import { TZ } from "@mydon/shared";
import type { FlowPhase, FlowPlayback, FlowSummary } from "./core";
import { describeLast, type Tone } from "./crons";

/**
 * Плейбэк прогона глазами владельца (волна R, R-R-5): чистые функции, которые
 * превращают ответ Core в то, что читается на экране.
 *
 * Фазы у Core уже посчитаны (`apps/core/src/routines/flows.ts`) — панель их не
 * пересчитывает и не «уточняет»: разъехавшаяся копия правила показывала бы
 * зелёное там, где ядро видит сбой. Здесь только подписи, тона и лента.
 */

/** Шесть фаз в одном порядке — владелец читает строку слева направо. */
export const PHASE_LABELS: Record<FlowPhase["name"], string> = {
  trigger: "Триггер",
  skill: "Навык",
  proposal: "Предложение",
  approval: "Согласование",
  execution: "Выполнение",
  delivery: "Доставка",
};

/**
 * Цвет фазы. `skip` — намеренно приглушённый, а не красный: «не было» это
 * ответ, а не поломка (согласования у T0 не бывает вовсе), и красный тут
 * приучил бы владельца не смотреть на красное — то же решение, что у исходов
 * на доске рутин.
 */
export const phaseTone = (s: FlowPhase["state"]): Tone =>
  s === "ok" ? "ok" : s === "warn" ? "warn" : s === "fail" ? "hot" : "muted";

/**
 * Время строки ленты — С СЕКУНДАМИ, в отличие от `hhmm` доски рутин: весь
 * прогон укладывается в секунды, и колонка одинаковых «08:00» не отвечала бы
 * на вопрос «что за чем шло».
 */
export const stamp = (iso: string): string =>
  new Date(iso).toLocaleTimeString("ru-RU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

/**
 * Фраза исхода для строки журнала прогонов.
 *
 * Считает её та же `describeLast`, что и доска рутин: подпись исхода живёт в
 * одном месте (`@mydon/shared`), и вторая её копия здесь разъехалась бы с
 * доской и ботом — урок П5a. Строка журнала отличается от строки доски двумя
 * полями, поэтому это переклад формы, а не повтор правила.
 */
export const runPhrase = (run: FlowSummary): string =>
  describeLast({
    at: run.startedAt,
    outcome: run.outcome,
    skipReason: run.skipReason,
    hook: run.hook,
    reason: run.reason,
    runId: run.id,
  });

export interface TimelineRow {
  at: string;
  kind: "event" | "audit";
  title: string;
  detail?: unknown;
}

/**
 * Лента прогона: события шины и аудит одной колонкой по времени.
 *
 * Core отдаёт их раздельно (у строк разная форма), а вопрос владельца — «что
 * происходило по порядку», и две параллельные колонки на него не отвечают:
 * пришлось бы сличать времена глазами. Источник остаётся видимым (`kind`),
 * иначе запись агента и запись человека сливались бы в один поток.
 */
export function mergeTimeline(events: FlowPlayback["events"], audit: FlowPlayback["audit"]): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...events.map((e) => ({ at: e.at, kind: "event" as const, title: e.type, detail: e.payload })),
    ...audit.map((a) => ({
      at: a.at,
      kind: "audit" as const,
      title: `${a.action}${a.actorRef ? ` · ${a.actorRef}` : ""}`,
      ...(a.target ? { detail: a.target } : {}),
    })),
  ];
  // ISO-строки Core одного формата и одной зоны, поэтому лексикографическое
  // сравнение — это сравнение по времени, без разбора дат.
  return rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Сколько символов детали помещается в строку ленты, не превращая её в простыню. */
const DETAIL_MAX = 200;

/**
 * Деталь строки ленты одной строкой.
 *
 * Строку (цель аудита — id задачи) печатаем как есть: кавычки JSON вокруг
 * `t1` — шум. Всё остальное — JSON, обрезанный по длине: payload шины бывает
 * длиной в экран, и лента переставала бы читаться как последовательность.
 * `null` вместо пустой строки — чтобы вызывающий не рисовал пустой `<code>`,
 * который читается как «деталь была, но потерялась».
 */
export function detailText(detail: unknown): string | null {
  if (detail === undefined || detail === null) return null;
  const raw = typeof detail === "string" ? detail : JSON.stringify(detail);
  if (raw === undefined || raw.length === 0) return null;
  return raw.length > DETAIL_MAX ? `${raw.slice(0, DETAIL_MAX)}…` : raw;
}
