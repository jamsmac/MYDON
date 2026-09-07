import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACES,
  rowFromHeartbeat,
  rowFromLlm,
  rowFromMonitor,
  rowFromOurvendAccounting,
  rowFromOurvendSync,
  rowFromOutbox,
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
  // Поле обязательное: «проверок не было» — это ЗНАЧЕНИЕ, а не отсутствие поля.
  lastCheckedAt: null,
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
    const row = unavailableRow(FACES.notion, "очередь доставок", null);
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не отвечает/);
    assert.match(row.detail ?? "", /очередь доставок/);
    assert.match(row.detail ?? "", /журнал Core/);
    assert.equal(row.lastCheckedAt, null, "журнал проверок не прочитан — момента нет");
  });

  it("недоступный источник с ИЗВЕСТНЫМ моментом проверки его не теряет", () => {
    // Отчёт OurVend не собрался, а журнал прогонов прочитан: тик монитора
    // известен, и «не запускался» здесь было бы ложью о работающем мониторе.
    const row = unavailableRow(FACES.ourvendSync, "отчёт OurVend", часНазад(1));
    assert.equal(row.state, "unknown");
    assert.equal(row.lastCheckedAt, часНазад(1).toISOString());
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
      unavailableRow(FACES.llm, "монитор ledger", null),
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

  it("очередь Notion: ни одной ЗАКРЫТОЙ доставки — null, возраст очереди проверкой не считается", () => {
    // `oldestPendingAt` — момент СОЗДАНИЯ строки, которую мы положили сами.
    // Считать его проверкой значило бы объявить вставшую очередь «проверенной
    // только что» ровно потому, что в неё подкладывают новые доставки.
    //
    // ЗАКРЕПЛЁННЫЙ УГОЛ: вердикт здесь «в порядке» (правила не менялись), а
    // момента проверки нет — единственная зелёная строка без времени во всём
    // ответе. Её `summary` сам говорит «доставлено 0»; менять вердикт — не
    // задача этого раздела, но подменять момент возрастом очереди нельзя.
    const row = rowFromOutbox(
      FACES.notion,
      доставки({ counts: { pending: 500 }, oldestPendingAt: new Date(NOW.getTime() - 5 * 60_000) }),
    );
    assert.match(row.summary, /доставлено 0/);
    assert.equal(row.lastCheckedAt, null, "ни одна доставка не закрылась — проверок не было");
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

  it("модели: битая дата последнего вызова даёт null, а не мусор и не падение", () => {
    const row = rowFromLlm(FACES.llm, { monitoring: ledger({ latestCompletedAt: "не дата" }), now: NOW });
    assert.equal(row.lastCheckedAt, null, "битую дату отбрасываем: `toISOString()` уронил бы весь ответ");
  });
});
