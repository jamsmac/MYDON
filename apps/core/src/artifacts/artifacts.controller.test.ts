import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Request } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AppModule } from "../app.module";
import { ReadTokenGuard } from "../common/read-token.guard";
import type { Db } from "../db/db.module";
import { ArtifactsController, ArtifactsQueryDto } from "./artifacts.controller";
import { ArtifactsModule } from "./artifacts.module";

/** Db-заглушка для excludePersonal: settingValue = `select().from(systemConfig)`. */
function fakeDb(rows: { key: string; value: string }[] = []): Db {
  return { select: () => ({ from: () => Promise.resolve(rows) }) } as unknown as Db;
}

/** Запрос с заголовками — owner-токен читается из `x-owner-action-token`. */
function req(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

/** Сервис-заглушка: наружу — аргументы вызова. */
function stub(db: Db = fakeDb()) {
  const calls: unknown[][] = [];
  const service = {
    list: async (...args: unknown[]) => {
      calls.push(args);
      return { items: [], next: null, now: "2026-09-08T00:00:00.000Z" };
    },
  };
  return { controller: new ArtifactsController(service as never, db), calls };
}

const ID = "11111111-1111-4111-8111-111111111111";
const dto = (input: Record<string, unknown>) => plainToInstance(ArtifactsQueryDto, input);

describe("GET /artifacts за сервисным токеном (Р-A3-3)", () => {
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

  it("guard навешен на КОНТРОЛЛЕР — будущие маршруты архива закрыты по умолчанию", () => {
    const guards: unknown = Reflect.getMetadata("__guards__", ArtifactsController);
    assert.ok(
      Array.isArray(guards) && guards.includes(ReadTokenGuard),
      "нет @UseGuards(ReadTokenGuard) на ArtifactsController",
    );
  });

  it("модуль зарегистрирован в AppModule — иначе маршрута нет вовсе, а тесты зелёные", () => {
    // `dist/app.module.js` грузится без побочных эффектов (фабрика DbModule
    // ленивая): метаданные Nest — единственный дешёвый способ поймать
    // выпавшую строку в `imports` до старта процесса.
    const imports: unknown = Reflect.getMetadata("imports", AppModule);
    assert.ok(Array.isArray(imports) && imports.includes(ArtifactsModule), "ArtifactsModule не в imports AppModule");
  });

  it("guard — провайдер модуля, контроллер — в модуле: иначе Nest не соберёт маршрут", () => {
    const controllers: unknown = Reflect.getMetadata("controllers", ArtifactsModule);
    const providers: unknown = Reflect.getMetadata("providers", ArtifactsModule);
    assert.ok(Array.isArray(controllers) && controllers.includes(ArtifactsController));
    assert.ok(Array.isArray(providers) && providers.includes(ReadTokenGuard), "ReadTokenGuard резолвится через DI, как в AppsModule");
  });

  it("анонимный GET отклоняется, верный токен проходит", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
  });
});

