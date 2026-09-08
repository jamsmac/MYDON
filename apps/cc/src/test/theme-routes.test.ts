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
