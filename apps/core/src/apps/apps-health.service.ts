import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { outboxDelivery } from "@mydon/db";
import { BOT_HEARTBEAT_INTERVAL_MS, BOT_HEARTBEAT_SOURCE, BOT_HEARTBEAT_TYPE, TZ } from "@mydon/shared";
import { DB, type Db } from "../db/db.module";
import { EventsService } from "../events/events.service";
import { LlmLedgerService } from "../llm-ledger/llm-ledger.service";
import { HEALTH_RUNS_DEFAULT, OurvendHealthService } from "../ourvend/ourvend-health.service";
import { rawStaleHours } from "../ourvend/sync-runs";
import { STALE_AFTER_SEC, disabledReasonText, nextOccurrences, snapshotFreshness } from "../routines/board";
import { RunsService } from "../routines/runs.service";
import {
  FACES,
  LAYER_DEPENDENCY,
  rowFromAgentsLayer,
  rowFromHeartbeat,
  rowFromLlm,
  rowFromMonitor,
  rowFromOurvendAccounting,
  rowFromOurvendSync,
  rowFromOutbox,
  rowFromSilentLayer,
  splitSections,
  unavailableRow,
  позднееИз,
  сведенияОПроверкеДоставок,
  сведенияОПроверкеМонитора,
  сведенияОПроверкеСбора,
  сведенияОПроверкеСлоя,
  сведенияОПроверкеУчёта,
  type FaceMeta,
  type HealthRow,
  type LayerSilence,
  type MonitorRunLite,
  type MonitorSnapshotLite,
  type OurvendAccountingHealthLite,
  type OurvendSyncHealthLite,
  type ПрочитанныйПрогон,
} from "./apps-health";

/**
 * Сборка здоровья приложений (волна A2, R-A2-2; решение Р-6).
 *
 * ОДНА ДВЕРЬ ДЛЯ ПАНЕЛИ. До этого среза здоровье было размазано по шести
 * адресам (`/ourvend/health`, `/llm-ledger/monitoring`, снимок расписаний,
 * журнал прогонов, у outbox не было GET вовсе, у бота — ничего), и панель
 * либо ходила бы по всем, либо повторяла бы правила оценки у себя. Правила
 * живут в `apps-health.ts` чистыми функциями, здесь — только выборки.
 *
 * КАЖДЫЙ ИСТОЧНИК В СВОЁМ `catch`. Витрина, которая гаснет целиком из-за
 * одной из девяти строк, хуже витрины, которая честно говорит, какая строка не
 * посчиталась (тот же приём, что у паритета внутри `OurvendHealthService`).
 * Недоступность источника даёт ЕГО строке «не оценить» с причиной, а не 500 на
 * весь ответ.
 *
 * ВОЗРАСТ СНИМКА — СИГНАЛ ЖИЗНИ СЛОЯ АГЕНТОВ (перепроверка прода, корень 2).
 * `RunsService.snapshot()` отдаёт `{payload, updatedAt}`, и до этой правки
 * `updatedAt` здесь не читался нигде: из снимка брались только мониторы и
 * булево «снимок есть». Рантайм переписывает снимок каждым тиком именно как
 * heartbeat, доска рутин красит его протухшим через `STALE_AFTER_SEC` — а
 * здоровье над мёртвым слоем оставалось «в порядке 8 · сломано 0» до второго
 * пропущенного тика суточных мониторов, то есть почти двое суток. Порог и
 * арифметика — ТЕ ЖЕ, что у доски (`snapshotFreshness`), не своя копия числа.
 */

/** Единственное назначение доставок сегодня; новое потребует своего лица. */
const NOTION_DESTINATION = "notion-report";

/**
 * Мониторы, у которых нет своего разбора: строка целиком из снимка и журнала.
 * Ключ лица здесь совпадает с именем монитора в снимке расписаний.
 */
const ПРОСТЫЕ_МОНИТОРЫ: readonly FaceMeta[] = [
  FACES.fx,
  FACES.coffee,
  FACES.maintenance,
  FACES.globerent,
];

export interface AppsHealthView {
  tz: typeof TZ;
  now: string;
  outside: HealthRow[];
  internal: HealthRow[];
}

