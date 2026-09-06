# Волна A, срез A1 «Руки» — MCP-сервер `mydon-core` и CLI `mydon`

Дата: 2026-09-06. План ARMS `docs/AGENTIC_OS_ARMS_PLAN.md` §6.4 пп. 1–2, критерий п. 7 («Claude Code
владельца отвечает „что ждёт моего решения“»). Ветка `feat/wave-a1-mcp-cli`. Предшественник — волна R
(`2026-09-06-wave-r-crons-flows-design.md`).

## 1. Цель и критерий

Владелец из своего Claude Code (и любой скрипт) обращается к MYDON напрямую, не открывая панель и не
вспоминая маршруты: «что ждёт моего решения», «поставь задачу Бехрузу», «что случилось у vendhub-ops за
сутки», «покажи страницу знаний». Это делает MYDON приложением собственного harness — суть уровня 3 плана.

Критерий приёмки: в Claude Code владельца инструмент `approvals_list` даёт тот же список, что `/inbox`;
`tasks_create` создаёт задачу, видимую на `/tasks`; `events_recent(source="agent:vendhub-ops", limit=20)`
возвращает ровно двадцать событий ЭТОГО источника; `kb_read` отдаёт страницу знаний, а личный документ —
только при owner-токене; `mydon inbox` печатает то же, что `approvals_list`.

## 2. Факты (инвентарь 06.09.2026, проверено в коде и на проде)

- MCP в репо нет: ни `apps/mcp`, ни `.mcp.json`, ни `@modelcontextprotocol/sdk` в зависимостях (в сторе он
  есть транзитивно от `@anthropic-ai/claude-agent-sdk`). CLI тоже нет: ни одного `bin` в манифестах,
  `tools/` не входит в workspace и не имеет своего `package.json`.
- REST уже покрывает большую часть: `tasks.*` (`tasks.controller.ts:470-810`), `approvals` list/pending/decide
  (`approvals.controller.ts:53-81`), брифинг `GET /registry/briefing`, знания `GET /docs/file` и `GET /docs/tree`
  (белый список корней), карточки агентов `GET/POST/PATCH /agents`, дека навыков `GET /agents/skills`,
  журнал прогонов и доска `GET /routines/*` (волна R), сущности `GET /entities?domain=&type=&q=`
  (`FindEntitiesDto`: `domain`, `type`, `q`, `operational`, `id`) — этого хватает и на `registry.search`,
  и на `ventures.*` (кандидат = `entity` типа `venture_candidate` в домене `mydon`).
- Дыра одна: `GET /events` теряет `source` и не принимает `limit` — контроллер передаёт в сервис только
  `type` и `since` (`events.controller.ts:66-72`), хотя сервис умеет `types[]`, `until`, `order`, `limit`, а
  соседние `count`/`latest` `source` учитывают. Память агентов живёт событиями типа `agent.memory:<навык>`
  (`apps/agents/src/core-client.ts:949-976`), и перечислить её нечем: `latest` отдаёт одну запись.
- Авторизация Core: глобально `ThrottlerGuard` (60/10 с) → `ServiceTokenGuard` (токен обязателен на мутациях;
  GET открыт, кроме `/docs/*` и `/routines/*` с собственными классовыми гардами) → `PersonalDomainGuard`.
  Точечно: `OwnerActionGuard` (всегда строгий), `OwnerMutationGuard` и `SystemOwnerGuard` — оба пропускают,
  пока `isOwnerIdentityEnforced` ложно (`owner-mutation.guard.ts:19`).
- Прод (06.09.2026): `OWNER_IDENTITY_ENFORCED` пуст (пояс выключен), `OWNER_ACTION_TOKEN` задан и НЕ равен
  `SERVICE_TOKEN`, `AGENTS_SCHEDULES_PAUSED=0`, `AGENTS_TASKS_PAUSED=1`, Core слушает `127.0.0.1:3001`
  (с MacBook — только через SSH-туннель, как в `project_mydon_local_dev`).
