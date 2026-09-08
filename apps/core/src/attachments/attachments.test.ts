// Метаданные Nest (`__guards__`, IS_PUBLIC) существуют только при загруженном
// reflect-metadata: без него ассерты про гарды прошли бы на `undefined`.
import "reflect-metadata";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { domainEnum } from "@mydon/db";
import { ATTACHMENT_KINDS, DOMAINS } from "@mydon/shared";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ARTIFACT_KINDS } from "../artifacts/artifacts.service";
import { IS_PUBLIC } from "../common/public.decorator";
import { ReadTokenGuard } from "../common/read-token.guard";
import {
  ATTACHMENT_TAGS_MAX,
  ATTACHMENT_TAG_MAX,
  ATTACHMENT_TITLE_MAX,
  AttachmentsController,
  UploadDto,
  isImageMime,
} from "./attachments.controller";
import { AttachmentsModule } from "./attachments.module";
import { AttachmentsService, tagsOf } from "./attachments.service";
import { StorageService } from "./storage.service";

/** Мок хранилища: ссылку строим предсказуемо, чтобы проверять раскладку. */
const storage = { url: async (id: string) => `/attachments/${id}/raw` } as never;

/** Мок db.select().from().where().orderBy() → заданные строки. */
function dbReturning(rows: Record<string, unknown>[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: async () => rows }),
      }),
    }),
  } as never;
}

const row = (id: string, ownerId: string, kind = "photo") => ({
  id,
  ownerType: "entity",
  ownerId,
  kind,
  storageKey: `k/${id}`,
  mime: "image/jpeg",
  bytes: 100,
  createdBy: "staff",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  // Как у строк, записанных до среза A3: колонки есть (миграция 0089), значения пустые.
  title: null,
  domain: null,
  tags: [],
});

/** Типы файлов `@mydon/documents` — то, что бот с среза A3 кладёт в архив. */
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

describe("Вложения многих записей одним запросом", () => {
  it("пустой набор — не ходит в базу, отдаёт пустую карту", async () => {
    let queried = false;
    const db = {
      select: () => {
        queried = true;
        return { from: () => ({ where: () => ({ orderBy: async () => [] }) }) };
      },
    } as never;
    const s = new AttachmentsService(db, storage);
    const res = await s.ofOwners("entity", []);
    assert.deepEqual(res, {});
    assert.equal(queried, false, "по пустому набору запрос делать незачем");
  });

  it("раскладывает вложения по владельцам", async () => {
    const s = new AttachmentsService(
      dbReturning([row("a1", "e1"), row("a2", "e1"), row("a3", "e2")]),
      storage,
    );
    const res = await s.ofOwners("entity", ["e1", "e2"]);
    assert.equal(res.e1.length, 2);
    assert.equal(res.e2.length, 1);
    assert.equal(res.e1[0].url, "/attachments/a1/raw");
  });

  it("владелец без вложений просто отсутствует в карте", async () => {
    const s = new AttachmentsService(dbReturning([row("a1", "e1")]), storage);
    const res = await s.ofOwners("entity", ["e1", "e2"]);
    assert.deepEqual(Object.keys(res), ["e1"]);
    assert.equal(res.e2, undefined);
  });
});

// ── Загрузка: тип владельца и тип файла ──────────────────────────────────────

/** Мок хранилища и базы для загрузки: ключ в хранилище и строка, ушедшая в insert, — наружу. */
function uploadHarness() {
  const written: { key: string; mime: string | null }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const storage = {
    keyFor: (ownerType: string, ownerId: string, ext: string) => `${ownerType}/${ownerId}/f${ext}`,
    put: async (key: string, _bytes: Buffer, mime: string | null) => {
      written.push({ key, mime });
    },
    url: async (id: string) => `/attachments/${id}/raw`,
  } as never;
  const db = {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return {
          returning: async () => [{ ...v, id: "a1", stage: null, createdAt: new Date("2026-08-01T00:00:00Z") }],
        };
      },
    }),
  } as never;
  return { service: new AttachmentsService(db, storage), written, inserted };
}

const file = (mimetype: string) => ({
  buffer: Buffer.from("x"),
  mimetype,
  size: 1,
  originalname: "f",
});

const upload = (kind: string) => ({ ownerType: "entity", ownerId: "e1", kind });

