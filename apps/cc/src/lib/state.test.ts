// @vitest-environment node
//
// Только чтение файлов, без DOM: под jsdom (общий environment пакета)
// относительные URL резолвятся от window.location, а не от файла теста, и
// readFileSync падает ENOENT — тесту не нужен рендер (тот же приём, что в
// `components/snack-format.test.tsx`).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AGENT_STATE_WORD, CARD_WORD, HEALTH_WORD, PAUSE_WORD } from "./state";

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ДОМ = path.join("lib", "state.ts");

/**
 * Слова состояний, у которых в панели ровно один дом — `lib/state.ts`.
 *
 * Список сверяется с самими словарями ассертом ниже, поэтому забыть пополнить
 * его при новом состоянии нельзя: тест покраснеет на equality, а не промолчит.
 */
const СЛОВА = [
  "работает",
  "затык",
  "на паузе",
  "молчит",
  "в порядке",
  "сломано",
  "не оценить",
  "выключен",
  "не заведён",
  "в архиве",
  "работают",
] as const;

/**
 * Чужие дома, разрешённые ЯВНО, — с причиной у каждого.
 *
 * Единственный вход: сотрудник — не система. Его «работает» значит «в штате» и
 * стоит рядом с кнопкой «Больше не работает». Свести человеческую занятость в
 * словарь состояний СИСТЕМЫ значило бы положить «в штате» рядом с «занят прямо
 * сейчас» — то самое смешение, от которого этот модуль и заводился.
 */
const ИСКЛЮЧЕНИЯ: Record<string, readonly string[]> = {
  [path.join("components", "person-editor.tsx")]: ["работает"],
};

/**
 * Файлы, которые ОБЯЗАНЫ брать состояние из словаря.
 *
 * Список зашит константой и роняет тест при откате правки в любом отдельном
 * файле: сторож по словам поймал бы возврат литерала, а этот — ещё и молчаливое
 * «выкинули состояние совсем». Список минимальный, а не полный: новый экран
 * держит сторож по словам.
 */
const ПОТРЕБИТЕЛИ = [
  path.join("components", "agent-grid.tsx"),
  path.join("app", "agents", "[name]", "page.tsx"),
  path.join("app", "apps", "page.tsx"),
  path.join("components", "skills-deck.tsx"),
  path.join("app", "agents", "page.tsx"),
  path.join("app", "team", "page.tsx"),
  path.join("components", "agent-editor.tsx"),
  path.join("components", "pause-toggles.tsx"),
] as const;

/** Все исходники панели, кроме самих тестов: путь относительно `src`. */
function исходники(dir: string): string[] {
  const out: string[] = [];
  for (const имя of readdirSync(dir)) {
    const полный = path.join(dir, имя);
    if (statSync(полный).isDirectory()) {
      out.push(...исходники(полный));
      continue;
    }
    if (!/\.tsx?$/.test(имя)) continue;
    if (/\.test\.tsx?$/.test(имя)) continue;
    out.push(path.relative(КОРЕНЬ, полный));
  }
  return out;
}

const ФАЙЛЫ = исходники(КОРЕНЬ);
const текст = (rel: string): string => readFileSync(path.join(КОРЕНЬ, rel), "utf8");

/**
 * Сторож ПО ИСХОДНИКУ (срез Д1, Р-Д1-6), приёмом `snack-format.test.tsx`.
 *
 * Ищем слово как ЦЕЛЫЙ строковый литерал — `"работает"`, `'работает'` или
 * `` `работает` ``. Именно эту форму имеют и словарь (`working: "работает"`), и
 * тернарник в разметке (`status === "active" ? "работает" : …`), то есть оба
 * способа завести второй словарь. Проза мимо не попадает: «Работают 3 из 12»
 * или «работают расписания» лежат внутри более длинных литералов.
 *
 * ЧЕГО СТОРОЖ НЕ ЛОВИТ, и это надо знать: слово, набранное голым JSX-текстом.
 * Так печатает чип в `components/ourvend-health-view.tsx` («не оценить» о
 * здоровье сбора OurVend) — это не словарь, а разовая фраза бизнес-листа, и
 * трогать её срез Д1 не должен.
 */
