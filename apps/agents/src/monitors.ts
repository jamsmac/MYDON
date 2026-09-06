import { Cron } from "croner";
import { TZ } from "@mydon/shared";
import { reportRun, type RunJournalClient } from "./run-journal";

/** Ключ прогона монитора: один плановый тик — одна запись даже на двух репликах. */
export function monitorRequestKey(name: string, cron: string, occurrence: Date): string {
  return `monitor:${name}:${cron}:${occurrence.toISOString()}`;
}

/**
 * Итог монитора: признак успеха ОТДЕЛЬНО от строки-отчёта.
 *
 * Признак обязателен и явен, потому что мониторы не бросают: сбор OurVend
 * возвращает `status: "failed"` обычным значением, а сверки складывают отказы
 * источников в `errors`. Пока исходом считалось «колбэк не бросил», провалившийся
 * прогон уходил в журнал как `executed`, и хук `source_fresh` признавал протухшие
 * данные свежими — ровно то, ради чего хук и написан.
 */
export interface MonitorOutcome {
  /** Работа монитора удалась. `false` — исход `failed` с той же строкой-причиной. */
  ok: boolean;
  /** Итоговая строка: она же попадает в лог и в `reason` записи журнала. */
  reason: string;
}

/**
 * Колбэк монитора под журналом (R-R-6).
 *
 * Мониторы — такие же прогоны по расписанию, как навыки агентов, только агент у
 * них «system». Итоговая строка монитора становится `reason` записи; `ok: false`
 * и исключение одинаково дают исход `failed`. Печать остаётся здесь: раньше её
 * делал каждый колбэк сам, и журнал с логом разъезжались бы по формулировкам.
 *
 * Журнал best effort (Р-1): и сбой монитора, и сбой записи наружу не всплывают —
 * cron-колбэку некому бросить ошибку, кроме unhandled rejection.
 */
export function journaledMonitor(
  name: string, cron: string, core: RunJournalClient, fn: () => Promise<MonitorOutcome>,
): (occurrence: Date) => Promise<void> {
  return async (occurrence) => {
    const startedAt = new Date();
    let outcome: "executed" | "failed" = "executed";
    let reason: string;
    try {
      const result = await fn();
      outcome = result.ok ? "executed" : "failed";
      reason = result.reason;
      // Провал монитора печатаем как ошибку: в логе крона он обязан выглядеть
      // провалом, а не обычной строкой отчёта рядом с удачными прогонами.
      if (result.ok) console.log(reason);
      else console.error(reason);
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

/**
 * Монитор на расписании под журналом: заводит cron-задание и сам держит
 * ПЛАНОВОЕ время срабатывания.
 *
 * `self.currentRun()` — фактический момент запуска, обрезанный до секунды. При
 * задержке event loop и на двух репликах он разъезжается, и одна и та же работа
 * получила бы в журнале две строки с разными `requestKey`. Поэтому плановое
 * время берём заранее из `nextRun()` — тем же приёмом, что и расписания
 * навыков в `index.ts`.
 *
 * Cron создаём здесь же: иначе этот приём пришлось бы повторять у каждого из
 * шести мониторов, и один забытый повтор был бы невидим.
 */
export function scheduleMonitor(
  name: string,
  cron: string,
  core: RunJournalClient,
  fn: () => Promise<MonitorOutcome>,
): Cron {
  const run = journaledMonitor(name, cron, core, fn);
  let expected: Date | null = null;
  const job = new Cron(cron, { timezone: TZ, name }, (self) => {
    const occurrence = expected ?? self.currentRun() ?? new Date();
    expected = self.nextRun();
    void run(occurrence);
  });
  expected = job.nextRun();
  return job;
}
