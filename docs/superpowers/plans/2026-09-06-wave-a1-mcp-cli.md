# Волна A, срез A1 «Руки» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Владелец из Claude Code и из терминала обращается к MYDON напрямую: «что ждёт решения», «поставь задачу», «что было у агента за сутки», «покажи страницу знаний».

**Architecture:** Новый пакет workspace `@mydon/mcp` (`apps/mcp`) с одним HTTP-клиентом Core и двумя оболочками над ним: MCP-сервер по stdio (`@modelcontextprotocol/sdk`) и CLI `mydon`. Плюс четыре микрофикса читающих маршрутов Core, без миграций.

**Tech Stack:** TypeScript strict, Node 22, `@modelcontextprotocol/sdk` 1.30.x, `node:test` из `dist`, NestJS 11 (Core), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-09-06-wave-a1-mcp-cli-design.md` (R-A1-1…R-A1-6, решения Р-1…Р-9).

## Global Constraints

- TypeScript strict, никакого `any`; тексты для владельца по-русски, код по-английски; комментарии по-русски.
- Ни одной миграции. Ни одного нового поля в схеме.
- Секреты только из окружения; ни одно сообщение об ошибке и ни один лог не печатает значение токена; `.mcp.json` содержит имена переменных, а не значения.
- Лимиты: список ≤ 50 записей по умолчанию и ≤ 200 максимум, текст ответа инструмента ≤ 8000 символов, `kb_read` ≤ 64 КБ с пометкой об обрезке, таймаут запроса 15 с.
- По умолчанию `registry_search` и `tasks_list` исключают `domain = personal`; личное — только явным параметром и с owner-токеном, если он задан.
- Меняющие инструменты: одна операция за вызов, никаких пакетных режимов; у CLI каждая меняющая команда требует `--yes`.
- Коммиты — Conventional Commits с трейлерами:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01NkuNnPz229PW2EbZ7E4YPa`
- Гейт задачи: сборка и тесты затронутых пакетов; в конце — `pnpm -r build && pnpm -r test && pnpm -r lint && pnpm -r typecheck`.

---

### Task 1: Микрофиксы Core — события, дека, журнал

**Files:**
- Modify: `apps/core/src/events/events.controller.ts` (`ListEventsDto` + `list`)
- Modify: `apps/core/src/events/events.service.ts` (условие `typePrefix`)
- Modify: `apps/core/src/agents/agents.controller.ts` и `agents.service.ts` (`GET /agents/skills?agent=`)
- Modify: `apps/core/src/routines/routines.controller.ts` и `runs.service.ts` (`GET /routines/runs?from=&to=`)
- Modify/Create: тесты рядом с каждым (`events.controller.test.ts`, `events.service.test.ts` если есть, `agents.service.test.ts`, `runs.service.test.ts`, `routines.controller.test.ts`)
- Modify: `tools/smoke-core.mjs` (сценарий `проверитьСобытияИДеку` + регистрация в списке)

**Interfaces:**
- Produces: `GET /events?source=&type=&typePrefix=&since=&until=&limit=&order=` → `EventRow[]`; `GET /agents/skills?agent=` → тот же `SkillDeck`, но `items` только этого агента; `GET /routines/runs?from=&to=` → журнал в окне.

- [ ] **Step 1: Тесты (падают)**

`events.controller.test.ts` — стаб сервиса копит фильтр: `source` доходит; `limit` больше 200 схлопывается в 200; `limit` 0/NaN/отрицательный → дефолт 50; `order` кроме `asc|desc` отвергается валидацией; `typePrefix` доходит; без параметров фильтр содержит ровно то же, что раньше (регресс-страховка).
`events.service` — `typePrefix: "agent.memory:"` рендерится в `like` по `type` (проверь через `PgDialect().sqlToQuery()` на захваченном условии, как это сделано в `runs.service.test.ts`).
`agents.service.test.ts` — дека с `agent: "vendhub-ops"` возвращает только его строки; неизвестный агент — пустой список, а не все.
`runs.service.test.ts` — `from`/`to` дают два условия по `started_at`; только `from` — одно; битая дата → 400.

