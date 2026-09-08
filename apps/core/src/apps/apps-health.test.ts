import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACES,
  LAYER_DEPENDENCY,
  rowFromAgentsLayer,
  rowFromHeartbeat,
  rowFromLlm,
  rowFromMonitor,
  rowFromOurvendAccounting,
  rowFromOurvendSync,
  rowFromOutbox,
  rowFromSilentLayer,
  OUTBOX_STUCK_MS,
  splitSections,
  unavailableRow,
  type HealthRow,
  type LlmMonitoringLite,
  type MonitorRowInput,
  type OurvendAccountingHealthLite,
  type OurvendAccountingInput,
  type OurvendSyncHealthLite,
  type OurvendSyncInput,
  type OutboxRowInput,
} from "./apps-health";
import { STALE_AFTER_SEC } from "../routines/board";

const NOW = new Date("2026-09-06T09:00:00.000Z");
const ЧАС = 3_600_000;

/** Монитор в снимке включён, последний прогон час назад и успешен. */
function монитор(over: Partial<MonitorRowInput> = {}): MonitorRowInput {
  return {
    snapshotPublished: true,
    monitor: { enabled: true },
    lastRun: { at: new Date(NOW.getTime() - ЧАС), outcome: "executed", reason: "[fx:refresh] обновлено: USD" },
    silentAfter: new Date(NOW.getTime() + ЧАС),
    now: NOW,
    ...over,
  };
}

/** Отчёт `/ourvend/health` здорового сбора: прогоны есть, отказов нет, свежо. */
const ЗДОРОВЬЕ_СБОРА: OurvendSyncHealthLite = {
  runs: 20,
  failedStreak: 0,
  lastSuccessAt: new Date(NOW.getTime() - ЧАС).toISOString(),
  staleHoursRaw: 1,
  staleHoursShown: 1,
  staleThresholdH: 6,
};

function сбор(over: Partial<OurvendSyncInput> = {}): OurvendSyncInput {
  return {
    snapshotPublished: true,
    monitor: { enabled: true },
    lastRun: { at: new Date(NOW.getTime() - ЧАС), outcome: "executed", reason: "[ourvend:sync] success" },
    health: ЗДОРОВЬЕ_СБОРА,
    now: NOW,
    ...over,
  };
}

/** Учётный снимок свежий, сверка нашла что сравнивать и сошлась. */
const ЗДОРОВЬЕ_УЧЁТА: OurvendAccountingHealthLite = {
  snapshotStale: false,
  salesLagShownH: 1,
  parity: { mode: "stock", checked: 34, mismatches: 0, stockOk: true, stockChecked: 12 },
};

function учёт(over: Partial<OurvendAccountingInput> = {}): OurvendAccountingInput {
  return {
    snapshotPublished: true,
    monitor: { enabled: true },
    lastRun: { at: new Date(NOW.getTime() - ЧАС), outcome: "executed", reason: "[ourvend:accounting] success" },
    health: ЗДОРОВЬЕ_УЧЁТА,
    // По умолчанию монитор тикает: второй плановый запуск ещё впереди.
    silentAfter: new Date(NOW.getTime() + ЧАС),
    now: NOW,
    ...over,
  };
}

function ledger(over: Partial<LlmMonitoringLite> = {}): LlmMonitoringLite {
  return {
    meteredEnabled: true,
    hasActivePrice: true,
    provider: "anthropic",
    model: "claude-sonnet-4",
    latestCompletedAt: new Date(NOW.getTime() - ЧАС).toISOString(),
    latestCompletedStatus: "settled",
    latestCompletedOutcome: null,
    stuckCount: 0,
    openCircuits: 0,
    failuresToday: 0,
    budgetRemainingUsd: 4.5,
    budgetCapUsd: 5,
    ...over,
  };
}

const строка = (state: HealthRow["state"], key = "x"): HealthRow => ({
  key,
  title: key,
  state,
  summary: "—",
  // Поля обязательные: «проверок не было» — это ЗНАЧЕНИЕ, а не отсутствие поля,
  // а `checksKnown` отвечает, ЧТО ИМЕННО значит `null` рядом (Ф-1).
  lastCheckedAt: null,
  checksKnown: false,
});

