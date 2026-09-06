/**
 * Heartbeat бота — событие в общий журнал Core, а не таблица (решение Р-5,
 * `docs/superpowers/specs/2026-09-06-wave-a2-faces-design.md`).
 *
 * Offset Telegram-опроса живёт в памяти процесса (`telegram.ts`) и нигде
 * больше не отражается: если поллер молча упал, ничто в базе об этом не
 * скажет. Раз в `HEARTBEAT_INTERVAL_MS` бот пишет `POST /events`
 * (`source: "bot"`, `type: "bot.heartbeat"`), и панель здоровья (`GET
 * /apps/health`) читает `GET /events/latest?source=bot&type=bot.heartbeat`:
 * свежее интервала — жив, старее — подозрение, нет вовсе — «не отчитывался».
 */

/**
 * Период отправки — он же шаг округления `clientKey`: два вызова в одну и
 * ту же пятиминутку обязаны схлопнуться в одну строку.
 */
export const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

export interface HeartbeatEvent {
  source: "bot";
  type: "bot.heartbeat";
  payload: { at: string };
  clientKey: string;
}

/**
 * Событие heartbeat на момент `now`.
 *
 * И `clientKey`, и `payload.at` строятся от ОДНОГО округлённого вниз до
 * `HEARTBEAT_INTERVAL_MS` момента — не только ключ. `EventsService.record`
 * при повторе `clientKey` не просто отбрасывает вставку: он перечитывает уже
 * сохранённую строку и сверяет хэш `{source, type, payload, occurredAt}`
 * (`apps/core/src/events/events.service.ts`). Если бы `payload.at` нёс точное
 * время вызова, у двух настоящих вызовов внутри одного интервала (два
 * инстанса бота во время деплоя, будущий ретрай) совпал бы `clientKey`, но
 * разошёлся бы `payload` — и Core ответил бы 409 (`ConflictException`)
 * вместо тихого no-op, на который рассчитан план (Р-5). С округлённым
 * `payload.at` повтор внутри интервала БАЙТ-В-БАЙТ идентичен: Core тихо
 * отбрасывает вставку по `onConflictDoNothing`, хэши совпадают, конфликта
 * нет. Разный `payload` под тем же ключом (не наш случай, но именно от него
 * защищает сверка) — это и есть единственный путь к 409, который ловит
 * `.catch` в `index.ts` и превращает в `console.warn`.
 */
export function heartbeatEvent(now: Date): HeartbeatEvent {
  const floored = Math.floor(now.getTime() / HEARTBEAT_INTERVAL_MS) * HEARTBEAT_INTERVAL_MS;
  return {
    source: "bot",
    type: "bot.heartbeat",
    payload: { at: new Date(floored).toISOString() },
    clientKey: `bot.heartbeat:${floored}`,
  };
}
