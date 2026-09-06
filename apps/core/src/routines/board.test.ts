import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBoard, nextOccurrences, type BoardInput } from "./board";

const now = new Date("2026-09-06T03:10:00.000Z"); // 08:10 Ташкент, суббота
const snapshot = {
  generatedAt: "2026-09-06T03:05:00.000Z",
  tz: "Asia/Tashkent" as const,
  paused: { schedules: true, tasks: true },
  jobs: [
    { agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" as const },
    { agent: "vendhub-ops", skill: "parts-audit", cron: "30 8 * * 1", mode: "durable-task" as const },
  ],
  notWired: [{ agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" as const }],
  monitors: [
    { name: "ourvend:sync", cron: "0 */3 * * *", enabled: true },
    { name: "coffee:monitor", cron: "off", enabled: false, reason: "off" as const },
  ],
};
const input: BoardInput = {
  now,
  snapshot: { payload: snapshot, updatedAt: new Date("2026-09-06T03:05:00.000Z") },
  paused: { schedules: false, tasks: true },
  lastRuns: [
    { agentName: "vendhub-ops", skill: "monitor-stock", startedAt: new Date("2026-09-06T03:00:01.000Z"), outcome: "skipped", skipReason: "no_signal", hook: null, reason: "повода нет", id: "r1" },
  ],
};

describe("computeBoard (R-R-3)", () => {
  it("следующий запуск по Ташкенту: 0 8 * * * после 08:10 → завтра 08:00 (= 03:00Z)", () => {
    const b = computeBoard(input);
    const j = b.jobs.find((x) => x.id === "vendhub-ops/monitor-stock")!;
    assert.equal(j.nextRun, "2026-09-07T03:00:00.000Z");
    assert.equal(j.mode, "legacy");
    assert.equal(j.last?.skipReason, "no_signal");
    assert.equal(j.last?.runId, "r1");
  });

  it("паузу берёт из system_config, а не из снимка; мониторы паузе не подчиняются", () => {
    const b = computeBoard(input);
    assert.deepEqual(b.paused, { schedules: false, tasks: true });
    assert.equal(b.jobs.find((x) => x.id === "vendhub-ops/parts-audit")!.paused, false);
    const paused = computeBoard({ ...input, paused: { schedules: true, tasks: true } });
    assert.equal(paused.jobs.find((x) => x.id === "vendhub-ops/parts-audit")!.paused, true);
    assert.equal(paused.jobs.find((x) => x.id === "system/ourvend:sync")!.paused, false);
    // на паузе задания не попадают в 24 ч, мониторы — попадают
    assert.ok(paused.upcoming24h.every((u) => u.jobId.startsWith("system/")));
  });

  it("не подключённые и выключенные — enabled=false с причиной, nextRun=null, в конце списка", () => {
    const b = computeBoard(input);
    const nw = b.jobs.find((x) => x.id === "vendhub-ceo/weekly-review")!;
    assert.equal(nw.enabled, false);
    assert.match(nw.disabledReason ?? "", /LLM-маршрут/);
    assert.equal(nw.nextRun, null);
    const off = b.jobs.find((x) => x.id === "system/coffee:monitor")!;
    assert.equal(off.enabled, false);
    assert.match(off.disabledReason ?? "", /COFFEE_MONITOR_CRON=off/);
    assert.equal(b.jobs.at(-1)!.enabled, false);
    assert.equal(b.jobs[0]!.enabled, true);
  });

  it("незнакомая причина монитора не теряется: показываем её сырой, а не пустоту", () => {
    // Снимок читается из jsonb: слово, которого нет в словаре, туда попасть
    // может, а «выключен без объяснения» — худший из ответов доски.
    const b = computeBoard({
      ...input,
      snapshot: {
        ...input.snapshot!,
        payload: { ...snapshot, monitors: [{ name: "ourvend:sync", cron: "off", enabled: false, reason: "потом" as never }] },
      },
    });
    const j = b.jobs.find((x) => x.id === "system/ourvend:sync")!;
    assert.equal(j.enabled, false);
    assert.equal(j.disabledReason, "потом");
  });

  it("ближайшие 24 ч: */3 даёт 8 срабатываний, отсортировано, лимит 200", () => {
    const b = computeBoard(input);
    const sync = b.upcoming24h.filter((u) => u.jobId === "system/ourvend:sync");
    assert.equal(sync.length, 8);
    assert.equal(sync[0]!.at, "2026-09-06T04:00:00.000Z"); // 09:00 Ташкент
    for (let i = 1; i < b.upcoming24h.length; i += 1) assert.ok(b.upcoming24h[i - 1]!.at <= b.upcoming24h[i]!.at);
    const flood = computeBoard({ ...input, snapshot: { ...input.snapshot!, payload: { ...snapshot, monitors: [{ name: "x", cron: "* * * * *", enabled: true }] } } });
    assert.equal(flood.upcoming24h.length, 200);
  });

  it("снимок: возраст и stale > 900 с; без снимка — null и пустые задания", () => {
    const b = computeBoard(input);
    assert.equal(b.snapshot?.ageSec, 300);
    assert.equal(b.snapshot?.stale, false);
    const old = computeBoard({ ...input, snapshot: { ...input.snapshot!, updatedAt: new Date("2026-09-06T02:00:00.000Z") } });
    assert.equal(old.snapshot?.stale, true);
    const none = computeBoard({ ...input, snapshot: null });
    assert.equal(none.snapshot, null);
    assert.equal(none.jobs.length, 0);
  });
});

describe("nextOccurrences", () => {
  it("битый cron → пустой список, не исключение", () => {
    assert.deepEqual(nextOccurrences("99 99 * * *", now, 5), []);
  });
});
