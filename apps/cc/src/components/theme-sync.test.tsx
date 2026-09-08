import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COOKIE } from "../lib/theme";

// `usePathname` — единственное, что компонент берёт у Next: маршрут задаёт
// тест и меняет его между рендерами, как клик по меню.
const навигация = vi.hoisted(() => ({ pathname: "/apps" }));
vi.mock("next/navigation", () => ({ usePathname: () => навигация.pathname }));

import { ThemeSync } from "./theme-sync";

/** Кука темы в jsdom: `document.cookie` там настоящий, библиотек не нужно. */
function поставитьКуку(значение: string): void {
  document.cookie = `${THEME_COOKIE}=${значение}; path=/`;
}
function снятьКуку(): void {
  document.cookie = `${THEME_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Разметка, как её отдаёт сервер для маршрута командного центра без куки. */
function какСерверДляКонсоли(): void {
  document.documentElement.dataset.theme = "dark";
}

/**
 * Оболочка `.app` — та же, что в корневом layout: компонент ищет её в DOM, а
 * не получает ссылкой, потому что `<div className="app">` рендерит серверный
 * layout, а `ThemeSync` — его клиентский ребёнок.
 */
function оболочка(консоль: boolean) {
  return (
    <div className="app" data-console={консоль ? "true" : undefined}>
      <ThemeSync />
    </div>
  );
}

const app = (): Element | null => document.querySelector(".app");

describe("ThemeSync: тема следует маршруту при SPA-навигации (Р-Д2-4)", () => {
  beforeEach(() => {
    снятьКуку();
    delete document.documentElement.dataset.theme;
    навигация.pathname = "/apps";
  });
  afterEach(() => {
    снятьКуку();
    delete document.documentElement.dataset.theme;
  });

  it("ничего не рисует", () => {
    const { container } = render(<ThemeSync />);
    expect(container.innerHTML).toBe("");
  });

  it("без куки: переход /apps → /stock снимает data-theme и data-console", () => {
    какСерверДляКонсоли();
    const { rerender } = render(оболочка(true));
    // На маршруте командного центра штамп сервера подтверждён, а не снят.
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(app()).toHaveAttribute("data-console", "true");

    навигация.pathname = "/stock";
    rerender(оболочка(true));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(app()).not.toHaveAttribute("data-console");
  });

  it("без куки: переход /stock → /apps ставит dark и data-console", () => {
    навигация.pathname = "/stock";
    const { rerender } = render(оболочка(false));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(app()).not.toHaveAttribute("data-console");

    навигация.pathname = "/apps";
    rerender(оболочка(false));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(app()).toHaveAttribute("data-console", "true");
  });

  it("кука dark: на /stock тема остаётся тёмной, а data-console снимается", () => {
    поставитьКуку("dark");
    какСерверДляКонсоли();
    const { rerender } = render(оболочка(true));

    навигация.pathname = "/stock";
    rerender(оболочка(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
    // Сетка и прочая грамматика консоли — по маршруту, не по теме.
    expect(app()).not.toHaveAttribute("data-console");
  });

  it("кука light: на /apps явный выбор выигрывает у областного дефолта", () => {
    поставитьКуку("light");
    навигация.pathname = "/stock";
    const { rerender } = render(оболочка(false));
    expect(document.documentElement.dataset.theme).toBe("light");

    навигация.pathname = "/apps";
    rerender(оболочка(false));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(app()).toHaveAttribute("data-console", "true");
  });

  it("кука находится среди соседних кук — разбор, а не сравнение строки целиком", () => {
    document.cookie = "mydon_bg=1; path=/";
    поставитьКуку("dark");
    навигация.pathname = "/stock";
    render(оболочка(false));
    expect(document.documentElement.dataset.theme).toBe("dark");
    document.cookie = "mydon_bg=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });
});
