import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { EventsService } from "./events.service";

type Row = Record<string, unknown>;

function eventDb(options: { created?: Row; existing?: Row }) {
  const inserted: Row[] = [];
  const tx = {
    insert: () => ({
      values: (value: Row) => {
        inserted.push(value);
        return {
          onConflictDoNothing: () => ({
            returning: async () => (options.created ? [options.created] : []),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (options.existing ? [options.existing] : []) }),
      }),
    }),
  };
  return {
    inserted,
    db: {
      transaction: async <T>(callback: (value: typeof tx) => Promise<T>): Promise<T> =>
        callback(tx),
    } as never,
  };
}

describe("EventsService idempotency", () => {
  it("stores clientKey with the first event", async () => {
    const created = {
      id: "e1",
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
    };
    const { db, inserted } = eventDb({ created });
    const row = await new EventsService(db).record({
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
    });
    assert.equal(row.id, "e1");
    assert.equal(inserted[0]?.clientKey, "task:t:effect:action");
  });

  it("returns the existing row for an exact retry and rejects a different payload", async () => {
    const occurredAt = new Date("2026-08-29T07:00:00.000Z");
    const existing = {
      id: "e1",
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
      occurredAt,
    };
    const exact = new EventsService(eventDb({ existing }).db);
    assert.equal(
      (
        await exact.record({
          source: "agent:a",
          type: "agent.action",
          payload: { action: "x" },
          occurredAt,
          clientKey: "task:t:effect:action",
        })
      ).id,
      "e1",
    );

    const mismatch = new EventsService(eventDb({ existing }).db);
    await assert.rejects(
      () =>
        mismatch.record({
          source: "agent:a",
          type: "agent.action",
          payload: { action: "другое" },
          occurredAt,
          clientKey: "task:t:effect:action",
        }),
      /уже использован другим payload/,
    );
  });

  it("rejects an explicit occurredAt mismatch for the same clientKey", async () => {
    const existing = {
      id: "e1",
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
      occurredAt: new Date("2026-08-29T07:00:00.000Z"),
    };
    const service = new EventsService(eventDb({ existing }).db);

    await assert.rejects(
      () =>
        service.record({
          source: "agent:a",
          type: "agent.action",
          payload: { action: "x" },
          occurredAt: new Date("2026-08-29T07:01:00.000Z"),
          clientKey: "task:t:effect:action",
        }),
      /уже использован/,
    );
  });

  it("accepts the stored timestamp when an exact retry omits occurredAt", async () => {
    const existing = {
      id: "e1",
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
      occurredAt: new Date("2026-08-29T07:00:00.000Z"),
    };
    const service = new EventsService(eventDb({ existing }).db);

    const replay = await service.record({
      source: "agent:a",
      type: "agent.action",
      payload: { action: "x" },
      clientKey: "task:t:effect:action",
    });
    assert.equal(replay.id, "e1");
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

/** Текст и параметры условия: заглушка SQL не исполняет, а перепутанный столбец обязан падать. */
function renderQuery(condition: unknown): { sql: string; params: unknown[] } {
  const q = new PgDialect().sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0]);
  return { sql: q.sql, params: q.params };
}

describe("EventsService.list — отбор ленты", () => {
  it("источник и префикс типа доходят до SQL своими условиями", async () => {
    const { db, captured } = listStub();
    await new EventsService(db).list({ source: "agent:vendhub-ops", typePrefix: "agent.memory:" });
    const { sql, params } = renderQuery(captured.where);
    assert.match(sql, /"event"\."source" = \$\d/);
    assert.match(sql, /"event"\."type" like \$\d/, "префикс — одно like, а не перебор типов");
    assert.ok(params.includes("agent.memory:%"), `параметры: ${JSON.stringify(params)}`);
  });

  it("метасимволы LIKE во вводе остаются буквами, а не «любым типом»", async () => {
    // `%` во вводе без экранирования превратил бы точечный префикс в полный
    // перебор по типам: ответ выглядел бы здоровым, а лента была бы чужой.
    const { db, captured } = listStub();
    await new EventsService(db).list({ typePrefix: "agent.memory:%_\\" });
    const { params } = renderQuery(captured.where);
    assert.ok(
      params.includes("agent.memory:\\%\\_\\\\%"),
      `метасимволы не экранированы: ${JSON.stringify(params)}`,
    );
  });

  it("без фильтров условия нет — лента не сужается сама по себе", async () => {
    const { db, captured } = listStub();
    await new EventsService(db).list();
    assert.equal(captured.where, undefined);
  });
});

describe("EventsService.latest — отбор «самого свежего»", () => {
  // Adversarial-фикс B1 (волна A1): `since` объявлялось в узком ДТО контроллера
  // и принималось валидацией, но фильтр по времени здесь не применялся —
  // «самое свежее» отдавалось без учёта since, хотя ответ выглядел здоровым.
  it("since доходит до SQL тем же условием, что у ленты", async () => {
    const { db, captured } = listStub();
    await new EventsService(db).latest({ since: new Date("2026-09-01T00:00:00.000Z") });
    const { sql, params } = renderQuery(captured.where);
    assert.match(sql, /"event"\."occurred_at" >= \$\d/);
    assert.ok(
      params.includes("2026-09-01T00:00:00.000Z"),
      `параметры: ${JSON.stringify(params)}`,
    );
  });

  it("без since условия нет — «самое свежее» не сужается само по себе", async () => {
    const { db, captured } = listStub();
    await new EventsService(db).latest({ source: "agent:vendhub-ops" });
    const { sql } = renderQuery(captured.where);
    assert.doesNotMatch(sql, /occurred_at/);
  });
});
