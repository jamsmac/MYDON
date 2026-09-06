# 2026-09-06 · Волна R — доска рутин, хуки паспорта, плейбэк прогона

## Активный контекст

Ветка `feat/wave-r-crons-flows` (от `main`), HEAD — `15222b6` (задача 8, полный гейт зелёный:
build/test/lint/typecheck/passports — 0, `apps/cc` 529/529). Спека
`docs/superpowers/specs/2026-09-06-wave-r-crons-flows-design.md` (решения Р-1…Р-9 в §3, требования
R-R-1…R-R-9 в §4, приёмка на проде §8), план `docs/superpowers/plans/2026-09-06-wave-r-crons-flows.md`,
журнал среза — `.superpowers/sdd/2026-09-06-wave-r-crons-flows/`. Решения с причинами —
`docs/decisions/2026-09-06-wave-r-crons-flows.md` (Р-1…Р-9 из спеки + три ruling, родившихся в
ревью), строка в `docs/AGENTIC_OS_ARMS_PLAN.md` §6.3/§9. Это волна R плана ARMS сразу после закрытия
волны M (06.09) — журнал прогонов и рутины поверх памяти/документов, которые дала волна M.

Десять задач по плану, коммиты по порядку (`git log main..feat/wave-r-crons-flows`):
`905ac5c`/`6b1b8a7` спека+план · `7fd100a` T1 словарь исходов (`@mydon/shared`) · `ad8319c` T2
миграция `0088_agent_run` · `43b5869`→`000d797` T3 модуль `routines` в Core (upsert журнала, доска,
токен на GET) · `a57970b`→`2d28350` T5 журнал и снимок в рантайме агентов, мониторы под журналом ·
`f850089` T4 доска (`/routines/board`) и плейбэк (`/routines/flows`) в Core · `dcbf064`→`6577e47` T6
хуки паспорта (`source_fresh`/`quiet_hours`/`coach_lite`) · `d9a7141`→`2f1ff08` T7 панель `/crons` ·
`cfa9339`→`12c578f` T9 смоук + `tools/repo-audit.mjs` + навык `repo-audit` · `15222b6` T8 панель
`/flows`. **T10 (этот коммит):** документация, решения, чек-лист, план ARMS, handoff.

## Сделано

- **Журнал прогонов** (Р-1): таблица `agent_run` + `agent_runtime_snapshot`
  (`packages/db/drizzle/0088_agent_run.sql`), плюс `agent.hooks` jsonb в той же миграции. Пишет
  рантайм (`apps/agents/src/run-journal.ts`, `reportRun` — best effort, никогда не бросает), а не
  Core: одна точка записи для legacy cron-колбэка, task-режима и мониторов. `POST /routines/runs`
  идемпотентен по `request_key` (`created: false` на повтор).
- **Снимок расписаний** (Р-2): `PUT /routines/snapshot` из `apps/agents/src/schedule-snapshot.ts`
  (`buildScheduleSnapshot` — терпит порчу одного задания, не роняет весь снимок). Core хранит одну
  строку и сам считает `nextRun` через `croner`; возраст снимка старше 900 с (15 мин) — «агенты не
  отчитывались» (`STALE_AFTER_SEC`, `apps/core/src/routines/board.ts`).
- **Мониторы под журналом** (Р-3, R-R-6): шесть env-cron мониторов переведены на `scheduleMonitor`/
  `journaledMonitor` (`apps/agents/src/monitors.ts`) — журналируются как `agent_name="system"`.
- **Хуки паспорта** (Р-4, R-R-4): `apps/agents/src/hooks.ts` — `parseHooks` (реестр по `kind`,
  неизвестный `pre_run` → `unknown`/блок), `runPreRunHooks`/`runPostRunHooks`, `coachLite` (правила
  без LLM), `inQuietHours` (Ташкент, переход через полночь). Kinds: `source_fresh`, `quiet_hours`
  (pre), `coach_lite` (post). `check:passports` читает `hooks:` настоящим `parseYaml`
  (`apps/agents/src/check-passports.ts`); `apps/agents/agents/_template/config.yaml` получил закомментированный
  пример.
- **Доска `/crons`** (R-R-3): `apps/core/src/routines/board.ts` (`computeBoard`, `nextOccurrences`,
  `UPCOMING_LIMIT=200`) + `apps/cc/src/app/crons/page.tsx` — снимок, тумблеры паузы (компонент
  `PauseToggles`, переиспользован с `/system`), «Ближайшие 24 ч» (группировка сегодня/завтра), «Все
  расписания» (таблица заданий с последним исходом и ссылкой на плейбэк). Виджет «Ближайшие 24 ч» на
  `/mydon` — `core.cronBoard()` в `try/catch`.