/**
 * Итог чтения источника: значение либо ЯРЛЫК того, что не прочиталось.
 *
 * Именно ярлык, а не текст исключения: сообщение драйвера несёт хост и
 * пользователя базы (постановление ветки). Маршрут с тех пор закрыт токеном
 * (`ReadTokenGuard`, круг починок C-1), но ярлык остаётся: сервисный токен
 * держат ещё бот и агенты, а строка подключения к базе Core им ни к чему.
 */
type Чтение<T> = { ok: true; value: T } | { ok: false; источник: string };

interface МониторСнимка extends MonitorSnapshotLite {
  cron: string;
}

interface СчётДоставок {
  counts: Record<string, number>;
  oldestPendingAt: Date | null;
  lastSentAt: Date | null;
  lastSkippedAt: Date | null;
  lastFailedAt: Date | null;
}

@Injectable()
export class AppsHealthService {
  private readonly logger = new Logger(AppsHealthService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly runs: RunsService,
    private readonly ourvend: OurvendHealthService,
    private readonly llm: LlmLedgerService,
    private readonly events: EventsService,
  ) {}

  /**
   * `now` — параметр, а не `Date.now()` внутри: от него считаются молчание
   * монитора и возраст heartbeat, и тест обязан уметь задать момент.
   */
  async health(now = new Date()): Promise<AppsHealthView> {
    // Всё параллельно: шесть независимых чтений, и последовательный `await`
    // добавил бы задержку ровно там, где владелец обновляет страницу.
    const [расписания, прогоны, ourvend, ledger, доставки, сигнал] = await Promise.all([
      this.попытка("снимок расписаний", () => this.runs.snapshot()),
      this.попытка("журнал прогонов", () => this.runs.lastPerJob()),
      // Тот же размер выборки, что у `/ourvend/health`: отчёт кеширован на
      // минуту по ключу «прогоны|минута», и своё число завело бы второй кеш.
      this.попытка("отчёт OurVend", () => this.ourvend.health(HEALTH_RUNS_DEFAULT, now)),
      this.попытка("монитор ledger", () => this.llm.monitoring(now)),
      this.попытка("очередь доставок", () => this.счётДоставок()),
      this.попытка("heartbeat бота", () =>
        this.events.latest({ source: BOT_HEARTBEAT_SOURCE, type: BOT_HEARTBEAT_TYPE }),
      ),
    ]);

    const мониторы = снимокМониторов(расписания);
    /*
     * ЧТО ГОВОРИТЬ О ПРОВЕРКАХ, КОГДА ЧТЕНИЕ ОТКАЗАЛО (круг починок среза Д1,
     * Ф-1; дверь одна — десятый круг).
     *
     * `базаОтказала` поднимается на отказе снимка ЛИБО журнала прогонов, и
     * ответ о проверках зависит от того, ЧТО ИМЕННО не прочиталось. Служба
     * этого больше не решает: она отдаёт двери правил (`сведенияОПроверке*`)
     * то, что успела прочитать, — строку журнала, «журнал прочитан, строки
     * нет» или «журнал не прочитан», а для ОБЕИХ строк OurVend ещё и отчёт
     * (`сведенияОПроверкеУчёта` появилась в одиннадцатом круге: у учёта та же
     * ложь стояла на строку ниже), — и дверь отвечает так же, как ответила бы
     * правилу на полном входе. Свой ответ у службы был (`проверкаПоЖурналу`),
     * считанный по одному журналу, и при отказе снимка он печатал «не
     * запускался» над отчётом с двадцатью прогонами, который лежал в
     * `ourvend.value` и не спрашивался.
     *
     * НЕЧИТАЕМЫЙ МОМЕНТ НА ГРАНИЦЕ — «НЕ ЗНАЕМ», А НЕ «НИ РАЗУ». Строка
     * прогона с испорченным `started_at` доезжает сюда КАК СТРОКА
     * (`последниеПрогоны` отдаёт её с `at: null`), и дверь считает её
     * свидетельством: журнал прочитан, прогон в нём есть, назвать его нечем.
     * Отбрасывание такой строки на границе — как делалось раньше — превращало
     * бы пересчёт в фолбэк: ноль получался бы не потому, что журнал пуст, а
     * потому, что строку выкинули по дороге.
     */
    const журналПрочитан = отказ(прогоны) === null;
    const последние = последниеПрогоны(прогоны);
    const прочитанныйПрогон = (key: string): ПрочитанныйПрогон =>
      журналПрочитан ? (последние.get(key) ?? null) : "журнал не прочитан";
    // Снимок опубликован хоть раз: отличает «слой агентов не запущен» от
    // «агенты работают, но про этот монитор не сообщали».
    const снимокЕсть = расписания.ok && расписания.value !== null;
    // Свежесть снимка — правилом доски рутин: один порог на `/crons` и `/apps`.
    const свежесть =
      расписания.ok && расписания.value !== null ? snapshotFreshness(расписания.value.updatedAt, now) : null;
    // Слой молчит: все строки, чьё здоровье делает этот слой, ниже отвечают
    // одной причиной вместо своих вчерашних вердиктов.
    const слойМолчит: LayerSilence | null =
      свежесть !== null && свежесть.stale ? { ageSec: свежесть.ageSec, reportedAt: свежесть.reportedAt } : null;
    const базаОтказала = отказ(расписания) ?? отказ(прогоны);

    const строкаМонитора = (face: FaceMeta): HealthRow => {
      const lastRun = последние.get(face.key) ?? null;
      // МОМЕНТ ПРОВЕРКИ ОТДАЁМ И В ОТКАЗЕ ЧТЕНИЯ. Не прочитался только снимок —
      // журнал на руках и тик монитора известен; не прочитался сам журнал — о
      // проверках не известно ничего, и на экране это РАЗНЫЕ слова.
      if (базаОтказала !== null) {
        return unavailableRow(face, базаОтказала, сведенияОПроверкеМонитора(прочитанныйПрогон(face.key)));
      }
      // МОЛЧАНИЕ СЛОЯ ГАСИТ ВЕРДИКТ, НО НЕ ЗНАНИЕ О ПРОВЕРКАХ (слияние A2-fix и
      // Д1). «Последний прогон прошёл» над мёртвым слоем — вчерашний день, а вот
      // тик из `agent_run` прочитан и никуда не делся: дверь свидетельств у
      // строки та же, что и в штатной ветке.
      if (слойМолчит !== null) {
        return rowFromSilentLayer(
          face,
          слойМолчит,
          LAYER_DEPENDENCY.monitor,
          сведенияОПроверкеМонитора(прочитанныйПрогон(face.key)),
        );
      }
      const снимок = мониторы.get(face.key) ?? null;
      return rowFromMonitor(face, {
        snapshotPublished: снимокЕсть,
        monitor: снимок,
        lastRun,
        silentAfter: молчитПосле(снимок, lastRun),
        now,
      });
    };

    const rows: HealthRow[] = [
      // Слой агентов — первой строкой «внутренних»: он условие всех строк ниже,
      // и одна его строка называет причину там, где восемь назвали бы следствия.
      расписания.ok
        ? rowFromAgentsLayer(FACES.agents, { freshness: свежесть, staleAfterSec: STALE_AFTER_SEC })
        // Снимок не прочитан: о собственных отчётах слоя не известно ничего.
        // ОТВЕТ БЕРЁТСЯ У ДВЕРИ, А НЕ ПИШЕТСЯ ЛИТЕРАЛОМ (ревью слияния, M-2):
        // `свежесть` на этой ветке `null` по построению (строка 173 — она
        // считается только при `расписания.ok`), поэтому дверь отвечает «не
        // знаем» сама. Литерал давал тот же ответ, но ВТОРЫМ местом: правка
        // правила свидетельств разошлась бы со службой молча — ровно тот
        // дефект, от которого файл избавлялся три круга подряд.
        : unavailableRow(FACES.agents, расписания.источник, сведенияОПроверкеСлоя(свежесть)),
      this.строкаСбора(мониторы, прочитанныйПрогон, ourvend, базаОтказала, слойМолчит, снимокЕсть, now),
      this.строкаУчёта(мониторы, прочитанныйПрогон, ourvend, базаОтказала, слойМолчит, снимокЕсть, now),
      ...ПРОСТЫЕ_МОНИТОРЫ.map((face) => строкаМонитора(face)),
      // Очередь Notion разбирает диспетчер внутри прохода задач агентов: над
      // мёртвым слоем «очередь разобрана» держалось бы бессрочно — новых строк
      // никто не кладёт, а старые не стареют. Бот и модели от слоя не зависят:
      // бот — отдельный процесс со своим heartbeat, вызовы моделей делают и
      // бот, и панель, и документы (`LLM_LEDGER_CONSUMERS`), не только агенты.
      !доставки.ok
        // Счётчики не прочитаны: о проходах диспетчера не известно ничего.
        ? unavailableRow(FACES.notion, доставки.источник, "не знаем")
        : слойМолчит !== null
          // Закрытые доставки из таблицы от молчания слоя не исчезают — дверь
          // свидетельств та же, что у штатной ветки ниже.
          ? rowFromSilentLayer(
              FACES.notion,
              слойМолчит,
              LAYER_DEPENDENCY.outbox,
              сведенияОПроверкеДоставок({ ...доставки.value, now }),
            )
          : rowFromOutbox(FACES.notion, { ...доставки.value, now }),
      сигнал.ok
        ? rowFromHeartbeat(FACES.bot, {
            // Нечитаемый момент события — это «сигнала не было», а не «бот
            // отвечает NaN мин назад»: `возраст` ушёл бы в NaN, сравнение с
            // порогом дало бы `false`, и строка зазеленела бы БЕЗ времени
            // проверки. Тот же пояс, что у прогонов выше.
            lastAt: дата(сигнал.value?.occurredAt ?? null),
            intervalMs: BOT_HEARTBEAT_INTERVAL_MS,
            now,
          })
        // Журнал событий не прочитан: о сигналах бота не известно ничего.
        : unavailableRow(FACES.bot, сигнал.источник, "не знаем"),
      ledger.ok
        ? rowFromLlm(FACES.llm, { monitoring: ledgerСловами(ledger.value), now })
        // Монитор ledger не ответил: о завершённых вызовах не известно ничего.
        : unavailableRow(FACES.llm, ledger.источник, "не знаем"),
      // Монитор, которого нет в реестре лиц: молча пропасть с экрана он не
      // должен — строку получает, но во «внутренних» (splitSections), потому
      // что про связь с чужой системой у него ничего не известно.
      ...[...мониторы.keys()]
        .filter((name) => !ИЗВЕСТНЫЕ_МОНИТОРЫ.has(name))
        .sort()
        // Имя монитора приезжает из тела `PUT /routines/snapshot`, поэтому в
        // ссылку оно уходит закодированным, а не подклеенным как есть.
        .map((name) =>
          строкаМонитора({
            key: name,
            title: name,
            href: `/flows?agent=system&skill=${encodeURIComponent(name)}`,
          }),
        ),
    ];

    const { outside, internal } = splitSections(rows);
    return { tz: TZ, now: now.toISOString(), outside, internal };
  }

