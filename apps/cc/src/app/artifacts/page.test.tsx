import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARTIFACT_KINDS, ARTIFACTS_Q_MAX, ARTIFACTS_SINCE } from "../../lib/artifacts";
import type { ArtifactList, ArtifactRow, Person } from "../../lib/core";
import { ago } from "../../lib/format";
import { ARTIFACT_KIND_LED, ARTIFACT_KIND_WORD } from "../../lib/state";
import { themeFor } from "../../lib/theme";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const artifacts = vi.hoisted(() => vi.fn());
const people = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { artifacts, people },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
  // Тот же класс, что видит страница: `instanceof` через мок работает только
  // когда тест и страница берут его из ОДНОГО модуля (приём flows/page.test).
  CoreRefused: class CoreRefused extends Error {
    constructor(readonly status: number) {
      super("Core отказал");
    }
  },
}));

import ArtifactsPage from "./page";
import { CoreRefused, CoreUnavailable } from "../../lib/core";

/** Часы Core в ответе: от них считается давность, а не от часов машины. */
const СЕЙЧАС = "2026-09-08T10:00:00.000Z";

const ДЖАМШИД = "2f6c9a7e-0000-4000-8000-0000000000aa";

/** Человек реестра: витрине от него нужны только `id` и `name`. */
function человек(over: Partial<Person> = {}): Person {
  return {
    id: ДЖАМШИД,
    name: "Джамшид",
    role: null,
    domain: null,
    email: null,
    phone: null,
    tgUsername: null,
    tgChatId: null,
    active: "true",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

/** Строка архива: остальное — «документ бота для человека по GLOBERENT». */
function строка(over: Partial<ArtifactRow>): ArtifactRow {
  return {
    id: "8b1f2d3e-0000-4000-8000-000000000001",
    ownerType: "person",
    ownerId: ДЖАМШИД,
    kind: "doc",
    title: "Дебиторка GLOBERENT за август",
    domain: "globerent",
    tags: ["bot"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: 24_576,
    createdBy: null,
    createdAt: "2026-09-08T09:30:00.000Z",
    ...over,
  };
}

const пусто: ArtifactList = { items: [], next: null, now: СЕЙЧАС };

/** Рендер серверной страницы с адресом: `searchParams` в Next 16 — промис. */
async function страница(sp: Record<string, string> = {}) {
  return render(await ArtifactsPage({ searchParams: Promise.resolve(sp) }));
}

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с
 * синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  artifacts.mockImplementation(async () => пусто);
  people.mockImplementation(async () => [человек()]);
});

/* Часы машины возвращаются ВСЕГДА: один подменённый `Date` протёк бы дальше. */
afterEach(() => {
  vi.useRealTimers();
});

describe("Витрина «Артефакты»: пустое состояние называет дату (Р-A3-5)", () => {
  it("без фильтра: «Артефактов с 8 сентября 2026 ещё нет», а не «ничего не найдено»", async () => {
    const { container } = await страница();
    const пустое = container.querySelector(".empty");
    expect(пустое).toHaveTextContent("Артефактов с 8 сентября 2026 ещё нет");
    expect(пустое).not.toHaveTextContent(/ничего не найдено/i);
    // Дата на экране — та самая константа, а не второе число, живущее в разметке.
    expect(ARTIFACTS_SINCE).toBe("2026-09-08");
    // Ни одной лампы: показывать нечего.
    expect(container.querySelector(".led")).toBeNull();
  });

  it("под фильтром дата тоже названа: пусто не в архиве, а в выборке", async () => {
    const { container } = await страница({ kind: "photo" });
    const пустое = container.querySelector(".empty");
    expect(пустое).toHaveTextContent("Под фильтр ничего не попало");
    expect(пустое).toHaveTextContent("8 сентября 2026");
    expect(пустое).not.toHaveTextContent(/ничего не найдено/i);
  });

  it("курсор за последней страницей — «дальше пусто» со ссылкой к началу, без даты", async () => {
    await страница({ kind: "doc", cursor: "eyJ" });
    expect(screen.getByText("Дальше пусто")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "к началу списка" })).toHaveAttribute(
      "href",
      "/artifacts?kind=doc",
    );
  });
});

