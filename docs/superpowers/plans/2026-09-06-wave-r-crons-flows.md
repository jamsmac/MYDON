# Волна R — рутины: доска, хуки, плейбэк — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Владелец с телефона видит, что запустится в ближайшие 24 ч (`/crons`) и почему навык промолчал (`/flows`), без SSH.

**Architecture:** Рантайм агентов после каждого прогона (cron, задача, монитор) пишет строку в новую таблицу `agent_run` через `POST /routines/runs` и пушит снимок расписаний в `PUT /routines/snapshot`; Core считает «следующий запуск» croner'ом и собирает доску (`GET /routines/board`) и плейбэк (`GET /routines/flows/:id`) из журнала + существующих таблиц (task/execution/approval/outbox/event/audit); панель рисует `/crons`, `/flows` и виджет на главной. Хуки паспорта (`hooks.pre_run/post_run`) — декларативные, реестр реализаций в `apps/agents/src/hooks.ts`, обёртка вокруг `runSkill`.

**Tech Stack:** NestJS 11 + Drizzle (Core), node:test из `dist` (Core/Agents), croner 9, Next.js 16 / React 19 / vitest (панель), `yaml` (паспорта), Node 22 (`tools/`).

**Spec:** `docs/superpowers/specs/2026-09-06-wave-r-crons-flows-design.md` (R-R-1…R-R-9, решения Р-1…Р-9).

## Global Constraints

- TypeScript strict, `exactOptionalPropertyTypes: true`, никакого `any`; UI по-русски, код/идентификаторы по-английски.
- Все новые маршруты Core — под префиксом `/routines/*`, за глобальным `ServiceTokenGuard` (ничего не открывать анонимно).
- Журнал и снимок в рантайме — best effort: ошибка записи → `console.warn`, прогон/расписание не страдают (Р-1, Р-2).
- Идемпотентность журнала: `request_key` UNIQUE; повтор → upsert полей исхода, `created: false` (R-R-1).
- Неизвестный `kind` в `hooks.pre_run` → навык не запускается (`skipReason: "hook_blocked"`); неизвестный `post_run` → warn (Р-4).
- Все времена — `Asia/Tashkent` (`TZ` из `@mydon/shared`); `nextRun`/`upcoming24h` считает Core croner'ом; `upcoming24h` ≤ 200 записей; список прогонов `limit` ≤ 200 (дефолт 50).
- Лимиты текста в Core: `reason` ≤ 2000, `action` ≤ 500, `review` ≤ 1000 символов (обрезать, не отвергать).
- Миграция ровно одна: `packages/db/drizzle/0088_agent_run.sql` (+ `meta/0088_snapshot.json`, запись в `_journal.json`).
- Коммиты — Conventional Commits, трейлеры:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` и
  `Claude-Session: https://claude.ai/code/session_01NkuNnPz229PW2EbZ7E4YPa`.
- Гейт перед отчётом о задаче: сборка и тесты затронутых пакетов зелёные (`pnpm --filter <pkg> build && pnpm --filter <pkg> test`); Core/Agents тесты гоняются из `dist` — сначала `build`.

---

### Task 1: Общий словарь исходов и причин (`@mydon/shared`)

**Files:**
- Create: `packages/shared/src/agent-runs.ts`
- Create: `packages/shared/src/agent-runs.test.ts`
- Modify: `packages/shared/src/index.ts` (добавить `export * from "./agent-runs";` после блока `subscription-env`)

**Interfaces:**
- Produces: `RUN_OUTCOMES`, `RunOutcome`, `SKIP_REASONS`, `SkipReason`, `RUN_TRIGGERS`, `RunTrigger`, `RUN_OUTCOME_LABELS`, `RUN_SKIP_REASONS`, `describeRun()`. Их используют Core (валидация), рантайм (тип `RunResult.skipReason`) и панель (подписи).

- [ ] **Step 1: Написать падающий тест**

```ts
// packages/shared/src/agent-runs.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RUN_OUTCOMES,
  RUN_SKIP_REASONS,
  SKIP_REASONS,
  describeRun,
  isRunOutcome,
  isSkipReason,
} from "./agent-runs";

describe("Словарь исходов прогона (Р-8)", () => {
  it("каждая причина пропуска имеет подпись и подсказку по-русски", () => {
    for (const r of SKIP_REASONS) {
      const d = RUN_SKIP_REASONS[r];
      assert.ok(d.label.length > 0, r);
      assert.ok(d.hint.length > 0, r);
      assert.match(d.label, /[а-яё]/i, r);
    }
  });

  it("узнаёт свои значения и отвергает чужие", () => {
    assert.equal(isRunOutcome("executed"), true);
    assert.equal(isRunOutcome("done"), false);
    assert.equal(isSkipReason("hook_blocked"), true);
    assert.equal(isSkipReason("nope"), false);
    assert.deepEqual([...RUN_OUTCOMES], ["approval_requested", "executed", "skipped", "failed"]);
  });

  it("описывает прогон одной фразой", () => {
    assert.equal(describeRun({ outcome: "executed", reason: "курс обновлён" }), "выполнено — курс обновлён");
    assert.equal(
      describeRun({ outcome: "skipped", skipReason: "no_signal", reason: "повода нет" }),
      "пропущено: повода нет — повода нет",
    );
    assert.equal(
      describeRun({ outcome: "skipped", skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы 22:00–07:00" }),
      "остановлено хуком quiet_hours — тихие часы 22:00–07:00",
    );
    assert.equal(describeRun({ outcome: "failed", reason: "ECONNREFUSED" }), "сбой — ECONNREFUSED");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter @mydon/shared build 2>&1 | tail -3` — ожидание: ошибка «Cannot find module './agent-runs'».

- [ ] **Step 3: Реализация**

```ts
// packages/shared/src/agent-runs.ts
/**
 * Исходы прогонов навыков и мониторов (волна R, Р-8).
 *
 * Один словарь на три приложения: рантайм пишет значения в журнал `agent_run`,
 * Core их валидирует, панель показывает подписи. Так «навык промолчал»
 * превращается в понятную владельцу фразу с подсказкой, что делать.
 */
export const RUN_OUTCOMES = ["approval_requested", "executed", "skipped", "failed"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export const SKIP_REASONS = [
  "inactive",
  "not_implemented",
  "no_signal",
  "capped",
  "no_change",
  "budget_denied",
  "execution_unknown",
  "workflow_changed",
  "ledger_unavailable",
  "llm_failed",
  "llm_invalid_output",
  "hook_blocked",
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export const RUN_TRIGGERS = ["cron", "task", "manual"] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export function isRunOutcome(v: unknown): v is RunOutcome {
  return typeof v === "string" && (RUN_OUTCOMES as readonly string[]).includes(v);
}
export function isSkipReason(v: unknown): v is SkipReason {
  return typeof v === "string" && (SKIP_REASONS as readonly string[]).includes(v);
}

export const RUN_OUTCOME_LABELS: Record<RunOutcome, string> = {
  approval_requested: "предложение отправлено",
  executed: "выполнено",
  skipped: "пропущено",
  failed: "сбой",
};

/** Подпись причины и подсказка владельцу: что это значит и надо ли что-то делать. */
export const RUN_SKIP_REASONS: Record<SkipReason, { label: string; hint: string }> = {
  inactive: { label: "агент не активен", hint: "Статус агента не active — включи его в карточке или убери расписание." },
  not_implemented: { label: "навык не подключён", hint: "Нет кода в SKILLS и нет executor: llm — навык нечем исполнить." },
  no_signal: { label: "повода нет", hint: "По данным Core предлагать нечего. Это нормально — делать ничего не нужно." },
  capped: { label: "потолок действий", hint: "Дневной лимит действий агента исчерпан — продолжит завтра по Ташкенту." },
  no_change: { label: "без изменений", hint: "Повод тот же, что в прошлый раз — предложение не повторяется." },
  budget_denied: { label: "бюджет исчерпан", hint: "Дневной бюджет LLM агента кончился — подними лимит в карточке или подожди сутки." },
  execution_unknown: { label: "исход неизвестен", hint: "Провайдер не подтвердил результат — задача заблокирована до повтора владельцем." },
  workflow_changed: { label: "план изменился", hint: "Навык поменял workflow между попытками — нужен явный повтор." },
  ledger_unavailable: { label: "LLM-ledger недоступен", hint: "Платный вызов не сделан: Core не принял учёт трат. Проверь /system." },
  llm_failed: { label: "модель не ответила", hint: "Провайдер вернул ошибку — проверь ключ и маршрут в /system." },
  llm_invalid_output: { label: "ответ не по контракту", hint: "Модель ответила не в формате навыка — проверь промпт навыка." },
  hook_blocked: { label: "остановлено хуком", hint: "Сработал pre_run-хук паспорта (свежесть источника, тихие часы или неизвестный kind)." },
};

export interface RunDescription {
  outcome: RunOutcome;
  skipReason?: SkipReason | null;
  hook?: string | null;
  reason: string;
}

/** Одна фраза для строки доски/списка: «пропущено: повода нет — …». */
export function describeRun(r: RunDescription): string {
  if (r.outcome === "skipped") {
    if (r.skipReason === "hook_blocked") return `остановлено хуком ${r.hook ?? "?"} — ${r.reason}`;
    const label = r.skipReason ? RUN_SKIP_REASONS[r.skipReason].label : "причина не указана";
    return `пропущено: ${label} — ${r.reason}`;
  }
  return `${RUN_OUTCOME_LABELS[r.outcome]} — ${r.reason}`;
}
```

И в `packages/shared/src/index.ts` после экспорта `subscription-env`:

```ts
/** Исходы прогонов навыков/мониторов — словарь причин для доски рутин (волна R). */
export * from "./agent-runs";
```

- [ ] **Step 4: Прогнать**

Run: `pnpm --filter @mydon/shared build && pnpm --filter @mydon/shared test 2>&1 | tail -5` — ожидание: pass, fail 0.

- [ ] **Step 5: Коммит**

```bash
git add packages/shared/src/agent-runs.ts packages/shared/src/agent-runs.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): словарь исходов и причин прогонов агентов (волна R, Р-8)"
```

---

### Task 2: Схема и миграция 0088 — `agent_run`, `agent_runtime_snapshot`, `agent.hooks`

**Files:**
- Modify: `packages/db/src/schema.ts` (после `agentSkillCatalog`, ~строка 1695; столбец `hooks` в `agent` после `kbPages`, ~строка 1660)
- Create: `packages/db/drizzle/0088_agent_run.sql`
- Create: `packages/db/drizzle/meta/0088_snapshot.json` (генерирует drizzle-kit)
- Modify: `packages/db/drizzle/meta/_journal.json` (запись idx 88)
- Create: `packages/db/src/agent-run-schema.test.ts`

**Interfaces:**
- Produces: таблицы `agentRun`, `agentRuntimeSnapshot` (drizzle), столбец `agent.hooks` (jsonb, default `{}`). Типы строк: `typeof agentRun.$inferSelect`.

- [ ] **Step 1: Падающий тест на схему**

```ts
// packages/db/src/agent-run-schema.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { agent, agentRun, agentRuntimeSnapshot } from "./schema";

describe("Журнал прогонов и снимок расписаний (R-R-1, R-R-2)", () => {
  it("agent_run: ключ запроса уникален, исход и причина обязательны", () => {
    assert.equal(getTableName(agentRun), "agent_run");
    const c = getTableColumns(agentRun);
    assert.equal(c.requestKey.notNull, true);
    assert.equal(c.requestKey.isUnique, true);
    assert.equal(c.outcome.notNull, true);
    assert.equal(c.reason.notNull, true);
    assert.equal(c.startedAt.notNull, true);
    assert.equal(c.finishedAt.notNull, true);
    assert.equal(c.skipReason.notNull, false);
    assert.equal(c.taskId.notNull, false);
  });

  it("agent_runtime_snapshot: ключ + jsonb", () => {
    assert.equal(getTableName(agentRuntimeSnapshot), "agent_runtime_snapshot");
    const c = getTableColumns(agentRuntimeSnapshot);
    assert.equal(c.key.primary, true);
    assert.equal(c.payload.notNull, true);
  });

  it("agent.hooks — jsonb с дефолтом {}", () => {
    const c = getTableColumns(agent);
    assert.equal(c.hooks.notNull, true);
    assert.equal(c.hooks.hasDefault, true);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `pnpm --filter @mydon/db build 2>&1 | tail -3` — ожидание: `agentRun`/`agentRuntimeSnapshot` не экспортируются.

- [ ] **Step 3: Схема**

В `packages/db/src/schema.ts` в таблице `agent` после `kbPages`:

```ts
    /**
     * Хуки паспорта (волна R, R-R-4): { preRun: [{kind,…}], postRun: [{kind}] }.
     * Хранятся в карточке, потому что рантайм грузит агентов из базы (источник
     * истины), а не из файлов — без столбца хуки терялись бы после сида.
     */
    hooks: jsonb("hooks").$type<Record<string, unknown>>().default({}).notNull(),
