import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScheduleSnapshot, type MonitorState } from "./schedule-snapshot";

describe("buildScheduleSnapshot (R-R-2)", () => {
  it("собирает задания, не подключённые с причиной и мониторы", () => {
    const s = buildScheduleSnapshot({
      now: new Date("2026-09-06T03:00:00.000Z"),
      jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *" }],
      modeOf: () => "legacy",
      notWired: ["vendhub-ceo/weekly-review", "x/y"],
      inactive: ["market-analyst/scan-market"],
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
      // Паузный агент до `desiredJobs` не доходит: без отдельной ветки его
      // расписание не имело бы на доске ни строки, ни причины.
      { agent: "market-analyst", skill: "scan-market", reason: "inactive_agent" },
    ]);
    assert.equal(s.monitors[1]!.reason, "no_credentials");
    assert.deepEqual(s.paused, { schedules: true, tasks: false });
  });
});

/** Ловим предупреждения снимка: они часть поведения, а не шум в выводе тестов. */
function withWarnings<T>(fn: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (m: string) => {
    warnings.push(String(m));
  };
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = orig;
  }
}

const BASE = {
  now: new Date("2026-09-06T03:00:00.000Z"),
  notWired: [] as string[],
  inactive: [] as string[],
  isLlmSkill: () => false,
  monitors: [] as MonitorState[],
  paused: { schedules: false, tasks: false },
};

describe("buildScheduleSnapshot терпит порчу одного задания (Р-2)", () => {
  it("битое расписание выкидывает ОДНО задание, остальные доезжают", () => {
    // Core проверяет каждый cron и на битом отвечает 400 на весь снимок:
    // одно кривое задание оставило бы владельца вообще без доски.
    const { result, warnings } = withWarnings(() =>
      buildScheduleSnapshot({
        ...BASE,
        jobs: [
          { agent: "a", skill: "bad", cron: "99 99 * * *" },
          { agent: "a", skill: "good", cron: "0 8 * * *" },
        ],
        modeOf: () => "legacy",
      }),
    );
    assert.deepEqual(result.jobs, [
      { agent: "a", skill: "good", cron: "0 8 * * *", mode: "legacy" },
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /a\/bad/);
    assert.match(warnings[0]!, /99 99 \* \* \*/);
  });

  it("modeOf бросил — у ЭТОГО задания legacy, соседнее не теряет свой режим", () => {
    const { result, warnings } = withWarnings(() =>
      buildScheduleSnapshot({
        ...BASE,
        jobs: [
          { agent: "a", skill: "metered", cron: "0 8 * * *" },
          { agent: "a", skill: "llm", cron: "0 9 * * *" },
        ],
        modeOf: (skill) => {
          if (skill === "metered") throw new Error("Metered scheduled skill metered is blocked");
          return "durable-task";
        },
      }),
    );
    assert.deepEqual(result.jobs, [
      { agent: "a", skill: "metered", cron: "0 8 * * *", mode: "legacy" },
      { agent: "a", skill: "llm", cron: "0 9 * * *", mode: "durable-task" },
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /metered.*legacy/s);
  });

  it("включённый монитор с битым расписанием показывается выключенным, а не рушит снимок", () => {
    const { result, warnings } = withWarnings(() =>
      buildScheduleSnapshot({
        ...BASE,
        jobs: [],
        modeOf: () => "legacy",
        monitors: [
          { name: "fx:refresh", cron: "каждый вторник", enabled: true },
          { name: "ourvend:sync", cron: "off", enabled: false, reason: "off" },
        ],
      }),
    );
    assert.deepEqual(result.monitors[0], {
      name: "fx:refresh",
      cron: "каждый вторник",
      enabled: false,
      reason: "off",
    });
    // Выключенный монитор с cron «off» валидировать нельзя — Core его и не проверяет.
    assert.deepEqual(result.monitors[1], {
      name: "ourvend:sync",
      cron: "off",
      enabled: false,
      reason: "off",
    });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /fx:refresh/);
  });
});