- Скрипты `tools/*.mjs` (25 штук) ходят в Core одним и тем же копипастом: `CORE_API_URL ?? http://127.0.0.1:3001`
  + `SERVICE_TOKEN` + заголовок `x-service-token`; общей обвязки нет, TS-клиенты панели и агентов
  переиспользовать нельзя (`server-only`, сборка). Четыре несовместимые конвенции сухого прогона.

## 3. Решения

**Р-1. Один клиент на два входа.** `apps/mcp` содержит и MCP-сервер, и CLI: они разные оболочки над одним
модулем `core-client.ts` (fetch + токены + разбор ошибок). Иначе появится третья копия того же fetch.
Отвергнуто: CLI отдельным пакетом (дублирует клиент и релизный путь), CLI внутри `tools/` (там нет
workspace-пакета и типов).

**Р-2. Инструменты именуются `<область>_<действие>` и делятся по последствию.** Читающие —
`briefing_get`, `inbox_list`, `tasks_list`, `task_get`, `registry_search`, `events_recent`, `memory_recall`,
`kb_read`, `kb_tree`, `agents_list`, `runs_recent`, `ventures_list` (восемнадцатый — `kb_tree`: без дерева
модель не знает, какую страницу просить; ruling 06.09, §4.2 всегда его требовал). Меняющие мир — `task_create`, `task_comment`,
`task_status`, `memory_remember`, `agent_upsert`, `approval_decide`. В описании каждого меняющего
инструмента первым предложением — что именно он изменит и где это увидит владелец.

**Р-3. Правда о поясе безопасности — в описании инструмента, а не в намерении.** При старте сервер
читает `GET /system/config` и запоминает, включён ли owner-пояс (`OWNER_IDENTITY_ENFORCED`) и задан ли
owner-токен в окружении сервера. Описание `approval_decide` собирается динамически: «решение владельца;
сейчас Core пропускает его по сервисному токену — пояс идентичности выключен» либо «…требует owner-токен,
он задан/не задан». Owner-заголовок закладывается сразу, поэтому включение пояса не превращает инструмент
в 401. Отвергнуто: подписать «только владелец» и надеяться — это ложь, которую владелец обнаружит поздно.

**Р-4. Личный контур исключается явно, а не гардом.** `PersonalDomainGuard` не закрывает чтения без
домена (признанный обход, `personal-domain.guard.ts:19-33`). Поэтому `registry_search` и `tasks_list` по
умолчанию ставят `domain != personal` на стороне MCP (фильтрация ответа по полю `domain`), а достать личное
можно только явным `domain: "personal"` — и такой вызов идёт с owner-токеном, если он задан. `kb_read`
полагается на серверную проверку `personalVisible` и честно возвращает её отказ.

**Р-5. Ответы — компактный текст, а не сырой JSON.** Модель получает готовые к чтению строки (список
согласований — по одной строке на запрос с id, тиром, возрастом), потому что сырые payload раздувают
контекст и провоцируют галлюцинации о полях. Полный объект отдаётся, только когда инструмент адресный
(`task_get`, `kb_read`). Ограничения: список ≤ 50 записей по умолчанию, текст ответа ≤ 8000 символов,
`kb_read` ≤ 64 КБ с честной пометкой об обрезке.

**Р-6. Микрофиксы Core минимальны и полезны сами по себе.** (а) `GET /events` принимает `source`, `limit`
(≤ 200, дефолт 50), `until` и `order`; (б) `GET /events` принимает `typePrefix` — префиксный фильтр по типу,
чем и перечисляется память агента (`agent.memory:`); (в) `GET /agents/skills` принимает `agent`;
(г) `GET /routines/runs` принимает `from`/`to`. Ни одной миграции.

**Р-7. Сухой прогон CLI — одна конвенция.** У всех команд CLI, меняющих мир, обязателен явный `--yes`
(без него — печать намерения и выход 0). Существующие `tools/*.mjs` не трогаем, но конвенцию фиксируем
в `docs/AGENTS_ACTIVATION.md`, чтобы новые скрипты писались по ней.