describe("Загрузка: белый список типов файла", () => {
  it("фото — только изображение", async () => {
    const { service } = uploadHarness();
    await assert.rejects(() => service.upload(upload("photo"), file("text/html")), /Не изображение/);
  });

  it("чек и документ: HTML не принимаем — иначе он вернётся как HTML на origin панели", async () => {
    for (const kind of ["receipt", "doc"]) {
      const { service, written } = uploadHarness();
      await assert.rejects(
        () => service.upload(upload(kind), file("text/html")),
        /Недопустимый тип файла/,
        `${kind}: text/html обязан быть отклонён`,
      );
      assert.deepEqual(written, [], "отклонённый файл в хранилище не попадает");
    }
  });

  it("чек и документ: изображение и PDF проходят, расширение по типу", async () => {
    const { service, written } = uploadHarness();
    const pdf = await service.upload(upload("receipt"), file("application/pdf"));
    assert.equal(pdf.mime, "application/pdf");
    const jpg = await service.upload(upload("doc"), file("image/jpeg"));
    assert.equal(jpg.mime, "image/jpeg");
    assert.deepEqual(
      written.map((w) => w.key),
      ["entity/e1/f.pdf", "entity/e1/f.jpg"],
    );
  });
});

describe("Загрузка: тип владельца — часть пути в хранилище", () => {
  const dto = (ownerType: string) =>
    plainToInstance(UploadDto, { ownerType, ownerId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" });

  it("«../» в типе владельца не проходит валидацию", async () => {
    for (const bad of ["../../../etc/cron.d", "entity/../..", "Entity", "1entity", "entity-1", ""]) {
      const errors = await validate(dto(bad));
      assert.ok(errors.length > 0, `${bad} обязан быть отклонён`);
    }
  });

  it("реально используемые типы владельца принимаются", async () => {
    for (const ok of ["entity", "task", "vending_purchase_order"]) {
      assert.deepEqual(await validate(dto(ok)), [], `${ok} должен проходить`);
    }
  });
});

describe("Хранилище на диске: ключ не выводит за пределы тома", () => {
  /** Реальный диск: проверяем именно то, что файл вне тома не появляется. */
  function localStorage(): { storage: StorageService; root: string } {
    const root = mkdtempSync(path.join(tmpdir(), "mydon-att-"));
    for (const key of ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"]) {
      delete process.env[key];
    }
    process.env.STORAGE_LOCAL_DIR = path.join(root, "attachments");
    return { storage: new StorageService(), root };
  }

  it("запись по ключу с «..» отклоняется, файл вне тома не создаётся", async () => {
    const { storage, root } = localStorage();
    const escape = path.join(root, "escaped.txt");
    await assert.rejects(
      () => storage.put("../escaped.txt", Buffer.from("вне тома"), "text/plain"),
      /за пределы хранилища/,
    );
    assert.equal(existsSync(escape), false, "файл вне тома появиться не должен");
    await assert.rejects(
      () => storage.put("/etc/cron.d/mydon", Buffer.from("x"), "text/plain"),
      /за пределы хранилища/,
    );
  });

  it("чтение по ключу с «..» тоже отклоняется", async () => {
    const { storage } = localStorage();
    await assert.rejects(() => storage.read("../../etc/passwd"), /за пределы хранилища/);
  });

  it("нормальный ключ пишется и читается", async () => {
    const { storage } = localStorage();
    await storage.put("entity/e1/f.jpg", Buffer.from("байты"), "image/jpeg");
    assert.equal((await storage.read("entity/e1/f.jpg")).toString(), "байты");
  });
});

describe("Отдача байтов: браузер не должен угадывать тип", () => {
  /** Мок express-ответа: наружу — заголовки и отданные байты. */
  function fakeRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      res: {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        send: () => undefined,
      } as never,
    };
  }

  const controller = (mime: string | null) =>
    new AttachmentsController({ raw: async () => ({ bytes: Buffer.from("x"), mime }) } as never);

  it("картинка: nosniff есть, вложением не отдаём — она идёт в <img>", async () => {
    const { headers, res } = fakeRes();
    await controller("image/jpeg").raw("a1", res);
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Content-Disposition"], undefined);
  });

  it("не картинка: nosniff и отдача вложением", async () => {
    for (const mime of ["application/pdf", DOCX_MIME, "text/html", null]) {
      const { headers, res } = fakeRes();
      await controller(mime).raw("a1", res);
      assert.equal(headers["X-Content-Type-Options"], "nosniff");
      assert.equal(headers["Content-Disposition"], "attachment", `${mime}: обязано быть вложением`);
    }
  });

  it("SVG — не inline-картинка: верно заявленный тип исполняет скрипты, nosniff не спасает", async () => {
    // Легаси-строки до белого списка загрузки могли записать любой mime —
    // барьер обязан стоять на отдаче, а не только на приёме.
    for (const mime of ["image/svg+xml", "IMAGE/SVG+XML", "image/svg+xml;charset=utf-8"]) {
      const { headers, res } = fakeRes();
      await controller(mime).raw("a1", res);
      assert.equal(headers["Content-Disposition"], "attachment", `${mime}: обязан уходить вложением`);
    }
  });

  it("на raw всегда стоит CSP-страховка: sandbox запрещает скрипты при прямом переходе", async () => {
    for (const mime of ["image/jpeg", "image/svg+xml", "application/pdf", null]) {
      const { headers, res } = fakeRes();
      await controller(mime).raw("a1", res);
      assert.equal(headers["Content-Security-Policy"], "default-src 'none'; sandbox");
    }
  });

  it("isImageMime: замкнутый список, регистр и параметры типа не путают", () => {
    assert.equal(isImageMime("IMAGE/PNG"), true);
    assert.equal(isImageMime("image/jpeg;charset=binary"), true);
    assert.equal(isImageMime("image/svg+xml"), false);
    assert.equal(isImageMime("image/gif"), false, "gif не в белом списке — вложением");
    assert.equal(isImageMime("text/html"), false);
    assert.equal(isImageMime(null), false);
  });
});

