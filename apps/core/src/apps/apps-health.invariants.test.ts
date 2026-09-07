import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACES,
  rowFromHeartbeat,
  rowFromLlm,
  rowFromMonitor,
  rowFromOurvendAccounting,
  rowFromOurvendSync,
  rowFromOutbox,
  unavailableRow,
  type HealthRow,
  type LlmMonitoringLite,
  type MonitorSnapshotLite,
  type OurvendAccountingHealthLite,
  type OurvendSyncHealthLite,
} from "./apps-health";

/**
 * СОСТЯЗАТЕЛЬНЫЙ ПЕРЕБОР ИНВАРИАНТА (срез Д1, П4).
 *
 * Инвариант среза: `state === "ok"` ⇒ `lastCheckedAt !== null`. Зелёная строка
 * ОБЯЗАНА нести время проверки — иначе панель говорит «в порядке» о том, чего
 * никто не проверял, и это ровно та ложь, ради которой волна A2 завела третье
 * состояние.
 *
 * ПОЧЕМУ ПЕРЕБОР, А НЕ ЕЩЁ ДЕСЯТЬ ПРИМЕРОВ. Инвариант держится не на одной
 * ветке, а на СОГЛАСОВАННОСТИ полутора десятков: каждая зелёная ветка берёт
 * момент проверки из своего поля, и любая новая ветка (или новый источник
 * моментов) может его потерять. Пример ловит то, о чём автор подумал; перебор
 * ловит то, о чём он не подумал. Такой перебор доказал инвариант при ревью
 * задачи 2 — на 90 283 входах, 9 242 зелёных строках, — но был одноразовой
 * оснасткой и умер вместе с сессией ревьюера. Здесь он живёт в репозитории.
 *
 * ЧТО ИМЕННО ПЕРЕБИРАЕТСЯ. Произведение ФОРМ, а не случайные значения: шесть
 * форм `Date` (нет, `undefined`, `Invalid Date`, свежая, старая, будущая) и
 * семь форм ISO (нет, пустая, мусор, с зоной свежая, с зоной старая, форма СУБД
 * «YYYY-MM-DD HH:mm:ss», голая дата) — по ВСЕМ точкам правил, включая
 * `unavailableRow`. Число входов вторично: важна полнота произведения, потому
 * что ломается именно стык форм («момент есть, но не читается» × «ветка судит
 * по другому полю»).
 *
 * ТРИ УТВЕРЖДЕНИЯ И ОДНО СЧЁТНОЕ:
 *   1) нет `ok` без `lastCheckedAt`;
 *   2) правила не бросают (`toISOString()` на `Invalid Date` — это `RangeError`
 *      ПРЯМО ИЗ ЧИСТЫХ ПРАВИЛ, то есть 500 на весь `/apps/health`);
 *   3) наружу не едет ни битый ISO, ни подстрока `NaN`;
 *   4) зелёных строк ЗАМЕТНО БОЛЬШЕ НУЛЯ — иначе мутация, после которой ничто
 *      не зеленеет, прошла бы незамеченной, а перебор остался бы зелёным,
 *      доказав пустоту.
 */

const NOW = new Date("2026-09-06T09:00:00.000Z");
const ЧАС = 3_600_000;

/**
 * `undefined` там, где тип обещает `Date | null`.
 *
 * ПРИВЕДЕНИЕ ЗДЕСЬ — ПРЕДМЕТ ПРОВЕРКИ, А НЕ НЕБРЕЖНОСТЬ. Пояса файла (`исо`,
 * `читаемыйМомент`) принимают `Date | null | undefined` именно потому, что
 * производитель обещание подписи уже нарушал: `rowFromRaw`
 * (`routines/runs.service.ts`) собирает `startedAt: d(r.started_at)!` —
 * `new Date(строка)` под непроверенным `!`. Перебор кормит правила тем, что
 * приезжает в рантайме, а не тем, что обещает тип.
 */
const БЕЗ_ЗНАЧЕНИЯ = undefined as unknown as Date;

