# Волна R — рутины: доска срабатываний, хуки, плейбэк прогона

Дата: 2026-09-06. План ARMS `docs/AGENTIC_OS_ARMS_PLAN.md` §6.3 (пп. 1–5), §9 строка **R**.
Ветка `feat/wave-r-crons-flows`. Предшественники: волна S (`2026-09-05-skills-deck-cron-llm-design.md`,
R-SD-*), волна M (`2026-09-06-wave-m-docs-brain-design.md`, R-M-*).

## 1. Цель и критерий

Владелец с телефона, без SSH, видит: **что запустится в ближайшие 24 часа** и **почему навык вчера
промолчал** (§6.3 п. 5). Сегодня это невозможно: исход cron-прогона (`skipped:no_signal`,
`budget_denied`, `llm_failed`…) живёт только в stdout контейнера `mydon-agents`, а системные мониторы
(`ourvend:sync`, `coffee:monitor`…) вообще не оставляют следа в базе.

Критерий приёмки на проде: `/crons` показывает все запланированные задания с ближайшим временем по
Ташкенту; после первого тика любого задания `/flows` показывает прогон с исходом и причиной; главная
показывает виджет «ближайшие 24 ч».

## 2. Факты (инвентарь на 06.09.2026)

- Расписания агентов: `schedule: [{cron, skill}]` в `apps/agents/agents/<name>/config.yaml`, зеркало в
  `agent.schedule` (jsonb, seed при старте). Набор заданий считает `desiredJobs(agents, isWired)`
  (`apps/agents/src/schedule.ts`): только `status: active`, навык «подключён» = код в SKILLS или llm-навык
  при metered LLM-маршруте (`llmCronAdmitted`). Заведение — `reconcileSchedules()` в `apps/agents/src/index.ts`
  (при старте, каждые 10 мин при изменении карточек/паузы/маршрута); croner, `TZ = Asia/Tashkent`.
- Два режима вызова (`scheduledInvocationMode`): `durable-task` (навык из `DURABLE_SCHEDULED_SKILLS` или
  llm-навык → Core создаёт задачу `source = agent-schedule` на плановый occurrence, worker её забирает) и
  `legacy` (прямой `runSkill` из cron-колбэка, `requestKey = cron:<agent>:<skill>:<cron>:<ISO>`).
- `runSkill` (`apps/agents/src/runner.ts`) возвращает `RunResult { outcome: approval_requested | executed |
  skipped; skipReason?: inactive | not_implemented | no_signal | capped | no_change | budget_denied |
  execution_unknown | workflow_changed | ledger_unavailable | llm_failed | llm_invalid_output; reason;
  approvalId?; action?; facts? }`. В legacy-режиме пишет событие `agent.run` **в начале** (без исхода) и
  `agent.action` при подаче; в task-режиме всё коммитит Core (`commitAgentTaskOutcome` → `task.resultNote`,
  `task_agent_execution.outcome_payload`, `approval`, `outbox_delivery`, `audit_log`).
- Исключение в cron-колбэке ловится `console.error(... сбой)`. Исход никуда не пишется.
- Системные мониторы (не паспорта, env-cron, только при старте): `ourvend:sync` (`OURVEND_SYNC_CRON`,
  `0 */3 * * *`, только при `OURVEND_ACCOUNT/PASSWORD`), `ourvend:accounting` (`5 8 * * *`),
  `coffee:monitor` (`0 7 * * *`), `maintenance:monitor` (`0 6 * * *`), `globerent:monitor` (`10 7 * * *`),
  `fx:refresh` (`5 9 * * *`). Значение `off` выключает. Итог — строка `console.log`.
- Паузы: `AGENTS_SCHEDULES_PAUSED` и `AGENTS_TASKS_PAUSED` (system_config, панель `/system`, дефолт `1`;
  на проде обе включены — см. чек-лист). Рантайм перечитывает раз в 10 минут.
- Core уже зависит от `croner` (`apps/core/package.json`) — «следующий запуск» можно считать в Core.
- Паттерн «рантайм отчитывается в Core»: `PUT /agents/skills/catalog` (волна S) — один вызов на процесс.
- Донор плейбэка: `MYDON-Run-Inspector.html` (iCloud, `MYDONv1.0/MYDON/`) — «полоса фаз»
  (`.flight` → `.ph.ok|warn|fail|skip`), таймлайн действий, карточки KPI; фазы INTAKE…LOG. Для MYDON фазы
  другие (§7.3), берём визуальную идею полосы и статусов, не код.
