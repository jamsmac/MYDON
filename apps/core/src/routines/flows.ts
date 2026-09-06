import { RUN_SKIP_REASONS, TZ, isSkipReason } from "@mydon/shared";
import type { AgentRunRow } from "./runs.service";

/**
 * Плейбэк прогона (волна R, R-R-5): шесть фаз от повода до доставки.
 *
 * Фазы всегда шесть и всегда в одном порядке — владелец читает строку слева
 * направо и видит, ГДЕ оборвалось. «Не было» — это тоже ответ (`skip`), а не
 * пропущенная колонка: исчезнувшая фаза читалась бы как «всё прошло».
 */
export type PhaseState = "ok" | "warn" | "fail" | "skip";
export type PhaseName = "trigger" | "skill" | "proposal" | "approval" | "execution" | "delivery";
export interface FlowPhase { name: PhaseName; state: PhaseState; at?: string; title: string; note?: string; href?: string }

export interface FlowContext {
  run: AgentRunRow;
  catalog: { executor: string; tier: string | null } | null;
  task: { id: string; status: string } | null;
  execution: { id: string; status: string; committedAt: Date | null; abandonReason: string | null } | null;
  approval: { id: string; decision: string; decidedAt: Date | null; tier: string; createdAt: Date } | null;
  deliveries: { destination: string; status: string; lastError: string | null; completedAt: Date | null }[];
}

const hhmm = (d: Date): string => d.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export function buildPhases(c: FlowContext): FlowPhase[] {
  const r = c.run;
  const trigger: FlowPhase =
    r.trigger === "cron"
      ? { name: "trigger", state: "ok", at: (r.scheduledAt ?? r.startedAt).toISOString(), title: `cron ${r.cron ?? "?"}${r.scheduledAt ? ` · план ${hhmm(r.scheduledAt)}` : ""}` }
      : r.trigger === "manual"
        ? { name: "trigger", state: "ok", at: r.startedAt.toISOString(), title: "вручную с деки навыков" }
        : { name: "trigger", state: "ok", at: r.startedAt.toISOString(), title: `задача ${r.taskId ? r.taskId.slice(0, 8) : "?"}${r.cron ? ` · cron ${r.cron}` : ""}` };

  // Монитор в каталоге навыков не числится — это не «навык вне каталога», а
  // системная работа; без этой ветки плейбэк синка всегда светился бы жёлтым.
  const skill: FlowPhase =
    r.agentName === "system"
      ? { name: "skill", state: "ok", title: `${r.skill} · системный монитор` }
      : c.catalog
        ? { name: "skill", state: "ok", title: `${r.skill} · ${c.catalog.executor}${c.catalog.tier ? ` · ${c.catalog.tier}` : ""}` }
        : { name: "skill", state: "warn", title: r.skill, note: "навык не в каталоге — агенты не отчитались о нём" };

  let proposal: FlowPhase;
  if (r.outcome === "failed") proposal = { name: "proposal", state: "fail", at: r.finishedAt.toISOString(), title: "сбой", note: r.reason };
  else if (r.outcome === "skipped") {
    // Подпись словаря, а не сырой `skip_reason`: владельцу нужен ответ словами.
    // У `hook_blocked` подпись общая на все хуки, поэтому имя хука подставляем.
    const note = r.skipReason === "hook_blocked" ? `хук ${r.hook ?? "?"}: ${r.reason}` : isSkipReason(r.skipReason) ? RUN_SKIP_REASONS[r.skipReason].label : r.reason;
    proposal = { name: "proposal", state: "skip", at: r.finishedAt.toISOString(), title: "предложения нет", note };
  } else proposal = { name: "proposal", state: "ok", at: r.finishedAt.toISOString(), title: r.action ?? "предложение", ...(r.action ? {} : { note: r.reason }) };

  let approval: FlowPhase;
  if (c.approval) {
    const a = c.approval;
    approval =
      a.decision === "pending"
        ? { name: "approval", state: "warn", at: a.createdAt.toISOString(), title: `ждёт решения с ${hhmm(a.createdAt)} · ${a.tier}`, href: "/inbox" }
        : a.decision === "approved"
          ? { name: "approval", state: "ok", at: (a.decidedAt ?? a.createdAt).toISOString(), title: `одобрено · ${a.tier}` }
          : { name: "approval", state: "fail", at: (a.decidedAt ?? a.createdAt).toISOString(), title: `${a.decision} · ${a.tier}` };
  } else approval = { name: "approval", state: "skip", title: r.outcome === "executed" ? "без согласования (T0/T1)" : "согласования не было" };

  let execution: FlowPhase;
  if (c.execution) {
    const e = c.execution;
    const href = c.task ? `/tasks/${c.task.id}` : undefined;
    // Статусов у попытки ровно четыре (`task_agent_execution_status`):
    // committed — сделано, abandoned — брошено (это провал), active и ready —
    // работа ещё идёт. Пятого («blocked») в перечислении нет, и ветка под него
    // была бы мёртвым кодом, который читается как поддержанный случай.
    execution =
      e.status === "committed"
        ? { name: "execution", state: "ok", ...(e.committedAt ? { at: e.committedAt.toISOString() } : {}), title: "результат зафиксирован Core", ...(href ? { href } : {}) }
        : e.status === "abandoned"
          ? { name: "execution", state: "fail", title: e.status, ...(e.abandonReason ? { note: e.abandonReason } : {}), ...(href ? { href } : {}) }
          : { name: "execution", state: "warn", title: `выполнение: ${e.status}`, ...(href ? { href } : {}) };
  } else if (r.outcome === "executed") execution = { name: "execution", state: "ok", at: r.finishedAt.toISOString(), title: "выполнено напрямую" };
  else execution = { name: "execution", state: "skip", title: "выполнения не было", ...(c.task ? { href: `/tasks/${c.task.id}` } : {}) };

  let delivery: FlowPhase;
  if (c.deliveries.length === 0) delivery = { name: "delivery", state: "skip", title: "нет доставок" };
  else {
    const bad = c.deliveries.find((d) => d.status === "failed" || d.status === "dead");
    const open = c.deliveries.find((d) => d.status === "pending" || d.status === "claimed" || d.status === "dispatching");
    const list = c.deliveries.map((d) => `${d.destination} ${d.status === "delivered" ? "✓" : d.status}`).join(", ");
    delivery = bad
      ? { name: "delivery", state: "fail", title: list, ...(bad.lastError ? { note: bad.lastError } : {}) }
      : open
        ? { name: "delivery", state: "warn", title: list }
        : { name: "delivery", state: "ok", title: list };
  }
  return [trigger, skill, proposal, approval, execution, delivery];
}
