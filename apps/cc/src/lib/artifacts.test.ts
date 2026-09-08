// @vitest-environment node
//
// Без DOM: здесь только даты, строки и ссылки (тот же приём, что в
// `lib/state.test.ts`).
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_KINDS,
  ARTIFACTS_LIMIT,
  ARTIFACTS_SINCE,
  authorWord,
  fileHref,
  isArtifactKind,
  isDomain,
  opensInNewTab,
  ownerCard,
  периодВМоменты,
  sinceWord,
} from "./artifacts";

/** Люди реестра: тот же вид карты, что кормит `actorLabel` в `/audit`. */
const ЛЮДИ = new Map([
  ["2f6c9a7e-0000-4000-8000-0000000000aa", "Джамшид"],
  ["3a7d0b1c-0000-4000-8000-0000000000bb", "Бехруз"],
]);
const БЕЗ_ЛЮДЕЙ = new Map<string, string>();

describe("Дата начала архива (срез A3, Р-A3-5)", () => {
  it("константа — день выката миграции 0089, и слово пришпилено к ней", () => {
    // Если миграция выкатится в другой день, менять надо И константу, И этот
    // ассерт — сознательно, а не «сам собой».
    expect(ARTIFACTS_SINCE).toBe("2026-09-08");
    expect(sinceWord()).toBe("8 сентября 2026");
  });

  it("год без «г.», день без ведущего нуля, месяц в родительном падеже", () => {
    expect(sinceWord("2026-01-01")).toBe("1 января 2026");
    expect(sinceWord("2027-11-30")).toBe("30 ноября 2027");
  });

  it("мусор возвращается как есть, а не «Invalid Date»", () => {
    expect(sinceWord("вчера")).toBe("вчера");
    expect(sinceWord("2026-13-45")).toBe("2026-13-45");
  });

  it("НЕСУЩЕСТВУЮЩИЙ ДЕНЬ возвращается как есть, а не переезжает в следующий месяц", () => {
    /*
     * ЗДЕСЬ БЫЛА НАСТОЯЩАЯ ОШИБКА, И ЕЁ НЕ ЛОВИЛ `Number.isFinite`.
     * `Date.UTC(2026, 12, 45, 12)` — не «Invalid Date», а 14 февраля 2027:
     * лишние месяцы и дни ПЕРЕПОЛНЯЮТСЯ в следующие. Проверено: прежняя
     * версия печатала «2026-13-45» как «14 февраля 2027», то есть выдумывала
     * дату, которой в аргументе не было. Поэтому день сверяется обратным
     * разбором (год/месяц/число совпали), а не живостью метки времени.
     */
    expect(sinceWord("2026-02-30")).toBe("2026-02-30");
    expect(sinceWord("2026-00-10")).toBe("2026-00-10");
    expect(sinceWord("2026-13-45")).not.toMatch(/февраля|января/);
  });
});

describe("Период фильтра → границы для Core", () => {
  it("ташкентские сутки включительно с обеих сторон", () => {
    expect(периодВМоменты("2026-09-01", "2026-09-08")).toEqual({
      from: "2026-08-31T19:00:00.000Z",
      to: "2026-09-08T18:59:59.999Z",
    });
  });

  it("однодневный период from=to не пуст", () => {
    const { from, to } = периодВМоменты("2026-09-08", "2026-09-08");
    expect(from).toBe("2026-09-07T19:00:00.000Z");
    expect(to).toBe("2026-09-08T18:59:59.999Z");
  });

  it("одна граница без другой — допустимо", () => {
    expect(периодВМоменты("2026-09-01", undefined)).toEqual({ from: "2026-08-31T19:00:00.000Z" });
    expect(периодВМоменты(undefined, "2026-09-01")).toEqual({ to: "2026-09-01T18:59:59.999Z" });
  });

  it("мусор и несуществующая дата выпадают, а не бросают", () => {
    expect(периодВМоменты("вчера", "2026-13-45")).toEqual({});
    expect(периодВМоменты("", "01.09.2026")).toEqual({});
  });

  it("29 февраля невисокосного года ВЫПАДАЕТ, а не сдвигает период на сутки", () => {
    /*
     * ВТОРАЯ ПОЛОВИНА ТОЙ ЖЕ ОШИБКИ, И ОНА ХУЖЕ ПЕРВОЙ — она МОЛЧАЛИВАЯ.
     * `new Date("2026-02-30T00:00:00+05:00")` — не «Invalid Date», а 1 марта:
     * граница не выпадала, а тихо переезжала на сутки, страница считала фильтр
     * ПРИНЯТЫМ и не говорила о нём ни слова (обещание докблока «нечитаемая
     * граница просто выпадает: страница скажет об этом словами» держалось
     * только на датах с невозможным МЕСЯЦЕМ, вроде `2026-13-45`).
     * Проверено на настоящем движке: `2026-13-45` → Invalid, `2026-02-30` →
     * 2026-03-01T19:00:00.000Z.
     */
    expect(периодВМоменты("2026-02-30", "2026-02-29")).toEqual({});
    expect(периодВМоменты("2025-02-29", undefined)).toEqual({});
    // 2028 — високосный: 29 февраля там существует и границей быть обязано.
    expect(периодВМоменты("2028-02-29", undefined)).toEqual({ from: "2028-02-28T19:00:00.000Z" });
  });
});

