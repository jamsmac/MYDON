import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { agentRun } from "@mydon/db";
import {
  RunsService,
  normalizeReport,
  rowFromRaw,
  snapshotFromBody,
  type ReportRunInput,
} from "./runs.service";

type Row = Record<string, unknown>;

/**
 * Стаб отчёта: одна цепочка `insert … onConflictDoUpdate … returning`.
 * `inserted` — то, что вернёт постгресовое `(xmax = 0)`: true у новой строки.
 */
function stub(opts: { inserted?: boolean } = {}) {
  const inserted = opts.inserted ?? true;
  const captured = { values: [] as Row[], patch: [] as Row[], target: [] as unknown[], returning: [] as Row[] };
  const db = {
    insert: () => ({
      values: (v: Row) => {
        captured.values.push(v);
        return {
          onConflictDoUpdate: (cfg: { target: unknown; set: Row }) => {
            captured.target.push(cfg.target);
            captured.patch.push(cfg.set);
            return {
              returning: async (sel: Row) => {
                captured.returning.push(sel);
                return [{ id: inserted ? "r1" : "r0", inserted }];
              },
            };
          },
        };
      },
    }),
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
    assert.equal(r.id, "r1");
    assert.equal(captured.values.length, 1);
    assert.equal(captured.values[0].requestKey, base.requestKey);
    assert.equal(captured.values[0].skipReason, "no_signal");
    assert.ok(captured.values[0].startedAt instanceof Date);
  });

  it("признак «строка новая» берётся у СУБД и назван — иначе created всегда false", () => {
    // drizzle не подставляет псевдоним сам: без `.as("inserted")` в returning
    // уходит голое `(xmax = 0)`, постгрес зовёт колонку `?column?`, и признак
    // теряется молча — тест на стабе этого не увидит, поэтому проверяем форму.
    const { db, captured } = stub();
    return new RunsService(db).report(base).then(() => {
      const marker = captured.returning[0].inserted as { fieldAlias?: string; sql?: unknown };
      assert.equal(marker.fieldAlias, "inserted", "маркер обязан иметь псевдоним");
      assert.match(renderSql(marker.sql), /xmax = 0/);
    });
  });

  it("повтор пишется ОДНИМ оператором по requestKey — гонка не даёт 500", async () => {
    // Была связка select→insert: одновременный повтор (таймаут клиента и ретрай,
    // пока первый запрос в полёте) упирался в UNIQUE и отдавал 500 вместо created:false.
    const { db, captured } = stub({ inserted: false });
    const r = await new RunsService(db).report({
      ...base,
      outcome: "executed",
      skipReason: undefined,
      reason: "выполнено",
    });
    assert.equal(r.created, false);
    assert.equal(r.id, "r0");
    assert.equal(captured.patch.length, 1);
    assert.equal(captured.target[0], agentRun.requestKey, "цель конфликта — уникальный requestKey");
    const patch = captured.patch[0];
    assert.equal(patch.outcome, "executed");
    assert.equal(patch.skipReason, null);
    // Опознание прогона и время старта первой попытки повтор НЕ переписывает.
    for (const key of ["requestKey", "agentName", "skill", "trigger", "startedAt"]) {
      assert.equal(key in patch, false, `повтор не должен переписывать ${key}`);
    }
    assert.ok(patch.finishedAt instanceof Date, "а вот время финиша обновляется");
  });
});

