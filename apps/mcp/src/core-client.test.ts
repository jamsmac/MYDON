import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { CoreError, createClient } from "./core-client";

function fetchStub(reply: { status: number; body?: unknown; text?: string }) {
  return mock.fn(async (_url: string, _init?: RequestInit) => ({
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    text: async () => reply.text ?? JSON.stringify(reply.body ?? {}),
  })) as unknown as typeof fetch;
}

/** Аргументы вызовов стаба: `mock.fn` прячет их за типом `fetch`. */
function callsOf(f: typeof fetch): { arguments: [string, RequestInit] }[] {
  return (f as unknown as { mock: { calls: { arguments: [string, RequestInit] }[] } }).mock.calls;
}

function headersOf(f: typeof fetch, call = 0): Record<string, string> {
  return callsOf(f)[call]!.arguments[1].headers as Record<string, string>;
}

describe("Клиент Core (R-A1-1)", () => {
  it("шлёт сервисный токен и не шлёт owner-токен без нужды", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o", fetchImpl: f });
    await c.tasks({});
    const init = (f as unknown as { mock: { calls: { arguments: [string, RequestInit] }[] } }).mock.calls[0]!.arguments[1];
    assert.equal((init.headers as Record<string, string>)["x-service-token"], "s");
    assert.equal((init.headers as Record<string, string>)["x-owner-action-token"], undefined);
  });

  it("owner-действие несёт owner-токен", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o", fetchImpl: f });
    await c.decideApproval("11111111-1111-4111-8111-111111111111", "approved");
    const init = (f as unknown as { mock: { calls: { arguments: [string, RequestInit] }[] } }).mock.calls[0]!.arguments[1];
    assert.equal((init.headers as Record<string, string>)["x-owner-action-token"], "o");
  });

  it("переводит коды Core и никогда не печатает токен", async () => {
    for (const [status, part] of [[401, /токен/i], [403, /личн|owner/i], [404, /не найдено/i], [429, /частот/i]] as const) {
      const c = createClient({ baseUrl: "http://core", serviceToken: "секрет-токен", fetchImpl: fetchStub({ status, text: "" }) });
      await assert.rejects(() => c.briefing(), (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.equal(e.status, status);
        assert.match(e.message, part);
        assert.doesNotMatch(e.message, /секрет-токен/);
        return true;
      });
    }
  });

  it("сеть недоступна — понятная ошибка с адресом", async () => {
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
    await assert.rejects(() => c.briefing(), /недоступен .*http:\/\/core/);
  });

  it("ошибка знает маршрут, на котором произошла", async () => {
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: fetchStub({ status: 404, text: "" }) });
    await assert.rejects(
      () => c.task("11111111-1111-4111-8111-111111111111"),
      (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.equal(e.path, "/tasks/11111111-1111-4111-8111-111111111111");
        return true;
      },
    );
  });

  it("409 отдаёт текст Core как есть", async () => {
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: fetchStub({ status: 409, text: JSON.stringify({ message: "Запрос уже закрыт решением \"approved\"" }) }),
    });
    await assert.rejects(() => c.briefing(), /уже закрыт решением/);
  });

  it("непустые параметры уходят в запрос, пустые — нет", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.tasks({ status: "todo", ownerRef: "", limit: 20 });
    const url = callsOf(f)[0]!.arguments[0];
    assert.match(url, /^http:\/\/core\/tasks\?/);
    assert.match(url, /status=todo/);
    assert.match(url, /limit=20/);
    assert.doesNotMatch(url, /ownerRef/);
  });

  it("без параметров запрос идёт без вопросительного знака", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.events({});
    assert.equal(callsOf(f)[0]!.arguments[0], "http://core/events");
  });

  it("явный личный домен несёт owner-токен (Р-4)", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o", fetchImpl: f });
    await c.tasks({ domain: "personal" });
    assert.equal(headersOf(f)["x-owner-action-token"], "o");
    await c.entities({ domain: "vendhub" });
    assert.equal(headersOf(f, 1)["x-owner-action-token"], undefined);
  });

  it("owner-токен не задан — заголовка нет, вызов всё равно уходит", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.setAutonomy("vendhub-ops", "T1");
    assert.equal(headersOf(f)["x-owner-action-token"], undefined);
    assert.equal(callsOf(f)[0]!.arguments[1].method, "PATCH");
  });

  it("пустое тело ответа не роняет разбор", async () => {
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: fetchStub({ status: 200, text: "   " }) });
    assert.equal(await c.commentTask("11111111-1111-4111-8111-111111111111", "готово"), undefined);
  });

  it("у каждого запроса есть сигнал таймаута", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.briefing();
    assert.ok(callsOf(f)[0]!.arguments[1].signal instanceof AbortSignal);
  });

  it("дека навыков фильтруется по агенту только когда агент назван", async () => {
    const f = fetchStub({ status: 200, body: { items: [] } });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.skillDeck("vendhub-ops");
    await c.skillDeck();
    assert.equal(callsOf(f)[0]!.arguments[0], "http://core/agents/skills?agent=vendhub-ops");
    assert.equal(callsOf(f)[1]!.arguments[0], "http://core/agents/skills");
  });

  it("дерево знаний отбирается по корню на стороне клиента", async () => {
    const tree = [
      { path: "docs/MCP.md", root: "docs", title: "MCP", bytes: 10, updatedAt: "2026-09-06T00:00:00.000Z" },
      { path: "memory/decisions.md", root: "memory", title: "Решения", bytes: 20, updatedAt: "2026-09-06T00:00:00.000Z" },
    ];
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: fetchStub({ status: 200, body: tree }) });
    assert.deepEqual((await c.docsTree({ root: "docs" })).map((i) => i.path), ["docs/MCP.md"]);
    assert.equal((await c.docsTree({})).length, 2);
  });

  it("тело мутации уходит как JSON", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.createTask({ title: "Проверить туннель", ownerKind: "human" });
    const init = callsOf(f)[0]!.arguments[1];
    assert.equal(init.method, "POST");
    assert.equal(headersOf(f)["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(init.body)), { title: "Проверить туннель", ownerKind: "human" });
  });
});