  /** Сбор OurVend: снимок расписаний + журнал прогонов + отчёт `/ourvend/health`. */
  private строкаСбора(
    мониторы: Map<string, МониторСнимка>,
    прочитанныйПрогон: (key: string) => ПрочитанныйПрогон,
    ourvend: Чтение<Awaited<ReturnType<OurvendHealthService["health"]>>>,
    базаОтказала: string | null,
    слойМолчит: LayerSilence | null,
    снимокЕсть: boolean,
    now: Date,
  ): HealthRow {
    const face = FACES.ourvendSync;
    const прогон = прочитанныйПрогон(face.key);
    const health = ourvend.ok ? отчётСбораСловами(ourvend.value, now) : null;
    // ЧТО УСПЕЛИ ПРОЧИТАТЬ — ТО И СПРАШИВАЕМ, И СПРАШИВАЕМ У ТОЙ ЖЕ ДВЕРИ, ЧТО
    // ПРАВИЛО (десятый круг починок, Ф-1). Отчёт OurVend мог не собраться при
    // исправном журнале — тогда момент проверки известен из тика монитора;
    // снимок мог не собраться при исправном отчёте — тогда свидетельства
    // (`runs`, `lastSuccessAt`) лежат в отчёте, и «не запускался» над ними
    // было бы ложью о сборе, который тикает каждые три часа. Молчание слоя —
    // третий такой случай: вердикт оно отменяет, свидетельства — нет.
    const проверено = сведенияОПроверкеСбора({ lastRun: прогон, health });
    if (базаОтказала !== null) return unavailableRow(face, базаОтказала, проверено);
    if (!ourvend.ok) return unavailableRow(face, ourvend.источник, проверено);
    // Молчание слоя — выше застоя и серии отказов: «сбор стоит 7 ч» читался бы
    // как проблема OurVend, а стоит он потому, что некому его запускать.
    if (слойМолчит !== null) {
      return rowFromSilentLayer(face, слойМолчит, LAYER_DEPENDENCY.ourvend, проверено);
    }
    return rowFromOurvendSync(face, {
      snapshotPublished: снимокЕсть,
      monitor: мониторы.get(face.key) ?? null,
      // Журнал прочитан, иначе сработал бы `базаОтказала` выше.
      lastRun: прогон === "журнал не прочитан" ? null : прогон,
      // Перевод повторён, а не взят из `health` выше: `health !== null` и
      // `ourvend.ok` — одно условие, но TypeScript связи не видит, а фолбэк
      // `health ?? …` был бы ложью о недостижимой ветке.
      health: отчётСбораСловами(ourvend.value, now),
      now,
    });
  }

