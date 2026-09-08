import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONSOLE_HEADER, THEME_BG, THEME_HEADER } from "../lib/theme";
import { СВЕТЛАЯ, ТЁМНАЯ_ВЫБРАННАЯ, ТЁМНАЯ_СИСТЕМНАЯ, палитраБлока, стилиПанели } from "../test/css";

/*
 * Сторож штампа темы в разметке (Р-Д2-1, Р-Д2-2, Р-Д2-5).
 *
 * Layout — асинхронный серверный компонент: вызываем его как функцию и смотрим
 * на ДЕРЕВО, которое он вернул, а не монтируем в jsdom. `<html>` и `<body>` в
 * React 19 — синглтоны: смонтированные в контейнер теста, они захватывают
 * настоящий `document.documentElement`, и React печатает «<html> cannot be a
 * child of <div>». Дерево говорит то же самое без шума: атрибут либо стоит на
 * элементе `html`, либо нет.
 *
 * Заголовки глушатся так же, как в `lib/owner.test.ts`: вне запроса
 * `next/headers` ничего не отдаёт. `cookies()` (Задача 3) сторожит не этот
 * файл — он же `header-actions.test.tsx`, — здесь достаточно заглушки без
 * куки: пропс `themeChoice` в этом наборе не проверяется, `HeaderActions`
 * замокан целиком.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn<(name: string) => string | null>() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.get }),
  cookies: async () => ({ get: () => undefined }),
}));
// Шрифты — файлы через `next/font/local`; вне сборки Next загрузчика нет.
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font" }) }));
// Счётчики меню ходят в Core; здесь проверяется штамп темы, а не Core.
vi.mock("../lib/core", () => ({
  core: {
    pendingApprovals: async () => [],
    pendingEntities: async () => ({ cards: [], fields: [] }),
  },
}));
// Клиентские части каркаса не участвуют: дерево не монтируется, а их модули
// тянут палитру ⌘K, чат помощника и WebGL-фон.
vi.mock("../components/nav", () => ({ Sidebar: () => null, TabBar: () => null }));
vi.mock("../components/floating-chat", () => ({ FloatingChat: () => null }));
vi.mock("../components/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("../components/header-actions", () => ({ HeaderActions: () => null }));
vi.mock("../components/bg/background", () => ({ Background: () => null }));

import RootLayout, { generateViewport } from "./layout";

type Элемент = ReactElement<Record<string, unknown>>;

/** Все элементы дерева в глубину — `props.children` любой формы. */
function элементы(узел: ReactNode): Элемент[] {
  if (Array.isArray(узел)) return узел.flatMap((u) => элементы(u as ReactNode));
  if (!isValidElement<Record<string, unknown>>(узел)) return [];
  return [узел, ...элементы(узел.props.children as ReactNode)];
}

/** Что «пришло» от прокси: `null` — заголовка нет (прокси не отработал). */
function заголовки(тема: string | null, консоль: string | null): void {
  mocks.get.mockImplementation((name) => {
    if (name === THEME_HEADER) return тема;
    if (name === CONSOLE_HEADER) return консоль;
    return null;
  });
}

/** Корень `<html>` и холст `<div class="app">` из дерева layout. */
async function дерево(): Promise<{ html: Элемент; app: Элемент }> {
  const все = элементы(await RootLayout({ children: <p>тело</p> }));
  const html = все[0];
  const app = все.find((el) => el.type === "div" && el.props.className === "app");
  if (html === undefined || html.type !== "html") throw new Error("корень дерева layout — не <html>");
  if (app === undefined) throw new Error('в дереве layout нет <div class="app">');
  return { html, app };
}

beforeEach(() => {
  mocks.get.mockReset();
});

describe("Корневой layout: тема стоит на <html> в разметке (Р-Д2-1, Р-Д2-2)", () => {
  it("заголовок dark → data-theme=\"dark\" и suppressHydrationWarning", async () => {
    заголовки("dark", "1");
    const { html } = await дерево();
    expect(html.props["data-theme"]).toBe("dark");
    expect(html.props.suppressHydrationWarning).toBe(true);
    expect(html.props.lang).toBe("ru");
  });

  it("заголовок light → data-theme=\"light\" (явный выбор на консоли)", async () => {
    заголовки("light", "1");
    const { html } = await дерево();
    expect(html.props["data-theme"]).toBe("light");
  });

  it("заголовок system → атрибута нет: работает prefers-color-scheme", async () => {
    заголовки("system", "0");
    const { html } = await дерево();
    expect(html.props["data-theme"]).toBeUndefined();
  });

  it("заголовка нет вовсе (прокси не отработал) → как system, без консоли", async () => {
    заголовки(null, null);
    const { html, app } = await дерево();
    expect(html.props["data-theme"]).toBeUndefined();
    expect(app.props["data-console"]).toBeUndefined();
  });

  it("мусор в заголовке не становится атрибутом", async () => {
    заголовки("blue", "1");
    const { html } = await дерево();
    expect(html.props["data-theme"]).toBeUndefined();
  });
});

describe("Корневой layout: область на холсте .app (для точечной сетки)", () => {
  it("консоль=1 → data-console=\"true\" независимо от темы", async () => {
    заголовки("light", "1");
    const { app } = await дерево();
    expect(app.props["data-console"]).toBe("true");
  });

  it("консоль=0 → атрибута нет", async () => {
    заголовки("dark", "0");
    const { app } = await дерево();
    expect(app.props["data-console"]).toBeUndefined();
  });
});

describe("generateViewport: цвет строки браузера по фактической теме (Р-Д2-5)", () => {
  it("dark → один цвет тёмного холста", async () => {
    заголовки("dark", "1");
    expect((await generateViewport()).themeColor).toBe(THEME_BG.dark);
  });

  it("light → один цвет светлого холста", async () => {
    заголовки("light", "0");
    expect((await generateViewport()).themeColor).toBe(THEME_BG.light);
  });

  it("system → пара по медиавыражению, как до среза", async () => {
    заголовки("system", "0");
    expect((await generateViewport()).themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_BG.dark },
    ]);
  });

  it("остальные поля viewport не потеряны", async () => {
    заголовки("dark", "1");
    const v = await generateViewport();
    expect(v.width).toBe("device-width");
    expect(v.initialScale).toBe(1);
  });

  it("THEME_BG — это --bg палитры, а не третья копия цвета", () => {
    // `generateViewport` работает на сервере и CSS не читает, поэтому цвет
    // холста продублирован в `lib/theme.ts`. Дубль законен, пока сходится с
    // палитрой в КАЖДОЙ ветке; разойдётся — строка браузера станет чужого тона.
    expect(палитраБлока(стилиПанели, СВЕТЛАЯ).get("--bg")).toBe(THEME_BG.light);
    expect(палитраБлока(стилиПанели, ТЁМНАЯ_СИСТЕМНАЯ).get("--bg")).toBe(THEME_BG.dark);
    expect(палитраБлока(стилиПанели, ТЁМНАЯ_ВЫБРАННАЯ).get("--bg")).toBe(THEME_BG.dark);
  });
});
