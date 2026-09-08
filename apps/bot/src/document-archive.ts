import path from "node:path";
import type { Domain } from "@mydon/shared";
import { CoreError, type PersonRow } from "./core-client";

/**
 * Архив документов бота (срез A3, спека §2.1).
 *
 * Файл из `@mydon/documents` стоил вызова модели с исполнением кода в
 * контейнере — и до этого среза жил секунды: бот отправлял его в чат и
 * забывал. Сорвалась отправка — файл потерян, владельцу писали «повтори
 * запрос». Теперь порядок обратный: СНАЧАЛА `POST /attachments`, ПОТОМ
 * `sendDocument`. Сбой архива отправку не блокирует (файл у нас в руках,
 * терять его из-за хранилища нельзя), но называется владельцу словами.
 *
 * Каждый необратимый шаг — зависимость: порядок «сохранили → отправили»
 * проверяется без живого Telegram и Core, как в tasks-push.ts.
 */

export interface DocumentToDeliver {
  filename: string;
  content: Buffer;
  /** Направление, о котором документ, если бот его знает. */
  domain?: Domain;
}

export interface DocumentArchiveDeps {
  /** Кто попросил — по chatId, тем же путём, что решается доступ бота (`personOf`). */
  resolveOwner(): Promise<PersonRow | null | "core-down">;
  /**
   * Записать документ в архив. Форма входа — ровно `CoreClient.uploadDocument`
   * (задача 3), чтобы провод в index.ts был проводом, а не переводчиком.
   * `kind: "doc"` там же и ставится: у этой двери другого рода не бывает.
   */
  save(input: {
    ownerType: "person";
    ownerId: string;
    title: string;
    mime: string;
    filename: string;
    bytes: Buffer;
    tags: string[];
    domain?: Domain;
    createdBy: string;
  }): Promise<{ id: string }>;
  sendDocument(filename: string, content: Buffer): Promise<void>;
  sendMessage(text: string): Promise<void>;
  /** Публичный адрес панели без завершающего «/»; пусто — ссылка будет путём. */
  panelUrl: string;
  log(message: string, error: unknown): void;
}

export interface DeliveryOutcome {
  /** id вложения в архиве; null — не сохранено (владельцу названа причина). */
  savedId: string | null;
  sent: boolean;
}

/**
 * MIME по расширению. `@mydon/documents` отдаёт только имя и байты — тип
 * файла из контейнера модели не приходит, а Core принимает вложение по
 * белому списку MIME (`allowedExt` в attachments.service.ts) и возвращает
 * этот же тип заголовком при отдаче. Расширение — не догадка: его ставит
 * сам пакет по `DocumentKind` (`EXT` в packages/documents/src/index.ts).
 */
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
};

/**
 * Неизвестное расширение → octet-stream: Core его отвергнет, и владелец
 * услышит «Core отверг файл», а не молчание и не выдуманный тип.
 */
