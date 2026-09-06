import { RUN_OUTCOMES, RUN_OUTCOME_LABELS, isRunOutcome } from "@mydon/shared";
import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import { FlowStrip } from "../../components/flow-strip";
import { core, CoreRefused, CoreUnavailable, type FlowPlayback, type FlowSummary } from "../../lib/core";
import { outcomeTone, runWhen } from "../../lib/crons";
import { detailText, mergeTimeline, runPhrase, stamp, type TimelineRow } from "../../lib/flows";
import { plural } from "../../lib/format";

export const dynamic = "force-dynamic";

/** Сколько прогонов показываем разом: журнал длинный, экран — нет. */
const LIMIT = "50";

/** Источник строки ленты словом: запись шины и запись аудита — разные вещи. */
const KIND_LABEL: Record<TimelineRow["kind"], string> = { event: "событие", audit: "аудит" };

/** Пустую строку запроса считаем отсутствующим фильтром: `?agent=` — это не фильтр. */
const pick = (v: string | undefined): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Экран «Прогоны» — плейбэк работы агентов (волна R, R-R-5).
 *
 * Отвечает на вопрос «что оно сделало и где оборвалось»: слева журнал
 * прогонов, справа — шесть фаз одного прогона, его причина и лента событий с
 * аудитом. Выбранный прогон живёт в адресе (`?run=`), а не в состоянии
 * клиента: ссылку на разбор можно кинуть в чат, а фильтры переживают переход.
 *
 * Плейбэк грузим ОТДЕЛЬНЫМ запросом и в своём try: отказ по одному прогону
 * (устаревшая ссылка) не должен уносить журнал — иначе владелец вместо списка
 * получал бы «Core недоступен» из-за собственной закладки.
 */
