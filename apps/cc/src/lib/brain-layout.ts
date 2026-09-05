import type { DocsGraph, GraphEdgeKind, GraphNode, GraphNodeKind } from "./core";

/**
 * Чистая арифметика экрана «Мозг» (R-M-6): что показать и каким токеном.
 *
 * Ни canvas, ни React, ни цветов значениями — только имена токенов. Цвет
 * читает уже компонент из `getComputedStyle(document.documentElement)`, потому
 * что тему выбирает браузер (`prefers-color-scheme`) или `data-theme`, и
 * зашитый здесь `#6d4bb8` протёк бы в светлую тему мимо палитры.
 */

/** Круг узла: чем именем токена красить и какого радиуса рисовать. */
export interface NodeStyle {
  token: string;
  r: number;
}

/** Линия ребра: токен, толщина и прозрачность. */
export interface EdgeStyle {
  token: string;
  width: number;
  alpha: number;
}

/**
 * Вид узла → токен и радиус.
 *
 * Токены — ТЕКСТОВОЙ глубины (`--tx`, `--tx-2`, `--tx-3`, `--hot`,
 * `--accent-tx`) и один `--agent`. Яркого `--accent` здесь нет намеренно:
 * §1 правил дизайна отдаёт его сплошным заливкам «нажми меня», а 219 кружков
 * графа — метки, а не кнопки. `--agent` достаётся ровно агенту: это
 * единственный внепалитровый токен, метка ИИ-исполнителя.
 *
 * Радиус спускается от корня к листьям (9 → 4): в графе из 219 узлов размер —
 * единственный способ увидеть скелет, не читая подписи.
 */
const NODE_STYLE: Readonly<Record<GraphNodeKind, NodeStyle>> = {
  root: { token: "--tx", r: 9 },
  domain: { token: "--tx", r: 8 },
  agent: { token: "--agent", r: 7 },
  router: { token: "--tx", r: 6 },
  skill: { token: "--accent-tx", r: 5 },
  tool: { token: "--tx-3", r: 4 },
  doc: { token: "--tx-2", r: 4 },
  memory: { token: "--tx-2", r: 4 },
  kb: { token: "--tx-2", r: 4 },
  decision: { token: "--hot", r: 4 },
  engine: { token: "--hot", r: 4 },
};

/**
 * Вид ребра → как рисовать.
 *
 * Три плотности, и это не украшение: на живом графе 478 рёбер `mentions`
 * (путь в бэктиках) против 23 `links` и полусотни структурных. Рисуй их
 * поровну — скелет («домен владеет агентом», «агент умеет навык») утонет в
 * сетке упоминаний. Поэтому упоминания — самая тонкая и самая прозрачная
 * линия, структура — самая плотная.
 *
 * Цвета — только линейные токены: рёбра не текст и не бренд, им хватает
 * `--line-strong` (3,26:1 в светлой) и `--line` для шума.
 */
const STRUCTURAL: EdgeStyle = { token: "--line-strong", width: 1.4, alpha: 0.85 };
const EDGE_STYLE: Readonly<Record<GraphEdgeKind, EdgeStyle>> = {
  routes: STRUCTURAL,
  owns: STRUCTURAL,
  has_skill: STRUCTURAL,
  uses_tool: STRUCTURAL,
  reads_kb: STRUCTURAL,
  describes: STRUCTURAL,
  links: { token: "--line-strong", width: 1, alpha: 0.55 },
  mentions: { token: "--line", width: 0.5, alpha: 0.22 },
};

/** Вид узла словами — легенда и карточка объясняют граф по-русски, а не кодами. */
const KIND_LABEL: Readonly<Record<GraphNodeKind, string>> = {
  root: "корень",
  router: "роутер",
  domain: "направление",
  agent: "агент",
  skill: "навык",
  tool: "инструмент",
  doc: "документ",
  memory: "память",
  decision: "решение",
  engine: "движок",
  kb: "знания",
};

export function styleOf(kind: GraphNodeKind): NodeStyle {
  return NODE_STYLE[kind];
}

export function edgeStyle(kind: GraphEdgeKind): EdgeStyle {
  return EDGE_STYLE[kind];
}

export function kindLabel(kind: GraphNodeKind): string {
  return KIND_LABEL[kind];
}

/**
 * Совпал ли узел с запросом.
 *
 * Ищем по трём полям сразу: заголовок русский («Ревизия узлов»), путь
 * латиницей (`apps/agents/.../parts-audit.md`), идентификатор синтетических
 * узлов вообще не путь (`domain:vendhub`) — владелец помнит то одно, то другое.
 * Запрос уже приведён к нижнему регистру вызывающим.
 */
function hits(node: GraphNode, needle: string): boolean {
  return (
    node.label.toLowerCase().includes(needle) ||
    node.id.toLowerCase().includes(needle) ||
    (node.path?.toLowerCase().includes(needle) ?? false)
  );
}

/** То же совпадение, но с сырым запросом — для списка результатов в панели. */
export function matchesQuery(node: GraphNode, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || hits(node, needle);
}

/**
 * Граф, суженный до совпадений и их прямых соседей (R-M-6).
 *
 * Соседи обязательны: узел «Ревизия узлов» сам по себе не отвечает ни на один
 * вопрос владельца — отвечает «чей это навык и чем он лезет наружу». Второй
 * круг не берём: на этом графе он почти всегда возвращает весь граф обратно.
 *
 * Пустой запрос — весь граф без копирования: это самый частый случай (экран
 * открывается именно так), и пересобирать 219 узлов на каждый рендер незачем.
 */
export function subgraph(graph: DocsGraph, query: string): DocsGraph {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return graph;

  const keep = new Set<string>();
  for (const node of graph.nodes) {
    if (hits(node, needle)) keep.add(node.id);
  }
  // Соседей собираем ПО ИСХОДНОМУ набору совпадений: расширять `keep` прямо в
  // цикле значило бы тянуть соседей соседей и разворачивать граф целиком.
  const matched = new Set(keep);
  for (const edge of graph.edges) {
    if (matched.has(edge.from)) keep.add(edge.to);
    if (matched.has(edge.to)) keep.add(edge.from);
  }

  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
    builtAt: graph.builtAt,
  };
}

/** Сколько узлов каждого вида в показанном графе — счётчики легенды. */
export function countByKind(nodes: readonly GraphNode[]): [GraphNodeKind, number][] {
  const counts = new Map<GraphNodeKind, number>();
  for (const node of nodes) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  // Порядок легенды — порядок карты стилей: от корня к листьям, а не по
  // алфавиту и не по частоте (иначе чипы прыгают при каждом поиске).
  return (Object.keys(NODE_STYLE) as GraphNodeKind[])
    .filter((kind) => counts.has(kind))
    .map((kind) => [kind, counts.get(kind) ?? 0]);
}
