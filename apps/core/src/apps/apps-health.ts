import { BOT_HEARTBEAT_MISS_LIMIT, RUN_OUTCOME_LABELS, isRunOutcome } from "@mydon/shared";

/**
 * Здоровье приложений словами (волна A2, R-A2-2; решения Р-3, Р-4, Р-5, Р-6).
 *
 * ЧИСТЫЕ ПРАВИЛА над УЖЕ ПРОЧИТАННЫМИ данными: ни одного запроса внутри.
 * Выборки живут в `apps-health.service.ts` — здесь только «что это значит».
 *
 * ТРИ СОСТОЯНИЯ, И «НЕ ОЦЕНИТЬ» — НЕ РАЗНОВИДНОСТЬ «В ПОРЯДКЕ» (Р-4). Весь
 * смысл файла в одном различии: отсутствие проверок и отсутствие ошибок
 * сегодня выглядят одинаково спокойно. Ноль прогонов, выключенный монитор,
 * ненастроенный источник и «расхождений 0, потому что сверять не с чем» — это
 * `unknown`, и ни одно из них не имеет права выглядеть зелёным.
 *
 * ФОРМУЛИРОВКИ ЦИТИРУЮТСЯ, А НЕ СОЧИНЯЮТСЯ. Те же случаи уже описаны словами
 * в боте (`apps/bot/src/analytics-brief.ts`: `состояниеСбора`, `строкаЗастоя`,
 * `строкаСнапшота`, `паритетСтрока`). Вторая формулировка того же состояния
 * разошлась бы с первой ровно там, где ошибка стоит дороже всего, — на пустых
 * данных.
 */

