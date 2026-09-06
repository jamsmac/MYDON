import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CoreError } from "./core-client";
import type {
  Agent,
  AgentRun,
  Approval,
  Briefing,
  CoreClient,
  CoreEvent,
  DocFile,
  DocsTreeItem,
  EntityCard,
  SkillDeck,
  Task,
  TaskComment,
} from "./core-client";
import {
  AGENT_STATUSES,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MUTATING_TOOLS,
  READING_TOOLS,
  buildTools,
  callTool,
  describeApprovalDecide,
  type OwnerPosture,
  type ToolDefinition,
} from "./tools";

// ── Фикстуры ответов Core ──

const NOW = "2026-09-06T05:00:00.000Z";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Проверить бункеры",
    description: null,
    ownerKind: "human",
    ownerRef: "Бехруз",
    domain: "vendhub",
    entityId: null,
    status: "todo",
    priority: "normal",
    due: null,
    source: null,
    createdBy: null,
    resultNote: null,
    completedAt: null,
    createdAt: NOW,
    ...over,
  };
}

function entity(over: Partial<EntityCard> = {}): EntityCard {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "machine",
    name: "Olma",
    externalRef: null,
    attrs: {},
    approvedAt: NOW,
    approvedBy: null,
    createdFrom: null,
    createdAt: NOW,
    updatedAt: NOW,
    domain: "vendhub",
    ...over,
  };
}

function agentCard(over: Partial<Agent> = {}): Agent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "vendhub-ops",
    business: "vendhub",
    status: "active",
    description: null,
    mission: null,
    autonomyDefault: "T0",
    skills: ["parts-audit"],
    schedule: [],
    archivedAt: null,
    updatedAt: NOW,
    ...over,
  };
}

function event(over: Partial<CoreEvent> = {}): CoreEvent {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    source: "agent:vendhub-ops",
    type: "agent.memory:parts-audit",
    payload: { signature: "abc" },
    occurredAt: NOW,
    createdAt: NOW,
    ...over,
  };
}

function doc(over: Partial<DocFile> = {}): DocFile {
  return {
    path: "docs/MCP.md",
    root: "docs",
    title: "MCP",
    bytes: 12,
    updatedAt: NOW,
    markdown: "# тело страницы",
    ...over,
  };
}

const APPROVAL: Approval = {
  id: "55555555-5555-4555-8555-555555555555",
  agent: "vendhub-ops",
  action: "поставить задачу",
  tier: "T2",
  payload: {},
  decision: "pending",
  decidedAt: null,
  createdAt: NOW,
};

const RUN: AgentRun = {
  id: "66666666-6666-4666-8666-666666666666",
  agentName: "vendhub-ops",
  skill: "parts-audit",
  trigger: "cron",
  cron: "0 7 * * *",
  scheduledAt: NOW,
  taskId: null,
  approvalId: null,
  startedAt: NOW,
  finishedAt: NOW,
  outcome: "executed",
  skipReason: null,
  hook: null,
  reason: "",
  action: null,
  review: null,
};

const BRIEFING: Briefing = {
  generatedAt: NOW,
  tz: "Asia/Tashkent",
  overdueMoney: 0,
  idleMachines: 1,
  pendingApprovals: 2,
  contractsDueSoon: 0,
  contractsBadDate: 0,
  overdueTasks: 3,
};

const DECK: SkillDeck = { syncedAt: NOW, models: { primary: null, fallbacks: [] }, items: [] };

const COMMENT: TaskComment = {
  id: "77777777-7777-4777-8777-777777777777",
  taskId: task().id,
  // Имя поля — из ответа Core (`task_comment.author_ref`), а не из нашего
  // намерения: на выдуманном `author` тест бы проходил, а инструмент печатал
  // «автор undefined».
  authorRef: "mcp",
  body: "готово",
  createdAt: NOW,
};

// ── Стаб клиента: пишет, с какими аргументами его звали ──

interface Call {
  method: string;
  args: unknown[];
}