describe("Здоровье приложений: три честных состояния (R-A2-2, решения Р-3…Р-6)", () => {
  it("ноль прогонов монитора — «не оценить», а не «в порядке»", () => {
    // Главная ловушка среза: отсутствие проверок и отсутствие ошибок сегодня
    // выглядят одинаково спокойно, если считать «ошибок нет» здоровьем.
    const row = rowFromMonitor(FACES.fx, монитор({ lastRun: null, silentAfter: null }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не оценить/);
    assert.match(row.summary, /не запускался|журнал прогонов пуст/);
    assert.equal(row.at, undefined, "времени последнего события нет — поля тоже быть не должно");
  });

  it("монитор выключен без учётных данных — «не оценить» словами «источник не настроен»", () => {
    const row = rowFromMonitor(
      FACES.fx,
      монитор({
        monitor: {
          enabled: false,
          reason: "no_credentials",
          // Текст приходит из общего словаря доски рутин (`DISABLED`): один
          // код причины — один текст на систему.
          disabledText: "не заданы OURVEND_ACCOUNT/OURVEND_PASSWORD",
        },
      }),
    );
    assert.equal(row.state, "unknown", "выключенный монитор — не «в порядке»");
    assert.match(row.summary, /источник не настроен/);
    assert.match(row.detail ?? "", /OURVEND_ACCOUNT/, "объяснение цитирует словарь, а не пишется заново");
  });

  it("монитор выключен явно — «не оценить» с причиной из снимка, даже когда прогоны были успешны", () => {
    const row = rowFromMonitor(FACES.coffee, монитор({ monitor: { enabled: false, reason: "off" } }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /выключен/);
    assert.doesNotMatch(row.summary, /источник не настроен/, "«выключен» и «не настроен» чинят по-разному");
  });

  it("снимка расписаний нет вовсе — «агенты ещё не отчитывались», а не «источник не настроен»", () => {
    const row = rowFromMonitor(FACES.fx, монитор({ snapshotPublished: false, monitor: null }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /агенты ещё не отчитывались/);
  });

  it("снимок есть, а монитора в нём нет — это другая починка, и сказано другими словами", () => {
    const row = rowFromMonitor(FACES.fx, монитор({ snapshotPublished: true, monitor: null }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не заявлен в снимке/);
    assert.doesNotMatch(row.summary, /агенты ещё не отчитывались/);
  });

  it("последний прогон упал — «сломано», и причина прогона процитирована", () => {
    const at = new Date(NOW.getTime() - ЧАС);
    const row = rowFromMonitor(
      FACES.fx,
      монитор({ lastRun: { at, outcome: "failed", reason: "ЦБ не ответил: 503" } }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.detail ?? "", /ЦБ не ответил: 503/);
    assert.equal(row.at, at.toISOString());
  });

  it("монитор молчит: последний прогон успешен, но плановые тики пропущены — «сломано»", () => {
    // `failedStreak = 0` держится вечно, если крон перестал ЗАПУСКАТЬСЯ:
    // он не падает — молчит, и зелёная строка стоит над мёртвым расписанием.
    const row = rowFromMonitor(
      FACES.coffee,
      монитор({ silentAfter: new Date(NOW.getTime() - 60_000) }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /молчит/);
  });

  it("монитор отработал в срок — «в порядке» с цитатой итоговой строки", () => {
    const row = rowFromMonitor(FACES.fx, монитор());
    assert.equal(row.state, "ok");
    assert.match(row.detail ?? "", /обновлено: USD/);
    assert.equal(row.href, FACES.fx.href, "с каждой строки есть куда уйти");
  });
});

describe("Здоровье приложений: OurVend", () => {
  it("прогонов сбора нет — «не оценить» формулировкой бота, а не «отказов нет»", () => {
    const row = rowFromOurvendSync(FACES.ourvendSync, сбор({ health: { ...ЗДОРОВЬЕ_СБОРА, runs: 0 } }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не оценить/);
  });

  it("серия отказов при последнем успешном прогоне монитора — всё равно «сломано»", () => {
    // На проде 25.08 один успех в 16:00 закрыл собой 12 отказов подряд.
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({ health: { ...ЗДОРОВЬЕ_СБОРА, failedStreak: 12 } }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /12/);
    assert.match(row.summary, /подряд/);
  });

  it("МОНИТОР СБОРА УПАЛ ДО ЗАПИСИ В ЖУРНАЛ СБОРА — «сломано», а не «данные свежие» (Д-1)", () => {
    // `startVendingSync()` бросил (Core на редеплое): в `agent_run` — failed,
    // в `vending_sync_run` строки нет, `failedStreak = 0`, застой под порогом.
    // До правки строка была зелёной и цитировала «последний прогон — сбой».
    const at = new Date(NOW.getTime() - 30 * 60_000);
    const r = rowFromOurvendSync(FACES.ourvendSync, сбор({
      lastRun: { at, outcome: "failed", reason: "[ourvend:sync] fetch failed" },
      health: { ...ЗДОРОВЬЕ_СБОРА, failedStreak: 0, staleHoursRaw: 3, staleHoursShown: 3 },
    }));
    assert.equal(r.state, "bad");
    assert.match(r.summary, /последний прогон упал/);
    assert.match(r.detail ?? "", /fetch failed/, "причина прогона процитирована");
    assert.equal(r.at, at.toISOString(), "момент — падение, а не прошлый успех");
    // Серия и застой — диагнозы точнее, и падение прогона их не перекрывает.
    const серия = rowFromOurvendSync(FACES.ourvendSync, сбор({
      lastRun: { at, outcome: "failed", reason: "[ourvend:sync] fetch failed" },
      health: { ...ЗДОРОВЬЕ_СБОРА, failedStreak: 2 },
    }));
    assert.match(серия.summary, /отказов подряд 2/);
    // Тот же вход, но прогон прошёл — «упал» не выдумывается.
    const прошёл = rowFromOurvendSync(FACES.ourvendSync, сбор({
      health: { ...ЗДОРОВЬЕ_СБОРА, failedStreak: 0, staleHoursRaw: 3, staleHoursShown: 3 },
    }));
    assert.equal(прошёл.state, "ok");
  });

  it("застой сравнивается с порогом по СЫРЫМ часам, а не по округлённому для показа полю", () => {
    // 5 ч 59 м 49 с округляются до ровно 6.0: сравнение показанного числа
    // сдвинуло бы границу на 11 секунд раньше настоящей (авария 24.08.2026).
    const почти = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: { ...ЗДОРОВЬЕ_СБОРА, staleHoursRaw: 5.99694, staleHoursShown: 6, staleThresholdH: 6 },
      }),
    );
    assert.equal(почти.state, "ok", "порог ещё не перейдён — красить нельзя");

    const перешли = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: { ...ЗДОРОВЬЕ_СБОРА, staleHoursRaw: 6.0001, staleHoursShown: 6, staleThresholdH: 6 },
      }),
    );
    assert.equal(перешли.state, "bad");
    assert.match(перешли.summary, /стоит/);
  });

  it("успешных прогонов не было вовсе при непустом журнале — «сломано», а не «ноль часов»", () => {
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({ health: { ...ЗДОРОВЬЕ_СБОРА, lastSuccessAt: null, staleHoursRaw: null, staleHoursShown: null } }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /успешных прогонов не было/);
  });

  it("учётки OurVend нет — «не оценить» словами «источник не настроен»", () => {
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({ monitor: { enabled: false, reason: "no_credentials" } }),
    );
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /источник не настроен/);
  });

  it("«расхождений 0», когда сверять не с чем, — не «в порядке»", () => {
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "stock", checked: 0, mismatches: 0, stockOk: false, stockChecked: 0 },
        },
      }),
    );
    assert.equal(row.state, "unknown", "зелёная галка над несравнёнными сутками — та же ложь, что ноль прогонов");
    assert.match(row.summary, /сверять/);
  });

  it("расхождения в сверке — «сломано» с числом", () => {
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "stock", checked: 34, mismatches: 3, stockOk: true, stockChecked: 12 },
        },
      }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /3/);
  });

  it("учётный снапшот встал — «сломано» вердиктом Core, а не сравнением лага с порогом", () => {
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({ health: { ...ЗДОРОВЬЕ_УЧЁТА, snapshotStale: true } }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /снапшот/);
  });

  it("зеркало погашено (mode retired) — сверка не считается и «в порядке» не отменяет", () => {
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "retired", checked: 0, mismatches: 0, stockOk: false, stockChecked: 0 },
        },
      }),
    );
    assert.equal(row.state, "ok");
    assert.match(row.summary, /зеркал/);
  });

  it("МОНИТОР УЧЁТА ВСТАЛ В РЕЖИМЕ `stock` — «сломано», а не «сверка сходится» (C-5)", () => {
    // Штатный откат катовера: `OURVEND_ACCOUNTING_SOURCE=stock`. Тогда
    // `snapshotStale` жёстко `false` по построению
    // (`ourvend-health.service.ts`: `источник === "own" && …`), режим паритета
    // — `mirror`, окно сверки 7 суток ещё держит `checked > 0` и `stockOk`.
    // Без проверки молчания строка отдавала `ok` над мёртвым монитором.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "mirror", checked: 34, mismatches: 0, stockOk: true, stockChecked: 12 },
        },
        lastRun: { at: new Date(NOW.getTime() - 48 * ЧАС), outcome: "executed", reason: "[ourvend:accounting] success" },
        silentAfter: new Date(NOW.getTime() - ЧАС),
      }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /молчит/);
  });

  it("монитор учёта тикает — молчание не выдумывается: тот же вход, `silentAfter` впереди", () => {
    // Граница правила: без неё «сломано» выше проходило бы по любой причине.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "mirror", checked: 34, mismatches: 0, stockOk: true, stockChecked: 12 },
        },
        lastRun: { at: new Date(NOW.getTime() - 48 * ЧАС), outcome: "executed", reason: "[ourvend:accounting] success" },
        silentAfter: new Date(NOW.getTime() + ЧАС),
      }),
    );
    assert.equal(row.state, "ok");
  });

  it("расписание монитора учёта неизвестно (`silentAfter: null`) — о молчании судить нечем", () => {
    const row = rowFromOurvendAccounting(FACES.ourvendAccounting, учёт({ silentAfter: null }));
    assert.equal(row.state, "ok");
  });

  it("МОНИТОР УЧЁТА ЗАПУСКАЕТСЯ И ПАДАЕТ КАЖДЫЙ ПРОГОН — «сломано» (Ф-1)", () => {
    // Падающий монитор НЕ молчит: он тикает по расписанию (`silentAfter`
    // впереди) и каждый раз падает — сменился вход в OurVend, таймаут,
    // изменилась вёрстка. `snapshotStale` ещё false, окно сверки 7 суток
    // держит паритет, и строка отдавала `ok` «снимок свежий, сверка
    // сходится», цитируя в том же `detail` «последний прогон — упал».
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        lastRun: {
          at: new Date(NOW.getTime() - 10 * 60_000),
          outcome: "failed",
          reason: "[ourvend:accounting] вход отклонён: 401",
        },
      }),
    );
    assert.equal(row.state, "bad", "зелёная лампа над падающим каждый прогон монитором");
    assert.match(row.summary, /упал/);
    assert.match(row.detail ?? "", /401/);
  });

  it("зеркало погашено (`retired`) НЕ отменяет падение прогона — сегодняшняя прода (Ф-1)", () => {
    // Источник `own` + погашенное зеркало: паритетного пояса нет вовсе, и
    // проверка исхода обязана стоять ВЫШЕ ветки `retired`, иначе строка
    // возвращает `ok` без единой проверки работы монитора.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          snapshotStale: false,
          salesLagShownH: 1,
          parity: { mode: "retired", checked: 0, mismatches: 0, stockOk: false, stockChecked: 0 },
        },
        lastRun: {
          at: new Date(NOW.getTime() - 10 * 60_000),
          outcome: "failed",
          reason: "[ourvend:accounting] таймаут",
        },
      }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /упал/);
  });

  it("тот же вход, но прогон прошёл — «упал» не выдумывается", () => {
    // Граница правила: без неё «сломано» выше проходило бы по любой причине.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        lastRun: {
          at: new Date(NOW.getTime() - 10 * 60_000),
          outcome: "executed",
          reason: "[ourvend:accounting] success",
        },
      }),
    );
    assert.equal(row.state, "ok");
  });
});

/**
 * Очередь доставок наружу.
 *
 * ВЕРДИКТ СУДИТ ПО ПОРЯДКУ ИСХОДОВ, А НЕ ПО НАЛИЧИЮ СТАТУСА (круг починок,
 * A-2): таблица `outbox_delivery` бесконечна и ретенцией не чистится, поэтому
 * «в ней есть skipped» и «в ней есть dead» — не утверждения о сегодняшнем дне.
 */
function доставки(over: Partial<OutboxRowInput> = {}): OutboxRowInput {
  return {
    counts: {},
    oldestPendingAt: null,
    lastSentAt: null,
    lastSkippedAt: null,
    lastFailedAt: null,
    now: NOW,
    ...over,
  };
}

/** Момент «столько-то часов назад» — для порядка исходов. */
const часНазад = (n: number): Date => new Date(NOW.getTime() - n * ЧАС);

