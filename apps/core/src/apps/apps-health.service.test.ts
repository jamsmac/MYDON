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

/**
 * Отчёт сбора, в котором ДВАДЦАТЬ ПРОГОНОВ И НИ ОДНОГО УСПЕХА: серия отказов,
 * читаемого момента нет ни в одной таблице. Ровно тот вход, на котором служба
 * печатала «не запускался» над двадцатью прогонами (десятый круг, Ф-1).
 */
const ДВАДЦАТЬ_ОТКАЗОВ: OurvendHealth = {
  ...ЗДОРОВЬЕ_OURVEND,
  runs: Array.from({ length: 20 }, (_, i) => ({
    id: `sync-fail-${i}`,
    startedAt: new Date(NOW.getTime() - (i + 1) * 3 * ЧАС).toISOString(),
    finishedAt: new Date(NOW.getTime() - (i + 1) * 3 * ЧАС).toISOString(),
    status: "failed" as const,
    machinesTotal: 2,
    machinesOk: 0,
    durationMs: 1000,
    error: "таймаут",
  })),
  failedStreak: 20,
  lastSuccessAt: null,
  staleHours: null,
};

/** Отчёт сбора, прочитанный и ПУСТОЙ: `vending_sync_run` без единой строки. */
const ПУСТОЙ_ОТЧЁТ: OurvendHealth = {
  ...ЗДОРОВЬЕ_OURVEND,
  runs: [],
  failedStreak: 0,
  lastSuccessAt: null,
  staleHours: null,
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
  /** Отчёт `/ourvend/health` вместо штатного (один успешный прогон час назад). */
  ourvend?: OurvendHealth;
  /** Отказ конкретного источника: сообщение исключения. */
  отказ?: {
    снимок?: string;
    /** Журнал прогонов (`lastPerJob`): без него о проверках не известно ничего. */
    прогоны?: string;
    ourvend?: string;
    ledger?: string;
    доставки?: string;
    бот?: string;
  };
  /** `newest` — `max(completed_at)` по статусу: момент ЗАКРЫТИЯ доставки. */
  доставки?: { status: string; n: number; oldest: Date | null; newest?: Date | null }[];
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
    lastPerJob: () =>
      м.отказ?.прогоны !== undefined
        ? Promise.reject(new Error(м.отказ.прогоны))
        : Promise.resolve(м.runs ?? monitors.map((m) => прогон(m.name))),
  } as unknown as Runs;
  const ourvend = {
    health: () =>
      м.отказ?.ourvend !== undefined
        ? Promise.reject(new Error(м.отказ.ourvend))
        : Promise.resolve(м.ourvend ?? ЗДОРОВЬЕ_OURVEND),
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
    // Наружу едет ЯРЛЫК прочитанного, а не сообщение исключения: маршрут
    // читается без токена, а текст драйвера несёт хост и пользователя базы.
    assert.match(сбор.detail ?? "", /отчёт OurVend/);
    assert.doesNotMatch(сбор.detail ?? "", /донор недоступен/);
    assert.doesNotMatch(сбор.summary, /донор недоступен/);
    // Соседи посчитаны: витрина, гаснущая целиком из-за одной строки, хуже.
    assert.equal(найти(ответ.outside, FACES.bot.key).state, "ok");
    assert.equal(найти(ответ.internal, FACES.coffee.key).state, "ok");
  });

  it("снимок расписаний не прочитался — строки говорят «не прочитался», а не «снимка нет»", async () => {
    const ответ = await сервис({ отказ: { снимок: "соединение закрыто" } }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.match(fx.detail ?? "", /снимок расписаний/);
    assert.doesNotMatch(fx.detail ?? "", /соединение закрыто/, "текст исключения наружу не едет");
    assert.doesNotMatch(fx.summary, /не отчитывались/, "отказ чтения — не то же, что молчание агентов");
  });

  it("очередь доставок не прочиталась — «не оценить», а не «доставок ещё не было»", async () => {
    const ответ = await сервис({ отказ: { доставки: "таблица заблокирована" } }).health(NOW);
    const notion = найти(ответ.outside, FACES.notion.key);
    assert.equal(notion.state, "unknown");
    assert.match(notion.detail ?? "", /очередь доставок/);
    assert.doesNotMatch(notion.detail ?? "", /таблица заблокирована/, "текст исключения наружу не едет");
    // Диспетчер Notion мог работать год — мы не смогли прочитать его таблицу.
    assert.equal(notion.checksKnown, false, "отказ чтения — не «доставок ещё не было»");
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

  it("выключенный монитор объясняется словарём доски рутин, а не своим текстом", async () => {
    const ответ = await сервис({
      monitors: [{ name: FACES.ourvendSync.key, cron: "0 */3 * * *", enabled: false, reason: "no_credentials" }],
    }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.summary, /источник не настроен/);
    // Тот же текст, что доска рутин показывает в `disabledReason`: один код
    // причины не должен нести в системе два разных объяснения.
    assert.match(сбор.detail ?? "", /OURVEND_ACCOUNT/);
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

  it("каждая строка ответа несёт момент проверки, а зелёная — обязательно ISO (Р-Д1-3)", async () => {
    const ответ = await сервис().health(NOW);
    for (const row of [...ответ.outside, ...ответ.internal]) {
      assert.ok(
        row.lastCheckedAt === null || typeof row.lastCheckedAt === "string",
        `${row.key}: поле lastCheckedAt пропало из строки`,
      );
      // Признак смысла едет ВМЕСТЕ с моментом (Ф-1): без него `null` снова
      // станет одним словом на три разных случая.
      assert.equal(typeof row.checksKnown, "boolean", `${row.key}: поле checksKnown пропало из строки`);
      if (row.lastCheckedAt !== null) {
        assert.equal(row.checksKnown, true, `${row.key}: момент известен, а о проверках «не знаем»`);
      }
      if (row.state === "ok") {
        assert.equal(
          typeof row.lastCheckedAt,
          "string",
          `${row.key}: «в порядке» без времени проверки приёмку не проходит`,
        );
      }
    }
  });

  it("нечитаемый момент прогона — «не знаем», а не «не запускался» и не 500 на весь ответ (Ф-2; десятый круг, Ф-1)", async () => {
    // `rowFromRaw` не проверяет `started_at` на конечность, поэтому испорченный
    // столбец приезжает в службу как `Invalid Date`. Ответ обязан собраться
    // (экран не гаснет целиком), а строка — НЕ утверждать «проверок не было»:
    // строка прогона в журнале ЕСТЬ, назвать её нечем. Прежняя редакция
    // отбрасывала такую строку на границе и получала честный с виду ноль.
    const ответ = await сервис({
      runs: [прогон(FACES.fx.key, { at: new Date("сломано") })],
    }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    // ФРАЗА НАЗЫВАЕТ ТРЕТИЙ СЛУЧАЙ (одиннадцатый круг починок, М-2): строка
    // прогона доехала до провода, значит «не запускался» и «журнал пуст» —
    // обе ложны, а рядом горит лампа «когда проверяли — неизвестно».
    assert.match(fx.summary, /прогон в журнале есть, момент его начала не читается/);
    assert.doesNotMatch(fx.summary, /не запускался|журнал прогонов пуст/);
    assert.equal(fx.at, undefined);
    assert.equal(fx.lastCheckedAt, null);
    assert.equal(fx.checksKnown, false, "строка прогона есть — «не запускался» над ней ложь, а не скромность");
  });

  it("сбор: снимок не прочитался, журнал пуст, в отчёте двадцать отказов — «не знаем», а не «не запускался» (десятый круг, Ф-1)", async () => {
    // Сценарий ревью: `agent_run` пуст (свежая установка, после смоука, первый
    // прогон убит деплоем), `runs.snapshot()` бросил, а отчёт OurVend с
    // двадцатью прогонами уже лежит в `ourvend.value`. Служба считала
    // свидетельства по ОДНОМУ журналу и печатала «не запускался» над двадцатью
    // прогонами; правило на том же входе отвечало «не знаем». Теперь дверь одна.
    const ответ = await сервис({
      runs: [],
      отказ: { снимок: "соединение закрыто" },
      ourvend: ДВАДЦАТЬ_ОТКАЗОВ,
    }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.detail ?? "", /снимок расписаний/);
    assert.equal(сбор.lastCheckedAt, null);
    assert.equal(сбор.checksKnown, false, "двадцать прогонов в отчёте — это свидетельства, а не их отсутствие");

    // Тот же отказ снимка при отчёте С УСПЕХОМ: момент успеха — читаемое
    // свидетельство, и оно едет на провод, а не теряется вместе со снимком.
    const сУспехом = await сервис({ runs: [], отказ: { снимок: "соединение закрыто" } }).health(NOW);
    const сборСУспехом = найти(сУспехом.outside, FACES.ourvendSync.key);
    assert.equal(сборСУспехом.lastCheckedAt, ЗДОРОВЬЕ_OURVEND.lastSuccessAt);
    assert.equal(сборСУспехом.checksKnown, true);
  });

  it("сбор: журнал пуст, отчёт не собрался — «не знаем», не «ни разу» (десятый круг, Ф-1)", async () => {
    // Одна таблица пуста, вторую не прочитали: ноль свидетельств недоказуем.
    const ответ = await сервис({ runs: [], отказ: { ourvend: "донор недоступен" } }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.detail ?? "", /отчёт OurVend/);
    assert.equal(сбор.lastCheckedAt, null);
    assert.equal(сбор.checksKnown, false, "по одному пустому agent_run «сбор не запускался» утверждать нельзя");

    // УЧЁТ НА ТОМ ЖЕ ВХОДЕ ОТВЕЧАЕТ ТАК ЖЕ (одиннадцатый круг починок, И-1).
    // Прежняя редакция теста утверждала обратное («у учёта одна таблица, и она
    // прочитана»), и это была та же ложь на строку ниже: отчёт учёта тоже
    // несёт СЛЕД снимка, а его-то как раз и не прочитали. Момента в отчёте
    // по-прежнему нет ни одного — но нуля свидетельств по одной прочитанной
    // таблице из двух не бывает ни у сбора, ни у учёта.
    const учёт = найти(ответ.outside, FACES.ourvendAccounting.key);
    assert.equal(учёт.lastCheckedAt, null);
    assert.equal(учёт.checksKnown, false, "отчёт учёта не прочитан — ноль по одному пустому agent_run недоказуем");
  });

  it("учёт: журнал прогонов пуст, а снимок часовой давности — «не знаем», не «не запускался» (И-1)", async () => {
    // СЦЕНАРИЙ РЕВЬЮ И САМЫЙ ЧАСТЫЙ ВХОД: свежая установка, день после смоука
    // или прогон, убитый автодеплоем. `agent_run` пуст, а `POST
    // /ourvend/snapshot` уже отработал — снимок продаж часовой давности лежит
    // в отчёте (`salesLagH: 1`). Строка печатала «монитор не запускался» НАД
    // этим снимком, потому что спрашивала дверь обычного монитора, знающую
    // одну таблицу.
    const ответ = await сервис({ runs: [] }).health(NOW);
    const учёт = найти(ответ.outside, FACES.ourvendAccounting.key);
    assert.equal(учёт.state, "unknown");
    assert.equal(учёт.lastCheckedAt, null, "момента в отчёте учёта нет — выдумывать его из округлённых часов нельзя");
    assert.equal(учёт.checksKnown, false, "снимок в отчёте — свидетельство: «не запускался» над ним ложь");

    // ОБРАТНАЯ ПОЛОВИНА, БЕЗ КОТОРОЙ ПОЧИНКА «ВСЕГДА НЕ ЗНАЕМ» ПРОШЛА БЫ
    // ЗЕЛЁНОЙ: обе таблицы прочитаны и обе пусты — снимков нет ни продаж
    // (`salesLagH: null`), ни остатков (`stockChecked: 0`), журнал прогонов
    // пуст. Вот здесь «не запускался» законно.
    const пусто = await сервис({
      runs: [],
      ourvend: {
        ...ЗДОРОВЬЕ_OURVEND,
        salesLagH: null,
        parity: { ...ЗДОРОВЬЕ_OURVEND.parity, checked: 0, mismatches: 0, stockOk: false, stockChecked: 0 },
      },
    }).health(NOW);
    const учётПусто = найти(пусто.outside, FACES.ourvendAccounting.key);
    assert.equal(учётПусто.lastCheckedAt, null);
    assert.equal(учётПусто.checksKnown, true, "снимков нет ни в одной половине, журнал пуст — ноль настоящий");
  });

  it("сбор: журнал не прочитан — отчёт всё равно спрашивается, но ноль по одному отчёту не выводится", async () => {
    // Отчёт помнит успех: момент проверки известен, хотя журнал не прочитан.
    const сУспехом = await сервис({ отказ: { прогоны: "таблица недоступна" } }).health(NOW);
    const сбор = найти(сУспехом.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.detail ?? "", /журнал прогонов/);
    assert.equal(сбор.lastCheckedAt, ЗДОРОВЬЕ_OURVEND.lastSuccessAt, "успех из отчёта — читаемый момент проверки");
    assert.equal(сбор.checksKnown, true);

    // Отчёт прочитан и ПУСТ, журнал не прочитан: одной пустой таблицы для нуля
    // мало — «не знаем», зеркально к «журнал пуст, отчёт не собрался».
    const пустой = await сервис({ отказ: { прогоны: "таблица недоступна" }, ourvend: ПУСТОЙ_ОТЧЁТ }).health(NOW);
    const сборПустой = найти(пустой.outside, FACES.ourvendSync.key);
    assert.equal(сборПустой.lastCheckedAt, null);
    assert.equal(сборПустой.checksKnown, false, "журнал не прочитан — ноль по одному отчёту недоказуем");
  });

  it("сбор: обе таблицы прочитаны и пусты — единственный законный «не запускался»", async () => {
    const ответ = await сервис({ runs: [], ourvend: ПУСТОЙ_ОТЧЁТ }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.match(сбор.summary, /сбор не запускался|журнал прогонов пуст/);
    assert.equal(сбор.lastCheckedAt, null);
    assert.equal(сбор.checksKnown, true, "обе таблицы прочитаны, обе пусты — ноль свидетельств настоящий");
  });

  it("монитор без прогонов — проверок не было ни разу (Р-Д1-2)", async () => {
    const ответ = await сервис({ runs: [] }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.equal(fx.at, undefined);
    assert.equal(fx.lastCheckedAt, null);
    // ЖУРНАЛ ПРОЧИТАН И ПУСТ — вот это «не запускался», и его экран печатает
    // словом. Пара с тестом отказа чтения ниже: одно значение признака на два
    // противоположных случая и было дефектом Ф-1.
    assert.equal(fx.checksKnown, true, "журнал прочитан — «прогонов не было» это утверждение");
  });

  it("монитор с прогоном — ISO-момент того самого прогона", async () => {
    const тик = new Date(NOW.getTime() - 40 * 60_000);
    const ответ = await сервис({
      monitors: [{ name: FACES.coffee.key, cron: "0 */3 * * *", enabled: true }],
      runs: [прогон(FACES.coffee.key, { at: тик })],
    }).health(NOW);
    assert.equal(найти(ответ.internal, FACES.coffee.key).lastCheckedAt, тик.toISOString());
  });

  it("отчёт OurVend не собрался, а журнал прогонов прочитан — момент проверки не теряется", async () => {
    // `unavailableRow` получает ровно то, что успели прочитать: «не запускался»
    // здесь было бы ложью о работающем мониторе.
    const ответ = await сервис({ отказ: { ourvend: "донор недоступен" } }).health(NOW);
    const сбор = найти(ответ.outside, FACES.ourvendSync.key);
    assert.equal(сбор.state, "unknown");
    assert.equal(сбор.lastCheckedAt, new Date(NOW.getTime() - ЧАС).toISOString());
    assert.equal(сбор.checksKnown, true, "тик монитора на руках — о проверках известно");
    assert.doesNotMatch(сбор.detail ?? "", /донор недоступен/, "текст исключения наружу не едет");

    // СИММЕТРИЧНАЯ ТОЧКА ОТКАЗА УЧЁТА. Отчёт `/ourvend/health` один на две
    // строки, значит и не собирается он для двух сразу — но тест был только на
    // сбор, и замена третьего аргумента у `строкаУчёта` на `null` не роняла
    // ничего. Ошибка, которую легко сделать: две ветки одного гарда правят
    // по-разному.
    const учёт = найти(ответ.outside, FACES.ourvendAccounting.key);
    assert.equal(учёт.state, "unknown");
    assert.equal(
      учёт.lastCheckedAt,
      new Date(NOW.getTime() - ЧАС).toISOString(),
      "тик монитора учёта прочитан — «не запускался» было бы ложью и здесь",
    );
    assert.doesNotMatch(учёт.detail ?? "", /донор недоступен/, "текст исключения наружу не едет");
  });

  it("снимок не прочитался, а журнал прогонов прочитан — момент проверки известен", async () => {
    const ответ = await сервис({ отказ: { снимок: "соединение закрыто" } }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.equal(fx.lastCheckedAt, new Date(NOW.getTime() - ЧАС).toISOString());
    assert.doesNotMatch(fx.detail ?? "", /соединение закрыто/, "текст исключения наружу не едет");

    // Обе строки OurVend идут по ветке `базаОтказала` — и обе обязаны отдать
    // прочитанный тик, а не «не запускался».
    for (const key of [FACES.ourvendSync.key, FACES.ourvendAccounting.key]) {
      const row = найти(ответ.outside, key);
      assert.equal(row.state, "unknown");
      assert.equal(row.lastCheckedAt, new Date(NOW.getTime() - ЧАС).toISOString(), key);
    }
  });

  it("журнал прогонов не прочитался — момента нет, и он не выдумывается", async () => {
    const ответ = await сервис({ отказ: { прогоны: "таблица недоступна" } }).health(NOW);
    const fx = найти(ответ.outside, FACES.fx.key);
    assert.equal(fx.state, "unknown");
    assert.match(fx.detail ?? "", /журнал прогонов/);
    assert.doesNotMatch(fx.detail ?? "", /таблица недоступна/, "текст исключения наружу не едет");
    assert.equal(fx.lastCheckedAt, null);
    // ВТОРОЙ ДОСТИЖИМЫЙ ВХОД Ф-1, И ОН ЖИВЁТ ИМЕННО ЗДЕСЬ, НА СТЫКЕ СО СЛУЖБОЙ:
    // журнал проверок не прочитан — «не запускался» было бы утверждением о
    // мониторе, который мог тикать всё это время.
    assert.equal(fx.checksKnown, false, "журнал проверок не прочитан — утверждать нечего");
  });

  it("свежая установка: доставки положены, ни одна не закрылась — «не оценить», а не «в порядке»", async () => {
    // Достижимый вход, а не угол: `max(completed_at)` по всей группе `pending`
    // приходит из СУБД как NULL, потому что доставщик ещё ни одной не закрыл.
    // Зелёная строка здесь обещала бы владельцу работающую доставку в Notion.
    const ответ = await сервис({
      доставки: [{ status: "pending", n: 3, oldest: new Date(NOW.getTime() - 5 * 60_000), newest: null }],
    }).health(NOW);
    const notion = найти(ответ.outside, FACES.notion.key);
    assert.equal(notion.state, "unknown");
    assert.match(notion.summary, /ни одна доставка ещё не закрылась/);
    assert.equal(notion.lastCheckedAt, null);
    assert.equal(notion.checksKnown, true, "таблица прочитана: закрытий в ней нет ни одного");
  });

  it("очередь доставок: момент проверки — последняя ЗАКРЫТАЯ доставка, а не возраст очереди", async () => {
    const закрыта = new Date(NOW.getTime() - 20 * 60_000);
    const ответ = await сервис({
      доставки: [
        { status: "sent", n: 10, oldest: new Date(NOW.getTime() - 10 * ЧАС), newest: закрыта },
        { status: "pending", n: 2, oldest: new Date(NOW.getTime() - 5 * 60_000), newest: null },
      ],
    }).health(NOW);
    const notion = найти(ответ.outside, FACES.notion.key);
    assert.equal(notion.state, "ok");
    assert.equal(notion.lastCheckedAt, закрыта.toISOString());
  });
});
