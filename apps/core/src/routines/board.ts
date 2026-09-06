import { Cron } from "croner";
import { TZ } from "@mydon/shared";
import type { ScheduleSnapshot } from "./runs.service";

/**
 * Доска рутин (волна R, R-R-3): что и когда сработает, что уже сработало и
 * почему что-то не сработает вовсе.
 *
 * Чистая функция без базы: расписания приходят снимком рантайма агентов,
 * последние прогоны — журналом, пауза — тумблерами `system_config`. Считать
 * «следующий запуск» здесь, а не в рантайме, нужно потому, что снимок живёт
 * минутами, а вопрос «когда дальше» задают в любой момент.
 */
export interface CronBoardJob {
  id: string;
  kind: "skill" | "monitor";
  agent: string;
  skill: string;
  cron: string;
  mode: "durable-task" | "legacy" | "monitor";
  enabled: boolean;
  disabledReason?: string;
  paused: boolean;
  nextRun: string | null;
  last: null | { at: string; outcome: string; skipReason: string | null; hook: string | null; reason: string; runId: string };
}
export interface CronBoard {
  tz: typeof TZ;
  now: string;
  snapshot: { generatedAt: string; ageSec: number; stale: boolean } | null;
  paused: { schedules: boolean; tasks: boolean };
  jobs: CronBoardJob[];
  upcoming24h: { at: string; jobId: string }[];
}

export interface LastRunLite {
  id: string; agentName: string; skill: string; startedAt: Date; outcome: string;
  skipReason: string | null; hook: string | null; reason: string;
}
export interface BoardInput {
  now: Date;
  snapshot: { payload: ScheduleSnapshot; updatedAt: Date } | null;
  paused: { schedules: boolean; tasks: boolean };
  lastRuns: LastRunLite[];
}

export const STALE_AFTER_SEC = 900;
export const UPCOMING_LIMIT = 200;
const DAY_MS = 86_400_000;

/** Машинная причина отключения → фраза владельцу: что именно и где чинить. */
const DISABLED: Record<string, string> = {
  no_implementation: "навык не подключён: нет кода в SKILLS и нет executor: llm",
  llm_route_off: "LLM-маршрут выключен или не metered — llm-навык на cron не допущен",
  off: "выключен в .env (<NAME>_CRON=off); меняется в .env, нужен рестарт агентов",
  no_credentials: "не заданы OURVEND_ACCOUNT/OURVEND_PASSWORD",
};

/** Ближайшие срабатывания cron по Ташкенту; битое выражение — пусто, не исключение. */
export function nextOccurrences(cron: string, from: Date, limit: number): Date[] {
  try {
    const job = new Cron(cron, { timezone: TZ, paused: true });
    const runs = job.nextRuns(limit, from);
    job.stop();
    return runs;
  } catch {
    return [];
  }
}

export function computeBoard(input: BoardInput): CronBoard {
  const now = input.now;
  const snap = input.snapshot;
  const lastByKey = new Map(input.lastRuns.map((r) => [`${r.agentName}/${r.skill}`, r]));
  const jobs: CronBoardJob[] = [];
  const upcoming: { at: string; jobId: string }[] = [];
  const horizon = new Date(now.getTime() + DAY_MS);

  const push = (j: Omit<CronBoardJob, "nextRun" | "last">, includeUpcoming: boolean): void => {
    const last = lastByKey.get(j.id);
    const next = j.enabled ? nextOccurrences(j.cron, now, 1)[0] ?? null : null;
    jobs.push({
      ...j,
      nextRun: next ? next.toISOString() : null,
      last: last
        ? { at: last.startedAt.toISOString(), outcome: last.outcome, skipReason: last.skipReason, hook: last.hook, reason: last.reason, runId: last.id }
        : null,
    });
    if (j.enabled && includeUpcoming) {
      for (const at of nextOccurrences(j.cron, now, UPCOMING_LIMIT)) {
        if (at > horizon) break;
        upcoming.push({ at: at.toISOString(), jobId: j.id });
      }
    }
  };

  if (snap) {
    const p = snap.payload;
    for (const j of p.jobs) {
      // Пауза расписаний берётся из `system_config`, а не из снимка: тумблер
      // владельца действует сразу, а снимок рантайма мог сняться до правки.
      push({ id: `${j.agent}/${j.skill}`, kind: "skill", agent: j.agent, skill: j.skill, cron: j.cron, mode: j.mode, enabled: true, paused: input.paused.schedules }, !input.paused.schedules);
    }
    for (const j of p.notWired) {
      push({ id: `${j.agent}/${j.skill}`, kind: "skill", agent: j.agent, skill: j.skill, cron: "", mode: "legacy", enabled: false, disabledReason: DISABLED[j.reason] ?? j.reason, paused: input.paused.schedules }, false);
    }
    for (const m of p.monitors) {
      // Мониторы паузе агентов не подчиняются: она про навыки и задачи, а синк
      // источника продолжает идти — иначе доска обещала бы простой, которого нет.
      const reason = m.enabled ? undefined : DISABLED[m.reason ?? "off"]?.replace("<NAME>", m.name.toUpperCase().replace(/[^A-Z]/g, "_"));
      push({ id: `system/${m.name}`, kind: "monitor", agent: "system", skill: m.name, cron: m.cron, mode: "monitor", enabled: m.enabled, ...(reason ? { disabledReason: reason } : {}), paused: false }, true);
    }
  }

  upcoming.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.jobId.localeCompare(b.jobId)));
  // Выключенные — в конец: доска отвечает на вопрос «что будет», а не «что
  // числится», и мёртвые строки не должны стоять выше живых.
  jobs.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const an = a.nextRun ?? "~", bn = b.nextRun ?? "~";
    return an < bn ? -1 : an > bn ? 1 : a.id.localeCompare(b.id);
  });

  const ageSec = snap ? Math.max(0, Math.round((now.getTime() - snap.updatedAt.getTime()) / 1000)) : 0;
  return {
    tz: TZ,
    now: now.toISOString(),
    snapshot: snap ? { generatedAt: snap.payload.generatedAt, ageSec, stale: ageSec > STALE_AFTER_SEC } : null,
    paused: input.paused,
    jobs,
    upcoming24h: upcoming.slice(0, UPCOMING_LIMIT),
  };
}
