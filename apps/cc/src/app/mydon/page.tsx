import Link from "next/link";
import { core, CoreUnavailable, type AgentsStatus, type Approval, type Briefing } from "../../lib/core";
import { CoreDown } from "../../components/core-down";
import { AgentGrid } from "../../components/agent-grid";
import { ApprovalCard } from "../../components/approval-card";
import { UpcomingRuns } from "../../components/upcoming-runs";
import { coffeeImportDetails, stripPayload } from "../../lib/approval-details";
import { groupUpcoming, type UpcomingRow } from "../../lib/crons";
import { when } from "../../lib/format";
import { DOMAIN_LABELS } from "@mydon/shared";

export const dynamic = "force-dynamic";

/** Те же четыре тревоги, что в утреннем брифинге бота (ответ владельца, Ф11). */
function alarms(b: Briefing) {
  return [
    { n: b.overdueMoney, k: "просрочено платежей" },
    { n: b.idleMachines, k: "автоматы простаивают" },
    { n: b.contractsDueSoon, k: "договоры на исходе" },
    { n: b.pendingApprovals, k: "ждут твоего решения" },
  ];
}

export default async function Main() {
  let briefing: Briefing;
  let pending: Approval[];
  try {
    [briefing, pending] = await Promise.all([core.briefing(), core.pendingApprovals()]);
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  // Сколько записей ждёт слова владельца — вход в очередь утверждения прямо с
  // главной (на телефоне это основной путь). Ошибка тут не должна ронять сводку.
  let queue = 0;
  try {
    const p = await core.pendingEntities();
    queue = p.cards.length + new Set(p.fields.map((f) => f.entityId)).size;
  } catch {
    queue = 0;
  }

  // Что агенты сделают в ближайшие сутки. Доска рутин живёт снимком рантайма
  // агентов, и её отказ (нет снимка, нет токена, лёг контейнер) не должен
  // уносить с собой тревоги и очередь решений — главный экран остаётся.
  let upcoming: UpcomingRow[] = [];
  let cronNow = new Date();
  try {
    const board = await core.cronBoard();
    cronNow = new Date(board.now);
    const groups = groupUpcoming(board, cronNow);
    upcoming = [...groups.today, ...groups.tomorrow].slice(0, 5);
  } catch {
    upcoming = [];
  }

  // Кто из агентов сейчас работает, кто молчит и почему (R-A2-4). Считает Core:
  // занятость выводится из задач и лизы claim. Системные тумблеры состояния НЕ
  // меняют (перепроверка A2, ревью C-1) — их сетка печатает отдельной строкой,
  // как и число ожидающих порученных задач. Отказ маршрута не должен уносить тревоги и очередь
  // решений — но и ПРОПАСТЬ раздел не имеет права (круг починок, C-2): при 500
  // или таймауте на «Главном» просто не было раздела «Агенты», и экран
  // выглядел нормальным над не отвечающим Core. Причину показываем человеку —
  // тем же способом, что карточка агента (`CoreUnavailable.detail`).
  let agents: AgentsStatus | null = null;
  let agentsError: string | null = null;
  try {
    agents = await core.agentsStatus();
  } catch (err) {
    agentsError =
      err instanceof CoreUnavailable ? err.detail : err instanceof Error ? err.message : String(err);
  }

  const list = alarms(briefing);
  const total = list.reduce((s, a) => s + a.n, 0);
  const importDetails = await coffeeImportDetails(pending.slice(0, 3));

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Главное</h1>
        <p className="lead">Обновлено {when(briefing.generatedAt)} · то же, что приходит в 07:30 в Telegram</p>
      </div>

      {pending.length > 0 && (
        <div className="card hot" style={{ marginBottom: 16 }}>
          <div className="sect-h">
            <span className="chip h">требует решения · {pending.length}</span>
          </div>
          {pending.slice(0, 2).map((a) => (
            <Link href="/inbox" className="trow hot" key={a.id}>
              <div className="tb">
                <div className="tt">{a.action}</div>
                <div className="tm">
                  <span className="who"><span className="av ag">✦</span>{a.agent}</span>
                </div>
              </div>
              <span className="due hot">решить</span>
            </Link>
          ))}
          <Link href="/inbox" className="btn full sm">Все решения</Link>
        </div>
      )}

      {queue > 0 && (
        <Link href="/inbox" className="trow hot" style={{ marginBottom: 16 }}>
          <div className="tb">
            <div className="tt">На утверждение</div>
            <div className="tm">
              заведено не тобой · {queue} {queue === 1 ? "запись" : "записей"}
            </div>
          </div>
          <span className="due hot">открыть</span>
        </Link>
      )}

      {/* ── Направления ─────────────────────────────────────────────────
          ЕДИНСТВЕННЫЙ ВХОД В РАБОЧИЕ МЕСТА С ТЕЛЕФОНА. Сайдбар скрыт ниже
          900 px, а в нижнюю панель попадают только сквозные пункты — ни
          одного направления. То есть в /domain/vendhub с телефона нельзя
          было попасть НИ ОДНИМ КЛИКОМ: оставались прямой адрес, ⌘K и ссылка
          из чата. Владелец открывает панель утром именно с телефона.

          На широком экране блок тоже не лишний: он дублирует сайдбар, но
          отвечает на вопрос «куда идти» на самом входе, а не сбоку. */}
      <div className="sect" style={{ marginBottom: 16 }}>
        <div className="sect-h">
          <h3 className="h2">Направления</h3>
        </div>
        <div className="wgrid">
          {(["vendhub", "globerent", "personal"] as const).map((d) => (
            <Link href={`/domain/${d}`} className="wt" key={d}>
              <div className="wl">{DOMAIN_LABELS[d]}</div>
              <div className="wv" style={{ fontSize: 15 }}>
                рабочее место
                <span className="go" style={{ marginLeft: 6 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="tiles">
        {list.map((a) => (
          <div className={`tile ${a.n > 0 ? "is-hot" : "zero"}`} key={a.k}>
            <div className="lab">{a.k}</div>
            <div className="v">{a.n}</div>
            <div className="foot"><span className="mk" />{a.n > 0 ? "нужно внимание" : "спокойно"}</div>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="empty" style={{ marginTop: 16 }}>
          <b>Тревог нет</b>
          Просрочек, простоев и незакрытых согласований не найдено.
        </div>
      )}

      {/* «Агенты» — под тревогами (R-A2-4): сначала что горит, потом кто этим
          занят. Двенадцать плиток на одном экране и отдельная строка про
          системную паузу, если она включена. */}
      {/* Три вида: строки, «Core не назвал ни одного агента» и «не прочиталось
          с причиной». Пропажа раздела — не вариант: она читается как «агентов
          нет» (то же правило, что у пропавшей строки в `apps-health.ts`). */}
      <AgentGrid
        rows={agents?.agents ?? []}
        paused={agents?.paused ?? { schedules: false, tasks: false }}
        {...(agents !== null ? { runtime: agents.runtime } : {})}
        // Давность состояния считаем от времени CORE: часы панели на границе
        // суток подписали бы вчерашний прогон сегодняшним днём.
        now={agents !== null ? new Date(agents.now) : new Date()}
        {...(agentsError !== null ? { error: agentsError } : {})}
      />

      {upcoming.length > 0 && (
        <div className="sect" style={{ marginTop: 16 }}>
          <div className="sect-h">
            <h3 className="h2">Ближайшие 24 ч</h3>
            <Link href="/crons" className="go">все рутины →</Link>
          </div>
          {/* `now` обязателен: строки склеены из «сегодня» и «завтра», и время
              без дня прочиталось бы на сутки раньше. */}
          <UpcomingRuns rows={upcoming} limit={5} now={cronNow} />
        </div>
      )}

      {briefing.contractsBadDate !== undefined && briefing.contractsBadDate > 0 && (
        <div className="warn" style={{ marginTop: 14 }}>
          <b>Договоры с непонятной датой: {briefing.contractsBadDate}</b>
          У них не разобрать срок окончания — в подсчёт «на исходе» они не попали. Проверьте вручную,
          иначе срок пройдёт незамеченным.
        </div>
      )}

      <div className="sect-h" style={{ marginTop: 26 }}><h3 className="h2">Очередь решений</h3></div>
      {pending.length === 0 ? (
        <div className="empty">
          <b>Очередь пуста</b>
          Агенты ничего не предлагают. Порог автономии T0 — сами они не действуют.
        </div>
      ) : (
        <>
          {pending.slice(0, 3).map((a) => (
            <ApprovalCard key={a.id} item={stripPayload(a)} details={importDetails.get(a.id)} />
          ))}
          {pending.length > 3 && (
            <Link href="/inbox" className="navlink" style={{ justifyContent: "center" }}>
              Показать все — {pending.length}
            </Link>
          )}
        </>
      )}
    </>
  );
}
