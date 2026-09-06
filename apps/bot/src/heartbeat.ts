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
 * `clientKey` строится от времени, округлённого ВНИЗ до `HEARTBEAT_INTERVAL_MS`:
 * Core (`onConflictDoNothing` по `clientKey` в `events.service.ts`) отбрасывает
 * повтор внутри интервала молча, не плодя вторую строку.
 */
export function heartbeatEvent(now: Date): HeartbeatEvent {
  const floored = Math.floor(now.getTime() / HEARTBEAT_INTERVAL_MS) * HEARTBEAT_INTERVAL_MS;
  return {
    source: "bot",
    type: "bot.heartbeat",
    payload: { at: now.toISOString() },
    clientKey: `bot.heartbeat:${floored}`,
  };
}