export default async function FlowsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; skill?: string; outcome?: string; run?: string }>;
}) {
  const sp = await searchParams;
  const agent = pick(sp.agent);
  const skill = pick(sp.skill);
  // Чужой исход из адреса (закладка, опечатка в URL) в Core НЕ отправляем: с
  // волны A1 он отвечает 400, и экран вместо журнала показал бы «нет связи».
  // Показываем весь журнал и говорим, что фильтр не применён.
  const askedOutcome = pick(sp.outcome);
  const outcome = isRunOutcome(askedOutcome) ? askedOutcome : undefined;
  const badOutcome = askedOutcome !== undefined && outcome === undefined;
  const runId = pick(sp.run) ?? null;
  const filters = {
    ...(agent ? { agent } : {}),
    ...(skill ? { skill } : {}),
    ...(outcome ? { outcome } : {}),
  };
  const filtered = Object.keys(filters).length > 0;

  let runs: FlowSummary[];
  try {
    ({ runs } = await core.flows({ ...filters, limit: LIMIT }));
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  let playback: FlowPlayback | null = null;
  let failure: string | null = null;
  // «Прогона нет» и «Core сломался» — разные ответы, и второй нельзя выдавать
  // за первый. Различает их ТИП отказа (`CoreRefused` на 404), а не текст
  // сообщения: разбор строки «HTTP 404 на …» ломался бы от любой правки
  // формата, и устаревшая закладка превращалась бы в экран аварии.
  let missing = false;
  if (runId !== null) {
    try {
      playback = await core.flow(runId);
    } catch (err) {
      if (err instanceof CoreRefused) missing = true;
      else failure = err instanceof CoreUnavailable ? err.detail : String(err);
    }
  }

  // Ссылка строки несёт текущие фильтры: без них возврат из плейбэка
  // высаживал бы владельца в полный журнал вместо своей выборки.
  const runHref = (id: string): string =>
    `/flows?${new URLSearchParams({ ...filters, run: id }).toString()}`;
  // Час рендера — только для подписи дня («сегодня 08:00» против «03.09 08:00»):
  // журнал длиной в 50 прогонов покрывает несколько суток, и голое время
  // читалось бы как сегодняшнее.
  const now = new Date();
  const timeline = playback ? mergeTimeline(playback.events, playback.audit) : [];

  return (
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Прогоны</h1>
        <p className="lead">
          {runs.length > 0
            ? `${runs.length} ${plural(runs.length, "прогон", "прогона", "прогонов")} · последние сверху`
            : filtered
              ? // «Журнал пуст» при фильтре было бы неправдой: пусто не в
                // журнале, а в выборке — и чинить надо фильтр, а не агентов.
                "Ни один прогон не подошёл под фильтр"
              : "Журнал прогонов пуст"}
        </p>
      </div>

      {badOutcome && (
        <div className="warn" style={{ marginBottom: 12 }}>
          <b>Фильтр по исходу не применён</b>
          В адресе указан исход «{askedOutcome}», которого нет: бывают{" "}
          {RUN_OUTCOMES.join(", ")}. Показан весь журнал.
        </div>
      )}

      {/* Форма GET, без JS: фильтр живёт в адресе, значит его можно сохранить
          в закладке и переслать — и он работает даже когда клиент не поднялся. */}
      <form className="search flows-filter" action="/flows" method="get">
        <input type="search" name="agent" defaultValue={agent ?? ""} placeholder="Агент" aria-label="Агент" />
        <input type="search" name="skill" defaultValue={skill ?? ""} placeholder="Навык" aria-label="Навык" />
        <select name="outcome" defaultValue={outcome ?? ""} aria-label="Исход">
          <option value="">Любой исход</option>
          {RUN_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {RUN_OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" style={{ flex: "none", padding: "11px 18px" }}>
          Показать
        </button>
      </form>

      {/* `reading` — не украшение: на телефоне при выбранном прогоне плейбэк
          встаёт ПЕРЕД журналом (globals.css). Иначе переход по `?run=` высаживал
          бы владельца на верх списка, а не на разбор, за которым он и нажимал. */}
      <div className={runId === null ? "flows-layout" : "flows-layout reading"}>
        <div className="flow-list">
          {runs.length === 0 ? (
            <div className="empty">
              <b>{filtered ? "Под фильтр ничего не попало" : "Прогонов ещё нет"}</b>
              {filtered
                ? "Проверь имя агента и навыка — они пишутся так же, как на доске рутин."
                : "Журнал заполняют сами агенты: первая сработавшая рутина появится здесь."}
            </div>
          ) : (
            runs.map((r) => (
              <Link
                key={r.id}
                href={runHref(r.id)}
                className={r.id === runId ? "trow is-active" : "trow"}
                aria-current={r.id === runId ? "page" : undefined}
              >
                <div className="tb">
                  <div className="tt">
                    {runWhen(r.startedAt, now)} · {r.agent}/{r.skill}
                  </div>
                  <div className="tm">
                    <span className={`led run-led ${outcomeTone(r)}`}>{runPhrase(r)}</span>
                  </div>
                </div>
                <span className="due">разбор →</span>
              </Link>
            ))
          )}
        </div>

        <div className="flow-detail">
          {runId === null ? (
            <div className="empty">
              <b>Прогон не выбран</b>
              Открой строку слева — плейбэк покажет шесть фаз: повод, навык, предложение,
              согласование, выполнение и доставку.
            </div>
          ) : playback ? (
            <>
              <div className="section-title">
                {runWhen(playback.run.startedAt, now)} · {playback.run.agent}/{playback.run.skill}
              </div>
              <FlowStrip phases={playback.phases} />

              <section className="card flow-reason" aria-label="Причина прогона">
                <div className="card-top">
                  <span className={`led run-led ${outcomeTone(playback.run)}`}>
                    {runPhrase(playback.run)}
                  </span>
                </div>
                {/* Разбор коуча — мнение модели о прогоне, а не факт Core:
                    курсив и приставка «коуч» держат эту границу видимой. */}
                {playback.run.review && <p className="flow-review">коуч: {playback.run.review}</p>}
                {/* Ключ идемпотентности мелко: он нужен раз в жизни — когда
                    выясняют, почему повтор не создал второе предложение. */}
                <div className="flow-key">{playback.run.requestKey}</div>
              </section>

              {/* Имя списка — ОДНО и видимое: заголовок над лентой. Второй
                  источник (`aria-label` с той же фразой) читался бы вслух
                  дважды и расходился бы с заголовком при первой же правке. */}
              <div className="section-title" id="flow-timeline-title">
                Лента агента в окне прогона
              </div>
              {/* Честная подпись вместо обещания, которого лента не даёт:
                  события выбираются по агенту и времени (`source=agent:<имя>`
                  плюс окно прогона), привязки к самому прогону в схеме нет. У
                  агента, у которого одновременно работают cron-колбэк и
                  task-worker, сюда попадают строки соседнего прогона — и
                  владелец должен читать ленту, зная это. */}
              <p className="hint" style={{ margin: "-4px 0 10px" }}>
                события агента в окне прогона — могут попасть соседние
              </p>
              {timeline.length === 0 ? (
                <div className="empty">
                  <b>Лента пуста</b>
                  Ни шина, ни аудит вокруг этого прогона ничего не записали.
                </div>
              ) : (
                <ul className="flow-timeline" aria-labelledby="flow-timeline-title">
                  {timeline.map((row, i) => {
                    const detail = detailText(row.detail);
                    return (
                      <li key={`${row.at}/${row.kind}/${i}`}>
                        <span className="at">{stamp(row.at)}</span>
                        <span className="chip">{KIND_LABEL[row.kind]}</span>
                        <span className="tl-title">{row.title}</span>
                        {detail !== null && <code>{detail}</code>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : missing ? (
            <div className="empty">
              <b>Прогон не найден</b>
              Ссылка ведёт на прогон <span className="mono">{runId}</span>, которого в журнале нет.
              Выбери прогон в списке слева.
            </div>
          ) : (
            <div className="notice">
              <b>Прогон не открылся</b>
              Журнал Core отвечает, а разбор прогона <span className="mono">{runId}</span> — нет.
              <p style={{ margin: "9px 0 0" }} className="mono">
                {failure}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
