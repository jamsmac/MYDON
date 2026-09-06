import { reportRun, type RunJournalClient } from "./run-journal";

/** Ключ прогона монитора: один плановый тик — одна запись даже на двух репликах. */
export function monitorRequestKey(name: string, cron: string, occurrence: Date): string {
  return `monitor:${name}:${cron}:${occurrence.toISOString()}`;
}

/**
 * Колбэк монитора под журналом (R-R-6).
 *
 * Мониторы — такие же прогоны по расписанию, как навыки агентов, только агент у
 * них «system». Итоговая строка монитора становится `reason` записи, исключение —
 * исходом `failed`. Печать остаётся здесь: раньше её делал каждый колбэк сам, и
 * журнал с логом разъезжались бы по формулировкам.
 *
 * Журнал best effort (Р-1): и сбой монитора, и сбой записи наружу не всплывают —
 * cron-колбэку некому бросить ошибку, кроме unhandled rejection.
 */
export function journaledMonitor(
  name: string, cron: string, core: RunJournalClient, fn: () => Promise<string>,
): (occurrence: Date) => Promise<void> {
  return async (occurrence) => {
    const startedAt = new Date();
    let outcome: "executed" | "failed" = "executed";
    let reason: string;
    try {
      reason = await fn();
      console.log(reason);
    } catch (err) {
      outcome = "failed";
      reason = err instanceof Error ? err.message : String(err);
      console.error(`[${name}] сбой:`, err);
    }
    await reportRun(core, {
      agentName: "system", skill: name, trigger: "cron", cron, scheduledAt: occurrence.toISOString(),
      requestKey: monitorRequestKey(name, cron, occurrence), startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(), outcome, reason,
    });
  };
}
