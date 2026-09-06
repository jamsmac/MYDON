import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEARTBEAT_INTERVAL_MS, heartbeatEvent } from "./heartbeat";

describe("heartbeatEvent — сигнал живого поллера (Р-5)", () => {
  it("два вызова внутри одного интервала дают один clientKey И один payload.at", () => {
    // Не только ключ: EventsService.record при повторе clientKey сверяет хэш
    // {source, type, payload, occurredAt} с уже сохранённой строкой. Разный
    // payload.at под тем же clientKey — это 409 (ConflictException), а не
    // тихий no-op, на который рассчитан план. Поэтому оба поля обязаны
    // совпасть у двух вызовов внутри одной пятиминутки.
    const a = heartbeatEvent(new Date("2026-09-06T10:00:00.000Z"));
    const b = heartbeatEvent(new Date("2026-09-06T10:04:59.999Z"));
    assert.equal(a.clientKey, b.clientKey);
    assert.equal(a.payload.at, b.payload.at);
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

  it("пересечение границы интервала сдвигает clientKey И payload.at ВМЕСТЕ", () => {
    // Ключ и отметка времени округляются одной и той же формулой: если бы
    // они расходились по разные стороны границы, пара clientKey+payload
    // ушла бы «наполовину новой» — ровно та рассинхронизация, которую чинит
    // этот раунд правок.
    const boundary = new Date("2026-09-06T10:05:00.000Z");
    const justBefore = new Date(boundary.getTime() - 1);
    const before = heartbeatEvent(justBefore);
    const after = heartbeatEvent(boundary);
    assert.notEqual(before.clientKey, after.clientKey);
    assert.notEqual(before.payload.at, after.payload.at);
    assert.equal(after.payload.at, boundary.toISOString());
  });

  it("payload.at — ISO-строка НАЧАЛА интервала, а не точного момента вызова", () => {
    // Округляем оба поля одной формулой (Math.floor к HEARTBEAT_INTERVAL_MS):
    // это условие «повтор внутри бакета байт-в-байт идентичен», на котором
    // держится тихий дедуп Core.
    const now = new Date("2026-09-06T10:03:17.456Z");
    const bucketStart = new Date("2026-09-06T10:00:00.000Z");
    const event = heartbeatEvent(now);
    assert.equal(event.payload.at, bucketStart.toISOString());
    assert.notEqual(event.payload.at, now.toISOString());
  });

  it("контракт source/type фиксирован планом — читает его другой исполнитель в Core", () => {
    const event = heartbeatEvent(new Date());
    assert.equal(event.source, "bot");
    assert.equal(event.type, "bot.heartbeat");
  });
});