// ── Срез A3: title / domain / tags и документы бота ──────────────────────────

const OWNER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

/** Вход как реально приходит из multipart: строки, без приведения типов. */
const artifactDto = (extra: Record<string, unknown>) =>
  plainToInstance(UploadDto, { ownerType: "person", ownerId: OWNER_ID, kind: "doc", ...extra });

describe("Артефакты: старый вызов без новых полей — как раньше", () => {
  it("DTO без title/domain/tags проходит валидацию, поля не выдумываются", async () => {
    const dto = artifactDto({ createdBy: "staff:1", stage: "before" });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title, undefined);
    assert.equal(dto.domain, undefined);
    assert.equal(dto.tags, undefined);
  });

  it("сервис пишет null / null / [] — фото и чеки полевого контура не меняются", async () => {
    const { service, inserted } = uploadHarness();
    const meta = await service.upload(upload("photo"), file("image/jpeg"));
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].title, null);
    assert.equal(inserted[0].domain, null);
    assert.deepEqual(inserted[0].tags, []);
    assert.equal(meta.title, null);
    assert.equal(meta.domain, null);
    assert.deepEqual(meta.tags, []);
  });
});

describe("Артефакты: title/domain/tags сохраняются и возвращаются", () => {
  it("DTO принимает все три поля как есть", async () => {
    const dto = artifactDto({ title: "Дебиторка GLOBERENT за август", domain: "globerent", tags: ["bot"] });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title, "Дебиторка GLOBERENT за август");
    assert.equal(dto.domain, "globerent");
    assert.deepEqual(dto.tags, ["bot"]);
  });

  it("сервис кладёт поля в строку и отдаёт их в метаданных", async () => {
    const { service, inserted } = uploadHarness();
    const meta = await service.upload(
      {
        ownerType: "person",
        ownerId: OWNER_ID,
        kind: "doc",
        title: "Дебиторка",
        domain: "globerent",
        tags: ["bot", "report"],
      },
      file("application/pdf"),
    );
    assert.equal(inserted[0].title, "Дебиторка");
    assert.equal(inserted[0].domain, "globerent");
    assert.deepEqual(inserted[0].tags, ["bot", "report"]);
    assert.equal(meta.title, "Дебиторка");
    assert.equal(meta.domain, "globerent");
    assert.deepEqual(meta.tags, ["bot", "report"]);
  });

  it("теги из jsonb: не-строки отбрасываются, а не роняют список", async () => {
    const s = new AttachmentsService(dbReturning([{ ...row("a1", "e1"), tags: ["bot", 7, null] }]), storage);
    const res = await s.ofOwner("entity", "e1");
    assert.deepEqual(res[0].tags, ["bot"]);
    assert.equal(res[0].title, null);
    assert.equal(res[0].domain, null);
  });

  it("tagsOf: не-массив — пустой список, а не исключение", () => {
    assert.deepEqual(tagsOf(null), []);
    assert.deepEqual(tagsOf("bot"), []);
    assert.deepEqual(tagsOf({ a: 1 }), []);
    assert.deepEqual(tagsOf(["a", 1, "b"]), ["a", "b"]);
  });
});