- [ ] **Step 2: Убедиться, что падает** — `pnpm --filter @mydon/core build` (ошибки о неизвестных полях DTO) или красные тесты.

- [ ] **Step 3: Реализация**

`ListEventsDto` дополняется (стиль соседних DTO):

```ts
  @IsOptional() @IsString() @MaxLength(128)
  source?: string;

  /** Префикс типа: `agent.memory:` перечисляет память агента (одно `like`, а не полный поиск). */
  @IsOptional() @IsString() @MaxLength(128)
  typePrefix?: string;

  @IsOptional() @IsISO8601()
  until?: string;

  @IsOptional() @IsIn(["asc", "desc"])
  order?: "asc" | "desc";

  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  limit?: number;
```

Контроллер пробрасывает всё это в `events.list`, оставляя дефолты `limit = 50`, `order = "desc"`. В сервисе — одно условие: `if (filter.typePrefix) conditions.push(like(event.type, `${filter.typePrefix}%`))` (импорт `like` из `drizzle-orm`; экранировать `%` и `_` во входе — `typePrefix.replace(/[\\%_]/g, "\\$&")` с `ESCAPE '\'`, либо `sql` с параметром; напиши тест на `%` во входе).
`GET /agents/skills?agent=` — фильтр в сервисе на уже собранном списке (дека собирается одним запросом; фильтровать в SQL необязательно, но если это дёшево — лучше в SQL).
`GET /routines/runs?from=&to=` — два дополнительных условия `gte/lte` по `agentRun.startedAt`, разбор дат как в `normalizeReport` (битая дата → `BadRequestException`).

- [ ] **Step 4: Смоук**

Сценарий `проверитьСобытияИДеку` в `tools/smoke-core.mjs` (по образцу `проверитьРутины`): записать два события разных источников через `POST /events`; `GET /events?source=X&limit=1` вернул одну запись именно источника X; `GET /events?typePrefix=agent.memory:` находит записанную память и не находит чужое; `GET /agents/skills?agent=<агент из сида>` уже полной деки; `GET /routines/runs?from=<будущее>` пуст. Зарегистрируй сценарий в общем списке с `ok`-строкой и `провалы.push`.

- [ ] **Step 5: Гейт и коммит**

`pnpm --filter @mydon/core build && pnpm --filter @mydon/core test`, `node --check tools/smoke-core.mjs`.

```bash
git add apps/core/src tools/smoke-core.mjs
git commit -m "feat(core): события по источнику и префиксу типа, дека по агенту, журнал по окну (волна A1)"
```

---

### Task 2: Каркас `@mydon/mcp` и клиент Core

**Files:**
- Create: `apps/mcp/package.json`, `apps/mcp/tsconfig.json`, `apps/mcp/.eslintrc` (если в репо файловые конфиги — скопируй у `apps/agents`)
- Create: `apps/mcp/src/core-client.ts`, `apps/mcp/src/core-client.test.ts`
- Create: `apps/mcp/src/env.ts`, `apps/mcp/src/env.test.ts`
- Modify: `deploy/Dockerfile` (одна строка `COPY apps/mcp/package.json ./apps/mcp/` рядом с прочими манифестами)

**Interfaces:**
- Produces:
  - `loadEnv(env = process.env): { baseUrl: string; serviceToken: string; ownerToken?: string }` — бросает понятную ошибку без значения токена, если `SERVICE_TOKEN` пуст.
  - `class CoreError extends Error { status: number; path: string }`
  - `createClient(cfg): CoreClient` с методами: `pendingApprovals()`, `pendingEntities()`, `decideApproval(id, decision)`, `tasks(params)`, `task(id)`, `createTask(input)`, `commentTask(id, body)`, `setTaskStatus(id, input)`, `events(params)`, `recordEvent(input)`, `entities(params)`, `docsTree(params)`, `docFile(path)`, `agents()`, `skillDeck(agent?)`, `createAgent(input)`, `updateAgent(name, patch)`, `setAutonomy(name, tier)`, `runs(params)`, `briefing()`, `systemConfig()`.

- [ ] **Step 1: Тест клиента (падает)**

