import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildGraph,
  classifyTool,
  domainsOf,
  isAllowed,
  linksOf,
  normalizeDocPath,
  repoRootFrom,
  rootOf,
  titleOf,
  TOOL_RULES,
  type DocFile,
  type GraphAgent,
  type GraphSkillRow,
} from "./docs-graph";

describe("Белый список корней документов (R-M-2)", () => {
  it("пускает файлы из объявленных корней", () => {
    for (const ok of [
      "CLAUDE.md",
      "docs/AGENTS.md",
      "docs/superpowers/specs/2026-09-06-x-design.md",
      "memory/glossary.md",
      "routers/vendhub.md",
      "engine/autonomy.yaml",
      "engine/eval-rubric.md",
      "apps/agents/shared/COMPANY.md",
      "apps/agents/shared/kb/globerent/faq.md",
      "apps/agents/agents/vendhub-ops/ROLE.md",
      "apps/agents/agents/vendhub-ops/skills/monitor-stock.md",
      ".claude/skills/onboard/SKILL.md",
      ".claude/skills/mydon-design/references/tokens.md",
    ]) {
      assert.equal(isAllowed(ok), true, `${ok} должен быть разрешён`);
    }
  });

  it("не пускает исходники, чужие расширения и архив стартера", () => {
    for (const bad of [
      "apps/core/src/main.ts",
      "docs/agentic-os-starter/_backup/a.md",
      "package.json",
      ".env",
      "docs/design/screen.png",
      // routers — только верхний уровень, engine — только верхний уровень
      "routers/sub/x.md",
      "engine/sub/x.yaml",
      // паспорта агентов — только ROLE.md и skills/*.md, не config.yaml
      "apps/agents/agents/vendhub-ops/config.yaml",
      // навыки .claude — только SKILL.md и references/**
      ".claude/skills/onboard/notes.md",
      "apps/agents/src/tools.ts",
    ]) {
      assert.equal(isAllowed(bad), false, `${bad} НЕ должен быть разрешён`);
    }
  });

  it("rootOf называет корень для группировки в панели", () => {
    assert.equal(rootOf("CLAUDE.md"), "CLAUDE.md");
    assert.equal(rootOf("docs/a/b.md"), "docs");
    assert.equal(rootOf("apps/agents/shared/kb/index.md"), "apps/agents/shared");
    assert.equal(rootOf("apps/agents/agents/x/ROLE.md"), "apps/agents/agents");
    assert.equal(rootOf(".claude/skills/onboard/SKILL.md"), ".claude/skills");
    assert.equal(rootOf("apps/core/src/main.ts"), null);
  });
});

describe("Нормализация пути (traversal, абсолют, дубли слэшей)", () => {
  it("отбивает выход за корень и абсолютные пути", () => {
    assert.equal(normalizeDocPath("../etc/passwd"), null);
    assert.equal(normalizeDocPath("docs/../../etc/passwd"), null);
    assert.equal(normalizeDocPath("/abs"), null);
    assert.equal(normalizeDocPath("/etc/passwd"), null);
    assert.equal(normalizeDocPath("C:\\Windows\\win.ini"), null);
    assert.equal(normalizeDocPath(""), null);
    assert.equal(normalizeDocPath("   "), null);
    assert.equal(normalizeDocPath("docs/a\u0000.md"), null);
  });

  it("схлопывает дубли слэшей и точки, оставляя путь внутри репо", () => {
    assert.equal(normalizeDocPath("docs//a.md"), "docs/a.md");
    assert.equal(normalizeDocPath("./docs/./a.md"), "docs/a.md");
    assert.equal(normalizeDocPath("docs/b/../a.md"), "docs/a.md");
    assert.equal(normalizeDocPath("  docs/a.md  "), "docs/a.md");
  });
});