describe("Артефакты: длинное название зажимается, а не отвергается", () => {
  it("200 символов → ровно 120, без ошибки валидации", async () => {
    const dto = artifactDto({ title: "д".repeat(200) });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title?.length, ATTACHMENT_TITLE_MAX);
  });

  it("режем по символам, а не по UTF-16: эмодзи не разрубается пополам", async () => {
    const dto = artifactDto({ title: "😀".repeat(150) });
    assert.deepEqual(await validate(dto), []);
    assert.equal(Array.from(dto.title ?? "").length, ATTACHMENT_TITLE_MAX);
    assert.equal(
      dto.title?.length,
      ATTACHMENT_TITLE_MAX * 2,
      "каждый эмодзи — пара суррогатов, обе половины на месте",
    );
  });

  it("пробелы по краям срезаются; пустое название — как отсутствующее", async () => {
    assert.equal(artifactDto({ title: "  Отчёт  " }).title, "Отчёт");
    const empty = artifactDto({ title: "   " });
    assert.deepEqual(await validate(empty), []);
    assert.equal(empty.title, undefined);
  });

  it("не строка — не зажимается молча, а отвергается", async () => {
    const errors = await validate(artifactDto({ title: 42 }));
    assert.ok(
      errors.some((e) => e.property === "title"),
      "число в title обязано быть отклонено",
    );
  });
});

describe("Артефакты: направление — только из перечня domainEnum", () => {
  it("перечень DTO и DOMAINS из @mydon/shared — один и тот же список", () => {
    assert.deepEqual([...domainEnum.enumValues], [...DOMAINS]);
  });

  it("каждое значение перечня проходит", async () => {
    for (const d of domainEnum.enumValues) {
      assert.deepEqual(await validate(artifactDto({ domain: d })), [], `${d} должен проходить`);
    }
  });

  it("пустая строка из формы — «не указано», а не ошибка", async () => {
    const dto = artifactDto({ domain: "" });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.domain, undefined);
  });

  it("чужое направление → ошибка валидации (ValidationPipe отдаст 400)", async () => {
    for (const bad of ["ozon", "GLOBERENT", "vendhub ", 7]) {
      const errors = await validate(artifactDto({ domain: bad }));
      assert.ok(
        errors.some((e) => e.property === "domain"),
        `«${String(bad)}» обязано быть отклонено`,
      );
    }
  });
});

describe("Артефакты: вид вложения — один список на бота, Core и панель (круг починок 3, B-1)", () => {
  it("перечень договора и то, что принимает UploadDto, — один и тот же объект", () => {
    // `ARTIFACT_KINDS` фильтра витрины — не копия, а ссылка: третий список
    // (а он тут уже был) не покраснил бы ни один тест.
    assert.equal(ARTIFACT_KINDS, ATTACHMENT_KINDS);
  });

  it("каждое значение перечня проходит валидацию DTO", async () => {
    // Дотягиваемся до самого `@IsIn`, а не до литерала рядом с ним: до этой
    // проверки заявленная «сверка с UploadDto.kind» шла мимо DTO вовсе.
    for (const k of ATTACHMENT_KINDS) {
      assert.deepEqual(await validate(artifactDto({ kind: k })), [], `${k} должен проходить`);
    }
  });

  it("чужой вид → ошибка по своему полю, а не тихая загрузка не того", async () => {
    for (const bad of ["video", "Doc", "doc ", 7, ["doc", "photo"]]) {
      const errors = await validate(artifactDto({ kind: bad }));
      assert.ok(
        errors.some((e) => e.property === "kind"),
        `«${String(bad)}» обязано быть отклонено`,
      );
    }
  });
});

