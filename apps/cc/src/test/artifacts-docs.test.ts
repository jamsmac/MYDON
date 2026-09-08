import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Сторож документации среза A3 «Кольцо артефактов».
 *
 * Решение, план ARMS, указатель памяти, рунбук MCP и навык дизайна — markdown:
 * их откат не роняет ни сборку, ни рантайм. Премиса «данные уже в Core —
 * нужна витрина» прожила в плане три волны ровно потому, что её никто не
 * сверял с кодом. Здесь ПРОВЕРЯЮТСЯ ФАКТЫ, а не формулировки: имена файлов,
 * констант, маршрутов, дата начала архива и пять причин «чего срез не делает»
 * из спеки §3. Переписать абзац другими словами можно; вынуть из него факт —
 * нет. Утверждения о коде сверяются с самим кодом (как в `design-skill.test.ts`).
 */

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const есть = (относительный: string): boolean => existsSync(path.join(КОРЕНЬ, относительный));
const читать = (относительный: string): string =>
  readFileSync(path.join(КОРЕНЬ, относительный), "utf8");

/** Проверки идут по тексту без переносов: абзац можно перенести иначе. */
const склеить = (s: string): string => s.replace(/\s+/g, " ");

const СПЕКА = "docs/superpowers/specs/2026-09-07-artifacts-ring-design.md";
const ЗАПИСКА = ".superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md";
const РЕШЕНИЕ = "docs/decisions/2026-09-07-artifacts-ring.md";
const ПЛАН = "docs/AGENTIC_OS_ARMS_PLAN.md";
const НАВЫК = ".claude/skills/mydon-design";

const решение = склеить(читать(РЕШЕНИЕ));
const план = читать(ПЛАН);

/** §6.4 плана целиком — нумерация пунктов повторяется в §6.1–6.3, резать надо внутри волны. */
const волнаA = план.slice(план.indexOf("### 6.4 Волна A"), план.indexOf("### 6.5"));

/** Пункт нумерованного списка §6.4 — от «N. **» до «N+1. **»; последний — до конца раздела. */
function пунктВолныA(номер: number): string {
  const начало = волнаA.indexOf(`\n${номер}. **`);
  expect(начало, `в §6.4 плана нет пункта ${номер}`).toBeGreaterThan(-1);
  const конец = волнаA.indexOf(`\n${номер + 1}. **`, начало + 1);
  return склеить(волнаA.slice(начало, конец === -1 ? undefined : конец));
}

/** Дата начала архива из кода — ОДИН источник для экрана, плана и решения. */
function датаНачалаАрхива(): { iso: string; печатная: string } {
  const m = /ARTIFACTS_SINCE\s*=\s*"(\d{4})-(\d{2})-(\d{2})"/.exec(читать("apps/cc/src/lib/artifacts.ts"));
  expect(m, 'в apps/cc/src/lib/artifacts.ts нет ARTIFACTS_SINCE = "YYYY-MM-DD"').not.toBeNull();
  const год = m?.[1] ?? "";
  const месяц = m?.[2] ?? "";
  const день = m?.[3] ?? "";
  return { iso: `${год}-${месяц}-${день}`, печатная: `${день}.${месяц}.${год}` };
}

