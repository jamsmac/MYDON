import { Body, Controller, Get, Post, Put, Query } from "@nestjs/common";
import type { RunOutcome } from "@mydon/shared";
import { isRunOutcome } from "@mydon/shared";
import { RunsService, snapshotFromBody, toView, type ReportRunInput } from "./runs.service";

/**
 * Рутины: журнал прогонов и снимок расписаний (волна R). Префикс /routines
 * выбран вместо /agents/…, чтобы не соревноваться с `GET /agents/:name`.
 */
@Controller("routines")
export class RoutinesController {
  constructor(private readonly runs: RunsService) {}

  @Post("runs")
  report(@Body() body: ReportRunInput) {
    return this.runs.report(body);
  }

  @Get("runs")
  async list(
    @Query("agent") agent?: string,
    @Query("skill") skill?: string,
    @Query("outcome") outcome?: string,
    @Query("limit") limit?: string,
  ) {
    const rows = await this.runs.list({
      ...(agent ? { agent } : {}),
      ...(skill ? { skill } : {}),
      ...(outcome && isRunOutcome(outcome) ? { outcome: outcome as RunOutcome } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
    return { runs: rows.map(toView) };
  }

  @Get("runs/last")
  async last(@Query("agent") agent: string, @Query("skill") skill: string) {
    const row = agent && skill ? await this.runs.last(agent, skill) : null;
    return { run: row ? toView(row) : null };
  }

  @Put("snapshot")
  putSnapshot(@Body() body: unknown) {
    return this.runs.putSnapshot(snapshotFromBody(body));
  }
}
