import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { agent, agentSkillCatalog, systemConfig } from "@mydon/db";
import { AgentsService, type CatalogSkillInput } from "./agents.service";

type Row = Record<string, unknown>;

/** Стаб базы: копит values из insert/update, чтобы проверить, что кладём. */
function stub(opts: { existing?: Row; selectRows?: Row[] }) {
  const captured = { insert: [] as Row[], update: [] as Row[] };
  const tx = {
    insert: () => ({
      values: (v: Row) => {
        captured.insert.push(v);
        return { returning: async () => [{ id: "a1", ...v }] };
      },
    }),
    update: () => ({
      set: (v: Row) => {
        captured.update.push(v);
        return { where: () => ({ returning: async () => [{ ...(opts.existing ?? {}), ...v }] }) };
      },
    }),
  };
  const db = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => opts.selectRows ?? (opts.existing ? [opts.existing] : []) }) }),
    }),
    transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
  } as never;
  return { db, captured };
}

/** Сервис задач нужен только запуску навыка: в остальных сценариях его вызов — регресс. */
const noTasks = {
  create: async () => {
    throw new Error("tasks.create вызван вне сценария запуска навыка");
  },
} as never;

/** Настройки системы читает только сетка состояний: в остальных сценариях вызов — регресс. */
const noSystem = {
  effective: async () => {
    throw new Error("system.effective вызван вне сценария состояния агентов");
  },
} as never;

describe("Настройки агента: конфиг-поля навыков в базе", () => {
  it("create кладёт пустые конфиг-поля по умолчанию (не теряются при загрузке из базы)", async () => {
    const { db, captured } = stub({ selectRows: [] });
    await new AgentsService(db, noTasks, noSystem).create({ name: "knowledge-curator" });
    const v = captured.insert[0]; // первый insert — сам агент (второй — аудит)
    assert.deepEqual(v.webSources, []);
    assert.deepEqual(v.breakGlass, []);
    assert.deepEqual(v.ideaChannels, []);
    assert.deepEqual(v.kbPages, [], "kb_pages по умолчанию пусты — иначе NOT NULL колонка упала бы на insert");
    assert.deepEqual(v.hooks, {}, "hooks по умолчанию пусты — колонка NOT NULL (волна R)");
    assert.equal(v.budgetOnExceeded, null);
  });

  it("хуки паспорта переживают сид и правку карточки (волна R)", async () => {
    // Рантайм грузит агентов ИЗ БАЗЫ: не сохранив hooks при сиде, мы потеряли бы
    // pre_run-проверки паспорта сразу после первого запуска.
    const hooks = { preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }] };
    const seed = stub({ selectRows: [] });
    const seeded = await new AgentsService(seed.db, noTasks, noSystem).seedIfEmpty([
      { name: "vendhub-ops", hooks },
    ]);
    assert.equal(seeded.seeded, 1);
    assert.deepEqual(seed.captured.insert[0].hooks, hooks, "сид кладёт хуки в карточку");

    const edit = stub({ existing: { id: "a1", name: "vendhub-ops" } });
    const svc = new AgentsService(edit.db, noTasks, noSystem);
    await svc.update("vendhub-ops", { hooks: { postRun: [{ kind: "coach_lite" }] } });
    assert.deepEqual(edit.captured.update[0].hooks, { postRun: [{ kind: "coach_lite" }] });
    await svc.update("vendhub-ops", { description: "только описание" });
    assert.equal("hooks" in edit.captured.update[1], false, "непереданные хуки не затираются");
  });

  it("update пишет страницы знаний (kbPages) и не трогает их, когда поле не передано", async () => {
    const { db, captured } = stub({ existing: { id: "a1", name: "globerent-sales" } });
    const svc = new AgentsService(db, noTasks, noSystem);
    await svc.update("globerent-sales", {
      kbPages: ["shared/kb/globerent/heli-models.md", "shared/kb/globerent/pricelist.md"],
    });
    assert.deepEqual(captured.update[0].kbPages, [
      "shared/kb/globerent/heli-models.md",
      "shared/kb/globerent/pricelist.md",
    ]);
    await svc.update("globerent-sales", { description: "только описание" });
    assert.equal("kbPages" in captured.update[1], false, "непереданные kbPages не затираются");
  });

  it("update переносит каналы идей, break-glass и стратегию бюджета", async () => {
    const { db, captured } = stub({ existing: { id: "a1", name: "knowledge-curator" } });
    await new AgentsService(db, noTasks, noSystem).update("knowledge-curator", {
      ideaChannels: ["promtjam"],
      breakGlass: ["read-sources"],
      budgetOnExceeded: "pause",
    });
    const v = captured.update[0];
    assert.deepEqual(v.ideaChannels, ["promtjam"]);
    assert.deepEqual(v.breakGlass, ["read-sources"]);
    assert.equal(v.budgetOnExceeded, "pause");
    assert.equal("webSources" in v, false, "непереданные поля не трогаем");
  });

  it("update пишет веб-источники", async () => {
    const { db, captured } = stub({ existing: { id: "a1", name: "market-analyst" } });
    await new AgentsService(db, noTasks, noSystem).update("market-analyst", {
      webSources: [{ name: "cbu", url: "https://cbu.uz" }],
    });
    assert.deepEqual(captured.update[0].webSources, [{ name: "cbu", url: "https://cbu.uz" }]);
  });
});

