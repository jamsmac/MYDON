import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentCard, AgentRun, AgentsStatus, AgentStatusRow, AuditEntry, SkillDeckItem } from "../../../lib/core";
import type { AutonomyMax } from "../../../components/agent-editor";
import { правилаCss, стилиПанели } from "../../../test/css";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const agentCard = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
const agentsStatus = vi.hoisted(() => vi.fn());
const skillDeck = vi.hoisted(() => vi.fn());
const agentRuns = vi.hoisted(() => vi.fn());
const agentMemory = vi.hoisted(() => vi.fn());
const systemConfig = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/core", () => ({
  core: { agent: agentCard, audit, agentsStatus, skillDeck, agentRuns, agentMemory, systemConfig },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));
// Редактор карточки — клиентский и со своими формами; здесь проверяются блоки.
// Порог автономии он получает пропом — печатаем его, чтобы тест видел, что
// именно карточка передала в подсказку (дефект Р-7: значение было захардкожено).
// Печатаем ВСЕ ТРИ случая: значение, отсутствие ключа и отказ с причиной —
// раньше два последних приезжали одним `null` и были неразличимы.
vi.mock("../../../components/agent-editor", () => ({
  AgentEditor: ({ autonomyMax }: { autonomyMax: AutonomyMax }) => (
    <div>
      Настройки агента · порог{" "}
      {autonomyMax.kind === "value"
        ? autonomyMax.tier
        : autonomyMax.kind === "missing"
          ? "не задан"
          : `не прочитан: ${autonomyMax.detail}`}
    </div>
  ),
}));
// Кнопка запуска — клиентская (server action + refresh); её поведение проверяет
// run-skill-button.test.tsx, здесь важно лишь, что она есть у навыка.
vi.mock("../../../components/run-skill-button", () => ({
  RunSkillButton: ({ skill }: { skill: string }) => <button type="button">Запустить {skill}</button>,
}));

import AgentPage from "./page";

const base: AgentCard = {
  id: "a1",
  name: "vendhub-ops",
  business: "vendhub",
  status: "active",
  description: "Оператор сети",
  mission: null,
  nonGoals: [],
  autonomyDefault: "T1",
  skills: ["monitor-stock"],
  schedule: [{ cron: "0 8 * * *", skill: "monitor-stock" }],
  budgetPerDayUsd: null,
  budgetOnExceeded: null,
  webSources: [],
  breakGlass: [],
  ideaChannels: [],
  kbPages: [],
  archivedAt: null,
  updatedAt: "2026-09-06T08:00:00.000Z",
};

const card = (hooks?: AgentCard["hooks"]): AgentCard => (hooks ? { ...base, hooks } : { ...base });

const состояние = (over: Partial<AgentStatusRow> = {}): AgentStatusRow => ({
  name: "vendhub-ops",
  business: "vendhub",
  passportStatus: "active",
  state: "working",
  reason: "выполняет задачу (навык «monitor-stock»)",
  ...over,
});

/** Рантайм отчитался минуту назад и применил ровно то, что в конфиге. */
const рантайм = (over: Partial<AgentsStatus["runtime"]> = {}): AgentsStatus["runtime"] => ({
  reportedAt: "2026-09-06T07:59:00.000Z",
  ageSec: 60,
  stale: false,
  paused: { schedules: false, tasks: false },
  lagging: false,
  readFailed: false,
  ...over,
});

const навык = (over: Partial<SkillDeckItem> = {}): SkillDeckItem => ({
  agent: "vendhub-ops",
  skill: "monitor-stock",
  description: "Следит за остатками",
  executor: "llm",
  tier: "T1",
  triggers: [],
  allowedTools: [],
  hasCode: false,
  problems: [],
  agentStatus: "active",
  business: "vendhub",
  autonomyDefault: "T1",
  enabled: true,
  crons: ["0 8 * * *"],
  tierFloor: "T1",
  duplicates: 1,
  lastRun: null,
  ...over,
});

