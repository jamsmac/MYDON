# Волна A, срез A2 «Лица» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Владелец за один взгляд видит, кто из агентов работает и почему молчит, что со внешними источниками, а в карточке агента — навыки, прогоны, память и кнопку запуска.

**Architecture:** Два новых читающих маршрута Core собирают состояние из существующих таблиц (`GET /agents/status`, `GET /apps/health`); панель показывает их на трёх экранах (`/mydon`, `/apps`, `/agents/[name]`). Ноль миграций; единственная новая запись — событие heartbeat бота.

**Tech Stack:** NestJS 11 + Drizzle (Core, `node:test` из `dist`), Next.js 16 / React 19 / vitest (панель), Node 22 (бот, `node:test`).

**Spec:** `docs/superpowers/specs/2026-09-06-wave-a2-faces-design.md` (R-A2-1…R-A2-7, решения Р-1…Р-8).

## Global Constraints

- TypeScript strict, никакого `any`; тексты владельцу по-русски, код по-английски; комментарии по-русски.
- **Ни одной миграции.** Всё собирается из существующих таблиц и маршрутов.
- Три состояния источника — `ok | bad | unknown`; «не оценить» никогда не выглядит как «в порядке»; ноль прогонов — это `unknown`.
- Системная пауза (`AGENTS_TASKS_PAUSED`, `AGENTS_SCHEDULES_PAUSED`) перекрывает занятость агента и называется словами как настройка системы.
- Сравнения с порогами — по сырым значениям, не по округлённым для показа; формулировки причин брать из `apps/bot/src/analytics-brief.ts`, а не сочинять новые.
- Все `/routines/*` требуют сервисный токен и на GET: панель ходит туда через `getWithToken`.
- Каждый блок панели — в своём try/catch: отказ одного источника не уносит страницу.
- Коммиты — Conventional Commits с трейлерами:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01NkuNnPz229PW2EbZ7E4YPa`
- Гейт задачи: сборка и тесты затронутых пакетов; в конце — гейт монорепо.

---

### Task 1: Core — `GET /agents/status`

**Files:**
- Create: `apps/core/src/agents/agent-state.ts` (чистые функции) + `agent-state.test.ts`
- Modify: `apps/core/src/agents/agents.service.ts` (метод `statuses()`), `agents.controller.ts` (маршрут выше `:name`), `agents.service.test.ts`
- Modify: `tools/smoke-core.mjs` (часть сценария `проверитьЛица`)

**Interfaces:**
- Produces: `computeAgentState(input): { state: "working" | "blocked" | "paused" | "idle"; reason: string; since?: Date }` и ответ маршрута из R-A2-1.

- [ ] **Step 1: Тесты чистой функции (падают)**

Кейсы, каждый отдельным `it` с говорящим именем:
`working` — задача агента `in_progress` с `agentRunClaimedAt` внутри лизы (`TasksService.AGENT_RUN_LEASE_MS = 15 * 60_000`), причина называет навык;
«claim протух» — та же задача с `claimedAt` старше лизы → НЕ `working` (это `idle` с причиной «прошлый прогон не завершился, lease истёк»);
`blocked` — задача с `agentExecutionBlockedAt`/`agentExecutionBlockedReason` → причина цитирует Core;
`blocked` по последнему прогону `failed` (когда задач нет);
`paused` — паспортный `paused`/`draft`/`deprecated`, причина называет статус;
`paused` системой — `AGENTS_TASKS_PAUSED = 1` перекрывает даже агента с задачей в работе, причина говорит, что это настройка системы, а не агента;
`idle` — активен, задач нет, последний прогон `skipped:no_signal` → причина «повода не было»;
`idle` без прогонов вовсе — причина «ещё не запускался», а не «всё спокойно»;
архивный агент (`archivedAt`) в список не попадает.

- [ ] **Step 2: Убедиться, что падает** — `pnpm --filter @mydon/core build` (нет модуля `agent-state`).

- [ ] **Step 3: Реализация**

`agent-state.ts` — чистая функция над уже прочитанными данными:

```ts
export interface AgentStateInput {
  passportStatus: string;
  archivedAt: Date | null;
  /** Задачи этого агента в работе (status = "in_progress", ownerKind = "agent"). */
  claimedTasks: { id: string; skill: string | null; claimedAt: Date | null; blockedAt: Date | null; blockedReason: string | null }[];
  lastRun: { at: Date; outcome: string; skipReason: string | null; reason: string } | null;
  paused: { tasks: boolean; schedules: boolean };
  now: Date;
  leaseMs: number;
}
```

Порядок правил: архив → системная пауза задач → паспортная пауза → blocked → working → idle. Причина — одна фраза по-русски, называющая источник вывода (навык, статус, настройку).

Сервис `statuses()` читает: агентов (`agent`, без архивных), их задачи в работе одним запросом (`task` where `ownerKind = "agent"` and `status = "in_progress"`), последние прогоны (`RunsService.lastPerJob()` уже есть — но он по паре агент+навык; для карточки достаточно последнего прогона агента: сделай отдельный `distinct on (agent_name)` по образцу `lastRunsBySkill` в этом же файле), паузы (`SystemService.effective()`). Ни одного запроса в цикле.

Маршрут `@Get("status")` объявить ВЫШЕ `@Get(":name")` (как `skills`) и добавить тест на порядок, по образцу существующего.

- [ ] **Step 4: Гейт и коммит**

```bash
git add apps/core/src/agents tools/smoke-core.mjs
git commit -m "feat(core): состояние агентов одним маршрутом — работает, заблокирован, на паузе, молчит (волна A2)"
```

---

### Task 2: Бот — heartbeat событием

**Files:**
- Modify: `apps/bot/src/index.ts` (интервал), `apps/bot/src/core-client.ts` (метод, если его нет)
- Create: `apps/bot/src/heartbeat.ts` + `heartbeat.test.ts`

**Interfaces:**
- Produces: `heartbeatEvent(now: Date): { source: "bot"; type: "bot.heartbeat"; payload: { at: string }; clientKey: string }` — `clientKey` от времени, округлённого вниз до интервала, чтобы повтор в одну минуту не плодил строк.

- [ ] **Step 1: Тест** — два вызова внутри одного интервала дают один `clientKey`, в разных интервалах — разные; `payload.at` — ISO.
- [ ] **Step 2–3: Реализация** — `setInterval` раз в 5 минут (константа рядом с прочими интервалами бота), отправка через существующий клиент `recordEvent`; ошибка отправки — `console.warn`, бот не падает (heartbeat — диагностика, а не работа).
- [ ] **Step 4: Коммит**

```bash
git add apps/bot/src
git commit -m "feat(bot): heartbeat событием — видно, жив ли поллер (волна A2)"
```

---

### Task 3: Core — `GET /apps/health`

**Files:**
- Create: `apps/core/src/apps/apps.module.ts`, `apps.controller.ts`, `apps-health.service.ts`, `apps-health.ts` (чистые правила) + `apps-health.test.ts`
- Modify: `apps/core/src/app.module.ts`
- Modify: `tools/smoke-core.mjs` (вторая часть сценария `проверитьЛица`)

**Interfaces:**
- Consumes: `RunsService` (`lastPerJob`, `snapshot`), `OurvendHealthService` (или его маршрутный сервис), `LlmLedger` monitoring service, `outboxDelivery` (прямой запрос счётчиков), `EventsService.latest`.
- Produces: `Row = { key, title, state: "ok" | "bad" | "unknown", summary, detail?, at?, href? }` и ответ `{ tz, now, outside: Row[], internal: Row[] }`.

- [ ] **Step 1: Тесты чистых правил (падают)**

Отдельным `it` на каждую ловушку честности:
«ноль прогонов — не ок, а не оценить»; «монитор выключен — не оценить, с причиной из снимка»;
«последний прогон failed — плохо, причина цитируется»; «серия отказов при последнем успешном — всё равно плохо»;
«данные протухли по СЫРЫМ часам, а не по округлённому полю»; «расхождений 0, когда сверять не с чем — не ок»;
«очередь доставок пуста — ок; есть dead — плохо; строк нет вовсе — не оценить»;
«heartbeat бота свежий — ок; старше пяти интервалов — плохо; нет — не оценить»;
«внутренний монитор не попадает в раздел „снаружи“».

- [ ] **Step 2: Убедиться, что падает.**

- [ ] **Step 3: Реализация**

`apps-health.ts` — чистые функции над уже прочитанными данными (никаких запросов внутри): `rowFromMonitor(...)`, `rowFromOurvend(...)`, `rowFromOutbox(...)`, `rowFromHeartbeat(...)`, `splitSections(rows)`. Тексты причин — из `apps/bot/src/analytics-brief.ts` (перечитай и цитируй, не сочиняй).
`apps-health.service.ts` — одна выборка на источник, всё параллельно (`Promise.all`), каждый источник в своём try/catch: недоступность одного даёт его строке `unknown` с причиной, а не роняет весь ответ.
Маршрут `@Get("health")` в `@Controller("apps")`.

- [ ] **Step 4: Смоук**

Сценарий `проверитьЛица` в `tools/smoke-core.mjs` (по образцу `проверитьРутины`): `GET /agents/status` возвращает активных агентов, при `AGENTS_TASKS_PAUSED=1` все в `paused` с системной причиной; `GET /apps/health` содержит обе группы, ненастроенный источник помечен `unknown`, ни одна строка с нулём прогонов не имеет `ok`. Зарегистрировать в общем списке.

- [ ] **Step 5: Гейт и коммит**

```bash
git add apps/core/src/apps apps/core/src/app.module.ts tools/smoke-core.mjs
git commit -m "feat(core): здоровье приложений одним маршрутом — снаружи и внутренние мониторы, три честных состояния (волна A2)"
```

---

### Task 4: Панель — `/apps` и сетка агентов на главной

**Files:**
- Modify: `apps/cc/src/lib/core.ts` (типы `AgentStatusRow`, `AppsHealth`, методы `agentsStatus()`, `appsHealth()`)
- Create: `apps/cc/src/app/apps/page.tsx` + `page.test.tsx`
- Create: `apps/cc/src/components/agent-grid.tsx` + `agent-grid.test.tsx`
- Create: `apps/cc/src/components/av8.tsx` (вынести из `skills-deck.tsx`, там оставить импорт)
- Modify: `apps/cc/src/app/mydon/page.tsx` (блок «Агенты»), `apps/cc/src/components/nav.tsx` (пункт «Приложения»), `apps/cc/src/app/globals.css`
- Modify: `tools/smoke-panel.mjs`

**Interfaces:**
- Consumes: `GET /agents/status`, `GET /apps/health`.
- Produces: `<AgentGrid rows={…} paused={…} />`, страница `/apps`.

- [ ] **Step 1: Тесты (падают)**

`agent-grid.test.tsx`: сводка «работают N · молчат M · на паузе K»; при системной паузе видна отдельная строка, что это настройка системы, а не агентов; плитка несёт имя, состояние и причину; ссылка ведёт на карточку.
`apps/page.test.tsx`: два раздела с заголовками; строка `unknown` печатает «не оценить» и НЕ имеет класса состояния «ок» (проверить по атрибуту/классу, а не по цвету); пустой ответ — честное пустое состояние; отказ Core → `CoreDown`.

- [ ] **Step 2–3: Реализация** — серверные компоненты, `force-dynamic`; `Av8` выносится как есть (тот же детерминированный рисунок по имени), в `skills-deck.tsx` — импорт; блок «Агенты» на главной в try/catch, при отказе не рисуется.

- [ ] **Step 4: Гейт и коммит**

```bash
git add apps/cc/src tools/smoke-panel.mjs
git commit -m "feat(cc): панель «Приложения» и сетка агентов на главной (волна A2)"
```

---

### Task 5: Панель — карточка агента

**Files:**
- Modify: `apps/cc/src/app/agents/[name]/page.tsx`, `apps/cc/src/app/agents/[name]/page.test.tsx`
- Modify: `apps/cc/src/components/agent-editor.tsx` (селект самостоятельности, подсказка о пороге)
- Modify: `apps/cc/src/app/agents/actions.ts` (действие смены автономии; действие запуска навыка — переиспользовать из `apps/cc/src/app/skills/actions.ts`)
- Modify: `apps/cc/src/lib/core.ts` (методы `agentRuns()`, `agentMemory()`, `setAutonomy()`, если их нет)

**Interfaces:**
- Consumes: `GET /agents/skills?agent=`, `GET /routines/runs?agent=` (через `getWithToken`), `GET /events?source=agent:<имя>&typePrefix=agent.memory:`, `PATCH /agents/:name/autonomy`, `GET /system/config`, `GET /audit?actorRef=`.

- [ ] **Step 1: Тесты (падают)**

Блоки: «Навыки» показывает тир, исполнителя и расписание; «Последние прогоны» ведут в плейбэк; «Память» показывает навык и время; при отказе одного источника страница остаётся, а блок говорит почему; селект самостоятельности вызывает действие автономии (а НЕ общий PATCH) — проверить по вызванному действию; подсказка о пороге берёт значение из конфига.

- [ ] **Step 2–3: Реализация.** Порядок блоков и содержание — по R-A2-5. Каждый блок в своём try/catch. Чинить ровно три дефекта из Р-7, ничего больше.

- [ ] **Step 4: Гейт и коммит**

```bash
git add apps/cc/src
git commit -m "feat(cc): карточка агента — навыки, прогоны, память, запуск; самостоятельность меняется по-настоящему (волна A2)"
```

---

### Task 6: Документация

**Files:**
- Modify: `docs/AGENTS_ACTIVATION.md` (раздел «Как читать состояние агентов и приложений»)
- Create: `docs/decisions/2026-09-06-wave-a2-faces.md`, `memory/session-log/2026-09-06-wave-a2-faces.md`
- Modify: `docs/AGENTIC_OS_ARMS_PLAN.md` (§6.4 пп. 3, 5, 6 — статус со ссылкой на спеку)

- [ ] **Step 1–3:** объяснить три состояния и почему ноль прогонов — не «ок»; записать Р-1…Р-8; handoff с приёмкой §7 и остатком владельцу; проверить все пути `ls`; коммит.

```bash
git add docs memory
git commit -m "docs: срез A2 — состояния агентов и приложений, решения Р-1…Р-8, план ARMS §6.4"
```

---

## Self-review

- **Покрытие:** R-A2-1 → T1; R-A2-2 → T3 (+T2 как источник heartbeat); R-A2-3 → T4; R-A2-4 → T4; R-A2-5 → T5; R-A2-6 → тесты в T1/T3/T4/T5 + смоуки в T3/T4; R-A2-7 → T6.
- **Порядок:** T1, T2, T3 независимы друг от друга по файлам (Core agents / bot / Core apps), но T3 читает heartbeat, который пишет T2 — контракт события зафиксирован в плане, поэтому параллельно можно. T4 после T1+T3, T5 после T1. T6 последняя.
- **Типы:** `state`-словарь один и тот же в T1 и T4; `Row.state` — один и тот же в T3 и T4; методы клиента панели объявляются в T4 и переиспользуются в T5.
