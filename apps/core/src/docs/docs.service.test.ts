import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  buildGraph,
  classifyTool,
  domainsOf,
  isAllowed,
  isPersonalDoc,
  linksOf,
  mentionsOf,
  normalizeDocPath,
  repoRootFrom,
  rootOf,
  titleOf,
  TOOL_RULES,
  type DocFile,
  type GraphAgent,
  type GraphSkillRow,
} from "./docs-graph";
import { DocsService } from "./docs.service";

describe("Белый список корней документов (R-M-2)", () => {
  it("пускает файлы из объявленных корней", () => {
    for (const ok of [
      "CLAUDE.md",
      "docs/AGENTS.md",
      "docs/superpowers/specs/2026-09-06-x-design.md",
      // Остальной стартер — обычная документация: закрываем только копии личного.
      "docs/agentic-os-starter/APPLY.md",
      "docs/agentic-os-starter/routers/vendhub.md",
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
      // Пакет стартера везёт КОПИИ личных файлов — они вне белого списка
      // целиком, иначе личное читалось бы по общему сервисному токену.
      "docs/agentic-os-starter/memory/decisions.md",
      "docs/agentic-os-starter/memory/session-log/README.md",
      "docs/agentic-os-starter/routers/personal.md",
      // Шаблон нового агента — не паспорт: ни в дереве, ни в графе.
      "apps/agents/agents/_template/ROLE.md",
      "apps/agents/agents/_template/skills/example-skill.md",
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

  it("не берёт «# » изнутри блока кода: там это комментарий shell, а не заголовок", () => {
    const md = ["```bash", "# сначала собери образ", "docker build .", "```", "", "# Настоящий"].join("\n");
    assert.equal(titleOf(md, "docs/DEPLOY.md"), "Настоящий");
    // Незакрытый блок кода не должен «съедать» весь файл молча — заголовка нет,
    // значит имя файла.
    assert.equal(titleOf("~~~\n# внутри\n", "docs/x.md"), "x.md");
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

describe("Упоминания путей в бэктиках (рёбра mentions)", () => {
  const present = new Set(["docs/DEPLOY.md", "memory/glossary.md", "routers/vendhub.md", "engine/autonomy.yaml"]);
  const exists = (p: string): boolean => present.has(p);

  it("берёт репо-относительный путь, путь рядом с файлом и .yaml; несуществующий пропускает", () => {
    const md = [
      "деплой — `docs/DEPLOY.md`",
      "соседний роутер — `vendhub.md`",
      "зеркало — `engine/autonomy.yaml`",
      "которого нет — `docs/MISSING.md`",
    ].join("\n");
    assert.deepEqual(mentionsOf(md, "routers/mydon.md", exists), [
      "docs/DEPLOY.md",
      "routers/vendhub.md",
      "engine/autonomy.yaml",
    ]);
  });

  it("не путь и ссылка на себя упоминанием не считаются", () => {
    const md = "запусти `pnpm build`, читай `agent.name`, а это я сам — `mydon.md`";
    assert.deepEqual(mentionsOf(md, "routers/mydon.md", () => true), []);
  });

  it("тройные кавычки блока кода упоминанием не становятся", () => {
    assert.deepEqual(mentionsOf("```\ncat docs/DEPLOY.md\n```", "routers/mydon.md", exists), []);
  });
});

describe("Личный контур среди документов", () => {
  it("memory/**, роутер личного направления и профиль владельца — личные", () => {
    for (const p of [
      "memory/glossary.md",
      "memory/session-log/2026-09-05.md",
      "routers/personal.md",
      ".claude/skills/mydon-venture-factory/references/owner-profile.md",
    ]) {
      assert.equal(isPersonalDoc(p), true, `${p} — личный контур`);
    }
  });

  it("остальные документы личными не считаются", () => {
    for (const p of ["CLAUDE.md", "docs/DEPLOY.md", "routers/vendhub.md", "engine/autonomy.yaml"]) {
      assert.equal(isPersonalDoc(p), false, `${p} — не личный контур`);
    }
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
  f(
    "routers/vendhub.md",
    [
      "[правила](../memory/constraints.md)",
      "он же в бэктиках — `../memory/constraints.md`",
      "зеркало — `engine/autonomy.yaml`",
      "словарь рядом — `../memory/glossary.md`",
      "которого нет — `docs/MISSING.md`",
    ].join("\n\n"),
  ),
  f("memory/glossary.md"),
  f("memory/constraints.md"),
  f("apps/agents/agents/vendhub-ops/ROLE.md"),
  f("apps/agents/agents/vendhub-ops/skills/monitor-stock.md"),
  // Файл навыка агента, которого в базе нет (архивирован или удалён из карточек).
  f("apps/agents/agents/archived-agent/skills/old.md"),
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
  // Имя из базы может содержать что угодно — проверяем экранирование href.
  { name: "ops team", business: "vendhub", skills: [], kbPages: [] },
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
    assert.equal(node("apps/agents/agents/vendhub-ops/ROLE.md")?.kind, "doc");
  });

  it("агент — узел со ссылкой на карточку, домен — узел направления", () => {
    assert.deepEqual(
      { kind: node("agent:vendhub-ops")?.kind, href: node("agent:vendhub-ops")?.href },
      { kind: "agent", href: "/agents/vendhub-ops" },
    );
    assert.equal(node("domain:vendhub")?.kind, "domain");
    assert.equal(node("domain:mydon")?.kind, "domain");
    assert.equal(node("agent:ops team")?.href, "/agents/ops%20team", "имя в href экранировано");
  });

  it("навык с файлом — ОДИН узел (сам файл), дубля skill:<агент>/<навык> нет", () => {
    const filePath = "apps/agents/agents/vendhub-ops/skills/monitor-stock.md";
    const withFile = node(filePath);
    assert.equal(withFile?.kind, "skill");
    assert.equal(withFile?.href, "/skills");
    assert.equal(withFile?.path, filePath);
    assert.equal(node("skill:vendhub-ops/monitor-stock"), undefined, "второго узла на тот же навык быть не должно");
  });

  it("файл навыка без ЖИВОГО агента остаётся навыком, но ссылки на витрину не получает", () => {
    // Витрина `/skills` показывает навыки живых агентов: ссылка от файла
    // архивного агента вела бы на экран, где этого навыка нет.
    const orphan = node("apps/agents/agents/archived-agent/skills/old.md");
    assert.equal(orphan?.kind, "skill");
    assert.equal(orphan?.href, undefined, "ссылка на витрину — только у навыка живого агента");
    assert.equal(orphan?.path, "apps/agents/agents/archived-agent/skills/old.md");
  });

  it("навык без файла — синтетический узел, иначе он исчез бы из графа", () => {
    const noFile = node("skill:vendhub-ops/send-digest");
    assert.equal(noFile?.kind, "skill");
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

  it("has_skill: навыки карточки и каталога объединяются; цель — файл, если он есть", () => {
    assert.ok(
      hasEdge("agent:vendhub-ops", "apps/agents/agents/vendhub-ops/skills/monitor-stock.md", "has_skill"),
    );
    assert.ok(hasEdge("agent:vendhub-ops", "skill:vendhub-ops/send-digest", "has_skill"));
  });

  it("describes: агент связан со своим паспортом ROLE.md", () => {
    assert.ok(hasEdge("agent:vendhub-ops", "apps/agents/agents/vendhub-ops/ROLE.md", "describes"));
    assert.equal(
      graph.edges.filter((e) => e.kind === "describes").length,
      1,
      "паспорта нет — ребра нет",
    );
  });

  it("uses_tool: тип инструмента — узел tool:<type>", () => {
    assert.equal(node("tool:read")?.kind, "tool");
    assert.ok(
      hasEdge("apps/agents/agents/vendhub-ops/skills/monitor-stock.md", "tool:read", "uses_tool"),
    );
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

  it("mentions: пути в бэктиках — репо-относительный, соседний и .yaml", () => {
    assert.ok(hasEdge("CLAUDE.md", "routers/vendhub.md", "mentions"));
    assert.ok(hasEdge("routers/vendhub.md", "engine/autonomy.yaml", "mentions"));
    assert.ok(hasEdge("routers/vendhub.md", "memory/glossary.md", "mentions"));
  });

  it("mentions не дублирует пару, у которой уже есть настоящая ссылка", () => {
    assert.ok(hasEdge("routers/vendhub.md", "memory/constraints.md", "links"));
    assert.equal(
      hasEdge("routers/vendhub.md", "memory/constraints.md", "mentions"),
      false,
      "ссылка сильнее упоминания",
    );
  });

  it("рёбра не дублируются", () => {
    const keys = graph.edges.map((e) => `${e.from}|${e.to}|${e.kind}`);
    assert.equal(new Set(keys).size, keys.length);
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

  it("копия не разошлась с оригиналом в apps/agents/src/tools.ts", (t) => {
    const src = path.join(repoRootFrom(__dirname), "apps/agents/src/tools.ts");
    if (!existsSync(src)) {
      // Молчаливый `return` выглядел бы как пройденная сверка — говорим вслух.
      t.skip(`оригинал ${src} недоступен — сверять не с чем`);
      return;
    }
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

// ── DocsService: личный контур и живой репозиторий ───────────────────────────

/** Заглушка Db: `settingValue` делает ровно `select().from(systemConfig)`. */
function fakeDb(rows: { key: string; value: string }[]): ConstructorParameters<typeof DocsService>[0] {
  return {
    select: () => ({ from: () => Promise.resolve(rows) }),
  } as unknown as ConstructorParameters<typeof DocsService>[0];
}

const request = (headers: Record<string, string> = {}): Parameters<DocsService["file"]>[1] =>
  ({ headers }) as unknown as Parameters<DocsService["file"]>[1];

describe("Личный контур документов за owner-токеном (зеркало PersonalDomainGuard)", () => {
  const saved = {
    enforced: process.env.OWNER_IDENTITY_ENFORCED,
    service: process.env.SERVICE_TOKEN,
    owner: process.env.OWNER_ACTION_TOKEN,
  };
  const restore = (name: keyof typeof saved, env: string): void => {
    const prev = saved[name];
    if (prev === undefined) delete process.env[env];
    else process.env[env] = prev;
  };
  afterEach(() => {
    restore("enforced", "OWNER_IDENTITY_ENFORCED");
    restore("service", "SERVICE_TOKEN");
    restore("owner", "OWNER_ACTION_TOKEN");
  });

  const service = (enforced: boolean): DocsService =>
    new DocsService(fakeDb([{ key: "OWNER_IDENTITY_ENFORCED", value: enforced ? "1" : "0" }]));

  it("ужесточение ВКЛ и только сервисный токен: memory/ → 403, docs/ → 200", async () => {
    process.env.OWNER_IDENTITY_ENFORCED = "1";
    process.env.SERVICE_TOKEN = "shared";
    process.env.OWNER_ACTION_TOKEN = "owner-secret";
    const docs = service(true);

    await assert.rejects(
      () => docs.file("memory/glossary.md", request()),
      (err: { status?: number }) => err.status === 403,
      "SERVICE_TOKEN общий (он есть у бота и агентов) — личное им не отдаём",
    );
    assert.equal((await docs.file("docs/DEPLOY.md", request())).path, "docs/DEPLOY.md");
  });

  it("ужесточение ВКЛ и owner-токен: личное открывается и помечено", async () => {
    process.env.OWNER_IDENTITY_ENFORCED = "1";
    process.env.SERVICE_TOKEN = "shared";
    process.env.OWNER_ACTION_TOKEN = "owner-secret";
    const own = await service(true).file(
      "memory/glossary.md",
      request({ "x-owner-action-token": "owner-secret" }),
    );
    assert.equal(own.personal, true);
    assert.ok(own.markdown.length > 0);
  });

  it("ужесточение ВЫКЛ (дефолт прода): поведение прежнее — читаются оба", async () => {
    process.env.OWNER_IDENTITY_ENFORCED = "0";
    const docs = service(false);
    assert.ok((await docs.file("memory/glossary.md", request())).markdown.length > 0);
    assert.ok((await docs.file("docs/DEPLOY.md", request())).markdown.length > 0);
  });

  it("НИ ОДИН негейтед файл дерева не совпадает байт-в-байт с личным (живой репозиторий)", async () => {
    // Гейт `isPersonalDoc` стоит на ПУТИ. Пакет стартера (04.09) привёз полные
    // копии `memory/**` и `routers/personal.md` под корень `docs/`, и они
    // отдавались по общему сервисному токену — тот же текст, другой путь.
    // Тест ходит по НАСТОЯЩЕМУ дереву, поэтому будущий снимок-копия (новая
    // раскладка стартера, второй пакет) уронит CI, а не утечёт молча.
    const items = await service(false).tree();
    const root = repoRootFrom(__dirname);
    const sha = (rel: string): string =>
      createHash("sha256").update(readFileSync(path.join(root, rel))).digest("hex");

    const personalByHash = new Map<string, string>();
    for (const item of items) {
      // Пустые файлы совпадают друг с другом по определению — это не копия.
      if (item.personal === true && item.bytes > 0) personalByHash.set(sha(item.path), item.path);
    }
    assert.ok(personalByHash.size > 0, "личных документов в дереве нет — тест ничего не сторожит");

    for (const item of items) {
      if (item.personal === true || item.bytes === 0) continue;
      const twin = personalByHash.get(sha(item.path));
      assert.equal(
        twin,
        undefined,
        `${item.path} отдаётся без owner-гейта, а это копия личного ${twin}`,
      );
    }
  });

  it("дерево показывает личные документы, но помечает их (заголовки, не содержимое)", async () => {
    const items = await service(false).tree();
    const at = (p: string) => items.find((i) => i.path === p);
    assert.equal(at("memory/glossary.md")?.personal, true);
    assert.equal(at("routers/personal.md")?.personal, true);
    assert.equal(at("CLAUDE.md")?.personal, undefined, "лишнего personal:false в ответе нет");
    assert.ok(items.length >= 150, `в дереве ${items.length} файлов — ожидали ≥150`);
  });
});
