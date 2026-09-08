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

  /*
   * Круг починок 1, находка 1: прокси читает куку через `request.cookies.get`
   * (декодирует значение), `document.cookie` в браузере — нет. Одно правило
   * `themeFor` на двух по-разному разобранных входах — не правило, а
   * видимость: сервер принял бы `%64ark` как `dark`, клиент до фикса видел
   * сырую `%64ark`, `isThemeChoice` её отвергал — форма Д-2 другой дверью.
   */
  it("кука процентно закодирована — клиент декодирует её так же, как прокси", () => {
    // %64 = 0x64 = 'd': `%64ark` — валидная процентная запись слова "dark".
    document.cookie = `${THEME_COOKIE}=%64ark; path=/`;
    навигация.pathname = "/stock";
    render(оболочка(false));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("кривой процент в куке не роняет эффект — мусор равен отсутствию куки", () => {
    // `decodeURIComponent("%")` бросает URIError: незавершённая процентная
    // последовательность. Кука произвольно подделываема, падать нельзя.
    document.cookie = `${THEME_COOKIE}=%; path=/`;
    какСерверДляКонсоли();
    навигация.pathname = "/apps";
    expect(() => render(оболочка(true))).not.toThrow();
    // Кука отвергнута — в силе правило маршрута: /apps тёмный по умолчанию.
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  /*
   * Круг починок 1, находка 5: без сверки с текущим значением эффект пишет
   * атрибут заново даже когда он уже верный — `brain-graph.tsx` слушает
   * `data-theme` MutationObserver'ом ровно для перерисовки холста, а
   * `setAttribute` того же значения ВСЁ РАВНО ставит запись мутации (в jsdom
   * проверено отдельно — фиксирует и голый `setAttribute` с тем же
   * значением). Шпион на `setAttribute` здесь не годится: `dataset.x = …` в
   * jsdom пишет атрибут в обход публичного метода прототипа, спай его не
   * видит совсем — считаем НАСТОЯЩИЕ записи мутации через MutationObserver,
   * как их видит `brain-graph.tsx`.
   *
   * Гидрация на тёмном маршруте и переход между двумя тёмными маршрутами —
   * оба случая должны обойтись без единой записи атрибута; смена на светлый
   * маршрут — ровно одна, и она законная.
   */
  it("тот же атрибут не пишется повторно тем же значением", async () => {
    какСерверДляКонсоли(); // сервер уже поставил dark — как на живой странице
    навигация.pathname = "/apps";
    let записей = 0;
    const observer = new MutationObserver((records) => {
      записей += records.length;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const { rerender } = render(оболочка(true));
    await Promise.resolve(); // дать MutationObserver'у слить микрозадачу
    // Гидрация /apps: тема уже dark, эффекту нечего переписывать.
    expect(записей).toBe(0);

    навигация.pathname = "/crons"; // тоже консоль, тоже dark
    rerender(оболочка(true));
    await Promise.resolve();
    expect(записей).toBe(0);

    навигация.pathname = "/stock"; // бизнес-экран — тема меняется, запись законна
    rerender(оболочка(true));
    await Promise.resolve();
    expect(записей).toBe(1);
    expect(document.documentElement.dataset.theme).toBeUndefined();

    observer.disconnect();
  });

  /*
   * Круг починок 1, находка 6: `.app` отсутствует в DOM ровно в этом
   * сценарии — компонент рендерится без обёртки, как в тесте «ничего не
   * рисует» выше. Молчаливый no-op здесь — решение, закреплённое кодовым
   * комментарием у `ThemeSync`; тест пинит его как поведение, а не как
   * случайность: `data-theme` не зависит от `.app` и обязан быть выставлен
   * даже без него.
   */
  it("без .app в DOM эффект не падает и всё равно ставит data-theme", () => {
    навигация.pathname = "/apps"; // консоль — тема должна стать dark
    expect(() => render(<ThemeSync />)).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