  /** Учётный снимок OurVend и сверка с зеркалом — из того же отчёта. */
  private строкаУчёта(
    мониторы: Map<string, МониторСнимка>,
    прочитанныйПрогон: (key: string) => ПрочитанныйПрогон,
    ourvend: Чтение<Awaited<ReturnType<OurvendHealthService["health"]>>>,
    базаОтказала: string | null,
    слойМолчит: LayerSilence | null,
    снимокЕсть: boolean,
    now: Date,
  ): HealthRow {
    const face = FACES.ourvendAccounting;
    const прогон = прочитанныйПрогон(face.key);
    // ЧТО УСПЕЛИ ПРОЧИТАТЬ — ТО И СПРАШИВАЕМ, У ТОЙ ЖЕ ДВЕРИ, ЧТО ПРАВИЛО
    // (одиннадцатый круг починок, И-1). Момента в отчёте учёта нет по-прежнему
    // ни одного, а вот СЛЕД учётного снимка в нём есть, и он говорит, что
    // монитор ходил: до этого круга строка спрашивала дверь обычного монитора,
    // которая знает одну таблицу, и печатала «монитор не запускался» над
    // снимком часовой давности при пустом `agent_run` (свежая установка, день
    // после смоука, прогон, убитый автодеплоем).
    const проверено = сведенияОПроверкеУчёта({
      lastRun: прогон,
      health: ourvend.ok ? отчётУчётаСловами(ourvend.value) : null,
    });
    if (базаОтказала !== null) return unavailableRow(face, базаОтказала, проверено);
    if (!ourvend.ok) return unavailableRow(face, ourvend.источник, проверено);
    if (слойМолчит !== null) {
      return rowFromSilentLayer(face, слойМолчит, LAYER_DEPENDENCY.ourvend, проверено);
    }
    const h = ourvend.value;
    const снимок = мониторы.get(face.key) ?? null;
    // Журнал прочитан, иначе сработал бы `базаОтказала` выше.
    const lastRun = прогон === "журнал не прочитан" ? null : прогон;
    return rowFromOurvendAccounting(face, {
      snapshotPublished: снимокЕсть,
      monitor: снимок,
      lastRun,
      // Проверка молчания — ТА ЖЕ, что у обычного монитора (круг починок, C-5).
      // Своего сторожа у этой строки не было: `snapshotStale` вне режима `own`
      // жёстко `false`, и мёртвый монитор учёта выглядел зелёным.
      silentAfter: молчитПосле(снимок, lastRun),
      // Перевод повторён, а не взят из `проверено` выше: `ourvend.ok` там уже
      // проверен, но TypeScript связи не видит — та же причина, что у сбора.
      health: отчётУчётаСловами(h),
      now,
    });
  }

