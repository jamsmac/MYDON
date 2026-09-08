import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CoreError, type PersonRow } from "./core-client";
import {
  доставитьДокумент,
  заголовокИзИмени,
  mimeПоРасширению,
  ссылкаНаАрхив,
  ярлыкПричины,
  type DocumentArchiveDeps,
} from "./document-archive";

const ВЛАДЕЛЕЦ: PersonRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Жамшид",
  role: null,
  roles: ["owner"],
  tgUsername: "owner",
  tgChatId: "111",
  active: "yes",
};

const ФАЙЛ = {
  filename: "Дебиторка GLOBERENT 08.09.2026.xlsx",
  content: Buffer.from("PK-xlsx"),
  domain: "globerent" as const,
};

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function стенд(
  opts: {
    владелец?: PersonRow | null | "core-down";
    поискВладельцаПадает?: unknown;
    архивПадает?: unknown;
    отправкаПадает?: unknown;
    уведомлениеПадает?: boolean;
    panelUrl?: string;
  } = {},
) {
  const порядок: string[] = [];
  const сохранено: Parameters<DocumentArchiveDeps["save"]>[0][] = [];
  const отправлено: { filename: string; bytes: number }[] = [];
  const сообщения: string[] = [];
  const лог: string[] = [];
  const deps: DocumentArchiveDeps = {
    resolveOwner: async () => {
      if (opts.поискВладельцаПадает !== undefined) throw opts.поискВладельцаПадает;
      return opts.владелец === undefined ? ВЛАДЕЛЕЦ : opts.владелец;
    },
    save: async (input) => {
      порядок.push("save");
      if (opts.архивПадает !== undefined) throw opts.архивПадает;
      сохранено.push(input);
      return { id: "a1" };
    },
    sendDocument: async (filename, content) => {
      порядок.push("send");
      if (opts.отправкаПадает !== undefined) throw opts.отправкаПадает;
      отправлено.push({ filename, bytes: content.length });
    },
    sendMessage: async (text) => {
      if (opts.уведомлениеПадает) throw new Error("Telegram ответил 400 на sendMessage");
      сообщения.push(text);
    },
    panelUrl: opts.panelUrl ?? "https://panel.example",
    log: (message) => {
      лог.push(message);
    },
  };
  return { deps, порядок, сохранено, отправлено, сообщения, лог };
}