function stubClient(over: Partial<CoreClient> = {}): { client: CoreClient; calls: Call[] } {
  const calls: Call[] = [];
  const base: CoreClient = {
    pendingApprovals: async () => [],
    pendingEntities: async () => ({ cards: [], fields: [] }),
    decideApproval: async () => APPROVAL,
    tasks: async () => [],
    task: async () => task(),
    createTask: async () => task(),
    commentTask: async () => COMMENT,
    setTaskStatus: async () => task({ status: "done" }),
    events: async () => [],
    recordEvent: async () => event(),
    entities: async () => [],
    docsTree: async (): Promise<DocsTreeItem[]> => [],
    docFile: async () => doc(),
    agents: async () => [],
    skillDeck: async () => DECK,
    createAgent: async () => agentCard(),
    updateAgent: async () => agentCard(),
    setAutonomy: async () => agentCard({ autonomyDefault: "T1" }),
    runs: async () => ({ runs: [] }),
    briefing: async () => BRIEFING,
    systemConfig: async () => [],
  };
  const merged: Record<string, unknown> = { ...base, ...over };
  const recorded = Object.fromEntries(
    Object.entries(merged).map(([method, fn]) => [
      method,
      (...args: unknown[]) => {
        calls.push({ method, args });
        return (fn as (...a: unknown[]) => unknown)(...args);
      },
    ]),
  );
  return { client: recorded as unknown as CoreClient, calls };
}

const BELT_OFF: OwnerPosture = { ownerEnforced: false, ownerTokenPresent: true };

function tools(client: CoreClient, posture: OwnerPosture = BELT_OFF): ToolDefinition[] {
  return buildTools(client, posture);
}

function byName(list: ToolDefinition[], name: string): ToolDefinition {
  const found = list.find((t) => t.name === name);
  assert.ok(found, `нет инструмента ${name}`);
  return found;
}

function textOf(result: { content: { type: "text"; text: string }[] }): string {
  return result.content.map((c) => c.text).join("\n");
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s/)[0] ?? "";
}

function argOf(calls: Call[], method: string): Record<string, unknown> {
  const call = calls.find((c) => c.method === method);
  assert.ok(call, `клиент не звал ${method}`);
  return (call.args[0] ?? {}) as Record<string, unknown>;
}

// ── Состав инструментов (R-A1-2, Р-2) ──

describe("Состав инструментов (R-A1-2)", () => {
  const NAMES = [
    // читающие (13)
    "briefing_get",
    "inbox_list",
    "tasks_list",
    "task_get",
    "registry_search",
    "events_recent",
    "memory_recall",
    "kb_read",
    "kb_tree",
    "agents_list",
    "skills_deck",
    "runs_recent",
    "ventures_list",
    // меняющие мир (6)
    "task_create",
    "task_comment",
    "task_status",
    "memory_remember",
    "agent_upsert",
    "approval_decide",
  ];

  it("девятнадцать инструментов присутствуют по именам, и ровно они", () => {
    const built = tools(stubClient().client).map((t) => t.name);
    assert.equal(NAMES.length, 19);
    assert.deepEqual([...built].sort(), [...NAMES].sort());
    assert.equal(new Set(built).size, 19, "имена инструментов повторяются");
  });

  it("списки читающих и меняющих совпадают с флагом mutates", () => {
    const built = tools(stubClient().client);
    const names = (mutating: boolean): string[] =>
      built
        .filter((t) => t.mutates === mutating)
        .map((t) => t.name)
        .sort();
    assert.deepEqual(names(false), [...READING_TOOLS].sort());
    assert.deepEqual(names(true), [...MUTATING_TOOLS].sort());
    assert.equal(MUTATING_TOOLS.length, 6);
    assert.equal(READING_TOOLS.length, 13);
  });

  it("у каждого инструмента непустое описание и объектная схема входа", () => {
    for (const t of tools(stubClient().client)) {
      assert.ok(t.description.length > 40, `слишком короткое описание у ${t.name}`);
      assert.equal(t.inputSchema.type, "object");
      assert.equal(t.inputSchema.additionalProperties, false);
      for (const [key, prop] of Object.entries(t.inputSchema.properties)) {
        assert.ok(prop.description.length > 0, `${t.name}.${key} без описания`);
      }
      for (const req of t.inputSchema.required ?? []) {
        assert.ok(t.inputSchema.properties[req], `${t.name}: required ${req} нет в properties`);
      }
    }
  });

  it("описание меняющего инструмента первым предложением говорит, что изменится и где это видно", () => {
    for (const t of tools(stubClient().client).filter((x) => x.mutates)) {
      const head = firstSentence(t.description);
      assert.match(head, /^(Создаёт|Добавляет|Меняет|Записывает|Проводит)/, `${t.name}: ${head}`);
      assert.match(head, /увид|\/(tasks|inbox|agents|flows)/, `${t.name}: ${head}`);
    }
  });

  it("читающий инструмент честно говорит, что ничего не меняет", () => {
    for (const t of tools(stubClient().client).filter((x) => !x.mutates)) {
      assert.match(t.description, /Ничего не меняет/, `${t.name}`);
    }
  });
});

// ── Дрейф рукописной копии перечисления Core ──

