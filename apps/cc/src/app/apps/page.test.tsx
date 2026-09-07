import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppsHealth } from "../../lib/core";
import { ago, when } from "../../lib/format";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const appsHealth = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { appsHealth },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));

import AppsPage from "./page";

const здоровье: AppsHealth = {
  tz: "Asia/Tashkent",
  now: "2026-09-06T10:00:00.000Z",
  outside: [
    {
      key: "ourvend:sync",
      title: "OurVend — сбор автоматов",
      state: "ok",
      summary: "отказов подряд нет, данные свежие",
      at: "2026-09-06T09:00:00.000Z",
      // НАМЕРЕННО ПОЗЖЕ `at` НА ПОЛЧАСА: событие и проверка — разные моменты.
      // Если строка снова начнёт печатать `at`, тест увидит это ЧИСЛОМ, а не
      // «примерно тем же временем».
      lastCheckedAt: "2026-09-06T09:30:00.000Z",
      href: "/vending",
    },
    {
      key: "notion",
      title: "Доставка в Notion",
      state: "bad",
      summary: "доставки не дошли: в тупике 2",
      detail: "всего строк доставки 14",
      lastCheckedAt: "2026-09-06T09:58:00.000Z",
      href: "/system",
    },
    {
      key: "bot",
      title: "Telegram-бот",
      state: "unknown",
      summary: "бот ещё не отчитывался: heartbeat в журнале не появлялся",
      // Ни одной проверки: heartbeat не появлялся вовсе. Давности у того, чего
      // не происходило, не существует — отсюда `null`, а не старая дата.
      lastCheckedAt: null,
      href: "/system",
    },
  ],
  internal: [
    {
      key: "coffee:monitor",
      title: "Кофе-бункеры — данные Core",
      state: "ok",
      summary: "последний прогон прошёл",
      at: "2026-09-06T02:00:00.000Z",
      lastCheckedAt: "2026-09-06T02:00:00.000Z",
      href: "/flows?agent=system&skill=coffee:monitor",
    },
  ],
};

/**
 * Источник, который ПРОВЕРЯЛИ, но оценить нечего: снимок есть, монитор молчит
 * четверо суток. Отдельный ответ, а не пятая строка в общей фикстуре: та
 * сломала бы сводку «в порядке 2 · сломано 1 · не оценить 1» в соседнем тесте.
 */
const молчащийКурс: AppsHealth = {
  tz: "Asia/Tashkent",
  now: "2026-09-06T10:00:00.000Z",
  outside: [
    {
      key: "fx",
      title: "Курс ЦБ",
      state: "unknown",
      summary: "снимок курса есть, но монитор молчит",
      at: "2026-09-02T10:00:00.000Z",
      lastCheckedAt: "2026-09-02T10:00:00.000Z",
      href: "/system",
    },
  ],
  internal: [],
};

/**
 * Колонка времени ИМЕННО ЭТОЙ строки.
 *
 * Ищем по ЗАГОЛОВКУ, а не по слову состояния: «в порядке» на витрине две
 * штуки, и `getByText` на нём упал бы неоднозначностью; индекс же в массиве
 * привязал бы тест к порядку разделов вместо смысла строки.
 */
function ячейкаВремени(заголовок: string): HTMLElement {
  const строка = screen.getByText(заголовок).closest(".approw");
  if (строка === null) throw new Error(`строки «${заголовок}» нет на витрине`);
  const ячейка = строка.querySelector<HTMLElement>(".aw");
  if (ячейка === null) throw new Error(`у строки «${заголовок}» нет колонки времени`);
  return ячейка;
}

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с
 * синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  appsHealth.mockImplementation(async () => здоровье);
});