describe("Архив документов бота (срез A3, Р-A3-1/Р-A3-2)", () => {
  it("сохранение СТРОГО раньше отправки; оба удались — владельцу тишина", async () => {
    const st = стенд();
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.сохранено.length, 1);
    const запись = st.сохранено[0]!;
    assert.equal(запись.ownerType, "person");
    assert.equal(запись.ownerId, ВЛАДЕЛЕЦ.id);
    assert.equal(запись.title, "Дебиторка GLOBERENT 08.09.2026");
    assert.equal(запись.mime, XLSX);
    assert.equal(запись.filename, ФАЙЛ.filename);
    // В архив уходят ТЕ ЖЕ байты, что и в чат: копия без содержимого — не копия.
    assert.deepEqual(запись.bytes, ФАЙЛ.content);
    assert.deepEqual(запись.tags, ["bot"]);
    assert.equal(запись.domain, "globerent");
    // Аудитное поле обязано говорить, КТО попросил: отчёт может запросить любой
    // из заведённых людей, и «owner» про запрос сотрудника было бы ложью.
    assert.equal(запись.createdBy, `person:${ВЛАДЕЛЕЦ.id}`);
    assert.deepEqual(st.отправлено, [{ filename: ФАЙЛ.filename, bytes: ФАЙЛ.content.length }]);
    assert.deepEqual(st.сообщения, []);
    assert.deepEqual(итог, { savedId: "a1", sent: true });
  });

  it("архив бросил → файл всё равно отправлен, владельцу «в архив не лёг: …»", async () => {
    const st = стенд({ архивПадает: new CoreError(400, "/attachments", "Недопустимый тип файла") });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.отправлено.length, 1);
    assert.equal(st.сообщения.length, 1);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core отверг файл/);
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.ok(st.лог.includes("Документ не лёг в архив"));
    assert.deepEqual(итог, { savedId: null, sent: true });
  });

  it("отправка бросила при удавшемся сохранении → ссылка в архив, без «повтори запрос»", async () => {
    const st = стенд({ отправкаПадает: new Error("Telegram ответил 500 на sendDocument") });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    // Порядок здесь и есть Р-A3-1: к моменту сорвавшейся отправки строка в
    // архиве уже есть — потому и говорим «файл в архиве», а не «повтори».
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.сохранено.length, 1);
    assert.equal(
      st.сообщения[0],
      `Отправить в чат не вышло, файл в архиве: https://panel.example/artifacts?q=${encodeURIComponent("Дебиторка GLOBERENT 08.09.2026")}`,
    );
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.ok(st.лог.includes("Файл не отправлен"));
    assert.deepEqual(итог, { savedId: "a1", sent: false });
  });

  it("гость без person: сохранения нет, файл отправлен, сказано словами", async () => {
    const st = стенд({ владелец: null });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["send"]);
    assert.deepEqual(st.сохранено, []);
    assert.equal(st.отправлено.length, 1);
    assert.match(st.сообщения[0]!, /в архив не лёг: чат не привязан к человеку/);
    assert.deepEqual(итог, { savedId: null, sent: true });
  });

  it("Core недоступен при поиске владельца: не сохраняем, файл отправлен, причина названа", async () => {
    const st = стенд({ владелец: "core-down" });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["send"]);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core не ответил\./);
  });

  it("оба шага сорвались: файл потерян, сказано прямо, без старого «повтори запрос»", async () => {
    const st = стенд({
      архивПадает: new CoreError(500, "/attachments", "boom"),
      отправкаПадает: new Error("Telegram ответил 502 на sendDocument"),
    });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.match(st.сообщения[0]!, /не отправился и в архив не лёг: Core ответил 500/);
    assert.match(st.сообщения[0]!, /потерян/);
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.deepEqual(итог, { savedId: null, sent: false });
  });

  it("текст исключения наружу не едет — только ярлык", async () => {
    const st = стенд({ архивПадает: new Error("ECONNREFUSED 127.0.0.1:3001 /secret/path") });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.doesNotMatch(st.сообщения[0]!, /ECONNREFUSED|secret/);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core недоступен\./);
  });

  it("сбой самой строки-уведомления не роняет доставку", async () => {
    const st = стенд({ владелец: null, уведомлениеПадает: true });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.equal(итог.sent, true);
    assert.ok(st.лог.includes("Владелец не узнал о судьбе файла"));
  });

  it("без домена поле в архив не передаётся вовсе", async () => {
    const st = стенд();
    await доставитьДокумент(st.deps, {
      filename: "Задачи 08.09.2026.docx",
      content: Buffer.from("x"),
    });
    assert.equal(Object.hasOwn(st.сохранено[0]!, "domain"), false);
  });

  it("поиск владельца бросил — файл всё равно отправлен, причина названа", async () => {
    // Половина «архив» не имеет права уронить половину «отправка» ЦЕЛИКОМ, а
    // не только на записи (Р-A3-2). Сегодня провод `personOf` глотает всё сам,
    // но гарантия принадлежит этому модулю, а не дисциплине вызывающего:
    // без своего барьера дорогой файл терялся бы из-за чужого throw.
    const st = стенд({ поискВладельцаПадает: new Error("fetch failed") });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["send"]);
    assert.equal(итог.sent, true);
    assert.equal(итог.savedId, null);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core недоступен\./);
    assert.ok(st.лог.includes("Владелец документа не найден"));
  });

  it("ссылка без CC_PUBLIC_URL — путь, место всё равно названо", async () => {
    const st = стенд({ panelUrl: "", отправкаПадает: new Error("500") });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.match(st.сообщения[0]!, /файл в архиве: \/artifacts\?q=/);
  });
});

