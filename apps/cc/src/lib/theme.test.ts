import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    //
    // Путь строится как в `test/css.ts` (`path.resolve` + `fileURLToPath`), а
    // не литеральным `new URL("./theme.ts", import.meta.url)`: под jsdom Vite
    // статически распознаёт именно этот паттерн как ссылку на ассет и
    // подменяет его на URL дев-сервера (`http://localhost:3000/…`), из-за чего
    // `readFileSync` падал на схеме URL, а не на содержимом файла. Приём из
    // `css.ts` работает и под jsdom, и под node — докблок окружения не нужен.
    const источник = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./theme.ts"),
      "utf8",
    );
    expect(источник).not.toMatch(/^\s*import\s/m);
    // Динамический импорт (`await import(…)`) не начинается со строки и не
    // содержит `require(` — прежняя пара проверок его не ловила, хотя в
    // клиентской сборке `import("next/headers")` уронил бы её ровно так же,
    // как обычный `import … from`.
    expect(источник).not.toMatch(/\bimport\s*\(/);
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
