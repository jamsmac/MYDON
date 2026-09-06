import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { RUN_OUTCOMES } from "@mydon/shared";
import {
  agentSkillCatalog,
  approval as approvalTable,
  auditLog,
  event,
  outboxDelivery,
  task as taskTable,
  taskAgentExecution,
} from "@mydon/db";
import { FlowsService } from "./flows.service";
import { RoutinesController } from "./routines.controller";
import { RoutinesTokenGuard } from "./routines-token.guard";
import type { AgentRunRow } from "./runs.service";

type Row = Record<string, unknown>;

/** Тот же шаблон, что у `RunsService.byId`: до базы мусорный id не доходит. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Доска и плейбэк в этих проверках не участвуют — контроллер их не трогает.
  return { controller: new RoutinesController(runs as never, {} as never, {} as never), calls };
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

  it("чужой outcome — 400 со списком допустимых, а не весь журнал под видом фильтра", async () => {
    // До волны A1 неизвестный исход молча выпадал из фильтра, и `?outcome=ok`
    // возвращал ВЕСЬ журнал: ответ выглядел здоровым и врал.
    const { controller, calls } = stubRuns([]);
    await assert.rejects(controller.list(undefined, undefined, "done", undefined), (e: unknown) => {
      assert.ok(e instanceof BadRequestException);
      const message = String((e.getResponse() as { message?: unknown }).message ?? e.message);
      for (const known of RUN_OUTCOMES) assert.match(message, new RegExp(known));
      return true;
    });
    assert.equal(calls.list.length, 0, "с чужим исходом в базу не ходим");
  });

  it("известные исходы проходят все до одного", async () => {
    for (const outcome of RUN_OUTCOMES) {
      const { controller, calls } = stubRuns([]);
      await controller.list(undefined, undefined, outcome, undefined);
      assert.deepEqual(calls.list[0], { outcome });
    }
  });

  it("limit вне рамок — 400, а не тихое схлопывание до потолка", async () => {
    // Асимметрия волны R: `/events?limit=500` отвечал 400, а здесь тот же
    // перебор молча срезался до 200 — вызывающий не знал, полон ли ответ.
    for (const bad of ["5000", "201", "0", "-1", "abc", "10.5"]) {
      const { controller, calls } = stubRuns([]);
      await assert.rejects(
        controller.list(undefined, undefined, undefined, bad),
        BadRequestException,
        `limit=${bad} обязан быть 400`,
      );
      assert.equal(calls.list.length, 0, `limit=${bad}: в базу не ходим`);
    }
  });

  it("limit на границах рамки принимается", async () => {
    for (const ok of ["1", "200"]) {
      const { controller, calls } = stubRuns([]);
      await controller.list(undefined, undefined, undefined, ok);
      assert.deepEqual(calls.list[0], { limit: Number(ok) });
    }
  });

  it("окно from/to доходит датами", async () => {
    const { controller, calls } = stubRuns([runRow()]);
    await controller.list(undefined, undefined, undefined, undefined, "2026-09-01T00:00:00.000Z", "2026-09-07T00:00:00.000Z");
    const filter = calls.list[0] as { from?: Date; to?: Date };
    assert.ok(filter.from instanceof Date, "from обязан уехать датой, а не строкой");
    assert.ok(filter.to instanceof Date);
    assert.equal(filter.from?.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(filter.to?.toISOString(), "2026-09-07T00:00:00.000Z");
  });

  it("битая дата в окне — 400, а не пустой журнал и не 500 от драйвера", async () => {
    // Invalid Date уехал бы в `started_at >= $1` и вернул 500 из драйвера, а
    // молчаливый пропуск границы соврал бы владельцу пустотой в его окне.
    const { controller, calls } = stubRuns([]);
    await assert.rejects(
      controller.list(undefined, undefined, undefined, undefined, "вчера"),
      BadRequestException,
    );
    await assert.rejects(
      controller.list(undefined, undefined, undefined, undefined, undefined, "2026-13-45"),
      BadRequestException,
    );
    assert.equal(calls.list.length, 0, "с битой датой в базу не ходим");
  });

  it("без окна границ в фильтре нет — журнал не сужается сам", async () => {
    const { controller, calls } = stubRuns([]);
    await controller.list("vendhub-ops", undefined, undefined, undefined);
    assert.deepEqual(calls.list[0], { agent: "vendhub-ops" });
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

/**
 * Стаб выборок плейбэка: строки раздаются ПО ТАБЛИЦЕ, а каждый запрос
 * записывается — так видно и что вернулось, и к какой таблице вообще ходили
 * (вопрос «а не сходили ли лишний раз» здесь такой же важный, как ответ).
 *
 * Цепочка сама по себе «ожидаема» (`then`): доставки читаются без `limit`,
 * и без этого `await` на построителе повис бы на объекте вместо строк.
 */