- **Плейбэк `/flows`** (Р-5, R-R-5): `apps/core/src/routines/flows.ts` (`buildPhases`,
  `mergeContextless`) — ровно шесть фаз `trigger → skill → proposal → approval → execution →
  delivery`, каждая `ok/warn/fail/skip`, из `agent_run` + существующих таблиц (без новых столбцов).
  `apps/cc/src/app/flows/page.tsx` — список с фильтрами + полоса фаз + лента событий/аудита.
- **Тумблеры паузы** (Р-6): существующие `AGENTS_SCHEDULES_PAUSED`/`AGENTS_TASKS_PAUSED`, без
  per-job паузы — отключить одно задание можно, убрав строку `schedule:` из паспорта.
- **Аудит репо** (Р-7, R-R-7): `tools/repo-audit.mjs` (только чтение, `collectFindings`/
  `renderAudit`/`upsertSection`, `--dry-run`) + `.claude/skills/repo-audit/SKILL.md` (недельное
  расписание — на владельце, `/schedule` в Claude Code). Прогнан этой задачей (`--dry-run`,
  read-only, ничего не изменил): **21 спека без записанного решения (22 до записи решения этой волны), 16 планов без леджера** — см.
  «Ожидает» ниже.
- **Словарь причин** (Р-8): `packages/shared/src/agent-runs.ts` — `RUN_OUTCOMES`, `SKIP_REASONS` (12
  значений, включая `hook_blocked`), `RUN_TRIGGERS`, `RUN_SKIP_REASONS` (label/hint), `describeRun`.
- **GET `/routines/*` — за сервисным токеном** (ruling ревью T3): класс-гард `RoutinesTokenGuard`
  (копия `DocsTokenGuard`) на всём контроллере, включая чтение; панель ходит через `getWithToken`.
- **Триггер `agent-schedule` = `"cron"`** (ruling ревью T5, спека §4.1(б) поправлена): плановая
  durable-задача журналируется как `trigger: "cron"`, не `"task"` — так `quiet_hours` и подпись фазы
  «Триггер» единообразны для legacy- и durable-пути одного расписания (`triggerFromTaskSource`,
  `apps/agents/src/task-worker.ts`).
- **Область `pre_run` — только `trigger === "cron"`, не на takeover** (ruling ревью T6, спека §4.4
  поправлена): `preRunApplies` в `apps/agents/src/runner.ts`; блок в task-режиме сохраняет checkpoint
  `no_signal`, затем коммитит его — Core не знает kind `hook_blocked`, журнал (`agent_run`) хранит
  точный исход.
- **Смоук** (эта задача видит T9): сценарий `проверитьРутины()` в `tools/smoke-core.mjs` (24-й по
  счёту в списке вызовов сценариев, живой Postgres 15) и `tools/smoke-panel.mjs` (`/crons`, `/flows`
  по словам из тела страницы, не из nav — «Расписания cron» вместо ссылки).
- **Документы** (эта задача, T10): `docs/AGENTS_ACTIVATION.md` — новый раздел «Рутины: доска
  `/crons`, плейбэк `/flows`, хуки паспорта» (`docs/AGENTS.md` в репозитории по-прежнему нет — см.
  «Урок» ниже, продолжен файл, куда руководство уже переносили дважды раньше).
  `docs/AGENTIC_OS_ARMS_PLAN.md` §6.3 — все пять пунктов помечены «СДЕЛАНО 06.09.2026», §9 — новая
  запись. `docs/FIRST_LOGIN_CHECKLIST.md` — раздел 7 (снять паузу расписаний, поставить `/repo-audit`,
  проверить свежесть снимка после рестарта). `docs/decisions/2026-09-06-wave-r-crons-flows.md` —
  Р-1…Р-9 + три ruling. `apps/agents/shared/kb/protocol/run-log.md` — одна строка-примечание:
  журнал прогонов НАВЫКОВ этой волны (`agent_run`, `/flows`) — отдельный, более узкий контракт, чем
  семифазный run-log.v1.0 этого файла (запуск АГЕНТА Claude Code); строка не утверждает, что один
  заменяет другой.

## Урок

