import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PauseToggles } from "../components/pause-toggles";
import { SkillsDeck } from "../components/skills-deck";
import type { AppsHealth, SkillDeck, SkillDeckItem } from "../lib/core";
import { весаЛамп, правилаВеса, стилиПанели } from "./css";

/*
 * ВЕС «ПОЛОМКИ» НЕ РАСТЕКАЕТСЯ ПО СОСЕДНИМ ПОВЕРХНОСТЯМ (срез Д1, Р-Д1-4).
 *
 * Класс `.led.blocked` носят ЧЕТЫРЕ разных состояния из `lib/state.ts`:
 * «затык» агента (`AGENT_STATE_LED.blocked`), «сломано» источника
 * (`HEALTH_LED.bad`) — и, на совсем других осях, «не заведён» и «в архиве»
 * карточки агента (`CARD_LED.draft`, `CARD_LED.deprecated`) плюс включённая
 * пауза системы (`PAUSE_LED.on`). Полужирным набирается только ПОЛОМКА:
 * черновик, архив и пауза поломкой не являются, и вес, доставшийся им, ничего
 * больше не значит.
 *
 * ЭТОТ СТОРОЖ ОТДЕЛЬНЫМ ФАЙЛОМ, А НЕ АССЕРТОМ В ТЕСТЕ СЕТКИ, потому что
 * запрет проверяется НА ЧУЖИХ ПОВЕРХНОСТЯХ: внутри сетки агентов слова
 * «работает», «молчит» и «на паузе» класса `.blocked` не носят вовсе, поэтому
 * правило `.led.blocked { font-weight: 600 }` — то есть ровно тот регресс, от
 * которого спасает `.agled`, — проверку по одной сетке проходит МОЛЧА
 * (проверено откатом: 0 упавших тестов). Утяжеляет он витрину навыков и
 * тумблеры пауз, и увидеть это можно только рендером этих двух экранов.
 */

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  runSkill: vi.fn(),
  saveSystemConfig: vi.fn(),
  appsHealth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock("../app/skills/actions", () => ({ runSkill: mocks.runSkill }));
vi.mock("../app/system/actions", () => ({ saveSystemConfig: mocks.saveSystemConfig }));
// Витрина `/apps` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует. Тип берём настоящий.
vi.mock("../lib/core", () => ({
  core: { appsHealth: mocks.appsHealth },
  CoreUnavailable: class CoreUnavailable extends Error {},
}));

import AppsPage from "../app/apps/page";

/** Строка витрины навыков: остальное — «обычный рабочий навык кодом». */
function навык(over: Partial<SkillDeckItem>): SkillDeckItem {
  return {
    agent: "finance",
    skill: "watch-money",
    description: "Следит за платежами",
    executor: "code",
    tier: "T1",
    triggers: ["каждое утро"],
    allowedTools: ["Read"],
    modelEffort: null,
    maxTokens: null,
    hasCode: true,
    problems: [],
    agentStatus: "active",
    business: "shared",
    autonomyDefault: "T1",
    enabled: true,
    crons: [],
    tierFloor: "T1",
    duplicates: 1,
    lastRun: null,
    ...over,
  };
}

function витрина(items: SkillDeckItem[]): SkillDeck {
  return {
    syncedAt: "2026-09-05T06:00:00.000Z",
    models: { primary: "claude-opus-5", fallbacks: [] },
    items,
  };
}

/**
 * ВСЕ правила веса живого `globals.css` — без отбора по носителям состояния
 * (десятый круг починок, Ф-3).
 *
 * Отбор по четырём носителям (`весаЛамп`) годится позитивному вопросу «какое
 * правило даёт вес затыку», а негативному — нет: `font-weight` наследуется от
 * ЛЮБОГО предка, и `.agtile { font-weight: 700 }` или `body { font-weight: 700 }`
 * утяжеляли бы слово, оставаясь вне списка. Мутация проходила зелёной.
 */
const правилаВесаФайла = правилаВеса(стилиПанели);

/**
 * Слово на экране не должно попадать НИ В ОДИН селектор веса — ни собой, ни
 * контейнером.
 *
 * `closest`, А НЕ `matches` (девятый круг починок, 3.2): `font-weight`
 * НАСЛЕДУЕТСЯ, поэтому правило на контейнере (`.agled`, `.approw`) утяжеляет
 * слово внутри, а `matches` про такое правило отвечает «не про меня».
 * `closest` проверяет и сам элемент, и всех его предков.
 */
function неУтяжелено(слово: string, элемент: HTMLElement = screen.getByText(слово)): void {
  for (const { селектор, запись } of правилаВесаФайла) {
    expect(
      элемент.closest(селектор),
      `правило «${селектор}» (${запись}) утяжеляет «${слово}» — это не поломка, а другая ось состояния`,
    ).toBeNull();
  }
}