function playbackDb(rows: Map<unknown, Row[]>) {
  const asked: { table: unknown; where: unknown }[] = [];
  const db = {
    select: () => ({
      from: (table: unknown) => {
        const entry: { table: unknown; where: unknown } = { table, where: undefined };
        asked.push(entry);
        const result = async (): Promise<Row[]> => rows.get(table) ?? [];
        const chain = {
          where: (cond: unknown) => {
            entry.where = cond;
            return chain;
          },
          orderBy: () => chain,
          limit: () => result(),
          then: (ok: (r: Row[]) => unknown, no: (e: unknown) => unknown) => result().then(ok, no),
        };
        return chain;
      },
    }),
  } as never;
  return { db, asked };
}

/** Условие запроса к таблице в виде текста и параметров. */
function queryTo(asked: { table: unknown; where: unknown }[], table: unknown): { sql: string; params: unknown[] } {
  const entry = asked.find((a) => a.table === table);
  assert.ok(entry, "запрос к таблице не выполнялся");
  const q = new PgDialect().sqlToQuery(entry.where as Parameters<PgDialect["sqlToQuery"]>[0]);
  return { sql: q.sql, params: q.params };
}

const TASK = "22222222-2222-4222-8222-222222222222";
const APPROVAL = "33333333-3333-4333-8333-333333333333";

describe("FlowsService.playback — Core собирает вокруг прогона всё, что о нём знает", () => {
  const taskRun = runRow({
    trigger: "task",
    taskId: TASK,
    outcome: "approval_requested",
    skipReason: null,
    action: "Пополнить автомат 12",
    reason: "остаток ниже нормы",
  });

  function fullDb() {
    return playbackDb(
      new Map<unknown, Row[]>([
        [agentSkillCatalog, [{ executor: "llm", tier: "T3" }]],
        [taskTable, [{ id: TASK, status: "todo" }]],
        [
          taskAgentExecution,
          [{ id: "e1", status: "committed", committedAt: new Date("2026-09-06T03:00:03.000Z"), abandonReason: null, approvalId: APPROVAL }],
        ],
        [event, [{ at: new Date("2026-09-06T03:00:02.000Z"), type: "agent.action", payload: { skill: "monitor-stock" } }]],
        [
          approvalTable,
          [{ id: APPROVAL, decision: "pending", decidedAt: null, tier: "T3", createdAt: new Date("2026-09-06T03:00:03.000Z") }],
        ],
        [outboxDelivery, [{ destination: "telegram", status: "sent", lastError: null, completedAt: new Date("2026-09-06T03:00:05.000Z") }]],
        [auditLog, [{ at: new Date("2026-09-06T03:00:01.000Z"), action: "task.claimed", actorRef: "vendhub-ops", target: TASK }]],
      ]),
    );
  }

  it("задача с исполнением, согласованием и доставкой — шесть фаз и лента в ISO", async () => {
    const { db } = fullDb();
    const flows = new FlowsService({ byId: async () => taskRun } as never, db);
    const res = await flows.playback(taskRun.id);

    assert.equal(res.run.requestKey, "k1");
    assert.equal(res.run.cron, "0 8 * * *");
    assert.equal(res.run.scheduledAt, "2026-09-06T03:00:00.000Z");
    assert.deepEqual(
      res.phases.map((p) => `${p.name}:${p.state}`),
      ["trigger:ok", "skill:ok", "proposal:ok", "approval:warn", "execution:ok", "delivery:ok"],
    );
    // Даты ленты — строки: плейбэк уезжает в JSON, а не в объектах Date.
    assert.deepEqual(res.events, [{ at: "2026-09-06T03:00:02.000Z", type: "agent.action", payload: { skill: "monitor-stock" } }]);
    assert.deepEqual(res.audit, [
      { at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: TASK },
    ]);
  });

  it("окно ленты — ±1 секунда вокруг прогона: часы агента и Core расходятся", async () => {
    const { db, asked } = fullDb();
    await new FlowsService({ byId: async () => taskRun } as never, db).playback(taskRun.id);

    const q = queryTo(asked, event);
    assert.match(q.sql, /"event"\."source" = \$\d/);
    assert.match(q.sql, /"event"\."occurred_at" >= \$\d/);
    assert.match(q.sql, /"event"\."occurred_at" <= \$\d/);
    // Прогон 03:00:01–03:00:04 → окно 03:00:00–03:00:05, ни секундой уже.
    const stamps = q.params.map((p) => String(p));
    assert.ok(stamps.includes("agent:vendhub-ops"), "события ищем по источнику этого агента");
    assert.ok(stamps.some((s) => s.includes("03:00:00")), `нижняя граница окна: ${stamps.join(" | ")}`);
    assert.ok(stamps.some((s) => s.includes("03:00:05")), `верхняя граница окна: ${stamps.join(" | ")}`);
  });

  it("аудит спрашиваем по ОБОИМ адресатам — согласование берётся у попытки исполнения", async () => {
    const { db, asked } = fullDb();
    // В строке журнала approvalId пуст (durable-задача его не пишет), и без
    // второго источника фаза согласования потерялась бы вместе с аудитом.
    assert.equal(taskRun.approvalId, null);
    await new FlowsService({ byId: async () => taskRun } as never, db).playback(taskRun.id);

    const q = queryTo(asked, auditLog);
    assert.match(q.sql, /"audit_log"\."target" in/);
    // Дальше в параметрах идут границы окна — они проверяются отдельно, ниже.
    assert.deepEqual(q.params.slice(0, 2), [TASK, APPROVAL]);
  });

  it("аудит взят ОКНОМ прогона: у задачи с несколькими попытками чужие записи не подмешиваются", async () => {
    const { db, asked } = fullDb();
    await new FlowsService({ byId: async () => taskRun } as never, db).playback(taskRun.id);

    // `target` у всех попыток одной задачи ОДИН И ТОТ ЖЕ, поэтому без границ
    // плейбэк первой попытки показывал бы аудит третьей. Окно — то же, что у
    // событий: [начало − 1 с; конец + 1 с].
    const q = queryTo(asked, auditLog);
    assert.match(q.sql, /"audit_log"\."ts" >= \$\d/);
    assert.match(q.sql, /"audit_log"\."ts" <= \$\d/);
    const stamps = q.params.map((p) => String(p));
    assert.ok(stamps.some((s) => s.includes("03:00:00")), `нижняя граница окна: ${stamps.join(" | ")}`);
    assert.ok(stamps.some((s) => s.includes("03:00:05")), `верхняя граница окна: ${stamps.join(" | ")}`);
  });

  it("ни задачи, ни согласования — за аудитом не ходим вовсе", async () => {
    const { db, asked } = playbackDb(new Map<unknown, Row[]>([[agentSkillCatalog, [{ executor: "code", tier: "T1" }]]]));
    // Легаси-прогон монитора: ни taskId, ни approvalId. Запрос `in ()` без
    // адресатов вернул бы всю таблицу аудита либо упал бы на пустом списке.
    const res = await new FlowsService({ byId: async () => runRow() } as never, db).playback(runRow().id);

    assert.deepEqual(res.audit, []);
    assert.equal(asked.some((a) => a.table === auditLog), false, "аудит без адресата не запрашиваем");
    assert.equal(asked.some((a) => a.table === taskTable), false, "задачи нет — за ней не ходим");
    assert.equal(asked.some((a) => a.table === outboxDelivery), false, "доставки живут у попытки исполнения, которой нет");
    assert.equal(res.phases[3]!.state, "skip");
  });
});

