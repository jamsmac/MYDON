import type { RunOutcome, RunTrigger, SkipReason } from "@mydon/shared";

/**
 * Одна запись журнала прогонов (тело `POST /routines/runs`, волна R).
 *
 * Тип-алиас, а не `interface`, СОЗНАТЕЛЬНО: у интерфейса нет неявной индексной
 * сигнатуры, и подставной клиент журнала с параметром `Record<string, unknown>`
 * (так удобнее всего писать тесты мониторов) не сходился бы по типам.
 */
export type RunJournalEntry = {
  agentName: string;
  skill: string;
  trigger: RunTrigger;
  cron?: string;
  scheduledAt?: string;
  requestKey: string;
  traceKey?: string;
  taskId?: string;
  approvalId?: string;
  startedAt: string;
  finishedAt: string;
  outcome: RunOutcome;
  skipReason?: SkipReason;
  hook?: string;
  reason: string;
  action?: string;
  review?: string;
};

/** Ровно то, что журналу нужно от Core: одна запись прогона. */
export interface RunJournalClient {
  reportRun(entry: RunJournalEntry): Promise<{ id: string; created: boolean }>;
}

/**
 * Запись прогона в Core — best effort (Р-1).
 *
 * Журнал — наблюдение за работой, а не сама работа: недоступный Core не должен
 * стоить владельцу выполненного навыка. Поэтому ошибка записи гасится в warn, а
 * не всплывает в путь навыка.
 */
export async function reportRun(core: RunJournalClient, entry: RunJournalEntry): Promise<void> {
  try {
    await core.reportRun(entry);
  } catch (err) {
    console.warn(
      `[journal] прогон ${entry.agentName}/${entry.skill} не записан: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Результат навыка в том виде, в каком его знает журнал (форма `RunResult`). */
export interface RunLike {
  agent: string;
  skill: string;
  outcome: "approval_requested" | "executed" | "skipped";
  skipReason?: SkipReason;
  hook?: string;
  reason: string;
  approvalId?: string;
  action?: string;
  review?: string;
}

/** Обстоятельства прогона: кто его вызвал, когда и по какому ключу. */
export interface RunFrame {
  trigger: RunTrigger;
  cron?: string;
  scheduledAt?: Date;
  requestKey: string;
  traceKey?: string;
  taskId?: string;
  startedAt: Date;
  finishedAt: Date;
  /** Для ошибки (без RunResult) — кто запускался. */
  agentName?: string;
  skill?: string;
}

/**
 * Запись журнала из результата навыка либо из перехваченной ошибки.
 *
 * Ошибка — единственный источник исхода `failed`: сам навык его не возвращает,
 * и без этой ветки сорвавшийся прогон не оставлял бы в журнале следа вообще.
 */
export function journalFromRunResult(result: RunLike | Error, frame: RunFrame): RunJournalEntry {
  const base = {
    trigger: frame.trigger,
    ...(frame.cron !== undefined ? { cron: frame.cron } : {}),
    ...(frame.scheduledAt !== undefined ? { scheduledAt: frame.scheduledAt.toISOString() } : {}),
    requestKey: frame.requestKey,
    ...(frame.traceKey !== undefined ? { traceKey: frame.traceKey } : {}),
    ...(frame.taskId !== undefined ? { taskId: frame.taskId } : {}),
    startedAt: frame.startedAt.toISOString(),
    finishedAt: frame.finishedAt.toISOString(),
  };
  if (result instanceof Error) {
    return {
      ...base,
      agentName: frame.agentName ?? "?",
      skill: frame.skill ?? "?",
      outcome: "failed",
      reason: result.message || String(result),
    };
  }
  return {
    ...base,
    agentName: result.agent,
    skill: result.skill,
    outcome: result.outcome,
    // Core отвергает skipReason не при `skipped` и hook не при `hook_blocked` —
    // условия здесь повторяют его правила, чтобы журнал не терял прогон на 400.
    ...(result.outcome === "skipped" && result.skipReason !== undefined
      ? { skipReason: result.skipReason }
      : {}),
    ...(result.skipReason === "hook_blocked" && result.hook !== undefined
      ? { hook: result.hook }
      : {}),
    reason: result.reason,
    ...(result.approvalId !== undefined ? { approvalId: result.approvalId } : {}),
    ...(result.action !== undefined ? { action: result.action } : {}),
    ...(result.review !== undefined ? { review: result.review } : {}),
  };
}