/**
 * Каталог навыков, deck и запуск из панели (спека 2026-09-05-skills-deck-cron-llm).
 * Каталог — ЗЕРКАЛО файлов (R-SD-1): sync переписывает его целиком.
 */

/** Заглушка таблицы каталога: delete чистит, insert добавляет — видно, что осталось. */
function catalogDb(opts: { rows?: Row[] } = {}) {
  const store: Row[] = [...(opts.rows ?? [])];
  const audits: Row[] = [];
  const order: string[] = [];
  const tx = {
    delete: (table: unknown) => {
      order.push("delete");
      if (table === agentSkillCatalog) store.length = 0;
      return Promise.resolve([]);
    },
    insert: (table: unknown) => ({
      values: (value: Row | Row[]) => {
        order.push("insert");
        if (table === agentSkillCatalog) {
          for (const row of Array.isArray(value) ? value : [value]) store.push(row);
        } else {
          audits.push(value as Row);
        }
        return { then: (res: (rows: Row[]) => unknown) => Promise.resolve([]).then(res) };
      },
    }),
  };
  return {
    db: {
      transaction: async <T>(cb: (t: typeof tx) => Promise<T>): Promise<T> => cb(tx),
    } as never,
    store,
    audits,
    order,
  };
}

describe("Каталог навыков — зеркало файлов (R-SD-1)", () => {
  const skill = (over: Partial<CatalogSkillInput> = {}): CatalogSkillInput => ({
    agent: "vendhub-ops",
    skill: "parts-audit",
    description: "Сверка узлов",
    executor: "llm",
    triggers: ["узлы"],
    allowedTools: ["core"],
    hasCode: false,
    problems: [],
    ...over,
  });

  it("sync стирает прежний каталог целиком и кладёт присланный", async () => {
    const fixture = catalogDb({
      rows: [
        { agentName: "old-agent", skill: "gone-one" },
        { agentName: "old-agent", skill: "gone-two" },
      ],
    });
    const result = await new AgentsService(fixture.db, noTasks, noSystem).syncSkillCatalog([
      skill(),
      skill({ skill: "stock-watch", executor: "code", hasCode: true }),
    ]);

    assert.equal(result.count, 2);
    assert.match(result.syncedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(
      fixture.store.map((r) => r.skill),
      ["parts-audit", "stock-watch"],
      "строки чужого агента обязаны исчезнуть: файлы — источник истины",
    );
    assert.equal(fixture.order[0], "delete", "сначала стираем, потом пишем — одной транзакцией");
    assert.ok(fixture.audits.some((a) => a.action === "agent.skill_catalog.synced"));
  });

  it("необязательные поля кладутся как NULL, а не как undefined", async () => {
    const fixture = catalogDb();
    await new AgentsService(fixture.db, noTasks, noSystem).syncSkillCatalog([skill()]);
    const row = fixture.store[0]!;
    assert.equal(row.tier, null);
    assert.equal(row.modelEffort, null);
    assert.equal(row.maxTokens, null);
    assert.equal(row.agentName, "vendhub-ops");
  });

  it("дубль пары «агент + навык» называется словами, а не безымянной 400 от драйвера", async () => {
    const fixture = catalogDb();
    await assert.rejects(
      new AgentsService(fixture.db, noTasks, noSystem).syncSkillCatalog([skill(), skill()]),
      /Дубль в каталоге: vendhub-ops\/parts-audit/,
    );
    assert.deepEqual(fixture.store, [], "битый каталог не должен затереть рабочий");
  });

  it("пустой список — пустой каталог (агенты не нашли ни одного навыка)", async () => {
    const fixture = catalogDb({ rows: [{ agentName: "old-agent", skill: "gone" }] });
    const result = await new AgentsService(fixture.db, noTasks, noSystem).syncSkillCatalog([]);
    assert.equal(result.count, 0);
    assert.deepEqual(fixture.store, []);
  });
});

/** Заглушка чтения deck: каталог ⨝ агент, последние запуски и настройки моделей. */
function deckDb(opts: {
  joined?: Row[];
  lastRuns?: Row[];
  settings?: { key: string; value: string }[];
  onExecute?: (query: unknown) => void;
}) {
  return {
    select: () => ({
      from: (table: unknown) =>
        table === systemConfig
          ? Promise.resolve(opts.settings ?? [])
          : { leftJoin: () => ({ orderBy: async () => opts.joined ?? [] }) },
    }),
    execute: async (query: unknown) => {
      opts.onExecute?.(query);
      return opts.lastRuns ?? [];
    },
  } as never;
}

describe("Deck навыков — что видит панель", () => {
  const catalogRow = (over: Row = {}): Row => ({
    agentName: "vendhub-ops",
    skill: "parts-audit",
    description: "Сверка узлов",
    executor: "llm",
    tier: "T1",
    triggers: ["узлы"],
    allowedTools: ["core"],
    modelEffort: "medium",
    maxTokens: null,
    hasCode: false,
    problems: [],
    syncedAt: new Date("2026-09-05T06:00:00.000Z"),
    agentStatus: "active",
    agentArchivedAt: null,
    business: "vendhub",
    autonomyDefault: "T2",
    agentSkills: ["parts-audit"],
    schedule: [{ cron: "0 9 * * 1", skill: "parts-audit" }],
    ...over,
  });

  it("enabled — навык закреплён за агентом; расписания и время синка видны", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [catalogRow(), catalogRow({ skill: "stock-watch", agentSkills: ["parts-audit"] })],
        settings: [
          { key: "LLM_MODEL", value: "gpt-5.6-sol" },
          { key: "LLM_FALLBACK_MODELS", value: "model-a, model-b ,, " },
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    assert.equal(deck.syncedAt, "2026-09-05T06:00:00.000Z");
    assert.deepEqual(deck.models, { primary: "gpt-5.6-sol", fallbacks: ["model-a", "model-b"] });
    assert.equal(deck.items[0]?.enabled, true);
    assert.deepEqual(deck.items[0]?.crons, ["0 9 * * 1"]);
    assert.equal(
      deck.items[1]?.enabled,
      false,
      "навык из файлов, не закреплённый в карточке, не запускается",
    );
    assert.deepEqual(deck.items[1]?.crons, []);
  });

  it("агент из файлов без карточки в базе — draft и выключен", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [
          catalogRow({
            agentName: "solution-scout",
            agentStatus: null,
            agentArchivedAt: null,
            business: null,
            autonomyDefault: null,
            agentSkills: null,
            schedule: null,
          }),
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    assert.equal(deck.items[0]?.agentStatus, "draft");
    assert.equal(deck.items[0]?.enabled, false);
    assert.deepEqual(deck.items[0]?.crons, []);
  });

  it("архивный агент — deprecated и выключен, а не «ещё не заведён»", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [
          catalogRow({
            agentStatus: "deprecated",
            agentArchivedAt: new Date("2026-09-01T00:00:00.000Z"),
          }),
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    assert.equal(deck.items[0]?.agentStatus, "deprecated");
    assert.equal(deck.items[0]?.enabled, false, "у убранного из работы агента запускать нечего");
    assert.deepEqual(
      deck.items[0]?.crons,
      [],
      "расписания архивного агента не показываем: они обещали бы запуск, которого не будет",
    );
  });

  it("одноимённые навыки у разных агентов: duplicates и тир не ниже максимума", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [
          catalogRow({ agentName: "a-agent", tier: "T1" }),
          catalogRow({ agentName: "b-agent", tier: "T3" }),
          catalogRow({ agentName: "c-agent", skill: "stock-watch", tier: null }),
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    assert.equal(deck.items[0]?.duplicates, 2);
    assert.equal(deck.items[0]?.tierFloor, "T3", "порог берём по самому строгому одноимённому");
    assert.equal(deck.items[1]?.tierFloor, "T3");
    assert.equal(deck.items[2]?.duplicates, 1);
    assert.equal(deck.items[2]?.tierFloor, null, "тира нет ни у кого — порога нет");
  });

  it("последний запуск берётся из задач того же агента и навыка (R-SD-7)", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [catalogRow(), catalogRow({ skill: "stock-watch" })],
        lastRuns: [
          {
            owner_ref: "vendhub-ops",
            agent_skill: "parts-audit",
            task_id: "11111111-1111-4111-8111-111111111111",
            status: "done",
            created_at: new Date("2026-09-05T05:00:00.000Z"),
            completed_at: new Date("2026-09-05T05:03:00.000Z"),
            blocked_reason: null,
            result_note: "Сверил 12 узлов",
          },
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    assert.deepEqual(deck.items[0]?.lastRun, {
      taskId: "11111111-1111-4111-8111-111111111111",
      status: "done",
      createdAt: "2026-09-05T05:00:00.000Z",
      completedAt: "2026-09-05T05:03:00.000Z",
      blockedReason: null,
      resultNote: "Сверил 12 узлов",
    });
    assert.equal(deck.items[1]?.lastRun, null, "чужой навык не подставляется");
  });

  it("«последний запуск» читается одним distinct on по индексу задач", async () => {
    let query: unknown;
    await new AgentsService(
      deckDb({
        joined: [catalogRow()],
        onExecute: (value) => {
          query = value;
        },
      }),
      noTasks,
      noSystem,
    ).skillDeck();

    // Заглушка не проверяет SQL — рендерим настоящий текст запроса: иначе
    // сломанный запрос остался бы «зелёным» до первого запроса панели.
    const text = new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
    assert.match(text, /distinct on \("task"\."owner_ref", "task"\."agent_skill"\)/);
    assert.match(text, /"task"\."agent_skill" is not null/);
    assert.match(text, /order by "task"\."owner_ref", "task"\."agent_skill", "task"\."created_at" desc/);
  });

  it("пустой каталог — пустой deck, а не ошибка", async () => {
    const deck = await new AgentsService(deckDb({}), noTasks, noSystem).skillDeck();
    assert.deepEqual(deck.items, []);
    assert.equal(deck.syncedAt, null);
  });

  it("?agent= оставляет строки только этого агента", async () => {
    const deck = await new AgentsService(
      deckDb({
        joined: [
          catalogRow({ agentName: "globerent-scout", skill: "market-scan" }),
          catalogRow({ agentName: "vendhub-ops" }),
        ],
      }),
      noTasks,
      noSystem,
    ).skillDeck({ agent: "vendhub-ops" });

    assert.deepEqual(
      deck.items.map((i) => `${i.agent}/${i.skill}`),
      ["vendhub-ops/parts-audit"],
    );
    assert.equal(deck.syncedAt, "2026-09-05T06:00:00.000Z", "шапка деки остаётся общей");
  });

  it("неизвестный агент даёт пустой список, а не всю деку", async () => {
    const deck = await new AgentsService(
      deckDb({ joined: [catalogRow(), catalogRow({ agentName: "globerent-scout" })] }),
      noTasks,
      noSystem,
    ).skillDeck({ agent: "нет-такого" });
    assert.deepEqual(deck.items, [], "промах фильтра не должен выглядеть как «фильтра не было»");
  });

  it("порог одноимённого навыка считается по ВСЕМ агентам, а не по отобранным", async () => {
    // Поэтому отбор идёт по собранной деке, а не в SQL: отфильтруй в запросе —
    // и сосед с T3 исчез бы из подсчёта, а навык показался бы как T1, то есть
    // «можно без согласования». Тир нельзя понижать фильтром показа.
    const deck = await new AgentsService(
      deckDb({
        joined: [catalogRow({ agentName: "a-agent", tier: "T1" }), catalogRow({ agentName: "b-agent", tier: "T3" })],
      }),
      noTasks,
      noSystem,
    ).skillDeck({ agent: "a-agent" });

    assert.equal(deck.items.length, 1);
    assert.equal(deck.items[0]?.tierFloor, "T3");
    assert.equal(deck.items[0]?.duplicates, 2);
  });
});

/** Заглушка запуска: каталог, карточка агента, задача и журнал. */
function runDb(opts: { catalog?: Row; agent?: Row }) {
  const audits: Row[] = [];
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () =>
              table === agentSkillCatalog
                ? opts.catalog
                  ? [opts.catalog]
                  : []
                : opts.agent
                  ? [opts.agent]
                  : [],
          }),
        }),
      }),
      insert: () => ({
        values: (value: Row) => {
          audits.push(value);
          return { then: (res: (rows: Row[]) => unknown) => Promise.resolve([]).then(res) };
        },
      }),
    } as never,
    audits,
  };
}

