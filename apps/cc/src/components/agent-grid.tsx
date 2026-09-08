import Link from "next/link";
import { AGENTS_SNAPSHOT_INTERVAL_MS, isSkipReason, type SkipReason } from "@mydon/shared";
import type { AgentsRuntime, AgentState, AgentStatusRow } from "../lib/core";
import { runWhen } from "../lib/crons";
import { plural } from "../lib/format";
import { Av8 } from "./av8";

/**
 * Сетка агентов на главной (волна A2, R-A2-4; решения Р-1 и Р-2).
 *
 * Критерий среза: двенадцать агентов видны на одном экране с состоянием, и
 * состояние НЕ ВРЁТ при системной паузе. Состояния и причины считает Core
 * (`GET /agents/status`) — панель их только показывает: третья копия правила
 * лизы разошлась бы с worker'ом и с Core на первой же правке.
 */

/**
 * Состояние → слово. Цвет никогда не единственный носитель смысла.
 *
 * ЭКСПОРТИРУЕТСЯ ради карточки агента (R-A2-5): сетка и карточка обязаны
 * называть одно состояние одним словом. Второй словарь разошёлся бы с первым
 * на первой же правке, и один агент «работал» бы на главной и «молчал» в
 * собственной карточке.
 */
export const STATE_WORD: Record<AgentState, string> = {
  working: "работает",
  blocked: "затык",
  paused: "на паузе",
  idle: "молчит",
};

/**
 * Состояние → класс лампы.
 *
 * ЗЕЛЁНОЙ ЛАМПЫ ЗДЕСЬ НЕТ НИ У ОДНОГО СОСТОЯНИЯ. `.led.idle` (`--ok`) значит
 * «повода нет, всё в норме» — это утверждение о здоровье, а сетка отвечает на
 * другой вопрос: «занят ли агент». Выключенный и молчащий агент здоровыми не
 * являются: про них просто ничего не известно, кроме того, что они ничего не
 * делают. Дефект витрины навыков (`skills-deck.tsx`, где `paused → idle`) в
 * сетке из двенадцати плиток стоил бы дороже всего: взгляд ловит цвет, и ряд
 * зелёных ламп прочитался бы как «всё хорошо» над выключенной системой.
 */
export const STATE_LED: Record<AgentState, string> = {
  working: "led working",
  blocked: "led blocked",
  // Пауза и молчание — базовая лампа (`--tx-2`): состояние известно, поэтому
  // квадрат залит, но «нормой» оно не является. У паузы дополнительно гаснут
  // имя, лицо и лампа (`.agtile[data-state="paused"]`) — она не проснётся
  // сама; причина не гаснет, ради неё плитка и печатает текст.
  paused: "led",
  idle: "led",
};

/**
 * Пропуски прогона, за которыми стоит ПОЛОМКА, а не «повода не было».
 *
 * Ревью среза: «молчит — модель не ответила» и «молчит — предлагать нечего»
 * приходят одним состоянием `idle`, и причина из Core их различает словами.
 * Но одинаковый вес на экране приучает пролистывать оба: сломанный маршрут к
 * модели неделю выглядит спокойным молчанием. В списке ровно те причины, при
 * которых работа НЕ СДЕЛАНА из-за поломки или запрета (подсказки словаря
 * `RUN_SKIP_REASONS` зовут чинить ключ, ledger, хук или повторять вручную), —
 * в отличие от `no_signal`, `no_change` и `capped`, где делать нечего.
 */
const ПОЛОМКА: readonly SkipReason[] = [
  "llm_failed",
  "ledger_unavailable",
  "execution_unknown",
  "hook_blocked",
];

function молчитИзЗаПоломки(row: AgentStatusRow): boolean {
  // Только у молчания: у «работает» и «затыка» свой вес и своя причина, и
  // полоса без объяснения в тексте плитки была бы шумом.
  if (row.state !== "idle") return false;
  // ОБОРВАННЫЙ CLAIM — НЕ ЭТОТ СЛУЧАЙ (ревью Ф-5). У такого `idle` причина
  // говорит про истёкший lease и судьбу задачи, а `lastRun` описывает ПРОШЛЫЙ
  // заход: полоса внимания вставала над текстом, который её не объясняет, —
  // ровно то, чего этот комментарий не хочет. Различаем по данным: у молчания
  // из журнала задачи нет, у оборванного claim `taskId` заполнен.
  if (row.taskId !== undefined) return false;
  const run = row.lastRun;
  if (run === undefined || run === null) return false;
  if (run.outcome === "failed") return true;
  if (run.outcome !== "skipped") return false;
  return isSkipReason(run.skipReason) && ПОЛОМКА.includes(run.skipReason);
}

