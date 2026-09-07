import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentCard } from "../../lib/core";

/*
 * СТАТУС КАРТОЧКИ ВНЕ ЧЕТЫРЁХ ЗНАЧЕНИЙ (девятый круг починок среза Д1).
 *
 * `CARD_WORD` и `CARD_PILL` — `Record<AgentCard["status"], string>`, но
 * индексируются они РАНТАЙМНЫМ значением из Core. Новый статус в ядре (или
 * старая панель против нового ядра) давал `undefined` и на слово, и на класс:
 * пилюля превращалась в пустой `<span>`, и строка агента молчала о том, что с
 * ним. До сведения словарей на этом месте стоял тернарник с фолбэком
 * «выключен» — вранья стало меньше, а пустоты больше.
 *
 * ТЕСТОВ НА ЭТОТ ЛИСТ В РЕПО НЕ БЫЛО ВОВСЕ (это записано и в `state.test.ts`),
 * поэтому файл заводится здесь и ровно про этот вход: рендер списка с
 * незнакомым статусом.
 */

const mocks = vi.hoisted(() => ({ agents: vi.fn(), createAgent: vi.fn() }));

// Клиент Core первой строкой импортирует `server-only`, которого вне RSC нет.
vi.mock("../../lib/core", () => ({
  core: { agents: mocks.agents },
  CoreUnavailable: class CoreUnavailable extends Error {},
}));
vi.mock("./actions", () => ({ createAgent: mocks.createAgent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import Agents from "./page";

/**
 * Карточка агента с ПРОИЗВОЛЬНЫМ статусом строкой.
 *
 * `status` намеренно `string`, а не тип провода: весь тест про значение,
 * которого в союзе нет, — новый статус в Core типом панели не запретить, он
 * приезжает по HTTP. Приведение здесь и есть предмет проверки.
 */
function карточка(поля: { name: string; status: string }): AgentCard {
  return {
    id: поля.name,
    name: поля.name,
    status: поля.status,
    business: "shared",
    autonomyDefault: "T1",
    schedule: [],
  } as unknown as AgentCard;
}

describe("Список агентов: незнакомый статус не превращается в пустоту", () => {
  it("слово — сырое значение Core, класс — нейтральная пилюля", async () => {
    mocks.agents.mockImplementation(async () => [
      карточка({ name: "vendhub-ops", status: "active" }),
      // Значение, которого нет в словарях: ровно то, что приедет из Core на
      // следующем статусе жизненного цикла.
      карточка({ name: "новый-агент", status: "retired" }),
    ]);
    render(await Agents());

    // Известный статус — как и был, из словаря.
    expect(screen.getByText("работает")).toHaveClass("pill", "ok");

    // Незнакомый — назван словом, а не проглочен.
    const незнакомый = screen.getByText("retired");
    expect(незнакомый.className, "класс пилюли потерялся вместе со словарём").toBe("pill");
  });

  it("строка агента с незнакомым статусом вообще ЕСТЬ на экране", async () => {
    // Обратная сторона: агент не должен исчезнуть из списка — он попадает в
    // раздел «Не в работе» (`status !== "active"`).
    mocks.agents.mockImplementation(async () => [карточка({ name: "новый-агент", status: "retired" })]);
    render(await Agents());
    expect(screen.getByText("новый-агент")).toBeInTheDocument();
    expect(screen.getByText("Не в работе")).toBeInTheDocument();
  });
});