describe("Витрина «Артефакты»: фильтры уходят в запрос (Р-A3-3, Р-A3-4)", () => {
  it("тип, направление, период и название — в Core одним вызовом, даты — границами суток Ташкента", async () => {
    await страница({
      kind: "doc",
      domain: "vendhub",
      from: "2026-09-01",
      to: "2026-09-08",
      q: "дебиторка",
    });
    expect(artifacts).toHaveBeenCalledTimes(1);
    expect(artifacts).toHaveBeenCalledWith({
      kind: "doc",
      domain: "vendhub",
      from: "2026-08-31T19:00:00.000Z",
      to: "2026-09-08T18:59:59.999Z",
      q: "дебиторка",
      limit: "50",
    });
  });

  it("без фильтров — только потолок строк", async () => {
    await страница();
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
  });

  it("чужие значения из адреса в Core не уходят и названы словами", async () => {
    // На `kind=video` Core ответит 400, и экран показал бы «нет связи» из-за
    // опечатки в закладке. Фильтр снимается, а не проглатывается молча.
    await страница({ kind: "video", domain: "trent", from: "вчера", to: "2026-13-45" });
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
    const предупреждение = screen.getByText("Часть фильтров не применена").closest(".warn");
    expect(предупреждение).toHaveTextContent("тип «video»");
    expect(предупреждение).toHaveTextContent("направление «trent»");
    expect(предупреждение).toHaveTextContent("дата с «вчера»");
    expect(предупреждение).toHaveTextContent("дата по «2026-13-45»");
  });

  it("НЕСУЩЕСТВУЮЩИЙ ДЕНЬ — тоже непринятый фильтр, а не тихой сдвиг периода", async () => {
    // `2026-02-30` в календаре нет, но разбор ISO не отвергает его, а
    // переезжает на 1 марта: без проверки календарём Core получил бы окно,
    // которого владелец не просил, и экран промолчал бы об этом (см.
    // `календарныйДень` в `lib/artifacts.ts`).
    await страница({ from: "2026-02-30" });
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
    expect(screen.getByText("Часть фильтров не применена").closest(".warn")).toHaveTextContent(
      "дата с «2026-02-30»",
    );
  });

  it("НАЗВАНИЕ ДЛИННЕЕ ПРЕДЕЛА CORE — непринятый фильтр, а не экран отказа", async () => {
    /*
     * У `q` в Core стоит `MaxLength(200)`, и до этой правки страница слала
     * строку любой длины: 201 символ — 400 от Core, то есть «Нет связи с
     * ядром MYDON» при живом ядре. Ссылку `?q=<имя файла>` печатает бот
     * (`ссылкаНаАрхив`), а имя файла собирает модель — длина не в наших руках.
     */
    const длинное = "я".repeat(ARTIFACTS_Q_MAX + 1);
    await страница({ q: длинное });
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
    expect(screen.getByText("Часть фильтров не применена").closest(".warn")).toHaveTextContent(
      `название длиннее ${ARTIFACTS_Q_MAX} символов`,
    );
    // Само название на экран не выливается: 201 символ мусора в предупреждении
    // ничего не объясняет, а обрезок читался бы как «искали вот это».
    expect(screen.queryByText(длинное)).toBeNull();
  });

  it("ровно предел — фильтр рабочий: пережать так же плохо, как недожать", async () => {
    const впритык = "я".repeat(ARTIFACTS_Q_MAX);
    await страница({ q: впритык });
    expect(artifacts).toHaveBeenCalledWith({ q: впритык, limit: "50" });
    expect(screen.queryByText("Часть фильтров не применена")).toBeNull();
  });

  it("форма не даёт набрать больше предела Core: maxLength на поле поиска", async () => {
    await страница();
    expect(screen.getByLabelText("Название")).toHaveAttribute("maxlength", String(ARTIFACTS_Q_MAX));
  });

  it("курсор передаётся как есть, а ссылка «дальше» несёт фильтры и новый курсор", async () => {
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: "eyJ", now: СЕЙЧАС }));
    await страница({ kind: "doc", cursor: "abc" });
    expect(artifacts).toHaveBeenCalledWith({ kind: "doc", cursor: "abc", limit: "50" });
    expect(screen.getByRole("link", { name: "дальше →" })).toHaveAttribute(
      "href",
      "/artifacts?kind=doc&cursor=eyJ",
    );
  });

  it("подпись под порцией говорит ВОЗМОЖНОСТЬ, а не факт (круг починок 3, A-3)", async () => {
    /*
     * Курсор у Core значит «строк пришло ровно `limit`», то есть «страница
     * МОГЛА быть не последней»: `rows.length === limit` в artifacts.service.ts.
     * На объёме, кратном 50, следующая страница пуста — и утвердительное «Это
     * не весь архив» оказывалось бы ложью ровно там, где владелец жмёт
     * «дальше». Проверяем не наличие ссылки (оно выше), а форму утверждения.
     */
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: "eyJ", now: СЕЙЧАС }));
    const { container } = await страница();
    const подпись = container.querySelector("section .hint");
    expect(подпись).toHaveTextContent("Возможно, это не весь архив");
    expect(подпись?.textContent).not.toMatch(/^Это не весь архив/);
  });

  it("поля формы возвращают принятые фильтры, а не мусор из адреса", async () => {
    await страница({ kind: "doc", from: "2026-09-01", to: "вчера", q: "дебиторка" });
    expect(screen.getByLabelText("Тип")).toHaveValue("doc");
    expect(screen.getByLabelText("С даты")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("По дату")).toHaveValue("");
    expect(screen.getByLabelText("Название")).toHaveValue("дебиторка");
  });
});

