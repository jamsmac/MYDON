import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAgentState, type AgentStateInput, type ClaimedTaskLite } from "./agent-state";

/** Лиза захвата задачи — та же константа, что у `TasksService.claimAgentRun`. */
const LEASE_MS = 15 * 60_000;
const NOW = new Date("2026-09-06T09:00:00.000Z");

function input(over: Partial<AgentStateInput> = {}): AgentStateInput {
  return {
    passportStatus: "active",
    archivedAt: null,
    claimedTasks: [],
    lastRun: null,
    paused: { tasks: false, schedules: false },
    now: NOW,
    leaseMs: LEASE_MS,
    ...over,
  };
}

/** Задача агента в работе: по умолчанию захвачена минуту назад, не заблокирована. */
function task(over: Partial<ClaimedTaskLite> = {}): ClaimedTaskLite {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    skill: "parts-audit",
    claimedAt: new Date(NOW.getTime() - 60_000),
    blockedAt: null,
    blockedReason: null,
    ...over,
  };
}

describe("Состояние агента словами (R-A2-1, решения Р-1 и Р-2)", () => {
  it("работает: у агента задача с живым claim, и причина называет навык", () => {
    const claimedAt = new Date(NOW.getTime() - 60_000);
    const verdict = computeAgentState(input({ claimedTasks: [task({ claimedAt })] }));
    assert.equal(verdict.state, "working");
    assert.match(verdict.reason, /parts-audit/, "иначе владелец не поймёт, чем агент занят");
    assert.deepEqual(verdict.since, claimedAt, "«работает с» — момент захвата задачи");
    assert.equal(verdict.taskId, "11111111-1111-4111-8111-111111111111");
    assert.equal(verdict.skill, "parts-audit");
  });

  it("claim протух: это не «работает», а «молчит» с истёкшим lease", () => {
    // Ровно на границе задача уже свободна: `claimAgentRun` берёт её по
    // `claimed_at <= now - lease`. Свой знак сравнения здесь развёл бы
    // показ с тем, что реально делает worker.
    const граница = new Date(NOW.getTime() - LEASE_MS);
    for (const claimedAt of [граница, new Date(граница.getTime() - 60_000)]) {
      const verdict = computeAgentState(input({ claimedTasks: [task({ claimedAt })] }));
      assert.equal(verdict.state, "idle", `claim от ${claimedAt.toISOString()} не должен считаться работой`);
      assert.match(verdict.reason, /lease истёк/);
      assert.match(verdict.reason, /parts-audit/, "названо, какой именно навык завис");
      assert.deepEqual(verdict.since, claimedAt);
    }
  });

  it("заблокирован: задача остановлена Core, и причина цитирует запись Core", () => {
    const blockedAt = new Date(NOW.getTime() - 3_600_000);
    const verdict = computeAgentState(
      input({
        claimedTasks: [
          task({
            claimedAt: null,
            blockedAt,
            blockedReason: "execution_unknown: исход предыдущей metered-попытки неизвестен",
          }),
        ],
      }),
    );
    assert.equal(verdict.state, "blocked");
    assert.match(verdict.reason, /execution_unknown/, "цитата Core — единственное, что объясняет затык");
    assert.match(verdict.reason, /parts-audit/);
    assert.deepEqual(verdict.since, blockedAt);
    assert.equal(verdict.taskId, "11111111-1111-4111-8111-111111111111");
  });

  it("заблокирован без записанной причины: сказано, что Core её не оставил, а не пусто", () => {
    const verdict = computeAgentState(
      input({ claimedTasks: [task({ claimedAt: null, blockedAt: NOW, blockedReason: null })] }),
    );
    assert.equal(verdict.state, "blocked");
    assert.match(verdict.reason, /причина не записана/);
  });

  it("заблокирован по последнему прогону: задач нет, а прогон упал", () => {
    const at = new Date(NOW.getTime() - 7_200_000);
    const verdict = computeAgentState(
      input({ lastRun: { at, outcome: "failed", skipReason: null, reason: "провайдер вернул 500" } }),
    );
    assert.equal(verdict.state, "blocked");
    assert.match(verdict.reason, /последний прогон/, "названо, откуда вывод: журнал прогонов");
    assert.match(verdict.reason, /провайдер вернул 500/);
    assert.deepEqual(verdict.since, at);
  });

  it("живая задача важнее упавшего прошлого прогона: агент работает, а не «заблокирован»", () => {
    // Упавший прогон — история; живой claim — «прямо сейчас». Обратный порядок
    // показал бы затык у агента, который в эту минуту работает.
    const verdict = computeAgentState(
      input({
        claimedTasks: [task()],
        lastRun: { at: new Date(NOW.getTime() - 7_200_000), outcome: "failed", skipReason: null, reason: "упал" },
      }),
    );
    assert.equal(verdict.state, "working");
  });

  it("затык старше текущего claim не перекрывает работу", () => {
    // Неразобранный затык недельной давности иначе навсегда показывал бы агента
    // заблокированным, пока тот в эту минуту выполняет другую задачу.
    const verdict = computeAgentState(
      input({
        claimedTasks: [
          task({
            id: "старая",
            skill: "stale-block",
            claimedAt: null,
            blockedAt: new Date(NOW.getTime() - 7 * 86_400_000),
            blockedReason: "execution_unknown: нужен owner retry",
          }),
          task({ id: "текущая", skill: "parts-audit", claimedAt: new Date(NOW.getTime() - 60_000) }),
        ],
      }),
    );
    assert.equal(verdict.state, "working");
    assert.equal(verdict.taskId, "текущая");
    assert.match(verdict.reason, /parts-audit/);
    // Хвост не исчезает с экрана: затык всё ещё ждёт разбора.
    assert.match(verdict.reason, /прежний затык Core не разобран/);
    assert.match(verdict.reason, /stale-block/);
  });

  it("затык текущей задачи перекрывает работу", () => {
    // Та же задача: claim жив, но Core уже остановил исполнение — это затык.
    const свой = computeAgentState(
      input({
        claimedTasks: [
          task({
            claimedAt: new Date(NOW.getTime() - 60_000),
            blockedAt: new Date(NOW.getTime() - 30_000),
            blockedReason: "workflow_changed: нужен owner retry",
          }),
        ],
      }),
    );
    assert.equal(свой.state, "blocked");
    assert.match(свой.reason, /workflow_changed/);

    // Другая задача, но затык НОВЕЕ живого claim: агент упёрся в него сейчас.
    const свежий = computeAgentState(
      input({
        claimedTasks: [
          task({ id: "текущая", skill: "parts-audit", claimedAt: new Date(NOW.getTime() - 300_000) }),
          task({
            id: "свежий-затык",
            skill: "stock-watch",
            claimedAt: null,
            blockedAt: new Date(NOW.getTime() - 60_000),
            blockedReason: "skill_failed: нужен owner retry",
          }),
        ],
      }),
    );
    assert.equal(свежий.state, "blocked");
    assert.equal(свежий.taskId, "свежий-затык");
  });

  it("на паузе по паспорту: причина называет статус карточки", () => {
    for (const status of ["paused", "draft", "deprecated"]) {
      const verdict = computeAgentState(input({ passportStatus: status, claimedTasks: [task()] }));
      assert.equal(verdict.state, "paused", `статус ${status} — не работа`);
      assert.match(verdict.reason, new RegExp(status), "иначе непонятно, что менять в карточке");
    }
    // Незнакомый статус тоже не работа: молчаливый `active` соврал бы.
    const чужой = computeAgentState(input({ passportStatus: "sleeping" }));
    assert.equal(чужой.state, "paused");
    assert.match(чужой.reason, /sleeping/);
  });

  it("системная пауза задач НЕ гасит агента с живым claim: он работает (перепроверка прода, корень 1)", () => {
    // Рантайм гейтит очереди разными тумблерами: пауза задач останавливает
    // только новые claim'ы ПОРУЧЕННЫХ задач, а cron-задачи идут
    // (`pollTaskQueue("scheduled", schedulesPaused)` против
    // `pollTaskQueue("assigned", tasksPaused)`). Прежнее правило возвращало
    // «на паузе» каждому агенту ДО проверки claim — и на проде (tasks=1,
    // schedules=0) тринадцать серых плиток стояли над работающими агентами.
    const сПаузой = computeAgentState(
      input({ paused: { tasks: true, schedules: false }, claimedTasks: [task()] }),
    );
    const безПаузы = computeAgentState(
      input({ paused: { tasks: false, schedules: false }, claimedTasks: [task()] }),
    );
    assert.equal(сПаузой.state, "working");
    assert.match(сПаузой.reason, /parts-audit/);
    assert.deepEqual(сПаузой, безПаузы, "живой claim — работа, что бы ни говорил тумблер");
  });

  it("системная пауза задач НЕ прячет затык: остановленная Core задача и упавший прогон — «затык»", () => {
    // На проде cron-задача llm-навыка, остановленная Core (`skill_failed`,
    // `execution_unknown`), пряталась за «на паузе» — самым спокойным
    // состоянием плитки. Затык — поломка, которую надо разбирать; тумблер её
    // не разбирает.
    const blockedAt = new Date(NOW.getTime() - 3_600_000);
    const остановлен = computeAgentState(
      input({
        paused: { tasks: true, schedules: false },
        claimedTasks: [
          task({ claimedAt: null, blockedAt, blockedReason: "skill_failed: ответ не по контракту, нужен owner retry" }),
        ],
      }),
    );
    assert.equal(остановлен.state, "blocked");
    assert.match(остановлен.reason, /skill_failed/);
    assert.deepEqual(остановлен.since, blockedAt);

    const at = new Date(NOW.getTime() - 7_200_000);
    const упал = computeAgentState(
      input({
        paused: { tasks: true, schedules: false },
        lastRun: { at, outcome: "failed", skipReason: null, reason: "провайдер вернул 500" },
      }),
    );
    assert.equal(упал.state, "blocked");
    assert.match(упал.reason, /провайдер вернул 500/);
  });

  it("системная пауза задач без занятости и затыка — «на паузе» с причиной про настройку", () => {
    // Только когда об агенте больше нечего сказать: ни claim, ни затыка. Причина
    // называет, ЧТО остановлено (назначенные задачи) и чего пауза не трогает
    // (cron-прогоны) — иначе плитка спорила бы с «Ближайшими 24 ч» рядом.
    const at = new Date(NOW.getTime() - 3_600_000);
    const прогоны = [
      null,
      { at, outcome: "executed", skipReason: null, reason: "сделано" },
      { at, outcome: "skipped", skipReason: "no_signal", reason: "предлагать нечего" },
    ];
    for (const lastRun of прогоны) {
      const verdict = computeAgentState(input({ paused: { tasks: true, schedules: false }, lastRun }));
      assert.equal(verdict.state, "paused", `с прогоном ${lastRun?.outcome ?? "нет"} — всё равно пауза`);
      assert.match(verdict.reason, /настройка системы, а не агента/);
      assert.match(verdict.reason, /назначенные задачи на паузе/);
      assert.match(verdict.reason, /cron-прогоны этой паузой не остановлены/);
      assert.equal(verdict.since, undefined, "«с каких пор» у настройки системы неизвестно");
    }
  });

  it("оборванный claim под системной паузой задач не прячется: «lease истёк» важнее тумблера", () => {
    // Задача in_progress с протухшим claim — упавший worker, факт об ЭТОМ
    // агенте; «на паузе» сверху скрыл бы его до снятия тумблера.
    const claimedAt = new Date(NOW.getTime() - LEASE_MS - 60_000);
    const verdict = computeAgentState(
      input({ paused: { tasks: true, schedules: false }, claimedTasks: [task({ claimedAt })] }),
    );
    assert.equal(verdict.state, "idle");
    assert.match(verdict.reason, /lease истёк/);
    assert.deepEqual(verdict.since, claimedAt);
  });

  it("порядок правил закреплён целиком: паспортная пауза выше занятости, занятость выше тумблера", () => {
    // Паспортная пауза — выключатель самого агента: он выше всего, кроме архива,
    // и тумблер системы его не меняет.
    const паспорт = computeAgentState(
      input({ passportStatus: "paused", paused: { tasks: true, schedules: true }, claimedTasks: [task()] }),
    );
    assert.equal(паспорт.state, "paused");
    assert.match(паспорт.reason, /статус paused/);
    // Оба тумблера включены, claim живой — всё равно работа, и вердикт байт в
    // байт тот же, что без тумблеров: настройка системы в вердикт не течёт.
    const работа = computeAgentState(input({ paused: { tasks: true, schedules: true }, claimedTasks: [task()] }));
    assert.deepEqual(работа, computeAgentState(input({ claimedTasks: [task()] })));
  });

  it("пауза расписаний занятость по задачам не гасит: это разные тумблеры", () => {
    const verdict = computeAgentState(input({ paused: { tasks: false, schedules: true }, claimedTasks: [task()] }));
    assert.equal(verdict.state, "working");
  });

  it("пауза расписаний НЕ становится состоянием и молчащего агента (круг починок, C-4)", () => {
    // Решение круга починок: `schedules` сознательно не участвует в вердикте —
    // назначенную задачу агент возьмёт и при выключенных расписаниях, и
    // четвёртый `paused` показал бы «на паузе» у работающего. Молчание же
    // объясняется своей причиной, а про саму настройку говорят ОБА экрана
    // отдельной строкой (сетка на главной и карточка агента с расписанием).
    const at = new Date(NOW.getTime() - 3_600_000);
    const молчит = { at, outcome: "executed", skipReason: null, reason: "сделано" };
    const сПаузой = computeAgentState(input({ paused: { tasks: false, schedules: true }, lastRun: молчит }));
    const безПаузы = computeAgentState(input({ paused: { tasks: false, schedules: false }, lastRun: молчит }));
    assert.equal(сПаузой.state, "idle");
    assert.deepEqual(сПаузой, безПаузы, "вердикт от тумблера расписаний зависеть не должен");
  });

  it("молчит: активен, задач нет, последний прогон пропущен — повода не было", () => {
    const at = new Date(NOW.getTime() - 1_800_000);
    const verdict = computeAgentState(
      input({ lastRun: { at, outcome: "skipped", skipReason: "no_signal", reason: "предлагать нечего" } }),
    );
    assert.equal(verdict.state, "idle");
    assert.match(verdict.reason, /повода нет/, "слово из общего словаря исходов, а не второе объяснение");
    assert.match(verdict.reason, /последний прогон/);
    assert.deepEqual(verdict.since, at);
  });

  it("молчит без прогонов вовсе: «ещё не запускался», а не «всё спокойно»", () => {
    const verdict = computeAgentState(input());
    assert.equal(verdict.state, "idle");
    assert.match(verdict.reason, /ещё не запускался/);
    assert.equal(verdict.since, undefined, "«с каких пор» тут неизвестно — врать нечем");
  });

  it("архивный агент не работает даже с живым claim: архив старше всех правил", () => {
    const archivedAt = new Date("2026-08-01T00:00:00.000Z");
    const verdict = computeAgentState(input({ archivedAt, claimedTasks: [task()] }));
    assert.equal(verdict.state, "paused");
    assert.match(verdict.reason, /в архиве/);
    assert.deepEqual(verdict.since, archivedAt);
  });

  it("из нескольких задач берётся самая ранняя: «с каких пор» не должно скакать", () => {
    const рано = new Date(NOW.getTime() - 300_000);
    const поздно = new Date(NOW.getTime() - 60_000);
    const работа = computeAgentState(
      input({
        claimedTasks: [
          task({ id: "b", skill: "late", claimedAt: поздно }),
          task({ id: "a", skill: "early", claimedAt: рано }),
        ],
      }),
    );
    assert.equal(работа.skill, "early");
    assert.deepEqual(работа.since, рано);

    const затык = computeAgentState(
      input({
        claimedTasks: [
          task({ id: "b", skill: "late", claimedAt: null, blockedAt: поздно, blockedReason: "второй" }),
          task({ id: "a", skill: "early", claimedAt: null, blockedAt: рано, blockedReason: "первый" }),
        ],
      }),
    );
    assert.equal(затык.state, "blocked");
    assert.match(затык.reason, /первый/);
    assert.deepEqual(затык.since, рано);
  });

  it("задача без навыка не роняет фразу: сказано, что навык не указан", () => {
    const verdict = computeAgentState(input({ claimedTasks: [task({ skill: null })] }));
    assert.equal(verdict.state, "working");
    assert.match(verdict.reason, /навык не указан/);
    assert.equal(verdict.skill, undefined);
  });
});
