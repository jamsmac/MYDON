import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeRunTimeline } from "./run-timeline";

describe("mergeRunTimeline — лента прогона одной колонкой (волна R)", () => {
  it("сливает шину и аудит по времени, помечая источник каждой строки", () => {
    const rows = mergeRunTimeline(
      [{ at: "2026-09-06T03:00:02.000Z", type: "agent.action", payload: { skill: "monitor-stock" } }],
      [{ at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: "t1" }],
    );
    assert.deepEqual(
      rows.map((r) => `${r.kind}:${r.title}`),
      ["audit:task.claimed · vendhub-ops", "event:agent.action"],
    );
    assert.deepEqual(rows[0]!.detail, "t1");
    assert.deepEqual(rows[1]!.detail, { skill: "monitor-stock" });
  });

  it("аудит без исполнителя и без цели — заголовок без хвоста и БЕЗ детали", () => {
    const rows = mergeRunTimeline([], [{ at: "2026-09-06T03:00:00.000Z", action: "run.reported", actorRef: null, target: null }]);
    assert.equal(rows[0]!.title, "run.reported");
    assert.equal("detail" in rows[0]!, false, "пустой <code> читался бы как потерянная деталь");
  });

  it("одинаковое время — обе строки на месте, порядок устойчив", () => {
    const at = "2026-09-06T03:00:00.000Z";
    const rows = mergeRunTimeline(
      [{ at, type: "agent.run", payload: null }],
      [{ at, action: "run.reported", actorRef: null, target: null }],
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.kind), ["event", "audit"]);
  });

  it("пустые списки — пустая лента, а не исключение", () => {
    assert.deepEqual(mergeRunTimeline([], []), []);
  });
});
