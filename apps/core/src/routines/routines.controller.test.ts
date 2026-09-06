import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { RoutinesController } from "./routines.controller";
import { RoutinesTokenGuard } from "./routines-token.guard";
import type { AgentRunRow } from "./runs.service";

/** Строка журнала — ровно то, что отдаёт база (все поля, даты объектами). */
function runRow(over: Partial<AgentRunRow> = {}): AgentRunRow {
  return {
    id: "3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
    agentName: "vendhub-ops",
    skill: "monitor-stock",
    trigger: "cron",
    cron: "0 8 * * *",
    scheduledAt: new Date("2026-09-06T03:00:00.000Z"),
    requestKey: "k1",
    traceKey: "trace-2026-09-06-01",
    taskId: null,
    approvalId: null,
    startedAt: new Date("2026-09-06T03:00:01.000Z"),
    finishedAt: new Date("2026-09-06T03:00:04.000Z"),
    outcome: "skipped",
    skipReason: "no_signal",
    hook: null,
    reason: "повода нет",
    action: null,
    review: null,
    createdAt: new Date("2026-09-06T03:00:04.000Z"),
    ...over,
  };
}

/** Стаб сервиса: копит вызовы, чтобы видеть, что контроллер до него донёс. */
function stubRuns(rows: AgentRunRow[] = []) {
  const calls = { list: [] as unknown[], last: [] as unknown[], report: [] as unknown[], snapshot: [] as unknown[] };
  const runs = {
    list: async (filter: unknown) => {
      calls.list.push(filter);
      return rows;
    },
    last: async (agent: string, skill: string) => {
      calls.last.push({ agent, skill });
      return rows[0] ?? null;
    },
    report: async (input: unknown) => {
      calls.report.push(input);
      return { id: "r1", created: true };
    },
    putSnapshot: async (snapshot: unknown) => {
      calls.snapshot.push(snapshot);
      return { storedAt: "2026-09-06T03:00:00.000Z" };
    },
  };
  return { controller: new RoutinesController(runs as never), calls };
}

describe("GET /routines/runs — фильтры журнала", () => {
  it("пробрасывает агента, навык, исход и лимит", async () => {
    const { controller, calls } = stubRuns([runRow()]);
    const res = await controller.list("vendhub-ops", "monitor-stock", "skipped", "10");
    assert.deepEqual(calls.list[0], {
      agent: "vendhub-ops",
      skill: "monitor-stock",
      outcome: "skipped",
      limit: 10,
    });
    assert.equal(res.runs.length, 1);
    // Даты в ответе — ISO-строки: панель и бот читают JSON, а не объекты Date.
    assert.equal(res.runs[0].startedAt, "2026-09-06T03:00:01.000Z");
    assert.equal(res.runs[0].scheduledAt, "2026-09-06T03:00:00.000Z");
    // traceKey нужен плейбэку: по нему прогон сшивается с задачей и согласованием.
    assert.equal(res.runs[0].traceKey, "trace-2026-09-06-01");
  });

  it("повторённый параметр (?agent=a&agent=b) не уезжает в запрос массивом", async () => {
    const { controller, calls } = stubRuns([]);
    await controller.list(["vendhub-ops", "vendhub-ceo"], undefined, ["skipped", "failed"], ["10", "99"]);
    assert.deepEqual(calls.list[0], { agent: "vendhub-ops", outcome: "skipped", limit: 10 });
  });

  it("чужой outcome отбрасывает, а не превращает в 400 или пустой список", async () => {
    const { controller, calls } = stubRuns([]);
    await controller.list(undefined, undefined, "done", undefined);
    assert.deepEqual(calls.list[0], {}, "неизвестный исход не должен попасть в фильтр");
  });
});

describe("GET /routines/runs/last — последний прогон задания", () => {
  it("без агента и навыка отвечает { run: null } и не трогает сервис", async () => {
    const { controller, calls } = stubRuns([runRow()]);
    const res = await controller.last("", "");
    assert.deepEqual(res, { run: null });
    assert.equal(calls.last.length, 0, "запрос без задания не должен идти в базу");
  });

  it("с агентом и навыком отдаёт строку в JSON-форме", async () => {
    const { controller, calls } = stubRuns([runRow({ outcome: "executed", skipReason: null })]);
    const res = await controller.last("vendhub-ops", "monitor-stock");
    assert.deepEqual(calls.last[0], { agent: "vendhub-ops", skill: "monitor-stock" });
    assert.equal(res.run?.outcome, "executed");
    assert.equal(res.run?.finishedAt, "2026-09-06T03:00:04.000Z");
  });
});

describe("Журнал прогонов за сервисным токеном и на чтение (волна R)", () => {
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
    }) as unknown as Parameters<RoutinesTokenGuard["canActivate"]>[0];

  it("анонимный GET отклоняется — глобальный guard чтения пропускает, этот нет", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new RoutinesTokenGuard().canActivate(ctx()), /токен/);
    assert.throws(() => new RoutinesTokenGuard().canActivate(ctx({ "x-service-token": "wrong" })), /токен/);
  });

  it("GET с верным токеном проходит (и заголовком, и Bearer)", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.equal(new RoutinesTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
    assert.equal(new RoutinesTokenGuard().canActivate(ctx({ authorization: "Bearer secret" })), true);
  });

  it("токен не настроен — журнал всё равно закрыт (fail-closed)", () => {
    delete process.env.SERVICE_TOKEN;
    assert.throws(() => new RoutinesTokenGuard().canActivate(ctx()), /токен/);
  });

  it("guard навешен на КОНТРОЛЛЕР — маршруты Task 4 закроются сами", () => {
    const guards: unknown = Reflect.getMetadata("__guards__", RoutinesController);
    assert.ok(Array.isArray(guards) && guards.includes(RoutinesTokenGuard), "нет @UseGuards(RoutinesTokenGuard)");
  });
});

describe("PUT /routines/snapshot — снимок проверяется до записи", () => {
  it("битый снимок отклоняется 400 и в сервис не уходит", () => {
    const { controller, calls } = stubRuns();
    assert.throws(() => controller.putSnapshot({ generatedAt: "2026-09-06T03:00:00.000Z", tz: "UTC" }), BadRequestException);
    assert.equal(calls.snapshot.length, 0);
  });

  it("корректный снимок доходит до сервиса разобранным", async () => {
    const { controller, calls } = stubRuns();
    await controller.putSnapshot({
      generatedAt: "2026-09-06T03:00:00.000Z",
      tz: "Asia/Tashkent",
      paused: { schedules: false, tasks: false },
      jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "durable-task" }],
      notWired: [],
      monitors: [],
    });
    assert.equal(calls.snapshot.length, 1);
  });
});
