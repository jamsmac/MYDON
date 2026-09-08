import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { attachment } from "@mydon/db";
import type { Domain } from "@mydon/shared";
import { and, desc, eq, gte, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";

/**
 * Кольцо артефактов (срез A3): чтение вложений как архива произведённой
 * работы — документов бота, фото и чеков полевого контура — по типу,
 * владельцу, направлению, дате и названию.
 *
 * СУБСТРАТ — `attachment`, а не `document` (спека §1): у вложений живое
 * хранилище и настоящие строки, у `document` — ни писателей, ни читателей.
 * Артефакт агента — ещё один `ownerType`, а не новая сущность. Сервис ТОЛЬКО
 * читает: письмо остаётся за `AttachmentsService.upload` (`POST /attachments`),
 * чтобы белый список типов файла и ключ хранилища жили в одном месте, а
 * содержимое отдаёт существующий `GET /attachments/:id/raw`.
 */

/**
 * Типы вложений — ровно те, что принимает `UploadDto.kind`
 * (`attachments.controller.ts`). Чужое значение фильтра — 400, а не тихо
 * пустой архив: `?kind=video` иначе выглядел бы как «ничего не было».
 */
export const ARTIFACT_KINDS = ["photo", "receipt", "doc"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Потолок страницы: одна рамка на DTO и на сервис, как `LIST_MAX` у журнала прогонов. */
export const LIST_MAX = 100;
const DEFAULT_LIMIT = 50;

export interface ArtifactsFilter {
  kind?: ArtifactKind;
  ownerType?: string;
  ownerId?: string;
  domain?: Domain;
  /** Окно по `createdAt` — по нему же сортируется и режется страница. */
  from?: Date;
  to?: Date;
  /** Подстрока названия, без учёта регистра. */
  q?: string;
  limit?: number;
  /** `next` предыдущей страницы. */
  cursor?: string;
}

/** Строка витрины. `storageKey` и содержимого здесь нет намеренно (см. ARTIFACT_COLUMNS). */
export interface ArtifactRow {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  title: string | null;
  domain: Domain | null;
  tags: string[];
  mime: string | null;
  bytes: number | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ArtifactsPage {
  items: ArtifactRow[];
  /** Курсор следующей страницы; `null` — страница последняя. */
  next: string | null;
  /** Часы Core: панель считает давность от них, а не от своих. */
  now: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Курсор страницы: `base64url("<created_at ISO>|<id>")`.
 *
 * Непрозрачный для клиента, но составной для нас: страница режется по
 * кортежу `(created_at, id)`, а не по одному времени — бот кладёт документ
 * и связанные файлы в одну секунду, и на границе страницы строки с равным
 * временем либо пропадали бы, либо повторялись. `base64url`, а не `base64`:
 * курсор едет в строке запроса, где `+` декодируется в пробел, а `/` и `=`
 * требуют экранирования — «непрозрачный» курсор ломался бы при простом
 * копировании ссылки на страницу.
 */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

/** Обратный разбор; `null` — курсор чужой или испорчен (наружу — 400, а не 500 драйвера). */
export function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const sep = text.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = new Date(text.slice(0, sep));
  const id = text.slice(sep + 1);
  if (!Number.isFinite(createdAt.getTime()) || !UUID_RE.test(id)) return null;
  return { createdAt, id };
}

/**
 * Поиск по названию — тот же приём, что `nameMatches` в entities.service.ts,
 * и по тем же двум причинам: `%`/`_` — подстановочные знаки LIKE (без
 * экранирования «100%» находил бы весь архив), а ILIKE не сворачивает регистр
 * кириллицы при локали C — «дебиторка» строчными не нашла бы «Дебиторка».
 *
 * Коллация `"pg_c_utf8"` — встроенный провайдер PostgreSQL 17 (прод, CI и
 * pglite — все 17-й версии), а не ICU `"und-x-icu"`, как у реестра: сценарии
 * на настоящем SQL идут локально на pglite, а он собран БЕЗ ICU — любая ICU-
 * коллация там падает «ICU is not supported in this build». Встроенная
 * сворачивает регистр по таблицам Unicode («Дебиторка» ↔ «дебиторка», «Ё» ↔
 * «ё») и не зависит ни от ICU, ни от локали, с которой создана база.
 */
export function titleMatches(q: string): SQL {
  const escaped = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return sql`${attachment.title} ILIKE ${`%${escaped}%`} ESCAPE '\\' COLLATE "pg_c_utf8"`;
}

/**
 * Столбцы витрины перечислены, а не `select()` целиком: `storageKey` — путь
 * в томе или ключ S3, наружу он не нужен и не должен попадать (Р-A3-3), а
 * явный список делает его отсутствие проверяемым тестом по ключам объекта.
 */
const ARTIFACT_COLUMNS = {
  id: attachment.id,
  ownerType: attachment.ownerType,
  ownerId: attachment.ownerId,
  kind: attachment.kind,
  title: attachment.title,
  domain: attachment.domain,
  tags: attachment.tags,
  mime: attachment.mime,
  bytes: attachment.bytes,
  createdBy: attachment.createdBy,
  createdAt: attachment.createdAt,
};

/** Что отдаёт выборка по ARTIFACT_COLUMNS; `tags` — jsonb, тип не доказан базой. */
interface Selected {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  title: string | null;
  domain: Domain | null;
  tags: unknown;
  mime: string | null;
  bytes: number | null;
  createdBy: string | null;
  createdAt: Date;
}

/** Теги — jsonb; в базу могли положить не список (ручной SQL) — наружу всегда список строк. */
function tagsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t: unknown): t is string => typeof t === "string") : [];
}

