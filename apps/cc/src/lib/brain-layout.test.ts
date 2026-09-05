import { describe, expect, it } from "vitest";
import { edgeStyle, kindLabel, matchesQuery, styleOf, subgraph } from "./brain-layout";
import type { DocsGraph } from "./core";

const SKILL = "apps/agents/agents/parts-keeper/skills/parts-audit.md";

/**
 * Миниатюра настоящего графа: корень → роутер → домен → агент → навык →
 * инструменты, плюс несколько документов в стороне. Живой граф — ~219 узлов и
 * ~522 ребра, и проверять на нём «сузилось ли» бессмысленно.
 */
const graph: DocsGraph = {
  builtAt: "2026-09-06T08:00:00.000Z",
  nodes: [
    { id: "CLAUDE.md", kind: "root", label: "MYDON — контекст монорепо", path: "CLAUDE.md" },
    { id: "routers/vendhub.md", kind: "router", label: "vendhub", path: "routers/vendhub.md" },
    { id: "domain:vendhub", kind: "domain", label: "vendhub" },
    { id: "agent:parts-keeper", kind: "agent", label: "parts-keeper", href: "/agents/parts-keeper" },
    { id: SKILL, kind: "skill", label: "Ревизия узлов", path: SKILL, href: "/skills" },
    { id: "tool:read", kind: "tool", label: "read" },
    { id: "tool:write", kind: "tool", label: "write" },
    { id: "docs/DEPLOY.md", kind: "doc", label: "Деплой MYDON", path: "docs/DEPLOY.md" },
    { id: "memory/glossary.md", kind: "memory", label: "Словарь", path: "memory/glossary.md" },
    {
      id: "docs/decisions/2026-08-22-navigaciya-i-gamma.md",
      kind: "decision",
      label: "Навигация и гамма",
      path: "docs/decisions/2026-08-22-navigaciya-i-gamma.md",
    },
    { id: "engine/autonomy.yaml", kind: "engine", label: "autonomy.yaml", path: "engine/autonomy.yaml" },
    {
      id: "apps/agents/shared/kb/vendhub.md",
      kind: "kb",
      label: "VendHub — знания",
      path: "apps/agents/shared/kb/vendhub.md",
    },
  ],
  edges: [
    { from: "CLAUDE.md", to: "routers/vendhub.md", kind: "routes" },
    { from: "routers/vendhub.md", to: "domain:vendhub", kind: "routes" },
    { from: "domain:vendhub", to: "agent:parts-keeper", kind: "owns" },
    { from: "agent:parts-keeper", to: SKILL, kind: "has_skill" },
    { from: "agent:parts-keeper", to: "apps/agents/shared/kb/vendhub.md", kind: "reads_kb" },
    { from: SKILL, to: "tool:read", kind: "uses_tool" },
    { from: SKILL, to: "tool:write", kind: "uses_tool" },
    { from: "memory/glossary.md", to: "CLAUDE.md", kind: "mentions" },
    { from: "docs/DEPLOY.md", to: "engine/autonomy.yaml", kind: "links" },
  ],
};

const ids = (g: DocsGraph): string[] => g.nodes.map((n) => n.id).sort();

describe("Подграф поиска", () => {
  it("пустой запрос отдаёт весь граф", () => {
    const all = subgraph(graph, "");
    expect(all.nodes).toHaveLength(graph.nodes.length);
    expect(all.edges).toHaveLength(graph.edges.length);
    // Пробел — тот же пустой запрос: «стёр строку не до конца» не должно
    // схлопывать граф в ноль узлов.
    expect(subgraph(graph, "   ").nodes).toHaveLength(graph.nodes.length);
  });

  it("держит совпавший узел вместе с прямыми соседями", () => {
    const view = subgraph(graph, "parts-audit");
    // Совпадение — по пути файла навыка; агент и оба инструмента приходят
    // соседями: навык без хозяина и без инструментов ничего не объясняет.
    expect(ids(view)).toEqual(
      ["agent:parts-keeper", SKILL, "tool:read", "tool:write"].sort(),
    );
  });

  it("ищет и по заголовку, и по идентификатору узла", () => {
    expect(ids(subgraph(graph, "Ревизия"))).toContain(SKILL);
    expect(ids(subgraph(graph, "domain:vendhub"))).toContain("domain:vendhub");
    // Регистр не важен: пути латиницей, заголовки русские.
    expect(ids(subgraph(graph, "DEPLOY"))).toContain("docs/DEPLOY.md");
  });

  it("оставляет только рёбра, у которых оба конца в подграфе", () => {
    const view = subgraph(graph, "parts-audit");
    const kept = new Set(view.nodes.map((n) => n.id));
    expect(view.edges.length).toBeGreaterThan(0);
    for (const e of view.edges) {
      expect(kept.has(e.from)).toBe(true);
      expect(kept.has(e.to)).toBe(true);
    }
    // Ребро «домен владеет агентом» уходит: домен в подграф не попал.
    expect(view.edges.some((e) => e.from === "domain:vendhub")).toBe(false);
  });

  it("ничего не нашлось — пустой граф, а не весь целиком", () => {
    expect(subgraph(graph, "такого узла нет").nodes).toHaveLength(0);
  });

  it("builtAt переносится: подграф — это тот же снимок", () => {
    expect(subgraph(graph, "parts-audit").builtAt).toBe(graph.builtAt);
  });
});