describe("Витрина «Артефакты»: строка в грамматике Д1 (Р-A3-6)", () => {
  it("давность считается от часов CORE, а не от часов машины", async () => {
    /*
     * ЧАСЫ МАШИНЫ УВЕДЕНЫ НА ТРИ НЕДЕЛИ ВПЕРЁД, и это не декорация: от
     * `list.now` (08.09) давность — «2 дня назад», от `Date.now()` вышло бы
     * «24 дня назад». Только на разошедшихся часах ассерт что-то проверяет.
     * Подменяется ТОЛЬКО `Date`: фальшивые таймеры целиком остановили бы
     * планировщик, на котором держится рендер.
     */
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-30T10:00:00.000Z") });
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdAt: "2026-09-06T10:00:00.000Z" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const ячейка = container.querySelector(".approw .aw");
    const отCore = ago("2026-09-06T10:00:00.000Z", new Date(СЕЙЧАС));
    expect(отCore).toBe("2 дня назад");
    expect(ячейка).toHaveTextContent(отCore);
    expect(ячейка).not.toHaveTextContent(ago("2026-09-06T10:00:00.000Z", new Date()));
  });

  it("тип — словом из lib/state и лампой; строка несёт тип атрибутом", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ kind: "receipt", title: "Чек за кофе" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    // Лампа берётся ИЗ СТРОКИ, а не поиском по слову на весь экран: то же
    // слово «чек» стоит в `<option>` выпадающего фильтра (он рисуется всегда),
    // и `getByText` падал бы «Found multiple elements» — на пустом архиве
    // такой ассерт был бы зелёным, а на первой же строке красным.
    const лампа = container.querySelector(".approw .led");
    expect(лампа).toHaveTextContent(ARTIFACT_KIND_WORD.receipt);
    expect(лампа).toHaveClass("led");
    // Тип — не здоровье: ни зелёной, ни красной лампы у чека быть не может.
    expect(лампа).not.toHaveClass("idle");
    expect(лампа).not.toHaveClass("blocked");
    expect(container.querySelector('.approw[data-kind="receipt"]')).not.toBeNull();
  });

  it.each([...ARTIFACT_KINDS])("лампа типа «%s» — ровно из словаря, без цвета здоровья", async (k) => {
    /*
     * СТОРОЖ КЛАССОВ ИЗ `state.test.ts` ЭТУ ЛАМПУ НЕ ВИДИТ, И ЭТО ИЗМЕРЕНО.
     * Он запрещает литералом только МНОГОТОКЕННЫЕ значения словарей
     * (`запрещённыеКлассы` отбирает классы с пробелом), а у всех трёх типов
     * значение одно и голое — `led`. Мутация «`kind === "doc" ? "led idle"`»
     * в `page.tsx` оставляла ВЕСЬ набор зелёным: соседний ассерт про `receipt`
     * ниже про документ ничего не знает. Поэтому проверка идёт по ВСЕМ трём
     * типам и сравнивает класс со словарём ЦЕЛИКОМ — тогда любой дописанный
     * тон здоровья (`idle`/`blocked`/`working`/`unknown`) краснеет сразу.
     *
     * Утверждение содержательное, а не стилевое: зелёная лампа значит «всё в
     * порядке», а у чека и документа здоровья нет — панель такого не говорит
     * (докблок `ARTIFACT_KIND_LED` в `lib/state.ts`).
     */
    artifacts.mockImplementation(async () => ({
      items: [строка({ kind: k })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const лампа = container.querySelector(".approw span");
    expect(лампа?.className).toBe(ARTIFACT_KIND_LED[k]);
  });

  it("тип мимо словаря печатается как есть и не роняет витрину", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ kind: "scan" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    expect(screen.getByText("scan")).toHaveClass("led");
  });

  it("название — ссылка на файл через прокси панели; docx — не в новой вкладке", async () => {
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: null, now: СЕЙЧАС }));
    await страница();
    const ссылка = screen.getByRole("link", { name: "Дебиторка GLOBERENT за август" });
    expect(ссылка).toHaveAttribute("href", "/api/attachments/8b1f2d3e-0000-4000-8000-000000000001/raw");
    expect(ссылка).not.toHaveAttribute("target");
  });

  it("файл скачивается ПОД НАЗВАНИЕМ, а не под именем «raw» (круг починок 3, A-5)", async () => {
    /*
     * Имени файла в базе нет, а `Content-Disposition: attachment` у Core и у
     * прокси идёт БЕЗ `filename` — браузер берёт имя из последнего сегмента
     * адреса, то есть «raw», «raw (1)». Витрина сделала этот маршрут
     * единственной дверью к docx/xlsx/pdf, поэтому имя обязано быть здесь.
     */
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: null, now: СЕЙЧАС }));
    await страница();
    expect(screen.getByRole("link", { name: "Дебиторка GLOBERENT за август" })).toHaveAttribute(
      "download",
      "Дебиторка GLOBERENT за август",
    );
  });

  it("без названия имени скачивания не выдумываем", async () => {
    // Пустой `download` браузер понял бы как «возьми имя из адреса» — то есть
    // тот же «raw»; выдумывать имя вместо базы витрина не имеет права.
    artifacts.mockImplementation(async () => ({
      items: [строка({ title: null })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    expect(screen.getByRole("link", { name: "без названия" })).not.toHaveAttribute("download");
  });

  it("HTML открывается в новой вкладке", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ mime: "text/html; charset=utf-8", title: "Отчёт о продажах" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    const ссылка = screen.getByRole("link", { name: "Отчёт о продажах" });
    expect(ссылка).toHaveAttribute("target", "_blank");
    expect(ссылка).toHaveAttribute("rel", "noreferrer");
    // `download` и `_blank` вместе бессмысленны: у HTML смысл ветки — читать.
    expect(ссылка).not.toHaveAttribute("download");
  });

  it("кто / для кого / направление — одной строкой, владелец — ссылкой на карточку", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: "agent:finance", domain: "vendhub" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const мета = container.querySelector(".approw .as");
    expect(мета).toHaveTextContent("агент finance · для человека · VendHub");
    expect(screen.getByRole("link", { name: "для человека" })).toHaveAttribute(
      "href",
      `/team/${ДЖАМШИД}`,
    );
  });

  it("без автора и направления строка не выдумывает слов", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: null, domain: null, title: null })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    expect(container.querySelector(".approw .as")).toHaveTextContent(/^для человека$/);
    expect(screen.getByRole("link", { name: "без названия" })).toBeInTheDocument();
  });

  it("storageKey и содержимое файла на экран не попадают", async () => {
    // Core по контракту `storageKey` не отдаёт; но если отдаст (регресс в
    // сервисе), панель обязана его не печатать — ни текстом, ни атрибутом.
    const сУтечкой = {
      ...строка({}),
      storageKey: "person/2f6c9a7e/secret-tail.docx",
    } as ArtifactRow;
    artifacts.mockImplementation(async () => ({ items: [сУтечкой], next: null, now: СЕЙЧАС }));
    const { container } = await страница();
    expect(container.innerHTML).not.toContain("secret-tail");
    expect(container.innerHTML).not.toContain("storageKey");
  });

  it("сводка в шапке считает строки СТРАНИЦЫ и называет дату архива", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({}), строка({ id: "8b1f2d3e-0000-4000-8000-000000000002" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    expect(
      screen.getByText(
        /^2 артефакта на этой странице · последние сверху · архив ведётся с 8 сентября 2026$/,
      ),
    ).toBeInTheDocument();
  });

  it("ШАПКА НЕ НАЗЫВАЕТ ЧИСЛОМ СТРАНИЦЫ ЧИСЛО АРХИВА: на второй странице «3 артефакта» без оговорки — ложь", async () => {
    /*
     * Общего количества у страницы НЕТ: Core отдаёт порцию и курсор, `total`
     * в ответе не предусмотрен. Прежняя шапка печатала «3 артефакта ·
     * последние сверху · архив ведётся с 8 сентября 2026» на второй странице
     * с тремя строками, и это читалось как «в архиве три артефакта» —
     * ровно тот класс лжи экрана, ради которого шла дизайн-волна. Подпись
     * «Показаны N строк» стояла НИЖЕ и только при наличии следующей
     * страницы, то есть на последней порции не спасала вовсе.
     */
    artifacts.mockImplementation(async () => ({
      items: [
        строка({}),
        строка({ id: "8b1f2d3e-0000-4000-8000-000000000002" }),
        строка({ id: "8b1f2d3e-0000-4000-8000-000000000003" }),
      ],
      next: "eyJ",
      now: СЕЙЧАС,
    }));
    const { container } = await страница({ cursor: "eyI" });
    const шапка = container.querySelector(".page-head .lead");
    expect(шапка).toHaveTextContent("3 артефакта на этой странице");
    // Число без оговорки — запрещено: именно так утверждается несуществующий итог.
    expect(шапка?.textContent).not.toMatch(/3 артефакта ·/);
    expect(screen.getByRole("link", { name: "дальше →" })).toBeInTheDocument();
  });
});