/*
 * Часы машины возвращаются ВСЕГДА, даже если тест упал на ассерте: один
 * подменённый `Date` протёк бы во все следующие файлы прогона.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe("Панель «Приложения»: разделы", () => {
  it("делит источники по природе связи — снаружи и внутренние мониторы", async () => {
    render(await AppsPage());
    expect(screen.getByText("Снаружи")).toBeInTheDocument();
    expect(screen.getByText("Внутренние мониторы")).toBeInTheDocument();
  });

  it("внутренний монитор не попадает в раздел внешних источников", async () => {
    const { container } = render(await AppsPage());
    const разделы = container.querySelectorAll(".apps-section");
    expect(разделы).toHaveLength(2);
    expect(разделы[0]).toHaveTextContent("OurVend — сбор автоматов");
    expect(разделы[0]).not.toHaveTextContent("Кофе-бункеры");
    expect(разделы[1]).toHaveTextContent("Кофе-бункеры");
  });

  it("сводка считает все три состояния", async () => {
    render(await AppsPage());
    expect(screen.getByText(/в порядке 2 · сломано 1 · не оценить 1/)).toBeInTheDocument();
  });
});

describe("Панель «Приложения»: «не оценить» не похоже на «в порядке»", () => {
  it("печатает словом «не оценить», а не «ошибок нет»", async () => {
    render(await AppsPage());
    expect(screen.getByText("не оценить")).toBeInTheDocument();
  });

  it("не носит класс состояния «в порядке» — ни на лампе, ни на строке", async () => {
    render(await AppsPage());
    const лампа = screen.getByText("не оценить");
    // Имя переменной называет то, что в ней лежит: это строка «не оценить»,
    // а не «в порядке». Прежнее имя `ок` утверждало обратное содержимому.
    const строкаНеОценить = screen.getByText("не оценить").closest(".approw");
    expect(лампа).toHaveClass("unknown");
    // `.idle` — зелёная лампа «всё в норме»: ноль прогонов ей не равен.
    expect(лампа).not.toHaveClass("idle");
    expect(строкаНеОценить).toHaveAttribute("data-state", "unknown");
  });

  it("«в порядке» остаётся своим классом — различие проверяется с обеих сторон", async () => {
    render(await AppsPage());
    const лампы = screen.getAllByText("в порядке");
    expect(лампы[0]).toHaveClass("idle");
    expect(лампы[0]).not.toHaveClass("unknown");
    expect(лампы[0].closest(".approw")).toHaveAttribute("data-state", "ok");
  });

  it("сломанный источник назван СЛОВОМ и несёт своё состояние строкой", async () => {
    // Витрина заводит источник в состоянии `bad` с первого дня, но проверялись
    // только `ok` и `unknown`: «сломано» могло тихо съехать в чужой класс —
    // и поломка выглядела бы либо спокойствием, либо неизвестностью.
    render(await AppsPage());
    const лампа = screen.getByText("сломано");
    expect(лампа).toHaveClass("blocked");
    expect(лампа).not.toHaveClass("idle");
    expect(лампа).not.toHaveClass("unknown");
    expect(лампа.closest(".approw")).toHaveAttribute("data-state", "bad");
  });

  it("строка ведёт на экран, где источник чинят", async () => {
    render(await AppsPage());
    expect(screen.getByRole("link", { name: /Telegram-бот/ })).toHaveAttribute("href", "/system");
  });
});

/*
 * Время в составе состояния (срез Д1, Р-Д1-2, Р-Д1-3, Р-Д1-4).
 *
 * Смысл блока: состояние без времени врёт МОЛЧА. «В порядке» без отметки
 * проверки утверждает только «когда-то было хорошо»; «не оценить» без давности
 * не отличает новый источник от молчащего неделю; а выдуманное число дней у
 * источника без прогонов хуже отсутствия числа — оно выглядит измерением.
 */
