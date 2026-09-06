import { Marked, Renderer, type Tokens } from "marked";

/**
 * Рендер документов репозитория для панели `/docs` (Р-4).
 *
 * Правило одно: **панель не исполняет чужой HTML**. Источник доверенный — свой
 * же образ, — но документы правят агенты, владелец с телефона и `git`, и один
 * вставленный `<script>` получил бы права страницы вместе с сервисным токеном
 * в серверных экшенах. Экранирование дешевле, чем исключение из правила.
 *
 * Второе правило: **из документа не тянется сеть**. Внешние картинки — это
 * визит владельца на чужой хост при простом чтении документа; вместо картинки
 * показываем её подпись.
 */

/** HTML-мнемоники: одно место, где текст превращается в разметку. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * То же, но для текста, который marked МОГ уже экранировать.
 *
 * Обычный текстовый токен приходит с готовыми мнемониками (`&amp;`), а токен
 * из «сырого блока» — как есть. Второй раз экранировать `&` внутри уже
 * готовой мнемоники нельзя, иначе в документе появится `&amp;amp;`; всё
 * остальное экранируем безусловно — именно этим правилом живёт сам marked.
 */
function escapeText(value: string): string {
  return value
    .replace(/&(?!#?\w+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Папка документа: от неё считаются относительные ссылки. */
function dirOf(repoPath: string): string[] {
  const parts = repoPath.split("/");
  parts.pop();
  return parts;
}

/**
 * Ссылка внутри репозитория → путь, который поймёт Core, или `null`.
 *
 * `null` значит «панель это открыть не сможет»: файл не markdown (Core отдаёт
 * только белый список), либо путь выводит за корень репозитория. Такие ссылки
 * остаются текстом — мёртвая ссылка в панели хуже, чем её отсутствие.
 */
export function resolveDocLink(href: string, fromPath: string): string | null {
  const [rawPath = ""] = href.split("#", 1);
  if (rawPath.length === 0) return null;
  // Ссылка «от корня репозитория» (`/CLAUDE.md`) и относительная («../routers/…»)
  // отличаются только точкой отсчёта.
  const base = rawPath.startsWith("/") ? [] : dirOf(fromPath);
  const out = [...base];
  for (const segment of rawPath.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      // Вышли за корень — это уже не документ репозитория.
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  const path = out.join("/");
  if (!path.toLowerCase().endsWith(".md")) return null;
  return path;
}

/**
 * Ссылка в саму панель: путь едет параметром запроса, как в дереве.
 *
 * `fragment` (вместе с «#») сохраняем: ссылка `dev.md#команды` без него ведёт
 * в начало чужого документа, и владельцу приходится искать раздел глазами.
 */
function panelHref(repoPath: string, fragment = ""): string {
  return `/docs?path=${encodeURIComponent(repoPath)}${escapeHtml(fragment)}`;
}

/**
 * Шапка навыка (YAML front matter) — блоком, а не заголовком.
 *
 * `---\nname: onboard\n---` markdown читает как setext-заголовок: шапка навыка
 * выглядела бы главным заголовком документа. Отдаём её как есть, кодом:
 * `allowed-tools` и `description` владельцу нужны, но врать про структуру нельзя.
 */
function foldFrontMatter(markdown: string): string {
  if (!markdown.startsWith("---\n")) return markdown;
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return markdown;
  const head = markdown.slice(4, end);
  // Первая строка обязана быть парой «ключ: значение». Иначе `---` в начале —
  // это горизонтальная линия, и раньше весь документ до следующей такой линии
  // уезжал в блок кода вместе со своим заголовком.
  if (!/^[A-Za-z_][\w.-]*\s*:/.test(head.split("\n", 1)[0] ?? "")) return markdown;
  const rest = markdown.slice(end + 4).replace(/^[^\n]*\n?/, "");
  return `\`\`\`yaml\n${head}\n\`\`\`\n\n${rest}`;
}

/**
 * Рендерер документа: сырой HTML экранирован, ссылки переведены на панель.
 *
 * Знает путь документа, потому что относительная ссылка без него не считается.
 */
class DocRenderer extends Renderer {
  constructor(
    private readonly fromPath: string,
    private readonly known: ReadonlySet<string>,
  ) {
    super();
  }

  /**
   * Внутри ли мы сейчас ссылки (пока `link()` разбирает свой текст).
   *
   * `parseInline` синхронный, поэтому простого флага достаточно, а знать это
   * обязательно: `<a>` внутри `<a>` браузер разрывает, и разметка вокруг
   * ссылки рассыпается.
   */
  private inLink = false;

  /**
   * Текстовый токен — всегда экранированным.
   *
   * Незакрытый строчный `<script>`, `<pre>`, `<code>` или `<kbd>` переводит
   * лексер в состояние «сырой блок», и ДЕФОЛТНЫЙ `text()` печатает дальше всё
   * без экранирования — до конца документа. Тогда `<svg/onload=…>` из текста
   * становится живым элементом страницы. Экранирования `html()` для этого
   * мало: тот видит только сами теги, а не текст после них.
   */
  override text(token: Tokens.Text | Tokens.Escape | Tokens.Tag): string {
    return "tokens" in token && token.tokens
      ? this.parser.parseInline(token.tokens)
      : escapeText(token.text);
  }

  /**
   * Путь в обратных кавычках — это тоже ссылка.
   *
   * В репозитории так пишут почти всегда: на 209 документов приходится 24
   * markdown-ссылки и 618 упоминаний вида `` `routers/vendhub.md` ``. Без этого
   * правила `CLAUDE.md` — главный роутер — не ведёт ни на один роутер
   * направления, и панель распадается на несвязанные страницы. Ссылку ставим
   * ТОЛЬКО на путь, который Core отдал в дереве: мёртвых ссылок не заводим.
   */
  override codespan(token: Tokens.Codespan): string {
    const code = `<code>${escapeHtml(token.text)}</code>`;
    const path = token.text.trim();
    // Внутри ссылки — только код: своя ссылка там дала бы вложенный `<a>`.
    if (this.inLink || !this.known.has(path)) return code;
    return `<a href="${panelHref(path)}">${code}</a>`;
  }

  /** HTML из документа — текстом. Ровно то, ради чего написан Р-4. */
  override html(token: Tokens.HTML | Tokens.Tag): string {
    return escapeHtml(token.text);
  }

  /** Широкая таблица едет внутри себя, а не растягивает страницу (`.table-scroll`). */
  override table(token: Tokens.Table): string {
    return `<div class="table-scroll">${super.table(token)}</div>`;
  }

  override link(token: Tokens.Link): string {
    // Текст ссылки разбираем с поднятым флагом: вложенных `<a>` быть не должно.
    const wasInLink = this.inLink;
    this.inLink = true;
    let text: string;
    try {
      text = this.parser.parseInline(token.tokens);
    } finally {
      // Восстанавливаем флаг и при исключении: иначе один сбой внутри текста
      // ссылки оставил бы весь остаток документа без живых путей в бэктиках.
      this.inLink = wasInLink;
    }
    const href = token.href.trim();
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
    // Якорь ведёт внутрь этого же документа — трогать нечего.
    if (href.startsWith("#")) return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
    if (/^https?:\/\//i.test(href)) {
      // `noopener` обязателен: открытая вкладка не должна получать доступ к панели.
      return `<a href="${escapeHtml(href)}"${title} target="_blank" rel="noopener">${text}</a>`;
    }
    if (/^(mailto|tel):/i.test(href)) return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
    const repoPath = resolveDocLink(href, this.fromPath);
    if (repoPath) {
      // Якорь несём дальше: `dev.md#команды` без него ведёт в начало чужого
      // документа, и раздел приходится искать глазами.
      const hash = href.indexOf("#");
      const fragment = hash === -1 ? "" : href.slice(hash);
      return `<a href="${panelHref(repoPath, fragment)}"${title}>${text}</a>`;
    }
    // Всё прочее (`javascript:`, путь к коду, файл вне белого списка) — текстом:
    // ни исполнять, ни вести в 404 панель не должна.
    return text;
  }

  /** Картинка — подписью: панель ничего не грузит из сети (R-M-6, тот же принцип). */
  override image(token: Tokens.Image): string {
    return `<span class="doc-img">${escapeHtml(token.text || token.href)}</span>`;
  }
}

/** Один экземпляр на процесс: состояние живёт в рендерере, а он свой на вызов. */
const marked = new Marked();

/**
 * Markdown документа `fromPath` → HTML для `article.doc`.
 *
 * `fromPath` — репо-относительный путь самого документа: без него нельзя
 * посчитать, куда ведёт `../routers/vendhub.md`. `known` — пути из дерева
 * Core: по ним оживают упоминания документов в обратных кавычках.
 */
export function renderMarkdown(
  markdown: string,
  fromPath: string,
  known: ReadonlySet<string> = new Set(),
): string {
  return marked.parse(foldFrontMatter(markdown), {
    renderer: new DocRenderer(fromPath, known),
    async: false,
  });
}