describe("Артефакты: теги из multipart", () => {
  it("одно поле приходит строкой — становится массивом из одного тега", async () => {
    const dto = artifactDto({ tags: "bot" });
    assert.deepEqual(await validate(dto), []);
    assert.deepEqual(dto.tags, ["bot"]);
  });

  it("повторённое поле — массив; пробелы срезаются, пустые теги выбрасываются", async () => {
    const dto = artifactDto({ tags: ["bot", " report ", "", "  "] });
    assert.deepEqual(await validate(dto), []);
    assert.deepEqual(dto.tags, ["bot", "report"]);
  });

  it("не строка внутри, слишком длинный тег, слишком много тегов, не массив — отказ", async () => {
    const cases: unknown[] = [
      [7],
      ["x".repeat(ATTACHMENT_TAG_MAX + 1)],
      Array.from({ length: ATTACHMENT_TAGS_MAX + 1 }, (_, i) => `t${i}`),
      { bot: true },
    ];
    for (const bad of cases) {
      const errors = await validate(artifactDto({ tags: bad }));
      assert.ok(
        errors.some((e) => e.property === "tags"),
        `${JSON.stringify(bad).slice(0, 40)} обязано быть отклонено`,
      );
    }
  });
});

describe("Документ: файлы @mydon/documents проходят белый список", () => {
  it("docx/xlsx/pptx принимаются для kind=doc, расширение по типу", async () => {
    const { service, written } = uploadHarness();
    const cases: [string, string][] = [
      [DOCX_MIME, ".docx"],
      [XLSX_MIME, ".xlsx"],
      [PPTX_MIME, ".pptx"],
    ];
    for (const [mime] of cases) await service.upload(upload("doc"), file(mime));
    assert.deepEqual(
      written.map((w) => w.key),
      cases.map(([, ext]) => `entity/e1/f${ext}`),
    );
  });

  it("для фото Office-тип по-прежнему «не изображение»", async () => {
    const { service, written } = uploadHarness();
    await assert.rejects(() => service.upload(upload("photo"), file(DOCX_MIME)), /Не изображение/);
    assert.deepEqual(written, []);
  });

  it("HTML для документа по-прежнему отклоняется — белый список расширен, а не открыт", async () => {
    const { service, written } = uploadHarness();
    await assert.rejects(() => service.upload(upload("doc"), file("text/html")), /Недопустимый тип файла/);
    assert.deepEqual(written, []);
  });
});

// ── Срез A3, ловушка спеки §6 п. 3: вложения закрыты токеном и на чтение ─────

describe("Читающие двери вложений — за сервисным токеном (ловушка спеки A3 §6 п. 3)", () => {
  const prev = process.env.SERVICE_TOKEN;
  afterEach(() => {
    if (prev === undefined) delete process.env.SERVICE_TOKEN;
    else process.env.SERVICE_TOKEN = prev;
  });

  const ctx = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method: "GET", headers }) }),
      getHandler: () => (): void => undefined,
      getClass: () => class {},
    }) as unknown as Parameters<ReadTokenGuard["canActivate"]>[0];

  it("guard навешен на КОНТРОЛЛЕР: закрыты и raw, и список, и batch, и meta", () => {
    // На маршруте guard был бы забыт следующим `@Get`: витрина `/artifacts`
    // печатает id и владельцев пачкой, и любая новая читающая дверь над
    // `attachment` открывает тот же архив.
    const guards: unknown = Reflect.getMetadata("__guards__", AttachmentsController);
    assert.ok(
      Array.isArray(guards) && guards.includes(ReadTokenGuard),
      "нет @UseGuards(ReadTokenGuard) на AttachmentsController",
    );
  });

  it("на raw больше нет @Public(): пометка «намеренно открыт» была бы ложью", () => {
    for (const цель of [
      AttachmentsController,
      AttachmentsController.prototype.raw,
      AttachmentsController.prototype.list,
      AttachmentsController.prototype.batch,
      AttachmentsController.prototype.meta,
    ]) {
      assert.equal(
        Reflect.getMetadata(IS_PUBLIC, цель),
        undefined,
        "@Public() на вложениях: глобальный guard и так пропускает GET, а пометка врёт про открытость",
      );
    }
  });

  it("guard — провайдер модуля: иначе Nest создаёт его вслепую", () => {
    const providers: unknown = Reflect.getMetadata("providers", AttachmentsModule);
    assert.ok(
      Array.isArray(providers) && providers.includes(ReadTokenGuard),
      "ReadTokenGuard не в providers AttachmentsModule",
    );
  });

  it("анонимный GET raw отклоняется, верный токен проходит", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
    assert.throws(() => new ReadTokenGuard().canActivate(ctx({ "x-service-token": "wrong" })), /токен/);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ authorization: "Bearer secret" })), true);
  });
});