/** Форма значения: имя для сообщения об ошибке и само значение. */
type Форма<T> = { имя: string; значение: T };

/** Шесть форм момента `Date`. */
const МОМЕНТЫ: readonly Форма<Date | null>[] = [
  { имя: "null", значение: null },
  { имя: "undefined", значение: БЕЗ_ЗНАЧЕНИЯ },
  { имя: "Invalid Date", значение: new Date("сломано") },
  { имя: "свежая", значение: new Date(NOW.getTime() - 60_000) },
  { имя: "старая 30 ч", значение: new Date(NOW.getTime() - 30 * ЧАС) },
  { имя: "будущая", значение: new Date(NOW.getTime() + ЧАС) },
];

/** Семь форм ISO-строки: так их отдают продюсеры Core и чужие отчёты. */
const СТРОКИ_ISO: readonly Форма<string | null>[] = [
  { имя: "null", значение: null },
  { имя: "пустая", значение: "" },
  { имя: "мусор", значение: "не дата" },
  { имя: "с зоной, свежая", значение: new Date(NOW.getTime() - ЧАС).toISOString() },
  { имя: "с зоной, старая", значение: new Date(NOW.getTime() - 30 * ЧАС).toISOString() },
  { имя: "форма СУБД", значение: "2026-09-06 04:00:00" },
  { имя: "голая дата", значение: "2026-09-06" },
];

/** Снимок расписаний: включён, выключен двумя причинами, отсутствует. */
const МОНИТОРЫ: readonly Форма<{ monitor: MonitorSnapshotLite | null; snapshotPublished: boolean }>[] = [
  { имя: "включён", значение: { monitor: { enabled: true }, snapshotPublished: true } },
  { имя: "выключен", значение: { monitor: { enabled: false, reason: "off" }, snapshotPublished: true } },
  {
    имя: "без учётных данных",
    значение: { monitor: { enabled: false, reason: "no_credentials" }, snapshotPublished: true },
  },
  { имя: "нет в снимке", значение: { monitor: null, snapshotPublished: true } },
  { имя: "снимка нет вовсе", значение: { monitor: null, snapshotPublished: false } },
];

/** Исходы прогона: два журналируемых, один чужой. */
const ИСХОДЫ = ["executed", "failed", "skipped"] as const;

/** Прогон: «прогонов не было» плюс произведение форм момента и исходов. */
const ПРОГОНЫ: readonly Форма<{ at: Date; outcome: string; reason: string } | null>[] = [
  { имя: "прогонов нет", значение: null },
  ...МОМЕНТЫ.flatMap((момент) =>
    ИСХОДЫ.map((исход) => ({
      имя: `прогон ${исход}, момент ${момент.имя}`,
      значение: { at: момент.значение as Date, outcome: исход, reason: "[skill] причина" },
    })),
  ),
];

/** Что перебор насчитал — счётчики общие на весь прогон. */
const счёт = { всего: 0, зелёных: 0, сломано: 0, неОценить: 0 };

/**
 * Одна строка перебора под всеми утверждениями сразу.
 *
 * Описание входа собирается ЗАРАНЕЕ и передаётся строкой: упавший перебор без
 * него сообщает «где-то в 53 тысячах входов», то есть не сообщает ничего.
 */
