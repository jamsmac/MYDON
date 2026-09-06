import Link from "next/link";
import { isSkipReason, type SkipReason } from "@mydon/shared";
import type { AgentState, AgentStatusRow } from "../lib/core";
import { runWhen } from "../lib/crons";
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
  const run = row.lastRun;
  if (run === undefined || run === null) return false;
  if (run.outcome === "failed") return true;
  if (run.outcome !== "skipped") return false;
  return isSkipReason(run.skipReason) && ПОЛОМКА.includes(run.skipReason);
}

/** Сводка заголовка: только ненулевое — «затыков 0» не вопрос владельца. */
function сводка(rows: readonly AgentStatusRow[]): string {
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
  now,
  error,
}: {
  rows: readonly AgentStatusRow[];
  paused: { schedules: boolean; tasks: boolean };
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
        {error === undefined && rows.length > 0 && <span className="hint">{сводка(rows)}</span>}
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
        <GridBody rows={rows} paused={paused} now={now} />
      )}
    </div>
  );
}

/** Обычный вид раздела: системные паузы, затем плитки (или пустое состояние). */
function GridBody({
  rows,
  paused,
  now,
}: {
  rows: readonly AgentStatusRow[];
  paused: { schedules: boolean; tasks: boolean };
  now: Date;
}) {
  return (
    <>
      {/* Р-2: пока настройка включена, ни один агент не возьмёт задачу. Без
          этой строки экран показал бы двенадцать спокойных плиток там, где
          выключена система, — и владелец искал бы поломку в агентах. */}
      {paused.tasks && <TasksPausedNotice />}
      {paused.schedules && <SchedulesPausedNotice />}

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
 */
export function TasksPausedNotice() {
  return (
    <div className="notice">
      <b>Задачи агентов на паузе</b>
      Это настройка системы (<span className="mono">AGENTS_TASKS_PAUSED=1</span>), а не состояние
      агентов: пока она включена, ни один из них не возьмёт задачу. Снять — в{" "}
      <Link href="/system" className="go">
        Системе
      </Link>
      .
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
          {/* `since` отсутствует, когда его честно нет (агент ни разу не
              запускался, системная пауза): выдумывать «неизвестно когда»
              не надо — об этом уже сказала причина. */}
          {row.since !== undefined && <span className="agw"> · {runWhen(row.since, now)}</span>}
        </div>
      </div>
    </Link>
  );
}