```ts
// apps/mcp/src/core-client.test.ts
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { CoreError, createClient } from "./core-client";

function fetchStub(reply: { status: number; body?: unknown; text?: string }) {
  return mock.fn(async (_url: string, _init?: RequestInit) => ({
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    text: async () => reply.text ?? JSON.stringify(reply.body ?? {}),
  })) as unknown as typeof fetch;
}

describe("Клиент Core (R-A1-1)", () => {
  it("шлёт сервисный токен и не шлёт owner-токен без нужды", async () => {
    const f = fetchStub({ status: 200, body: [] });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o", fetchImpl: f });
    await c.tasks({});
    const init = (f as unknown as { mock: { calls: { arguments: [string, RequestInit] }[] } }).mock.calls[0]!.arguments[1];
    assert.equal((init.headers as Record<string, string>)["x-service-token"], "s");
    assert.equal((init.headers as Record<string, string>)["x-owner-action-token"], undefined);
  });

  it("owner-действие несёт owner-токен", async () => {
    const f = fetchStub({ status: 200, body: {} });
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o", fetchImpl: f });
    await c.decideApproval("11111111-1111-4111-8111-111111111111", "approved");
    const init = (f as unknown as { mock: { calls: { arguments: [string, RequestInit] }[] } }).mock.calls[0]!.arguments[1];
    assert.equal((init.headers as Record<string, string>)["x-owner-action-token"], "o");
  });

  it("переводит коды Core и никогда не печатает токен", async () => {
    for (const [status, part] of [[401, /токен/i], [403, /личн|owner/i], [404, /не найдено/i], [429, /частот/i]] as const) {
      const c = createClient({ baseUrl: "http://core", serviceToken: "секрет-токен", fetchImpl: fetchStub({ status, text: "" }) });
      await assert.rejects(() => c.briefing(), (e: unknown) => {
        assert.ok(e instanceof CoreError);
        assert.equal(e.status, status);
        assert.match(e.message, part);
        assert.doesNotMatch(e.message, /секрет-токен/);
        return true;
      });
    }
  });

  it("сеть недоступна — понятная ошибка с адресом", async () => {
    const c = createClient({ baseUrl: "http://core", serviceToken: "s", fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
    await assert.rejects(() => c.briefing(), /недоступен .*http:\/\/core/);
  });
});
```

`env.test.ts`: пустой `SERVICE_TOKEN` → ошибка со словом `SERVICE_TOKEN` и без значений; `CORE_API_URL` по умолчанию `http://127.0.0.1:3001`; `OWNER_ACTION_TOKEN` необязателен.

- [ ] **Step 2: Каркас пакета**

`apps/mcp/package.json` по образцу `apps/agents/package.json`: `name: "@mydon/mcp"`, `private: true`, `type` как у соседей, скрипты `build`/`typecheck`/`lint`/`clean`/`test` (тот же `find dist -name '*.test.js' | xargs node --test`), `bin: { "mydon": "dist/cli.js" }`, зависимости `@modelcontextprotocol/sdk` (^1.30.0), `@mydon/shared` (workspace:*) при необходимости; devDependencies как у соседей. `tsconfig.json` — копия соседнего с правкой путей. Установить: `pnpm install --filter @mydon/mcp` (SDK уже в сторе, сеть не нужна; если pnpm всё же полезет в сеть и упадёт — сообщи в отчёте).

- [ ] **Step 3: Клиент**

`core-client.ts`: `fetchImpl` в конфиге (для тестов), `AbortSignal.timeout(15_000)`, сбор `URLSearchParams` из параметров (пустые значения не добавляются), разбор ответа (`text()` → `JSON.parse` только если тело непустое), тексты ошибок из Р-9 спеки. Никаких `console.log`.

- [ ] **Step 4: Гейт и коммит**

`pnpm --filter @mydon/mcp build && pnpm --filter @mydon/mcp test && lint && typecheck`.

```bash
git add apps/mcp deploy/Dockerfile pnpm-lock.yaml
git commit -m "feat(mcp): каркас пакета и клиент Core с переводом ошибок (волна A1)"
```

---

### Task 3: Форматтеры ответов

**Files:**
- Create: `apps/mcp/src/format.ts`, `apps/mcp/src/format.test.ts`

