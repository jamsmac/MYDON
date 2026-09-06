import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import { ReadTokenGuard } from "../common/read-token.guard";
import {
  AgentsController,
  CatalogSkillDto,
  CreateAgentDto,
  RunSkillDto,
  SyncCatalogDto,
  UpdateAgentDto,
} from "./agents.controller";

/** Все сообщения валидатора, включая вложенные (webSources[i].url лежит в children). */
async function problems(dto: object): Promise<string[]> {
  const flatten = (errors: ValidationError[]): string[] =>
    errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...flatten(e.children ?? [])]);
  return flatten(await validate(dto));
}

describe("Карточка агента — валидация kbPages (страницы знаний, R-LS-8)", () => {
  it("принимает относительные пути внутри shared/ с расширением .md", async () => {
    const dto = plainToInstance(CreateAgentDto, {
      name: "globerent-sales",
      kbPages: ["shared/kb/globerent/heli-models.md", "shared/COMPANY.md", "shared/kb/vendhub/faq-2026.md"],
    });
    assert.deepEqual(await problems(dto), []);
  });

  it("отсекает путь с .. — контекст модели нельзя увести за пределы shared/", async () => {
    // Путь проходит формат shared/**.md, но содержит .. — ловит вторая проверка.
    const sneaky = plainToInstance(UpdateAgentDto, { kbPages: ["shared/kb/../secret.md"] });
    const list = await problems(sneaky);
    assert.ok(list.some((m) => /не может содержать \.\./.test(m)), list.join("; "));
    // Совсем чужой путь (.env за пределами shared/) — отказ по любой из проверок.
    const escape = plainToInstance(UpdateAgentDto, { kbPages: ["shared/kb/../../.env"] });
    assert.ok((await problems(escape)).length > 0);
  });

  it("отсекает абсолютные пути, пути не из shared/ и не-.md файлы", async () => {
    for (const bad of ["/etc/passwd", "kb/globerent/faq.md", "shared/kb/globerent/pricelist.xlsx", "https://x.uz/a.md"]) {
      const dto = plainToInstance(UpdateAgentDto, { kbPages: [bad] });
      const list = await problems(dto);
      assert.ok(list.some((m) => /shared\/kb/.test(m)), `«${bad}» должен быть отклонён: ${list.join("; ")}`);
    }
  });

  it("kbPages — список строк, не строка", async () => {
    const dto = plainToInstance(UpdateAgentDto, { kbPages: "shared/kb/globerent/faq.md" });
    assert.ok((await problems(dto)).length > 0);
  });
});

describe("Карточка агента — границы роли", () => {
  it("mission до 2000 символов, nonGoals до 20 пунктов по 300 символов", async () => {
    const ok = plainToInstance(UpdateAgentDto, { mission: "Одна задача", nonGoals: ["НЕ пишет клиентам"] });
    assert.deepEqual(await problems(ok), []);
    const long = plainToInstance(UpdateAgentDto, { mission: "x".repeat(2001) });
    assert.ok((await problems(long)).length > 0, "миссия длиннее 2000 — отказ");
    const many = plainToInstance(UpdateAgentDto, { nonGoals: Array.from({ length: 21 }, (_, i) => `НЕ ${i}`) });
    assert.ok((await problems(many)).length > 0, "21 non_goal — отказ");
  });

  it("webSources: только http(s) с явной схемой; кириллица в пути допустима", async () => {
    const ok = plainToInstance(UpdateAgentDto, {
      webSources: [{ name: "OLX", url: "https://olx.uz/list/q-вилочный-погрузчик/" }],
    });
    assert.deepEqual(await problems(ok), []);
    const bare = plainToInstance(UpdateAgentDto, { webSources: [{ name: "Xarid", url: "xarid.uzex.uz" }] });
    assert.ok((await problems(bare)).length > 0, "адрес без схемы — отказ");
  });
});