/**
 * Сводка заголовка: только ненулевое — «затыков 0» не вопрос владельца.
 *
 * ЭКСПОРТИРУЕТСЯ ради списка `/agents` (перепроверка прода, Д-2): тот
 * печатал «Работают N из M» по паспортному статусу, и одна сводка на два
 * экрана — единственный способ, чтобы они не спорили о числе работающих.
 */
export function stateSummary(rows: readonly AgentStatusRow[]): string {
  const счёт = (state: AgentState): number => rows.filter((r) => r.state === state).length;
  const working = счёт("working");
  const blocked = счёт("blocked");
  const idle = счёт("idle");
  const paused = счёт("paused");
  const части = [
    working > 0 ? `работают ${working}` : null,
    // Затык называется отдельно: в «молчат» он выглядел бы обычным простоем.
    blocked > 0 ? `в затыке ${blocked}` : null,
    idle > 0 ? `молчат ${idle}` : null,
    paused > 0 ? `на паузе ${paused}` : null,
  ].filter((ч): ч is string => ч !== null);
  return части.join(" · ");
}

export function AgentGrid({
  rows,
  paused,
  runtime,
  now,
  error,
}: {
  rows: readonly AgentStatusRow[];
  paused: { schedules: boolean; tasks: boolean };
  /** Сверка намерения с рантаймом (Д-3); нет — когда состояние не прочиталось. */
  runtime?: AgentsRuntime;
  /**
   * Момент, от которого считается давность состояния (`row.since`).
   *
   * Берём время CORE (`AgentsStatus.now`), а не часы панели: тот же довод, что
   * у доски рутин (`lib/crons.ts`) — на границе суток «сегодня» панели и
   * «сегодня» Core разъезжаются, и плитка подписала бы вчерашний прогон
   * сегодняшним днём.
   */
  now: Date;
  /**
   * Состояние не прочиталось — ТРЕТИЙ ВИД раздела (круг починок, C-2).
   *
   * До этой правки главный экран ловил отказ `/agents/status` и не рисовал
   * раздел вовсе: над упавшим Core «Главное» выглядело нормальным, а пропажа
   * раздела читается как «агентов нет». Это то же правило, которое ветка сама
   * записала в `apps-health.ts` про пропавшую строку источника, — раздел
   * остаётся на месте и называет причину. Ни `rows`, ни `paused` при этом не
   * значат ничего: их не прочитали.
   */
  error?: string;
}) {
  return (
    <div className="sect" style={{ marginTop: 16 }}>
      <div className="sect-h">
        <h3 className="h2">Агенты</h3>
        {error === undefined && rows.length > 0 && (
          <span className="hint">{stateSummary(rows)}</span>
        )}
        <span className="sp" />
        <Link href="/agents" className="go">
          все агенты →
        </Link>
      </div>

      {error !== undefined ? (
        <div className="notice">
          <b>Состояние агентов не прочиталось: {error}</b>
          Это НЕ значит, что агенты стоят или что их нет: Core не ответил на запрос состояния, и о
          занятости сейчас неизвестно ничего. Системную паузу здесь тоже не проверить — открой{" "}
          <Link href="/agents" className="go">
            Агентов
          </Link>{" "}
          или{" "}
          <Link href="/system" className="go">
            Систему
          </Link>
          .
        </div>
      ) : (
        <GridBody
          rows={rows}
          paused={paused}
          now={now}
          {...(runtime !== undefined ? { runtime } : {})}
        />
      )}
    </div>
  );
}

