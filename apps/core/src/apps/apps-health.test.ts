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
});

describe("Здоровье приложений: очередь доставок и heartbeat бота", () => {
  it("строк доставки нет вовсе — «не оценить»: «доставок ещё не было», а не «очередь пуста»", () => {
    const row = rowFromOutbox(FACES.notion, { counts: {}, oldestPendingAt: null, now: NOW });
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /доставок ещё не было/);
  });

  it("очередь разобрана (ничего не ждёт) — «в порядке» и так и сказано", () => {
    const row = rowFromOutbox(FACES.notion, { counts: { sent: 12 }, oldestPendingAt: null, now: NOW });
    assert.equal(row.state, "ok");
    assert.match(row.summary, /очередь разобрана/);
    assert.match(row.summary, /12/);
  });

  it("в очереди есть строки — «в порядке», но число названо", () => {
    const row = rowFromOutbox(FACES.notion, {
      counts: { sent: 12, pending: 2 },
      oldestPendingAt: new Date(NOW.getTime() - 60_000),
      now: NOW,
    });
    assert.equal(row.state, "ok");
    assert.match(row.summary, /в очереди 2/, "число в очереди обязано быть видно");
  });

  it("все доставки пропущены — «не оценить»: «источник не настроен», а не «доставлено 0»", () => {
    // `skipped` в этом репозитории означает ровно одно: конфигурации Notion
    // нет (`apps/agents/src/outbox-dispatcher.ts`). Зелёная строка тут
    // показывала бы «доставлено 0» рядом с «всего 42».
    const row = rowFromOutbox(FACES.notion, { counts: { skipped: 42 }, oldestPendingAt: null, now: NOW });
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /источник не настроен/);
    assert.match(row.summary, /42/, "число пропущенных обязано стоять рядом с «всего»");
  });

  it("часть пропущена, часть доставлена — «в порядке», но пропуски названы числом", () => {
    const row = rowFromOutbox(FACES.notion, {
      counts: { sent: 10, skipped: 3 },
      oldestPendingAt: null,
      now: NOW,
    });
    assert.equal(row.state, "ok");
    assert.match(row.summary, /пропущено 3/);
    assert.match(row.detail ?? "", /13/, "сумма по статусам обязана сходиться с «всего»");
  });

  it("очередь не разбирается дольше часа — «сломано», хотя ни одна строка не отказала", () => {
    // Диспетчер не падает, а молчит: статусы остаются `pending` навсегда.
    const порог = OUTBOX_STUCK_MS;
    const свежая = rowFromOutbox(FACES.notion, {
      counts: { pending: 500, sent: 12 },
      oldestPendingAt: new Date(NOW.getTime() - порог),
      now: NOW,
    });
    assert.equal(свежая.state, "ok", "ровно на пороге очередь ещё разбирается");

    const вставшая = rowFromOutbox(FACES.notion, {
      counts: { pending: 500, sent: 12 },
      oldestPendingAt: new Date(NOW.getTime() - порог - 60_000),
      now: NOW,
    });
    assert.equal(вставшая.state, "bad");
    assert.match(вставшая.summary, /не разбирается/);
    assert.match(вставшая.summary, /500/);
  });

  it("доставка в тупике (dead) — «сломано», даже когда остальные ушли", () => {
    const row = rowFromOutbox(FACES.notion, {
      counts: { sent: 100, dead: 1 },
      oldestPendingAt: null,
      now: NOW,
    });
    assert.equal(row.state, "bad");
    assert.match(row.summary, /тупик/);
  });

  it("доставка с неизвестным исходом — «сломано»: повтор мог задвоить запись", () => {
    const row = rowFromOutbox(FACES.notion, {
      counts: { sent: 100, unknown: 2 },
      oldestPendingAt: null,
      now: NOW,
    });
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
    // Маршрут читается без токена, а сообщения драйвера несут хост и
    // пользователя базы: наружу — ярлык прочитанного, причина — в журнал.
    const row = unavailableRow(FACES.notion, "очередь доставок");
    assert.equal(row.state, "unknown");
    assert.match(row.summary, /не отвечает/);
    assert.match(row.detail ?? "", /очередь доставок/);
    assert.match(row.detail ?? "", /журнал Core/);
  });
});
