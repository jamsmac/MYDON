import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FlowPhase } from "../lib/core";
import { FlowStrip } from "./flow-strip";

const PHASES: FlowPhase[] = [
  { name: "trigger", state: "ok", at: "2026-09-06T03:00:00.000Z", title: "cron 0 8 * * * · план 08:00" },
  { name: "skill", state: "warn", title: "monitor-stock", note: "навык не в каталоге — агенты не отчитались о нём" },
  { name: "proposal", state: "ok", at: "2026-09-06T03:00:03.000Z", title: "заказать 6 позиций" },
  { name: "approval", state: "warn", at: "2026-09-06T03:00:04.000Z", title: "ждёт решения с 08:00 · T3", href: "/inbox" },
  { name: "execution", state: "skip", title: "выполнения не было" },
  { name: "delivery", state: "fail", title: "telegram failed", note: "429 от Telegram" },
];

describe("Полоса фаз прогона", () => {
  it("шесть фаз в одном порядке с русскими подписями и состоянием в разметке", () => {
    render(<FlowStrip phases={PHASES} />);

    const strip = within(screen.getByRole("list", { name: "Фазы прогона" }));
    const cells = strip.getAllByRole("listitem");
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.getAttribute("data-state"))).toEqual(["ok", "warn", "ok", "warn", "skip", "fail"]);
    expect(cells.map((c) => within(c).getByText(/^(Триггер|Навык|Предложение|Согласование|Выполнение|Доставка)$/).textContent)).toEqual([
      "Триггер",
      "Навык",
      "Предложение",
      "Согласование",
      "Выполнение",
      "Доставка",
    ]);
  });

  it("время фазы по Ташкенту, а «не было» — прочерк, а не пустая клетка", () => {
    render(<FlowStrip phases={PHASES} />);

    const cells = within(screen.getByRole("list", { name: "Фазы прогона" })).getAllByRole("listitem");
    expect(cells[0]).toHaveTextContent("08:00");
    // Фазы без времени («навык», «выполнения не было») обязаны сказать это
    // прочерком: пустая клетка читается как «данные не доехали».
    expect(cells[4]).toHaveTextContent("—");
  });

  it("подсказка фазы и ссылка на разбор видны прямо в полосе", () => {
    render(<FlowStrip phases={PHASES} />);

    expect(screen.getByText("навык не в каталоге — агенты не отчитались о нём")).toBeVisible();
    expect(screen.getByRole("link", { name: "ждёт решения с 08:00 · T3" })).toHaveAttribute("href", "/inbox");
    expect(screen.getByText("429 от Telegram")).toBeVisible();
  });
});