describe("Сужение значений из адреса", () => {
  it("типов ровно три, и они те же, что у UploadDto Core", () => {
    expect([...ARTIFACT_KINDS]).toEqual(["doc", "photo", "receipt"]);
    expect(isArtifactKind("doc")).toBe(true);
    expect(isArtifactKind("video")).toBe(false);
    expect(isArtifactKind(undefined)).toBe(false);
  });

  it("направления — из @mydon/shared", () => {
    expect(isDomain("vendhub")).toBe(true);
    expect(isDomain("trent")).toBe(false);
    expect(isDomain(undefined)).toBe(false);
  });

  it("страница просит 50 строк — потолок Core по контракту", () => {
    expect(ARTIFACTS_LIMIT).toBe("50");
  });
});

describe("Ссылка на файл и способ открытия", () => {
  it("файл — через прокси панели, не через Core", () => {
    expect(fileHref("8b1f2d3e-0000-4000-8000-000000000001")).toBe(
      "/api/attachments/8b1f2d3e-0000-4000-8000-000000000001/raw",
    );
  });

  it("в новой вкладке — только HTML, параметры типа не мешают", () => {
    expect(opensInNewTab("text/html")).toBe(true);
    expect(opensInNewTab("Text/HTML; charset=utf-8")).toBe(true);
    expect(
      opensInNewTab("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(false);
    expect(opensInNewTab("application/pdf")).toBe(false);
    expect(opensInNewTab(null)).toBe(false);
  });
});

describe("Кто / для кого", () => {
  it("владелец с карточкой в панели получает ссылку, незнакомый — только слово", () => {
    expect(ownerCard("person", "2f6c9a7e-0000-4000-8000-0000000000aa")).toEqual({
      label: "для человека",
      href: "/team/2f6c9a7e-0000-4000-8000-0000000000aa",
    });
    expect(ownerCard("task", "t1")).toEqual({ label: "по задаче", href: "/tasks/t1" });
    expect(ownerCard("entity", "e1")).toEqual({ label: "к карточке", href: "/card/e1" });
    expect(ownerCard("stock_movement", "s1")).toEqual({ label: "stock_movement", href: null });
  });

  it("автор — словом, отсутствие автора — ничем", () => {
    expect(authorWord(null, ЛЮДИ)).toBeNull();
    expect(authorWord("", ЛЮДИ)).toBeNull();
    expect(authorWord("owner", ЛЮДИ)).toBe("владелец");
    expect(authorWord("agent:finance", ЛЮДИ)).toBe("агент finance");
    expect(authorWord("bot", ЛЮДИ)).toBe("bot");
  });

  it("ЧЕЛОВЕК ПОДПИСЫВАЕТСЯ ИМЕНЕМ, а не сырым uuid из аудитного поля", () => {
    /*
     * ДОЛГ ЗАДАЧИ 4, И ЭТО НЕ КОСМЕТИКА. Бот пишет документу
     * `createdBy = "person:<uuid>"` — «owner» было бы ложью, когда отчёт
     * просит не владелец. Прежняя версия функции печатала всё, что не
     * `owner`/`agent:`/`staff:`, КАК ЕСТЬ — то есть строку «person:8b1f2d3e-…»
     * в строке витрины. Резолв — тот же, что у `actorLabel` в `/audit`
     * (`app/audit/page.tsx`), и по той же записанной причине: там любой человек
     * подписывался «ты», и работа оператора выглядела работой владельца.
     */
    const джамшид = "2f6c9a7e-0000-4000-8000-0000000000aa";
    expect(authorWord(`person:${джамшид}`, ЛЮДИ)).toBe("Джамшид");
    expect(authorWord(`staff:${джамшид}`, ЛЮДИ)).toBe("Джамшид");
    // Ни одна ветка не имеет права напечатать сам идентификатор.
    expect(authorWord(`person:${джамшид}`, БЕЗ_ЛЮДЕЙ)).not.toContain(джамшид);
  });

  it("человека нет в реестре — «сотрудник», а не догадка и не id", () => {
    // Список людей мог не приехать (Core ответил отказом) или человек уволен и
    // выпал из выдачи. Слово честнее и первого, и второго варианта.
    expect(authorWord("person:0f000000-0000-4000-8000-00000000ffff", ЛЮДИ)).toBe("сотрудник");
    // Короткий id из ранних записей — та же ветка, а не печать «staff:2f6c9a7e».
    expect(authorWord("staff:2f6c9a7e", ЛЮДИ)).toBe("сотрудник");
    expect(authorWord("person:", ЛЮДИ)).toBe("сотрудник");
  });
});