export const HEALTH_STATES = ["ok", "bad", "unknown"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export interface HealthRow {
  key: string;
  title: string;
  state: HealthState;
  /** Одна фраза по-русски: что именно известно об источнике. */
  summary: string;
  /** Цитата источника (итог прогона, ошибка доставки) — текстом, не разметкой. */
  detail?: string;
  /** Момент последнего события строки (ISO). Отсутствует, когда его честно нет. */
  at?: string;
  href?: string;
}

/** Заголовок строки и куда с неё уходить. */
export interface FaceMeta {
  key: string;
  title: string;
  href: string;
}

/**
 * Лица источников: ключ, заголовок и ссылка.
 *
 * Реестр, а не строки по месту: панель, смоук и тесты обязаны называть один и
 * тот же источник одним ключом, иначе «ourvend:sync» на экране и «ourvend» в
 * проверке разойдутся молча.
 */
export const FACES = {
  ourvendSync: { key: "ourvend:sync", title: "OurVend — сбор автоматов", href: "/vending" },
  ourvendAccounting: {
    key: "ourvend:accounting",
    title: "OurVend — учётный снимок",
    href: "/vending",
  },
  fx: { key: "fx:refresh", title: "Курс ЦБ РУз", href: "/flows?agent=system&skill=fx:refresh" },
  notion: { key: "notion", title: "Доставка в Notion", href: "/system" },
  bot: { key: "bot", title: "Telegram-бот", href: "/system" },
  llm: { key: "llm", title: "Модели (LLM)", href: "/system" },
  coffee: {
    key: "coffee:monitor",
    title: "Кофе-бункеры — данные Core",
    href: "/flows?agent=system&skill=coffee:monitor",
  },
  maintenance: {
    key: "maintenance:monitor",
    title: "Графики обслуживания — данные Core",
    href: "/flows?agent=system&skill=maintenance:monitor",
  },
  globerent: {
    key: "globerent:monitor",
    title: "Конвейер GLOBERENT — данные Core",
    href: "/flows?agent=system&skill=globerent:monitor",
  },
  /**
   * Сам слой агентов — лицо системы, а не только её частей (перепроверка
   * прода, корень 2). Одна строка «слой агентов не отчитывался N мин» вместо
   * восьми потемневших: владелец видит причину, а не восемь следствий.
   * Ведёт на `/crons` — там снимок расписаний и тот же чип о молчании.
   */
  agents: { key: "agents", title: "Слой агентов (mydon-agents)", href: "/crons" },
} as const satisfies Record<string, FaceMeta>;

/**
 * Ключи раздела «Снаружи» — ровно то, что ходит в чужую систему (Р-3).
 *
 * Список ПЕРЕЧИСЛЯЕТ внешние, а не исключает внутренние: незнакомый монитор
 * уедет во «внутренние» и не получит обещания связи, которой у него,
 * возможно, нет. `coffee:monitor`, `maintenance:monitor` и `globerent:monitor`
 * читают только Core: их «здоровье» — здоровье данных, а не связи.
 */
export const OUTSIDE_KEYS: readonly string[] = [
  FACES.ourvendSync.key,
  FACES.ourvendAccounting.key,
  FACES.fx.key,
  FACES.notion.key,
  FACES.bot.key,
  FACES.llm.key,
];

/** Строка монитора в снимке расписаний (`RunsService.snapshot()`). */
export interface MonitorSnapshotLite {
  enabled: boolean;
  reason?: "off" | "no_credentials";
  /**
   * Причина отключения СЛОВАМИ — из общего словаря доски рутин
   * (`DISABLED`/`disabledReasonText` в `routines/board.ts`), который называет
   * конкретную переменную окружения. Приходит готовой строкой, а не
   * пересобирается здесь: один код причины не должен нести в системе два
   * разных текста — иначе доска и панель отправят владельца чинить в разные
   * места. Пусто — словаря не спросили, и тогда объяснение общее.
   */
  disabledText?: string;
}

/** Последний прогон монитора из `agent_run` (`agent_name = "system"`). */
export interface MonitorRunLite {
  at: Date;
  outcome: string;
  reason: string;
}

export interface MonitorRowInput {
  /**
   * Снимок расписаний вообще опубликован (агенты отчитывались хоть раз).
   *
   * ОТДЕЛЬНО ОТ `monitor`, потому что это разные починки: снимка нет — не
   * запущен слой агентов; снимок есть, а монитора в нём нет — агенты работают
   * версией, которая про этот монитор не знает. Одна формулировка на два
   * случая отправила бы владельца искать не там.
   */
  snapshotPublished: boolean;
  /** `null` — монитора в снимке нет (или снимка нет вовсе, см. выше). */
  monitor: MonitorSnapshotLite | null;
  lastRun: MonitorRunLite | null;
  /**
   * Момент, после которого молчание монитора — уже не задержка тика: ВТОРОЙ
   * плановый запуск после последнего прогона (считает служба по cron снимка).
   * `null` — расписание неизвестно или битое, о молчании судить нечем.
   */
  silentAfter: Date | null;
  now: Date;
}

/** Что из отчёта `/ourvend/health` решает судьбу строки сбора. */
export interface OurvendSyncHealthLite {
  /** Сколько прогонов вообще в журнале сбора: ноль — «не оценить», а не «ок». */
  runs: number;
  failedStreak: number;
  lastSuccessAt: string | null;
  /**
   * СЫРЫЕ часы с последнего успеха — единственное, с чем сравнивается порог.
   * `staleHoursShown` округлён до 0,1 ч ДЛЯ ПОКАЗА, и сравнение по нему
   * двигало бы границу (авария 24.08.2026 началась ровно на этом сдвиге).
   */
  staleHoursRaw: number | null;
  staleHoursShown: number | null;
  staleThresholdH: number;
}

export interface OurvendSyncInput {
  snapshotPublished: boolean;
  monitor: MonitorSnapshotLite | null;
  lastRun: MonitorRunLite | null;
  /** `null` — отчёт не собрался: это «не оценить», а не «всё хорошо». */
  health: OurvendSyncHealthLite | null;
  now: Date;
}

export interface OurvendAccountingHealthLite {
  /** ГОТОВЫЙ вердикт Core, а не сравнение округлённого лага с порогом. */
  snapshotStale: boolean;
  salesLagShownH: number | null;
  parity: {
    mode: string;
    /** Сверенных пар продаж. Ноль — сверять было не с чем. */
    checked: number;
    mismatches: number;
    stockOk: boolean;
    /** Сверенных пар остатков. Ноль при `stockOk: false` — снимков за период нет. */
    stockChecked: number;
  };
}

export interface OurvendAccountingInput {
  snapshotPublished: boolean;
  monitor: MonitorSnapshotLite | null;
  lastRun: MonitorRunLite | null;
  health: OurvendAccountingHealthLite | null;
  /**
   * Момент второго пропущенного планового запуска — то же правило, что у
   * `MonitorRowInput.silentAfter`. `null` — расписание неизвестно или битое.
   *
   * ПОЧЕМУ ЭТОЙ СТРОКЕ ОН НУЖЕН ОТДЕЛЬНО (круг починок, C-5). Сбор
   * (`rowFromOurvendSync`) защищён от вставшего монитора застоем
   * `staleHoursRaw`, а учёт полагался ТОЛЬКО на `snapshotStale`, который
   * считается как `источник === "own" && …`
   * (`ourvend/ourvend-health.service.ts`). В штатном откате катовера
   * (`OURVEND_ACCOUNTING_SOURCE=stock`) он жёстко `false` по построению, режим
   * паритета — `mirror`, окно сверки 7 суток ещё держит `checked > 0` и
   * `stockOk`, — и строка отдавала `ok` («снимок свежий, сверка сходится») над
   * МЁРТВЫМ монитором несколько суток. Монитор при этом заведён независимо от
   * источника учёта (`apps/agents/src/index.ts`: гейт — учётка и cron), так
   * что вход достижим на штатной настройке.
   */
  silentAfter: Date | null;
  now: Date;
}

export interface OutboxRowInput {
  /**
   * Счётчики по статусам `outbox_delivery` за ВСЁ ВРЕМЯ; отсутствующий статус
   * — ноль. Годятся, чтобы НАЗВАТЬ числа, но не чтобы вынести вердикт: см.
   * моменты ниже.
   */
  counts: Readonly<Record<string, number>>;
  /** Момент самой старой НЕразобранной строки (`pending`/`dispatching`). */
  oldestPendingAt: Date | null;
  /**
   * Моменты ПОСЛЕДНЕГО закрытия доставки по каждому исходу (`completed_at`).
   *
   * ЗАЧЕМ ОНИ, ЕСЛИ ЕСТЬ СЧЁТЧИКИ (круг починок, A-2). Счётчики
   * бесконечны — ни окна, ни ретенции, — и вердикт по одному их НАЛИЧИЮ врёт в
   * обе стороны. Ключ Notion убрали из окружения агентов: каждая новая
   * доставка закрывается как `skipped`, но правило «не настроен» требовало
   * `пропущено === всего`, а в таблице лежат 200 старых `sent` — и строка
   * отдавала `ok` «доставлено 200, очередь разобрана · пропущено 50» над
   * источником, куда сегодня не ушло НИЧЕГО. Зеркально: одна давняя `dead`
   * держала строку красной навсегда, хотя доставки давно идут.
   *
   * Судим ПОРЯДКОМ, а не выдуманным окном в часах: «после последнего успеха
   * пропускали» и «после последнего успеха не дошло» — факты, у которых нет
   * произвольного порога. `null` — такого исхода не было ни разу.
   */
  lastSentAt: Date | null;
  lastSkippedAt: Date | null;
  /** Последний терминальный отказ: `dead` или `unknown` (запись могла задвоиться). */
  lastFailedAt: Date | null;
  now: Date;
}

export interface HeartbeatRowInput {
  lastAt: Date | null;
  intervalMs: number;
  now: Date;
}

export interface LlmMonitoringLite {
  meteredEnabled: boolean;
  hasActivePrice: boolean;
  provider: string;
  model: string;
  latestCompletedAt: string | null;
  /**
   * Чем закончился ПОСЛЕДНИЙ завершённый вызов (круг починок, A-3).
   *
   * До этой правки бралась только его дата, и строка отдавала `ok` «вызовы
   * проходят, отказов сегодня 137» при отозванном ключе провайдера: ledger
   * закрывает каждый вызов как `failed`, предохранитель на обычную ошибку
   * провайдера НЕ открывается (`monitoringOpenCircuits` строится по аномалиям
   * модели), а `latestCompleted` принимает и `failed` — значит все проверки
   * выше проходили. `null` — завершённых вызовов не было.
   */
  latestCompletedStatus: "settled" | "failed" | null;
  /** Причина отказа последнего вызова словом ledger (`provider_error`, …). */
  latestCompletedOutcome: string | null;
  stuckCount: number;
  openCircuits: number;
  failuresToday: number;
  budgetRemainingUsd: number;
  budgetCapUsd: number;
  configError?: string;
}

export interface LlmRowInput {
  monitoring: LlmMonitoringLite | null;
  now: Date;
}

const МИНУТА = 60_000;
const ЧАС = 3_600_000;

/**
 * С какого возраста самой старой неразобранной доставки очередь считается
 * вставшей.
 *
 * ЧАС, А НЕ ДЕСЯТЬ МИНУТ. Диспетчер Notion живёт внутри прохода агентов
 * (`pollAgentTasks`, по умолчанию раз в 5 минут) и забирает до 10 строк за
 * проход: всплеск в сотню доставок честно разбирается около часа, и порог
 * поменьше красил бы строку на нормальной работе. Час без движения — это уже
 * дюжина пропущенных проходов, то есть диспетчер не работает.
 */
export const OUTBOX_STUCK_MS = ЧАС;

function row(
  face: FaceMeta,
  state: HealthState,
  summary: string,
  detail?: string,
  at?: Date,
): HealthRow {
  return {
    key: face.key,
    title: face.title,
    state,
    summary,
    href: face.href,
    ...(detail !== undefined && detail !== "" ? { detail } : {}),
    ...(at !== undefined ? { at: at.toISOString() } : {}),
  };
}

/**
 * Источник, о котором нечего спрашивать: снимка нет или монитор выключен.
 *
 * ВОЗВРАЩАЕТ `unknown`, А НЕ `ok`, И СТОИТ ПЕРВЫМ ПРАВИЛОМ. Выключенный
 * монитор не падает и не жалуется — у него просто нет прогонов, и «ошибок
 * нет» о нём было бы правдой формы и ложью смысла. Причина берётся из снимка:
 * «выключен» и «не настроен» чинят по-разному.
 */
function молчаливыйИсточник(
  face: FaceMeta,
  snapshotPublished: boolean,
  monitor: MonitorSnapshotLite | null,
): HealthRow | null {
  if (monitor === null) {
    return snapshotPublished
      ? row(
          face,
          "unknown",
          "монитор не заявлен в снимке расписаний",
          "слой агентов о нём не сообщал: монитор снят из кода или на сервере работает старая версия агентов",
        )
      : row(
          face,
          "unknown",
          "агенты ещё не отчитывались: снимка расписаний в Core нет",
          "неизвестно даже, включён ли монитор — слой агентов ни разу не публиковал расписания",
        );
  }
  if (monitor.enabled) return null;
  if (monitor.reason === "no_credentials") {
    return row(
      face,
      "unknown",
      "источник не настроен: нет учётных данных",
      monitor.disabledText ?? "монитор не заводится, пока в окружении агентов нет учётной записи источника",
    );
  }
  if (monitor.reason === "off") {
    return row(
      face,
      "unknown",
      "монитор выключен в настройках",
      monitor.disabledText ?? "расписание снято владельцем или не принято при старте агентов",
    );
  }
  return row(face, "unknown", "монитор выключен", monitor.disabledText ?? "снимок расписаний не назвал причину");
}

/** Ярлык исхода словами общего словаря (`@mydon/shared`), а не второй формулировкой. */
function исходЯрлык(outcome: string): string {
  return isRunOutcome(outcome) ? RUN_OUTCOME_LABELS[outcome] : outcome;
}

/** Итог прогона одной фразой — для `detail`, где рядом не стоит слово «прогон». */
function исходСловами(run: MonitorRunLite): string {
  return `последний прогон — ${исходЯрлык(run.outcome)}: ${run.reason}`;
}

/**
 * Строка обычного монитора: снимок расписаний + последний прогон.
 *
 * ПОРЯДОК ПРАВИЛ: выключен → прогонов нет → молчит → упал → прошёл. «Молчит»
 * стоит ВЫШЕ исхода сознательно: `failedStreak = 0` держится вечно, если крон
 * перестал ЗАПУСКАТЬСЯ — он не падает, а молчит, и зелёная строка спокойно
 * стоит над мёртвым расписанием.
 */
export function rowFromMonitor(face: FaceMeta, input: MonitorRowInput): HealthRow {
  const молчит = молчаливыйИсточник(face, input.snapshotPublished, input.monitor);
  if (молчит !== null) return молчит;

  const run = input.lastRun;
  if (run === null) {
    return row(face, "unknown", "здоровье не оценить: монитор не запускался или журнал прогонов пуст");
  }
  if (input.silentAfter !== null && input.now.getTime() > input.silentAfter.getTime()) {
    return row(
      face,
      "bad",
      "монитор молчит: пропущено больше одного планового запуска",
      исходСловами(run),
      run.at,
    );
  }
  if (run.outcome === "failed") {
    return row(face, "bad", "последний прогон упал", run.reason, run.at);
  }
  if (run.outcome === "executed") {
    return row(face, "ok", "последний прогон прошёл", run.reason, run.at);
  }
  // `approval_requested` и `skipped` мониторы не пишут (`journaledMonitor`
  // знает только `executed`/`failed`), поэтому чужой исход — это не «плохо»
  // и не «хорошо», а «мы такого не ждали».
  return row(face, "unknown", `исход последнего прогона — ${исходЯрлык(run.outcome)}: оценить нечем`, run.reason, run.at);
}

/** Дата из ISO-строки, если она вообще дата: битая отбрасывается, а не роняет ответ. */
function разобрать(iso: string | null): Date | undefined {
  if (iso === null) return undefined;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

/** Момент, который строка про OurVend описывает: последний успех, иначе тик монитора. */
function ourvendAt(lastSuccessAt: string | null, lastRun: MonitorRunLite | null): Date | undefined {
  return разобрать(lastSuccessAt) ?? lastRun?.at;
}

/**
 * Сбор OurVend: прогоны, серия отказов, застой (R-A2-2).
 *
 * ПОРОГ СРАВНИВАЕТСЯ С `staleHoursRaw`, А НЕ С ПОКАЗАННЫМ ЧИСЛОМ. «5 ч 59 м
 * 49 с» округляются до ровно 6,0, и сравнение по показанному сдвинуло бы
 * границу на 11 секунд раньше настоящей. Источник истины по границе —
 * `rawStaleHours` (`ourvend/sync-runs.ts`), показанное число живёт только в
 * тексте.
 */
export function rowFromOurvendSync(face: FaceMeta, input: OurvendSyncInput): HealthRow {
  const молчит = молчаливыйИсточник(face, input.snapshotPublished, input.monitor);
  if (молчит !== null) return молчит;

  const h = input.health;
  if (h === null) {
    return row(face, "unknown", "здоровье не оценить: отчёт OurVend не собрался", undefined, input.lastRun?.at);
  }
  const at = ourvendAt(h.lastSuccessAt, input.lastRun);
  // Ни одного прогона — это третье состояние, а не «ошибок нет»: серия отказов
  // равна нулю просто потому, что сбор ни разу не запускался (цитата бота).
  if (h.runs === 0) {
    return row(face, "unknown", "здоровье не оценить: сбор не запускался или журнал прогонов пуст", undefined, at);
  }
  if (h.failedStreak > 0) {
    return row(
      face,
      "bad",
      `отказов подряд ${h.failedStreak} — сбор стоит, свежих данных нет`,
      input.lastRun !== null ? исходСловами(input.lastRun) : undefined,
      at,
    );
  }
  if (h.staleHoursRaw === null) {
    return row(face, "bad", "сбор стоит — успешных прогонов не было", undefined, at);
  }
  if (h.staleHoursRaw >= h.staleThresholdH) {
    const показ = Math.round(h.staleHoursShown ?? h.staleHoursRaw);
    return row(
      face,
      "bad",
      `сбор стоит ${показ} ч — порог ${h.staleThresholdH} ч`,
      input.lastRun !== null ? исходСловами(input.lastRun) : undefined,
      at,
    );
  }
  return row(
    face,
    "ok",
    "отказов подряд нет, данные свежие",
    input.lastRun !== null ? исходСловами(input.lastRun) : undefined,
    at,
  );
}

/**
 * Учётный снимок OurVend и сверка с зеркалом.
 *
 * СВЕРКА ЖИВЁТ В ЭТОЙ СТРОКЕ, А НЕ В ОТДЕЛЬНОЙ: сверять есть что ровно тогда,
 * когда этот агент довёз снимок, и «расхождений 0» — это утверждение о его
 * работе. Ноль расхождений БЕЗ СВЕРКИ «сходится» не значит: зелёная галка над
 * несравнёнными сутками — та же ложь, что зелёная галка над нулём прогонов.
 *
 * ПОРЯДОК ПРАВИЛ: выключен → отчёта нет → снимок встал → прогонов нет →
 * молчит → упал → выводы сверки. Первые пять называют поломку точнее любого
 * вывода о сверке, а сама сверка судит о прогоне, которого могло не быть.
 */
export function rowFromOurvendAccounting(face: FaceMeta, input: OurvendAccountingInput): HealthRow {
  const молчит = молчаливыйИсточник(face, input.snapshotPublished, input.monitor);
  if (молчит !== null) return молчит;

  const h = input.health;
  const at = input.lastRun?.at;
  if (h === null) {
    return row(face, "unknown", "здоровье не оценить: отчёт OurVend не собрался", undefined, at);
  }
  // Вердикт Core, а не сравнение округлённого лага с порогом: `snapshotStale`
  // считается по сырым часам и по ОБЕИМ половинам снимка (продажи и остатки).
  if (h.snapshotStale) {
    const давность =
      h.salesLagShownH === null ? "снимков продаж нет" : `снимок продаж — ${Math.round(h.salesLagShownH)} ч`;
    return row(
      face,
      "bad",
      "учётный снапшот OurVend не обновляется — продажи и остатки стоят",
      давность,
      at,
    );
  }
  if (input.lastRun === null) {
    return row(face, "unknown", "здоровье не оценить: монитор не запускался или журнал прогонов пуст");
  }
  // МОЛЧАНИЕ МОНИТОРА — ВЫШЕ ЛЮБОГО ВЫВОДА О СВЕРКЕ (круг починок, C-5). Ниже
  // «расхождений 0» и «снимок свежий» — утверждения о РАБОТЕ этого монитора, а
  // если он не запускается, они описывают позавчерашний день. То же правило и
  // тот же порог (второй пропущенный тик), что у `rowFromMonitor`.
  if (input.silentAfter !== null && input.now.getTime() > input.silentAfter.getTime()) {
    return row(
      face,
      "bad",
      "монитор молчит: пропущено больше одного планового запуска",
      исходСловами(input.lastRun),
      at,
    );
  }
  // ПОСЛЕДНИЙ ПРОГОН УПАЛ — «сломано»: то же правило и то же место цепочки,
  // что у `rowFromMonitor` (круг починок 2, Ф-1). Падающий монитор НЕ молчит:
  // он тикает по расписанию и каждый раз падает, поэтому проверка молчания
  // выше его не ловит; `snapshotStale` в штатном откате катовера
  // (`OURVEND_ACCOUNTING_SOURCE=stock`) жёстко `false` по построению, а на
  // сегодняшней проде (`own` + погашенное зеркало, `mode: "retired"`)
  // паритетного пояса нет вовсе. Строка отдавала `ok` «сверка сходится»,
  // цитируя В ТОЙ ЖЕ СТРОКЕ «последний прогон — упал»: зелёная лампа прямо
  // против собственного пояснения.
  //
  // ПОЧЕМУ ИМЕННО ЗДЕСЬ. Выше стоят диагнозы ТОЧНЕЕ («снапшот не
  // обновляется», «монитор молчит») — они называют владельцу конкретную
  // поломку, и падение прогона их не перекрывает. Ниже — выводы сверки, но
  // это утверждения о РАБОТЕ прогона, которого не было: числа паритета
  // описывают предыдущий, успешный проход, а `mode: "retired"` возвращает
  // `ok` вообще без проверок. Поэтому исход прогона решает раньше сверки.
  if (input.lastRun.outcome === "failed") {
    return row(face, "bad", "последний прогон упал", input.lastRun.reason, at);
  }

  const p = h.parity;
  // Зеркало погашено: сверять больше не с чем ШТАТНО, и «не оценить» здесь
  // читалось бы как авария конца катовера (R-FW-P3).
  if (p.mode === "retired") {
    return row(
      face,
      "ok",
      "снимок свежий; сверка с зеркалом завершена — сравнивать больше не с чем",
      исходСловами(input.lastRun),
      at,
    );
  }
  if (p.mismatches > 0) {
    return row(face, "bad", `сверка продаж: расхождений ${p.mismatches}`, исходСловами(input.lastRun), at);
  }
  if (!p.stockOk && p.stockChecked > 0) {
    return row(face, "bad", "сверка остатков: расходится", исходСловами(input.lastRun), at);
  }
  const продажНеСверены = p.checked === 0;
  const остаткиНеСверены = !p.stockOk && p.stockChecked === 0;
  if (продажНеСверены || остаткиНеСверены) {
    const части = [
      продажНеСверены ? "продажи: сверять нечего" : null,
      остаткиНеСверены ? "остатки: снимков за период нет — сверять не по чему" : null,
    ].filter((ч): ч is string => ч !== null);
    return row(
      face,
      "unknown",
      `снимок свежий, но сверка ничего не сравнила (${части.join(" · ")})`,
      "расхождений 0 здесь значит «не с чем сравнивать», а не «сошлось»",
      at,
    );
  }
  return row(
    face,
    "ok",
    `снимок свежий, сверка сходится (пар продаж ${p.checked}, остатков ${p.stockChecked})`,
    исходСловами(input.lastRun),
    at,
  );
}

/** Исход `a` случился ПОЗЖЕ исхода `b` (или `b` не случался вовсе)? */
function позже(a: Date | null, b: Date | null): boolean {
  if (a === null) return false;
  return b === null || a.getTime() > b.getTime();
}

/**
 * Очередь доставок наружу (Notion) — по счётчикам `outbox_delivery`.
 *
 * ПУСТАЯ ТАБЛИЦА — НЕ «ОЧЕРЕДЬ РАЗОБРАНА». Ноль строк означает, что в очередь
 * ничего не клали: доставок ещё не было, и оценивать нечего.
 *
 * СЧЁТЧИКИ НАЗЫВАЮТ ЧИСЛА, ВЕРДИКТ ВЫНОСИТ ПОРЯДОК ИСХОДОВ (круг починок, A-2).
 * Таблица бесконечна, и «в ней есть `skipped`» / «в ней есть `dead`» — не
 * утверждения о сегодняшнем дне: первое молчало после первой же успешной
 * доставки, второе краснело вечно после первой же неудачной. Спрашиваем не
 * «бывало ли», а «случилось ли это ПОСЛЕ последнего успеха».
 */
export function rowFromOutbox(face: FaceMeta, input: OutboxRowInput): HealthRow {
  const счёт = (status: string): number => input.counts[status] ?? 0;
  const всего = Object.values(input.counts).reduce((a, b) => a + b, 0);
  if (всего === 0) {
    return row(face, "unknown", "доставок ещё не было", "в очереди нет ни одной строки — ни успешной, ни отказавшей");
  }
  const тупик = счёт("dead");
  // `unknown` — исход, при котором мы НЕ ЗНАЕМ, дошла ли запись: повтор мог бы
  // задвоить её на той стороне. Тот же список, по которому будит владельца
  // сторож ledger (индекс `outbox_delivery_alert_terminal_idx`: unknown или dead).
  const неясно = счёт("unknown");
  const пропущено = счёт("skipped");
  const очередь = счёт("pending") + счёт("dispatching");
  const ушло = счёт("sent");
  const хвостПропусков = пропущено > 0 ? ` · пропущено ${пропущено}` : "";
  const итого = `всего строк доставки ${всего}`;

  const части = [
    тупик > 0 ? `в тупике ${тупик}` : null,
    неясно > 0 ? `с неизвестным исходом ${неясно}` : null,
  ].filter((ч): ч is string => ч !== null);
  // Отказ СВЕЖИЙ: после него ни одна доставка не ушла. Старый отказ, за
  // которым доставки пошли, красным быть не должен — но и исчезнуть не может,
  // и ниже он назван в `detail`. `lastSentAt === null` — успехов не было
  // вовсе: тогда отказ свежий по определению, каким бы ни был его момент
  // (страховка от строки без `completed_at`).
  if (части.length > 0 && (input.lastSentAt === null || позже(input.lastFailedAt, input.lastSentAt))) {
    return row(
      face,
      "bad",
      `доставки не дошли: ${части.join(" · ")}${хвостПропусков}`,
      итого,
      input.lastFailedAt ?? input.oldestPendingAt ?? undefined,
    );
  }

  // ОЧЕРЕДЬ, КОТОРУЮ НИКТО НЕ РАЗБИРАЕТ, — ЭТО НЕ «В ПОРЯДКЕ». Диспетчер не
  // падает, а молчит: строки остаются `pending` навсегда, ни один статус не
  // становится плохим, и «в очереди 500» спокойно зеленеет. Та же ловушка, что
  // у замолчавшего крона монитора, и то же лекарство — возраст, а не статус.
  const застряло = input.oldestPendingAt;
  if (застряло !== null && input.now.getTime() - застряло.getTime() > OUTBOX_STUCK_MS) {
    const часов = Math.round((input.now.getTime() - застряло.getTime()) / ЧАС);
    return row(
      face,
      "bad",
      `очередь не разбирается: в ней ${очередь}, самой старой ${часов} ч${хвостПропусков}`,
      `${итого}; доставщик забирает партию раз в проход агентов — час без движения означает, что он не работает`,
      застряло,
    );
  }

  // ПРОПУСКАЮТ СЕЙЧАС — ЭТО «НЕ НАСТРОЕНО», А НЕ «ДОСТАВЛЕНО 0». Диспетчер
  // закрывает доставку статусом `skipped` ровно в одном случае: конфигурации
  // Notion нет (`apps/agents/src/outbox-dispatcher.ts`, «Notion не настроен»).
  // Условие — ПОСЛЕДНИЙ пропуск свежее последнего успеха, а не «пропущено ==
  // всего»: прежнее правило молчало ровно в том случае, ради которого его
  // писали, — когда ключ убрали у уже работавшего источника.
  // `пропущено === всего` остаётся вторым поясом: если у строк почему-то нет
  // `completed_at`, порядок исходов неизвестен, а вывод «не настроен» верен.
  if (пропущено > 0 && (пропущено === всего || позже(input.lastSkippedAt, input.lastSentAt))) {
    return row(
      face,
      "unknown",
      `источник не настроен: доставки пропускаются, пропущено ${пропущено}`,
      "диспетчер закрывает доставку как «пропущена», пока в окружении агентов нет ключа и базы Notion" +
        (ушло > 0 ? `; после последней успешной доставки не ушло ни одной (успешных всего ${ушло})` : ""),
      input.lastSkippedAt ?? input.oldestPendingAt ?? undefined,
    );
  }

  // Доставки идут. Старые отказы НЕ красят строку, но и не пропадают: запись,
  // не дошедшая до Notion, разбирается вручную, и число обязано остаться на
  // экране — иначе «зелено» означало бы «всё дошло».
  const хвостОтказов =
    части.length > 0 ? `; до последней успешной доставки — ${части.join(" · ")}: разбери вручную` : "";
  return row(
    face,
    "ok",
    (очередь > 0 ? `в очереди ${очередь}, доставлено ${ушло}` : `доставлено ${ушло}, очередь разобрана`) +
      хвостПропусков,
    итого + хвостОтказов,
    input.oldestPendingAt ?? undefined,
  );
}

/**
 * Жив ли Telegram-поллер (Р-5): heartbeat раз в пять минут.
 *
 * Offset опроса живёт в памяти процесса, и если поллер молча упал, в базе об
 * этом не скажет ничто, кроме отсутствия этих событий. Отсутствие событий
 * ВООБЩЕ — «не отчитывался», а не «молчит»: бот мог просто ни разу не
 * запуститься с этой версией.
 */
export function rowFromHeartbeat(face: FaceMeta, input: HeartbeatRowInput): HealthRow {
  if (input.lastAt === null) {
    return row(
      face,
      "unknown",
      "бот ещё не отчитывался: heartbeat в журнале не появлялся",
      "поллер либо не запускался, либо работает версией без heartbeat",
    );
  }
  const возраст = Math.max(0, input.now.getTime() - input.lastAt.getTime());
  const минут = Math.round(возраст / МИНУТА);
  if (возраст > input.intervalMs * BOT_HEARTBEAT_MISS_LIMIT) {
    return row(
      face,
      "bad",
      `бот молчит ${минут} мин — поллер, скорее всего, не работает`,
      `сигнал ждём каждые ${Math.round(input.intervalMs / МИНУТА)} мин`,
      input.lastAt,
    );
  }
  return row(face, "ok", `бот отвечает: последний сигнал ${минут} мин назад`, undefined, input.lastAt);
}

/**
 * Ledger моделей: может ли система вообще звать провайдера.
 *
 * СПИСОК ПОВОДОВ ПОКРАСНЕТЬ — ТОТ ЖЕ, ЧТО У СТОРОЖА `LlmAlertMonitorService`
 * (предохранитель, зависшие резервы, потолок, неверная настройка). Голое
 * число отказов за день в этот список не входит: один 429 от провайдера — не
 * авария, и красить им строку значило бы приучить владельца её не замечать.
 */
export function rowFromLlm(face: FaceMeta, input: LlmRowInput): HealthRow {
  const m = input.monitoring;
  if (m === null) return row(face, "unknown", "здоровье не оценить: монитор ledger не ответил");
  // Момент последнего завершённого вызова — только если он разбирается: битая
  // строка ушла бы в `toISOString()` и уронила бы весь ответ.
  const at = разобрать(m.latestCompletedAt);

  if (!m.meteredEnabled) {
    return row(
      face,
      "unknown",
      "метрируемый маршрут моделей выключен — оценивать нечего",
      "платные вызовы отключены настройкой: ни расхода, ни отказов быть не может",
    );
  }
  if (m.configError !== undefined && m.configError !== "") {
    return row(face, "bad", "дневной потолок задан неверно — ledger закрыт", m.configError);
  }
  if (!m.hasActivePrice) {
    return row(
      face,
      "bad",
      `нет действующей цены на ${m.provider}/${m.model} — ledger отклонит каждый вызов`,
      "модели «включены», но молча не работают: заведи цену в каталоге",
      at,
    );
  }
  if (m.openCircuits > 0) {
    return row(face, "bad", `провайдер отключён предохранителем (${m.openCircuits})`, undefined, at);
  }
  if (m.stuckCount > 0) {
    return row(face, "bad", `зависших резервов ${m.stuckCount} — исход вызова неизвестен`, undefined, at);
  }
  if (m.budgetCapUsd <= 0) {
    return row(face, "bad", "дневной потолок нулевой — ledger отклонит каждый вызов", undefined, at);
  }
  if (m.budgetRemainingUsd <= 0) {
    return row(face, "bad", "дневной потолок исчерпан — вызовы до полуночи отклоняются", undefined, at);
  }
  // Ни одного завершённого вызова: «отказов нет» здесь — та же ложь, что ноль
  // прогонов у монитора.
  if (m.latestCompletedAt === null) {
    return row(face, "unknown", "завершённых вызовов не было — оценивать нечего");
  }
  // ПОСЛЕДНИЙ ЗАВЕРШЁННЫЙ ВЫЗОВ ОТКАЗАЛ — «вызовы проходят» сказать нельзя
  // (A-3). Утверждение строки касается не истории, а того, может ли система
  // позвать провайдера ПРЯМО СЕЙЧАС: успешных вызовов после этого отказа не
  // было, и это самое свежее, что о маршруте к модели известно. Голое число
  // отказов за день красным по-прежнему не красит (один 429 — не авария): там
  // рядом стоял УСПЕШНЫЙ последний вызов, здесь его нет.
  if (m.latestCompletedStatus === "failed") {
    const почему = m.latestCompletedOutcome !== null ? ` (${m.latestCompletedOutcome})` : "";
    return row(
      face,
      "bad",
      `последний завершённый вызов отказал${почему} — успешных после него не было`,
      `отказов сегодня ${m.failuresToday}; предохранитель провайдера при обычной ошибке не открывается, ` +
        "поэтому строка судит по исходу последнего вызова, а не по нему",
      at,
    );
  }
  return row(
    face,
    "ok",
    `вызовы проходят, отказов сегодня ${m.failuresToday}`,
    `остаток дневного потолка ${m.budgetRemainingUsd.toFixed(2)} из ${m.budgetCapUsd.toFixed(2)} USD`,
    at,
  );
}

/**
 * Молчание слоя агентов, от которого зависит строка: возраст снимка расписаний
 * (по правилу доски рутин, `snapshotFreshness`) и момент последнего отчёта.
 */
export interface LayerSilence {
  ageSec: number;
  reportedAt: Date;
}

/**
 * Чем строка обязана слою агентов — для `detail`, чтобы владелец видел, почему
 * потемнела именно она. Одна строка на вид зависимости, а не текст по месту.
 */
export const LAYER_DEPENDENCY = {
  monitor: "монитор запускается в слое агентов",
  ourvend: "сбор и учётный монитор OurVend запускаются в слое агентов",
  outbox: "диспетчер доставок живёт в слое агентов (проход задач)",
} as const;

/**
 * Строка источника, чьё здоровье делает слой агентов, пока сам слой молчит
 * (перепроверка прода, корень 2).
 *
 * `unknown`, А НЕ ПРЕЖНИЙ ВЕРДИКТ. «Последний прогон прошёл» и «очередь
 * разобрана» — утверждения о работе, которую делает процесс, а процесс не
 * отчитывается: они описывают позавчерашний день. Контейнер агентов, умерший
 * после всех суточных мониторов, держал пять таких строк зелёными до ВТОРОГО
 * пропущенного тика (~45 ч), а Notion — бессрочно (диспетчер мёртв, новых
 * строк нет). Это тот же класс, что heartbeat бота (A-1): сигнал доказывал
 * «последний тик был хорош», а не «слой жив».
 *
 * Слово — то же, что на `/crons` («агенты не отчитывались N мин»), и минуты
 * считаются так же (`Math.round(ageSec / 60)`): два экрана не должны спорить
 * о том, жив ли слой.
 */
export function rowFromSilentLayer(face: FaceMeta, silence: LayerSilence, зависимость: string): HealthRow {
  return row(
    face,
    "unknown",
    `слой агентов не отчитывался ${минуты(silence.ageSec)} мин — оценить нечем`,
    `${зависимость}; снимок расписаний перестал обновляться — проверь контейнер mydon-agents`,
    silence.reportedAt,
  );
}

export interface AgentsLayerInput {
  /** Свежесть снимка по правилу доски рутин; `null` — снимка нет вовсе. */
  freshness: { ageSec: number; stale: boolean; reportedAt: Date } | null;
  /** Порог доски (`STALE_AFTER_SEC`), чтобы фраза называла число, по которому решено. */
  staleAfterSec: number;
}

/**
 * Жив ли слой агентов — по возрасту снимка расписаний, как бот по heartbeat.
 *
 * Снимок — единственный сигнал, который рантайм агентов шлёт в Core сам,
 * без повода (`apps/agents/src/index.ts`, тик опроса), поэтому он и heartbeat.
 * Три состояния те же, что у бота: не отчитывался вовсе — «не оценить», а не
 * «молчит» (слой мог ни разу не запуститься с этой версией); старше порога —
 * «сломано»; свежий — «в порядке» с давностью.
 */
export function rowFromAgentsLayer(face: FaceMeta, input: AgentsLayerInput): HealthRow {
  const f = input.freshness;
  if (f === null) {
    return row(
      face,
      "unknown",
      "агенты ещё не отчитывались: снимка расписаний в Core нет",
      "рантайм публикует снимок при старте и каждым тиком опроса — проверь, запущен ли контейнер mydon-agents",
    );
  }
  const порог = минуты(input.staleAfterSec);
  if (f.stale) {
    return row(
      face,
      "bad",
      `слой агентов не отчитывался ${минуты(f.ageSec)} мин — снимок расписаний протух`,
      `порог молчания ${порог} мин, снимок ждём каждым тиком опроса; проверь контейнер mydon-agents`,
      f.reportedAt,
    );
  }
  return row(
    face,
    "ok",
    `слой агентов отчитывался ${минуты(f.ageSec)} мин назад`,
    `снимок расписаний свежий (порог молчания ${порог} мин)`,
    f.reportedAt,
  );
}

/** Секунды → минуты тем же округлением, что чип на `/crons` (`Math.round(ageSec / 60)`). */
function минуты(sec: number): number {
  return Math.round(sec / 60);
}

/**
 * Источник не прочитался: строка честно говорит об этом, а не исчезает.
 *
 * Пропавшая строка читается как «такого источника нет», а `ok` по умолчанию —
 * как «всё хорошо». Оба варианта хуже, чем «оценить нечем».
 *
 * ТЕКСТ ИСКЛЮЧЕНИЯ СЮДА НЕ ПОПАДАЕТ (постановление ветки). Сообщения драйвера
 * несут хост и пользователя базы, а наружу едет НАШ ярлык прочитанного
 * («снимок расписаний»); причина отказа пишется только в журнал Core. Маршрут
 * с тех пор закрыт токеном (`ReadTokenGuard`, круг починок C-1), но ярлык
 * остаётся вторым поясом: держатель сервисного токена — это ещё и бот, и
 * агенты, и им строка подключения к базе Core ни к чему.
 */
export function unavailableRow(face: FaceMeta, источник: string): HealthRow {
  return row(
    face,
    "unknown",
    "источник не отвечает — оценить нечем",
    `не прочитано: ${источник}. Причина записана в журнал Core.`,
  );
}

/** Разделы по природе связи (Р-3): «снаружи» — только то, что ходит в чужую систему. */
export function splitSections(rows: readonly HealthRow[]): {
  outside: HealthRow[];
  internal: HealthRow[];
} {
  const outside: HealthRow[] = [];
  const internal: HealthRow[] = [];
  for (const r of rows) {
    if (OUTSIDE_KEYS.includes(r.key)) outside.push(r);
    else internal.push(r);
  }
  return { outside, internal };
}
