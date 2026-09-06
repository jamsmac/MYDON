import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clamp,
  formatAgents,
  formatBriefing,
  formatDeck,
  formatDoc,
  formatEntities,
  formatEvents,
  formatInbox,
  formatRuns,
  formatTask,
  formatTasks,
  MAX_KB_BYTES,
  MAX_LIST_ITEMS,
  MAX_RESPONSE_CHARS,
} from "./format";
import type {
  Agent,
  AgentRun,
  Approval,
  Briefing,
  CoreEvent,
  DocFile,
  EntityCard,
  PendingEntities,
  SkillDeck,
  Task,
} from "./core-client";

/** Момент N часов назад в формате ISO — для проверки возраста согласований. */
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function approval(over: Partial<Approval> = {}): Approval {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    agent: "vendhub-ops",
    action: "decide_price",
    tier: "T2",
    payload: {},
    decision: "pending",
    decidedAt: null,
    createdAt: hoursAgo(2),
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Проверить остатки на точке",
    description: null,
    ownerKind: "human",
    ownerRef: "jamshid",
    domain: "vendhub",
    entityId: null,
    status: "todo",
    priority: "normal",
    due: "2026-09-10",
    source: null,
    createdBy: null,
    resultNote: null,
    completedAt: null,
    createdAt: "2026-09-01T08:00:00.000Z",
    ...over,
  };
}

function event(over: Partial<CoreEvent> = {}): CoreEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    source: "ourvend",
    type: "sale.recorded",
    payload: { machineId: "M-1", amount: 15000 },
    occurredAt: "2026-09-01T10:15:00.000Z",
    createdAt: "2026-09-01T10:15:05.000Z",
    ...over,
  };
}

function run(over: Partial<AgentRun> = {}): AgentRun {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    agentName: "vendhub-ops",
    skill: "refill-check",
    trigger: "cron",
    cron: "0 8 * * *",
    scheduledAt: "2026-09-01T03:00:00.000Z",
    taskId: null,
    approvalId: null,
    startedAt: "2026-09-01T03:00:01.000Z",
    finishedAt: "2026-09-01T03:00:05.000Z",
    outcome: "done",
    skipReason: null,
    hook: null,
    reason: "остатков хватает",
    action: null,
    review: null,
    ...over,
  };
}

