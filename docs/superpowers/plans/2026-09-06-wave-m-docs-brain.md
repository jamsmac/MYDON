# Волна M: зеркала под тестом, «Документы», «Мозг» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зеркала движка не расходятся с кодом (тест дрейфа); панель читает любой документ репозитория из Core; граф «Мозг» открывает любой навык/агента/документ за один клик.

**Architecture:** Core читает markdown с диска образа по белому списку и строит граф (скан ссылок + база: агенты, каталог навыков, kb_pages) с кэшем; панель — два экрана поверх трёх GET-маршрутов; тест дрейфа живёт в apps/agents рядом с кодом-истиной.

**Tech Stack:** NestJS (Core), Next.js 16 + `marked` + `d3-force` (cc), `node:test` (agents/core), vitest (cc), `yaml` (agents, уже есть).

**Spec:** `docs/superpowers/specs/2026-09-06-wave-m-docs-brain-design.md` (R-M-1…8)

## Global Constraints

- TypeScript strict, без `any`; русский в UI, английский в коде; Conventional Commits с трейлерами `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` и `Claude-Session: https://claude.ai/code/session_01NkuNnPz229PW2EbZ7E4YPa`.
- Core-тесты из `dist` (`pnpm --filter @mydon/core build && cd apps/core && node --test dist/<путь>.test.js`); agents аналогично; cc — `pnpm --filter cc test`.
- Полный гейт перед PR: `pnpm -r build && pnpm -r test && pnpm -r lint && pnpm -r typecheck && pnpm --filter @mydon/agents check:passports`.
- Docs-маршруты — только с сервисным токеном (R-M-8); traversal → 400 (R-M-2).
- Дизайн: `.claude/skills/mydon-design/{rules,tokens,primitives,checklist}.md`; `/brain` — консольная грамматика (эталон `/skills`), `/docs` — светлый экран чтения; новых цветов нет.
- Новые зависимости только `marked` и `d3-force` (+ `@types/d3-force`) в `apps/cc`; `pnpm install` обновляет lockfile — коммитить `pnpm-lock.yaml`.

---

### Task 1: Тест дрейфа зеркал движка

**Files:**
- Create: `apps/agents/src/engine-mirror.test.ts`
- Read: `engine/autonomy.yaml`, `engine/eval-rubric.md`, `apps/agents/src/{policy,tools,coach,coach-review,skill-loader}.ts`, `packages/shared/src/index.ts` (`AUTONOMY_TIERS`)

- [ ] **Step 1 (RED):** тест читает `engine/autonomy.yaml` (`yaml.parse`) и проверяет: `Object.keys(tiers)` === `AUTONOMY_TIERS` по порядку; для каждого `tool_types.<t>.min_tier` === `TOOLTYPE_MIN[t]` (экспорт из `tools.ts`; если он не экспортирован — экспортировать); `threshold_env === "AGENT_AUTONOMY_MAX"` и `autonomyThreshold(undefined) === threshold_default`; правило гейта: для таблицы `[threshold, actionTier] → requiresApproval` (T0/T1, T1/T1, T1/T2, T2/T2, T3/T1) значения совпадают с формулой из `rule` (реализовать мини-парсер строки `rule` НЕ нужно — проверять эквивалентную таблицу и держать её в тесте с комментарием «если правило в коде меняется, меняются и таблица, и строка rule в yaml»); `mirrored_at` — дата ISO. Для `eval-rubric.md`: распарсить таблицу критериев (регулярка по строкам `| \`key\` | … | ×N |`) → ключи и веса === `RUBRIC` из `coach.ts`; `PASS_THRESHOLD` из блока кода === `PASS_THRESHOLD`; строки исходов содержат каждое значение `CoachOutcome`. Запустить — RED хотя бы по одному пункту (например, добавить временно неверное ожидание) → затем реальные ожидания.
- [ ] **Step 2:** экспортировать недостающие константы (`TOOLTYPE_MIN`, `RUBRIC`, `PASS_THRESHOLD`, список исходов) без изменения поведения.
- [ ] **Step 3:** `pnpm --filter @mydon/agents build && cd apps/agents && node --test dist/engine-mirror.test.js` — GREEN; `pnpm --filter @mydon/agents lint`.
- [ ] **Step 4:** В шапку `engine/autonomy.yaml` и `engine/eval-rubric.md` добавить строку «Дрейф с кодом ловит `apps/agents/src/engine-mirror.test.ts` (CI)». Commit `test(agents): зеркала движка под тестом дрейфа (engine/autonomy.yaml, eval-rubric.md ↔ policy/tools/coach)`.

---

### Task 2: Core — модуль `docs` (дерево, файл, граф)

**Files:**
- Create: `apps/core/src/docs/docs.module.ts`, `docs.service.ts`, `docs.controller.ts`, `docs-graph.ts` (чистые функции), `docs.service.test.ts`, `docs.controller.test.ts`
- Modify: `apps/core/src/app.module.ts` (импорт `DocsModule`)