describe("Заголовок документа", () => {
  it("берёт первый заголовок первого уровня", () => {
    assert.equal(titleOf("# Заголовок\n\nтекст", "docs/a.md"), "Заголовок");
    assert.equal(titleOf("---\ntitle: x\n---\n\n## Второй\n\n# Главный\n", "docs/a.md"), "Главный");
  });

  it("без заголовка — имя файла", () => {
    assert.equal(titleOf("просто текст", "docs/a/b.md"), "b.md");
    assert.equal(titleOf("", "memory/glossary.md"), "glossary.md");
  });

  it("для не-markdown (engine/*.yaml) заголовок — имя файла: «# » там комментарий, а не заголовок", () => {
    assert.equal(titleOf("# engine/autonomy.yaml — зеркало кода\ntiers:\n", "engine/autonomy.yaml"), "autonomy.yaml");
  });
});

describe("Ссылки между документами (рёбра links)", () => {
  const md = [
    "[док](../docs/a.md)",
    "[память](/memory/x.md)",
    "[внешка](https://example.com/a.md)",
    "[почта](mailto:js@example.com)",
    "[якорь](#разделы)",
    "[код](../apps/core/src/main.ts)",
    "[тот же док с якорем](../docs/a.md#часть)",
    "[вне белого списка](../package.json)",
    "[архив](../docs/agentic-os-starter/_backup/a.md)",
    "[выход за репо](../../etc/passwd)",
    '[с подписью](../memory/x.md "подпись")',
  ].join("\n\n");

  it("резолвит относительные и репо-абсолютные пути, отбрасывает всё остальное", () => {
    assert.deepEqual(linksOf(md, "routers/vendhub.md"), ["docs/a.md", "memory/x.md"]);
  });

  it("ссылка на себя не создаёт петлю", () => {
    assert.deepEqual(linksOf("[я](vendhub.md)", "routers/vendhub.md"), []);
  });

  it("домены роутеров читаются из CLAUDE.md по таблице направлений", () => {
    const claude = [
      "| Домен | Что это | Роутер |",
      "| **GLOBERENT** | погрузчики | `routers/globerent.md` |",
      "| **VendHub** | кофе | `routers/vendhub.md` |",
      "| *(процесс)* | разработка | `routers/dev.md` |",
      "",
      "Подробности — `routers/dev.md`.",
    ].join("\n");
    assert.deepEqual(domainsOf(claude), ["globerent", "vendhub", "dev"]);
  });
});

// ── Граф «Мозг» (R-M-4) ─────────────────────────────────────────────────────

const f = (p: string, markdown = ""): DocFile => ({
  path: p,
  root: rootOf(p) ?? "",
  title: p,
  bytes: Buffer.byteLength(markdown, "utf8"),
  updatedAt: "2026-09-06T00:00:00.000Z",
  markdown,
});

const FILES: DocFile[] = [
  f(
    "CLAUDE.md",
    [
      "| **VendHub** | сеть | `routers/vendhub.md` |",
      "| **MYDON** | оболочка | `routers/mydon.md` |",
      "[словарь](/memory/glossary.md)",
    ].join("\n"),
  ),
  f("routers/vendhub.md", "[правила](../memory/constraints.md)"),
  f("memory/glossary.md"),
  f("memory/constraints.md"),
  f("apps/agents/agents/vendhub-ops/skills/monitor-stock.md"),
  f("apps/agents/shared/kb/vendhub/sop.md"),
  f("docs/decisions/2026-09-06-x.md"),
  f("engine/autonomy.yaml"),
];

const AGENTS: GraphAgent[] = [
  {
    name: "vendhub-ops",
    business: "vendhub",
    skills: ["monitor-stock"],
    kbPages: ["shared/kb/vendhub/sop.md", "shared/kb/vendhub/нет-такой.md"],
  },
  { name: "chief-of-staff", business: "shared", skills: [], kbPages: [] },
  { name: "solution-scout", business: "ventures:kofe-to-go", skills: [], kbPages: [] },
];