- Панель: `/skills` (волна S) — образец «консольного» экрана (`ConsoleTheme`, `.led`, `.av8`);
  `/system` — `SystemEditor` с `saveSystemConfig(key, value)`; главная `/mydon` — тревоги + очередь
  решений, серверный компонент, ошибки вспомогательных блоков не роняют страницу.
- Telegram-моста для алертов нет (`outbox_delivery.destination = "telegram"` встречается только в тесте) —
  уведомления «навык упал» в этой волне не делаем (§8).
- Migrations: последняя `0087_agent_skill_catalog.sql`; гейт — `gh workflow run ci.yml --ref <ветка>`
  (postgres:17) + локально pglite/Homebrew Postgres 15 (`tools/smoke-core.mjs`, 23 сценария).

## 3. Решения

**Р-1. Журнал прогонов — новая таблица `agent_run`, пишет рантайм.** Единый источник «последнего исхода»
для доски и списка для плейбэка. Пишет тот, кто выполнял навык (`apps/agents`), одной записью после
завершения `runSkill` (или из `catch` — `failed`), идемпотентно по `request_key`. В task-режиме тоже пишет
рантайм (после `commitAgentTaskOutcome`), а не Core: одна точка записи, одинаковая для обоих режимов;
Core-детали (execution, approval, outbox) плейбэк дочитывает по `task_id`. Журнал **никогда не блокирует
навык**: ошибка записи — `console.warn`, прогон считается состоявшимся.
Отвергнуто: «писать в `event`» — jsonb без индексов по агенту/навыку и без уникальности по ключу запроса;
«Core пишет сам при коммите» — legacy-путь Core не видит вовсе.

**Р-2. Снимок расписаний — рантайм пушит, Core хранит, «следующий запуск» считает Core.**
`PUT /agents/schedules/snapshot` на каждом `reconcileSchedules()` и при старте: список заданий, которые
croner реально держит (agent/skill/cron/mode), «не подключённые» с причиной, мониторы (name/cron/enabled),
флаги пауз, `generatedAt`. Core хранит одну строку (`agent_runtime_snapshot`, key `schedules`).
`nextRun` Core считает сам через `croner` (TZ Asia/Tashkent) на момент запроса — не устаревает; возраст
снимка показываем, старше 15 минут — предупреждение «агенты не отчитывались», так владелец видит и
падение контейнера. Отвергнуто: считать `desiredJobs` в Core заново (дублирует `llmCronAdmitted` и
чтение SKILLS с диска — два источника правды).

**Р-3. Мониторы — те же задания на доске и в журнале.** Шесть env-cron мониторов — это большинство того,
что реально срабатывает за сутки; доска без них врала бы. Оборачиваем колбэки в `journaledMonitor(name,
cron, fn)`: пишет `agent_run` с `agent_name = "system"`, `skill = <name>`, `trigger = "cron"`,
`outcome = executed|failed`, `reason` = итоговая строка (та, что сейчас уходит в `console.log`). Cron
мониторов остаётся в env (`*_CRON`), перевод в system_config — вне среза; на доске подпись «меняется в
.env, нужен рестарт агентов».

**Р-4. Хуки в паспорте — декларативные, с реестром реализаций; неизвестный pre_run блокирует.**
`hooks.pre_run` / `hooks.post_run` — списки `{kind, …параметры}` в `config.yaml`. Реализация —
`apps/agents/src/hooks.ts` с реестром по `kind`; `runSkill` вызывает `runPreRunHooks` перед резолвом
навыка и `runPostRunHooks` после получения результата (не влияет на результат). Неизвестный `kind` в
`pre_run` → навык **не запускается** (`skipReason: hook_blocked`, `hook: <kind>`, причина «неизвестный
хук») — как с явным навыком в волне S: не угадываем. Неизвестный `post_run` — предупреждение в лог и в
`check:passports`, прогон не страдает. Kinds этой волны: `source_fresh`, `quiet_hours` (pre),
`coach_lite` (post). Бюджет, пауза, дельта-память, потолок действий — уже встроены в рантайм и
хуками **не** дублируются (в спеке §4.4 перечислены как «встроенные проверки», доска показывает их
как причины пропуска). Реестр «виденного» фабрики — навык Claude Code, не рантайм: вне среза.

**Р-5. Плейбэк собирает Core из того, что уже есть, по `agent_run`.** `GET /flows/:id` — фазы
`trigger → skill → proposal → approval → execution → delivery` + хвост `events/audit` в окне прогона.
Источники: `agent_run` (триггер, навык, исход, причина, action), `agent_skill_catalog` (executor/tier),
`approval` (по `approval_id`; для task-режима через `task_agent_execution.approval_id`),
`task`/`task_agent_execution` (по `task_id`), `outbox_delivery` (по `task_agent_execution_id`),
`event` (source `agent:<name>`, окно `[started_at − 1 с; finished_at + 1 с]`), `audit_log` (target = task_id
или approval_id). Без новых столбцов у существующих таблиц. Что не нашли — фаза `skip`, а не выдумка.