/**
 * `AGENT_STATUSES` — вторая, рукописная копия закрытого списка Core:
 * импортировать модуль Core сюда нельзя (он тянет весь NestJS), а
 * `@mydon/shared` этих статусов не знает. Значит, ничто не помешает спискам
 * разъехаться при следующей правке Core — кроме этого теста.
 *
 * Читаем ИСХОДНИК Core, а не собранный модуль: тот же приём, что у зеркал
 * движка (`apps/agents/src/engine-mirror.test.ts`) — сверка идёт с текстом,
 * который правит человек. Путь считается от `dist` (тесты гоняются оттуда).
 */
describe("AGENT_STATUSES — копия перечисления Core не должна разъехаться", () => {
  const SERVICE_TS = path.resolve(__dirname, "../../core/src/agents/agents.service.ts");

  function coreAgentStatuses(): string[] {
    const src = fs.readFileSync(SERVICE_TS, "utf8");
    const m = /export const AGENT_STATUSES = \[([^\]]*)\] as const;/.exec(src);
    assert.ok(m, `не нашли объявление AGENT_STATUSES в ${SERVICE_TS} — перечисление переехало`);
    return [...m[1]!.matchAll(/"([^"]+)"/g)].map((g) => g[1]!);
  }

  it("состав и порядок совпадают с apps/core/src/agents/agents.service.ts", () => {
    assert.deepEqual([...AGENT_STATUSES], coreAgentStatuses());
  });

  it("схема agent_upsert предлагает модели ровно статусы Core", () => {
    const upsert = tools(stubClient().client).find((t) => t.name === "agent_upsert");
    assert.ok(upsert);
    assert.deepEqual(upsert.inputSchema.properties.status?.enum, coreAgentStatuses());
  });
});

// ── Пояс владельца (Р-3) ──

describe("Честное описание пояса владельца (Р-3)", () => {
  it("пояс выключен — решение проходит по сервисному токену", () => {
    const text = describeApprovalDecide({ ownerEnforced: false, ownerTokenPresent: false });
    assert.match(text, /пояс идентичности выключен/);
  });

  it("пояс включён и owner-токен задан — требует owner-токен", () => {
    const text = describeApprovalDecide({ ownerEnforced: true, ownerTokenPresent: true });
    assert.match(text, /требует owner-токен/);
    assert.doesNotMatch(text, /вернёт 401/);
  });

  it("пояс включён, а owner-токена нет — честно про 401", () => {
    const text = describeApprovalDecide({ ownerEnforced: true, ownerTokenPresent: false });
    assert.match(text, /owner-токен не задан: вызов вернёт 401/);
  });

  it("Core не ответил — состояние пояса неизвестно, а не «выключен»", () => {
    const text = describeApprovalDecide({
      ownerEnforced: false,
      ownerTokenPresent: false,
      beltUnknown: true,
    });
    assert.match(text, /состояние пояса неизвестно/i);
    assert.doesNotMatch(text, /пояс идентичности выключен/);
  });

  it("описание approval_decide собрано этой же функцией", () => {
    const posture: OwnerPosture = { ownerEnforced: true, ownerTokenPresent: false };
    const tool = byName(tools(stubClient().client, posture), "approval_decide");
    assert.equal(tool.description, describeApprovalDecide(posture));
  });
});

// ── Личный контур (Р-4) ──