**Interfaces:**
- Consumes: типы ответов Core (объявляй локальные интерфейсы в `core-client.ts`, не тяни `apps/cc`).
- Produces: `formatInbox(approvals, entities)`, `formatTasks(tasks)`, `formatTask(task)`, `formatEvents(events)`, `formatRuns(runs)`, `formatEntities(entities)`, `formatAgents(agents)`, `formatDeck(deck)`, `formatBriefing(briefing)`, `formatDoc(file)`, `clamp(text, limit)`.

- [ ] **Step 1: Тесты (падают)**

Проверяют смысл, а не вёрстку: `formatInbox` первой строкой даёт «Ждёт решения: N согласований, M записей»; пустой вход → «Ничего не ждёт решения»; каждая строка согласования содержит id, действие, тир и возраст («2 ч»); `formatTasks` печатает статус и владельца, дату — по Ташкенту; `formatEvents` печатает время, источник, тип и первые 120 символов payload; `clamp` режет ровно по лимиту и добавляет «…(обрезано)»; `formatDoc` при усечении говорит, сколько байт всего.

- [ ] **Step 2–3: Реализация и прогон** — чистые функции без обращений к сети; тесты зелёные.

- [ ] **Step 4: Коммит**

```bash
git add apps/mcp/src/format.ts apps/mcp/src/format.test.ts
git commit -m "feat(mcp): компактные ответы для модели и терминала (волна A1)"
```

---

### Task 4: MCP-сервер

**Files:**
- Create: `apps/mcp/src/server.ts` (точка входа `dist/server.js`), `apps/mcp/src/tools.ts`, `apps/mcp/src/tools.test.ts`
- Create: `.mcp.json` (корень репозитория)

**Interfaces:**
- Consumes: клиент (Task 2), форматтеры (Task 3).
- Produces: `buildTools(client, posture): ToolDefinition[]` — чистая функция, где `posture = { ownerEnforced: boolean; ownerTokenPresent: boolean }`; `describeApprovalDecide(posture): string`; `registerTools(server, tools)`.

- [ ] **Step 1: Тесты (падают)**

`tools.test.ts`: семнадцать инструментов из R-A1-2 присутствуют по именам; у каждого есть непустое описание и схема входа; описание каждого меняющего инструмента начинается с того, что он изменит; `describeApprovalDecide` при `ownerEnforced: false` содержит «пояс идентичности выключен», при `true` и заданном токене — «требует owner-токен», при `true` и отсутствующем — «owner-токен не задан: вызов вернёт 401»; `tasks_list` без домена добавляет фильтр, исключающий `personal` (проверь по аргументам стаба клиента); `events_recent` c `limit: 1000` уходит в клиент с `limit: 200`; ошибка клиента превращается в результат с `isError: true` и переведённым текстом.

- [ ] **Step 2–3: Реализация**

`server.ts`: читает окружение (`loadEnv`), создаёт клиент, пробует `client.systemConfig()` (при недоступности Core — `posture` с пометкой «состояние пояса неизвестно», сервер всё равно стартует), собирает инструменты и поднимает `StdioServerTransport`. Ни одной записи в stdout мимо протокола (диагностика — только в stderr).

`.mcp.json` в корне:

```json
{
  "mcpServers": {
    "mydon-core": {
      "command": "node",
      "args": ["apps/mcp/dist/server.js"],
      "env": {
        "CORE_API_URL": "${CORE_API_URL:-http://127.0.0.1:3001}",
        "SERVICE_TOKEN": "${SERVICE_TOKEN}",
        "OWNER_ACTION_TOKEN": "${OWNER_ACTION_TOKEN}"
      }
    }
  }
}
```

(Проверь синтаксис подстановки, поддерживаемый Claude Code; если `${VAR:-default}` не поддерживается — оставь только `${VAR}` и опиши дефолт в `docs/MCP.md`.)

- [ ] **Step 4: Гейт и коммит**

```bash
git add apps/mcp/src .mcp.json
git commit -m "feat(mcp): сервер mydon-core — 17 инструментов, честное описание пояса владельца (волна A1)"
```

---

### Task 5: CLI `mydon`

