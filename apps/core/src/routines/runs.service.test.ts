import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  RunsService,
  normalizeReport,
  rowFromRaw,
  snapshotFromBody,
  type ReportRunInput,
} from "./runs.service";

type Row = Record<string, unknown>;

/** Стаб: select по requestKey отдаёт existing; insert/update копятся. */
function stub(opts: { existing?: Row } = {}) {
  const captured = { insert: [] as Row[], update: [] as Row[] };
  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => (opts.existing ? [opts.existing] : []) }) }),
    }),
    insert: () => ({
      values: (v: Row) => {
        captured.insert.push(v);
        return { returning: async () => [{ id: "r1", ...v }] };
      },
      // upsert снимка
      onConflictDoUpdate: () => ({ returning: async () => [{ key: "schedules" }] }),
    }),
    update: () => ({
      set: (v: Row) => {
        captured.update.push(v);
        return { where: () => ({ returning: async () => [{ ...(opts.existing ?? {}), ...v }] }) };
      },
    }),
  };
  const db = {
    transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
    insert: tx.insert,
    select: tx.select,
  } as never;
  return { db, captured };
}

const base: ReportRunInput = {
  agentName: "vendhub-ops",
  skill: "monitor-stock",
  trigger: "cron",
  cron: "0 8 * * *",
  scheduledAt: "2026-09-06T03:00:00.000Z",
  requestKey: "cron:vendhub-ops:monitor-stock:0 8 * * *:2026-09-06T03:00:00.000Z",
  startedAt: "2026-09-06T03:00:01.000Z",
  finishedAt: "2026-09-06T03:00:04.000Z",
  outcome: "skipped",
  skipReason: "no_signal",
  reason: "повода нет",
};

describe("RunsService.report (R-R-1)", () => {
  it("новая строка → created: true, поля исхода на месте", async () => {
    const { db, captured } = stub();
    const s = new RunsService(db);
    const r = await s.report(base);
    assert.equal(r.created, true);
    assert.equal(captured.insert.length, 1);
    assert.equal(captured.insert[0].requestKey, base.requestKey);
    assert.equal(captured.insert[0].skipReason, "no_signal");
    assert.ok(captured.insert[0].startedAt instanceof Date);
  });

  it("повтор того же requestKey → update, created: false", async () => {
    const { db, captured } = stub({ existing: { id: "r0", requestKey: base.requestKey } });
    const r = await new RunsService(db).report({
      ...base,
      outcome: "executed",
      skipReason: undefined,
      reason: "выполнено",
    });
    assert.equal(r.created, false);
    assert.equal(r.id, "r0");
    assert.equal(captured.update.length, 1);
    assert.equal(captured.update[0].outcome, "executed");
    assert.equal(captured.update[0].skipReason, null);
  });
});

/** Стаб выборки: запоминает limit и число условий, строк не отдаёт. */
function listStub() {
  const captured: { limit: number | null; conds: number } = { limit: null, conds: 0 };
  const chain = {
    where: (c: unknown) => {
      captured.conds = c === undefined ? 0 : 1;
      return chain;
    },
    orderBy: () => chain,
    limit: async (n: number) => {
      captured.limit = n;
      return [];
    },
  };
  const db = { select: () => ({ from: () => chain }) } as never;
  return { db, captured };
}

describe("RunsService.list — рамки выборки", () => {
  it("по умолчанию 50, потолок 200, мусорный limit не уезжает в SQL", async () => {
    const plain = listStub();
    await new RunsService(plain.db).list();
    assert.equal(plain.captured.limit, 50);
    assert.equal(plain.captured.conds, 0, "без фильтров условие не добавляем");

    const huge = listStub();
    await new RunsService(huge.db).list({ limit: 5000 });
    assert.equal(huge.captured.limit, 200);

    const junk = listStub();
    await new RunsService(junk.db).list({ limit: Number("abc") });
    assert.equal(junk.captured.limit, 50, "NaN дал бы «limit NaN» и 500 вместо журнала");

    const fraction = listStub();
    await new RunsService(fraction.db).list({ limit: Number("10.5") });
    assert.equal(fraction.captured.limit, 10, "дробь драйвер не примет в LIMIT");
  });

  it("фильтры доходят до запроса одним условием", async () => {
    const { db, captured } = listStub();
    await new RunsService(db).list({ agent: "vendhub-ops", skill: "monitor-stock", outcome: "failed" });
    assert.equal(captured.conds, 1);
  });

  it("byId с неверным идентификатором не ходит в базу", async () => {
    const db = {
      select: () => {
        throw new Error("выборка по мусорному id не должна начинаться");
      },
    } as never;
    assert.equal(await new RunsService(db).byId("nope"), null);
  });
});

