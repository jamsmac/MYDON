# 2026-09-06 · Волна A, срез A1 «Руки» — MCP-сервер `mydon-core` и CLI `mydon`

## Активный контекст

Ветка `feat/wave-a1-mcp-cli` (от `main`, база `3e431dd` — main после волны R), HEAD на момент
записи — `8f2ef5d` (после этого коммита следует T6, документация); итоговый HEAD ветки после
отложенного пакета Minor и adversarial-раунда — `8600b45` (см. ниже). Спека
`docs/superpowers/specs/2026-09-06-wave-a1-mcp-cli-design.md` (решения Р-1…Р-9 в §3, требования
R-A1-1…R-A1-6 в §4, приёмка в §7), план `docs/superpowers/plans/2026-09-06-wave-a1-mcp-cli.md`,
журнал среза — `.superpowers/sdd/2026-09-06-wave-a1-mcp-cli/`. Решения с причинами —
`docs/decisions/2026-09-06-wave-a1-mcp-cli.md` (Р-1…Р-9 из спеки + шесть ruling из ревью реализации
+ пять ruling из adversarial-раунда, Ruling 7–11), статус в `docs/AGENTIC_OS_ARMS_PLAN.md` §6.4
пп. 1–2. Это волна A плана ARMS сразу после закрытия волны R (06.09) — командный центр начинает
читаться и писаться прямо из Claude Code владельца.

Шесть задач по плану, коммиты по порядку (`git log main..feat/wave-a1-mcp-cli`):
`3d509ae` спека+план · `9697b0d` T2 каркас пакета и клиент Core · `4ce9dda`→`763b74a` T1
микрофиксы Core (`/events`, `/agents/skills`, `/routines/runs`) + ruling'и 1/2 (`5dc3bb9`) ·
`f2571d2` фикс-раунд T2 после ревью (лимит `entities()`, чтение тела в защите таймаута, честные типы
пустого ответа) · `f9e7362` T3 компактные форматтеры (`format.ts`) · `5b3d09a` T5 CLI `mydon` ·
`528df79` T4 MCP-сервер (18 инструментов) + ruling 3 (`8f2ef5d`, `kb_tree` остаётся, спека
поправлена) · `5cb6923` T6 документация, решения, чек-лист, план ARMS, handoff · `113a3b5`
фикс-раунд T4 после ревью (исходы и статусы — словарями Core, а не примерами). Дальше — пакет
отложенных Minor: `ddee771` (apps/mcp) и `31087ba` (apps/core), см. «Отложенный пакет A1» ниже.
Ещё дальше — adversarial-раунд (пакеты A и B, тот же вечер, параллельно): `407543d` fix(core) B1
(`/events/latest` честно фильтрует по `since`, а не только принимает поле) · `b8475b8` docs B2–B5
(пересчёт инструментов 18→19 везде, верный build-гейт `pnpm --filter "@mydon/mcp..." build`, честная
доставка `apps/mcp` в prod-образ) · `cbff358` fix(mcp) A1–A7 (подпись `mcp` на меняющих вызовах,
честная полная страница при отсеве личного, `agent_upsert` объявляет замену набора навыков,
граница чужого текста, `authorRef`/`kb_tree`/`archived`, лимиты CLI, протокольный тест) · `8600b45`
fix(core) — карточка агента принимает `actor` (Ruling 7–11 в decisions.md; отчёты пакетов —
`.superpowers/sdd/2026-09-06-wave-a1-mcp-cli/adv-fixes-mcp-report.md` и `.../adv-fixes-core-docs-report.md`).

## Сделано

- **Клиент Core** (Р-1, R-A1-1): `apps/mcp/src/core-client.ts` — 21 метод (`pendingApprovals`,
  `pendingEntities`, `decideApproval`, `tasks`, `task`, `createTask`, `commentTask`,
  `setTaskStatus`, `events`, `recordEvent`, `entities`, `docsTree`, `docFile`, `agents`,
  `skillDeck`, `createAgent`, `updateAgent`, `setAutonomy`, `runs`, `briefing`, `systemConfig`),
  класс `CoreError` с переводами кодов (Р-9), таймаут 15 с, owner-заголовок только там, где нужен.
  Пустое тело на успехе — тоже `CoreError` (не тихий `undefined`). `apps/mcp/src/env.ts`
  (`loadEnv`) читает `CORE_API_URL`/`SERVICE_TOKEN`/`OWNER_ACTION_TOKEN`, падает на старте без
  `SERVICE_TOKEN`.
