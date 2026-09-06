import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { isRunOutcome } from "@mydon/shared";
import { BoardService } from "./board.service";
import { FlowsService } from "./flows.service";
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

/** Общий фильтр журнала: и сырые прогоны, и плейбэк отбирают одинаково. */
function runFilter(agent: unknown, skill: unknown, outcome: unknown, limit: unknown) {
  const agentName = first(agent);
  const skillName = first(skill);
  const outcomeName = first(outcome);
  const limitRaw = first(limit);
  return {
    ...(agentName !== undefined ? { agent: agentName } : {}),
    ...(skillName !== undefined ? { skill: skillName } : {}),
    // Неизвестный исход молча отбрасываем: панель не должна получать 400
    // из-за устаревшей ссылки в закладках.
    ...(isRunOutcome(outcomeName) ? { outcome: outcomeName } : {}),
    ...(limitRaw !== undefined ? { limit: Number(limitRaw) } : {}),
  };
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
  constructor(
    private readonly runs: RunsService,
    private readonly boardService: BoardService,
    private readonly flows: FlowsService,
  ) {}

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
    const rows = await this.runs.list(runFilter(agent, skill, outcome, limit));
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

  /** Доска рутин: что сработает дальше, что сработало и что не сработает вовсе. */
  @Get("board")
  board() {
    return this.boardService.board();
  }

  /** Список прогонов в форме плейбэка (те же фильтры, что у журнала). */
  @Get("flows")
  async flowList(
    @Query("agent") agent?: unknown,
    @Query("skill") skill?: unknown,
    @Query("outcome") outcome?: unknown,
    @Query("limit") limit?: unknown,
  ) {
    return { runs: await this.flows.list(runFilter(agent, skill, outcome, limit)) };
  }

  /** Плейбэк одного прогона: шесть фаз, события шины и аудит. */
  @Get("flows/:id")
  playback(@Param("id") id: string) {
    return this.flows.playback(id);
  }
}
