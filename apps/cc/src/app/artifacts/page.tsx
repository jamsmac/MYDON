import { DOMAINS, DOMAIN_LABELS } from "@mydon/shared";
import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import { core, CoreUnavailable, type ArtifactList, type ArtifactRow, type Person } from "../../lib/core";
import {
  ARTIFACT_KINDS,
  ARTIFACTS_LIMIT,
  authorWord,
  fileHref,
  isArtifactKind,
  isDomain,
  opensInNewTab,
  ownerCard,
  периодВМоменты,
  sinceWord,
} from "../../lib/artifacts";
import { ago, plural } from "../../lib/format";
import { ARTIFACT_KIND_LED, ARTIFACT_KIND_WORD } from "../../lib/state";

export const dynamic = "force-dynamic";

/** Пустую строку запроса считаем отсутствующим фильтром: `?kind=` — это не фильтр. */
const pick = (v: string | undefined): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Кольцо артефактов (срез A3, Р-A3-4 … Р-A3-6).
 *
 * Отвечает на один вопрос: «где тот файл, который бот (агент) сделал для
 * меня». До среза ответа не было вовсе: документ, стоивший вызова модели с
 * исполнением кода, уходил в Telegram и не сохранялся нигде
 * (`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`). Поэтому
 * экран честен о прошлом: пустое состояние НАЗЫВАЕТ ДАТУ, с которой архив
 * ведётся, а не говорит «ничего не найдено» (`ARTIFACTS_SINCE`).
 *
 * ФИЛЬТРЫ ЖИВУТ В АДРЕСЕ, а не в состоянии клиента: форма GET без JS, как на
 * `/flows`, — выборку можно сохранить закладкой и переслать. Тип, направление
 * и даты из адреса СУЖАЮТСЯ до известных значений ПЕРЕД походом в Core: на
 * чужое значение Core отвечает 400, и экран показал бы «нет связи» вместо
 * витрины из-за опечатки в закладке. Непринятый фильтр называется словами.
 *
 * СКОРОСТИ ЭКРАН НЕ ОБЕЩАЕТ, И ЭТО ИЗМЕРЕНО. Посадочный вид (без `?kind=`)
 * индексом не покрыт — на 50 000 строк это `Seq Scan`, и второй индекс признан
 * платой за запись без выигрыша (`packages/db/migrations/0089…`). Поэтому
 * страница берёт РОВНО одну порцию (`ARTIFACTS_LIMIT`) и ходит дальше по
 * курсору, а не рисует «всё сразу» с прокруткой.
 *
 * ГРАММАТИКА СТРОКИ — Д1 (`rules.md` §4.1): слово (тип из `lib/state.ts`) +
 * лампа + давность по ЧАСАМ CORE (`list.now`, а не `Date.now()` — тот же
 * довод, что у `/apps`: на границе суток «сегодня» панели и Core разъезжаются).
 * Классы — те, что уже стоят на этом листе (`.approw`, `.search`,
 * `.flows-filter`, `.empty`, `.warn`, `.hint`): новых токенов и классов срез
 * не заводит.
 *
 * ССЫЛКА НА ФАЙЛ — через прокси панели (`fileHref`), не на Core напрямую: Core
 * наружу не открыт. HTML — в новой вкладке, прочее — обычной ссылкой.
 *
 * Тёмная тема — не отсюда: `/artifacts` числится в `CONSOLE_ROUTES`
 * (`lib/theme.ts`), атрибут ставят прокси (`proxy.ts`, первый кадр) и
 * `ThemeSync` (SPA-переход), как у `/apps` и `/flows`.
 */