describe("Каталог навыков — валидация зеркала файлов (R-SD-1)", () => {
  const skill = (over: Record<string, unknown> = {}) => ({
    agent: "vendhub-ops",
    skill: "parts-audit",
    description: "Сверка узлов по журналу",
    executor: "llm",
    tier: "T1",
    triggers: ["узлы", "сверка"],
    allowedTools: ["core.tasks"],
    modelEffort: "medium",
    maxTokens: 4000,
    hasCode: false,
    problems: [],
    ...over,
  });

  it("принимает полную строку каталога", async () => {
    assert.deepEqual(await problems(plainToInstance(CatalogSkillDto, skill())), []);
  });

  it("имена агента и навыка — только по формату файлов", async () => {
    for (const bad of ["VendHub", "-ops", "ops ops", "x".repeat(65), ""]) {
      const dto = plainToInstance(CatalogSkillDto, skill({ agent: bad }));
      assert.ok((await problems(dto)).length > 0, `агент «${bad}» должен быть отклонён`);
      const other = plainToInstance(CatalogSkillDto, skill({ skill: bad }));
      assert.ok((await problems(other)).length > 0, `навык «${bad}» должен быть отклонён`);
    }
  });

  it("исполнитель — только code | llm, тир — только T0..T4", async () => {
    assert.ok((await problems(plainToInstance(CatalogSkillDto, skill({ executor: "bash" })))).length > 0);
    assert.ok((await problems(plainToInstance(CatalogSkillDto, skill({ tier: "T9" })))).length > 0);
    // Тир не задан в frontmatter — это норма, а не ошибка.
    assert.deepEqual(await problems(plainToInstance(CatalogSkillDto, skill({ tier: undefined }))), []);
  });

  it("список каталога ограничен сверху — один агент не завалит Core", async () => {
    const many = plainToInstance(SyncCatalogDto, {
      skills: Array.from({ length: 1001 }, (_, i) => skill({ skill: `s-${i}` })),
    });
    assert.ok((await problems(many)).length > 0);
    const sane = plainToInstance(SyncCatalogDto, { skills: [skill()] });
    assert.deepEqual(await problems(sane), []);
    const broken = plainToInstance(SyncCatalogDto, { skills: [skill({ executor: "bash" })] });
    assert.ok((await problems(broken)).length > 0, "вложенные строки обязаны проверяться");
  });
});

describe("Запуск навыка из панели — валидация (R-SD-2)", () => {
  it("вход необязателен и ограничен 4000 символами", async () => {
    assert.deepEqual(await problems(plainToInstance(RunSkillDto, {})), []);
    assert.deepEqual(
      await problems(plainToInstance(RunSkillDto, { input: "Сверить узлы", modelEffort: "high" })),
      [],
    );
    const long = plainToInstance(RunSkillDto, { input: "я".repeat(4001) });
    assert.ok((await problems(long)).length > 0);
  });

  it("усилие модели — только из известного списка", async () => {
    const dto = plainToInstance(RunSkillDto, { modelEffort: "ultra" });
    assert.ok((await problems(dto)).some((m) => /modelEffort/.test(m)));
  });

  it("«minimal» отклоняется: список принимаемого совпадает со списком исполняемого", async () => {
    const dto = plainToInstance(RunSkillDto, { modelEffort: "minimal" });
    assert.ok((await problems(dto)).some((m) => /modelEffort/.test(m)));
  });
});

describe("Порядок маршрутов: «skills» не должен уехать в :name", () => {
  it("skills объявлен выше byName", () => {
    const methods = Object.getOwnPropertyNames(AgentsController.prototype);
    assert.ok(
      methods.indexOf("skills") < methods.indexOf("byName"),
      "иначе GET /agents/skills вернёт «Агент \"skills\" не найден»",
    );
  });

  it("status объявлен выше byName (R-A2-1)", () => {
    const methods = Object.getOwnPropertyNames(AgentsController.prototype);
    assert.ok(
      methods.indexOf("status") < methods.indexOf("byName"),
      "иначе GET /agents/status вернёт «Агент \"status\" не найден», и сетка на главной опустеет",
    );
  });
});

