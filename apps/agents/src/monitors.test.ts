import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journaledMonitor, monitorRequestKey } from "./monitors";

describe("journaledMonitor (R-R-6)", () => {
  const occurrence = new Date("2026-09-06T04:00:00.000Z");
  it("успех → executed с итоговой строкой, requestKey от occurrence", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("fx:refresh", "5 9 * * *", core, async () => "[fx:refresh] обновлено: USD");
    await run(occurrence);
    assert.equal(entries[0]!.agentName, "system");
    assert.equal(entries[0]!.skill, "fx:refresh");
    assert.equal(entries[0]!.outcome, "executed");
    assert.equal(entries[0]!.reason, "[fx:refresh] обновлено: USD");
    assert.equal(entries[0]!.requestKey, monitorRequestKey("fx:refresh", "5 9 * * *", occurrence));
    assert.equal(entries[0]!.scheduledAt, occurrence.toISOString());
  });
  it("исключение → failed, и ошибка не всплывает наружу", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("coffee:monitor", "0 7 * * *", core, async () => { throw new Error("db down"); });
    await run(occurrence);
    assert.equal(entries[0]!.outcome, "failed");
    assert.equal(entries[0]!.reason, "db down");
  });
  it("падение журнала не роняет монитор", async () => {
    const core = { reportRun: async () => { throw new Error("core down"); } };
    let ran = false;
    const run = journaledMonitor("x", "* * * * *", core, async () => { ran = true; return "ok"; });
    await run(occurrence);
    assert.equal(ran, true);
  });
});
