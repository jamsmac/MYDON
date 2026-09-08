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
import { DOMAINS, type Domain } from "@mydon/shared";
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

  /** Окно по `createdAt`; дата без времени — полночь UTC (05:00 Ташкента). */
  @IsOptional()
  @IsISO8601({}, { message: "from: дата в формате ISO" })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: "to: дата в формате ISO" })
  to?: string;

  /** Подстрока названия. Пустая строка — «фильтр не задан», как `?agent=` у деки. */
  @IsOptional()
  @IsString({ message: "q: строка" })
  @MaxLength(200, { message: "q: не длиннее 200 символов" })
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