const прогон = (over: Partial<AgentRun> = {}): AgentRun => ({
  id: "run-1",
  agentName: "vendhub-ops",
  skill: "monitor-stock",
  trigger: "cron",
  cron: "0 8 * * *",
  scheduledAt: "2026-09-06T03:00:00.000Z",
  requestKey: "k1",
  traceKey: null,
  taskId: null,
  approvalId: null,
  startedAt: "2026-09-06T03:00:01.000Z",
  finishedAt: "2026-09-06T03:00:09.000Z",
  outcome: "executed",
  skipReason: null,
  hook: null,
  reason: "остатки сверены",
  action: null,
  review: null,
  ...over,
});

const запись = (over: Partial<AuditEntry> & { id: string }): AuditEntry => ({
  actorKind: "agent",
  actorRef: "agent:vendhub-ops",
  action: "approval.request",
  target: null,
  ts: "2026-09-06T03:00:00.000Z",
  ...over,
});

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с отказом
 * падает «необработанным» отказом при зелёном теле.
 */
beforeEach(() => {
  agentCard.mockImplementation(async () => card());
  audit.mockImplementation(async () => []);
  agentsStatus.mockImplementation(async () => ({
    tz: "Asia/Tashkent",
    now: "2026-09-06T08:00:00.000Z",
    paused: { schedules: false, tasks: false },
    runtime: рантайм(),
    agents: [состояние()],
  }));
  skillDeck.mockImplementation(async () => ({
    syncedAt: "2026-09-06T02:00:00.000Z",
    models: { primary: "sonnet", fallbacks: [] },
    items: [навык()],
  }));
  agentRuns.mockImplementation(async () => ({ runs: [прогон()] }));
  agentMemory.mockImplementation(async () => [
    {
      id: "e1",
      source: "agent:vendhub-ops",
      type: "agent.memory:monitor-stock",
      occurredAt: "2026-09-06T03:00:09.000Z",
    },
  ]);
  systemConfig.mockImplementation(async () => [
    { key: "AGENT_AUTONOMY_MAX", label: "Глобальный порог автономии", kind: "select", value: "T0", source: "default" },
  ]);
});

/*
 * Часы машины возвращаются ВСЕГДА, даже если тест упал на ассерте: один
 * подменённый `Date` протёк бы во все следующие тесты файла (тот же сторож, что
 * в `app/apps/page.test.tsx`).
 */
afterEach(() => {
  vi.useRealTimers();
});

const screenFor = () => AgentPage({ params: Promise.resolve({ name: "vendhub-ops" }) });

/** Блок карточки по заголовку: каждый живёт своей секцией и своим отказом. */
const блок = (name: string) => within(screen.getByRole("region", { name }));