**Р-6. Тумблеры паузы на доске — те же два ключа system_config, без per-job паузы.** Per-job пауза
требует новой сущности-оверлея над паспортом; §6.3 просит «тумблеры паузы (system-config)» — это
`AGENTS_SCHEDULES_PAUSED` и `AGENTS_TASKS_PAUSED`. Отключить одно задание владелец может, убрав строку из
`schedule` в карточке агента (`/agents`, уже работает, перечитка 10 мин).

**Р-7. Аудит репо — скрипт в `tools/` + навык Claude Code, планирование за владельцем.** Scheduled
task Claude Code живёт на Mac владельца и из сессии не переживает перезапуск; в репо кладём
детерминированный `tools/repo-audit.mjs` (только чтение, отчёт в `memory/open-questions.md` под датой) и
`.claude/skills/repo-audit/SKILL.md` с командой планирования. Пункт в `docs/FIRST_LOGIN_CHECKLIST.md`.

**Р-8. Причины пропуска — человеческий словарь в одном месте.** `packages/shared`:
`RUN_SKIP_REASONS: Record<SkipReason, {label, hint}>` (рус.). Его читают панель (`/crons`, `/flows`) и бот
(в этой волне — только панель; бот подключит «итоги» позже). Так «промолчал» превращается в «повода нет:
по данным Core предлагать нечего» + подсказка «нормально, ничего не делать».

**Р-9. Контракты типов — как в волне S.** Типы ответов объявляет Core-сервис, панель дублирует
интерфейсы в `apps/cc/src/lib/core.ts` (существующая практика; общий пакет типов — отдельный срез).
Исключение — словарь причин (Р-8) и `SkipReason`: они в `@mydon/shared`, потому что нужны трём
приложениям.

## 4. Требования

### 4.1 R-R-1 Журнал прогонов

Таблица `agent_run` (миграция `0088_agent_run.sql`):

```sql
CREATE TABLE "agent_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_name" text NOT NULL,          -- имя агента или "system" для мониторов
  "skill" text NOT NULL,               -- навык или имя монитора (ourvend:sync)
  "trigger" text NOT NULL,             -- cron | task | manual
  "cron" text,                         -- выражение, если trigger = cron (и для task из agent-schedule)
  "scheduled_at" timestamptz,          -- плановый occurrence (cron/agent-schedule), NULL для назначенных задач
  "request_key" text NOT NULL UNIQUE,  -- идемпотентность (реплики/повторы)
  "trace_key" text,
  "task_id" uuid REFERENCES "task"("id") ON DELETE SET NULL,
  "approval_id" uuid REFERENCES "approval"("id") ON DELETE SET NULL,
  "started_at" timestamptz NOT NULL,
  "finished_at" timestamptz NOT NULL,
  "outcome" text NOT NULL,             -- approval_requested | executed | skipped | failed
  "skip_reason" text,                  -- SkipReason | hook_blocked
  "hook" text,                         -- kind заблокировавшего pre_run-хука
  "reason" text NOT NULL,              -- человеческая причина (RunResult.reason / текст ошибки)
  "action" text,                       -- заголовок предложения, если было
  "review" text,                       -- заметка coach_lite (post_run)
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "agent_run_agent_skill_idx" ON "agent_run" ("agent_name","skill","started_at" DESC);
CREATE INDEX "agent_run_started_idx" ON "agent_run" ("started_at" DESC);
CREATE INDEX "agent_run_task_idx" ON "agent_run" ("task_id") WHERE "task_id" IS NOT NULL;
```

Таблица `agent_runtime_snapshot` (та же миграция):

```sql
CREATE TABLE "agent_runtime_snapshot" (
  "key" text PRIMARY KEY,              -- "schedules"
  "payload" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
```

`POST /routines/runs` (сервисный токен, как все записи рантайма), тело = `ReportRunInput`:

```ts
interface ReportRunInput {
  agentName: string; skill: string;
  trigger: "cron" | "task" | "manual";
  cron?: string; scheduledAt?: string;          // ISO
  requestKey: string; traceKey?: string;
  taskId?: string; approvalId?: string;
  startedAt: string; finishedAt: string;         // ISO, finishedAt ≥ startedAt
  outcome: "approval_requested" | "executed" | "skipped" | "failed";
  skipReason?: SkipReason | "hook_blocked"; hook?: string;
  reason: string;                                // ≤ 2000 символов, Core обрезает
  action?: string; review?: string;
}
```