describe("Личный контур исключается явно (Р-4)", () => {
  it("tasks_list без домена не показывает личные задачи", async () => {
    const { client, calls } = stubClient({
      tasks: async () => [
        task({ title: "Рабочая", domain: "vendhub" }),
        task({ id: "личная", title: "Личная", domain: "personal" }),
      ],
    });
    const out = textOf(await callTool(tools(client), "tasks_list", {}));
    assert.match(out, /Рабочая/);
    assert.doesNotMatch(out, /Личная/);
    assert.equal(argOf(calls, "tasks").domain, undefined);
  });

  it("tasks_list с domain personal просит личное явно (клиент добавит owner-токен)", async () => {
    const { client, calls } = stubClient({
      tasks: async () => [task({ title: "Личная", domain: "personal" })],
    });
    const out = textOf(await callTool(tools(client), "tasks_list", { domain: "personal" }));
    assert.match(out, /Личная/);
    assert.equal(argOf(calls, "tasks").domain, "personal");
  });

  it("registry_search без домена не показывает личные карточки", async () => {
    const { client, calls } = stubClient({
      entities: async () => [
        entity({ name: "Рабочая карточка", domain: "vendhub" }),
        entity({ id: "личная", name: "Квартира", domain: "personal" }),
      ],
    });
    const out = textOf(await callTool(tools(client), "registry_search", { q: "а" }));
    assert.match(out, /Рабочая карточка/);
    assert.doesNotMatch(out, /Квартира/);
    assert.equal(argOf(calls, "entities").domain, undefined);
  });

  it("registry_search с domain personal передаёт домен в клиент", async () => {
    const { client, calls } = stubClient({
      entities: async () => [entity({ name: "Квартира", domain: "personal" })],
    });
    const out = textOf(
      await callTool(tools(client), "registry_search", { q: "кв", domain: "personal" }),
    );
    assert.match(out, /Квартира/);
    assert.equal(argOf(calls, "entities").domain, "personal");
  });

  it("kb_read помечает личный документ", async () => {
    const личный = stubClient({ docFile: async () => doc({ personal: true }) });
    const общий = stubClient({ docFile: async () => doc() });
    const withMark = textOf(
      await callTool(tools(личный.client), "kb_read", { path: "memory/x.md" }),
    );
    const noMark = textOf(await callTool(tools(общий.client), "kb_read", { path: "docs/MCP.md" }));
    assert.match(withMark, /Личный контур/i);
    assert.doesNotMatch(noMark, /Личный контур/i);
  });
});

// ── Лимиты (Р-5) ──

describe("Лимиты ответов (Р-5)", () => {
  it("events_recent с limit 1000 уходит в клиент с 200", async () => {
    const { client, calls } = stubClient();
    await callTool(tools(client), "events_recent", { limit: 1000 });
    assert.equal(argOf(calls, "events").limit, MAX_LIMIT);
    assert.equal(MAX_LIMIT, 200);
  });

  it("без limit уходит умолчание 50", async () => {
    const { client, calls } = stubClient();
    await callTool(tools(client), "events_recent", {});
    assert.equal(argOf(calls, "events").limit, DEFAULT_LIMIT);
    assert.equal(DEFAULT_LIMIT, 50);
  });

  it("tasks_list и runs_recent тоже режут limit по потолку", async () => {
    const t = stubClient();
    await callTool(tools(t.client), "tasks_list", { limit: 900 });
    assert.equal(argOf(t.calls, "tasks").limit, MAX_LIMIT);
    const r = stubClient();
    await callTool(tools(r.client), "runs_recent", { limit: 900 });
    assert.equal(argOf(r.calls, "runs").limit, MAX_LIMIT);
  });

  it("ответ инструмента не длиннее 8000 символов", async () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      task({ id: `id-${i}`, title: `Задача ${i} ${"я".repeat(100)}` }),
    );
    const { client } = stubClient({ tasks: async () => many });
    const out = textOf(await callTool(tools(client), "tasks_list", { limit: 200 }));
    assert.ok(out.length <= 8000, `ответ ${out.length} символов`);
  });

  it("kb_tree тоже держит предел ответа", async () => {
    const tree: DocsTreeItem[] = Array.from({ length: 500 }, (_, i) => ({
      path: `docs/страница-${i}-${"я".repeat(60)}.md`,
      root: "docs",
      title: `Страница ${i}`,
      bytes: 100,
      updatedAt: NOW,
    }));
    const { client } = stubClient({ docsTree: async () => tree });
    const out = textOf(await callTool(tools(client), "kb_tree", {}));
    assert.ok(out.length <= 8000, `ответ ${out.length} символов`);
    assert.match(out, /из 500/);
  });
});

// ── Ошибки (Р-9) ──

describe("Ошибки клиента становятся isError (Р-9)", () => {
  it("CoreError отдаётся переведённым текстом и флагом isError", async () => {
    const { client } = stubClient({
      briefing: async () => {
        throw new CoreError(
          401,
          "/registry/briefing",
          "Core не принял токен: проверь SERVICE_TOKEN.",
        );
      },
    });
    const res = await callTool(tools(client), "briefing_get", {});
    assert.equal(res.isError, true);
    assert.match(textOf(res), /Core не принял токен/);
  });

  it("обязательный параметр без значения — ошибка инструмента, а не вызов Core", async () => {
    const { client, calls } = stubClient();
    const res = await callTool(tools(client), "task_get", {});
    assert.equal(res.isError, true);
    assert.match(textOf(res), /id/);
    assert.equal(calls.length, 0);
  });

  it("значение вне перечисления не уходит в Core", async () => {
    const { client, calls } = stubClient();
    const res = await callTool(tools(client), "approval_decide", {
      id: APPROVAL.id,
      decision: "может быть",
    });
    assert.equal(res.isError, true);
    assert.equal(calls.length, 0);
  });

  it("неизвестный инструмент — isError со списком доступных", async () => {
    const res = await callTool(tools(stubClient().client), "tasks_delete", {});
    assert.equal(res.isError, true);
    assert.match(textOf(res), /tasks_list/);
  });
});