describe("Карточка агента: шапка", () => {
  it("показывает направление, состояние С ПРИЧИНОЙ и тир", async () => {
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(шапка.getByText("VendHub")).toBeVisible();
    // Слово состояния — из словаря сетки агентов, второго набора слов нет.
    expect(шапка.getByText("работает")).toBeVisible();
    expect(шапка.getByText("выполняет задачу (навык «monitor-stock»)")).toBeVisible();
    // Тир — ДЕЙСТВУЮЩИЙ: в настройках стоит потолок T0, и он режет номинальный
    // T1 карточки. Номинальный назван рядом отметкой, а не вместо него.
    expect(шапка.getByText("только спрашивает")).toBeVisible();
    expect(шапка.getByText(/урезан потолком системы T0/)).toBeVisible();
  });

  it("ДАВНОСТЬ СОСТОЯНИЯ ЕСТЬ, И ОНА ИЗ ЧАСОВ CORE (круг починок, C-3)", async () => {
    // Дефект: правило «плитка без давности врёт» было применено только к сетке
    // на главной. Агент со снятым расписанием и прогоном 12 июня давал шапку
    // «молчит · последний прогон — выполнено» — байт в байт как у
    // отработавшего час назад.
    /*
     * ЧАСЫ МАШИНЫ УВЕДЕНЫ НА ДРУГОЙ ДЕНЬ, И ЭТО НЕ ДЕКОРАЦИЯ (круг починок 1,
     * находка 8). Прежняя редакция ловила подмену часов Core на часы рендера
     * только потому, что «сегодня» настоящей машины не совпадало с 06.09.2026:
     * ровно в этот день года мутация прошла бы зелёной. Тесты, чьё обнаружение
     * зависит от календаря, в этом проекте уже протухали. Теперь часы рендера
     * стоят в январе и совпасть с `now` ответа не могут никогда.
     *
     * Подменяется ТОЛЬКО `Date`: фальшивые таймеры целиком остановили бы
     * планировщик, на котором держится рендер.
     */
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-15T10:00:00.000Z") });
    const молчун = (since: string) => async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: false },
      runtime: рантайм(),
      agents: [состояние({ state: "idle", reason: "последний прогон — выполнено", since })],
    });

    agentsStatus.mockImplementation(молчун("2026-09-06T03:00:00.000Z"));
    const свежий = render(await screenFor());
    const причина = свежий.container.querySelector(".agr");
    // ЧАСЫ CORE, А НЕ ЧАСЫ РЕНДЕРА: `now` ответа — 6 сентября, `since` — того
    // же дня по Ташкенту, значит «сегодня». Часы рендера стоят на 15 января,
    // и с ними тот же момент подписался бы датой «06.09» — на этом ассерт и
    // краснеет, независимо от того, какое сегодня число.
    expect(причина).toHaveTextContent("последний прогон — выполнено · сегодня 08:00");
    // Тон давности — свой (`.agw`), как в плитке: «12.06 08:00» и «сегодня
    // 08:00» должны отличаться взглядом, а не только вчитыванием.
    expect(причина?.querySelector(".agw")).not.toBeNull();
    const свежийТекст = причина?.textContent ?? "";
    свежий.unmount();

    agentsStatus.mockImplementation(молчун("2026-06-12T03:00:00.000Z"));
    const старый = render(await screenFor());
    const староеТекст = старый.container.querySelector(".agr")?.textContent ?? "";
    expect(староеТекст).not.toEqual(свежийТекст);
    expect(староеТекст).toMatch(/12\.06/);
  });

  it("ТОН ДАВНОСТИ ДОСТАЁТ ДО ШАПКИ, а не только до плитки (круг починок 1, находка 5)", async () => {
    /*
     * jsdom стилей не применяет, поэтому требование сторожится ПО ИСХОДНИКУ
     * `globals.css` — тем же разборщиком, что палитра и вес слова состояния.
     * НО ПРОВЕРЯЕТСЯ НА НАСТОЯЩЕМ ДЕРЕВЕ: правило `.agtile .agr .agw` красило
     * давность только в плитке, и снятие второй половины селектора не роняло
     * ни одного из 166 тестов панели. Существующие сторожа его и не поймали бы:
     * `правилаВеса` собирает правила с объявлением веса, `спорыЗаЛампу` смотрит
     * на носителей лампы, а `.agw` — не лампа и веса не несёт.
     *
     * Смысл требования: «12.06 08:00» и «сегодня 08:00» должны отличаться
     * взглядом, а не только вчитыванием, — а для этого давность обязана быть
     * покрашена своим тоном на ОБЕИХ поверхностях, где её печатает `runWhen`.
     */
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: false },
      runtime: рантайм(),
      agents: [
        состояние({ state: "idle", reason: "последний прогон — выполнено", since: "2026-06-12T03:00:00.000Z" }),
      ],
    }));
    const { container } = render(await screenFor());
    const давность = container.querySelector(".agw");
    expect(давность).not.toBeNull();

    // Правила файла, задающие ЦВЕТ субъекту `.agw`, — по одному селектору на
    // запятую. Только безусловные (`контекст === ""`): правило внутри
    // медиавыражения нельзя проверить через `matches`, и обещанием тона на
    // всех экранах оно не является.
    const красящие = правилаCss(стилиПанели)
      .filter((правило) => правило.контекст === "" && /(^|[;\s])color\s*:/.test(правило.тело))
      .flatMap((правило) => правило.селектор.split(",").map((с) => с.trim()))
      .filter((селектор) => селектор.endsWith(".agw"));
    expect(красящие.length).toBeGreaterThan(0);
    expect(красящие.some((селектор) => давность?.matches(селектор) === true)).toBe(true);
  });

  it("без `since` давность не выдумывается: об этом уже сказала причина", async () => {
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: false },
      runtime: рантайм(),
      agents: [
        состояние({
          state: "idle",
          reason: "ещё не запускался: в журнале прогонов нет ни одной записи",
        }),
      ],
    }));
    const { container } = render(await screenFor());
    const причина = container.querySelector(".agr");
    expect(причина).toHaveTextContent(/ещё не запускался/);
    expect(причина?.querySelector(".agw")).toBeNull();
  });

  it("Core не назвал состояние этого агента — шапка говорит это, а не молчит", async () => {
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: false },
      runtime: рантайм(),
      agents: [],
    }));
    render(await screenFor());

    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(блок("vendhub-ops").getByText(/состояние Core не назвал/)).toBeVisible();
  });

  it("состояние не прочиталось — шапка называет причину, карточка остаётся", async () => {
    agentsStatus.mockImplementation(async () => {
      throw new Error("HTTP 500 на /agents/status");
    });
    render(await screenFor());

    expect(блок("vendhub-ops").getByText(/Состояние не прочиталось: HTTP 500 на \/agents\/status/)).toBeVisible();
    expect(блок("Навыки").getByText("monitor-stock")).toBeVisible();
  });
});

