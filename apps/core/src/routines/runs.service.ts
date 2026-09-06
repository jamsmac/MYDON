import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { Cron } from "croner";
import {
  RUN_TRIGGERS,
  TZ,
  isRunOutcome,
  isSkipReason,
  type RunOutcome,
  type RunTrigger,
  type SkipReason,
} from "@mydon/shared";
import { agentRun, agentRuntimeSnapshot } from "@mydon/db";
import { DB, type Db } from "../db/db.module";

export type AgentRunRow = typeof agentRun.$inferSelect;

export interface ReportRunInput {
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
}

export interface ScheduleSnapshot {
  generatedAt: string;
  tz: typeof TZ;
  paused: { schedules: boolean; tasks: boolean };
  jobs: { agent: string; skill: string; cron: string; mode: "durable-task" | "legacy" }[];
  notWired: { agent: string; skill: string; reason: "no_implementation" | "llm_route_off" }[];
  monitors: { name: string; cron: string; enabled: boolean; reason?: "off" | "no_credentials" }[];
}

export const SNAPSHOT_KEY = "schedules";
const REASON_MAX = 2000;
const ACTION_MAX = 500;
const REVIEW_MAX = 1000;
const LIST_MAX = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoDate(v: unknown, field: string): Date {
  const d = typeof v === "string" ? new Date(v) : new Date(NaN);
  if (!Number.isFinite(d.getTime())) throw new BadRequestException(`${field}: нужна дата ISO`);
  return d;
}
function optText(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new BadRequestException(`${field}: нужна строка`);
  return v.slice(0, max);
}
function optUuid(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new BadRequestException(`${field}: нужен uuid`);
  return v;
}

/** Проверка тела отчёта; длинные тексты режем, а не отвергаем (журнал не должен терять прогон). */
export function normalizeReport(input: ReportRunInput): typeof agentRun.$inferInsert {
  if (typeof input.agentName !== "string" || !input.agentName) throw new BadRequestException("agentName обязателен");
  if (typeof input.skill !== "string" || !input.skill) throw new BadRequestException("skill обязателен");
  if (typeof input.requestKey !== "string" || !input.requestKey) throw new BadRequestException("requestKey обязателен");
  if (!(RUN_TRIGGERS as readonly string[]).includes(input.trigger)) throw new BadRequestException("trigger: cron | task | manual");
  if (!isRunOutcome(input.outcome)) throw new BadRequestException("outcome: approval_requested | executed | skipped | failed");
  if (input.skipReason !== undefined && !isSkipReason(input.skipReason)) throw new BadRequestException("skipReason неизвестен");
  if (input.skipReason !== undefined && input.outcome !== "skipped") throw new BadRequestException("skipReason только при outcome=skipped");
  if (input.hook !== undefined && input.skipReason !== "hook_blocked") throw new BadRequestException("hook только при skipReason=hook_blocked");
  if (typeof input.reason !== "string" || !input.reason) throw new BadRequestException("reason обязателен");
  const startedAt = isoDate(input.startedAt, "startedAt");
  const finishedAt = isoDate(input.finishedAt, "finishedAt");
  if (finishedAt.getTime() < startedAt.getTime()) throw new BadRequestException("finishedAt раньше startedAt");
  return {
    agentName: input.agentName.slice(0, 64),
    skill: input.skill.slice(0, 64),
    trigger: input.trigger,
    cron: optText(input.cron, "cron", 64),
    scheduledAt: input.scheduledAt === undefined ? null : isoDate(input.scheduledAt, "scheduledAt"),
    requestKey: input.requestKey.slice(0, 300),
    traceKey: optText(input.traceKey, "traceKey", 300),
    taskId: optUuid(input.taskId, "taskId"),
    approvalId: optUuid(input.approvalId, "approvalId"),
    startedAt,
    finishedAt,
    outcome: input.outcome,
    skipReason: input.skipReason ?? null,
    hook: optText(input.hook, "hook", 64),
    reason: input.reason.slice(0, REASON_MAX),
    action: optText(input.action, "action", ACTION_MAX),
    review: optText(input.review, "review", REVIEW_MAX),
  };
}

/**
 * Значение из закрытого списка. Через `find`, а не сравнение с приведением:
 * `x.mode` в теле запроса имеет тип `unknown`, и сравнение с литералом его не
 * сужает — без этой проверки в снимок уехала бы любая строка.
 */
