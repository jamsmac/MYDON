import Link from "next/link";
import {
  core,
  CoreUnavailable,
  type AgentCard,
  type AgentsStatus,
  type AgentStatusRow,
} from "../../lib/core";
import { CoreDown } from "../../components/core-down";
import { NewAgentForm } from "../../components/agent-new";
import {
  очередьПорученных,
  RuntimeLagNotice,
  SchedulesPausedNotice,
  stateSummary,
  TasksPausedNotice,
} from "../../components/agent-grid";
// Подписи направления и тира переехали в lib/labels: их читают и клиентские
// компоненты (витрина навыков), а эта страница тянет server-only через core.
import { BUSINESS_LABEL, TIER_LABEL } from "../../lib/labels";
import { runWhen } from "../../lib/crons";
import { plural } from "../../lib/format";
import { AGENT_STATE_WORD, CARD_PASSPORT_WORD, ledЗанятости } from "../../lib/state";

export const dynamic = "force-dynamic";

/**
 * Список агентов (перепроверка прода, Д-2).
 *
 * ЗАНЯТОСТЬ — ИЗ `GET /agents/status`, А НЕ ИЗ ПАСПОРТА. До этой правки
 * страница считала `working = status === "active"` и печатала «Работают 13 из
 * 13» с тринадцатью зелёными «работает» — по паспортному статусу, при
 * `AGENTS_TASKS_PAUSED=1`. Это ровно та формулировка, ради устранения которой
 * писался `agent-state.ts`, и сюда ведут все ссылки: главное меню, «все агенты
 * →» из сетки, «← Все агенты» из карточки и «открой Агентов» из уведомления об
 * отказе `/agents/status` — при падении статуса владельца отправляли на экран,
 * который врал сильнее всех.
 *
 * Паспортный статус остаётся, но словами «включён/выключен в карточке» и БЕЗ
 * `.ok`: зелёный на этом экране значит «здоров», а включённость здоровьем не
 * является. Состояние и лампа — из словаря панели (`AGENT_STATE_WORD` и дверь
 * `ledЗанятости`), паспорт — из `CARD_PASSPORT_WORD`, сводка — той же
 * функцией, что на главной: один агент не должен «работать» здесь и «молчать»
 * на главной. Отказ `/agents/status` — третий вид с причиной (как у сетки на
 * `/mydon`), а не список по паспортам.
 *
 * СЛОВАРИ — ТОЛЬКО ИЗ `lib/state.ts` (слияние со срезом Д1). Свой
 * `PASSPORT_WORD` жил здесь константой файла — второй дом оси «карточка
 * агента», ровно то, от чего заводился общий словарь; переехал вместе с
 * причиной «без `.ok`» и с фолбэком Д1 на незнакомый статус.
 */

