/*
 * ТЕМА ПАНЕЛИ — ОДНО ПРАВИЛО ДЛЯ СЕРВЕРА И КЛИЕНТА (срез Д2 «Два мира»).
 *
 * Этот модуль читают трое: прокси (`src/proxy.ts`) — чтобы штамп темы попал в
 * разметку до первого кадра; корневой layout — чтобы поставить атрибут на
 * `<html>`; клиентский `ThemeSync` — чтобы поправить атрибут при SPA-переходе,
 * когда корневой layout не перерисовывается. Поэтому здесь НЕТ НИ ОДНОГО
 * ИМПОРТА: `next/headers` или `server-only` уронили бы клиентскую сборку, а
 * разнести правило на два файла значит завести два списка маршрутов, которые
 * разъедутся так же, как разъехались §4 навыка и код (сторож —
 * `theme.test.ts`).
 */

/** Кука явного выбора: `light` | `dark`; куки нет — «как в системе». */
export const THEME_COOKIE = "mydon_theme";

/** Заголовок запроса от прокси к layout: `light` | `dark` | `system`. */
export const THEME_HEADER = "x-mydon-theme";

/** Заголовок запроса от прокси к layout: `1` — маршрут командного центра, `0` — нет. */
export const CONSOLE_HEADER = "x-mydon-console";

/** Явный выбор темы. «Как в системе» — это ОТСУТСТВИЕ выбора, а не третье слово. */
export type ThemeChoice = "light" | "dark";

/** Из куки и заголовка приходит строка; темой считаются ровно два слова. */
export function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
  return value === "light" || value === "dark";
}

/**
 * Маршруты командного центра — ДАННЫЕ, а не проза (Р-Д2-3): `rules.md` §4
 * ссылается сюда, а не перечисляет сам. Это ПРЕФИКСЫ: `/agents` покрывает и
 * карточку `/agents/[name]`. `/artifacts` появится в срезе A3 и добавится
 * строкой сюда — и только сюда.
 */
export const CONSOLE_ROUTES: readonly string[] = [
  "/mydon",
  "/agents",
  "/crons",
  "/flows",
  "/skills",
  "/brain",
  "/docs",
  "/apps",
];

/**
 * Маршрут командного центра — по СЕГМЕНТАМ, а не по подстроке: `/agentsfoo`
 * начинается с `/agents`, но командным центром не является.
 */
export function isConsoleRoute(pathname: string): boolean {
  return CONSOLE_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Тема запроса. `null` — «системная»: атрибута на `<html>` нет, работает
 * `prefers-color-scheme`, как было до среза на бизнес-экранах.
 *
 * Порядок правил: явный выбор (кука) выигрывает у всего; без него маршрут
 * командного центра тёмный, остальное — системное. Мусор в куке равен её
 * отсутствию: куку пишет только `setTheme`, но подделать её может кто угодно.
 */
export function themeFor(pathname: string, cookie: string | undefined): ThemeChoice | null {
  if (isThemeChoice(cookie)) return cookie;
  return isConsoleRoute(pathname) ? "dark" : null;
}

/**
 * Холст `--bg` каждой темы — для `themeColor` строки браузера. Дубль значения
 * из `globals.css`, а не новый токен: `generateViewport` работает на сервере,
 * где таблицу стилей не прочитать. Разъезд с палитрой ловит
 * `app/layout.test.tsx`.
 */
export const THEME_BG: Readonly<Record<ThemeChoice, string>> = {
  light: "#f4f4ee",
  dark: "#111712",
};