function entityCard(over: Partial<EntityCard> = {}): EntityCard {
  return {
    id: "55555555-5555-4555-8555-555555555555",
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

function agent(over: Partial<Agent> = {}): Agent {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    name: "vendhub-ops",
    business: "vendhub",
    status: "active",
    description: null,
    mission: null,
    autonomyDefault: "T0",
    skills: ["refill-check"],
    schedule: [],
    archivedAt: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function briefing(over: Partial<Briefing> = {}): Briefing {
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

function docFile(over: Partial<DocFile> = {}): DocFile {
  const markdown = "# Заголовок\n\nСодержимое документа.";
  return {
    path: "docs/example.md",
    root: "docs",
    title: "Пример",
    bytes: Buffer.byteLength(markdown, "utf8"),
    updatedAt: "2026-09-01T00:00:00.000Z",
    markdown,
    ...over,
  };
}

describe("clamp (Р-5, предел ответа)", () => {
  it("короткий текст возвращает как есть", () => {
    assert.equal(clamp("привет", 100), "привет");
  });

  it("режет ровно по лимиту и добавляет пометку об обрезке", () => {
    const text = "а".repeat(500);
    const out = clamp(text, 50);
    assert.equal(out.length, 50);
    assert.ok(out.endsWith("…(обрезано)"), `ожидали пометку обрезки, получили: ${out}`);
  });

  it("текст ровно на границе лимита не трогается", () => {
    const text = "б".repeat(50);
    assert.equal(clamp(text, 50), text);
  });
});

describe("formatInbox — очередь решений (Р-5)", () => {
  it("пустой вход — честная фраза, а не пустая строка", () => {
    const empty: PendingEntities = { cards: [], fields: [] };
    const out = formatInbox([], empty);
    assert.equal(out, "Ничего не ждёт решения");
  });

  it("первая строка — сводка согласований и записей", () => {
    const entities: PendingEntities = { cards: [entityCard()], fields: [] };
    const out = formatInbox([approval()], entities);
    const firstLine = out.split("\n")[0];
    assert.equal(firstLine, "Ждёт решения: 1 согласований, 1 записей");
  });

  it("строка согласования несёт id, действие, тир и возраст", () => {
    const a = approval({ id: "approval-xyz", action: "decide_price", tier: "T3", createdAt: hoursAgo(2) });
    const out = formatInbox([a], { cards: [], fields: [] });
    const line = out.split("\n").find((l: string) => l.includes("approval-xyz"));
    assert.ok(line, "строка согласования не найдена");
    assert.match(line!, /approval-xyz/);
    assert.match(line!, /decide_price/);
    assert.match(line!, /T3/);
    assert.match(line!, /2 ч/);
  });

  it("список согласований ограничен MAX_LIST_ITEMS с честной пометкой", () => {
    const approvals = Array.from({ length: MAX_LIST_ITEMS + 10 }, (_, i) =>
      approval({ id: `a-${i}`, createdAt: hoursAgo(1) }),
    );
    const out = formatInbox(approvals, { cards: [], fields: [] });
    assert.match(out, new RegExp(`Показаны первые ${MAX_LIST_ITEMS} из ${MAX_LIST_ITEMS + 10}`));
    // Последний элемент за пределами лимита не должен попасть в текст.
    assert.ok(!out.includes(`a-${MAX_LIST_ITEMS + 9}`));
  });
});

describe("formatTasks — список задач", () => {
  it("пустой список — честная фраза", () => {
    assert.equal(formatTasks([]), "Задач нет.");
  });

  it("печатает статус, владельца и дату по Ташкенту", () => {
    const t = task({ status: "in_progress", ownerKind: "agent", ownerRef: "vendhub-ops", due: "2026-09-10" });
    const out = formatTasks([t]);
    assert.match(out, /в работе/);
    assert.match(out, /агент/);
    assert.match(out, /vendhub-ops/);
    assert.match(out, /2026-09-10/);
  });

  it("id задачи присутствует для последующих действий", () => {
    const t = task({ id: "task-abc" });
    const out = formatTasks([t]);
    assert.match(out, /task-abc/);
  });
});

describe("formatTask — карточка одной задачи", () => {
  it("несёт статус, владельца, приоритет и срок по Ташкенту", () => {
    const t = task({ status: "done", priority: "urgent", due: "2026-09-10", resultNote: "готово, остатки пополнены" });
    const out = formatTask(t);
    assert.match(out, /готово/);
    assert.match(out, /срочно/);
    assert.match(out, /2026-09-10/);
    assert.match(out, /остатки пополнены/);
  });
});

describe("formatEvents — журнал событий", () => {
  it("пустой список — честная фраза", () => {
    assert.equal(formatEvents([]), "Событий нет.");
  });

  it("печатает время, источник, тип и первые 120 символов payload", () => {
    const bigPayload = { note: "x".repeat(200) };
    const e = event({ source: "ourvend", type: "sale.recorded", payload: bigPayload, occurredAt: "2026-09-01T10:15:00.000Z" });
    const out = formatEvents([e]);
    assert.match(out, /ourvend/);
    assert.match(out, /sale\.recorded/);
    assert.match(out, /2026-09-01/);
    const json = JSON.stringify(bigPayload);
    assert.ok(out.includes(json.slice(0, 120)), "должны попасть первые 120 символов payload");
    assert.ok(!out.includes(json.slice(0, 121)), "121-й символ payload попадать не должен");
  });
});

describe("formatRuns — запуски агентов", () => {
  it("пустой список — честная фраза", () => {
    assert.equal(formatRuns([]), "Запусков нет.");
  });

  it("печатает агента, навык, триггер и исход", () => {
    const r = run({ agentName: "vendhub-ops", skill: "refill-check", trigger: "cron", outcome: "done" });
    const out = formatRuns([r]);
    assert.match(out, /vendhub-ops/);
    assert.match(out, /refill-check/);
    assert.match(out, /cron/);
    assert.match(out, /done/);
  });
});

describe("formatEntities — карточки реестра", () => {
  it("пустой список — честная фраза", () => {
    assert.equal(formatEntities([]), "Карточек нет.");
  });

  it("печатает id, тип и имя", () => {
    const c = entityCard({ id: "entity-1", type: "machine", name: "Olma-12" });
    const out = formatEntities([c]);
    assert.match(out, /entity-1/);
    assert.match(out, /machine/);
    assert.match(out, /Olma-12/);
  });
});

describe("formatAgents — список агентов", () => {
  it("пустой список — честная фраза", () => {
    assert.equal(formatAgents([]), "Агентов нет.");
  });

  it("печатает имя, статус и автономию", () => {
    const a = agent({ name: "vendhub-ops", status: "active", autonomyDefault: "T1" });
    const out = formatAgents([a]);
    assert.match(out, /vendhub-ops/);
    assert.match(out, /active/);
    assert.match(out, /T1/);
  });
});

describe("formatDeck — колода навыков", () => {
  it("пустая колода — честная фраза, а модель всё равно видна", () => {
    const deck: SkillDeck = { syncedAt: null, models: { primary: null, fallbacks: [] }, items: [] };
    const out = formatDeck(deck);
    assert.match(out, /Навыков нет/);
  });

  it("печатает агента, навык и тир пункта", () => {
    const deck: SkillDeck = {
      syncedAt: "2026-09-01T00:00:00.000Z",
      models: { primary: "claude-sonnet", fallbacks: ["claude-haiku"] },
      items: [
        {
          agent: "vendhub-ops",
          skill: "refill-check",
          description: "проверка остатков",
          executor: "cron",
          tier: "T1",
          agentStatus: "active",
          autonomyDefault: "T0",
          enabled: true,
          crons: ["0 8 * * *"],
          duplicates: 0,
          problems: [],
          hasCode: true,
        },
      ],
    };
    const out = formatDeck(deck);
    assert.match(out, /vendhub-ops/);
    assert.match(out, /refill-check/);
    assert.match(out, /T1/);
    assert.match(out, /claude-sonnet/);
  });
});

describe("formatBriefing — сводка", () => {
  it("печатает время по Ташкенту и ключевые числа", () => {
    const b = briefing();
    const out = formatBriefing(b);
    assert.match(out, /2026-09-06/);
    // Разделитель тысяч зависит от ICU рантайма — сверяемся с тем же
    // `toLocaleString`, а не гадаем вид пробела.
    assert.ok(out.includes(b.overdueMoney.toLocaleString("ru-RU")));
    assert.match(out, /Простаивающие автоматы: 3/);
    assert.match(out, /Просроченные задачи: 4/);
  });
});

describe("formatDoc — чтение документа (kb_read ≤ 64 КБ)", () => {
  it("короткий документ выводится целиком без пометки обрезки", () => {
    const out = formatDoc(docFile());
    assert.match(out, /Заголовок/);
    assert.match(out, /Содержимое документа/);
    assert.ok(!out.includes("обрезано"));
  });

  it("длинный документ обрезается по байтам и честно называет полный размер", () => {
    // Кириллица — два байта на символ: 40000 символов уже вдвое больше лимита.
    const markdown = "документ ".repeat(8000);
    const totalBytes = Buffer.byteLength(markdown, "utf8");
    const file = docFile({ markdown, bytes: totalBytes });
    const out = formatDoc(file);
    assert.match(out, /обрезано/);
    assert.match(out, new RegExp(`из ${totalBytes} байт`));
    // Тело ответа не должно превышать лимит kb_read с большим запасом.
    assert.ok(Buffer.byteLength(out, "utf8") <= MAX_KB_BYTES + 500);
  });
});

describe("Общий предел текста ответа", () => {
  it("ни один список-форматтер не превышает MAX_RESPONSE_CHARS", () => {
    const tasks = Array.from({ length: 200 }, (_, i) =>
      task({ id: `task-${i}`, title: "Очень длинное название задачи для проверки предела ответа ".repeat(3) }),
    );
    const out = formatTasks(tasks);
    assert.ok(out.length <= MAX_RESPONSE_CHARS);
  });
});