  /**
   * Счётчики очереди доставок — ОДНИМ запросом со свернутой группировкой.
   *
   * Возраст самой старой неразобранной строки берём тут же (`min` по группе),
   * а не вторым запросом: два раунда к одной таблице ради одного поля.
   *
   * И `max(completed_at)` ПО КАЖДОМУ ИСХОДУ (круг починок, A-2): по одним
   * счётчикам «в таблице есть `skipped`» и «в таблице есть `dead`» вердикт
   * врал в обе стороны — таблица бесконечна, ретенция её не чистит. Правило
   * строки — «случилось ли это после последнего успеха», и порядок исходов
   * стоит ровно столько же, сколько сами числа.
   */
  private async счётДоставок(): Promise<СчётДоставок> {
    const rows = await this.db
      .select({
        status: outboxDelivery.status,
        n: sql<number>`count(*)::int`,
        oldest: sql<Date | string | null>`min(${outboxDelivery.createdAt})`,
        newest: sql<Date | string | null>`max(${outboxDelivery.completedAt})`,
      })
      .from(outboxDelivery)
      .where(eq(outboxDelivery.destination, NOTION_DESTINATION))
      .groupBy(outboxDelivery.status);

    const counts: Record<string, number> = {};
    let oldestPendingAt: Date | null = null;
    let lastSentAt: Date | null = null;
    let lastSkippedAt: Date | null = null;
    let lastFailedAt: Date | null = null;
    for (const r of rows) {
      counts[r.status] = Number(r.n);
      const newest = дата(r.newest);
      if (r.status === "sent") lastSentAt = позднееИз(lastSentAt, newest);
      if (r.status === "skipped") lastSkippedAt = позднееИз(lastSkippedAt, newest);
      // `dead` и `unknown` — один терминальный отказ на два статуса: в обоих
      // случаях запись до Notion не дошла (у `unknown` — неизвестно, дошла ли).
      if (r.status === "dead" || r.status === "unknown") lastFailedAt = позднееИз(lastFailedAt, newest);
      if (r.status !== "pending" && r.status !== "dispatching") continue;
      const at = дата(r.oldest);
      // Битую дату отбрасываем здесь: ниже она ушла бы в `toISOString()` и
      // уронила бы ВЕСЬ ответ на строке, которая всего лишь показывает возраст.
      if (at === null) continue;
      if (oldestPendingAt === null || at.getTime() < oldestPendingAt.getTime()) {
        oldestPendingAt = at;
      }
    }
    return { counts, oldestPendingAt, lastSentAt, lastSkippedAt, lastFailedAt };
  }