**Interfaces (Produces):**
```ts
export interface DocsTreeItem { path: string; root: string; title: string; bytes: number; updatedAt: string }
export interface DocFile extends DocsTreeItem { markdown: string }
export type GraphNodeKind = "root"|"router"|"domain"|"agent"|"skill"|"tool"|"doc"|"memory"|"decision"|"engine"|"kb";
export interface GraphNode { id: string; kind: GraphNodeKind; label: string; path?: string; href?: string }
export interface GraphEdge { from: string; to: string; kind: "links"|"routes"|"owns"|"has_skill"|"uses_tool"|"reads_kb" }
export interface DocsGraph { nodes: GraphNode[]; edges: GraphEdge[]; builtAt: string }
```
- [ ] **Step 1 (RED):** тесты чистых функций в `docs-graph.ts`: `isAllowed("docs/x.md")` true, `isAllowed("apps/core/src/main.ts")` false, `isAllowed("docs/agentic-os-starter/_backup/a.md")` false; `normalizeDocPath("../etc/passwd")` → null, `"/abs"` → null, `"docs//a.md"` → "docs/a.md"; `titleOf("# Заголовок\n…", p)` → "Заголовок", без `#` → имя файла; `linksOf(md, "routers/vendhub.md")` резолвит `../docs/a.md` и `/memory/x.md` (репо-абсолют) в пути, отбрасывает `http(s)://`, якоря `#…`, не-`.md`; `buildGraph(files, agents, catalog)`: root→router по таблице доменов из CLAUDE.md (`routers/<x>.md`), router→domain, domain(business)→agent, agent→skill (`has_skill`), skill→tool (`uses_tool`, узел `tool:<type>` через `classifyTool`-подобную карту типов из `engine/autonomy.yaml`? — НЕТ: типы инструментов брать из имени по той же карте, что `apps/agents/src/tools.ts`; чтобы не дублировать, скопировать таблицу в `docs-graph.ts` с комментарием-ссылкой и тестом-снимком), agent→kb (`reads_kb`, из `kbPages`), doc→doc (`links`); навык без файла — всё равно узел с `href: "/skills"`; агент — `href: "/agents/<name>"`.
- [ ] **Step 2:** `DocsService`: `repoRoot = path.resolve(__dirname, "../../..")`; `tree()` — рекурсивный скан по белому списку (только файлы, без симлинков — `lstat`), кэш 60 с; `file(path)` — `normalizeDocPath` + `isAllowed` + `realpath` внутри `repoRoot` иначе 404; лимит 512 КБ → 413; `graph()` — `buildGraph(tree, agents (из `agent` таблицы, не archived), catalog (`agent_skill_catalog`))`, кэш 60 с. Контроллер: `@Controller("docs")` + `@UseGuards(ServiceTokenGuard)` на классе (проверить, как гард применяется на GET в других owner-маршрутах; если гард глобальный пропускает GET — навесить явно), DTO `path` (`@IsString() @MaxLength(512)`).
- [ ] **Step 3:** `app.module.ts` импорт; сборка + тесты; ручная проверка: `curl -H "x-service-token: …" localhost:3001/docs/tree | head` (если Core поднят локально — иначе smoke в Task 5).
- [ ] **Step 4:** Commit `feat(core): модуль docs — дерево, файл и граф знаний с диска образа (белый список, сервисный токен)`.

---

### Task 3: Панель `/docs`

**Files:**
- Modify: `apps/cc/package.json` (+`marked`), `pnpm-lock.yaml`, `apps/cc/src/lib/core.ts` (типы + `docsTree()`, `docFile(path)`), `apps/cc/src/components/nav.tsx` (SYSTEM: `{ href: "/docs", icon: "jour", label: "Документы" }`)
- Create: `apps/cc/src/app/docs/page.tsx`, `apps/cc/src/components/docs-tree.tsx`, `apps/cc/src/components/doc-view.tsx`, `apps/cc/src/lib/markdown.ts` (обёртка `marked`: `renderer.html = escape`, ссылки `.md` → `/docs?path=`), tests `docs-tree.test.tsx`, `markdown.test.ts`

- [ ] **Step 1 (RED):** `markdown.test.ts`: `<script>` экранируется; `[a](../routers/x.md)` от `docs/y.md` → `href="/docs?path=routers/x.md"`; внешняя ссылка получает `target="_blank" rel="noopener"`. `docs-tree.test.tsx`: фильтр «vendhub» оставляет только совпадения; активный путь подсвечен (`aria-current`).
- [ ] **Step 2:** `pnpm --filter cc add marked`; реализация: страница (server) читает `?path`, грузит дерево и файл (если задан), `CoreDown` при ошибке; `.page-head` + `.lead` «N файлов в M корнях · обновлено {when(max updatedAt)}»; пустое → `.empty` «Документов нет — образ собран без docs/…». Макет: две колонки (`grid-template-columns: minmax(240px, 320px) 1fr`, на 390px — одна колонка, дерево сверху). `article.doc` — стили в `globals.css` только через токены (заголовки, код `--fm`, таблицы в `.table-scroll`).
- [ ] **Step 3:** тесты, typecheck, lint; `checklist.md`. Commit `feat(cc): экран «Документы» — дерево репозитория и чтение markdown из Core`.

---

