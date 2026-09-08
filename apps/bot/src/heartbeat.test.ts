import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  HEARTBEAT_INTERVAL_MS,
  createHeartbeatSender,
  heartbeatEvent,
  type HeartbeatEvent,
} from "./heartbeat";

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

describe("createHeartbeatSender — сигнал из цикла опроса, но не чаще бакета (перепроверка A2, П2)", () => {
  const НАЧАЛО = new Date("2026-09-08T10:00:00.000Z");

  /** Тихий прогон: отказ отправки печатается в консоль, тесту это шум. */
  async function молча(fn: () => Promise<void> | void): Promise<void> {
    const warn = mock.method(console, "warn", () => undefined);
    try {
      await fn();
    } finally {
      warn.mock.restore();
    }
  }

  /** Отправитель с управляемыми часами и журналом вызовов Core. */
  function стенд(исход: (event: HeartbeatEvent) => Promise<unknown> = () => Promise.resolve({})) {
    const вызовы: HeartbeatEvent[] = [];
    let сейчас = НАЧАЛО;
    const send = createHeartbeatSender({
      record: (event) => {
        вызовы.push(event);
        return исход(event);
      },
      now: () => сейчас,
    });
    return {
      вызовы,
      send,
      сдвиг: (ms: number) => {
        сейчас = new Date(сейчас.getTime() + ms);
      },
    };
  }

  it("два прохода опроса в одном бакете — ОДИН вызов Core", () => {
    // Виток long polling'а — это timeoutSec = 30: без этой проверки в Core
    // уходило ~2900 транзакций в сутки ради 288 строк, и ~90% из них no-op.
    const с = стенд();
    с.send();
    с.сдвиг(30_000);
    с.send();
    assert.equal(с.вызовы.length, 1);
  });

  it("проход в НОВОМ бакете — второй вызов: сигнал остаётся доказательством прохода опроса", () => {
    const с = стенд();
    с.send();
    с.сдвиг(HEARTBEAT_INTERVAL_MS);
    с.send();
    assert.equal(с.вызовы.length, 2);
    assert.notEqual(с.вызовы[0]?.clientKey, с.вызовы[1]?.clientKey);
  });

  it("бакет считается ТОЙ ЖЕ формулой, что clientKey события — второй формулы нет", () => {
    // Разъехавшиеся формулы одного значения — дефект, который срез A2 чинил у
    // payload.at против clientKey. Здесь сравнивается ровно тот ключ, который
    // уходит в Core.
    const с = стенд();
    с.send();
    assert.equal(с.вызовы[0]?.clientKey, heartbeatEvent(НАЧАЛО).clientKey);
    assert.equal(с.вызовы[0]?.payload.at, heartbeatEvent(НАЧАЛО).payload.at);
  });

  it("ОТКАЗ ОТПРАВКИ НЕ СЪЕДАЕТ БАКЕТ: следующий проход пробует снова", async () => {
    // Иначе одна сетевая ошибка выключила бы сигнал на пять минут, и панель
    // здоровья сказала бы «бот молчит» о живом поллере.
    let падать = true;
    const с = стенд(() =>
      падать ? Promise.reject(new Error("Core недоступен")) : Promise.resolve({}),
    );
    await молча(async () => {
      с.send();
      await Promise.resolve();
      await Promise.resolve();
    });
    падать = false;
    с.сдвиг(30_000);
    с.send();
    assert.equal(с.вызовы.length, 2, "неудачная отправка не считается отправкой");
    assert.equal(
      с.вызовы[0]?.clientKey,
      с.вызовы[1]?.clientKey,
      "тот же бакет — повтор идемпотентен",
    );
    // Успех внутри того же бакета снова закрывает его.
    с.сдвиг(30_000);
    с.send();
    assert.equal(с.вызовы.length, 2);
  });

  it("отказ СТАРОГО вызова не стирает отметку об успехе в новом бакете", async () => {
    // Отправка асинхронна: если бы .catch сбрасывал бакет безусловно, отказ,
    // пришедший после смены бакета, открыл бы уже закрытый новый — и следующий
    // же виток слал бы дубль.
    let отказать: (() => void) | null = null;
    let первый = true;
    const с = стенд(() => {
      if (!первый) return Promise.resolve({});
      первый = false;
      return new Promise((_, reject) => {
        отказать = () => reject(new Error("поздний отказ"));
      });
    });
    с.send(); // бакет 1 — «в полёте»
    с.сдвиг(HEARTBEAT_INTERVAL_MS);
    с.send(); // бакет 2 — успех
    assert.equal(с.вызовы.length, 2);
    await молча(async () => {
      отказать?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    с.сдвиг(30_000);
    с.send(); // всё ещё бакет 2 — отправлять нечего
    assert.equal(с.вызовы.length, 2);
  });
});
