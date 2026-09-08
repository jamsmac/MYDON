import type { Response } from "express";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { domainEnum } from "@mydon/db";
import { ATTACHMENT_KINDS, type AttachmentKind, type Domain } from "@mydon/shared";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { ReadTokenGuard } from "../common/read-token.guard";
import {
  ATTACHMENT_STAGES,
  AttachmentsService,
  INLINE_IMAGE_MIMES,
  type AttachmentStage,
  type UploadedFile as UF,
} from "./attachments.service";

/**
 * Картинку показываем в `<img>`, всё прочее отдаём вложением.
 *
 * Сверяем с замкнутым списком, а не с префиксом `image/`: SVG — тоже
 * `image/*`, но при прямом переходе исполняет вложенный скрипт, и `nosniff`
 * не спасает — тип заявлен верно. Параметры (`;charset=...`) отбрасываем.
 */
export function isImageMime(mime: string | null): boolean {
  if (mime === null) return false;
  return INLINE_IMAGE_MIMES.has(mime.toLowerCase().split(";")[0].trim());
}

/**
 * Предел названия артефакта. Одно число: зажим на входе и договор
 * `@MaxLength` — как `STOCK_COUNTS_PRODUCT_MAX` у поиска остатков.
 */
export const ATTACHMENT_TITLE_MAX = 120;
/** Сколько тегов принимаем на одно вложение. */
export const ATTACHMENT_TAGS_MAX = 20;
/** Длина одного тега. */
export const ATTACHMENT_TAG_MAX = 64;

/**
 * Название артефакта: ЗАЖИМ, А НЕ ОТКАЗ.
 *
 * Бот берёт название из summary документа, а summary модель пишет длиной в
 * абзац. Отвергать запрос за длину — терять файл, стоивший вызова модели с
 * исполнением кода; полный текст и так остаётся в caption сообщения Telegram
 * (спека A3 §6 п. 4). Режем по code point, а не `slice` по UTF-16: `slice`
 * разрубил бы эмодзи пополам и оставил бы в БД битую суррогатную половину.
 * Пустое после обрезки — как отсутствующее (в строку пойдёт null). Не строку
 * возвращаем как есть — её отвергнет `@IsString`, а не проглотит зажим.
 */
export function clampAttachmentTitle(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cut = Array.from(value.trim()).slice(0, ATTACHMENT_TITLE_MAX).join("").trimEnd();
  return cut.length === 0 ? undefined : cut;
}

/**
 * Теги из multipart — к массиву до валидации.
 *
 * Одно поле `tags` multer отдаёт строкой, повторённое — массивом; без
 * приведения один тег и два тега проходили бы `@IsArray` по-разному. Пустые
 * и пробельные теги выбрасываем. Не-массив и не-строку возвращаем как есть —
 * их отвергнет `@IsArray`/`@IsString`, а не молчаливая нормализация.
 */
export function normalizeAttachmentTags(value: unknown): unknown {
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list)) return list;
  return list.map((t) => (typeof t === "string" ? t.trim() : t)).filter((t) => t !== "");
}

/** Куда привязать файл и что это. */
export class UploadDto {
  // Тип владельца попадает в ключ файла в хранилище, а ключ — в путь на диске.
  // Поэтому закрытый шаблон, а не свободная строка: «../» в типе писало бы файл
  // мимо тома.
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,31}$/, {
    message:
      "ownerType: латиница в нижнем регистре, цифры и подчёркивание, до 32 символов (например vending_purchase_order)",
  })
  ownerType!: string;

  @IsUUID()
  ownerId!: string;

  /**
   * Что это. Список — из `@mydon/shared`, а не литералом здесь: те же три
   * значения проверяет фильтр витрины и показывает панель, и разъехавшись они
   * дали бы «загрузилось, но не находится» (круг починок 3, B-1).
   */
  @IsOptional() @IsIn([...ATTACHMENT_KINDS])
  kind?: AttachmentKind;

  @IsOptional() @IsString() @MaxLength(128)
  createdBy?: string;

  /** В какой момент снято. Незнакомое значение отвергаем здесь, а не в БД. */
  @IsOptional() @IsIn([...ATTACHMENT_STAGES])
  stage?: AttachmentStage;

  /**
   * Человеческое имя артефакта (срез A3). Зажимается `clampAttachmentTitle`;
   * `@MaxLength` после зажима сработать не может, но фиксирует границу
   * договором для любого другого клиента.
   */
  @IsOptional()
  @Transform(({ value }) => clampAttachmentTitle(value))
  @IsString()
  @MaxLength(ATTACHMENT_TITLE_MAX)
  title?: string;

  /**
   * Направление бизнеса — тот же перечень, что у `money_flow.domain`.
   * Сверяем со значениями `domainEnum`, а не со свободной строкой: колонка —
   * pg-enum, и чужое значение упало бы уже в БД как 500, а не 400. Пустая
   * строка из формы — это «не указано», а не ошибка.
   */
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsIn([...domainEnum.enumValues])
  domain?: Domain;

  /**
   * Метки («bot», «report», …). В multipart — повторённое поле `tags`;
   * `normalizeAttachmentTags` приводит строку к массиву до `@IsArray`.
   */
  @IsOptional()
  @Transform(({ value }) => normalizeAttachmentTags(value))
  @IsArray()
  @ArrayMaxSize(ATTACHMENT_TAGS_MAX)
  @IsString({ each: true })
  @MaxLength(ATTACHMENT_TAG_MAX, { each: true })
  tags?: string[];
}

