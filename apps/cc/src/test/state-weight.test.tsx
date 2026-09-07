import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PauseToggles } from "../components/pause-toggles";
import { SkillsDeck } from "../components/skills-deck";
import type { AppsHealth, SkillDeck, SkillDeckItem } from "../lib/core";
import { весаЛамп, стилиПанели } from "./css";

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

/** Селекторы, утяжеляющие лампу, — из живого `globals.css`. */
const селекторыВеса = весаЛамп(стилиПанели).map((r) => r.селектор);

/**
 * Слово на экране не должно попадать НИ В ОДИН селектор веса — ни собой, ни
 * контейнером.
 *
 * `closest`, А НЕ `matches` (девятый круг починок, 3.2): `font-weight`
 * НАСЛЕДУЕТСЯ, поэтому правило на контейнере (`.agled`, `.approw`) утяжеляет
 * слово внутри, а `matches` про такое правило отвечает «не про меня».
 * `closest` проверяет и сам элемент, и всех его предков.
 */
function неУтяжелено(слово: string): void {
  const элемент = screen.getByText(слово);
  for (const sel of селекторыВеса) {
    expect(
      элемент.closest(sel),
      `правило «${sel}» утяжеляет «${слово}» — это не поломка, а другая ось состояния`,
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
  it("сторож не пустой: правила веса в globals.css вообще есть", () => {
    // Иначе весь файл превращается в набор тавтологий: пустой список
    // селекторов проходит любую проверку «не попадает».
    expect(селекторыВеса.length, "правил веса в globals.css не найдено").toBeGreaterThan(0);
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
    for (const слово of ["не оценить"]) неУтяжелено(слово);
    for (const элемент of screen.getAllByText("в порядке")) {
      for (const sel of селекторыВеса) {
        expect(
          элемент.closest(sel),
          `правило «${sel}» утяжеляет «в порядке» — зелёная строка не поломка`,
        ).toBeNull();
      }
    }
  });

  it("«сломано» весит 600 ИНЛАЙНОМ, и это единственный механизм на экране", async () => {
    mocks.appsHealth.mockImplementation(async () => ЗДОРОВЬЕ);
    render(await AppsPage());
    const сломано = screen.getByText("сломано");
    // Инлайн — на месте (иначе состояние отличается только цветом, Р-Д1-4).
    expect(сломано.style.fontWeight, "«сломано» на витрине потеряло вес 600").toBe("600");
    // И ни одного правила CSS поверх: два механизма на одном слове — это спор,
    // в котором победитель зависит от порядка файлов.
    for (const sel of селекторыВеса) {
      expect(
        сломано.closest(sel),
        `правило «${sel}» задаёт вес слову витрины — здесь его задаёт инлайн`,
      ).toBeNull();
    }
  });
});