  /**
   * Чтение источника под своим `catch`: отказ становится значением, а не
   * исключением на весь ответ. В строку панели едет ЯРЛЫК прочитанного, а
   * причина — только в журнал Core: маршрут читается анонимно, а сообщения
   * драйвера несут хост и пользователя базы.
   */
  private async попытка<T>(что: string, fn: () => Promise<T>): Promise<Чтение<T>> {
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      const причина = e instanceof Error ? e.message : String(e);
      this.logger.warn(`${что} не прочитан: ${причина}`);
      return { ok: false, источник: что };
    }
  }
}

/** Ключи мониторов, у которых есть своё лицо: остальные идут во «внутренние». */
const ИЗВЕСТНЫЕ_МОНИТОРЫ = new Set<string>([
  FACES.ourvendSync.key,
  FACES.ourvendAccounting.key,
  ...ПРОСТЫЕ_МОНИТОРЫ.map((face) => face.key),
]);

/** Момент из СУБД в `Date`; битое или пустое значение — `null`, а не NaN-дата. */
function дата(value: Date | string | null): Date | null {
  const at = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return at !== null && Number.isFinite(at.getTime()) ? at : null;
}

/** Ярлык не прочитавшегося источника (не текст исключения) либо `null`. */
function отказ(чтение: Чтение<unknown>): string | null {
  return чтение.ok ? null : чтение.источник;
}

