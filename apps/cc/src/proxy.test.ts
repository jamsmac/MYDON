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