describe("RunsService.lastPerJob — последний прогон каждого задания", () => {
  it("сырые строки execute приходят в форме карточки", async () => {
    const db = {
      execute: async () => [
        {
          id: "r1", agent_name: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
          scheduled_at: null, request_key: "k1", trace_key: null, task_id: null, approval_id: null,
          started_at: new Date("2026-09-06T03:00:01.000Z"), finished_at: new Date("2026-09-06T03:00:04.000Z"),
          outcome: "executed", skip_reason: null, hook: null, reason: "готово", action: null, review: null,
          created_at: new Date("2026-09-06T03:00:04.000Z"),
        },
      ],
    } as never;
    const [row] = await new RunsService(db).lastPerJob();
    assert.equal(row.agentName, "vendhub-ops");
    assert.equal(row.startedAt.toISOString(), "2026-09-06T03:00:01.000Z");
  });
});

describe("normalizeReport — валидация тела", () => {
  it("режет длинные тексты и не отвергает их", () => {
    const n = normalizeReport({ ...base, reason: "x".repeat(5000), action: "y".repeat(900) });
    assert.equal(n.reason.length, 2000);
    assert.equal(n.action?.length, 500);
  });
  it("skipReason при outcome ≠ skipped → 400", () => {
    assert.throws(() => normalizeReport({ ...base, outcome: "executed" }), BadRequestException);
  });
  it("finishedAt раньше startedAt → 400", () => {
    assert.throws(
      () => normalizeReport({ ...base, finishedAt: "2026-09-06T02:59:00.000Z" }),
      BadRequestException,
    );
  });
  it("неизвестный outcome/skipReason/trigger → 400", () => {
    assert.throws(() => normalizeReport({ ...base, outcome: "done" as never }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, skipReason: "tired" as never }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, trigger: "webhook" as never }), BadRequestException);
  });
  it("hook без hook_blocked → 400; taskId не uuid → 400", () => {
    assert.throws(() => normalizeReport({ ...base, hook: "quiet_hours" }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, taskId: "nope" }), BadRequestException);
  });
});

describe("snapshotFromBody — снимок расписаний (R-R-2)", () => {
  const ok = {
    generatedAt: "2026-09-06T03:00:00.000Z",
    tz: "Asia/Tashkent",
    paused: { schedules: true, tasks: true },
    jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" }],
    notWired: [{ agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" }],
    monitors: [{ name: "fx:refresh", cron: "5 9 * * *", enabled: true }],
  };
  it("принимает корректный снимок", () => {
    const s = snapshotFromBody(ok);
    assert.equal(s.jobs.length, 1);
    assert.equal(s.monitors[0].name, "fx:refresh");
  });
  it("битый cron → 400 с именем задания", () => {
    assert.throws(
      () => snapshotFromBody({ ...ok, jobs: [{ ...ok.jobs[0], cron: "99 99 * * *" }] }),
      (e: unknown) =>
        e instanceof BadRequestException && /vendhub-ops\/monitor-stock/.test(String((e as Error).message)),
    );
  });
  it("чужой tz или mode → 400", () => {
    assert.throws(() => snapshotFromBody({ ...ok, tz: "UTC" }), BadRequestException);
    assert.throws(
      () => snapshotFromBody({ ...ok, jobs: [{ ...ok.jobs[0], mode: "eager" }] }),
      BadRequestException,
    );
  });
  it("чужая причина notWired → 400 с именем задания", () => {
    assert.throws(
      () => snapshotFromBody({ ...ok, notWired: [{ ...ok.notWired[0], reason: "потом" }] }),
      (e: unknown) =>
        e instanceof BadRequestException && /vendhub-ceo\/weekly-review/.test(String((e as Error).message)),
    );
  });
  it("выключенный монитор пропускает cron «off» — его расписание не проверяем", () => {
    const s = snapshotFromBody({
      ...ok,
      monitors: [{ name: "ourvend:sync", cron: "off", enabled: false, reason: "no_credentials" }],
    });
    assert.equal(s.monitors[0].cron, "off");
    assert.equal(s.monitors[0].enabled, false);
    assert.equal(s.monitors[0].reason, "no_credentials");
  });
});

describe("rowFromRaw — сырая строка execute в форму карточки", () => {
  it("Date и строковая дата дают один и тот же startedAt", () => {
    const raw = {
      id: "r1",
      agent_name: "vendhub-ops",
      skill: "monitor-stock",
      trigger: "cron",
      cron: "0 8 * * *",
      scheduled_at: null,
      request_key: "k1",
      trace_key: null,
      task_id: null,
      approval_id: null,
      outcome: "skipped",
      skip_reason: "no_signal",
      hook: null,
      reason: "повода нет",
      action: null,
      review: null,
    };
    const asDate = rowFromRaw({
      ...raw,
      started_at: new Date("2026-09-06T03:00:01.000Z"),
      finished_at: new Date("2026-09-06T03:00:04.000Z"),
      created_at: new Date("2026-09-06T03:00:04.000Z"),
    });
    const asText = rowFromRaw({
      ...raw,
      started_at: "2026-09-06T03:00:01.000Z",
      finished_at: "2026-09-06T03:00:04.000Z",
      created_at: "2026-09-06T03:00:04.000Z",
    });
    assert.equal(asDate.startedAt.toISOString(), asText.startedAt.toISOString());
    assert.equal(asText.startedAt.toISOString(), "2026-09-06T03:00:01.000Z");
    assert.equal(asDate.agentName, "vendhub-ops");
    assert.equal(asText.scheduledAt, null);
  });
});