const CATALOG: GraphSkillRow[] = [
  { agentName: "vendhub-ops", skill: "monitor-stock", allowedTools: ["reg:read_machines"] },
  { agentName: "vendhub-ops", skill: "send-digest", allowedTools: ["telegram:send"] },
  { agentName: "archived-agent", skill: "old", allowedTools: [] },
];

const graph = buildGraph(FILES, AGENTS, CATALOG, new Date("2026-09-06T10:00:00.000Z"));
const node = (id: string) => graph.nodes.find((n) => n.id === id);
const hasEdge = (from: string, to: string, kind: string) =>
  graph.edges.some((e) => e.from === from && e.to === to && e.kind === kind);

describe("buildGraph: виды узлов", () => {
  it("вид узла определяется корнем пути", () => {
    assert.equal(node("CLAUDE.md")?.kind, "root");
    assert.equal(node("routers/vendhub.md")?.kind, "router");
    assert.equal(node("memory/glossary.md")?.kind, "memory");
    assert.equal(node("docs/decisions/2026-09-06-x.md")?.kind, "decision");
    assert.equal(node("engine/autonomy.yaml")?.kind, "engine");
    assert.equal(node("apps/agents/shared/kb/vendhub/sop.md")?.kind, "kb");
    assert.equal(node("apps/agents/agents/vendhub-ops/skills/monitor-stock.md")?.kind, "doc");
  });

  it("агент — узел со ссылкой на карточку, домен — узел направления", () => {
    assert.deepEqual(
      { kind: node("agent:vendhub-ops")?.kind, href: node("agent:vendhub-ops")?.href },
      { kind: "agent", href: "/agents/vendhub-ops" },
    );
    assert.equal(node("domain:vendhub")?.kind, "domain");
    assert.equal(node("domain:mydon")?.kind, "domain");
  });

  it("навык из каталога — узел даже без файла (href на deck), с файлом — ещё и path", () => {
    const withFile = node("skill:vendhub-ops/monitor-stock");
    assert.equal(withFile?.kind, "skill");
    assert.equal(withFile?.href, "/skills");
    assert.equal(withFile?.path, "apps/agents/agents/vendhub-ops/skills/monitor-stock.md");
    const noFile = node("skill:vendhub-ops/send-digest");
    assert.equal(noFile?.kind, "skill", "навык без файла всё равно узел");
    assert.equal(noFile?.href, "/skills");
    assert.equal(noFile?.path, undefined);
  });

  it("узлы уникальны по id и отсортированы — панель рисует детерминированно", () => {
    const ids = graph.nodes.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length, "дублей узлов нет");
    assert.deepEqual(ids, [...ids].sort(), "узлы отсортированы по id");
    assert.equal(graph.builtAt, "2026-09-06T10:00:00.000Z");
  });

  it("каталог архивного агента не воскрешает его узел", () => {
    assert.equal(node("agent:archived-agent"), undefined);
    assert.equal(node("skill:archived-agent/old"), undefined);
  });
});

