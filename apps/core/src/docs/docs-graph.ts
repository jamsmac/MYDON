import path from "node:path";

/**
 * Чистые функции панели «Документы» и графа «Мозг» (Р-2/Р-3, R-M-2…R-M-4).
 *
 * Здесь нет ни файловой системы, ни базы — только разбор путей, markdown и
 * сборка графа из уже прочитанных данных. Так граница «что считаем» проверяется
 * тестами без диска, а `DocsService` отвечает только за чтение и кэш.
 */

/** Элемент дерева документов: метаданные без содержимого (R-M-3). */
export interface DocsTreeItem {
  path: string;
  root: string;
  title: string;
  bytes: number;
  updatedAt: string;
  /** Личный контур владельца: содержимое за owner-токеном (см. `isPersonalDoc`). */
  personal?: boolean;
}

/** Документ с содержимым (R-M-2). */
export interface DocFile extends DocsTreeItem {
  markdown: string;
}

export type GraphNodeKind =
  | "root"
  | "router"
  | "domain"
  | "agent"
  | "skill"
  | "tool"
  | "doc"
  | "memory"
  | "decision"
  | "engine"
  | "kb";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  path?: string;
  href?: string;
}

export type GraphEdgeKind =
  | "links"
  | "mentions"
  | "routes"
  | "owns"
  | "has_skill"
  | "uses_tool"
  | "reads_kb"
  | "describes";

export interface GraphEdge {
  from: string;
  to: string;
  kind: GraphEdgeKind;
}

export interface DocsGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  builtAt: string;
}

/** Агент из таблицы `agent` — ровно те поля, из которых строится граф. */
export interface GraphAgent {
  name: string;
  business: string;
  skills: string[];
  kbPages: string[];
}

/** Строка `agent_skill_catalog` — зеркало файла навыка. */
export interface GraphSkillRow {
  agentName: string;
  skill: string;
  allowedTools: string[];
}

/** Корневой документ репозитория — он же корень графа. */
export const ROOT_DOC = "CLAUDE.md";

/** Архив стартера читать не надо: это снимок старых файлов, а не документация. */
const BACKUP_PREFIX = "docs/agentic-os-starter/_backup/";

/**
 * Документы личного контура вне `memory/**`: роутер личного направления и
 * профиль владельца из навыка фабрики направлений.
 */
const PERSONAL_FILES = new Set([
  "routers/personal.md",
  ".claude/skills/mydon-venture-factory/references/owner-profile.md",
]);

/**
 * Личное владельца среди документов (зеркало `PersonalDomainGuard`).
 *
 * `SERVICE_TOKEN` общий — его держат бот и агенты, поэтому «за сервисным
 * токеном» для `memory/` (handoff'ы сессий, ограничения, личные заметки) —
 * это не защита. При включённом ужесточении owner-identity содержимое таких
 * файлов отдаётся только по owner-токену; заголовки в дереве остаются видны,
 * иначе панель молча теряла бы часть дерева и владелец не понимал бы почему.
 */
export function isPersonalDoc(relPath: string): boolean {
  if (relPath.startsWith("memory/")) return true;
  return PERSONAL_FILES.has(relPath);
}

/**
 * Описание корня из белого списка (спека §4).
 *
 * `dir` — каталог для скана, `depth` — насколько глубоко в него спускаться
 * (1 — только прямые дети; `routers/` и `engine/` нарочно неглубокие),
 * `match` — окончательное решение по конкретному пути. Разделение нужно
 * `DocsService`: по `dir`/`depth` он обходит диск, по `match` — фильтрует.
 */
export interface DocsRootSpec {
  key: string;
  dir: string;
  depth: number;
  match: (rel: string) => boolean;
}

const isMd = (rel: string): boolean => rel.endsWith(".md");

