import { Body, Controller, Get, Post, Put, Query, UseGuards } from "@nestjs/common";
import { isRunOutcome } from "@mydon/shared";
import { RoutinesTokenGuard } from "./routines-token.guard";
import { RunsService, snapshotFromBody, toView, type ReportRunInput } from "./runs.service";

/**
 * Повторённый параметр (`?agent=a&agent=b`) приходит из express массивом, а не
 * строкой: без этого фильтр уехал бы в `eq(column, ["a","b"])` и вернул 500.
 */
function first(v: unknown): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

/**
 * Рутины: журнал прогонов и снимок расписаний (волна R). Префикс /routines
 * выбран вместо /agents/…, чтобы не соревноваться с `GET /agents/:name`.
 *
 * Guard на классе требует сервисный токен и на чтение: глобальный
 * `ServiceTokenGuard` GET пропускает, а журнал открывать анонимно нельзя.
 */
@Controller("routines")
@UseGuards(RoutinesTokenGuard)
export class RoutinesController {
  constructor(private readonly runs: RunsService) {}

  @Post("runs")
  report(@Body() body: ReportRunInput) {
    return this.runs.report(body);
  }

  @Get("runs")
  async list(
    @Query("agent") agent?: unknown,
    @Query("skill") skill?: unknown,
    @Query("outcome") outcome?: unknown,
    @Query("limit") limit?: unknown,
  ) {
    const agentName = first(agent);
    const skillName = first(skill);
    const outcomeName = first(outcome);
    const limitRaw = first(limit);
    const rows = await this.runs.list({
      ...(agentName !== undefined ? { agent: agentName } : {}),
      ...(skillName !== undefined ? { skill: skillName } : {}),
      // Неизвестный исход молча отбрасываем: панель не должна получать 400
      // из-за устаревшей ссылки в закладках.
      ...(isRunOutcome(outcomeName) ? { outcome: outcomeName } : {}),
      ...(limitRaw !== undefined ? { limit: Number(limitRaw) } : {}),
    });
    return { runs: rows.map(toView) };
  }

  @Get("runs/last")
  async last(@Query("agent") agent?: unknown, @Query("skill") skill?: unknown) {
    const agentName = first(agent);
    const skillName = first(skill);
    const row = agentName && skillName ? await this.runs.last(agentName, skillName) : null;
    return { run: row ? toView(row) : null };
  }

  @Put("snapshot")
  putSnapshot(@Body() body: unknown) {
    return this.runs.putSnapshot(snapshotFromBody(body));
  }
}
