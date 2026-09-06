import Link from "next/link";
import { dayLabel, describeLast, flowsHref, outcomeTone, type UpcomingRow } from "../lib/crons";

/**
 * Ближайшие срабатывания рутин — одинаковые строки на доске и на главной.
 *
 * Рядом с будущим запуском стоит исход ПРОШЛОГО: вопрос владельца звучит не
 * «когда», а «когда — и отработало ли оно в прошлый раз»; ради второго
 * пришлось бы уходить в журнал.
 *
 * `now` передают там, где строки вырваны из-под заголовка дня (виджет главной
 * склеивает сегодня и завтра): «08:00» без дня — это обещание, которое можно
 * прочитать на сутки раньше.
 */
export function UpcomingRuns({
  rows,
  limit,
  now,
}: {
  rows: UpcomingRow[];
  limit?: number;
  now?: Date;
}) {
  const shown = limit === undefined ? rows : rows.slice(0, limit);
  return (
    <div className="runs-strip">
      {shown.map((row) => (
        <Link href={flowsHref(row.job)} className="trow" key={`${row.at}/${row.job.id}`}>
          <div className="tb">
            <div className="tt">
              {now ? `${dayLabel(row.at, now)} ${row.time}` : row.time} ·{" "}
              {row.job.kind === "monitor" ? row.job.skill : `${row.job.agent}/${row.job.skill}`}
            </div>
            <div className="tm">
              <span className={`led run-led ${outcomeTone(row.job.last)}`}>
                {describeLast(row.job.last)}
              </span>
            </div>
          </div>
          <span className="due">плейбэк →</span>
        </Link>
      ))}
    </div>
  );
}