describe("Запуск навыка из панели (R-SD-2/6)", () => {
  const catalog: Row = { agentName: "vendhub-ops", skill: "parts-audit", executor: "llm" };
  const card = (over: Row = {}): Row => ({
    id: "a1",
    name: "vendhub-ops",
    status: "active",
    archivedAt: null,
    skills: ["parts-audit"],
    ...over,
  });

  function tasksSpy() {
    const calls: { input: Record<string, unknown>; actor: string | undefined }[] = [];
    return {
      calls,
      tasks: {
        create: async (input: Record<string, unknown>, actor?: string) => {
          calls.push({ input, actor });
          return { id: "task-1" };
        },
      } as never,
    };
  }

  it("успех: задача агенту с источником skills-deck, навыком и усилием", async () => {
    const fixture = runDb({ catalog, agent: card() });
    const spy = tasksSpy();
    const result = await new AgentsService(fixture.db, spy.tasks, noSystem).runSkill(
      "vendhub-ops",
      "parts-audit",
      { input: "Сверить узлы на Kaffit-04", modelEffort: "high", actor: "owner" },
    );

    assert.deepEqual(result, { taskId: "task-1" });
    const input = spy.calls[0]!.input;
    assert.equal(input.title, "Навык parts-audit: Сверить узлы на Kaffit-04");
    assert.equal(input.description, "Сверить узлы на Kaffit-04");
    assert.equal(input.ownerKind, "agent");
    assert.equal(input.ownerRef, "vendhub-ops");
    assert.equal(input.source, "skills-deck");
    assert.equal(input.agentSkill, "parts-audit");
    assert.deepEqual(input.runOptions, { modelEffort: "high" });
    assert.equal(input.createdBy, "owner");
    assert.ok(fixture.audits.some((a) => a.action === "agent.skill.run"));
  });

  it("без входа — заголовок говорит, откуда задача, и параметров запуска нет", async () => {
    const spy = tasksSpy();
    await new AgentsService(runDb({ catalog, agent: card() }).db, spy.tasks, noSystem).runSkill(
      "vendhub-ops",
      "parts-audit",
      {},
    );
    const input = spy.calls[0]!.input;
    assert.equal(input.title, "Навык parts-audit: запуск из deck");
    assert.equal(input.description, undefined);
    assert.equal(input.runOptions, undefined, "усилие не задано — поле не появляется");
    assert.equal(input.createdBy, "owner");
  });

  it("длинный вход обрезается в заголовке, но целиком уходит в описание", async () => {
    const spy = tasksSpy();
    const long = "я".repeat(200);
    await new AgentsService(runDb({ catalog, agent: card() }).db, spy.tasks, noSystem).runSkill(
      "vendhub-ops",
      "parts-audit",
      { input: long },
    );
    assert.equal(spy.calls[0]!.input.title, `Навык parts-audit: ${"я".repeat(60)}`);
    assert.equal(spy.calls[0]!.input.description, long);
  });

  it("переносы строк из textarea не уезжают в заголовок задачи", async () => {
    const spy = tasksSpy();
    const multiline = "Сверить узлы\n\n  на Kaffit-04";
    await new AgentsService(runDb({ catalog, agent: card() }).db, spy.tasks, noSystem).runSkill(
      "vendhub-ops",
      "parts-audit",
      { input: multiline },
    );
    assert.equal(spy.calls[0]!.input.title, "Навык parts-audit: Сверить узлы на Kaffit-04");
    assert.equal(spy.calls[0]!.input.description, multiline, "описание хранит вход как есть");
  });

  it("выключенный агент — отказ словами владельца (R-SD-6)", async () => {
    const svc = new AgentsService(runDb({ catalog, agent: card({ status: "paused" }) }).db, noTasks, noSystem);
    await assert.rejects(
      svc.runSkill("vendhub-ops", "parts-audit", {}),
      /Агент "vendhub-ops" выключен — включи его в карточке/,
    );
  });

  it("навык не закреплён за агентом — 409, а не тихий запуск", async () => {
    const svc = new AgentsService(
      runDb({ catalog, agent: card({ skills: ["stock-watch"] }) }).db,
      noTasks,
      noSystem,
    );
    await assert.rejects(
      svc.runSkill("vendhub-ops", "parts-audit", {}),
      /Навык "parts-audit" не закреплён за агентом "vendhub-ops"/,
    );
  });

  it("навыка нет в каталоге — 404 с подсказкой перезапустить агентов", async () => {
    const svc = new AgentsService(runDb({ agent: card() }).db, noTasks, noSystem);
    await assert.rejects(svc.runSkill("vendhub-ops", "нет-такого", {}), NotFoundException);
  });

  it("навык обещает код, а кода нет — 409, а не задача под угадывание (Р-6)", async () => {
    const spy = tasksSpy();
    const svc = new AgentsService(
      runDb({
        catalog: { agentName: "vendhub-ops", skill: "parts-audit", executor: "code", hasCode: false },
        agent: card(),
      }).db,
      spy.tasks,
      noSystem,
    );
    await assert.rejects(
      svc.runSkill("vendhub-ops", "parts-audit", {}),
      /Навык "parts-audit" ещё не реализован — запуск невозможен/,
    );
    assert.deepEqual(spy.calls, [], "задача не создаётся: её всё равно некому выполнить");
  });

  it("llm-навык без кода запускается: его реализация — тело файла, а не реестр", async () => {
    const spy = tasksSpy();
    await new AgentsService(
      runDb({
        catalog: { agentName: "vendhub-ops", skill: "parts-audit", executor: "llm", hasCode: false },
        agent: card(),
      }).db,
      spy.tasks,
      noSystem,
    ).runSkill("vendhub-ops", "parts-audit", {});
    assert.equal(spy.calls.length, 1);
  });
});