describe("Карточка агента: системная пауза расписаний (круг починок, C-4)", () => {
  /** Штатный вход: задачи включены отдельно, расписания стоят по умолчанию «1». */
  const паузаРасписаний = (): void => {
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: true, tasks: false },
      runtime: рантайм({ paused: { schedules: true, tasks: false } }),
      agents: [состояние({ state: "idle", reason: "последний прогон — выполнено" })],
    }));
  };

  it("cron-агент видит, что плановые прогоны выключены НАСТРОЙКОЙ СИСТЕМЫ", async () => {
    // До правки `paused` из ответа выбрасывался, и карточка писала «молчит ·
    // последний прогон — выполнено», ни словом не упоминая причину молчания.
    паузаРасписаний();
    const { container } = render(await screenFor());

    const строка = container.querySelector(".notice");
    expect(строка).not.toBeNull();
    expect(строка).toHaveTextContent(/настройка системы/i);
    // Слова и ключ окружения — те же, что в сетке на главной: одна настройка
    // не должна называться на двух экранах по-разному.
    expect(строка).toHaveTextContent(/AGENTS_SCHEDULES_PAUSED/);
  });

  it("без паузы строки нет — иначе она перестанет что-либо значить", async () => {
    const { container } = render(await screenFor());
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("у агента БЕЗ расписания строки нет: пауза плановых прогонов его не касается", async () => {
    паузаРасписаний();
    agentCard.mockImplementation(async () => ({ ...card(), schedule: [] }));
    const { container } = render(await screenFor());
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("ожидающие поручения названы числом и в карточке, и в строке паузы (ревью Ф-1)", async () => {
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: true },
      runtime: рантайм({ paused: { schedules: false, tasks: true } }),
      agents: [
        состояние({ state: "idle", reason: "последний прогон — выполнено", queuedAssigned: 1 }),
      ],
    }));
    const { container } = render(await screenFor());
    expect(container.querySelector(".agr")).toHaveTextContent(/в очереди 1 порученная задача/);
    expect(container.querySelector(".notice")).toHaveTextContent(/Сейчас 1 задача ждёт снятия паузы/);
  });

  it("пауза ЗАДАЧ — отдельной строкой и у работающего агента (перепроверка прода, корень 1)", async () => {
    // Раньше карточка полагалась на то, что вердикт при паузе задач — «на
    // паузе» с той же формулировкой. Теперь занятый агент под паузой работает,
    // и без своей строки карточка молчала бы о тумблере, который держит его
    // порученные задачи в очереди.
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: true },
      runtime: рантайм({ paused: { schedules: false, tasks: true } }),
      agents: [состояние({ state: "working", reason: "выполняет задачу (навык «monitor-stock»)" })],
    }));
    const { container } = render(await screenFor());
    expect(screen.getByText("работает")).toBeVisible();
    const строка = container.querySelector(".notice");
    expect(строка).not.toBeNull();
    expect(строка).toHaveTextContent(/AGENTS_TASKS_PAUSED/);
    // Те же слова, что в сетке на главной: одна настройка — один текст.
    expect(строка).toHaveTextContent(/прогоны по cron-расписанию идут/);
  });
});