```

После `agentSkillCatalog`:

```ts
// ── Журнал прогонов навыков и мониторов (волна R, R-R-1) ────────────────────
// Пишет рантайм агентов после каждого прогона (cron, задача, монитор). Раньше
// исход `skipped:<reason>` жил только в stdout контейнера — владелец не мог
// узнать, почему навык промолчал. request_key уникален: дубль тика на двух
// репликах даёт одну строку.
export const agentRun = pgTable(
  "agent_run",
  {
    id: id(),
    /** Имя агента или "system" для мониторов. */
    agentName: text("agent_name").notNull(),
    /** Навык или имя монитора (ourvend:sync). */
    skill: text("skill").notNull(),
    /** cron | task | manual. */
    trigger: text("trigger").notNull(),
    cron: text("cron"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    requestKey: text("request_key").notNull().unique(),
    traceKey: text("trace_key"),
    taskId: uuid("task_id").references(() => task.id, { onDelete: "set null" }),
    approvalId: uuid("approval_id").references(() => approval.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    /** approval_requested | executed | skipped | failed. */
    outcome: text("outcome").notNull(),
    /** SkipReason из @mydon/shared (в т.ч. hook_blocked). */
    skipReason: text("skip_reason"),
    /** kind заблокировавшего pre_run-хука. */
    hook: text("hook"),
    reason: text("reason").notNull(),
    action: text("action"),
    /** Заметка coach_lite (post_run). */
    review: text("review"),
    createdAt: createdAt(),
  },
  (t) => [
    index("agent_run_agent_skill_idx").on(t.agentName, t.skill, desc(t.startedAt)),
    index("agent_run_started_idx").on(desc(t.startedAt)),
    index("agent_run_task_idx").on(t.taskId).where(sql`${t.taskId} is not null`),
  ],
);

// ── Снимок рантайма агентов (волна R, R-R-2) ───────────────────────────────
// Одна строка на ключ ("schedules"): что croner реально держит, не подключённые
// навыки с причиной, мониторы, паузы. Core считает nextRun сам; возраст снимка
// показывает, что контейнер агентов жив.
export const agentRuntimeSnapshot = pgTable("agent_runtime_snapshot", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

(`desc`, `sql` уже импортированы в schema.ts; `task`, `approval` объявлены выше — проверь, что `agentRun` стоит ПОСЛЕ них в файле.)

- [ ] **Step 4: Миграция**

Run: `pnpm --filter @mydon/db db:generate` — drizzle-kit создаст `drizzle/0088_<имя>.sql` и `meta/0088_snapshot.json`, допишет `_journal.json`. Переименуй SQL в `0088_agent_run.sql` и поправь `tag` в `_journal.json` на `0088_agent_run`. Открой SQL и убедись, что он содержит ровно: `ALTER TABLE "agent" ADD COLUMN "hooks" jsonb DEFAULT '{}'::jsonb NOT NULL`, `CREATE TABLE "agent_run"`, `CREATE TABLE "agent_runtime_snapshot"`, три индекса, два FK с `ON DELETE set null`. Добавь первой строкой комментарий:
`-- Журнал прогонов + снимок расписаний + хуки паспорта (волна R, спека 2026-09-06-wave-r-crons-flows).`
Если drizzle-kit требует живую базу (`DATABASE_URL`) — напиши SQL руками по образцу `0087_agent_skill_catalog.sql`, а snapshot-файл сгенерируй командой `pnpm --filter @mydon/db exec drizzle-kit generate --custom --name agent_run` и вставь SQL в него; в любом случае `meta/0088_snapshot.json` должен существовать (CI сверяет цепочку).

- [ ] **Step 5: Прогнать миграции на настоящем SQL**

Run: `node tools/pglite-checks/run-migrations.mjs 2>&1 | tail -3` (локально pglite; если пакет не стоит — `CHECKS_DATABASE_URL=postgres://mydon:mydon@127.0.0.1:5432/mydon_checks node tools/pglite-checks/run-migrations.mjs`, база Homebrew Postgres 15). Ожидание: «миграций применено: 89» без ошибок.

- [ ] **Step 6: Тесты**

Run: `pnpm --filter @mydon/db build && pnpm --filter @mydon/db test 2>&1 | tail -4` — pass.

- [ ] **Step 7: Коммит**

```bash
git add packages/db/src/schema.ts packages/db/src/agent-run-schema.test.ts packages/db/drizzle/0088_agent_run.sql packages/db/drizzle/meta/0088_snapshot.json packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): миграция 0088 — журнал agent_run, снимок рантайма, хуки паспорта в карточке (волна R)"
```

---

### Task 3: Core — модуль `routines`: журнал прогонов, снимок расписаний, хуки в карточке агента

**Files:**
- Create: `apps/core/src/routines/routines.module.ts`
- Create: `apps/core/src/routines/routines.controller.ts`
- Create: `apps/core/src/routines/runs.service.ts`
- Create: `apps/core/src/routines/runs.service.test.ts`
- Create: `apps/core/src/routines/routines.controller.test.ts`
- Modify: `apps/core/src/app.module.ts` (импорт `RoutinesModule` после `AgentsModule`)
- Modify: `apps/core/src/agents/agents.service.ts` (`UpsertAgentInput.hooks`, create/seed/patch/list — по образцу `kbPages`)
- Modify: `apps/core/src/agents/agents.controller.ts` (`CreateAgentDto.hooks`: `@IsOptional() @IsObject()`; `toInput` пробрасывает)
- Modify: `apps/core/src/agents/agents.service.test.ts` (сид сохраняет `hooks`)

**Interfaces:**
- Consumes: `agentRun`, `agentRuntimeSnapshot` (Task 2), `isRunOutcome`, `isSkipReason`, `RUN_TRIGGERS` (Task 1).
- Produces (для Task 4 и рантайма):
  - `RunsService.report(input: ReportRunInput): Promise<{ id: string; created: boolean }>`
  - `RunsService.list(filter: { agent?: string; skill?: string; outcome?: RunOutcome; limit?: number }): Promise<AgentRunRow[]>`
  - `RunsService.last(agent: string, skill: string): Promise<AgentRunRow | null>`
  - `RunsService.lastPerJob(): Promise<AgentRunRow[]>` (DISTINCT ON (agent_name, skill), новые)
  - `RunsService.byId(id: string): Promise<AgentRunRow | null>`
  - `RunsService.putSnapshot(s: ScheduleSnapshot): Promise<{ storedAt: string }>`
  - `RunsService.snapshot(): Promise<{ payload: ScheduleSnapshot; updatedAt: Date } | null>`
  - Маршруты: `POST /routines/runs`, `GET /routines/runs`, `GET /routines/runs/last`, `PUT /routines/snapshot`.
  - `AgentRunRow = typeof agentRun.$inferSelect`; `AgentRunView` (JSON-форма с ISO-датами) — `toView(row)`.

- [ ] **Step 1: Тесты сервиса (стаб базы по образцу `agents.service.test.ts`)**

```ts
// apps/core/src/routines/runs.service.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { RunsService, type ReportRunInput, normalizeReport, snapshotFromBody } from "./runs.service";

type Row = Record<string, unknown>;

/** Стаб: select по requestKey отдаёт existing; insert/update копятся. */
function stub(opts: { existing?: Row } = {}) {
  const captured = { insert: [] as Row[], update: [] as Row[] };
  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => (opts.existing ? [opts.existing] : []) }) }),
    }),
    insert: () => ({
      values: (v: Row) => {
        captured.insert.push(v);
        return { returning: async () => [{ id: "r1", ...v }] };
      },
      // upsert снимка
      onConflictDoUpdate: () => ({ returning: async () => [{ key: "schedules" }] }),
    }),
    update: () => ({
      set: (v: Row) => {
        captured.update.push(v);
        return { where: () => ({ returning: async () => [{ ...(opts.existing ?? {}), ...v }] }) };
      },
    }),
  };
  const db = {
    transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
    insert: tx.insert,
    select: tx.select,
  } as never;
  return { db, captured };
}

const base: ReportRunInput = {
  agentName: "vendhub-ops",
  skill: "monitor-stock",
  trigger: "cron",
  cron: "0 8 * * *",
  scheduledAt: "2026-09-06T03:00:00.000Z",
  requestKey: "cron:vendhub-ops:monitor-stock:0 8 * * *:2026-09-06T03:00:00.000Z",
  startedAt: "2026-09-06T03:00:01.000Z",
  finishedAt: "2026-09-06T03:00:04.000Z",
  outcome: "skipped",
  skipReason: "no_signal",
  reason: "повода нет",
};

describe("RunsService.report (R-R-1)", () => {
  it("новая строка → created: true, поля исхода на месте", async () => {
    const { db, captured } = stub();
    const s = new RunsService(db);
    const r = await s.report(base);
    assert.equal(r.created, true);
    assert.equal(captured.insert.length, 1);
    assert.equal(captured.insert[0].requestKey, base.requestKey);
    assert.equal(captured.insert[0].skipReason, "no_signal");
    assert.ok(captured.insert[0].startedAt instanceof Date);
  });

  it("повтор того же requestKey → update, created: false", async () => {
    const { db, captured } = stub({ existing: { id: "r0", requestKey: base.requestKey } });
    const r = await new RunsService(db).report({ ...base, outcome: "executed", skipReason: undefined, reason: "выполнено" });
    assert.equal(r.created, false);
    assert.equal(r.id, "r0");
    assert.equal(captured.update.length, 1);
    assert.equal(captured.update[0].outcome, "executed");
    assert.equal(captured.update[0].skipReason, null);
  });
});

describe("normalizeReport — валидация тела", () => {
  it("режет длинные тексты и не отвергает их", () => {
    const n = normalizeReport({ ...base, reason: "x".repeat(5000), action: "y".repeat(900) });
    assert.equal(n.reason.length, 2000);
    assert.equal(n.action?.length, 500);
  });
  it("skipReason при outcome ≠ skipped → 400", () => {
    assert.throws(() => normalizeReport({ ...base, outcome: "executed" }), BadRequestException);
  });
  it("finishedAt раньше startedAt → 400", () => {
    assert.throws(() => normalizeReport({ ...base, finishedAt: "2026-09-06T02:59:00.000Z" }), BadRequestException);
  });
  it("неизвестный outcome/skipReason/trigger → 400", () => {
    assert.throws(() => normalizeReport({ ...base, outcome: "done" as never }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, skipReason: "tired" as never }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, trigger: "webhook" as never }), BadRequestException);
  });
  it("hook без hook_blocked → 400; taskId не uuid → 400", () => {
    assert.throws(() => normalizeReport({ ...base, hook: "quiet_hours" }), BadRequestException);
    assert.throws(() => normalizeReport({ ...base, taskId: "nope" }), BadRequestException);
  });
});

describe("snapshotFromBody — снимок расписаний (R-R-2)", () => {
  const ok = {
    generatedAt: "2026-09-06T03:00:00.000Z",
    tz: "Asia/Tashkent",
    paused: { schedules: true, tasks: true },
    jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" }],
    notWired: [{ agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" }],
    monitors: [{ name: "fx:refresh", cron: "5 9 * * *", enabled: true }],
  };
  it("принимает корректный снимок", () => {
    const s = snapshotFromBody(ok);
    assert.equal(s.jobs.length, 1);
    assert.equal(s.monitors[0].name, "fx:refresh");
  });
  it("битый cron → 400 с именем задания", () => {
    assert.throws(
      () => snapshotFromBody({ ...ok, jobs: [{ ...ok.jobs[0], cron: "99 99 * * *" }] }),
      (e: unknown) => e instanceof BadRequestException && /vendhub-ops\/monitor-stock/.test(String((e as Error).message)),
    );
  });
  it("чужой tz или mode → 400", () => {
    assert.throws(() => snapshotFromBody({ ...ok, tz: "UTC" }), BadRequestException);
    assert.throws(() => snapshotFromBody({ ...ok, jobs: [{ ...ok.jobs[0], mode: "eager" }] }), BadRequestException);
  });
});
```

- [ ] **Step 2: Убедиться, что падает** — `pnpm --filter @mydon/core build 2>&1 | grep -c routines` > 0 (модуль не найден).

- [ ] **Step 3: Сервис**

```ts
// apps/core/src/routines/runs.service.ts
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { Cron } from "croner";
import {
  RUN_TRIGGERS,
  TZ,
  isRunOutcome,
  isSkipReason,
  type RunOutcome,
  type RunTrigger,
  type SkipReason,
} from "@mydon/shared";
import { agentRun, agentRuntimeSnapshot } from "@mydon/db";
import { DB, type Db } from "../db/db.module";

export type AgentRunRow = typeof agentRun.$inferSelect;

export interface ReportRunInput {
  agentName: string;
  skill: string;
  trigger: RunTrigger;
  cron?: string;
  scheduledAt?: string;
  requestKey: string;
  traceKey?: string;
  taskId?: string;
  approvalId?: string;
  startedAt: string;
  finishedAt: string;
  outcome: RunOutcome;
  skipReason?: SkipReason;
  hook?: string;
  reason: string;
  action?: string;
  review?: string;
}

export interface ScheduleSnapshot {
  generatedAt: string;
  tz: typeof TZ;
  paused: { schedules: boolean; tasks: boolean };
  jobs: { agent: string; skill: string; cron: string; mode: "durable-task" | "legacy" }[];
  notWired: { agent: string; skill: string; reason: "no_implementation" | "llm_route_off" }[];
  monitors: { name: string; cron: string; enabled: boolean; reason?: "off" | "no_credentials" }[];
}

export const SNAPSHOT_KEY = "schedules";
const REASON_MAX = 2000;
const ACTION_MAX = 500;
const REVIEW_MAX = 1000;
const LIST_MAX = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoDate(v: unknown, field: string): Date {
  const d = typeof v === "string" ? new Date(v) : new Date(NaN);
  if (!Number.isFinite(d.getTime())) throw new BadRequestException(`${field}: нужна дата ISO`);
  return d;
}
function optText(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new BadRequestException(`${field}: нужна строка`);
  return v.slice(0, max);
}
function optUuid(v: unknown, field: string): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new BadRequestException(`${field}: нужен uuid`);
  return v;
}

/** Проверка тела отчёта; длинные тексты режем, а не отвергаем (журнал не должен терять прогон). */
export function normalizeReport(input: ReportRunInput): typeof agentRun.$inferInsert {
  if (typeof input.agentName !== "string" || !input.agentName) throw new BadRequestException("agentName обязателен");
  if (typeof input.skill !== "string" || !input.skill) throw new BadRequestException("skill обязателен");
  if (typeof input.requestKey !== "string" || !input.requestKey) throw new BadRequestException("requestKey обязателен");
  if (!(RUN_TRIGGERS as readonly string[]).includes(input.trigger)) throw new BadRequestException("trigger: cron | task | manual");
  if (!isRunOutcome(input.outcome)) throw new BadRequestException("outcome: approval_requested | executed | skipped | failed");
  if (input.skipReason !== undefined && !isSkipReason(input.skipReason)) throw new BadRequestException("skipReason неизвестен");
  if (input.skipReason !== undefined && input.outcome !== "skipped") throw new BadRequestException("skipReason только при outcome=skipped");
  if (input.hook !== undefined && input.skipReason !== "hook_blocked") throw new BadRequestException("hook только при skipReason=hook_blocked");
  if (typeof input.reason !== "string" || !input.reason) throw new BadRequestException("reason обязателен");
  const startedAt = isoDate(input.startedAt, "startedAt");
  const finishedAt = isoDate(input.finishedAt, "finishedAt");
  if (finishedAt.getTime() < startedAt.getTime()) throw new BadRequestException("finishedAt раньше startedAt");
  return {
    agentName: input.agentName.slice(0, 64),
    skill: input.skill.slice(0, 64),
    trigger: input.trigger,
    cron: optText(input.cron, "cron", 64),
    scheduledAt: input.scheduledAt === undefined ? null : isoDate(input.scheduledAt, "scheduledAt"),
    requestKey: input.requestKey.slice(0, 300),
    traceKey: optText(input.traceKey, "traceKey", 300),
    taskId: optUuid(input.taskId, "taskId"),
    approvalId: optUuid(input.approvalId, "approvalId"),
    startedAt,
    finishedAt,
    outcome: input.outcome,
    skipReason: input.skipReason ?? null,
    hook: optText(input.hook, "hook", 64),
    reason: input.reason.slice(0, REASON_MAX),
    action: optText(input.action, "action", ACTION_MAX),
    review: optText(input.review, "review", REVIEW_MAX),
  };
}

function assertCron(expr: unknown, who: string): string {
  if (typeof expr !== "string" || !expr.trim()) throw new BadRequestException(`${who}: cron пуст`);
  try {
    new Cron(expr, { timezone: TZ, paused: true }).stop();
  } catch {
    throw new BadRequestException(`${who}: битое расписание «${expr}»`);
  }
  return expr;
}

/** Снимок из тела запроса: чужой tz/mode — 400, битый cron — 400 с именем задания. */
export function snapshotFromBody(body: unknown): ScheduleSnapshot {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.tz !== TZ) throw new BadRequestException(`tz должен быть ${TZ}`);
  const generatedAt = isoDate(b.generatedAt, "generatedAt").toISOString();
  const p = (b.paused ?? {}) as Record<string, unknown>;
  const paused = { schedules: p.schedules === true, tasks: p.tasks === true };
  const jobs = (Array.isArray(b.jobs) ? b.jobs : []).map((j) => {
    const x = j as Record<string, unknown>;
    if (typeof x.agent !== "string" || typeof x.skill !== "string") throw new BadRequestException("jobs[]: agent/skill");
    if (x.mode !== "durable-task" && x.mode !== "legacy") throw new BadRequestException(`${x.agent}/${x.skill}: mode`);
    return { agent: x.agent, skill: x.skill, cron: assertCron(x.cron, `${x.agent}/${x.skill}`), mode: x.mode };
  });
  const notWired = (Array.isArray(b.notWired) ? b.notWired : []).map((j) => {
    const x = j as Record<string, unknown>;
    if (typeof x.agent !== "string" || typeof x.skill !== "string") throw new BadRequestException("notWired[]: agent/skill");
    if (x.reason !== "no_implementation" && x.reason !== "llm_route_off") throw new BadRequestException(`${x.agent}/${x.skill}: reason`);
    return { agent: x.agent, skill: x.skill, reason: x.reason };
  });
  const monitors = (Array.isArray(b.monitors) ? b.monitors : []).map((m) => {
    const x = m as Record<string, unknown>;
    if (typeof x.name !== "string") throw new BadRequestException("monitors[]: name");
    const enabled = x.enabled === true;
    const reason = x.reason === "off" || x.reason === "no_credentials" ? x.reason : undefined;
    // Выключенный монитор может нести cron "off" — его не валидируем.
    const cron = enabled ? assertCron(x.cron, `system/${x.name}`) : String(x.cron ?? "");
    return { name: x.name, cron, enabled, ...(reason ? { reason } : {}) };
  });
  return { generatedAt, tz: TZ, paused, jobs, notWired, monitors };
}

export interface AgentRunView {
  id: string; agentName: string; skill: string; trigger: string; cron: string | null; scheduledAt: string | null;
  requestKey: string; taskId: string | null; approvalId: string | null; startedAt: string; finishedAt: string;
  outcome: string; skipReason: string | null; hook: string | null; reason: string; action: string | null; review: string | null;
}

export function toView(r: AgentRunRow): AgentRunView {
  return {
    id: r.id, agentName: r.agentName, skill: r.skill, trigger: r.trigger, cron: r.cron,
    scheduledAt: r.scheduledAt?.toISOString() ?? null, requestKey: r.requestKey, taskId: r.taskId,
    approvalId: r.approvalId, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt.toISOString(),
    outcome: r.outcome, skipReason: r.skipReason, hook: r.hook, reason: r.reason, action: r.action, review: r.review,
  };
}

/** Сырая строка `execute` (snake_case) → форма `$inferSelect`. */
export function rowFromRaw(r: Record<string, unknown>): AgentRunRow {
  const d = (v: unknown): Date | null => (v instanceof Date ? v : typeof v === "string" ? new Date(v) : null);
  return {
    id: String(r.id), agentName: String(r.agent_name), skill: String(r.skill), trigger: String(r.trigger),
    cron: (r.cron as string | null) ?? null, scheduledAt: d(r.scheduled_at), requestKey: String(r.request_key),
    traceKey: (r.trace_key as string | null) ?? null, taskId: (r.task_id as string | null) ?? null,
    approvalId: (r.approval_id as string | null) ?? null, startedAt: d(r.started_at)!, finishedAt: d(r.finished_at)!,
    outcome: String(r.outcome), skipReason: (r.skip_reason as string | null) ?? null, hook: (r.hook as string | null) ?? null,
    reason: String(r.reason), action: (r.action as string | null) ?? null, review: (r.review as string | null) ?? null,
    createdAt: d(r.created_at)!,
  };
}

@Injectable()
export class RunsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Идемпотентно по requestKey: повтор обновляет поля исхода (реплика/повтор тика). */
  async report(input: ReportRunInput): Promise<{ id: string; created: boolean }> {
    const row = normalizeReport(input);
    return this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(agentRun).where(eq(agentRun.requestKey, row.requestKey)).limit(1);
      if (existing) {
        const { requestKey: _k, agentName: _a, skill: _s, trigger: _t, startedAt: _st, ...patch } = row;
        await tx.update(agentRun).set(patch).where(eq(agentRun.id, existing.id)).returning();
        return { id: existing.id, created: false };
      }
      const [created] = await tx.insert(agentRun).values(row).returning();
      return { id: created!.id, created: true };
    });
  }

  async list(filter: { agent?: string; skill?: string; outcome?: RunOutcome; limit?: number } = {}): Promise<AgentRunRow[]> {
    const conds = [
      ...(filter.agent ? [eq(agentRun.agentName, filter.agent)] : []),
      ...(filter.skill ? [eq(agentRun.skill, filter.skill)] : []),
      ...(filter.outcome ? [eq(agentRun.outcome, filter.outcome)] : []),
    ];
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), LIST_MAX);
    const q = this.db.select().from(agentRun);
    return (conds.length ? q.where(and(...conds)) : q).orderBy(desc(agentRun.startedAt)).limit(limit);
  }

  async last(agent: string, skill: string): Promise<AgentRunRow | null> {
    const [row] = await this.db.select().from(agentRun)
      .where(and(eq(agentRun.agentName, agent), eq(agentRun.skill, skill)))
      .orderBy(desc(agentRun.startedAt)).limit(1);
    return row ?? null;
  }

  async byId(id: string): Promise<AgentRunRow | null> {
    if (!UUID_RE.test(id)) return null;
    const [row] = await this.db.select().from(agentRun).where(eq(agentRun.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * Последний прогон каждого задания — одной выборкой (`distinct on`, как
   * `lastRunsBySkill` в agents.service). Драйвер postgres-js отдаёт массив
   * строк со snake_case-колонками и `Date` для timestamptz.
   */
  async lastPerJob(): Promise<AgentRunRow[]> {
    const raw = (await this.db.execute(sql`
      select distinct on (${agentRun.agentName}, ${agentRun.skill}) ${agentRun}.*
      from ${agentRun}
      order by ${agentRun.agentName}, ${agentRun.skill}, ${agentRun.startedAt} desc
    `)) as unknown as Record<string, unknown>[];
    return raw.map(rowFromRaw);
  }

  async putSnapshot(snapshot: ScheduleSnapshot): Promise<{ storedAt: string }> {
    const storedAt = new Date();
    await this.db.insert(agentRuntimeSnapshot)
      .values({ key: SNAPSHOT_KEY, payload: snapshot as unknown as Record<string, unknown>, updatedAt: storedAt })
      .onConflictDoUpdate({ target: agentRuntimeSnapshot.key, set: { payload: snapshot as unknown as Record<string, unknown>, updatedAt: storedAt } });
    return { storedAt: storedAt.toISOString() };
  }

  async snapshot(): Promise<{ payload: ScheduleSnapshot; updatedAt: Date } | null> {
    const [row] = await this.db.select().from(agentRuntimeSnapshot).where(eq(agentRuntimeSnapshot.key, SNAPSHOT_KEY)).limit(1);
    return row ? { payload: row.payload as unknown as ScheduleSnapshot, updatedAt: row.updatedAt } : null;
  }
}
```

Добавь в тест `runs.service.test.ts` кейс на `rowFromRaw`: snake_case-строка с `Date` и со строковой датой даёт одинаковый `startedAt.toISOString()`.

- [ ] **Step 4: Контроллер + модуль**

```ts
// apps/core/src/routines/routines.controller.ts
import { Body, Controller, Get, Post, Put, Query } from "@nestjs/common";
import type { RunOutcome } from "@mydon/shared";
import { isRunOutcome } from "@mydon/shared";
import { RunsService, snapshotFromBody, toView, type ReportRunInput } from "./runs.service";

/**
 * Рутины: журнал прогонов и снимок расписаний (волна R). Префикс /routines
 * выбран вместо /agents/…, чтобы не соревноваться с `GET /agents/:name`.
 */
@Controller("routines")
export class RoutinesController {
  constructor(private readonly runs: RunsService) {}

  @Post("runs")
  report(@Body() body: ReportRunInput) {
    return this.runs.report(body);
  }

  @Get("runs")
  async list(
    @Query("agent") agent?: string,
    @Query("skill") skill?: string,
    @Query("outcome") outcome?: string,
    @Query("limit") limit?: string,
  ) {
    const rows = await this.runs.list({
      ...(agent ? { agent } : {}),
      ...(skill ? { skill } : {}),
      ...(outcome && isRunOutcome(outcome) ? { outcome: outcome as RunOutcome } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
    return { runs: rows.map(toView) };
  }

  @Get("runs/last")
  async last(@Query("agent") agent: string, @Query("skill") skill: string) {
    const row = agent && skill ? await this.runs.last(agent, skill) : null;
    return { run: row ? toView(row) : null };
  }

  @Put("snapshot")
  putSnapshot(@Body() body: unknown) {
    return this.runs.putSnapshot(snapshotFromBody(body));
  }
}
```

```ts
// apps/core/src/routines/routines.module.ts
import { Module } from "@nestjs/common";
import { RoutinesController } from "./routines.controller";
import { RunsService } from "./runs.service";

@Module({
  controllers: [RoutinesController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RoutinesModule {}
```

В `app.module.ts` добавь `RoutinesModule` в `imports` сразу после `AgentsModule`. Тест контроллера (`routines.controller.test.ts`): `list` пробрасывает фильтры и отбрасывает чужой `outcome`; `last` без параметров → `{ run: null }` без обращения к сервису (стаб сервиса, как в `agents.controller.test.ts`).

- [ ] **Step 5: Хуки в карточке агента**

В `agents.service.ts`: `UpsertAgentInput.hooks?: Record<string, unknown>`; в `create`/`seedIfEmpty` — `hooks: input.hooks ?? {}`; в `update` — `if (patch.hooks !== undefined) values.hooks = patch.hooks;`; `list()`/`get()` отдают `hooks` (столбец уже в `select()` по `*` — проверь, что маппинг карточки не фильтрует поля явно). В `agents.controller.ts` `CreateAgentDto`: 

```ts
  /** Хуки паспорта (волна R): { preRun: [{kind,…}], postRun: [{kind}] }. Валидирует рантайм/check:passports; Core хранит. */
  @IsOptional() @IsObject()
  hooks?: Record<string, unknown>;
```

и в `toInput` — `...(a.hooks !== undefined ? { hooks: a.hooks } : {})`. Тест в `agents.service.test.ts`: сид с `hooks: { preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }] }` кладёт объект в insert.

- [ ] **Step 6: Гейт**

Run: `pnpm --filter @mydon/core build && pnpm --filter @mydon/core test 2>&1 | grep -E "^# (pass|fail)"` — fail 0.

- [ ] **Step 7: Коммит**

```bash
git add apps/core/src/routines apps/core/src/app.module.ts apps/core/src/agents/agents.service.ts apps/core/src/agents/agents.controller.ts apps/core/src/agents/agents.service.test.ts
git commit -m "feat(core): модуль routines — журнал прогонов (POST/GET /routines/runs), снимок расписаний, хуки в карточке агента (волна R)"
```

---

### Task 4: Core — доска (`GET /routines/board`) и плейбэк (`GET /routines/flows`, `/routines/flows/:id`)

**Files:**
- Create: `apps/core/src/routines/board.ts` (чистые функции) + `board.test.ts`
- Create: `apps/core/src/routines/board.service.ts`
- Create: `apps/core/src/routines/flows.ts` (чистые функции) + `flows.test.ts`
- Create: `apps/core/src/routines/flows.service.ts`
- Modify: `apps/core/src/routines/routines.controller.ts` (три маршрута), `routines.module.ts` (провайдеры, `imports: [SystemModule]`)

**Interfaces:**
- Consumes: `RunsService` (Task 3), `SystemService.effective()` (`apps/core/src/system/system.service.ts`, элементы `{ key, value }`), `agentSkillCatalog`, `task`, `taskAgentExecution`, `approval`, `outboxDelivery`, `event`, `auditLog` (`@mydon/db`), `RUN_SKIP_REASONS` (Task 1).
- Produces (JSON, дублируется в панели в Task 7/8):

```ts
export interface CronBoardJob {
  id: string; kind: "skill" | "monitor"; agent: string; skill: string; cron: string;
  mode: "durable-task" | "legacy" | "monitor"; enabled: boolean; disabledReason?: string;
  paused: boolean; nextRun: string | null;
  last: null | { at: string; outcome: string; skipReason: string | null; hook: string | null; reason: string; runId: string };
}
export interface CronBoard {
  tz: "Asia/Tashkent"; now: string;
  snapshot: { generatedAt: string; ageSec: number; stale: boolean } | null;
  paused: { schedules: boolean; tasks: boolean };
  jobs: CronBoardJob[];
  upcoming24h: { at: string; jobId: string }[];
}
export type PhaseState = "ok" | "warn" | "fail" | "skip";
export interface FlowPhase { name: "trigger" | "skill" | "proposal" | "approval" | "execution" | "delivery"; state: PhaseState; at?: string; title: string; note?: string; href?: string }
export interface FlowSummary { id: string; agent: string; skill: string; trigger: string; startedAt: string; finishedAt: string; outcome: string; skipReason: string | null; hook: string | null; reason: string; action: string | null; taskId: string | null; approvalId: string | null }
export interface FlowPlayback {
  run: FlowSummary & { cron: string | null; scheduledAt: string | null; review: string | null; requestKey: string };
  phases: FlowPhase[];
  events: { at: string; type: string; payload: unknown }[];
  audit: { at: string; action: string; actorRef: string | null; target: string | null }[];
}
```

- [ ] **Step 1: Тесты чистых функций доски**

```ts
// apps/core/src/routines/board.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeBoard, nextOccurrences, type BoardInput } from "./board";

const now = new Date("2026-09-06T03:10:00.000Z"); // 08:10 Ташкент, суббота
const snapshot = {
  generatedAt: "2026-09-06T03:05:00.000Z",
  tz: "Asia/Tashkent" as const,
  paused: { schedules: true, tasks: true },
  jobs: [
    { agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" as const },
    { agent: "vendhub-ops", skill: "parts-audit", cron: "30 8 * * 1", mode: "durable-task" as const },
  ],
  notWired: [{ agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" as const }],
  monitors: [
    { name: "ourvend:sync", cron: "0 */3 * * *", enabled: true },
    { name: "coffee:monitor", cron: "off", enabled: false, reason: "off" as const },
  ],
};
const input: BoardInput = {
  now,
  snapshot: { payload: snapshot, updatedAt: new Date("2026-09-06T03:05:00.000Z") },
  paused: { schedules: false, tasks: true },
  lastRuns: [
    { agentName: "vendhub-ops", skill: "monitor-stock", startedAt: new Date("2026-09-06T03:00:01.000Z"), outcome: "skipped", skipReason: "no_signal", hook: null, reason: "повода нет", id: "r1" },
  ],
};

describe("computeBoard (R-R-3)", () => {
  it("следующий запуск по Ташкенту: 0 8 * * * после 08:10 → завтра 08:00 (= 03:00Z)", () => {
    const b = computeBoard(input);
    const j = b.jobs.find((x) => x.id === "vendhub-ops/monitor-stock")!;
    assert.equal(j.nextRun, "2026-09-07T03:00:00.000Z");
    assert.equal(j.mode, "legacy");
    assert.equal(j.last?.skipReason, "no_signal");
    assert.equal(j.last?.runId, "r1");
  });

  it("паузу берёт из system_config, а не из снимка; мониторы паузе не подчиняются", () => {
    const b = computeBoard(input);
    assert.deepEqual(b.paused, { schedules: false, tasks: true });
    assert.equal(b.jobs.find((x) => x.id === "vendhub-ops/parts-audit")!.paused, false);
    const paused = computeBoard({ ...input, paused: { schedules: true, tasks: true } });
    assert.equal(paused.jobs.find((x) => x.id === "vendhub-ops/parts-audit")!.paused, true);
    assert.equal(paused.jobs.find((x) => x.id === "system/ourvend:sync")!.paused, false);
    // на паузе задания не попадают в 24 ч, мониторы — попадают
    assert.ok(paused.upcoming24h.every((u) => u.jobId.startsWith("system/")));
  });

  it("не подключённые и выключенные — enabled=false с причиной, nextRun=null, в конце списка", () => {
    const b = computeBoard(input);
    const nw = b.jobs.find((x) => x.id === "vendhub-ceo/weekly-review")!;
    assert.equal(nw.enabled, false);
    assert.match(nw.disabledReason ?? "", /LLM-маршрут/);
    assert.equal(nw.nextRun, null);
    const off = b.jobs.find((x) => x.id === "system/coffee:monitor")!;
    assert.equal(off.enabled, false);
    assert.equal(b.jobs.at(-1)!.enabled, false);
    assert.equal(b.jobs[0]!.enabled, true);
  });

  it("ближайшие 24 ч: */3 даёт 8 срабатываний, отсортировано, лимит 200", () => {
    const b = computeBoard(input);
    const sync = b.upcoming24h.filter((u) => u.jobId === "system/ourvend:sync");
    assert.equal(sync.length, 8);
    assert.equal(sync[0]!.at, "2026-09-06T04:00:00.000Z"); // 09:00 Ташкент
    for (let i = 1; i < b.upcoming24h.length; i += 1) assert.ok(b.upcoming24h[i - 1]!.at <= b.upcoming24h[i]!.at);
    const flood = computeBoard({ ...input, snapshot: { ...input.snapshot!, payload: { ...snapshot, monitors: [{ name: "x", cron: "* * * * *", enabled: true }] } } });
    assert.equal(flood.upcoming24h.length, 200);
  });

  it("снимок: возраст и stale > 900 с; без снимка — null и пустые задания", () => {
    const b = computeBoard(input);
    assert.equal(b.snapshot?.ageSec, 300);
    assert.equal(b.snapshot?.stale, false);
    const old = computeBoard({ ...input, snapshot: { ...input.snapshot!, updatedAt: new Date("2026-09-06T02:00:00.000Z") } });
    assert.equal(old.snapshot?.stale, true);
    const none = computeBoard({ ...input, snapshot: null });
    assert.equal(none.snapshot, null);
    assert.equal(none.jobs.length, 0);
  });
});

describe("nextOccurrences", () => {
  it("битый cron → пустой список, не исключение", () => {
    assert.deepEqual(nextOccurrences("99 99 * * *", now, 5), []);
  });
});
```

- [ ] **Step 2: Реализация доски**

```ts
// apps/core/src/routines/board.ts
import { Cron } from "croner";
import { TZ } from "@mydon/shared";
import type { ScheduleSnapshot } from "./runs.service";

export interface CronBoardJob {
  id: string;
  kind: "skill" | "monitor";
  agent: string;
  skill: string;
  cron: string;
  mode: "durable-task" | "legacy" | "monitor";
  enabled: boolean;
  disabledReason?: string;
  paused: boolean;
  nextRun: string | null;
  last: null | { at: string; outcome: string; skipReason: string | null; hook: string | null; reason: string; runId: string };
}
export interface CronBoard {
  tz: typeof TZ;
  now: string;
  snapshot: { generatedAt: string; ageSec: number; stale: boolean } | null;
  paused: { schedules: boolean; tasks: boolean };
  jobs: CronBoardJob[];
  upcoming24h: { at: string; jobId: string }[];
}

export interface LastRunLite {
  id: string; agentName: string; skill: string; startedAt: Date; outcome: string;
  skipReason: string | null; hook: string | null; reason: string;
}
export interface BoardInput {
  now: Date;
  snapshot: { payload: ScheduleSnapshot; updatedAt: Date } | null;
  paused: { schedules: boolean; tasks: boolean };
  lastRuns: LastRunLite[];
}

export const STALE_AFTER_SEC = 900;
export const UPCOMING_LIMIT = 200;
const DAY_MS = 86_400_000;

const DISABLED: Record<string, string> = {
  no_implementation: "навык не подключён: нет кода в SKILLS и нет executor: llm",
  llm_route_off: "LLM-маршрут выключен или не metered — llm-навык на cron не допущен",
  off: "выключен в .env (<NAME>_CRON=off); меняется в .env, нужен рестарт агентов",
  no_credentials: "не заданы OURVEND_ACCOUNT/OURVEND_PASSWORD",
};

/** Ближайшие срабатывания cron по Ташкенту; битое выражение — пусто, не исключение. */
export function nextOccurrences(cron: string, from: Date, limit: number): Date[] {
  try {
    const job = new Cron(cron, { timezone: TZ, paused: true });
    const runs = job.nextRuns(limit, from);
    job.stop();
    return runs;
  } catch {
    return [];
  }
}

export function computeBoard(input: BoardInput): CronBoard {
  const now = input.now;
  const snap = input.snapshot;
  const lastByKey = new Map(input.lastRuns.map((r) => [`${r.agentName}/${r.skill}`, r]));
  const jobs: CronBoardJob[] = [];
  const upcoming: { at: string; jobId: string }[] = [];
  const horizon = new Date(now.getTime() + DAY_MS);

  const push = (j: Omit<CronBoardJob, "nextRun" | "last">, includeUpcoming: boolean): void => {
    const last = lastByKey.get(j.id);
    const next = j.enabled ? nextOccurrences(j.cron, now, 1)[0] ?? null : null;
    jobs.push({
      ...j,
      nextRun: next ? next.toISOString() : null,
      last: last
        ? { at: last.startedAt.toISOString(), outcome: last.outcome, skipReason: last.skipReason, hook: last.hook, reason: last.reason, runId: last.id }
        : null,
    });
    if (j.enabled && includeUpcoming) {
      for (const at of nextOccurrences(j.cron, now, UPCOMING_LIMIT)) {
        if (at > horizon) break;
        upcoming.push({ at: at.toISOString(), jobId: j.id });
      }
    }
  };

  if (snap) {
    const p = snap.payload;
    for (const j of p.jobs) {
      push({ id: `${j.agent}/${j.skill}`, kind: "skill", agent: j.agent, skill: j.skill, cron: j.cron, mode: j.mode, enabled: true, paused: input.paused.schedules }, !input.paused.schedules);
    }
    for (const j of p.notWired) {
      push({ id: `${j.agent}/${j.skill}`, kind: "skill", agent: j.agent, skill: j.skill, cron: "", mode: "legacy", enabled: false, disabledReason: DISABLED[j.reason] ?? j.reason, paused: input.paused.schedules }, false);
    }
    for (const m of p.monitors) {
      const reason = m.enabled ? undefined : DISABLED[m.reason ?? "off"]?.replace("<NAME>", m.name.toUpperCase().replace(/[^A-Z]/g, "_"));
      push({ id: `system/${m.name}`, kind: "monitor", agent: "system", skill: m.name, cron: m.cron, mode: "monitor", enabled: m.enabled, ...(reason ? { disabledReason: reason } : {}), paused: false }, true);
    }
  }

  upcoming.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.jobId.localeCompare(b.jobId)));
  jobs.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const an = a.nextRun ?? "~", bn = b.nextRun ?? "~";
    return an < bn ? -1 : an > bn ? 1 : a.id.localeCompare(b.id);
  });

  const ageSec = snap ? Math.max(0, Math.round((now.getTime() - snap.updatedAt.getTime()) / 1000)) : 0;
  return {
    tz: TZ,
    now: now.toISOString(),
    snapshot: snap ? { generatedAt: snap.payload.generatedAt, ageSec, stale: ageSec > STALE_AFTER_SEC } : null,
    paused: input.paused,
    jobs,
    upcoming24h: upcoming.slice(0, UPCOMING_LIMIT),
  };
}
```

```ts
// apps/core/src/routines/board.service.ts
import { Injectable } from "@nestjs/common";
import { SystemService } from "../system/system.service";
import { computeBoard, type CronBoard } from "./board";
import { RunsService } from "./runs.service";

@Injectable()
export class BoardService {
  constructor(private readonly runs: RunsService, private readonly system: SystemService) {}

  async board(now = new Date()): Promise<CronBoard> {
    const [snapshot, lastRuns, config] = await Promise.all([this.runs.snapshot(), this.runs.lastPerJob(), this.system.effective()]);
    const flag = (key: string): boolean => config.find((i) => i.key === key)?.value === "1";
    return computeBoard({
      now,
      snapshot,
      paused: { schedules: flag("AGENTS_SCHEDULES_PAUSED"), tasks: flag("AGENTS_TASKS_PAUSED") },
      lastRuns,
    });
  }
}
```

Проверь по `system.service.ts`, как называется поле с действующим значением у `EffectiveItem` (`value` или `effective`) — используй то, что означает «действует с учётом базы».

- [ ] **Step 3: Тесты фаз плейбэка**

```ts
// apps/core/src/routines/flows.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPhases, mergeContextless, type FlowContext } from "./flows";

const run = {
  id: "r1", agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
  scheduledAt: new Date("2026-09-06T03:00:00.000Z"), requestKey: "k", traceKey: null, taskId: null, approvalId: null,
  startedAt: new Date("2026-09-06T03:00:01.000Z"), finishedAt: new Date("2026-09-06T03:00:04.000Z"),
  outcome: "skipped", skipReason: "no_signal", hook: null, reason: "повода нет", action: null, review: null, createdAt: new Date(),
};
const ctx0: FlowContext = { run, catalog: { executor: "code", tier: "T1" }, task: null, execution: null, approval: null, deliveries: [] };

const names = (p: ReturnType<typeof buildPhases>) => p.map((x) => `${x.name}:${x.state}`);

describe("buildPhases (R-R-5)", () => {
  it("legacy skipped:no_signal — trigger ok, proposal skip с подписью словаря, остальное skip", () => {
    const p = buildPhases(ctx0);
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:skip", "approval:skip", "execution:skip", "delivery:skip"]);
    assert.match(p[0]!.title, /0 8 \* \* \*/);
    assert.equal(p[2]!.note, "повода нет");
    assert.match(p[1]!.title, /monitor-stock · code · T1/);
  });

  it("legacy executed без согласования — execution ok «выполнено напрямую», approval skip (T0/T1)", () => {
    const p = buildPhases({ ...ctx0, run: { ...run, outcome: "executed", skipReason: null, action: "Курс обновлён" } });
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:ok", "approval:skip", "execution:ok", "delivery:skip"]);
    assert.equal(p[2]!.title, "Курс обновлён");
  });

  it("task approval pending — approval warn со ссылкой /inbox, execution по статусу committed", () => {
    const p = buildPhases({
      ...ctx0,
      run: { ...run, trigger: "task", taskId: "11111111-1111-4111-8111-111111111111", outcome: "approval_requested", skipReason: null, action: "Пополнить автомат 12" },
      task: { id: "11111111-1111-4111-8111-111111111111", status: "todo" },
      execution: { id: "e1", status: "committed", committedAt: new Date("2026-09-06T03:00:03.000Z"), abandonReason: null },
      approval: { id: "a1", decision: "pending", decidedAt: null, tier: "T2", createdAt: new Date("2026-09-06T03:00:03.000Z") },
      deliveries: [{ destination: "notion-report", status: "pending", lastError: null, completedAt: null }],
    });
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:ok", "approval:warn", "execution:ok", "delivery:warn"]);
    assert.equal(p[3]!.href, "/inbox");
    assert.equal(p[4]!.href, "/tasks/11111111-1111-4111-8111-111111111111");
  });

  it("hook_blocked — proposal skip «хук quiet_hours: …»; failed — proposal fail", () => {
    const h = buildPhases({ ...ctx0, run: { ...run, skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы 22:00–07:00" } });
    assert.equal(h[2]!.state, "skip");
    assert.match(h[2]!.note ?? "", /хук quiet_hours: тихие часы/);
    const f = buildPhases({ ...ctx0, run: { ...run, outcome: "failed", skipReason: null, reason: "ECONNREFUSED" } });
    assert.equal(f[2]!.state, "fail");
    assert.equal(f[2]!.note, "ECONNREFUSED");
  });

  it("монитор — skill ok «системный монитор» без каталога; навык вне каталога — warn", () => {
    const m = buildPhases({ ...ctx0, run: { ...run, agentName: "system", skill: "fx:refresh", outcome: "executed", skipReason: null }, catalog: null });
    assert.equal(m[1]!.state, "ok");
    assert.match(m[1]!.title, /системный монитор/);
    const w = buildPhases({ ...ctx0, catalog: null });
    assert.equal(w[1]!.state, "warn");
  });

  it("delivery: dead → fail с last_error; всё delivered → ok", () => {
    const dead = buildPhases({ ...ctx0, deliveries: [{ destination: "notion-report", status: "dead", lastError: "401", completedAt: null }] });
    assert.equal(dead[5]!.state, "fail");
    assert.match(dead[5]!.note ?? "", /401/);
    const ok = buildPhases({ ...ctx0, deliveries: [{ destination: "notion-report", status: "delivered", lastError: null, completedAt: new Date() }] });
    assert.equal(ok[5]!.state, "ok");
  });
});

describe("mergeContextless — лента событий и аудита по времени", () => {
  it("сливает и сортирует по at", () => {
    const rows = mergeContextless(
      [{ at: "2026-09-06T03:00:02.000Z", type: "agent.run", payload: {} }],
      [{ at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: "t" }],
    );
    assert.deepEqual(rows.map((r) => r.at), ["2026-09-06T03:00:01.000Z", "2026-09-06T03:00:02.000Z"]);
  });
});
```

- [ ] **Step 4: Реализация фаз и сервиса**

```ts
// apps/core/src/routines/flows.ts
import { RUN_SKIP_REASONS, isSkipReason } from "@mydon/shared";
import type { AgentRunRow } from "./runs.service";

export type PhaseState = "ok" | "warn" | "fail" | "skip";
export type PhaseName = "trigger" | "skill" | "proposal" | "approval" | "execution" | "delivery";
export interface FlowPhase { name: PhaseName; state: PhaseState; at?: string; title: string; note?: string; href?: string }

export interface FlowContext {
  run: AgentRunRow;
  catalog: { executor: string; tier: string | null } | null;
  task: { id: string; status: string } | null;
  execution: { id: string; status: string; committedAt: Date | null; abandonReason: string | null } | null;
  approval: { id: string; decision: string; decidedAt: Date | null; tier: string; createdAt: Date } | null;
  deliveries: { destination: string; status: string; lastError: string | null; completedAt: Date | null }[];
}

const hhmm = (d: Date): string => d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });

export function buildPhases(c: FlowContext): FlowPhase[] {
  const r = c.run;
  const trigger: FlowPhase =
    r.trigger === "cron"
      ? { name: "trigger", state: "ok", at: (r.scheduledAt ?? r.startedAt).toISOString(), title: `cron ${r.cron ?? "?"}${r.scheduledAt ? ` · план ${hhmm(r.scheduledAt)}` : ""}` }
      : r.trigger === "manual"
        ? { name: "trigger", state: "ok", at: r.startedAt.toISOString(), title: "вручную с деки навыков" }
        : { name: "trigger", state: "ok", at: r.startedAt.toISOString(), title: `задача ${r.taskId ? r.taskId.slice(0, 8) : "?"}${r.cron ? ` · cron ${r.cron}` : ""}` };

  const skill: FlowPhase =
    r.agentName === "system"
      ? { name: "skill", state: "ok", title: `${r.skill} · системный монитор` }
      : c.catalog
        ? { name: "skill", state: "ok", title: `${r.skill} · ${c.catalog.executor}${c.catalog.tier ? ` · ${c.catalog.tier}` : ""}` }
        : { name: "skill", state: "warn", title: r.skill, note: "навык не в каталоге — агенты не отчитались о нём" };

  let proposal: FlowPhase;
  if (r.outcome === "failed") proposal = { name: "proposal", state: "fail", at: r.finishedAt.toISOString(), title: "сбой", note: r.reason };
  else if (r.outcome === "skipped") {
    const note = r.skipReason === "hook_blocked" ? `хук ${r.hook ?? "?"}: ${r.reason}` : isSkipReason(r.skipReason) ? RUN_SKIP_REASONS[r.skipReason].label : r.reason;
    proposal = { name: "proposal", state: "skip", at: r.finishedAt.toISOString(), title: "предложения нет", note };
  } else proposal = { name: "proposal", state: "ok", at: r.finishedAt.toISOString(), title: r.action ?? "предложение", ...(r.action ? {} : { note: r.reason }) };

  let approval: FlowPhase;
  if (c.approval) {
    const a = c.approval;
    approval =
      a.decision === "pending"
        ? { name: "approval", state: "warn", at: a.createdAt.toISOString(), title: `ждёт решения с ${hhmm(a.createdAt)} · ${a.tier}`, href: "/inbox" }
        : a.decision === "approved"
          ? { name: "approval", state: "ok", at: (a.decidedAt ?? a.createdAt).toISOString(), title: `одобрено · ${a.tier}` }
          : { name: "approval", state: "fail", at: (a.decidedAt ?? a.createdAt).toISOString(), title: `${a.decision} · ${a.tier}` };
  } else approval = { name: "approval", state: "skip", title: r.outcome === "executed" ? "без согласования (T0/T1)" : "согласования не было" };

  let execution: FlowPhase;
  if (c.execution) {
    const e = c.execution;
    const href = c.task ? `/tasks/${c.task.id}` : undefined;
    execution =
      e.status === "committed"
        ? { name: "execution", state: "ok", ...(e.committedAt ? { at: e.committedAt.toISOString() } : {}), title: "результат зафиксирован Core", ...(href ? { href } : {}) }
        : e.status === "blocked" || e.status === "abandoned"
          ? { name: "execution", state: "fail", title: e.status, ...(e.abandonReason ? { note: e.abandonReason } : {}), ...(href ? { href } : {}) }
          : { name: "execution", state: "warn", title: `выполнение: ${e.status}`, ...(href ? { href } : {}) };
  } else if (r.outcome === "executed") execution = { name: "execution", state: "ok", at: r.finishedAt.toISOString(), title: "выполнено напрямую" };
  else execution = { name: "execution", state: "skip", title: "выполнения не было", ...(c.task ? { href: `/tasks/${c.task.id}` } : {}) };

  let delivery: FlowPhase;
  if (c.deliveries.length === 0) delivery = { name: "delivery", state: "skip", title: "нет доставок" };
  else {
    const bad = c.deliveries.find((d) => d.status === "failed" || d.status === "dead");
    const open = c.deliveries.find((d) => d.status === "pending" || d.status === "claimed" || d.status === "dispatching");
    const list = c.deliveries.map((d) => `${d.destination} ${d.status === "delivered" ? "✓" : d.status}`).join(", ");
    delivery = bad
      ? { name: "delivery", state: "fail", title: list, ...(bad.lastError ? { note: bad.lastError } : {}) }
      : open
        ? { name: "delivery", state: "warn", title: list }
        : { name: "delivery", state: "ok", title: list };
  }
  return [trigger, skill, proposal, approval, execution, delivery];
}

export interface TimelineRow { at: string; kind: "event" | "audit"; title: string; detail?: unknown }
export function mergeContextless(
  events: { at: string; type: string; payload: unknown }[],
  audit: { at: string; action: string; actorRef: string | null; target: string | null }[],
): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...events.map((e) => ({ at: e.at, kind: "event" as const, title: e.type, detail: e.payload })),
    ...audit.map((a) => ({ at: a.at, kind: "audit" as const, title: `${a.action}${a.actorRef ? ` · ${a.actorRef}` : ""}`, ...(a.target ? { detail: a.target } : {}) })),
  ];
  return rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
```

`flows.service.ts`: `summary(row)` → `FlowSummary`; `list(filter)` → `runs.list` + map; `playback(id)`: `runs.byId` (нет → `NotFoundException`), затем параллельно: каталог (`agentSkillCatalog` where agentName & skill; для `system` не запрашивать), задача (`task` by id) и последняя `taskAgentExecution` по `taskId` (`orderBy desc(startedAt)`, limit 1), согласование по `run.approvalId ?? execution.approvalId`, доставки `outboxDelivery` where `taskAgentExecutionId = execution.id`, события `event` where `source = agent:<agentName>` (для мониторов — `agent:system`) и `occurredAt` в `[startedAt − 1 с, finishedAt + 1 с]` (limit 50, asc), аудит `auditLog` where `target in (taskId, approvalId)` (пропустить, если оба null; limit 50, asc по ts). Вернуть `{ run: {...summary, cron, scheduledAt, review, requestKey}, phases: buildPhases(ctx), events, audit }` (панель сама сливает ленту `mergeContextless`; Core отдаёт раздельно, чтобы не терять тип).

Контроллер: `@Get("board")` → `board.board()`; `@Get("flows")` (query `agent`, `skill`, `outcome`, `limit`) → `{ runs }`; `@Get("flows/:id")` → playback. Модуль: `imports: [SystemModule]`, `providers: [RunsService, BoardService, FlowsService]`.

- [ ] **Step 5: Гейт**

Run: `pnpm --filter @mydon/core build && pnpm --filter @mydon/core test 2>&1 | grep -E "^# (pass|fail)"` — fail 0.

- [ ] **Step 6: Коммит**

```bash
git add apps/core/src/routines
git commit -m "feat(core): доска рутин (/routines/board) и плейбэк прогона (/routines/flows) — croner nextRun, фазы из журнала и таблиц Core (волна R)"
```

---

### Task 5: Рантайм агентов — журнал прогонов, снимок расписаний, мониторы под журналом

**Files:**
- Modify: `apps/agents/src/core-client.ts` (методы `reportRun`, `putScheduleSnapshot`, `lastRun`, `listRuns`; поле `hooks?: unknown` в строке `listAgents()`)
- Create: `apps/agents/src/run-journal.ts` + `run-journal.test.ts`
- Create: `apps/agents/src/schedule-snapshot.ts` + `schedule-snapshot.test.ts`
- Create: `apps/agents/src/monitors.ts` + `monitors.test.ts`
- Modify: `apps/agents/src/skills.ts` (`SkillRunContext.trigger?: RunTrigger`)
- Modify: `apps/agents/src/runner.ts` (`RunResult.skipReason: SkipReason`, `hook?: string`, `review?: string` — типы из `@mydon/shared`)
- Modify: `apps/agents/src/index.ts` (cron-колбэк: `trigger: "cron"` + журнал; `reconcileSchedules` → пуш снимка; шесть мониторов через `journaledMonitor`; пуш снимка после мониторов)
- Modify: `apps/agents/src/task-worker.ts` (журнал после commit/release/skip)

**Interfaces:**
- Consumes: `POST /routines/runs`, `PUT /routines/snapshot`, `GET /routines/runs/last`, `GET /routines/runs` (Task 3); `RunOutcome`, `SkipReason`, `RunTrigger` (Task 1).
- Produces:
  - `AgentsCoreClient.reportRun(input: ReportRunInput): Promise<{ id: string; created: boolean }>`
  - `AgentsCoreClient.putScheduleSnapshot(s: ScheduleSnapshot): Promise<{ storedAt: string }>`
  - `AgentsCoreClient.lastRun(agent, skill): Promise<AgentRunView | null>` и `listRuns(agent, skill, limit): Promise<AgentRunView[]>` (нужны Task 6)
  - `reportRun(core, entry): Promise<void>` (никогда не бросает), `journalFromRunResult(...)`
  - `buildScheduleSnapshot(input): ScheduleSnapshot`, `journaledMonitor(name, cron, core, fn)`
  - `SkillRunContext.trigger` (Task 6 читает для quiet_hours).

- [ ] **Step 1: Тесты**

```ts
// apps/agents/src/run-journal.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journalFromRunResult, reportRun, type RunJournalEntry } from "./run-journal";

const entry: RunJournalEntry = {
  agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
  scheduledAt: "2026-09-06T03:00:00.000Z", requestKey: "k1", startedAt: "2026-09-06T03:00:01.000Z",
  finishedAt: "2026-09-06T03:00:02.000Z", outcome: "skipped", skipReason: "no_signal", reason: "повода нет",
};

describe("reportRun — журнал никогда не блокирует навык (Р-1)", () => {
  it("успех → один вызов Core", async () => {
    const calls: unknown[] = [];
    const core = { reportRun: async (e: unknown) => { calls.push(e); return { id: "r", created: true }; } };
    await reportRun(core, entry);
    assert.equal(calls.length, 1);
  });
  it("ошибка Core → warn, без исключения", async () => {
    const warns: string[] = [];
    const orig = console.warn; console.warn = (m: string) => { warns.push(String(m)); };
    try {
      await reportRun({ reportRun: async () => { throw new Error("ECONNREFUSED"); } }, entry);
    } finally { console.warn = orig; }
    assert.equal(warns.length, 1);
    assert.match(warns[0]!, /\[journal\]/);
  });
});

describe("journalFromRunResult", () => {
  const started = new Date("2026-09-06T03:00:01.000Z");
  it("skipped + hook → hook_blocked с именем хука; approvalId/action переносятся", () => {
    const e = journalFromRunResult(
      { agent: "a", skill: "s", outcome: "skipped", skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы" },
      { trigger: "cron", cron: "0 8 * * *", scheduledAt: new Date("2026-09-06T03:00:00.000Z"), requestKey: "k", startedAt: started, finishedAt: new Date(started.getTime() + 500) },
    );
    assert.equal(e.hook, "quiet_hours");
    assert.equal(e.skipReason, "hook_blocked");
    const ok = journalFromRunResult(
      { agent: "a", skill: "s", outcome: "approval_requested", approvalId: "11111111-1111-4111-8111-111111111111", action: "Пополнить", reason: "предложено", review: "три подряд" },
      { trigger: "task", taskId: "22222222-2222-4222-8222-222222222222", requestKey: "k", startedAt: started, finishedAt: started },
    );
    assert.equal(ok.approvalId, "11111111-1111-4111-8111-111111111111");
    assert.equal(ok.taskId, "22222222-2222-4222-8222-222222222222");
    assert.equal(ok.action, "Пополнить");
    assert.equal(ok.review, "три подряд");
    assert.equal(ok.skipReason, undefined);
  });
  it("ошибка → failed с сообщением", () => {
    const e = journalFromRunResult(new Error("boom"), { trigger: "cron", requestKey: "k", startedAt: started, finishedAt: started, agentName: "a", skill: "s" });
    assert.equal(e.outcome, "failed");
    assert.equal(e.reason, "boom");
  });
});
```

```ts
// apps/agents/src/schedule-snapshot.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildScheduleSnapshot } from "./schedule-snapshot";

describe("buildScheduleSnapshot (R-R-2)", () => {
  it("собирает задания, не подключённые с причиной и мониторы", () => {
    const s = buildScheduleSnapshot({
      now: new Date("2026-09-06T03:00:00.000Z"),
      jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *" }],
      modeOf: () => "legacy",
      notWired: ["vendhub-ceo/weekly-review", "x/y"],
      isLlmSkill: (skill) => skill === "weekly-review",
      monitors: [{ name: "fx:refresh", cron: "5 9 * * *", enabled: true }, { name: "ourvend:sync", cron: "0 */3 * * *", enabled: false, reason: "no_credentials" }],
      paused: { schedules: true, tasks: false },
    });
    assert.equal(s.tz, "Asia/Tashkent");
    assert.equal(s.generatedAt, "2026-09-06T03:00:00.000Z");
    assert.deepEqual(s.jobs, [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" }]);
    assert.deepEqual(s.notWired, [
      { agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" },
      { agent: "x", skill: "y", reason: "no_implementation" },
    ]);
    assert.equal(s.monitors[1]!.reason, "no_credentials");
    assert.deepEqual(s.paused, { schedules: true, tasks: false });
  });
});
```

```ts
// apps/agents/src/monitors.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journaledMonitor, monitorRequestKey } from "./monitors";

describe("journaledMonitor (R-R-6)", () => {
  const occurrence = new Date("2026-09-06T04:00:00.000Z");
  it("успех → executed с итоговой строкой, requestKey от occurrence", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("fx:refresh", "5 9 * * *", core, async () => "[fx:refresh] обновлено: USD");
    await run(occurrence);
    assert.equal(entries[0]!.agentName, "system");
    assert.equal(entries[0]!.skill, "fx:refresh");
    assert.equal(entries[0]!.outcome, "executed");
    assert.equal(entries[0]!.reason, "[fx:refresh] обновлено: USD");
    assert.equal(entries[0]!.requestKey, monitorRequestKey("fx:refresh", "5 9 * * *", occurrence));
    assert.equal(entries[0]!.scheduledAt, occurrence.toISOString());
  });
  it("исключение → failed, и ошибка не всплывает наружу", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("coffee:monitor", "0 7 * * *", core, async () => { throw new Error("db down"); });
    await run(occurrence);
    assert.equal(entries[0]!.outcome, "failed");
    assert.equal(entries[0]!.reason, "db down");
  });
  it("падение журнала не роняет монитор", async () => {
    const core = { reportRun: async () => { throw new Error("core down"); } };
    let ran = false;
    const run = journaledMonitor("x", "* * * * *", core, async () => { ran = true; return "ok"; });
    await run(occurrence);
    assert.equal(ran, true);
  });
});
```

- [ ] **Step 2: Убедиться, что падает** — `pnpm --filter @mydon/agents build 2>&1 | tail -3`.

- [ ] **Step 3: Реализация**

```ts
// apps/agents/src/run-journal.ts
import type { RunOutcome, RunTrigger, SkipReason } from "@mydon/shared";

export interface RunJournalEntry {
  agentName: string; skill: string; trigger: RunTrigger; cron?: string; scheduledAt?: string;
  requestKey: string; traceKey?: string; taskId?: string; approvalId?: string;
  startedAt: string; finishedAt: string; outcome: RunOutcome; skipReason?: SkipReason; hook?: string;
  reason: string; action?: string; review?: string;
}
export interface RunJournalClient { reportRun(entry: RunJournalEntry): Promise<{ id: string; created: boolean }> }

/** Журнал — best effort: ошибка записи не должна стоить прогона (Р-1). */
export async function reportRun(core: RunJournalClient, entry: RunJournalEntry): Promise<void> {
  try {
    await core.reportRun(entry);
  } catch (err) {
    console.warn(`[journal] прогон ${entry.agentName}/${entry.skill} не записан: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface RunLike {
  agent: string; skill: string; outcome: "approval_requested" | "executed" | "skipped";
  skipReason?: SkipReason; hook?: string; reason: string; approvalId?: string; action?: string; review?: string;
}
export interface RunFrame {
  trigger: RunTrigger; cron?: string; scheduledAt?: Date; requestKey: string; traceKey?: string; taskId?: string;
  startedAt: Date; finishedAt: Date;
  /** Для ошибки (без RunResult) — кто запускался. */
  agentName?: string; skill?: string;
}

export function journalFromRunResult(result: RunLike | Error, frame: RunFrame): RunJournalEntry {
  const base = {
    trigger: frame.trigger,
    ...(frame.cron !== undefined ? { cron: frame.cron } : {}),
    ...(frame.scheduledAt !== undefined ? { scheduledAt: frame.scheduledAt.toISOString() } : {}),
    requestKey: frame.requestKey,
    ...(frame.traceKey !== undefined ? { traceKey: frame.traceKey } : {}),
    ...(frame.taskId !== undefined ? { taskId: frame.taskId } : {}),
    startedAt: frame.startedAt.toISOString(),
    finishedAt: frame.finishedAt.toISOString(),
  };
  if (result instanceof Error) {
    return { ...base, agentName: frame.agentName ?? "?", skill: frame.skill ?? "?", outcome: "failed", reason: result.message || String(result) };
  }
  return {
    ...base,
    agentName: result.agent,
    skill: result.skill,
    outcome: result.outcome,
    ...(result.outcome === "skipped" && result.skipReason !== undefined ? { skipReason: result.skipReason } : {}),
    ...(result.skipReason === "hook_blocked" && result.hook !== undefined ? { hook: result.hook } : {}),
    reason: result.reason,
    ...(result.approvalId !== undefined ? { approvalId: result.approvalId } : {}),
    ...(result.action !== undefined ? { action: result.action } : {}),
    ...(result.review !== undefined ? { review: result.review } : {}),
  };
}
```

```ts
// apps/agents/src/schedule-snapshot.ts
import { TZ } from "@mydon/shared";
import type { ScheduledJob, ScheduledInvocationMode } from "./schedule";

export interface MonitorState { name: string; cron: string; enabled: boolean; reason?: "off" | "no_credentials" }
export interface ScheduleSnapshot {
  generatedAt: string; tz: typeof TZ; paused: { schedules: boolean; tasks: boolean };
  jobs: { agent: string; skill: string; cron: string; mode: ScheduledInvocationMode }[];
  notWired: { agent: string; skill: string; reason: "no_implementation" | "llm_route_off" }[];
  monitors: MonitorState[];
}
export interface SnapshotInput {
  now: Date; jobs: readonly ScheduledJob[]; modeOf: (skill: string) => ScheduledInvocationMode;
  notWired: readonly string[]; isLlmSkill: (skill: string) => boolean; monitors: readonly MonitorState[];
  paused: { schedules: boolean; tasks: boolean };
}

export function buildScheduleSnapshot(i: SnapshotInput): ScheduleSnapshot {
  return {
    generatedAt: i.now.toISOString(),
    tz: TZ,
    paused: i.paused,
    jobs: i.jobs.map((j) => ({ agent: j.agent, skill: j.skill, cron: j.cron, mode: i.modeOf(j.skill) })),
    notWired: i.notWired.map((ref) => {
      const at = ref.indexOf("/");
      const agent = ref.slice(0, at), skill = ref.slice(at + 1);
      return { agent, skill, reason: i.isLlmSkill(skill) ? ("llm_route_off" as const) : ("no_implementation" as const) };
    }),
    monitors: i.monitors.map((m) => ({ ...m })),
  };
}
```

```ts
// apps/agents/src/monitors.ts
import { reportRun, type RunJournalClient } from "./run-journal";

export function monitorRequestKey(name: string, cron: string, occurrence: Date): string {
  return `monitor:${name}:${cron}:${occurrence.toISOString()}`;
}

/**
 * Колбэк монитора под журналом (R-R-6): итоговая строка монитора становится
 * `reason`, исключение — `failed`. Журнал best effort, лог как раньше.
 */
export function journaledMonitor(
  name: string, cron: string, core: RunJournalClient, fn: () => Promise<string>,
): (occurrence: Date) => Promise<void> {
  return async (occurrence) => {
    const startedAt = new Date();
    let outcome: "executed" | "failed" = "executed";
    let reason: string;
    try {
      reason = await fn();
      console.log(reason);
    } catch (err) {
      outcome = "failed";
      reason = err instanceof Error ? err.message : String(err);
      console.error(`[${name}] сбой:`, err);
    }
    await reportRun(core, {
      agentName: "system", skill: name, trigger: "cron", cron, scheduledAt: occurrence.toISOString(),
      requestKey: monitorRequestKey(name, cron, occurrence), startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(), outcome, reason,
    });
  };
}
```

`core-client.ts`: добавить рядом с `putSkillCatalog`:

```ts
  reportRun(entry: RunJournalEntry): Promise<{ id: string; created: boolean }> {
    return this.request("/routines/runs", { method: "POST", body: JSON.stringify(entry) });
  }
  putScheduleSnapshot(snapshot: ScheduleSnapshot): Promise<{ storedAt: string }> {
    return this.request("/routines/snapshot", { method: "PUT", body: JSON.stringify(snapshot) });
  }
  async lastRun(agent: string, skill: string): Promise<AgentRunView | null> {
    const r = await this.request<{ run: AgentRunView | null }>(`/routines/runs/last?agent=${encodeURIComponent(agent)}&skill=${encodeURIComponent(skill)}`);
    return r.run;
  }
  async listRuns(agent: string, skill: string, limit = 6): Promise<AgentRunView[]> {
    const r = await this.request<{ runs: AgentRunView[] }>(`/routines/runs?agent=${encodeURIComponent(agent)}&skill=${encodeURIComponent(skill)}&limit=${limit}`);
    return r.runs;
  }
```

`AgentRunView` объявить в `core-client.ts` (те же поля, что `toView` в Core: строки/ISO/null). Импорт типов `RunJournalEntry` из `./run-journal`, `ScheduleSnapshot` из `./schedule-snapshot` (type-only, чтобы не было цикла).

`skills.ts`: в `SkillRunContext` добавить

```ts
  /** Кто запустил: cron (легаси-колбэк или задача из agent-schedule), task (назначенная), manual (дека). Читают хуки (quiet_hours) и журнал. */
  trigger?: RunTrigger;
```

`runner.ts`: `skipReason?: SkipReason` (импорт из `@mydon/shared`; локальный union удалить), добавить `hook?: string` и `review?: string` в `RunResult` с комментариями (хук-блокировка; заметка coach_lite). Существующие значения совпадают со словарём — компиляция не должна сломаться.

`index.ts`, cron-колбэк legacy (строки ~380–400): перед `runSkill` — `const startedAt = new Date()`; передать в контекст `trigger: "cron"`; после `runSkill` — `await reportRun(core, journalFromRunResult(result, { trigger: "cron", cron: j.cron, scheduledAt: occurrence, requestKey, traceKey, startedAt, finishedAt: new Date() }))`; в `catch` — `await reportRun(core, journalFromRunResult(err instanceof Error ? err : new Error(String(err)), { …тот же frame, agentName: j.agent, skill: j.skill }))`. Durable-путь (`pendingScheduledOccurrences.enqueue`) журнал НЕ пишет — его напишет worker при исполнении задачи.

`index.ts`, `reconcileSchedules()`: в конце (после логов о notWired) — `void pushScheduleSnapshot()`, где

```ts
  let monitorStates: MonitorState[] = [];
  async function pushScheduleSnapshot(): Promise<void> {
    const { jobs, notWired } = desiredJobs(agents, (s) => hasCodeSkill(s) || (isLlmSkill(s) && llmCronAdmitted(modelGatewayFromEnv())));
    const snapshot = buildScheduleSnapshot({
      now: new Date(), jobs, notWired, isLlmSkill,
      modeOf: (skill) => scheduledInvocationMode(skill, () => buildTaskLlmWorkflowPlan(skill).steps.length > 0, isLlmSkill),
      monitors: monitorStates, paused: { schedules: schedulesPaused(), tasks: tasksPaused() },
    });
    try { await core.putScheduleSnapshot(snapshot); }
    catch (err) { console.warn("[snapshot] расписания не записаны в Core:", err instanceof Error ? err.message : String(err)); }
  }
```

(Снимок при паузе всё равно перечисляет `jobs` из `desiredJobs` — Р-2.) После блока шести мониторов: заполнить `monitorStates` (`enabled`, `reason: "off"` при `off`, `"no_credentials"` для ourvend без учётки) и вызвать `void pushScheduleSnapshot()` ещё раз.

Шесть мониторов: колбэк `new Cron(expr, {...}, (self) => { const occurrence = self.currentRun() ?? new Date(); void journaled(occurrence); })`, где `journaled = journaledMonitor(name, expr, core, async () => { const r = await runX(core, …); return "<та же строка, что сейчас в console.log>"; })`. Для `ourvend:sync` строка с `journalError` остаётся `console.error` внутри `fn` **и** возвращается как reason с пометкой «ЖУРНАЛ НЕ ЗАКРЫТ» — исход всё равно `executed` (сбор прошёл), как и сейчас. Прежние `console.log/error` внутри колбэков убрать — их печатает `journaledMonitor`.

`task-worker.ts`: `const startedAt = new Date()` перед `runSkill`; в контекст `trigger: t.source === "agent-schedule" ? "cron" : t.source === "skills-deck" ? "manual" : "task"`; frame: `{ trigger: <то же, но "cron" → журнал пишет trigger "task"? НЕТ — пиши как есть: "cron" для agent-schedule (это плановый occurrence), taskId: t.id, scheduledAt: t.due ?? undefined, cron: <из описания задачи строка после "Cron: "> , requestKey: `task:${t.id}:execution:${executionAttemptId}`, traceKey, startedAt, finishedAt: new Date() }`. Вызывать `reportRun` **после** `commitAgentTaskOutcome` (в ветке `run.commit`, включая `capped`/`blocked` — исход остаётся тем, что вернул `runSkill`; `approvalId` из `committed` если Core его отдаёт — проверь тип `commitAgentTaskOutcome`), и в ветке release (`skipped`), и в `catch` (`failed`), но НЕ при `claim === null` и не при `leaseLost` (прогона не было / чужой прогон). Помощник `cronFromDescription(description?: string): string | undefined` — регулярка `/^Cron: (.+)$/m` — с тестом в `task-worker.test.ts` (если файла нет — создать минимальный).

- [ ] **Step 4: Гейт**

Run: `pnpm --filter @mydon/agents build && pnpm --filter @mydon/agents test 2>&1 | grep -E "^# (pass|fail)" && pnpm --filter @mydon/agents check:passports | tail -2` — fail 0.

- [ ] **Step 5: Коммит**

```bash
git add apps/agents/src
git commit -m "feat(agents): журнал прогонов и снимок расписаний в Core, мониторы под журналом (волна R, Р-1…Р-3)"
```

---

### Task 6: Хуки паспорта `hooks.pre_run` / `hooks.post_run`

**Files:**
- Create: `apps/agents/src/hooks.ts` + `hooks.test.ts`
- Modify: `apps/agents/src/registry.ts` (`AgentHooks`, `AgentDefinition.hooks?`, разбор `raw.hooks` через `parseHooks`)
- Modify: `apps/agents/src/index.ts` (`toPassport`/`fromCore` — проброс `hooks`)
- Modify: `apps/agents/src/runner.ts` (обёртка: `runSkill` = pre-хуки → прежнее тело (`runSkillInner`) → post-хуки)
- Modify: `apps/agents/src/check-passports.ts` (+ `hooks` через `parseYaml` и `parseHooks(...).problems`)
- Modify: `apps/agents/agents/_template/config.yaml` (закомментированный пример `hooks`)
- Modify: `apps/agents/src/runner.test.ts` (или новый `runner-hooks.test.ts`): блок хуком в legacy → `skipped/hook_blocked`; в task-режиме → `commit.outcome = "no_signal"` с note = причина

**Interfaces:**
- Consumes: `AgentsCoreClient.lastRun/listRuns` (Task 5), `SkillRunContext.trigger` (Task 5), `RunResult.hook/review` (Task 5).
- Produces:

```ts
export type PreRunHook = { kind: "source_fresh"; run: string; maxAgeHours: number } | { kind: "quiet_hours"; from: string; to: string } | { kind: "unknown"; raw: string };
export type PostRunHook = { kind: "coach_lite" } | { kind: "unknown"; raw: string };
export interface AgentHooks { preRun: PreRunHook[]; postRun: PostRunHook[] }
export function parseHooks(raw: unknown): { hooks: AgentHooks; problems: string[] }
export type HookVerdict = { ok: true } | { ok: false; hook: string; reason: string }
export function runPreRunHooks(hooks: AgentHooks, ctx: { trigger?: RunTrigger; now: Date; core: Pick<AgentsCoreClient, "lastRun"> }): Promise<HookVerdict>
export function runPostRunHooks(hooks: AgentHooks, ctx: { agent: string; skill: string; result: RunResultLite; core: Pick<AgentsCoreClient, "listRuns"> }): Promise<{ review?: string }>
export function inQuietHours(now: Date, from: string, to: string): boolean   // Asia/Tashkent, переход через полночь
export function coachLite(history: RunResultLite[], current: RunResultLite): string | undefined
```

- [ ] **Step 1: Тесты**

```ts
// apps/agents/src/hooks.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coachLite, inQuietHours, parseHooks, runPostRunHooks, runPreRunHooks } from "./hooks";

describe("parseHooks (R-R-4)", () => {
  it("разбирает kinds и параметры, чужой kind → unknown + problem", () => {
    const { hooks, problems } = parseHooks({
      pre_run: [
        { kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 },
        { kind: "quiet_hours", from: "22:00", to: "07:00" },
        { kind: "moon_phase" },
      ],
      post_run: [{ kind: "coach_lite" }, { kind: "telepathy" }],
    });
    assert.equal(hooks.preRun.length, 3);
    assert.deepEqual(hooks.preRun[0], { kind: "source_fresh", run: "system/ourvend:sync", maxAgeHours: 6 });
    assert.deepEqual(hooks.preRun[2], { kind: "unknown", raw: "moon_phase" });
    assert.deepEqual(hooks.postRun[1], { kind: "unknown", raw: "telepathy" });
    assert.equal(problems.length, 2);
    assert.match(problems[0]!, /moon_phase/);
  });
  it("битые параметры → problems, хук помечен unknown", () => {
    const { hooks, problems } = parseHooks({ pre_run: [{ kind: "source_fresh", run: "nope", max_age_hours: 0 }, { kind: "quiet_hours", from: "25:00", to: "x" }] });
    assert.equal(hooks.preRun.every((h) => h.kind === "unknown"), true);
    assert.equal(problems.length >= 2, true);
  });
  it("нет раздела → пусто без problems", () => {
    const { hooks, problems } = parseHooks(undefined);
    assert.deepEqual(hooks, { preRun: [], postRun: [] });
    assert.equal(problems.length, 0);
  });
});

describe("inQuietHours — Ташкент, переход через полночь", () => {
  it("23:30 Ташкента (18:30Z) внутри 22:00–07:00; 12:00 — нет; 06:59 — да; 07:00 — нет", () => {
    assert.equal(inQuietHours(new Date("2026-09-06T18:30:00.000Z"), "22:00", "07:00"), true);
    assert.equal(inQuietHours(new Date("2026-09-06T07:00:00.000Z"), "22:00", "07:00"), false);
    assert.equal(inQuietHours(new Date("2026-09-06T01:59:00.000Z"), "22:00", "07:00"), true);
    assert.equal(inQuietHours(new Date("2026-09-06T02:00:00.000Z"), "22:00", "07:00"), false);
    assert.equal(inQuietHours(new Date("2026-09-06T08:00:00.000Z"), "12:00", "14:00"), true); // 13:00 Ташкент
  });
});

describe("runPreRunHooks", () => {
  const now = new Date("2026-09-06T03:00:00.000Z");
  const fresh = { id: "r", agentName: "system", skill: "ourvend:sync", outcome: "executed", finishedAt: "2026-09-06T01:00:00.000Z" };
  it("source_fresh: свежий executed → ok; старый → блок с часами; нет прогона → блок; ошибка Core → блок", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }] }).hooks;
    assert.deepEqual(await runPreRunHooks(hooks, { trigger: "cron", now, core: { lastRun: async () => fresh as never } }), { ok: true });
    const old = await runPreRunHooks(hooks, { trigger: "cron", now, core: { lastRun: async () => ({ ...fresh, finishedAt: "2026-09-05T03:00:00.000Z" }) as never } });
    assert.equal(old.ok, false);
    assert.match((old as { reason: string }).reason, /24 ч .*порог 6/);
    const none = await runPreRunHooks(hooks, { trigger: "cron", now, core: { lastRun: async () => null } });
    assert.equal(none.ok, false);
    const down = await runPreRunHooks(hooks, { trigger: "cron", now, core: { lastRun: async () => { throw new Error("x"); } } });
    assert.equal(down.ok, false);
    assert.match((down as { reason: string }).reason, /журнал недоступен/);
  });
  it("quiet_hours: блок только для cron; manual проходит", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }] }).hooks;
    const night = new Date("2026-09-06T18:30:00.000Z");
    const blocked = await runPreRunHooks(hooks, { trigger: "cron", now: night, core: { lastRun: async () => null } });
    assert.equal(blocked.ok, false);
    assert.equal((blocked as { hook: string }).hook, "quiet_hours");
    assert.deepEqual(await runPreRunHooks(hooks, { trigger: "manual", now: night, core: { lastRun: async () => null } }), { ok: true });
  });
  it("unknown kind → блок «неизвестный хук»", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "moon_phase" }] }).hooks;
    const v = await runPreRunHooks(hooks, { trigger: "cron", now, core: { lastRun: async () => null } });
    assert.equal(v.ok, false);
    assert.match((v as { reason: string }).reason, /неизвестный хук moon_phase/);
  });
});