describe("Здоровье приложений: очередь доставок и heartbeat бота", () => {
  it("строк доставки нет вовсе — «не оценить»: «доставок ещё не было», а не «очередь пуста»", () => {
    const row = rowFromOutbox(FACES.notion, доставки());
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /доставок ещё не было/);
  });

  it("очередь разобрана (ничего не ждёт) — «в порядке» и так и сказано", () => {
    const row = rowFromOutbox(FACES.notion, доставки({ counts: { sent: 12 }, lastSentAt: часНазад(1) }));
    assert.equal(row.state, "ok");
    assert.match(row.summary, /очередь разобрана/);
    assert.match(row.summary, /12/);
  });

  it("в очереди есть строки — «в порядке», но число названо", () => {
    const row = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { sent: 12, pending: 2 },
        oldestPendingAt: new Date(NOW.getTime() - 60_000),
        lastSentAt: часНазад(1),
      }),
    );
    assert.equal(row.state, "ok");
    assert.match(row.summary, /в очереди 2/, "число в очереди обязано быть видно");
  });

  it("все доставки пропущены — «не оценить»: «источник не настроен», а не «доставлено 0»", () => {
    // `skipped` в этом репозитории означает ровно одно: конфигурации Notion
    // нет (`apps/agents/src/outbox-dispatcher.ts`). Зелёная строка тут
    // показывала бы «доставлено 0» рядом с «всего 42».
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { skipped: 42 }, lastSkippedAt: часНазад(1) }),
    );
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /источник не настроен/);
    assert.match(row.summary, /42/, "число пропущенных обязано стоять рядом с «всего»");
  });

  it("КЛЮЧ УБРАЛИ У РАБОТАВШЕГО ИСТОЧНИКА — «не настроен», а не «доставлено 200» (A-2)", () => {
    // Прежнее правило требовало `пропущено === всего` и молчало ровно в том
    // случае, ради которого писалось: 200 старых успешных доставок навсегда
    // отменяли вывод «не настроен», и строка зеленела над источником, куда
    // сегодня не ушло ничего и не уйдёт больше никогда.
    const row = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { sent: 200, skipped: 50 },
        lastSentAt: часНазад(48),
        lastSkippedAt: часНазад(1),
      }),
    );
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /источник не настроен/);
    assert.match(row.detail ?? "", /после последней успешной доставки не ушло ни одной/);
  });

  it("пропуски СТАРЫЕ, доставки пошли — «в порядке»: настройку вернули", () => {
    const row = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { sent: 10, skipped: 3 },
        lastSkippedAt: часНазад(48),
        lastSentAt: часНазад(1),
      }),
    );
    assert.equal(row.state, "ok");
    assert.match(row.summary, /пропущено 3/);
    assert.match(row.detail ?? "", /13/, "сумма по статусам обязана сходиться с «всего»");
  });

  it("очередь не разбирается дольше часа — «сломано», хотя ни одна строка не отказала", () => {
    // Диспетчер не падает, а молчит: статусы остаются `pending` навсегда.
    const порог = OUTBOX_STUCK_MS;
    const свежая = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { pending: 500, sent: 12 },
        oldestPendingAt: new Date(NOW.getTime() - порог),
        lastSentAt: часНазад(1),
      }),
    );
    assert.equal(свежая.state, "ok", "ровно на пороге очередь ещё разбирается");

    const вставшая = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { pending: 500, sent: 12 },
        oldestPendingAt: new Date(NOW.getTime() - порог - 60_000),
        lastSentAt: часНазад(1),
      }),
    );
    assert.equal(вставшая.state, "bad");
    assert.match(вставшая.summary, /не разбирается/);
    assert.match(вставшая.summary, /500/);
  });

  it("доставка в тупике (dead) — «сломано», даже когда остальные ушли", () => {
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { sent: 100, dead: 1 }, lastSentAt: часНазад(2), lastFailedAt: часНазад(1) }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /тупик/);
  });

  it("доставка с неизвестным исходом — «сломано»: повтор мог задвоить запись", () => {
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { sent: 100, unknown: 2 }, lastSentAt: часНазад(2), lastFailedAt: часНазад(1) }),
    );
    assert.equal(row.state, "bad");
  });

  it("СТАРЫЙ тупик, за которым доставки пошли, красным не держит — но и не пропадает (A-2)", () => {
    // Вторая половина той же причины: по бесконечной выборке одна давняя
    // `dead` красила строку вечно. Состояние отвечает про сегодня, а запись,
    // не дошедшая до Notion, остаётся названа — иначе «зелено» прочиталось бы
    // как «всё дошло».
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { sent: 100, dead: 1 }, lastFailedAt: часНазад(48), lastSentAt: часНазад(1) }),
    );
    assert.equal(row.state, "ok");
    assert.match(row.detail ?? "", /в тупике 1/);
    assert.match(row.detail ?? "", /разбери вручную/);
  });

  it("успешных не было ни разу, а тупик есть — «сломано» независимо от моментов", () => {
    // Страховка на случай строк без `completed_at`: порядок исходов неизвестен,
    // но «ни одной успешной доставки и есть тупик» — это не «в порядке».
    const row = rowFromOutbox(FACES.notion, доставки({ counts: { dead: 3 }, lastFailedAt: null }));
    assert.equal(row.state, "bad");
  });

  it("heartbeat бота свежий — «в порядке»", () => {
    const row = rowFromHeartbeat(FACES.bot, {
      lastAt: new Date(NOW.getTime() - 60_000),
      intervalMs: 5 * 60_000,
      now: NOW,
    });
    assert.equal(row.state, "ok");
  });

  it("heartbeat старше пяти интервалов — «сломано»; ровно пять — ещё «в порядке»", () => {
    const интервал = 5 * 60_000;
    const граница = rowFromHeartbeat(FACES.bot, {
      lastAt: new Date(NOW.getTime() - 5 * интервал),
      intervalMs: интервал,
      now: NOW,
    });
    assert.equal(граница.state, "ok", "ровно пять интервалов — ещё не молчание");

    const row = rowFromHeartbeat(FACES.bot, {
      lastAt: new Date(NOW.getTime() - 5 * интервал - 1),
      intervalMs: интервал,
      now: NOW,
    });
    assert.equal(row.state, "bad");
    assert.match(row.summary, /молчит/);
  });

  it("heartbeat не появлялся — «не оценить», а не «бот молчит»", () => {
    const row = rowFromHeartbeat(FACES.bot, { lastAt: null, intervalMs: 5 * 60_000, now: NOW });
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не отчитывался/);
  });
});

describe("Здоровье приложений: ledger моделей", () => {
  it("метрируемый маршрут выключен — «не оценить», а не «в порядке»", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ meteredEnabled: false }), now: NOW });
    assert.equal(row.state, "unknown");
  });

  it("маршрут включён, а действующей цены нет — «сломано»: ledger отклонит каждый вызов", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ hasActivePrice: false }), now: NOW });
    assert.equal(row.state, "bad");
    assert.match(row.summary, /цен/);
  });

  it("завершённых вызовов не было — «не оценить», а не «отказов нет»", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ latestCompletedAt: null }), now: NOW });
    assert.equal(row.state, "unknown");
  });

  it("предохранитель провайдера открыт — «сломано»", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ openCircuits: 1 }), now: NOW });
    assert.equal(row.state, "bad");
  });

  it("ОТОЗВАННЫЙ КЛЮЧ ПРОВАЙДЕРА: последний вызов отказал — не «вызовы проходят» (A-3)", () => {
    // Предохранитель при обычной ошибке провайдера НЕ открывается
    // (`monitoringOpenCircuits` строится по аномалиям модели), зависших
    // резервов нет, потолок цел, а `latestCompleted` принимает и `failed` —
    // значит все прежние проверки проходили, и строка объявляла «вызовы
    // проходят, отказов сегодня 137» при 401 на каждый вызов.
    const row = rowFromLlm(FACES.llm, {
      monitoring: ledger({
        latestCompletedStatus: "failed",
        latestCompletedOutcome: "provider_error",
        failuresToday: 137,
      }),
      now: NOW,
    });
    assert.equal(row.state, "bad");
    assert.doesNotMatch(row.summary, /вызовы проходят/);
    assert.match(row.summary, /отказал/);
    assert.match(row.summary, /provider_error/);
  });

  it("последний вызов прошёл — «в порядке», даже если отказы сегодня были", () => {
    // Граница: голое число отказов за день красным по-прежнему не красит —
    // один 429 не авария, и красный на нём приучил бы не смотреть на красное.
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ failuresToday: 3 }), now: NOW });
    assert.equal(row.state, "ok");
    assert.match(row.summary, /вызовы проходят/);
  });
});

describe("Здоровье приложений: слой агентов по возрасту снимка (перепроверка прода, корень 2)", () => {
  it("снимка нет — «не оценить», а не «сломано»: слой мог ни разу не запуститься", () => {
    const row = rowFromAgentsLayer(FACES.agents, { freshness: null, staleAfterSec: STALE_AFTER_SEC });
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /ещё не отчитывались/);
    assert.match(row.detail ?? "", /mydon-agents/);
    assert.equal(row.at, undefined);
    // «НЕ ЗНАЕМ», А НЕ «НИ РАЗУ» (слияние A2-fix и Д1). Пустая
    // `agent_runtime_snapshot` доказывает, что ОТЧЁТА мы не видели, — но не
    // то, что слой не работал: прогоны лежат в другой таблице, которой этот
    // вход не видит. «Не запускался» на экране было бы утверждением о слое,
    // который мог тикать год со старой версией рантайма.
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, false, "снимка нет — это «не знаем», а не утверждение «ни разу»");
  });

  it("снимок есть, а его момент не читается — «не оценить», а не зелёное с NaN (слияние с Д1)", () => {
    // Достижимо: `updatedAt` приезжает из СУБД, а возраст снимка считается
    // вычитанием из него. Мусор → `ageSec = NaN`, `stale = NaN > порог = false`
    // → до слияния строка отдавала `ok` «отчитывался NaN мин назад» БЕЗ
    // времени проверки, то есть ломала инвариант среза на собственной строке.
    const row = rowFromAgentsLayer(FACES.agents, {
      freshness: { ageSec: Number.NaN, stale: false, reportedAt: new Date("сломано") },
      staleAfterSec: STALE_AFTER_SEC,
    });
    assert.equal(row.state, "unknown");
    assert.doesNotMatch(row.summary, /NaN/);
    assert.equal(row.at, undefined, "битый момент наружу не едет");
    // Строка снимка ЕСТЬ — значит слой отчитывался, назвать момент нечем.
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, false, "мусор в момент — свидетельство отчёта, а не его отсутствие");
  });

  it("снимок протух — «сломано» с давностью в минутах и порогом", () => {
    const reportedAt = new Date(NOW.getTime() - 2 * ЧАС);
    const row = rowFromAgentsLayer(FACES.agents, {
      freshness: { ageSec: 7200, stale: true, reportedAt },
      staleAfterSec: STALE_AFTER_SEC,
    });
    assert.equal(row.state, "bad");
    assert.match(row.summary, /не отчитывался 120 мин/);
    assert.match(row.detail ?? "", new RegExp(`порог молчания ${STALE_AFTER_SEC / 60} мин`));
    assert.equal(row.at, reportedAt.toISOString());
    // Снимок есть — момент отчёта и есть момент проверки слоя.
    assert.equal(row.lastCheckedAt, reportedAt.toISOString());
    assert.equal(row.checksKnown, true);
  });

  it("снимок свежий — «в порядке» с давностью", () => {
    const reportedAt = new Date(NOW.getTime() - 5 * 60_000);
    const row = rowFromAgentsLayer(FACES.agents, {
      freshness: { ageSec: 300, stale: false, reportedAt },
      staleAfterSec: STALE_AFTER_SEC,
    });
    assert.equal(row.state, "ok");
    assert.match(row.summary, /отчитывался 5 мин назад/);
    assert.equal(row.at, reportedAt.toISOString());
    // ИНВАРИАНТ СРЕЗА Д1 НА НОВОЙ СТРОКЕ: `ok` ⇒ момент проверки известен.
    assert.equal(row.lastCheckedAt, reportedAt.toISOString());
    assert.equal(row.checksKnown, true);
  });

  it("строка над молчащим слоем — «не оценить» тем же словом, что чип на /crons, и с причиной зависимости", () => {
    const reportedAt = new Date(NOW.getTime() - 45 * 60_000);
    const закрыта = new Date(NOW.getTime() - 3 * ЧАС);
    const row = rowFromSilentLayer(FACES.notion, { ageSec: 2700, reportedAt }, LAYER_DEPENDENCY.outbox, закрыта);
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /слой агентов не отчитывался 45 мин/);
    assert.match(row.detail ?? "", /диспетчер доставок живёт в слое агентов/);
    assert.match(row.detail ?? "", /mydon-agents/);
    assert.equal(row.at, reportedAt.toISOString());
    assert.equal(row.href, FACES.notion.href, "ссылка — на экран строки, не на слой");
    // МОЛЧАНИЕ СЛОЯ ОТМЕНЯЕТ ВЕРДИКТ, А НЕ ЗНАНИЕ О ПРОВЕРКАХ (слияние с Д1):
    // последняя закрытая доставка из таблицы никуда не делась, и «когда
    // проверяли — неизвестно» над ней было бы потерей уже прочитанного факта.
    assert.equal(row.lastCheckedAt, закрыта.toISOString());
    assert.equal(row.checksKnown, true);
  });

  it("над молчащим слоем свидетельства берутся у ИСТОЧНИКА: непрочитанное остаётся «не знаем»", () => {
    // Тот же класс, что чинили трижды (сбор → учёт → служба): скромная база
    // строки печатала бы «когда проверяли — неизвестно» над журналом с тиком, а
    // `true` по умолчанию — «не запускался» над ним же.
    const reportedAt = new Date(NOW.getTime() - 45 * 60_000);
    const молчание = { ageSec: 2700, reportedAt };
    const неЗнаем = rowFromSilentLayer(FACES.fx, молчание, LAYER_DEPENDENCY.monitor, "не знаем");
    assert.equal(неЗнаем.lastCheckedAt, null);
    assert.equal(неЗнаем.checksKnown, false);
    const ниРазу = rowFromSilentLayer(FACES.fx, молчание, LAYER_DEPENDENCY.monitor, { свидетельств: 0 });
    assert.equal(ниРазу.lastCheckedAt, null);
    assert.equal(ниРазу.checksKnown, true, "журнал прочитан и пуст — вот это утверждение «не запускался»");
    // Возраст не число (битый `updatedAt` снимка): без числа, но без «NaN».
    const безЧисла = rowFromSilentLayer(
      FACES.fx,
      { ageSec: Number.NaN, reportedAt },
      LAYER_DEPENDENCY.monitor,
      "не знаем",
    );
    assert.equal(безЧисла.state, "unknown");
    assert.doesNotMatch(безЧисла.summary, /NaN/);
  });
});

