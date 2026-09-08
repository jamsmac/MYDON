import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import {
  core,
  CoreUnavailable,
  type AppsHealth,
  type AppsHealthRow,
  type HealthState,
} from "../../lib/core";
import { when } from "../../lib/format";

export const dynamic = "force-dynamic";

/**
 * Панель «Приложения» (волна A2, R-A2-3; решения Р-3, Р-4, Р-6).
 *
 * Отвечает на один вопрос: что происходит с источниками — с теми, что ходят
 * наружу (OurVend, курс, Notion, Telegram, модели), и с внутренними
 * мониторами, которые читают только Core.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭКРАНА: «не оценить» не похоже на «в порядке». Оценку даёт
 * Core одним маршрутом (`GET /apps/health`) — панель не повторяет правила и не
 * сочиняет вторых формулировок; её работа в том, чтобы третье состояние нельзя
 * было прочитать как первое. Ноль прогонов, выключенный монитор и
 * ненастроенный источник выглядят спокойно ровно до того дня, когда молчание
 * оказывается поломкой.
 *
 * Тёмная тема: это системный экран агентского слоя (§4 правил дизайна), как
 * `/crons`, `/flows` и `/skills`, а не бизнес-экран.
 */

/** Состояние → слово. Цвет здесь никогда не единственный носитель смысла. */
const STATE_WORD: Record<HealthState, string> = {
  ok: "в порядке",
  bad: "сломано",
  unknown: "не оценить",
};

/**
 * Состояние → класс лампы.
 *
 * `unknown` получает СВОЙ класс, а не базовую лампу: у базовой залитый серый
 * квадрат — тот же, что у «пропущено: повода нет», и владелец не отличил бы
 * «повода не было» от «мы вообще не знаем». `.led.unknown` рисует пустой
 * квадрат со штриховкой: заливка значит «ответ есть», контур — «ответа нет».
 * Зелёного (`.led.idle`) у него нет ни в одной теме.
 */
const STATE_LED: Record<HealthState, string> = {
  ok: "led idle",
  bad: "led blocked",
  unknown: "led unknown",
};

export default async function AppsPage() {
  let health: AppsHealth;
  try {
    health = await core.appsHealth();
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const все = [...health.outside, ...health.internal];
  const счёт = (state: HealthState): number => все.filter((r) => r.state === state).length;
  // Сводка печатает ВСЕ ТРИ числа, включая нули: «не оценить 0» — это ответ,
  // а спрятанный ноль читался бы как «таких строк не бывает».
  const сводка = `в порядке ${счёт("ok")} · сломано ${счёт("bad")} · не оценить ${счёт("unknown")}`;

  return (
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Приложения</h1>
        <p className="lead">
          {все.length === 0
            ? `Core не назвал ни одного источника · собрано ${when(health.now)}`
            : `${сводка} · собрано ${when(health.now)}`}
        </p>
      </div>

      <HealthSection
        title="Снаружи"
        hint="Ходят в чужую систему: сбор OurVend, курс ЦБ, доставка в Notion, Telegram-бот, модели."
        rows={health.outside}
        emptyTitle="Core не назвал ни одного источника снаружи"
        emptyHint="Ни сбор OurVend, ни курс, ни доставка, ни бот не отчитывались — проверь, запущен ли слой агентов."
      />
      <HealthSection
        title="Внутренние мониторы"
        hint="Сам слой агентов и мониторы, которые читают только Core: здоровье рантайма и данных, а не связи с чужой системой."
        rows={health.internal}
        emptyTitle="Core не назвал ни одного внутреннего монитора"
        emptyHint="Снимка расписаний в Core нет — неизвестно даже, включены ли мониторы. Проверь слой агентов."
      />
    </>
  );
}

function HealthSection({
  title,
  hint,
  rows,
  emptyTitle,
  emptyHint,
}: {
  title: string;
  hint: string;
  rows: readonly AppsHealthRow[];
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <section className="apps-section">
      <div className="section-title">{title}</div>
      <p className="hint">{hint}</p>
      {rows.length === 0 ? (
        <div className="empty">
          <b>{emptyTitle}</b>
          {emptyHint}
        </div>
      ) : (
        rows.map((row) => <HealthRowView key={row.key} row={row} />)
      )}
    </section>
  );
}

/** Строка источника: состояние словом, заголовок, причина, время, ссылка на починку. */
function HealthRowView({ row }: { row: AppsHealthRow }) {
  const тело = (
    <>
      <span className={STATE_LED[row.state]}>{STATE_WORD[row.state]}</span>
      <div className="ab">
        <div className="an">{row.title}</div>
        <div className="as">{row.summary}</div>
        {/* Цитата источника — текстом: итог прогона и ошибка доставки приходят
            из базы, и разметкой их рендерить нельзя. */}
        {row.detail !== undefined && <div className="hint">{row.detail}</div>}
      </div>
      {/* Прочерк, а не пустота: у «не оценить» времени последнего события
          честно нет, и колонка не должна молча съезжать. */}
      <div className="aw">{row.at !== undefined ? when(row.at) : "—"}</div>
    </>
  );
  return row.href !== undefined ? (
    <Link href={row.href} className="approw" data-state={row.state}>
      {тело}
    </Link>
  ) : (
    <div className="approw" data-state={row.state}>
      {тело}
    </div>
  );
}