// ── Поведение отдельных инструментов ──

describe("Поведение инструментов", () => {
  it("inbox_list складывает согласования и очередь реестра", async () => {
    const { client, calls } = stubClient({
      pendingApprovals: async () => [APPROVAL],
      pendingEntities: async () => ({ cards: [entity()], fields: [] }),
    });
    const out = textOf(await callTool(tools(client), "inbox_list", {}));
    assert.match(out, /Ждёт решения: 1 согласований, 1 записей/);
    assert.equal(calls.length, 2);
  });

  it("memory_recall читает события памяти агента префиксом", async () => {
    const { client, calls } = stubClient({ events: async () => [event()] });
    await callTool(tools(client), "memory_recall", { agent: "vendhub-ops" });
    const q = argOf(calls, "events");
    assert.equal(q.source, "agent:vendhub-ops");
    assert.equal(q.typePrefix, "agent.memory:");
  });

  it("memory_recall с навыком спрашивает точный тип", async () => {
    const { client, calls } = stubClient({ events: async () => [event()] });
    await callTool(tools(client), "memory_recall", {
      agent: "agent:vendhub-ops",
      skill: "parts-audit",
    });
    const q = argOf(calls, "events");
    assert.equal(q.source, "agent:vendhub-ops");
    assert.equal(q.type, "agent.memory:parts-audit");
  });

  it("memory_remember пишет событие в том же виде, что runner", async () => {
    const { client, calls } = stubClient();
    const out = textOf(
      await callTool(tools(client), "memory_remember", {
        agent: "vendhub-ops",
        skill: "parts-audit",
        value: "sig-1",
      }),
    );
    const body = argOf(calls, "recordEvent");
    assert.equal(body.source, "agent:vendhub-ops");
    assert.equal(body.type, "agent.memory:parts-audit");
    assert.deepEqual(body.payload, { signature: "sig-1" });
    assert.match(out, /agent\.memory:parts-audit/);
  });

  it("task_create шлёт заголовок, владельца и источник mcp", async () => {
    const { client, calls } = stubClient();
    await callTool(tools(client), "task_create", {
      title: "Заправить Olma",
      ownerKind: "human",
      ownerRef: "Бехруз",
    });
    const body = argOf(calls, "createTask");
    assert.equal(body.title, "Заправить Olma");
    assert.equal(body.ownerKind, "human");
    assert.equal(body.ownerRef, "Бехруз");
    assert.equal(body.source, "mcp");
  });

  it("task_status передаёт статус и заметку", async () => {
    const { client, calls } = stubClient();
    const out = textOf(
      await callTool(tools(client), "task_status", {
        id: task().id,
        status: "done",
        note: "сделал",
      }),
    );
    const body = calls.find((c) => c.method === "setTaskStatus")?.args[1] as Record<
      string,
      unknown
    >;
    assert.equal(body.status, "done");
    assert.equal(body.resultNote, "сделал");
    assert.match(out, /done|Сделано/);
  });

  it("agent_upsert создаёт карточку, когда агента нет", async () => {
    const { client, calls } = stubClient({ agents: async () => [] });
    const out = textOf(await callTool(tools(client), "agent_upsert", { name: "new-agent" }));
    assert.ok(calls.some((c) => c.method === "createAgent"));
    assert.ok(!calls.some((c) => c.method === "updateAgent"));
    assert.match(out, /Создана|создан/);
  });

  it("agent_upsert обновляет существующего и меняет автономию отдельным вызовом", async () => {
    const { client, calls } = stubClient({ agents: async () => [agentCard()] });
    await callTool(tools(client), "agent_upsert", {
      name: "vendhub-ops",
      mission: "следить за узлами",
      autonomyDefault: "T1",
    });
    assert.ok(calls.some((c) => c.method === "updateAgent"));
    assert.ok(!calls.some((c) => c.method === "createAgent"));
    const autonomy = calls.find((c) => c.method === "setAutonomy");
    assert.ok(autonomy, "автономия должна меняться отдельным вызовом");
    assert.equal(autonomy.args[1], "T1");
  });

  it("ventures_list просит кандидатов домена mydon и считает вердикты", async () => {
    const { client, calls } = stubClient({
      entities: async () => [
        entity({
          id: "v1",
          name: "Кандидат A",
          type: "venture_candidate",
          domain: "mydon",
          attrs: { verdict: "PARK" },
        }),
        entity({
          id: "v2",
          name: "Кандидат B",
          type: "venture_candidate",
          domain: "mydon",
          attrs: { verdict: "NO" },
        }),
      ],
    });
    const out = textOf(await callTool(tools(client), "ventures_list", {}));
    const q = argOf(calls, "entities");
    assert.equal(q.type, "venture_candidate");
    assert.equal(q.domain, "mydon");
    assert.match(out, /PARK/);
    assert.match(out, /Кандидат A/);
  });

  it("ventures_list с вердиктом отбирает только его", async () => {
    const { client } = stubClient({
      entities: async () => [
        entity({ id: "v1", name: "Кандидат A", attrs: { verdict: "PARK" } }),
        entity({ id: "v2", name: "Кандидат B", attrs: { verdict: "NO" } }),
      ],
    });
    const out = textOf(await callTool(tools(client), "ventures_list", { verdict: "park" }));
    assert.match(out, /Кандидат A/);
    assert.doesNotMatch(out, /Кандидат B/);
  });

  it("исход прогона вне словаря отбивается до Core", async () => {
    const { client, calls } = stubClient();
    const res = await callTool(tools(client), "runs_recent", { outcome: "ok" });
    assert.equal(res.isError, true);
    // Core на такой исход отвечает 400 (31087ba); отбой на месте экономит
    // сетевой запрос и называет модели годные значения.
    assert.equal(calls.length, 0);
    assert.match(textOf(res), /executed/);
  });

  it("статус карточки агента вне словаря Core отбивается до вызова", async () => {
    const { client, calls } = stubClient({ agents: async () => [agentCard()] });
    const res = await callTool(tools(client), "agent_upsert", {
      name: "vendhub-ops",
      status: "включён",
    });
    assert.equal(res.isError, true);
    assert.equal(calls.length, 0);
    assert.match(textOf(res), /deprecated/);
  });

  it("agent_upsert без единой правки честно говорит, что изменений не было", async () => {
    const { client, calls } = stubClient({ agents: async () => [agentCard()] });
    const out = textOf(await callTool(tools(client), "agent_upsert", { name: "vendhub-ops" }));
    assert.match(out, /изменений не было/);
    assert.ok(!calls.some((c) => c.method === "updateAgent"));
    assert.ok(!calls.some((c) => c.method === "setAutonomy"));
  });

  it("ventures_list не выдаёт «нет таких» за приговор всему реестру", async () => {
    const full = Array.from({ length: MAX_LIMIT }, (_, i) =>
      entity({ id: `v${i}`, name: `Кандидат ${i}`, attrs: { verdict: "NO" } }),
    );
    const { client, calls } = stubClient({ entities: async () => full });
    const out = textOf(await callTool(tools(client), "ventures_list", { verdict: "GO" }));
    // При отборе по вердикту просматриваем максимальное окно, а не страницу.
    assert.equal(argOf(calls, "entities").limit, MAX_LIMIT);
    assert.match(out, /Кандидатов с вердиктом GO нет\./);
    assert.match(out, /Просмотрены первые 200 карточек/);
  });

  it("пустой список навыков не стирает навыки агента", async () => {
    const { client, calls } = stubClient({ agents: async () => [agentCard()] });
    await callTool(tools(client), "agent_upsert", { name: "vendhub-ops", skills: [] });
    assert.ok(
      !calls.some((c) => c.method === "updateAgent"),
      "пустой список ушёл в Core как правка",
    );
  });

  it("кандидатов с таким вердиктом нет — одна честная строка", async () => {
    const { client } = stubClient({ entities: async () => [] });
    const out = textOf(await callTool(tools(client), "ventures_list", { verdict: "GO" }));
    assert.match(out, /Кандидатов с вердиктом GO нет\./);
    assert.doesNotMatch(out, /Карточек нет/);
  });

  it("runs_recent разворачивает { runs } и печатает исход", async () => {
    const { client } = stubClient({ runs: async () => ({ runs: [RUN] }) });
    const out = textOf(await callTool(tools(client), "runs_recent", { agent: "vendhub-ops" }));
    assert.match(out, /vendhub-ops\/parts-audit/);
    assert.match(out, /executed/);
  });

  it("skills_deck отдаёт отбор по агенту Core, а не режет ответ сам", async () => {
    // Дубли и «тир не ниже» дека считает по одноимённым навыкам ВСЕХ агентов:
    // отфильтруй мы ответ у себя — числа остались бы, а причина исчезла.
    const { client, calls } = stubClient({
      skillDeck: async () => ({
        syncedAt: NOW,
        models: { primary: "claude-sonnet", fallbacks: [] },
        items: [
          {
            agent: "vendhub-ops",
            skill: "parts-audit",
            description: "сверка узлов",
            executor: "code",
            tier: "T1",
            agentStatus: "active",
            autonomyDefault: "T0",
            enabled: true,
            crons: [],
            duplicates: 1,
            tierFloor: "T1",
            problems: [],
            hasCode: true,
          },
        ],
      }),
    });
    const out = textOf(await callTool(tools(client), "skills_deck", { agent: "vendhub-ops" }));
    const call = calls.find((c) => c.method === "skillDeck");
    assert.ok(call, "клиент не звал skillDeck");
    assert.deepEqual(call.args, ["vendhub-ops"]);
    assert.match(out, /vendhub-ops\/parts-audit/);
    assert.match(out, /claude-sonnet/);
    assert.doesNotMatch(out, /[{}]/);
  });

  it("skills_deck без агента просит деку целиком", async () => {
    const { client, calls } = stubClient();
    const out = textOf(await callTool(tools(client), "skills_deck", {}));
    assert.deepEqual(calls.find((c) => c.method === "skillDeck")?.args, [undefined]);
    assert.match(out, /Навыков нет/);
  });

  it("approval_decide зовёт решение владельца ровно один раз и подписывается", async () => {
    const { client, calls } = stubClient();
    const out = textOf(
      await callTool(tools(client), "approval_decide", { id: APPROVAL.id, decision: "approved" }),
    );
    const call = calls.find((c) => c.method === "decideApproval");
    assert.ok(call);
    // Третий аргумент — подпись: без неё Core запишет в audit_log «owner», и
    // решение модели станет неотличимо от нажатия владельца.
    assert.deepEqual(call.args, [APPROVAL.id, "approved", "mcp"]);
    assert.match(out, /approved|одобрен/i);
  });

  it("task_comment подписан как mcp и печатает автора из ответа Core", async () => {
    const { client, calls } = stubClient();
    const out = textOf(
      await callTool(tools(client), "task_comment", { id: task().id, body: "готово" }),
    );
    assert.deepEqual(calls.find((c) => c.method === "commentTask")?.args, [
      task().id,
      "готово",
      "mcp",
    ]);
    assert.match(out, /автор mcp/);
    assert.doesNotMatch(out, /undefined/);
  });

  it("подпись mcp стоит у каждого меняющего вызова", async () => {
    // Одна константа на все подписи: пропущенная подпись — это «owner» в
    // журнале Core, то есть чужое имя под действием модели.
    const { client, calls } = stubClient();
    const list = tools(client);
    await callTool(list, "task_create", { title: "Заправить Olma", ownerKind: "human" });
    await callTool(list, "task_status", { id: task().id, status: "done" });
    const created = argOf(calls, "createTask");
    assert.equal(created.source, "mcp");
    assert.equal(created.createdBy, "mcp");
    const patch = calls.find((c) => c.method === "setTaskStatus")?.args[1] as Record<
      string,
      unknown
    >;
    assert.equal(patch.actor, "mcp");
  });

  it("agent_upsert говорит, что стало с набором навыков", async () => {
    // Непустой список ЗАМЕНЯЕТ набор целиком: модель, добавляя один навык,
    // сносит остальные — и должна увидеть это в ответе, а не по молчащим
    // прогонам через неделю.
    const { client, calls } = stubClient({
      agents: async () => [agentCard({ skills: ["parts-audit", "refill-check", "kpi", "sla"] })],
      updateAgent: async () => agentCard({ skills: ["kpi"] }),
    });
    const out = textOf(
      await callTool(tools(client), "agent_upsert", { name: "vendhub-ops", skills: ["kpi"] }),
    );
    const patch = calls.find((c) => c.method === "updateAgent")?.args[1];
    assert.deepEqual(patch, { skills: ["kpi"] });
    assert.match(out, /Навыки: было 4 → стало 1 \(список заменён целиком\)\./);
  });

  it("agent_upsert с пустым списком навыков говорит, что набор не тронут", async () => {
    const { client } = stubClient({
      agents: async () => [agentCard({ skills: ["parts-audit", "kpi"] })],
    });
    const out = textOf(
      await callTool(tools(client), "agent_upsert", { name: "vendhub-ops", skills: [] }),
    );
    assert.match(out, /Навыки не тронуты: пустой список ничего не стирает \(осталось 2\)\./);
    assert.doesNotMatch(out, /было \d+ → стало/);
  });

  it("описание agent_upsert прямо говорит про замену набора навыков", () => {
    const upsert = byName(tools(stubClient().client), "agent_upsert");
    assert.match(upsert.description, /ЗАМЕНЯЕТ весь набор навыков/);
    assert.match(upsert.inputSchema.properties.skills?.description ?? "", /заменяет прежний набор/);
  });

  it("полная страница с личными записями остаётся помеченной", async () => {
    // Отсев личного укорачивает список ДО форматтера: считай полноту по
    // остатку — и модель прочитает неполную выдачу как полную.
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => task({ id: `t-${i}`, domain: "vendhub" })),
      task({ id: "личная", title: "Личная", domain: "personal" }),
    ];
    const { client } = stubClient({ tasks: async () => rows });
    const out = textOf(await callTool(tools(client), "tasks_list", { limit: 5 }));
    assert.doesNotMatch(out, /Личная/);
    assert.match(out, /Core вернул полную страницу \(5\) — в списке задач могут быть ещё\./);
    assert.match(out, /Часть записей скрыта \(личный контур\): 1\./);
  });

  it("то же в поиске по реестру", async () => {
    const cards = [
      ...Array.from({ length: 2 }, (_, i) => entity({ id: `e-${i}`, domain: "vendhub" })),
      entity({ id: "личная", name: "Квартира", domain: "personal" }),
    ];
    const { client } = stubClient({ entities: async () => cards });
    const out = textOf(await callTool(tools(client), "registry_search", { q: "а", limit: 3 }));
    assert.doesNotMatch(out, /Квартира/);
    assert.match(out, /Core вернул полную страницу \(3\) — в реестре могут быть ещё\./);
    assert.match(out, /Часть записей скрыта \(личный контур\): 1\./);
  });

  it("briefing_get и agents_list печатают компактный текст, а не JSON", async () => {
    const { client } = stubClient({ agents: async () => [agentCard()] });
    const brief = textOf(await callTool(tools(client), "briefing_get", {}));
    const agents = textOf(await callTool(tools(client), "agents_list", {}));
    assert.match(brief, /Брифинг/);
    assert.doesNotMatch(brief, /[{}]/);
    assert.match(agents, /vendhub-ops/);
    assert.doesNotMatch(agents, /[{}]/);
  });

  it("kb_tree берёт дерево целиком и отбирает корень сам", async () => {
    const { client, calls } = stubClient({
      docsTree: async () => [
        { path: "memory/x.md", root: "memory", title: "X", bytes: 10, updatedAt: NOW },
        { path: "docs/MCP.md", root: "docs", title: "MCP", bytes: 10, updatedAt: NOW },
      ],
    });
    const out = textOf(await callTool(tools(client), "kb_tree", { root: "memory" }));
    // У `GET /docs/tree` фильтра по корню нет — клиента зовём без параметров.
    assert.deepEqual(calls.find((c) => c.method === "docsTree")?.args, []);
    assert.match(out, /memory\/x\.md/);
    assert.doesNotMatch(out, /docs\/MCP\.md/);
  });

  it("промах по корню — отказ со списком настоящих корней, а не «страниц нет»", async () => {
    // Набор корней закрыт (`apps/core/src/docs/docs-graph.ts`), и промах по
    // нему раньше давал уверенное «страниц нет» — приговор всей базе знаний.
    const { client } = stubClient({
      docsTree: async () => [
        { path: "memory/x.md", root: "memory", title: "X", bytes: 10, updatedAt: NOW },
        { path: "docs/MCP.md", root: "docs", title: "MCP", bytes: 10, updatedAt: NOW },
        { path: "routers/dev.md", root: "routers", title: "Dev", bytes: 10, updatedAt: NOW },
      ],
    });
    const res = await callTool(tools(client), "kb_tree", { root: "документы" });
    assert.equal(res.isError, true);
    assert.match(textOf(res), /docs, memory, routers/);
    assert.doesNotMatch(textOf(res), /Страниц знаний .* нет/);
  });

  it("agents_list показывает архив только по явной просьбе", async () => {
    const { client, calls } = stubClient({ agents: async () => [agentCard()] });
    const list = tools(client);
    await callTool(list, "agents_list", {});
    await callTool(list, "agents_list", { archived: true });
    const [first, second] = calls.filter((c) => c.method === "agents");
    assert.deepEqual(first?.args[0], {});
    assert.deepEqual(second?.args[0], { archived: true });
    // Описание не обещает архив по умолчанию — Core его без параметра не отдаёт.
    assert.match(byName(list, "agents_list").description, /archived/);
  });
});
