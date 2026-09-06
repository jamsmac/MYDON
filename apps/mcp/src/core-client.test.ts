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
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    await c.tasks({});
    assert.equal(headersOf(f)["x-service-token"], "s");
    assert.equal(headersOf(f)["x-owner-action-token"], undefined);
  });

  it("owner-действие несёт owner-токен", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    await c.decideApproval("11111111-1111-4111-8111-111111111111", "approved");
    assert.equal(headersOf(f)["x-owner-action-token"], "o");
  });

  it("переводит коды Core и никогда не печатает токен", async () => {
    for (const [status, part] of [
      [401, /токен/i],
      [403, /личн|owner/i],
      [404, /не найдено/i],
      [429, /частот/i],
    ] as const) {
      const c = createClient({
        baseUrl: "http://core",
        serviceToken: "секрет-токен",
        fetchImpl: fetchStub({ status, text: "" }),
      });
      await assert.rejects(
        () => c.briefing(),
        (e: unknown) => {
          assert.ok(e instanceof CoreError);
          assert.equal(e.status, status);
          assert.match(e.message, part);
          assert.doesNotMatch(e.message, /секрет-токен/);
          return true;
        },
      );
    }
  });

  it("сеть недоступна — понятная ошибка с адресом", async () => {
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    await assert.rejects(() => c.briefing(), /недоступен .*http:\/\/core/);
  });

  it("ошибка знает маршрут, на котором произошла", async () => {
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: fetchStub({ status: 404, text: "" }),
    });
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
      fetchImpl: fetchStub({
        status: 409,
        text: JSON.stringify({ message: 'Запрос уже закрыт решением "approved"' }),
      }),
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
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    await c.tasks({ domain: "personal" });
    assert.equal(headersOf(f)["x-owner-action-token"], "o");
    await c.entities({ domain: "vendhub" });
    assert.equal(headersOf(f, 1)["x-owner-action-token"], undefined);
  });

  it("читающие маршруты под `excludePersonal` несут owner-токен", async () => {
    // Р-4 прячет личное только у ленты задач БЕЗ домена. Эти три маршрута Core
    // гейтит сам: без заголовка `inbox_list` недосчитал бы личные карточки,
    // `task_get` ответил бы «не найдено», а брифинг пришёл бы неполным.
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    await c.pendingEntities();
    await c.task("11111111-1111-4111-8111-111111111111");
    await c.briefing();
    for (const [i, path] of ["/entities/pending", "/tasks/", "/registry/briefing"].entries()) {
      assert.ok(callsOf(f)[i]!.arguments[0].includes(path), `вызов ${i} ушёл не на ${path}`);
      assert.equal(headersOf(f, i)["x-owner-action-token"], "o", `${path} без owner-токена`);
    }
  });

  it("owner-токен не задан — заголовка нет, вызов всё равно уходит", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.setAutonomy("vendhub-ops", "T1");
    assert.equal(headersOf(f)["x-owner-action-token"], undefined);
    assert.equal(callsOf(f)[0]!.arguments[1].method, "PATCH");
  });

  it("пустое тело на успехе — ошибка, а не молчаливый undefined", async () => {
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: fetchStub({ status: 200, text: "   " }),
    });
    await assert.rejects(
      () => c.commentTask("11111111-1111-4111-8111-111111111111", "готово"),
      (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.equal(e.status, 200);
        assert.match(e.message, /пустой ответ/);
        return true;
      },
    );
  });

  it("2xx с телом не-JSON — ошибка про чужой адрес", async () => {
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: fetchStub({ status: 200, text: "<html>502 Bad Gateway</html>" }),
    });
    await assert.rejects(
      () => c.briefing(),
      (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.match(e.message, /не JSON/);
        return true;
      },
    );
  });

  it("обрыв на чтении тела — тоже CoreError, а не сырое исключение", async () => {
    // fetch резолвится по заголовкам: обрыв туннеля случается уже на потоке тела.
    const torn = (async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new TypeError("terminated");
      },
    })) as unknown as typeof fetch;
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: torn });
    await assert.rejects(
      () => c.briefing(),
      (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.equal(e.status, 0);
        assert.match(e.message, /недоступен .*http:\/\/core/);
        return true;
      },
    );
  });

  it("таймаут назван таймаутом, а не отказом в соединении", async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("This operation was aborted")),
        );
      })) as unknown as typeof fetch;
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      fetchImpl: hang,
      timeoutMs: 5,
    });
    await assert.rejects(() => c.briefing(), /истекло время ожидания \(0 с\)/);
  });

  it("у каждого запроса есть сигнал прерывания", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.briefing();
    assert.ok(callsOf(f)[0]!.arguments[1].signal instanceof AbortSignal);
  });

  it("запрос без тела идёт без Content-Type", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.briefing();
    assert.equal(headersOf(f)["Content-Type"], undefined);
  });

  it("дека навыков фильтруется по агенту только когда агент назван", async () => {
    const f = fetchStub({ status: 200, body: { items: [] } });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.skillDeck("vendhub-ops");
    await c.skillDeck();
    assert.equal(callsOf(f)[0]!.arguments[0], "http://core/agents/skills?agent=vendhub-ops");
    assert.equal(callsOf(f)[1]!.arguments[0], "http://core/agents/skills");
  });

  it("дерево знаний приходит целиком: у Core фильтра по корню нет", async () => {
    const tree = [
      {
        path: "docs/MCP.md",
        root: "docs",
        title: "MCP",
        bytes: 10,
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
      {
        path: "memory/decisions.md",
        root: "memory",
        title: "Решения",
        bytes: 20,
        updatedAt: "2026-09-06T00:00:00.000Z",
      },
    ];
    const f = fetchStub({ status: 200, body: tree });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    // Отбор по корню делает `kb_tree`: ему нужны ВСЕ корни ответа, чтобы
    // назвать настоящие в отказе на выдуманный.
    assert.deepEqual(
      (await c.docsTree()).map((i) => i.root),
      ["docs", "memory"],
    );
    assert.equal(callsOf(f)[0]!.arguments[0], "http://core/docs/tree");
  });

  it("страница знаний идёт с owner-токеном: личный документ Core отдаёт только владельцу", async () => {
    // Тест смотрит на ЗАГОЛОВОК, а не на ответ стаба: стаб отдаёт то, что в
    // него положили, и «личный документ пришёл» доказывало бы только стаб.
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    await c.docFile("memory/личное.md");
    assert.match(callsOf(f)[0]!.arguments[0], /^http:\/\/core\/docs\/file\?path=/);
    assert.equal(headersOf(f)["x-owner-action-token"], "o");
  });

  it("архив агентов запрашивается явно, иначе Core его не отдаёт", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.agents();
    await c.agents({ archived: true });
    assert.equal(callsOf(f)[0]!.arguments[0], "http://core/agents");
    assert.equal(callsOf(f)[1]!.arguments[0], "http://core/agents?archived=1");
  });

  it("подпись уходит в теле решения и комментария: иначе Core запишет «owner»", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({
      baseUrl: "http://core",
      serviceToken: "s",
      ownerToken: "o",
      fetchImpl: f,
    });
    const id = "11111111-1111-4111-8111-111111111111";
    await c.decideApproval(id, "approved", "mcp");
    await c.commentTask(id, "готово", "mcp");
    assert.deepEqual(JSON.parse(String(callsOf(f)[0]!.arguments[1].body)), {
      decision: "approved",
      actor: "mcp",
    });
    assert.deepEqual(JSON.parse(String(callsOf(f)[1]!.arguments[1].body)), {
      body: "готово",
      author: "mcp",
    });
  });

  it("без подписи поля в теле нет вовсе — Core сам решает, чьё это действие", async () => {
    // Пустая подпись не должна уезжать как `actor: ""`: Core прочитал бы её
    // как «актор с пустым именем» вместо своего умолчания.
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    const id = "11111111-1111-4111-8111-111111111111";
    await c.decideApproval(id, "rejected");
    await c.commentTask(id, "текст", "");
    assert.deepEqual(JSON.parse(String(callsOf(f)[0]!.arguments[1].body)), {
      decision: "rejected",
    });
    assert.deepEqual(JSON.parse(String(callsOf(f)[1]!.arguments[1].body)), { body: "текст" });
  });

  it("предел выдачи реестра уходит в Core", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.entities({ q: "kaffit", limit: 20 });
    const url = callsOf(f)[0]!.arguments[0];
    assert.match(url, /q=kaffit/);
    assert.match(url, /limit=20/);
  });

  it("тело мутации уходит как JSON", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: f });
    await c.createTask({ title: "Проверить туннель", ownerKind: "human" });
    const init = callsOf(f)[0]!.arguments[1];
    assert.equal(init.method, "POST");
    assert.equal(headersOf(f)["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(init.body)), {
      title: "Проверить туннель",
      ownerKind: "human",
    });
  });
});