/** Порядок важен: `rootOf` возвращает ПЕРВЫЙ подошедший корень. */
export const DOCS_ROOTS: readonly DocsRootSpec[] = [
  { key: ROOT_DOC, dir: "", depth: 1, match: (r) => r === ROOT_DOC },
  {
    key: "docs",
    dir: "docs",
    depth: Number.MAX_SAFE_INTEGER,
    match: (r) => r.startsWith("docs/") && isMd(r) && !r.startsWith(BACKUP_PREFIX),
  },
  {
    key: "memory",
    dir: "memory",
    depth: Number.MAX_SAFE_INTEGER,
    match: (r) => r.startsWith("memory/") && isMd(r),
  },
  { key: "routers", dir: "routers", depth: 1, match: (r) => /^routers\/[^/]+\.md$/.test(r) },
  { key: "engine", dir: "engine", depth: 1, match: (r) => /^engine\/[^/]+\.(yaml|md)$/.test(r) },
  {
    key: "apps/agents/shared",
    dir: "apps/agents/shared",
    depth: Number.MAX_SAFE_INTEGER,
    match: (r) => r.startsWith("apps/agents/shared/") && isMd(r),
  },
  {
    key: "apps/agents/agents",
    dir: "apps/agents/agents",
    depth: Number.MAX_SAFE_INTEGER,
    match: (r) =>
      /^apps\/agents\/agents\/[^/]+\/ROLE\.md$/.test(r) ||
      /^apps\/agents\/agents\/[^/]+\/skills\/[^/]+\.md$/.test(r),
  },
  {
    key: ".claude/skills",
    dir: ".claude/skills",
    depth: Number.MAX_SAFE_INTEGER,
    match: (r) =>
      /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(r) ||
      /^\.claude\/skills\/[^/]+\/references\/.+\.md$/.test(r),
  },
];

/**
 * Корень репозитория от каталога скомпилированного модуля.
 *
 * `apps/core/dist/docs` → `dist` → `apps/core` → `apps` → корень (в образе `/app`,
 * потому что Dockerfile кладёт весь репозиторий целиком). Число уровней проверено
 * тестом «в корне есть CLAUDE.md» — считать его на глаз нельзя.
 */
export function repoRootFrom(dirname: string): string {
  return path.resolve(dirname, "..", "..", "..", "..");
}

/**
 * Приводит путь из запроса к репо-относительному виду или отказывает.
 *
 * `..` разрешён только пока не выводит за корень (`docs/b/../a.md` — законный
 * путь, `docs/../../etc/passwd` — попытка выхода). Абсолютные пути, windows-
 * разделители и NUL отбиваются до всякой работы с диском.
 */
export function normalizeDocPath(input: string): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0) return null;
  // Управляющие символы (NUL, перевод строки) в пути — всегда попытка обмана.
  // Проверяем по коду, а не регуляркой: control-char в literal запрещён линтером.
  if ([...raw].some((ch) => ch.charCodeAt(0) < 0x20)) return null;
  if (raw.includes("\\")) return null;
  if (raw.startsWith("/")) return null;
  if (/^[a-zA-Z]:/.test(raw)) return null;

  const out: string[] = [];
  for (const segment of raw.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.length > 0 ? out.join("/") : null;
}

/** Ключ корня для группировки в панели; `null` — путь вне белого списка. */
export function rootOf(relPath: string): string | null {
  for (const root of DOCS_ROOTS) {
    if (root.match(relPath)) return root.key;
  }
  return null;
}

/** Пускаем только пути из белого списка корней и расширений (R-M-2). */
export function isAllowed(relPath: string): boolean {
  return rootOf(relPath) !== null;
}

/**
 * Заголовок документа: первый `# ` или имя файла.
 *
 * Для не-markdown (`engine/*.yaml`) заголовок ищем НЕ по `# `: там это
 * комментарий YAML, а не заголовок, и панель показывала бы первую строку
 * шапки вместо имени файла.
 */
export function titleOf(markdown: string, relPath: string): string {
  const name = relPath.split("/").pop() ?? relPath;
  if (!relPath.endsWith(".md")) return name;

  // Внутри блока кода `# …` — комментарий shell или markdown-пример, а не
  // заголовок документа: рунбуки начинаются именно с такого блока.
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const fenceMark = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMark) {
      const mark = fenceMark[1][0];
      if (fence === null) fence = mark;
      else if (mark === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^# +(.+?)\s*$/.exec(line);
    if (heading) return heading[1].trim();
  }
  return name;
}

/** `[текст](цель)`, включая вариант с подписью `[текст](цель "подпись")`. */
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