function oneOf<T extends string>(v: unknown, allowed: readonly T[], message: string): T {
  const hit = allowed.find((a) => a === v);
  if (hit === undefined) throw new BadRequestException(message);
  return hit;
}

function assertCron(expr: unknown, who: string): string {
  if (typeof expr !== "string" || !expr.trim()) throw new BadRequestException(`${who}: cron пуст`);
  try {
    new Cron(expr, { timezone: TZ, paused: true }).stop();
  } catch {
    throw new BadRequestException(`${who}: битое расписание «${expr}»`);
  }
  return expr;
}

/** Снимок из тела запроса: чужой tz/mode — 400, битый cron — 400 с именем задания. */
export function snapshotFromBody(body: unknown): ScheduleSnapshot {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.tz !== TZ) throw new BadRequestException(`tz должен быть ${TZ}`);
  const generatedAt = isoDate(b.generatedAt, "generatedAt").toISOString();
  const p = (b.paused ?? {}) as Record<string, unknown>;
  const paused = { schedules: p.schedules === true, tasks: p.tasks === true };
  const jobs = (Array.isArray(b.jobs) ? b.jobs : []).map((j) => {
    const x = j as Record<string, unknown>;
    if (typeof x.agent !== "string" || typeof x.skill !== "string") throw new BadRequestException("jobs[]: agent/skill");
    const mode = oneOf(x.mode, ["durable-task", "legacy"] as const, `${x.agent}/${x.skill}: mode`);
    return { agent: x.agent, skill: x.skill, cron: assertCron(x.cron, `${x.agent}/${x.skill}`), mode };
  });
  const notWired = (Array.isArray(b.notWired) ? b.notWired : []).map((j) => {
    const x = j as Record<string, unknown>;
    if (typeof x.agent !== "string" || typeof x.skill !== "string") throw new BadRequestException("notWired[]: agent/skill");
    const reason = oneOf(x.reason, ["no_implementation", "llm_route_off"] as const, `${x.agent}/${x.skill}: reason`);
    return { agent: x.agent, skill: x.skill, reason };
  });
  const monitors = (Array.isArray(b.monitors) ? b.monitors : []).map((m) => {
    const x = m as Record<string, unknown>;
    if (typeof x.name !== "string") throw new BadRequestException("monitors[]: name");
    const enabled = x.enabled === true;
    const reason = (["off", "no_credentials"] as const).find((r) => r === x.reason);
    // Выключенный монитор может нести cron "off" — его не валидируем.
    const cron = enabled ? assertCron(x.cron, `system/${x.name}`) : String(x.cron ?? "");
    return { name: x.name, cron, enabled, ...(reason ? { reason } : {}) };
  });
  return { generatedAt, tz: TZ, paused, jobs, notWired, monitors };
}

export interface AgentRunView {
  id: string; agentName: string; skill: string; trigger: string; cron: string | null; scheduledAt: string | null;
  requestKey: string; taskId: string | null; approvalId: string | null; startedAt: string; finishedAt: string;
  outcome: string; skipReason: string | null; hook: string | null; reason: string; action: string | null; review: string | null;
}

export function toView(r: AgentRunRow): AgentRunView {
  return {
    id: r.id, agentName: r.agentName, skill: r.skill, trigger: r.trigger, cron: r.cron,
    scheduledAt: r.scheduledAt?.toISOString() ?? null, requestKey: r.requestKey, taskId: r.taskId,
    approvalId: r.approvalId, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt.toISOString(),
    outcome: r.outcome, skipReason: r.skipReason, hook: r.hook, reason: r.reason, action: r.action, review: r.review,
  };
}

/** Сырая строка `execute` (snake_case) → форма `$inferSelect`. */
export function rowFromRaw(r: Record<string, unknown>): AgentRunRow {
  const d = (v: unknown): Date | null => (v instanceof Date ? v : typeof v === "string" ? new Date(v) : null);
  return {
    id: String(r.id), agentName: String(r.agent_name), skill: String(r.skill), trigger: String(r.trigger),
    cron: (r.cron as string | null) ?? null, scheduledAt: d(r.scheduled_at), requestKey: String(r.request_key),
    traceKey: (r.trace_key as string | null) ?? null, taskId: (r.task_id as string | null) ?? null,
    approvalId: (r.approval_id as string | null) ?? null, startedAt: d(r.started_at)!, finishedAt: d(r.finished_at)!,
    outcome: String(r.outcome), skipReason: (r.skip_reason as string | null) ?? null, hook: (r.hook as string | null) ?? null,
    reason: String(r.reason), action: (r.action as string | null) ?? null, review: (r.review as string | null) ?? null,
    createdAt: d(r.created_at)!,
  };
}

