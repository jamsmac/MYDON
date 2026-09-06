import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RUN_OUTCOMES,
  RUN_SKIP_REASONS,
  SKIP_REASONS,
  describeRun,
  isRunOutcome,
  isSkipReason,
} from "./agent-runs";

describe("Словарь исходов прогона (Р-8)", () => {
  it("каждая причина пропуска имеет подпись и подсказку по-русски", () => {
    for (const r of SKIP_REASONS) {
      const d = RUN_SKIP_REASONS[r];
      assert.ok(d.label.length > 0, r);
      assert.ok(d.hint.length > 0, r);
      assert.match(d.label, /[а-яё]/i, r);
    }
  });

  it("узнаёт свои значения и отвергает чужие", () => {
    assert.equal(isRunOutcome("executed"), true);
    assert.equal(isRunOutcome("done"), false);
    assert.equal(isSkipReason("hook_blocked"), true);
    assert.equal(isSkipReason("nope"), false);
    assert.deepEqual([...RUN_OUTCOMES], ["approval_requested", "executed", "skipped", "failed"]);
  });

  it("описывает прогон одной фразой", () => {
    assert.equal(describeRun({ outcome: "executed", reason: "курс обновлён" }), "выполнено — курс обновлён");
    assert.equal(
      describeRun({ outcome: "skipped", skipReason: "no_signal", reason: "повода нет" }),
      "пропущено: повода нет — повода нет",
    );
    assert.equal(
      describeRun({ outcome: "skipped", skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы 22:00–07:00" }),
      "остановлено хуком quiet_hours — тихие часы 22:00–07:00",
    );
    assert.equal(describeRun({ outcome: "failed", reason: "ECONNREFUSED" }), "сбой — ECONNREFUSED");
  });
});