/** Стаб выборки: запоминает limit и САМО условие, строк не отдаёт. */
function listStub() {
  const captured: { limit: number | null; where: unknown } = { limit: null, where: undefined };
  const chain = {
    where: (c: unknown) => {
      captured.where = c;
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

/** Текст условия/запроса — заглушка SQL не проверяет, а перепутанный столбец обязан падать. */
function renderSql(query: unknown): string {
  return new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
}

describe("RunsService.list — рамки выборки", () => {
  it("по умолчанию 50, потолок 200, мусорный limit не уезжает в SQL", async () => {
    const plain = listStub();
    await new RunsService(plain.db).list();
    assert.equal(plain.captured.limit, 50);
    assert.equal(plain.captured.where, undefined, "без фильтров условие не добавляем");

    const huge = listStub();
    await new RunsService(huge.db).list({ limit: 5000 });
    assert.equal(huge.captured.limit, 200);

    const junk = listStub();
    await new RunsService(junk.db).list({ limit: Number("abc") });
    assert.equal(junk.captured.limit, 50, "NaN дал бы «limit NaN» и 500 вместо журнала");

    const fraction = listStub();
    await new RunsService(fraction.db).list({ limit: Number("10.5") });
    assert.equal(fraction.captured.limit, 10, "дробь драйвер не примет в LIMIT");

    for (const bad of [0, -5]) {
      const zero = listStub();
      await new RunsService(zero.db).list({ limit: bad });
      assert.equal(zero.captured.limit, 50, `limit=${bad} — это «не задан», а не пустой журнал`);
    }
  });

  it("фильтры доходят до запроса своими столбцами", async () => {
    const { db, captured } = listStub();
    await new RunsService(db).list({ agent: "vendhub-ops", skill: "monitor-stock", outcome: "failed" });
    const text = renderSql(captured.where);
    assert.match(text, /"agent_run"\."agent_name" = \$\d/);
    assert.match(text, /"agent_run"\."skill" = \$\d/);
    assert.match(text, /"agent_run"\."outcome" = \$\d/);
    assert.equal(text.split(" and ").length, 3, "три фильтра — три условия, ни одно не потерялось");

    const one = listStub();
    await new RunsService(one.db).list({ skill: "monitor-stock" });
    const onlySkill = renderSql(one.captured.where);
    assert.match(onlySkill, /"agent_run"\."skill" = \$\d/);
    assert.equal(/agent_name/.test(onlySkill), false, "непереданный агент не должен появляться в запросе");
  });

  it("окно журнала: from и to — два условия по началу прогона, только from — одно", async () => {
    const both = listStub();
    await new RunsService(both.db).list({
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-07T00:00:00.000Z"),
    });
    const text = renderSql(both.captured.where);
    assert.match(text, /"agent_run"\."started_at" >= \$\d/);
    assert.match(text, /"agent_run"\."started_at" <= \$\d/);
    assert.equal(text.split(" and ").length, 2, "две границы — два условия");

    const only = listStub();
    await new RunsService(only.db).list({ from: new Date("2026-09-01T00:00:00.000Z") });
    const fromOnly = renderSql(only.captured.where);
    assert.match(fromOnly, /"agent_run"\."started_at" >= \$\d/);
    assert.equal(/<=/.test(fromOnly), false, "верхней границы не просили — её не должно быть в запросе");
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
  it("сырые строки execute приходят в форме карточки, запрос — distinct on", async () => {
    const queries: unknown[] = [];
    const db = {
      execute: async (q: unknown) => {
        queries.push(q);
        return [
        {
          id: "r1", agent_name: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
          scheduled_at: null, request_key: "k1", trace_key: null, task_id: null, approval_id: null,
          started_at: new Date("2026-09-06T03:00:01.000Z"), finished_at: new Date("2026-09-06T03:00:04.000Z"),
          outcome: "executed", skip_reason: null, hook: null, reason: "готово", action: null, review: null,
          created_at: new Date("2026-09-06T03:00:04.000Z"),
        },
        ];
      },
    } as never;
    const [row] = await new RunsService(db).lastPerJob();
    assert.equal(row.agentName, "vendhub-ops");
    assert.equal(row.startedAt.toISOString(), "2026-09-06T03:00:01.000Z");
    const text = renderSql(queries[0]);
    assert.match(text, /distinct on \("agent_run"\."agent_name", "agent_run"\."skill"\)/);
    assert.match(text, /order by "agent_run"\."agent_name", "agent_run"\."skill", "agent_run"\."started_at" desc/);
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
  it("null в необязательных полях = поля нет (JSON присылает пропуски именно так)", () => {
    const n = normalizeReport({
      ...base,
      outcome: "executed",
      skipReason: null,
      hook: null,
      cron: null,
      scheduledAt: null,
      traceKey: null,
      taskId: null,
      approvalId: null,
      action: null,
      review: null,
    });
    assert.equal(n.outcome, "executed");
    assert.equal(n.skipReason, null);
    assert.equal(n.hook, null);
    assert.equal(n.scheduledAt, null);
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
  it("не-список вместо jobs/notWired/monitors → 400, а не тихо пустой снимок", () => {
    for (const field of ["jobs", "notWired", "monitors"]) {
      assert.throws(
        () => snapshotFromBody({ ...ok, [field]: "нет" }),
        (e: unknown) => e instanceof BadRequestException && new RegExp(field).test(String((e as Error).message)),
        `${field} строкой должен отклоняться`,
      );
    }
  });
  it("не-объект в paused и в элементе списка → 400, а не TypeError 500", () => {
    assert.throws(() => snapshotFromBody({ ...ok, paused: "да" }), BadRequestException);
    assert.throws(() => snapshotFromBody({ ...ok, jobs: [null] }), BadRequestException);
    assert.throws(() => snapshotFromBody({ ...ok, notWired: ["vendhub-ceo"] }), BadRequestException);
    assert.throws(() => snapshotFromBody({ ...ok, monitors: [42] }), BadRequestException);
  });
  it("чужая причина notWired → 400 с именем задания", () => {
    assert.throws(
      () => snapshotFromBody({ ...ok, notWired: [{ ...ok.notWired[0], reason: "потом" }] }),
      (e: unknown) =>
        e instanceof BadRequestException && /vendhub-ceo\/weekly-review/.test(String((e as Error).message)),
    );
  });
  it("причина inactive_agent принимается: расписание паузного агента — тоже строка доски", () => {
    // Паузный агент до `desiredJobs` не доходит, и без этой причины шесть
    // паузных паспортов прода не имели бы на доске ни строки, ни объяснения.
    const s = snapshotFromBody({
      ...ok,
      notWired: [{ agent: "market-analyst", skill: "scan-market", reason: "inactive_agent" }],
    });
    assert.deepEqual(s.notWired, [
      { agent: "market-analyst", skill: "scan-market", reason: "inactive_agent" },
    ]);
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
