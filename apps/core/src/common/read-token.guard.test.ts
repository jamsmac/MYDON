import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * СТОРОЖ ЧЕТЫРЁХ ДОКБЛОКОВ, КОТОРЫЕ ОПИСЫВАЮТ ОДИН И ТОТ ЖЕ ФАКТ.
 *
 * «Чтения (GET) в Core открыты» было правилом ровно до волны M. Дальше своя
 * читающая дверь появилась у `docs` (R-M-8), `routines` (волна R), `events`
 * (волна A1), `apps` (круг починок A2), а срез A3 добавил `attachments` и
 * `artifacts`. Каждая волна закрывала свою дверь И НЕ ТРОГАЛА докблоки, где
 * записано общее правило, — к A3 их накопилось три штуки, описывающих прошлый
 * мир: `ServiceTokenGuard` («вреда от чтения в закрытой сети нет»),
 * `appConfig.serviceToken` («чтения открыты в обоих случаях») и `getWithToken`
 * в панели («Документы — исключение»), причём последний называл исключением
 * одну дверь из шести. Нашёл это финальное ревью ветки глазами — то есть
 * случайно, а не проверкой.
 *
 * Поэтому список закрытых на чтение контроллеров здесь ВЫВОДИТСЯ ИЗ КОДА
 * (класс несёт `@UseGuards(<…>TokenGuard)`), а каждый докблок обязан назвать
 * КАЖДЫЙ из них. Седьмая закрытая дверь покраснит все ПЯТЬ мест сразу — и
 * автор допишет их вместе со своим guard'ом, а не через три волны. Пятое
 * место добавил круг починок 3 (C-1): предупреждение старта в `main.ts` —
 * единственный из этих текстов, который читает оператор, — говорило про одни
 * мутации, хотя пустой токен закрывает и чтения.
 *
 * Границы честности: сторож проверяет ПОЛНОТУ перечисления, а не качество
 * прозы. Переписать абзац другими словами можно; забыть в нём дверь — нельзя.
 */

// Тест исполняется из `dist/common`, а читает `src`: путь ищем по сегменту
// «core», как в `personal-read-surfaces.guard.test.ts`.
const ЧАСТИ = __dirname.split(path.sep);
const КОРЕНЬ_CORE = ЧАСТИ.slice(0, ЧАСТИ.lastIndexOf("core") + 1).join(path.sep);
const SRC = path.join(КОРЕНЬ_CORE, "src");
/** Корень монорепо: один докблок живёт в панели, а факт у него тот же. */
const КОРЕНЬ_РЕПО = path.resolve(КОРЕНЬ_CORE, "..", "..");

function контроллеры(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...контроллеры(p));
    else if (e.name.endsWith(".controller.ts")) out.push(p);
  }
  return out;
}

/**
 * Блок декораторов КЛАССА: строки непосредственно перед `export class`, вверх
 * до пустой строки или конца комментария.
 *
 * ПОЧЕМУ ОКНО ВОКРУГ КЛАССА, А НЕ «ТЕКСТ ПОСЛЕ @Controller». Прежний разбор
 * брал кусок между `@Controller("…")` и `export class`, а форму guard'а искал
 * регэкспом `@UseGuards\(\s*\w*TokenGuard\s*\)` — то есть РОВНО ОДИН аргумент
 * и только ПОСЛЕ `@Controller`. Седьмая закрытая дверь, написанная как
 * `@UseGuards(ReadTokenGuard, OwnerGuard)` или поставившая `@UseGuards` выше
 * `@Controller`, прошла бы вакуумно — при том что докблок сторожа обещает
 * «покраснит все четыре места сразу» (круг починок 3, B-2).
 */
function блокДекораторов(строки: string[], i: number): string {
  const out: string[] = [];
  for (let j = i - 1; j >= 0; j--) {
    const s = (строки[j] ?? "").trim();
    if (s.length === 0 || s.startsWith("//") || s.startsWith("*") || s.endsWith("*/")) break;
    out.unshift(s);
  }
  return out.join("\n");
}