- **Микрофиксы Core** (Р-6, R-A1-4): `apps/core/src/events/events.controller.ts` —
  `ListEventsDto` (`source`, `typePrefix`, `until`, `order`, `limit` 1…200) для ленты, отдельный
  узкий `FilterEventsDto` для `count`/`latest` (прежний набор полей — неизвестное новое поле снова
  400, а не молчаливо игнорируется). Дефолт страницы ленты остался 100 (ruling 1). `GET
  /agents/skills?agent=` фильтрует деку, `GET /routines/runs?from=&to=` фильтрует журнал по
  `started_at`. `GET /events/latest` дополнительно фильтрует по `since` (было: принимало поле и
  молча его не применяло — B1, `407543d`). Ни одной миграции. `apps/core` тесты на финальном HEAD
  ветки (`8600b45`, перепроверено прогоном `pnpm --filter @mydon/core test`): **1990 pass / 0 fail
  (395 suite)** — было 1978/391 на момент этой записи; между ними ещё +4 теста guard'а ленты
  событий (Ruling 5, `d04e163`), +5 у B1 (`407543d`) и +3 у подписи карточки агента (Ruling 11,
  `8600b45`).
- **Компактные форматтеры** (Р-5, R-A1-1): `apps/mcp/src/format.ts` — `formatInbox`, `formatTasks`,
  `formatTask`, `formatEvents`, `formatRuns`, `formatEntities`, `formatAgents`, `formatDeck`,
  `formatBriefing`, `formatDoc`, общий `clamp` (8000 симв.) и `truncateUtf8` (64 КБ по байтам для
  `kb_read`). Список по умолчанию — 50 записей (`MAX_LIST_ITEMS`), честная пометка при обрезке.
- **MCP-сервер** (Р-2, Р-3, R-A1-2): `apps/mcp/src/server.ts` (stdio-транспорт,
  `@modelcontextprotocol/sdk`, `console.log` перехвачен в stderr — stdout занят протоколом) +
  `apps/mcp/src/tools.ts` (`buildTools`, `registerTools`) — девятнадцать инструментов (ruling 3 +
  ruling 6): тринадцать читающих (`briefing_get`, `inbox_list`, `tasks_list`, `task_get`,
  `registry_search`, `events_recent`, `memory_recall`, `kb_read`, `kb_tree`, `agents_list`,
  `skills_deck`, `runs_recent`, `ventures_list`), шесть меняющих (`task_create`, `task_comment`,
  `task_status`, `memory_remember`, `agent_upsert`, `approval_decide`). Личный контур отсеян на
  стороне MCP (`hidePersonal`, Р-4). Описание `approval_decide` собирается динамически по состоянию
  `OWNER_IDENTITY_ENFORCED`, прочитанному при старте (`readPosture`, Р-3). `.mcp.json` в корне
  репозитория — только имена переменных, `${VAR:-default}` подтверждён по докам Claude Code.
- **CLI `mydon`** (Р-7, R-A1-3): `apps/mcp/src/cli.ts` (`runCommand`, чистая функция) +
  `apps/mcp/src/args.ts` (`parseArgs`, свой разбор без зависимостей, неизвестный флаг — ошибка с
  подсказкой). Одиннадцать команд: `inbox`, `tasks`, `task`, `task-create`, `events`, `runs`, `kb`,
  `search`, `briefing`, `agents`, `decide`. `--yes` обязателен на `task-create`/`decide` (без него —
  печать намерения, код 0, Core не вызывается); `--json` печатает сырой ответ. Коды возврата: 0
  успех, 1 ошибка Core, 2 ошибка использования. `bin: { mydon: "dist/cli.js" }` в
  `apps/mcp/package.json`.
- **Сборка и доставка** (Р-8, R-A1-6 частично): `apps/mcp` — пакет workspace `@mydon/mcp`, сборка
  `tsc` в `dist`. `deploy/Dockerfile` — `COPY apps/mcp/package.json ./apps/mcp/` в слое зависимостей
  (только для целостности `pnpm install`, процесс на сервере не запускается).