describe("coachLite — правила по серии (без LLM)", () => {
  const r = (outcome: string, skipReason?: string) => ({ outcome, skipReason: skipReason ?? null, reason: "" });
  it("3 llm-сбоя подряд", () => {
    assert.match(coachLite([r("skipped", "llm_failed"), r("skipped", "llm_invalid_output")], r("skipped", "llm_failed")) ?? "", /LLM-маршрут падает 3/);
  });
  it("5 тихих подряд", () => {
    const h = Array.from({ length: 4 }, () => r("skipped", "no_signal"));
    assert.match(coachLite(h, r("skipped", "no_signal")) ?? "", /пять тихих/);
    assert.equal(coachLite(h.slice(1), r("skipped", "no_signal")), undefined);
  });
  it("3 предложения подряд; сбой дважды подряд", () => {
    assert.match(coachLite([r("approval_requested"), r("approval_requested")], r("approval_requested")) ?? "", /три предложения/);
    assert.match(coachLite([r("failed")], { outcome: "failed", skipReason: null, reason: "boom" }) ?? "", /второй раз подряд: boom/);
  });
  it("история новее→старее: обрывается на первом несовпадении", () => {
    assert.equal(coachLite([r("executed"), r("skipped", "no_signal"), r("skipped", "no_signal"), r("skipped", "no_signal"), r("skipped", "no_signal")], r("skipped", "no_signal")), undefined);
  });
});