Ответ `{ id, created: boolean }`. Повтор с тем же `requestKey` — upsert полей исхода (`finished_at`,
`outcome`, `skip_reason`, `hook`, `reason`, `action`, `review`, `approval_id`, `task_id`), `created: false`.
Валидация: `outcome ∉` списка → 400; `skipReason` задан при `outcome ≠ skipped` → 400; `finishedAt <
startedAt` → 400; `taskId`/`approvalId` не uuid → 400.

Рантайм: `reportRun(core, entry)` в `apps/agents/src/run-journal.ts` — оборачивает `core.reportRun` в
try/catch с `console.warn("[journal] …")`. Точки вызова: (а) cron-колбэк legacy в `index.ts` — после
`runSkill` и в `catch` (`outcome: failed`, `reason` = сообщение ошибки); (б) `task-worker.ts` — после
`commitAgentTaskOutcome`/пропуска: `trigger: "cron"` для задач из `agent-schedule` (плановый occurrence),
`"task"` для назначенных владельцем, `"manual"` для деки; `taskId`, `scheduledAt = task.due` и `cron` из
описания задачи только если `task.source = agent-schedule` (описание содержит строку `Cron: <expr>`;
парсим её, иначе `cron` пуст); (в) `journaledMonitor` (R-R-6); (г) ручной запуск с деки — это задача
(волна S создаёт task) → путь (б) с `trigger: "manual"` когда `task.source` = источник деки
(`SKILLS_DECK_SOURCE = "skills-deck"` из `agents.service.ts`; рантайм сравнивает строку `task.source`).

`GET /routines/runs?agent=&skill=&outcome=&limit=` — список (новые первыми, `limit` ≤ 200, дефолт 50);
`GET /routines/runs/last?agent=&skill=` — `{ run: AgentRun | null }` (для хука `source_fresh` и деки).

Все маршруты волны живут под префиксом `/routines/*` в новом модуле `apps/core/src/routines/`: у
`AgentsController` есть `GET /agents/:name`, и любой новый `GET /agents/<слово>` пришлось бы ставить выше
него по порядку объявления (так уже сделано для `skills`) — отдельный префикс снимает риск затенения.
Пути панели при этом остаются `/crons` и `/flows`.

### 4.2 R-R-2 Снимок расписаний

`PUT /routines/snapshot`, тело `ScheduleSnapshot`:

```ts
interface ScheduleSnapshot {
  generatedAt: string; tz: "Asia/Tashkent";
  paused: { schedules: boolean; tasks: boolean };
  jobs: { agent: string; skill: string; cron: string; mode: "durable-task" | "legacy" }[];
  notWired: { agent: string; skill: string; reason: "no_implementation" | "llm_route_off" }[];
  monitors: { name: string; cron: string; enabled: boolean; reason?: string }[]; // reason: "off" | "no_credentials"
}
```

Ответ `{ storedAt }`. Core валидирует cron-выражения croner'ом (битое → 400 с именем задания: рантайм не
должен был его принять). Рантайм пушит в конце `reconcileSchedules()` и один раз после заведения
мониторов (мониторы известны только после старта); падение пуша — `console.warn`, не влияет на
расписания. Так как `reconcileSchedules()` при паузе гасит задания, снимок при паузе всё равно содержит
`jobs` из `desiredJobs` (что запустилось бы) с `paused.schedules = true` — доска показывает их серыми.

### 4.3 R-R-3 Доска `/crons` и виджет

`GET /routines/board` (сервисный токен) → `CronBoard`:

```ts
interface CronBoardJob {
  id: string;                              // `${agent}/${skill}` или `system/${name}`
  kind: "skill" | "monitor";
  agent: string; skill: string; cron: string;
  mode: "durable-task" | "legacy" | "monitor";
  enabled: boolean;                        // false: not wired / off / no credentials
  disabledReason?: string;                 // человекочитаемо (словарь в Core)
  paused: boolean;                         // paused.schedules для skill; мониторы паузе не подчиняются → false
  nextRun: string | null;                  // ISO, croner по TZ; null если disabled
  last: null | { at: string; outcome: string; skipReason?: string; hook?: string; reason: string; runId: string };
}
interface CronBoard {
  tz: "Asia/Tashkent"; now: string;
  snapshot: { generatedAt: string; ageSec: number; stale: boolean } | null;  // stale: ageSec > 900
  paused: { schedules: boolean; tasks: boolean };   // из system_config (истина панели), не из снимка
  jobs: CronBoardJob[];                             // отсортированы по nextRun asc, disabled — в конце
  upcoming24h: { at: string; jobId: string }[];     // все occurrences в [now, now+24h], включая повторные (*/3)
}
```

