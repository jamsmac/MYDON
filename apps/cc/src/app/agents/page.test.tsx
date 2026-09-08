import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentCard, AgentsStatus, AgentStatusRow } from "../../lib/core";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const agents = vi.hoisted(() => vi.fn());
const agentsStatus = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { agents, agentsStatus },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));
// Форма нового агента — клиентская, со своим server action; здесь проверяется список.
vi.mock("../../components/agent-new", () => ({
  NewAgentForm: () => <div>форма нового агента</div>,
}));

import AgentsPage from "./page";

const base: AgentCard = {
  id: "a1",
  name: "vendhub-ops",
  business: "vendhub",
  status: "active",
  description: null,
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
const card = (over: Partial<AgentCard> = {}): AgentCard => ({ ...base, ...over });

const состояние = (over: Partial<AgentStatusRow> = {}): AgentStatusRow => ({
  name: "vendhub-ops",
  business: "vendhub",
  passportStatus: "active",
  state: "working",
  reason: "выполняет задачу (навык «monitor-stock»)",
  ...over,
});

const рантайм = (over: Partial<AgentsStatus["runtime"]> = {}): AgentsStatus["runtime"] => ({
  reportedAt: "2026-09-06T07:59:00.000Z",
  ageSec: 60,
  stale: false,
  paused: { schedules: false, tasks: false },
  lagging: false,
  readFailed: false,
  ...over,
});

const ответ = (over: Partial<AgentsStatus> = {}): AgentsStatus => ({
  tz: "Asia/Tashkent",
  now: "2026-09-06T08:00:00.000Z",
  paused: { schedules: false, tasks: false },
  runtime: рантайм(),
  agents: [
    состояние(),
    состояние({
      name: "globerent-scout",
      business: "globerent",
      state: "idle",
      reason: "последний прогон — выполнено",
    }),
  ],
  ...over,
});

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest отслеживать промисы мока, и тест с отказом падает
 * «необработанным» отказом при зелёном теле.
 */
beforeEach(() => {
  agents.mockImplementation(async () => [
    card(),
    card({ id: "a2", name: "globerent-scout", business: "globerent" }),
  ]);
  agentsStatus.mockImplementation(async () => ответ());
});

describe("Список агентов: занятость из /agents/status, а не из паспорта (перепроверка прода, Д-2)", () => {
  it("ПРИ СИСТЕМНОЙ ПАУЗЕ ЗАДАЧ заголовок не говорит «Работают N», строка про тумблер есть, сводка — по состояниям", async () => {
    // Прод: AGENTS_TASKS_PAUSED=1, 13 карточек `active`. Прежняя страница
    // печатала «Работают 13 из 13» и 13 зелёных «работает».
    agentsStatus.mockImplementation(async () =>
      ответ({
        paused: { schedules: false, tasks: true },
        runtime: рантайм({ paused: { schedules: false, tasks: true } }),
        agents: [
          состояние(),
          состояние({
            name: "globerent-scout",
            business: "globerent",
            state: "paused",
            reason:
              "назначенные задачи на паузе (это настройка системы, а не агента); cron-прогоны этой паузой не остановлены",
          }),
        ],
      }),
    );
    const { container } = render(await AgentsPage());
    expect(screen.queryByText(/Работают \d+ из \d+/)).toBeNull();
    expect(screen.getByText(/работают 1 · на паузе 1/)).toBeInTheDocument();
    expect(container.querySelector(".notice")).toHaveTextContent(/AGENTS_TASKS_PAUSED/);
    // Зелёной пилюли «работает» по паспорту больше нет ни у кого.
    expect(container.querySelector(".pill.ok")).toBeNull();
    expect(screen.getByText("на паузе")).toBeInTheDocument();
  });

  it("ожидающие поручения — числом в строке и в сводке паузы (ревью Ф-1)", async () => {
    agentsStatus.mockImplementation(async () =>
      ответ({
        paused: { schedules: false, tasks: true },
        runtime: рантайм({ paused: { schedules: false, tasks: true } }),
        agents: [
          состояние({ state: "idle", reason: "последний прогон — выполнено", queuedAssigned: 3 }),
          состояние({ name: "globerent-scout", state: "idle", reason: "повода нет" }),
        ],
      }),
    );
    const { container } = render(await AgentsPage());
    // Текст разбит на узлы (число и слово — отдельные выражения JSX), поэтому
    // проверяем содержимое строки, а не единый текстовый узел.
    const строки = [...container.querySelectorAll(".agr")].map((n) => n.textContent ?? "");
    expect(строки.some((t) => /в очереди 3 порученные задачи/.test(t))).toBe(true);
    expect(строки.some((t) => /в очереди/.test(t) && /повода нет/.test(t))).toBe(false);
    expect(container.querySelector(".notice")).toHaveTextContent(
      /Сейчас 3 задачи ждут снятия паузы/,
    );
  });

  it("состояние — словами сетки с причиной, паспорт — «включён в карточке» без класса ok", async () => {
    const { container } = render(await AgentsPage());
    expect(screen.getByText("работает")).toBeInTheDocument();
    expect(screen.getByText("молчит")).toBeInTheDocument();
    expect(screen.getByText(/выполняет задачу/)).toBeInTheDocument();
    const пилюли = screen.getAllByText("включён в карточке");
    expect(пилюли).toHaveLength(2);
    for (const p of пилюли) expect(p).not.toHaveClass("ok");
    expect(container.querySelector(".pill.ok")).toBeNull();
    // Строка ведёт в карточку.
    expect(screen.getByRole("link", { name: /vendhub-ops/ })).toHaveAttribute(
      "href",
      "/agents/vendhub-ops",
    );
  });

  it("выключенный в карточке агент — в своём разделе, словами паспорта, и с состоянием Core", async () => {
    agents.mockImplementation(async () => [
      card(),
      card({ id: "a2", name: "globerent-scout", status: "paused" }),
    ]);
    agentsStatus.mockImplementation(async () =>
      ответ({
        agents: [
          состояние(),
          состояние({
            name: "globerent-scout",
            passportStatus: "paused",
            state: "paused",
            reason: "агент выключен в карточке (статус paused)",
          }),
        ],
      }),
    );
    render(await AgentsPage());
    // Заголовок секции — точная противоположность «Включены в карточке»
    // (слияние: правило среза Д1). Под ним лежат три разных паспортных
    // статуса, и называть секцию одним из них значит спорить со строками.
    expect(screen.getByText("Не включены в карточке")).toBeInTheDocument();
    expect(screen.getByText("выключен в карточке (paused)")).toBeInTheDocument();
    expect(screen.getByText(/агент выключен в карточке/)).toBeInTheDocument();
  });

  it("ОТКАЗ /agents/status — третий вид с причиной, а не список «работает» по паспортам", async () => {
    agentsStatus.mockImplementation(async () => {
      throw new Error("HTTP 500 на /agents/status");
    });
    const { container } = render(await AgentsPage());
    expect(screen.getByText(/Состояние агентов не прочиталось: HTTP 500/)).toBeInTheDocument();
    expect(screen.queryByText("работает")).toBeNull();
    expect(screen.queryByText(/Работают/)).toBeNull();
    expect(container.querySelector(".pill.ok")).toBeNull();
    // Карточки не пропали: у каждой сказано, что состояние не прочиталось.
    expect(screen.getAllByText("состояние не прочиталось")).toHaveLength(2);
    expect(screen.getAllByText("включён в карточке")).toHaveLength(2);
  });

  it("Core ответил, но агента в ответе нет — сказано именно это, не «не прочиталось»", async () => {
    agentsStatus.mockImplementation(async () => ответ({ agents: [состояние()] }));
    render(await AgentsPage());
    expect(screen.getByText("состояние Core не назвал")).toBeInTheDocument();
  });

  it("рантайм ещё не подхватил тумблер — строка об этом есть и здесь (Д-3)", async () => {
    agentsStatus.mockImplementation(async () =>
      ответ({
        runtime: рантайм({ ageSec: 300, paused: { schedules: false, tasks: true }, lagging: true }),
      }),
    );
    const { container } = render(await AgentsPage());
    expect(container.querySelector(".notice")).toHaveTextContent(
      /не подхватил настройку \(снимок 5 мин назад\)/,
    );
  });

  /*
   * СТАТУС КАРТОЧКИ ВНЕ ЧЕТЫРЁХ ЗНАЧЕНИЙ (девятый круг починок среза Д1).
   *
   * `CARD_PASSPORT_WORD` — `Record<AgentCard["status"], string>`, но
   * индексируется он РАНТАЙМНЫМ значением из Core. Новый статус в ядре (или
   * старая панель против нового ядра) давал `undefined`: пилюля превращалась в
   * пустой `<span>`, и строка агента молчала о том, что с ним. До сведения
   * словарей здесь стоял тернарник с фолбэком «выключен» — вранья стало
   * меньше, а пустоты больше.
   */
  it("незнакомый статус: слово — сырое значение Core, класс — нейтральная пилюля", async () => {
    agents.mockImplementation(async () => [
      card(),
      // Значение, которого нет в словарях: ровно то, что приедет из Core на
      // следующем статусе жизненного цикла.
      card({ id: "a3", name: "новый-агент", status: "retired" as AgentCard["status"] }),
    ]);
    render(await AgentsPage());

    // Известный статус — как и был, из словаря паспорта и БЕЗ зелёного.
    const известный = screen.getByText("включён в карточке");
    expect(известный.className, "класс пилюли паспорта разошёлся со словарём").toBe("pill");

    // Незнакомый — назван словом, а не проглочен.
    const незнакомый = screen.getByText("retired");
    expect(незнакомый.className, "класс пилюли потерялся вместе со словарём").toBe("pill");
  });

  it("строка агента с незнакомым статусом вообще ЕСТЬ на экране", async () => {
    // Обратная сторона: агент не должен исчезнуть из списка — он попадает в
    // секцию «Не включены в карточке» (`status !== "active"`).
    agents.mockImplementation(async () => [
      card({ id: "a3", name: "новый-агент", status: "retired" as AgentCard["status"] }),
    ]);
    render(await AgentsPage());
    expect(screen.getByText("новый-агент")).toBeInTheDocument();
    expect(screen.getByText("Не включены в карточке")).toBeInTheDocument();
  });

  it("отказ Core на карточках — «Core недоступен», а не пустой список", async () => {
    agents.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });
    render(await AgentsPage());
    expect(screen.getByText(/Core недоступен|ECONNREFUSED/)).toBeInTheDocument();
  });
});