describe("Маршруты доски и плейбэка (волна R)", () => {
  const board = { tz: "Asia/Tashkent", now: "2026-09-06T03:10:00.000Z", jobs: [], upcoming24h: [] };

  it("GET /routines/board отдаёт доску как есть — считает её сервис, не контроллер", async () => {
    const controller = new RoutinesController({} as never, { board: async () => board } as never, {} as never);
    assert.equal(await controller.board(), board);
  });

  it("GET /routines/flows фильтрует теми же правилами, что журнал, и отдаёт строки плейбэка", async () => {
    const calls: unknown[] = [];
    const runs = {
      list: async (filter: unknown) => {
        calls.push(filter);
        return [runRow()];
      },
    };
    const controller = new RoutinesController({} as never, {} as never, new FlowsService(runs as never, {} as never));
    const res = await controller.flowList(
      ["vendhub-ops", "vendhub-ceo"],
      "monitor-stock",
      "skipped",
      "10",
    );

    // Повторённый параметр — первым значением: правило фильтра одно на оба
    // маршрута (`runFilter`), и разъехаться они не могут.
    assert.deepEqual(calls[0], {
      agent: "vendhub-ops",
      skill: "monitor-stock",
      outcome: "skipped",
      limit: 10,
    });
    assert.equal(res.runs.length, 1);
    assert.equal(res.runs[0]!.startedAt, "2026-09-06T03:00:01.000Z");
    assert.equal(res.runs[0]!.agent, "vendhub-ops");
  });

  it("GET /routines/flows отбивает чужой исход и перебор limit так же, как журнал", async () => {
    const runs = {
      list: async () => {
        throw new Error("до выборки дойти не должны");
      },
    };
    const controller = new RoutinesController({} as never, {} as never, new FlowsService(runs as never, {} as never));
    await assert.rejects(
      controller.flowList(undefined, undefined, "ok", undefined),
      BadRequestException,
    );
    await assert.rejects(
      controller.flowList(undefined, undefined, undefined, "5000"),
      BadRequestException,
    );
  });

  it("GET /routines/flows/:id на мусорный id — 404, а не 500 от драйвера", async () => {
    const db = {
      select: () => {
        throw new Error("выборка по мусорному id не должна начинаться");
      },
    } as never;
    const flows = new FlowsService({ byId: async (id: string) => (UUID.test(id) ? runRow() : null) } as never, db);
    const controller = new RoutinesController({} as never, {} as never, flows);
    await assert.rejects(() => controller.playback("не-id"), NotFoundException);
  });
});