- **Тесты** (R-A1-5): `apps/mcp` — на момент этой записи 145 pass / 0 fail (25 сьютов):
  env/клиент/переводы ошибок, форматтеры (снимки строк), разбор флагов CLI, CLI-команды (сухой
  прогон/`--yes`/`--json`), сборка описаний инструментов при включённом и выключенном поясе,
  фильтрация `domain != personal` по умолчанию, stdio-смоук сервера (`tools/list` → 19 после
  ruling 6, ошибка переведена, 0 не-JSON строк в stdout). После adversarial-раунда A1–A7 (`cbff358`)
  гейт стал **180 pass / 0 fail (29 сьютов)** — новые тесты покрывают подпись `mcp` на всех
  меняющих вызовах, честную полноту страницы при отсеве личного, объявленную замену набора навыков
  у `agent_upsert`, границу чужого текста (`inlineText`/`untrustedBlock`), `authorRef`/`kb_tree`/
  `archived`, лимиты CLI и протокольный слой (`server-protocol.test.ts` — полноценный stdio-смоук
  вместо ручного). `tools/smoke-core.mjs`: новый сценарий `проверитьСобытияИДеку()` — `?source=&limit=`
  возвращает записи именно этого источника, `?typePrefix=` находит память агента и не даёт ложных
  срабатываний через `%`/`_` в пользовательском вводе (экранировано), `?agent=` уже деки, `?from=&to=`
  журнала.
- **Документы** (эта задача, T6): `docs/MCP.md` — зачем, как включить (туннель/окружение/`.mcp.json`/
  сборка), таблица инструментов «что делает — что меняет» (девятнадцать после ruling 6), пояс
  владельца и как проверить его состояние, ограничения. `docs/AGENTS_ACTIVATION.md` — раздел
  «CLI `mydon` и конвенция `--yes`». `docs/FIRST_LOGIN_CHECKLIST.md` — раздел 8 (туннель, токены,
  сборка, проверка инструментов и пояса). `docs/AGENTIC_OS_ARMS_PLAN.md` §6.4 пп. 1–2 — помечены
  «СДЕЛАНО 06.09.2026», ссылка на спеку. `docs/decisions/2026-09-06-wave-a1-mcp-cli.md` — Р-1…Р-9 +
  шесть ruling.
- **Adversarial-раунд** (тот же вечер, после T6 и отложенного пакета Minor): пакет A —
  `apps/mcp` (A1–A7, `cbff358`) — подпись `mcp` на всех меняющих вызовах кроме `memory_remember`
  (её у события и так нет) и `agent_upsert` (Core пока не принимал подпись), честная полнота
  страницы при отсеве личного, `agent_upsert` объявляет замену набора навыков вслух, граница
  чужого текста (`inlineText`/`untrustedBlock`, страж в `instructions` сервера),
  `authorRef`/`kb_tree` (закрытый набор корней, честный отказ)/`agents_list.archived`, лимиты CLI
  до Core и до форматтера, протокольный тест вместо ручного смоука. Пакет B — `apps/core` и
  документы (B1–B5, `407543d`+`b8475b8`) — `/events/latest` честно фильтрует по `since`, пересчёт
  инструментов 18→19 везде, верный build-гейт (`pnpm --filter "@mydon/mcp..." build`), честная
  доставка `apps/mcp` в prod-образ. Follow-up `8600b45` (Ruling 11) — `POST /agents`/
  `PATCH /agents/:name`/`PATCH /agents/:name/autonomy` принимают `actor`, закрывая ровно ту дыру,
  что пакет A нашёл в чужой зоне и не мог закрыть сам; `apps/mcp` этот `actor` пока НЕ шлёт (см.
  «Что осталось владельцу»). Решения — Ruling 7–11 в `docs/decisions/2026-09-06-wave-a1-mcp-cli.md`,
  отчёты пакетов — `.superpowers/sdd/2026-09-06-wave-a1-mcp-cli/adv-fixes-mcp-report.md` и
  `.../adv-fixes-core-docs-report.md`. Рунбук `docs/MCP.md` обновлён по всем пунктам выше.

## Как принять (§7 спеки)

