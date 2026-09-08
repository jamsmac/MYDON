import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonRow } from "./core-client";
import type { Reply } from "./handler";
import { доставитьОтвет, type ReplyDeliveryDeps } from "./reply-delivery";
import { TelegramError } from "./telegram";

const ВЛАДЕЛЕЦ: PersonRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Жамшид",
  role: null,
  roles: ["owner"],
  tgUsername: "owner",
  tgChatId: "111",
  active: "yes",
};

const ДОКУМЕНТ = {
  filename: "Дебиторка GLOBERENT 08.09.2026.xlsx",
  content: Buffer.from("PK-xlsx"),
  domain: "globerent" as const,
};

/** Отказ Telegram на текстовом сообщении — тот самый, что уносил архивацию. */
const ДЛИННЫЙ_ОТВЕТ = new TelegramError(
  "sendMessage",
  400,
  "Bad Request: message is too long",
  null,
);

function стенд(
  opts: {
    текстПадает?: unknown;
    частиПадают?: unknown;
    архивПадает?: unknown;
    отправкаФайлаПадает?: unknown;
    владелец?: PersonRow | null | "core-down";
    panelUrl?: string;
  } = {},
) {
  const порядок: string[] = [];
  const сообщения: string[] = [];
  const отправлено: string[] = [];
  const лог: string[] = [];
  let текстов = 0;
  const deps: ReplyDeliveryDeps = {
    sendMessage: async (text) => {
      текстов += 1;
      порядок.push("text");
      // Первый вызов — сам ответ; дальше части и строки о судьбе файла.
      if (текстов === 1 && opts.текстПадает !== undefined) throw opts.текстПадает;
      if (текстов > 1 && opts.частиПадают !== undefined && text.startsWith("часть")) {
        throw opts.частиПадают;
      }
      сообщения.push(text);
    },
    sendDocument: async (filename) => {
      порядок.push("send");
      if (opts.отправкаФайлаПадает !== undefined) throw opts.отправкаФайлаПадает;
      отправлено.push(filename);
    },
    resolveOwner: async () => (opts.владелец === undefined ? ВЛАДЕЛЕЦ : opts.владелец),
    save: async () => {
      порядок.push("save");
      if (opts.архивПадает !== undefined) throw opts.архивПадает;
      return { id: "a1" };
    },
    panelUrl: opts.panelUrl ?? "https://panel.example",
    log: (message) => {
      лог.push(message);
    },
  };
  return { deps, порядок, сообщения, отправлено, лог };
}

const ОТВЕТ: Reply = { text: "Готово, я построил дебиторку." };