describe("GET /agents/status закрыт токеном и на чтение (круг починок, C-1)", () => {
  const prev = process.env.SERVICE_TOKEN;
  afterEach(() => {
    if (prev === undefined) delete process.env.SERVICE_TOKEN;
    else process.env.SERVICE_TOKEN = prev;
  });

  const ctx = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method: "GET", headers }) }),
      getHandler: () => (): void => undefined,
      getClass: () => class {},
    }) as unknown as Parameters<ReadTokenGuard["canActivate"]>[0];

  it("анонимный GET отклоняется — глобальный guard чтения пропускает, этот нет", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
    assert.throws(() => new ReadTokenGuard().canActivate(ctx({ "x-service-token": "wrong" })), /токен/);
  });

  it("GET с верным токеном проходит (и заголовком, и Bearer)", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.equal(new ReadTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ authorization: "Bearer secret" })), true);
  });

  it("токен не настроен — состояние всё равно закрыто (fail-closed)", () => {
    delete process.env.SERVICE_TOKEN;
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
  });

  it("guard навешен НА МАРШРУТ status", () => {
    // Снятие `@UseGuards(ReadTokenGuard)` роняет этот ассерт: маршрут печатает
    // `lastRun.reason` — то же поле, ради которого закрыт `/routines/runs`.
    const guards: unknown = Reflect.getMetadata("__guards__", AgentsController.prototype.status);
    assert.ok(
      Array.isArray(guards) && guards.includes(ReadTokenGuard),
      "нет @UseGuards(ReadTokenGuard) на GET /agents/status",
    );
  });

  it("КОНТРОЛЛЕР целиком НЕ закрыт: список, каталог навыков и карточка читаются как раньше", () => {
    // Классовый guard закрыл бы `GET /agents`, `GET /agents/skills` и
    // `GET /agents/:name` — ими ходят панель, бот и MCP-сервер, и починка C-1
    // не имеет права их сломать.
    const guards: unknown = Reflect.getMetadata("__guards__", AgentsController);
    assert.ok(
      guards === undefined || (Array.isArray(guards) && !guards.includes(ReadTokenGuard)),
      "ReadTokenGuard на классе закроет читающие маршруты панели, бота и MCP",
    );
    for (const route of ["list", "skills", "byName"] as const) {
      const g: unknown = Reflect.getMetadata("__guards__", AgentsController.prototype[route]);
      assert.ok(
        g === undefined || (Array.isArray(g) && !g.includes(ReadTokenGuard)),
        `маршрут ${route} не должен требовать токен: им ходят панель, бот и MCP`,
      );
    }
  });
});

describe("Подпись правки карточки агента (волна A1, adversarial)", () => {
  /** Стаб сервиса: копит подпись, с которой пришёл вызов. */
  function stub() {
    const calls: { method: string; actorRef: unknown }[] = [];
    const agents = {
      create: async (_input: unknown, actorRef?: string) => {
        calls.push({ method: "create", actorRef });
        return { name: "a" };
      },
      update: async (_name: string, _patch: unknown, actorRef?: string) => {
        calls.push({ method: "update", actorRef });
        return { name: "a" };
      },
    } as never;
    // База контроллеру нужна только гейту личного контура (GET /agents/status):
    // в сценариях подписи она не участвует, и её вызов был бы регрессом.
    const noDb = {
      select: () => {
        throw new Error("db тронута вне сценария состояния агентов");
      },
    } as never;
    return { controller: new AgentsController(agents, noDb), calls };
  }

  it("правка через инструмент подписана им, а не владельцем", async () => {
    const { controller, calls } = stub();
    await controller.create(plainToInstance(CreateAgentDto, { name: "vendhub-ops", actor: "mcp" }));
    await controller.update("vendhub-ops", plainToInstance(UpdateAgentDto, { name: "vendhub-ops", actor: "mcp" }));
    assert.deepEqual(
      calls.map((c) => c.actorRef),
      ["mcp", "mcp"],
      "иначе в журнале правка модели неотличима от нажатия владельца",
    );
  });

  it("без подписи поведение прежнее: решает Core (owner по умолчанию)", async () => {
    const { controller, calls } = stub();
    await controller.create(plainToInstance(CreateAgentDto, { name: "vendhub-ops" }));
    assert.equal(calls[0]!.actorRef, undefined);
  });

  it("подпись — короткая строка, а не что угодно", async () => {
    const long = plainToInstance(CreateAgentDto, { name: "vendhub-ops", actor: "x".repeat(65) });
    assert.ok((await problems(long)).some((m) => /actor/.test(m)));
  });
});