/**
 * Витрина источников с тремя состояниями здоровья сразу.
 *
 * Поля обязательные, поэтому фикстура называет и `lastCheckedAt`, и
 * `checksKnown`: строка без них на экран не поедет.
 */
const ЗДОРОВЬЕ: AppsHealth = {
  tz: "Asia/Tashkent",
  now: "2026-09-06T10:00:00.000Z",
  outside: [
    {
      key: "ourvend:sync",
      title: "OurVend — сбор автоматов",
      state: "ok",
      summary: "отказов подряд нет, данные свежие",
      lastCheckedAt: "2026-09-06T09:30:00.000Z",
      checksKnown: true,
      href: "/vending",
    },
    {
      key: "notion",
      title: "Доставка в Notion",
      state: "bad",
      summary: "доставки не дошли: в тупике 2",
      lastCheckedAt: "2026-09-06T09:58:00.000Z",
      checksKnown: true,
      href: "/system",
    },
    {
      key: "bot",
      title: "Telegram-бот",
      state: "unknown",
      summary: "бот ещё не отчитывался",
      lastCheckedAt: null,
      checksKnown: true,
      href: "/system",
    },
  ],
  internal: [
    {
      key: "coffee:monitor",
      title: "Кофе-бункеры — данные Core",
      state: "ok",
      summary: "последний прогон прошёл",
      lastCheckedAt: "2026-09-06T02:00:00.000Z",
      checksKnown: true,
      href: "/flows?agent=system&skill=coffee:monitor",
    },
  ],
};

describe("Вес «поломки» не задевает соседние оси состояний (срез Д1, Р-Д1-4)", () => {
  it("сторож не пустой: правила веса в globals.css вообще есть, и правил ламп среди них меньше", () => {
    // Иначе весь файл превращается в набор тавтологий: пустой список
    // селекторов проходит любую проверку «не попадает».
    const ламп = весаЛамп(стилиПанели);
    expect(ламп.length, "правил веса ламп в globals.css не найдено").toBeGreaterThan(0);
    // Полный список ШИРЕ списка ламп — иначе негативный сторож снова смотрит
    // только на четыре носителя.
    expect(
      правилаВесаФайла.length,
      "полный список правил веса не шире списка ламп",
    ).toBeGreaterThan(ламп.length);
  });

  it("вес ламп записан числом или словом, а не через переменную (десятый круг, Ф-3)", () => {
    // Вес через `var(--x)` сторож прочесть не может: число живёт в другом
    // месте файла, а то и в другой ветке темы, и довод «600, потому что IBM
    // Plex Mono подключён в 400/500/600» проверить нечем. Раньше такая запись
    // молча ВЫПАДАЛА из списка, и лампа с весом через переменную выглядела
    // лампой без веса — обе стороны сторожа (затыку дали / соседям не дали)
    // оставались зелёными на дефекте.
    for (const { селектор, вес, запись } of весаЛамп(стилиПанели)) {
      expect(
        вес,
        `«${селектор}»: вес «${запись}» сторож не прочёл — в правилах ламп вес пишется числом`,
      ).not.toBeNull();
    }
  });

  it("«не заведён» в витрине навыков остаётся обычного начертания", () => {
    render(<SkillsDeck deck={витрина([навык({ agentStatus: "draft" })])} />);
    expect(screen.getByText("не заведён")).toHaveClass("led", "blocked");
    неУтяжелено("не заведён");
  });

  it("«в архиве» — тоже: архивный агент не сломан", () => {
    render(<SkillsDeck deck={витрина([навык({ agentStatus: "deprecated" })])} />);
    expect(screen.getByText("в архиве")).toHaveClass("led", "blocked");
    неУтяжелено("в архиве");
  });

  it("«на паузе» у тумблера системы — не поломка, а решение владельца", () => {
    render(<PauseToggles schedules tasks={false} />);
    expect(screen.getByText("на паузе")).toHaveClass("led", "blocked");
    неУтяжелено("на паузе");
  });
});

/*
 * ВИТРИНА `/apps` — ТРЕТЬЯ ПОВЕРХНОСТЬ, И ОНА НЕ СТОРОЖИЛАСЬ ВОВСЕ (девятый
 * круг починок, 3.4).
 *
 * Вес «сломано» здесь задаётся ИНЛАЙНОМ (`ВЕС_ПОЛОМКИ` в `app/apps/page.tsx`)
 * ровно потому, что общего контейнера с витриной навыков и тумблерами у строк
 * нет: правило `.led.blocked` утяжелило бы и «черновик», и «в архиве», и «на
 * паузе». Из этого следует ЗАПРЕТ, который никто не проверял: ни одно правило
 * `globals.css` не имеет права утяжелять слова этой витрины — иначе механизмов
 * веса станет два на один экран, и снятие инлайна ничего не изменит.
 */
