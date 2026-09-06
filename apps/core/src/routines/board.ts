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
  /**
   * Ключ СТРОКИ доски, а не задания: у навыка с двумя расписаниями строк две
   * (`агент/навык@cron`), у монитора и у неподключённого навыка — одна
   * (`агент/навык`). Идентификатор задания для ссылок — пара `agent`+`skill`;
   * `id` годится только на ключ списка и на связку с `upcoming24h`.
   */
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

/**
 * Машинная причина отключения → фраза владельцу: что именно и где чинить.
 *
 * ЭКСПОРТИРУЕТСЯ ради панели «Приложения» (`apps/apps-health.service.ts`):
 * один код причины обязан нести в системе один текст. Своя формулировка там
 * означала бы, что доска рутин и здоровье приложений объясняют одно и то же
 * выключение разными словами — и владелец пошёл бы чинить не туда.
 */
export const DISABLED: Record<string, string> = {
  no_implementation: "навык не подключён: нет кода в SKILLS и нет executor: llm",
  llm_route_off: "LLM-маршрут выключен или не metered — llm-навык на cron не допущен",
  inactive_agent: "агент не активен: расписание не запускается",
  off: "выключен в .env (<NAME>_CRON=off); меняется в .env, нужен рестарт агентов",
  no_credentials: "не заданы OURVEND_ACCOUNT/OURVEND_PASSWORD",
};

/**
 * Причина отключения монитора словами: `<NAME>` в шаблоне подставляется именем
 * самого монитора, поэтому фраза называет КОНКРЕТНУЮ переменную окружения.
 *
 * Незнакомая причина не ОБНУЛЯЕТ объяснение: сырое слово из снимка хуже фразы,
 * но несравнимо лучше пустоты, на которую владелец задаст тот же вопрос
 * «почему выключен?».
 */
export function disabledReasonText(reason: string | undefined, monitorName: string): string {
  const key = reason ?? "off";
  return DISABLED[key]?.replace("<NAME>", monitorName.toUpperCase().replace(/[^A-Z]/g, "_")) ?? key;
}

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
    // Прошлый прогон ищем по паре агент/навык, а НЕ по `id` строки: журнал
    // помнит последний прогон навыка, а не расписания, и у навыка с двумя
    // расписаниями обе строки показывают один и тот же последний исход.
    const last = lastByKey.get(`${j.agent}/${j.skill}`);
    // Один разбор cron на задание: «когда дальше» — это ПЕРВЫЙ элемент того же
    // списка, из которого набираются ближайшие сутки. Два вызова croner (limit 1
    // и limit 200) считали одно и то же дважды и могли разойтись между собой.
    const occurrences = j.enabled ? nextOccurrences(j.cron, now, UPCOMING_LIMIT) : [];
    const next = occurrences[0] ?? null;
    jobs.push({
      ...j,
      nextRun: next ? next.toISOString() : null,
      last: last
        ? { at: last.startedAt.toISOString(), outcome: last.outcome, skipReason: last.skipReason, hook: last.hook, reason: last.reason, runId: last.id }
        : null,
    });
    if (includeUpcoming) {
      for (const at of occurrences) {
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
      //
      // Cron в ключе строки обязателен: рантайм дедуплицирует задания по тройке
      // агент+навык+cron, и у навыка с двумя расписаниями (например «утром» и
      // «вечером») строк на доске тоже две. С ключом без cron они получали бы
      // ОДИН `id` — а по нему панель и связывает «Ближайшие 24 ч» со строкой
      // таблицы и раздаёт ключи списка React.
      push({ id: `${j.agent}/${j.skill}@${j.cron}`, kind: "skill", agent: j.agent, skill: j.skill, cron: j.cron, mode: j.mode, enabled: true, paused: input.paused.schedules }, !input.paused.schedules);
    }
    // Неподключённый навык приходит БЕЗ cron: расписаний у него может быть
    // сколько угодно, а сказать о нём нечего, кроме причины — поэтому строка
    // одна на пару агент/навык, и повторы снимка её не размножают.
    const wiredOff = new Set<string>();
    for (const j of p.notWired) {
      const id = `${j.agent}/${j.skill}`;
      if (wiredOff.has(id)) continue;
      wiredOff.add(id);
      push({ id, kind: "skill", agent: j.agent, skill: j.skill, cron: "", mode: "legacy", enabled: false, disabledReason: DISABLED[j.reason] ?? j.reason, paused: input.paused.schedules }, false);
    }
    for (const m of p.monitors) {
      // Мониторы паузе агентов не подчиняются: она про навыки и задачи, а синк
      // источника продолжает идти — иначе доска обещала бы простой, которого нет.
      // Причина отключения — общей функцией с панелью «Приложения»
      // (`disabledReasonText`), включая фолбэк на сырое слово из снимка.
      const reason = m.enabled ? undefined : disabledReasonText(m.reason, m.name);
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
