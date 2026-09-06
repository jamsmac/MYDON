import { describe, expect, it } from "vitest";
import type { FlowSummary } from "./core";
import { PHASE_LABELS, detailText, mergeTimeline, phaseTone, runPhrase, stamp } from "./flows";

const RUN: FlowSummary = {
  id: "r1",
  agent: "vendhub-ops",
  skill: "monitor-stock",
  trigger: "cron",
  startedAt: "2026-09-06T03:00:00.000Z",
  finishedAt: "2026-09-06T03:00:03.000Z",
  outcome: "executed",
  skipReason: null,
  hook: null,
  reason: "заказ на 6 позиций создан",
  action: "заказать 6 позиций",
  taskId: "t1",
  approvalId: null,
};

describe("mergeTimeline", () => {
  it("сливает события и аудит по времени, помечая источник", () => {
    const rows = mergeTimeline(
      [{ at: "2026-09-06T03:00:02.000Z", type: "agent.action", payload: { skill: "s" } }],
      [{ at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: "t1" }],
    );
    expect(rows.map((r) => `${r.kind}:${r.title}`)).toEqual(["audit:task.claimed · vendhub-ops", "event:agent.action"]);
  });

  it("аудит без исполнителя и без цели — заголовок без хвоста и пустая деталь", () => {
    const rows = mergeTimeline([], [{ at: "2026-09-06T03:00:00.000Z", action: "run.reported", actorRef: null, target: null }]);
    expect(rows[0]?.title).toBe("run.reported");
    expect(rows[0]?.detail).toBeUndefined();
  });
});

describe("phaseTone / PHASE_LABELS", () => {
  it("шесть фаз по-русски, тона по состоянию", () => {
    expect(Object.keys(PHASE_LABELS)).toEqual(["trigger", "skill", "proposal", "approval", "execution", "delivery"]);
    expect(phaseTone("ok")).toBe("ok");
    expect(phaseTone("warn")).toBe("warn");
    expect(phaseTone("fail")).toBe("hot");
    expect(phaseTone("skip")).toBe("muted");
  });
});

describe("runPhrase", () => {
  it("исход строки журнала объясняет теми же словами, что доска рутин", () => {
    expect(runPhrase(RUN)).toBe("выполнено — заказ на 6 позиций создан");
    expect(runPhrase({ ...RUN, outcome: "skipped", skipReason: "no_signal", reason: "нечего предлагать" })).toBe(
      "пропущено: повода нет — нечего предлагать",
    );
  });
});

describe("stamp", () => {
  it("время ленты по Ташкенту и с секундами: прогон укладывается в секунды", () => {
    expect(stamp("2026-09-06T03:00:01.000Z")).toBe("08:00:01");
  });
});

describe("detailText", () => {
  it("строку показывает как есть, объект — JSON, длинное режет до 200 символов", () => {
    expect(detailText("t1")).toBe("t1");
    expect(detailText({ skill: "monitor-stock" })).toBe('{"skill":"monitor-stock"}');
    const long = detailText({ reason: "я".repeat(500) });
    expect(long).toHaveLength(201);
    expect(long?.endsWith("…")).toBe(true);
  });

  it("детали нет — нет и строки: пустой <code> в ленте читался бы как пустой ответ", () => {
    expect(detailText(undefined)).toBeNull();
  });
});
