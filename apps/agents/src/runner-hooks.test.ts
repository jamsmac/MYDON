import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tashkentHour } from "@mydon/shared";
import { parseHooks } from "./hooks";
import type { AgentDefinition } from "./registry";
import { runSkill } from "./runner";
import type { SkillRunContext } from "./skills";

/**
 * Хуки вокруг runSkill (волна R, Р-4).
 *
 * Навык берём реальный (`watch-receivables`): важно, что при блоке хуком до
 * него дело НЕ доходит — ни события `agent.run`, ни похода в данные.
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

/**
 * Окно тихих часов, накрывающее «сейчас»: от текущего ташкентского часа на два
 * часа вперёд. Хук берёт `new Date()` — часы в тесте не заморозить, а окно
 * «00:00–00:00» пустое (`to` не включается). Двухчасовой запас снимает
 * зависимость от того, в какую минуту суток идёт прогон тестов.
 */
function quietWindowAroundNow(): { kind: string; from: string; to: string } {
  const h = tashkentHour(new Date());
  const hh = (n: number): string => `${String(n % 24).padStart(2, "0")}:00`;
  return { kind: "quiet_hours", from: hh(h), to: hh(h + 2) };
}

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

describe("runSkill + hooks паспорта", () => {
  it("pre_run блокирует legacy-прогон: skipped/hook_blocked с именем хука, навык не запускался", async () => {
    const { client, calls } = stubCore();
    const agent: AgentDefinition = {
      ...base,
      hooks: parseHooks({ pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }] }).hooks,
    };

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

  it("в task-режиме блок хуком коммитится как no_signal с причиной хука в примечании", async () => {
    const { client } = stubCore();
    const agent: AgentDefinition = {
      ...base,
      hooks: parseHooks({ pre_run: [quietWindowAroundNow()] }).hooks,
    };
    const invocation: SkillRunContext = {
      requestKey: "run-hook-2",
      trigger: "cron",
      task: { saveCheckpoint: async () => { throw new Error("checkpoint не должен сохраняться"); } },
    };

    const res = await runSkill(agent, "watch-receivables", client, "T0", undefined, invocation);

    assert.equal(res.skipReason, "hook_blocked");
    assert.equal(res.hook, "quiet_hours");
    assert.equal(res.commit?.outcome, "no_signal", "Core не знает kind hook_blocked");
    assert.equal(res.commit?.note, `Не запускал: ${res.reason}.`);
  });

  it("ручной запуск с деки проходит сквозь тихие часы", async () => {
    const { client } = stubCore();
    const agent: AgentDefinition = {
      ...base,
      hooks: parseHooks({ pre_run: [quietWindowAroundNow()] }).hooks,
    };

    const res = await runSkill(agent, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-3",
      trigger: "manual",
    });

    assert.equal(res.skipReason, "no_signal", "навык отработал: данных нет, повода нет");
  });

  it("post_run coach_lite прикладывает заметку к результату прогона", async () => {
    const { client } = stubCore({
      listRuns: async () => Array.from({ length: 4 }, () => ({ outcome: "skipped", skipReason: "no_signal", reason: "" })),
    });
    const agent: AgentDefinition = { ...base, hooks: parseHooks({ post_run: [{ kind: "coach_lite" }] }).hooks };

    const res = await runSkill(agent, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-4",
      trigger: "cron",
    });

    assert.equal(res.skipReason, "no_signal");
    assert.match(res.review ?? "", /пять тихих/);
  });

  it("агент без хуков идёт прежним путём — журнал прогонов не дёргается", async () => {
    const { client, calls } = stubCore();
    const res = await runSkill(base, "watch-receivables", client, "T0", undefined, {
      requestKey: "run-hook-5",
      trigger: "cron",
    });
    assert.equal(res.skipReason, "no_signal");
    assert.deepEqual(calls, ["event"]);
  });

  it("неактивный агент не тратит запрос на хуки — прежний skipReason inactive", async () => {
    const { client, calls } = stubCore();
    const agent: AgentDefinition = {
      ...base,
      status: "paused",
      hooks: parseHooks({ pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }] }).hooks,
    };
    const res = await runSkill(agent, "watch-receivables", client, "T0");
    assert.equal(res.skipReason, "inactive");
    assert.deepEqual(calls, []);
  });
});