describe("Здоровье приложений: разделы «снаружи» и «внутренние мониторы» (Р-3)", () => {
  it("внутренний монитор не попадает в раздел «снаружи»", () => {
    const rows = [
      строка("ok", FACES.ourvendSync.key),
      строка("ok", FACES.coffee.key),
      строка("ok", FACES.maintenance.key),
      строка("ok", FACES.globerent.key),
      строка("ok", FACES.bot.key),
    ];
    const { outside, internal } = splitSections(rows);
    assert.deepEqual(
      outside.map((r) => r.key),
      [FACES.ourvendSync.key, FACES.bot.key],
      "они читают только Core: рядом с внешними источниками это обещание связи, которой нет",
    );
    assert.deepEqual(internal.map((r) => r.key), [
      FACES.coffee.key,
      FACES.maintenance.key,
      FACES.globerent.key,
    ]);
  });

  it("строка слоя агентов — во «внутренних»: связи с чужой системой у неё нет", () => {
    const { outside, internal } = splitSections([строка("ok", FACES.agents.key), строка("ok", FACES.bot.key)]);
    assert.deepEqual(outside.map((r) => r.key), [FACES.bot.key]);
    assert.deepEqual(internal.map((r) => r.key), [FACES.agents.key]);
  });

  it("незнакомый монитор уезжает во «внутренние»: связи с чужой системой ему не приписываем", () => {
    const { outside, internal } = splitSections([строка("ok", "какой-то:новый")]);
    assert.equal(outside.length, 0);
    assert.deepEqual(internal.map((r) => r.key), ["какой-то:новый"]);
  });

  it("недоступный источник даёт «не оценить», но текст исключения наружу не едет", () => {
    // Маршрут закрыт токеном (`ReadTokenGuard`, круг починок C-1), а ярлык —
    // второй пояс: сервисный токен держат ещё бот и агенты, а сообщения
    // драйвера несут хост и пользователя базы. Наружу — ярлык прочитанного,
    // причина — в журнал Core.
    const row = unavailableRow(FACES.notion, "очередь доставок", "не знаем");
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не отвечает/);
    assert.match(row.detail ?? "", /очередь доставок/);
    assert.match(row.detail ?? "", /журнал Core/);
    assert.equal(row.lastCheckedAt, null, "журнал проверок не прочитан — момента нет");
    // ВТОРОЙ ВХОД ПОЧИНКИ Ф-1. Отказ чтения — не «источника никогда не
    // проверяли»: диспетчер Notion мог работать год, мы просто не прочитали его
    // таблицу. Без этого ассерта экран снова напишет «не запускался».
    assert.equal(row.checksKnown, false, "об отказе чтения нельзя утверждать «проверок не было»");
  });

  it("недоступный источник с ИЗВЕСТНЫМ моментом проверки его не теряет", () => {
    // Отчёт OurVend не собрался, а журнал прогонов прочитан: тик монитора
    // известен, и «не запускался» здесь было бы ложью о работающем мониторе.
    const row = unavailableRow(FACES.ourvendSync, "отчёт OurVend", часНазад(1));
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
    assert.equal(row.checksKnown, true, "момент на руках — значит о проверках известно");
    assert.doesNotMatch(row.detail ?? "", /Error|host|password/i, "текст исключения наружу не едет");
  });
});

/**
 * Момент последней проверки (срез Д1, Р-Д1-2, Р-Д1-3).
 *
 * ПОЧЕМУ ЭТО ОТДЕЛЬНОЕ ПОЛЕ, А НЕ `at`. `at` — момент СОБЫТИЯ, о котором
 * говорит строка, и у выключенного монитора, у разобранной очереди Notion и у
 * «не оценить» его честно нет. «Когда проверяли» существует и там, а без него
 * «нет данных» неотличимо от «нет данных уже неделю».
 */
