import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_PAUSE_OFF, agentWorkPaused } from "./agent-pause";

/**
 * Одна дверь с одним ключом (круг починок, C-6).
 *
 * До этой функции тумблер читали три места по-своему: рантайм агентов —
 * `raw?.trim() !== "0"`, состояние агентов и доска рутин — `value !== "0"`.
 * Значение `" 0 "` давало «пауза» на двух экранах при работающих агентах.
 */
describe("Паузы парка агентов: одно правило чтения тумблера", () => {
  it("только точный «0» разрешает работу", () => {
    assert.equal(agentWorkPaused("0"), false);
    assert.equal(AGENT_PAUSE_OFF, "0");
  });

  it("пробелы вокруг нуля не превращают работу в паузу", () => {
    // Ровно то расхождение, ради которого правило стало общим: рантайм
    // работал, а два экрана рисовали паузу.
    assert.equal(agentWorkPaused(" 0 "), false);
    assert.equal(agentWorkPaused("\t0\n"), false);
  });

  it("отсутствие ключа, пустое значение и опечатка — пауза (fail-closed)", () => {
    for (const raw of [undefined, null, "", "  ", "1", "false", "off", "no"]) {
      assert.equal(agentWorkPaused(raw), true, `«${String(raw)}» обязано читаться как пауза`);
    }
  });
});