describe("Вес на витрине источников: только инлайн, ни одного правила CSS (3.4)", () => {
  it("«в порядке» и «не оценить» не утяжелены НИ ОДНИМ правилом", async () => {
    mocks.appsHealth.mockImplementation(async () => ЗДОРОВЬЕ);
    render(await AppsPage());
    // «В порядке» на витрине две штуки (снаружи и внутри), поэтому проверяем
    // каждую: `getByText` на неоднозначном слове упал бы сам.
    неУтяжелено("не оценить");
    for (const элемент of screen.getAllByText("в порядке")) неУтяжелено("в порядке", элемент);
  });

  it("«сломано» весит 600 ИНЛАЙНОМ, и это единственный механизм на экране", async () => {
    mocks.appsHealth.mockImplementation(async () => ЗДОРОВЬЕ);
    render(await AppsPage());
    const сломано = screen.getByText("сломано");
    // Инлайн — на месте (иначе состояние отличается только цветом, Р-Д1-4).
    expect(сломано.style.fontWeight, "«сломано» на витрине потеряло вес 600").toBe("600");
    // И ни одного правила CSS поверх: два механизма на одном слове — это спор,
    // в котором победитель зависит от порядка файлов.
    неУтяжелено("сломано", сломано);
  });
});

/*
 * РАЗБОРЩИК ВЕСА — НА ОБРАЗЦАХ, А НЕ ТОЛЬКО НА ЖИВОМ ФАЙЛЕ (десятый круг
 * починок, Ф-3). Живой `globals.css` пишет вес одной формой (`font-weight:
 * <число>`), и сторож, проверенный только на нём, слеп ровно к формам, которых
 * в файле пока нет: шортхенд `font:` с весом внутри и `var()` вместо числа. Обе
 * проверены мутациями живого файла (краснеют), а здесь закреплены образцами,
 * чтобы правка разборщика не сняла их молча.
 */
describe("Разборщик веса читает шортхенд и не глотает переменную (Ф-3)", () => {
  const веса = (css: string) => правилаВеса(css).map(({ селектор, вес }) => ({ селектор, вес }));

  it("`font: 700 13px/1.2 …` — это вес 700, как и `font-weight: 700`", () => {
    expect(веса(".led.x { font: 700 13px/1.2 var(--fm); }")).toEqual([
      { селектор: ".led.x", вес: 700 },
    ]);
    expect(веса(".led.x { font: italic bold 12px/30px Georgia, serif; }")).toEqual([
      { селектор: ".led.x", вес: 700 },
    ]);
    expect(веса(".x { font-weight: 600 !important; }")).toEqual([{ селектор: ".x", вес: 600 }]);
  });

  it("шортхенд без токена веса, `inherit` и системные шрифты веса не несут", () => {
    expect(веса(".x { font: 13px var(--fm); }")).toEqual([]);
    expect(веса(".x { font: inherit; }")).toEqual([]);
    expect(веса(".x { font: menu; }")).toEqual([]);
    expect(веса(".x { font-family: var(--fm); font-size: 11px; }")).toEqual([]);
  });

  it("`var()` вместо веса — красный флаг `null`, а не пропуск правила", () => {
    expect(веса(".led.x { font-weight: var(--w); }")).toEqual([{ селектор: ".led.x", вес: null }]);
    expect(веса(".led.x { font: var(--w) 13px var(--fm); }")).toEqual([
      { селектор: ".led.x", вес: null },
    ]);
    expect(веса(".led.x { font-weight: 700px; }")).toEqual([{ селектор: ".led.x", вес: null }]);
  });

  it("селектор — по одному на запятую; псевдоэлементы не в счёт", () => {
    expect(веса(".a, .b { font-weight: 500; }")).toEqual([
      { селектор: ".a", вес: 500 },
      { селектор: ".b", вес: 500 },
    ]);
    // Вес `::before` красит сгенерированное содержимое, а не слово.
    expect(веса(".led::before { font-weight: 700; }")).toEqual([]);
    expect(веса("@media (min-width: 720px) { .x { font-weight: 700; } }")).toEqual([
      { селектор: ".x", вес: 700 },
    ]);
  });

  it("список ламп — подмножество полного списка, отобранное по субъекту", () => {
    const css =
      ".agtile { font-weight: 700; } .agled .led.blocked { font-weight: 600; } .approw .an { font-weight: 600; }";
    expect(весаЛамп(css).map((r) => r.селектор)).toEqual([".agled .led.blocked"]);
    expect(правилаВеса(css).map((r) => r.селектор)).toEqual([
      ".agtile",
      ".agled .led.blocked",
      ".approw .an",
    ]);
  });
});
