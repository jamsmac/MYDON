import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

/**
 * Рендер документов репозитория (Р-4).
 *
 * Источник доверенный — свой же образ, — но правило «панель не исполняет
 * чужой HTML» дешевле исключения: документы правят агенты и владелец с
 * телефона, и один вставленный `<script>` не должен получать права страницы.
 */
describe("renderMarkdown: сырой HTML не проходит", () => {
  it("экранирует HTML-блок вместо вставки", () => {
    const html = renderMarkdown("<script>alert(1)</script>\n", "docs/x.md");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("экранирует и строчный HTML внутри абзаца", () => {
    const html = renderMarkdown('Текст <b onclick="x()">жирный</b> дальше\n', "docs/x.md");
    expect(html).not.toContain("<b onclick");
    expect(html).toContain("&lt;b onclick");
  });

  /**
   * Дыра, найденная на ревью (ebd8b31). Незакрытый строчный `<script>`, `<pre>`,
   * `<code>` или `<kbd>` переводит лексер marked в состояние `inRawBlock`, и
   * ДЕФОЛТНЫЙ `Renderer.text()` печатает дальнейшие текстовые токены БЕЗ
   * экранирования — до конца документа. То есть весь текст после такого тега
   * становится живым HTML: `<svg/onload=…>` исполняется. Экранирования
   * `html()` для этого мало, нужен и свой `text()`.
   */
  it("после незакрытого <script> текст остаётся текстом, а не живым HTML", () => {
    const html = renderMarkdown("текст <script> и <svg/onload=alert(1)> конец\n", "docs/x.md");
    expect(html).not.toContain("<svg");
    expect(html).toContain("&lt;svg/onload=alert(1)&gt;");
  });

  it("после незакрытых <code>/<pre> — тоже (сырой блок ловит четыре тега)", () => {
    for (const tag of ["<code>", "<pre", "<kbd>"]) {
      const html = renderMarkdown(`текст ${tag} и <img/src=x/onerror=alert(1)> конец\n`, "docs/x.md");
      expect(html, tag).not.toContain("<img");
      expect(html, tag).toContain("&lt;img/src=x/onerror=alert(1)&gt;");
    }
  });

  it("обычный текст не экранируется дважды", () => {
    const html = renderMarkdown("a & b, уже &amp; и \\<b\\> и 'кавычки'\n", "docs/x.md");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("&amp;amp;");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("renderMarkdown: ссылки", () => {
  it("относительная ссылка на .md ведёт в панель по репо-пути", () => {
    const html = renderMarkdown("[роутер](../routers/vendhub.md)\n", "docs/y.md");
    expect(html).toContain('href="/docs?path=routers%2Fvendhub.md"');
  });

  it("ссылка «от корня репозитория» ведёт туда же", () => {
    const html = renderMarkdown("[контекст](/CLAUDE.md)\n", "docs/y.md");
    expect(html).toContain('href="/docs?path=CLAUDE.md"');
  });

  it("соседний файл считается от папки документа", () => {
    const html = renderMarkdown("[деплой](./DEPLOY.md)\n", "docs/y.md");
    expect(html).toContain('href="/docs?path=docs%2FDEPLOY.md"');
  });

  it("якорь на разделе другого документа не теряется", () => {
    const html = renderMarkdown("[команды](../routers/dev.md#команды)\n", "docs/y.md");
    expect(html).toContain('href="/docs?path=routers%2Fdev.md#команды"');
  });

  it("якорь остаётся якорем и не открывается в новой вкладке", () => {
    const html = renderMarkdown("[цели](#цели)\n", "docs/y.md");
    expect(html).toContain('href="#цели"');
    expect(html).not.toContain("target=");
  });

  it("внешняя ссылка уходит в новую вкладку без доступа к панели", () => {
    const html = renderMarkdown("[сайт](https://example.com/a)\n", "docs/y.md");
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
  });

  it("javascript: ссылкой не становится — только текстом", () => {
    const html = renderMarkdown("[жми](javascript:alert(1))\n", "docs/y.md");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("жми");
  });

  it("ссылка за пределы репозитория остаётся текстом", () => {
    const html = renderMarkdown("[наружу](../../../etc/passwd.md)\n", "docs/y.md");
    expect(html).not.toContain("/docs?path=");
    expect(html).toContain("наружу");
  });

  it("не-markdown файл панель открыть не может — тоже текст", () => {
    const html = renderMarkdown("[код](apps/core/src/main.ts)\n", "CLAUDE.md");
    expect(html).not.toContain("<a ");
    expect(html).toContain("код");
  });
});

/**
 * В этом репозитории пути пишут в обратных кавычках (`routers/vendhub.md`), а
 * не markdown-ссылкой: на 209 документов приходится 24 ссылки и 618 таких
 * упоминаний. Без них панель — набор несвязанных страниц, а `CLAUDE.md`
 * (главный роутер!) не ведёт ни на один роутер направления.
 */
describe("renderMarkdown: пути в обратных кавычках", () => {
  const known = new Set(["routers/vendhub.md", "docs/DEPLOY.md"]);

  it("существующий документ становится ссылкой прямо из кода", () => {
    const html = renderMarkdown("Подробности — `routers/vendhub.md`.\n", "CLAUDE.md", known);
    expect(html).toContain('<a href="/docs?path=routers%2Fvendhub.md"><code>routers/vendhub.md</code></a>');
  });

  it("несуществующий путь остаётся кодом — мёртвых ссылок не заводим", () => {
    const html = renderMarkdown("Смотри `docs/net-takogo.md`.\n", "CLAUDE.md", known);
    expect(html).not.toContain("/docs?path=");
    expect(html).toContain("<code>docs/net-takogo.md</code>");
  });

  it("без дерева документов код остаётся кодом", () => {
    const html = renderMarkdown("Смотри `routers/vendhub.md`.\n", "CLAUDE.md");
    expect(html).not.toContain("/docs?path=");
    expect(html).toContain("<code>routers/vendhub.md</code>");
  });

  it("внутри ссылки путь ссылкой НЕ становится — вложенных <a> не бывает", () => {
    const html = renderMarkdown("[роутер `routers/vendhub.md` тут](https://example.com)\n", "CLAUDE.md", known);
    // Ровно одна открывающая `<a` на весь абзац: вложенный `<a>` браузер
    // разрывает, и разметка вокруг ссылки рассыпается.
    expect(html.match(/<a\s/g) ?? []).toHaveLength(1);
    expect(html).toContain("<code>routers/vendhub.md</code>");
  });

  it("код, который не путь, не трогаем", () => {
    const html = renderMarkdown("Команда `pnpm test` и `<b>` в коде.\n", "CLAUDE.md", known);
    expect(html).toContain("<code>pnpm test</code>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("renderMarkdown: типографика документа", () => {
  it("таблица едет внутри .table-scroll, а не растягивает страницу", () => {
    const html = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |\n", "docs/x.md");
    expect(html).toContain('<div class="table-scroll">');
    expect(html).toContain("<table>");
  });

  it("шапка навыка (YAML front matter) показывается блоком, а не заголовком", () => {
    const html = renderMarkdown("---\nname: onboard\ndescription: бриф\n---\n\n# Навык\n", ".claude/skills/onboard/SKILL.md");
    // Без обработки `name: onboard` + `---` — это setext-заголовок h2, то есть
    // шапка навыка выглядела бы главным заголовком документа.
    expect(html).not.toContain("<h2>name: onboard");
    expect(html).toContain("<pre>");
    expect(html).toContain("name: onboard");
    expect(html).toContain("<h1>Навык</h1>");
  });

  it("документ, начатый тематическим разрывом, не съедается как шапка", () => {
    // `---` в начале — это горизонтальная линия, а не YAML. Раньше всё до
    // следующего `---` уезжало в блок кода вместе с заголовком документа.
    const html = renderMarkdown("---\n\n# Заголовок\n\nтекст\n\n---\n\nещё\n", "docs/x.md");
    expect(html).toContain("<h1>Заголовок</h1>");
    expect(html).not.toContain("language-yaml");
  });

  it("код в блоке экранируется, а не исполняется", () => {
    const html = renderMarkdown("```\n<script>1</script>\n```\n", "docs/x.md");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
