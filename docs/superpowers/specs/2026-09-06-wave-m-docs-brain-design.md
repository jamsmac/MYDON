# Волна M: зеркала движка под тестом, панель «Документы», граф «Мозг»

Дата: 06.09.2026 · ветка `feat/wave-m-docs-brain` · план ARMS `docs/AGENTIC_OS_ARMS_PLAN.md` §6.2 (пп. 4–8) ·
поручение владельца «сделай всё по порядку до 100% production ready» (05.09).

## 1. Что уже есть (факты 06.09)

- §6.2 пп. 1–3 применены пакетом-стартером 04.09 (`CLAUDE.md`-роутер с целями и картой, `routers/*.md`, `memory/` с
  handoff'ами). `verify-paths.mjs`: 260 ссылок, битых нет — п. 4 «закрыть 51 битую ссылку» закрыт.
- Память агентов: `apps/agents/shared/COMPANY.md` (85 строк), `shared/kb/index.md` + страницы (globerent, vendhub,
  venture-factory); `check:passports` проверяет существование `kb_pages` — «knowledge-curator читает index.md, а не 404»
  выполняется. `PROTOCOL.md` / `MYDON_AGENT_BUILDER.md` в донорах отсутствуют (04.09), ищутся в истории чатов; до
  появления агенты пишутся по `_template/` и `direction-package.md` — так предусмотрено навыком фабрики.
- `engine/autonomy.yaml` и `engine/eval-rubric.md` — рукописные «читаемые зеркала» кода (`policy.ts`, `tools.ts`,
  `skill-loader.ts`, `coach.ts`, `coach-review.ts`) с пометкой «истина — в коде». Ничто не проверяет, что они не разошлись.
- Docker-образ один на все сервисы и собирается `COPY . .` → в рантайме `/app` содержит весь репозиторий: `docs/`, `memory/`,
  `routers/`, `engine/`, `.claude/skills/`, `apps/agents/{agents,shared}/`. Core может читать markdown с диска.
- В `apps/cc` нет рендера markdown и графовой библиотеки. Навигация: MAIN — 7 пунктов (лимит таббара телефона), SYSTEM — сайдбар.
- RAG (§6.2 п. 7): рунбук `docs/AGENTS_ACTIVATION.md` сценарий 2 требует OpenAI-совместимый `/embeddings`, `EMBED_*` и
  price-provider — деньги и инфраструктура владельца.

## 2. Решения (записаны в `docs/decisions/2026-09-06-wave-m-docs-brain.md`)

- **Р-1 Зеркала не генерируются — они под тестом дрейфа.** Рукописный YAML/MD объясняет, генератор отдал бы голые числа.
  Тест `apps/agents/src/engine-mirror.test.ts` сверяет факты зеркал с кодом; расхождение роняет CI.
- **Р-2 Документы отдаёт Core с диска образа** по белому списку корней; панель читает только Core. Никакого доступа к
  GitHub/файлам из панели. Чтение — только с сервисным токеном (в `memory/` есть личное).
- **Р-3 Граф строится в Core** из скана markdown-ссылок + базы (агенты, каталог навыков, kb_pages) и кэшируется в памяти;
  панель только рисует.
- **Р-4 Рендер markdown — `marked` в панели** без сырого HTML (HTML-блоки экранируются): источник доверенный (репо),
  но правило «панель не исполняет чужой HTML» дешевле, чем исключение.
- **Р-5 Граф — `d3-force` на canvas** в клиентском компоненте: стандартная сила, без своего физического движка.
- **Р-6 Правка документов агентом через approval (§6.2 п. 5) — не в этом срезе.** Механизма «coach-diff» в коде нет
  (только `coach-apply.ts` для SKILL.md); панель — чтение.
- **Р-7 RAG не включается этим срезом:** это env с деньгами; срез добавляет пункт в `FIRST_LOGIN_CHECKLIST.md` со
  ссылкой на сценарий 2 рунбука.

## 3. Инварианты

- **R-M-1** Тест дрейфа падает, если в коде изменилось: имена/порядок тиров (`AUTONOMY_TIERS`), пол тира по типу
  инструмента (`TOOLTYPE_MIN`), имя env и дефолт порога (`AGENT_AUTONOMY_MAX`, `T0`), правило гейта (на таблице примеров
  через `requiresApproval`), ключи и веса рубрики (`RUBRIC`), `PASS_THRESHOLD`, исходы (`CoachOutcome`) — а зеркала нет.
- **R-M-2** `GET /docs/file` отдаёт только файлы из белого списка корней и расширений; путь нормализуется, `..`, симлинки и
  абсолютные пути → 400/404; ответ содержит `path`, `title` (первый `# ` или имя файла), `markdown`, `updatedAt`, `bytes`.
- **R-M-3** `GET /docs/tree` — плоский список `{path, title, root, bytes, updatedAt}` по тем же корням, отсортирован по
  пути; скан кэшируется 60 с; пустая папка не ломает ответ.
- **R-M-4** `GET /docs/graph` — `{nodes, edges, builtAt}`; узлы: `root` (CLAUDE.md), `router`, `domain`, `agent`, `skill`,
  `tool`, `doc`, `memory`, `decision`, `engine`, `kb`; рёбра: `links` (markdown-ссылка), `routes` (CLAUDE.md → роутер →
  домен), `owns` (домен/business → агент), `has_skill`, `uses_tool`, `reads_kb`. Любой навык из каталога — узел с `href`
  на `/skills` (и `path` на `.md` файла навыка, если есть); любой агент — с `href` `/agents/<name>`.
- **R-M-5** Панель `/docs`: дерево по корням + фильтр по пути/заголовку + просмотр; ссылка «Открыть в Мозге». Ошибка Core →
  `CoreDown`; пустое дерево говорит, что сделать («образ без документов — проверь сборку»).
- **R-M-6** Панель `/brain` (консольная грамматика, тёмная тема через `ConsoleTheme`): canvas-граф, легенда по видам узлов
  на токенах (`--agent` только для агентов), поиск сужает граф до совпадений и соседей, клик по узлу — карточка справа
  (заголовок, вид, ссылки: документ → `/docs?path=…`, навык → `/skills`, агент → `/agents/<name>`) и предпросмотр первых
  ~40 строк документа. Клавиатура: Esc закрывает карточку. Ничего не тянется из сети, кроме Core.
- **R-M-7** Никаких новых цветов; кириллица Golos; цифры `.num`; формы — нет (только чтение).
- **R-M-8** Docs-эндпоинты — за сервисным токеном (`ServiceTokenGuard` на GET тоже); в панели вызовы идут через
  `get<T>()`, который токен подставляет.

## 4. Core API

| Маршрут | Ответ |
|---|---|
| `GET /docs/tree` | `DocsTreeItem[]` |
| `GET /docs/file?path=<repo-relative>` | `DocFile` |
| `GET /docs/graph` | `DocsGraph` |

Корни (репо-относительно, только эти): `CLAUDE.md`; `docs/**/*.md` (кроме `docs/agentic-os-starter/_backup/**`);
`memory/**/*.md`; `routers/*.md`; `engine/*.{yaml,md}`; `apps/agents/shared/**/*.md`; `apps/agents/agents/*/ROLE.md`;
`apps/agents/agents/*/skills/*.md`; `.claude/skills/*/SKILL.md`; `.claude/skills/*/references/**/*.md`.
Корень репозитория в рантайме — `path.resolve(__dirname, "../../../..")` (4 уровня от `apps/core/dist/docs/`; тест
«в корне есть CLAUDE.md»), в образе `/app`, локально то же. Лимит файла — 512 КБ (больше → 413).

## 5. Панель

- `/docs` (светлая, чтение): `.page-head` «Документы» + `.lead` «N файлов в M корнях · обновлено <когда>»; слева `.rows`
  сгруппированные по корню (сворачиваемые), сверху поле фильтра; справа — `article.doc` с рендером; путь в query `?path=`.
  `marked` c `renderer.html = escape`, ссылки на `.md` внутри белого списка → `/docs?path=…`, внешние — `target=_blank rel=noopener`.
- `/brain` (тёмная): `.page-head` «Мозг» + `.lead` «узлов N · связей K · собран <когда>»; `<BrainGraph>` (client): canvas на
  всю ширину, `d3-force` (link/charge/center/collide), drag узлов, колесо — zoom; легенда `.chip` по видам; поиск; карточка
  `.panel.console` справа. Навигация: пункты «Документы» (`/docs`, icon `jour`) и «Мозг» (`/brain`, icon `sky`) — в группу
  SYSTEM (MAIN на телефоне уже 7).

## 6. Тесты

- agents: `engine-mirror.test.ts` (R-M-1; читает `engine/*.{yaml,md}` через `yaml` и регулярки по таблице рубрики).
- core: `docs.service.test.ts` — чистые функции: `isAllowed(path)`, `normalize(path)` (traversal/абсолют/симлинк-имя),
  `titleOf(markdown, path)`, `linksOf(markdown, fromPath)` (относительные/абсолютные-репо ссылки, якоря, внешние),
  `buildGraph(files, agents, catalog)` (виды узлов, рёбра, навык без файла всё равно узел); `docs.controller.test.ts` — DTO.
- cc: `docs-tree.test.tsx` (фильтр, активный путь), `brain-graph.test.tsx` (поиск сужает, клик открывает карточку с href;
  canvas мокается), `page` tests опционально.
- smoke `tools/smoke-core.mjs`: «документы: дерево непустое, файл CLAUDE.md читается, `..` → 400, граф содержит root и
  хотя бы один навык из каталога» (23-й сценарий).

## 7. Приёмка на проде

`GET /docs/tree` → ≥ 150 файлов; `GET /docs/file?path=CLAUDE.md` → заголовок «MYDON — контекст монорепо»; `GET /docs/graph`
→ nodes ≥ 250, среди них 12 агентов и 30 навыков; `/docs` и `/brain` — 200 на Tailscale-адресе; CI зелёный (тест дрейфа).

## 8. Границы

Правка документов из панели/агентом (approval) — волна R/A; RAG — владелец; `PROTOCOL.md`/`BUILDER.md` — по итогам поиска
в истории чатов (перенос, если найдены); «Мозг» не рисует историю прогонов (`/flows` — волна R).