1. **Гейт монорепо, CI зелёный:** `pnpm --filter "@mydon/mcp..." build && pnpm --filter @mydon/mcp test`
   (суффикс `...` тянет зависимость `@mydon/shared` — без него сборка падает на свежем чекауте,
   adversarial-фикс B3) — на финальном HEAD ветки (`8600b45`) **180/180** (было 145/145 на момент T6, до
   adversarial-раунда); `pnpm --filter @mydon/core test` — **1990/1990** (было 1978/1978 после
   микрофиксов и пакета отложенных Minor) — оба прогонялись по отдельности при написании этой
   записи и при adversarial-раунде; финальный совместный прогон всей ветки — на владельце перед мержем
   PR (`gh workflow run ci.yml --ref feat/wave-a1-mcp-cli`, см. `reference_github_actions_billing_block`
   — CI на PR отключён осознанно, гейт миграций/пакета до мержа запускается вручную).
2. **Смоук Core:** `проверитьСобытияИДеку()` в `tools/smoke-core.mjs` — прогнан на живом Postgres
   задачей T1 дважды зелёным при внедрении микрофиксов; полный прогон сценария под финальным HEAD
   ветки — тоже на владельце перед мержем.
3. **Локально у владельца (ручная проверка, чек-лист `docs/FIRST_LOGIN_CHECKLIST.md` §8):** поднять
   туннель (`ssh -N -L 3001:127.0.0.1:3001 <прод-хост>`), положить `SERVICE_TOKEN`/
   `OWNER_ACTION_TOKEN` в окружение своей машины, `pnpm --filter "@mydon/mcp..." build` (тянет
   зависимость `@mydon/shared` — adversarial-фикс B3), открыть
   репозиторий в Claude Code — `.mcp.json` уже в корне, инструменты `mydon-core` должны появиться в
   списке (19 штук); `inbox_list` должен дать тот же список, что `/inbox`; `task_create` должен
   создать задачу, видимую на `/tasks`; `mydon inbox --json` должен напечатать то же, что вернул
   `inbox_list` (в JSON-форме).
4. **Отрицательные проверки:** запуск без `SERVICE_TOKEN` в окружении → понятная ошибка при старте
   (не 401 позже); `kb_read` личного документа без `OWNER_ACTION_TOKEN` → переведённый отказ (403,
   текст «личный контур закрыт: нужен owner-токен»); `events_recent(limit=1000)` → ограничено 200 без
   падения (`limitOf`, `tools.ts`).

## Что осталось владельцу

- **Смержить PR** после зелёного CI (шаг 1 выше) и прогнать смоук-сценарий на финальном коммите
  ветки перед мержем.
- **Поднять SSH-туннель** до Core с MacBook (`ssh -N -L 3001:127.0.0.1:3001 <прод-хост>`) — держать
  его поднятым на время работы с MCP/CLI; без него оба входа вернут «Core недоступен».
- **Положить `SERVICE_TOKEN` и `OWNER_ACTION_TOKEN` в окружение своей машины** — тем же значением,
  что у панели/бота для сервисного, и существующим `OWNER_ACTION_TOKEN` прода для owner-действий
  (он уже задан на проде и не равен `SERVICE_TOKEN` — подходит без смены).
- **Собрать пакет** (`pnpm --filter "@mydon/mcp..." build` — суффикс `...` тянет `@mydon/shared`,
  без него сборка падает на свежем чекауте, adversarial-фикс B3) и открыть репозиторий в
  Claude Code — `.mcp.json` уже в корне, ничего добавлять не нужно.
- **Пройти чек-лист §7 спеки** (раздел «Как принять» выше) на своей машине — это единственная
  проверка, которую нельзя выполнить из этой сессии (нужны реальный туннель и реальный Claude Code
  владельца).
- **Решить, линковать ли `mydon` глобально** (`pnpm link --global` в `apps/mcp`) — без этого CLI
  вызывается как `node apps/mcp/dist/cli.js <команда>`, что тоже рабочий путь для скриптов.
