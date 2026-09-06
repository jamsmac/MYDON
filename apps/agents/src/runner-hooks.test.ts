import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentTaskCheckpoint } from "./core-client";
import { parseHooks } from "./hooks";
import type { AgentDefinition } from "./registry";
import { runSkill } from "./runner";
import type { SkillRunContext, TaskSkillCheckpointDraft } from "./skills";

/**
 * Хуки вокруг runSkill (волна R, Р-4).
 *
 * Навык берём реальный (`watch-receivables`): важно, что при блоке хуком до
 * него дело НЕ доходит — ни события `agent.run`, ни похода в данные.
 * Блокирующий хук везде `source_fresh` с пустым журналом: он не зависит от
 * времени суток, поэтому тест не протухает к ночи.
 */
const base: AgentDefinition = {
  name: "hooked-agent",
  business: "globerent",
  status: "active",
  autonomyDefault: "T1",
  schedule: [],
  skills: ["watch-receivables"],
  dir: "/tmp",
};

const BLOCKING = parseHooks({
  pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }],
}).hooks;

/** Заглушка Core: пустые данные + журнал прогонов, который отвечает по сценарию. */
function stubCore(over: Record<string, unknown> = {}) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      recordEvent: async () => {
        calls.push("event");
      },
      requestApproval: async () => {
        calls.push("approval");
        return { id: "appr-1" };
      },
      briefing: async () => ({
        overdueMoney: 0,
        idleMachines: 0,
        pendingApprovals: 0,
        contractsDueSoon: 0,
        contractsBadDate: 0,
        overdueTasks: 0,
      }),
      obligations: async () => ({
        domain: "globerent",
        totals: [],
        overdue: [],
        overdueTotal: 0,
        overdueTruncated: false,
      }),
      entities: async () => [],
      recallMemory: async () => null,
      rememberMemory: async () => undefined,
      lastRun: async () => {
        calls.push("lastRun");
        return null;
      },
      listRuns: async () => {
        calls.push("listRuns");
        return [];
      },
      ...over,
    } as never,
  };
}

/** Task-режим: собираем сохранённые чекпойнты, чтобы проверить порядок «чекпойнт → коммит». */
function taskContext(saved: TaskSkillCheckpointDraft[], checkpoint?: AgentTaskCheckpoint) {
  return {
    ...(checkpoint !== undefined ? { checkpoint } : {}),
    saveCheckpoint: async (draft: TaskSkillCheckpointDraft) => {
      saved.push(draft);
      return { id: "cp-1", skill: draft.skill, kind: draft.kind } as AgentTaskCheckpoint;
    },
  };
}

