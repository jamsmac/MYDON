import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RUN_OUTCOMES, isRunOutcome, type RunOutcome } from "@mydon/shared";
import { first } from "../common/query-param";
import { BoardService } from "./board.service";
import { FlowsService } from "./flows.service";
import { RoutinesTokenGuard } from "./routines-token.guard";
import {
  LIST_MAX,
  RunsService,
  snapshotFromBody,
  toView,
  type ReportRunInput,
} from "./runs.service";

/**
 * Исход прогона из строки запроса. Чужое значение — 400 со списком допустимых,
 * а НЕ тихо отброшенный фильтр (волна A1, отложенный пакет).
 *
 * Прежде неизвестный исход молча выпадал из фильтра ради устаревших закладок —
 * и `?outcome=ok` возвращал ВЕСЬ журнал под видом отфильтрованного. Такой
 * ответ выглядит здоровым и врёт; 400 честнее пустого экрана и тем более
 * полного. Ровно так же поступает лента событий с `?order=` (`@IsIn`).
 * Панель `/flows` пустой `outcome` в Core не шлёт: `?outcome=` она считает
 * отсутствием фильтра ещё у себя (`pick` в `apps/cc/src/app/flows/page.tsx`),
 * а выбор в форме ограничен `RUN_OUTCOMES`.
 */
function runOutcome(v: unknown): RunOutcome | undefined {
  const raw = first(v);
  if (raw === undefined) return undefined;
  if (!isRunOutcome(raw)) throw new BadRequestException(`outcome: ${RUN_OUTCOMES.join(" | ")}`);
  return raw;
}

/**
 * Предел страницы журнала. Вне рамок — 400, а не тихое схлопывание до потолка.
 *
 * До волны A1 `/routines/runs?limit=5000` молча отдавал 200 строк, тогда как
 * `/events?limit=500` отвечал 400: одно и то же превышение на соседних
 * маршрутах значило разное, и вызывающий не мог знать, полный ли перед ним
 * ответ. Выровнено по более честному поведению — тому, что сообщает о
 * непонятом запросе. Потолок общий с `RunsService.list`, чтобы рамка была
 * одна на границу и на сервис.
 */
function pageLimit(v: unknown): number | undefined {
  const raw = first(v);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > LIST_MAX) {
    throw new BadRequestException(`limit: целое от 1 до ${LIST_MAX}`);
  }
  return n;
}

/** Общий фильтр журнала: и сырые прогоны, и плейбэк отбирают одинаково. */
function runFilter(agent: unknown, skill: unknown, outcome: unknown, limit: unknown) {
  const agentName = first(agent);
  const skillName = first(skill);
  const outcomeName = runOutcome(outcome);
  const limitValue = pageLimit(limit);
  return {
    ...(agentName !== undefined ? { agent: agentName } : {}),
    ...(skillName !== undefined ? { skill: skillName } : {}),
    ...(outcomeName !== undefined ? { outcome: outcomeName } : {}),
    ...(limitValue !== undefined ? { limit: limitValue } : {}),
  };
}

/**
 * Граница окна журнала. Битую дату отвергаем словами: `Invalid Date` уехал бы
 * в `started_at >= $1` и вернул 500 от драйвера, а молчаливый пропуск границы
 * соврал бы владельцу пустотой в его окне. Разбор — как в `normalizeReport`.
 */
function windowDate(v: unknown, field: string): Date | undefined {
  const raw = first(v);
  if (raw === undefined) return undefined;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) throw new BadRequestException(`${field}: нужна дата ISO`);
  return d;
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

  /** Журнал прогонов; `from`/`to` — окно по началу прогона (волна A1). */
  @Get("runs")
  async list(
    @Query("agent") agent?: unknown,
    @Query("skill") skill?: unknown,
    @Query("outcome") outcome?: unknown,
    @Query("limit") limit?: unknown,
    @Query("from") from?: unknown,
    @Query("to") to?: unknown,
  ) {
    const windowFrom = windowDate(from, "from");
    const windowTo = windowDate(to, "to");
    const rows = await this.runs.list({
      ...runFilter(agent, skill, outcome, limit),
      ...(windowFrom !== undefined ? { from: windowFrom } : {}),
      ...(windowTo !== undefined ? { to: windowTo } : {}),
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
