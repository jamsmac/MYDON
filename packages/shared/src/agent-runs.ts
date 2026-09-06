/**
 * Исходы прогонов навыков и мониторов (волна R, Р-8).
 *
 * Один словарь на три приложения: рантайм пишет значения в журнал `agent_run`,
 * Core их валидирует, панель показывает подписи. Так «навык промолчал»
 * превращается в понятную владельцу фразу с подсказкой, что делать.
 */
export const RUN_OUTCOMES = ["approval_requested", "executed", "skipped", "failed"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const SKIP_REASONS = [
  "inactive",
  "not_implemented",
  "no_signal",
  "capped",
  "no_change",
  "budget_denied",
  "execution_unknown",
  "workflow_changed",
  "ledger_unavailable",
  "llm_failed",
  "llm_invalid_output",
  "hook_blocked",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const RUN_TRIGGERS = ["cron", "task", "manual"] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export function isRunOutcome(v: unknown): v is RunOutcome {
  return typeof v === "string" && (RUN_OUTCOMES as readonly string[]).includes(v);
}
export function isSkipReason(v: unknown): v is SkipReason {
  return typeof v === "string" && (SKIP_REASONS as readonly string[]).includes(v);
}

export const RUN_OUTCOME_LABELS: Record<RunOutcome, string> = {
  approval_requested: "предложение отправлено",
  executed: "выполнено",
  skipped: "пропущено",
  failed: "сбой",
};

/** Подпись причины и подсказка владельцу: что это значит и надо ли что-то делать. */
export const RUN_SKIP_REASONS: Record<SkipReason, { label: string; hint: string }> = {
  inactive: { label: "агент не активен", hint: "Статус агента не active — включи его в карточке или убери расписание." },
  not_implemented: { label: "навык не подключён", hint: "Нет кода в SKILLS и нет executor: llm — навык нечем исполнить." },
  no_signal: { label: "повода нет", hint: "По данным Core предлагать нечего. Это нормально — делать ничего не нужно." },
  capped: { label: "потолок действий", hint: "Дневной лимит действий агента исчерпан — продолжит завтра по Ташкенту." },
  no_change: { label: "без изменений", hint: "Повод тот же, что в прошлый раз — предложение не повторяется." },
  budget_denied: { label: "бюджет исчерпан", hint: "Дневной бюджет LLM агента кончился — подними лимит в карточке или подожди сутки." },
  execution_unknown: { label: "исход неизвестен", hint: "Провайдер не подтвердил результат — задача заблокирована до повтора владельцем." },
  workflow_changed: { label: "план изменился", hint: "Навык поменял workflow между попытками — нужен явный повтор." },
  ledger_unavailable: { label: "LLM-ledger недоступен", hint: "Платный вызов не сделан: Core не принял учёт трат. Проверь /system." },
  llm_failed: { label: "модель не ответила", hint: "Провайдер вернул ошибку — проверь ключ и маршрут в /system." },
  llm_invalid_output: { label: "ответ не по контракту", hint: "Модель ответила не в формате навыка — проверь промпт навыка." },
  hook_blocked: { label: "остановлено хуком", hint: "Сработал pre_run-хук паспорта (свежесть источника, тихие часы или неизвестный kind)." },
};

export interface RunDescription {
  outcome: RunOutcome;
  skipReason?: SkipReason | null;
  hook?: string | null;
  reason: string;
}

/** Одна фраза для строки доски/списка: «пропущено: повода нет — …». */
export function describeRun(r: RunDescription): string {
  if (r.outcome === "skipped") {
    if (r.skipReason === "hook_blocked") return `остановлено хуком ${r.hook ?? "?"} — ${r.reason}`;
    const label = r.skipReason ? RUN_SKIP_REASONS[r.skipReason].label : "причина не указана";
    return `пропущено: ${label} — ${r.reason}`;
  }
  return `${RUN_OUTCOME_LABELS[r.outcome]} — ${r.reason}`;
}
