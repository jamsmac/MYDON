import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppsHealth } from "../../lib/core";

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
      href: "/vending",
    },
    {
      key: "notion",
      title: "Доставка в Notion",
      state: "bad",
      summary: "доставки не дошли: в тупике 2",
      detail: "всего строк доставки 14",
      href: "/system",
    },
    {
      key: "bot",
      title: "Telegram-бот",
      state: "unknown",
      summary: "бот ещё не отчитывался: heartbeat в журнале не появлялся",
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
      href: "/flows?agent=system&skill=coffee:monitor",
    },
  ],
};

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с
 * синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  appsHealth.mockImplementation(async () => здоровье);
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
    const ок = screen.getByText("не оценить")
      .closest(".approw");
    expect(лампа).toHaveClass("unknown");
    // `.idle` — зелёная лампа «всё в норме»: ноль прогонов ей не равен.
    expect(лампа).not.toHaveClass("idle");
    expect(ок).toHaveAttribute("data-state", "unknown");
  });

  it("«в порядке» остаётся своим классом — различие проверяется с обеих сторон", async () => {
    render(await AppsPage());
    const лампы = screen.getAllByText("в порядке");
    expect(лампы[0]).toHaveClass("idle");
    expect(лампы[0]).not.toHaveClass("unknown");
    expect(лампы[0].closest(".approw")).toHaveAttribute("data-state", "ok");
  });

  it("строка ведёт на экран, где источник чинят", async () => {
    render(await AppsPage());
    expect(screen.getByRole("link", { name: /Telegram-бот/ })).toHaveAttribute("href", "/system");
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