/** Мониторы снимка по имени. Снимка нет вовсе — пустая карта: строки скажут об этом сами. */
function снимокМониторов(
  расписания: Чтение<Awaited<ReturnType<RunsService["snapshot"]>>>,
): Map<string, МониторСнимка> {
  const map = new Map<string, МониторСнимка>();
  if (!расписания.ok || расписания.value === null) return map;
  for (const m of расписания.value.payload.monitors) {
    map.set(m.name, {
      enabled: m.enabled,
      cron: m.cron,
      ...(m.reason ? { reason: m.reason } : {}),
      // Объяснение выключения — из словаря доски рутин: один код причины,
      // один текст на систему, и текст называет конкретную переменную .env.
      ...(m.enabled ? {} : { disabledText: disabledReasonText(m.reason, m.name) }),
    });
  }
  return map;
}

/**
 * Последний прогон каждого монитора: `agent_run` c `agent_name = "system"`.
 *
 * МОМЕНТ ПРОГОНА — ЭТО `startedAt`, НАЧАЛО ПРОВЕРКИ, хотя рядом лежит
 * `finishedAt`. Так было и до среза (строка описывала им своё событие), и
 * менять я не стал: журнал прогонов кладёт `finished_at` тем же тиком, разница
 * — секунды, а ошибка уходит в БЕЗОПАСНУЮ сторону (давность проверки чуть
 * завышается, «проверено давно» не превращается в «проверено только что»).
 * Но контракт поля обещает «момент проверки», поэтому названо прямо: это
 * момент, когда проверка НАЧАЛАСЬ.
 *
 * НЕЧИТАЕМЫЙ МОМЕНТ — ЭТО «СТРОКА ЕСТЬ, МОМЕНТ НЕ ПРОЧИТАН», А НЕ «ПРОГОНА
 * НЕТ» (десятый круг починок, Ф-1). `rowFromRaw` (`routines/runs.service.ts`)
 * собирает `startedAt: d(r.started_at)!` — `new Date(строка)` без проверки на
 * конечность и с `!` поверх, — так что испорченный столбец приезжает сюда как
 * `Invalid Date`. Прежняя редакция отбрасывала такую строку целиком, и на
 * границе «прогон был, момент испорчен» превращалось в «прогонов не было»:
 * дальше пересчёт свидетельств честно находил ноль и экран печатал «не
 * запускался» — над журналом, в котором строка лежит. Отбрасывание на границе
 * — это ровно то, что делает ноль неправдой.
 *
 * Теперь строка едет дальше с `at: null`: правила оценки её не видят
 * (`сЧитаемымПрогоном` обнуляет прогон ДО сравнения с порогом, поэтому мусор
 * ни в `toISOString()`, ни в сравнение с `NaN` не попадает), а дверь
 * свидетельств (`сведенияОПроверкеМонитора`) считает её одним свидетельством
 * — и на экране стоит «когда проверяли — неизвестно», а не «не запускался».
 * `дата` при этом по-прежнему отбрасывает битое значение СУБД: не строку, а
 * только её момент.
 */
function последниеПрогоны(
  прогоны: Чтение<Awaited<ReturnType<RunsService["lastPerJob"]>>>,
): Map<string, MonitorRunLite> {
  const map = new Map<string, MonitorRunLite>();
  if (!прогоны.ok) return map;
  for (const r of прогоны.value) {
    if (r.agentName !== "system") continue;
    map.set(r.skill, { at: дата(r.startedAt ?? null), outcome: r.outcome, reason: r.reason });
  }
  return map;
}

/**
 * Отчёт `/ourvend/health` → поля, которые решают судьбу строки сбора.
 *
 * Отдельной функцией, потому что отчёт спрашивают ДВАЖДЫ — правило на полном
 * входе и дверь свидетельств при отказе снимка, — и два перевода одного отчёта
 * разошлись бы на первом же новом поле.
 */
function отчётСбораСловами(
  h: Awaited<ReturnType<OurvendHealthService["health"]>>,
  now: Date,
): OurvendSyncHealthLite {
  return {
    runs: h.runs.length,
    failedStreak: h.failedStreak,
    lastSuccessAt: h.lastSuccessAt,
    // СЫРЫЕ часы — той же функцией, по которой будит владельца сторож
    // застоя. Поле `staleHours` в ответе округлено до 0,1 ч ДЛЯ ПОКАЗА, и
    // сравнение по нему сдвинуло бы границу порога.
    staleHoursRaw: rawStaleHours(h.lastSuccessAt, now),
    staleHoursShown: h.staleHours,
    staleThresholdH: h.staleThresholdH,
  };
}