describe("Здоровье приложений: момент последней проверки (Р-Д1-2, Р-Д1-3)", () => {
  it("поле есть в КАЖДОЙ строке: «проверок не было» — значение, а не отсутствие поля", () => {
    const rows = [
      rowFromMonitor(FACES.fx, монитор()),
      rowFromMonitor(FACES.fx, монитор({ lastRun: null, silentAfter: null })),
      rowFromOurvendSync(FACES.ourvendSync, сбор()),
      rowFromOurvendAccounting(FACES.ourvendAccounting, учёт()),
      rowFromOutbox(FACES.notion, доставки()),
      rowFromHeartbeat(FACES.bot, { lastAt: null, intervalMs: 5 * 60_000, now: NOW }),
      rowFromLlm(FACES.llm, { monitoring: ledger(), now: NOW }),
      rowFromLlm(FACES.llm, { monitoring: null, now: NOW }),
      unavailableRow(FACES.llm, "монитор ledger", "не знаем"),
    ];
    for (const row of rows) {
      assert.ok(
        row.lastCheckedAt === null || typeof row.lastCheckedAt === "string",
        `${row.key}: lastCheckedAt обязано быть ISO-строкой или null, а не пропадать`,
      );
    }
  });

  it("монитор без прогонов — проверок не было ни разу: null, а не выдуманное число дней", () => {
    const row = rowFromMonitor(FACES.fx, монитор({ lastRun: null, silentAfter: null }));
    assert.equal(row.state, "unknown");
    assert.equal(row.at, undefined);
    assert.equal(row.lastCheckedAt, null, "экран обязан сказать «не запускался», а не давность");
  });

  it("ВЫКЛЮЧЕННЫЙ монитор с прогонами в прошлом называет давность, хотя события нет", () => {
    // Главная ценность поля: `молчаливыйИсточник` отдаёт строку без `at`, и до
    // среза выключенный монитор выглядел как никогда не запускавшийся. Снятый
    // с расписания вчера проверялся вчера.
    const row = rowFromMonitor(
      FACES.coffee,
      монитор({
        monitor: { enabled: false, reason: "off" },
        lastRun: { at: часНазад(30), outcome: "executed", reason: "[coffee:monitor] бункеров 12" },
      }),
    );
    assert.equal(row.state, "unknown");
    assert.equal(row.at, undefined, "события строка не описывает: монитор выключен");
    assert.equal(row.lastCheckedAt, часНазад(30).toISOString());
  });

  it("монитора нет в снимке, а прогоны были — момент проверки не теряется", () => {
    const row = rowFromMonitor(
      FACES.globerent,
      монитор({
        monitor: null,
        lastRun: { at: часНазад(50), outcome: "executed", reason: "[globerent:monitor] ok" },
      }),
    );
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не заявлен в снимке/);
    assert.equal(row.lastCheckedAt, часНазад(50).toISOString());
  });

  it("зелёная строка монитора называет время проверки (Р-Д1-3)", () => {
    const row = rowFromMonitor(FACES.fx, монитор());
    assert.equal(row.state, "ok");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
  });

  it("сбор OurVend: проверка — ПОЗДНЕЙШИЙ момент, а не последний успех недельной давности", () => {
    // Серия отказов: успеха нет неделю, но монитор тикает каждые три часа и
    // каждый раз падает. «Проверено 7 д назад» было бы ложью, а именно так
    // ответил бы `ourvendAt` — он отдаёт предпочтение успеху, а не максимуму.
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: {
          ...ЗДОРОВЬЕ_СБОРА,
          failedStreak: 3,
          lastSuccessAt: часНазад(24 * 7).toISOString(),
          staleHoursRaw: 168,
          staleHoursShown: 168,
        },
        lastRun: { at: часНазад(1), outcome: "failed", reason: "[ourvend:sync] таймаут" },
      }),
    );
    assert.equal(row.state, "bad");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
  });

  it("сбор OurVend: отчёт не собрался — проверка берётся из тика монитора", () => {
    const row = rowFromOurvendSync(FACES.ourvendSync, сбор({ health: null }));
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
  });

  it("сбор OurVend: ни прогонов, ни успехов — null", () => {
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: { ...ЗДОРОВЬЕ_СБОРА, runs: 0, lastSuccessAt: null, staleHoursRaw: null, staleHoursShown: null },
        lastRun: null,
      }),
    );
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, null);
  });

  it("учёт OurVend без прогонов — null: лаг в часах момента не даёт", () => {
    // `salesLagShownH` округлён ДЛЯ ПОКАЗА, и `now - лаг` был бы выдуманным
    // моментом с точностью до часа.
    const row = rowFromOurvendAccounting(FACES.ourvendAccounting, учёт({ lastRun: null }));
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, null);
    // «МОМЕНТА НЕТ» И «ПРОВЕРОК НЕ БЫЛО» — РАЗНЫЕ УТВЕРЖДЕНИЯ, И БЕЗ ЭТОГО
    // АССЕРТА ТЕСТ ПРОПУСКАЛ ВТОРОЕ (одиннадцатый круг починок, И-1). Вход
    // фикстуры — ровно тот, что каждый день бывает на проде: журнал прогонов
    // пуст, а снимок продаж часовой давности лежит в отчёте
    // (`salesLagShownH: 1`). Момента он не даёт — свидетельство даёт.
    assert.equal(row.checksKnown, false, "снимок часовой давности — свидетельство, а не его отсутствие");
  });

  it("учёт OurVend: ни прогонов, ни следа снимка — вот здесь «не запускался» (И-1)", () => {
    // ОБРАТНАЯ ПОЛОВИНА ПРЕДЫДУЩЕГО ТЕСТА: без неё починка «всегда не знаем»
    // прошла бы зелёной, а экран потерял бы слово «не запускался» у учёта
    // целиком. Следов у снимка два, по одному на половину (продажи и остатки
    // едут разными POST-ами), и ноль требует отсутствия обоих.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        lastRun: null,
        health: {
          ...ЗДОРОВЬЕ_УЧЁТА,
          salesLagShownH: null,
          parity: { mode: "stock", checked: 0, mismatches: 0, stockOk: false, stockChecked: 0 },
        },
      }),
    );
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, true, "отчёт прочитан, снимков нет ни в одной половине, журнал пуст");

    // И КАЖДАЯ ПОЛОВИНА ПООТДЕЛЬНОСТИ ЗАКРЫВАЕТ НОЛЬ. Продаж не было ни одной
    // (`salesLagShownH: null`), а остатки монитор довёз — прогон был.
    const толькоОстатки = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        lastRun: null,
        health: {
          ...ЗДОРОВЬЕ_УЧЁТА,
          salesLagShownH: null,
          parity: { mode: "stock", checked: 0, mismatches: 0, stockOk: true, stockChecked: 12 },
        },
      }),
    );
    assert.equal(толькоОстатки.checksKnown, false, "сверенные пары остатков — след нашего снимка");
  });

  it("учёт OurVend с прогоном — ISO-момент тика монитора", () => {
    const row = rowFromOurvendAccounting(FACES.ourvendAccounting, учёт());
    assert.equal(row.state, "ok");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
  });

  it("ЗЕЛЁНАЯ ОЧЕРЕДЬ NOTION НАЗЫВАЕТ ВРЕМЯ ПРОВЕРКИ, хотя события у неё нет (Р-Д1-3)", () => {
    // Пробел из разведки: при разобранной очереди `at` = oldestPendingAt =
    // undefined, и зелёная строка стояла вообще без времени.
    const row = rowFromOutbox(FACES.notion, доставки({ counts: { sent: 12 }, lastSentAt: часНазад(2) }));
    assert.equal(row.state, "ok");
    assert.equal(row.at, undefined, "события нет: очередь разобрана");
    assert.equal(row.lastCheckedAt, часНазад(2).toISOString());
  });

  it("очередь Notion: пропуск свежее успеха — проверка это пропуск (диспетчер жив, ключа нет)", () => {
    const row = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { sent: 200, skipped: 50 },
        lastSentAt: часНазад(48),
        lastSkippedAt: часНазад(1),
      }),
    );
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /источник не настроен/);
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
  });

  it("очередь Notion: ни одной ЗАКРЫТОЙ доставки — «не оценить», а не «в порядке» (Р-Д1-3)", () => {
    // ДОСТИЖИМЫЙ ВХОД, А НЕ УГОЛ: первый час свежей установки (или только что
    // подключённого назначения) — доставки положены, доставщик ни одной ещё не
    // закрыл. Ретенции у `outbox_delivery` нет, поэтому состояние одноразовое:
    // после первой закрытой доставки её `completed_at` остаётся навсегда.
    //
    // Строки в очередь положили МЫ: они говорят о нас, а не о Notion. Пока ни
    // одна не закрылась, свидетельств, что доставщик ходил, нет — и «доставлено
    // 0, очередь разобрана» здесь та же ложь, что зелёная галка над нулём
    // прогонов монитора (инвариант волны A2).
    //
    // `oldestPendingAt` при этом не становится проверкой: это момент СОЗДАНИЯ
    // нашей же строки, и вставшая очередь выглядела бы «проверенной только
    // что» ровно потому, что в неё подкладывают новые доставки.
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { pending: 500 }, oldestPendingAt: new Date(NOW.getTime() - 5 * 60_000) }),
    );
    assert.equal(row.state, "unknown", "ноль закрытых доставок — это «не оценить», а не «ок»");
    assert.match(row.summary, /ни одна доставка ещё не закрылась/);
    assert.match(row.summary, /в очереди 500/);
    assert.doesNotMatch(row.summary, /доставлено 0/, "«доставлено 0» звучит как исправная работа");
    // Диагноз обязан отличаться от двух соседних, иначе владелец пойдёт чинить
    // не там: «не настроен» — это отсутствие ключа, «не разбирается» — мёртвый
    // доставщик при живой очереди.
    assert.doesNotMatch(row.summary, /не настроен/);
    assert.doesNotMatch(row.summary, /не разбирается/);
    assert.match(row.detail ?? "", /о работе доставщика не известно ничего/);
    assert.equal(row.lastCheckedAt, null, "ни одна доставка не закрылась — проверок не было");
  });

  it("ГРАНИЦА: одна закрытая доставка любым исходом возвращает и время, и прежний вердикт", () => {
    // Ровно один шаг от предыдущего входа: доставщик закрыл первую строку.
    // С этого момента свидетельство есть, и правила ведут себя как до среза.
    const ушла = rowFromOutbox(
      FACES.notion,
      доставки({
        counts: { sent: 1, pending: 1 },
        oldestPendingAt: new Date(NOW.getTime() - 60_000),
        lastSentAt: часНазад(1),
      }),
    );
    assert.equal(ушла.state, "ok", "закрытая доставка есть — вердикт прежний");
    assert.match(ушла.summary, /в очереди 1, доставлено 1/);
    assert.equal(ушла.lastCheckedAt, часНазад(1).toISOString());

    // Пропуск — тоже закрытие: диспетчер прошёл, ключа нет. Вердикт прежний
    // («источник не настроен»), и время проверки теперь есть.
    const пропущена = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { skipped: 1 }, lastSkippedAt: часНазад(2) }),
    );
    assert.equal(пропущена.state, "unknown");
    assert.match(пропущена.summary, /источник не настроен/);
    assert.equal(пропущена.lastCheckedAt, часНазад(2).toISOString());

    // Отказ — тоже закрытие: строка красная, как и была.
    const отказала = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { dead: 1 }, lastFailedAt: часНазад(3) }),
    );
    assert.equal(отказала.state, "bad");
    assert.match(отказала.summary, /не дошли/);
    assert.equal(отказала.lastCheckedAt, часНазад(3).toISOString());
  });

  it("более точные диагнозы остаются ТОЧНЕЕ нового правила", () => {
    // Все три входа — без единого момента закрытия, то есть новое правило по
    // условию к ним подходит. Оно обязано их не перехватить: каждый из трёх
    // называет поломку конкретнее, чем «закрытых доставок нет».
    const тупик = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { dead: 1, pending: 1 }, oldestPendingAt: new Date(NOW.getTime() - 60_000) }),
    );
    assert.equal(тупик.state, "bad", "свежий тупик у строк без completed_at — по-прежнему «сломано»");
    assert.match(тупик.summary, /в тупике 1/);

    const встала = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { pending: 1 }, oldestPendingAt: часНазад(2) }),
    );
    assert.equal(встала.state, "bad", "вставшая очередь любого возраста краснее «не оценить»");
    assert.match(встала.summary, /не разбирается/);

    const неНастроен = rowFromOutbox(FACES.notion, доставки({ counts: { skipped: 3 } }));
    assert.equal(неНастроен.state, "unknown");
    assert.match(
      неНастроен.summary,
      /источник не настроен/,
      "второй пояс «пропущено === всего» написан ровно для строк без completed_at",
    );
  });

  it("исходы в таблице есть, а моментов закрытия нет — «не оценить» со своей причиной", () => {
    // Через код недостижимо: все три терминальных перехода в
    // `outbox/outbox.service.ts` пишут `completedAt` вместе со статусом, а
    // ретенции у таблицы нет. Остаётся легаси-строка или правка руками — и
    // молча зеленеть на ней строка не имеет права: числа есть, а порядок
    // исходов неизвестен, значит о свежести доставок судить нечем.
    const row = rowFromOutbox(FACES.notion, доставки({ counts: { sent: 5 } }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /нет момента закрытия/);
    assert.match(row.summary, /\(5\)/, "число закрытых строк не прячем");
    assert.equal(row.lastCheckedAt, null);
  });

  it("ИНВАРИАНТ Р-Д1-3: зелёной строки очереди без времени проверки не существует", () => {
    // Зубы требования: перебор входов, а не один пример. `ok` на этой строке
    // теперь недостижим без момента закрытия ПО ПОСТРОЕНИЮ — вердикт и момент
    // спрашивают один факт одной функцией (`закрытиеДоставки`).
    const входы: OutboxRowInput[] = [
      доставки(),
      доставки({ counts: { pending: 1 }, oldestPendingAt: new Date(NOW.getTime() - 60_000) }),
      доставки({ counts: { dispatching: 1 }, oldestPendingAt: new Date(NOW.getTime() - 60_000) }),
      доставки({ counts: { pending: 500 }, oldestPendingAt: new Date(NOW.getTime() - 5 * 60_000) }),
      доставки({ counts: { pending: 1 }, oldestPendingAt: часНазад(9) }),
      доставки({ counts: { sent: 5 } }),
      доставки({ counts: { skipped: 3 } }),
      доставки({ counts: { skipped: 2, sent: 3 } }),
      доставки({ counts: { dead: 1, pending: 1 }, oldestPendingAt: часНазад(1) }),
      доставки({ counts: { sent: 12 }, lastSentAt: часНазад(2) }),
      доставки({ counts: { sent: 1, pending: 1 }, oldestPendingAt: часНазад(1), lastSentAt: часНазад(2) }),
      доставки({ counts: { sent: 100, dead: 1 }, lastSentAt: часНазад(1), lastFailedAt: часНазад(48) }),
    ];
    let зелёных = 0;
    for (const вход of входы) {
      const row = rowFromOutbox(FACES.notion, вход);
      if (row.state === "ok") {
        зелёных += 1;
        assert.equal(
          typeof row.lastCheckedAt,
          "string",
          `«в порядке» без времени проверки: ${row.summary}`,
        );
      }
    }
    // ПЕРЕБОР ОБЯЗАН БЫТЬ НЕПУСТЫМ. Ассерт живёт внутри `if (state === "ok")`,
    // поэтому мутация, из-за которой НИ ОДИН вход не зеленеет, прошла бы его
    // вакуумно — и «инвариант» доказывал бы только то, что зелёных нет.
    assert.ok(зелёных >= 3, `зелёных входов в переборе ${зелёных}: доказывать инвариант нечем`);
    // И один вход назван зелёным прямо, чтобы список нельзя было выхолостить
    // целиком, оставив счётчик довольным.
    assert.equal(
      rowFromOutbox(FACES.notion, доставки({ counts: { sent: 12 }, lastSentAt: часНазад(2) })).state,
      "ok",
      "разобранная очередь с закрытой доставкой — эталонный зелёный вход",
    );
  });

  it("heartbeat: проверка и событие — одно и то же; без сигнала — null", () => {
    const свежий = rowFromHeartbeat(FACES.bot, {
      lastAt: new Date(NOW.getTime() - 60_000),
      intervalMs: 5 * 60_000,
      now: NOW,
    });
    assert.equal(свежий.state, "ok");
    assert.equal(свежий.lastCheckedAt, new Date(NOW.getTime() - 60_000).toISOString());
    assert.equal(свежий.lastCheckedAt, свежий.at, "у бота сигнал и есть проверка");

    const молчок = rowFromHeartbeat(FACES.bot, { lastAt: null, intervalMs: 5 * 60_000, now: NOW });
    assert.equal(молчок.state, "unknown");
    assert.equal(молчок.lastCheckedAt, null);
  });

  it("модели: выключенный метрируемый маршрут всё равно называет давность прошлых вызовов", () => {
    // Строка говорит «оценивать нечего» и не несёт `at`, но вызовы были: до
    // среза источник выглядел как никогда не проверявшийся.
    const row = rowFromLlm(FACES.llm, {
      monitoring: ledger({ meteredEnabled: false, latestCompletedAt: часНазад(72).toISOString() }),
      now: NOW,
    });
    assert.equal(row.state, "unknown");
    assert.equal(row.at, undefined);
    assert.equal(row.lastCheckedAt, часНазад(72).toISOString());
  });

  it("модели: монитор ledger не ответил или завершённых вызовов не было — null", () => {
    const безМонитора = rowFromLlm(FACES.llm, { monitoring: null, now: NOW });
    assert.equal(безМонитора.state, "unknown");
    assert.equal(безМонитора.lastCheckedAt, null);

    const безВызовов = rowFromLlm(FACES.llm, {
      monitoring: ledger({ latestCompletedAt: null, latestCompletedStatus: null }),
      now: NOW,
    });
    assert.equal(безВызовов.state, "unknown");
    assert.match(безВызовов.summary, /завершённых вызовов не было/);
    assert.equal(безВызовов.lastCheckedAt, null);
  });

  it("модели: битая дата последнего вызова — «не оценить» БЕЗ времени, а не зелёное без времени", () => {
    // ЭТОТ ТЕСТ РАНЬШЕ ЗАКРЕПЛЯЛ ДЕФЕКТ. Он проверял только `lastCheckedAt` и
    // молчал про вердикт, а вердикт был `ok` «вызовы проходят, отказов сегодня
    // 0»: гард «вызовов не было» спрашивал СЫРОЕ поле (`=== null`), мимо
    // которого «не дата» проходит насквозь, а момент обёртка брала из
    // разобранного. Зелёная строка без отметки времени — ровно то, что срез
    // запрещает, и защита от битой даты консервировала её.
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ latestCompletedAt: "не дата" }), now: NOW });
    assert.equal(row.state, "unknown", "нечитаемый момент не даёт права говорить «вызовы проходят»");
    assert.equal(row.lastCheckedAt, null, "битую дату отбрасываем: `toISOString()` уронил бы весь ответ");
    assert.equal(row.at, undefined);
    // «Вызовов не было» и «вызов был, а когда — не читается» чинят в разных
    // местах: вторую нельзя называть первой.
    assert.match(row.summary, /не читается/);
    assert.doesNotMatch(row.summary, /вызовов не было/);
    assert.match(row.detail ?? "", /не дата/, "что именно вернул ledger — владельцу видно");
  });

  it("сбор OurVend: отчёт называет свежесть, а момента успеха нет — «не оценить», а не зелёное", () => {
    // Тот же класс, что у моделей: вердикт доказывал «данные свежие» полем
    // `staleHoursRaw`, а момент проверки живёт в ДРУГИХ полях (читаемый
    // `lastSuccessAt` и тик монитора). Служба считает `staleHoursRaw` из того
    // же `lastSuccessAt`, поэтому через HTTP вход не приезжает — но это
    // согласованность в двух модулях отсюда, и гард обязан стоять рядом с
    // правилом.
    const безМомента = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: { ...ЗДОРОВЬЕ_СБОРА, lastSuccessAt: null },
        lastRun: null,
      }),
    );
    assert.equal(безМомента.state, "unknown", "«данные свежие» без времени проверки приёмку не проходит");
    assert.match(безМомента.summary, /момента последнего успеха/);
    assert.equal(безМомента.lastCheckedAt, null);

    // Битая дата успеха — тот же вход: `разобрать` её отбрасывает.
    const битаяДата = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({ health: { ...ЗДОРОВЬЕ_СБОРА, lastSuccessAt: "не дата" }, lastRun: null }),
    );
    assert.equal(битаяДата.state, "unknown");
    assert.equal(битаяДата.lastCheckedAt, null);
  });

  it("сбор OurVend: ПРОГОНОВ НЕТ, а успех есть — проверка берётся из успеха (обе половины нужны)", () => {
    // ЗУБЫ ДЛЯ `позднееИз`: без этого входа мутация
    // `сПроверкой(вердиктСбора(...), input.lastRun?.at ?? null)` — то есть
    // выбрасывание половины, ради которой функция и писалась, — проходила весь
    // набор зелёной. Журнал прогонов пуст штатно (строки мониторов удаляет
    // смоук, колбэк пишет их best effort; ретенции у `agent_run` нет), а отчёт
    // помнит успех: это не угол, а обычное состояние сбора.
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        health: { ...ЗДОРОВЬЕ_СБОРА, lastSuccessAt: часНазад(2).toISOString(), staleHoursRaw: 2, staleHoursShown: 2 },
        lastRun: null,
      }),
    );
    assert.equal(row.state, "ok");
    assert.equal(row.lastCheckedAt, часНазад(2).toISOString(), "успех — вторая половина `позднееИз`");
  });

  it("учёт OurVend: зелёная ветка ПРОДА (зеркало погашено) называет время проверки", () => {
    // Единственная зелёная ветка учёта, работающая на проде сегодня:
    // `parity.mode === "retired"` (комментарий в правилах говорит это прямо).
    // Прочие тесты идут через `stock` и `mirror`, то есть ровно мимо неё.
    // Ветка безопасна только потому, что гард `lastRun === null` стоит выше:
    // перенеси её вверх — и получишь `ok` без времени, не уронив ни теста.
    const row = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          ...ЗДОРОВЬЕ_УЧЁТА,
          parity: { mode: "retired", checked: 0, mismatches: 0, stockOk: true, stockChecked: 0 },
        },
      }),
    );
    assert.equal(row.state, "ok");
    assert.match(row.summary, /сверка с зеркалом завершена/);
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());

    // И зубы для порядка правил: ветка `retired` безопасна ТОЛЬКО потому, что
    // гард «прогонов нет» стоит выше. Перенеси её вверх — и погашенное зеркало
    // выдаст `ok` «сравнивать больше не с чем» над монитором, который ни разу
    // не запускался, да ещё без времени проверки.
    const безПрогонов = rowFromOurvendAccounting(
      FACES.ourvendAccounting,
      учёт({
        health: {
          ...ЗДОРОВЬЕ_УЧЁТА,
          parity: { mode: "retired", checked: 0, mismatches: 0, stockOk: true, stockChecked: 0 },
        },
        lastRun: null,
      }),
    );
    assert.equal(безПрогонов.state, "unknown", "«сравнивать больше не с чем» — не вердикт о нуле прогонов");
    assert.equal(безПрогонов.lastCheckedAt, null);
  });

  it("битый момент прогона даёт строку БЕЗ времени, а не 500 на весь экран (Ф-2)", () => {
    // `rowFromRaw` собирает `startedAt: d(r.started_at)!` без проверки на
    // конечность, поэтому испорченный столбец приезжает в правила как
    // `Invalid Date`. `toISOString()` на ней бросает `RangeError` ИЗ ЧИСТЫХ
    // ПРАВИЛ, которые вызываются вне `попытка`, — то есть гасит `/apps/health`
    // целиком. До среза ветки `молчаливыйИсточник` и `unavailableRow` даты не
    // касались вовсе; момент проверки их к ней привёл.
    const битая = new Date("сломано");
    const выключен = rowFromMonitor(
      FACES.coffee,
      монитор({
        monitor: { enabled: false, reason: "off" },
        lastRun: { at: битая, outcome: "executed", reason: "[coffee:monitor] ok" },
      }),
    );
    assert.equal(выключен.state, "unknown");
    assert.equal(выключен.lastCheckedAt, null, "нечитаемый момент — это отсутствие момента");

    // Тот же пояс на строке-заглушке: она существует ровно для того, чтобы
    // витрина выживала при плохом чтении.
    const заглушка = unavailableRow(FACES.fx, "журнал прогонов", битая);
    assert.equal(заглушка.state, "unknown");
    assert.equal(заглушка.lastCheckedAt, null);

    // ЗЕЛЁНАЯ ВЕТКА — ГЛАВНОЕ ЗДЕСЬ. Успешный прогон с нечитаемым моментом
    // отдавал `ok` «последний прогон прошёл» БЕЗ времени: `исо` дату
    // отбрасывал, 500 не случалось, и строка тихо зеленела без отметки. Это
    // тот же дефект, что был у моделей, и «не роняет ответ» его не оправдывает.
    // Нечитаемый момент уравнен с отсутствующим — прогона для правил нет.
    const прошёл = rowFromMonitor(
      FACES.fx,
      монитор({ lastRun: { at: битая, outcome: "executed", reason: "[fx:refresh] ok" } }),
    );
    assert.equal(прошёл.state, "unknown", "«прогон прошёл» без времени проверки приёмку не проходит");
    assert.match(прошёл.summary, /момент его начала не читается/, "строка прогона в журнале есть (М-2)");
    assert.equal(прошёл.at, undefined);
    assert.equal(прошёл.lastCheckedAt, null);

    // Heartbeat: нечитаемый момент не имеет права дать «бот отвечает NaN мин».
    const бот = rowFromHeartbeat(FACES.bot, { lastAt: битая, intervalMs: 5 * 60_000, now: NOW });
    assert.equal(бот.state, "unknown");
    assert.equal(бот.lastCheckedAt, null);
    assert.doesNotMatch(бот.summary, /NaN/);

    // Очередь: битый момент закрытия не съедает читаемый соседний (сравнение с
    // `NaN` всегда ложно, поэтому нормализуется КАЖДЫЙ момент, а не максимум).
    const очередь = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { sent: 2, skipped: 1 }, lastSentAt: битая, lastSkippedAt: часНазад(3) }),
    );
    assert.equal(очередь.lastCheckedAt, часНазад(3).toISOString());

    const всёБитое = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { sent: 2 }, lastSentAt: битая }),
    );
    assert.equal(всёБитое.state, "unknown", "ни одного читаемого закрытия — зелёной строки быть не может");
    assert.equal(всёБитое.lastCheckedAt, null);
  });
});