describe("решение среза A3 записано и названо по конвенции аудита", () => {
  it("имя файла — дата спеки + slug: так его ищет tools/repo-audit.mjs («Спеки без решения»)", () => {
    const m = /^(\d{4}-\d{2}-\d{2})-(.+)-design\.md$/.exec(path.basename(СПЕКА));
    expect(m, "имя спеки не по шаблону <дата>-<slug>-design.md").not.toBeNull();
    const дата = m?.[1] ?? "";
    const slug = m?.[2] ?? "";
    expect(РЕШЕНИЕ).toBe(`docs/decisions/${дата}-${slug}.md`);
    expect(есть(РЕШЕНИЕ), `нет файла ${РЕШЕНИЕ}`).toBe(true);
  });

  it("решение ссылается на спеку и записку о премисе", () => {
    expect(решение).toContain(СПЕКА);
    expect(решение).toContain(ЗАПИСКА);
  });

  it("субстрат назван, и `document` помечена в схеме, а не снесена (Р-A3-8)", () => {
    expect(решение).toContain("## Р-1. Субстрат — `attachment`, не `document`");
    const схема = читать("packages/db/src/schema.ts");
    expect(схема, "таблица document снесена — Р-6 говорит обратное").toContain('pgTable("document"');
    expect(схема, "в схеме нет пометки об устаревшей document").toContain(
      "УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment (срез A3).",
    );
  });

  it("«чего срез НЕ делает» — все пять причин спеки §3 на месте", () => {
    for (const причина of [
      "автосохранение каждого черновика забило бы архив",
      "их существование не подтверждено",
      "Не сносит `document`",
      "только по `title`",
      "их `ownerType` и маршруты как были",
    ]) {
      expect(решение, `в решении нет причины «${причина}»`).toContain(причина);
    }
  });

  it("миграция 0089 — обычный индекс, и решение объясняет, почему не CONCURRENTLY", () => {
    const миграция = читать("packages/db/drizzle/0089_attachment_artifacts.sql");
    expect(миграция).toContain("attachment_kind_created_idx");
    // Слово CONCURRENTLY в файле ЕСТЬ — в комментарии, объясняющем, почему его
    // тут нет: причина отказа живёт рядом с оператором (Р-5). Поэтому сверяем
    // ИСПОЛНЯЕМУЮ часть, выбросив строки комментариев: запрет на слово целиком
    // заставил бы автора вынести причину из файла, где её и читают.
    const исполняемое = миграция
      .split("\n")
      .filter((s) => !s.trimStart().startsWith("--"))
      .join("\n");
    expect(исполняемое, "CONCURRENTLY внутри транзакции мигратора упадёт — Р-5").not.toContain(
      "CONCURRENTLY",
    );
    expect(миграция, "причина отказа от CONCURRENTLY ушла из миграции").toContain("CONCURRENTLY");
    expect(решение).toContain("drizzle-orm/postgres-js/migrator");
    expect(решение).toContain("CONCURRENTLY");
  });
});

/**
 * ЛОВУШКА СПЕКИ §6 п. 3 — условие выката среза, и она проверяется по коду в
 * ОБЕ стороны. Ruling решения утверждает: `raw` закрыт вместе со всем
 * `AttachmentsController`, а панель носит токен. Оба утверждения — про код;
 * откат любого из них делает ruling ложью, а полевой контур или витрину —
 * сломанными.
 */