describe("Доставка ответа: отказ отправки ТЕКСТА не уносит архивацию файла (круг 3, A-1)", () => {
  it("sendMessage бросил → файл В АРХИВЕ и в чате, владельцу сказано словами", async () => {
    const st = стенд({ текстПадает: ДЛИННЫЙ_ОТВЕТ });
    const итог = await доставитьОтвет(st.deps, { ...ОТВЕТ, document: ДОКУМЕНТ });

    // Порядок и есть обязательство: текст сорвался ПЕРВЫМ, архив всё равно
    // случился, и строка владельцу пришла ПОСЛЕ архива, а не вместо него.
    assert.deepEqual(st.порядок, ["text", "save", "send", "text"]);
    assert.equal(итог.textSent, false);
    assert.equal(итог.document?.savedId, "a1");
    assert.equal(итог.document?.sent, true);
    assert.deepEqual(st.отправлено, [ДОКУМЕНТ.filename]);
    assert.equal(st.сообщения.length, 1, "владельцу ровно одна строка — про потерянный текст");
    assert.match(st.сообщения[0]!, /Текст ответа не дошёл до чата/);
    assert.match(
      st.сообщения[0]!,
      /Файл уже в архиве: https:\/\/panel\.example\/artifacts\?q=/,
      "иначе владелец закажет второй вызов модели за тем же файлом",
    );
    assert.ok(st.лог.includes("Текст ответа не отправлен"));
  });

  it("текст сорвался, а архив не принял файл → молчания нет: названо и то, и другое", async () => {
    const st = стенд({ текстПадает: ДЛИННЫЙ_ОТВЕТ, владелец: null });
    const итог = await доставитьОтвет(st.deps, { ...ОТВЕТ, document: ДОКУМЕНТ });
    assert.equal(итог.document?.savedId, null);
    assert.equal(итог.document?.sent, true);
    // Первая строка — от архива (почему не лёг), вторая — про текст.
    assert.match(st.сообщения[0]!, /в архив не лёг: чат не привязан к человеку/);
    assert.match(st.сообщения[1]!, /Текст ответа не дошёл до чата\. Спроси ещё раз\./);
    assert.doesNotMatch(st.сообщения[1]!, /в архиве/);
  });

  it("текст сорвался, документа в ответе нет → одна строка «спроси ещё раз», архива не звали", async () => {
    const st = стенд({ текстПадает: new Error("socket hang up") });
    const итог = await доставитьОтвет(st.deps, ОТВЕТ);
    assert.deepEqual(st.порядок, ["text", "text"]);
    assert.equal(итог.document, null);
    assert.deepEqual(st.сообщения, ["⚠️ Текст ответа не дошёл до чата. Спроси ещё раз."]);
  });

  it("Telegram мёртв целиком: строка о потерянном тексте тоже не уходит — но в логе есть", async () => {
    // Владелец не узнает ничего (сказать нечем), а архив всё равно состоялся:
    // это и есть разница между «файл потерян» и «файл на месте, связи нет».
    const st = стенд({ текстПадает: ДЛИННЫЙ_ОТВЕТ, отправкаФайлаПадает: ДЛИННЫЙ_ОТВЕТ });
    const deps: ReplyDeliveryDeps = {
      ...st.deps,
      sendMessage: async () => {
        throw ДЛИННЫЙ_ОТВЕТ;
      },
    };
    const итог = await доставитьОтвет(deps, { ...ОТВЕТ, document: ДОКУМЕНТ });
    assert.equal(итог.document?.savedId, "a1", "архив состоялся при мёртвом Telegram");
    assert.equal(итог.textSent, false);
    assert.ok(st.лог.includes("Владелец не узнал о потерянном тексте"));
  });

  it("всё удалось — лишних слов нет: файл в чате говорит сам за себя", async () => {
    const st = стенд();
    const итог = await доставитьОтвет(st.deps, { ...ОТВЕТ, document: ДОКУМЕНТ });
    assert.deepEqual(st.порядок, ["text", "save", "send"]);
    assert.deepEqual(st.сообщения, [ОТВЕТ.text]);
    assert.deepEqual(итог, { textSent: true, document: { savedId: "a1", sent: true } });
  });

  it("части ответа: обрыв на середине не уносит ни файл, ни слово владельцу", async () => {
    const st = стенд({ частиПадают: new Error("Telegram ответил 429") });
    const итог = await доставитьОтвет(st.deps, {
      ...ОТВЕТ,
      more: ["часть 2", "часть 3"],
      document: ДОКУМЕНТ,
    });
    assert.equal(итог.document?.savedId, "a1", "документ обязан уехать после сорвавшихся частей");
    assert.ok(
      st.сообщения.some((m) => /Остальные части не дошли/.test(m)),
      "недоехавшие части владелец прочитал бы как «маршрут кончился»",
    );
    assert.ok(st.лог.includes("Части ответа не отправлены"));
  });

  it("клавиатура уходит с первым сообщением, у частей её нет", async () => {
    const клавиатуры: unknown[] = [];
    const st = стенд();
    const deps: ReplyDeliveryDeps = {
      ...st.deps,
      sendMessage: async (_text, keyboard) => {
        клавиатуры.push(keyboard);
      },
    };
    const keyboard = { inline_keyboard: [[{ text: "Да", callback_data: "ok" }]] };
    await доставитьОтвет(deps, { ...ОТВЕТ, keyboard, more: ["часть 2"] });
    assert.deepEqual(клавиатуры, [keyboard, undefined]);
  });

  it("неожиданный отказ доставки файла не съедает строку про потерянный текст", async () => {
    // `доставитьДокумент` держит свои три шага под своими `try`, но ДО них
    // считает имя и MIME: `path.extname` от нестроки бросает TypeError раньше
    // любого барьера. Обязательство «владельцу сказано словами» принадлежит
    // этому модулю, а не дисциплине соседнего: испорченный `filename` от
    // будущего производителя документов не должен превращаться в молчание.
    const st = стенд({ текстПадает: ДЛИННЫЙ_ОТВЕТ });
    const битый = { filename: undefined as unknown as string, content: Buffer.from("x") };
    const итог = await доставитьОтвет(st.deps, { ...ОТВЕТ, document: битый });
    assert.equal(итог.document, null);
    assert.ok(st.лог.includes("Доставка документа сорвалась целиком"));
    assert.ok(
      st.сообщения.some((m) => /Текст ответа не дошёл до чата/.test(m)),
      "молчание владельцу — ровно тот отказ, ради которого затевался срез",
    );
  });
});