describe("Панель «Приложения»: время в составе состояния", () => {
  it("зелёная строка называет время последней ПРОВЕРКИ, а не момент события", async () => {
    render(await AppsPage());
    // Ассерт на ПРИСУТСТВИЕ: без отметки проверки зелёная строка приёмку не
    // проходит (Р-Д1-3). Момент события у этой строки другой (09:00), поэтому
    // возврат к печати `row.at` тоже упадёт здесь.
    expect(ячейкаВремени("OurVend — сбор автоматов")).toHaveTextContent(
      `проверено ${when("2026-09-06T09:30:00.000Z")}`,
    );
  });

  it("внутренний монитор в порядке тоже называет время проверки", async () => {
    render(await AppsPage());
    expect(ячейкаВремени("Кофе-бункеры — данные Core")).toHaveTextContent(
      `проверено ${when("2026-09-06T02:00:00.000Z")}`,
    );
  });

  it("источник без единого прогона говорит «не запускался» и не печатает числа дней", async () => {
    render(await AppsPage());
    const ячейка = ячейкаВремени("Telegram-бот");
    expect(ячейка).toHaveTextContent("не запускался");
    // НИ ОДНОЙ ЦИФРЫ. Давности у того, чего не происходило, не существует:
    // «6 дней» здесь были бы выдумкой, а не оценкой (Р-Д1-2).
    expect(ячейка.textContent ?? "").not.toMatch(/\d/);
  });

  it("источник с прогонами называет давность последней проверки", async () => {
    /*
     * ЧАСЫ МАШИНЫ УВЕДЕНЫ НА ТРИ НЕДЕЛИ ВПЕРЁД, и это не декорация.
     * От часов Core (`health.now` = 06.09) давность равна «4 дня назад», от
     * `Date.now()` вышло бы «27 дней назад» — только на разошедшихся часах
     * ассерт вообще ЧТО-ТО проверяет. На настоящей машине даты стоят так, что
     * оба счёта совпадают: подмена `момент = new Date()` проходила тест молча
     * (проверено откатом), и заодно ассерт зависел бы от сегодняшнего числа —
     * протух бы сам собой через сутки.
     *
     * Подменяется ТОЛЬКО `Date`: фальшивые таймеры целиком остановили бы
     * планировщик, на котором держится рендер.
     */
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-30T10:00:00.000Z") });
    appsHealth.mockImplementation(async () => молчащийКурс);
    render(await AppsPage());
    const ячейка = ячейкаВремени("Курс ЦБ");
    // Давность считается от часов ЯДРА (`health.now`), а не от `Date.now()`
    // машины: иначе на границе суток число разошлось бы с абсолютным временем
    // соседней строки.
    const давность = ago("2026-09-02T10:00:00.000Z", new Date("2026-09-06T10:00:00.000Z"));
    expect(ячейка).toHaveTextContent(`проверяли ${давность}`);
    // Величина обязательна: «давно» без числа — не давность.
    expect(ячейка.textContent ?? "").toMatch(/\d/);
    // «Назад» РОВНО ОДНО. `ago()` возвращает фразу С предлогом, и первая
    // редакция этой строки дописывала свой — «4 дня назад назад» вышло бы на
    // экран, если бы ассерта не было. Он остаётся сторожем в обе стороны.
    expect(ячейка.textContent ?? "").not.toMatch(/назад[\s\S]*назад/);
  });

  it("«сломано» набрано весом, отличным от остальных состояний", async () => {
    render(await AppsPage());
    // 600, а не 700: у IBM Plex Mono в проекте лежат файлы 400/500/600
    // (`app/layout.tsx`), и 700 браузер синтезировал бы размазыванием. Вес
    // живёт инлайном, поэтому jsdom его видит без CSS.
    expect(screen.getByText("сломано").style.fontWeight).toBe("600");
    // У остальных состояний веса нет вовсе — выделено ровно одно состояние.
    expect(screen.getAllByText("в порядке")[0]?.style.fontWeight).toBe("");
    expect(screen.getByText("не оценить").style.fontWeight).toBe("");
  });
});

describe("Панель «Приложения»: пусто и отказ", () => {
  it("пустой ответ Core — честное пустое состояние, а не «всё хорошо»", async () => {
    appsHealth.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T10:00:00.000Z",
      outside: [],
      internal: [],
    }));
    const { container } = render(await AppsPage());
    const пустые = container.querySelectorAll(".empty");
    expect(пустые).toHaveLength(2);
    expect(пустые[0]).toHaveTextContent(/не назвал ни одного источника/i);
    // Ни одной зелёной лампы на пустом экране: оценивать нечего.
    expect(container.querySelector(".led.idle")).toBeNull();
  });

  it("отказ Core показывает «Core недоступен», а не пустую витрину", async () => {
    appsHealth.mockImplementation(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    render(await AppsPage());
    expect(screen.getByText(/Нет связи с ядром MYDON/i)).toBeInTheDocument();
  });
});