export default async function ArtifactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    domain?: string;
    from?: string;
    to?: string;
    q?: string;
    cursor?: string;
  }>;
}) {
  const sp = await searchParams;
  const askedKind = pick(sp.kind);
  const askedDomain = pick(sp.domain);
  const askedFrom = pick(sp.from);
  const askedTo = pick(sp.to);
  const q = pick(sp.q);
  const cursor = pick(sp.cursor);

  const kind = isArtifactKind(askedKind) ? askedKind : undefined;
  const domain = isDomain(askedDomain) ? askedDomain : undefined;
  const период = периодВМоменты(askedFrom, askedTo);
  // Дни из адреса, которые разобрались: они же возвращаются в поля формы и в
  // ссылку «дальше». Мусор (`from=вчера`) в форму не возвращаем — иначе
  // владелец отправил бы его повторно, не заметив.
  const from = период.from !== undefined ? askedFrom : undefined;
  const to = период.to !== undefined ? askedTo : undefined;

  const неПрименены: string[] = [];
  if (askedKind !== undefined && kind === undefined) неПрименены.push(`тип «${askedKind}»`);
  if (askedDomain !== undefined && domain === undefined) {
    неПрименены.push(`направление «${askedDomain}»`);
  }
  if (askedFrom !== undefined && from === undefined) неПрименены.push(`дата с «${askedFrom}»`);
  if (askedTo !== undefined && to === undefined) неПрименены.push(`дата по «${askedTo}»`);

  /** Фильтры страницы, пережившие проверку, — в форме адреса (дни, не ISO). */
  const filters: Record<string, string> = {
    ...(kind !== undefined ? { kind } : {}),
    ...(domain !== undefined ? { domain } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(q !== undefined ? { q } : {}),
  };
  const filtered = Object.keys(filters).length > 0;

  let list: ArtifactList;
  let люди: Person[];
  try {
    /*
     * ИМЕНА ЛЮДЕЙ — ВТОРЫМ ЧТЕНИЕМ, И ЕГО ОТКАЗ АРХИВ НЕ УНОСИТ. Core отдаёт
     * в строке `createdBy = "person:<uuid>"` (так пишет бот, задача 4), а имя
     * живёт в реестре людей; без него строка печатала бы сырой идентификатор.
     * Один запрос на всю страницу, а не по строке: людей в реестре единицы.
     * `all = true` — автор архивного документа мог уволиться и выпасть из
     * обычной выдачи, а подпись обязана работать и через год (тот же довод и
     * тот же приём, что у `actorLabel` в `app/audit/page.tsx`). Отказ гасится:
     * подпись — украшение строки, архив — её содержание, и терять весь экран
     * из-за имён нельзя.
     */
    [list, люди] = await Promise.all([
      core.artifacts({
        ...(kind !== undefined ? { kind } : {}),
        ...(domain !== undefined ? { domain } : {}),
        ...(период.from !== undefined ? { from: период.from } : {}),
        ...(период.to !== undefined ? { to: период.to } : {}),
        ...(q !== undefined ? { q } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
        limit: ARTIFACTS_LIMIT,
      }),
      core.people(true).catch(() => [] as Person[]),
    ]);
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  const имена = new Map(люди.map((p) => [p.id, p.name]));
  // Момент, от которого считается давность: часы ЯДРА, не браузера (Р-A3-6).
  const момент = new Date(list.now);
  const n = list.items.length;
  const с = sinceWord();
  /** Адрес с текущими фильтрами плюс что-то ещё (курсор): возврат и «дальше» не теряют выборку. */
  const адрес = (extra: Record<string, string>): string => {
    const qs = new URLSearchParams({ ...filters, ...extra }).toString();
    return qs ? `/artifacts?${qs}` : "/artifacts";
  };

  return (
    <>
      <div className="page-head">
        <h1>Артефакты</h1>
        <p className="lead">
          {n === 0
            ? `архив ведётся с ${с}`
            : `${n} ${plural(n, "артефакт", "артефакта", "артефактов")} · последние сверху · архив ведётся с ${с}`}
        </p>
      </div>

      {неПрименены.length > 0 && (
        <div className="warn" style={{ marginBottom: 12 }}>
          <b>Часть фильтров не применена</b>
          В адресе: {неПрименены.join(", ")} — таких значений нет. Показана выборка без них.
        </div>
      )}

      {/* Форма GET, без JS: фильтр живёт в адресе, значит его можно сохранить
          в закладке и переслать — и он работает даже когда клиент не поднялся. */}
      <form className="search flows-filter" action="/artifacts" method="get">
        <select name="kind" defaultValue={kind ?? ""} aria-label="Тип">
          <option value="">Любой тип</option>
          {ARTIFACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {ARTIFACT_KIND_WORD[k]}
            </option>
          ))}
        </select>
        <select name="domain" defaultValue={domain ?? ""} aria-label="Направление">
          <option value="">Любое направление</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d]}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from ?? ""} aria-label="С даты" />
        <input type="date" name="to" defaultValue={to ?? ""} aria-label="По дату" />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Название"
          aria-label="Название"
        />
        <button className="btn" type="submit" style={{ flex: "none", padding: "11px 18px" }}>
          Показать
        </button>
      </form>

      {n === 0 ? (
        <EmptyState filtered={filtered} cursor={cursor} since={с} back={адрес({})} />
      ) : (
        <section aria-label="Список артефактов">
          {list.items.map((row) => (
            <ArtifactRowView key={row.id} row={row} now={момент} people={имена} />
          ))}
          {list.next !== null && (
            <p className="hint">
              Показаны {n} {plural(n, "строка", "строки", "строк")} ·{" "}
              <Link href={адрес({ cursor: list.next })}>дальше →</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}

/**
 * Пустое состояние ГОВОРИТ ПРАВДУ И НАЗЫВАЕТ ДАТУ (Р-A3-5) — в обеих ветках
 * фильтра, а не только в «чистой»: под фильтром владелец так же должен знать,
 * что искать раньше `ARTIFACTS_SINCE` нечего. «Ничего не найдено» здесь не
 * звучит нигде: до этого дня ничего и не сохранялось — это факт о системе, а
 * не результат поиска. Третья ветка — курсор за последней страницей: это не
 * «пусто», это «список кончился», и дата тут ни при чём.
 */
function EmptyState({
  filtered,
  cursor,
  since,
  back,
}: {
  filtered: boolean;
  cursor: string | undefined;
  since: string;
  back: string;
}) {
  if (cursor !== undefined) {
    return (
      <div className="empty">
        <b>Дальше пусто</b>
        Страница за курсором закончилась — <Link href={back}>к началу списка</Link>.
      </div>
    );
  }
  if (filtered) {
    return (
      <div className="empty">
        <b>Под фильтр ничего не попало</b>
        Архив ведётся с {since}: раньше этой даты артефактов не существует. Сними фильтр или
        расширь период.
      </div>
    );
  }
  return (
    <div className="empty">
      <b>Артефактов с {since} ещё нет</b>
      До этого дня документы бота не сохранялись — искать раньше нечего. Первый файл, который
      бот сделает по запросу, появится здесь.
    </div>
  );
}

/**
 * Строка артефакта (грамматика Д1): тип словом и лампой, название-ссылка на
 * файл, кто / для кого / направление, давность по часам Core.
 *
 * Название и владелец — ДВЕ ссылки в одной строке, поэтому строка не `<Link>`
 * целиком, как на `/apps`: вложенные `<a>` — невалидная разметка, и браузер
 * разорвал бы её сам, непредсказуемо.
 */
function ArtifactRowView({
  row,
  now,
  people,
}: {
  row: ArtifactRow;
  now: Date;
  people: ReadonlyMap<string, string>;
}) {
  // Тип мимо словаря (строка, записанная не через `UploadDto`) печатается КАК
  // ЕСТЬ и с базовой лампой: это данные, а сочинять им слово нельзя.
  const kind = isArtifactKind(row.kind) ? row.kind : null;
  const владелец = ownerCard(row.ownerType, row.ownerId);
  const автор = authorWord(row.createdBy, people);
  return (
    <div className="approw" data-kind={row.kind}>
      <span className={kind !== null ? ARTIFACT_KIND_LED[kind] : "led"}>
        {kind !== null ? ARTIFACT_KIND_WORD[kind] : row.kind}
      </span>
      <div className="ab">
        <div className="an">
          <a
            href={fileHref(row.id)}
            {...(opensInNewTab(row.mime) ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {row.title ?? "без названия"}
          </a>
        </div>
        <div className="as">
          {автор !== null && `${автор} · `}
          {владелец.href !== null ? (
            <Link href={владелец.href}>{владелец.label}</Link>
          ) : (
            владелец.label
          )}
          {row.domain !== null && ` · ${DOMAIN_LABELS[row.domain]}`}
        </div>
      </div>
      <div className="aw">{ago(row.createdAt, now)}</div>
    </div>
  );
}