/**
 * Маршруты, закрытые токеном НА ЧТЕНИЕ целым классом, — из одного исходника.
 *
 * Классовый guard, а не маршрутный: `GET /agents/status` и `GET /agents/skills`
 * закрыты по отдельности намеренно (рядом живут открытые `GET /agents` и
 * `GET /agents/:name`), поэтому `AgentsController` в этот список не входит — и
 * докблоки называют его отдельно, как два маршрута. Отсюда и окно: маршрутные
 * `@UseGuards` живут в ТЕЛЕ класса и в блок декораторов не попадают.
 *
 * Границы честности разбора: «класс несёт `@UseGuards`, и среди его
 * декораторов упомянут `…TokenGuard`». Проверка идёт по подстроке после
 * `@UseGuards(`, а не по одному регэкспу со списком аргументов: у guard'а
 * может стоять вызов с собственными скобками (`AuthGuard("jwt")`), и
 * `[^)]*` оборвался бы на первой из них.
 */
export function двериТекста(text: string): { маршрут: string; класс: string }[] {
  const out: { маршрут: string; класс: string }[] = [];
  const строки = text.split("\n");
  for (let i = 0; i < строки.length; i += 1) {
    const класс = /^export class (\w+)/.exec(строки[i] ?? "");
    if (класс === null) continue;
    const блок = блокДекораторов(строки, i);
    const маршрут = /@Controller\("([^"]+)"\)/.exec(блок);
    if (маршрут === null) continue;
    const guard = блок.indexOf("@UseGuards(");
    if (guard === -1 || !/TokenGuard\b/.test(блок.slice(guard))) continue;
    out.push({ маршрут: маршрут[1] ?? "", класс: класс[1] ?? "" });
  }
  return out;
}

function закрытыеНаЧтение(): { маршрут: string; класс: string }[] {
  const out: { маршрут: string; класс: string }[] = [];
  for (const file of контроллеры(SRC)) {
    out.push(...двериТекста(readFileSync(file, "utf8")));
  }
  return out.sort((a, b) => a.маршрут.localeCompare(b.маршрут));
}

/** Кусок файла от одной строки-якоря до другой: докблок, а не весь модуль. */
function докблок(файл: string, от: string, до: string): string {
  const text = readFileSync(path.join(КОРЕНЬ_РЕПО, файл), "utf8");
  const i = text.indexOf(от);
  assert.ok(i > -1, `в ${файл} нет якоря «${от}» — докблок переписан, сторож ослеп`);
  const j = text.indexOf(до, i);
  assert.ok(j > i, `в ${файл} нет якоря «${до}» после «${от}»`);
  return text.slice(i, j);
}

