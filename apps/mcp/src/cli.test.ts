import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs } from "./args";
import { runCommand } from "./cli";
import { CoreError } from "./core-client";
import type {
  Agent,
  AgentRun,
  Approval,
  Briefing,
  CoreClient,
  CoreEvent,
  EntityCard,
  PendingEntities,
  Task,
} from "./core-client";
import {
  formatAgents,
  formatBriefing,
  formatEntities,
  formatEvents,
  formatInbox,
  formatRuns,
  formatTask,
  formatTasks,
} from "./format";

/**
 * Стаб клиента Core: методы, не заявленные в `overrides`, бросают ошибку при
 * вызове — так тесты «клиент НЕ должен был вызываться» ловят реальный вызов,
 * а не молчаливо получают `undefined`.
 */
function stubClient(overrides: Partial<CoreClient> = {}): CoreClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === "string" && prop in overrides) {
          return (overrides as Record<string, unknown>)[prop];
        }
        return async () => {
          throw new Error(`стаб: метод ${String(prop)} не должен был вызываться в этом тесте`);
        };
      },
    },
  ) as CoreClient;
}

function approvalFixture(over: Partial<Approval> = {}): Approval {
  return {
    id: "appr-1",
    agent: "vendhub-ops",
    action: "decide_price",
    tier: "T2",
    payload: {},
    decision: "pending",
    decidedAt: null,
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    ...over,
  };
}

function taskFixture(over: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Проверить остатки",
    description: null,
    ownerKind: "human",
    ownerRef: "jamshid",
    domain: "vendhub",
    entityId: null,
    status: "todo",
    priority: "normal",
    due: null,
    source: null,
    createdBy: null,
    resultNote: null,
    completedAt: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    ...over,
  };
}

function eventFixture(over: Partial<CoreEvent> = {}): CoreEvent {
  return {
    id: "event-1",
    source: "ourvend",
    type: "sale.recorded",
    payload: {},
    occurredAt: "2026-09-01T10:15:00.000Z",
    createdAt: "2026-09-01T10:15:05.000Z",
    ...over,
  };
}

function briefingFixture(over: Partial<Briefing> = {}): Briefing {
  return {
    generatedAt: "2026-09-06T02:30:00.000Z",
    tz: "Asia/Tashkent",
    overdueMoney: 1_250_000,
    idleMachines: 3,
    pendingApprovals: 2,
    contractsDueSoon: 1,
    contractsBadDate: 0,
    overdueTasks: 4,
    ...over,
  };
}

function agentFixture(over: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    name: "vendhub-ops",
    business: "vendhub",
    status: "active",
    description: null,
    mission: null,
    autonomyDefault: "T0",
    skills: [],
    schedule: [],
    archivedAt: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function runFixture(over: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "run-1",
    agentName: "vendhub-ops",
    skill: "refill-check",
    trigger: "cron",
    cron: null,
    scheduledAt: null,
    taskId: null,
    approvalId: null,
    startedAt: "2026-09-01T03:00:00.000Z",
    finishedAt: "2026-09-01T03:00:05.000Z",
    outcome: "executed",
    skipReason: null,
    hook: null,
    reason: "остатков хватает",
    action: null,
    review: null,
    ...over,
  };
}

