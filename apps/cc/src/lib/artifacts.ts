import { DOMAINS, TZ, type Domain } from "@mydon/shared";

/**
 * Витрина артефактов (срез A3): константы и чистые функции без Core и без
 * React. Страница `/artifacts` только рисует; всё, что проверяется без
 * рендера, живёт здесь и закрыто `artifacts.test.ts`.
 *
 * Модуль читают и серверная страница, и `lib/state.ts` (тип `ArtifactKind`),
 * который импортируют клиентские компоненты, — поэтому здесь нет ни
 * `server-only`, ни импорта из `./core`.
 */

/**
 * ДЕНЬ, С КОТОРОГО ВЕДЁТСЯ АРХИВ.
 *
 * 2026-09-08 — день выката миграции `0089_attachment_artifacts` (колонки
 * `title`/`domain`/`tags` у `attachment`) и первого сохранения документа
 * ботом ДО отправки в Telegram. Раньше этого дня документы бота не сохранялись
 * нигде: пакет `@mydon/documents` делал файл, бот отправлял его и терял
 * (`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`). Поэтому
 * пустой экран обязан НАЗВАТЬ дату, а не сказать «ничего не найдено»:
 * «ничего» здесь значит «до этого дня архива не существовало» — факт о
 * системе, а не результат поиска (спека §0, Р-A3-5).
 *
 * КОНСТАНТА, А НЕ ЧТЕНИЕ ЖУРНАЛА DRIZZLE: `meta/_journal.json` хранит `when`
 * ГЕНЕРАЦИИ миграции на машине разработчика, а не день выката на прод, и
 * панель до файлов миграций не дотягивается. Если миграция выкатится в другой
 * день — править здесь; `artifacts.test.ts` пришпиливает слово к константе.
 */
export const ARTIFACTS_SINCE = "2026-09-08";

/**
 * Типы вложений на витрине — ровно те три, что принимает `POST /attachments`
 * (`UploadDto.kind` в `apps/core/src/attachments/attachments.controller.ts`).
 * Порядок — порядок в выпадающем списке: документ первым, потому что ради него
 * срез и затевался.
 */