describe("Карточка агента: рантайм ещё не подхватил тумблер (Д-3)", () => {
  it("конфиг снял паузу, снимок рантайма ещё на ней — строка с расхождением", async () => {
    agentsStatus.mockImplementation(async () => ({
      tz: "Asia/Tashkent",
      now: "2026-09-06T08:00:00.000Z",
      paused: { schedules: false, tasks: false },
      runtime: рантайм({ ageSec: 300, paused: { schedules: false, tasks: true }, lagging: true }),
      agents: [состояние({ state: "idle", reason: "последний прогон — выполнено" })],
    }));
    const { container } = render(await screenFor());
    const строка = container.querySelector(".notice");
    expect(строка).not.toBeNull();
    expect(строка).toHaveTextContent(/не подхватил настройку \(снимок 5 мин назад\)/);
    expect(строка).toHaveTextContent(/назначенные задачи: в настройке работают, у рантайма ещё на паузе/);
  });
});

describe("Карточка агента: навыки", () => {
  it("показывает тир, исполнителя, расписание и кнопку запуска", async () => {
    render(await screenFor());
    const навыки = блок("Навыки");

    expect(навыки.getByText("monitor-stock")).toBeVisible();
    expect(навыки.getByText("модель")).toBeVisible();
    expect(навыки.getByText("предлагает, решаешь ты")).toBeVisible();
    expect(навыки.getByText("0 8 * * *")).toBeVisible();
    expect(навыки.getByRole("button", { name: "Запустить monitor-stock" })).toBeVisible();
  });

  it("каталог навыков пуст — блок объясняет, что каталог пишут сами агенты", async () => {
    skillDeck.mockImplementation(async () => ({
      syncedAt: null,
      models: { primary: null, fallbacks: [] },
      items: [],
    }));
    render(await screenFor());

    expect(блок("Навыки").getByText(/каталог навыков пуст/i)).toBeVisible();
  });
});

describe("Карточка агента: последние прогоны", () => {
  it("строка прогона ведёт в плейбэк этого прогона", async () => {
    render(await screenFor());

    // Ссылка несёт и агента (возврат из плейбэка в свою выборку), и сам прогон.
    const разбор = блок("Последние прогоны").getByRole("link", { name: /monitor-stock/ });
    expect(разбор).toHaveAttribute("href", "/flows?agent=vendhub-ops&run=run-1");
    // Исход прогона словами — из общего словаря, а не второй формулировкой.
    expect(блок("Последние прогоны").getByText(/выполнено/i)).toBeVisible();
  });

  it("прогонов нет — это не «всё хорошо», а «журнал пуст»", async () => {
    agentRuns.mockImplementation(async () => ({ runs: [] }));
    render(await screenFor());

    expect(блок("Последние прогоны").getByText(/прогонов ещё нет/i)).toBeVisible();
  });
});

describe("Карточка агента: память", () => {
  it("показывает навык и время записи", async () => {
    render(await screenFor());
    const память = блок("Память");

    expect(память.getByText("monitor-stock")).toBeVisible();
    expect(память.getByText("6 сент., 08:00")).toBeVisible();
  });

  it("памяти нет — блок говорит, что агент ещё ничего не запомнил", async () => {
    agentMemory.mockImplementation(async () => []);
    render(await screenFor());

    expect(блок("Память").getByText(/ещё ничего не запомнил/i)).toBeVisible();
  });
});

describe("Карточка агента: что делал", () => {
  it("аудит запрашивается с фильтром по актору, а не выгрузкой всего журнала", async () => {
    render(await screenFor());

    const фильтры = audit.mock.calls.map((c) => c[1]);
    expect(фильтры).toEqual(
      expect.arrayContaining([expect.objectContaining({ actor: "vendhub-ops" })]),
    );
  });

  it("запуск навыка попадает в блок, хотя его актор — владелец", async () => {
    // Дефект Р-7: у запуска `target = "<агент>/<навык>"`, а `actorRef` —
    // владелец, поэтому фильтр по актору его не находит, и блок молчал о том,
    // что навык вообще запускали.
    audit.mockImplementation(async (_limit: number, filter?: { actor?: string; action?: string }) =>
      filter?.action === "agent.skill.run"
        ? [
            запись({
              id: "a-run",
              actorKind: "human",
              actorRef: "owner",
              action: "agent.skill.run",
              target: "vendhub-ops/monitor-stock",
            }),
            // Чужой запуск в блок попасть не должен: фильтра по target у Core нет.
            запись({
              id: "a-alien",
              actorKind: "human",
              actorRef: "owner",
              action: "agent.skill.run",
              target: "chief-of-staff/morning-digest",
            }),
          ]
        : [запись({ id: "a-own" })],
    );
    render(await screenFor());
    const делал = блок("Что делал");

    expect(делал.getByText("запущен навык monitor-stock")).toBeVisible();
    expect(делал.getByText("попросил разрешения")).toBeVisible();
    expect(делал.queryByText(/morning-digest/)).toBeNull();
  });

  it("подстрока актора притащила чужого агента — в блок он не попадает", async () => {
    // Фильтр Core — подстрока (`like %имя%`), и «ops» нашёл бы «vendhub-ops».
    audit.mockImplementation(async (_limit: number, filter?: { actor?: string; action?: string }) =>
      filter?.action === "agent.skill.run"
        ? []
        : [запись({ id: "a-own" }), запись({ id: "a-other", actorRef: "agent:vendhub-ops-2" })],
    );
    render(await screenFor());

    expect(блок("Что делал").getAllByText("попросил разрешения")).toHaveLength(1);
  });
});

