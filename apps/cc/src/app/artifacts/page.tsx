import { DOMAINS, DOMAIN_LABELS } from "@mydon/shared";
import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import {
  core,
  CoreRefused,
  CoreUnavailable,
  type ArtifactList,
  type ArtifactRow,
  type Person,
} from "../../lib/core";
import {
  ARTIFACT_KINDS,
  ARTIFACTS_LIMIT,
  ARTIFACTS_Q_MAX,
  authorWord,
  fileHref,
  isArtifactKind,
  isDomain,
  isSearchable,
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
 * `/flows`, — выборку можно сохранить закладкой и переслать. Тип, направление,
 * даты И ДЛИНА НАЗВАНИЯ из адреса СУЖАЮТСЯ до значений, которые Core примет,
 * ПЕРЕД походом в него: на чужое значение он отвечает 400, и экран показал бы
 * «нет связи» вместо витрины из-за опечатки в закладке. Непринятый фильтр
 * называется словами.
 *
 * КУРСОР — ЕДИНСТВЕННЫЙ ПАРАМЕТР, КОТОРЫЙ СУЗИТЬ НЕЛЬЗЯ: он непрозрачен, его
 * форму знает только Core. Поэтому у него другой приём — не проверка до, а
 * разбор отказа после: 400 приходит `CoreRefused` (`refused: [400]` у
 * `core.artifacts`), страница показывает архив С НАЧАЛА и говорит про курсор
 * словами. «Нет связи с ядром» на живом ядре — то же враньё экрана, от
 * которого уводит сужение фильтров.
 *
 * СКОРОСТИ ЭКРАН НЕ ОБЕЩАЕТ, И ЭТО ИЗМЕРЕНО. Посадочный вид (без `?kind=`)
 * индексом не покрыт — на 50 000 строк это `Seq Scan`, и второй индекс признан
 * платой за запись без выигрыша
 * (`packages/db/drizzle/0089_attachment_artifacts.sql` — там же замер объёма
 * таблицы на проде). Поэтому
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
  const askedQ = pick(sp.q);
  const cursor = pick(sp.cursor);

  const kind = isArtifactKind(askedKind) ? askedKind : undefined;
  const domain = isDomain(askedDomain) ? askedDomain : undefined;
  // Название — тоже сужаемый параметр: у Core на `q` стоит `MaxLength(200)`, и
  // строка длиннее была бы 400, то есть экраном отказа вместо витрины. Ссылку
  // `?q=<имя файла>` печатает бот, а имя собирает модель — длина не в наших руках.
  const q = askedQ !== undefined && isSearchable(askedQ) ? askedQ : undefined;
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
  if (askedQ !== undefined && q === undefined) {
    неПрименены.push(`название длиннее ${ARTIFACTS_Q_MAX} символов`);
  }

  /** Фильтры страницы, пережившие проверку, — в форме адреса (дни, не ISO). */
  const filters: Record<string, string> = {
    ...(kind !== undefined ? { kind } : {}),
    ...(domain !== undefined ? { domain } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(q !== undefined ? { q } : {}),
  };
  const filtered = Object.keys(filters).length > 0;

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
  const порция = async (
    откуда: string | undefined,
  ): Promise<{ ok: [ArtifactList, Person[]] } | { fail: unknown }> => {
    try {
      return {
        ok: await Promise.all([
          core.artifacts({
            ...(kind !== undefined ? { kind } : {}),
            ...(domain !== undefined ? { domain } : {}),
            ...(период.from !== undefined ? { from: период.from } : {}),
            ...(период.to !== undefined ? { to: период.to } : {}),
            ...(q !== undefined ? { q } : {}),
            ...(откуда !== undefined ? { cursor: откуда } : {}),
            limit: ARTIFACTS_LIMIT,
          }),
          core.people(true).catch(() => [] as Person[]),
        ]),
      };
    } catch (err) {
      return { fail: err };
    }
  };

  /*
   * ИСПОРЧЕННЫЙ КУРСОР — НЕ АВАРИЯ ЯДРА, И ЭКРАН НЕ ИМЕЕТ ПРАВА ГОВОРИТЬ
   * ИНАЧЕ. Курсор непрозрачен, и страница проверить его не может — форму
   * знает только Core (`decodeCursor`, 400 на испорченном). Прежде любой
   * не-ok становился `CoreUnavailable`, и `/artifacts?cursor=abc` рисовал
   * «Нет связи с ядром MYDON. Проверьте контейнер mydon-core» при ЖИВОМ
   * ядре: владельца отправляли проверять здоровый контейнер из-за опечатки в
   * закладке. Теперь 400 — `CoreRefused` (`refused: [400]` у `core.artifacts`),
   * и ответ на него — начало списка плюс строка о курсоре, а не пустота и не
   * экран аварии.
   */
  let ответ = await порция(cursor);
  /** Курсор Core не принял: витрина показана с начала, и об этом сказано. */
  let курсорНеПринят = false;
  if ("fail" in ответ && ответ.fail instanceof CoreRefused && cursor !== undefined) {
    курсорНеПринят = true;
    ответ = await порция(undefined);
  }
  if ("fail" in ответ) {
    const err = ответ.fail;
    /*
     * 400 БЕЗ КУРСОРА — ТОЖЕ НЕ АВАРИЯ. Сегодня этой ветки не достичь: тип,
     * направление, даты и длину названия страница сужает сама, а `limit` —
     * константа. Значит такой ответ означал бы, что контракт параметров
     * панели и Core разошёлся, — и «нет связи» соврало бы о мире ровно так
     * же, как врало про курсор. Поэтому отказ называется отказом.
     */
    if (err instanceof CoreRefused) {
      return (
        <>
          <div className="page-head">
            <h1>Артефакты</h1>
          </div>
          <div className="warn">
            <b>Ядро не приняло запрос</b>
            Связь с MYDON есть, но выборку Core считает неверной (HTTP {err.status}). Дело в адресе,
            а не в контейнере: <Link href="/artifacts">открыть архив без фильтров</Link>.
          </div>
        </>
      );
    }
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }
  const [list, люди] = ответ.ok;

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
        {/*
         * ШАПКА НЕ НАЗЫВАЕТ ЧИСЛОМ СТРАНИЦЫ ЧИСЛО АРХИВА. Общего количества у
         * страницы нет и быть не может: Core отдаёт порцию и курсор, а не
         * `total` (`ArtifactsPage` в `artifacts.service.ts`) — считать его
         * значило бы просканировать таблицу целиком на каждый показ. Прежнее
         * «3 артефакта · последние сверху» на второй странице читалось как
         * «в архиве три артефакта», то есть экран утверждал то, чего не знает.
         */}
        <p className="lead">
          {n === 0
            ? `архив ведётся с ${с}`
            : `${n} ${plural(n, "артефакт", "артефакта", "артефактов")} на этой странице · последние сверху · архив ведётся с ${с}`}
        </p>
      </div>

      {курсорНеПринят && (
        <div className="warn" style={{ marginBottom: 12 }}>
          <b>Курсор из адреса не распознан</b>
          Ядро его не приняло — архив показан с начала списка. Ссылку «дальше» возьмите заново, а
          в закладку сохраняйте адрес без курсора.
        </div>
      )}

      {неПрименены.length > 0 && (
        <div className="warn" style={{ marginBottom: 12 }}>
          <b>Часть фильтров не применена</b>
          В адресе: {неПрименены.join(", ")} — Core такие значения не принимает. Показана выборка
          без них.
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
          maxLength={ARTIFACTS_Q_MAX}
          placeholder="Название"
          aria-label="Название"
        />
        <button className="btn" type="submit" style={{ flex: "none", padding: "11px 18px" }}>
          Показать
        </button>
      </form>

      {n === 0 ? (
        /* Курсор, который Core не принял, — уже НЕ курсор: выдача пришла с
           начала списка, и «страница за курсором закончилась» о ней соврала бы. */
        <EmptyState
          filtered={filtered}
          cursor={курсорНеПринят ? undefined : cursor}
          since={с}
          back={адрес({})}
        />
      ) : (
        <section aria-label="Список артефактов">
          {list.items.map((row) => (
            <ArtifactRowView key={row.id} row={row} now={момент} people={имена} />
          ))}
          {list.next !== null && (
            /* ВОЗМОЖНОСТЬ, А НЕ ФАКТ (круг починок 3, A-3). Курсор Core отдаёт
               по признаку «строк ровно `limit`» (`rows.length === limit` в
               artifacts.service.ts) — то есть «страница МОГЛА быть не
               последней». На объёме, кратном 50, архив кончается ровно на
               50-й строке, и утвердительное «Это не весь архив» врало бы:
               владелец жмёт «дальше» и получает «Дальше пусто». Пустой
               запрос дешевле пропущенной строки, но обещание экрана обязано
               совпадать с тем, что ядро знает. */
            <p className="hint">
              Возможно, это не весь архив · <Link href={адрес({ cursor: list.next })}>дальше →</Link>
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
          {/*
           * `download` — ЧТОБЫ ФАЙЛ НЕ СКАЧИВАЛСЯ ПОД ИМЕНЕМ «raw».
           *
           * Имени файла в базе нет (есть `title` и `storage_key`), а Core и
           * прокси панели ставят `Content-Disposition: attachment` БЕЗ
           * `filename` — браузер берёт имя из последнего сегмента адреса, то
           * есть `raw`, `raw (1)`, `raw (2)`. Витрина сделала этот маршрут
           * единственной дверью к docx/xlsx/pdf, а четыре соседних скачивания
           * панели имя ставят. Атрибут работает: прокси свой (origin панели),
           * а при `attachment` без `filename` браузер берёт значение отсюда.
           *
           * РАСШИРЕНИЯ В ИМЕНИ НЕТ: `title` — «Дебиторка GLOBERENT
           * 08.09.2026» (`заголовокИзИмени` в боте срезает его намеренно, по
           * нему ищут). Полная починка — отдавать `filename*` у Core, собрав
           * его из `title` и расширения ключа хранилища; это форма решения
           * владельца и записано кандидатом, а не сделано здесь.
           *
           * Не ставим вместе с `target="_blank"`: у HTML (ветка мёртвая, см.
           * `opensInNewTab`) смысл ровно обратный — такой артефакт читают.
           */}
          <a
            href={fileHref(row.id)}
            {...(opensInNewTab(row.mime)
              ? { target: "_blank", rel: "noreferrer" }
              : row.title !== null
                ? { download: row.title }
                : {})}
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