export const ARTIFACT_KINDS = ["doc", "photo", "receipt"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Сколько строк за раз: архив длинный, экран — нет; дальше — по курсору `next`. */
export const ARTIFACTS_LIMIT = "50";

/** Значение из адреса — один из трёх типов? Чужое (`?kind=video`) в Core не уходит: он ответит 400. */
export function isArtifactKind(v: string | undefined): v is ArtifactKind {
  return v !== undefined && (ARTIFACT_KINDS as readonly string[]).includes(v);
}

/** Значение из адреса — одно из направлений? Тот же довод, что у типа. */
export function isDomain(v: string | undefined): v is Domain {
  return v !== undefined && (DOMAINS as readonly string[]).includes(v);
}

/** Сутки в форме `YYYY-MM-DD` — единственная форма, которую страница принимает из адреса. */
const ДЕНЬ = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Сутки из адреса → части календарной даты, КОТОРАЯ СУЩЕСТВУЕТ.
 *
 * ФОРМЫ НЕДОСТАТОЧНО, И ЭТО ИЗМЕРЕНО, А НЕ ПРЕДПОЛОЖЕНО. И `Date.UTC`, и
 * разбор ISO-строки лишние месяцы и дни ПЕРЕПОЛНЯЮТ в следующие, а не
 * отвергают: `Date.UTC(2026, 12, 45, 12)` — это 14 февраля 2027, а
 * `new Date("2026-02-30T00:00:00+05:00")` — 1 марта 2026. Проверка «метка
 * времени жива» (`Number.isFinite`) оба случая пропускает, и обе стороны
 * витрины врали бы по-своему: заголовок пустого экрана печатал бы выдуманный
 * день вместо переданного, а граница периода тихо переезжала бы на сутки,
 * оставаясь «принятым» фильтром, о котором экран не говорит ни слова.
 *
 * Поэтому день сверяется ОБРАТНЫМ РАЗБОРОМ: год, месяц и число обязаны
 * совпасть с тем, что стояло в строке. `null` — такого дня в календаре нет.
 */
function календарныйДень(day: string): { год: number; месяц: number; число: number } | null {
  const m = ДЕНЬ.exec(day);
  if (m === null) return null;
  const год = Number(m[1]);
  const месяц = Number(m[2]);
  const число = Number(m[3]);
  const дата = new Date(Date.UTC(год, месяц - 1, число, 12));
  if (
    дата.getUTCFullYear() !== год ||
    дата.getUTCMonth() !== месяц - 1 ||
    дата.getUTCDate() !== число
  ) {
    return null;
  }
  return { год, месяц, число };
}

/**
 * Дата начала архива словами: «8 сентября 2026».
 *
 * Год дописывается руками: `toLocaleDateString` с `year: "numeric"` печатает
 * «8 сентября 2026 г.», а сокращение «г.» в заголовке пустого экрана — шум.
 * Полдень UTC — чтобы день не уехал на границе суток ни в одном поясе.
 * Мусор на входе возвращается как есть: это константа из кода, и тест
 * увидит её раньше владельца.
 */
export function sinceWord(day: string = ARTIFACTS_SINCE): string {
  const части = календарныйДень(day);
  if (части === null) return day;
  const дата = new Date(Date.UTC(части.год, части.месяц - 1, части.число, 12));
  return `${дата.toLocaleDateString("ru-RU", { timeZone: TZ, day: "numeric", month: "long" })} ${части.год}`;
}

/**
 * Смещение Ташкента: UTC+5 круглый год — Узбекистан не переводит часы с 1991
 * года, поэтому константа честна, а `TZ` из `@mydon/shared` нужен только для
 * печати. Границы периода считаются от суток ВЛАДЕЛЬЦА: «с 1 сентября» значит
 * с полуночи по Ташкенту, а не по UTC, — иначе документ, сделанный вечером
 * 31-го по местному времени, попадал бы «в сентябрь».
 */
const СМЕЩЕНИЕ = "+05:00";

/** Ташкентские сутки → ISO-момент; мусор и «31 февраля» — `undefined`, а не сдвинутая дата. */
function момент(day: string | undefined, время: string): string | undefined {
  if (day === undefined || календарныйДень(day) === null) return undefined;
  const d = new Date(`${day}T${время}${СМЕЩЕНИЕ}`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

/**
 * Период фильтра (две даты из адреса) → границы `from`/`to` для Core.
 *
 * Сутки включительно с обеих сторон: `to=2026-09-08` значит «до конца 8-го»,
 * а не «до его полуночи» — иначе однодневный период `from=to` был бы пустым.
 * Нечитаемая граница просто выпадает: страница скажет об этом словами, а
 * Core получит остальные фильтры.
 */
export function периодВМоменты(
  from: string | undefined,
  to: string | undefined,
): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  const f = момент(from, "00:00:00");
  const t = момент(to, "23:59:59.999");
  if (f !== undefined) out.from = f;
  if (t !== undefined) out.to = t;
  return out;
}

/**
 * Ссылка на сам файл — через прокси панели, а не на Core: Core наружу не
 * открыт, браузер владельца до него не дотянется
 * (`app/api/attachments/[id]/raw/route.ts` ходит в `GET /attachments/:id/raw`).
 * Прокси и Core отдают всё, что не картинка, с `Content-Disposition:
 * attachment` — docx/xlsx/pdf скачиваются, а не открываются в origin панели.
 */
export function fileHref(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}/raw`;
}

/**
 * HTML — в новой вкладке (спека §2.3): такой артефакт читают, а не кладут в
 * папку. Прочие типы — обычной ссылкой: браузер и так предложит сохранить.
 * По MIME, а не по расширению названия: `title` пишет человек или модель, и
 * расширения в нём может не быть вовсе. Параметры типа (`;charset=…`)
 * отбрасываем.
 */
export function opensInNewTab(mime: string | null): boolean {
  return mime !== null && mime.toLowerCase().split(";")[0].trim() === "text/html";
}

/**
 * «Для кого» — владелец вложения: слово и, если у него есть карточка в
 * панели, ссылка на неё. Имени в СЛОВЕ здесь нет намеренно: у владельца
 * четыре разных типа (человек, задача, карточка реестра, движение склада), и
 * имя для каждого пришлось бы тянуть из своей двери Core; карточка по ссылке
 * назовёт его за один переход. Имя есть у АВТОРА (`authorWord` ниже) — там
 * тип один, человек, и одного списка людей на всю страницу довольно.
 *
 * Слова здесь — подписи ТИПА ВЛАДЕЛЬЦА, а не состояния: их дом не
 * `lib/state.ts`. Незнакомый тип печатается как есть — это данные, и
 * придумывать им слово нельзя.
 */
export function ownerCard(ownerType: string, ownerId: string): { label: string; href: string | null } {
  switch (ownerType) {
    case "person":
      return { label: "для человека", href: `/team/${encodeURIComponent(ownerId)}` };
    case "task":
      return { label: "по задаче", href: `/tasks/${encodeURIComponent(ownerId)}` };
    case "entity":
      return { label: "к карточке", href: `/card/${encodeURIComponent(ownerId)}` };
    default:
      return { label: ownerType, href: null };
  }
}

/**
 * «Кто» — автор записи из `createdBy`
 * (`owner | person:<id> | staff:<id> | agent:<имя>`, см.
 * `packages/db/src/schema.ts`, таблица `attachment`). `null` — не записано, и
 * строка это слово не печатает вовсе: «автор неизвестен» было бы утверждением
 * о мире, которого система не делает.
 *
 * ЧЕЛОВЕК РЕЗОЛВИТСЯ В ИМЯ ПО КАРТЕ, А НЕ ПЕЧАТАЕТСЯ КАК ЕСТЬ. Бот пишет
 * документу `createdBy = "person:<uuid>"` (задача 4: «owner» было бы ложью,
 * когда отчёт просит не владелец — в реестре четыре человека, трое не
 * владельцы), и без резолва в строке витрины стоял бы сырой идентификатор.
 * Приём и причина — те же, что у `actorLabel` в `app/audit/page.tsx`: там
 * ЛЮБОЙ человек подписывался «ты», и работа оператора выглядела работой
 * владельца.
 *
 * ФОЛБЭК — СЛОВО «сотрудник», А НЕ ID. Человек мог уволиться и выпасть из
 * выдачи, а список людей — не приехать вовсе (панель терпит его отказ, чтобы
 * не терять из-за имён весь архив). Слово честно в обоих случаях; сырой uuid
 * не сообщает владельцу ничего, кроме того, что панель не справилась.
 */
export function authorWord(
  createdBy: string | null,
  people: ReadonlyMap<string, string>,
): string | null {
  if (createdBy === null || createdBy.length === 0) return null;
  if (createdBy === "owner") return "владелец";
  if (createdBy.startsWith("agent:")) return `агент ${createdBy.slice("agent:".length)}`;
  // Префикс, а НЕ форма uuid: у ранних записей id мог быть коротким, и ветка
  // «печатаем как есть» вернула бы «staff:2f6c9a7e» в строку витрины.
  const человек = /^(?:person|staff):(.*)$/.exec(createdBy);
  if (человек !== null) return people.get(человек[1] ?? "") ?? "сотрудник";
  return createdBy;
}