export function mimeПоРасширению(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/**
 * Имя артефакта — имя файла без расширения. Не `doc.summary`: сводка модели
 * начинается с «Готово, я построил…» и в списке /artifacts читалась бы как
 * болтовня, а имя файла бот собирает сам («Дебиторка GLOBERENT 08.09.2026»)
 * — по нему и ищут (`q` ILIKE по title). Сводка остаётся текстом в чате.
 *
 * Длину здесь НЕ режем. Предел 120 (спека §6 п. 4) стоит на входе Core
 * (`clampAttachmentTitle`, задача 3) и режет по code point; второй зажим здесь
 * дал бы правилу второй дом, а `slice` по UTF-16 мог бы оставить в БД
 * половину суррогатной пары — ровно то, от чего зажим Core и уходит.
 */
export function заголовокИзИмени(filename: string): string {
  const base = path.basename(filename, path.extname(filename)).trim();
  return base.length > 0 ? base : filename;
}

/**
 * Ярлык причины для владельца. Текст исключения наружу не едет: он для
 * лога, а владельцу нужно одно из немногих слов, по которому ясно, к кому идти.
 */
export function ярлыкПричины(error: unknown): string {
  if (error instanceof CoreError) {
    if (error.status === 400) return "Core отверг файл";
    if (error.status === 401 || error.status === 403) return "нет доступа к Core";
    if (error.status === 413) return "файл слишком большой";
    return `Core ответил ${error.status}`;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Core не ответил вовремя";
  }
  return "Core недоступен";
}

/**
 * Ссылка в витрину. Поиск по названию — фильтр, который у /artifacts есть по
 * спеке §2.3; владелец открывает список и видит ровно этот файл.
 */
export function ссылкаНаАрхив(panelUrl: string, title: string): string {
  return `${panelUrl}/artifacts?q=${encodeURIComponent(title)}`;
}

/**
 * Кому принадлежит документ — или почему архива не будет.
 *
 * Три исхода `personOf` (человек / гость / «Core недоступен») плюс четвёртый:
 * сам поиск бросил. Он тоже часть половины «архив», и его сбой не имеет права
 * унести с собой отправку — файл у нас в руках (Р-A3-2). Провод (`personOf`)
 * исключения глотает сам, но гарантия принадлежит модулю, иначе она держалась
 * бы на дисциплине вызывающего.
 */
async function владелецИлиПричина(
  deps: DocumentArchiveDeps,
): Promise<{ owner: PersonRow } | { note: string }> {
  let owner: PersonRow | null | "core-down";
  try {
    owner = await deps.resolveOwner();
  } catch (error) {
    deps.log("Владелец документа не найден", error);
    return { note: ярлыкПричины(error) };
  }
  if (owner === "core-down") return { note: "Core не ответил" };
  // Гость: у файла нет владельца, а вложения без владельца не бывает
  // (спека §1, ownerId NOT NULL). Не выдумываем хозяина — говорим.
  if (owner === null) return { note: "чат не привязан к человеку в MYDON" };
  return { owner };
}

/**
 * Доставка документа владельцу: архив → Telegram → одна строка о судьбе
 * файла, только если что-то пошло не так (Р-A3-1, Р-A3-2).
 */
export async function доставитьДокумент(
  deps: DocumentArchiveDeps,
  doc: DocumentToDeliver,
): Promise<DeliveryOutcome> {
  const title = заголовокИзИмени(doc.filename);

  // 1. Архив — ДО отправки (Р-A3-1): сорвётся Telegram — файл уже есть.
  let savedId: string | null = null;
  let archiveNote: string | null = null;
  const хозяин = await владелецИлиПричина(deps);
  if ("note" in хозяин) {
    archiveNote = хозяин.note;
  } else {
    try {
      const saved = await deps.save({
        ownerType: "person",
        ownerId: хозяин.owner.id,
        title,
        mime: mimeПоРасширению(doc.filename),
        filename: doc.filename,
        bytes: doc.content,
        tags: ["bot"],
        ...(doc.domain ? { domain: doc.domain } : {}),
        // `person:<id>`, как в остальных записях бота: отчёт может попросить
        // любой из заведённых людей, и «owner» про запрос сотрудника было бы
        // ложью в аудитном поле. Читаемость — забота витрины, не хранения.
        createdBy: `person:${хозяин.owner.id}`,
      });
      savedId = saved.id;
    } catch (error) {
      deps.log("Документ не лёг в архив", error);
      archiveNote = ярлыкПричины(error);
    }
  }

  // 2. Отправка — всегда, независимо от архива: файл у нас в руках, и
  //    терять его из-за хранилища нельзя (Р-A3-2).
  let sent = false;
  try {
    await deps.sendDocument(doc.filename, doc.content);
    sent = true;
  } catch (error) {
    deps.log("Файл не отправлен", error);
  }

  // 3. Строка владельцу — только когда что-то сорвалось. Оба шага удались —
  //    молчим, как и раньше: файл в чате говорит сам за себя. Прежнего
  //    «повтори запрос» нет: файл в архиве, повторять незачем.
  let note: string | null = null;
  if (sent && archiveNote !== null) {
    note = `⚠️ Файл отправлен, но в архив не лёг: ${archiveNote}.`;
  } else if (!sent && savedId !== null) {
    note = `Отправить в чат не вышло, файл в архиве: ${ссылкаНаАрхив(deps.panelUrl, title)}`;
  } else if (!sent && archiveNote !== null) {
    note = `⚠️ Файл не отправился и в архив не лёг: ${archiveNote}. Он потерян — запроси отчёт заново.`;
  }
  if (note !== null) {
    await deps
      .sendMessage(note)
      .catch((error: unknown) => deps.log("Владелец не узнал о судьбе файла", error));
  }
  return { savedId, sent };
}