describe("Карточка агента: порог автономии", () => {
  it("ключа AGENT_AUTONOMY_MAX в ответе нет — это не то же, что отказ чтения", async () => {
    // Прежний общий `null` смешивал «ответ пришёл, ключа нет» и «ответа не
    // было»: редактор молчал одинаково, хотя чинить надо разное.
    systemConfig.mockImplementation(async () => [
      { key: "LLM_PRIMARY_MODEL", label: "Основная модель", kind: "text", value: "sonnet", source: "db" },
    ]);
    render(await screenFor());

    expect(screen.getByText("Настройки агента · порог не задан")).toBeVisible();
  });

  it("подсказка о пороге получает ДЕЙСТВУЮЩЕЕ значение из конфига, а не константу", async () => {
    systemConfig.mockImplementation(async () => [
      { key: "AGENT_AUTONOMY_MAX", label: "Глобальный порог автономии", kind: "select", value: "T2", source: "db" },
    ]);
    render(await screenFor());

    expect(screen.getByText("Настройки агента · порог T2")).toBeVisible();
  });

  it("конфиг не прочитался — редактор получает «не прочитан», а не выдуманный T0", async () => {
    systemConfig.mockImplementation(async () => {
      throw new Error("нет связи");
    });
    render(await screenFor());

    expect(screen.getByText("Настройки агента · порог не прочитан: нет связи")).toBeVisible();
  });
});

/*
 * Р-7 в шапке: пилюля — самый крупный текст экрана, и она называла номинальный
 * тир действующим, хотя потолок системы прочитан на этой же странице и умеет
 * пинить агента в T0. Отметка — словами на экране: `title` не читается взглядом.
 */
describe("Карточка агента: потолок системы в шапке", () => {
  const сПотолком = (tier: string) => {
    systemConfig.mockImplementation(async () => [
      { key: "AGENT_AUTONOMY_MAX", label: "Глобальный порог автономии", kind: "select", value: tier, source: "db" },
    ]);
  };

  it("потолок НИЖЕ номинального тира — шапка называет действующий тир и урезание", async () => {
    сПотолком("T0"); // в карточке T1
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(шапка.getByText("только спрашивает")).toBeVisible();
    expect(шапка.getByText(/урезан потолком системы T0 · в карточке T1/)).toBeVisible();
    // Номинальный тир действующим больше не называется.
    expect(шапка.queryByText("предлагает, решаешь ты")).toBeNull();
  });

  it("потолок равен номинальному — отметки нет", async () => {
    сПотолком("T1");
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(шапка.getByText("предлагает, решаешь ты")).toBeVisible();
    expect(шапка.queryByText(/урезан потолком/)).toBeNull();
  });

  it("потолок ВЫШЕ номинального — отметки нет: карточка строже системы", async () => {
    сПотолком("T3");
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(шапка.getByText("предлагает, решаешь ты")).toBeVisible();
    expect(шапка.queryByText(/урезан потолком/)).toBeNull();
  });

  it("потолок не прочитан — про урезание НИЧЕГО не додумывается", async () => {
    // Врать про урезание, не зная потолка, хуже, чем молчать: печатаем
    // номинальный тир как есть.
    systemConfig.mockImplementation(async () => {
      throw new Error("нет связи");
    });
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(шапка.getByText("предлагает, решаешь ты")).toBeVisible();
    expect(шапка.queryByText(/урезан потолком/)).toBeNull();
  });

  it("в настройках лежит не тир — сравнивать нечем, отметки нет", async () => {
    // Сравнение идёт местом в AUTONOMY_TIERS: у чужого значения место -1, то
    // есть «строже T0», и экран объявил бы урезанным тир, которого не резали.
    сПотолком("максимальный");
    render(await screenFor());
    const шапка = блок("vendhub-ops");

    expect(шапка.getByText("предлагает, решаешь ты")).toBeVisible();
    expect(шапка.queryByText(/урезан потолком/)).toBeNull();
  });
});

