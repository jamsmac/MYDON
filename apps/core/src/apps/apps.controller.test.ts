import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ReadTokenGuard } from "../common/read-token.guard";
import { AppsController } from "./apps.controller";

/**
 * `GET /apps/health` закрыт токеном и на ЧТЕНИЕ (круг починок среза A2, C-1).
 *
 * Строки мониторов цитируют `agent_run.reason`, а колбэк монитора кладёт туда
 * голый `err.message` (`apps/agents/src/monitors.ts`) — текст драйвера с хостом
 * и пользователем БД. Пока маршрут был бестокенным, `/routines/runs` отвечал
 * 401, а это же содержимое уезжало наружу без единого заголовка.
 */
describe("Здоровье приложений за сервисным токеном (круг починок, C-1)", () => {
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

  it("анонимный GET отклоняется — глобальный guard чтения пропускает, этот нет", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
    assert.throws(() => new ReadTokenGuard().canActivate(ctx({ "x-service-token": "wrong" })), /токен/);
  });

  it("GET с верным токеном проходит (и заголовком, и Bearer)", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.equal(new ReadTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ authorization: "Bearer secret" })), true);
  });

  it("токен не настроен — здоровье всё равно закрыто (fail-closed)", () => {
    delete process.env.SERVICE_TOKEN;
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
  });

  it("guard навешен на КОНТРОЛЛЕР — будущие маршруты здоровья закрыты по умолчанию", () => {
    const guards: unknown = Reflect.getMetadata("__guards__", AppsController);
    assert.ok(
      Array.isArray(guards) && guards.includes(ReadTokenGuard),
      "нет @UseGuards(ReadTokenGuard) на AppsController",
    );
  });
});