/** Обычный вид раздела: системные паузы, затем плитки (или пустое состояние). */
function GridBody({
  rows,
  paused,
  runtime,
  now,
}: {
  rows: readonly AgentStatusRow[];
  paused: { schedules: boolean; tasks: boolean };
  runtime?: AgentsRuntime;
  now: Date;
}) {
  return (
    <>
      {/* Пауза задач — ОТДЕЛЬНОЙ СТРОКОЙ, а не состоянием плиток (перепроверка
          прода, корень 1): она останавливает только новые claim'ы порученных
          задач, cron-прогоны идут, и агент с живым claim работает. Без этой
          строки владелец не узнал бы, почему порученная задача лежит в очереди. */}
      {paused.tasks && <TasksPausedNotice queued={очередьПорученных(rows)} />}
      {paused.schedules && <SchedulesPausedNotice />}
      {runtime !== undefined && <RuntimeLagNotice paused={paused} runtime={runtime} />}

      {rows.length === 0 ? (
        <div className="empty">
          <b>Core не назвал ни одного агента</b>
          Карточек агентов в базе нет — заведи первого на экране «Агенты» или проверь, что слой
          агентов запущен.
        </div>
      ) : (
        <div className="aggrid">
          {rows.map((row) => (
            <AgentTile key={row.name} row={row} now={now} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Системная пауза ЗАДАЧ словами: настройка системы, а не состояние агента.
 *
 * ЭКСПОРТИРУЕТСЯ ради карточки агента (круг починок, C-4): одна настройка
 * обязана называться на обеих поверхностях одними словами и указывать один и
 * тот же ключ окружения. Второй текст разошёлся бы с первым, и владелец пошёл
 * бы чинить в разные места.
 *
 * ТЕКСТ — ПО ФАКТУ РАНТАЙМА (перепроверка прода, корень 1). Прежний говорил
 * «ни один из них не возьмёт задачу», а рантайм гейтит очереди разными
 * тумблерами: этот останавливает только НОВЫЕ claim'ы порученных задач, уже
 * начатая задача завершается, а cron-задачи идут — их выключает
 * `AGENTS_SCHEDULES_PAUSED`. Поэтому строка стоит рядом с плитками, а не
 * подменяет их состояние: работающий под этой паузой агент работает.
 */
export function TasksPausedNotice({ queued }: { queued?: number }) {
  return (
    <div className="notice">
      <b>Назначенные задачи агентов на паузе</b>
      Это настройка системы (<span className="mono">AGENTS_TASKS_PAUSED=1</span>), а не состояние
      агентов: новые порученные задачи никто не возьмёт, уже начатая — завершится, а прогоны по
      cron-расписанию идут (их выключает <span className="mono">AGENTS_SCHEDULES_PAUSED</span>).
      {/* Числом, а не общим предупреждением (ревью Ф-1): «кто-то чего-то не
          возьмёт» и «три поручения лежат с 5 сентября» — разные поводы. */}
      {queued !== undefined && queued > 0 && (
        <>
          {" "}
          Сейчас {queued} {plural(queued, "задача", "задачи", "задач")}{" "}
          {plural(queued, "ждёт", "ждут", "ждут")} снятия паузы.
        </>
      )}{" "}
      Снять — в{" "}
      <Link href="/system" className="go">
        Системе
      </Link>
      .
    </div>
  );
}

/** Сколько порученных задач ждёт по всему парку: числа считает Core, панель складывает. */
export function очередьПорученных(rows: readonly AgentStatusRow[]): number {
  return rows.reduce((сумма, r) => сумма + (r.queuedAssigned ?? 0), 0);
}

/**
 * Рантайм ещё не подхватил тумблер (перепроверка прода, Д-3).
 *
 * Сетка читает НАМЕРЕНИЕ — тумблеры из конфига в ту же секунду, а слой агентов
 * перечитывает настройки своим тиком (`AGENTS_SNAPSHOT_INTERVAL_MS`). Владелец
 * снял паузу → в ту же секунду плитки «молчит», а worker до перечитки ничего
 * не берёт: спокойный экран над всё ещё выключенной системой. Поставил паузу →
 * «на паузе» над worker'ом, который ещё claim'ит. Об этом знал только `/system`
 * («применится в течение N минут»); теперь — и сетка, и карточка, и список.
 * Ничего не рисует, пока конфиг и снимок сходятся: строка, которая есть
 * всегда, перестаёт что-либо значить.
 */
export function RuntimeLagNotice({
  paused,
  runtime,
}: {
  paused: { schedules: boolean; tasks: boolean };
  runtime: AgentsRuntime;
}) {
  // Отказ ЧТЕНИЯ снимка — не «рантайм не отчитывался» (ревью M-2): молчать
  // здесь значило бы выдать неизвестное за «сходится». Причина — в журнале Core.
  if (runtime.readFailed) {
    return (
      <div className="notice">
        <b>Сверка с рантаймом недоступна: снимок расписаний не прочитался</b>
        {/* Называем тумблеры по именам, а не «выше» (ревью Ф-5): при обоих
            выключенных строк выше нет вовсе, и ссылка висела бы в воздухе. */}
        Применил ли слой агентов <span className="mono">AGENTS_TASKS_PAUSED</span> и{" "}
        <span className="mono">AGENTS_SCHEDULES_PAUSED</span> — неизвестно; причина отказа записана
        в журнал Core.
      </div>
    );
  }
  if (!runtime.lagging || runtime.paused === null) return null;
  const слово = (on: boolean): string => (on ? "на паузе" : "работают");
  const применено = runtime.paused;
  const разница = [
    применено.tasks !== paused.tasks
      ? `назначенные задачи: в настройке ${слово(paused.tasks)}, у рантайма ещё ${слово(применено.tasks)}`
      : null,
    применено.schedules !== paused.schedules
      ? `расписания: в настройке ${слово(paused.schedules)}, у рантайма ещё ${слово(применено.schedules)}`
      : null,
  ].filter((ч): ч is string => ч !== null);
  const мин = runtime.ageSec !== null ? Math.round(runtime.ageSec / 60) : null;
  return (
    <div className="notice">
      <b>
        {runtime.stale
          ? `Рантайм агентов не отчитывался ${мин ?? "?"} мин — что он применил сейчас, неизвестно`
          : `Рантайм агентов ещё не подхватил настройку (снимок ${мин ?? "?"} мин назад)`}
      </b>
      {разница.join("; ")}. Слой агентов перечитывает настройки раз в{" "}
      {AGENTS_SNAPSHOT_INTERVAL_MS / 60_000} мин; состояния выше — по настройке, а worker до
      перечитки работает по-старому.
    </div>
  );
}

/** Системная пауза РАСПИСАНИЙ словами — те же слова на сетке и на карточке. */
export function SchedulesPausedNotice() {
  return (
    <div className="notice">
      <b>Расписания агентов на паузе</b>
      Это настройка системы (<span className="mono">AGENTS_SCHEDULES_PAUSED=1</span>): плановые
      прогоны не запускаются, даже если сами агенты в порядке.
    </div>
  );
}

/**
 * Плитка агента: лицо, имя, состояние словом и ПРИЧИНА — без причины плитка не
 * отвечает.
 *
 * ДАВНОСТЬ ПЕЧАТАЕТСЯ РЯДОМ С ПРИЧИНОЙ (круг починок, C-3). Core отдаёт
 * `since`, а плитка его выбрасывала: у агента со снятым расписанием и успешным
 * прогоном 12 июня она писала «молчит · последний прогон — выполнено» — байт в
 * байт как у отработавшего час назад. Формат — `runWhen` доски рутин, тот же,
 * что в карточке агента: второй словарь дат разошёлся бы с первым, и две
 * поверхности назвали бы один факт по-разному.
 */
function AgentTile({ row, now }: { row: AgentStatusRow; now: Date }) {
  const поломка = молчитИзЗаПоломки(row);
  return (
    <Link
      href={`/agents/${encodeURIComponent(row.name)}`}
      className="agtile"
      data-state={row.state}
      data-attention={поломка ? "true" : undefined}
    >
      <Av8 name={row.name} />
      <div className="agb">
        <div className="agn">{row.name}</div>
        <div className="agled">
          {/* Тон «поломки» — тот же, что у предупреждения в журнале прогонов
              (`.run-led.warn`): не авария, но и не спокойствие. */}
          <span className={поломка ? "led run-led warn" : STATE_LED[row.state]}>
            {STATE_WORD[row.state]}
          </span>
        </div>
        <div className="agr">
          {row.reason}
          {/* Ожидающие поручения — рядом с причиной (ревью Ф-1): состояние
              «молчит» без этого числа читалось бы как «делать нечего». */}
          {row.queuedAssigned !== undefined && row.queuedAssigned > 0 && (
            <>
              {" · "}в очереди {row.queuedAssigned}{" "}
              {plural(
                row.queuedAssigned,
                "порученная задача",
                "порученные задачи",
                "порученных задач",
              )}
            </>
          )}
          {/* `since` отсутствует, когда его честно нет (агент ни разу не
              запускался, системная пауза): выдумывать «неизвестно когда»
              не надо — об этом уже сказала причина. */}
          {row.since !== undefined && <span className="agw"> · {runWhen(row.since, now)}</span>}
        </div>
      </div>
    </Link>
  );
}