### Task 4: Панель `/brain`

**Files:**
- Modify: `apps/cc/package.json` (+`d3-force`, `@types/d3-force` dev), `pnpm-lock.yaml`, `apps/cc/src/lib/core.ts` (`docsGraph()`), `apps/cc/src/components/nav.tsx` (SYSTEM: `{ href: "/brain", icon: "sky", label: "Мозг" }`), `apps/cc/src/app/globals.css` (легенда/карточка на токенах, если не хватает примитивов)
- Create: `apps/cc/src/app/brain/page.tsx`, `apps/cc/src/components/brain-graph.tsx` (client), `apps/cc/src/components/brain-graph.test.tsx`, `apps/cc/src/lib/brain-layout.ts` (чистые функции: фильтр по поиску с соседями, цвет/радиус по виду — возвращают имена токенов)

- [ ] **Step 1 (RED):** `brain-layout.test.ts`: `subgraph(graph, "parts-audit")` содержит навык, его агента и инструменты; пустой запрос → весь граф; `styleOf("agent")` → `{ token: "--agent", r: 7 }`, `styleOf("skill")` → `"--accent-tx"`, документы — `--tx-2`, engine — `--hot`. `brain-graph.test.tsx` (canvas замокан через `HTMLCanvasElement.prototype.getContext = () => stub`): ввод в поиск сужает список узлов в легенде/счётчике; клик по узлу (кнопка в списке результатов, не canvas) открывает карточку с `href`.
- [ ] **Step 2:** `pnpm --filter cc add d3-force && pnpm --filter cc add -D @types/d3-force`; страница (server) грузит граф → `<ConsoleTheme/>` + `<BrainGraph graph=…/>`; компонент: симуляция `forceSimulation(nodes).force("link", forceLink(edges).id(d=>d.id).distance(40)).force("charge", forceManyBody().strength(-80)).force("center", forceCenter(w/2,h/2)).force("collide", forceCollide(10))`, отрисовка на canvas по `requestAnimationFrame`, цвета — `getComputedStyle(document.documentElement).getPropertyValue(token)`; drag (pointer events), zoom колесом (масштаб 0.5–3); поиск (`input`) → `subgraph`; список совпадений (`.rows`, до 30) с кнопками — доступный путь без canvas; карточка `.panel.console` справа: label, вид словами, кнопки-ссылки (`/docs?path=`, `/skills`, `/agents/<name>`), предпросмотр — `core.docFile(path)` через server action или route handler `apps/cc/src/app/api/docs/file/route.ts` (проксирует GET с сервисным токеном; проверить, как другие client-компоненты читают Core — если есть паттерн server action для чтения, использовать его); Esc закрывает.
- [ ] **Step 3:** тесты, typecheck, lint; `checklist.md` (обе темы, ноль оранжевых заливок: LED/легенда — текстовые цвета). Commit `feat(cc): экран «Мозг» — граф знаний (документы, роутеры, агенты, навыки, инструменты) на d3-force`.

---

### Task 5: Smoke, документы, решение

**Files:**
- Modify: `tools/smoke-core.mjs` (сценарий «документы и граф», счётчик 22→23), `docs/AGENTIC_OS_ARMS_PLAN.md` (§6.2 пп. 4–8 — статусы; §9 строка 06.09), `docs/FIRST_LOGIN_CHECKLIST.md` (пункт RAG со ссылкой на сценарий 2 рунбука и env), `routers/mydon.md` (экраны `/docs`, `/brain`), `memory/decisions.md`, `docs/AGENTS_ACTIVATION.md` (абзац «Документы и Мозг»), `CLAUDE.md` (цели: волна M закрыта, дальше R)
- Create: `docs/decisions/2026-09-06-wave-m-docs-brain.md` (Р-1…Р-7 из спеки §2 с причинами и ценой ошибки), `memory/session-log/2026-09-06-wave-m-docs-brain.md` (handoff по шаблону)

- [ ] **Step 1:** smoke: `GET /docs/tree` непустой и содержит `CLAUDE.md`; `GET /docs/file?path=CLAUDE.md` → `title` содержит «MYDON»; `GET /docs/file?path=../package.json` → 400; `GET /docs/graph` → есть узел `root` и узлы `kind=skill` из каталога, записанного тем же smoke-прогоном (сценарий каталога идёт раньше — проверить порядок). Прогнать локально на Homebrew Postgres 15 как в `.superpowers/sdd/2026-09-05-skills-deck-cron-llm/task-5-report.md`.
- [ ] **Step 2:** документы и решение; commit `test(tools),docs: smoke «документы и граф»; решение волны M; план ARMS, рунбук, чек-лист (RAG), handoff`.

---

## Self-review

- Спека R-M-1 → T1; R-M-2/3/4/8 → T2; R-M-5/7 → T3; R-M-6/7 → T4; §6 smoke → T5; §7 приёмка — после мержа.
- Имена сквозные: `DocsTreeItem`/`DocFile`/`DocsGraph`/`GraphNode`/`GraphEdge` (core → cc); маршруты `/docs/tree|file|graph`.
- Заглушек нет; каждый шаг с командой проверки.