describe("buildGraph: рёбра", () => {
  it("routes: корень → роутер → домен (роутер без файла всё равно узел)", () => {
    assert.ok(hasEdge("CLAUDE.md", "routers/vendhub.md", "routes"));
    assert.ok(hasEdge("CLAUDE.md", "routers/mydon.md", "routes"));
    assert.equal(node("routers/mydon.md")?.kind, "router", "роутера нет в дереве — узел всё равно нужен");
    assert.ok(hasEdge("routers/vendhub.md", "domain:vendhub", "routes"));
    assert.ok(hasEdge("routers/mydon.md", "domain:mydon", "routes"));
  });

  it("owns: домен владеет агентом; shared → mydon, ventures:<slug> → ventures", () => {
    assert.ok(hasEdge("domain:vendhub", "agent:vendhub-ops", "owns"));
    assert.ok(hasEdge("domain:mydon", "agent:chief-of-staff", "owns"));
    assert.ok(hasEdge("domain:ventures", "agent:solution-scout", "owns"));
  });

  it("has_skill: навыки карточки и каталога объединяются", () => {
    assert.ok(hasEdge("agent:vendhub-ops", "skill:vendhub-ops/monitor-stock", "has_skill"));
    assert.ok(hasEdge("agent:vendhub-ops", "skill:vendhub-ops/send-digest", "has_skill"));
  });

  it("uses_tool: тип инструмента — узел tool:<type>", () => {
    assert.equal(node("tool:read")?.kind, "tool");
    assert.ok(hasEdge("skill:vendhub-ops/monitor-stock", "tool:read", "uses_tool"));
    assert.ok(hasEdge("skill:vendhub-ops/send-digest", "tool:net", "uses_tool"));
  });

  it("reads_kb: только существующие страницы знаний", () => {
    assert.ok(hasEdge("agent:vendhub-ops", "apps/agents/shared/kb/vendhub/sop.md", "reads_kb"));
    assert.equal(
      graph.edges.filter((e) => e.kind === "reads_kb").length,
      1,
      "несуществующая kb-страница ребра не даёт",
    );
  });

  it("links: markdown-ссылки внутри белого списка", () => {
    assert.ok(hasEdge("CLAUDE.md", "memory/glossary.md", "links"));
    assert.ok(hasEdge("routers/vendhub.md", "memory/constraints.md", "links"));
  });

  it("все рёбра ссылаются на существующие узлы (граф не рвётся)", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      assert.ok(ids.has(e.from), `нет узла-источника ${e.from}`);
      assert.ok(ids.has(e.to), `нет узла-приёмника ${e.to}`);
    }
  });
});

describe("Типы инструментов — копия карты из apps/agents/src/tools.ts", () => {
  it("снимок классификации: от опасного к безопасному", () => {
    const expected: Record<string, string> = {
      "edo:sign_contract": "contract",
      "money:invoice": "money",
      "exec:pay_supplier": "exec",
      "pay_invoice": "money",
      "exec:run_report": "exec",
      "shell:ls": "exec",
      "write:task": "write",
      "reg:create_entity": "write",
      "telegram:send": "net",
      "web:fetch": "net",
      "reg:read_machines": "read",
      "kb:index": "read",
      "неведомый_инструмент": "net",
    };
    for (const [tool, type] of Object.entries(expected)) {
      assert.equal(classifyTool(tool), type, `${tool} → ${type}`);
    }
  });

  it("копия не разошлась с оригиналом в apps/agents/src/tools.ts", () => {
    const src = path.join(repoRootFrom(__dirname), "apps/agents/src/tools.ts");
    if (!existsSync(src)) return; // в урезанном образе оригинала может не быть — тест не про это
    const text = readFileSync(src, "utf8");
    const original = [...text.matchAll(/if \(\/(.+?)\/\.test\(t\)\) return "(\w+)";/g)].map((m) => ({
      source: m[1],
      type: m[2],
    }));
    assert.ok(original.length > 0, "не удалось разобрать classifyTool в оригинале");
    assert.deepEqual(
      TOOL_RULES.map((r) => ({ source: r.re.source, type: r.type })),
      original,
      "карта типов инструментов в docs-graph.ts разошлась с apps/agents/src/tools.ts",
    );
  });
});

describe("Корень репозитория в рантайме", () => {
  it("repoRootFrom(dist/docs) указывает на репозиторий с CLAUDE.md", () => {
    const root = repoRootFrom(__dirname);
    assert.ok(
      existsSync(path.join(root, "CLAUDE.md")),
      `в ${root} нет CLAUDE.md — число уровней ".." посчитано неверно`,
    );
    assert.ok(existsSync(path.join(root, "routers")), `в ${root} нет routers/`);
  });
});