/**
 * Сетка состояний агентов (волна A2, R-A2-1).
 *
 * Правило состояния проверяется чистой функцией (`agent-state.test.ts`);
 * здесь — сборка: что читается, сколько раз и что доезжает до панели.
 */
function statusDb(opts: {
  agents?: Row[];
  tasks?: Row[];
  runs?: Row[];
  onExecute?: (query: unknown) => void;
  onTaskWhere?: (condition: unknown) => void;
  onAgentWhere?: (condition: unknown) => void;
}) {
  const счётчик = { select: 0, execute: 0 };
  const db = {
    select: () => {
      счётчик.select += 1;
      return {
        from: (table: unknown) =>
          table === agent
            ? {
                where: (condition: unknown) => {
                  opts.onAgentWhere?.(condition);
                  return { orderBy: async () => opts.agents ?? [] };
                },
              }
            : {
                where: async (condition: unknown) => {
                  opts.onTaskWhere?.(condition);
                  return opts.tasks ?? [];
                },
              },
      };
    },
    execute: async (query: unknown) => {
      счётчик.execute += 1;
      opts.onExecute?.(query);
      return opts.runs ?? [];
    },
  } as never;
  return { db, счётчик };
}

/** Тумблеры системы: `value` — действующее значение (база > env > дефолт). */
function systemStub(paused: { tasks: boolean; schedules: boolean }) {
  return {
    effective: async () => [
      { key: "AGENTS_TASKS_PAUSED", value: paused.tasks ? "1" : "0" },
      { key: "AGENTS_SCHEDULES_PAUSED", value: paused.schedules ? "1" : "0" },
      { key: "LLM_MODEL", value: "gpt-5.6-sol" },
    ],
  } as never;
}

