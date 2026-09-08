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
  RuntimeLagNotice,
  SchedulesPausedNotice,
  STATE_LED,
  STATE_WORD,
  stateSummary,
  TasksPausedNotice,
} from "../../components/agent-grid";
// Подписи направления и тира переехали в lib/labels: их читают и клиентские
// компоненты (витрина навыков), а эта страница тянет server-only через core.
import { BUSINESS_LABEL, TIER_LABEL } from "../../lib/labels";
import { runWhen } from "../../lib/crons";
import { plural } from "../../lib/format";

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
 * является. Состояние и лампа — из словаря сетки (`STATE_WORD`/`STATE_LED`),
 * сводка — той же функцией: один агент не должен «работать» здесь и «молчать»
 * на главной. Отказ `/agents/status` — третий вид с причиной (как у сетки на
 * `/mydon`), а не список по паспортам.
 */

/** Паспортный статус словами: включённость — не здоровье, поэтому без `.ok`. */
const PASSPORT_WORD: Record<AgentCard["status"], string> = {
  active: "включён в карточке",
  paused: "выключен в карточке (paused)",
  draft: "не введён в работу (draft)",
  deprecated: "выведен из работы (deprecated)",
};

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
            {status.paused.tasks && <TasksPausedNotice />}
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

      {выключены.length > 0 && <div className="section-title">Выключены в карточке</div>}
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
            {state.since !== undefined && ` · ${runWhen(state.since, now)}`}
          </small>
        )}
      </div>
      {state !== null ? (
        <span className={STATE_LED[state.state]}>{STATE_WORD[state.state]}</span>
      ) : (
        <span className="led unknown">
          {statusRead ? "состояние Core не назвал" : "состояние не прочиталось"}
        </span>
      )}
      <span className="pill">{PASSPORT_WORD[a.status]}</span>
    </Link>
  );
}