export default async function Agents() {
  // Карточки — единственный обязательный источник: без них показывать нечего.
  let list: AgentCard[];
  try {
    list = await core.agents();
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  // Состояние — под своим catch: его отказ даёт третий вид страницы с
  // причиной, а не список по паспортам и не пропажу страницы целиком.
  let status: AgentsStatus | null = null;
  let statusError: string | null = null;
  try {
    status = await core.agentsStatus();
  } catch (err) {
    statusError =
      err instanceof CoreUnavailable
        ? err.detail
        : err instanceof Error
          ? err.message
          : String(err);
  }

  const byName = new Map((status?.agents ?? []).map((a) => [a.name, a]));
  // Давность состояния — от времени CORE, как в сетке: часы панели на границе
  // суток подписали бы вчерашний прогон сегодняшним днём.
  const now = status !== null ? new Date(status.now) : new Date();
  const включены = list.filter((a) => a.status === "active");
  const выключены = list.filter((a) => a.status !== "active");

  return (
    <>
      <div className="page-head">
        <h1>Агенты</h1>
        <p>
          {status !== null && status.agents.length > 0 ? `${stateSummary(status.agents)} · ` : ""}
          {list.length} {plural(list.length, "агент", "агента", "агентов")} в базе. Настройки
          хранятся в базе — не сбрасываются при обновлении системы.
        </p>
      </div>

      {statusError !== null ? (
        <div className="notice">
          <b>Состояние агентов не прочиталось: {statusError}</b>
          Это НЕ значит, что агенты стоят или что их нет: Core не ответил на запрос состояния, и о
          занятости сейчас неизвестно ничего. Ниже — карточки без занятости; включённость в карточке
          работой не является.
        </div>
      ) : (
        status !== null && (
          <>
            {status.paused.tasks && <TasksPausedNotice queued={очередьПорученных(status.agents)} />}
            {status.paused.schedules && <SchedulesPausedNotice />}
            <RuntimeLagNotice paused={status.paused} runtime={status.runtime} />
          </>
        )
      )}

      {включены.length > 0 && <div className="section-title">Включены в карточке</div>}
      <div className="rows">
        {включены.map((a) => (
          <AgentRow
            key={a.id}
            a={a}
            state={byName.get(a.name) ?? null}
            now={now}
            statusRead={statusError === null}
          />
        ))}
      </div>

      {/* «НЕ ВКЛЮЧЕНЫ», А НЕ «ВЫКЛЮЧЕНЫ» (слияние: правило Д1, словарь A2-fix).
          Под этим заголовком лежат три разных паспортных статуса — «выключен в
          карточке», «не введён в работу» и «выведен из работы», — и называть
          секцию одним из них значит противоречить строкам под ней. Формулировка
          — точная противоположность секции выше, то есть ровно предикат
          `status !== "active"`, и она не называет ни одного из трёх. Шапка и
          «Включены в карточке» описывают `active` — там противоречия нет. */}
      {выключены.length > 0 && <div className="section-title">Не включены в карточке</div>}
      <div className="rows">
        {выключены.map((a) => (
          <AgentRow
            key={a.id}
            a={a}
            state={byName.get(a.name) ?? null}
            now={now}
            statusRead={statusError === null}
          />
        ))}
      </div>

      <div className="section-title">Завести агента</div>
      <NewAgentForm />
    </>
  );
}

/**
 * Строка агента: имя, паспорт словами, состояние словом и причина из Core.
 *
 * Состояния нет в двух случаях, и они названы по-разному: `/agents/status`
 * не прочитался (о занятости неизвестно ничего) и Core ответил, но этого
 * агента в ответе нет (архивный или скрыт личным контуром).
 */
function AgentRow({
  a,
  state,
  now,
  statusRead,
}: {
  a: AgentCard;
  state: AgentStatusRow | null;
  now: Date;
  statusRead: boolean;
}) {
  const jobs = a.schedule.length;
  return (
    <Link href={`/agents/${encodeURIComponent(a.name)}`} className="row rowlink">
      <div className="t">
        <b>{a.name}</b>
        <small>
          {BUSINESS_LABEL[a.business] ?? a.business} ·{" "}
          {jobs > 0
            ? `${jobs} ${plural(jobs, "расписание", "расписания", "расписаний")}`
            : "без расписания"}{" "}
          · {TIER_LABEL[a.autonomyDefault] ?? a.autonomyDefault}
        </small>
        {state !== null && (
          <small className="agr">
            {state.reason}
            {/* Ожидающие поручения — тем же числом, что на плитке (ревью Ф-1). */}
            {state.queuedAssigned !== undefined && state.queuedAssigned > 0 && (
              <>
                {" · "}в очереди {state.queuedAssigned}{" "}
                {plural(
                  state.queuedAssigned,
                  "порученная задача",
                  "порученные задачи",
                  "порученных задач",
                )}
              </>
            )}
            {state.since !== undefined && ` · ${runWhen(state.since, now)}`}
          </small>
        )}
      </div>
      {/* ЗАНЯТОСТЬ — ДВЕРЬЮ `ledЗанятости`, А НЕ ИНДЕКСОМ ПО СЛОВАРЮ ЛАМП
          (слияние со срезом Д1): у оси пятое значение — «молчит из-за
          поломки», и индексом его не получить. Без двери сломанный молчун
          светился бы тревогой на главной и в своей карточке, а в этом списке
          — спокойным серым, то есть панель называла бы одно состояние тремя
          видами. */}
      {/* КОНТЕЙНЕР `.agled` — ТРЕТЬЯ ПОВЕРХНОСТЬ ЗАНЯТОСТИ (ревью слияния, I-1).
          Вес 600 у «затыка» правило `globals.css` даёт ЧЕРЕЗ этот контейнер
          (`.agled .led.blocked`), а не по самому классу: тем же `.blocked`
          красятся «не заведён», «в архиве» и включённая пауза. До слияния
          занятости в этом списке не было вовсе — стоял паспорт, — и без
          обёртки «затык» отличался бы здесь ОДНИМ цветом `--err`, ровно тем
          отличием, которого нет на монохромном экране и при дальтонизме.
          Обёрнуты ОБЕ ветки: контейнер — «состояние агента», а не «затык», и
          следующее правило оси приезжает на все поверхности сразу. */}
      <span className="agled">
        {state !== null ? (
          <span className={ledЗанятости(state)}>{AGENT_STATE_WORD[state.state]}</span>
        ) : (
          <span className="led unknown">
            {statusRead ? "состояние Core не назвал" : "состояние не прочиталось"}
          </span>
        )}
      </span>
      {/* СТАТУС ВНЕ ЧЕТЫРЁХ ЗНАЧЕНИЙ — НЕ ПУСТАЯ ПИЛЮЛЯ (девятый круг починок
          среза Д1). Тип провода обещает четыре значения, но словарь
          индексируется РАНТАЙМНЫМ: новый статус в Core (или старая панель
          против нового ядра) давал `undefined` — пилюля исчезала вовсе, и
          строка молчала о том, что с агентом. Печатаем сырое значение — тем же
          приёмом, что `BUSINESS_LABEL[a.business] ?? a.business` выше.
          Пилюля голая (`pill`), без `ok`: цветом паспорт состояния не носит —
          зелёный на этом экране значит «здоров», а включённость здоровьем не
          является (перепроверка прода, Д-2). */}
      <span className="pill">{CARD_PASSPORT_WORD[a.status] ?? a.status}</span>
    </Link>
  );
}
