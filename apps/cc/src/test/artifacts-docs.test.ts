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
