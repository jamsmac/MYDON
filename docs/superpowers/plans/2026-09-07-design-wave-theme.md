# Дизайн-волна, срез Д2 «Два мира» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** тема известна серверу до первого кадра, явный выбор пользователя хранится и
переключается, маршруты командного центра существуют как данные в одном модуле.

**Architecture:** прокси (Next 16: `proxy.ts`, прежнее имя `middleware.ts`) читает куку и
`pathname`, вычисляет тему одним чистым правилом и кладёт в заголовок запроса; корневой layout
штампует `data-theme` на `<html>` и `data-console` на `.app` в разметке; клиентский `ThemeSync`
поправляет оба атрибута при SPA-переходе тем же правилом из того же модуля.

**Tech Stack:** TypeScript strict · Next.js 16.2 / React 19.2 (`apps/cc`, vitest 3.2, jsdom) ·
CSS-переменные без препроцессора

**Spec:** `docs/superpowers/specs/2026-09-07-design-wave-theme-design.md`

## Global Constraints

- Русский язык кода и комментариев; комментарий объясняет ПРИЧИНУ.
- TypeScript strict, `exactOptionalPropertyTypes: true`, `any` и `@ts-ignore` запрещены.
- **Миграций в срезе НЕТ.**
- Каждая правка закрывается ассертом, который упадёт при её откате.
- `apps/cc/src/lib/theme.ts` — БЕЗ ЕДИНОГО ИМПОРТА: его читают прокси, layout и клиент.
- Интерфейсы: `THEME_COOKIE="mydon_theme"`, `THEME_HEADER="x-mydon-theme"`,
  `CONSOLE_HEADER="x-mydon-console"`, `type ThemeChoice="light"|"dark"`, `CONSOLE_ROUTES`,
  `isConsoleRoute`, `themeFor(pathname, cookie): ThemeChoice|null`, `isThemeChoice`, `THEME_BG`.
- Атрибут на `.app` — `data-console="true"` либо отсутствует (не `"false"`).
- Мутирующие формы — `onSubmit` + `preventDefault` + server action в `startTransition` +
  `router.refresh()` (эталон `components/customs-rates.tsx`).
- Новые токены CSS не заводить. Тёмная тема объявлена ДВАЖДЫ, `color-scheme` идёт в обе ветки.
- Небо и жидкость (`components/bg/`) не трогать; сетка — CSS-слой под ними.

---

## Интерфейсы задач (сводка контроллера)

Порядок: 1 → 2 → 3 → 4 → 5. Задача 2 потребляет модуль из 1; задача 3 потребляет `setTheme`-
контракт и `ThemeSync` из 2; задача 4 потребляет `data-console` из 1; задача 5 описывает всё.


---

### Интерфейсы задачи 1

Ровно по контроллеру: `THEME_COOKIE="mydon_theme"`, `THEME_HEADER="x-mydon-theme"`, `type ThemeChoice="light"|"dark"`, `CONSOLE_ROUTES: readonly string[]` (8 префиксов: /mydon,/agents,/crons,/flows,/skills,/brain,/docs,/apps), `isConsoleRoute(pathname)`, `themeFor(pathname, cookie): ThemeChoice|null` — всё в `apps/cc/src/lib/theme.ts` БЕЗ единого import (сторож в theme.test.ts). ДОБАВЛЕНО в тот же модуль (нужно layout/прокси/тестам, серверных импортов нет): `CONSOLE_HEADER="x-mydon-console"` (имя второго заголовка, у контроллера было только значение), `isThemeChoice(value: string|null|undefined): value is ThemeChoice` (одна проверка «это одно из двух слов» для куки в прокси, заголовка в layout и аргумента `setTheme` в задаче переключателя), `THEME_BG: Readonly<Record<ThemeChoice,string>>={light:"#f4f4ee",dark:"#111712"}` — TS-дубль `--bg` для `themeColor`, НЕ новый CSS-токен, пришпилен к палитре тестом layout. Прокси: `apps/cc/src/proxy.ts`, `export function proxy(request: NextRequest): NextResponse` + `export const config = { matcher: [...] }`; кладёт `x-mydon-theme` = `light|dark|system` и `x-mydon-console` = `1|0` в заголовки ЗАПРОСА через `NextResponse.next({ request: { headers } })`. Layout: `export async function generateViewport(): Promise<Viewport>` (вместо `export const viewport`), модульный хелпер `requestTheme(): Promise<{ theme: ThemeChoice|null; isConsole: boolean }>`, `<html lang="ru" data-theme={theme ?? undefined} suppressHydrationWarning>`, `<div className="app" data-console={isConsole ? "true" : undefined}>`. Для задачи ThemeSync: атрибут на `.app` называется `data-console`, значение `"true"` либо атрибут отсутствует; для задачи сетки: селектор `.app[data-console="true"]`.

---

### Интерфейсы задачи 2

ПОТРЕБЛЯЕТ из задачи 1 (`apps/cc/src/lib/theme.ts`, ровно как зафиксировал контроллер): `THEME_COOKIE = "mydon_theme"`, `CONSOLE_ROUTES: readonly string[]`, `isConsoleRoute(pathname): boolean`, `themeFor(pathname, cookie: string | undefined): ThemeChoice | null`. Дополнительное требование к `themeFor`: НЕЗНАКОМОЕ значение куки (не "light"/"dark") трактуется как отсутствие — `ThemeSync` передаёт сырую строку из `document.cookie` без своей проверки, чтобы правило было одно.

ОТДАЁТ: `export function ThemeSync(): null` в `apps/cc/src/components/theme-sync.tsx` ("use client"; по `usePathname()` в `useLayoutEffect` ставит/снимает `data-theme` на `<html>` через `themeFor` и `data-console="true"` на `.app` через `isConsoleRoute`; при `themeFor === null` атрибут `data-theme` УДАЛЯЕТСЯ; при не-консольном маршруте `data-console` УДАЛЯЕТСЯ). В корневом layout стоит один раз: `import { ThemeSync } from "../components/theme-sync";` и `<ThemeSync />` сразу после `<Background />`.

КОНТРАКТ ДЛЯ ЗАДАЧИ 3 (layout): `data-console` на `.app` — атрибут либо равен "true", либо отсутствует (ThemeSync снимает его через `delete dataset.console`); правило CSS — `.app[data-console="true"]`.

КОНТРАКТ ДЛЯ ЗАДАЧИ 4 (setTheme): кука `mydon_theme` ОБЯЗАНА быть без `HttpOnly` — ThemeSync читает её из `document.cookie`; с HttpOnly явный выбор терялся бы при каждом SPA-переходе.