describe("ArtifactsQueryDto — фильтры и рамки", () => {
  it("полный корректный набор проходит, limit становится числом", async () => {
    const q = dto({
      kind: "doc",
      ownerType: "person",
      ownerId: ID,
      domain: "vendhub",
      from: "2026-09-01",
      to: "2026-09-08T10:00:00.000Z",
      q: "дебиторка",
      limit: "20",
      cursor: "MjAyNg",
    });
    assert.deepEqual(await validate(q), []);
    assert.equal(q.limit, 20);
  });

  it("пустой запрос — тоже корректный (все фильтры необязательны)", async () => {
    assert.deepEqual(await validate(dto({})), []);
  });

  it("`strict` не отсекает то, что шлёт панель: сутки, полный момент и 29 февраля высокосного", async () => {
    // Обратная сторона предыдущего ассерта: пережать так же плохо, как
    // недожать. Панель строит границы `периодВМоменты` (`lib/artifacts.ts`) —
    // это `toISOString()`, то есть полный момент с `Z`; в закладке владельца
    // могут остаться и голые сутки. Всё это Core обязан принять.
    for (const value of [
      "2026-09-08",
      "2026-09-08T10:00:00.000Z",
      "2026-08-31T19:00:00.000Z",
      "2026-09-08T18:59:59.999Z",
      "2028-02-29",
    ]) {
      assert.deepEqual(await validate(dto({ from: value, to: value })), [], `${value} обязан быть принят`);
    }
  });

  it("чужое значение — ошибка по своему полю, а не тихо отброшенный фильтр", async () => {
    for (const input of [
      { kind: "video" },
      { kind: ["doc", "photo"] },
      { ownerType: "../etc" },
      { ownerType: "Person" },
      { ownerId: "nope" },
      { domain: "trent" },
      { from: "вчера" },
      { to: "08.09.2026" },
      // ДЕНЬ, КОТОРОГО НЕТ В КАЛЕНДАРЕ, — тоже чужое значение, а не «почти
      // верное». Форма у него безупречная, и без `strict` валидатор давал 0
      // ошибок, а `new Date("2026-02-30")` в `list` ниже переезжал на 2 марта:
      // окно, которого вызывающий не просил, принятое молча. Панель этот
      // случай отсекает сама (`календарныйДень`), но у двери Core есть
      // прямой вызов и будущий навык `artifacts_list`.
      { from: "2026-02-30" },
      { to: "2026-09-31" },
      { q: ["a", "b"] },
      { q: "x".repeat(201) },
      { limit: "0" },
      { limit: "101" },
      { limit: "abc" },
      { limit: "1.5" },
      { limit: ["5"] },
      { cursor: ["a"] },
    ]) {
      const errors = await validate(dto(input));
      const field = Object.keys(input)[0];
      assert.ok(errors.some((e) => e.property === field), `${JSON.stringify(input)} обязан быть отклонён по ${field}`);
    }
  });
});

describe("ArtifactsController.list — проводка фильтра и личного контура", () => {
  it("даты становятся Date, q обрезается, пустые q/cursor — «не задан»; excludePersonal=false при выключенном флаге", async () => {
    const { controller, calls } = stub();
    await controller.list(
      dto({ kind: "doc", ownerType: "person", ownerId: ID, domain: "globerent", from: "2026-09-01", to: "2026-09-08T10:00:00.000Z", q: "  дебиторка ", limit: "20", cursor: "MjAyNg" }),
      req(),
    );
    await controller.list(dto({ q: "   ", cursor: "" }), req());
    assert.deepEqual(calls, [
      [
        {
          kind: "doc",
          ownerType: "person",
          ownerId: ID,
          domain: "globerent",
          from: new Date("2026-09-01T00:00:00.000Z"),
          to: new Date("2026-09-08T10:00:00.000Z"),
          q: "дебиторка",
          limit: 20,
          cursor: "MjAyNg",
        },
        { excludePersonal: false },
      ],
      [{}, { excludePersonal: false }],
    ]);
  });

  it("флаг включён + нет owner-токена → excludePersonal=true; с owner-токеном — снова false", async () => {
    const prevOwner = process.env.OWNER_ACTION_TOKEN;
    const prevService = process.env.SERVICE_TOKEN;
    process.env.SERVICE_TOKEN = "shared";
    process.env.OWNER_ACTION_TOKEN = "owner-secret";
    try {
      const { controller, calls } = stub(fakeDb([{ key: "OWNER_IDENTITY_ENFORCED", value: "1" }]));
      await controller.list(dto({}), req());
      await controller.list(dto({}), req({ "x-owner-action-token": "owner-secret" }));
      assert.deepEqual(
        calls.map((c) => c[1]),
        [{ excludePersonal: true }, { excludePersonal: false }],
      );
    } finally {
      if (prevOwner === undefined) delete process.env.OWNER_ACTION_TOKEN;
      else process.env.OWNER_ACTION_TOKEN = prevOwner;
      if (prevService === undefined) delete process.env.SERVICE_TOKEN;
      else process.env.SERVICE_TOKEN = prevService;
    }
  });
});