**Р-8. Сборка и доставка.** `apps/mcp` — обычный пакет workspace (`@mydon/mcp`), TypeScript, сборка в `dist`,
`bin: { mydon: "dist/cli.js" }`. В `deploy/Dockerfile` добавляется одна строка `COPY apps/mcp/package.json`.
На сервере ничего не запускается: MCP живёт у владельца на MacBook и ходит в Core через SSH-туннель
(`CORE_API_URL=http://127.0.0.1:3001` при поднятом туннеле). `.mcp.json` в корне репозитория описывает сервер
для Claude Code; секреты в нём не хранятся — только имена переменных окружения.

**Р-9. Ошибки Core переводятся, а не пробрасываются.** 401 → «Core не принял токен: проверь SERVICE_TOKEN…»,
403 → «личный контур закрыт: нужен owner-токен», 404 → «не найдено», 409 → текст Core как есть, 429 →
«Core ограничил частоту, повтори через несколько секунд», сеть → «Core недоступен по адресу …». Ни одно
сообщение не печатает значение токена.

## 4. Требования

### 4.1 R-A1-1 Клиент (`apps/mcp/src/core-client.ts`)
`createClient({ baseUrl, serviceToken, ownerToken? })` → методы под каждый используемый маршрут; таймаут
15 с; ошибки — класс `CoreError { status, path, message }` с текстами Р-9; owner-токен добавляется
заголовком `x-owner-action-token` только там, где он нужен (owner-действия и явный личный домен).
`baseUrl` по умолчанию `http://127.0.0.1:3001`, из `CORE_API_URL`; токен из `SERVICE_TOKEN`; owner-токен из
`OWNER_ACTION_TOKEN` (необязателен). Отсутствие `SERVICE_TOKEN` — понятная ошибка при старте, а не 401 позже.

### 4.2 R-A1-2 MCP-сервер (`apps/mcp/src/server.ts`)
Транспорт stdio, `@modelcontextprotocol/sdk`. Восемнадцать инструментов из Р-2 с JSON-схемами входа.
Обязательные детали:
- `inbox_list` = `GET /approvals/pending` + `GET /entities/pending`, одна сводка «ждёт решения: N согласований,
  M записей», далее строки. Именно этот инструмент отвечает на «что ждёт моего решения».
- `tasks_list(status?, ownerRef?, domain?, limit?)`, `task_get(id)`, `task_create({title, description?, ownerKind,
  ownerRef?, domain?, due?, priority?})`, `task_comment(id, body)`, `task_status(id, status, note?)`.
- `events_recent({source?, type?, typePrefix?, since?, limit?})`, `memory_recall({agent, skill?})` (поверх
  `typePrefix: "agent.memory:"`), `memory_remember({agent, skill, value})`.
- `registry_search({q, domain?, type?, limit?})`, `ventures_list({verdict?, limit?})` (поверх entities).
- `kb_read({path})` + `kb_tree({root?})` (дерево `GET /docs/tree`, чтобы модель знала, что просить).
- `agents_list()`, `agent_upsert({name, ...})` (POST при отсутствии, PATCH при наличии; `autonomyDefault`
  идёт отдельным вызовом `PATCH /agents/:name/autonomy`, потому что общий patch его сознательно отбрасывает),
  `runs_recent({agent?, skill?, outcome?, limit?})`, `briefing_get()`, `approval_decide({id, decision})`.
- Каждый инструмент возвращает текст; при ошибке — `isError: true` и переведённое сообщение.

### 4.3 R-A1-3 CLI (`apps/mcp/src/cli.ts`)
Команды: `mydon inbox`, `mydon tasks [--status] [--owner]`, `mydon task <id>`, `mydon task-create --title …
[--yes]`, `mydon events [--source] [--type] [--limit]`, `mydon runs [--agent] [--skill]`, `mydon kb <path>`,
`mydon search <q>`, `mydon briefing`, `mydon agents`, `mydon decide <id> approved|rejected --yes`.
`--json` печатает сырой ответ (для скриптов), без него — тот же компактный текст, что у MCP. Разбор флагов
свой, без зависимостей; неизвестный флаг — ошибка с подсказкой (не молчаливое игнорирование, как в
`argv.includes` у старых скриптов).