describe("ruling про закрытие вложений сверяется с кодом Core и панели", () => {
  const контроллер = читать("apps/core/src/attachments/attachments.controller.ts");

  it("guard стоит на КЛАССЕ контроллера вложений, и @Public() снят", () => {
    expect(
      контроллер,
      "нет @UseGuards(ReadTokenGuard) на AttachmentsController — ruling врёт, что вложения закрыты",
    ).toMatch(/@Controller\("attachments"\)\s*@UseGuards\(ReadTokenGuard\)/);
    expect(
      контроллер,
      "@Public() вернулся: на GET он ничего не значит и просто утверждает неправду",
    ).not.toContain("@Public()");
  });

  it("прокси панели носит токен — иначе закрытие Core ломает фото и чеки", () => {
    const core = читать("apps/cc/src/lib/core.ts");
    const начало = core.indexOf("export async function coreBytes(");
    expect(начало, "в core.ts нет coreBytes").toBeGreaterThan(-1);
    const конец = core.indexOf("\nexport ", начало + 1);
    const тело = core.slice(начало, конец === -1 ? undefined : конец);
    expect(тело, "coreBytes без заголовков Core = 401 в <img> вместо файла").toContain(
      "coreWriteHeaders",
    );
    expect(
      есть("apps/cc/src/app/api/attachments/[id]/raw/route.token.test.ts"),
      "сторож пары «дверь закрыта / файл доезжает» удалён",
    ).toBe(true);
  });

  it("рунбук предупреждает отладчика: curl без заголовка теперь 401, а не поломка хранилища", () => {
    // Полевой контур отлаживают с сервера curl'ом. Пока рунбук молчит, первый
    // же 401 на фото читается как «упало хранилище» — и лечиться будет не то.
    const рунбук = склеить(читать("docs/AGENTS_ACTIVATION.md"));
    expect(рунбук, "рунбук не знает, что контроллер вложений закрыт").toContain(
      "весь `AttachmentsController`",
    );
    expect(рунбук).toContain("x-service-token: $SERVICE_TOKEN");
    expect(рунбук, "рунбук не ведёт к решению среза").toContain(РЕШЕНИЕ);
  });

  it("сколько у вложений маршрутов — столько и названо (круг починок 3, C-5)", () => {
    // «Пять маршрутов» жило в решении и в схеме, а `@Delete(":id")` был
    // шестым с самого начала. Число — довод Р-1 («у attachment живой код, у
    // document ноль»), поэтому считаем его по контроллеру, а не по памяти.
    const маршрутов = (контроллер.match(/^\s*@(?:Get|Post|Put|Patch|Delete)\(/gm) ?? []).length;
    expect(маршрутов, "разбор маршрутов контроллера сломан").toBeGreaterThanOrEqual(6);
    const словом = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь"][маршрутов];
    expect(решение, `решение называет не ${словом} маршрутов, а их ${маршрутов}`).toContain(
      `${словом} маршрут`,
    );
    expect(
      склеить(читать("packages/db/src/schema.ts")),
      `схема называет не ${словом} маршрутов вложений`,
    ).toContain(`${словом} маршрут`);
  });

  it("ruling называет причины, а не только вывод", () => {
    for (const факт of [
      "ReadTokenGuard",
      "SAFE_METHODS",
      "ПРЕСАЙНЕД-ссылка",
      "route.token.test.ts",
    ]) {
      expect(решение, `ruling про вложения не называет ${факт}`).toContain(факт);
    }
    expect(
      решение,
      "решение снова числит raw открытым — сверь с @UseGuards в контроллере",
    ).not.toContain("`raw` остаётся");
  });
});

/*
 * Круг починок 2, И-3 и М-5. Оба пункта — правки ТОЛЬКО в решении, и без
 * сторожа их нельзя ни проверить, ни удержать: markdown откатывается молча.
 * Поэтому здесь сверяются не формулировки, а ЧИСЛА И ИМЕНА, которые решение
 * называет: они обязаны совпадать с кодом, иначе запись превращается во
 * второй источник правды, разошедшийся с первым.
 */
describe("ruling про открытый /people и цена задержки сверяются с кодом", () => {
  it("решение называет `/people` открытым сознательно, а не молчит о нём", () => {
    for (const факт of [
      "остаётся ОТКРЫТЫМ",
      "разорвана на ВТОРОМ звене",
      "tgChatId",
      "tools/smoke-core.mjs",
    ]) {
      expect(решение, `ruling про /people не называет ${факт}`).toContain(факт);
    }
  });

  it("`/people` в Core действительно открыт: закроют — ruling обязан краснеть, а не устаревать молча", () => {
    // Если следующий срез закроет дверь, обоснование ruling'а («цепочка
    // разорвана на втором звене, а первое открыто») перестанет описывать мир —
    // и решение придётся переписать. Пусть об этом скажет тест, а не читатель.
    const люди = читать("apps/core/src/people/people.controller.ts");
    expect(
      люди,
      "PeopleController закрыт классовым guard'ом — ruling про открытый /people устарел",
    ).toMatch(/@Controller\("people"\)\s*export class PeopleController/);
  });

  it("замер цены закрытия — настоящий: столько мест в apps/cc, сколько названо в решении", () => {
    /*
     * Число в решении — обещание тому, кто возьмётся. Считаем ровно то, что
     * пришлось бы править: вызовы `core.people(...)` и `core.person(...)` в
     * коде панели, без тестов.
     */
    const m = /В `apps\/cc` — (\d+) мест/.exec(решение);
    expect(m, "в решении нет замера «В `apps/cc` — N мест»").not.toBeNull();
    const файлы = execSync(
      "grep -rln --include=*.ts --include=*.tsx -E 'core\\.(people|person)\\(' apps/cc/src",
      { cwd: КОРЕНЬ, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter((f) => f.length > 0 && !f.includes(".test."));
    const вызовов = файлы
      .map((f) => (читать(f).match(/core\.(?:people|person)\(/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(вызовов, `решение обещает ${m?.[1]} мест, а в apps/cc их ${вызовов}`).toBe(
      Number(m?.[1]),
    );
  });

  it("цена задержки названа числами из КОДА, а не из памяти автора", () => {
    /*
     * Числа в решении и в боте — одни и те же. Читается ИМЕННО константа
     * ДОКУМЕНТА: после разделения таймаутов (М-5) `UPLOAD_TIMEOUT_MS` остался
     * у фото и равен 60 с, и регэксп без границы слова подхватил бы её —
     * сторож стал бы сторожить не тот путь и тихо разрешил бы документу
     * уехать обратно на минуту.
     */
    const бот = читать("apps/bot/src/core-client.ts");
    const документ = /\bDOCUMENT_UPLOAD_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(бот);
    const фото = /\bconst UPLOAD_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(бот);
    expect(документ, "в core-client.ts нет DOCUMENT_UPLOAD_TIMEOUT_MS").not.toBeNull();
    expect(фото, "в core-client.ts нет UPLOAD_TIMEOUT_MS").not.toBeNull();
    const секунд = (m: RegExpExecArray | null): number =>
      Number((m?.[1] ?? "0").replace(/_/g, "")) / 1000;
    expect(
      секунд(документ),
      "таймауты документа и фото снова одно число — цены двух путей смешаны, и сторож ниже сторожит не тот путь",
    ).not.toBe(секунд(фото));

    expect(решение, "Р-3 не называет DOCUMENT_UPLOAD_TIMEOUT_MS").toContain(
      "DOCUMENT_UPLOAD_TIMEOUT_MS",
    );
    expect(
      решение,
      `в решении не написано «${секунд(документ)} с» — число документа разошлось с кодом`,
    ).toContain(`${секунд(документ)} с`);
    // Вторая половина задержки — общий таймаут клиента перед загрузкой.
    expect(решение, "Р-3 не называет шаг resolveOwner, а он тоже ждёт").toContain("personOf");
    // Худший случай — сумма двух шагов, и он тоже обязан быть числом из кода.
    const клиент = /private readonly timeoutMs = ([\d_]+)/.exec(бот);
    // Третье чтение исходника — с тем же `not.toBeNull()`, что у двух соседей
    // выше (круг починок 3, B-5): при переименовании поля подстановка `?? "0"`
    // ниже посчитала бы худший случай от нуля и назвала бы в решении число,
    // которого в коде нет, — а сторож остался бы зелёным.
    expect(клиент, "в core-client.ts нет `private readonly timeoutMs`").not.toBeNull();
    const худший = секунд(документ) + секунд(клиент);
    expect(
      решение,
      `Р-3 не называет худший случай «~${худший} с» = ${секунд(клиент)} с (personOf) + ${секунд(документ)} с (документ)`,
    ).toContain(`~${худший} с`);
  });
});

describe("план ARMS §6.4 больше не повторяет опровергнутую премису", () => {
  it("п. 4 — факт вместо «данные уже в Core — нужна витрина»", () => {
    const п4 = пунктВолныA(4);
    expect(п4, "премиса вернулась в план").not.toContain("Данные уже в Core — нужна витрина");
    for (const факт of ["СДЕЛАНО 08.09.2026 (срез A3)", "`attachment`", "`document`", ЗАПИСКА, РЕШЕНИЕ]) {
      expect(п4, `в п. 4 нет факта «${факт}»`).toContain(факт);
    }
  });

  it("п. 7 — критерий переформулирован, дата совпадает с ARTIFACTS_SINCE в коде", () => {
    const п7 = пунктВолныA(7);
    expect(п7, "критерий снова «ждёт п. 4»").not.toContain("ждёт п. 4");
    const { iso, печатная } = датаНачалаАрхива();
    expect(п7, `в п. 7 нет даты ${печатная}`).toContain(печатная);
    expect(п7).toContain("ARTIFACTS_SINCE");
    expect(решение, "решение печатает не ту дату начала архива").toContain(iso);
  });

  it("оси критерия — те, что витрина РЕАЛЬНО умеет (круг починок 3, C-8)", () => {
    /*
     * Критерий помечен «выполнено», поэтому каждая его ось обязана быть на
     * экране. Прежняя формулировка обещала ось ВЛАДЕЛЬЦА: у двери Core
     * `ownerType`/`ownerId` есть, но страница их не читает и в запрос не
     * кладёт — приёмка проверяла бы фильтр, которого нет. Сверяем оси с
     * полями формы и с самим вызовом Core, а не с памятью автора.
     */
    const страница = читать("apps/cc/src/app/artifacts/page.tsx");
    for (const поле of ['name="kind"', 'name="domain"', 'name="from"', 'name="to"', 'name="q"']) {
      expect(страница, `в форме /artifacts нет поля ${поле}`).toContain(поле);
    }
    const начало = страница.indexOf("core.artifacts({");
    expect(начало, "в page.tsx нет вызова core.artifacts({").toBeGreaterThan(-1);
    const вызов = страница.slice(начало, страница.indexOf("limit: ARTIFACTS_LIMIT", начало));
    expect(
      вызов.toLowerCase(),
      "витрина начала фильтровать по владельцу — критерий п. 7 можно расширить обратно",
    ).not.toContain("owner");

    for (const п of [пунктВолныA(7), решение]) {
      expect(п, "критерий снова обещает ось владельца, которой у витрины нет").not.toMatch(
        /находится по типу, владельц/,
      );
    }
    for (const ось of ["типу", "направлению", "периоду", "названию"]) {
      expect(пунктВолныA(7), `в критерии нет оси «${ось}»`).toContain(ось);
    }
  });
});

describe("тексты не описывают мир, которого больше нет (круг починок 3, C-3 и C-4)", () => {
  it("записка о премисе не числит бота «всё ещё не сохраняющим»", () => {
    // На записку ссылаются четыре текста ветки, и её постскриптум описывал
    // вершину `f580683`: «задача 4 не закрыта, бот отправляет и не сохраняет».
    // Пока в боте есть дверь архива, это утверждение — ложь о сегодняшнем дне.
    const дверь = читать("apps/bot/src/reply-delivery.ts");
    expect(дверь, "доставка ответа больше не зовёт архив — тогда прав постскриптум, а не код").toContain(
      "доставитьДокумент(",
    );
    const записка = склеить(читать(ЗАПИСКА));
    expect(записка, "постскриптум записки снова числит открытый вопрос 2 открытым").not.toContain(
      "Открытый вопрос 2 остаётся открытым",
    );
    expect(записка, "в записке нет отметки о закрытии вопроса 2").toContain("Открытый вопрос 2 ЗАКРЫТ");
  });

  it("контракт uploadDocument описывает то, что кладёт единственный вызывающий", () => {
    // Контракт приводил в пример `GeneratedDocument.summary` как `title` и
    // «подпись Telegram-сообщения», а вызывающий делает обратное — кладёт имя
    // файла без расширения, и caption не ставит вовсе.
    const клиент = читать("apps/bot/src/core-client.ts");
    const начало = клиент.indexOf("Загрузить документ, сгенерированный ботом");
    expect(начало, "в core-client.ts нет докблока uploadDocument").toBeGreaterThan(-1);
    const контракт = склеить(клиент.slice(начало, клиент.indexOf("async uploadDocument(", начало)));
    expect(контракт, "контракт снова обещает сводку модели в title").not.toContain(
      "`GeneratedDocument.summary`) — обрезку",
    );
    expect(контракт, "контракт не говорит, что кладёт вызывающий").toContain("имя файла без расширения");

    const архив = читать("apps/bot/src/document-archive.ts");
    expect(архив, "название артефакта больше не имя файла — контракт снова описывает не то").toContain(
      "const title = заголовокИзИмени(doc.filename);",
    );
    expect(
      архив.includes("caption"),
      "в архиве появился caption — контракт врёт, что подписи бот не ставит",
    ).toBe(false);
  });
});

describe("формы created_by: схема и витрина говорят об одном (круг починок 3, C-7)", () => {
  it("докблок колонки называет каждую форму, которую печатает authorWord", () => {
    /*
     * Докблок схемы перечислял ТРИ формы (`owner | staff:<id> | agent:<имя>`),
     * а живых четыре: `person:<uuid>` пишут и загрузка фото полевого контура,
     * и документы бота (задача 4 — «owner» про запрос сотрудника было бы
     * ложью в аудитном поле). Читатель схемы про четвёртую не знал.
     *
     * Сверяем ДВА источника: докблок колонки и разбор в панели. Формы берём
     * из самого `authorWord` — он единственный, кто их печатает.
     */
    const витрина = читать("apps/cc/src/lib/artifacts.ts");
    const начало = витрина.indexOf("export function authorWord(");
    expect(начало, "в lib/artifacts.ts нет authorWord").toBeGreaterThan(-1);
    const тело = витрина.slice(начало);
    const формы = new Set<string>();
    for (const m of тело.matchAll(/"([a-z]+):?"/g)) формы.add(m[1] ?? "");
    for (const m of тело.matchAll(/\(\?:([a-z|]+)\)/g)) {
      for (const ф of (m[1] ?? "").split("|")) формы.add(ф);
    }
    expect([...формы].sort(), "разбор authorWord сломан — формы не те").toEqual([
      "agent",
      "owner",
      "person",
      "staff",
    ]);

    // Окно — РОВНО строка перечисления, а не абзац вокруг: ниже в том же
    // докблоке формы упоминаются прозой, и по абзацу проверка была бы
    // зелёной даже с усечённым перечнем (поймано откатом).
    const перечень = читать("packages/db/src/schema.ts")
      .split("\n")
      .find((s) => s.includes("Кто загрузил:"));
    expect(перечень, "в schema.ts нет строки «Кто загрузил:» у attachment").toBeDefined();
    for (const форма of формы) {
      expect(перечень, `перечень created_by не знает форму «${форма}»`).toContain(форма);
    }
  });
});

describe("ссылки среза ведут в существующие файлы", () => {
  /**
   * Докблоки этого среза ссылаются друг на друга путями — на них и держится
   * «куда смотреть». Один такой путь оказался битым (`packages/db/migrations`
   * вместо `packages/db/drizzle`, круг починок 3, C-6): каталога нет, и
   * читатель уходил искать замер туда, где его никогда не было. Проверка
   * дешёвая, а класс ошибки повторяемый — поэтому она в репозитории, а не в
   * одном чужом grep'е.
   */
  const ФАЙЛЫ = [
    "apps/cc/src/app/artifacts/page.tsx",
    "apps/cc/src/lib/artifacts.ts",
    "apps/core/src/artifacts/artifacts.service.ts",
    "apps/core/src/artifacts/artifacts.controller.ts",
    "apps/bot/src/document-archive.ts",
    "apps/bot/src/reply-delivery.ts",
    "packages/shared/src/artifacts-contract.ts",
    "packages/db/drizzle/0089_attachment_artifacts.sql",
    "apps/cc/src/app/api/attachments/[id]/raw/route.ts",
  ];
  const ПУТЬ = /(?:apps|packages|tools|docs|memory)\/[A-Za-z0-9_./[\]-]*[A-Za-z0-9_\]]/g;

  it("каждый упомянутый путь репозитория существует", () => {
    let всего = 0;
    for (const файл of ФАЙЛЫ) {
      expect(есть(файл), `нет самого ${файл}`).toBe(true);
      for (const путь of new Set(читать(файл).match(ПУТЬ) ?? [])) {
        всего += 1;
        expect(есть(путь), `в ${файл} ссылка на несуществующий путь ${путь}`).toBe(true);
      }
    }
    // Часть файлов ссылается на соседей коротким именем (`telegram.ts`) — это
    // не дефект. Но если регэксп перестанет находить ПОЛНЫЕ пути вовсе,
    // проверка станет зелёной на пустоте: порог считает их по всему набору.
    expect(всего, "ни одной полной ссылки на набор файлов — регэксп сломан").toBeGreaterThan(7);
  });
});

describe("указатели ведут к решению", () => {
  it("memory/decisions.md — строка-указатель с датой спеки и путём к файлу", () => {
    const строка = читать("memory/decisions.md")
      .split("\n")
      .find((s) => s.startsWith("| 2026-09-07 |") && s.includes(РЕШЕНИЕ));
    expect(строка, "в memory/decisions.md нет строки среза A3").toBeDefined();
  });

  it("docs/MCP.md — artifacts_list записан кандидатом и НЕ добавлен в сервер", () => {
    const mcp = читать("docs/MCP.md");
    expect(mcp).toContain("### Кандидаты (не добавлены)");
    expect(mcp).toContain("`artifacts_list`");
    expect(
      читать("apps/mcp/src/tools.ts"),
      "artifacts_list появился в tools.ts — перенеси строку из «Кандидатов» в таблицу читающих",
    ).not.toContain("artifacts_list");
  });
});

describe("навык mydon-design знает строку артефакта", () => {
  const примитивы = склеить(читать(`${НАВЫК}/primitives.md`));

  it("строка артефакта в primitives.md называет словари, дату и эталон", () => {
    for (const факт of [
      "ARTIFACT_KIND_WORD",
      "ARTIFACT_KIND_LED",
      "ARTIFACTS_SINCE",
      "app/artifacts/page.tsx",
    ]) {
      expect(примитивы, `в primitives.md нет ${факт}`).toContain(факт);
    }
    const state = читать("apps/cc/src/lib/state.ts");
    expect(state).toContain("export const ARTIFACT_KIND_WORD");
    expect(state).toContain("export const ARTIFACT_KIND_LED");
  });

  it("описанная анатомия — та, что в вёрстке страницы", () => {
    // Навык — карта примитивов: строка артефакта не завела своего класса, а
    // переиспользовала `.approw` с ярлыком `data-kind`. Разъезд карты с
    // вёрсткой отправит следующего автора писать второй класс с той же
    // геометрией — тот же дефект, от которого §9 избавлялась весь Д2.
    expect(примитивы).toContain(".approw[data-kind]");
    const страница = читать("apps/cc/src/app/artifacts/page.tsx");
    for (const класс of ['className="approw" data-kind', 'className="ab"', 'className="aw"']) {
      expect(страница, `вёрстка /artifacts не содержит ${класс}`).toContain(класс);
    }
  });
});