describe("Один словарь состояний на панель (срез Д1, Р-Д1-6)", () => {
  it("список сторожа сходится с самими словарями — новое состояние не проскочит", () => {
    const объявленные = new Set<string>([
      ...Object.values(AGENT_STATE_WORD),
      ...Object.values(HEALTH_WORD),
      ...Object.values(CARD_WORD),
      ...Object.values(PAUSE_WORD),
    ]);
    expect(отсортировано(объявленные)).toEqual([...СЛОВА].sort());
  });

  it("слова состояний объявлены в lib/state.ts — дом настоящий, а не пустой", () => {
    const дом = текст(ДОМ);
    for (const слово of СЛОВА) {
      expect(дом, `слово «${слово}» пропало из lib/state.ts`).toMatch(литерал(слово));
    }
  });

  it("второго словаря в apps/cc/src не осталось", () => {
    const лишние: string[] = [];
    for (const rel of ФАЙЛЫ) {
      if (rel === ДОМ) continue;
      const разрешено = ИСКЛЮЧЕНИЯ[rel] ?? [];
      const код = текст(rel);
      for (const слово of СЛОВА) {
        if (разрешено.includes(слово)) continue;
        if (литерал(слово).test(код)) лишние.push(`${rel}: «${слово}»`);
      }
    }
    // Печатаем ВЕСЬ список, а не первое попадание: правка словарей идёт
    // пачкой, и чинить её по одному файлу за прогон — потерянные полчаса.
    expect(лишние, `состояние названо словом мимо lib/state.ts:\n${лишние.join("\n")}`).toEqual([]);
  });

  it("исключение не протухло: person-editor.tsx всё ещё печатает «работает» сам", () => {
    // Исключение без потребителя — это разрешение на будущее, которого никто
    // не просил. Если файл переписали, вход в списке надо снять, а не хранить.
    for (const [rel, слова] of Object.entries(ИСКЛЮЧЕНИЯ)) {
      const код = текст(rel);
      for (const слово of слова) {
        expect(код, `исключение ${rel} → «${слово}» больше не нужно`).toMatch(литерал(слово));
      }
    }
  });

  it("каждый экран состояний берёт слово из lib/state", () => {
    for (const rel of ПОТРЕБИТЕЛИ) {
      expect(текст(rel), `${rel} не импортирует lib/state`).toMatch(
        /from "(?:\.\.\/)+lib\/state"/,
      );
    }
  });
});

/**
 * Сторож ВТОРОЙ ФУНКЦИИ ДАВНОСТИ (срез Д1).
 *
 * Дом давности один — `lib/format.ts`. Локальная `ago()` в `sources-view.tsx`
 * считала от `Date.now()`, тогда как вся грамматика центра сознательно считает
 * от времени Core (`lib/crons.ts`, `components/agent-grid.tsx`): на границе
 * суток два таких счёта расходятся, и соседние строки одного экрана назвали бы
 * один факт по-разному.
 *
 * Формы «вчера 17:03» (`components/service-tab.tsx`) и «истёк N дней назад»
 * (`components/expiry-book.tsx`) под запрет НЕ попадают: первая — день плюс
 * время, родня `dayLabel`, вторая — доменная фраза от календарной даты
 * `YYYY-MM-DD`, а не от ISO-момента.
 */
describe("Функция давности в панели одна (срез Д1)", () => {
  it("объявление `ago` есть только в lib/format.ts", () => {
    const дом = path.join("lib", "format.ts");
    expect(текст(дом)).toMatch(/export function ago\(iso: string, now: Date\): string/);
    const лишние = ФАЙЛЫ.filter(
      (rel) => rel !== дом && /\b(?:function|const|let|var)\s+ago\b/.test(текст(rel)),
    );
    expect(лишние, `своя давность мимо lib/format.ts:\n${лишние.join("\n")}`).toEqual([]);
  });

  it("sources-view.tsx берёт давность из lib/format", () => {
    expect(текст(path.join("components", "sources-view.tsx"))).toMatch(
      /import \{ ago \} from "\.\.\/lib\/format";/,
    );
  });
});

/** Слово как ЦЕЛЫЙ строковый литерал в любых кавычках. */
function литерал(слово: string): RegExp {
  return new RegExp(`(["'\`])${слово}\\1`);
}

/** Отсортированный массив из множества — ради читаемого diff в упавшем тесте. */
function отсортировано(набор: ReadonlySet<string>): string[] {
  return [...набор].sort();
}
