import {
  BOT_HEARTBEAT_INTERVAL_MS,
  BOT_HEARTBEAT_SOURCE,
  BOT_HEARTBEAT_TYPE,
} from "@mydon/shared";

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
 *
 * ЧИСЛО ЖИВЁТ В `@mydon/shared`, а не здесь: по нему же Core решает, молчит
 * ли поллер (`GET /apps/health`). Своя копия у каждой стороны разъехалась бы
 * молча — бот стал бы слать реже, чем ждёт Core, и панель показывала бы «бот
 * молчит» каждый цикл при живом боте.
 */
export const HEARTBEAT_INTERVAL_MS = BOT_HEARTBEAT_INTERVAL_MS;

export interface HeartbeatEvent {
  source: typeof BOT_HEARTBEAT_SOURCE;
  type: typeof BOT_HEARTBEAT_TYPE;
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
    source: BOT_HEARTBEAT_SOURCE,
    type: BOT_HEARTBEAT_TYPE,
    payload: { at: new Date(floored).toISOString() },
    clientKey: `${BOT_HEARTBEAT_TYPE}:${floored}`,
  };
}

/** Зависимости отправителя: запись события в Core и часы — обе подменяемы тестом. */
export interface HeartbeatSenderDeps {
  /** `CoreClient.recordEvent`, обёрнутый вызывающей стороной: сюда приходит готовое событие. */
  record: (event: HeartbeatEvent) => Promise<unknown>;
  now: () => Date;
}

/**
 * Отправитель heartbeat с клиентской проверкой бакета.
 *
 * ЗАЧЕМ. Сигнал уходит ИЗ ЦИКЛА опроса (`poll.ts`, круг починок A-1) — только
 * так он доказывает проход `getUpdates`, а не жизнь процесса. Но виток цикла —
 * это `timeoutSec = 30` long polling'а, то есть ~2900 вызовов в сутки ради 288
 * строк журнала. Дедуп живёт на стороне Core и стоит дорого: транзакция
 * `insert … on conflict do nothing`, затем `select` уже сохранённой строки и
 * сверка хэша — через pooler, и ~90% этих вызовов заведомо no-op.
 *
 * ЧТО СДЕЛАНО. Помним бакет ПОСЛЕДНЕЙ отправки и молчим, пока он тот же.
 * Семантика не ослаблена: зовут по-прежнему каждый проход опроса, и первый же
 * проход в новом бакете отправляет — то есть свежая запись в журнале
 * по-прежнему означает «опрос прошёл», а не «процесс запущен».
 *
 * БАКЕТ НЕ СЧИТАЕТСЯ ЗАНОВО. Сравниваем ровно тот `clientKey`, который уходит
 * в Core (`heartbeatEvent`): второй формулы бакета нет, поэтому и разъехаться
 * нечему. Разошедшиеся формулы одного значения — это дефект, который срез A2
 * уже чинил у `payload.at` против `clientKey`.
 *
 * ОТКАЗ НЕ «СЪЕДАЕТ» БАКЕТ. При неудачной отправке отметка сбрасывается, и
 * следующий проход пробует снова: иначе одна сетевая ошибка выключила бы
 * сигнал на всю пятиминутку, и панель здоровья сказала бы «бот молчит» о
 * живом поллере. Сброс только если бакет с тех пор не сменился — иначе отказ
 * старого вызова стёр бы отметку об успешной отправке в новом.
 */
export function createHeartbeatSender(deps: HeartbeatSenderDeps): () => void {
  let отправленныйБакет: string | null = null;
  return () => {
    const event = heartbeatEvent(deps.now());
    if (event.clientKey === отправленныйБакет) return;
    отправленныйБакет = event.clientKey;
    void deps.record(event).catch((err: unknown) => {
      if (отправленныйБакет === event.clientKey) отправленныйБакет = null;
      console.warn("Heartbeat не отправлен:", err);
    });
  };
}
