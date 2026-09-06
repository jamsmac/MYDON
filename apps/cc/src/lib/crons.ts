import { TZ, describeRun, isRunOutcome, isSkipReason } from "@mydon/shared";
import type { CronBoard, CronBoardJob } from "./core";

/**
 * Доска рутин глазами владельца (волна R, R-R-3): время по Ташкенту, разбивка
 * ближайших запусков по дням и одна фраза про прошлый исход.
 *
 * Чистые функции без Core и без React: их проверяет тест, а страница только
 * рисует. Всё считается ОТ `board.now` (времени Core), а не от часов панели —
 * иначе «сегодня» на экране и «сегодня» в снимке разъезжались бы на границе
 * суток и владелец видел бы завтрашние запуски под заголовком «Сегодня».
 */
const DAY_MS = 86_400_000;

export const hhmm = (iso: string): string =>
  new Date(iso).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Ключ календарного дня по Ташкенту: en-CA даёт ровно YYYY-MM-DD. */
const dayKey = (d: Date): string => d.toLocaleDateString("en-CA", { timeZone: TZ });

export interface UpcomingRow {
  at: string;
  time: string;
  job: CronBoardJob;
}

export function groupUpcoming(
  board: CronBoard,
  now: Date,
): { today: UpcomingRow[]; tomorrow: UpcomingRow[]; later: UpcomingRow[] } {
  const byId = new Map(board.jobs.map((j) => [j.id, j]));
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + DAY_MS));
  const out = { today: [] as UpcomingRow[], tomorrow: [] as UpcomingRow[], later: [] as UpcomingRow[] };
  for (const u of board.upcoming24h) {
    const job = byId.get(u.jobId);
    // Задания нет в доске — строку не рисуем: время без ответа на вопрос «чего
    // именно» владельцу бесполезно, а исчезнуть задание между списками может.
    if (!job) continue;
    const row = { at: u.at, time: hhmm(u.at), job };
    const k = dayKey(new Date(u.at));
    (k === today ? out.today : k === tomorrow ? out.tomorrow : out.later).push(row);
  }
  return out;
}

/**
 * «Сегодня» / «Завтра» / дата — для строк, вырванных из-под заголовка дня
 * (виджет главной показывает первые пять запусков подряд, без разбивки).
 */
export function dayLabel(iso: string, now: Date): string {
  const k = dayKey(new Date(iso));
  if (k === dayKey(now)) return "сегодня";
  if (k === dayKey(new Date(now.getTime() + DAY_MS))) return "завтра";
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit" });
}

/**
 * «Когда» одной строкой: день плюс время.
 *
 * Голое «08:00» у недельного или месячного расписания читается как «сегодня» —
 * а до запуска может быть неделя. Время без дня имеет право стоять только под
 * заголовком дня («Сегодня»/«Завтра»), везде ещё — эта форма.
 */
export const runWhen = (iso: string, now: Date): string => `${dayLabel(iso, now)} ${hhmm(iso)}`;

export type Tone = "ok" | "warn" | "muted" | "hot";

/**
 * Цвет исхода. «Пропущено» — НЕ тревога: повода не было, делать нечего, и
 * красный тут приучил бы владельца не смотреть на красное.
 */
export function outcomeTone(last: { outcome: string } | null): Tone {
  if (!last) return "muted";
  return last.outcome === "executed"
    ? "ok"
    : last.outcome === "approval_requested"
      ? "warn"
      : last.outcome === "failed"
        ? "hot"
        : "muted";
}

/**
 * Одна фраза о прошлом прогоне. Словарь исходов общий с ботом и Core
 * (`@mydon/shared`): три копии одной подписи разъезжаются — урок П5a.
 * Исход не из словаря (чужая или будущая запись журнала) показываем причиной,
 * а не пустотой: доска не должна падать из-за одного слова.
 */
export function describeLast(last: CronBoardJob["last"]): string {
  if (!last) return "ещё не запускался";
  if (!isRunOutcome(last.outcome)) return last.reason;
  return describeRun({
    outcome: last.outcome,
    skipReason: isSkipReason(last.skipReason) ? last.skipReason : null,
    hook: last.hook,
    reason: last.reason,
  });
}

/** Плейбэк прогонов этого задания: те же фильтры, что у журнала `/routines/flows`. */
export const flowsHref = (job: Pick<CronBoardJob, "agent" | "skill">): string =>
  `/flows?${new URLSearchParams({ agent: job.agent, skill: job.skill }).toString()}`;