/*
 * АВТОР-ЧЕЛОВЕК — ДОЛГ, ПЕРЕДАННЫЙ ЗАДАЧЕЙ 4.
 *
 * Бот пишет документу `createdBy = "person:<uuid>"` (решение задачи 4: «owner»
 * было бы ложью, когда отчёт просит не владелец). Прежняя версия `authorWord`
 * печатала такую строку КАК ЕСТЬ — сырой идентификатор в строке витрины.
 * Резолв в имя и его фолбэк проверяются здесь на настоящем рендере, а не
 * только в `lib/artifacts.test.ts`: имена страница обязана ещё и ЗАПРОСИТЬ, и
 * не обязана падать, когда их не дали.
 */
describe("Витрина «Артефакты»: автор-человек называется именем (долг задачи 4)", () => {
  it("`person:<uuid>` печатается именем из реестра, а не идентификатором", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: `person:${ДЖАМШИД}`, domain: null })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const мета = container.querySelector(".approw .as");
    expect(мета).toHaveTextContent(/^Джамшид · для человека$/);
    expect(мета?.textContent).not.toContain(ДЖАМШИД);
    // Список людей просится ВЕСЬ (`all`): автор архивного документа мог
    // уволиться, а строка обязана называть его и через год.
    expect(people).toHaveBeenCalledWith(true);
  });

  it("человека нет в выдаче — «сотрудник», и всё равно ни одного uuid на экране", async () => {
    people.mockImplementation(async () => [] as Person[]);
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: `person:${ДЖАМШИД}`, domain: null })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const мета = container.querySelector(".approw .as");
    expect(мета).toHaveTextContent(/^сотрудник · для человека$/);
    expect(мета?.textContent).not.toContain(ДЖАМШИД);
  });

  it("отказ списка людей НЕ уносит с собой архив: строки на месте, автор — словом", async () => {
    // Имена — украшение строки, архив — её содержание. Падение `people` через
    // `Promise.all` утащило бы весь экран в «Core недоступен» из-за подписи.
    people.mockImplementation(async () => {
      throw new Error("HTTP 500 на /people");
    });
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: `person:${ДЖАМШИД}` })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    expect(screen.queryByText(/Нет связи с ядром MYDON/i)).toBeNull();
    expect(container.querySelector(".approw .as")).toHaveTextContent("сотрудник");
    expect(screen.getByRole("link", { name: "Дебиторка GLOBERENT за август" })).toBeInTheDocument();
  });
});