describe("runPostRunHooks", () => {
  it("coach_lite читает историю и отдаёт review; ошибка Core → без review, без исключения", async () => {
    const hooks = parseHooks({ post_run: [{ kind: "coach_lite" }] }).hooks;
    const history = Array.from({ length: 4 }, () => ({ outcome: "skipped", skipReason: "no_signal", reason: "" }));
    const r = await runPostRunHooks(hooks, { agent: "a", skill: "s", result: { outcome: "skipped", skipReason: "no_signal", reason: "" }, core: { listRuns: async () => history as never } });
    assert.match(r.review ?? "", /пять тихих/);
    const down = await runPostRunHooks(hooks, { agent: "a", skill: "s", result: { outcome: "skipped", skipReason: "no_signal", reason: "" }, core: { listRuns: async () => { throw new Error("x"); } } });
    assert.equal(down.review, undefined);
  });
});
```

- [ ] **Step 2: Убедиться, что падает** — `pnpm --filter @mydon/agents build 2>&1 | tail -2`.

- [ ] **Step 3: Реализация**

```ts
// apps/agents/src/hooks.ts
import { tashkentHour, tashkentMinute, type RunTrigger, type SkipReason } from "@mydon/shared";

export type PreRunHook =
  | { kind: "source_fresh"; run: string; maxAgeHours: number }
  | { kind: "quiet_hours"; from: string; to: string }
  | { kind: "unknown"; raw: string };