/**
 * Вложения: фото номенклатуры, чеки, документы агентов. Файл — в хранилище,
 * метаданные — в БД.
 *
 * ТОКЕН ОБЯЗАТЕЛЕН И НА ЧТЕНИЕ (ловушка спеки A3 §6 п. 3, проверена по коду).
 * Глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS, и до среза A3 все
 * четыре читающих маршрута отдавали содержимое архива любому, кто дотянулся до
 * сети Core. Срез A3 сделал это материально хуже: витрина `/artifacts` печатает
 * СПИСОК id, владельцев и названий, а названия документов бота — тот же
 * пересказ работы агентов по делам владельца («Дебиторка GLOBERENT за
 * август»), ради которого закрыты `/routines/runs`, `/agents/status` и сам
 * `GET /artifacts`.
 *
 * Guard на КЛАССЕ, а не на одном `raw`, потому что дверь и стена — не одно и
 * то же, а на этой таблице их четыре. Закрыть только `raw` было бы театром:
 * `GET /attachments?ownerType=person&ownerId=…` отдаёт метаданные, где `url` —
 * это ПРЕСАЙНЕД-ССЫЛКА S3 на час (`storage.service.ts`), то есть сами байты в
 * обход закрытого `raw`; а `ownerId` человека берётся из бестокенного
 * `GET /people`. `meta` и `batch` — те же названия и те же ссылки. Проверка на
 * «перебор UUID v4 невозможен» этого не отменяет: перебирать и не нужно, id
 * выдаются списком.
 *
 * Кто ходит сюда и потому обязан носить токен: панель
 * (`apps/cc/src/lib/core.ts` — `attachments`, `attachmentsBatch` через
 * `getWithToken`, и `coreBytes` для прокси `/api/attachments/:id/raw`) и бот
 * (`apps/bot/src/core-client.ts` — `request()` и загрузка ставят токен всегда).
 * Полевой контур — фото и чеки на проде — виден через прокси панели, и он
 * ломается ровно тогда, когда токен перестаёт ехать: сторож этой пары —
 * `apps/cc/src/app/api/attachments/[id]/raw/route.token.test.ts`.
 */
@Controller("attachments")
@UseGuards(ReadTokenGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 12 * 1024 * 1024 } }))
  upload(@UploadedFile() file: UF | undefined, @Body() dto: UploadDto) {
    return this.attachments.upload(dto, file);
  }

  /** Вложения записи (owner_type + owner_id) — для галереи карточки. */
  @Get()
  list(@Query("ownerType") ownerType: string, @Query("ownerId", ParseUUIDPipe) ownerId: string) {
    return this.attachments.ofOwner(ownerType, ownerId);
  }

  /**
   * Вложения многих записей одним запросом (очередь утверждения).
   *
   * Стоит ВЫШЕ маршрута `:id` — иначе «batch» ушло бы в него как в
   * идентификатор и упало бы на разборе UUID.
   */
  @Get("batch")
  batch(@Query("ownerType") ownerType: string, @Query("ids") ids?: string) {
    const list = (ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return this.attachments.ofOwners(ownerType, list);
  }

  @Get(":id")
  meta(@Param("id", ParseUUIDPipe) id: string) {
    return this.attachments.meta(id);
  }

  /**
   * Отдать сам файл — для локального хранилища (у S3 ссылка presigned, и панель
   * ходит прямо в него). ЗА ТОКЕНОМ, как весь контроллер: в `<img>` браузера
   * это попадает не напрямую, а через прокси панели
   * (`apps/cc/src/app/api/attachments/[id]/raw/route.ts`), который токен несёт.
   *
   * `nosniff` — всегда: браузеру нельзя угадывать тип по содержимому, иначе
   * файл, принятый как картинка, исполнился бы как HTML на origin панели. Всё,
   * что не картинка из замкнутого списка, отдаём вложением, а не документом в
   * том же origin. CSP `sandbox` — страховка второй линии: даже если строка с
   * исполняемым типом (легаси до белого списка) уйдёт inline, скрипты в ней
   * при прямом переходе не выполнятся; показу в `<img>` заголовок не мешает.
   */
  @Get(":id/raw")
  async raw(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const { bytes, mime } = await this.attachments.raw(id);
    if (mime) res.setHeader("Content-Type", mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!isImageMime(mime)) res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(bytes);
  }

  @Delete(":id")
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    await this.attachments.remove(id);
    return { ok: true };
  }
}
