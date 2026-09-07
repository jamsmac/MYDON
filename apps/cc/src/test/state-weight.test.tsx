import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PauseToggles } from "../components/pause-toggles";
import { SkillsDeck } from "../components/skills-deck";
import type { SkillDeck, SkillDeckItem } from "../lib/core";
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

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), runSkill: vi.fn(), saveSystemConfig: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock("../app/skills/actions", () => ({ runSkill: mocks.runSkill }));
vi.mock("../app/system/actions", () => ({ saveSystemConfig: mocks.saveSystemConfig }));

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

/** Слово на экране не должно попадать НИ В ОДИН селектор веса. */
function неУтяжелено(слово: string): void {
  const элемент = screen.getByText(слово);
  for (const sel of селекторыВеса) {
    expect(
      элемент.matches(sel),
      `правило «${sel}» утяжеляет «${слово}» — это не поломка, а другая ось состояния`,
    ).toBe(false);
  }
}

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