@Injectable()
export class RunsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Идемпотентно по requestKey: повтор обновляет поля исхода (реплика/повтор тика). */
  async report(input: ReportRunInput): Promise<{ id: string; created: boolean }> {
    const row = normalizeReport(input);
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(agentRun).where(eq(agentRun.requestKey, row.requestKey)).limit(1);
      if (existing) {
        const { requestKey: _k, agentName: _a, skill: _s, trigger: _t, startedAt: _st, ...patch } = row;
        await tx.update(agentRun).set(patch).where(eq(agentRun.id, existing.id)).returning();
        return { id: existing.id, created: false };
      }
      const [created] = await tx.insert(agentRun).values(row).returning();
      return { id: created!.id, created: true };
    });
  }

  async list(filter: { agent?: string; skill?: string; outcome?: RunOutcome; limit?: number } = {}): Promise<AgentRunRow[]> {
    const conds = [
      ...(filter.agent ? [eq(agentRun.agentName, filter.agent)] : []),
      ...(filter.skill ? [eq(agentRun.skill, filter.skill)] : []),
      ...(filter.outcome ? [eq(agentRun.outcome, filter.outcome)] : []),
    ];
    // `limit` приходит из строки запроса через Number(): «abc» даёт NaN, «10.5» —
    // дробь. И то и другое ушло бы в `limit $1` и вернуло владельцу 500 от
    // драйвера вместо журнала, поэтому приводим к целому здесь, у границы.
    const asked = typeof filter.limit === "number" && Number.isFinite(filter.limit) ? Math.trunc(filter.limit) : 50;
    const limit = Math.min(Math.max(asked, 1), LIST_MAX);
    const q = this.db.select().from(agentRun);
    return (conds.length ? q.where(and(...conds)) : q).orderBy(desc(agentRun.startedAt)).limit(limit);
  }

  async last(agent: string, skill: string): Promise<AgentRunRow | null> {
    const [row] = await this.db.select().from(agentRun)
      .where(and(eq(agentRun.agentName, agent), eq(agentRun.skill, skill)))
      .orderBy(desc(agentRun.startedAt)).limit(1);
    return row ?? null;
  }

  async byId(id: string): Promise<AgentRunRow | null> {
    if (!UUID_RE.test(id)) return null;
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * Последний прогон каждого задания — одной выборкой (`distinct on`, как
   * `lastRunsBySkill` в agents.service). Драйвер postgres-js отдаёт массив
   * строк со snake_case-колонками и `Date` для timestamptz.
   */
  async lastPerJob(): Promise<AgentRunRow[]> {
    const raw = (await this.db.execute(sql`
      select distinct on (${agentRun.agentName}, ${agentRun.skill}) ${agentRun}.*
      from ${agentRun}
      order by ${agentRun.agentName}, ${agentRun.skill}, ${agentRun.startedAt} desc
    `)) as unknown as Record<string, unknown>[];
    return raw.map(rowFromRaw);
  }

  async putSnapshot(snapshot: ScheduleSnapshot): Promise<{ storedAt: string }> {
    const storedAt = new Date();
    await this.db.insert(agentRuntimeSnapshot)
      .values({ key: SNAPSHOT_KEY, payload: snapshot as unknown as Record<string, unknown>, updatedAt: storedAt })
      .onConflictDoUpdate({ target: agentRuntimeSnapshot.key, set: { payload: snapshot as unknown as Record<string, unknown>, updatedAt: storedAt } });
    return { storedAt: storedAt.toISOString() };
  }

  async snapshot(): Promise<{ payload: ScheduleSnapshot; updatedAt: Date } | null> {
    const [row] = await this.db.select().from(agentRuntimeSnapshot).where(eq(agentRuntimeSnapshot.key, SNAPSHOT_KEY)).limit(1);
    return row ? { payload: row.payload as unknown as ScheduleSnapshot, updatedAt: row.updatedAt } : null;
  }
}
