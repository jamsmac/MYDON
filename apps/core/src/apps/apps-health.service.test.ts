import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LlmLedgerMonitoring, OurvendHealth } from "@mydon/shared";
import { AppsHealthService } from "./apps-health.service";
import { FACES, type HealthRow } from "./apps-health";

type Db = ConstructorParameters<typeof AppsHealthService>[0];
type Runs = ConstructorParameters<typeof AppsHealthService>[1];
type Ourvend = ConstructorParameters<typeof AppsHealthService>[2];
type Llm = ConstructorParameters<typeof AppsHealthService>[3];
type Events = ConstructorParameters<typeof AppsHealthService>[4];

const NOW = new Date("2026-09-06T09:00:00.000Z");
const ЧАС = 3_600_000;

/** Прогон монитора: `agent_run` с `agent_name = "system"`. */
function прогон(skill: string, over: { at?: Date; outcome?: string; reason?: string } = {}) {
  const at = over.at ?? new Date(NOW.getTime() - ЧАС);
  return {
    id: `run-${skill}`,
    agentName: "system",
    skill,
    trigger: "cron",
    cron: "0 */3 * * *",
    scheduledAt: at,
    requestKey: `monitor:${skill}`,
    traceKey: null,
    taskId: null,
    approvalId: null,
    startedAt: at,
    finishedAt: at,
    outcome: over.outcome ?? "executed",
    skipReason: null,
    hook: null,
    reason: over.reason ?? `[${skill}] ok`,
    action: null,
    review: null,
    createdAt: at,
  };
}

const ЗДОРОВЬЕ_OURVEND: OurvendHealth = {
  runs: [
    {
      id: "sync-1",
      startedAt: new Date(NOW.getTime() - ЧАС).toISOString(),
      finishedAt: new Date(NOW.getTime() - ЧАС).toISOString(),
      status: "success",
      machinesTotal: 2,
      machinesOk: 2,
      durationMs: 1000,
      error: null,
    },
  ],
  failedStreak: 0,
  lastSuccessAt: new Date(NOW.getTime() - ЧАС).toISOString(),
  staleHours: 1,
  staleThresholdH: 6,
  slotsLagMin: 30,
  salesLagH: 1,
  snapshotStale: false,
  productSaleLagH: 1,
  parityStreak: 3,
  cutoverThreshold: 7,
  parityLastRed: null,
  parityStreakSince: null,
  parity: {
    days: 7,
    ok: true,
    checked: 14,
    mismatches: 0,
    stockOk: true,
    stockChecked: 14,
    mode: "mirror",
    note: null,
  },
};

const МОНИТОРИНГ_LLM: LlmLedgerMonitoring = {
  generatedAt: NOW.toISOString(),
  day: "2026-09-06",
  settlementOutbox: {
    available: true,
    pendingCount: 0,
    retryingCount: 0,
    processingCount: 0,
    deadCount: 0,
    fallbackCount: 0,
    exactCount: 0,
    oldestPendingAt: null,
    nextRetryAt: null,
    maxAttempts: 5,
  },
  budget: {
    globalCapUsd: 5,
    knownCostUsd: 0.5,
    globalExposureUsd: 0.5,
    reservedUsd: 0,
    remainingUsd: 4.5,
  },
  latestCompleted: {
    provider: "anthropic",
    consumer: "agents",
    feature: "brief",
    requestedModel: "claude",
    resolvedModel: "claude",
    status: "settled",
    outcome: "success",
    costUsd: 0.5,
    costBasis: "actual",
    completedAt: new Date(NOW.getTime() - ЧАС).toISOString(),
  },
  stuckReservations: { thresholdMinutes: 30, count: 0, reservedUsd: 0, oldestReservedAt: null },
  failuresToday: { count: 0, providerErrorCount: 0, unknownCount: 0, last: null },
  openCircuits: [],
  catalogPrice: { meteredEnabled: true, provider: "anthropic", model: "claude", hasActivePrice: true },
};

interface Мир {
  monitors?: { name: string; cron: string; enabled: boolean; reason?: "off" | "no_credentials" }[];
  /** Снимка расписаний нет вовсе (агенты ни разу не публиковали). */
  безСнимка?: boolean;
  runs?: ReturnType<typeof прогон>[];
  /** Отказ конкретного источника: сообщение исключения. */
  отказ?: { снимок?: string; ourvend?: string; ledger?: string; доставки?: string; бот?: string };
  доставки?: { status: string; n: number; oldest: Date | null }[];
}

/** Заглушка Db: сервис делает ровно `select().from().where().groupBy()`. */
function fakeDb(м: Мир): Db {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          groupBy: () =>
            м.отказ?.доставки !== undefined
              ? Promise.reject(new Error(м.отказ.доставки))
              : Promise.resolve(м.доставки ?? []),
        }),
      }),
    }),
  } as unknown as Db;
}