/**
 * ПОРОГОВЫЕ МОМЕНТЫ: битый момент не имеет права дать зелёное (срез Д1, П3).
 *
 * Срез ввёл правило «нечитаемый момент = отсутствующий» и применил его к
 * моментам ПРОГОНОВ. Три момента остались снаружи — `MonitorRowInput.silentAfter`,
 * `OurvendAccountingInput.silentAfter` и `OutboxRowInput.oldestPendingAt`, — и
 * все три операнды ПОРОГОВОГО сравнения: сравнение с `NaN` всегда ложно,
 * поэтому битый момент молча снимал правило и переворачивал `bad` в `ok`.
 *
 * ПОЧЕМУ ЗДЕСЬ ПРОВЕРЯЕТСЯ ТРИ ВХОДА, А НЕ ОДИН. У этих моментов `null` —
 * ЗАКОННЫЙ штатный случай («расписания нет», «неразобранных доставок нет»), при
 * котором правило порога честно пропускается и строка вправе зеленеть. Поэтому
 * каждый тест пришпиливает ВСЕ ТРИ формы: читаемый порог — «сломано»,
 * отсутствующий — зелёное, битый — «оценить нечем». Уравняй битый с `null`
 * (одна нормализация без пост-фильтра) — и третья форма снова станет зелёной,
 * то есть проверка обязана падать при откате.
 */