/*
 * Р-7 в блоке «Что делал»: из шести подписей живой была одна, а четыре самых
 * частых действия агента падали в фолбэк `ACTION_LABEL[e.action] ?? e.action` и
 * печатались владельцу машинной строкой вида `task.agent_run.claimed`.
 */
describe("Карточка агента: что делал — подписи действий", () => {
  const живые = [
    "task.agent_run.claimed",
    "task.agent_execution.blocked",
    "task.agent_run.action_capped",
    "task.agent_run.released",
  ] as const;

  it.each(живые)("«%s» печатается словами, а не идентификатором", async (action) => {
    audit.mockImplementation(async (_limit: number, filter?: { actor?: string; action?: string }) =>
      filter?.action === "agent.skill.run" ? [] : [запись({ id: "a-1", action, target: "task-1" })],
    );
    render(await screenFor());

    const секция = screen.getByRole("region", { name: "Что делал" });
    const подпись = секция.querySelector(".row .t b")?.textContent ?? "";
    expect(подпись).not.toBe("");
    expect(подпись).not.toBe(action);
    // Точечная нотация в выводе = подпись потерялась и приехал идентификатор.
    expect(подпись).not.toMatch(/\./);
  });

  it("правку карточки владельцем блок не показывает — это не действие агента", async () => {
    // Сужение по актору — РЕШЕНИЕ, а не случайность: блок называется «Что
    // делал», а тир и описание правил владелец. Ищущий здесь свою правку
    // владелец должен не найти её и пойти в журнал изменений.
    audit.mockImplementation(async (_limit: number, filter?: { actor?: string; action?: string }) =>
      filter?.action === "agent.skill.run"
        ? []
        : [
            запись({ id: "a-own", action: "task.agent_run.claimed", target: "task-1" }),
            запись({
              id: "a-owner",
              actorKind: "human",
              actorRef: "owner",
              action: "agent.update",
              target: "vendhub-ops",
            }),
          ],
    );
    render(await screenFor());
    const делал = блок("Что делал");

    expect(делал.getByText("взял задачу в работу")).toBeVisible();
    expect(делал.queryByText("agent.update")).toBeNull();
    expect(делал.queryByText(/изменены настройки/)).toBeNull();
  });

  it("подпись блока честно называет содержимое — правок карточки в нём нет", async () => {
    render(await screenFor());

    expect(блок("Что делал").getByText(/Правки карточки .* делает владелец/)).toBeVisible();
  });
});

describe("Карточка агента: отказ одного источника", () => {
  it("память не прочиталась — страница остаётся, а блок говорит почему", async () => {
    agentMemory.mockImplementation(async () => {
      throw new Error("HTTP 401 на /events");
    });
    render(await screenFor());

    // Всё остальное на месте: отказ одного блока не уносит карточку.
    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(блок("Навыки").getByText("monitor-stock")).toBeVisible();
    expect(блок("Память").getByText(/Память не прочиталась: HTTP 401 на \/events/)).toBeVisible();
  });

  it("журнал прогонов не прочитался — свой блок говорит это, соседние живы", async () => {
    agentRuns.mockImplementation(async () => {
      throw new Error("HTTP 401 на /routines/runs");
    });
    render(await screenFor());

    expect(
      блок("Последние прогоны").getByText(/Прогоны не прочитались: HTTP 401 на \/routines\/runs/),
    ).toBeVisible();
    expect(screen.getByText("Настройки агента · порог T0")).toBeVisible();
  });

  it("навыки не прочитались — блок говорит это, а не показывает пустой каталог", async () => {
    skillDeck.mockImplementation(async () => {
      throw new Error("HTTP 500 на /agents/skills");
    });
    render(await screenFor());

    expect(блок("Навыки").getByText(/Навыки не прочитались: HTTP 500 на \/agents\/skills/)).toBeVisible();
    expect(блок("Навыки").queryByText(/каталог навыков пуст/i)).toBeNull();
  });

  it("журнал действий не прочитался — блок говорит это, а не «пока ничего»", async () => {
    audit.mockImplementation(async () => {
      throw new Error("HTTP 500 на /audit");
    });
    render(await screenFor());

    expect(блок("Что делал").getByText(/Журнал действий не прочитался: HTTP 500 на \/audit/)).toBeVisible();
    expect(блок("Что делал").queryByText(/Пока ничего/)).toBeNull();
  });
});

