import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENTS_SNAPSHOT_INTERVAL_MS, AGENTS_SNAPSHOT_MISS_LIMIT } from "@mydon/shared";
import { STALE_AFTER_SEC, computeBoard, nextOccurrences, snapshotFreshness, type BoardInput } from "./board";

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
    const j = b.jobs.find((x) => x.id === "vendhub-ops/monitor-stock@0 8 * * *")!;
    assert.equal(j.nextRun, "2026-09-07T03:00:00.000Z");
    assert.equal(j.mode, "legacy");
    assert.equal(j.last?.skipReason, "no_signal");
    assert.equal(j.last?.runId, "r1");
  });

  it("паузу берёт из system_config, а не из снимка; мониторы паузе не подчиняются", () => {
    const b = computeBoard(input);
    assert.deepEqual(b.paused, { schedules: false, tasks: true });
    assert.equal(b.jobs.find((x) => x.id === "vendhub-ops/parts-audit@30 8 * * 1")!.paused, false);
    const paused = computeBoard({ ...input, paused: { schedules: true, tasks: true } });
    assert.equal(paused.jobs.find((x) => x.id === "vendhub-ops/parts-audit@30 8 * * 1")!.paused, true);
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

  it("расписание паузного агента — строка с причиной «агент не активен», а не пустота", () => {
    const b = computeBoard({
      ...input,
      snapshot: {
        ...input.snapshot!,
        payload: {
          ...snapshot,
          notWired: [
            ...snapshot.notWired,
            { agent: "market-analyst", skill: "scan-market", reason: "inactive_agent" as const },
          ],
        },
      },
    });
    const j = b.jobs.find((x) => x.id === "market-analyst/scan-market")!;
    assert.equal(j.enabled, false);
    assert.equal(j.disabledReason, "агент не активен: расписание не запускается");
    assert.equal(j.nextRun, null);
    assert.equal(b.upcoming24h.some((u) => u.jobId === "market-analyst/scan-market"), false);
  });

  it("два расписания одного навыка — две строки с разными id и общим последним исходом", () => {
    // Рантайм дедуплицирует задания по тройке агент+навык+cron, а доска с
    // ключом `агент/навык` склеивала их в один `id`: панель получала
    // повторяющиеся ключи React и не могла связать строку «Ближайшие 24 ч» с
    // нужным расписанием (adversarial-ревью волны R, B4).
    const b = computeBoard({
      ...input,
      snapshot: {
        ...input.snapshot!,
        payload: {
          ...snapshot,
          jobs: [
            { agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" as const },
            { agent: "vendhub-ops", skill: "monitor-stock", cron: "0 20 * * *", mode: "legacy" as const },
          ],
        },
      },
    });
    const rows = b.jobs.filter((x) => x.agent === "vendhub-ops" && x.skill === "monitor-stock");
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((x) => x.id).sort(),
      ["vendhub-ops/monitor-stock@0 20 * * *", "vendhub-ops/monitor-stock@0 8 * * *"],
    );
    assert.equal(new Set(b.jobs.map((x) => x.id)).size, b.jobs.length);
    // Журнал помнит последний прогон навыка, а не расписания: обе строки
    // показывают его, и поиск по `id` строки этот исход терял бы.
    for (const r of rows) assert.equal(r.last?.runId, "r1");
    // У каждой строки — своё ближайшее срабатывание, и обе попадают в сутки.
    assert.equal(b.upcoming24h.some((u) => u.jobId === "vendhub-ops/monitor-stock@0 20 * * *"), true);
    assert.equal(b.upcoming24h.some((u) => u.jobId === "vendhub-ops/monitor-stock@0 8 * * *"), true);
  });

  it("повтор в notWired не даёт двух одинаковых строк", () => {
    // У неподключённого навыка cron не приходит вовсе: различить строки
    // нечем, и повтор в снимке дал бы две одинаковые с одним `id`.
    const b = computeBoard({
      ...input,
      snapshot: {
        ...input.snapshot!,
        payload: {
          ...snapshot,
          notWired: [
            { agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" as const },
            { agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" as const },
          ],
        },
      },
    });
    assert.equal(b.jobs.filter((x) => x.id === "vendhub-ceo/weekly-review").length, 1);
    assert.equal(new Set(b.jobs.map((x) => x.id)).size, b.jobs.length);
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

  it("порог прощает два пропущенных тика, третий подряд — молчание (ревью I-3)", () => {
    // Формула та же, что у heartbeat бота: интервал × лимит пропусков, обе
    // константы общие с рантаймом. Один редеплой Core в момент тика больше не
    // красит слой в «сломано» на пять минут.
    const тик = AGENTS_SNAPSHOT_INTERVAL_MS / 1000;
    assert.equal(STALE_AFTER_SEC, тик * AGENTS_SNAPSHOT_MISS_LIMIT);
    assert.ok(AGENTS_SNAPSHOT_MISS_LIMIT >= 3, "меньше трёх периодов — один пропущенный тик снова ложная авария");
    const дваПропуска = new Date(now.getTime() - (2 * тик + 30) * 1000);
    assert.equal(snapshotFreshness(дваПропуска, now).stale, false, "два пропущенных тика прощаются");
    const триПропуска = new Date(now.getTime() - (3 * тик + 1) * 1000);
    assert.equal(snapshotFreshness(триПропуска, now).stale, true);
  });

  it("снимок: возраст и stale за порогом; без снимка — null и пустые задания", () => {
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

describe("snapshotFreshness — одно правило на доску и здоровье приложений", () => {
  it("ровно на пороге снимок ещё свежий, секундой старше — протух; момент отчёта возвращается как есть", () => {
    // Порог — ИМПОРТИРОВАННАЯ константа, а не число: здоровье приложений
    // (`apps-health.service.ts`) судит о слое агентов той же функцией, и
    // второй порог где-то ещё разошёлся бы с этим молча.
    const наПороге = new Date(now.getTime() - STALE_AFTER_SEC * 1000);
    assert.deepEqual(snapshotFreshness(наПороге, now), { ageSec: STALE_AFTER_SEC, stale: false, reportedAt: наПороге });
    const старше = new Date(now.getTime() - (STALE_AFTER_SEC + 1) * 1000);
    assert.equal(snapshotFreshness(старше, now).stale, true);
    // Часы разъехались (снимок «из будущего») — возраст ноль, а не отрицательный.
    assert.equal(snapshotFreshness(new Date(now.getTime() + 60_000), now).ageSec, 0);
    // Доска считает тем же правилом: подмена числа в одном месте роняет оба.
    const b = computeBoard({ ...input, snapshot: { ...input.snapshot!, updatedAt: старше } });
    assert.equal(b.snapshot?.stale, true);
    assert.equal(b.snapshot?.ageSec, STALE_AFTER_SEC + 1);
  });
});

describe("nextOccurrences", () => {
  it("битый cron → пустой список, не исключение", () => {
    assert.deepEqual(nextOccurrences("99 99 * * *", now, 5), []);
  });
});
