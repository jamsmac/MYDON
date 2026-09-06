import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEARTBEAT_INTERVAL_MS, heartbeatEvent } from "./heartbeat";

describe("heartbeatEvent — сигнал живого поллера (Р-5)", () => {
  it("два вызова внутри одного интервала дают один clientKey", () => {
    const a = heartbeatEvent(new Date("2026-09-06T10:00:00.000Z"));
    const b = heartbeatEvent(new Date("2026-09-06T10:04:59.999Z"));
    assert.equal(a.clientKey, b.clientKey);
  });

  it("в соседних интервалах — разные clientKey", () => {
    const start = new Date("2026-09-06T10:00:00.000Z");
    const a = heartbeatEvent(start);
    const b = heartbeatEvent(new Date(start.getTime() + HEARTBEAT_INTERVAL_MS));
    assert.notEqual(a.clientKey, b.clientKey);
  });

  it("округление вниз: момент чуть до границы интервала остаётся в предыдущем", () => {
    // 10:04:59.999 — тот же интервал, что 10:00:00.000; 10:05:00.000 — уже следующий.
    const boundary = new Date("2026-09-06T10:05:00.000Z");
    const justBefore = new Date(boundary.getTime() - 1);
    assert.notEqual(heartbeatEvent(justBefore).clientKey, heartbeatEvent(boundary).clientKey);
  });

  it("payload.at — ISO-строка ровно переданного момента", () => {
    const now = new Date("2026-09-06T10:03:17.456Z");
    const event = heartbeatEvent(now);
    assert.equal(event.payload.at, now.toISOString());
  });

  it("контракт source/type фиксирован планом — читает его другой исполнитель в Core", () => {
    const event = heartbeatEvent(new Date());
    assert.equal(event.source, "bot");
    assert.equal(event.type, "bot.heartbeat");
  });
});