`upcoming24h` считается croner'ом итерацией `nextRun` от `now`, максимум 200 записей суммарно
(защита от `* * * * *`), для `enabled && !paused` заданий; мониторы — всегда, если `enabled`.
`last` — последняя строка `agent_run` по `(agent_name, skill)` (`DISTINCT ON`).

Панель `/crons` (серверный компонент, `ConsoleTheme`, пункт «Рутины» в группе SYSTEM `nav.tsx`, иконка
`clock` — добавить в `icons.tsx`, если нет):

1. Шапка: `now` по Ташкенту, снимок «от HH:MM» (при `stale` — `.chip h` «агенты не отчитывались N мин»),
   при `snapshot === null` — пустое состояние «Агенты ещё не отчитались о расписаниях — перезапусти
   контейнер агентов».
2. `PauseToggles` (клиентский): два переключателя на `saveSystemConfig("AGENTS_SCHEDULES_PAUSED" | "AGENTS_TASKS_PAUSED", "0" | "1")`
   с текстом последствий из `config-spec.help`; после сохранения — «применится в течение 10 минут».
3. «Ближайшие 24 ч»: список `upcoming24h`, группировка «сегодня / завтра», строка: время `HH:MM` ·
   агент/навык (или монитор) · чип режима · последний исход (`RUN_SKIP_REASONS.label`). Строка —
   ссылка на `/flows?agent=…&skill=…`.
4. «Все расписания»: таблица `jobs` (в т.ч. disabled с `disabledReason`, paused серые), колонки: задание,
   cron, режим, следующий запуск, последний исход (время + причина + `.led` цветом:
   executed зелёный, approval_requested жёлтый, skipped серый, failed красный), ссылка на плейбэк.

Чистые функции в `apps/cc/src/lib/crons.ts` (тесты vitest): `groupUpcoming(board, now)` → `{ today, tomorrow }`,
`outcomeTone(last)` → `"ok" | "warn" | "muted" | "hot"`, `describeLast(last)` (через `RUN_SKIP_REASONS`).

Виджет главной (`/mydon`): блок «Ближайшие 24 ч» под тревогами — первые 5 записей `upcoming24h`
(время · задание · последний исход) и ссылка «все рутины → /crons»; данные через
`core.cronBoard()` в try/catch — при ошибке блок не рисуется, страница живёт.

### 4.4 R-R-4 Хуки

Паспорт (`config.yaml`), необязательный раздел:

```yaml
hooks:
  pre_run:
    - kind: source_fresh          # источник свежий: последний executed-прогон задания не старше N часов
      run: system/ourvend:sync    # `${agent}/${skill}` из журнала (мониторы — system/<name>)
      max_age_hours: 6
    - kind: quiet_hours           # не запускать ночью (Ташкент)
      from: "22:00"
      to: "07:00"
  post_run:
    - kind: coach_lite            # заметка-подсказка по серии прогонов (без LLM)
```

Реестр `apps/agents/src/hooks.ts`:

```ts
type PreRunHook = { kind: "source_fresh"; run: string; maxAgeHours: number } | { kind: "quiet_hours"; from: string; to: string };
type PostRunHook = { kind: "coach_lite" };
interface HookVerdict { ok: true } | { ok: false; hook: string; reason: string }
runPreRunHooks(agent, skill, core, now): Promise<HookVerdict>      // первый провал останавливает
runPostRunHooks(agent, skill, result, core): Promise<{ review?: string }> // ошибки → warn, не бросает
parseHooks(raw: unknown): { preRun: PreRunHook[]; postRun: PostRunHook[]; problems: string[] } // registry.ts
```

Семантика:
- `source_fresh`: `GET /routines/runs/last?agent=system&skill=ourvend:sync`; нет прогона или
  `outcome ≠ executed` или `finished_at` старше `max_age_hours` → блок с причиной «источник
  `system/ourvend:sync` не обновлялся N ч (порог M)». Ошибка Core → блок («журнал недоступен —
  свежесть не подтверждена»): ложный пропуск дешевле ложного действия на протухших данных.
- `quiet_hours`: интервал по Ташкенту, допускает переход через полночь; попадание → блок «тихие часы
  22:00–07:00». Как и все pre_run — только для `trigger: cron` (см. область pre_run ниже).