describe("Витрина «Артефакты»: оболочка", () => {
  it("экран агентского слоя — тёмный по маршруту, без штампа на странице", async () => {
    /*
     * ТЕМУ СТАВИТ НЕ СТРАНИЦА (срез Д2): маршрут числится в `CONSOLE_ROUTES`,
     * атрибут на `<html>` пишут прокси (первый кадр) и `ThemeSync` (SPA-
     * переход). Ассерт по правилу, а не по `dataset.theme`: в jsdom без прокси
     * и без корневого layout атрибут не появится ни у одной страницы, и такой
     * ассерт проверял бы лишь то, что страница не пишет тему сама, — а это уже
     * запрещено сторожем `test/theme-routes.test.ts`.
     */
    expect(themeFor("/artifacts", undefined)).toBe("dark");
    const { container } = await страница();
    expect(container.innerHTML).not.toContain("data-theme");
  });

  it("отказ Core показывает «Core недоступен», а не пустую витрину с датой", async () => {
    artifacts.mockImplementation(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    await страница();
    expect(screen.getByText(/Нет связи с ядром MYDON/i)).toBeInTheDocument();
    expect(screen.queryByText(/ещё нет/)).toBeNull();
  });
});

/*
 * ИСПОРЧЕННЫЙ КУРСОР — НЕ АВАРИЯ ЯДРА (круг починок 2, И-2).
 *
 * Цепочка была такая: страница передаёт курсор из адреса как есть → Core
 * честно отвечает 400 (`decodeCursor` не разобрал) → `getWithToken`
 * превращает ЛЮБОЙ не-ok в `CoreUnavailable` → экран рисует «Нет связи с
 * ядром MYDON. Проверьте контейнер mydon-core» с деталью «HTTP 400 на
 * /artifacts?cursor=abc&limit=50». Ядро при этом ЖИВО, и владельца
 * отправляли проверять здоровый контейнер из-за опечатки в закладке —
 * при том что докблок страницы объявляет обратный принцип для остальных
 * фильтров. Различает исходы ТИП отказа, а не текст сообщения.
 */
describe("Витрина «Артефакты»: отказ Core ≠ авария Core (И-2)", () => {
  it("испорченный курсор → архив с начала списка и строка о курсоре, а не «нет связи»", async () => {
    artifacts.mockImplementation(async (params: Record<string, string>) => {
      if (params.cursor !== undefined) throw new CoreRefused(400);
      return { items: [строка({})], next: null, now: СЕЙЧАС };
    });
    const { container } = await страница({ kind: "doc", cursor: "abc" });

    // Ядро живо — экрана аварии быть не должно ни в каком виде.
    expect(screen.queryByText(/Нет связи с ядром MYDON/i)).toBeNull();
    expect(container.innerHTML).not.toContain("mydon-core");
    // Сказано словами, что именно не приняли.
    const предупреждение = screen.getByText("Курсор из адреса не распознан").closest(".warn");
    expect(предупреждение).toHaveTextContent("архив показан с начала списка");
    // И показано С НАЧАЛА, а не пустота: второй заход ушёл БЕЗ курсора, но с фильтром.
    expect(artifacts).toHaveBeenCalledTimes(2);
    expect(artifacts).toHaveBeenLastCalledWith({ kind: "doc", limit: "50" });
    expect(screen.getByRole("link", { name: "Дебиторка GLOBERENT за август" })).toBeInTheDocument();
    // «Дальше пусто» — про курсор, которого больше нет: такой строки быть не может.
    expect(screen.queryByText("Дальше пусто")).toBeNull();
  });

  it("испорченный курсор на пустом архиве: пустое состояние называет дату, а не «дальше пусто»", async () => {
    // Ветка `cursor !== undefined` у `EmptyState` печатает «Страница за
    // курсором закончилась». После повтора с начала это была бы ложь: выдача
    // пришла НЕ за курсором, а с начала — и она действительно пуста.
    artifacts.mockImplementation(async (params: Record<string, string>) => {
      if (params.cursor !== undefined) throw new CoreRefused(400);
      return пусто;
    });
    await страница({ cursor: "abc" });
    expect(screen.getByText("Артефактов с 8 сентября 2026 ещё нет")).toBeInTheDocument();
    expect(screen.queryByText("Дальше пусто")).toBeNull();
    expect(screen.getByText("Курсор из адреса не распознан")).toBeInTheDocument();
  });

  it("НАСТОЯЩАЯ недоступность Core по-прежнему даёт «Core недоступен», а не витрину", async () => {
    // Обратная сторона: отказ и авария различаются, и второй исход не должен
    // был пострадать от починки первого.
    artifacts.mockImplementation(async () => {
      throw new CoreUnavailable("connect ECONNREFUSED 127.0.0.1:3001");
    });
    await страница({ cursor: "abc" });
    expect(screen.getByText(/Нет связи с ядром MYDON/i)).toBeInTheDocument();
    expect(screen.getByText("connect ECONNREFUSED 127.0.0.1:3001")).toBeInTheDocument();
    // Повтора без курсора нет: авария повтором не лечится.
    expect(artifacts).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Курсор из адреса не распознан")).toBeNull();
  });

  it("400 без курсора — «Ядро не приняло запрос», тоже не авария контейнера", async () => {
    // Сегодня недостижимо (все прочие параметры страница сужает сама), но
    // расхождение контракта панели и Core обязано звучать как расхождение, а
    // не как упавший контейнер.
    artifacts.mockImplementation(async () => {
      throw new CoreRefused(400);
    });
    await страница({ kind: "doc" });
    expect(screen.getByText("Ядро не приняло запрос")).toBeInTheDocument();
    expect(screen.queryByText(/Нет связи с ядром MYDON/i)).toBeNull();
    expect(screen.getByRole("link", { name: "открыть архив без фильтров" })).toHaveAttribute(
      "href",
      "/artifacts",
    );
  });
});