describe("MIME по расширению — то, что примет белый список Core", () => {
  it("четыре формата @mydon/documents", () => {
    assert.equal(mimeПоРасширению("а.xlsx"), XLSX);
    assert.equal(
      mimeПоРасширению("а.docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(
      mimeПоРасширению("а.pptx"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    assert.equal(mimeПоРасширению("а.pdf"), "application/pdf");
  });

  it("регистр расширения не важен, неизвестное → octet-stream (Core отвергнет вслух)", () => {
    assert.equal(mimeПоРасширению("Отчёт.XLSX"), XLSX);
    assert.equal(mimeПоРасширению("script.html"), "application/octet-stream");
    assert.equal(mimeПоРасширению("без-расширения"), "application/octet-stream");
  });
});

describe("Имя артефакта", () => {
  it("имя файла без расширения", () => {
    assert.equal(
      заголовокИзИмени("Дебиторка GLOBERENT 08.09.2026.xlsx"),
      "Дебиторка GLOBERENT 08.09.2026",
    );
    assert.equal(заголовокИзИмени("без-расширения"), "без-расширения");
  });

  it("длинное имя уезжает целиком: предел 120 живёт в Core, а не здесь", () => {
    // Зажим по спеке §6 п. 4 стоит на входе Core (`clampAttachmentTitle`,
    // задача 3) и режет по code point. Повторить его здесь `slice` по UTF-16
    // значило бы завести второй дом правилу и рискнуть половиной суррогатной
    // пары в БД. Бот имена собирает сам («Дебиторка … 08.09.2026»), до 120 им
    // далеко.
    const длинное = "а".repeat(200);
    assert.equal(заголовокИзИмени(`${длинное}.docx`), длинное);
  });
});

describe("Ярлык причины", () => {
  it("статусы Core → слова, без текста тела", () => {
    assert.equal(ярлыкПричины(new CoreError(400, "/attachments", "тело")), "Core отверг файл");
    assert.equal(ярлыкПричины(new CoreError(403, "/attachments", "")), "нет доступа к Core");
    assert.equal(ярлыкПричины(new CoreError(413, "/attachments", "")), "файл слишком большой");
    assert.equal(ярлыкПричины(new CoreError(503, "/attachments", "")), "Core ответил 503");
  });

  it("таймаут и прочее", () => {
    assert.equal(
      ярлыкПричины(Object.assign(new Error("x"), { name: "TimeoutError" })),
      "Core не ответил вовремя",
    );
    assert.equal(ярлыкПричины(new Error("ECONNREFUSED")), "Core недоступен");
    assert.equal(ярлыкПричины("строка"), "Core недоступен");
  });
});

describe("Ссылка в витрину", () => {
  it("кодирует название и клеится к базе", () => {
    assert.equal(
      ссылкаНаАрхив("https://panel.example", "Дебиторка GLOBERENT"),
      "https://panel.example/artifacts?q=%D0%94%D0%B5%D0%B1%D0%B8%D1%82%D0%BE%D1%80%D0%BA%D0%B0%20GLOBERENT",
    );
    assert.equal(ссылкаНаАрхив("", "x"), "/artifacts?q=x");
  });
});

/**
 * СТОРОЖ ПРОВОДА в index.ts (`main()` → `processUpdate` не экспортируется, и
 * замыкание тестом не позвать). Читает исходник, а не поведение, — поэтому
 * граница честности такая:
 *
 *  • ЧТО ДОКАЗЫВАЕТ: у документа в боте одна дверь — `доставитьДокумент`;
 *    прямого `tg.sendDocument` в обход архива нет, и старая строка «повтори
 *    запрос» не вернулась (спека §2.1: повторять незачем, файл в архиве).
 *  • ЧЕГО НЕ ДОКАЗЫВАЕТ: порядок «архив → Telegram» — он проверяется выше,
 *    массивом вызовов, на настоящих шагах.
 *
 * Grep в брифе жил бы одним прогоном в чужой сессии; проверка, которой нет в
 * репозитории, не существует.
 */
describe("Сторож: доставка документа в index.ts идёт через архив", () => {
  const индекс = path.resolve(__dirname, "../src/index.ts");

  it("исходник бота на месте — иначе сторож молчал бы вместо проверки", () => {
    assert.ok(existsSync(индекс), `не найден ${индекс}`);
  });

  it("одна дверь: доставитьДокумент есть, второго прямого sendDocument нет", () => {
    const код = readFileSync(индекс, "utf8");
    assert.equal(
      (код.match(/доставитьДокумент\(/g) ?? []).length,
      1,
      "документ обязан уходить через document-archive.ts",
    );
    assert.equal(
      (код.match(/tg\.sendDocument\(/g) ?? []).length,
      1,
      "прямая отправка допустима ровно одна — та, что передана в доставитьДокумент",
    );
  });

  it("прежнего «Повтори запрос» в боте нет: файл в архиве, повторять незачем", () => {
    assert.doesNotMatch(readFileSync(индекс, "utf8"), /[Пп]овтори запрос/);
  });
});