**Files:**
- Create: `apps/mcp/src/cli.ts`, `apps/mcp/src/args.ts`, `apps/mcp/src/args.test.ts`, `apps/mcp/src/cli.test.ts`

**Interfaces:**
- Produces: `parseArgs(argv): { command: string; positional: string[]; flags: Record<string, string | boolean> }` — неизвестный флаг бросает ошибку с подсказкой; `runCommand(args, deps): Promise<{ text: string; code: number }>` — чистая функция над клиентом (для тестов), `cli.ts` только печатает результат и ставит `process.exitCode`.

- [ ] **Step 1: Тесты (падают)**

`args.test.ts`: `--limit 5` и `--limit=5` дают одно и то же; `--yes` булев; неизвестный `--limt` → ошибка с текстом «неизвестный флаг --limt; возможно, вы имели в виду --limit»; позиционные аргументы сохраняют порядок.
`cli.test.ts` (стаб клиента): `mydon inbox` печатает то же, что `formatInbox`; `mydon decide <id> approved` без `--yes` печатает намерение, НЕ зовёт клиент и возвращает код 0; с `--yes` — зовёт; `--json` печатает JSON, а не текст; неизвестная команда → код 2 и список команд.

- [ ] **Step 2–3: Реализация** — без внешних зависимостей.

- [ ] **Step 4: Коммит**

```bash
git add apps/mcp/src
git commit -m "feat(mcp): CLI mydon поверх того же клиента, --yes на меняющих командах (волна A1)"
```

---

### Task 6: Документация и приёмка

**Files:**
- Create: `docs/MCP.md`, `docs/decisions/2026-09-06-wave-a1-mcp-cli.md`
- Modify: `docs/AGENTS_ACTIVATION.md` (раздел про CLI и конвенцию `--yes`), `docs/FIRST_LOGIN_CHECKLIST.md` (пункт «подключить MCP»), `docs/AGENTIC_OS_ARMS_PLAN.md` (§6.4 пп. 1–2 — статус «сделано срезом A1», ссылка на спеку)
- Create: `memory/session-log/2026-09-06-wave-a1-mcp-cli.md`

- [ ] **Step 1: `docs/MCP.md`** — зачем; как включить (SSH-туннель до Core, переменные окружения, `.mcp.json`, сборка `pnpm --filter @mydon/mcp build`); таблица инструментов «имя — что делает — что меняет»; что означает пояс владельца и как проверить его состояние; ограничения (лимиты, личный контур, одна операция за вызов).
- [ ] **Step 2: Решение** Р-1…Р-9 из спеки, по образцу `docs/decisions/2026-09-06-wave-r-crons-flows.md`.
- [ ] **Step 3: Чек-лист и план ARMS.**
- [ ] **Step 4: Handoff** — что сделано, как принять (спека §7), что осталось владельцу (поднять туннель, положить токены в окружение своей машины).
- [ ] **Step 5: Проверить ссылки** (`ls` каждого упомянутого пути) и коммит.

```bash
git add docs memory
git commit -m "docs: срез A1 — рунбук MCP и CLI, решения Р-1…Р-9, чек-лист, план ARMS §6.4 (волна A1)"
```

---

## Self-review

- **Покрытие спеки:** R-A1-1 → T2; R-A1-2 → T4; R-A1-3 → T5; R-A1-4 → T1; R-A1-5 → тесты в T1–T5 + смоук в T1; R-A1-6 → T6. Решения: Р-1 → T2 (один клиент), Р-2/Р-3 → T4, Р-4 → T4 (фильтр домена), Р-5 → T3, Р-6 → T1, Р-7 → T5, Р-8 → T2 (Dockerfile, bin) + T4 (`.mcp.json`), Р-9 → T2.
- **Порядок:** T1 и T2 независимы (Core против нового пакета) — можно параллельно; T3 после T2; T4 после T2+T3; T5 после T2+T3; T6 после всех.
- **Типы:** `CoreError`, `createClient`, `loadEnv` (T2) используются в T3/T4/T5 под теми же именами; `buildTools(client, posture)` (T4) и `runCommand(args, deps)` (T5) принимают один и тот же клиент.
