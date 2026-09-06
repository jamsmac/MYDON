import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { EventsTokenGuard } from "./events-token.guard";
import { EventsService } from "./events.service";

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  source!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  type!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  clientKey?: string;
}

/**
 * Потолок страницы ленты — те же рамки, что у журнала рутин.
 *
 * Умолчание НЕ трогаем: без `?limit=` лента отдаёт столько же, сколько до
 * волны A1 (`EventsService.list`, 100). Новому клиенту (MCP) нужна страница
 * поменьше — он присылает pageSize явно; менять умолчание значило бы урезать
 * выборку существующему читателю (`CoreClient.listEvents` → `memory-rag`)
 * ради чужого удобства, причём молча.
 */
const LIST_MAX = 200;

/**
 * Фильтр событий для счётчика и «самого свежего»: ровно те поля, которые эти
 * маршруты ДЕЙСТВИТЕЛЬНО учитывают.
 *
 * Отдельный класс, а не общий с лентой: с общим `?typePrefix=` на
 * `/events/count` прошёл бы валидацию и молча не сузил бы счёт — ответ
 * выглядел бы здоровым и был бы неверным. Молчаливое игнорирование хуже
 * прежней 400: у вызывающего не остаётся ни одной подсказки.
 */
export class FilterEventsDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  source?: string;

  @IsOptional()
  @IsISO8601()
  since?: string;
}

/**
 * Фильтр ленты. Раньше ?since=abc уходил в new Date() и падал
 * с 500 (Invalid time value) уже на уровне драйвера.
 *
 * Наследует отбор счётчика и добавляет рамки выборки, которые есть только у
 * ленты. Поля объявлены в одном месте: разъехавшись, `?source=` снова начал бы
 * значить разное на соседних маршрутах.
 */
export class ListEventsDto extends FilterEventsDto {
  /**
   * Префикс типа: `agent.memory:` перечисляет память агента одним `like`,
   * а не перебором всех типов на стороне вызывающего.
   */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  typePrefix?: string;

  @IsOptional()
  @IsISO8601()
  until?: string;

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "order: asc | desc" })
  order?: "asc" | "desc";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(LIST_MAX)
  @Type(() => Number)
  limit?: number;
}

/**
 * Предел страницы у границы, а не только в ДТО: пайп отобьёт мусор из строки
 * запроса, но контроллер не должен быть без него беззащитным — NaN уехал бы
 * в `limit $1` и вернул 500 от драйвера вместо ленты. То же правило, что в
 * `RunsService.list`: бессмысленное значение считаем «предел не задан», и
 * тогда предел вообще не уходит в сервис — умолчание остаётся его.
 */
function pageLimit(limit?: number): number | undefined {
  const asked = typeof limit === "number" && Number.isFinite(limit) ? Math.trunc(limit) : 0;
  return asked > 0 ? Math.min(asked, LIST_MAX) : undefined;
}

/**
 * Шина событий Core.
 *
 * Guard на классе требует сервисный токен и на ЧТЕНИЕ (волна A1, Ruling 5):
 * глобальный `ServiceTokenGuard` GET пропускает, а листать ленту насквозь
 * (`until` + `order=asc`) анонимно нельзя — там память агентов и события
 * личного контура.
 */
@Controller("events")
@UseGuards(EventsTokenGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.events.record({
      source: dto.source,
      type: dto.type,
      payload: dto.payload,
      ...(dto.occurredAt ? { occurredAt: new Date(dto.occurredAt) } : {}),
      ...(dto.clientKey ? { clientKey: dto.clientKey } : {}),
    });
  }

  /**
   * Лента событий под фильтр.
   *
   * `source` до волны A1 объявлялся в ДТО, работал в `count`/`latest`, а
   * здесь молча терялся: владелец задавал источник и получал чужие события,
   * считая, что смотрит один. `typePrefix` добавлен ради памяти агентов —
   * она лежит типами `agent.memory:<навык>`, и без префикса перечислить её
   * можно было только зная имя каждого навыка.
   */
  @Get()
  list(@Query() filter: ListEventsDto) {
    const pageSize = pageLimit(filter.limit);
    return this.events.list({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.typePrefix ? { typePrefix: filter.typePrefix } : {}),
      ...(filter.since ? { since: new Date(filter.since) } : {}),
      ...(filter.until ? { until: new Date(filter.until) } : {}),
      order: filter.order ?? "desc",
      ...(pageSize !== undefined ? { limit: pageSize } : {}),
    });
  }

  /** Счётчик событий под фильтр (источник/тип/с даты). */
  @Get("count")
  async count(@Query() filter: FilterEventsDto) {
    const count = await this.events.count({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.since ? { since: new Date(filter.since) } : {}),
    });
    return { count };
  }

  /** Самое свежее событие под фильтр (источник/тип) — для дельта-памяти агента. */
  @Get("latest")
  async latest(@Query() filter: FilterEventsDto) {
    const row = await this.events.latest({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    });
    return { event: row ?? null };
  }
}