- `hook_blocked` — новое значение `skipReason` в `RunResult` и в `@mydon/shared` `SkipReason`; `RunResult.hook`.
  **Область pre_run (ruling 06.09):** pre_run-хуки проверяются только у запусков по расписанию —
  `trigger === "cron"` (legacy-колбэк и durable-задача из `agent-schedule`); `task` (поручено владельцем) и
  `manual` (дека) идут мимо pre_run: владелец попросил сам. Отсутствующий trigger считается `cron`
  (консервативно). В task-режиме с уже сохранённым checkpoint (takeover оплаченной работы) pre_run тоже
  не выполняется — хуки стерегут *старт* прогона, а не возобновление.
  Блок в task-режиме (то есть только durable occurrence из `agent-schedule`): рантайм сначала сохраняет
  checkpoint `{ kind: "no_signal" }` (как штатная ветка «повода нет»), затем коммитит `no_signal` с note =
  причина хука — Core закрывает occurrence честно, без 409 (Core не знает kind `hook_blocked`; расширение
  `commitPayload` — вне среза), а журнал (`agent_run`) хранит настоящий `hook_blocked` + `hook`.
- `coach_lite`: `GET /routines/runs?agent=&skill=&limit=6` (включая текущий), правила →
  строка `review` или ничего:
  - 3 последних `skipped:llm_failed|llm_invalid_output` подряд → «LLM-маршрут падает N прогонов подряд —
    проверь ключ/модель в /system»;
  - 5 последних `skipped:no_signal` подряд → «пять тихих прогонов подряд — расписание можно проредить»;
  - 3 последних `approval_requested` подряд → «три предложения подряд ждут решения — владелец не отвечает
    или предложение повторяется»;
  - последний `failed` дважды подряд → «сбой второй раз подряд: <reason>».
  `review` пишется в журнал (поле `review` в `ReportRunInput`) — поэтому `runPostRunHooks` вызывается
  **до** `reportRun`, а его GET видит прошлые прогоны (текущего ещё нет — правила считают «последние»
  как прошлые + текущий результат).
- Встроенные проверки (не хуки, документируются в `docs/AGENTS.md` как «что проверяется всегда»): пауза
  (`schedulesPaused`), статус агента, бюджет (`budget_denied`), потолок действий (`capped`), дельта-память
  (`no_change`), LLM-ledger.
- `check:passports` (`apps/agents/src/check-passports.ts`; мини-парсер YAML не знает вложенных списков —
  `hooks` читать через `parseYaml` из пакета `yaml`, он уже зависимость, и общий `parseHooks`): неизвестный `kind`, `max_age_hours ≤ 0`, `run`
  не вида `a/b`, `from/to` не `HH:MM` → problem; `hooks` попадает в паспорт (`toPassport`) и в карточку
  Core (`agent.hooks` jsonb — **новый столбец** в той же миграции 0088, `DEFAULT '{}'`), чтобы `/agents`
  показывал хуки в карточке (только чтение в этой волне).

### 4.5 R-R-5 Плейбэк `/flows`

`GET /routines/flows?agent=&skill=&outcome=&limit=` → `{ runs: FlowSummary[] }` (обёртка над `agent_run`, `limit` ≤ 200):

```ts
interface FlowSummary { id; agent; skill; trigger; startedAt; finishedAt; outcome; skipReason?; hook?; reason; action?; taskId?; approvalId? }
```

`GET /routines/flows/:id` → `FlowPlayback`:

```ts
type PhaseState = "ok" | "warn" | "fail" | "skip";
interface FlowPhase { name: "trigger" | "skill" | "proposal" | "approval" | "execution" | "delivery"; state: PhaseState; at?: string; title: string; note?: string; href?: string }
interface FlowPlayback {
  run: FlowSummary & { cron?: string; scheduledAt?: string; review?: string; requestKey: string };
  phases: FlowPhase[];                   // ровно 6, в этом порядке
  events: { at: string; type: string; payload: unknown }[];       // event в окне прогона, source agent:<name>
  audit: { at: string; action: string; actorRef?: string; target?: string }[];  // target ∈ {taskId, approvalId}
}
```

Правила фаз:
- `trigger`: `ok`; title «cron `0 8 * * *` · план 08:00» / «задача <id8>» / «вручную с деки»; `at = scheduledAt ?? startedAt`.
- `skill`: `ok` если навык есть в `agent_skill_catalog` (title «monitor-stock · code · T1»), иначе `warn`
  «навык не в каталоге»; для мониторов — `ok` «системный монитор».
- `proposal`: `ok` при `action` (title = action), `skip` при `skipped` (note = `RUN_SKIP_REASONS[skipReason].label`,
  при `hook_blocked` — «хук <hook>: <reason>»), `fail` при `failed` (note = reason).