function сервис(м: Мир = {}): AppsHealthService {
  const monitors = м.monitors ?? [
    { name: FACES.ourvendSync.key, cron: "0 */3 * * *", enabled: true },
    { name: FACES.ourvendAccounting.key, cron: "5 8 * * *", enabled: true },
    { name: FACES.fx.key, cron: "5 9 * * *", enabled: true },
    { name: FACES.coffee.key, cron: "0 7 * * *", enabled: true },
    { name: FACES.maintenance.key, cron: "0 6 * * *", enabled: true },
    { name: FACES.globerent.key, cron: "10 7 * * *", enabled: true },
  ];
  const runs = {
    snapshot: () =>
      м.отказ?.снимок !== undefined
        ? Promise.reject(new Error(м.отказ.снимок))
        : Promise.resolve(
            м.безСнимка === true
              ? null
              : {
                  payload: {
                    generatedAt: NOW.toISOString(),
                    tz: "Asia/Tashkent",
                    paused: { schedules: false, tasks: false },
                    jobs: [],
                    notWired: [],
                    monitors,
                  },
                  updatedAt: NOW,
                },
          ),
    lastPerJob: () => Promise.resolve(м.runs ?? monitors.map((m) => прогон(m.name))),
  } as unknown as Runs;
  const ourvend = {
    health: () =>
      м.отказ?.ourvend !== undefined
        ? Promise.reject(new Error(м.отказ.ourvend))
        : Promise.resolve(ЗДОРОВЬЕ_OURVEND),
  } as unknown as Ourvend;
  const llm = {
    monitoring: () =>
      м.отказ?.ledger !== undefined
        ? Promise.reject(new Error(м.отказ.ledger))
        : Promise.resolve(МОНИТОРИНГ_LLM),
  } as unknown as Llm;
  const events = {
    latest: () =>
      м.отказ?.бот !== undefined
        ? Promise.reject(new Error(м.отказ.бот))
        : Promise.resolve({ occurredAt: new Date(NOW.getTime() - 60_000) }),
  } as unknown as Events;
  return new AppsHealthService(fakeDb(м), runs, ourvend, llm, events);
}

const найти = (rows: HealthRow[], key: string): HealthRow => {
  const row = rows.find((r) => r.key === key);
  assert.ok(row, `строки ${key} нет в ответе`);
  return row;
};

describe("Сборка здоровья приложений (R-A2-2, решение Р-6)", () => {
  it("отдаёт обе группы, зону и момент; внутренние мониторы стоят отдельно", async () => {
    const ответ = await сервис().health(NOW);
    assert.equal(ответ.tz, "Asia/Tashkent");
    assert.equal(ответ.now, NOW.toISOString());
    assert.deepEqual(
      ответ.outside.map((r) => r.key),
      [
        FACES.ourvendSync.key,
        FACES.ourvendAccounting.key,
        FACES.fx.key,
        FACES.notion.key,
        FACES.bot.key,
        FACES.llm.key,
      ],
    );
    assert.deepEqual(ответ.internal.map((r) => r.key), [
      FACES.coffee.key,
      FACES.maintenance.key,
      FACES.globerent.key,
    ]);
  });

  it("отказ одного источника даёт «не оценить» ЕГО строке, а не роняет ответ", async () => {
    const ответ = await сервис({ отказ: { ourvend: "донор недоступен" } }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.detail ?? "", /донор недоступен/);
    // Соседи посчитаны: витрина, гаснущая целиком из-за одной строки, хуже.
    assert.equal(найти(ответ.outside, FACES.bot.key).state, "ok");
    assert.equal(найти(ответ.internal, FACES.coffee.key).state, "ok");
  });

  it("снимок расписаний не прочитался — строки говорят «не прочитался», а не «снимка нет»", async () => {
    const ответ = await сервис({ отказ: { снимок: "соединение закрыто" } }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.match(fx.detail ?? "", /соединение закрыто/);
    assert.doesNotMatch(fx.summary, /не отчитывались/, "отказ чтения — не то же, что молчание агентов");
  });

  it("очередь доставок не прочиталась — «не оценить», а не «доставок ещё не было»", async () => {
    const ответ = await сервис({ отказ: { доставки: "таблица заблокирована" } }).health(NOW);
    const notion = найти(ответ.outside, FACES.notion.key);
    assert.equal(notion.state, "unknown");
    assert.match(notion.detail ?? "", /таблица заблокирована/);
  });

  it("счётчики доставок складываются по статусам, тупик красит строку", async () => {
    const ответ = await сервис({
      доставки: [
        { status: "sent", n: 10, oldest: new Date(NOW.getTime() - 10 * ЧАС) },
        { status: "dead", n: 1, oldest: new Date(NOW.getTime() - 2 * ЧАС) },
      ],
    }).health(NOW);
    const notion = найти(ответ.outside, FACES.notion.key);
    assert.equal(notion.state, "bad");
    assert.match(notion.summary, /тупик/);
  });

  it("молчание монитора считается по ЕГО расписанию: два пропущенных тика — сломано", async () => {
    // Крон раз в три часа, последний прогон семь часов назад: пропущены два
    // плановых запуска, хотя сам прогон был успешным.
    const ответ = await сервис({
      runs: [прогон(FACES.coffee.key, { at: new Date(NOW.getTime() - 7 * ЧАС) })],
      monitors: [{ name: FACES.coffee.key, cron: "0 */3 * * *", enabled: true }],
    }).health(NOW);
    const кофе = найти(ответ.internal, FACES.coffee.key);
    assert.equal(кофе.state, "bad");
    assert.match(кофе.summary, /молчит/);
  });

  it("снимка расписаний нет вовсе — «агенты ещё не отчитывались», строка не пропадает", async () => {
    const ответ = await сервис({ безСнимка: true }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.match(fx.summary, /агенты ещё не отчитывались/);
  });

  it("монитор без лица в реестре не пропадает с экрана и уезжает во «внутренние»", async () => {
    const ответ = await сервис({
      monitors: [{ name: "новый:монитор", cron: "0 * * * *", enabled: true }],
      runs: [прогон("новый:монитор")],
    }).health(NOW);
    assert.ok(
      ответ.internal.some((r) => r.key === "новый:монитор"),
      "незнакомый монитор обязан получить строку, а не исчезнуть",
    );
    assert.equal(ответ.outside.some((r) => r.key === "новый:монитор"), false);
  });
});