function проверить(описание: string, вызов: () => HealthRow): void {
  счёт.всего += 1;
  let строка: HealthRow;
  try {
    строка = вызов();
  } catch (ошибка) {
    // Бросок из ЧИСТЫХ ПРАВИЛ — это 500 на весь `/apps/health`: они вызываются
    // вне `попытка`, и вместо строки «оценить нечем» гаснет весь экран.
    assert.fail(`${описание}: правила бросили ${String(ошибка)}`);
  }

  if (строка.state === "ok") {
    счёт.зелёных += 1;
    assert.notEqual(
      строка.lastCheckedAt,
      null,
      `${описание}: зелёная строка «${строка.summary}» без времени проверки`,
    );
  }
  if (строка.state === "bad") счёт.сломано += 1;
  if (строка.state === "unknown") счёт.неОценить += 1;

  const моменты: readonly [string, string | null][] = [
    ["lastCheckedAt", строка.lastCheckedAt],
    ["at", строка.at ?? null],
  ];
  for (const [поле, значение] of моменты) {
    if (значение === null) continue;
    assert.ok(
      Number.isFinite(new Date(значение).getTime()),
      `${описание}: в ${поле} уехало «${значение}» — это не момент`,
    );
  }

  const тексты: readonly [string, string][] = [
    ["summary", строка.summary],
    ["detail", строка.detail ?? ""],
  ];
  for (const [поле, текст] of тексты) {
    // `NaN` в тексте — след того же битого момента: «бот отвечает NaN мин
    // назад» и «самой старой NaN ч» уже случались.
    assert.doesNotMatch(текст, /NaN|Invalid Date/, `${описание}: в ${поле} утёк мусор — «${текст}»`);
  }
}