- `approval`: по `approval_id` (или execution.approval_id): `pending` → `warn` «ждёт решения с HH:MM»,
  `approved` → `ok`, `rejected` → `fail`; нет согласования: `executed` → `skip` «без согласования (T0/T1)»,
  иначе `skip`. `href = /inbox` при pending.
- `execution`: task-режим — `task_agent_execution.status` (`committed` → `ok` с `committedAt`, `blocked` →
  `fail` с `abandon_reason`/`blocked_reason`, `ready|running` → `warn`), legacy — `executed` → `ok` «выполнено
  напрямую», иначе `skip`. `href = /tasks/<id>` если задача есть.
- `delivery`: `outbox_delivery` по execution: нет строк → `skip` «нет доставок»; все `delivered` → `ok`
  (title «notion-report ✓»), есть `pending|claimed` → `warn`, есть `failed|dead` → `fail` с `last_error`.

Панель `/flows` (`ConsoleTheme`, пункт «Прогоны» в SYSTEM): слева/сверху список (фильтры `agent`, `skill`,
`outcome` из query, по умолчанию 50 последних), справа/снизу плейбэк выбранного `?run=<id>` — полоса
фаз (донор: `.flight` → шесть `.ph` с состоянием и временем), под ней карточка причины (`reason`, `review`),
затем таймлайн `events` + `audit` одной лентой по времени. На телефоне — список, затем плейбэк
(как `.docs-layout.reading`). Клиентский JS не нужен (ссылки с query). Чистые функции
`apps/cc/src/lib/flows.ts` (тесты): `mergeTimeline(events, audit)`, `phaseTone(state)`.

### 4.6 R-R-6 Мониторы под журналом

`journaledMonitor(name, cron, core, fn: () => Promise<string>)` в `apps/agents/src/monitors.ts`: возвращает
колбэк для `new Cron`; `requestKey = monitor:<name>:<cron>:<ISO occurrence>` (occurrence — как у навыков:
`expectedOccurrence`/`currentRun`); внутри `try { reason = await fn() } catch { outcome = failed }`,
затем `reportRun` и прежний `console.log/error`. Шесть колбэков в `index.ts` переводятся на него;
каждый возвращает свою итоговую строку (та, что сейчас логируется). Снимок (`monitors[]`) заполняется из
того же места: `enabled=false, reason="off"` при `off`, `reason="no_credentials"` для ourvend без учётки.

### 4.7 R-R-7 Аудит репо (dev-контур)

`tools/repo-audit.mjs` (Node 22, только чтение): собирает
- ветки старше 30 дней без мержа (`git for-each-ref --sort=committerdate refs/remotes/origin`), worktrees;
- untracked-файлы (счёт, первые 10 путей);
- спеки `docs/superpowers/specs/*` без файла решения `docs/decisions/<та же дата>-*` того же slug;
- планы `docs/superpowers/plans/*` без леджера `.superpowers/sdd/<basename>/progress.md` с `complete`;
- миграции `packages/db/drizzle/*.sql` не из `meta/_journal.json`;
- `pnpm --filter @mydon/agents check:passports` (вывод, код возврата);
- `memory/open-questions.md`: вопросы старше 60 дней (по датам заголовков `## YYYY-MM-DD`).
Пишет секцию `## Аудит репо YYYY-MM-DD` в `memory/open-questions.md` (заменяет секцию той же даты, не
дублирует) и печатает её в stdout; `--dry-run` — только stdout. Формат секции — чистая функция
`renderAudit(findings)` (тест `tools/repo-audit.test.mjs` на фикстуре findings).
`.claude/skills/repo-audit/SKILL.md`: когда запускать, команда, как поставить недельный scheduled task в
Claude Code (`/schedule` — понедельник 09:00 Asia/Tashkent, промпт «/repo-audit») — планирует владелец.

### 4.8 R-R-8 Проверки

- Тесты: Core (`node:test` из `dist`): `runs.service` (upsert по requestKey, валидация), `crons.service`
  (`nextRun`/`upcoming24h` на фиксированном `now`, лимит 200, stale), `flows.service` (фазы на
  фикстурах: legacy executed / task approval pending / hook_blocked / failed / monitor); Agents: `hooks`
  (парсинг, quiet_hours через полночь, source_fresh при отсутствии/старом/ошибке, coach_lite правила),
  `run-journal` (не бросает), `schedule snapshot` сборка; cc: `crons.ts`, `flows.ts`, страницы
  `/crons` и `/flows` (render с фикстурой, пустые состояния), виджет главной при ошибке `cronBoard`.
