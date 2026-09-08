import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import { PauseToggles } from "../../components/pause-toggles";
import { UpcomingRuns } from "../../components/upcoming-runs";
import { core, CoreUnavailable, type CronBoard, type CronBoardJob } from "../../lib/core";
import { describeLast, flowsHref, groupUpcoming, hhmm, outcomeTone, runWhen } from "../../lib/crons";

export const dynamic = "force-dynamic";

/** Как именно сработает задание: через задачу Core, напрямую или монитором. */
const MODE_LABEL: Record<CronBoardJob["mode"], string> = {
  "durable-task": "через задачу",
  legacy: "напрямую",
  monitor: "монитор",
};

/** Имя задания: у монитора агента нет — «system/…» читалось бы как чужой агент. */
const jobName = (job: CronBoardJob): string =>
  job.kind === "monitor" ? job.skill : `${job.agent}/${job.skill}`;

/**
 * Экран «Рутины» — что сработает дальше, что уже сработало и что не сработает
 * вовсе (волна R, R-R-3).
 *
 * Расписания живут в рантайме агентов и приходят сюда снимком, поэтому пустой
 * экран здесь значит не «расписаний нет», а «агенты ещё не отчитались» —
 * разница в том, что чинить. Всё время считается от `board.now` (часов Core),
 * а не от часов панели: иначе «Сегодня» на экране и «сегодня» в снимке
 * разъезжались бы на границе суток.
 */
export default async function CronsPage() {
  let board: CronBoard;
  try {
    board = await core.cronBoard();
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const now = new Date(board.now);
  const snapshot = board.snapshot;
  const staleMin = snapshot ? Math.round(snapshot.ageSec / 60) : 0;
  const groups = groupUpcoming(board, now);
  const upcoming: { title: string; rows: typeof groups.today }[] = [
    { title: "Сегодня", rows: groups.today },
    { title: "Завтра", rows: groups.tomorrow },
  ].filter((g) => g.rows.length > 0);

  return (
    <>
      <div className="page-head">
        <h1>Рутины</h1>
        <p className="lead">
          Сейчас {hhmm(board.now)} по Ташкенту
          {snapshot ? ` · снимок расписаний от ${hhmm(snapshot.generatedAt)}` : ""}{" "}
          {snapshot?.stale && (
            // Снимок протух — расписания на экране могли устареть. Молчание
            // агентов само по себе повод посмотреть на контейнер.
            <span className="chip h">агенты не отчитывались {staleMin} мин</span>
          )}
        </p>
      </div>

      <PauseToggles schedules={board.paused.schedules} tasks={board.paused.tasks} />

      {snapshot === null ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <b>Агенты ещё не отчитались о расписаниях</b>
          Снимок присылает рантайм агентов при старте и раз в несколько минут. Проверь контейнер
          <span className="mono"> mydon-agents</span> — чинить надо его, а не расписания.
        </div>
      ) : (
        <>
          <section aria-label="Ближайшие 24 ч">
            <div className="section-title">Ближайшие 24 ч</div>
            {upcoming.length === 0 ? (
              <div className="empty">
                <b>В ближайшие сутки запусков нет</b>
                {board.paused.schedules
                  ? "Расписания на паузе — тумблер выше вернёт их в работу."
                  : "Ни одно расписание не попадает в ближайшие 24 часа."}
              </div>
            ) : (
              upcoming.map((g) => (
                <div key={g.title}>
                  <div className="section-title task-urgency-title">{g.title}</div>
                  <UpcomingRuns rows={g.rows} />
                </div>
              ))
            )}
          </section>

          <div className="section-title">Все расписания</div>
          <div className="crons-wrap">
            <table className="crons-table">
              <thead>
                <tr>
                  <th>Задание</th>
                  <th>Cron</th>
                  <th>Режим</th>
                  <th>Следующий</th>
                  <th>Последний исход</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {board.jobs.map((job) => (
                  <tr key={job.id} className={job.paused ? "is-paused" : undefined}>
                    <td>
                      <b>{jobName(job)}</b>
                      {job.disabledReason && <div className="dim">{job.disabledReason}</div>}
                      {job.enabled && job.paused && <div className="dim">на паузе</div>}
                    </td>
                    <td className="mono">{job.cron === "" ? "—" : job.cron}</td>
                    <td>{MODE_LABEL[job.mode]}</td>
                    {/* День обязателен: недельный cron сработает не сегодня, а голое
                        «08:00» владелец прочитает как ближайшее утро. Прочерк — тоже
                        ответ («не сработает»), а не пустая клетка. */}
                    <td className="mono">{job.nextRun ? runWhen(job.nextRun, now) : "—"}</td>
                    {/* Исход БЕЗ времени врёт молча: вчерашний прогон и
                        мартовский выглядят одинаково, и «выполнено» читается
                        как «работает». День обязателен по той же причине, что
                        и в колонке «Следующий». */}
                    <td>
                      <span className={`led run-led ${outcomeTone(job.last)}`}>
                        {describeLast(job.last)}
                      </span>
                      {job.last && <div className="dim">{runWhen(job.last.at, now)}</div>}
                    </td>
                    <td>
                      <Link href={flowsHref(job)} className="go">
                        плейбэк →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