/**
 * Отчёт `/ourvend/health` → поля, которые решают судьбу строки УЧЁТА.
 *
 * Отдельной функцией по той же причине, что у сбора (одиннадцатый круг
 * починок, И-1): отчёт спрашивают ДВАЖДЫ — правило на полном входе и дверь
 * свидетельств, когда до правила дело не дошло, — и два перевода одного отчёта
 * разошлись бы на первом же новом поле. До этого круга второго читателя не
 * было, а перевод жил прямо в аргументе правила.
 */
function отчётУчётаСловами(
  h: Awaited<ReturnType<OurvendHealthService["health"]>>,
): OurvendAccountingHealthLite {
  return {
    snapshotStale: h.snapshotStale,
    salesLagShownH: h.salesLagH,
    parity: {
      mode: h.parity.mode,
      checked: h.parity.checked,
      mismatches: h.parity.mismatches,
      stockOk: h.parity.stockOk,
      stockChecked: h.parity.stockChecked,
    },
  };
}

/**
 * Момент, после которого молчание монитора — уже не задержка тика: ВТОРОЙ
 * плановый запуск после последнего прогона.
 *
 * ПОЧЕМУ ВТОРОЙ, А НЕ ПЕРВЫЙ. Первый пропуск бывает от рестарта контейнера и
 * от задержки event loop — красить строку на нём значило бы приучить владельца
 * к красному. Два пропуска подряд — то же правило, по которому выставлен порог
 * застоя сбора (6 ч при кроне раз в 3 ч).
 *
 * `null` — расписание неизвестно или битое: судить о молчании нечем, и
 * молчаливое «в порядке» здесь честнее выдуманного порога. Момент прогона не
 * прочитан (`at: null`) — то же самое: отсчитывать плановые запуски не от чего.
 */
function молчитПосле(снимок: МониторСнимка | null, lastRun: MonitorRunLite | null): Date | null {
  if (снимок === null || !снимок.enabled || lastRun === null || lastRun.at === null) return null;
  // Разбор cron — общей функцией доски рутин (`nextOccurrences`): своя копия
  // с другим часовым поясом или другим поведением на битом выражении дала бы
  // «монитор молчит» там, где доска рисует ближайший запуск.
  return nextOccurrences(снимок.cron, lastRun.at, 2)[1] ?? null;
}

/**
 * Монитор ledger → поля, которые решают судьбу строки моделей.
 *
 * ЭКСПОРТИРУЕТСЯ РАДИ СЦЕНАРИЯ НА НАСТОЯЩЕМ SQL
 * (`tools/pglite-checks/check-llm-latest.mjs`): вторая, «тестовая» копия этого
 * перевода доказывала бы саму себя, а спорное место — именно стык снимка
 * ledger со строкой.
 */
export function ledgerСловами(m: Awaited<ReturnType<LlmLedgerService["monitoring"]>>) {
  return {
    meteredEnabled: m.catalogPrice.meteredEnabled,
    hasActivePrice: m.catalogPrice.hasActivePrice,
    provider: m.catalogPrice.provider,
    model: m.catalogPrice.model,
    latestCompletedAt: m.latestCompleted?.completedAt ?? null,
    // ИСХОД, А НЕ ТОЛЬКО ДАТА (круг починок, A-3): `latestCompleted` принимает
    // и `failed`, и без статуса строка объявляла «вызовы проходят» над
    // отозванным ключом провайдера.
    latestCompletedStatus: m.latestCompleted?.status ?? null,
    latestCompletedOutcome: m.latestCompleted?.outcome ?? null,
    stuckCount: m.stuckReservations.count,
    openCircuits: m.openCircuits.length,
    failuresToday: m.failuresToday.count,
    budgetRemainingUsd: m.budget.remainingUsd,
    budgetCapUsd: m.budget.globalCapUsd,
    ...(m.budget.configError !== undefined ? { configError: m.budget.configError } : {}),
  };
}