describe("докблоки про «GET открыт» знают все закрытые на чтение двери", () => {
  const закрытые = закрытыеНаЧтение();

  it("разбор видит формы, которые прежний регэксп пропускал (круг починок 3, B-2)", () => {
    // Три формы одной и той же закрытой двери. Первая — единственная, что
    // проходила прежний регэксп; из-за остальных двух сторож полноты мог быть
    // зелёным при седьмой двери, не названной ни в одном докблоке.
    assert.deepEqual(двериТекста('@Controller("one")\n@UseGuards(ReadTokenGuard)\nexport class OneController {}'), [
      { маршрут: "one", класс: "OneController" },
    ]);
    assert.deepEqual(
      двериТекста('@Controller("two")\n@UseGuards(ReadTokenGuard, OwnerGuard)\nexport class TwoController {}'),
      [{ маршрут: "two", класс: "TwoController" }],
      "два аргумента у @UseGuards — та же закрытая дверь",
    );
    assert.deepEqual(
      двериТекста('@UseGuards(ReadTokenGuard)\n@Controller("three")\nexport class ThreeController {}'),
      [{ маршрут: "three", класс: "ThreeController" }],
      "порядок декораторов Nest не важен, и сторожу он тоже не должен быть важен",
    );
    assert.deepEqual(
      двериТекста('@Controller("four")\n@UseGuards(\n  ReadTokenGuard,\n)\nexport class FourController {}'),
      [{ маршрут: "four", класс: "FourController" }],
      "@UseGuards в несколько строк",
    );

    // И обратная половина: маршрутный guard в ТЕЛЕ класса дверью класса не
    // является (`AgentsController` закрывает два GET по отдельности), а
    // контроллер без guard'а — тем более.
    assert.deepEqual(
      двериТекста(
        '@Controller("agents")\nexport class AgentsController {\n  @Get("status")\n  @UseGuards(ReadTokenGuard)\n  status() {}\n}',
      ),
      [],
    );
    assert.deepEqual(двериТекста('@Controller("open")\nexport class OpenController {}'), []);
  });

  it("двери находятся в коде, а не в списке в тесте", () => {
    // Если разбор перестанет находить контроллеры (переименование декоратора,
    // другой стиль), все ассерты ниже станут зелёными на пустом множестве.
    assert.ok(закрытые.length >= 6, `нашли ${закрытые.length} закрытых контроллеров — разбор сломан`);
    for (const маршрут of ["artifacts", "attachments", "apps", "docs", "events", "routines"]) {
      assert.ok(
        закрытые.some((c) => c.маршрут === маршрут),
        `${маршрут} не опознан как закрытый на чтение`,
      );
    }
  });

  it("докблок ServiceTokenGuard называет КАЖДУЮ закрытую дверь классом", () => {
    const текст = докблок(
      "apps/core/src/common/service-token.guard.ts",
      "Граница доступа Core",
      "export class ServiceTokenGuard",
    );
    for (const { класс } of закрытые) {
      assert.ok(текст.includes(класс), `докблок ServiceTokenGuard не знает про ${класс}`);
    }
    assert.ok(
      !/Чтения \(GET\) открыты: панель и бот читают много/.test(текст),
      "вернулась формулировка «вреда от чтения в закрытой сети нет» — она описывает мир до волны M",
    );
  });

  it("докблок ReadTokenGuard называет своих носителей и три прежних guard'а", () => {
    const текст = докблок(
      "apps/core/src/common/read-token.guard.ts",
      "Токен обязателен и на ЧТЕНИЕ",
      "export class ReadTokenGuard",
    );
    for (const { класс } of закрытые) {
      assert.ok(текст.includes(класс), `докблок ReadTokenGuard не знает про ${класс}`);
    }
  });

  it("докблок appConfig.serviceToken не обещает открытых чтений", () => {
    const текст = докблок(
      "apps/core/src/config.ts",
      "Внутренний токен доступа к Core",
      "get serviceToken",
    );
    for (const { маршрут } of закрытые) {
      assert.ok(текст.includes(маршрут), `докблок serviceToken не знает про ${маршрут}`);
    }
    assert.ok(
      !текст.includes("чтения открыты в обоих случаях"),
      "вернулось «чтения открыты в обоих случаях» — при пустом токене эти двери отказывают всем",
    );
  });

  it("предупреждение старта Core не обещает оператору только мутации (круг починок 3, C-1)", () => {
    // ПЯТОЕ место с тем же фактом — и единственное, которое читает ОПЕРАТОР.
    // Ветка записала «чтения открыты не все» в config.ts, а сообщение старта
    // так и говорило про одни мутации: при пустом токене панель получает 401
    // на архив, и оператор шёл искать поломку в контейнере, а не в .env.
    const текст = докблок("apps/core/src/main.ts", "ВНИМАНИЕ: SERVICE_TOKEN не задан", "void bootstrap();");
    for (const { маршрут } of закрытые) {
      assert.ok(текст.includes(`/${маршрут}`), `предупреждение старта не знает про /${маршрут}`);
    }
    assert.ok(
      /ЧТЕНИЯ/.test(текст),
      "в предупреждении снова только мутации — при пустом токене закрыты и чтения",
    );
  });

  it("докблок getWithToken в панели знает все шесть дверей, а не одни документы", () => {
    // Панель — главный читатель этих дверей: каждая из них ходит `getWithToken`,
    // а не `get()`. Пока докблок называл исключением только `/docs`, следующий
    // автор имел все основания взять `get()` и получить 401 на проде.
    const текст = докблок(
      "apps/cc/src/lib/core.ts",
      "Чтение из Core С СЕРВИСНЫМ ТОКЕНОМ",
      "async function getWithToken",
    );
    for (const { маршрут } of закрытые) {
      assert.ok(текст.includes(`/${маршрут}`), `докблок getWithToken не знает про /${маршрут}`);
    }
  });
});