function entityFixture(over: Partial<EntityCard> = {}): EntityCard {
  return {
    id: "entity-1",
    type: "machine",
    name: "Olma-12",
    externalRef: "2508160376",
    attrs: {},
    approvedAt: null,
    approvedBy: null,
    createdFrom: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("runCommand — CLI mydon поверх клиента Core (R-A1-3)", () => {
  it("mydon inbox печатает то же, что formatInbox", async () => {
    const approvals = [approvalFixture()];
    const entities: PendingEntities = { cards: [], fields: [] };
    const client = stubClient({
      pendingApprovals: async () => approvals,
      pendingEntities: async () => entities,
    });
    const result = await runCommand(parseArgs(["inbox"]), { client });
    assert.equal(result.text, formatInbox(approvals, entities));
    assert.equal(result.code, 0);
  });

  it("mydon inbox --json печатает сырые данные, а не текст форматтера", async () => {
    const approvals = [approvalFixture()];
    const entities: PendingEntities = { cards: [], fields: [] };
    const client = stubClient({
      pendingApprovals: async () => approvals,
      pendingEntities: async () => entities,
    });
    const result = await runCommand(parseArgs(["inbox", "--json"]), { client });
    assert.deepEqual(JSON.parse(result.text), { approvals, entities });
    assert.notEqual(result.text, formatInbox(approvals, entities));
  });

  it("mydon tasks печатает то же, что formatTasks, и шлёт фильтры в клиент", async () => {
    const tasks = [taskFixture()];
    let seenQuery: unknown;
    const client = stubClient({
      tasks: async (q) => {
        seenQuery = q;
        return tasks;
      },
    });
    const result = await runCommand(
      parseArgs(["tasks", "--status", "todo", "--owner", "jamshid"]),
      { client },
    );
    assert.equal(result.text, formatTasks(tasks));
    assert.equal(result.code, 0);
    // Умолчание уходит В ЗАПРОС: без него Core отдавал свою страницу, а CLI
    // печатал её как весь ответ.
    assert.deepEqual(seenQuery, {
      status: "todo",
      ownerRef: "jamshid",
      domain: undefined,
      limit: 50,
    });
  });

  it("mydon tasks --limit N шлёт N в Core и печатает предел тем же числом", async () => {
    // `mydon events --limit 5` печатал «События: 5» как весь ответ: предел в
    // запрос уходил, а форматтер считал полноту по своему умолчанию 50.
    const tasks = Array.from({ length: 5 }, (_, i) => taskFixture({ id: `task-${i}` }));
    let seenLimit: number | undefined;
    const client = stubClient({
      tasks: async (q) => {
        seenLimit = q.limit;
        return tasks;
      },
    });
    const result = await runCommand(parseArgs(["tasks", "--limit", "5"]), { client });
    assert.equal(seenLimit, 5);
    assert.match(result.text, /Показаны первые 5 — в списке задач могут быть ещё\./);
  });

  it("тот же предел у events, runs и search", async () => {
    const events = Array.from({ length: 2 }, () => eventFixture());
    const entities = Array.from({ length: 2 }, () => entityFixture());
    const runs = Array.from({ length: 2 }, () => runFixture());
    const seen: Record<string, number | undefined> = {};
    const client = stubClient({
      events: async (q) => {
        seen.events = q.limit;
        return events;
      },
      entities: async (q) => {
        seen.entities = q.limit;
        return entities;
      },
      runs: async (q) => {
        seen.runs = q.limit;
        return { runs };
      },
    });
    const ev = await runCommand(parseArgs(["events", "--limit", "2"]), { client });
    const se = await runCommand(parseArgs(["search", "склад", "--limit", "2"]), { client });
    const ru = await runCommand(parseArgs(["runs", "--limit", "2"]), { client });
    assert.deepEqual(seen, { events: 2, entities: 2, runs: 2 });
    assert.match(ev.text, /Показаны первые 2 — в ленте событий могут быть ещё\./);
    assert.match(se.text, /Показаны первые 2 — в реестре могут быть ещё\./);
    assert.match(ru.text, /Показаны первые 2 — в журнале прогонов могут быть ещё\./);
  });

  it("mydon task <id> печатает карточку задачи", async () => {
    const t = taskFixture({ id: "task-42" });
    const client = stubClient({
      task: async (id) => (id === "task-42" ? t : Promise.reject(new Error("не тот id"))),
    });
    const result = await runCommand(parseArgs(["task", "task-42"]), { client });
    assert.equal(result.text, formatTask(t));
    assert.equal(result.code, 0);
  });

  it("mydon task без id — код 2, клиент не зовётся", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["task"]), { client });
    assert.equal(result.code, 2);
    assert.match(result.text, /id/);
  });

  it("mydon task-create без --title — код 2, клиент не зовётся", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["task-create"]), { client });
    assert.equal(result.code, 2);
    assert.match(result.text, /title/);
  });

  it("mydon task-create без --yes печатает намерение, НЕ зовёт клиент, код 0", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["task-create", "--title", "Заправить точку 12"]), {
      client,
    });
    assert.equal(result.code, 0);
    assert.match(result.text, /Заправить точку 12/);
    assert.match(result.text, /--yes/);
  });

  it("mydon task-create --yes зовёт createTask и печатает карточку созданной задачи", async () => {
    let seenInput: unknown;
    const created = taskFixture({ id: "task-99", title: "Заправить точку 12" });
    const client = stubClient({
      createTask: async (input) => {
        seenInput = input;
        return created;
      },
    });
    const result = await runCommand(
      parseArgs(["task-create", "--title", "Заправить точку 12", "--yes"]),
      { client },
    );
    assert.equal(result.code, 0);
    assert.equal(result.text, formatTask(created));
    assert.deepEqual(seenInput, {
      title: "Заправить точку 12",
      ownerKind: "human",
      // Источник проставлен и здесь: задача из терминала владельца не должна
      // приходить в Core ничьей, а `mcp` соврал бы про происхождение.
      source: "mydon-cli",
      ownerRef: undefined,
      domain: undefined,
      due: undefined,
      description: undefined,
      priority: undefined,
    });
  });

  it("известный флаг без значения — usage-ошибка, а не тихо потерянный фильтр", async () => {
    // `--status` перед другим флагом парсер отдаёт как `true`. Раньше
    // `strFlag` считал это «не задано» и печатал ВСЕ задачи на вопрос про
    // одно состояние; `--limit` в том же положении отказывал. Правило одно.
    const client = stubClient({ tasks: async () => [] });
    for (const argv of [
      ["tasks", "--status", "--limit", "10"],
      ["tasks", "--status="],
      ["task-create", "--title", "--yes"],
    ]) {
      const result = await runCommand(parseArgs(argv), { client });
      assert.equal(result.code, 2, `${argv.join(" ")} → ${result.text}`);
      assert.match(result.text, /требует значения|title/);
    }
  });

  it("mydon events печатает то же, что formatEvents", async () => {
    const events = [eventFixture()];
    const client = stubClient({ events: async () => events });
    const result = await runCommand(parseArgs(["events", "--source", "ourvend", "--limit", "10"]), {
      client,
    });
    assert.equal(result.text, formatEvents(events));
    assert.equal(result.code, 0);
  });

  it("mydon events --limit не число — код 2, клиент не зовётся", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["events", "--limit", "abc"]), { client });
    assert.equal(result.code, 2);
  });

  it("mydon runs печатает то же, что formatRuns", async () => {
    const runs = [
      {
        id: "run-1",
        agentName: "vendhub-ops",
        skill: "refill-check",
        trigger: "cron",
        cron: null,
        scheduledAt: null,
        taskId: null,
        approvalId: null,
        startedAt: "2026-09-01T03:00:00.000Z",
        finishedAt: "2026-09-01T03:00:05.000Z",
        outcome: "done",
        skipReason: null,
        hook: null,
        reason: "остатков хватает",
        action: null,
        review: null,
      },
    ];
    const client = stubClient({ runs: async () => ({ runs }) });
    const result = await runCommand(parseArgs(["runs", "--agent", "vendhub-ops"]), { client });
    assert.equal(result.text, formatRuns(runs));
    assert.equal(result.code, 0);
  });

  it("mydon kb <path> печатает содержимое документа", async () => {
    const file = {
      path: "docs/MCP.md",
      root: "docs",
      title: "MCP",
      bytes: 20,
      updatedAt: "2026-09-01T00:00:00.000Z",
      markdown: "# MCP\n\nТекст.",
    };
    const client = stubClient({
      docFile: async (p) => (p === "docs/MCP.md" ? file : Promise.reject(new Error("не тот путь"))),
    });
    const result = await runCommand(parseArgs(["kb", "docs/MCP.md"]), { client });
    assert.match(result.text, /Текст\./);
    assert.equal(result.code, 0);
  });

  it("mydon search <q> печатает то же, что formatEntities", async () => {
    const entities = [entityFixture()];
    const client = stubClient({ entities: async (q) => (q.q === "olma" ? entities : []) });
    const result = await runCommand(parseArgs(["search", "olma"]), { client });
    assert.equal(result.text, formatEntities(entities));
    assert.equal(result.code, 0);
  });

  it("mydon search без запроса — код 2", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["search"]), { client });
    assert.equal(result.code, 2);
  });

  it("mydon briefing печатает то же, что formatBriefing", async () => {
    const briefing = briefingFixture();
    const client = stubClient({ briefing: async () => briefing });
    const result = await runCommand(parseArgs(["briefing"]), { client });
    assert.equal(result.text, formatBriefing(briefing));
    assert.equal(result.code, 0);
  });

  it("mydon briefing --json печатает сырой ответ", async () => {
    const briefing = briefingFixture();
    const client = stubClient({ briefing: async () => briefing });
    const result = await runCommand(parseArgs(["briefing", "--json"]), { client });
    assert.deepEqual(JSON.parse(result.text), briefing);
  });

  it("mydon agents печатает то же, что formatAgents", async () => {
    const agents = [agentFixture()];
    const client = stubClient({ agents: async () => agents });
    const result = await runCommand(parseArgs(["agents"]), { client });
    assert.equal(result.text, formatAgents(agents));
    assert.equal(result.code, 0);
  });

  it("mydon decide <id> approved без --yes печатает намерение, НЕ зовёт клиент, код 0", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["decide", "appr-1", "approved"]), { client });
    assert.equal(result.code, 0);
    assert.match(result.text, /appr-1/);
    assert.match(result.text, /approved/);
    assert.match(result.text, /--yes/);
  });

  it("mydon decide <id> approved --yes зовёт decideApproval", async () => {
    let seenArgs: [string, string] | undefined;
    const decided = approvalFixture({ id: "appr-1", decision: "approved" });
    const client = stubClient({
      decideApproval: async (id, decision) => {
        seenArgs = [id, decision];
        return decided;
      },
    });
    const result = await runCommand(parseArgs(["decide", "appr-1", "approved", "--yes"]), {
      client,
    });
    assert.deepEqual(seenArgs, ["appr-1", "approved"]);
    assert.equal(result.code, 0);
    assert.match(result.text, /appr-1/);
  });

  it("mydon decide с неверным решением — код 2, клиент не зовётся", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["decide", "appr-1", "maybe", "--yes"]), { client });
    assert.equal(result.code, 2);
  });

  it("mydon decide --json без --yes печатает сырое намерение", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["decide", "appr-1", "approved", "--json"]), {
      client,
    });
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.text), { dryRun: true, id: "appr-1", decision: "approved" });
  });

  it("неизвестная команда — код 2 и список известных команд, клиент не зовётся", async () => {
    const client = stubClient();
    const result = await runCommand(parseArgs(["frobnicate"]), { client });
    assert.equal(result.code, 2);
    for (const cmd of [
      "inbox",
      "tasks",
      "task",
      "task-create",
      "events",
      "runs",
      "kb",
      "search",
      "briefing",
      "agents",
      "decide",
    ]) {
      assert.match(result.text, new RegExp(cmd));
    }
  });

  it("валидный, но чужой для команды флаг — код 2, а не тихое проглатывание", async () => {
    // `--status` — законный флаг `tasks`, но `task-create` статус не задаёт:
    // раньше он проходил общий словарь `parseArgs` и молча пропадал.
    const client = stubClient();
    const result = await runCommand(
      parseArgs(["task-create", "--title", "Заправить точку 12", "--status", "done", "--yes"]),
      { client },
    );
    assert.equal(result.code, 2);
    assert.match(result.text, /--status/);
    assert.match(result.text, /task-create/);
    // Сообщение перечисляет применимые флаги, а не только отказывает.
    assert.match(result.text, /--title/);
  });

  it("чужой флаг ловится и на читающих командах, до похода в Core", async () => {
    const client = stubClient();
    for (const argv of [
      ["inbox", "--limit", "10"],
      ["briefing", "--agent", "vendhub-ops"],
      ["runs", "--status", "done"],
      ["search", "склад", "--owner", "jamshid"],
    ]) {
      const result = await runCommand(parseArgs(argv), { client });
      assert.equal(result.code, 2, `${argv.join(" ")} должен быть usage-ошибкой`);
      assert.match(result.text, /не применим к команде/);
    }
  });

  it("свои флаги команд и глобальный --json проходят проверку", async () => {
    const client = stubClient({
      tasks: async () => [],
      runs: async () => ({ runs: [] }),
      entities: async () => [],
      events: async () => [],
      briefing: async () => briefingFixture(),
    });
    for (const argv of [
      ["tasks", "--status", "todo", "--owner", "jamshid", "--domain", "vendhub", "--limit", "5"],
      ["runs", "--agent", "vendhub-ops", "--skill", "parts-audit", "--limit", "5", "--json"],
      ["search", "склад", "--domain", "vendhub", "--type", "machine", "--limit", "5"],
      ["events", "--source", "bot", "--type", "task.created", "--limit", "5"],
      ["briefing", "--json"],
    ]) {
      const result = await runCommand(parseArgs(argv), { client });
      assert.equal(result.code, 0, `${argv.join(" ")} → ${result.text}`);
    }
  });

  it("ошибка Core переводится и попадает в текст с кодом 1, а не падением", async () => {
    const client = stubClient({
      briefing: async () => {
        throw new CoreError(
          401,
          "/registry/briefing",
          "Core не принял токен: проверь SERVICE_TOKEN в окружении.",
        );
      },
    });
    const result = await runCommand(parseArgs(["briefing"]), { client });
    assert.equal(result.code, 1);
    assert.match(result.text, /SERVICE_TOKEN/);
    assert.doesNotMatch(result.text, /секрет/);
  });
});
