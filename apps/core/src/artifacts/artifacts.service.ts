import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { attachment } from "@mydon/db";
import { ATTACHMENT_KINDS, type AttachmentKind, type Domain } from "@mydon/shared";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
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
 * Типы вложений — РОВНО ТОТ ЖЕ СПИСОК, что принимает `UploadDto.kind`, и
 * теперь это один объект, а не два совпадающих литерала (`@mydon/shared`,
 * `artifacts-contract.ts`). Чужое значение фильтра — 400, а не тихо пустой
 * архив: `?kind=video` иначе выглядел бы как «ничего не было».
 */
export const ARTIFACT_KINDS = ATTACHMENT_KINDS;
export type ArtifactKind = AttachmentKind;

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

/** Момент в курсоре: ISO с долей секунды до микросекунд — так печатает база. */
const CURSOR_MOMENT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

/**
 * Момент, КОТОРЫЙ СУЩЕСТВУЕТ В КАЛЕНДАРЕ, — формы недостаточно, и это измерено.
 *
 * `new Date("2026-02-30T10:00:00Z")` — не «Invalid Date», а 2 марта: V8
 * ПЕРЕПОЛНЯЕТ лишние дни, а не отвергает их (`2026-09-31` → 1 октября;
 * `2026-13-01` — уже Invalid). Такая строка уехала бы в SQL параметром с
 * `::timestamptz` и упала бы 22008 драйвера, то есть 500 вместо честного 400.
 * Тот же приём и тот же довод, что у `strict: true` в `ArtifactsQueryDto` и
 * `календарныйДень` в панели: сверяем ОБРАТНЫМ РАЗБОРОМ. Лишние знаки доли
 * секунды V8 отбрасывает, а не округляет (проверено на
 * `2026-12-31T23:59:59.999999Z`), поэтому сутки от них не съезжают.
 */
function моментЖивой(iso: string): boolean {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso.slice(0, 10);
}

/**
 * Курсор страницы: `base64url("<created_at ISO с микросекундами>|<id>")`.
 *
 * Непрозрачный для клиента, но составной для нас: страница режется по
 * кортежу `(created_at, id)`, а не по одному времени — бот кладёт документ
 * и связанные файлы в одну секунду, и на границе страницы строки с равным
 * временем либо пропадали бы, либо повторялись. `base64url`, а не `base64`:
 * курсор едет в строке запроса, где `+` декодируется в пробел, а `/` и `=`
 * требуют экранирования — «непрозрачный» курсор ломался бы при простом
 * копировании ссылки на страницу.
 *
 * ВРЕМЯ БЕРЁТСЯ СТРОКОЙ ИЗ БАЗЫ, А НЕ ЧЕРЕЗ `Date` (круг починок 3, A-4).
 * `created_at` — `timestamptz` из `now()`, то есть МИКРОсекунды; JS `Date`
 * держит миллисекунды, и `toISOString()` печатал `…:00.123Z` там, где в базе
 * `…:00.123456`. Последствие было хуже мёртвой ветки «равное время»: строка с
 * тем же миллисекундным срезом времени не меньше `…:00.123` и не равна ему —
 * то есть страница за курсором НЕ ВИДЕЛА ЕЁ ВОВСЕ, и на границе порции строки
 * молча выпадали из обхода. Поэтому в курсор едет `createdAtCursor` —
 * `to_char(… '.US')` самой базы (см. ARTIFACT_COLUMNS).
 */
export function encodeCursor(row: { createdAtCursor: string; id: string }): string {
  return Buffer.from(`${row.createdAtCursor}|${row.id}`, "utf8").toString("base64url");
}

/**
 * Обратный разбор; `null` — курсор чужой или испорчен (наружу — 400, а не 500
 * драйвера).
 *
 * Момент остаётся СТРОКОЙ: через `Date` он потерял бы те самые микросекунды,
 * ради которых и берётся из базы. Поэтому проверяем его формой И живостью —
 * «вчера» в параметре с `::timestamptz` дало бы 22P02 драйвера вместо 400, а
 * «2026-02-30T00:00:00Z» форму проходит и в базе не существует.
 */
export function decodeCursor(raw: string): { createdAt: string; id: string } | null {
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const sep = text.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = text.slice(0, sep);
  const id = text.slice(sep + 1);
  if (!CURSOR_MOMENT_RE.test(createdAt) || !моментЖивой(createdAt)) return null;
  if (!UUID_RE.test(id)) return null;
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
  /**
   * Время СТРОКОЙ ПОЛНОЙ ТОЧНОСТИ — служебный столбец под курсор, наружу он не
   * едет (`toRow` его не переносит, `ArtifactRow` о нём не знает).
   *
   * `createdAt` выше приезжает драйвером как JS `Date`, а он держит только
   * миллисекунды — микросекунды `now()` теряются ДО `encodeCursor`, и починить
   * это в кодировании курсора нельзя. `to_char` с `.US` печатает те же шесть
   * знаков, что стоят в базе, и Postgres принимает такую строку обратно как
   * `timestamptz`. `at time zone 'UTC'` — чтобы значение не зависело от
   * `TimeZone` сессии: у курсора один смысл на любой машине.
   */
  createdAtCursor:
    sql<string>`to_char(${attachment.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
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
  /** `to_char` базы: ISO с микросекундами. Уезжает только в курсор. */
  createdAtCursor: string;
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
      //
      // Момент едет параметром-строкой с `::timestamptz`, а не через `Date`:
      // сравнение обязано идти в ПОЛНОЙ точности базы (A-4 выше). Через
      // маппер колонки (`lt(attachment.createdAt, …)`) прошла бы только
      // миллисекундная копия, и ветка равенства снова стала бы мёртвой.
      conds.push(
        sql`(${attachment.createdAt} < ${c.createdAt}::timestamptz or (${attachment.createdAt} = ${c.createdAt}::timestamptz and ${attachment.id} < ${c.id}))`,
      );
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