КОНТРАКТ ДЛЯ ЗАДАЧИ 5 (rules.md §4) — маркер сторожа дрейфа `apps/cc/src/test/theme-routes.test.ts`: в §4 (между заголовками «## 4. » и «## 5. ») РОВНО ОДНА строка содержит подстроку `` `CONSOLE_ROUTES` ``; «абзац маркера» = эта строка плюс следующие непустые строки, не начинающиеся с `-`, `#`, `|`, `*`; все `` `/…` `` в обратных кавычках внутри абзаца маркера = список маршрутов, он сравнивается с `CONSOLE_ROUTES` как множество (порядок свободный, дубли краснеют). Прочие пути в обратных кавычках (например `` `/artifacts` `` «появится в A3») — в других абзацах или буллетах. Зеркала §4 (.agents, docs/agentic-os-starter) — байт-в-байт, это держит существующий `design-skill.test.ts`.

---

### Интерфейсы задачи 3

ИСПОЛЬЗУЕТ из Задачи 1 (`apps/cc/src/lib/theme.ts`): `THEME_COOKIE = "mydon_theme"`, `type ThemeChoice = "light" | "dark"`.

ДАЁТ:
- `apps/cc/src/app/theme/actions.ts` ("use server"):
  - `export interface ActionResult { ok: boolean; message?: string }` — тот же формат, что `app/catalog/actions.ts` (шапка читает `res.message`, как `customs-rates.tsx`)
  - `export async function setTheme(choice: ThemeChoice | "system"): Promise<ActionResult>` — `light`/`dark` → `cookies().set("mydon_theme", choice, { path: "/", sameSite: "lax", maxAge: 31536000 })`; `system` → `cookies().delete({ name: "mydon_theme", path: "/" })`; затем `revalidatePath("/", "layout")`. Чужое значение → `{ ok: false, message: "Неизвестная тема" }` без записи. Кука НЕ httpOnly и НЕ secure (её читает `ThemeSync` из `document.cookie`; панель по http за Tailscale).
- `HeaderActions({ pendingCount: number; themeChoice: ThemeChoice | "system" })` — новый ОБЯЗАТЕЛЬНЫЙ проп `themeChoice`; источник — кука через `cookies()` в корневом layout (НЕ заголовок `x-mydon-theme` и НЕ `dataset.theme`: они несут фактическую тему, а не выбор).
- Разметка переключателя: `<select class="theme-sw" aria-label="Тема" title="Тема панели">` с опциями `system`→«как в системе», `light`→«светлая», `dark`→«тёмная»; при отказе — `<button class="theme-retry err-text">{message} · повторить</button>`.
- `apps/cc/src/app/layout.tsx`: `const rawTheme = (await cookies()).get(THEME_COOKIE)?.value; const themeChoice: ThemeChoice | "system" = rawTheme === "light" || rawTheme === "dark" ? rawTheme : "system";` → `<HeaderActions pendingCount={inbox} themeChoice={themeChoice} />`.
- CSS-классы `.hdr .theme-sw`, `.hdr .theme-retry` — только токены `--line`, `--r-s`, `--surf`, `--tx-2`, `--tx`, `--accent-line` (все объявлены в трёх ветках палитры).

ТЕСТОВЫЕ ХЕЛПЕРЫ (существующие, `apps/cc/src/test/css.ts`): `стилиПанели`, `последнееПравило(source, селектор)`, `палитраБлока(source, ветка)`, `ВЕТКИ`.

---

### Интерфейсы задачи 4

ПОТРЕБЛЯЕТ (от других задач среза): атрибут `data-console="true"` на `<div className="app">` в apps/cc/src/app/layout.tsx (SSR) и его переключение в `ThemeSync` при SPA-навигации; `data-theme` на `<html>` (middleware/layout). ПОТРЕБЛЯЕТ (уже в коде): токены `--line-soft` (#232a1d тёмная), `--bg` (#111712 тёмная), `--surf` (#18211a тёмная); `body { background: var(--bg) }` (globals.css:199–206); `.bgw { position: fixed; z-index: 0 }` (216) и `.app { position: relative; z-index: 1 }` (239); `:has()` уже применяется в файле (`.brain-layout:has(.brain-card)`, 1809–1817, с записью о поддержке браузеров). ОТДАЁТ: CSS-контракт сетки — РОВНО два правила, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) body:has(.app[data-console="true"]) {…} }` и `:root[data-theme="dark"] body:has(.app[data-console="true"]) {…}`, тело `background-image: radial-gradient(circle, var(--line-soft) 1px, transparent 1px); background-size: 24px 24px;` (только эти два свойства, НЕ shorthand `background`); сторож apps/cc/src/test/console-grid.test.ts. ФАКТЫ ДЛЯ ЗАДАЧИ НАВЫКА (Р-Д2-8, `rules.md` §4): сетка лежит на `body` под небом (`z-index` 0/1), цвет `--line-soft`, контраст к холсту 1,23:1 (WCAG, обе тёмные ветки), шаг 24px, радиус точки 1px, в светлом мире отсутствует, внутри `.panel`/`.card` невозможна (их `--surf` непрозрачен). Отклонение от зафиксированного контроллером «правило на `.app[data-console="true"]`»: селектор `body:has(.app[data-console="true"])` — см. вопрос 1.

---

### Интерфейсы задачи 5

Из других задач используются РОВНО: `CONSOLE_ROUTES`, `isConsoleRoute(pathname)`, `themeFor(pathname, cookie)` из `apps/cc/src/lib/theme.ts`; заголовки `x-mydon-theme` (`light`|`dark`|`system`) и `x-mydon-console` (`1`|`0`) из `apps/cc/src/proxy.ts`; `data-theme` на `<html>` + `suppressHydrationWarning` + `data-console="true"` на `<div className="app">` + `generateViewport` в `apps/cc/src/app/layout.tsx`; `ThemeSync` в `apps/cc/src/components/theme-sync.tsx`; `setTheme` в `apps/cc/src/app/theme/actions.ts` (кука `mydon_theme`, `SameSite=Lax`, `Path=/`, год); переключатель словами «как в системе» / «светлая» / «тёмная» в `apps/cc/src/components/header-actions.tsx`; CSS: `color-scheme: light` в `:root`, `color-scheme: dark` в `:root:not([data-theme="light"])` под `@media (prefers-color-scheme: dark)` и в `:root[data-theme="dark"]`; правило сетки с `radial-gradient` и `24px` на селекторе, содержащем `.app[data-console="true"]`, только под тёмными ветками.
КОНТРАКТ МАРКЕРА ДЛЯ ЗАДАЧИ 2 (тест дрейфа маршрутов): в `rules.md` §4 стоит строка, состоящая ровно из `<!-- CONSOLE_ROUTES -->` (один раз на файл); СРАЗУ за ней — абзац до первой пустой строки. Абзац обязан содержать литералы `` `CONSOLE_ROUTES` `` и `` `apps/cc/src/lib/theme.ts` `` и НЕ содержать ни одного элемента `CONSOLE_ROUTES` как подстроки (т. е. не перечислять маршруты). Тест задачи 2 импортирует `CONSOLE_ROUTES` из модуля, вырезает абзац по маркеру и проверяет эти три утверждения; живёт он НЕ в design-skill.test.ts (там — только маркер «есть и один»), а рядом с модулем (например `apps/cc/src/lib/theme.test.ts`). Весь §4 до «### 4.1.» тоже свободен от литералов маршрутов — задача 2 может взять и этот, более широкий, охват.
Сторож зеркал (design-skill.test.ts, блок «зеркала навыка mydon-design не разъезжаются») сверяет rules/tokens/primitives/checklist побайтно и SKILL.md — с двумя объявленными заменами; порядок сравнения и список файлов не меняются.

---

# Задачи

## Задача 1. Тема известна серверу: `theme.ts`, прокси, штамп в layout, `color-scheme`, `themeColor`

Контекст для исполнителя: панель — `apps/cc` (Next.js 16.2.12, React 19.2, vitest 3.2, jsdom). Команды запускаются из корня монорепо `/Users/js/Developer/mydon`. Единственный layout — корневой `apps/cc/src/app/layout.tsx`; он общий для тёмного командного центра и светлых бизнес-экранов, и у него нет доступа к `pathname`. Поэтому тема считается в прокси (там есть и адрес, и кука) и едет в layout заголовком запроса. Клиентскую половину (`ThemeSync`) делает следующая задача — здесь её НЕ добавлять.

Порядок шагов — тест первым, потом код, потом прогон. Все тесты ниже написаны целиком; в них ничего не «дополнять».

### Шаг 1. Модуль правила `apps/cc/src/lib/theme.ts` (новый файл)

- [ ] Создать `apps/cc/src/lib/theme.ts` с содержимым ДОСЛОВНО (в файле нет ни одного `import` — это требование, а не стиль; сторож в шаге 2):

```ts
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
```

### Шаг 2. Тест правила `apps/cc/src/lib/theme.test.ts` (новый файл)

- [ ] Создать файл с содержимым ДОСЛОВНО:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSOLE_HEADER,
  CONSOLE_ROUTES,
  THEME_BG,
  THEME_COOKIE,
  THEME_HEADER,
  isConsoleRoute,
  isThemeChoice,
  themeFor,
} from "./theme";

/*
 * Сторож правила темы (Р-Д2-2, Р-Д2-3, ловушка 3 спеки).
 *
 * Маршруты перечислены здесь ВТОРОЙ РАЗ намеренно: список в модуле — данные,
 * и тест обязан упасть, если из него выпадет строка. Вложенный `/agents/…` и
 * ложный префикс `/agentsfoo` — два случая, на которых «начинается с»
 * ошибается в разные стороны.
 */
const КОНСОЛЬ: readonly string[] = [
  "/mydon",
  "/agents",
  "/agents/vendhub-ops",
  "/crons",
  "/flows",
  "/skills",
  "/brain",
  "/docs",
  "/apps",
  "/apps/",
];
const БИЗНЕС: readonly string[] = [
  "/",
  "/stock/goods",
  "/domain/vendhub",
  "/card/7d1c",
  "/tasks/42",
  "/team/actions",
  "/registry",
  "/system",
  "/inbox",
  "/assistant",
  "/agentsfoo",
  "/mydon-old",
  "/x/agents",
];
/** Куки: нет, оба законных слова, мусор, пустая строка. */
const КУКИ: readonly (string | undefined)[] = [undefined, "light", "dark", "auto", ""];

describe("theme.ts: список маршрутов командного центра — данные в одном месте", () => {
  it("ровно восемь префиксов, без слэша на конце, без дублей", () => {
    expect([...CONSOLE_ROUTES]).toEqual([
      "/mydon",
      "/agents",
      "/crons",
      "/flows",
      "/skills",
      "/brain",
      "/docs",
      "/apps",
    ]);
    for (const p of CONSOLE_ROUTES) {
      expect(p, `${p}: префикс обязан начинаться со слэша`).toMatch(/^\/[a-z]/);
      expect(p, `${p}: слэш на конце сломает сравнение по сегментам`).not.toMatch(/\/$/);
    }
    expect(new Set(CONSOLE_ROUTES).size).toBe(CONSOLE_ROUTES.length);
  });

  it("модуль не импортирует ничего: его читают и прокси, и клиент (ловушка 3)", () => {
    // `next/headers` здесь уронил бы клиентскую сборку; любой другой импорт —
    // повод перечитать шапку файла, прежде чем его добавлять.
    const источник = readFileSync(new URL("./theme.ts", import.meta.url), "utf8");
    expect(источник).not.toMatch(/^\s*import\s/m);
    expect(источник).not.toMatch(/require\(/);
  });
});

describe("isConsoleRoute: по сегментам, не по подстроке", () => {
  it("вложенный маршрут карточки агента — консоль", () => {
    expect(isConsoleRoute("/agents/vendhub-ops")).toBe(true);
    expect(isConsoleRoute("/agents/")).toBe(true);
  });

  it("ложный префикс — НЕ консоль", () => {
    expect(isConsoleRoute("/agentsfoo")).toBe(false);
    expect(isConsoleRoute("/mydon-old")).toBe(false);
    expect(isConsoleRoute("/x/agents")).toBe(false);
  });

  it("вся таблица", () => {
    for (const p of КОНСОЛЬ) expect(isConsoleRoute(p), `${p} — командный центр`).toBe(true);
    for (const p of БИЗНЕС) expect(isConsoleRoute(p), `${p} — бизнес`).toBe(false);
  });
});

describe("themeFor: кука выигрывает у области, область — у системы (Р-Д2-2)", () => {
  it("три утверждения приёмки §4 спеки", () => {
    expect(themeFor("/stock", "dark")).toBe("dark");
    expect(themeFor("/apps", undefined)).toBe("dark");
    expect(themeFor("/stock", undefined)).toBeNull();
  });

  it("консоль: без куки и с мусором — dark; с кукой — как в куке", () => {
    for (const p of КОНСОЛЬ) {
      expect(themeFor(p, undefined), `${p} без куки`).toBe("dark");
      expect(themeFor(p, "auto"), `${p} с мусором в куке`).toBe("dark");
      expect(themeFor(p, ""), `${p} с пустой кукой`).toBe("dark");
      expect(themeFor(p, "light"), `${p} с кукой light`).toBe("light");
      expect(themeFor(p, "dark"), `${p} с кукой dark`).toBe("dark");
    }
  });

  it("бизнес: без куки и с мусором — системная (null); с кукой — как в куке", () => {
    for (const p of БИЗНЕС) {
      expect(themeFor(p, undefined), `${p} без куки`).toBeNull();
      expect(themeFor(p, "auto"), `${p} с мусором в куке`).toBeNull();
      expect(themeFor(p, ""), `${p} с пустой кукой`).toBeNull();
      expect(themeFor(p, "light"), `${p} с кукой light`).toBe("light");
      expect(themeFor(p, "dark"), `${p} с кукой dark`).toBe("dark");
    }
  });

  it("результат всегда одно из трёх: light, dark, null — на любой паре", () => {
    for (const p of [...КОНСОЛЬ, ...БИЗНЕС]) {
      for (const c of КУКИ) expect([null, "light", "dark"]).toContain(themeFor(p, c));
    }
  });
});

describe("theme.ts: провод между прокси, layout, ThemeSync и setTheme", () => {
  it("имена куки и заголовков пришпилены — их читают четыре файла", () => {
    expect(THEME_COOKIE).toBe("mydon_theme");
    expect(THEME_HEADER).toBe("x-mydon-theme");
    expect(CONSOLE_HEADER).toBe("x-mydon-console");
  });

  it("isThemeChoice принимает ровно два слова", () => {
    expect(isThemeChoice("light")).toBe(true);
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("system")).toBe(false);
    expect(isThemeChoice("")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
  });

  it("холсты двух тем — разные hex-цвета", () => {
    expect(THEME_BG.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_BG.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_BG.light).not.toBe(THEME_BG.dark);
  });
});
```

- [ ] Прогнать: `pnpm --filter @mydon/cc test src/lib/theme.test.ts` — все зелёные.

### Шаг 3. Прокси `apps/cc/src/proxy.ts` (новый файл)

Next 16 переименовал `middleware.ts` → `proxy.ts` (экспорт `proxy`, рантайм Node; в `next/dist/build/analysis/get-page-static-info.js:246-247` распознаются и `/src/middleware`, и `/src/proxy`, но `middleware` объявлен устаревшим в upgrade-guide 16). Файл лежит именно в `apps/cc/src/` (рядом с `app/`), НЕ внутри `app/`. Создавать и `middleware.ts`, и `proxy.ts` одновременно НЕЛЬЗЯ — Next откажется собираться.

- [ ] Создать `apps/cc/src/proxy.ts` ДОСЛОВНО:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { CONSOLE_HEADER, THEME_COOKIE, THEME_HEADER, isConsoleRoute, themeFor } from "./lib/theme";

/**
 * Штамп темы ДО первого кадра (Р-Д2-1, Р-Д2-2).
 *
 * Корневой layout не знает адреса запроса (у серверного layout нет
 * `usePathname`, а `headers()` пути не несёт) и он один на оба мира — тёмный
 * командный центр и светлые бизнес-экраны. Поэтому тема вычисляется здесь, где
 * есть и адрес, и кука, и едет в layout заголовком ЗАПРОСА:
 * `NextResponse.next({ request })` подменяет заголовки для серверного рендера,
 * и `headers()` в layout отдаёт их как пришедшие с клиента. Заголовок всегда
 * ПЕРЕЗАПИСЫВАЕТСЯ, а не дописывается: клиент может прислать свой
 * `x-mydon-theme`, и он не должен дойти до разметки.
 *
 * Прокси, а не route groups: перенос двадцати страниц в `(console)/` и
 * `(business)/` изменил бы двадцать файлов с относительными импортами ради
 * того же результата (решение контроллера 2). Это Next 16 `proxy`: прежнее имя
 * `middleware` объявлено устаревшим, рантайм — Node, не edge.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const cookie = request.cookies.get(THEME_COOKIE)?.value;
  const headers = new Headers(request.headers);
  headers.set(THEME_HEADER, themeFor(pathname, cookie) ?? "system");
  headers.set(CONSOLE_HEADER, isConsoleRoute(pathname) ? "1" : "0");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
   * Только страницы. Исключены: `_next/*` (чанки, шрифты, картинки), `api/*` и
   * два route.ts вне `api` (`/kp/download`, `/contracts/[id]/docx`) — там нет
   * разметки, штамп не нужен; `favicon.ico` и `prototypes/*` — содержимое
   * `public/`. Без исключений прокси бил бы по каждому ассету каждой страницы.
   * Синтаксис — path-to-regexp Next: одна группа с отрицательным просмотром;
   * что она компилируется и делит адреса как задумано, проверяет
   * `proxy.test.ts` тем же кодом, что и сборка.
   */
  matcher: ["/((?!api/|_next/|favicon\\.ico|prototypes/|kp/download|contracts/[^/]+/docx).*)"],
};
```

### Шаг 4. Тест прокси `apps/cc/src/proxy.test.ts` (новый файл)

- [ ] Создать ДОСЛОВНО (первая строка — докблок окружения, его не убирать):

```ts
/** @vitest-environment node */
import { NextRequest } from "next/server";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import { describe, expect, it } from "vitest";
import { CONSOLE_HEADER, THEME_COOKIE, THEME_HEADER } from "./lib/theme";
import { config, proxy } from "./proxy";

/*
 * Окружение node, а не jsdom (общий default в vitest.config.mts): `NextRequest`
 * расширяет платформенный `Request`, и брать его надо у Node, а не искать в
 * окне jsdom.
 *
 * Подменённые заголовки ЗАПРОСА снаружи видны как `x-middleware-request-<имя>`
 * на ответе `NextResponse.next({ request })` — так Next передаёт их серверному
 * рендеру. Это единственное место, где их можно прочитать, не поднимая сервер.
 */
function запрос(pathname: string, cookie?: string): NextRequest {
  const init = cookie === undefined ? undefined : { headers: { cookie: `${THEME_COOKIE}=${cookie}` } };
  return new NextRequest(`http://cc.local${pathname}`, init);
}

function заголовокЗапроса(res: Response, имя: string): string | null {
  return res.headers.get(`x-middleware-request-${имя}`);
}

describe("proxy: штамп темы в заголовках запроса (Р-Д2-1, Р-Д2-2)", () => {
  it("маршрут командного центра без куки → dark, консоль=1", () => {
    const res = proxy(запрос("/apps"));
    expect(заголовокЗапроса(res, THEME_HEADER)).toBe("dark");
    expect(заголовокЗапроса(res, CONSOLE_HEADER)).toBe("1");
  });

  it("вложенный маршрут консоли — тоже dark", () => {
    const res = proxy(запрос("/agents/vendhub-ops"));
    expect(заголовокЗапроса(res, THEME_HEADER)).toBe("dark");
    expect(заголовокЗапроса(res, CONSOLE_HEADER)).toBe("1");
  });

  it("бизнес-маршрут без куки → system, консоль=0", () => {
    const res = proxy(запрос("/stock/goods"));
    expect(заголовокЗапроса(res, THEME_HEADER)).toBe("system");
    expect(заголовокЗапроса(res, CONSOLE_HEADER)).toBe("0");
  });

  it("кука light на консоли выигрывает у областного дефолта; консоль остаётся консолью", () => {
    const res = proxy(запрос("/apps", "light"));
    expect(заголовокЗапроса(res, THEME_HEADER)).toBe("light");
    expect(заголовокЗапроса(res, CONSOLE_HEADER)).toBe("1");
  });

  it("кука dark на бизнес-маршруте выигрывает у системной", () => {
    const res = proxy(запрос("/stock/goods", "dark"));
    expect(заголовокЗапроса(res, THEME_HEADER)).toBe("dark");
    expect(заголовокЗапроса(res, CONSOLE_HEADER)).toBe("0");
  });

  it("мусор в куке равен её отсутствию", () => {
    expect(заголовокЗапроса(proxy(запрос("/apps", "auto")), THEME_HEADER)).toBe("dark");
    expect(заголовокЗапроса(proxy(запрос("/stock/goods", "auto")), THEME_HEADER)).toBe("system");
  });

  it("присланный клиентом x-mydon-theme перезаписывается, а не пропускается", () => {
    const req = new NextRequest("http://cc.local/stock/goods", { headers: { [THEME_HEADER]: "dark" } });
    expect(заголовокЗапроса(proxy(req), THEME_HEADER)).toBe("system");
  });

  it("ответ — пропуск запроса дальше, не редирект и не переписывание", () => {
    const res = proxy(запрос("/mydon"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy: matcher — страницы да, ассеты и route.ts нет", () => {
  // Компилируем тем же кодом, что и сборка Next (`lib/try-to-parse-path`), и
  // проверяем тем же RegExp, что и рантайм: синтаксис matcher — path-to-regexp,
  // и «похоже на регулярку» не значит «компилируется».
  const источник = config.matcher[0] ?? "";
  const разбор = tryToParsePath(источник);
  const re = new RegExp(разбор.regexStr ?? "(?!)");

  it("ровно один matcher, и он компилируется", () => {
    expect(config.matcher).toHaveLength(1);
    expect(разбор.error).toBeUndefined();
    expect(разбор.regexStr).toBeDefined();
  });

  it("страницы обоих миров проходят", () => {
    for (const p of [
      "/",
      "/mydon",
      "/apps",
      "/agents/vendhub-ops",
      "/docs",
      "/stock/goods",
      "/contracts/abc-1",
      "/domain/vendhub",
      "/apiary",
    ]) {
      expect(re.test(p), `${p} — страница, штамп нужен`).toBe(true);
    }
  });

  it("ассеты, api и route.ts вне api — мимо", () => {
    for (const p of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/favicon.ico",
      "/prototypes/x.html",
      "/api/catch",
      "/api/sources/export",
      "/api/sources/unify-export",
      "/api/attachments/1/raw",
      "/kp/download",
      "/contracts/abc-1/docx",
    ]) {
      expect(re.test(p), `${p} — не страница, прокси тут лишний`).toBe(false);
    }
  });
});
```

- [ ] Прогнать: `pnpm --filter @mydon/cc test src/proxy.test.ts` — зелёный. (Проверено на этом дереве: `next/package.json` без `exports`, глубокий импорт `next/dist/lib/try-to-parse-path` резолвится и в TS (`.d.ts` есть), и в vitest; `NextRequest` работает под окружением node.)

### Шаг 5. `color-scheme` в трёх блоках `apps/cc/src/app/globals.css`

Три правки, все — вставка одной декларации ПЕРЕД первой строкой `--bg` каждого блока. Индент и якоря — точные.

- [ ] Блок `:root` (строка 18 по текущему файлу: `  --bg: #f4f4ee;              /* холст: тёплый белый с оливковой нотой */`). Перед ней вставить:

```css
  /* Нативные контролы, autofill и системные скроллбары — под тему, а не под
     систему; обе тёмные ветки ниже переопределяют это свойство на dark. */
  color-scheme: light;
```

- [ ] Тёмная системная ветка. Якорь — две строки подряд:

```css
  :root:not([data-theme="light"]) {
    --bg: #111712;
```

заменить на:

```css
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #111712;
```

- [ ] Тёмная выбранная ветка. Якорь — две строки подряд:

```css
:root[data-theme="dark"] {
  --bg: #111712;
```

заменить на:

```css
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111712;
```

Ничего больше в CSS не трогать: `.bgw` (строки 216–220), `.srcform input[type="datetime-local"] { color-scheme: light dark; }` (строка 1301) остаются как есть. В комментарии к `:root` НЕ писать чисел вида `N,N:1` — сторож контраста в `palette.test.ts` считает каждое такое число утверждением.

### Шаг 6. Сторож `color-scheme` в `apps/cc/src/test/palette.test.ts`

- [ ] В блоке импорта (строки 2–13) добавить `правилаCss,` — заменить

```ts
  палитраБлока,
  последнееПравило,
  стилиПанели as css,
```

на

```ts
  палитраБлока,
  последнееПравило,
  правилаCss,
  стилиПанели as css,
```

- [ ] В КОНЕЦ файла (после закрывающей `});` последнего `describe("Палитра globals.css: контраст записан рядом со значением", …)`) дописать ДОСЛОВНО:

```ts

describe("Палитра globals.css: color-scheme объявлен в трёх блоках темы (Р-Д2-5)", () => {
  /*
   * `color-scheme` — НЕ кастомное свойство, и `палитраБлока` его не видит: она
   * собирает только `--имя`. Ищем в теле того же правила (контекст + селектор
   * ветки), последнее объявление — как браузер. Без этого свойства нативные
   * контролы, autofill и системные скроллбары в тёмной консоли оставались
   * светлыми, и токены палитры этого не чинят: они красят только то, что
   * красит наш CSS.
   */
  function схемаЦвета(ветка: Ветка): string | null {
    let итог: string | null = null;
    for (const r of правилаCss(css)) {
      if (r.контекст !== ветка.контекст || r.селектор !== ветка.селектор) continue;
      for (const m of r.тело.matchAll(/(?:^|[;\s])color-scheme\s*:\s*([^;{}]+)/g)) {
        итог = (m[1] ?? "").trim();
      }
    }
    return итог;
  }

  it("светлая база объявляет light", () => {
    expect(схемаЦвета(СВЕТЛАЯ)).toBe("light");
  });

  it("ОБЕ тёмные ветки объявляют dark — списки синхронизируются руками", () => {
    // Та же ловушка, что у токенов: свойство в одной ветке и забытое в другой
    // видно только половине пользователей (системная тема против явного выбора).
    expect(схемаЦвета(ТЁМНАЯ_СИСТЕМНАЯ)).toBe("dark");
    expect(схемаЦвета(ТЁМНАЯ_ВЫБРАННАЯ)).toBe("dark");
  });

  it("в каждой ветке свойство объявлено, а не унаследовано молчанием", () => {
    for (const ветка of ВЕТКИ) {
      expect(схемаЦвета(ветка), `в блоке «${ветка.имя}» нет color-scheme`).not.toBeNull();
    }
  });
});
```

- [ ] Прогнать: `pnpm --filter @mydon/cc test src/test/palette.test.ts` — новые три теста зелёные, старые (в т.ч. «две ветки тёмной темы объявляют ОДИН набор токенов» и сверка контраста) не изменились: `color-scheme` не начинается с `--`, разборщик токенов его не видит.

### Шаг 7. Корневой layout `apps/cc/src/app/layout.tsx`

Файл заменяется целиком — ниже полное новое содержимое. Отличия от текущего: (1) импорты `headers` и модуля темы; (2) `export const viewport` → `export async function generateViewport`; (3) хелпер `requestTheme`; (4) `<html>` получает `data-theme` и `suppressHydrationWarning`; (5) `<div className="app">` получает `data-console`. Шрифтовой блок и счётчики — без изменений, комментарий про шрифты сохранён дословно.

- [ ] Записать `apps/cc/src/app/layout.tsx` ДОСЛОВНО:

```tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { core } from "../lib/core";
import { CONSOLE_HEADER, THEME_BG, THEME_HEADER, isThemeChoice, type ThemeChoice } from "../lib/theme";
import { Sidebar, TabBar } from "../components/nav";
import { FloatingChat } from "../components/floating-chat";
import { CommandPalette } from "../components/command-palette";
import { HeaderActions } from "../components/header-actions";
import { Background } from "../components/bg/background";
import "./globals.css";

// Шрифты фирменные (ТЗ) — ЛОКАЛЬНЫЕ ФАЙЛЫ, а не `next/font/google`.
// Почему так: `next/font/google` забирает шрифт ПО СЕТИ НА СБОРКЕ, и Next 16 с
// Turbopack при недостижимом `fonts.googleapis.com` не предупреждает, а роняет
// сборку («next/font: error: Failed to fetch `Golos Text` from Google Fonts»).
// `.dockerignore` исключает `**/.next`, поэтому кеша шрифтов в контексте сборки
// нет никогда — каждая сборка ходила в интернет заново, и любой сбой доступа
// останавливал автодеплой на шаге `compose build` (до миграций и переключения
// контейнеров: прод при этом жив, но ни один коммит не выкатывается) и заодно
// весь CI. Теперь файлы лежат в репозитории (`src/fonts`, OFL — лицензии рядом),
// и сборка не зависит от сети вовсе.
//
// Начертания те же, что раньше подключались из Google. Кириллица и латиница
// СЛИТЫ В ОДИН ФАЙЛ на начертание (fontsource-подмножества latin/latin-ext/
// cyrillic/cyrillic-ext, объединённые fontTools): `next/font/local` не умеет
// `unicode-range` на отдельный `src`, а двумя файлами одного веса браузер брал
// бы первый и кириллица снова уезжала бы в системный запасной шрифт — ровно тот
// дефект, из-за которого Syne заменили на Golos Text.
//
// Golos Text вместо Syne + Manrope. Syne подключался ТОЛЬКО с латиницей, а на
// нём висели ВСЕ заголовки — и в них русский текст. То есть кириллические
// заголовки уже сейчас рендерились не Syne, а системным запасным шрифтом:
// дефект был виден глазом как «типографика какая-то не такая», но не читался
// как ошибка. Golos Text — русская гарнитура, кириллица у неё родная.
const golosDisplay = localFont({
  src: [
    { path: "../fonts/golos-text-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/golos-text-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-display",
});
const golosBody = localFont({
  src: [
    { path: "../fonts/golos-text-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/golos-text-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/golos-text-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-body",
});
const mono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-mono-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MYDON · командный центр",
  description: "Единый контур управления направлениями",
};

/**
 * Тема и область запроса — из заголовков, которые проставил `src/proxy.ts`
 * (правило — `lib/theme.ts`, одно на сервер и клиент).
 *
 * Заголовка нет (прокси не отработал, адрес вне его matcher) — «системная» и
 * «не консоль»: разметка без атрибутов, как до среза. Первый кадр тогда
 * системный, а клиентский `ThemeSync` поправит его после гидрации — хуже, чем
 * штамп, но не ошибка.
 */
async function requestTheme(): Promise<{ theme: ThemeChoice | null; isConsole: boolean }> {
  const h = await headers();
  const theme = h.get(THEME_HEADER);
  return {
    theme: isThemeChoice(theme) ? theme : null,
    isConsole: h.get(CONSOLE_HEADER) === "1",
  };
}

/**
 * Цвет строки браузера — по ФАКТИЧЕСКОЙ теме, а не только по системной
 * (Р-Д2-5): при штампе `dark` на системно-светлом телефоне статический
 * `viewport` рисовал светлую шапку над тёмной консолью. Функция вместо
 * объекта: статический `viewport` и `generateViewport` в одном сегменте вместе
 * не экспортируются. Без штампа — прежняя пара по медиавыражению.
 */
export async function generateViewport(): Promise<Viewport> {
  const { theme } = await requestTheme();
  return {
    themeColor:
      theme === null
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_BG.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_BG.dark },
          ]
        : THEME_BG[theme],
    width: "device-width",
    initialScale: 1,
  };
}

/** Счётчик в меню не должен ронять всю панель, если Core прилёг. */
async function pendingCount(): Promise<number> {
  try {
    return (await core.pendingApprovals()).length;
  } catch {
    return 0;
  }
}

/**
 * Сколько записей ждёт слова владельца — для значка «На утверждение».
 * Считаем плитки очереди: новые карточки плюс карточки с предложенными
 * значениями, чтобы число в меню совпадало с тем, что владелец там увидит.
 */
async function queueCount(): Promise<number> {
  try {
    const { cards, fields } = await core.pendingEntities();
    return cards.length + new Set(fields.map((f) => f.entityId)).size;
  } catch {
    return 0;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // «Входящие» = решения агентов + карточки реестра на утверждение. Один счётчик
  // на объединённый вход.
  const [pending, queue, { theme, isConsole }] = await Promise.all([
    pendingCount(),
    queueCount(),
    requestTheme(),
  ]);
  const inbox = pending + queue;

  // Тема — АТРИБУТОМ В РАЗМЕТКЕ, до любого скрипта (Р-Д2-1): прежний
  // `ConsoleTheme` ставил её из `useEffect`, и первый кадр консоли был светлым.
  // `undefined` — атрибута нет вовсе, работает `prefers-color-scheme`.
  // `suppressHydrationWarning`: клиентский `ThemeSync` вправе поменять атрибут
  // раньше, чем React сверит разметку, — это ожидаемое расхождение, не дефект.
  // `data-console` на `.app` — область, а не тема: точечная сетка холста
  // командного центра включается по нему и только в тёмной теме.
  return (
    <html
      lang="ru"
      className={`${golosDisplay.variable} ${golosBody.variable} ${mono.variable}`}
      data-theme={theme ?? undefined}
      suppressHydrationWarning
    >
      <body>
        <Background />
        <div className="app" data-console={isConsole ? "true" : undefined}>
          <header className="hdr">
            <svg className="logo" viewBox="0 0 24 24" aria-hidden>
              <path d="M4 20 12 4l8 16-8-5z" fill="#1A6BFF" />
            </svg>
            <h1>MYDON</h1>
            <span className="sub">· командный центр</span>
            <span className="sp" />
            <HeaderActions pendingCount={inbox} />
          </header>

          <div className="body">
            <Sidebar pendingCount={inbox} />
            <main className="scroll">
              <div className="wrap">{children}</div>
            </main>
          </div>

          <TabBar pendingCount={inbox} />
          <FloatingChat />
          <CommandPalette />
        </div>
      </body>
    </html>
  );
}
```

Примечание для следующей задачи (ThemeSync): компонент вставляется в `<body>` первой строкой, перед `<Background />`; в этой задаче его нет.

### Шаг 8. Тест layout `apps/cc/src/app/layout.test.tsx` (новый файл)

- [ ] Создать ДОСЛОВНО:

```tsx
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
 * `next/headers` ничего не отдаёт.
 */
const mocks = vi.hoisted(() => ({ get: vi.fn<(name: string) => string | null>() }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: mocks.get }) }));
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
```

- [ ] Прогнать: `pnpm --filter @mydon/cc test src/app/layout.test.tsx` — зелёный.

### Шаг 9. Полный прогон и ручная проверка

- [ ] `pnpm --filter @mydon/cc typecheck` — чисто (тесты входят в `include` tsconfig, они тоже типизируются).
- [ ] `pnpm --filter @mydon/cc lint` — чисто.
- [ ] `pnpm --filter @mydon/cc test` — весь набор зелёный; особо: `src/test/palette.test.ts`, `src/test/design-skill.test.ts`, `src/components/agent-grid.test.tsx` (они читают `globals.css` разбором — вставка `color-scheme` их не трогает, но прогнать обязательно).
- [ ] Смок SSR (нужен туннель к Core и `.env.local`, см. рунбук локальной разработки): `pnpm --filter @mydon/cc dev`, затем в другом терминале:
  - `curl -s http://localhost:3000/apps | grep -o '<html[^>]*>'` → содержит `data-theme="dark"`;
  - `curl -s -H 'Cookie: mydon_theme=light' http://localhost:3000/apps | grep -o '<html[^>]*>'` → содержит `data-theme="light"`;
  - `curl -s http://localhost:3000/stock/goods | grep -o '<html[^>]*>'` → атрибута `data-theme` НЕТ;
  - `curl -s http://localhost:3000/apps | grep -o '<meta name="theme-color"[^>]*>'` → одна мета `#111712` без `media`;
  - `curl -s http://localhost:3000/apps | grep -o '<div class="app"[^>]*>'` → содержит `data-console="true"`.
  Без прокси (если файл случайно назван не `src/proxy.ts`) первые две проверки покраснеют — это и есть признак, что прокси не подхватился.
- [ ] Коммит одной задачей: `feat(cc): тема известна серверу — theme.ts, proxy, штамп в layout, color-scheme, themeColor`.

### Ловушка 2 спеки — ответ по дереву

`headers()` в корневом layout делает маршрут динамическим. По манифесту последней сборки (`apps/cc/.next/prerender-manifest.json`, сборка 07.09 15:42, HEAD 15:52) статически отрендерен только `/_global-error`: layout уже сегодня динамический на всех 45 путях, потому что `pendingCount`/`queueCount` ходят в Core через `fetch(..., { cache: "no-store" })` (`lib/core.ts:88-89, 126-127`). Три страницы без `force-dynamic` — `apps/cc/src/app/page.tsx`, `apps/cc/src/app/coffee/page.tsx`, `apps/cc/src/app/vending/page.tsx` — это чистые `redirect()`; они и сейчас динамические, и от `headers()` ничего не меняют. Правок в них не требуется.

## Задача 2: `ThemeSync`, снос `ConsoleTheme`, сторож дрейфа маршрутов (Р-Д2-3, Р-Д2-4)

**Зависимость:** задача 1 выполнена — существует `apps/cc/src/lib/theme.ts` с `THEME_COOKIE`, `CONSOLE_ROUTES`, `isConsoleRoute`, `themeFor`. Задача 3 (layout) может идти до или после: здесь layout правится минимально (импорт + одна строка JSX); если задача 3 уже вставила `<ThemeSync />` — шаг 3 пропустить.

**Что уже проверено автором раздела:** компонент и оба теста прогнаны в песочнице против заглушки `lib/theme.ts` по интерфейсу контроллера — vitest 13/13, `tsc --noEmit` с `exactOptionalPropertyTypes: true`, eslint по корневому `eslint.config.mjs` без замечаний. Восемь мутаций (маршрут в модуль без навыка; в навык без модуля; путь в соседнем буллете — зелёный; перенос списка на третью строку абзаца — зелёный; второй абзац с маркером; маршрут убран из обоих; `<ConsoleTheme />` вернулся на страницу; чужая запись `dataset.theme`; `ThemeSync` выброшен из layout) падают ровно тем ассертом, который для них написан.

Все пути — от корня репо `/Users/js/Developer/mydon`. Команды тестов — из корня: `pnpm --filter cc exec vitest run <файлы>`.

- [ ] **Шаг 0. Перед правками.** Codex работает параллельно на тех же файлах: `git fetch origin && git status --short` и `ls -l apps/cc/src/app/{brain,skills,crons,apps,flows}/page.tsx apps/cc/src/app/layout.tsx` — свежих чужих изменений (mtime за последние минуты, незакоммиченные) быть не должно. Убедиться, что `apps/cc/src/lib/theme.ts` существует и экспортирует четыре имени из зависимости.

- [ ] **Шаг 1. Создать `apps/cc/src/components/theme-sync.tsx`** (дословно):

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { THEME_COOKIE, isConsoleRoute, themeFor } from "../lib/theme";

/**
 * Значение куки темы из `document.cookie` — простой разбор, без библиотек.
 *
 * Возвращается СЫРАЯ строка, а не `ThemeChoice`: что считать законным
 * значением, решает одна функция `themeFor` (общая с middleware), и второй
 * проверки здесь быть не должно — иначе клиент и сервер разошлись бы на
 * первом же новом значении.
 */
function кукаТемы(): string | undefined {
  const ключ = `${THEME_COOKIE}=`;
  for (const часть of document.cookie.split(";")) {
    const пара = часть.trim();
    if (пара.startsWith(ключ)) return пара.slice(ключ.length);
  }
  return undefined;
}

/**
 * Тема при SPA-навигации (срез Д2, Р-Д2-4).
 *
 * Первый кадр держит сервер: middleware кладёт `themeFor(...)` в заголовок,
 * корневой layout ставит `data-theme` на `<html>` и `data-console` на `.app`
 * прямо в разметке. Но корневой layout НЕ ПЕРЕРИСОВЫВАЕТСЯ при переходе между
 * страницами — без этого компонента `data-theme="dark"` с `/apps` остался бы
 * на `/stock`. Поэтому при каждой смене `pathname` те же два атрибута ставятся
 * заново ТЕМ ЖЕ правилом `themeFor`: модуль без серверных импортов, его
 * читают и middleware, и клиент, и правило у них одно.
 *
 * Cleanup'а («вернуть прежнее значение при размонтировании»), который был у
 * прежнего постраничного штампа темы (до Д2 он стоял на пяти страницах и
 * снимал `data-theme` при уходе с них), здесь НЕТ, и это не упущение:
 * компонент стоит в корневом layout один раз и не размонтируется, а нужное
 * значение ставит сам при каждой смене маршрута — восстанавливать нечего и
 * некому. Снимок «прежнего» к тому же врал бы после смены куки
 * переключателем: штамп при уходе со страницы затёр бы явный выбор
 * пользователя устаревшим снимком.
 *
 * `useLayoutEffect`, а не `useEffect`: атрибуты меняются до отрисовки нового
 * экрана, и кадра «новая страница в теме старой» нет. На сервере React 19
 * этот хук не выполняет и не предупреждает.
 */
export function ThemeSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const html = document.documentElement;
    const тема = themeFor(pathname, кукаТемы());
    if (тема === null) delete html.dataset.theme;
    else html.dataset.theme = тема;

    const app = document.querySelector(".app");
    if (app instanceof HTMLElement) {
      if (isConsoleRoute(pathname)) app.dataset.console = "true";
      else delete app.dataset.console;
    }
  }, [pathname]);

  return null;
}
```

  Важно: в докблоке НАМЕРЕННО нет слова `ConsoleTheme` и имени `console-theme` — сторож шага 8 проверяет все текстовые файлы `apps/cc/src`, включая комментарии.

- [ ] **Шаг 2. Создать `apps/cc/src/components/theme-sync.test.tsx`** (дословно):

```tsx
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
```

  Прогнать: `pnpm --filter cc exec vitest run src/components/theme-sync.test.tsx` → `Tests 6 passed (6)`.

- [ ] **Шаг 3. Поставить `ThemeSync` в корневой layout** `apps/cc/src/app/layout.tsx` — две правки.

  Импорт. Было:
```tsx
import { Background } from "../components/bg/background";
import "./globals.css";
```
  Стало:
```tsx
import { Background } from "../components/bg/background";
import { ThemeSync } from "../components/theme-sync";
import "./globals.css";
```

  JSX. Было:
```tsx
      <body>
        <Background />
        <div className="app">
```
  Стало:
```tsx
      <body>
        <Background />
        <ThemeSync />
        <div className="app">
```
  Если задача 3 уже переписала `<html>`/`<body>` — вставить те же две строки в те же места (импорт после `Background`, `<ThemeSync />` сразу после `<Background />`). Строка `import { ThemeSync } from "../components/theme-sync";` и ровно один `<ThemeSync />` проверяются сторожем шага 8 дословно.

- [ ] **Шаг 4. Снять `ConsoleTheme` с пяти страниц.** В каждом файле две правки: убрать строку импорта и строку `<ConsoleTheme />`. Фрагменты `<>…</>` оставить (в каждом ≥ 2 дочерних элемента, правило `jsx-no-useless-fragment` в репо не включено).

  4a. `apps/cc/src/app/brain/page.tsx`. Было:
```tsx
import { BrainGraph } from "../../components/brain-graph";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
```
  Стало:
```tsx
import { BrainGraph } from "../../components/brain-graph";
import { CoreDown } from "../../components/core-down";
```
  Было:
```tsx
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Мозг</h1>
```
  Стало:
```tsx
    <>
      <div className="page-head">
        <h1>Мозг</h1>
```
  И комментарий в докблоке страницы (он утверждал «как `/agents`», что до Д2 было неправдой, а теперь механизм не здесь). Было:
```tsx
 * Тёмная тема: «Мозг» — агентский слой (§4 правил дизайна), как `/skills` и
 * `/agents`, а не бизнес-экран.
 */
```
  Стало:
```tsx
 * Тёмная тема — не отсюда: `/brain` числится в `CONSOLE_ROUTES` (`lib/theme.ts`),
 * атрибут ставят middleware (первый кадр) и `ThemeSync` (SPA-переход).
 */
```

  4b. `apps/cc/src/app/skills/page.tsx`. Было:
```tsx
import { CoreDown } from "../../components/core-down";
import { ConsoleTheme } from "../../components/console-theme";
import { SkillTree } from "../../components/skill-tree";
```
  Стало:
```tsx
import { CoreDown } from "../../components/core-down";
import { SkillTree } from "../../components/skill-tree";
```
  Было:
```tsx
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Навыки</h1>
```
  Стало:
```tsx
    <>
      <div className="page-head">
        <h1>Навыки</h1>
```

  4c. `apps/cc/src/app/crons/page.tsx`. Было:
```tsx
import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import { PauseToggles } from "../../components/pause-toggles";
```
  Стало:
```tsx
import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import { PauseToggles } from "../../components/pause-toggles";
```
  Было:
```tsx
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Рутины</h1>
```
  Стало:
```tsx
    <>
      <div className="page-head">
        <h1>Рутины</h1>
```

  4d. `apps/cc/src/app/apps/page.tsx`. Было:
```tsx
import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import {
  core,
```
  Стало:
```tsx
import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import {
  core,
```
  Было:
```tsx
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Приложения</h1>
```
  Стало:
```tsx
    <>
      <div className="page-head">
        <h1>Приложения</h1>
```
  И комментарий в докблоке. Было:
```tsx
 * Тёмная тема: это системный экран агентского слоя (§4 правил дизайна), как
 * `/crons`, `/flows` и `/skills`, а не бизнес-экран.
 */
```
  Стало:
```tsx
 * Тёмная тема — не отсюда: `/apps` числится в `CONSOLE_ROUTES` (`lib/theme.ts`),
 * атрибут ставят middleware (первый кадр) и `ThemeSync` (SPA-переход).
 */
```

  4e. `apps/cc/src/app/flows/page.tsx`. Было:
```tsx
import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import { FlowStrip } from "../../components/flow-strip";
```
  Стало:
```tsx
import Link from "next/link";
import { CoreDown } from "../../components/core-down";
import { FlowStrip } from "../../components/flow-strip";
```
  Было:
```tsx
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Прогоны</h1>
```
  Стало:
```tsx
    <>
      <div className="page-head">
        <h1>Прогоны</h1>
```

- [ ] **Шаг 5. Удалить компонент:** `git rm apps/cc/src/components/console-theme.tsx`.

- [ ] **Шаг 6. Два комментария, отсылающих к снесённому компоненту** (иначе сторож шага 8 красный, и следующий автор пойдёт искать несуществующий механизм).

  6a. `apps/cc/src/app/globals.css` (строки 1804–1806). Было:
```css
/* ── «Мозг»: граф знаний (R-M-6) ──
   Все цвета — токенами, поэтому в ветки темы правила не дублируются: экран
   тёмный не сам по себе, а через `data-theme="dark"` от <ConsoleTheme/>. */
```
  Стало:
```css
/* ── «Мозг»: граф знаний (R-M-6) ──
   Все цвета — токенами, поэтому в ветки темы правила не дублируются: экран
   тёмный не сам по себе, а через `data-theme="dark"` на <html> — его ставят
   middleware и ThemeSync по списку CONSOLE_ROUTES (lib/theme.ts). */
```

  6b. `apps/cc/src/components/brain-graph.tsx` (строки 559–560, внутри докблока у `themeWatcher`). Было:
```tsx
     * Слушаем оба источника: `data-theme` на <html> (явный выбор,
     * <ConsoleTheme/>) и системную настройку.
     */
```
  Стало:
```tsx
     * Слушаем оба источника: `data-theme` на <html> (его ставят middleware и
     * `ThemeSync` — областной дефолт либо явный выбор из куки) и системную
     * настройку.
     */
```

- [ ] **Шаг 7. Абзац-маркер в `rules.md` §4 — в ТРЁХ файлах одинаково:** `.claude/skills/mydon-design/rules.md`, `.agents/skills/mydon-design/rules.md`, `docs/agentic-os-starter/claude-skills/mydon-design/rules.md` (зеркала обязаны совпадать байт-в-байт — `design-skill.test.ts`). §9 НЕ трогать (его чистит задача 5; существующий тест §9 пока ждёт там `/artifacts` и `ConsoleTheme`). Было (сразу под заголовком `## 4. Грамматика командного центра (агентский слой)`):
```md
Маршрутный список ниже **разошёлся с кодом** (§9, долг среза Д2). Правила действуют на любом экране
агентского слоя независимо от того, тёмный он сегодня или светлый.

Для `/mydon`, `/agents`, `/crons`, `/flows`, `/skills`, `/brain`, `/artifacts`:
```
  Стало:
```md
Маршрутный список ниже — копия данных из кода: сторож `apps/cc/src/test/theme-routes.test.ts` роняет
сборку, когда копия и данные расходятся в любую сторону. Правила действуют на любом экране агентского
слоя независимо от того, тёмный он сегодня или светлый.

Маршруты командного центра — `CONSOLE_ROUTES` в `apps/cc/src/lib/theme.ts`:
`/mydon`, `/agents`, `/crons`, `/flows`, `/skills`, `/brain`, `/docs`, `/apps`. Для них:
```
  Следующая строка `- тёмная тема по умолчанию (…)` остаётся как есть. Проверить зеркала: `diff -q .claude/skills/mydon-design/rules.md .agents/skills/mydon-design/rules.md && diff -q .claude/skills/mydon-design/rules.md docs/agentic-os-starter/claude-skills/mydon-design/rules.md` — обе команды молчат.

- [ ] **Шаг 8. Создать `apps/cc/src/test/theme-routes.test.ts`** (дословно):

```ts
// @vitest-environment node
//
// Только чтение файлов, без DOM: под jsdom (общий environment пакета)
// относительные пути резолвятся от window.location, а не от файла теста, и
// readFileSync падает ENOENT (тот же приём, что в `lib/state.test.ts`).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONSOLE_ROUTES } from "../lib/theme";

/**
 * Сторожа механизма темы (срез Д2, Р-Д2-3 и Р-Д2-4).
 *
 * Список маршрутов командного центра — ДАННЫЕ в `lib/theme.ts`; навык
 * `mydon-design` §4 печатает его копию, потому что автор нового экрана читает
 * навык, а не модуль. Две копии расходятся молча: до Д2 §4 называл `/mydon` и
 * `/agents` тёмными (они были светлыми) и `/artifacts` (маршрута не было).
 * Здесь копия сверяется с данными в обе стороны.
 *
 * МАРКЕР — абзац §4, в котором стоит подстрока `` `CONSOLE_ROUTES` ``, и он в
 * §4 ровно один. Тест держится за имя константы, а не за прозу вокруг:
 * §4 можно переписывать, не трогая тест, — пока маршруты стоят в абзаце
 * маркера (сама строка маркера плюс её переносы до пустой строки, списка или
 * заголовка), а прочие пути `/…` в обратных кавычках — в других абзацах.
 *
 * Зеркала навыка (`.agents/skills`, `docs/agentic-os-starter`) отдельно не
 * сверяются: их дословное равенство с `.claude/skills` уже держит
 * `design-skill.test.ts`.
 */

const СРЦ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const КОРЕНЬ = path.resolve(СРЦ, "../../..");
const ПРАВИЛА = path.join(КОРЕНЬ, ".claude/skills/mydon-design/rules.md");
const МАРКЕР = "`CONSOLE_ROUTES`";

/** Текст §4 навыка — от его заголовка до заголовка §5. */
function раздел4(): string {
  const текст = readFileSync(ПРАВИЛА, "utf8");
  const от = текст.indexOf("\n## 4. ");
  const до = текст.indexOf("\n## 5. ");
  expect(от, "в rules.md нет §4").toBeGreaterThan(-1);
  expect(до, "в rules.md нет §5 после §4").toBeGreaterThan(от);
  return текст.slice(от, до);
}

/** Абзац маркера: строка с `CONSOLE_ROUTES` и её переносы. */
function абзацМаркера(): string {
  const строки = раздел4().split("\n");
  const начала = строки.flatMap((строка, i) => (строка.includes(МАРКЕР) ? [i] : []));
  expect(начала, `в §4 rules.md должна быть ровно одна строка с ${МАРКЕР}`).toHaveLength(1);
  const от = начала[0] ?? 0;
  let до = от + 1;
  while (до < строки.length) {
    const строка = строки[до] ?? "";
    if (строка.trim() === "" || /^[-#|*]/.test(строка)) break;
    до += 1;
  }
  return строки.slice(от, до).join("\n");
}

/** Текстовые файлы под `src`, кроме тестов: путь относительно `src`. */
function исходники(dir: string): string[] {
  const out: string[] = [];
  for (const имя of readdirSync(dir)) {
    const полный = path.join(dir, имя);
    if (statSync(полный).isDirectory()) {
      out.push(...исходники(полный));
      continue;
    }
    if (!/\.(tsx?|css|mjs|js|md)$/.test(имя)) continue;
    if (/\.test\.tsx?$/.test(имя)) continue;
    out.push(path.relative(СРЦ, полный));
  }
  return out;
}

const текст = (rel: string): string => readFileSync(path.join(СРЦ, rel), "utf8");

describe("маршруты командного центра: модуль и навык не расходятся (Р-Д2-3)", () => {
  it("список в абзаце маркера совпадает с CONSOLE_ROUTES в обе стороны", () => {
    const вНавыке = [...абзацМаркера().matchAll(/`(\/[a-z][a-z0-9-]*)`/g)].map((m) => m[1] ?? "");
    expect(вНавыке.length, "в абзаце маркера нет ни одного маршрута").toBeGreaterThan(0);
    // Сравнение отсортированными списками: порядок в прозе — дело автора,
    // состав — нет. Дубль в любой из копий тоже краснеет: длины разойдутся.
    expect([...вНавыке].sort()).toEqual([...CONSOLE_ROUTES].sort());
  });

  it("модуль знает решение владельца: командный центр тёмный по умолчанию", () => {
    // Состав, а не только равенство копий: две одинаково пустые копии прошли
    // бы тест выше. Восемь маршрутов — спека Д2 §1.1; девятый (`/artifacts`,
    // срез A3) сюда не добавлять, он добавится в модуль и навык одной правкой.
    for (const маршрут of ["/mydon", "/agents", "/crons", "/flows", "/skills", "/brain", "/docs", "/apps"]) {
      expect(CONSOLE_ROUTES, `в CONSOLE_ROUTES нет ${маршрут}`).toContain(маршрут);
    }
  });
});

describe("ConsoleTheme снесён, тему при навигации держит ThemeSync (Р-Д2-4)", () => {
  it("файла console-theme.tsx больше нет", () => {
    expect(existsSync(path.join(СРЦ, "components", "console-theme.tsx"))).toBe(false);
  });

  it("в apps/cc/src нет ни одного упоминания ConsoleTheme и console-theme", () => {
    // По ВСЕМ текстовым файлам, включая CSS и комментарии: комментарий,
    // отсылающий к снесённому компоненту, отправит следующего автора искать
    // несуществующий механизм. Ищется и имя компонента, и имя файла — импорт
    // мог бы пережить переименование экспорта.
    const лишние = исходники(СРЦ).filter((rel) => /ConsoleTheme|console-theme/.test(текст(rel)));
    expect(лишние, `ручной штамп темы ещё упоминается:\n${лишние.join("\n")}`).toEqual([]);
  });

  it("ThemeSync стоит в корневом layout ровно один раз", () => {
    const layout = текст(path.join("app", "layout.tsx"));
    expect(layout).toContain('import { ThemeSync } from "../components/theme-sync";');
    expect(layout.match(/<ThemeSync \/>/g) ?? []).toHaveLength(1);
  });

  it("data-theme на клиенте пишет только ThemeSync", () => {
    // Штамп на странице — второй писатель атрибута рядом с ThemeSync, и они
    // дрались бы при SPA-переходе ровно так, как дрались бы ConsoleTheme и
    // серверный штамп. Ловится прямая запись атрибута где угодно, кроме
    // самого ThemeSync; чтение (`brain-graph.tsx` слушает его
    // MutationObserver'ом) под запрет не попадает.
    const лишние = исходники(СРЦ).filter((rel) => {
      if (rel === path.join("components", "theme-sync.tsx")) return false;
      if (!/\.tsx?$/.test(rel)) return false;
      return /dataset\.theme\s*=|setAttribute\(\s*["']data-theme["']/.test(текст(rel));
    });
    expect(лишние, `data-theme пишут мимо ThemeSync:\n${лишние.join("\n")}`).toEqual([]);
  });

  it("theme-sync.tsx — клиентский и без серверных модулей", () => {
    // Компонент делит `lib/theme` с middleware: `next/headers` или
    // `server-only` в этой цепочке уронили бы клиентскую сборку.
    const код = текст(path.join("components", "theme-sync.tsx"));
    expect(код.startsWith('"use client";')).toBe(true);
    expect(код).not.toMatch(/next\/headers|server-only/);
  });
});
```

  Прогнать: `pnpm --filter cc exec vitest run src/test/theme-routes.test.ts` → `Tests 7 passed (7)`. Если красный «ручной штамп темы ещё упоминается» — в выводе список файлов: это пропущенный шаг 4 или 6.

- [ ] **Шаг 9. Проверки перед коммитом** (все из корня репо; все обязаны быть зелёными):
```bash
grep -rn "ConsoleTheme\|console-theme" apps/cc/src            # пусто
pnpm --filter cc exec vitest run src/components/theme-sync.test.tsx src/test/theme-routes.test.ts \
  src/test/design-skill.test.ts src/lib/state.test.ts src/test/state-weight.test.tsx \
  src/app/brain/page.test.tsx src/app/crons/page.test.tsx src/app/apps/page.test.tsx src/app/flows/page.test.tsx
pnpm --filter cc test                                           # весь пакет
pnpm --filter cc typecheck                                      # если жалуется на удалённый console-theme — `pnpm --filter cc clean` (кеш .next) и повторить
pnpm --filter cc lint
diff -q .claude/skills/mydon-design/rules.md .agents/skills/mydon-design/rules.md
diff -q .claude/skills/mydon-design/rules.md docs/agentic-os-starter/claude-skills/mydon-design/rules.md
```
  Ручная приёмка (Р-Д2-4), если поднят dev-сервер (`pnpm --filter cc dev` + туннель к core): открыть `/apps` (тёмный, у `.app` есть `data-console="true"`), кликнуть в меню на бизнес-экран (например «Реестр» `/registry`) — `<html>` без `data-theme`, `.app` без `data-console`, без перезагрузки; назад на `/crons` — снова `dark` и `data-console`. В DevTools → Application → Cookies поставить `mydon_theme=light`, перейти на `/skills` — светлый.

- [ ] **Шаг 10. Коммит** (одним коммитом, ветка задачи, не main):
```
feat(cc): ThemeSync вместо постраничного штампа темы — тема держится при SPA-переходе, сторож дрейфа маршрутов (Д2, Р-Д2-3/Р-Д2-4)

- components/theme-sync.tsx: по usePathname ставит data-theme на <html> и data-console на .app тем же themeFor, что middleware; без cleanup — стоит в корневом layout и не размонтируется
- console-theme.tsx удалён вместе с пятью вызовами (/brain, /skills, /crons, /apps, /flows); комментарии в globals.css и brain-graph.tsx переписаны
- rules.md §4 (три копии): абзац-маркер CONSOLE_ROUTES вместо расходившегося списка
- test/theme-routes.test.ts: дрейф модуль↔навык в обе стороны, grep-сторож ConsoleTheme, единственный писатель data-theme, ThemeSync в layout ровно один раз
```
  Трейлеры коммита — по конвенции сессии исполнителя (`Co-Authored-By: …`).

## Задача 3: server action `setTheme` и переключатель темы в шапке

**Выполнять после Задач 1 и 2** (нужны `apps/cc/src/lib/theme.ts` с `THEME_COOKIE`/`ThemeChoice` и правки корневого layout; здесь layout правится точечно, строки импортов — сливать).

Все пути — от корня репозитория `/Users/js/Developer/mydon`. Команды — из корня. Порядок каждого шага: сначала тест (красный), потом код (зелёный).

### Два решения, принятых в этой задаче

**Откуда переключатель узнаёт текущее состояние — из пропса layout, а пропс — из КУКИ (`cookies()`), не из заголовка и не из `document.documentElement.dataset.theme`.** Оба предложенных источника несут ФАКТИЧЕСКУЮ тему: на `/apps` без куки `<html data-theme="dark">` и заголовок `x-mydon-theme: dark`, а выбор владельца при этом — «как в системе». Переключатель, показывающий «тёмная», утверждал бы, что владелец её выбирал. Единственный носитель выбора — кука `mydon_theme`; её читает корневой layout (`cookies()` — он и так динамический после `headers()` из Задачи 2) и передаёт пропсом. Пропс с сервера ещё и не мигает: контрол верен уже в серверной разметке, а чтение `document.cookie` при монтировании дало бы первый кадр «как в системе» и расхождение гидрации.

**Контрол — родной `<select>` с тремя словами, а не три чипа рядом.** Арифметика шапки на 390px (чек-лист навыка требует её для строк со словами): полезных 362px (`.hdr` padding 14+14); лого 26 + «MYDON» ≈62 + три кнопки по 34 + 6 промежутков `gap: 10px` = 250px; контролу остаётся ~112px. Три чипа «как в системе» · «светлая» · «тёмная» — это ~255px, и `.hdr h1` (`overflow: hidden; text-overflow: ellipsis`) ушёл бы в «MYD…». Свёрнутый `<select>` показывает одно слово текущего состояния (~103px без родной стрелки, `appearance: none`), развёрнутый — все три слова. Раскрытый список красит браузер по `color-scheme` корня (Задача 1), свёрнутый — токенами `--surf`/`--tx-2`/`--line`, объявленными в трёх ветках палитры: в этом и состоит «читается в обеих темах». Тумблер фона (`localStorage "mydon_bg"`, `components/bg/background.tsx`) не трогается — переключатель темы стоит справа от него, в той же 34-пиксельной рамке.

Ловушка `<select>`: на повторный выбор уже выбранного значения он не шлёт `change`. Поэтому при отказе action показывается кнопка «{ошибка} · повторить» — это роль кнопки отправки формы из правила §7 («поля сохраняют ввод»): выбор остаётся в контроле, ошибка видна, повтор возможен.

Идентификаторы — английские, комментарии — русские, как в соседних `header-actions.tsx`/`customs-rates.tsx`.

---

### 3.1. Тест server action (красный)

- [ ] Создать `apps/cc/src/app/theme/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeChoice } from "../../lib/theme";
import { setTheme } from "./actions";

/*
 * `next/headers` вне request-скоупа не работает — глушим фабрикой, как
 * `lib/owner.test.ts`; `next/cache` — как `tasks/actions.test.ts`. Через
 * `mocks.set`/`mocks.delete` видно, ЧТО action попросил у хранилища куки.
 */
const mocks = vi.hoisted(() => ({
  set: vi.fn<(name: string, value: string, attrs: Record<string, unknown>) => void>(),
  delete: vi.fn<(options: { name: string; path: string }) => void>(),
  revalidatePath: vi.fn<(path: string, type: "layout" | "page") => void>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.set, delete: mocks.delete }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

/** Атрибуты куки — ровно те, что требует спека Д2 §1.2: Path=/, SameSite=Lax, год. */
const COOKIE_ATTRS = { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 };

describe("setTheme — кука выбора темы (Р-Д2-2, Р-Д2-6)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("«тёмная» пишет mydon_theme=dark с Path=/, SameSite=Lax на год и перерисовывает корневой layout", async () => {
    await expect(setTheme("dark")).resolves.toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith("mydon_theme", "dark", COOKIE_ATTRS);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("«светлая» пишет mydon_theme=light с теми же атрибутами", async () => {
    await expect(setTheme("light")).resolves.toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith("mydon_theme", "light", COOKIE_ATTRS);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("«как в системе» удаляет куку по тому же Path и ничего не пишет", async () => {
    await expect(setTheme("system")).resolves.toEqual({ ok: true });
    expect(mocks.delete).toHaveBeenCalledWith({ name: "mydon_theme", path: "/" });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("кука не httpOnly и не secure: её читает ThemeSync из document.cookie, а панель живёт по http", async () => {
    await setTheme("dark");
    const attrs = mocks.set.mock.calls[0]?.[2];
    expect(attrs).toBeDefined();
    expect(attrs).not.toHaveProperty("httpOnly");
    expect(attrs).not.toHaveProperty("secure");
  });

  it("чужое значение отбивается словами: куку не трогает, layout не перерисовывает", async () => {
    // Тип не защищает: server action — публичная точка входа, с клиента
    // может прийти любая строка.
    await expect(setTheme("blue" as unknown as ThemeChoice)).resolves.toEqual({
      ok: false,
      message: "Неизвестная тема",
    });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("сбой хранилища куки → ok:false с текстом причины, без перерисовки", async () => {
    mocks.set.mockImplementation(() => {
      throw new Error("cookies() вне запроса");
    });
    await expect(setTheme("light")).resolves.toEqual({ ok: false, message: "cookies() вне запроса" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] Запустить `pnpm --filter @mydon/cc test src/app/theme/actions.test.ts` — красный (модуля `./actions` нет).

### 3.2. Server action (зелёный)

- [ ] Создать `apps/cc/src/app/theme/actions.ts` (каталог `app/theme/` без `page.tsx` — маршрута `/theme` не появится, Next маршрутизирует только `page`/`route`):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, type ThemeChoice } from "../../lib/theme";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Срок куки темы — год (спека Д2 §1.2). Секундами, потому что `maxAge` у
 * `cookies().set` в секундах; `expires` не задаём — при обоих полях браузер
 * берёт `maxAge`, второе значение только вводило бы в заблуждение.
 * НЕ экспортировать: из файла с "use server" наружу уходят только async-функции.
 */
const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Значения, которые action вообще готов принять; всё остальное — чужой ввод. */
const ALLOWED: ReadonlySet<string> = new Set(["light", "dark", "system"]);

/**
 * Запомнить выбор темы. `light`/`dark` — кука `mydon_theme` на год; `system` —
 * куки нет вовсе: «как в системе» = отсутствие явного выбора, и хранить его
 * отдельным значением значило бы завести третье состояние, которого
 * `themeFor` в middleware не знает.
 *
 * Кука НЕ httpOnly и НЕ secure намеренно: её читает клиентский `ThemeSync`
 * через `document.cookie` при SPA-переходе, а панель живёт по http за
 * Tailscale — `Secure` отрезал бы куку целиком.
 *
 * Server action — публичная точка входа: значение приходит с клиента и может
 * быть любым, тип `ThemeChoice | "system"` этого не гарантирует. Чужое
 * значение отбиваем ДО записи, иначе в куке оказалась бы строка, которую
 * `themeFor` считает «нет куки», а переключатель — «выбрано».
 */
export async function setTheme(choice: ThemeChoice | "system"): Promise<ActionResult> {
  if (!ALLOWED.has(choice)) {
    return { ok: false, message: "Неизвестная тема" };
  }
  try {
    const store = await cookies();
    if (choice === "system") {
      // Path тот же, что при записи: браузер сопоставляет куки по паре
      // имя+путь, и удаление без пути могло бы не найти куку с `Path=/`.
      store.delete({ name: THEME_COOKIE, path: "/" });
    } else {
      store.set(THEME_COOKIE, choice, { path: "/", sameSite: "lax", maxAge: YEAR_SECONDS });
    }
    // Корневой layout ставит `data-theme` на <html> из заголовка middleware —
    // перерисовать нужно именно его, а не страницу.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Не удалось сохранить тему" };
  }
}
```

- [ ] `pnpm --filter @mydon/cc test src/app/theme/actions.test.ts` — 6 зелёных.

### 3.3. Тест переключателя (красный)

- [ ] Создать `apps/cc/src/components/header-actions.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ВЕТКИ, палитраБлока, последнееПравило, стилиПанели } from "../test/css";
import { HeaderActions } from "./header-actions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setTheme: vi.fn<(choice: string) => Promise<{ ok: boolean; message?: string }>>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../app/theme/actions", () => ({ setTheme: mocks.setTheme }));

/** `<select>` без multiple — роль combobox; имя — из aria-label. */
const themeSwitch = (): HTMLSelectElement => screen.getByRole<HTMLSelectElement>("combobox", { name: "Тема" });

describe("переключатель темы в шапке (Р-Д2-6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("три состояния словами; текущее — из пропса layout, а не из data-theme", () => {
    // На /apps без куки <html data-theme="dark">, а выбор — «как в системе»:
    // контрол обязан показать ВЫБОР, не фактическую тему.
    document.documentElement.dataset.theme = "dark";
    render(<HeaderActions pendingCount={0} themeChoice="system" />);
    const sw = themeSwitch();
    expect(sw).toHaveValue("system");
    expect([...sw.options].map((o) => o.textContent)).toEqual(["как в системе", "светлая", "тёмная"]);
    delete document.documentElement.dataset.theme;
  });

  it("выбор «светлая» зовёт setTheme('light') и обновляет страницу; mydon_bg не трогает", async () => {
    mocks.setTheme.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<HeaderActions pendingCount={0} themeChoice="system" />);

    await user.selectOptions(themeSwitch(), "light");

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(themeSwitch()).toHaveValue("light");
    expect(screen.queryByRole("button", { name: /повторить/ })).toBeNull();
    // Фон остаётся своим тумблером с localStorage `mydon_bg` — тема туда не пишет.
    expect(localStorage.getItem("mydon_bg")).toBeNull();
  });

  it("отказ action: ошибка показана, выбор не потерян, страница не обновляется; «повторить» зовёт action снова", async () => {
    mocks.setTheme.mockResolvedValue({ ok: false, message: "Тема не сохранилась" });
    const user = userEvent.setup();
    render(<HeaderActions pendingCount={0} themeChoice="system" />);

    await user.selectOptions(themeSwitch(), "dark");

    const retry = await screen.findByRole("button", { name: "Тема не сохранилась · повторить" });
    expect(retry).toBeVisible();
    expect(themeSwitch()).toHaveValue("dark");
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.setTheme.mockResolvedValue({ ok: true });
    await user.click(retry);

    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /повторить/ })).toBeNull();
  });

  it("сервер побеждает: новый пропс после refresh переставляет контрол", () => {
    // Инициализатор useState выполняется один раз (ловушка App Router):
    // без синхронизации с пропсом кука, изменённая в другой вкладке, не
    // отразилась бы здесь никогда.
    const { rerender } = render(<HeaderActions pendingCount={0} themeChoice="system" />);
    rerender(<HeaderActions pendingCount={0} themeChoice="light" />);
    expect(themeSwitch()).toHaveValue("light");
  });
});

describe("переключатель читается в обеих темах (сторож globals.css)", () => {
  it("правило .hdr .theme-sw есть и красит контрол только токенами, объявленными во всех трёх ветках", () => {
    const rule = последнееПравило(стилиПанели, ".hdr .theme-sw");
    expect(rule, "в globals.css нет правила .hdr .theme-sw").not.toBeNull();
    const body = rule?.тело ?? "";
    // Ни одного литерала цвета: только так тема не «протекает» (чек-лист навыка).
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    const used = [...body.matchAll(/var\((--[a-z0-9-]+)\)/gi)].map((m) => m[1] ?? "");
    expect(used).toEqual(expect.arrayContaining(["--surf", "--tx-2", "--line"]));
    for (const ветка of ВЕТКИ) {
      const палитра = палитраБлока(стилиПанели, ветка);
      for (const token of ["--surf", "--tx-2", "--line"]) {
        expect(палитра.get(token), `${token} не объявлен в блоке «${ветка.имя}»`).toBeDefined();
      }
    }
  });

  it("стрелка родного select убрана — иначе контрол не влезает в шапку 390px", () => {
    expect(последнееПравило(стилиПанели, ".hdr .theme-sw")?.тело).toMatch(/appearance\s*:\s*none/);
  });
});

describe("корневой layout передаёт выбор темы из куки", () => {
  // Сторожим сам файл: рендер RootLayout в jsdom тянет next/font/local и Core.
  const layout = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app/layout.tsx"),
    "utf8",
  ).replace(/\s+/g, " ");

  it("выбор читается из cookies().get(THEME_COOKIE), а не из заголовка, и уходит в HeaderActions пропсом", () => {
    expect(layout).toContain("(await cookies()).get(THEME_COOKIE)?.value");
    expect(layout).toContain("<HeaderActions pendingCount={inbox} themeChoice={themeChoice} />");
  });
});
```

- [ ] `pnpm --filter @mydon/cc test src/components/header-actions.test.tsx` — красный.

### 3.4. Переключатель в шапке (зелёный, часть 1)

- [ ] Заменить `apps/cc/src/components/header-actions.tsx` целиком:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ThemeChoice } from "../lib/theme";
import { setTheme } from "../app/theme/actions";
import { Ic } from "./icons";

/** Выбор темы, как его хранит кука: явная светлая/тёмная или «куки нет». */
type ThemeSetting = ThemeChoice | "system";

/**
 * Три состояния — СЛОВАМИ, не иконками: правило среза Д1 (цвет и форма не
 * единственные носители смысла), и переключатель темы обязан читаться в
 * обеих темах. Порядок — от «ничего не выбирал» к явному выбору.
 */
const THEME_OPTIONS: readonly { value: ThemeSetting; word: string }[] = [
  { value: "system", word: "как в системе" },
  { value: "light", word: "светлая" },
  { value: "dark", word: "тёмная" },
];

/** Сужение без `as`: `<select>` отдаёт строку, а action принимает три слова. */
function isThemeSetting(value: string): value is ThemeSetting {
  return THEME_OPTIONS.some((o) => o.value === value);
}

/**
 * Кнопки шапки: поиск, фон, тема, решения. Фон общается с Background событиями
 * и помнит выбор в localStorage `mydon_bg` — тема сюда НЕ переезжает: её
 * читает сервер (кука), чтобы первый кадр уже был нужного цвета.
 *
 * Текущий выбор темы приходит ПРОПСОМ из корневого layout (кука через
 * `cookies()`), а не из `document.documentElement.dataset.theme` и не из
 * заголовка `x-mydon-theme`: оба несут ФАКТИЧЕСКУЮ тему — на /apps без куки
 * это «dark», — а переключатель обязан показывать ВЫБОР («как в системе»),
 * иначе он утверждал бы, что владелец выбирал тёмную. Пропс с сервера ещё и
 * не мигает: контрол верен уже в серверной разметке.
 *
 * Родной `<select>`, а не три чипа: на 390px после лого, «MYDON» и трёх
 * кнопок контролу остаётся ~112px, три слова чипами — ~255px (расчёт в
 * globals.css у правила `.hdr .theme-sw`).
 */
export function HeaderActions({
  pendingCount,
  themeChoice,
}: {
  pendingCount: number;
  themeChoice: ThemeSetting;
}) {
  const router = useRouter();
  const [bgOn, setBgOn] = useState(false);
  const [choice, setChoice] = useState<ThemeSetting>(themeChoice);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = (e: Event) => setBgOn(Boolean((e as CustomEvent).detail));
    window.addEventListener("mydon:bg-state", sync);
    return () => window.removeEventListener("mydon:bg-state", sync);
  }, []);

  /**
   * Инициализатор `useState` выполняется один раз (ловушка App Router, та же,
   * что у тумблеров пауз): после `router.refresh()` layout приносит новый
   * пропс, и контрол обязан перестроиться под сервер — иначе кука, изменённая
   * в другой вкладке, здесь не отразится никогда. При отказе action пропс не
   * меняется, и оптимистичный выбор остаётся на месте.
   */
  useEffect(() => setChoice(themeChoice), [themeChoice]);

  function apply(next: ThemeSetting) {
    // Выбор — в состояние ДО ответа сервера и независимо от него: при отказе
    // контрол показывает то, что владелец выбрал, плюс ошибку (правило форм
    // §7: «поля сохраняют ввод»).
    setChoice(next);
    start(async () => {
      const res = await setTheme(next);
      if (res.ok) {
        setError(null);
        router.refresh();
      } else {
        setError(res.message ?? "Не получилось");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="iconbtn"
        aria-label="Найти карточку или отчёт (⌘K)"
        title="Найти карточку или отчёт  ⌘K"
        onClick={() => window.dispatchEvent(new CustomEvent("mydon:palette-open"))}
      >
        <Ic name="search" />
      </button>
      <button
        type="button"
        className={`iconbtn ${bgOn ? "on" : ""}`}
        aria-label="Фон: небо над Ташкентом"
        onClick={() => window.dispatchEvent(new CustomEvent("mydon:bg-toggle"))}
      >
        <Ic name="sky" />
      </button>
      <select
        className="theme-sw"
        aria-label="Тема"
        title="Тема панели"
        value={choice}
        disabled={pending}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isThemeSetting(next)) apply(next);
        }}
      >
        {THEME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.word}
          </option>
        ))}
      </select>
      {/* `<select>` не шлёт change на уже выбранное значение — повтор нужен
          отдельной кнопкой; это роль кнопки отправки формы. */}
      {error && (
        <button type="button" className="theme-retry err-text" title={error} onClick={() => apply(choice)}>
          {error} · повторить
        </button>
      )}
      <Link href="/inbox" className="iconbtn" aria-label="Входящие">
        <Ic name="bell" />
        {pendingCount > 0 && <span className="cnt">{pendingCount}</span>}
      </Link>
    </>
  );
}
```

### 3.5. Стили переключателя (зелёный, часть 2)

- [ ] В `apps/cc/src/app/globals.css` найти строку (сейчас 261):

```css
.iconbtn.on { color: var(--accent); border-color: var(--accent-line); background: var(--accent-soft); }
```

  и СРАЗУ ПОСЛЕ неё (перед пустой строкой и `.body { … }`) вставить:

```css
/* Переключатель темы — родной <select>, а не три чипа рядом. Арифметика
   390px: полезных 362px; лого 26 + «MYDON» ≈62 + три кнопки по 34 +
   6 промежутков по 10 = 250, контролу остаётся ~112. Три слова чипами
   («как в системе» · «светлая» · «тёмная») — ~255px, «MYDON» ушёл бы в
   многоточие. Свёрнутый select — одно слово текущего состояния, ~103px без
   родной стрелки (`appearance: none`); развёрнутый — все три. Цвета только
   токенами — контрол обязан читаться в ОБЕИХ темах; раскрытый список красит
   браузер по `color-scheme` корня. Новых токенов нет. */