- **Решить, стоит ли донести подпись `mcp` до правок карточки агента** (Ruling 11, известный
  хвост). Core (`8600b45`) уже принимает `actor` на `POST /agents`/`PATCH /agents/:name`/
  `PATCH /agents/:name/autonomy`; `apps/mcp` его пока не шлёт, и `agent_upsert` до сих пор ложится
  в `audit_log` карточки агента как `owner` — в отличие от `task_create`/`task_comment`/
  `task_status`/`approval_decide`, которые уже подписаны `mcp`. Правка небольшая (пробросить
  `MCP_ACTOR` в `core-client.ts`/`tools.ts` тем же приёмом), но не входит в этот срез — решение,
  приоритизировать ли её сейчас или оставить на A2/A3.

## Что НЕ сделано (сознательно, не в этом срезе, §6 спеки)

- Панели `/apps`, `/artifacts`, командный центр из виджетов и карточка агента — срезы A2/A3.
- Запись артефактов в `document`; раскладка виджетов владельца.
- `ventures.create/update` — пишет навык Venture Factory, MCP только читает (`ventures_list`).
- Web-чтение и Builder (§9 строка A плана ARMS, отдельная работа).
- Запуск MCP на сервере — не нужен по конструкции (Р-8): сервер — процесс на машине владельца.
- ~~Проверка допустимых флагов CLI НА КОМАНДУ~~ — СДЕЛАНО в пакете отложенных Minor (`ddee771`):
  карта `COMMAND_FLAGS` в `cli.ts`, чужой для команды флаг — usage-ошибка с кодом 2.
- Индекс под `typePrefix`/`source` в `event` — миграции в этом срезе запрещены (найдено ревью
  Task 1); MCP компенсирует советом «передавайте `since`, если знаете период» в описании
  `events_recent`.
- Подпись `mcp` у `agent_upsert` (Ruling 11) — Core (`8600b45`) уже принимает `actor` на всех трёх
  маршрутах карточки агента, `apps/mcp/src/core-client.ts` его пока не шлёт; правка небольшая, но
  за пределами этого среза (см. «Что осталось владельцу»).

## Откат

Предыдущий образ (прод не менялся: `apps/mcp` не участвует в рантайме сервера — только
`COPY apps/mcp/package.json` в слое зависимостей Dockerfile ради целостности `pnpm install`).
Микрофиксы Core (`ListEventsDto`/`FilterEventsDto`, `agent=`/`from=`/`to=`) — новые опциональные
параметры без изменения поведения при их отсутствии; откат безопасен без миграции (миграций в
срезе нет вовсе). MCP-сервер и CLI живут только на машине владельца — откат кода на ней не влияет
на прод.

## Ожидает

- **Владелец:** смёржить PR после зелёного CI, пройти ручную проверку §7 на своей машине (раздел
  «Что осталось владельцу» выше).
- **Отложенный пакет A1 — ЗАКРЫТ** двумя коммитами (`ddee771` apps/mcp, `31087ba` apps/core):
  `clamp()` при малом лимите, флаги CLI по командам, `clamp` в пустой ветке `ventures_list`, тест
  дрейфа `AGENT_STATUSES` против исходника Core, разовый `prettier --write` по `apps/mcp`; в Core —
  400 на чужой `outcome` (разворот решения волны R: тихое отбрасывание — дефект честности) и на
  перебор `limit` (симметрия с `/events`), общий `first()` в `common/query-param.ts`. Осталось
  из находок ревью: индекс под `typePrefix`/`source` в `event` — миграции в срезе запрещены,
  вынесено в A2/A3.
- **Adversarial-раунд (пакеты A и B) — ЗАКРЫТ** четырьмя коммитами (`407543d`, `b8475b8`,
  `cbff358`, `8600b45`): подпись `mcp` на меняющих вызовах, честная полнота страницы при отсеве
  личного, объявленная замена набора навыков, граница чужого текста, честные контракты
  (`authorRef`/`kb_tree`/`archived`), лимиты CLI, `/events/latest` фильтрует по `since`, документы
  пересчитаны и сверены с кодом (Ruling 7–11 в decisions.md). Осталось из находок пакета A: подпись
  `mcp` у `agent_upsert` — Core теперь принимает `actor`, MCP пока не шлёт (см. ниже).
- Дальше по `docs/AGENTIC_OS_ARMS_PLAN.md` §6.4: пп. 3–7 — панель «Приложения» (`/apps`), кольцо
  артефактов (`/artifacts`), командный центр `/mydon` из виджетов, `/agents/[name]`.