export type PostRunHook = { kind: "coach_lite" } | { kind: "unknown"; raw: string };
export interface AgentHooks { preRun: PreRunHook[]; postRun: PostRunHook[] }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const RUN_REF = /^[a-z0-9_-]+\/[a-z0-9:_-]+$/i;

/** Разбор `hooks:` паспорта. Чужой kind не отбрасываем, а помечаем unknown: pre_run с ним блокирует навык (Р-4). */
export function parseHooks(raw: unknown): { hooks: AgentHooks; problems: string[] } {
  const problems: string[] = [];
  const hooks: AgentHooks = { preRun: [], postRun: [] };
  if (raw === undefined || raw === null) return { hooks, problems };
  if (typeof raw !== "object" || Array.isArray(raw)) return { hooks, problems: ["hooks: ожидается объект с pre_run/post_run"] };
  const o = raw as Record<string, unknown>;
  const list = (v: unknown, name: string): Record<string, unknown>[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) { problems.push(`hooks.${name}: ожидается список`); return []; }
    return v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  };
  for (const h of list(o.pre_run, "pre_run")) {
    const kind = String(h.kind ?? "");
    if (kind === "source_fresh") {
      const run = typeof h.run === "string" ? h.run : "";
      const hours = typeof h.max_age_hours === "number" ? h.max_age_hours : NaN;
      if (!RUN_REF.test(run)) problems.push(`hooks.pre_run source_fresh: run должен быть вида agent/skill, получено «${run}»`);
      if (!(hours > 0)) problems.push("hooks.pre_run source_fresh: max_age_hours должен быть > 0");
      hooks.preRun.push(RUN_REF.test(run) && hours > 0 ? { kind, run, maxAgeHours: hours } : { kind: "unknown", raw: kind });
    } else if (kind === "quiet_hours") {
      const from = String(h.from ?? ""), to = String(h.to ?? "");
      if (!HHMM.test(from) || !HHMM.test(to)) problems.push(`hooks.pre_run quiet_hours: from/to в формате HH:MM, получено «${from}»–«${to}»`);
      hooks.preRun.push(HHMM.test(from) && HHMM.test(to) ? { kind, from, to } : { kind: "unknown", raw: kind });
    } else {
      problems.push(`hooks.pre_run: неизвестный kind «${kind}» — навык будет блокироваться`);
      hooks.preRun.push({ kind: "unknown", raw: kind });
    }
  }
  for (const h of list(o.post_run, "post_run")) {
    const kind = String(h.kind ?? "");
    if (kind === "coach_lite") hooks.postRun.push({ kind });
    else { problems.push(`hooks.post_run: неизвестный kind «${kind}» — будет пропущен`); hooks.postRun.push({ kind: "unknown", raw: kind }); }
  }
  return { hooks, problems };
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Попадание в интервал по Ташкенту; `from > to` — интервал через полночь; `to` не включается. */
export function inQuietHours(now: Date, from: string, to: string): boolean {
  const cur = tashkentHour(now) * 60 + Number(tashkentMinute(now));
  const a = minutes(from), b = minutes(to);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

export type HookVerdict = { ok: true } | { ok: false; hook: string; reason: string };
interface LastRunLite { outcome: string; finishedAt: string }

export async function runPreRunHooks(
  hooks: AgentHooks,
  ctx: { trigger?: RunTrigger; now: Date; core: { lastRun(agent: string, skill: string): Promise<LastRunLite | null> } },
): Promise<HookVerdict> {
  for (const h of hooks.preRun) {
    if (h.kind === "unknown") return { ok: false, hook: h.raw || "?", reason: `неизвестный хук ${h.raw || "?"} — не угадываю, не запускаю` };
    if (h.kind === "quiet_hours") {
      if (ctx.trigger === "manual") continue; // владелец нажал сам
      if (inQuietHours(ctx.now, h.from, h.to)) return { ok: false, hook: h.kind, reason: `тихие часы ${h.from}–${h.to}` };
      continue;
    }
    // source_fresh
    const at = h.run.indexOf("/");
    let last: LastRunLite | null;
    try {
      last = await ctx.core.lastRun(h.run.slice(0, at), h.run.slice(at + 1));
    } catch (err) {
      return { ok: false, hook: h.kind, reason: `журнал недоступен — свежесть ${h.run} не подтверждена (${err instanceof Error ? err.message : String(err)})` };
    }
    if (!last || last.outcome !== "executed") return { ok: false, hook: h.kind, reason: `источник ${h.run} ещё не отработал успешно` };
    const ageH = (ctx.now.getTime() - new Date(last.finishedAt).getTime()) / 3_600_000;
    if (ageH > h.maxAgeHours) return { ok: false, hook: h.kind, reason: `источник ${h.run} не обновлялся ${Math.round(ageH)} ч (порог ${h.maxAgeHours})` };
  }
  return { ok: true };
}

export interface RunResultLite { outcome: string; skipReason: SkipReason | string | null; reason: string }

/** «Коуч-лайт» по серии прогонов (новые первыми в history). Только правила — без LLM. */
export function coachLite(history: RunResultLite[], current: RunResultLite): string | undefined {
  const seq = [current, ...history];
  const streak = (pred: (r: RunResultLite) => boolean): number => { let n = 0; for (const r of seq) { if (!pred(r)) break; n += 1; } return n; };
  const llm = streak((r) => r.outcome === "skipped" && (r.skipReason === "llm_failed" || r.skipReason === "llm_invalid_output"));
  if (llm >= 3) return `LLM-маршрут падает ${llm} прогона подряд — проверь ключ/модель в /system`;
  if (streak((r) => r.outcome === "skipped" && r.skipReason === "no_signal") >= 5) return "пять тихих прогонов подряд — расписание можно проредить";
  if (streak((r) => r.outcome === "approval_requested") >= 3) return "три предложения подряд ждут решения — владелец не отвечает или предложение повторяется";
  if (streak((r) => r.outcome === "failed") >= 2) return `сбой второй раз подряд: ${current.reason}`;
  return undefined;
}

export async function runPostRunHooks(
  hooks: AgentHooks,
  ctx: { agent: string; skill: string; result: RunResultLite; core: { listRuns(agent: string, skill: string, limit: number): Promise<RunResultLite[]> } },
): Promise<{ review?: string }> {
  let review: string | undefined;
  for (const h of hooks.postRun) {
    if (h.kind === "unknown") { console.warn(`[hooks] ${ctx.agent}/${ctx.skill}: неизвестный post_run «${h.raw}» пропущен`); continue; }
    try {
      const history = await ctx.core.listRuns(ctx.agent, ctx.skill, 5);
      review = coachLite(history, ctx.result) ?? review;
    } catch (err) {
      console.warn(`[hooks] coach_lite ${ctx.agent}/${ctx.skill}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return review === undefined ? {} : { review };
}
```

`registry.ts`: `export type { AgentHooks }` (реэкспорт из hooks) и `AgentDefinition.hooks?: AgentHooks`; в разборе паспорта — `const parsedHooks = parseHooks(raw.hooks); if (parsedHooks.problems.length) errors.push(...)? НЕТ` — problems в registry только `console.warn` (паспорт валиден; блокировать будет рантайм), в объект — `...(parsedHooks.hooks.preRun.length || parsedHooks.hooks.postRun.length ? { hooks: parsedHooks.hooks } : {})`.

`index.ts`: `toPassport` → `...(a.hooks !== undefined ? { hooks: a.hooks } : {})`; `fromCore` → `hooks` из `row.hooks` через `hooksFromCore(raw: unknown): AgentHooks | undefined` (форма в базе — уже разобранная `{preRun, postRun}`; принять её как есть с проверкой типов kind; пустая → undefined). Строка типа `listAgents()` в core-client: `hooks?: unknown`.

`runner.ts`: переименовать текущую `runSkill` в `runSkillInner` (не экспортировать) и добавить:

```ts
export async function runSkill(agent, skill, core, threshold, skillFloor?, invocation?): Promise<RunResult> {
  const hooks = agent.hooks;
  if (hooks && hooks.preRun.length > 0 && agent.status === "active") {
    const verdict = await runPreRunHooks(hooks, { ...(invocation?.trigger ? { trigger: invocation.trigger } : {}), now: new Date(), core });
    if (!verdict.ok) {
      const note = `Не запускал: ${verdict.reason}.`;
      return {
        agent: agent.name, skill, outcome: "skipped", skipReason: "hook_blocked", hook: verdict.hook, reason: verdict.reason,
        // Core не знает kind hook_blocked (§7 спеки): task-режим коммитит как no_signal с причиной хука.
        ...(invocation?.task ? { commit: { outcome: "no_signal", note } } : {}),
      };
    }
  }
  const result = await runSkillInner(agent, skill, core, threshold, skillFloor, invocation);
  if (hooks && hooks.postRun.length > 0) {
    const { review } = await runPostRunHooks(hooks, { agent: agent.name, skill, result: { outcome: result.outcome, skipReason: result.skipReason ?? null, reason: result.reason }, core });
    return review === undefined ? result : { ...result, review };
  }
  return result;
}
```

Проверь, что тип `commit` у `RunResult` допускает `{ outcome: "no_signal", note }` (так уже возвращает ветка no_signal). `check-passports.ts`: в `checkPassport` добавить параметр `hooksRaw?: unknown` → `problems.push(...parseHooks(hooksRaw).problems)`; вызывающий код читает `hooks` через `parseYaml(fs.readFileSync(configPath))` (`yaml` уже зависимость `apps/agents`). Шаблон `_template/config.yaml` — после `skills: []`:

```yaml
# Хуки прогона (волна R). pre_run проверяется перед навыком, первый провал = пропуск с причиной
# в журнале (/flows). Неизвестный kind БЛОКИРУЕТ навык — не угадываем.
# hooks:
#   pre_run:
#     - kind: source_fresh          # источник обновлялся не позже N часов (executed-прогон из журнала)
#       run: system/ourvend:sync
#       max_age_hours: 6
#     - kind: quiet_hours           # не запускать ночью (Asia/Tashkent); ручной запуск с деки проходит
#       from: "22:00"
#       to: "07:00"
#   post_run:
#     - kind: coach_lite            # заметка по серии прогонов (3 llm-сбоя, 5 тихих, 3 предложения, 2 сбоя)
```

- [ ] **Step 4: Гейт**

Run: `pnpm --filter @mydon/agents build && pnpm --filter @mydon/agents test 2>&1 | grep -E "^# (pass|fail)" && pnpm --filter @mydon/agents check:passports | tail -3` — fail 0, паспорта без новых problems.

- [ ] **Step 5: Коммит**

```bash
git add apps/agents/src apps/agents/agents/_template/config.yaml
git commit -m "feat(agents): хуки паспорта pre_run (source_fresh, quiet_hours) и post_run (coach_lite) вокруг runSkill; неизвестный kind блокирует (волна R, Р-4)"
```

---

### Task 7: Панель — `/crons` (доска), тумблеры паузы, виджет «Ближайшие 24 ч» на главной

**Files:**
- Modify: `apps/cc/src/lib/core.ts` (типы `CronBoard`, `CronBoardJob`, `FlowSummary`, `FlowPhase`, `FlowPlayback`; методы `cronBoard`, `flows`, `flow`; `AgentCard.hooks`)
- Create: `apps/cc/src/lib/crons.ts` + `crons.test.ts`
- Create: `apps/cc/src/app/crons/page.tsx` + `page.test.tsx`
- Create: `apps/cc/src/components/pause-toggles.tsx` + `pause-toggles.test.tsx`
- Create: `apps/cc/src/components/upcoming-runs.tsx`
- Modify: `apps/cc/src/app/mydon/page.tsx` (виджет под тревогами, try/catch)
- Modify: `apps/cc/src/components/nav.tsx` (SYSTEM: «Рутины» `/crons`, «Прогоны» `/flows` — после «Мозг»), `icons.tsx` (иконка `clock`)
- Modify: `apps/cc/src/app/globals.css` (`.runs-strip`, `.run-led.*`, `.crons-table`)

**Interfaces:**
- Consumes: `GET /routines/board` (Task 4), `saveSystemConfig` (`apps/cc/src/app/system/actions.ts`), `RUN_SKIP_REASONS`, `RUN_OUTCOME_LABELS`, `describeRun` (`@mydon/shared`).
- Produces: `core.cronBoard(): Promise<CronBoard>`, `core.flows(params): Promise<{ runs: FlowSummary[] }>`, `core.flow(id): Promise<FlowPlayback>`; чистые `groupUpcoming(board, now)`, `outcomeTone(last)`, `describeLast(last)`, `hhmm(iso)`, `dayLabel(iso, now)`.

- [ ] **Step 1: Тесты чистых функций**

```ts
// apps/cc/src/lib/crons.test.ts
import { describe, expect, it } from "vitest";
import type { CronBoard } from "./core";
import { describeLast, groupUpcoming, hhmm, outcomeTone } from "./crons";

const board: CronBoard = {
  tz: "Asia/Tashkent", now: "2026-09-06T03:10:00.000Z",
  snapshot: { generatedAt: "2026-09-06T03:05:00.000Z", ageSec: 300, stale: false },
  paused: { schedules: false, tasks: true },
  jobs: [
    { id: "system/ourvend:sync", kind: "monitor", agent: "system", skill: "ourvend:sync", cron: "0 */3 * * *", mode: "monitor", enabled: true, paused: false, nextRun: "2026-09-06T04:00:00.000Z", last: { at: "2026-09-06T01:00:00.000Z", outcome: "executed", skipReason: null, hook: null, reason: "автоматов 26/26", runId: "r1" } },
    { id: "vendhub-ops/monitor-stock", kind: "skill", agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy", enabled: true, paused: false, nextRun: "2026-09-07T03:00:00.000Z", last: null },
  ],
  upcoming24h: [
    { at: "2026-09-06T04:00:00.000Z", jobId: "system/ourvend:sync" },
    { at: "2026-09-06T19:00:00.000Z", jobId: "system/ourvend:sync" },   // 00:00 завтра по Ташкенту
    { at: "2026-09-07T03:00:00.000Z", jobId: "vendhub-ops/monitor-stock" },
  ],
};

describe("groupUpcoming", () => {
  it("делит на сегодня/завтра по Ташкенту и подставляет задание", () => {
    const g = groupUpcoming(board, new Date(board.now));
    expect(g.today.map((r) => r.time)).toEqual(["09:00"]);
    expect(g.tomorrow.map((r) => r.time)).toEqual(["00:00", "08:00"]);
    expect(g.tomorrow[1]!.job.id).toBe("vendhub-ops/monitor-stock");
  });
});

describe("outcomeTone / describeLast", () => {
  it("цвета по исходу; без прогона — muted и «ещё не запускался»", () => {
    expect(outcomeTone({ outcome: "executed" })).toBe("ok");
    expect(outcomeTone({ outcome: "approval_requested" })).toBe("warn");
    expect(outcomeTone({ outcome: "skipped" })).toBe("muted");
    expect(outcomeTone({ outcome: "failed" })).toBe("hot");
    expect(outcomeTone(null)).toBe("muted");
    expect(describeLast(null)).toBe("ещё не запускался");
    expect(describeLast(board.jobs[0]!.last)).toBe("выполнено — автоматов 26/26");
  });
});

describe("hhmm", () => {
  it("по Ташкенту", () => {
    expect(hhmm("2026-09-06T03:00:00.000Z")).toBe("08:00");
  });
});
```

- [ ] **Step 2: Реализация lib**

```ts
// apps/cc/src/lib/crons.ts
import { RUN_OUTCOME_LABELS, describeRun, isRunOutcome, isSkipReason, type RunOutcome } from "@mydon/shared";
import type { CronBoard, CronBoardJob } from "./core";

const TZ = "Asia/Tashkent";
export const hhmm = (iso: string): string =>
  new Date(iso).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (d: Date): string => d.toLocaleDateString("en-CA", { timeZone: TZ });

export interface UpcomingRow { at: string; time: string; job: CronBoardJob }
export function groupUpcoming(board: CronBoard, now: Date): { today: UpcomingRow[]; tomorrow: UpcomingRow[]; later: UpcomingRow[] } {
  const byId = new Map(board.jobs.map((j) => [j.id, j]));
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const out = { today: [] as UpcomingRow[], tomorrow: [] as UpcomingRow[], later: [] as UpcomingRow[] };
  for (const u of board.upcoming24h) {
    const job = byId.get(u.jobId);
    if (!job) continue;
    const row = { at: u.at, time: hhmm(u.at), job };
    const k = dayKey(new Date(u.at));
    (k === today ? out.today : k === tomorrow ? out.tomorrow : out.later).push(row);
  }
  return out;
}

export type Tone = "ok" | "warn" | "muted" | "hot";
export function outcomeTone(last: { outcome: string } | null): Tone {
  if (!last) return "muted";
  return last.outcome === "executed" ? "ok" : last.outcome === "approval_requested" ? "warn" : last.outcome === "failed" ? "hot" : "muted";
}

export function describeLast(last: CronBoardJob["last"]): string {
  if (!last) return "ещё не запускался";
  if (!isRunOutcome(last.outcome)) return last.reason;
  return describeRun({
    outcome: last.outcome as RunOutcome,
    skipReason: isSkipReason(last.skipReason) ? last.skipReason : null,
    hook: last.hook,
    reason: last.reason,
  });
}

export const outcomeLabel = (o: string): string => (isRunOutcome(o) ? RUN_OUTCOME_LABELS[o] : o);
```

`core.ts`: интерфейсы из Task 4 (скопировать дословно, поле `tz: "Asia/Tashkent"`), методы:

```ts
  cronBoard: () => get<CronBoard>("/routines/board"),
  flows: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return get<{ runs: FlowSummary[] }>(`/routines/flows${q ? `?${q}` : ""}`);
  },
  flow: (id: string) => get<FlowPlayback>(`/routines/flows/${encodeURIComponent(id)}`),
```

и `AgentCard.hooks?: { preRun: { kind: string; [k: string]: unknown }[]; postRun: { kind: string }[] }`.

- [ ] **Step 3: Тест страницы и тумблеров**

```tsx
// apps/cc/src/app/crons/page.test.tsx — по образцу apps/cc/src/app/brain/page.test.tsx (vi.mock lib/core; реализация через mockImplementation)
// Кейсы:
//  1) доска с двумя заданиями: на странице есть «Ближайшие 24 ч», строка «09:00», «ourvend:sync», подпись «выполнено — автоматов 26/26», ссылка на /flows?agent=system&skill=ourvend%3Async;
//  2) snapshot: null → пустое состояние «Агенты ещё не отчитались о расписаниях»;
//  3) stale: true → чип «агенты не отчитывались 20 мин»;
//  4) core.cronBoard бросает CoreUnavailable → <CoreDown>;
//  5) disabled-задание показывает disabledReason и «—» вместо времени.
```

```tsx
// apps/cc/src/components/pause-toggles.test.tsx
// vi.mock("../app/system/actions", () => ({ saveSystemConfig: vi.fn(async () => ({ ok: true })) }))
// Кейсы: клик по «Расписания» вызывает saveSystemConfig("AGENTS_SCHEDULES_PAUSED", "0") когда было "1"; после успеха виден текст «применится в течение 10 минут»; ошибка → текст ошибки.
```

- [ ] **Step 4: Страница, компоненты, навигация**

`pause-toggles.tsx` (`"use client"`): два `<button role="switch" aria-checked>` («Расписания cron», «Назначенные задачи»), состояние через `useState`, `useTransition`, вызов `saveSystemConfig(key, next ? "1" : "0")`; подпись под каждым — текст из `config-spec.help` (скопировать строки дословно); после `ok` — `<small className="hint">Сохранено · применится в течение 10 минут (агенты перечитывают настройки).</small>`.

`upcoming-runs.tsx` (серверный, чистый): принимает `rows: UpcomingRow[]`, `limit?`, рисует список `<Link href={`/flows?agent=…&skill=…`} className="trow">` с `.tt` = `hhmm · agent/skill` (для мониторов — только имя), `.tm` = `describeLast(job.last)` и `<span className={`led run-led ${outcomeTone(job.last)}`}>`.

`crons/page.tsx` (`export const dynamic = "force-dynamic"`, `<ConsoleTheme />`):
1. `page-head`: `h1` «Рутины», `lead`: «Сейчас HH:MM по Ташкенту · снимок расписаний от HH:MM» + чип `.chip h` «агенты не отчитывались N мин» при `stale`.
2. `<PauseToggles schedules={board.paused.schedules} tasks={board.paused.tasks} />`.
3. `section-title` «Ближайшие 24 ч» → `groupUpcoming` → подзаголовки «Сегодня»/«Завтра» + `<UpcomingRuns rows=…/>`; пусто → `.empty` «В ближайшие сутки запусков нет» (если `paused.schedules` — добавить «расписания на паузе»).
4. `section-title` «Все расписания» → таблица `.crons-table` в `overflow-x:auto`: Задание · Cron · Режим · Следующий · Последний исход (led + `describeLast`) · «плейбэк →» (`/flows?agent=&skill=`); disabled — `disabledReason` серым, `paused` — класс `is-paused`.
5. Пустое состояние при `snapshot === null`.

`mydon/page.tsx`: после блока тревог (`tiles`) —

```tsx
      {upcoming.length > 0 && (
        <div className="sect" style={{ marginTop: 16 }}>
          <div className="sect-h"><h3 className="h2">Ближайшие 24 ч</h3><Link href="/crons" className="go">все рутины →</Link></div>
          <UpcomingRuns rows={upcoming} limit={5} />
        </div>
      )}
```

где `upcoming` = `[...g.today, ...g.tomorrow].slice(0, 5)` из `core.cronBoard()` в `try/catch` (ошибка → `[]`). Nav: `{ href: "/crons", icon: "clock", label: "Рутины" }`, `{ href: "/flows", icon: "clock", label: "Прогоны" }` — в SYSTEM после «Мозг» с комментарием (почему SYSTEM: сквозной пульт, таббар телефона занят). `icons.tsx`: добавить `clock` (круг + две стрелки, 16×16, `stroke="currentColor"`). CSS: `.run-led.ok{color:var(--ok)} .run-led.warn{color:var(--accent-tx)} .run-led.hot{color:var(--err)} .run-led.muted{color:var(--tx-2)}`; `.crons-table td.is-paused{opacity:.55}`; `.crons-wrap{overflow-x:auto}`.

`agents/[name]/page.tsx`: если `agent.hooks` и есть хуки — блок «Хуки прогона» (только чтение): список `kind` + параметры одной строкой.

- [ ] **Step 5: Гейт**

Run: `pnpm --filter cc test 2>&1 | tail -4 && pnpm --filter cc typecheck && pnpm --filter cc lint` — зелёные.

- [ ] **Step 6: Коммит**

```bash
git add apps/cc/src
git commit -m "feat(cc): доска рутин /crons — ближайшие 24 ч, все расписания, тумблеры паузы; виджет на главной (волна R, R-R-3)"
```

---

### Task 8: Панель — `/flows` (список прогонов + плейбэк)

**Files:**
- Create: `apps/cc/src/lib/flows.ts` + `flows.test.ts`
- Create: `apps/cc/src/app/flows/page.tsx` + `page.test.tsx`
- Create: `apps/cc/src/components/flow-strip.tsx` (серверный) + `flow-strip.test.tsx`
- Modify: `apps/cc/src/app/globals.css` (`.flight`, `.ph`, `.ph.ok|warn|fail|skip`, `.flows-layout`, `.flow-timeline`)

**Interfaces:**
- Consumes: `core.flows`, `core.flow`, типы `FlowSummary`, `FlowPlayback`, `FlowPhase` (Task 7), `describeRun`/`outcomeTone` (Task 7 `lib/crons.ts`).
- Produces: `mergeTimeline(events, audit)`, `phaseTone(state)`, `PHASE_LABELS`.

- [ ] **Step 1: Тесты**

```ts
// apps/cc/src/lib/flows.test.ts
import { describe, expect, it } from "vitest";
import { PHASE_LABELS, mergeTimeline, phaseTone } from "./flows";

describe("mergeTimeline", () => {
  it("сливает события и аудит по времени, помечая источник", () => {
    const rows = mergeTimeline(
      [{ at: "2026-09-06T03:00:02.000Z", type: "agent.action", payload: { skill: "s" } }],
      [{ at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: "t1" }],
    );
    expect(rows.map((r) => `${r.kind}:${r.title}`)).toEqual(["audit:task.claimed · vendhub-ops", "event:agent.action"]);
  });
});
describe("phaseTone / PHASE_LABELS", () => {
  it("шесть фаз по-русски, тона по состоянию", () => {
    expect(Object.keys(PHASE_LABELS)).toEqual(["trigger", "skill", "proposal", "approval", "execution", "delivery"]);
    expect(phaseTone("ok")).toBe("ok"); expect(phaseTone("warn")).toBe("warn"); expect(phaseTone("fail")).toBe("hot"); expect(phaseTone("skip")).toBe("muted");
  });
});
```

```tsx
// apps/cc/src/app/flows/page.test.tsx — vi.mock lib/core (flows, flow)
// Кейсы: 1) список из двух прогонов с подписью describeRun и ссылкой ?run=<id>; 2) ?run=r1 → полоса из 6 фаз (role="list", 6 элементов) с заголовками PHASE_LABELS и лента из events+audit; 3) фильтры agent/skill/outcome пробрасываются в core.flows; 4) пустой список → «Прогонов ещё нет»; 5) CoreUnavailable → CoreDown; 6) core.flow бросает (404) → плейбэк показывает «Прогон не найден», список остаётся.
```

- [ ] **Step 2: Реализация**

```ts
// apps/cc/src/lib/flows.ts
import type { FlowPhase, FlowPlayback } from "./core";
import type { Tone } from "./crons";

export const PHASE_LABELS: Record<FlowPhase["name"], string> = {
  trigger: "Триггер", skill: "Навык", proposal: "Предложение", approval: "Согласование", execution: "Выполнение", delivery: "Доставка",
};
export const phaseTone = (s: FlowPhase["state"]): Tone => (s === "ok" ? "ok" : s === "warn" ? "warn" : s === "fail" ? "hot" : "muted");

export interface TimelineRow { at: string; kind: "event" | "audit"; title: string; detail?: unknown }
export function mergeTimeline(events: FlowPlayback["events"], audit: FlowPlayback["audit"]): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...events.map((e) => ({ at: e.at, kind: "event" as const, title: e.type, detail: e.payload })),
    ...audit.map((a) => ({ at: a.at, kind: "audit" as const, title: `${a.action}${a.actorRef ? ` · ${a.actorRef}` : ""}`, ...(a.target ? { detail: a.target } : {}) })),
  ];
  return rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
```

`flow-strip.tsx`: `<ol className="flight" role="list">` из шести `<li className={`ph ${phase.state}`}>` — `.pn` (подпись фазы), `.pt` (время `hhmm` или «—»), `.tt` (title), `.note` (note), `href` → `<Link>`. Данные-атрибут `data-state` для тестов.

`flows/page.tsx` (`force-dynamic`, `<ConsoleTheme />`): `searchParams: Promise<{ agent?; skill?; outcome?; run? }>`; список `core.flows({agent, skill, outcome, limit: "50"})`; фильтры — форма `GET` с тремя `<input>`/`<select outcome>` (без JS); каждая строка `<Link href={`/flows?${текущие фильтры}&run=${id}`} className={`trow ${run === id ? "is-active" : ""}`}>` — `.tt` = `hhmm(startedAt) · agent/skill`, `.tm` = `describeRun(...)`, `led run-led <tone>`. Если `run` задан — `core.flow(run)` в try/catch → справа/снизу `FlowStrip` + карточка «Причина» (`reason`, `review` курсивом «коуч: …», `requestKey` мелко) + лента `mergeTimeline` (`<ul className="flow-timeline">`: время · kind-чип · title · `detail` в `<code>` через `JSON.stringify` ≤ 200 символов). На телефоне (`@media (max-width: 900px)`) при выбранном прогоне плейбэк выше списка (`.flows-layout.reading .flow-detail{order:-1}` — как `.docs-layout.reading`). CSS полосы (донор Run Inspector, идея): `.flight{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}` `.ph{border:1px solid var(--line);padding:8px;font-family:var(--fm);font-size:12px}` `.ph.ok{border-color:var(--ok)} .ph.warn{border-color:var(--accent-tx)} .ph.fail{border-color:var(--err)} .ph.skip{opacity:.55}`; на узком экране — `grid-template-columns:repeat(3,1fr)`.

- [ ] **Step 3: Гейт** — `pnpm --filter cc test 2>&1 | tail -4 && pnpm --filter cc typecheck && pnpm --filter cc lint`.

- [ ] **Step 4: Коммит**

```bash
git add apps/cc/src
git commit -m "feat(cc): плейбэк прогона /flows — список с фильтрами, полоса шести фаз, лента событий и аудита (волна R, R-R-5)"
```

---

### Task 9: Смоук-сценарий, панельный смоук, аудит репо (`tools/`), навык `repo-audit`

**Files:**
- Modify: `tools/smoke-core.mjs` (сценарий `проверитьРутины` + вызов в общем списке после `проверитьДокументыИГраф`)
- Modify: `tools/smoke-panel.mjs` (страницы `/crons` → «Рутины», `/flows` → «Прогоны»)
- Create: `tools/repo-audit.mjs`, `tools/repo-audit.test.mjs`
- Modify: `.github/workflows/ci.yml` (шаг «Tools (unit)»: добавить `tools/repo-audit.test.mjs`)
- Create: `.claude/skills/repo-audit/SKILL.md`

**Interfaces:**
- Consumes: маршруты `/routines/*` (Task 3–4), страницы `/crons`, `/flows` (Task 7–8).
- Produces: `renderAudit(findings: AuditFindings): string`, `collectFindings(repoRoot): Promise<AuditFindings>`, `upsertSection(markdown, date, section): string`.

- [ ] **Step 1: Смоук Core**

```js
async function проверитьРутины() {
  const анонимно = await jsonRequest("GET", "/routines/board", undefined, false);
  if (анонимно.r.status !== 401) throw new Error(`GET /routines/board без токена → ${анонимно.r.status}, ожидали 401`);

  const снимок = await jsonRequest("PUT", "/routines/snapshot", {
    generatedAt: new Date().toISOString(), tz: "Asia/Tashkent", paused: { schedules: false, tasks: true },
    jobs: [
      { agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" },
      { agent: "vendhub-ops", skill: "parts-audit", cron: "30 8 * * 1", mode: "durable-task" },
    ],
    notWired: [{ agent: "vendhub-ceo", skill: "weekly-review", reason: "llm_route_off" }],
    monitors: [{ name: "fx:refresh", cron: "5 9 * * *", enabled: true }],
  });
  if (!снимок.r.ok) throw new Error(`PUT /routines/snapshot → ${снимок.r.status}: ${снимок.text.slice(0, 200)}`);

  const битый = await jsonRequest("PUT", "/routines/snapshot", { generatedAt: new Date().toISOString(), tz: "Asia/Tashkent", paused: {}, jobs: [{ agent: "a", skill: "b", cron: "99 99 * * *", mode: "legacy" }], notWired: [], monitors: [] });
  if (битый.r.status !== 400) throw new Error(`битый cron в снимке → ${битый.r.status}, ожидали 400`);

  const requestKey = `smoke:${Date.now()}`;
  const запись = await jsonRequest("POST", "/routines/runs", {
    agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
    scheduledAt: new Date().toISOString(), requestKey, startedAt: new Date(Date.now() - 2000).toISOString(),
    finishedAt: new Date().toISOString(), outcome: "skipped", skipReason: "no_signal", reason: "смоук: повода нет",
  });
  if (!запись.r.ok || запись.json.created !== true) throw new Error(`POST /routines/runs → ${запись.r.status} ${запись.text.slice(0, 200)}`);
  const повтор = await jsonRequest("POST", "/routines/runs", { ...JSON.parse(JSON.stringify({ agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", requestKey, startedAt: new Date(Date.now() - 2000).toISOString(), finishedAt: new Date().toISOString(), outcome: "executed", reason: "смоук: повтор" })) });
  if (!повтор.r.ok || повтор.json.created !== false || повтор.json.id !== запись.json.id) throw new Error(`повтор requestKey не стал upsert: ${повтор.text.slice(0, 200)}`);
  const плохой = await jsonRequest("POST", "/routines/runs", { agentName: "a", skill: "b", trigger: "cron", requestKey: `${requestKey}:bad`, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), outcome: "done", reason: "x" });
  if (плохой.r.status !== 400) throw new Error(`битый outcome → ${плохой.r.status}, ожидали 400`);

  const доска = await jsonRequest("GET", "/routines/board");
  if (!доска.r.ok) throw new Error(`GET /routines/board → ${доска.r.status}`);
  const job = доска.json.jobs.find((j) => j.id === "vendhub-ops/monitor-stock");
  if (!job || typeof job.nextRun !== "string") throw new Error("на доске нет vendhub-ops/monitor-stock с nextRun");
  if (!job.last || job.last.outcome !== "executed") throw new Error(`last на доске не обновился после upsert: ${JSON.stringify(job.last)}`);
  if (!доска.json.jobs.some((j) => j.id === "system/fx:refresh" && j.kind === "monitor")) throw new Error("монитор fx:refresh не на доске");
  if (!доска.json.jobs.some((j) => j.id === "vendhub-ceo/weekly-review" && j.enabled === false)) throw new Error("не подключённый навык не показан как disabled");
  if (доска.json.snapshot === null || доска.json.snapshot.stale !== false) throw new Error("снимок не свежий");
  if (доска.json.paused.tasks !== true && доска.json.paused.tasks !== false) throw new Error("paused не из system_config");

  const плейбэк = await jsonRequest("GET", `/routines/flows/${запись.json.id}`);
  if (!плейбэк.r.ok) throw new Error(`GET /routines/flows/:id → ${плейбэк.r.status}`);
  const фазы = плейбэк.json.phases.map((p) => `${p.name}:${p.state}`);
  if (фазы[0] !== "trigger:ok" || фазы[3] !== "approval:skip" || фазы.length !== 6) throw new Error(`фазы плейбэка: ${фазы.join(" ")}`);
  const список = await jsonRequest("GET", "/routines/flows?agent=vendhub-ops&limit=5");
  if (!список.r.ok || !список.json.runs.some((r) => r.id === запись.json.id)) throw new Error("прогон не найден в списке /routines/flows");
  const нет = await jsonRequest("GET", "/routines/flows/00000000-0000-4000-8000-000000000000");
  if (нет.r.status !== 404) throw new Error(`несуществующий прогон → ${нет.r.status}, ожидали 404`);
}
```

Вызов в списке сценариев (после `проверитьДокументыИГраф`) с `console.log("  ok  сценарий: рутины — снимок, журнал (upsert), доска с nextRun/last, плейбэк 6 фаз, 401/400/404")` и `провалы.push(\`рутины: ${e.message}\`)`. Панельный смоук: `{ path: "/crons", должно: "Рутины" }`, `{ path: "/flows", должно: "Прогоны" }`.

- [ ] **Step 2: Тест аудита репо**

```js
// tools/repo-audit.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAudit, upsertSection } from "./repo-audit.mjs";

const findings = {
  date: "2026-09-08",
  staleBranches: [{ name: "origin/feat/old", days: 41 }],
  worktrees: ["/tmp/wt-a"],
  untracked: { count: 3, sample: [".agents/skills/x", "notes.md", "tmp.log"] },
  specsWithoutDecision: ["docs/superpowers/specs/2026-08-01-foo-design.md"],
  plansWithoutLedger: [],
  migrationsNotInJournal: ["0089_x.sql"],
  passports: { ok: false, output: "vendhub-ops: расписание зовёт навык «x»" },
  staleQuestions: [{ heading: "2026-06-01 — что с RAG", days: 99 }],
};

describe("renderAudit", () => {
  it("секция с датой, счётчиками и списками; пустые группы — «нет»", () => {
    const md = renderAudit(findings);
    assert.match(md, /^## Аудит репо 2026-09-08/m);
    assert.match(md, /Ветки старше 30 дней \(1\)/);
    assert.match(md, /origin\/feat\/old — 41 дн/);
    assert.match(md, /Планы без леджера \(0\): нет/);
    assert.match(md, /Паспорта: ПРОБЛЕМЫ/);
    assert.match(md, /2026-06-01 — что с RAG — 99 дн/);
  });
});

describe("upsertSection", () => {
  const doc = "# Открытые вопросы\n\n## 2026-06-01 — что с RAG\nтекст\n\n## Аудит репо 2026-09-01\nстарое\n";
  it("заменяет секцию той же даты, иначе добавляет в конец", () => {
    const same = upsertSection(doc, "2026-09-01", "## Аудит репо 2026-09-01\nновое\n");
    assert.equal((same.match(/## Аудит репо 2026-09-01/g) ?? []).length, 1);
    assert.match(same, /новое/);
    assert.doesNotMatch(same, /старое/);
    const added = upsertSection(doc, "2026-09-08", "## Аудит репо 2026-09-08\nx\n");
    assert.match(added, /старое[\s\S]*## Аудит репо 2026-09-08/);
  });
});
```

- [ ] **Step 3: Реализация `tools/repo-audit.mjs`**

Экспорты `renderAudit`, `upsertSection`, `collectFindings(root, { now, exec })` (все `git`-вызовы через `exec` = `execFileSync`-обёртку, чтобы тест мог подменить); `main()` под `if (import.meta.url === pathToFileURL(process.argv[1]).href)`: `--dry-run` печатает, иначе пишет `memory/open-questions.md` через `upsertSection`. Проверки — по R-R-7 спеки: ветки (`git for-each-ref --format='%(refname:short) %(committerdate:unix)' refs/remotes/origin` → старше 30 дн, кроме `origin/main`, `origin/HEAD`), `git worktree list --porcelain`, `git status --porcelain --untracked-files=all` (только `??`), спеки без решения (slug после даты: `docs/decisions/<та же дата>-<slug>.md` существует?), планы без `.superpowers/sdd/<basename без .md>/progress.md` со строкой `complete`, миграции `packages/db/drizzle/*.sql` без тега в `meta/_journal.json`, `pnpm --filter @mydon/agents check:passports` (код возврата + последние 20 строк), вопросы `## YYYY-MM-DD` в `memory/open-questions.md` старше 60 дней. Формат секции:

```
## Аудит репо 2026-09-08

- Ветки старше 30 дней (1): origin/feat/old — 41 дн
- Worktrees (1): /tmp/wt-a
- Неотслеживаемые файлы (3): .agents/skills/x, notes.md, tmp.log
- Спеки без решения (1): docs/superpowers/specs/2026-08-01-foo-design.md
- Планы без леджера (0): нет
- Миграции вне журнала (1): 0089_x.sql
- Паспорта: ПРОБЛЕМЫ — vendhub-ops: расписание зовёт навык «x»
- Вопросы старше 60 дней (1): 2026-06-01 — что с RAG — 99 дн
```

(«Паспорта: ок» при `ok: true`.) `SKILL.md` навыка `repo-audit` (frontmatter `name: repo-audit`, `description: Еженедельный аудит репозитория MYDON — ветки, worktrees, спеки без решений, миграции, паспорта; пишет секцию в memory/open-questions.md`): когда запускать, команда `node tools/repo-audit.mjs` (и `--dry-run`), что делать с находками, и как поставить расписание в Claude Code: «`/schedule` → еженедельно, понедельник 09:00 Asia/Tashkent, промпт `/repo-audit`» — планирует владелец на своём Mac.

- [ ] **Step 4: Прогон**

Run: `node --test tools/repo-audit.test.mjs && node tools/repo-audit.mjs --dry-run | head -20` — тест pass, отчёт печатается без исключений. Смоук: локально `CORE_DATABASE_URL=… node tools/smoke-core.mjs` (Homebrew Postgres 15; см. README `tools/pglite-checks`) — сценарий «рутины» ok; если локальный Postgres не поднят — отметить в отчёте, что сценарий проверит CI.

- [ ] **Step 5: Коммит**

```bash
git add tools/smoke-core.mjs tools/smoke-panel.mjs tools/repo-audit.mjs tools/repo-audit.test.mjs .github/workflows/ci.yml .claude/skills/repo-audit
git commit -m "test(smoke): сценарий рутин (снимок, журнал, доска, плейбэк); tools/repo-audit + навык repo-audit (волна R, R-R-7/8)"
```

---

### Task 10: Документация, решения, чек-лист, план ARMS, handoff

**Files:**
- Modify: `docs/AGENTS.md` (разделы «Доска рутин `/crons`», «Плейбэк `/flows`», «Журнал прогонов», «Хуки паспорта» — kinds, семантика, встроенные проверки, что блокирует)
- Modify: `docs/AGENTIC_OS_ARMS_PLAN.md` (§6.3 — «сделано 2026-09-06, PR …» построчно; §9 строка R — «видно на доске `/crons`, плейбэк `/flows`»)
- Modify: `docs/FIRST_LOGIN_CHECKLIST.md` (пункты: снять `AGENTS_SCHEDULES_PAUSED` с `/crons`, когда готов; поставить недельный `/repo-audit`; проверить, что `/crons` показывает снимок не старше 15 минут после рестарта агентов)
- Create: `docs/decisions/2026-09-06-wave-r-crons-flows.md` (Р-1…Р-9 из спеки, по образцу `docs/decisions/2026-09-06-wave-m-docs-brain.md`)
- Create: `memory/session-log/2026-09-06-wave-r-crons-flows.md` (handoff: что сделано, как принять на проде — §8 спеки, что осталось владельцу)
- Modify: `apps/agents/shared/kb/protocol/run-log.md` — одна строка-ссылка: «журнал прогонов рантайма — таблица `agent_run`, панель `/flows`» (если файл описывает контракт лога прогона; иначе пропустить и сказать об этом в отчёте)

**Interfaces:** —

- [ ] **Step 1: Написать документы** (без кода; факты — из спеки §4 и итоговых сигнатур задач 1–9: маршруты `/routines/*`, kinds хуков, словарь причин, `stale` 900 с, лимиты).
- [ ] **Step 2: Проверить ссылки** — `node tools/verify-paths.mjs` если есть; иначе `grep -n "](" docs/AGENTS.md | grep -v http` и ручная проверка, что упомянутые файлы существуют (`ls`).
- [ ] **Step 3: Коммит**

```bash
git add docs memory apps/agents/shared/kb/protocol/run-log.md
git commit -m "docs: волна R — рунбук доски/плейбэка/хуков, решения Р-1…Р-9, чек-лист, план ARMS §6.3, handoff"
```

---

## Self-review (выполнено при написании)

- **Покрытие спеки:** R-R-1 → T2+T3+T5; R-R-2 → T2+T3+T5; R-R-3 → T4+T7; R-R-4 → T6 (+T3 столбец, +T7 карточка); R-R-5 → T4+T8; R-R-6 → T5; R-R-7 → T9; R-R-8 → T9 (+тесты в каждой задаче); R-R-9 → T10. Решение Р-6 (тумблеры) → T7; Р-8 → T1.
- **Плейсхолдеры:** тесты страниц панели (T7 шаг 3, T8 шаг 1) заданы кейсами, а не кодом — образец `brain/page.test.tsx` указан; остальное — код.
- **Согласованность типов:** `ReportRunInput`/`RunJournalEntry` — одни поля (T3 ↔ T5); `ScheduleSnapshot` — T3 ↔ T5 (`mode: ScheduledInvocationMode` = `"durable-task" | "legacy"`); `CronBoard`/`FlowPhase`/`FlowPlayback` — T4 ↔ T7/T8 дословно; `SkipReason` включает `hook_blocked` (T1) и используется в `RunResult` (T5/T6); `SkillRunContext.trigger` — T5 добавляет, T6 читает; `AgentsCoreClient.lastRun/listRuns` — T5 добавляет, T6 использует (`LastRunLite`/`RunResultLite` — структурные подтипы `AgentRunView`).