/**
 * Пути документов, на которые ссылается markdown, — источник рёбер `links`.
 *
 * Внешние ссылки, якоря и всё вне белого списка отбрасываем: граф рисует связи
 * ВНУТРИ репозитория, а не карту интернета. Ссылка на себя петли не даёт.
 */
export function linksOf(markdown: string, fromPath: string): string[] {
  const out: string[] = [];
  const dir = path.posix.dirname(fromPath);
  for (const match of markdown.matchAll(LINK_RE)) {
    const target = match[1];
    if (target.startsWith("#")) continue;
    // Схема (http:, https:, mailto:, tel:) — ссылка наружу.
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const withoutAnchor = target.split("#")[0].split("?")[0];
    if (withoutAnchor.length === 0) continue;
    const candidate = withoutAnchor.startsWith("/")
      ? withoutAnchor.slice(1)
      : path.posix.join(dir, withoutAnchor);
    const rel = normalizeDocPath(candidate);
    if (rel === null || rel === fromPath) continue;
    if (!isAllowed(rel)) continue;
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

/** Путь в обратных кавычках: `routers/vendhub.md`, `engine/autonomy.yaml`. */
const BACKTICK_RE = /`([^`\n]+)`/g;
const PATH_TOKEN_RE = /^[A-Za-z0-9_./-]+\.(md|yaml)$/;

/**
 * Пути, УПОМЯНУТЫЕ в обратных кавычках, — источник рёбер `mentions`.
 *
 * В этом репозитории документы ссылаются друг на друга не markdown-ссылками, а
 * путём в бэктиках: на 208 файлов приходится всего 25 настоящих ссылок, и граф
 * из одних `links` распадался бы на 167 островов. Толкований два — путь от
 * корня репозитория и путь рядом с самим файлом; берём ПЕРВОЕ, которое
 * указывает на существующий файл из белого списка (`exists`), поэтому функция и
 * получает предикат, а не лезет на диск.
 */
export function mentionsOf(
  markdown: string,
  fromPath: string,
  exists: (relPath: string) => boolean,
): string[] {
  const out: string[] = [];
  const dir = path.posix.dirname(fromPath);
  for (const match of markdown.matchAll(BACKTICK_RE)) {
    const token = match[1].trim();
    if (!PATH_TOKEN_RE.test(token)) continue;
    for (const candidate of [token, path.posix.join(dir, token)]) {
      const rel = normalizeDocPath(candidate);
      if (rel === null || rel === fromPath) continue;
      if (!isAllowed(rel) || !exists(rel)) continue;
      if (!out.includes(rel)) out.push(rel);
      break;
    }
  }
  return out;
}

/**
 * Направления из `CLAUDE.md`: каждое упоминание `routers/<x>.md` — домен.
 *
 * Читаем весь файл, а не только таблицу «Направления»: роутеры упоминаются и в
 * других разделах (например `routers/dev.md` в «Инфраструктуре»), а разбор
 * границ markdown-таблицы ломался бы от любой правки шапки.
 */
export function domainsOf(markdown: string): string[] {
  const out: string[] = [];
  for (const match of markdown.matchAll(/routers\/([a-z0-9-]+)\.md/g)) {
    const domain = match[1];
    if (!out.includes(domain)) out.push(domain);
  }
  return out;
}

export type ToolType = "read" | "net" | "write" | "exec" | "money" | "contract";

/**
 * КОПИЯ карты типов инструментов из `apps/agents/src/tools.ts` (`classifyTool`).
 *
 * Импорт через границу приложений запрещён (у Core нет зависимости на agents),
 * поэтому таблица скопирована ДОСЛОВНО, а тест-снимок в `docs.service.test.ts`
 * читает оригинал с диска и краснеет при расхождении. Порядок — от самого
 * опасного к безопасному, чтобы `exec:pay_...` не утёк в read по подстроке.
 */
export const TOOL_RULES: readonly { re: RegExp; type: ToolType }[] = [
  { re: /(^|[:_])(contract|edo|dogovor|договор)/, type: "contract" },
  { re: /(money|invoice|payment|^pay|_pay|платеж|платёж|инкасс)/, type: "money" },
  { re: /(^exec|[:_]exec|^run[:_]|shell|bash|command)/, type: "exec" },
  { re: /(^write|[:_]write|create|update|delete|записать|создать|изменить)/, type: "write" },
  { re: /(^send|notify|post|message|telegram|email|отправ)/, type: "net" },
  { re: /(web|net|fetch|http|scrape|browse)/, type: "net" },
  { re: /(^read|[:_]read|^get|^list|kb|db|reg|entities)/, type: "read" },
];

/** Неизвестный инструмент считаем `net`, а не `read` (как в оригинале). */
export function classifyTool(tool: string): ToolType {
  const t = tool.trim().toLowerCase();
  for (const rule of TOOL_RULES) {
    if (rule.re.test(t)) return rule.type;
  }
  return "net";
}

/** Вид узла по корню пути (R-M-4). */
function kindOfPath(relPath: string): GraphNodeKind {
  if (relPath === ROOT_DOC) return "root";
  if (relPath.startsWith("routers/")) return "router";
  if (relPath.startsWith("memory/")) return "memory";
  if (relPath.startsWith("docs/decisions/")) return "decision";
  if (relPath.startsWith("engine/")) return "engine";
  if (relPath.startsWith("apps/agents/shared/")) return "kb";
  // Файл навыка И навык из каталога — ОДИН узел: два узла на один навык
  // рвали бы граф надвое (и «Мозг» показывал бы навыки дважды).
  if (/^apps\/agents\/agents\/[^/]+\/skills\/[^/]+\.md$/.test(relPath)) return "skill";
  return "doc";
}

/**
 * Направление агента по полю `business`: `shared` — общий агент (домен MYDON),
 * `ventures:<slug>` — кандидат фабрики направлений (домен Ventures).
 */
function domainOfBusiness(business: string): string {
  const value = business.trim().toLowerCase();
  if (value.length === 0 || value === "shared") return "mydon";
  if (value.startsWith("ventures:")) return "ventures";
  return value;
}

/**
 * Путь страницы знаний из `kb_pages` в репо-относительный.
 *
 * В карточках страницы записаны от `apps/agents/` (`shared/kb/...`), но
 * встречается и запись от самого `shared/` — принимаем оба вида, иначе часть
 * рёбер `reads_kb` молча пропала бы.
 */
function kbPagePath(page: string): string | null {
  const rel = page.trim();
  if (rel.length === 0) return null;
  const full = rel.startsWith("shared/") ? `apps/agents/${rel}` : `apps/agents/shared/${rel}`;
  return normalizeDocPath(full);
}

/** Файл навыка агента на диске — если он есть, узел навыка получает `path`. */
function skillFilePath(agentName: string, skill: string): string {
  return `apps/agents/agents/${agentName}/skills/${skill}.md`;
}

/**
 * Граф знаний: документы с диска + агенты и каталог навыков из базы (R-M-4).
 *
 * Рёбра проводим только между СУЩЕСТВУЮЩИМИ узлами: ссылка на удалённый файл
 * или на несуществующую kb-страницу узла не выдумывает — иначе панель рисовала
 * бы обещание, которого в репозитории нет.
 */
export function buildGraph(
  files: readonly DocFile[],
  agents: readonly GraphAgent[],
  catalog: readonly GraphSkillRow[],
  now: Date = new Date(),
): DocsGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const addNode = (node: GraphNode): void => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const edgeKeyOf = (from: string, to: string, kind: GraphEdgeKind): string =>
    `${from} ${to} ${kind}`;
  const addEdge = (from: string, to: string, kind: GraphEdgeKind): void => {
    const key = edgeKeyOf(from, to, kind);
    if (!edges.has(key)) edges.set(key, { from, to, kind });
  };

  const byPath = new Map<string, DocFile>();
  for (const file of files) {
    byPath.set(file.path, file);
    const kind = kindOfPath(file.path);
    const node: GraphNode = { id: file.path, kind, label: file.title, path: file.path };
    // Файл навыка — он же узел навыка, значит и ссылка у него навыковая.
    if (kind === "skill") node.href = "/skills";
    addNode(node);
  }

  // routes: CLAUDE.md -> роутер -> домен
  const root = byPath.get(ROOT_DOC);
  if (root) {
    for (const domain of domainsOf(root.markdown)) {
      const routerPath = `routers/${domain}.md`;
      // Роутер может быть объявлен в таблице, но ещё не написан — узел нужен
      // всё равно, иначе направление исчезает из графа целиком.
      addNode({ id: routerPath, kind: "router", label: domain });
      addEdge(ROOT_DOC, routerPath, "routes");
      const domainId = `domain:${domain}`;
      addNode({ id: domainId, kind: "domain", label: domain });
      addEdge(routerPath, domainId, "routes");
    }
  }

  // owns / has_skill / uses_tool / reads_kb
  const skillsByAgent = new Map<string, Set<string>>();
  const toolsBySkill = new Map<string, Set<string>>();
  for (const agent of agents) {
    skillsByAgent.set(agent.name, new Set(agent.skills.filter((s) => s.trim().length > 0)));
  }
  for (const row of catalog) {
    // Каталог переживает архивацию карточки: строки архивных агентов
    // игнорируем, иначе «Мозг» показывал бы снятых с работы агентов.
    const known = skillsByAgent.get(row.agentName);
    if (!known) continue;
    known.add(row.skill);
    const key = `${row.agentName}/${row.skill}`;
    const tools = toolsBySkill.get(key) ?? new Set<string>();
    for (const tool of row.allowedTools) tools.add(tool);
    toolsBySkill.set(key, tools);
  }

  for (const agent of agents) {
    const agentId = `agent:${agent.name}`;
    // Имя агента приходит из базы и попадает в URL — экранируем, а не верим.
    addNode({
      id: agentId,
      kind: "agent",
      label: agent.name,
      href: `/agents/${encodeURIComponent(agent.name)}`,
    });

    // Паспорт агента — обычный документ дерева; связь с ним объявляем явно,
    // иначе ROLE.md висел бы островом рядом со своим же агентом.
    const rolePath = `apps/agents/agents/${agent.name}/ROLE.md`;
    if (byPath.has(rolePath)) addEdge(agentId, rolePath, "describes");

    const domain = domainOfBusiness(agent.business);
    const domainId = `domain:${domain}`;
    addNode({ id: domainId, kind: "domain", label: domain });
    addEdge(domainId, agentId, "owns");

    for (const page of agent.kbPages) {
      const kbPath = kbPagePath(page);
      if (kbPath !== null && byPath.has(kbPath)) addEdge(agentId, kbPath, "reads_kb");
    }

    for (const skill of skillsByAgent.get(agent.name) ?? []) {
      const filePath = skillFilePath(agent.name, skill);
      // Есть файл — узлом навыка служит он сам (уже добавлен выше). Нет файла
      // (навык только в карточке или в каталоге) — синтетический узел, чтобы
      // навык не исчез из графа молча.
      const skillId = byPath.has(filePath) ? filePath : `skill:${agent.name}/${skill}`;
      if (!byPath.has(filePath)) {
        addNode({ id: skillId, kind: "skill", label: skill, href: "/skills" });
      }
      addEdge(agentId, skillId, "has_skill");

      for (const tool of toolsBySkill.get(`${agent.name}/${skill}`) ?? []) {
        const type = classifyTool(tool);
        const toolId = `tool:${type}`;
        addNode({ id: toolId, kind: "tool", label: type });
        addEdge(skillId, toolId, "uses_tool");
      }
    }
  }

  // links: markdown-ссылки между документами; mentions: пути в бэктиках
  const exists = (relPath: string): boolean => byPath.has(relPath);
  for (const file of files) {
    for (const target of linksOf(file.markdown, file.path)) {
      if (byPath.has(target)) addEdge(file.path, target, "links");
    }
    for (const target of mentionsOf(file.markdown, file.path, exists)) {
      // Настоящая ссылка сильнее упоминания: вторым ребром ту же пару не дублируем.
      if (edges.has(edgeKeyOf(file.path, target, "links"))) continue;
      addEdge(file.path, target, "mentions");
    }
  }

  const byId = (a: { id: string }, b: { id: string }): number =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const edgeKey = (e: GraphEdge): string => `${e.from}|${e.to}|${e.kind}`;

  return {
    nodes: [...nodes.values()].sort(byId),
    edges: [...edges.values()].sort((a, b) => (edgeKey(a) < edgeKey(b) ? -1 : 1)),
    builtAt: now.toISOString(),
  };
}