describe("Состояние агентов для панели (R-A2-1)", () => {
  const card = (over: Row = {}): Row => ({
    name: "vendhub-ops",
    business: "vendhub",
    status: "active",
    archivedAt: null,
    ...over,
  });

  it("собирает строку сетки: состояние, причина и последний прогон", async () => {
    const now = new Date("2026-09-06T09:00:00.000Z");
    const { db } = statusDb({
      agents: [card(), card({ name: "globerent-scout", business: "globerent", status: "paused" })],
      tasks: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          ownerRef: "vendhub-ops",
          skill: "parts-audit",
          claimedAt: new Date(now.getTime() - 60_000),
          blockedAt: null,
          blockedReason: null,
        },
      ],
      runs: [
        {
          agent_name: "vendhub-ops",
          started_at: new Date("2026-09-06T06:00:00.000Z"),
          outcome: "skipped",
          skip_reason: "no_signal",
          reason: "предлагать нечего",
        },
      ],
    });
    const view = await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses({ now });

    assert.equal(view.tz, "Asia/Tashkent");
    assert.equal(view.now, now.toISOString());
    assert.deepEqual(view.paused, { schedules: false, tasks: false });
    const [ops, scout] = view.agents;
    assert.equal(ops?.state, "working");
    assert.equal(ops?.skill, "parts-audit");
    assert.equal(ops?.taskId, "11111111-1111-4111-8111-111111111111");
    assert.equal(ops?.since, new Date(now.getTime() - 60_000).toISOString());
    assert.deepEqual(ops?.lastRun, {
      at: "2026-09-06T06:00:00.000Z",
      outcome: "skipped",
      skipReason: "no_signal",
      reason: "предлагать нечего",
    });
    // Паспортный статус едет рядом с состоянием: это разные ответы.
    assert.equal(scout?.passportStatus, "paused");
    assert.equal(scout?.state, "paused");
    assert.match(scout?.reason ?? "", /paused/);
    assert.equal(scout?.lastRun, undefined, "прогонов не было — ключа нет, а не пустышка");
  });

  it("системная пауза задач не гасит живой claim: занятый работает, свободный — на паузе (перепроверка прода, корень 1)", async () => {
    // Продовая конфигурация: tasks=1, schedules=0. Пауза задач останавливает
    // только новые claim'ы порученных задач, cron-задачи идут — и агент с
    // живым claim РАБОТАЕТ. Прежняя редакция Р-2 рисовала здесь два
    // одинаковых «на паузе» над работающим агентом.
    const now = new Date("2026-09-06T09:00:00.000Z");
    const { db } = statusDb({
      agents: [card(), card({ name: "globerent-scout" })],
      tasks: [
        {
          id: "t1",
          ownerRef: "vendhub-ops",
          skill: "parts-audit",
          claimedAt: new Date(now.getTime() - 60_000),
          blockedAt: null,
          blockedReason: null,
        },
      ],
    });
    const view = await new AgentsService(db, noTasks, systemStub({ tasks: true, schedules: false })).statuses({ now });
    assert.deepEqual(view.paused, { schedules: false, tasks: true });
    assert.deepEqual(
      view.agents.map((a) => a.state),
      ["paused", "paused"],
      "иначе экран покажет работающих агентов при выключенной системе",
    );
    assert.match(view.agents[0]?.reason ?? "", /настройка системы, а не агента/);
  });

  it("отсутствие записи о паузе — это «пауза»: дефолт тумблера равен 1", async () => {
    // ОТКАЗ В СТОРОНУ ПАУЗЫ. Дефолт обоих тумблеров в config-spec — «1», и
    // выключатель всего парка обязан ломаться в «выключено»: пустой ответ
    // настроек (сбой чтения, чужой набор ключей) не должен рисовать
    // работающих агентов там, где задачи стоят.
    const now = new Date("2026-09-06T09:00:00.000Z");
    const { db } = statusDb({
      agents: [card()],
      tasks: [
        {
          id: "t1",
          ownerRef: "vendhub-ops",
          skill: "parts-audit",
          claimedAt: new Date(now.getTime() - 60_000),
          blockedAt: null,
          blockedReason: null,
        },
      ],
    });
    const пусто = { effective: async () => [] } as never;
    const view = await new AgentsService(db, noTasks, пусто).statuses({ now });
    assert.deepEqual(view.paused, { schedules: true, tasks: true });
    assert.equal(view.agents[0]?.state, "paused");
    assert.match(view.agents[0]?.reason ?? "", /настройка системы, а не агента/);

    // Только явный «0» означает «работаем»: значение с опечаткой — тоже пауза.
    const мусор = {
      effective: async () => [{ key: "AGENTS_TASKS_PAUSED", value: "false" }],
    } as never;
    const второй = statusDb({ agents: [card()] });
    const кривой = await new AgentsService(второй.db, noTasks, мусор).statuses({ now });
    assert.equal(кривой.paused.tasks, true, "не «0» — значит пауза, а не «работаем»");
  });

  it("архивных в сетке нет: фильтр `archived_at is null` уходит в SQL", async () => {
    // ЗАХВАТ WHERE И НАСТОЯЩИЙ SQL, а не «заглушка вернула одну строку»
    // (круг починок, C-8). Прежний тест назывался «архивных в сетке нет», но
    // заглушка условие игнорировала: он проверял только, что сервис не делает
    // второй запрос. Снятие фильтра из `list()` он бы не заметил — а именно
    // оно и вернуло бы архивных агентов на главный экран. Приём тот же, что у
    // соседнего теста про `distinct on`: рендерим условие диалектом Postgres.
    let условие: unknown;
    const { db, счётчик } = statusDb({ agents: [card()], onAgentWhere: (c) => (условие = c) });
    const view = await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses();
    assert.deepEqual(
      view.agents.map((a) => a.name),
      ["vendhub-ops"],
    );
    assert.notEqual(условие, undefined, "`list()` обязан фильтровать, а не звать `where()` пустым");
    const sql = new PgDialect().sqlToQuery(условие as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
    assert.match(sql, /"agent"\."archived_at" is null/);
    assert.equal(счётчик.select, 2, "две выборки: карточки и задачи");
    assert.equal(счётчик.execute, 1, "последние прогоны — один distinct on, а не запрос на агента");
  });

  it("задачи и прогоны читаются по одному разу на всю сетку, а не на агента", async () => {
    const агенты = Array.from({ length: 12 }, (_, i) => card({ name: `agent-${i}` }));
    const { db, счётчик } = statusDb({ agents: агенты });
    const view = await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses();
    assert.equal(view.agents.length, 12);
    assert.equal(счётчик.select, 2, "12 агентов не должны дать 12 выборок задач");
    assert.equal(счётчик.execute, 1);
  });

  it("последний прогон берётся одним distinct on (agent_name)", async () => {
    let query: unknown;
    const { db } = statusDb({ agents: [card()], onExecute: (q) => (query = q) });
    await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses();
    // Заглушка не исполняет SQL — рендерим текст запроса, иначе сломанный
    // запрос остался бы «зелёным» до первого открытия панели.
    const text = new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
    assert.match(text, /distinct on \("agent_run"\."agent_name"\)/);
    assert.match(text, /order by "agent_run"\."agent_name", "agent_run"\."started_at" desc/);
  });

  it("личные задачи уходят из выдачи по гейту owner-видимости (R-P5-7b)", async () => {
    // Проводка гейта проверяется ЗАХВАТОМ WHERE, а не наличием слова в файле:
    // заглушка SQL не исполняет, и потерянный предикат остался бы «зелёным».
    const render = (condition: unknown): string =>
      new PgDialect().sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
    let открыто: unknown;
    const { db } = statusDb({ agents: [card()], onTaskWhere: (c) => (открыто = c) });
    await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses();
    const текстБезГейта = render(открыто);
    assert.match(текстБезГейта, /"task"\."owner_kind" = \$\d/);
    assert.doesNotMatch(текстБезГейта, /personal/, "по умолчанию выдача прода не меняется");

    let закрыто: unknown;
    const второй = statusDb({ agents: [card()], onTaskWhere: (c) => (закрыто = c) });
    await new AgentsService(второй.db, noTasks, systemStub({ tasks: false, schedules: false })).statuses({
      excludePersonal: true,
    });
    // `is distinct from`, а не `<> 'personal'`: у задач бывает NULL-домен, и
    // обычное сравнение выбросило бы из состояния задачи без направления.
    assert.match(render(закрыто), /"task"\."domain" is distinct from 'personal'/);
  });

  it("задача без исполнителя не приписывается никому", async () => {
    const { db } = statusDb({
      agents: [card()],
      tasks: [{ id: "t1", ownerRef: null, skill: "parts-audit", claimedAt: new Date(), blockedAt: null, blockedReason: null }],
    });
    const view = await new AgentsService(db, noTasks, systemStub({ tasks: false, schedules: false })).statuses();
    assert.equal(view.agents[0]?.state, "idle");
    assert.equal(view.agents[0]?.taskId, undefined);
  });
});
