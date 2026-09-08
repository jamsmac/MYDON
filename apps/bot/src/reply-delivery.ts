import {
  доставитьДокумент,
  заголовокИзИмени,
  ссылкаНаАрхив,
  type DeliveryOutcome,
  type DocumentArchiveDeps,
} from "./document-archive";
import type { Reply } from "./handler";

/**
 * Доставка ответа владельцу: текст → продолжение → документ → слово о том,
 * что не доехало.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ ЧЕТЫРЕ ШАГА В `processUpdate`. Первый шаг —
 * `sendMessage(reply.text)` — стоял без защиты И ВЫШЕ единственной двери
 * архива. Отказ отправки ТЕКСТА уносил исполнение из `processUpdate`
 * (`TelegramError` 400 «message is too long» на сводке модели длиннее 4096,
 * обрыв соединения, 15-секундный abort в `telegram.ts`), `poll.ts` исключение
 * глотал — offset пачки уже сдвинут, — и документ, стоивший вызова модели с
 * исполнением кода, НЕ СОХРАНЯЛСЯ, не отправлялся, а владельцу не говорили
 * ничего. Ровно тот отказ, ради которого затевался срез A3: там порядок
 * «архив → Telegram» защищает файл от сбоя ОТПРАВКИ ФАЙЛА, а сбой отправки
 * ТЕКСТА обходил защиту сверху.
 *
 * Путь существовал и до среза (тот же незащищённый вызов, архива не было
 * вовсе) — это не регресс, а непокрытый путь, и он отменял смысл среза в
 * реальном сценарии.
 *
 * Порядок здесь — обязательство, а не удобство: КАЖДЫЙ шаг доставки защищён
 * своей `try`, и ни один не может унести следующие. Замыкание `processUpdate`
 * тестом не позвать, поэтому шаги живут в чистой функции с зависимостями —
 * как `доставитьДокумент` и `доставитьНазначения`.
 */

export interface ReplyDeliveryDeps {
  /** Отправить сообщение владельцу; клавиатура бывает только у первого. */
  sendMessage(text: string, keyboard?: Reply["keyboard"]): Promise<void>;
  sendDocument(filename: string, content: Buffer): Promise<void>;
  /** Кто просил — для владельца вложения (`personOf` по chatId). */
  resolveOwner: DocumentArchiveDeps["resolveOwner"];
  /** Запись в архив — ровно `CoreClient.uploadDocument`. */
  save: DocumentArchiveDeps["save"];
  /** Публичный адрес панели без завершающего «/»; пусто — ссылка будет путём. */
  panelUrl: string;
  log(message: string, error: unknown): void;
}

export interface ReplyOutcome {
  /** Текст ответа доехал? `false` — владельцу сказано словами. */
  textSent: boolean;
  /** Судьба файла; `null` — документа в ответе не было. */
  document: DeliveryOutcome | null;
}

export async function доставитьОтвет(
  deps: ReplyDeliveryDeps,
  reply: Reply,
): Promise<ReplyOutcome> {
  // 1. Текст ответа. Своя защита: дальше идут НЕОБРАТИМЫЕ шаги (архив), и
  //    сорвавшееся сообщение не имеет права их отменить.
  let textSent = false;
  try {
    await deps.sendMessage(reply.text, reply.keyboard);
    textSent = true;
  } catch (error) {
    deps.log("Текст ответа не отправлен", error);
  }

  // 2. Длинный ответ (план закупа) приходит частями: у Telegram предел на одно
  //    сообщение, а резать список многоточием нельзя — обрезанный маршрут
  //    читается как полный. Обрыв на середине молчать не имеет права:
  //    недоехавшие части владелец прочтёт как «маршрут кончился» и не довезёт
  //    товар. Части идут даже если голова не доехала: они могли сорваться по
  //    длине, а не по связи, и половина маршрута лучше молчания.
  try {
    for (const part of reply.more ?? []) await deps.sendMessage(part);
  } catch (error) {
    deps.log("Части ответа не отправлены", error);
    await deps
      .sendMessage("⚠️ Остальные части не дошли — повтори «план закупа».")
      .catch((err: unknown) => deps.log("Владелец не узнал о недоехавших частях", err));
  }

  // 3. Файл — независимо от судьбы текста. Внутри свой порядок «архив →
  //    Telegram» и свои слова владельцу (document-archive.ts).
  //    `try` снаружи — потому что гарантия «текст не унёс архив» обязана
  //    работать и в обратную сторону: неожиданный отказ доставки файла не
  //    должен съесть строку про потерянный текст ниже.
  let document: DeliveryOutcome | null = null;
  if (reply.document) {
    const архив: DocumentArchiveDeps = {
      resolveOwner: () => deps.resolveOwner(),
      save: (input) => deps.save(input),
      sendDocument: (filename, content) => deps.sendDocument(filename, content),
      sendMessage: (text) => deps.sendMessage(text),
      panelUrl: deps.panelUrl,
      log: (message, error) => deps.log(message, error),
    };
    try {
      document = await доставитьДокумент(архив, reply.document);
    } catch (error) {
      deps.log("Доставка документа сорвалась целиком", error);
    }
  }

  // 4. Слово о потерянном тексте — ПОСЛЕ архива, а не вместо него: молчание
  //    владельцу при сорвавшейся отправке выглядит как «бот проглотил
  //    запрос», и он повторяет вызов модели. Если файл уже в архиве, об этом
  //    говорится сразу: перестраивать его заново — второй вызов модели с
  //    исполнением кода за тот же результат.
  if (!textSent) {
    const вАрхиве =
      reply.document !== undefined && document !== null && document.savedId !== null
        ? ` Файл уже в архиве: ${ссылкаНаАрхив(deps.panelUrl, заголовокИзИмени(reply.document.filename))}`
        : " Спроси ещё раз.";
    await deps
      .sendMessage(`⚠️ Текст ответа не дошёл до чата.${вАрхиве}`)
      .catch((error: unknown) => deps.log("Владелец не узнал о потерянном тексте", error));
  }

  return { textSent, document };
}