describe("runSkill + hooks паспорта", () => {
  it("pre_run блокирует плановый прогон: skipped/hook_blocked с именем хука, навык не запускался", async () => {
    const { client, calls } = stubCore();
    const agent: AgentDefinition = { ...base, hooks: BLOCKING };

    const res = await runSkill(agent, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-1",
      trigger: "cron",
    });

    assert.equal(res.outcome, "skipped");
    assert.equal(res.skipReason, "hook_blocked");
    assert.equal(res.hook, "source_fresh");
    assert.match(res.reason, /ещё не отработал успешно/);
    assert.equal(res.commit, undefined, "не task-режим — коммитить нечего");
    assert.deepEqual(calls, ["lastRun"], "до события agent.run и до навыка дело не дошло");
  });

  it("прогон без trigger считается плановым — хук всё равно охраняет", async () => {
    const { client, calls } = stubCore();
    const res = await runSkill({ ...base, hooks: BLOCKING }, "watch-receivables", client, "T0");
    assert.equal(res.skipReason, "hook_blocked");
    assert.deepEqual(calls, ["lastRun"]);
  });

  it("в task-режиме блок хуком сначала пишет чекпойнт no_signal, потом коммитит его же", async () => {
    const { client } = stubCore();
    const saved: TaskSkillCheckpointDraft[] = [];
    let leases = 0;
    const invocation: SkillRunContext = {
      requestKey: "run-hook-2",
      trigger: "cron", // durable-задача из agent-schedule — тоже плановый прогон
      assertLease: async () => {
        leases += 1;
      },
      task: taskContext(saved),
    };

    const res = await runSkill({ ...base, hooks: BLOCKING }, "watch-receivables", client, "T0", undefined, invocation);

    assert.deepEqual(saved, [{ skill: "watch-receivables", kind: "no_signal" }]);
    assert.equal(leases, 1, "чекпойнт пишется только под живым lease");
    assert.equal(res.skipReason, "hook_blocked");
    assert.equal(res.hook, "source_fresh");
    assert.equal(res.commit?.outcome, "no_signal", "Core не знает kind hook_blocked");
    assert.equal(res.commit?.note, `Не запускал: ${res.reason}.`);
  });

  it("сбой записи чекпойнта всплывает наверх, а не превращается в тихий пропуск", async () => {
    const { client } = stubCore();
    const invocation: SkillRunContext = {
      requestKey: "run-hook-2b",
      trigger: "cron",
      task: {
        saveCheckpoint: async () => {
          throw new Error("Core недоступен");
        },
      },
    };
    await assert.rejects(
      runSkill({ ...base, hooks: BLOCKING }, "watch-receivables", client, "T0", undefined, invocation),
      /Core недоступен/,
    );
  });

  it("поручение владельца (task) и запуск с деки (manual) проходят мимо pre_run", async () => {
    for (const trigger of ["task", "manual"] as const) {
      const { client, calls } = stubCore();
      const res = await runSkill({ ...base, hooks: BLOCKING }, "watch-receivables", client, "T0", undefined, {
        requestKey: `run-hook-3-${trigger}`,
        trigger,
      });
      assert.equal(res.skipReason, "no_signal", `${trigger}: навык отработал, данных нет — повода нет`);
      assert.ok(!calls.includes("lastRun"), `${trigger}: журнал прогонов не спрашивали`);
    }
  });

  it("возобновление задачи по чекпойнту идёт мимо pre_run — хук охраняет старт, а не takeover", async () => {
    const { client, calls } = stubCore();
    const saved: TaskSkillCheckpointDraft[] = [];
    const checkpoint: AgentTaskCheckpoint = { id: "cp-0", skill: "watch-receivables", kind: "no_signal" };

    const res = await runSkill({ ...base, hooks: BLOCKING }, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-4",
      trigger: "cron",
      task: taskContext(saved, checkpoint),
    });

    assert.equal(res.skipReason, "no_signal", "результат взят из чекпойнта");
    assert.deepEqual(calls, [], "ни журнала прогонов, ни события — takeover ничего не пересчитывает");
    assert.deepEqual(saved, [], "чужой чекпойнт не переписываем");
  });

  it("post_run coach_lite прикладывает заметку к результату прогона", async () => {
    const { client } = stubCore({
      listRuns: async () => Array.from({ length: 4 }, () => ({ outcome: "skipped", skipReason: "no_signal", reason: "" })),
    });
    const agent: AgentDefinition = { ...base, hooks: parseHooks({ post_run: [{ kind: "coach_lite" }] }).hooks };

    const res = await runSkill(agent, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-5",
      trigger: "cron",
    });

    assert.equal(res.skipReason, "no_signal");
    assert.match(res.review ?? "", /пять тихих/);
  });

  it("агент без хуков идёт прежним путём — журнал прогонов не дёргается", async () => {
    const { client, calls } = stubCore();
    const res = await runSkill(base, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-6",
      trigger: "cron",
    });
    assert.equal(res.skipReason, "no_signal");
    assert.deepEqual(calls, ["event"]);
  });

  it("неактивный агент не тратит запрос ни на pre_run, ни на post_run", async () => {
    const { client, calls } = stubCore();
    const agent: AgentDefinition = {
      ...base,
      status: "paused",
      hooks: parseHooks({
        pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }],
        post_run: [{ kind: "coach_lite" }],
      }).hooks,
    };
    const res = await runSkill(agent, "watch-receivables", client, "T0");
    assert.equal(res.skipReason, "inactive");
    assert.deepEqual(calls, []);
  });
});
