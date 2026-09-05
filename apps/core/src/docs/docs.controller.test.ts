import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import { DocFileQueryDto, DocsController } from "./docs.controller";
import { DocsTokenGuard } from "./docs-token.guard";

async function problems(dto: object): Promise<string[]> {
  const flatten = (errors: ValidationError[]): string[] =>
    errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...flatten(e.children ?? [])]);
  return flatten(await validate(dto));
}

describe("DTO пути документа", () => {
  it("принимает репо-относительный путь", async () => {
    const dto = plainToInstance(DocFileQueryDto, { path: "docs/superpowers/specs/x-design.md" });
    assert.deepEqual(await problems(dto), []);
  });

  it("отказывает пустому, отсутствующему и не-строковому пути", async () => {
    for (const bad of [{}, { path: "" }, { path: 42 }, { path: ["docs/a.md"] }]) {
      const dto = plainToInstance(DocFileQueryDto, bad);
      assert.ok((await problems(dto)).length > 0, `${JSON.stringify(bad)} должен быть отклонён`);
    }
  });

  it("режет путь длиннее 512 символов до разбора", async () => {
    const dto = plainToInstance(DocFileQueryDto, { path: `docs/${"a".repeat(600)}.md` });
    assert.ok((await problems(dto)).some((m) => /512/.test(m)));
  });
});

describe("Документы за сервисным токеном на GET (R-M-8)", () => {
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
    }) as unknown as Parameters<DocsTokenGuard["canActivate"]>[0];

  it("анонимный GET отклоняется — глобальный guard чтения пропускает, этот нет", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new DocsTokenGuard().canActivate(ctx()), /токен/);
    assert.throws(() => new DocsTokenGuard().canActivate(ctx({ "x-service-token": "wrong" })), /токен/);
  });

  it("GET с верным токеном проходит (и заголовком, и Bearer)", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.equal(new DocsTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
    assert.equal(new DocsTokenGuard().canActivate(ctx({ authorization: "Bearer secret" })), true);
  });

  it("токен не настроен — читать документы всё равно нельзя (fail-closed)", () => {
    delete process.env.SERVICE_TOKEN;
    assert.throws(() => new DocsTokenGuard().canActivate(ctx()), /токен/);
  });

  it("guard навешен на КОНТРОЛЛЕР — снять его с одного маршрута молча нельзя", () => {
    const guards: unknown = Reflect.getMetadata("__guards__", DocsController);
    assert.ok(Array.isArray(guards) && guards.includes(DocsTokenGuard), "нет @UseGuards(DocsTokenGuard)");
  });
});
