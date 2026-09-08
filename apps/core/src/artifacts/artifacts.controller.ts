import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ARTIFACTS_Q_MAX, DOMAINS, type Domain } from "@mydon/shared";
import { excludePersonal } from "../common/owner-enforcement";
import { ReadTokenGuard } from "../common/read-token.guard";
import { DB, type Db } from "../db/db.module";
import {
  ARTIFACT_KINDS,
  ArtifactsService,
  LIST_MAX,
  type ArtifactKind,
  type ArtifactsFilter,
  type ArtifactsPage,
} from "./artifacts.service";

/**
 * Фильтры архива. Всё необязательно; чужое значение — 400 со списком
 * допустимых, а не тихо отброшенный фильтр (как `?outcome=` у журнала
 * прогонов): «отфильтрованный» ответ, который на деле полный, врёт.
 */
export class ArtifactsQueryDto {
  @IsOptional()
  @IsIn([...ARTIFACT_KINDS], { message: `kind: ${ARTIFACT_KINDS.join(" | ")}` })
  kind?: ArtifactKind;

  /** Тот же шаблон, что у `UploadDto.ownerType`: иной тип владельца в базе не появится. */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{0,31}$/, {
    message: "ownerType: латиница в нижнем регистре, цифры и подчёркивание, до 32 символов",
  })
  ownerType?: string;

  @IsOptional()
  @IsUUID(undefined, { message: "ownerId: нужен UUID" })
  ownerId?: string;

  @IsOptional()
  @IsIn([...DOMAINS], { message: `domain: ${DOMAINS.join(" | ")}` })
  domain?: Domain;

  /**
   * Окно по `createdAt`; дата без времени — полночь UTC (05:00 Ташкента).
   *
   * `strict: true` — НЕ УКРАШЕНИЕ, И ЭТО ИЗМЕРЕНО. Без него валидатор
   * проверяет только ФОРМУ: `{"from":"2026-02-30"}` даёт 0 ошибок, а
   * `new Date(q.from)` ниже переезжает на 2 марта; `2026-09-31` — на
   * 1 октября. Граница периода тихо сдвигалась бы на сутки, оставаясь
   * ПРИНЯТЫМ фильтром, о котором ответ не говорит ни слова. Панель этот же
   * случай ловит обратным разбором y/m/d (`календарныйДень` в
   * `apps/cc/src/lib/artifacts.ts`) и печатает «дата с … не применена», но у
   * двери Core есть свои вызывающие: прямой `curl` и будущий навык
   * `artifacts_list`. `strict` сверяет день с календарём и отвергает такое
   * значение 400 — как и любое другое чужое (§«чужое значение — ошибка»
   * выше). Что панель реально шлёт, `strict` принимает: и сутки
   * `2026-09-08`, и полный момент `2026-08-31T19:00:00.000Z`, и 29 февраля
   * высокосного `2028-02-29`.
   */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: "from: дата в формате ISO" })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "to: дата в формате ISO" })
  to?: string;

  /** Подстрока названия. Пустая строка — «фильтр не задан», как `?agent=` у деки. */
  @IsOptional()
  @IsString({ message: "q: строка" })
  @MaxLength(ARTIFACTS_Q_MAX, { message: `q: не длиннее ${ARTIFACTS_Q_MAX} символов` })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit должен быть целым числом" })
  @Min(1, { message: "limit не может быть меньше 1" })
  @Max(LIST_MAX, { message: `limit не может быть больше ${LIST_MAX}` })
  limit?: number;

  /** `next` предыдущего ответа; разбор — в сервисе, испорченный курсор — 400. */
  @IsOptional()
  @IsString({ message: "cursor: строка" })
  @MaxLength(256, { message: "cursor: не длиннее 256 символов" })
  cursor?: string;
}

/**
 * Архив артефактов (срез A3, Р-A3-3): строки вложений без содержимого и без
 * ключа хранилища; сам файл — `GET /attachments/:id/raw`.
 *
 * ТОКЕН ОБЯЗАТЕЛЕН И НА ЧТЕНИЕ: названия документов бота — пересказ работы
 * агентов по делам владельца («Дебиторка GLOBERENT за август»), то же
 * содержание, ради которого закрыты `/routines/runs` и `/agents/status`.
 * Guard на КЛАССЕ, а не на маршруте: будущие `@Get` архива закрыты по
 * умолчанию, а не по памяти автора (как `AppsController`).
 */
@Controller("artifacts")
@UseGuards(ReadTokenGuard)
export class ArtifactsController {
  constructor(
    private readonly artifacts: ArtifactsService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get()
  async list(@Query() q: ArtifactsQueryDto, @Req() req: Request): Promise<ArtifactsPage> {
    const text = q.q?.trim();
    const filter: ArtifactsFilter = {
      ...(q.kind !== undefined ? { kind: q.kind } : {}),
      ...(q.ownerType !== undefined ? { ownerType: q.ownerType } : {}),
      ...(q.ownerId !== undefined ? { ownerId: q.ownerId } : {}),
      ...(q.domain !== undefined ? { domain: q.domain } : {}),
      ...(q.from !== undefined ? { from: new Date(q.from) } : {}),
      ...(q.to !== undefined ? { to: new Date(q.to) } : {}),
      ...(text !== undefined && text.length > 0 ? { q: text } : {}),
      ...(q.limit !== undefined ? { limit: q.limit } : {}),
      ...(q.cursor !== undefined && q.cursor.length > 0 ? { cursor: q.cursor } : {}),
    };
    // Тот же domain-less обход, что у `GET /tasks` (R-P5-7b): ужесточение
    // включено И запрос не доказан owner-токеном → личный контур вырезается.
    // Флаг выключен (дефолт) → false → выдача прода не меняется.
    return this.artifacts.list(filter, { excludePersonal: await excludePersonal(req, this.db) });
  }
}
