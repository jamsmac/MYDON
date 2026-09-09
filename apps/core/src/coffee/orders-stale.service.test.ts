import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { event, systemConfig } from "@mydon/db";
import {
  COFFEE_ORDERS_STALE_EVENT,
  COFFEE_ORDERS_STALE_DAYS_FALLBACK,
  CoffeeOrdersStaleService,
} from "./orders-stale.service";

/**
 * Стаб БД: `where` ФИЛЬТРУЕТ, а не отдаёт фикстуру как есть.
 *
 * Заглушка, отвечающая одинаково на любой запрос, сказала бы «событие за сутки
 * уже было» всегда — и дедуп проверялся бы ничем (тот же урок, что записан у
 * соседнего сторожа `sync-stale.service.test.ts`).
 */
function параметры(cond: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (n instanceof Date) {
      out.push(n);
      return;
    }
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const chunks = (n as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(chunks)) {
      for (const c of chunks) walk(c);
      return;
    }
    const v = (n as { value?: unknown }).value;
    if (typeof v === "string" || v instanceof Date) out.push(v);
  };
  walk(cond);
  return out;
}

interface Мир {
  /** Момент самого позднего заказа (ISO). `null` — заказов нет вовсе. */
  последний?: string | null;
  всего?: number;
  /** Что уже лежит в журнале событий — материал для дедупа. */
  уже?: { type: string; occurredAt: Date }[];
  настройки?: Record<string, string>;
  /** Ошибка чтения статуса заказов. */
  статусПадает?: Error;
}