describe("Здоровье приложений: перебор форм момента (срез Д1, П4)", () => {
  it("монитор: снимок × прогон × порог молчания", () => {
    for (const снимок of МОНИТОРЫ) {
      for (const прогон of ПРОГОНЫ) {
        for (const порог of МОМЕНТЫ) {
          проверить(`монитор [${снимок.имя}] [${прогон.имя}] [порог ${порог.имя}]`, () =>
            rowFromMonitor(FACES.fx, {
              ...снимок.значение,
              lastRun: прогон.значение,
              silentAfter: порог.значение,
              now: NOW,
            }),
          );
        }
      }
    }
  });

  it("сбор OurVend: снимок × прогон × отчёт (застой, серия отказов, момент успеха)", () => {
    const отчёты: Форма<OurvendSyncHealthLite | null>[] = [{ имя: "отчёта нет", значение: null }];
    for (const успех of СТРОКИ_ISO) {
      for (const runs of [0, 20]) {
        for (const failedStreak of [0, 3]) {
          for (const застой of [null, 1, 100]) {
            отчёты.push({
              имя: `отчёт [успех ${успех.имя}] [прогонов ${runs}] [отказов ${failedStreak}] [застой ${застой}]`,
              значение: {
                runs,
                failedStreak,
                lastSuccessAt: успех.значение,
                staleHoursRaw: застой,
                // Показанное число ОКРУГЛЕНО и с сырым нарочно не совпадает:
                // сравнение по нему двигало бы границу (авария 24.08.2026).
                staleHoursShown: застой === null ? null : застой + 0.4,
                staleThresholdH: 6,
              },
            });
          }
        }
      }
    }
    for (const снимок of МОНИТОРЫ) {
      for (const прогон of ПРОГОНЫ) {
        for (const отчёт of отчёты) {
          проверить(`сбор [${снимок.имя}] [${прогон.имя}] [${отчёт.имя}]`, () =>
            rowFromOurvendSync(FACES.ourvendSync, {
              ...снимок.значение,
              lastRun: прогон.значение,
              health: отчёт.значение,
              now: NOW,
            }),
          );
        }
      }
    }
  });

  it("учёт OurVend: снимок × прогон × сверка (четыре режима паритета) × порог молчания", () => {
    const паритеты: Форма<OurvendAccountingHealthLite["parity"]>[] = [];
    for (const mode of ["stock", "mirror", "retired", "незнакомый"]) {
      for (const [checked, mismatches, stockOk, stockChecked] of [
        [34, 0, true, 12],
        [0, 0, false, 0],
        [34, 7, true, 12],
      ] as const) {
        паритеты.push({
          имя: `паритет ${mode} (${checked}/${mismatches}/${stockOk}/${stockChecked})`,
          значение: { mode, checked, mismatches, stockOk, stockChecked },
        });
      }
    }
    const отчёты: Форма<OurvendAccountingHealthLite | null>[] = [{ имя: "отчёта нет", значение: null }];
    for (const snapshotStale of [true, false]) {
      for (const salesLagShownH of [null, 1]) {
        for (const паритет of паритеты) {
          отчёты.push({
            имя: `отчёт [снимок встал ${snapshotStale}] [лаг ${salesLagShownH}] [${паритет.имя}]`,
            значение: { snapshotStale, salesLagShownH, parity: паритет.значение },
          });
        }
      }
    }
    for (const снимок of МОНИТОРЫ) {
      for (const прогон of ПРОГОНЫ) {
        for (const отчёт of отчёты) {
          for (const порог of МОМЕНТЫ) {
            проверить(`учёт [${снимок.имя}] [${прогон.имя}] [${отчёт.имя}] [порог ${порог.имя}]`, () =>
              rowFromOurvendAccounting(FACES.ourvendAccounting, {
                ...снимок.значение,
                lastRun: прогон.значение,
                health: отчёт.значение,
                silentAfter: порог.значение,
                now: NOW,
              }),
            );
          }
        }
      }
    }
  });

  it("очередь доставок: 13 наборов счётчиков × четыре момента", () => {
    // Наборы счётчиков — те же случаи, что разбирались в круге починок A-2:
    // пустая таблица, только пропуски, старый тупик при идущих доставках,
    // очередь без единого закрытия, неизвестный исход.
    const наборы: readonly Форма<Record<string, number>>[] = [
      { имя: "пусто", значение: {} },
      { имя: "только очередь", значение: { pending: 500 } },
      { имя: "очередь и успехи", значение: { pending: 500, sent: 5 } },
      { имя: "всё ушло", значение: { sent: 200 } },
      { имя: "только пропуски", значение: { skipped: 50 } },
      { имя: "успехи и пропуски", значение: { sent: 200, skipped: 50 } },
      { имя: "тупик", значение: { sent: 200, dead: 1 } },
      { имя: "неизвестный исход", значение: { sent: 200, unknown: 2 } },
      { имя: "тупик и неизвестность", значение: { dead: 1, unknown: 2 } },
      { имя: "разбор идёт", значение: { pending: 3, dispatching: 2, sent: 10 } },
      { имя: "всё сразу", значение: { pending: 3, dispatching: 2, sent: 10, skipped: 4, dead: 1, unknown: 1 } },
      { имя: "чужой статус", значение: { какой_то: 7 } },
      { имя: "только диспетчеризация", значение: { dispatching: 9 } },
    ];
    for (const набор of наборы) {
      for (const старая of МОМЕНТЫ) {
        for (const ушла of МОМЕНТЫ) {
          for (const пропущена of МОМЕНТЫ) {
            for (const отказала of МОМЕНТЫ) {
              проверить(
                `очередь [${набор.имя}] [старая ${старая.имя}] [ушла ${ушла.имя}] ` +
                  `[пропущена ${пропущена.имя}] [отказала ${отказала.имя}]`,
                () =>
                  rowFromOutbox(FACES.notion, {
                    counts: набор.значение,
                    oldestPendingAt: старая.значение,
                    lastSentAt: ушла.значение,
                    lastSkippedAt: пропущена.значение,
                    lastFailedAt: отказала.значение,
                    now: NOW,
                  }),
              );
            }
          }
        }
      }
    }
  });

  it("heartbeat бота: момент сигнала × интервал ожидания", () => {
    for (const сигнал of МОМЕНТЫ) {
      for (const intervalMs of [5 * 60_000, 0, -1]) {
        проверить(`бот [сигнал ${сигнал.имя}] [интервал ${intervalMs}]`, () =>
          rowFromHeartbeat(FACES.bot, { lastAt: сигнал.значение, intervalMs, now: NOW }),
        );
      }
    }
  });

  it("ledger моделей: настройки маршрута × исход последнего вызова × момент вызова", () => {
    const настройки: readonly Форма<Omit<LlmMonitoringLite, "latestCompletedAt" | "latestCompletedStatus" | "latestCompletedOutcome">>[] =
      [
        { имя: "всё в порядке", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: 4.5, budgetCapUsd: 5 } },
        { имя: "маршрут выключен", значение: { meteredEnabled: false, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: 4.5, budgetCapUsd: 5 } },
        { имя: "нет цены", значение: { meteredEnabled: true, hasActivePrice: false, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 3, budgetRemainingUsd: 4.5, budgetCapUsd: 5 } },
        { имя: "предохранитель", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 2, failuresToday: 9, budgetRemainingUsd: 4.5, budgetCapUsd: 5 } },
        { имя: "зависшие резервы", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 4, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: 4.5, budgetCapUsd: 5 } },
        { имя: "потолок нулевой", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: 0, budgetCapUsd: 0 } },
        // Отрицательные потолки: настройка, которую никто не обещал, но которую
        // ledger примет как число.
        { имя: "потолок отрицательный", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: -1, budgetCapUsd: -5 } },
        { имя: "потолок исчерпан", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 12, budgetRemainingUsd: 0, budgetCapUsd: 5 } },
        { имя: "потолок задан неверно", значение: { meteredEnabled: true, hasActivePrice: true, provider: "anthropic", model: "sonnet", stuckCount: 0, openCircuits: 0, failuresToday: 0, budgetRemainingUsd: 4.5, budgetCapUsd: 5, configError: "LLM_DAILY_CAP_USD=«много»" } },
      ];
    for (const набор of настройки) {
      for (const статус of ["settled", "failed", null] as const) {
        for (const момент of СТРОКИ_ISO) {
          проверить(`ledger [${набор.имя}] [исход ${статус ?? "нет"}] [момент ${момент.имя}]`, () =>
            rowFromLlm(FACES.llm, {
              monitoring: {
                ...набор.значение,
                latestCompletedAt: момент.значение,
                latestCompletedStatus: статус,
                latestCompletedOutcome: статус === "failed" ? "provider_error" : null,
              },
              now: NOW,
            }),
          );
        }
      }
    }
    проверить("ledger [монитор не ответил]", () => rowFromLlm(FACES.llm, { monitoring: null, now: NOW }));
  });

  it("строка-заглушка: момент проверки во всех формах", () => {
    for (const момент of МОМЕНТЫ) {
      for (const источник of ["журнал прогонов", "очередь доставок"]) {
        проверить(`заглушка [${источник}] [проверено ${момент.имя}]`, () =>
          unavailableRow(FACES.fx, источник, момент.значение),
        );
      }
    }
  });

  it("перебор НЕ ВАКУУМЕН: зелёных строк заметно больше нуля", () => {
    /*
     * САМОЕ ВАЖНОЕ УТВЕРЖДЕНИЕ ФАЙЛА, и оно не про инвариант, а про сам перебор.
     * Все проверки выше — отрицательные («не зелёная без времени», «не бросили»,
     * «не NaN»), и мутация, после которой НИЧТО не зеленеет, оставила бы их
     * зелёными: доказывать было бы нечего. Поэтому считаем зелёные строки и
     * требуем, чтобы их было много.
     *
     * Порог — с большим запасом вниз от факта (сегодня перебор даёт 53 643
     * входа: 6 731 зелёная строка, 9 564 «сломано», 37 348 «не оценить»),
     * потому что он охраняет ПОРЯДОК ВЕЛИЧИНЫ,
     * а не число: точное совпадение пришлось бы править при каждом новом
     * варианте входа, и его бы правили не глядя.
     */
    assert.ok(счёт.всего > 20_000, `входов в переборе всего ${счёт.всего} — произведение форм не собралось`);
    assert.ok(счёт.зелёных > 2_000, `зелёных строк ${счёт.зелёных} — перебор доказывает пустоту`);
    assert.ok(счёт.сломано > 100, `строк «сломано» ${счёт.сломано} — плохие входы перестали быть плохими`);
    assert.ok(счёт.неОценить > 100, `строк «не оценить» ${счёт.неОценить}`);
  });
});