- `tools/smoke-core.mjs`: сценарий `проверитьРутины`: `PUT /routines/snapshot` (2 задания + 1 монитор) →
  `GET /routines/board` содержит их с `nextRun`; `POST /routines/runs` (skipped:no_signal) → `board.last`
  заполнен → `GET /routines/flows/:id` фазы: trigger ok, proposal skip, approval skip; повтор `POST` с тем
  же `requestKey` → `created: false`; анонимный `GET /routines/board` → 401.
- `check:passports` — паспорт `_template` получает закомментированный пример `hooks`.
- Гейт: `pnpm -r build && pnpm -r test && pnpm -r lint && pnpm -r typecheck && pnpm --filter @mydon/agents check:passports`,
  `gh workflow run ci.yml --ref feat/wave-r-crons-flows`.

### 4.9 R-R-9 Документация

- `docs/AGENTS.md`: разделы «Доска рутин `/crons`», «Плейбэк `/flows`», «Хуки паспорта» (kinds,
  семантика, встроенные проверки), «Журнал прогонов» (что пишется, идемпотентность).
- `docs/AGENTIC_OS_ARMS_PLAN.md` §6.3 — статус «сделано» с датой; §9 строка R — ссылка на доску.
- `docs/FIRST_LOGIN_CHECKLIST.md`: «поставить недельный аудит репо», «снять `AGENTS_SCHEDULES_PAUSED` с
  доски `/crons`, когда готов».
- `docs/decisions/2026-09-06-wave-r-crons-flows.md` — Р-1…Р-9.
- `memory/session-log/2026-09-06-wave-r-crons-flows.md` — handoff.

## 5. Поток данных

```
config.yaml (schedule, hooks) ──seed──▶ agent (Core)          system_config (паузы) ◀── /crons, /system
       │                                                          │
  registry.ts ─▶ desiredJobs ─▶ reconcileSchedules ─▶ croner ── PUT /routines/snapshot ─▶ agent_runtime_snapshot
                                                 │                                                     │
                                          cron tick ─▶ pre_run hooks ─▶ runSkill ─▶ post_run ─▶ POST /routines/runs ─▶ agent_run
                                          monitors  ─▶ journaledMonitor ─────────────────────────────▶ agent_run
                                                                                                        │
                                                            GET /routines/board ◀── croner(nextRun) + snapshot + last(agent_run)
                                                            GET /routines/flows/:id ◀── agent_run + task/execution/approval/outbox/event/audit
```

## 6. Безопасность и ограничения

- Все новые маршруты — за сервисным токеном на КАЖДЫЙ метод, включая GET: класс-гард `RoutinesTokenGuard` (копия
  `DocsTokenGuard`), потому что глобальный `ServiceTokenGuard` пропускает GET/HEAD/OPTIONS без токена (ruling ревью
  06.09); тумблеры паузы — существующий
  `PUT /system/config` (его гард не меняем).
- `reason` и `action` из рантайма — свободный текст, панель рендерит как текст (без HTML); длина
  режется в Core (2000 / 500 символов).
- Журнал и снимок — best effort в рантайме: любая ошибка записи логируется и не влияет на прогон.
- Идемпотентность: `request_key` уникален; дубль тика на двух репликах даёт одну строку.
- Плейбэк не пишет ничего; окно событий ±1 с — эвристика, помечена в UI как «события в окне прогона».

## 7. Вне среза

Per-job пауза; cron мониторов в system_config; Telegram-алерты о сбоях (нет моста); LLM-«коуч» по
прогонам (есть `coach-review` как навык); реестр «виденного» фабрики (навык Claude Code); расширение
`commitPayload` Core новым kind `hook_blocked`; бот «что запустится» (словарь причин уже общий — подключить
в следующей волне); общий пакет типов API.

## 8. Приёмка на проде

1. `GET /routines/board` (сервисный токен) → `snapshot.stale=false`, `jobs` содержит 6 мониторов (ourvend-пара
   `enabled` по наличию учётки) и задания активных агентов; `paused.schedules` совпадает с `/system`.
2. Дождаться тика `ourvend:sync` (каждые 3 ч) или `fx:refresh` → `GET /routines/runs?agent=system` содержит
   строку; `/flows?run=<id>` — 6 фаз, `trigger ok`, `execution ok/fail`.
3. `/crons`, `/flows`, `/mydon` → 200; на `/mydon` есть блок «Ближайшие 24 ч».
4. Анонимный `GET /routines/board` → 401; `POST /routines/runs` с битым `outcome` → 400.
