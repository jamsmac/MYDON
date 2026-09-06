import { describe, expect, it } from "vitest";
import type { CronBoard } from "./core";
import { dayLabel, describeLast, groupUpcoming, hhmm, outcomeTone } from "./crons";

const board: CronBoard = {
  tz: "Asia/Tashkent", now: "2026-09-06T03:10:00.000Z",
  snapshot: { generatedAt: "2026-09-06T03:05:00.000Z", ageSec: 300, stale: false },
  paused: { schedules: false, tasks: true },
  jobs: [
    { id: "system/ourvend:sync", kind: "monitor", agent: "system", skill: "ourvend:sync", cron: "0 */3 * * *", mode: "monitor", enabled: true, paused: false, nextRun: "2026-09-06T04:00:00.000Z", last: { at: "2026-09-06T01:00:00.000Z", outcome: "executed", skipReason: null, hook: null, reason: "автоматов 26/26", runId: "r1" } },
    { id: "vendhub-ops/monitor-stock", kind: "skill", agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy", enabled: true, paused: false, nextRun: "2026-09-07T03:00:00.000Z", last: null },
  ],
  upcoming24h: [
    { at: "2026-09-06T04:00:00.000Z", jobId: "system/ourvend:sync" },
    { at: "2026-09-06T19:00:00.000Z", jobId: "system/ourvend:sync" },   // 00:00 завтра по Ташкенту
    { at: "2026-09-07T03:00:00.000Z", jobId: "vendhub-ops/monitor-stock" },
  ],
};

describe("groupUpcoming", () => {
  it("делит на сегодня/завтра по Ташкенту и подставляет задание", () => {
    const g = groupUpcoming(board, new Date(board.now));
    expect(g.today.map((r) => r.time)).toEqual(["09:00"]);
    expect(g.tomorrow.map((r) => r.time)).toEqual(["00:00", "08:00"]);
    expect(g.tomorrow[1]!.job.id).toBe("vendhub-ops/monitor-stock");
  });

  it("срабатывание без задания в доске пропускается, а не рисует пустую строку", () => {
    // Снимок расписаний и журнал живут врозь: задание могло исчезнуть между
    // сборкой `upcoming24h` и списком `jobs`. Строка без задания показала бы
    // владельцу время запуска, о котором нечего сказать.
    const g = groupUpcoming({ ...board, upcoming24h: [{ at: "2026-09-06T04:00:00.000Z", jobId: "нет/такого" }] }, new Date(board.now));
    expect(g.today).toEqual([]);
    expect(g.tomorrow).toEqual([]);
  });
});

describe("outcomeTone / describeLast", () => {
  it("цвета по исходу; без прогона — muted и «ещё не запускался»", () => {
    expect(outcomeTone({ outcome: "executed" })).toBe("ok");
    expect(outcomeTone({ outcome: "approval_requested" })).toBe("warn");
    expect(outcomeTone({ outcome: "skipped" })).toBe("muted");
    expect(outcomeTone({ outcome: "failed" })).toBe("hot");
    expect(outcomeTone(null)).toBe("muted");
    expect(describeLast(null)).toBe("ещё не запускался");
    expect(describeLast(board.jobs[0]!.last)).toBe("выполнено — автоматов 26/26");
  });

  it("исход не из словаря показывается причиной, а не пустотой", () => {
    // Журнал Core валидирует исходы, но панель переживает и чужую запись:
    // упасть на неизвестном слове значило бы потерять всю доску.
    expect(describeLast({ at: "2026-09-06T01:00:00.000Z", outcome: "cancelled", skipReason: null, hook: null, reason: "остановлено вручную", runId: "r9" })).toBe("остановлено вручную");
  });

  it("остановку хуком объясняет именем хука", () => {
    expect(describeLast({ at: "2026-09-06T01:00:00.000Z", outcome: "skipped", skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы 22:00–07:00", runId: "r8" })).toBe("остановлено хуком quiet_hours — тихие часы 22:00–07:00");
  });
});

describe("hhmm", () => {
  it("по Ташкенту", () => {
    expect(hhmm("2026-09-06T03:00:00.000Z")).toBe("08:00");
  });
});

describe("dayLabel", () => {
  it("«сегодня»/«завтра», дальше — дата: строка вне заголовка дня должна называть день сама", () => {
    const now = new Date(board.now);
    expect(dayLabel("2026-09-06T04:00:00.000Z", now)).toBe("сегодня");
    expect(dayLabel("2026-09-07T03:00:00.000Z", now)).toBe("завтра");
    expect(dayLabel("2026-09-09T03:00:00.000Z", now)).toBe("09.09");
  });
});