function стенд(м: Мир) {
  const события = (м.уже ?? []).map((e, i) => ({ id: `e${i}`, type: e.type, occurredAt: e.occurredAt }));
  const записано: { source: string; type: string; payload: Record<string, unknown>; occurredAt: Date }[] = [];
  const настройки = Object.entries(м.настройки ?? {}).map(([key, value]) => ({ key, value }));

  const db = {
    select: () => ({
      from: (t: unknown) => {
        const текущие: unknown[] = t === event ? [...события] : t === systemConfig ? [...настройки] : [];
        // `settingValue` читает системные настройки БЕЗ `where` и просто
        // ждёт результат (`await db.select().from(systemConfig)`), а дедуп
        // событий идёт через `.where().limit()`. Значит `from` обязан быть
        // разом и массивом строк, и звеном цепочки — иначе стаб отвечает
        // объектом там, где код ждёт строки, и «настройка не прочиталась»
        // выглядит как «настройки нет».
        const результат = текущие as unknown[] & {
          where?: (c?: unknown) => unknown;
          limit?: () => unknown[];
        };
        результат.where = (cond?: unknown) => {
          const п = параметры(cond);
          const строки = п.filter((v): v is string => typeof v === "string");
          const даты = п.filter((v): v is Date => v instanceof Date);
          let строкиРезультата = текущие;
          if (t === event) {
            строкиРезультата = (текущие as typeof события).filter(
              (e) =>
                (строки.length === 0 || строки.includes(e.type)) &&
                (даты.length === 0 || e.occurredAt >= даты[0]),
            );
          }
          if (t === systemConfig && строки.length > 0) {
            строкиРезультата = (текущие as typeof настройки).filter((s) => строки.includes(s.key));
          }
          return { limit: () => строкиРезультата };
        };
        результат.limit = () => текущие;
        return результат;
      },
    }),
    insert: () => ({
      values: async (v: (typeof записано)[number]) => {
        записано.push(v);
      },
    }),
  };

  const orders = {
    status: async () => {
      if (м.статусПадает) throw м.статусПадает;
      return {
        всего: м.всего ?? 57886,
        вВыручке: м.всего ?? 57886,
        первый: "2024-05-14T06:12:00.000Z",
        последний: м.последний === undefined ? "2026-09-09T03:00:00.000Z" : м.последний,
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- узкий стаб вместо целого Db/сервиса
  const svc = new CoffeeOrdersStaleService(db as any, orders as any);
  return { svc, записано };
}

/** Полдень 09.09.2026 по Ташкенту. */
const СЕЙЧАС = new Date("2026-09-09T07:00:00.000Z");

describe("CoffeeOrdersStaleService — сторож молчащего источника заказов", () => {
  it("источник молчит дольше порога — пишет событие с числом суток", async () => {
    const { svc, записано } = стенд({ последний: "2026-08-20T06:12:00.000Z" });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, true);
    assert.equal(res.staleDays, 20);
    assert.equal(res.threshold, COFFEE_ORDERS_STALE_DAYS_FALLBACK);
    assert.equal(записано.length, 1);
    assert.equal(записано[0].type, COFFEE_ORDERS_STALE_EVENT);
    assert.equal(записано[0].source, "system");
    assert.deepEqual(записано[0].payload, {
      staleDays: 20,
      lastOrderAt: "2026-08-20",
      total: 57886,
      threshold: COFFEE_ORDERS_STALE_DAYS_FALLBACK,
    });
  });

  it("заливали недавно — молчим: ложная тревога обесценивает настоящую", async () => {
    const { svc, записано } = стенд({ последний: "2026-09-07T06:12:00.000Z" });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, false);
    assert.equal(res.staleDays, 2);
    assert.equal(записано.length, 0);
  });

  it("заказов нет вовсе — тревожнее большого числа, уходит с staleDays: null", async () => {
    const { svc, записано } = стенд({ последний: null, всего: 0 });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, true);
    assert.equal(res.staleDays, null);
    assert.deepEqual(записано[0].payload, {
      staleDays: null,
      lastOrderAt: null,
      total: 0,
      threshold: COFFEE_ORDERS_STALE_DAYS_FALLBACK,
    });
  });

  it("порог берётся из настроек, а не зашит в коде", async () => {
    const { svc, записано } = стенд({
      последний: "2026-09-04T06:12:00.000Z",
      настройки: { COFFEE_ORDERS_STALE_DAYS: "10" },
    });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.threshold, 10);
    assert.equal(res.staleDays, 5);
    assert.equal(res.emitted, false, "5 суток при пороге 10 — ещё не сигнал");
    assert.equal(записано.length, 0);
  });

  it("событие за эти ташкентские сутки уже есть — второго не пишем", async () => {
    const { svc, записано } = стенд({
      последний: "2026-08-20T06:12:00.000Z",
      уже: [{ type: COFFEE_ORDERS_STALE_EVENT, occurredAt: new Date("2026-09-09T04:00:00.000Z") }],
    });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, false, "дедуп по суткам");
    assert.equal(записано.length, 0);
  });

  it("вчерашнее событие дедуп не глушит — сутки новые", async () => {
    const { svc, записано } = стенд({
      последний: "2026-08-20T06:12:00.000Z",
      уже: [{ type: COFFEE_ORDERS_STALE_EVENT, occurredAt: new Date("2026-09-08T04:00:00.000Z") }],
    });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, true);
    assert.equal(записано.length, 1);
  });

  it("чужое событие тех же суток не считается своим", async () => {
    const { svc, записано } = стенд({
      последний: "2026-08-20T06:12:00.000Z",
      уже: [{ type: "ourvend.sync_stale", occurredAt: new Date("2026-09-09T04:00:00.000Z") }],
    });

    const res = await svc.check(СЕЙЧАС);

    assert.equal(res.emitted, true, "дедуп обязан смотреть на СВОЙ тип события");
    assert.equal(записано.length, 1);
  });

  it("статус заказов не читается — ошибка наверх, а не тихое «свежо»", async () => {
    const { svc, записано } = стенд({ статусПадает: new Error("база недоступна") });

    await assert.rejects(() => svc.check(СЕЙЧАС), /база недоступна/);
    assert.equal(записано.length, 0);
  });
});