function toRow(r: Selected): ArtifactRow {
  return {
    id: r.id,
    ownerType: r.ownerType,
    ownerId: r.ownerId,
    kind: r.kind,
    title: r.title,
    domain: r.domain,
    tags: tagsOf(r.tags),
    mime: r.mime,
    bytes: r.bytes,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Целое в рамках 1..LIST_MAX; всё бессмысленное — «не задан» (как в
 * `RunsService.list`): DTO уже отвергает мусор 400-й, но сервис зовут и
 * напрямую (сценарии, будущий MCP), и NaN в `limit $1` — это 500 драйвера.
 */
function pageLimit(asked: number | undefined): number {
  const n = typeof asked === "number" && Number.isFinite(asked) ? Math.trunc(asked) : 0;
  return n > 0 ? Math.min(n, LIST_MAX) : DEFAULT_LIMIT;
}

@Injectable()
export class ArtifactsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Страница архива: новые сверху, режется по кортежу `(created_at, id)`.
   *
   * `excludePersonal` — тот же гейт, что у `GET /tasks` (R-P5-7b): без домена
   * в запросе выдача включала бы личный контур, и при включённом ужесточении
   * не-владелец видел бы названия его документов.
   */
  async list(
    filter: ArtifactsFilter = {},
    opts: { excludePersonal?: boolean; now?: Date } = {},
  ): Promise<ArtifactsPage> {
    const conds: SQL[] = [];
    if (filter.kind !== undefined) conds.push(eq(attachment.kind, filter.kind));
    if (filter.ownerType !== undefined) conds.push(eq(attachment.ownerType, filter.ownerType));
    if (filter.ownerId !== undefined) conds.push(eq(attachment.ownerId, filter.ownerId));
    if (filter.domain !== undefined) conds.push(eq(attachment.domain, filter.domain));
    if (filter.from !== undefined) conds.push(gte(attachment.createdAt, filter.from));
    if (filter.to !== undefined) conds.push(lte(attachment.createdAt, filter.to));
    if (filter.q !== undefined) conds.push(titleMatches(filter.q));
    if (filter.cursor !== undefined) {
      const c = decodeCursor(filter.cursor);
      if (c === null) {
        throw new BadRequestException("cursor: не распознан — возьмите `next` из предыдущего ответа");
      }
      // Строго «раньше кортежа» по той же паре столбцов, что в ORDER BY:
      // сравнение по одному created_at на равном времени либо теряло бы
      // строки, либо повторяло их на стыке страниц.
      const before = or(
        lt(attachment.createdAt, c.createdAt),
        and(eq(attachment.createdAt, c.createdAt), lt(attachment.id, c.id)),
      );
      if (before !== undefined) conds.push(before);
    }
    if (opts.excludePersonal === true) {
      // `is distinct from`, а не `<> 'personal'`: у вложений полевого контура
      // домен NULL, и обычное сравнение вычеркнуло бы их из архива.
      conds.push(sql`${attachment.domain} is distinct from 'personal'`);
    }

    const limit = pageLimit(filter.limit);
    const rows: Selected[] = await this.db
      .select(ARTIFACT_COLUMNS)
      .from(attachment)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(attachment.createdAt), desc(attachment.id))
      .limit(limit);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    return {
      items: rows.map(toRow),
      // Ровно `limit` строк — страница могла быть не последней; меньше —
      // точно последняя. Лишний пустой запрос дешевле пропущенной строки.
      next: last !== undefined ? encodeCursor(last) : null,
      now: (opts.now ?? new Date()).toISOString(),
    };
  }
}
