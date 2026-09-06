import { Body, Controller, Get, Post, Query } from "@nestjs/common";
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

/** Потолок и умолчание страницы ленты — те же рамки, что у журнала рутин. */
const LIST_MAX = 200;
const LIST_DEFAULT = 50;

/**
 * Фильтр событий. Раньше ?since=abc уходил в new Date() и падал
 * с 500 (Invalid time value) уже на уровне драйвера.
 *
 * ДТО общее для трёх маршрутов, но рамки выборки (`typePrefix`, `until`,
 * `order`, `limit`) читает ТОЛЬКО лента: `count` и `latest` берут отсюда
 * `type`, `source`, `since`. До волны A1 остальные поля отбивались пайпом как
 * незнакомые на всех трёх — теперь на счётчике и «самом свежем» они молча
 * ничего не меняют; расширять их фильтр — отдельная задача, не эта.
 */
export class ListEventsDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  source?: string;

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
  since?: string;

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
 * `RunsService.list`: бессмысленное значение считаем «предел не задан».
 */
function pageLimit(limit?: number): number {
  const asked = typeof limit === "number" && Number.isFinite(limit) ? Math.trunc(limit) : 0;
  return asked > 0 ? Math.min(asked, LIST_MAX) : LIST_DEFAULT;
}

@Controller("events")
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
    return this.events.list({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.typePrefix ? { typePrefix: filter.typePrefix } : {}),
      ...(filter.since ? { since: new Date(filter.since) } : {}),
      ...(filter.until ? { until: new Date(filter.until) } : {}),
      order: filter.order ?? "desc",
      limit: pageLimit(filter.limit),
    });
  }

  /** Счётчик событий под фильтр (источник/тип/с даты). */
  @Get("count")
  async count(@Query() filter: ListEventsDto) {
    const count = await this.events.count({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.since ? { since: new Date(filter.since) } : {}),
    });
    return { count };
  }

  /** Самое свежее событие под фильтр (источник/тип) — для дельта-памяти агента. */
  @Get("latest")
  async latest(@Query() filter: ListEventsDto) {
    const row = await this.events.latest({
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    });
    return { event: row ?? null };
  }
}
