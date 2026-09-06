import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journalFromRunResult, reportRun, type RunJournalEntry } from "./run-journal";

const entry: RunJournalEntry = {
  agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
  scheduledAt: "2026-09-06T03:00:00.000Z", requestKey: "k1", startedAt: "2026-09-06T03:00:01.000Z",
  finishedAt: "2026-09-06T03:00:02.000Z", outcome: "skipped", skipReason: "no_signal", reason: "повода нет",
};

describe("reportRun — журнал никогда не блокирует навык (Р-1)", () => {
  it("успех → один вызов Core", async () => {
    const calls: unknown[] = [];
    const core = { reportRun: async (e: unknown) => { calls.push(e); return { id: "r", created: true }; } };
    await reportRun(core, entry);
    assert.equal(calls.length, 1);
  });
  it("ошибка Core → warn, без исключения", async () => {
    const warns: string[] = [];
    const orig = console.warn; console.warn = (m: string) => { warns.push(String(m)); };
    try {
      await reportRun({ reportRun: async () => { throw new Error("ECONNREFUSED"); } }, entry);
    } finally { console.warn = orig; }
    assert.equal(warns.length, 1);
    assert.match(warns[0]!, /\[journal\]/);
  });
});

describe("journalFromRunResult", () => {
  const started = new Date("2026-09-06T03:00:01.000Z");
  it("skipped + hook → hook_blocked с именем хука; approvalId/action переносятся", () => {
    const e = journalFromRunResult(
      { agent: "a", skill: "s", outcome: "skipped", skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы" },
      { trigger: "cron", cron: "0 8 * * *", scheduledAt: new Date("2026-09-06T03:00:00.000Z"), requestKey: "k", startedAt: started, finishedAt: new Date(started.getTime() + 500) },
    );
    assert.equal(e.hook, "quiet_hours");
    assert.equal(e.skipReason, "hook_blocked");
    const ok = journalFromRunResult(
      { agent: "a", skill: "s", outcome: "approval_requested", approvalId: "11111111-1111-4111-8111-111111111111", action: "Пополнить", reason: "предложено", review: "три подряд" },
      { trigger: "task", taskId: "22222222-2222-4222-8222-222222222222", requestKey: "k", startedAt: started, finishedAt: started },
    );
    assert.equal(ok.approvalId, "11111111-1111-4111-8111-111111111111");
    assert.equal(ok.taskId, "22222222-2222-4222-8222-222222222222");
    assert.equal(ok.action, "Пополнить");
    assert.equal(ok.review, "три подряд");
    assert.equal(ok.skipReason, undefined);
  });
  it("ошибка → failed с сообщением", () => {
    const e = journalFromRunResult(new Error("boom"), { trigger: "cron", requestKey: "k", startedAt: started, finishedAt: started, agentName: "a", skill: "s" });
    assert.equal(e.outcome, "failed");
    assert.equal(e.reason, "boom");
  });
});