**Спека планировала правку `docs/AGENTS.md` третий раз подряд, хотя этого файла в репозитории нет.**
Проверено (`find`, `grep`): единственный `AGENTS.md` — симлинк в корне репозитория на `CLAUDE.md`
(роутер для Codex), а не runbook в `docs/`. Две предыдущие волны (`docs/superpowers/specs/
2026-08-26-p7-tasks-design.md` и `docs/superpowers/plans/2026-08-26-sloy-gigiena.md`) уже находили
это же расхождение и явно перенаправляли документацию в `docs/AGENTS_ACTIVATION.md` — реальный дом
всех разделов «крон/петля X делает Y, тумблер Z». Спека и план волны R написаны заново по старому
шаблону и не унаследовали этот факт. Раздел волны R добавлен в `docs/AGENTS_ACTIVATION.md`, третий
раз подряд по тому же прецеденту; `docs/AGENTS.md` не создан — заводить его сейчас значило бы
разъехаться источником истины с двумя предыдущими волнами, которые уже выбрали `AGENTS_ACTIVATION.md`.

## Что НЕ сделано (сознательно, не в этом срезе)

- **Per-job пауза расписания** (Р-6) — вне среза, см. решение.
- **Cron мониторов в `system_config`** (Р-3) — остаётся в `.env`.
- **Telegram-алерты о сбоях прогона** — моста в `outbox_delivery` для Telegram нет.
- **Расширение `commitPayload` Core новым kind `hook_blocked`** — блок в task-режиме коммитится как
  `no_signal` с причиной в примечании (ruling волны R).
- **Общий пакет типов API** между Core/Agents/CC (Р-9) — панель продолжает дублировать интерфейсы в
  `apps/cc/src/lib/core.ts`, как и в волне S.

## Как проверить на проде (приёмка §8 спеки)

1. `GET /routines/board` с сервисным токеном (`x-service-token`) → `snapshot.stale=false`, `jobs`
   содержит шесть мониторов (ourvend-пара `enabled` по наличию учётки `OURVEND_ACCOUNT/PASSWORD`) и
   задания активных агентов; `paused.schedules` совпадает с тумблером на `/system`.
2. Дождаться тика `ourvend:sync` (каждые 3 ч) или `fx:refresh` (09:05 Ташкент) →
   `GET /routines/runs?agent=system` содержит строку; `GET /routines/flows/<id>` — шесть фаз,
   `trigger ok`, `execution ok` (или `fail`, если реально был сбой).
3. `/crons`, `/flows`, `/mydon` → 200 (Tailscale-адрес); на `/mydon` есть блок «Ближайшие 24 ч».
4. Анонимный `GET /routines/board` (без `x-service-token`) → 401; `POST /routines/runs` с битым
   `outcome` → 400.
5. `/agents/<имя>` агента с хуками в паспорте (пока такого нет ни у одного из 12 карточек — раздел
   `hooks:` добавляется владельцем вручную) показывает блок «Хуки прогона».

## Откат

Предыдущий образ. Миграция `0088_agent_run.sql` добавляет две новые таблицы и один jsonb-столбец
(`agent.hooks`, `DEFAULT '{}'`) — обратима без потери данных других таблиц; откат кода безопасен без
отдельного `DROP`, если новый прогон уже что-то в них записал — эти строки просто перестанут читаться
до следующего деплоя вперёд. Хуки в паспортах по умолчанию пусты (`hooks: []` не заведён ни в одном
из 12 текущих агентов) — включение произойдёт только при явной правке `config.yaml`.

## Ожидает

- **Владелец:** смёржить PR после зелёного CI, проверить приёмку §8 на проде (раздел выше).
- **Владелец, решение:** снять `AGENTS_SCHEDULES_PAUSED` с доски `/crons`, когда сочтёт нужным
  (`docs/FIRST_LOGIN_CHECKLIST.md` п. 7).
- **Владелец, действие:** поставить `/repo-audit` на еженедельное расписание в Claude Code
  (`/schedule`, понедельник 09:00 Asia/Tashkent) — сам скрипт в репозитории готов и проверен.
- **Владелец, решение по находкам первого аудита** (06.09, `--dry-run`): 21 спека без записанного
  решения и 16 планов без леджера в `.superpowers/sdd/` — список путей в выводе
  `node tools/repo-audit.mjs --dry-run`; для каждой — либо `docs/decisions/<дата>-<slug>.md` с
  причиной, либо явная пометка «план брошен».
- Дальше по `docs/AGENTIC_OS_ARMS_PLAN.md`: волна A (приложения и командный центр — MCP-сервер,
  CLI, панель «Приложения», кольцо артефактов, `/mydon` из виджетов).
