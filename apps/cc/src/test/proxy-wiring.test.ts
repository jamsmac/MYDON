/** @vitest-environment node */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { getPossibleMiddlewareFilenames } from "next/dist/build/utils";

/*
 * Сторож провода (круг починок 1, Р-Д2-1): `proxy.test.ts` импортирует
 * `./proxy` ОТНОСИТЕЛЬНЫМ путём — такой импорт срабатывает из любого места на
 * диске, и переименование файла в `middleware.ts` или перенос из `src/` в
 * корень пакета прошли бы мимо него зелёными, typecheck и lint остались бы
 * чистыми, а Next молча перестал бы подхватывать штамп темы: консоль
 * вернулась бы к светлому первому кадру без единого красного теста.
 *
 * Утверждается ФАКТ РАСПОЛОЖЕНИЯ — тем же кодом, что и сборка Next
 * (`next/dist/build/utils`, `getPossibleMiddlewareFilenames`): она строит
 * список кандидатов `middleware.<ext>` / `proxy.<ext>` относительно папки,
 * СОСЕДНЕЙ с `app/` (Next берёт `path.join(rootDir, "..")`, где `rootDir` —
 * `src/app`; проверено чтением
 * `next/dist/server/lib/router-utils/setup-dev-bundler.js`) — то есть
 * `apps/cc/src/`, а не корень пакета `apps/cc/` и не внутри `app/`.
 */
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app");
const SRC_DIR = path.resolve(APP_DIR, "..");
// `next.config.mjs` не переопределяет `pageExtensions` — берём дефолт Next 16.
const EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const CANONICAL = path.join(SRC_DIR, "proxy.ts");

describe("proxy: файл лежит там, где его ищет Next (Р-Д2-1)", () => {
  it("среди ВСЕХ кандидатов Next на диске существует ровно один — src/proxy.ts", () => {
    // `middleware.*` в списке кандидатов НЕ случайность: Next 16 ищет и
    // устаревшее имя тоже (см. `proxy.ts` — оба распознаются
    // `get-page-static-info.js`). Существовать должен ровно один файл — наш,
    // с новым именем; появление второго (переименование, а не перенос) уже
    // само по себе дрейф от решения задачи 1.
    const кандидаты = getPossibleMiddlewareFilenames(SRC_DIR, EXTENSIONS);
    const существующие = кандидаты.filter((f) => existsSync(f));
    expect(существующие).toEqual([CANONICAL]);
  });

  it("на канонической позиции экспортирована функция proxy", async () => {
    // Импорт по АБСОЛЮТНОМУ пути, вычисленному кандидатом Next, а не по
    // относительному `./proxy`: относительный импорт сработал бы и после
    // переименования файла (модуль остался бы на месте под старым
    // специфайером), и дрейф остался бы незамеченным.
    const модуль: unknown = await import(pathToFileURL(CANONICAL).href);
    expect(typeof (модуль as { proxy?: unknown }).proxy).toBe("function");
  });
});
