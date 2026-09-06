import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { pollOnce } from "./poll";
import { InvalidTokenError, type TgUpdate } from "./telegram";

const update = (id: number): TgUpdate => ({ update_id: id });

/** Тихий прогон: `pollOnce` печатает отказы в консоль, тесту это шум. */
async function молча<T>(fn: () => Promise<T>): Promise<T> {
  const err = mock.method(console, "error", () => undefined);
  try {
    return await fn();
  } finally {
    err.mock.restore();
  }
}

/**
 * Сигнал «поллер жив» обязан доказывать ПРОХОД ОПРОСА (круг починок, A-1).
 *
 * Прежний `setInterval(...).unref()` доказывал живой процесс: на отозванном
 * токене бот навсегда уходил в `idle()`, а heartbeat продолжал тикать, и
 * панель писала «Telegram-бот · в порядке» над ботом, который не обработает ни
 * одного сообщения. Ассерты ниже падают, если сигнал снова отвяжут от опроса.
 */
describe("Проход опроса Telegram — источник heartbeat (A-1)", () => {
  it("успешный getUpdates даёт сигнал ровно один раз за проход", async () => {
    let сигналов = 0;
    const исход = await pollOnce({
      getUpdates: async () => [update(1), update(2)],
      processUpdate: async () => undefined,
      onPass: () => {
        сигналов += 1;
      },
    });
    assert.equal(исход, "passed");
    assert.equal(сигналов, 1);
  });

  it("пустая пачка — тоже проход: long polling законно молчит", async () => {
    let сигналов = 0;
    const исход = await pollOnce({
      getUpdates: async () => [],
      processUpdate: async () => undefined,
      onPass: () => {
        сигналов += 1;
      },
    });
    assert.equal(исход, "passed");
    assert.equal(сигналов, 1, "иначе бот молчал бы в Core в спокойный день");
  });

  it("ОТКАЗ ОПРОСА — СИГНАЛА НЕТ (устойчивый 409: два поллера на одном токене)", async () => {
    let сигналов = 0;
    const исход = await молча(() =>
      pollOnce({
        getUpdates: async () => {
          throw new Error("409 Conflict: terminated by other getUpdates request");
        },
        processUpdate: async () => undefined,
        onPass: () => {
          сигналов += 1;
        },
      }),
    );
    assert.equal(исход, "failed");
    assert.equal(сигналов, 0, "зелёная строка приложений над не работающим поллером — тот самый дефект");
  });

  it("отозванный токен — сигнала нет, и цикл уходит ждать правки", async () => {
    let сигналов = 0;
    const исход = await молча(() =>
      pollOnce({
        getUpdates: async () => {
          throw new InvalidTokenError("TELEGRAM_BOT_TOKEN отозван");
        },
        processUpdate: async () => undefined,
        onPass: () => {
          сигналов += 1;
        },
      }),
    );
    assert.equal(исход, "invalid_token", "отдельный исход: 5-секундный retry тут бесполезен");
    assert.equal(сигналов, 0);
  });

  it("упавший update пачку не уносит и сигнал не отменяет: опрос-то прошёл", async () => {
    const обработано: number[] = [];
    let сигналов = 0;
    const исход = await молча(() =>
      pollOnce({
        getUpdates: async () => [update(1), update(2), update(3)],
        processUpdate: async (u) => {
          if (u.update_id === 2) throw new Error("answerCallback: query is too old");
          обработано.push(u.update_id);
        },
        onPass: () => {
          сигналов += 1;
        },
      }),
    );
    assert.equal(исход, "passed");
    assert.deepEqual(обработано, [1, 3], "offset уже сдвинут — соседей пачки терять нельзя");
    assert.equal(сигналов, 1);
  });
});