describe("Карточка агента: хуки прогона", () => {
  it("показывает хук, его параметры и фазу", async () => {
    agentCard.mockImplementation(async () =>
      card({ preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }], postRun: [{ kind: "coach_lite" }] }),
    );
    render(await screenFor());
    const хуки = блок("Хуки прогона");

    expect(хуки.getByText("quiet_hours")).toBeVisible();
    expect(хуки.getByText("from: 22:00 · to: 07:00")).toBeVisible();
    expect(хуки.getByText("до прогона")).toBeVisible();
    expect(хуки.getByText("coach_lite")).toBeVisible();
    expect(хуки.getByText("без параметров")).toBeVisible();
    // Известные хуки ничего не блокируют — тревожной метки быть не должно.
    expect(хуки.queryByText(/блокирует запуск/)).toBeNull();
  });

  it("хуки в форме паспорта (snake_case) карточка тоже показывает", async () => {
    // `tools/apply-passport-fields.mjs` — единственный документированный путь
    // доставки хуков в 12 существующих карточек прода — кладёт в Core СЫРОЙ
    // раздел паспорта (`pre_run`/`post_run`). Рантайм читает обе формы, а
    // карточка знала только camelCase: документированная проверка выката
    // («блок „Хуки прогона“ в карточке») всегда врала «не доехало»
    // (adversarial-ревью волны R, B3).
    agentCard.mockImplementation(async () =>
      card({
        pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }],
        post_run: [{ kind: "coach_lite" }],
      }),
    );
    render(await screenFor());
    const хуки = блок("Хуки прогона");

    expect(хуки.getByText("source_fresh")).toBeVisible();
    expect(хуки.getByText("run: system/ourvend:sync · max_age_hours: 6")).toBeVisible();
    expect(хуки.getByText("до прогона")).toBeVisible();
    expect(хуки.getByText("coach_lite")).toBeVisible();
    expect(хуки.queryByText(/блокирует запуск/)).toBeNull();
  });

  it("неизвестный pre_run назван по имени из паспорта и помечен как блокирующий", async () => {
    // Рантайм фейлится закрыто: навык с таким хуком не запускается ВООБЩЕ
    // (Р-4). Без метки владелец ищет причину молчания агента в cron.
    agentCard.mockImplementation(async () =>
      card({ preRun: [{ kind: "unknown", raw: "telepathy" }], postRun: [] }),
    );
    render(await screenFor());

    expect(блок("Хуки прогона").getByText("telepathy")).toBeVisible();
    expect(блок("Хуки прогона").getByText("блокирует запуск: неизвестный kind")).toBeVisible();
  });

  it("кривой json хуков не роняет карточку — блок просто не рисуется", async () => {
    // В карточке Core `hooks` — json-колонка: туда попадало то, что прислал
    // сид паспорта. Одна кривая запись не должна уносить с собой настройки
    // агента и его журнал.
    agentCard.mockImplementation(async () =>
      card({ preRun: "перезапустить всё", postRun: [null, 42, {}] } as unknown as AgentCard["hooks"]),
    );
    render(await screenFor());

    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(screen.getByText("Настройки агента · порог T0")).toBeVisible();
    expect(screen.queryByText("Хуки прогона")).toBeNull();
  });

  it("хуков нет — блока нет", async () => {
    render(await screenFor());
    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(screen.queryByText("Хуки прогона")).toBeNull();
  });
});