describe("Здоровье приложений: битый пороговый момент (срез Д1, П3)", () => {
  const битая = new Date("сломано");

  it("монитор: битый порог молчания даёт «не оценить», а не «последний прогон прошёл»", () => {
    // Монитор молчит 30 часов, порог второго планового запуска давно прошёл.
    const молчит = монитор({ lastRun: { at: часНазад(30), outcome: "executed", reason: "ok" }, silentAfter: часНазад(1) });
    const сломано = rowFromMonitor(FACES.fx, молчит);
    assert.equal(сломано.state, "bad");
    assert.match(сломано.summary, /монитор молчит/);

    // Расписания нет вовсе — о молчании судить нечем ЗАКОННО, строка зелёная.
    const безРасписания = rowFromMonitor(FACES.fx, монитор({ ...молчит, silentAfter: null }));
    assert.equal(безРасписания.state, "ok");

    // А вот битый порог — это утверждение «расписание есть», без времени.
    const битый = rowFromMonitor(FACES.fx, монитор({ ...молчит, silentAfter: битая }));
    assert.equal(битый.state, "unknown", "зелёное над нечитаемым порогом приёмку не проходит");
    assert.match(битый.summary, /не оценить/);
    assert.match(битый.summary, /не читается/);
    assert.doesNotMatch(битый.summary, /NaN|Invalid/);
    assert.doesNotMatch(битый.detail ?? "", /NaN|Invalid/);
    // Момент проверки берётся из ДРУГОГО поля и не теряется: «когда проверяли»
    // мы знаем даже там, где не знаем, когда монитор был должен тикнуть.
    assert.equal(битый.lastCheckedAt, часНазад(30).toISOString());
  });

  it("учёт OurVend: битый порог молчания гасит «сверка сходится»", () => {
    const молчит = учёт({ lastRun: { at: часНазад(30), outcome: "executed", reason: "ok" }, silentAfter: часНазад(1) });
    const сломано = rowFromOurvendAccounting(FACES.ourvendAccounting, молчит);
    assert.equal(сломано.state, "bad");
    assert.match(сломано.summary, /монитор молчит/);

    const безРасписания = rowFromOurvendAccounting(FACES.ourvendAccounting, { ...молчит, silentAfter: null });
    assert.equal(безРасписания.state, "ok");
    assert.match(безРасписания.summary, /сверка сходится/);

    const битый = rowFromOurvendAccounting(FACES.ourvendAccounting, { ...молчит, silentAfter: битая });
    assert.equal(битый.state, "unknown");
    assert.match(битый.summary, /не оценить/);
    // Что сказали бы правила — в `detail`: диагноз не пропадает, он теряет право
    // называться зелёным.
    assert.match(битый.detail ?? "", /сверка сходится/);
    assert.equal(битый.lastCheckedAt, часНазад(30).toISOString());
  });

  it("очередь: битый момент застоя гасит «в очереди 500, доставлено 5»", () => {
    const очередь = доставки({ counts: { pending: 500, sent: 5 }, lastSentAt: часНазад(1) });
    const сломано = rowFromOutbox(FACES.notion, { ...очередь, oldestPendingAt: часНазад(9) });
    assert.equal(сломано.state, "bad");
    assert.match(сломано.summary, /очередь не разбирается/);

    // Неразобранных нет — момента нет законно, и строка зелёная.
    const свежая = rowFromOutbox(FACES.notion, очередь);
    assert.equal(свежая.state, "ok");

    const битый = rowFromOutbox(FACES.notion, { ...очередь, oldestPendingAt: битая });
    assert.equal(битый.state, "unknown");
    assert.match(битый.summary, /не оценить/);
    assert.doesNotMatch(битый.summary, /NaN/);
    assert.equal(битый.at, undefined, "нечитаемый момент не едет наружу даже в `at`");
    assert.equal(битый.lastCheckedAt, часНазад(1).toISOString());
  });

  it("очередь: битый момент УСПЕХА не делает свежий отказ несвежим (находка перебора П4)", () => {
    // ПОРЯДОК ИСХОДОВ СУДИТСЯ ТЕМИ ЖЕ МОМЕНТАМИ, и `позже` сравнивал их СЫРЫМИ,
    // в отличие от `закрытиеДоставки`. Сравнение с `NaN` ложно в обе стороны:
    // битый момент успеха делал СВЕЖИЙ терминальный отказ «старым», и строка с
    // записью в тупике зеленела. Правило файла на этот случай уже написано —
    // «успехов не было вовсе: тогда отказ свежий по определению», — только до
    // нормализации оно не срабатывало, потому что `Invalid Date` не `null`.
    const тупик = доставки({ counts: { sent: 200, dead: 1 }, lastFailedAt: часНазад(1) });
    const свежий = rowFromOutbox(FACES.notion, { ...тупик, lastSentAt: часНазад(5) });
    assert.equal(свежий.state, "bad");
    assert.match(свежий.summary, /в тупике 1/);

    // Старый отказ, за которым доставки пошли, красным быть не должен —
    // проверяем, что нормализация не покрасила и его.
    const старый = rowFromOutbox(FACES.notion, {
      ...тупик,
      lastFailedAt: часНазад(5),
      lastSentAt: часНазад(1),
    });
    assert.equal(старый.state, "ok");

    const битыйУспех = rowFromOutbox(FACES.notion, { ...тупик, lastSentAt: битая });
    assert.equal(битыйУспех.state, "bad", "нечитаемый успех — это отсутствие успеха, а не свежий успех");
    assert.match(битыйУспех.summary, /в тупике 1/);
    assert.equal(битыйУспех.lastCheckedAt, часНазад(1).toISOString());
  });
});

