import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { RunOutcome } from "@mydon/shared";
import {
  agentSkillCatalog,
  approval as approvalTable,
  auditLog,
  event,
  outboxDelivery,
  task as taskTable,
  taskAgentExecution,
} from "@mydon/db";
import { DB, type Db } from "../db/db.module";
import { buildPhases, type FlowContext, type FlowPhase } from "./flows";
import { RunsService, type AgentRunRow } from "./runs.service";

export interface FlowSummary {
  id: string; agent: string; skill: string; trigger: string; startedAt: string; finishedAt: string;
  outcome: string; skipReason: string | null; hook: string | null; reason: string;
  action: string | null; taskId: string | null; approvalId: string | null;
}
export interface FlowPlayback {
  run: FlowSummary & { cron: string | null; scheduledAt: string | null; review: string | null; requestKey: string };
  phases: FlowPhase[];
  events: { at: string; type: string; payload: unknown }[];
  audit: { at: string; action: string; actorRef: string | null; target: string | null }[];
}

/** Окно ленты событий вокруг прогона: секунда запаса на разницу часов. */
const WINDOW_MS = 1000;
const TIMELINE_LIMIT = 50;

export function summary(r: AgentRunRow): FlowSummary {
  return {
    id: r.id,
    agent: r.agentName,
    skill: r.skill,
    trigger: r.trigger,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt.toISOString(),
    outcome: r.outcome,
    skipReason: r.skipReason,
    hook: r.hook,
    reason: r.reason,
    action: r.action,
    taskId: r.taskId,
    approvalId: r.approvalId,
  };
}

/**
 * Плейбэк прогона: собирает вокруг строки журнала всё, что о нём знает Core —
 * каталог навыков, задачу, попытку исполнения, согласование, доставки, шину и
 * аудит, — и раскладывает по фазам (`buildPhases`).
 */
@Injectable()
export class FlowsService {
  constructor(
    private readonly runs: RunsService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async list(filter: { agent?: string; skill?: string; outcome?: RunOutcome; limit?: number } = {}): Promise<FlowSummary[]> {
    return (await this.runs.list(filter)).map(summary);
  }

  async playback(id: string): Promise<FlowPlayback> {
    const run = await this.runs.byId(id);
    // `byId` отдаёт null и на неизвестный, и на непохожий на uuid идентификатор —
    // 404, а не 500 от драйвера на битом `where`.
    if (!run) throw new NotFoundException("Прогон не найден");

    const from = new Date(run.startedAt.getTime() - WINDOW_MS);
    const to = new Date(run.finishedAt.getTime() + WINDOW_MS);
    const taskId = run.taskId;

    const [catalogRows, taskRows, executionRows, eventRows] = await Promise.all([
      // Мониторы (`agentName = "system"`) в каталоге навыков не числятся — за
      // ними не ходим вовсе, иначе каждый плейбэк синка тратил бы запрос впустую.
      run.agentName === "system"
        ? Promise.resolve([])
        : this.db
            .select({ executor: agentSkillCatalog.executor, tier: agentSkillCatalog.tier })
            .from(agentSkillCatalog)
            .where(and(eq(agentSkillCatalog.agentName, run.agentName), eq(agentSkillCatalog.skill, run.skill)))
            .limit(1),
      taskId
        ? this.db.select({ id: taskTable.id, status: taskTable.status }).from(taskTable).where(eq(taskTable.id, taskId)).limit(1)
        : Promise.resolve([]),
      taskId
        ? this.db
            .select({
              id: taskAgentExecution.id,
              status: taskAgentExecution.status,
              committedAt: taskAgentExecution.committedAt,
              abandonReason: taskAgentExecution.abandonReason,
              approvalId: taskAgentExecution.approvalId,
            })
            .from(taskAgentExecution)
            .where(eq(taskAgentExecution.taskId, taskId))
            .orderBy(desc(taskAgentExecution.startedAt))
            .limit(1)
        : Promise.resolve([]),
      this.db
        .select({ at: event.occurredAt, type: event.type, payload: event.payload })
        .from(event)
        .where(and(eq(event.source, `agent:${run.agentName}`), gte(event.occurredAt, from), lte(event.occurredAt, to)))
        .orderBy(asc(event.occurredAt))
        .limit(TIMELINE_LIMIT),
    ]);

    const execution = executionRows[0] ?? null;
    // Согласование ищем по ссылке из журнала, а при её отсутствии — по попытке
    // исполнения: legacy-прогон пишет approvalId сам, durable-задача — через
    // `task_agent_execution`, и без второго источника половина плейбэков теряла
    // бы фазу согласования.
    const approvalId = run.approvalId ?? execution?.approvalId ?? null;
    const auditTargets = [taskId, approvalId].filter((t): t is string => t !== null);

    const [approvalRows, deliveryRows, auditRows] = await Promise.all([
      approvalId
        ? this.db
            .select({
              id: approvalTable.id,
              decision: approvalTable.decision,
              decidedAt: approvalTable.decidedAt,
              tier: approvalTable.tier,
              createdAt: approvalTable.createdAt,
            })
            .from(approvalTable)
            .where(eq(approvalTable.id, approvalId))
            .limit(1)
        : Promise.resolve([]),
      execution
        ? this.db
            .select({
              destination: outboxDelivery.destination,
              status: outboxDelivery.status,
              lastError: outboxDelivery.lastError,
              completedAt: outboxDelivery.completedAt,
            })
            .from(outboxDelivery)
            .where(eq(outboxDelivery.taskAgentExecutionId, execution.id))
            .orderBy(asc(outboxDelivery.createdAt))
        : Promise.resolve([]),
      auditTargets.length > 0
        ? this.db
            .select({ at: auditLog.ts, action: auditLog.action, actorRef: auditLog.actorRef, target: auditLog.target })
            .from(auditLog)
            // Окно то же, что у событий: у задачи с несколькими попытками
            // `target` один на все, и плейбэк ПЕРВОЙ показывал бы аудит третьей.
            .where(
              and(inArray(auditLog.target, auditTargets), gte(auditLog.ts, from), lte(auditLog.ts, to)),
            )
            .orderBy(asc(auditLog.ts))
            .limit(TIMELINE_LIMIT)
        : Promise.resolve([]),
    ]);

    const context: FlowContext = {
      run,
      catalog: catalogRows[0] ?? null,
      task: taskRows[0] ?? null,
      execution,
      approval: approvalRows[0] ?? null,
      deliveries: deliveryRows,
    };

    return {
      run: {
        ...summary(run),
        cron: run.cron,
        scheduledAt: run.scheduledAt?.toISOString() ?? null,
        review: run.review,
        requestKey: run.requestKey,
      },
      phases: buildPhases(context),
      events: eventRows.map((e) => ({ at: e.at.toISOString(), type: e.type, payload: e.payload })),
      audit: auditRows.map((a) => ({ at: a.at.toISOString(), action: a.action, actorRef: a.actorRef, target: a.target })),
    };
  }
}
