import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScheduleSnapshot } from "./schedule-snapshot";

describe("buildScheduleSnapshot (R-R-2)", () => {
  it("собирает задания, не подключённые с причиной и мониторы", () => {
    const s = buildScheduleSnapshot({
      now: new Date("2026-09-06T03:00:00.000Z"),
      jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *" }],
      modeOf: () => "legacy",
      notWired: ["vendhub-ceo/weekly-review", "x/y"],
      isLlmSkill: (skill) => skill === "weekly-review",
      monitors: [{ name: "fx:refresh", cron: "5 9 * * *", enabled: true }, { name: "ourvend:sync", cron: "0 */3 * * *", enabled: false, reason: "no_credentials" }],
      paused: { schedules: true, tasks: false },
    });
    assert.equal(s.tz, "Asia/Tashkent");
    assert.equal(s.generatedAt, "2026-09-06T03:00:00.000Z");
    assert.deepEqual(s.jobs, [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" }]);
    assert.deepEqual(s.notWired, [
      { agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" },
      { agent: "x", skill: "y", reason: "no_implementation" },
    ]);
    assert.equal(s.monitors[1]!.reason, "no_credentials");
    assert.deepEqual(s.paused, { schedules: true, tasks: false });
  });
});