/*
 * ТРИ СМЫСЛА `lastCheckedAt === null`, РАЗВЕДЁННЫЕ ПО ПРОВОДУ (круг починок
 * среза Д1, Ф-1), И УТВЕРЖДЕНИЕ ТРЕБУЕТ ДОКАЗАТЕЛЬСТВА (девятый круг, К-1).
 *
 * Панель печатала «не запускался» везде, где момента нет, — то есть УТВЕРЖДАЛА
 * о мире то, чего система не знает. Ф-1 развёл три смысла, но развёл их ТОЛЬКО
 * у очереди доставок, где вызывающий передавал свидетеля; у остальных пяти
 * источников `checksKnown` по-прежнему выводился из отсутствия МОМЕНТА, то есть
 * был истиной по умолчанию. Ниже — все достижимые входы, на которых это
 * утверждение ложно, и «ноль свидетельств» рядом с ними: без последнего теста
 * пара «правда / ложь» сошлась бы на одном значении признака.
 */
describe("Здоровье приложений: «не было ни разу» ≠ «не знаем» (Ф-1, К-1)", () => {
  it("закрытые доставки без момента закрытия: строка не спорит сама с собой", () => {
    // ВХОД, ПРОТИВОРЕЧИВШИЙ СЕБЕ В ОДНОЙ СТРОКЕ: слева «у закрытых доставок (3)
    // нет момента закрытия», справа «не запускался». Права левая половина —
    // проходы диспетчера БЫЛИ, неизвестен их момент. Страховку на строки без
    // `completed_at` вердикт держит намеренно (`пропущено === всего` выше и это
    // правило), значит вход достижим, а не выдуман.
    const row = rowFromOutbox(FACES.notion, доставки({ counts: { sent: 3 } }));
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /у закрытых доставок \(3\) нет момента закрытия/);
    assert.equal(row.lastCheckedAt, null);
    assert.equal(
      row.checksKnown,
      false,
      "закрытия есть — «проверок не было ни разу» здесь ложь о работающем диспетчере",
    );
  });

  it("монитор ledger не ответил — о вызовах не известно ничего, а не «ни разу»", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: null, now: NOW });
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, false, "монитор молчит — судить о вызовах нечем");
  });

  it("пустая очередь и монитор без прогонов — вот это «ни разу», и оно утверждение", () => {
    // ТРЕТИЙ ТЕСТ ОБЯЗАТЕЛЕН: если бы `checksKnown` всегда был `false`, два
    // теста выше прошли бы зелёными, а экран потерял бы слово «не запускался»
    // целиком — починка в другую сторону.
    const пусто = rowFromOutbox(FACES.notion, доставки());
    assert.equal(пусто.lastCheckedAt, null);
    assert.equal(пусто.checksKnown, true, "таблица прочитана и пуста — доставок не было ни разу");

    const монитор_ = rowFromMonitor(FACES.fx, монитор({ lastRun: null, silentAfter: null }));
    assert.equal(монитор_.lastCheckedAt, null);
    assert.equal(монитор_.checksKnown, true, "журнал прогонов прочитан — прогонов в нём нет");

    const бот = rowFromHeartbeat(FACES.bot, { lastAt: null, intervalMs: 5 * 60_000, now: NOW });
    assert.equal(бот.checksKnown, true, "журнал событий прочитан — сигналов в нём нет");

    // Сбор OurVend — тот же обратный случай на источнике с ДВУМЯ мерилами:
    // отчёт прочитан и говорит «прогонов ноль», журнал прогонов пуст. Оба
    // свидетеля молчат, и вот здесь «не запускался» законно.
    const сборПусто = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({ lastRun: null, health: { ...ЗДОРОВЬЕ_СБОРА, runs: 0, lastSuccessAt: null, staleHoursRaw: null } }),
    );
    assert.equal(сборПусто.lastCheckedAt, null);
    assert.equal(сборПусто.checksKnown, true, "отчёт прочитан: прогонов сбора ноль, журнал пуст");
  });

  it("прогон с нечитаемым моментом — свидетельство проверки, а не её отсутствие (К-1)", () => {
    // РЕШЕНИЕ ПЕРЕВЁРНУТО ОСОЗНАННО. Ф-1 оставил здесь «не запускался» с
    // доводом «строка не должна спорить с вердиктом». Но спорить тут не с чем:
    // вердикт говорит «здоровье не оценить: монитор не запускался ИЛИ журнал
    // прогонов пуст» — он и сам ничего не утверждает. А СТРОКА ПРОГОНА в
    // журнале есть: `сЧитаемымПрогоном` спрятал её от правил (сравнение с `NaN`
    // зеленило бы строку), а не отменил в базе. «Не запускался» о живом
    // прогоне — выдумка того же рода, что и три другие в этом круге.
    for (const момент of [new Date("сломано"), null as unknown as Date]) {
      const row = rowFromMonitor(
        FACES.fx,
        монитор({ lastRun: { at: момент, outcome: "executed", reason: "[fx] ok" } }),
      );
      assert.equal(row.lastCheckedAt, null, "нечитаемый момент — это отсутствие момента");
      assert.equal(
        row.checksKnown,
        false,
        "строка прогона есть — «проверок не было» здесь ложь о работавшем мониторе",
      );
      // И ВЕРДИКТ БОЛЬШЕ НЕ ВРЁТ ОБЕИМИ ПОЛОВИНАМИ (одиннадцатый круг, М-2).
      // Прежняя фраза «монитор не запускался ИЛИ журнал прогонов пуст» стояла
      // рядом с лампой «когда проверяли — неизвестно», а в журнале лежала
      // строка: ложны обе альтернативы, и строка спорила сама с собой.
      assert.match(row.summary, /прогон в журнале есть, момент его начала не читается/);
      assert.doesNotMatch(row.summary, /не запускался|журнал прогонов пуст/);
      assert.match(row.detail ?? "", /приехал не датой/);

      // ТА ЖЕ ФРАЗА У УЧЁТА: гард «прогонов нет» у него свой, и разъехаться
      // двум формулировкам одного факта нечем — они из одной функции.
      const учётСБитым = rowFromOurvendAccounting(
        FACES.ourvendAccounting,
        учёт({ lastRun: { at: момент, outcome: "executed", reason: "[ourvend:accounting] ok" } }),
      );
      assert.match(учётСБитым.summary, /прогон в журнале есть, момент его начала не читается/);
      assert.equal(учётСБитым.checksKnown, false);

      // ОБРАТНАЯ ПОЛОВИНА: прогона нет ВОВСЕ — прежняя фраза остаётся, и она
      // правдива. Без этого ассерта починка «всегда третья формулировка»
      // прошла бы зелёной.
      const безПрогона = rowFromMonitor(FACES.fx, монитор({ lastRun: null, silentAfter: null }));
      assert.match(безПрогона.summary, /не запускался|журнал прогонов пуст/);
      assert.doesNotMatch(безПрогона.summary, /не читается/);
    }
  });

  it("сбор с прогонами в отчёте, но без момента: «не запускался» — ложь (К-1)", () => {
    // ВХОД ДОСТИЖИМ, А НЕ УГЛОВОЙ, И ЭТО ДВЕ РАЗНЫЕ ТАБЛИЦЫ. `runs` считается
    // по `vending_sync_run`, `lastRun` — по `agent_run`; коллектор открывает
    // строку сбора В НАЧАЛЕ прогона, а прогон монитора пишется ПОСЛЕ и best
    // effort. Двадцать прогонов, серия отказов — и «не запускался» справа.
    const row = rowFromOurvendSync(
      FACES.ourvendSync,
      сбор({
        lastRun: null,
        health: { ...ЗДОРОВЬЕ_СБОРА, failedStreak: 3, lastSuccessAt: null, staleHoursRaw: null },
      }),
    );
    assert.equal(row.state, "bad");
    assert.match(row.summary, /отказов подряд 3/);
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, false, "прогоны в отчёте есть — проверки шли, неизвестен их момент");
  });

  it("ledger: нечитаемый момент вызова и зависшие резервы — тоже свидетельства (К-1)", () => {
    // ЯДРО ЭТО РАЗЛИЧИЕ УЖЕ ДЕЛАЛО В СВОДКЕ («момент последнего завершённого
    // вызова не читается» против «завершённых вызовов не было»), а на провод
    // обе ветки уезжали одним `checksKnown: true` — экран называл их ОДНИМ
    // словом. Различие ядра обязано доезжать до провода целиком.
    const битыйМомент = rowFromLlm(FACES.llm, {
      monitoring: ledger({ latestCompletedAt: "не дата", latestCompletedStatus: null }),
      now: NOW,
    });
    assert.match(битыйМомент.summary, /не читается/);
    assert.equal(битыйМомент.lastCheckedAt, null);
    assert.equal(битыйМомент.checksKnown, false, "ledger вернул строку вызова — вызов был");

    // Резерв открывается ПЕРЕД вызовом: зависший резерв и есть доказательство
    // того, что провайдера звали.
    const резервы = rowFromLlm(FACES.llm, {
      monitoring: ledger({ stuckCount: 4, latestCompletedAt: null, latestCompletedStatus: null }),
      now: NOW,
    });
    assert.equal(резервы.state, "bad");
    assert.match(резервы.summary, /зависших резервов 4/);
    assert.equal(резервы.checksKnown, false, "резервы есть — вызовы шли, момента у них нет");
  });

  it("заглушка с нечитаемым моментом не утверждает «не запускался» (К-1)", () => {
    // ФУНКЦИЯ ПРИШЛА В СОГЛАСИЕ С СОБСТВЕННЫМ ДОКБЛОКОМ: `исо` выбрасывал
    // `Invalid Date` молча, и над «источник не отвечает — оценить нечем»
    // вставало утверждение о прогонах, которое тот же докблок запрещает.
    const row = unavailableRow(FACES.fx, "журнал прогонов", new Date("сломано"));
    assert.equal(row.lastCheckedAt, null);
    assert.equal(row.checksKnown, false, "момент отдан мусором — значит проверка БЫЛА");
  });

  it("известный момент — всегда знание: невозможной пары нет по построению", () => {
    // Полный перебор форм держит `apps-health.invariants.test.ts`; здесь —
    // читаемый пример того же утверждения на самом обычном входе.
    const row = rowFromMonitor(FACES.fx, монитор());
    assert.equal(typeof row.lastCheckedAt, "string");
    assert.equal(row.checksKnown, true);
  });
});