### 4.4 R-A1-4 Микрофиксы Core
`ListEventsDto` + `EventsController.list`: `source`, `limit` (1…200, дефолт прежний — 100; ruling 06.09: менять
дефолт ради MCP нельзя, у него свой лимит 50, который он шлёт явно), `until`, `order`
(`asc|desc`, дефолт `desc`), `typePrefix` (≤ 128 символов, транслируется в `like` по `type`); сервис уже
умеет всё, кроме префикса — добавить одно условие. `count`/`latest` сохраняют прежний набор параметров отдельным DTO: тихо игнорировать новые поля хуже, чем
отвечать 400 (ruling 06.09). `GET /agents/skills?agent=` фильтрует деку.
`GET /routines/runs?from=&to=` фильтрует журнал по `started_at`. Тесты на каждый параметр, включая
«без параметров ответ не изменился».

### 4.5 R-A1-5 Проверки
- Тесты `apps/mcp`: клиент (переводы ошибок, заголовки, таймаут), форматтеры ответов (снимки строк),
  разбор флагов CLI, сборка описаний инструментов при включённом и выключенном поясе, фильтрация
  `domain != personal` по умолчанию.
- Тесты Core на четыре микрофикса.
- `tools/smoke-core.mjs`: сценарий `проверитьСобытияИДеку` — `GET /events?source=…&limit=1` возвращает одну
  запись именно этого источника; `typePrefix` находит запись памяти; `GET /agents/skills?agent=` уже деки;
  `GET /routines/runs?from=&to=` отсекает по времени.
- Ручная проверка владельцем (в чек-лист): туннель поднят, `.mcp.json` подхвачен, `inbox_list` отвечает.

### 4.6 R-A1-6 Документация
`docs/MCP.md`: зачем, как включить (`.mcp.json`, переменные окружения, туннель), список инструментов с
последствиями, что делает owner-пояс. Раздел в `docs/AGENTS_ACTIVATION.md` про CLI и конвенцию `--yes`.
Пункт в `docs/FIRST_LOGIN_CHECKLIST.md`. Решение `docs/decisions/2026-09-06-wave-a1-mcp-cli.md`.

## 5. Безопасность

- Токены только из окружения; `.mcp.json` содержит имена переменных, не значения; ни одно сообщение об
  ошибке не печатает токен; CLI не логирует заголовки.
- Личный контур: по умолчанию исключён (Р-4); явный запрос личного — с owner-токеном.
- Меняющие инструменты не имеют «пакетного» режима: одна операция за вызов, чтобы модель не смогла
  массово изменить состояние одним движением.
- `approval_decide` не выдумывает решение: `decision` — обязательный параметр из перечисления.
- Ответы Core — данные, не инструкции: содержимое задач, событий и страниц знаний вставляется в текст как
  цитата и никогда не исполняется MCP-сервером.

## 6. Вне среза

Панели `/apps`, `/artifacts`, командный центр из виджетов и карточка агента (срезы A2/A3); запись
артефактов в `document`; раскладка виджетов владельца; ventures.create/update (реестр пишет навык
Venture Factory); web-чтение и Builder (§9 строка A, отдельная работа); запуск MCP на сервере.

## 7. Приёмка

1. `pnpm --filter @mydon/mcp build && test`, гейт монорепо, CI зелёный.
2. Смоук Core: новый сценарий проходит на postgres:17.
3. Локально у владельца: туннель, `.mcp.json`, в Claude Code видны инструменты; `inbox_list` совпадает с
   `/inbox`; `task_create` создаёт задачу, видимую на `/tasks`; `mydon inbox --json` печатает то же.
4. Отрицательные: без `SERVICE_TOKEN` — понятная ошибка; `kb_read` личного документа без owner-токена —
   переведённый отказ; `events_recent(limit=1000)` — ограничено 200 без падения.
