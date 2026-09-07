import Link from "next/link";
import { core, CoreUnavailable, type AgentCard } from "../../lib/core";
import { CoreDown } from "../../components/core-down";
import { NewAgentForm } from "../../components/agent-new";
// Подписи направления и тира переехали в lib/labels: их читают и клиентские
// компоненты (витрина навыков), а эта страница тянет server-only через core.
import { BUSINESS_LABEL, TIER_LABEL } from "../../lib/labels";
import { CARD_PILL, CARD_WORD } from "../../lib/state";

export const dynamic = "force-dynamic";

export default async function Agents() {
  let list: AgentCard[];
  try {
    list = await core.agents();
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const working = list.filter((a) => a.status === "active");
  const idle = list.filter((a) => a.status !== "active");

  return (
    <>
      <div className="page-head">
        <h1>Агенты</h1>
        <p>
          Работают {working.length} из {list.length}. Настройки хранятся в базе — не сбрасываются
          при обновлении системы.
        </p>
      </div>

      {working.length > 0 && <div className="section-title">В работе</div>}
      <div className="rows">
        {working.map((a) => (
          <AgentRow key={a.id} a={a} />
        ))}
      </div>

      {/* «Не в работе», а не «Выключены»: под этим заголовком лежат пилюли
          «выключен», «не заведён» и «в архиве» — три разных состояния, и
          называть секцию одним из них значит противоречить строкам под ней.
          Шапка и «В работе» описывают `active`, а `CARD_WORD.active` и есть
          «работает», — там противоречия нет и правки не нужно. */}
      {idle.length > 0 && <div className="section-title">Не в работе</div>}
      <div className="rows">
        {idle.map((a) => (
          <AgentRow key={a.id} a={a} />
        ))}
      </div>

      <div className="section-title">Завести агента</div>
      <NewAgentForm />
    </>
  );
}

function AgentRow({ a }: { a: AgentCard }) {
  const jobs = a.schedule.length;
  return (
    <Link href={`/agents/${a.name}`} className="row rowlink">
      <div className="t">
        <b>{a.name}</b>
        <small>
          {BUSINESS_LABEL[a.business] ?? a.business} ·{" "}
          {jobs > 0 ? `${jobs} расписан${jobs === 1 ? "ие" : "ий"}` : "без расписания"} ·{" "}
          {TIER_LABEL[a.autonomyDefault] ?? a.autonomyDefault}
        </small>
      </div>
      {/* СТАТУС ВНЕ ЧЕТЫРЁХ ЗНАЧЕНИЙ — НЕ ПУСТАЯ ПИЛЮЛЯ (девятый круг починок).
          Тип провода обещает четыре значения, но словари индексируются
          РАНТАЙМНЫМ: новый статус в Core (или старая панель против нового
          ядра) давал `undefined` и на слово, и на класс — пилюля исчезала
          вовсе, и строка молчала о том, что с агентом. До сведения словарей
          здесь стоял тернарник с фолбэком «выключен», то есть ВРАНЬЁ вместо
          пустоты; печатаем сырое значение нейтральной пилюлей — тем же
          приёмом, что `BUSINESS_LABEL[a.business] ?? a.business` строкой
          выше. Нейтральной: об архивности незнакомого статуса мы не знаем
          ничего. */}
      <span className={CARD_PILL[a.status] ?? "pill"}>{CARD_WORD[a.status] ?? a.status}</span>
    </Link>
  );
}