describe("Предикат совпадения", () => {
  it("совпадение по заголовку, идентификатору и пути", () => {
    const node = graph.nodes.find((n) => n.id === SKILL)!;
    expect(matchesQuery(node, "ревизия")).toBe(true);
    expect(matchesQuery(node, "parts-keeper")).toBe(true);
    expect(matchesQuery(node, "снабжение")).toBe(false);
  });
});

describe("Стиль узла", () => {
  it("вид решает токен цвета", () => {
    expect(styleOf("agent").token).toBe("--agent");
    expect(styleOf("skill").token).toBe("--accent-tx");
    expect(styleOf("tool").token).toBe("--tx-3");
    expect(styleOf("doc").token).toBe("--tx-2");
    expect(styleOf("memory").token).toBe("--tx-2");
    expect(styleOf("kb").token).toBe("--tx-2");
    expect(styleOf("decision").token).toBe("--hot");
    expect(styleOf("engine").token).toBe("--hot");
    expect(styleOf("root").token).toBe("--tx");
    expect(styleOf("router").token).toBe("--tx");
    expect(styleOf("domain").token).toBe("--tx");
  });

  it("--agent достаётся ТОЛЬКО агенту (правило дизайна §4)", () => {
    const kinds = graph.nodes.map((n) => n.kind);
    for (const kind of kinds) {
      if (kind !== "agent") expect(styleOf(kind).token).not.toBe("--agent");
    }
  });

  it("ни один узел не красится яркой заливкой --accent", () => {
    for (const node of graph.nodes) expect(styleOf(node.kind).token).not.toBe("--accent");
  });

  it("радиус падает по мере спуска от корня к листьям", () => {
    expect(styleOf("root").r).toBe(9);
    expect(styleOf("domain").r).toBe(8);
    expect(styleOf("agent").r).toBe(7);
    expect(styleOf("router").r).toBe(6);
    expect(styleOf("skill").r).toBe(5);
    expect(styleOf("tool").r).toBe(4);
    expect(styleOf("doc").r).toBe(4);
  });
});

describe("Стиль ребра", () => {
  it("mentions — самое тонкое и самое прозрачное", () => {
    const mentions = edgeStyle("mentions");
    for (const kind of ["links", "routes", "owns", "has_skill", "uses_tool", "reads_kb", "describes"] as const) {
      expect(mentions.width).toBeLessThan(edgeStyle(kind).width);
      expect(mentions.alpha).toBeLessThan(edgeStyle(kind).alpha);
    }
  });

  it("структурные рёбра плотнее markdown-ссылок", () => {
    // 478 упоминаний против 23 ссылок: скелет (кто кем владеет, кто что умеет)
    // должен читаться поверх шума, а не тонуть в нём.
    expect(edgeStyle("owns").alpha).toBeGreaterThan(edgeStyle("links").alpha);
    expect(edgeStyle("has_skill").width).toBeGreaterThanOrEqual(edgeStyle("links").width);
  });

  it("цвет ребра — токен линии, не текста и не бренда", () => {
    for (const kind of ["links", "mentions", "routes", "owns", "has_skill", "uses_tool", "reads_kb", "describes"] as const) {
      expect(edgeStyle(kind).token).toMatch(/^--line/);
    }
  });
});

describe("Вид узла словами", () => {
  it("каждый вид назван по-русски", () => {
    expect(kindLabel("root")).toBe("корень");
    expect(kindLabel("router")).toBe("роутер");
    expect(kindLabel("domain")).toBe("направление");
    expect(kindLabel("agent")).toBe("агент");
    expect(kindLabel("skill")).toBe("навык");
    expect(kindLabel("tool")).toBe("инструмент");
    expect(kindLabel("doc")).toBe("документ");
    expect(kindLabel("memory")).toBe("память");
    expect(kindLabel("decision")).toBe("решение");
    expect(kindLabel("engine")).toBe("движок");
    expect(kindLabel("kb")).toBe("знания");
  });
});