.hdr .theme-sw {
  height: 34px; flex: 0 0 auto; padding: 0 8px; appearance: none;
  border: 1px solid var(--line); border-radius: var(--r-s); background: var(--surf); color: var(--tx-2);
  font-size: 12px; font-weight: 600; cursor: pointer;
}
.hdr .theme-sw:hover, .hdr .theme-sw:focus-visible { color: var(--tx); border-color: var(--accent-line); }
.hdr .theme-sw:disabled { opacity: 0.55; cursor: default; }
/* Отказ action: выбор остаётся в контроле (§7), «повторить» — роль кнопки
   отправки формы, потому что select не шлёт change на уже выбранное. На
   телефоне длинное сообщение режется многоточием, полный текст — в title. */
.hdr .theme-retry {
  background: none; border: 0; padding: 0; font-size: 12px; cursor: pointer; text-decoration: underline;
  max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
```

  Цвет «повторить» даёт существующий `.err-text` (`color: var(--err)`); `.hdr .theme-retry` специфичнее и переопределяет только размер.

### 3.6. Проп из корневого layout (зелёный, часть 3)

- [ ] В `apps/cc/src/app/layout.tsx` — три правки. Файл одновременно правит Задача 2; строки импортов СЛИВАТЬ (один `import … from "next/headers"`, один `import … from "../lib/theme"`), не дублировать.

  (а) Импорты. После строки `import localFont from "next/font/local";` должно стоять:

```ts
import { cookies } from "next/headers";
```

  Если после Задачи 2 уже есть `import { headers } from "next/headers";` — заменить её на `import { cookies, headers } from "next/headers";`.

  После строки `import { core } from "../lib/core";` должно стоять:

```ts
import { THEME_COOKIE, type ThemeChoice } from "../lib/theme";
```

  Если строка импорта из `"../lib/theme"` уже есть — добавить в неё `THEME_COOKIE` и `type ThemeChoice`.

  (б) В `RootLayout` сразу после строки `const inbox = pending + queue;` добавить:

```ts
  // Выбор темы для переключателя — из КУКИ, не из заголовка `x-mydon-theme`:
  // заголовок несёт фактическую тему (на /apps без куки это «dark»), а
  // переключатель показывает ВЫБОР — «как в системе» там законно. Кука —
  // единственный носитель выбора; чужое значение считаем отсутствием выбора,
  // ровно как `themeFor` в middleware.
  const rawTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const themeChoice: ThemeChoice | "system" = rawTheme === "light" || rawTheme === "dark" ? rawTheme : "system";
```

  (в) Строку `<HeaderActions pendingCount={inbox} />` заменить на:

```tsx
            <HeaderActions pendingCount={inbox} themeChoice={themeChoice} />
```

- [ ] `pnpm --filter @mydon/cc test src/components/header-actions.test.tsx src/app/theme/actions.test.ts` — все зелёные.

### 3.7. Полный прогон и ручная проверка

- [ ] `pnpm --filter @mydon/cc typecheck && pnpm --filter @mydon/cc lint && pnpm --filter @mydon/cc test` — зелёные (в частности `test/palette.test.ts`: токенов не добавлено, две тёмные ветки не тронуты).
- [ ] Руками в dev (`pnpm --filter @mydon/cc dev`, по памяти проекта — с SSH-туннелем 3001 к Core): на `/stock` выбрать «тёмная» → в DevTools `document.cookie` содержит `mydon_theme=dark`, `<html data-theme="dark">` появился БЕЗ перезагрузки; перейти на `/apps`, выбрать «как в системе» → куки нет, `/apps` тёмный, `/stock` без атрибута; выбрать «светлая» на `/apps` → `<html data-theme="light">`. Ширина 390px: «MYDON» не обрезан, переключатель виден, страница не скроллится вбок. Обе темы: слово в контроле читается.
- [ ] Если после успешного action `<html data-theme>` НЕ меняется без перезагрузки — дефект не здесь: React перерисовывает `<html>` при обновлении корневого layout по `router.refresh()`; чинить в `ThemeSync` (Задача 2), не дублируя запись атрибута в переключатель. Записать в план как вопрос.

### 3.8. Проверка откатом — каждый ассерт должен покраснеть

- [ ] Убрать `revalidatePath("/", "layout")` из `setTheme` → `actions.test.ts` красный (3 теста).
- [ ] Заменить `sameSite: "lax"` на `"strict"`, `maxAge` на другое число, `path` на иное, либо `store.delete({ name, path })` на `store.delete(THEME_COOKIE)` → красный.
- [ ] Добавить `httpOnly: true` или `secure: true` → «кука не httpOnly и не secure» красный.
- [ ] Убрать проверку `ALLOWED.has(choice)` → «чужое значение» красный.
- [ ] Убрать `setChoice(next)` из `apply` или кнопку «повторить» → «отказ action» красный.
- [ ] Убрать `useEffect(() => setChoice(themeChoice), [themeChoice])` → «сервер побеждает» красный.
- [ ] Удалить правило `.hdr .theme-sw`, заменить `var(--surf)` на `#ffffff` или убрать `appearance: none` → сторож CSS красный.
- [ ] Вернуть `<HeaderActions pendingCount={inbox} />` без пропса → `typecheck` красный (обязательный проп) и сторож layout красный.
- [ ] `grep -rn "mydon_bg" apps/cc/src/components/header-actions.tsx` — пусто: переключатель темы фон не трогает.

## Задача 4. Точечная сетка на холсте командного центра

**Зависимости:** CSS и сторож можно вливать в ЛЮБОМ порядке относительно задач 1–3
(middleware, layout, `ThemeSync`): пока атрибута `data-console="true"` на `.app` нет,
правило просто ни к чему не применяется, а сторож проверяет исходник, а не DOM.
Визуальная приёмка (шаг 4.5) требует, чтобы layout уже ставил `data-console`.

**Что в коде сегодня** (прочитано): холст — `body { background: var(--bg) }`
(`globals.css:199`); небо — `.bgw { position: fixed; inset: 0; z-index: 0; … display: none }`
(`:216`), включается двумя правилами-близнецами только в тёмных ветках (`:217–220`); каркас —
`.app { position: relative; z-index: 1; … }` (`:239`), внутри него `.hdr` (полупрозрачный
`color-mix(… var(--bg) 84%, transparent)` + blur), `.body` → `.side` (`--overlay` + blur,
от 900px) и `.scroll` → `.wrap` (без фона). Панели: `.card { background: var(--surf) … }`
(`:371`), `.panel.console { background: var(--surf) … }` (`:379`). Ни одного
`radial-gradient` в файле нет; единственный градиент — `repeating-linear-gradient` у
`.led.unknown::before` (`:405`), он не сетка. Небо (`sky-liquid.ts`) рисует звёзды на
ПРОЗРАЧНОМ canvas (`clearRect`, WebGL `alpha: true`, `setClearColor(0x000000, 0)`).

**Ключевой факт, определяющий место правила:** `.app` — контекст наложения с `z-index: 1`,
`.bgw` — с `z-index: 0` в ТОМ ЖЕ корневом контексте. Всё, что нарисовано внутри `.app`
(его фон, любой `::before`, даже с отрицательным `z-index`), лежит ПОВЕРХ неба. Значит фон
на `.app[data-console="true"]` физически не может лечь «под небом»: тёмные точки легли бы
на свечение жидкости дырками. Единственный слой между `--bg` и небом — сам `body`
(его фон пропагируется на канву). Поэтому правило вешается на
`body:has(.app[data-console="true"])`, а не на `.app`; `:has()` в файле уже есть.
На `<html>` нельзя: у корня появился бы свой фон, фон `body` перестал бы
распространяться на канву, и непрозрачный `--bg` на `body` накрыл бы сетку.

**Цвет точки — посчитан, не подобран.** Тёмный холст `#111712`: Y = 0,00776, L* = 7,0,
HSL-светлота 7,8 %. Кандидаты (контраст WCAG к холсту / ΔL* / Δсветлота HSL):
`--surf` #18211a — 1,10:1 / +4,7 / +3,3 п.п. (на точке 1px пропадает);
`--line-soft` #232a1d — **1,23:1 / +9,0 / +6,1 п.п.** (выбран);
`--surf-2` #202b22 — 1,24:1; `--line` #2c3324 — 1,39:1 (спорит с рамками панелей);
`color-mix(in srgb, var(--bg) 94%, var(--tx))` ≈ #1e241f — 1,15:1 (арифметика вместо токена).
«Пару процентов» из §4 — это про светлоту, и `--line-soft` даёт +6 п.п. HSL: самый тихий
разделитель палитры, новых токенов не заводится. Порог 3:1 нетекстовых элементов к сетке
не применяется — она ничего не значит и не должна читаться как знак.

**Перед правкой:** `git -C /Users/js/Developer/mydon status --short` — в дереве сейчас чужие
правки (`apps/core/src/apps/apps-health*.ts`, неотслеживаемые `.agents/skills/*`), это
параллельная работа Codex; их не трогать и не стэшить.

---

### 4.1. CSS: два правила-близнеца под небом

- [ ] В `/Users/js/Developer/mydon/apps/cc/src/app/globals.css` найти (строки 233–238,
  единственное вхождение):

```css
.bgcap {
  position: absolute; left: 16px; bottom: calc(var(--bar) + 12px);
  font-family: var(--fm); font-size: 10px; letter-spacing: 0.04em; color: var(--tx-3); opacity: 0.55;
}

/* ============ КАРКАС (mobile first) ============ */
```

- [ ] Заменить на (блок `.bgcap` и заголовок КАРКАС остаются как были, между ними — вставка):

```css
.bgcap {
  position: absolute; left: 16px; bottom: calc(var(--bar) + 12px);
  font-family: var(--fm); font-size: 10px; letter-spacing: 0.04em; color: var(--tx-3); opacity: 0.55;
}

/*
 * ТОЧЕЧНАЯ СЕТКА ХОЛСТА КОМАНДНОГО ЦЕНТРА (срез Д2, Р-Д2-7; `rules.md` §4).
 *
 * Только тёмная тема и только маршруты командного центра: корневой layout
 * помечает их `data-console="true"` на `.app` (список маршрутов — данные в
 * `lib/theme.ts`, единственное место). Светлый мир сетки не знает: правила
 * нет в базовой ветке, как нет там и неба.
 *
 * СЕТКА ЛЕЖИТ НА BODY, А НЕ НА `.app`, И ЭТО НЕ ВКУС. Небо `.bgw` —
 * `position: fixed; z-index: 0`, а `.app` — `z-index: 1`: любой фон на `.app`
 * (и любой его `::before`, даже с отрицательным z-index — контекст наложения
 * `.app` целиком выше) лёг бы ПОВЕРХ звёзд и свечения жидкости, и тёмные
 * точки читались бы дырками в свечении. Сетка — слой ПОД небом и НАД `--bg`,
 * то есть на том же элементе, что и холст: `body { background: var(--bg) }`.
 * На `<html>` нельзя: у корня появился бы свой фон, фон body перестал бы
 * распространяться на канву и непрозрачным `--bg` накрыл бы сетку. До `.app`
 * с body дотягивается `:has()` — он в файле уже есть («Мозг»,
 * `.brain-layout:has(.brain-card)`, поддержка браузеров описана там же).
 *
 * Цвет точки — `--line-soft`, самый тихий разделитель палитры: новых токенов
 * не заводим. На тёмном холсте это #232a1d против #111712 — контраст 1,23:1,
 * светлота +6 % (HSL) / +9 L*; порог 3:1 нетекстовых элементов сюда НЕ
 * относится — сетка ничего не значит и обязана НЕ читаться как знак.
 * `--surf` (1,10:1) на точке в 1px пропадает уже на матовом экране, `--line`
 * (1,39:1) спорит с рамками панелей. Шаг 24px, точка 1px — `rules.md` §4;
 * настройка шага не заводится (решение владельца).
 *
 * Внутри `.panel`/`.card` сетки нет и быть не может: у обеих поверхностей
 * `background: var(--surf)`, непрозрачный в каждой ветке — сторож
 * `test/console-grid.test.ts` проверяет и это. Шапка, таббар и сайдбар
 * полупрозрачны намеренно: сквозь них так же просвечивает и небо.
 *
 * ДВАЖДЫ, как небо и вся тёмная палитра: медиавыражение ловит системную
 * настройку, `[data-theme="dark"]` — явный выбор.
 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) body:has(.app[data-console="true"]) {
    background-image: radial-gradient(circle, var(--line-soft) 1px, transparent 1px);
    background-size: 24px 24px;
  }
}
:root[data-theme="dark"] body:has(.app[data-console="true"]) {
  background-image: radial-gradient(circle, var(--line-soft) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* ============ КАРКАС (mobile first) ============ */
```

- [ ] Убедиться, что в правилах сетки НЕТ shorthand `background:` — он сбросил бы
  `background-color` холста. Только `background-image` и `background-size`.
- [ ] Убедиться, что оба правила стоят ОТДЕЛЬНЫМИ правилами верхнего уровня, а не вложены
  внутрь блоков палитры `:root:not([data-theme="light"]) { … }` / `:root[data-theme="dark"] { … }`
  (CSS-вложенность сломала бы `палитраБлока` и сторож «две ветки объявляют один набор токенов»).
- [ ] `grep -c 'data-console="true"' /Users/js/Developer/mydon/apps/cc/src/app/globals.css`
  → `3` (одно упоминание в комментарии + два селектора).

---

### 4.2. Сторож `console-grid.test.ts`

- [ ] Создать `/Users/js/Developer/mydon/apps/cc/src/test/console-grid.test.ts` с содержимым:

```ts
import { describe, expect, it } from "vitest";
import {
  ТЁМНАЯ_ВЫБРАННАЯ,
  ТЁМНАЯ_СИСТЕМНАЯ,
  контраст,
  палитраБлока,
  последнееПравило,
  правилаCss,
  стилиПанели as css,
  type Ветка,
  type ПравилоCss,
} from "./css";

/*
 * Сторож точечной сетки холста командного центра (срез Д2, Р-Д2-7).
 *
 * `rules.md` §4: сетка ТОЛЬКО на холсте, НИКОГДА внутри панели; шаг 24px, точка
 * 1px, светлее фона на пару процентов; в светлом мире её нет. jsdom стилей не
 * применяет, поэтому сторожим исходник `globals.css` тем же разборщиком, что
 * сторож палитры (`test/css.ts`).
 *
 * ПРАВИЛА ИЩУТСЯ ПО ПРИЗНАКУ (`radial-gradient` в `background-image`), А НЕ ПО
 * СЕЛЕКТОРУ: сторож, который ищет сетку только там, где она должна быть, не
 * увидит её там, где её быть не должно, — а второе и есть запрет §4.
 */

/** Признак точечной сетки в теле правила. */
const СЕТКА = /background-image\s*:\s*radial-gradient\(/i;

/** Правила файла, рисующие точечную сетку, — где бы они ни стояли. */
function правилаСетки(): ПравилоCss[] {
  return правилаCss(css).filter((r) => СЕТКА.test(r.тело));
}

/** ПОСЛЕДНЕЕ значение свойства в теле правила; `null` — не задано. */
function значение(тело: string, свойство: string): string | null {
  const все = [...тело.matchAll(new RegExp(`(?:^|[;\\s])${свойство}\\s*:\\s*([^;{}]+)`, "gi"))];
  const последнее = все.at(-1)?.[1];
  return последнее === undefined ? null : последнее.trim();
}

/**
 * Действующий `background` поверхности: ПОСЛЕДНЕЕ правило с этим селектором,
 * которое фон ОБЪЯВЛЯЕТ. Не `последнееПравило`: у `.approw` последнее правило
 * файла — телефонная ступень `@media (max-width: 520px)` с одним `flex-wrap`,
 * и по ней фона «нет», хотя базовое правило выше его задаёт. `null` — ни одно
 * правило селектора фона не задаёт.
 */
function фонПоверхности(селектор: string): string | null {
  const фоны = правилаCss(css)
    .filter((r) => r.селектор.split(",").some((s) => s.trim() === селектор))
    .map((r) => значение(r.тело, "background"))
    .filter((v): v is string => v !== null);
  return фоны.at(-1) ?? null;
}

/** Ожидаемый селектор сетки в ветке темы: от корня ветки до body с консольным `.app`. */
const селекторСетки = (ветка: Ветка): string =>
  `${ветка.селектор} body:has(.app[data-console="true"])`;

/** Правило сетки одной ветки темы; ассерт «нашлось» — здесь, а не в разборщике. */
function правилоСетки(ветка: Ветка): ПравилоCss {
  const найдено = правилаСетки().filter(
    (r) => r.контекст === ветка.контекст && r.селектор === селекторСетки(ветка),
  );
  expect(найдено.length, `в блоке «${ветка.имя}» нет правила сетки ${селекторСетки(ветка)}`).toBe(1);
  return найдено[0] as ПравилоCss;
}

/** Палитра ветки с ассертом «блок нашёлся» — пустая карта прошла бы проверки зелёной. */
function палитра(ветка: Ветка): Map<string, string> {
  const карта = палитраБлока(css, ветка);
  expect(карта.size, `блок палитры «${ветка.имя}» в globals.css не найден`).toBeGreaterThan(0);
  return карта;
}

/** Число в записи файла: запятая как разделитель, два знака. */
const какВФайле = (значение: number): string => значение.toFixed(2).replace(".", ",");

const ТЁМНЫЕ: readonly Ветка[] = [ТЁМНАЯ_СИСТЕМНАЯ, ТЁМНАЯ_ВЫБРАННАЯ];

describe("Сетка холста: где она есть", () => {
  it("ровно два правила сетки — по одному на каждую ветку тёмной темы, и ни одного больше", () => {
    // «Ровно два» закрывает сразу три утверждения: сетка есть; она есть в
    // ОБЕИХ тёмных ветках (они синхронизируются руками, как вся палитра);
    // третьего правила — в светлой ветке или внутри панели — нет.
    const все = правилаСетки();
    expect(
      все.map((r) => `${r.контекст ? `[${r.контекст}] ` : ""}${r.селектор}`),
      "правила с radial-gradient в background-image",
    ).toEqual([селекторСетки(ТЁМНАЯ_СИСТЕМНАЯ), селекторСетки(ТЁМНАЯ_ВЫБРАННАЯ)].map((s, i) =>
      i === 0 ? `[${ТЁМНАЯ_СИСТЕМНАЯ.контекст}] ${s}` : s,
    ));
    for (const ветка of ТЁМНЫЕ) правилоСетки(ветка);
  });

  it("в светлой ветке сетки нет", () => {
    // Светлая тема — голый `:root` без контекста. Правило сетки вне
    // медиавыражения обязано нести `[data-theme="dark"]` в селекторе, иначе
    // оно действует и на светлом холсте.
    for (const r of правилаСетки()) {
      const тёмное =
        r.контекст === ТЁМНАЯ_СИСТЕМНАЯ.контекст || r.селектор.startsWith(ТЁМНАЯ_ВЫБРАННАЯ.селектор);
      expect(тёмное, `правило сетки «${r.селектор}» не ограничено тёмной темой`).toBe(true);
    }
  });

  it("привязана к data-console и лежит на body — ПОД небом, а не на .app", () => {
    // Небо `.bgw` — fixed, z-index 0; `.app` — z-index 1. Фон на `.app` лёг бы
    // поверх звёзд. Пока эти два числа таковы, единственное место сетки под
    // небом и над `--bg` — сам body. Числа сторожатся здесь же: изменятся они —
    // пересматривать и место сетки.
    for (const ветка of ТЁМНЫЕ) {
      expect(правилоСетки(ветка).селектор).toContain('[data-console="true"]');
      expect(правилоСетки(ветка).селектор).toMatch(/ body:has\(\.app\[data-console="true"\]\)$/);
    }
    const небо = последнееПравило(css, ".bgw");
    const каркас = последнееПравило(css, ".app");
    expect(небо, "правило .bgw не найдено").not.toBeNull();
    expect(каркас, "правило .app не найдено").not.toBeNull();
    expect(значение(небо?.тело ?? "", "z-index")).toBe("0");
    expect(значение(каркас?.тело ?? "", "z-index")).toBe("1");
    expect(значение(последнееПравило(css, "body")?.тело ?? "", "background")).toBe("var(--bg)");
  });
});

describe("Сетка холста: какая она", () => {
  it("шаг 24px, точка 1px, цвет — токен --line-soft, и обе ветки — один в один", () => {
    for (const ветка of ТЁМНЫЕ) {
      const тело = правилоСетки(ветка).тело;
      expect(значение(тело, "background-image"), ветка.имя).toBe(
        "radial-gradient(circle, var(--line-soft) 1px, transparent 1px)",
      );
      expect(значение(тело, "background-size"), ветка.имя).toBe("24px 24px");
      // Токен, а не литерал: новых цветов срез не заводит, а литерал разъехался
      // бы с палитрой при первой же правке `--line-soft`.
      expect(тело, ветка.имя).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
    expect(правилоСетки(ТЁМНАЯ_ВЫБРАННАЯ).тело.replace(/\s+/g, " ").trim()).toBe(
      правилоСетки(ТЁМНАЯ_СИСТЕМНАЯ).тело.replace(/\s+/g, " ").trim(),
    );
  });

  it("точка светлее холста на пару процентов: 1,23:1 по WCAG, и это число стоит в файле", () => {
    // Число в комментарии — утверждение, а не подпись (сторож палитры, срез Д1):
    // считается здесь заново по значениям палитры, а не сверяется подстрокой.
    // Коридор: ниже 1,05 точка не видна, выше 1,5 — читается линией, как
    // `--line` (1,39) уже спорит с рамками панелей.
    const начало = css.indexOf("ТОЧЕЧНАЯ СЕТКА");
    const конец = css.indexOf('body:has(.app[data-console="true"])');
    expect(начало, "комментарий «ТОЧЕЧНАЯ СЕТКА» над правилом не найден").toBeGreaterThan(-1);
    expect(конец, "правило сетки не найдено").toBeGreaterThan(начало);
    const комментарий = css.slice(начало, конец);
    for (const ветка of ТЁМНЫЕ) {
      // Токен — ИЗ ПРАВИЛА, а не из головы теста: поменяют цвет точки — число
      // в комментарии обязано поменяться вместе с ним.
      const токен = /var\(\s*(--[a-z0-9-]+)\s*\)/i.exec(значение(правилоСетки(ветка).тело, "background-image") ?? "")?.[1];
      expect(токен, `${ветка.имя}: цвет точки задан не токеном`).toBeDefined();
      const точка = палитра(ветка).get(токен ?? "");
      const холст = палитра(ветка).get("--bg");
      expect(точка, `в блоке «${ветка.имя}» нет ${токен}`).toBeDefined();
      expect(холст, `в блоке «${ветка.имя}» нет --bg`).toBeDefined();
      const к = контраст(точка ?? "", холст ?? "");
      expect(к, `${ветка.имя}: цвет не разобрался, считать контраст нечем`).not.toBeNull();
      expect(к ?? 0, `${ветка.имя}: точка не видна на холсте`).toBeGreaterThanOrEqual(1.05);
      expect(к ?? 0, `${ветка.имя}: точка читается линией, а не сеткой`).toBeLessThanOrEqual(1.5);
      // Со словом «контраст» перед числом: комментарий называет и контрасты
      // ОТВЕРГНУТЫХ цветов («`--line` (1,39:1) спорит…»), и голое число нашлось
      // бы у них — сторож одобрил бы подмену токена по чужой строке.
      expect(
        комментарий,
        `${ветка.имя}: комментарий над сеткой не называет «контраст ${какВФайле(к ?? 0)}:1»`,
      ).toContain(`контраст ${какВФайле(к ?? 0)}:1`);
    }
  });
});

describe("Сетка холста: где её нет", () => {
  it("ни один селектор с панелью или карточкой не носит radial-gradient", () => {
    // Класс, в имени которого есть «panel» или «card» (`.panel.console`, `.card`,
    // `.rcard`, `.qcard`, `.brain-card`, `.fab-panel`, …): шире, чем §4
    // требует буквально, — и намеренно: карточка под другим именем остаётся
    // карточкой.
    const панель = /\.[\w-]*(panel|card)[\w-]*/i;
    const нарушители = правилаCss(css)
      .filter((r) => СЕТКА.test(r.тело))
      .flatMap((r) => r.селектор.split(",").map((s) => s.trim()))
      .filter((s) => панель.test(s));
    expect(нарушители, "сетка внутри панели").toEqual([]);
  });

  it("поверхности командного центра непрозрачны — сетка сквозь них не просвечивает", () => {
    // Сетка не «выключается» внутри панели — её просто накрывает фон панели.
    // Значит фон обязан быть, и обязан быть без альфы в каждой тёмной ветке.
    for (const селектор of [".panel.console", ".card", ".agtile", ".approw", ".ph", ".doc-wrap"]) {
      expect(фонПоверхности(селектор), селектор).toBe("var(--surf)");
    }
    for (const ветка of ТЁМНЫЕ) {
      expect(палитра(ветка).get("--surf"), `${ветка.имя}: --surf должен быть непрозрачным hex`).toMatch(
        /^#[0-9a-f]{6}$/i,
      );
    }
  });
});
```

---

### 4.3. Прогон: зелёный на правке

- [ ] Выполнить:

```bash
cd /Users/js/Developer/mydon/apps/cc && pnpm exec vitest run src/test/console-grid.test.ts src/test/palette.test.ts src/test/design-skill.test.ts
```

  Ожидание: `✓ src/test/console-grid.test.ts (7 tests)`, `✓ src/test/palette.test.ts (14 tests)`,
  `design-skill.test.ts` без изменений статуса (он не смотрит на правила сетки: его вызовы
  `правилаCss` фильтруют по `--unk` и `.aggrid`).
- [ ] Типы: `cd /Users/js/Developer/mydon/apps/cc && pnpm exec tsc --noEmit` — без ошибок
  (файл теста проверен под этим же `tsconfig.json`: strict, `exactOptionalPropertyTypes`, ни одного
  `any`/`@ts-ignore`).
- [ ] Весь пакет панели: `cd /Users/js/Developer/mydon/apps/cc && pnpm exec vitest run` — все зелёные.

### 4.4. Прогон: красный на откате (доказательство, что сторож не вакуумный)

- [ ] Временно убрать ТОЛЬКО правку CSS (тест остаётся), прогнать, вернуть:

```bash
cd /Users/js/Developer/mydon && git stash push -- apps/cc/src/app/globals.css && (cd apps/cc && pnpm exec vitest run src/test/console-grid.test.ts; true) && git stash pop
```

  Ожидание — `4 failed | 3 passed`, среди сообщений дословно:
  `правила с radial-gradient в background-image: expected [] to deeply equal [ …(2) ]`,
  `в блоке «тёмная системная (@media prefers-color-scheme: dark)» нет правила сетки :root:not([data-theme="light"]) body:has(.app[data-console="true"])`,
  `комментарий «ТОЧЕЧНАЯ СЕТКА» над правилом не найден`.
  (Проверено на копии файла; ещё три мутации тоже красные: правило внутри
  `.panel.console` → `сетка внутри панели: expected [ '.panel.console' ] to deeply equal []`;
  правило на `.app[data-console="true"]` вместо `body:has(…)` → 4 падения; `var(--line)`
  вместо `var(--line-soft)` → 2 падения, включая
  `комментарий над сеткой не называет «контраст 1,39:1»`.)
- [ ] После `git stash pop` — повторить 4.3, снова зелёный.

### 4.5. Визуальная приёмка Р-Д2-7 (после задач 1–3, когда `data-console` уже ставится)

- [ ] `pnpm --filter @mydon/cc dev`, открыть `/apps` без куки темы (тёмная по маршруту):
  на холсте между панелями видны точки шагом 24px; внутри `.panel.console`/`.card`/строк
  `.approw` точек нет; в шапке и сайдбаре — приглушённо сквозь blur, как и небо.
- [ ] Кнопкой в шапке выключить небо (`mydon_bg`) — точки остаются; включить — звёзды и
  свечение ложатся ПОВЕРХ точек (точки внутри свечения светлеют, а не пробивают его дырками).
- [ ] Открыть `/stock` (бизнес-маршрут, светлый) — точек нет; с кукой `mydon_theme=dark` на
  `/stock` — тёмная тема, но точек нет (сетка привязана к `data-console`, не к теме).
- [ ] С кукой `mydon_theme=light` на `/apps` — светлая тема, точек нет
  (`:root:not([data-theme="light"])` не совпадает, `[data-theme="dark"]` отсутствует).
- [ ] SPA-переход `/apps` → `/stock` → `/apps` без перезагрузки: точки исчезают и
  возвращаются вместе с `data-console` (ответственность `ThemeSync`, задача 3).

### 4.6. Передать в задачу навыка (Р-Д2-8), здесь НЕ делать

- [ ] В `rules.md` §4 строка про фон переписывается по факту: сетка — CSS-слой на `body`
  под небом (`z-index` 0 у `.bgw`, 1 у `.app`), селектор `body:has(.app[data-console="true"])`
  в обеих тёмных ветках, цвет `--line-soft` (1,23:1 к холсту), шаг 24px, точка 1px, в светлом
  мире нет, внутри `.panel`/`.card` невозможна. Сторож фактов — `console-grid.test.ts`.

## Задача 5: навык mydon-design — §4 по факту, §9 очищен, primitives.md знает доски A2/M/R

**Когда:** ПОСЛЕДНЕЙ, после задач 1–4 — навык ссылается на `apps/cc/src/lib/theme.ts`, `apps/cc/src/proxy.ts`, `apps/cc/src/components/theme-sync.tsx`, `apps/cc/src/app/theme/actions.ts`, и `verify-paths.mjs` считает несуществующий путь битой ссылкой; сторож проверяет `existsSync` тех же файлов.

**Как править навык:** правится ТОЛЬКО мастер `.claude/skills/mydon-design/`; два зеркала генерируются в шаге 5.7 копированием. Ручная правка зеркала = красный сторож дрейфа.

### 5.0. Контракт маркера маршрутов (общий с задачей 2)

- [ ] Согласовать с задачей 2 форму: в `rules.md` §4 стоит отдельная строка `<!-- CONSOLE_ROUTES -->`, ровно одна на файл; сразу под ней — абзац до первой пустой строки. Абзац содержит `` `CONSOLE_ROUTES` `` и `` `apps/cc/src/lib/theme.ts` `` и НЕ содержит ни одного элемента `CONSOLE_ROUTES` как подстроки. Тест задачи 2 проверяет абзац против модуля; сторож навыка (эта задача) проверяет только «маркер есть и он один» — чтобы два теста не дублировали друг друга и не разошлись.

### 5.1. `rules.md`

- [ ] Строки 3–4 (шапка источников). Заменить

```
Источник каждого правила — комментарии в `apps/cc/src/app/globals.css`, `components/nav.tsx`, `layout.tsx`
и `docs/decisions/2026-08-22-navigaciya-i-gamma.md`. Здесь — выжимка.
```

на

```
Источник каждого правила — комментарии в `apps/cc/src/app/globals.css`, `components/nav.tsx`, `layout.tsx`,
`lib/theme.ts`, `proxy.ts` и `docs/decisions/2026-08-22-navigaciya-i-gamma.md`. Здесь — выжимка.
```

- [ ] Строки 39–57 (весь §4 до `### 4.1.`). Заменить блок, начинающийся с `## 4. Грамматика командного центра (агентский слой)` и заканчивающийся строкой `  гасятся в светлой теме (`.bgw { display: none }`, включается только в тёмной ветке). Решение по фону — §9.`, на текст ниже ДОСЛОВНО (маркер `<!-- CONSOLE_ROUTES -->` — отдельной строкой, абзац под ним без литералов маршрутов):

```
## 4. Грамматика командного центра (агентский слой)

Командный центр — тёмный мир, бизнес-экраны — светлый. Правила грамматики действуют на любом экране
агентского слоя независимо от того, какую тему выбрал пользователь.

<!-- CONSOLE_ROUTES -->
Какие маршруты — командный центр, знает РОВНО ОДИН модуль: `CONSOLE_ROUTES` в `apps/cc/src/lib/theme.ts`
(префиксы пути, дверь — `isConsoleRoute(pathname)`; вложенный маршрут, например карточка агента, покрыт
префиксом родителя). Здесь маршруты НЕ перечисляются: список в прозе уже расходился с кодом в обе
стороны, и сторож маршрутов роняет сборку, если этот абзац начнёт перечислять их снова. Новому экрану
агентского слоя — строка в `CONSOLE_ROUTES`, а не штамп темы на странице.

Механизм темы (срез Д2, спека `docs/superpowers/specs/2026-09-07-design-wave-theme-design.md`):
- **Правило одно — `themeFor(pathname, cookie)`** в `apps/cc/src/lib/theme.ts`: явный выбор из куки
  `mydon_theme` (`light` | `dark`) выигрывает у всего; без куки маршрут командного центра → `dark`,
  остальное → `null`, то есть системная настройка через `prefers-color-scheme`. Модуль БЕЗ серверных
  импортов: его читают и middleware, и клиент, и `next/headers` там уронил бы клиентскую сборку.
- **Первый кадр держит сервер.** `apps/cc/src/proxy.ts` на каждом запросе кладёт результат
  `themeFor` в заголовок `x-mydon-theme` (`light` | `dark` | `system`) и `x-mydon-console` (`1` | `0`);
  корневой `apps/cc/src/app/layout.tsx` читает оба через `headers()` и ставит `data-theme` на `<html>`
  В РАЗМЕТКЕ (для `system` атрибута нет) с `suppressHydrationWarning`, а `data-console="true"` — на
  `<div className="app">`. `generateViewport` там же отдаёт `themeColor` по той же теме. Светлого
  первого кадра на тёмной странице больше нет — прежний клиентский `useEffect` давал его всегда.
- **Навигацию держит клиент.** Корневой layout при SPA-переходе не перерисовывается, и тема «протекла»
  бы на соседний мир, поэтому `ThemeSync` (`apps/cc/src/components/theme-sync.tsx`, стоит в корневом
  layout один раз) по `usePathname()` и `document.cookie` применяет ту же `themeFor` к `<html>` и
  `data-console` к `.app`. Ручного штампа темы на страницах нет ни одного.
- **Выбор пользователя — кука, не `localStorage` и не Core.** `localStorage` сервер не читает (мигание
  вернулось бы), в Core личных настроек просмотра нет и заводить их ради темы не стали. Куку
  `mydon_theme` (`SameSite=Lax`, `Path=/`, срок год) пишет server action `setTheme`
  (`apps/cc/src/app/theme/actions.ts`); `system` — куку удаляет. Переключатель — в шапке
  (`apps/cc/src/components/header-actions.tsx`) рядом с тумблером фона, три состояния СЛОВАМИ:
  «как в системе» / «светлая» / «тёмная». Слова, не иконки: цвет и форма не единственные носители
  смысла (§4.1), и переключатель обязан читаться в обеих темах. «Как в системе» — законное состояние,
  и его нельзя отобрать у того, кто ничего не менял. Блока `[data-theme="light"]` в CSS нет и не
  будет: светлая палитра — голый `:root`, атрибут только глушит медиа-блок через `:not()`.
- **`color-scheme`** объявлен трижды, как все токены: `light` в `:root`, `dark` в ОБЕИХ тёмных ветках —
  нативные контролы, autofill и системные скроллбары следуют теме. Тёмная тема объявлена дважды
  намеренно (§8), списки синхронизируются руками, и сторож палитры (`apps/cc/src/test/palette.test.ts`)
  сверяет обе ветки по именам и значениям.
- **Точечная сетка** — только на холсте командного центра и только в тёмной теме: правило на
  `.app[data-console="true"]`, `background-image: radial-gradient(...)`, шаг 24px, точка 1px, светлее
  фона на пару процентов. Внутри `.panel`/`.card` её нет; в светлом мире нет; настройки шага нет
  (решение владельца). Небо и жидкость (`apps/cc/src/components/bg/`, тумблер `mydon_bg` в
  `localStorage`, гасятся в светлой теме через `.bgw { display: none }`) остаются как были: сетка —
  статичный CSS-слой ПОД ними, не замена; выключил небо — осталась сетка.

Грамматика экрана:
- метки разделов — существующий `.eyebrow` (10,5px, 700, uppercase, трекинг 0.13em, `--tx-3`); для цифровых
  меток добавлять `.mono`. Новый класс `.lbl` не заводить;
- панель `.panel.console` (объявлена в `globals.css` рядом с `.card`): жёсткая рамка
  `1px solid var(--line-strong)` + смещённый контур 4 px (`box-shadow: 4px 4px 0 var(--line)`), без размытой
  тени; радиус `--r-s`;
- аватар агента — `.av8`: детерминированный 8×8 SVG от имени, цвет всегда `--agent` (у активного тоже:
  состояние говорит лампа, а не аватар);
  новые классы — в обе ветки темы, если используют цвета вне токенов (не должны);
- цифры — `--fm` с табличными цифрами (`.num`); пиксельный display-шрифт — только для цифр и только после
  проверки контраста; **кириллица — всегда Golos Text**;
- доски агентского слоя (сетка агентов, здоровье источников, рутины, прогоны, документы) собираются из
  готовых классов — инвентарь в `primitives.md`, раздел «Доски агентского слоя».
```

- [ ] Строка 92 (в §4.1, абзац про четыре оси). Заменить `осях — известное расхождение, помеченное долгом Д2 (§9): тип защищает код, но не владельца.` на `осях — известное расхождение, помеченное долгом (§9): тип защищает код, но не владельца.`

- [ ] §8 (строки 224–228). Заменить весь раздел от `## 8. Тема` до строки `в обе ветки, иначе тема «протечёт».` на:

```
## 8. Тема

Тёмная тема объявлена дважды намеренно: `@media (prefers-color-scheme: dark)` для системной настройки и
`:root[data-theme="dark"]` для явного выбора; оба списка синхронизируются руками, и сторож палитры сверяет
их по именам И значениям (`color-scheme: dark` в том числе). Светлая палитра — голый `:root`
(`color-scheme: light`); блока `[data-theme="light"]` нет: атрибут только глушит медиа-блок через `:not()`.
Кто ставит `data-theme` (middleware + `ThemeSync`), где хранится выбор (кука `mydon_theme`) и как
устроена сетка холста — §4. `themeColor` отдаёт `generateViewport` в `layout.tsx` по фактической теме.
Новые токены — в обе тёмные ветки, иначе тема «протечёт».
```

- [ ] §9 (строки 230–257, до конца файла). Заменить весь раздел от `## 9. Долг среза Д2 «Два мира» — известные расхождения (не чинить здесь)` до конца файла на текст ниже. Два оставшихся пункта — ДОСЛОВНО прежние (сторож ищет в них `CARD_WORD.active`, `PAUSE_WORD.on`, `284`, `font-size`):

```
## 9. Долги после среза Д2 — известные расхождения (не чинить попутно)

Помечено, а не исправлено: каждое — словарь продукта или отдельная приёмка, и правка наполовину хуже
честной пометки. Долги, которые Д2 закрыл (маршрутный список в прозе, ручной штамп темы на страницах,
точечная сетка, инвентарь досок в `primitives.md`), отсюда убраны: их состояние — §4 и `primitives.md`.

- **Одно слово стоит на двух осях состояний.** «Работает» — это и занятость агента
  (`AGENT_STATE_WORD.working`, «занят прямо сейчас»), и жизненный цикл карточки (`CARD_WORD.active`,
  «введена в работу»); «на паузе» — и занятость агента, и настройка системы (`PAUSE_WORD.on`,
  «выключено сразу у всех»). Тип защищает КОД — перепутать `AgentState` и `CardStatus` нельзя, — но не
  защищает ВЛАДЕЛЬЦА: на двух экранах он читает одно слово про разные вещи. Туда же зелёная пилюля у
  «введён в работу» (`CARD_PILL.active`) и зелёная лампа у «работают» (`PAUSE_LED.off`): `--ok` там
  значит «включён», а не «здоров», вопреки §4.1. Разводится словами, а не типами, и не в этом срезе.
- **Сведение шкалы кеглей ОТЛОЖЕНО ОСОЗНАННО.** В `globals.css` 284 объявления `font-size`, 28 разных
  значений и ноль размерных токенов. Шкала идёт в навык как правило для НОВЫХ экранов (§6); существующие
  объявления не трогаются — механическая правка 284 мест без экранной приёмки дороже пользы.
```

- [ ] Проверить: `grep -c 'CONSOLE_ROUTES -->' .claude/skills/mydon-design/rules.md` → `1`; `grep -n 'ConsoleTheme\|/artifacts' .claude/skills/mydon-design/rules.md` → пусто.

### 5.2. `primitives.md`

- [ ] Таблица «Каркас страницы», строка `.app`. Заменить

```
| `.app`, `.hdr` (+ `.logo`, `.sub`, `.sp`) | обёртка приложения и шапка 64px | `app/layout.tsx` |
```

на

```
| `.app` (атрибут `data-console="true"` на маршрутах командного центра — ставят layout и `ThemeSync`, `rules.md` §4; в тёмной теме несёт точечную сетку), `.hdr` (+ `.logo`, `.sub`, `.sp`) | обёртка приложения и шапка 64px | `app/layout.tsx` |
```

- [ ] Таблица «Каркас страницы», строка `.panel.console`. Заменить

```
| `.panel.console` | панель агентского слоя: жёсткая рамка + смещённый контур 4px, без размытой тени | `components/skills-deck.tsx` |
```

на

```
| `.panel.console` | панель агентского слоя: жёсткая рамка `1px solid var(--line-strong)` + смещённый контур `4px 4px 0 var(--line)`, без размытой тени, радиус `--r-s`, паддинг 16px; стоит как `panel console` (карточка навыка), `panel console aghead` (шапка карточки агента) и `panel console brain-card` (карточка узла графа) | `components/skills-deck.tsx`, `app/agents/[name]/page.tsx`, `components/brain-graph.tsx` |
```

- [ ] Таблица «Контейнеры и списки», строка `.aggrid`. Заменить

```
| `.aggrid` → `.agtile` (+ `.av8` лицо · `.agn` имя · `.agled` состояние · `.agr` причина, в ней `.agw` — давность) | сетка агентов 1/2/3; левая полоса по состоянию — `rules.md` §4.2, §4.3 |
```

на

```
| `.aggrid` → `.agtile` | сетка агентов 1/2/3 — полная анатомия, модификаторы и место в коде в разделе «Доски агентского слоя» ниже |
```

- [ ] Вставить НОВЫЙ раздел между таблицей «Контейнеры и списки» и заголовком `## Состояния и сигналы` (после строки `.aggrid` и пустой строки):

```
## Доски агентского слоя (волны A2/M/R)

Всё — на токенах, поэтому в ветки темы не дублируется. Состояние читается из `data-*`-атрибута, а не из
класса-утилиты (`.warn` — глобальный цвет текста, и `.ph.warn` цеплял бы его вместе с рамкой фазы).
Гаснущее «есть, но не действует» везде одно число — `opacity: 0.55` (пауза агента, расписание на паузе,
фаза «не было», `.btn:disabled`); гаснут части, а не строка целиком, если в строке есть причина.

| Класс | Назначение и анатомия | Где стоит | Модификаторы |
|---|---|---|---|
| `.aggrid` → `.agtile` | сетка агентов: плитка = лицо `.av8` (26px) + `.agb` (имя `.agn` моно 12,5px/600 · состояние `.agled` с лампой `.led` · причина `.agr` 11,5px `--tx-2`, в ней давность `.agw` `--tx-3`); рамка `--line-strong` и смещённый контур 4px, как у `.panel.console`; колонки 1/2/3 (`rules.md` §4.3) | `components/agent-grid.tsx` (главная) | `[data-state="blocked"]` — полоса 3px `--err`; `[data-state="paused"]` — гаснут `.av8`/`.agn`/`.agled`, причина НЕ гаснет; `[data-attention="true"]` — полоса 3px `--warn` (молчит из-за поломки); две полосы не складываются (§4.2) |
| `.aghead` | шапка карточки агента: та же анатомия (`.av8` 40px · `.agn` 17px · `.agled` · `.agr` · `.tags`), только крупнее — здесь читают, а не опознают глазом | `app/agents/[name]/page.tsx` (`panel console aghead`) | — |
| `.approw` | строка источника здоровья: лампа `.led` + `.ab` (`.an` заголовок 14px/600 · `.as` причина 12,5px `--tx-2`) + `.aw` время моно 11,5px `--tx-3` `nowrap`; секции — `.apps-section` (+ `.hint` под заголовком) | `app/apps/page.tsx` (`Link.approw` при `href`, иначе `div.approw`) | `.approw[data-state="bad"]` — полоса 3px `--err`; `.approw[data-state="unknown"]` — пунктирная рамка, строка остаётся; под 520px `.approw` переносит содержимое, `.aw` уходит на свою строку (§4.2) |
| `.crons-wrap` → `.crons-table` | доска расписаний: таблица `min-width: 720px`, прокрутка внутри `.crons-wrap`; `th` 12px/600 `--tx-2`, `td` 9px 12px с разделителем `--line`; в ячейках `.mono` (cron-выражение и время — табличные цифры, `nowrap`), `.dim` (подпись 11,5px `--tx-3`: причина отключения, «на паузе», давность прогона), лампа исхода `.led.run-led.*`; «Ближайшие 24 ч» рядом — `.runs-strip` из строк `.trow` | `app/crons/page.tsx`, `components/upcoming-runs.tsx` | `tr.is-paused` — ячейки гаснут 0.55, строка остаётся («такого расписания нет» — не ответ на «почему не сработало») |
| `.flows-layout` → `.flow-list` + `.flow-detail` | раскладка прогонов: журнал слева `minmax(280px, 400px)`, разбор справа; у обеих колонок `min-width: 0` (иначе payload тянет страницу вбок); фильтр — `.search.flows-filter` с `select` 42px; выбранный прогон — `.trow.is-active` (рамка `--accent-line`, фон `--accent-soft`, единственный «выбор» на экране) | `app/flows/page.tsx` | ниже 900px — одна колонка; `.flows-layout.reading` — разбор встаёт первым (`order: -1`), как на `/docs` |
| `.flight` → `.ph` | полоса шести фаз прогона: `ol.flight` — шесть равных клеток (ниже 900px — 3×2), `li.ph` — клетка: лампа `.led.run-led.*` со словом фазы · `.pt` время моно `--tx-3` (нет — прочерк) · `.tt` заголовок 12px (ссылка — пунктирное подчёркивание) · `.note` 11px `--tx-2`. Клеток всегда шесть — исчезнувшая читалась бы как «всё прошло» | `components/flow-strip.tsx` (внутри `.flow-detail`) | атрибут `data-state`: `ok` — рамка `--ok`, `warn` — `--warn` (тем же токеном, что лампа внутри), `fail` — `--err`, `data-state="skip"` — гаснет 0.55, клетка остаётся |
| `.flow-reason`, `.flow-review`, `.flow-key`, `.flow-timeline` | разбор прогона: `.card.flow-reason` («Причина прогона», `.card-top` с лампой исхода), `.flow-review` — отзыв коуча курсивом 13px `--tx-2`, `.flow-key` — ключ запроса моно 11px `--tx-3`, `.flow-timeline` — лента: `li` по времени (`.at` моно 11,5px · `.chip` источника · `.tl-title` · `code` payload моно 11,5px с переносом) | `app/flows/page.tsx` | — |
| `.docs-layout` → `.docs-tree` + `.docs-body` | документы: дерево слева `minmax(240px, 320px)` (от 901px липкое, `max-height: calc(100vh - 96px)`), чтение справа; в дереве `.docs-filter` (липкий фильтр с фоном `--bg`), `.docs-group` (`<details>` с путём `.docs-root` и счётчиком `.docs-count`), строки `.row` с `aria-current="page"` на `--accent-soft`, метка `.docs-personal` | `app/docs/page.tsx` | ниже 900px — одна колонка, дерево `46vh`; `.docs-layout.reading` — документ первым |
| `.doc-wrap` → `.doc-head` + `article.doc` | чтение документа: `.doc-head` (`.doc-meta` — `b` заголовок 16px/700 и `small.mono` путь · размер · дата; `.doc-brain` — пилюля «Открыть в Мозге» на `--accent-line`/`--accent-tx`, не `.chip`: кириллица — Golos); `article.doc` — типографика отрендеренного markdown 14px/1.62: `h1` 20px (просит вес 800 — у Golos загружены 600/700, браузер синтезирует; в новых классах не повторять), `h2` 16,5px с верхней линией `--line-soft`, `a` `--accent-tx` подчёркнутая, `code`/`pre` на `--surf-2`, `blockquote` — полоса 3px `--line-strong` (цитата, не внимание), таблицы через `.table-scroll`, `.doc-img` — подпись вместо картинки (`lib/markdown.ts`) | `components/doc-view.tsx` | — |
| `.panel.console` + `brain-card` | карточка узла графа «Мозг»: та же панель консоли; внутри `.brain-card-head` (`.eyebrow` вида узла + `.btn.sm.ghost` закрыть), `.brain-card-title` 16px/700, `.brain-card-path` 11px `--tx-3`, `.brain-card-links` — ряд `.btn` | `components/brain-graph.tsx` | — |
```

- [ ] Хвост файла. Заменить весь раздел от `## Чего нет — и что добавить при первой потребности (в `globals.css`, рядом с родственными)` до конца файла на:

```
## Чего нет — и что добавить при первой потребности (в `globals.css`, рядом с родственными)

`.panel.console`, `.led` (четыре состояния), `.av8` и сетка `.aggrid`/`.agtile` больше НЕ в этом списке:
они объявлены в `globals.css` с волны A2 и описаны в таблицах выше — не заводить их заново. Классы досок
волн A2/M/R (`.approw`, `.crons-table`, `.flight`/`.ph`, `.flows-layout`/`.flow-*`, `article.doc`) описаны
в разделе «Доски агентского слоя» — примитив для нового экрана агентского слоя ищется там, а не в
`globals.css` глазами. Точечная сетка холста — не примитив, а правило темы на `.app[data-console="true"]`
(`rules.md` §4): на элементы её не вешать. Новый класс добавляется с тестом на контраст и в обе ветки
темы, если приносит цвет вне токенов (не должен).
```

### 5.3. `checklist.md`

- [ ] После группы «Палитра и контраст» (после строки про новый токен и три условия §2, перед `## Типографика`) вставить:

```
## Тема и холст
- [ ] Экран агентского слоя тёмный ПО МАРШРУТУ: его префикс есть в `CONSOLE_ROUTES` (`apps/cc/src/lib/theme.ts`); ручного штампа `data-theme` на странице нет.
- [ ] Экран просмотрен в трёх состояниях переключателя («как в системе» / «светлая» / «тёмная»): явный выбор побеждает областной дефолт в обе стороны, первый кадр не мигает.
- [ ] Фон не рисуется внутри `.panel`/`.card`: точечная сетка живёт только на `.app[data-console="true"]`, небо и жидкость — в `components/bg/`.

```

(с пустой строкой после — чтобы `## Типографика` остался отдельным абзацем).

### 5.4. `tokens.md`

- [ ] Заменить раздел от `## Цвет строки браузера` до конца файла на:

```
## Цвет строки браузера

`themeColor` отдаёт `generateViewport` в `layout.tsx` по фактической теме — заголовок `x-mydon-theme` от
middleware (`rules.md` §4), а не только `prefers-color-scheme`: светлая `#f4f4ee`, тёмная `#111712`;
«как в системе» — по медиазапросу. Менять вместе с `--bg`.
```

### 5.5. `SKILL.md`

- [ ] Пункт 5 порядка работы. Заменить

```
5. Сверстай. Для страниц агентского слоя — консольная грамматика `rules.md` §4: панель `.panel.console`,
   метки `.eyebrow` (класс `.lbl` не заводить), лампы `.led` с анатомией состояния (§4.1), левые полосы
   внимания (§4.2), колоночность 1/2/3 (§4.3). Маршрутный список тёмных страниц — там же, вместе с
   пометкой его долга (§9).
```

на

```
5. Сверстай. Для страниц агентского слоя — консольная грамматика `rules.md` §4: панель `.panel.console`,
   метки `.eyebrow` (класс `.lbl` не заводить), лампы `.led` с анатомией состояния (§4.1), левые полосы
   внимания (§4.2), колоночность 1/2/3 (§4.3), готовые доски — `primitives.md`, раздел «Доски агентского
   слоя». Тёмный ли экран, решает не страница, а `CONSOLE_ROUTES` в `apps/cc/src/lib/theme.ts` (§4):
   новому экрану агентского слоя — строка там, не штамп темы.
```

### 5.6. Сторож `apps/cc/src/test/design-skill.test.ts`

- [ ] Импорты. Заменить первую строку `import { readFileSync } from "node:fs";` на `import { existsSync, readFileSync } from "node:fs";` и в импорте из `./css` добавить `ТЁМНАЯ_ВЫБРАННАЯ` (после `ТЁМНАЯ_СИСТЕМНАЯ,`):

```ts
import {
  СВЕТЛАЯ,
  ТЁМНАЯ_СИСТЕМНАЯ,
  ТЁМНАЯ_ВЫБРАННАЯ,
  контраст,
  палитраБлока,
  последнееПравило,
  правилаCss,
  стилиПанели,
  type Ветка,
} from "./css";
```

- [ ] Заменить ЦЕЛИКОМ блок `describe("rules.md §9: долг Д2 помечен, а не починен наполовину", () => { … });` (строки 257–284, до закрывающей `});` перед `describe("primitives.md перестал числить…`) на три блока:

```ts
describe("rules.md §4: механизм темы описан по факту (Р-Д2-8)", () => {
  // Шапка §4 — от заголовка до первого подраздела: сюда срез Д2 положил
  // механизм темы, здесь же стоит ссылка на модуль маршрутов.
  const шапка4 = правилаОдной.slice(правилаОдной.indexOf("## 4. "), правилаОдной.indexOf("### 4.1."));

  it("маршруты — ссылкой на модуль под устойчивым маркером, и маркер один", () => {
    // Сам абзац против `CONSOLE_ROUTES` сверяет тест дрейфа рядом с модулем
    // (задача 2); здесь — только что маркер на месте и не размножился, иначе
    // тому тесту нечего вырезать.
    expect(правила, "маркер <!-- CONSOLE_ROUTES --> пропал из rules.md").toContain("<!-- CONSOLE_ROUTES -->");
    expect(правила.split("<!-- CONSOLE_ROUTES -->").length - 1, "маркер обязан стоять ровно один раз").toBe(1);
    for (const факт of ["`CONSOLE_ROUTES`", "`apps/cc/src/lib/theme.ts`", "isConsoleRoute"]) {
      expect(шапка4, `§4 не называет ${факт}`).toContain(факт);
    }
  });

  it("первый кадр держит сервер: middleware, заголовки, атрибуты в разметке", () => {
    for (const факт of [
      "apps/cc/src/proxy.ts",
      "x-mydon-theme",
      "x-mydon-console",
      "headers()",
      "suppressHydrationWarning",
      'data-console="true"',
      "generateViewport",
      "themeFor",
    ]) {
      expect(шапка4, `§4 не знает факта «${факт}»`).toContain(факт);
    }
  });

  it("навигацию держит клиент: ThemeSync в корневом layout, а не штамп на странице", () => {
    for (const факт of ["ThemeSync", "apps/cc/src/components/theme-sync.tsx", "usePathname()"]) {
      expect(шапка4, `§4 не знает факта «${факт}»`).toContain(факт);
    }
  });

  it("выбор пользователя — кука с параметрами, переключатель — словами", () => {
    for (const факт of [
      "mydon_theme",
      "SameSite=Lax",
      "Path=/",
      "setTheme",
      "apps/cc/src/app/theme/actions.ts",
      "header-actions.tsx",
      "«как в системе» / «светлая» / «тёмная»",
    ]) {
      expect(шапка4, `§4 не знает факта «${факт}»`).toContain(факт);
    }
  });

  it("color-scheme объявлен трижды, сетка — только на холсте и не в панели", () => {
    for (const факт of [
      "color-scheme",
      "ОБЕИХ тёмных ветках",
      '.app[data-console="true"]',
      "radial-gradient",
      "24px",
      "1px",
      "`.panel`/`.card`",
      "mydon_bg",
    ]) {
      expect(шапка4, `§4 не знает факта «${факт}»`).toContain(факт);
    }
  });
});

/*
 * ПРИЗРАКИ СРЕЗА Д2. Клиентский штамп темы и маршрут, которого нет, жили в
 * навыке дольше, чем в коде; после среза любое их упоминание — снова ложь про
 * код. `/artifacts` появится в модуле маршрутов (A3), а не в прозе навыка.
 */
describe("призраки среза Д2 из навыка ушли", () => {
  it("ConsoleTheme не упоминается ни в одном файле навыка", () => {
    for (const файл of ["rules.md", "primitives.md", "checklist.md", "tokens.md", "SKILL.md"] as const) {
      expect(читать(НАВЫК, файл), `${файл} всё ещё знает ConsoleTheme`).not.toContain("ConsoleTheme");
    }
  });

  it("маршрута-призрака /artifacts в правилах нет", () => {
    expect(правилаОдной).not.toContain("/artifacts");
  });
});

describe("rules.md §9: после Д2 остались только незакрытые долги", () => {
  const долг = правилаОдной.slice(правилаОдной.indexOf("## 9. Долги после среза Д2"));

  it("секция долга есть и названа по факту, а не наперёд", () => {
    expect(правила).toContain("## 9. Долги после среза Д2");
    expect(правила, "заголовок «Долг среза Д2» ушёл вместе с закрытыми пунктами").not.toContain(
      "## 9. Долг среза Д2",
    );
  });

  it("закрытые долги из §9 ушли: маршрутный список, штамп темы, сетка, инвентарь", () => {
    // Каждый из четырёх закрыт срезом Д2; оставшись в §9, он учил бы автора
    // нового экрана ставить тему штампом и искать примитив «глазами».
    for (const призрак of [
      "разошёлся с реальностью",
      "Точечной сетки на холсте, которую требует §4, в коде нет",
      "`primitives.md` не описывает",
    ]) {
      expect(долг, `в §9 остался закрытый долг: ${призрак}`).not.toContain(призрак);
    }
  });

  it("одно слово на двух осях записано долгом, а не выдано за порядок", () => {
    expect(долг).toContain("CARD_WORD.active");
    expect(долг).toContain("PAUSE_WORD.on");
  });

  it("отложенная шкала кеглей названа числом, а не намерением", () => {
    expect(долг).toContain("284");
    expect(долг).toContain("font-size");
  });
});
```

- [ ] В блоке `describe("primitives.md перестал числить существующие классы отсутствующими", …)` заменить тест `раздел «чего нет» больше не требует заводить `.led` заново` на:

```ts
  it("раздел «чего нет» больше не требует заводить `.led` заново и не отсылает искать доски глазами", () => {
    const хвост = склеить(примитивы.slice(примитивы.indexOf("## Чего нет")));
    expect(хвост).toContain("больше НЕ в этом списке");
    expect(хвост, "хвост снова числит доски A2/M/R неописанными").not.toContain("Ещё не описаны здесь классы досок");
    expect(хвост, "хвост снова ссылается на закрытый долг §9").not.toContain("§9");
  });
```

- [ ] Сразу после закрывающей `});` этого блока (перед `describe("checklist.md спрашивает про состояние"`) добавить:

```ts
describe("primitives.md знает доски волн A2/M/R", () => {
  const склеенные = склеить(примитивы);

  it("раздел досок есть, и в нём все семейства классов", () => {
    expect(примитивы).toContain("## Доски агентского слоя");
    for (const класс of [
      "`.aggrid`",
      "`.agtile`",
      "`.aghead`",
      "`.approw`",
      "`.aw`",
      "`.crons-table`",
      "`.flight`",
      "`.ph`",
      "`.flows-layout`",
      "`.flow-timeline`",
      "`article.doc`",
      "`.docs-layout`",
      "`.panel.console`",
    ]) {
      expect(склеенные, `в primitives.md нет ${класс}`).toContain(класс);
    }
  });

  it("у каждой доски названо место в коде", () => {
    for (const файл of [
      "components/agent-grid.tsx",
      "app/apps/page.tsx",
      "app/crons/page.tsx",
      "app/flows/page.tsx",
      "components/flow-strip.tsx",
      "app/docs/page.tsx",
      "components/doc-view.tsx",
      "components/brain-graph.tsx",
    ]) {
      expect(склеенные, `primitives.md не говорит, где стоит ${файл}`).toContain(файл);
    }
  });

  it("модификаторы названы так, как они записаны в коде", () => {
    for (const факт of [
      'data-state="skip"',
      "tr.is-paused",
      ".flows-layout.reading",
      ".docs-layout.reading",
      '.approw[data-state="unknown"]',
      'data-attention="true"',
    ]) {
      expect(склеенные, `primitives.md не знает модификатора ${факт}`).toContain(факт);
    }
  });
});

describe("checklist.md и tokens.md знают тему как механизм", () => {
  it("чек-лист спрашивает про маршрут, три состояния переключателя и холст", () => {
    for (const факт of ["CONSOLE_ROUTES", "как в системе", '.app[data-console="true"]']) {
      expect(чеклист, `в чек-листе нет ${факт}`).toContain(факт);
    }
  });

  it("tokens.md: themeColor следует фактической теме, а не только медиазапросу", () => {
    const хвост = склеить(токены.slice(токены.indexOf("## Цвет строки браузера")));
    for (const факт of ["generateViewport", "x-mydon-theme", "#f4f4ee", "#111712"]) {
      expect(хвост, `tokens.md не знает ${факт}`).toContain(факт);
    }
  });
});
```

- [ ] В блок `describe("навык не врёт про код", …)` после теста `ступени колонок в CSS — ровно те, что печатает §4.3` (перед закрывающей `});` блока) добавить три теста:

```ts
  it("color-scheme объявлен во всех трёх блоках темы — §4 и §8 не врут", () => {
    const схема = (ветка: Ветка, ожидаемая: string): void => {
      const блоки = правилаCss(стилиПанели).filter(
        (r) =>
          r.контекст === ветка.контекст && r.селектор === ветка.селектор && /color-scheme\s*:/.test(r.тело),
      );
      expect(блоки.length, `в блоке «${ветка.имя}» нет color-scheme`).toBeGreaterThanOrEqual(1);
      expect(блоки.at(-1)?.тело ?? "", `в блоке «${ветка.имя}» color-scheme не ${ожидаемая}`).toMatch(
        new RegExp(`color-scheme\\s*:\\s*${ожидаемая}\\b`),
      );
    };
    схема(СВЕТЛАЯ, "light");
    схема(ТЁМНАЯ_СИСТЕМНАЯ, "dark");
    схема(ТЁМНАЯ_ВЫБРАННАЯ, "dark");
  });

  it("точечная сетка стоит на холсте командного центра, только в тёмной теме и не в панели", () => {
    const сетки = правилаCss(стилиПанели).filter((r) => /radial-gradient/.test(r.тело));
    const наХолсте = сетки.filter((r) => r.селектор.includes('.app[data-console="true"]'));
    expect(наХолсте.length, 'в globals.css нет правила сетки на .app[data-console="true"]').toBeGreaterThanOrEqual(1);
    for (const правило of наХолсте) {
      expect(правило.тело, "шаг сетки — 24px, как печатает §4").toContain("24px");
      expect(
        `${правило.контекст} ${правило.селектор}`,
        "сетка обязана быть заперта в тёмной теме — §4 обещает светлому миру холст без неё",
      ).toMatch(/data-theme="dark"\]|prefers-color-scheme: dark/);
    }
    for (const r of сетки) {
      expect(r.селектор, `сетка вложена в панель или карточку: ${r.селектор}`).not.toMatch(/\.panel|\.card/);
    }
  });

  it("ручного штампа темы нет, а названные в §4 файлы механизма существуют", () => {
    expect(
      existsSync(path.join(КОРЕНЬ, "apps/cc/src/components/console-theme.tsx")),
      "console-theme.tsx вернулся — §4 снова врёт про штамп на странице",
    ).toBe(false);
    for (const файл of [
      "apps/cc/src/lib/theme.ts",
      "apps/cc/src/proxy.ts",
      "apps/cc/src/components/theme-sync.tsx",
      "apps/cc/src/app/theme/actions.ts",
      "apps/cc/src/components/header-actions.tsx",
    ]) {
      expect(existsSync(path.join(КОРЕНЬ, файл)), `§4 ссылается на ${файл}, а его нет`).toBe(true);
    }
  });

  it("доски из primitives.md существуют в CSS теми же селекторами", () => {
    for (const селектор of [
      ".crons-table",
      ".crons-table tr.is-paused td",
      ".flight",
      ".ph",
      '.ph[data-state="skip"]',
      ".flows-layout",
      ".flows-layout.reading .flow-detail",
      ".flow-timeline",
      "article.doc",
      ".approw",
      '.approw[data-state="unknown"]',
      ".aghead",
      ".docs-layout",
      ".docs-layout.reading .docs-body",
      ".brain-card-head",
    ]) {
      телоПравила(селектор);
    }
    // Одно число гашения на все доски — навык это утверждает, CSS обязан держать.
    expect(телоПравила(".crons-table tr.is-paused td")).toContain("0.55");
    expect(телоПравила('.ph[data-state="skip"]')).toContain("0.55");
    expect(телоПравила('.approw[data-state="unknown"]')).toContain("dashed");
  });
```

- [ ] Убедиться, что удалённый тест `назван долг primitives.md по классам досок M/R` (искал `.crons-table` в §9) больше не существует — иначе он покраснеет на очищенном §9.

### 5.7. Зеркала (генерируются, не правятся)

- [ ] Из корня репо:

```sh
for f in rules.md primitives.md checklist.md tokens.md SKILL.md; do
  cp .claude/skills/mydon-design/$f docs/agentic-os-starter/claude-skills/mydon-design/$f
done
for f in rules.md primitives.md checklist.md tokens.md; do
  cp .claude/skills/mydon-design/$f .agents/skills/mydon-design/$f
done
sed -e 's/CLAUDE\.md/AGENTS.md/g' -e 's/макеты Claude Design/макеты Codex Design/g' \
  .claude/skills/mydon-design/SKILL.md > .agents/skills/mydon-design/SKILL.md
```

- [ ] Сверить руками: `diff -r .claude/skills/mydon-design docs/agentic-os-starter/claude-skills/mydon-design` → пусто; `diff .claude/skills/mydon-design/SKILL.md .agents/skills/mydon-design/SKILL.md` → ровно две строки (п. 4 «макеты …» и п. «конвенция … в AGENTS.md»); остальные четыре файла `.agents/` — `diff` пустой.

### 5.8. Проверка

- [ ] `node docs/agentic-os-starter/verify-paths.mjs` → `Битых нет.` (пути `apps/cc/src/lib/theme.ts`, `apps/cc/src/proxy.ts`, `apps/cc/src/components/theme-sync.tsx`, `apps/cc/src/app/theme/actions.ts`, `apps/cc/src/components/bg/`, `docs/superpowers/specs/2026-09-07-design-wave-theme-design.md` обязаны существовать).
- [ ] `pnpm --filter @mydon/cc test -- src/test/design-skill.test.ts` → зелёный, число тестов выросло с 44 до 57.
- [ ] `pnpm --filter @mydon/cc test -- src/test/palette.test.ts` → зелёный (сторож палитры задачи 4, `color-scheme` в трёх блоках).
- [ ] `pnpm --filter @mydon/cc typecheck && pnpm --filter @mydon/cc lint` → зелёные (в тесте нет `any`, `existsSync` и `ТЁМНАЯ_ВЫБРАННАЯ` использованы).
- [ ] Откат-проверка: временно вернуть в `rules.md` строку `Для `/mydon`, `/agents`, …` из старого §4 → тест задачи 2 красный; временно вписать `ConsoleTheme` в `primitives.md` → «призраки среза Д2» красный; временно убрать `color-scheme: dark` из `:root[data-theme="dark"]` → «color-scheme объявлен во всех трёх блоках» красный. Вернуть всё как было.
- [ ] `grep -rn "ConsoleTheme" .claude/skills .agents/skills/mydon-design docs/agentic-os-starter/claude-skills` → пусто.

---

## Ловушки, названные авторами задач

- **(задача 1)** Next 16.2.12: `middleware.ts` объявлен устаревшим, каноническое имя — `src/proxy.ts` с `export function proxy`; оба распознаются (`get-page-static-info.js:246-247`), но создавать ОБА файла нельзя — сборка упадёт на конфликте. Файл лежит в `apps/cc/src/`, не в `src/app/`.

- **(задача 1)** `export const viewport` и `export async function generateViewport` в одном сегменте вместе не экспортируются — статический объект надо УДАЛИТЬ, иначе ошибка сборки.

- **(задача 1)** `data-theme={theme ?? undefined}` — именно `undefined`, не пустая строка и не `"system"`: только отсутствие атрибута оставляет работать `prefers-color-scheme`; строка `data-theme="system"` глушила бы медиа-ветку через `:not([data-theme="light"])`? нет — но она не совпала бы ни с одним селектором и стала бы третьим носителем, которого CSS не знает.

- **(задача 1)** `color-scheme` — не кастомное свойство: `палитраБлока`/`токеныПравила` в `test/css.ts` его не видят, поэтому старые сторожи «две ветки — один набор токенов» его НЕ проверяют; нужен новый describe из шага 6, иначе забытая вторая тёмная ветка пройдёт зелёной.

- **(задача 1)** В комментарии к `color-scheme` в `:root` нельзя писать числа вида `N,N:1` — сторож контраста (`palette.test.ts`, «КАЖДОЕ число контраста сходится с расчётом») считает их утверждениями и упадёт на не-токене.

- **(задача 1)** Прокси ПЕРЕЗАПИСЫВАЕТ `x-mydon-theme`/`x-mydon-console` (`headers.set`), а не дописывает: клиент может прислать свой заголовок; на путях вне matcher заголовок вообще не читается разметкой.

- **(задача 1)** Тест прокси обязан идти под `/** @vitest-environment node */`: общий default в `vitest.config.mts` — jsdom, а `NextRequest` расширяет платформенный `Request` Node.

- **(задача 1)** Layout-тест НЕ монтирует дерево: `<html>`/`<body>` в React 19 — синглтоны и при `render()` в контейнер захватывают настоящий `document.documentElement` с предупреждением «<html> cannot be a child of <div>» (проверено пробой на react-dom 19.2.8). Проверяется возвращённое дерево элементов.

- **(задача 1)** `vi.mock("../lib/core")` в layout-тесте резолвится в тот же модуль, что импорт `../lib/core` из layout (оба относительно `src/app/`); при переносе теста в другой каталог пути моков надо пересчитать.

- **(задача 1)** `import "./globals.css"` в layout под vitest безвреден: по умолчанию `test.css` не обрабатывает CSS и подставляет пустую строку; отдельного мока не нужно.

- **(задача 1)** Глубокий импорт `next/dist/lib/try-to-parse-path` в тесте matcher'а работает только потому, что у `next/package.json` нет поля `exports` (проверено на 16.2.12); при апгрейде Next, добавившем `exports`, тест matcher'а переписать на публичный API или пришпилить строку регэкспа.

- **(задача 1)** Кука с `Path=/` и `SameSite=Lax` пишется в задаче переключателя; прокси читает её через `request.cookies.get(THEME_COOKIE)?.value` — значение валидируется `isThemeChoice`, мусор равен отсутствию.

- **(задача 1)** После этой задачи `ConsoleTheme` ещё стоит на пяти страницах и при размонтировании ВОССТАНАВЛИВАЕТ снимок `prev` — до задачи ThemeSync SPA-переходы будут затирать серверный штамп; это ожидаемое промежуточное состояние ветки, не баг этой задачи, но мержить ветку между задачами 1 и 2 нельзя.

- **(задача 1)** `.bgw` (звёздное небо) включается любым `data-theme="dark"` — с этой задачи /mydon, /agents, /docs получают тёмный штамп и, при включённом тумблере `mydon_bg`, WebGL-фон на главной; решение спеки §1.3 — оставить как есть.

- **(задача 2)** Grep-сторож шага 8 читает ВСЕ текстовые файлы apps/cc/src, включая CSS и комментарии: слово `ConsoleTheme` в докблоке самого ThemeSync уронило его в песочнице — поэтому докблок объясняет отсутствие cleanup'а без имени снесённого компонента («прежний постраничный штамп темы»). Не «улучшать» комментарий, вписывая имя обратно.

- **(задача 2)** Кука `mydon_theme` ОБЯЗАНА быть без HttpOnly (задача 4, setTheme): ThemeSync читает `document.cookie`. С HttpOnly пользователь, выбравший тёмную на бизнес-экране, при переходе /stock → /parts получит светлую — ThemeSync не увидит куку и вернёт областной дефолт, а сервер с перезагрузкой покажет тёмную. Расхождение «клик по меню ≠ прямой адрес» — ровно тот дефект, от которого срез уходит.

- **(задача 2)** `themeFor` (задача 1) должна трактовать незнакомое значение куки как отсутствие: ThemeSync передаёт сырую строку без проверки намеренно, чтобы правило было одно. Если задача 1 бросает/возвращает мусор на «purple» — обсудить, не дублировать проверку в ThemeSync.

- **(задача 2)** Бэкап/восстановление при тестировании мутациями: в песочнице дважды подряд получил ложные результаты из-за грязного бэкапа (бэкап снимался ДО очистки) — при ручной проверке «падает при откате» сверять состояние файлов `grep -c artifacts` ПЕРЕД каждой мутацией, а не доверять порядку скрипта.

- **(задача 2)** rules.md — ТРИ байт-идентичные копии (.claude/skills, .agents/skills, docs/agentic-os-starter); design-skill.test.ts сверяет их дословно. Правка только канонической — красный CI без единого слова про тему.

- **(задача 2)** §9 rules.md по-прежнему упоминает ConsoleTheme и `/artifacts`, и существующий тест `rules.md §9: долг Д2 помечен` ЖДЁТ там `/artifacts`, `/docs` и т.д. Это вне apps/cc/src (grep-сторож не задевает), чистит задача 5 — и она обязана одновременно переписать тот describe в design-skill.test.ts, иначе красный.

- **(задача 2)** Маркер для задачи 5: в §4 ровно ОДНА строка с `` `CONSOLE_ROUTES` ``; список — в её абзаце (переносы до пустой строки / `- ` / `#` / `|` / `*`); упоминание `` `/artifacts` `` («появится в A3») — только в другом абзаце или буллете, иначе сторож дрейфа посчитает его девятым маршрутом (проверено мутацией M3: в соседнем буллете — зелёный, в абзаце маркера — красный).

- **(задача 2)** Корневой layout не перерисовывается при SPA-навигации (спека §5 п.1) — именно поэтому ThemeSync в layout, а не на страницах, и слушает `usePathname()`. После `router.refresh()` из переключателя (задача 4) pathname не меняется, эффект не срабатывает — и не должен: refresh перерисует `<html>` с сервера по новой куке.

- **(задача 2)** `restoreMocks: true` в vitest.config.mts панели: pathname в тесте — обычный объект из `vi.hoisted`, а не `vi.fn()` с реализацией, иначе restore перед каждым тестом обнулит её.

- **(задача 2)** После `git rm console-theme.tsx` typecheck может ругаться на кеш `.next/types` (урок из памяти: `.next/` кеш → ложные tsc после переезда роутов) — `pnpm --filter cc clean` и повторить.

- **(задача 2)** Codex работает параллельно в этом же репо: перед правками пяти страниц и layout сверить `git status`/mtime, чужие незакоммиченные изменения не перезаписывать.

- **(задача 2)** Next 16.2.12 при сборке и в dev печатает warnOnce: «The "middleware" file convention is deprecated. Please use "proxy" instead» (dist/build/index.js:651, setup-dev-bundler.js:354). Работать будет, но это относится к задаче 1 — см. вопросы.

- **(задача 2)** `useLayoutEffect` выбран вместо `useEffect`, чтобы не было кадра «новая страница в старой теме»; React 19.2.8 на сервере его не выполняет и не предупреждает (строки «useLayoutEffect does nothing on the server» в react-dom нет). При откате React на 18 появится предупреждение в SSR — тогда вернуть useEffect.

- **(задача 3)** Источник текущего состояния: `document.documentElement.dataset.theme` и заголовок `x-mydon-theme` несут ФАКТИЧЕСКУЮ тему (на /apps без куки — dark), а не выбор; контрол, взявший состояние оттуда, покажет «тёмная» вместо «как в системе». Единственный источник выбора — кука, читается в layout через `cookies()` и уходит пропсом. Чтение `document.cookie` при монтировании дало бы мигание контрола и расхождение гидрации.

- **(задача 3)** Кука НЕ должна быть `secure` (панель живёт по http за Tailscale — портал только http; `Secure` отрежет куку целиком) и НЕ `httpOnly` (Задача 2: `ThemeSync` читает `document.cookie`). Тест «кука не httpOnly и не secure» это сторожит.

- **(задача 3)** `delete` куки — с тем же `path: "/"`, что и при записи: браузер сопоставляет куки по имени+пути; `store.delete(THEME_COOKIE)` без пути — регресс, который тест ловит явным объектом `{ name, path }`.

- **(задача 3)** Файл с `"use server"` экспортирует наружу только async-функции: `YEAR_SECONDS` и `ALLOWED` не экспортировать (сборка Next упадёт); `export interface ActionResult` допустим — тип стирается (так уже в `catalog/actions.ts`).

- **(задача 3)** Server action — публичная точка входа: тип `ThemeChoice | "system"` ничего не гарантирует, с клиента может прийти любая строка. Валидация ДО записи; иначе в куке окажется значение, которое `themeFor` считает «нет куки», а переключатель — «выбрано».

- **(задача 3)** `<select>` не шлёт `change` на повторный выбор уже выбранного значения — без кнопки «повторить» отказ action оставляет владельца без пути повторить попытку (выбор в контроле есть, отправить его нечем). Кнопка = роль кнопки отправки формы из §7.

- **(задача 3)** Инициализатор `useState` в App Router выполняется один раз (урок из памяти проекта и `pause-toggles.tsx`): без `useEffect(() => setChoice(themeChoice), [themeChoice])` контрол не увидит куку, изменённую в другой вкладке, после `router.refresh()`.

- **(задача 3)** Ширина шапки на 390px: контролу остаётся ~112px; без `appearance: none` родная стрелка (~20px) выталкивает «MYDON» в многоточие (`.hdr h1` с `overflow: hidden`). Если в шапку позже добавят четвёртую кнопку — арифметику пересчитать.

- **(задача 3)** Правка `layout.tsx` пересекается с Задачей 2 по строкам импортов (`next/headers`, `../lib/theme`): сливать в один импорт, второй `import … from "next/headers"` — ошибка lint/дубликат.

- **(задача 3)** Установка куки в server action сама по себе вызывает серверную перерисовку текущей страницы и layout'ов (документация Next 16), плюс `router.refresh()` по конвенции репо — два RSC-запроса. Безвредно; НЕ убирать `router.refresh()` «как лишний»: конвенция §7 и тест на него.

- **(задача 3)** Стили контрола — только токенами, объявленными во всех трёх ветках палитры (`--surf`, `--tx-2`, `--line`, `--accent-line`, `--tx`): именно так переключатель «читается в обеих темах». Литерал цвета в `.hdr .theme-sw` ловит сторож; раскрытый список select красит браузер по `color-scheme` из Задачи 1 — без неё в тёмной теме список останется светлым.

- **(задача 3)** vitest-конфиг панели: `restoreMocks: true` + `vi.hoisted`-моки — реализации (`mockResolvedValue`, `mockImplementation`) задавать ВНУТРИ теста, `beforeEach(vi.resetAllMocks)`; фабрика `vi.mock("next/headers")` обязана отдавать `cookies` как async-функцию (в Next 16 `cookies()` — Promise).

- **(задача 3)** Слова «как в системе / светлая / тёмная» живут только в `header-actions.tsx` (`THEME_OPTIONS`): это не ось состояния из `lib/state.ts`, второго словаря не заводить; тест сверяет ровно эти три подписи и их порядок.

- **(задача 4)** СТЕК НАЛОЖЕНИЯ: `.app { position: relative; z-index: 1 }` (globals.css:239) выше `.bgw { position: fixed; z-index: 0 }` (:216) в одном корневом контексте. Фон на `.app[data-console="true"]` — как зафиксировал контроллер — лёг бы ПОВЕРХ неба; `::before` с `z-index: -1` не спасает (контекст `.app` целиком выше). Единственный слой «под небом и над --bg» — сам `body`. Отсюда `body:has(.app[data-console="true"])`.

- **(задача 4)** НЕ НА `<html>`: стоит корню получить любой фон — фон `body` перестаёт пропагироваться на канву, и непрозрачный `--bg` на `body` накрывает сетку. Только `body`, и только `background-image`+`background-size` (shorthand `background:` сбросит цвет холста).

- **(задача 4)** ОБА ПРАВИЛА — ОТДЕЛЬНЫМИ ПРАВИЛАМИ ВЕРХНЕГО УРОВНЯ, не CSS-вложенностью внутрь блоков палитры: `палитраБлока` фильтрует по точному селектору ветки, вложенность превратила бы объявления сетки в «токены» и уронила сторож «две ветки объявляют один набор».

- **(задача 4)** `последнееПравило(css, ".approw")` возвращает телефонную ступень `@media (max-width: 520px) { .approw { flex-wrap… } }` БЕЗ фона — поэтому в сторожe поверхностей свой хелпер `фонПоверхности` (последнее правило селектора, которое фон ОБЪЯВЛЯЕТ). На это наступил первый прогон.

- **(задача 4)** Число «1,23:1» в комментарии НЕ проверяется сторожем палитры: `объявленияСКомментарием` разбирает только строки вида `--token: value; /* … */`. Поэтому сторож сетки считает контраст сам (токен берёт ИЗ правила) и ищет в комментарии именно «контраст 1,23:1» со словом: комментарий называет и отвергнутые «`--line` (1,39:1)», и голое число одобрило бы подмену токена по чужой строке (мутация проверена).

- **(задача 4)** Радиус градиента 1px = точка ДИАМЕТРОМ ~2px со сглаженным краем — это стандартный dot-grid и формула, зафиксированная контроллером; буквальная точка 1px была бы `0.5px` (и тогда меняется ожидаемая строка в тесте). См. вопрос 3.

- **(задача 4)** Небо прозрачное (canvas `clearRect`, WebGL `alpha: true`), поэтому сетка видна и при включённом небе — просто под звёздами; при выключенном (`mydon_bg=0`) остаётся одна сетка. Это и есть решение спеки §1.3.

- **(задача 4)** НЕ ВСЁ НА КОНСОЛЬНЫХ МАРШРУТАХ ЛЕЖИТ В ПАНЕЛЯХ: `/crons` — `<table class="crons-table">` внутри `.crons-wrap { overflow-x: auto }` без фона; `/docs` — строки `.docs-tree .row` без фона (фон только у текущей); `/brain` — `.brain-results .row` без фона (только hover/current). Под их текстом сетка будет видна. Это не нарушение §4 (они не панели), но визуальное следствие — вопрос 2. `.brain-canvas`, `.doc-wrap`, `.agtile`, `.approw`, `.ph`, `.wt`, `.tile`, `.trow` — непрозрачный `--surf`, сетка под них не пробивается.

- **(задача 4)** Шапка `.hdr` (84% --bg + blur), таббар (92%) и сайдбар `.side` (`--overlay` + blur) полупрозрачны намеренно — сетка просвечивает сквозь них так же приглушённо, как небо. Не «чинить».

- **(задача 4)** Сетка привязана к МАРШРУТУ (`data-console`), небо — к ТЕМЕ: с кукой `dark` на `/stock` будет небо без сетки, с кукой `light` на `/apps` — ни того ни другого. Если `ThemeSync` (задача 3) забудет переключать `data-console` при SPA-навигации, сетка «протечёт» на бизнес-маршрут в тёмной теме; сторож CSS этого не поймает — только приёмка 4.5.

- **(задача 4)** `:has()` — уже в файле (`.brain-layout:has(.brain-card)`, поддержка Safari 15.4+/Chrome 105+/Firefox 121+ записана там же). Комбинатор ПОТОМКА, не `>`: обёртка-провайдер между `body` и `.app` в будущем не погасит сетку молча.

- **(задача 4)** Порядок в каскаде не важен (специфичность `body:has(.app[attr])` > `body`), но правила поставлены после `body { background }` и рядом с `.bgw` — как слой фона; не перемещать в конец файла «к остальному консольному».

- **(задача 4)** В рабочем дереве сейчас чужие правки (`apps/core/src/apps/apps-health*.ts`, `.agents/skills/*`) — параллельный Codex. Команда отката в 4.4 ограничена одним путём `apps/cc/src/app/globals.css`; `git stash` без пути утащил бы чужое.

- **(задача 4)** vitest создаёт `node_modules/.vite` в корне прогона — при воспроизведении моей песочницы (`--root` вне репо) симлинк `node_modules` надо делать ДО первого прогона, иначе ссылка ляжет внутрь кэша (наступил сам).

- **(задача 5)** Зеркала сверяются ПОБАЙТНО (`design-skill.test.ts`, блок «зеркала навыка mydon-design не разъезжаются»): любая правка руками в `.agents/` или `docs/agentic-os-starter/claude-skills/` — красный. Только `cp` из мастера; для `.agents/…/SKILL.md` — `sed` с двумя заменами, и в новом тексте SKILL.md нельзя писать `CLAUDE.md` или «макеты Claude Design» иначе, чем они уже стоят, иначе замена сломает смысл.

- **(задача 5)** Порядок задач: эта — последняя. `verify-paths.mjs` проверяет каждый путь в обратных кавычках, начинающийся с `apps/`, `docs/`, `.claude/` — до задач 1–4 ссылки на `lib/theme.ts`, `middleware.ts`, `theme-sync.tsx`, `theme/actions.ts` битые; сторож `existsSync` тоже красный.

- **(задача 5)** Существующие тесты §9 (`названы все расхождения маршрутного списка` — ищет `/mydon`, `/agents`, `/apps`, `/artifacts`, `/docs`; `назван долг primitives.md по классам досок M/R` — ищет `.crons-table` в §9) ОБЯЗАНЫ быть удалены вместе с блоком, иначе очищенный §9 их роняет. Заголовок якоря меняется: `## 9. Долг среза Д2` → `## 9. Долги после среза Д2`.

- **(задача 5)** Абзац под `<!-- CONSOLE_ROUTES -->` не должен содержать ни одного маршрута из `CONSOLE_ROUTES` как подстроки — включая косвенные вроде `/agents/[name]` или упоминания `/apps` в скобках. В плане абзац написан без них; при редактировании формулировки это правило держать. Путь `apps/cc/src/lib/theme.ts` безопасен: подстроки `/apps` в нём нет.

- **(задача 5)** Сторож §4 режет шапку по `indexOf("## 4. ")` (с пробелом) и `indexOf("### 4.1.")` — заголовки §4 и §4.1 менять нельзя; `## 4.1` без третьей решётки сломает срез.

- **(задача 5)** Тест `color-scheme` фильтрует правила по `контекст`+`селектор` ветки из `css.ts` (`:root`, `:root:not([data-theme="light"])` под `@media (prefers-color-scheme: dark)`, `:root[data-theme="dark"]`). Если задача 4 положит `color-scheme` в другой селектор (`html {…}`) — тест красный по праву: §4/§8 обещают три блока токенов. Существующий `.srcform input[type="datetime-local"] { color-scheme: light dark }` фильтром не задевается.

- **(задача 5)** Тест сетки ищет `radial-gradient` в теле и подстроку `.app[data-console="true"]` в селекторе (кавычки двойные, как в остальных data-атрибутах файла). Сегодня `radial-gradient` в `globals.css` ноль раз — любое другое применение градиента внутри `.panel`/`.card` сторож запретит; это намеренно (Р-Д2-7).

- **(задача 5)** `последнееПравило` сравнивает селектор после разбиения по запятой и `trim` — селекторы в тесте досок должны совпадать с CSS ДОСЛОВНО (`.flows-layout.reading .flow-detail`, `.docs-layout.reading .docs-body`, `.crons-table tr.is-paused td`); лишний пробел — «в globals.css нет правила».

- **(задача 5)** В тексте primitives.md нельзя писать «не состояния» (существующий тест про `.run-led`), а в хвосте «Чего нет» обязана остаться фраза «больше НЕ в этом списке» и не должно быть «§9».

- **(задача 5)** `article.doc h1` просит `font-weight: 800`, а у Golos загружены 600/700 (`app/layout.tsx`) — навык это называет как факт, не как норму; чинить CSS в этом срезе нельзя (Д1 закрыт, кегли отложены).

- **(задача 5)** `.brain-card` как самостоятельного CSS-правила нет — есть `.brain-card-head/-title/-path/-links`; в инвентаре `brain-card` описан как класс-хук на `.panel.console`, не выдумывать ему стили.

- **(задача 5)** Скобки в grep под zsh: `grep 'CONSOLE_ROUTES -->'` в одинарных кавычках; `for f in …` без массива работает, `$FILES` без `${=FILES}` — нет.

## Решения, принятые авторами задач самостоятельно

- **(задача 1)** Контроллер зафиксировал файл как `apps/cc/src/proxy.ts`, но в Next 16.2.12 (установленная версия) `middleware` объявлен устаревшим и заменён на `proxy.ts` / `export function proxy` (upgrade-guide 16, «middleware to proxy»; edge-рантайм у proxy не поддерживается — нам не нужен). Раздел написан под `src/proxy.ts`. Если контроллер настаивает на старом имени: переименовать файл в `src/middleware.ts`, функцию в `middleware`, тест — `src/middleware.test.ts` с импортом `{ config, middleware }`; тело и matcher идентичны. Другие разделы плана на имя файла не завязаны — только на заголовки `x-mydon-theme`/`x-mydon-console`.

- **(задача 1)** Добавлены три экспорта сверх зафиксированного интерфейса `theme.ts`: `CONSOLE_HEADER` (имя второго заголовка), `isThemeChoice` (общая проверка значения для прокси/layout/`setTheme`), `THEME_BG` (TS-дубль `--bg` для `themeColor`, пришпилен к CSS тестом). Просьба подтвердить, что задачи ThemeSync и переключателя импортируют `CONSOLE_HEADER`/`isThemeChoice` отсюда, а не заводят свои строки.

- **(задача 1)** Тест дрейфа `rules.md` §4 ↔ `CONSOLE_ROUTES` (Р-Д2-3) в этом разделе НЕ написан — он принадлежит задаче переписывания навыка (Р-Д2-8) и должен жить в `apps/cc/src/test/design-skill.test.ts` с импортом `CONSOLE_ROUTES` из `../lib/theme`. Сейчас §4 перечисляет `/artifacts` и не знает `/docs`,`/apps` — пока навык не переписан, такой тест был бы красным по факту.

- **(задача 1)** Сторож спеки «`grep ConsoleTheme apps/cc/src` пуст» упадёт не только на компоненте и пяти вызовах, но и на ДВУХ КОММЕНТАРИЯХ: `apps/cc/src/app/globals.css:1806` («через data-theme="dark" от <ConsoleTheme/>») и `apps/cc/src/components/brain-graph.tsx:560`. Их правка — в задаче ThemeSync; напомнить исполнителю той задачи.

- **(задача 1)** Атрибут `data-console` на `.app` ставится по ОБЛАСТИ (маршрут), а не по теме: при куке `light` на `/apps` он равен `"true"`, сетка не рисуется только потому, что её CSS-правило ограничено тёмными ветками. Подтвердить, что задача сетки пишет селекторы `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .app[data-console="true"] {…} }` и `:root[data-theme="dark"] .app[data-console="true"] {…}` — иначе сетка появится в светлой консоли.

- **(задача 1)** Смок через `curl` в шаге 9 требует локального dev-сервера с туннелем к Core; если у исполнителя его нет, достаточно vitest + typecheck, а SSR-проверку «/apps без data-theme="dark" → красный» (спека §4) закрывает пара тестов proxy.test + layout.test, каждый со своей половины провода.

- **(задача 2)** Задача 1: `apps/cc/src/proxy.ts` или `apps/cc/src/proxy.ts`? Next 16.2.12 объявляет конвенцию middleware устаревшей и печатает предупреждение на каждой сборке/старте dev; функционально оба работают. Раздел 2 не зависит от имени файла, но тест `theme-sync.tsx без next/headers` и вся цепочка «общий модуль без серверных импортов» одинаково применимы к обоим.

- **(задача 2)** Задача 4: подтвердить, что setTheme пишет куку БЕЗ HttpOnly (иначе ThemeSync слеп — см. ловушки). Если кука HttpOnly принципиальна, ThemeSync должен получать выбор иначе (например, `data-theme-choice` на `<html>` из layout) — это изменение интерфейса, здесь не реализовано.

- **(задача 2)** Тест «модуль знает решение владельца» (восемь маршрутов зашиты в theme-routes.test.ts) дублирует, вероятно, unit-тест задачи 1 на CONSOLE_ROUTES/themeFor. Оставлен как защита от «двух одинаково пустых копий»; если у задачи 1 есть эквивалент — контроллер может снять один из двух.

- **(задача 2)** Задача 5 при переписывании §4: сохранить абзац-маркер в описанном формате (одна строка с `CONSOLE_ROUTES`, список в её абзаце) и одновременно переписать describe «rules.md §9: долг Д2 помечен» в design-skill.test.ts, который сейчас требует в §9 `/artifacts` и упоминания ConsoleTheme.

- **(задача 2)** Ручная приёмка Р-Д2-4 требует поднятого dev-сервера с туннелем к Core (память: `pnpm --filter cc dev` + SSH-туннель 3001). В плане она помечена как «если поднят»; нужна ли обязательная ручная проверка перед мержем среза или достаточно тестов — решение контроллера.

- **(задача 3)** Задача 1: `themeFor(pathname, cookie)` при чужом значении куки (например `mydon_theme=blue`) должна вернуть областной дефолт, как при отсутствии куки — layout здесь считает такое значение «как в системе»; иначе контрол и страница разойдутся. Подтвердить в тестах Задачи 1.

- **(задача 3)** Задача 8 (навык): вписать `.theme-sw`/`.theme-retry` в `primitives.md` (строка «шапка») и в §4/§8 `rules.md` — переключатель словами, три состояния, источник = кука; чек-лист «Формы» расширить на немодальные контролы (select + «повторить»), чтобы правило §7 явно покрывало не только `<form>`.

- **(задача 3)** Проверить руками (шаг 3.7), что `router.refresh()` действительно обновляет `data-theme` на `<html>` без перезагрузки (ожидаю да: React диффит атрибуты `<html>` при перерисовке корневого layout). Если нет — Задача 2: `ThemeSync` слушает событие после успеха action, переключатель атрибут не пишет (один писатель).

- **(задача 3)** Порядок опций «как в системе → светлая → тёмная» и подпись `aria-label="Тема"` — принять или переименовать (тесты завязаны на эти слова).

- **(задача 3)** Кнопка «повторить» в шапке при отказе — принятая форма правила §7 для контрола без формы; альтернатива (сбрасывать выбор к серверному, как тумблеры пауз) отвергнута контроллером формулировкой «выбор не потерян». Подтвердить.

- **(задача 4)** 1. ОТКЛОНЕНИЕ ОТ ЗАФИКСИРОВАННОГО ИНТЕРФЕЙСА: контроллер записал «правило на `.app[data-console="true"]`», я ставлю на `body:has(.app[data-console="true"])` — иначе требование «под небом» невыполнимо физически (`.app` z-index 1 над `.bgw` z-index 0). Атрибутный контракт (`data-console` на `.app`) не меняется. Подтвердить. Фолбэк, если `:has()` отвергнут: два селектора `… .app[data-console="true"]` — тогда точки лягут ПОВЕРХ неба (тёмные дырки в свечении), а в тесте ожидаемый селектор и ассерт «лежит на body» переписываются под `.app`.

- **(задача 4)** 2. На `/crons` (таблица в `.crons-wrap` без фона), `/docs` (строки дерева) и `/brain` (строки результатов) текст лежит прямо на холсте — сетка будет видна под ним. Принять как есть (1,23:1 — очень тихо) или отдельной задачей обернуть эти списки в `.panel.console`? В CSS этого раздела не решается.

- **(задача 4)** 3. «Точка 1px»: формула контроллера `radial-gradient(circle, C 1px, transparent 1px)` даёт точку диаметром ~2px (радиус 1px). Оставить (стандартный dot-grid, соответствует спеке буквально) или `0.5px` для буквального 1px? Меняется одна строка в CSS ×2 и ожидаемая строка в тесте.

- **(задача 4)** 4. Список поверхностей в ассерте «непрозрачны»: `.panel.console`, `.card`, `.agtile`, `.approw`, `.ph`, `.doc-wrap` (консольный слой). Добавить `.wt`/`.tile` с главной `/mydon` (сегодня тоже `--surf`)? Расширяет запрет на бизнес-плитки — решение контроллера.

- **(задача 4)** 5. Кому достаётся правка `rules.md` §4 под факты сетки (шаг 4.6) и нужен ли в `design-skill.test.ts` ассерт факта «сетка на body / --line-soft / 1,23:1»? В этом разделе навык не трогается.

- **(задача 5)** Задача 2: подтвердить принятую форму маркера (`<!-- CONSOLE_ROUTES -->` отдельной строкой + абзац до пустой строки) и что тест дрейфа живёт рядом с модулем (`apps/cc/src/lib/theme.test.ts`), а не в `design-skill.test.ts`; если задача 2 берёт широкий охват (весь §4 до `### 4.1.`), текст плана это выдерживает — литералов маршрутов там нет.

- **(задача 5)** Задачи 3/4: `generateViewport` для `system` отдаёт пару по `prefers-color-scheme` (как нынешний статический `viewport`) или один цвет? В `tokens.md` записано «по медиазапросу» — поправить одну строку, если иначе.

- **(задача 5)** Задача 4: точный селектор сетки — план и тест рассчитывают на подстроку `.app[data-console="true"]` внутри обеих тёмных веток (`:root[data-theme="dark"] .app[data-console="true"]` и `:root:not([data-theme="light"]) .app[data-console="true"]` под медиа). Если селектор другой — синхронизировать §4 и тест.

- **(задача 5)** Оставлять ли в §4 фразу «сторож маршрутов роняет сборку» без имени файла (сделано намеренно, чтобы навык не ссылался на путь теста, который выбирает задача 2)? Если контроллер хочет путь — добавить после выбора файла задачей 2 (verify-paths проверит существование).

- **(задача 5)** Нужна ли запись в `docs/decisions/` о переименовании §9 и закрытии четырёх долгов, или это покрывает решение среза Д2 из другой задачи плана?
