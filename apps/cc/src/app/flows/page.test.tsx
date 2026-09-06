import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowPlayback, FlowSummary } from "../../lib/core";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const flows = vi.hoisted(() => vi.fn());
const flow = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { flows, flow },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));

// Типы берутся у настоящего модуля, реализация — у мока выше.
import { CoreUnavailable } from "../../lib/core";
import FlowsPage from "./page";

const STOCK: FlowSummary = {
  id: "r1",
  agent: "vendhub-ops",
  skill: "monitor-stock",
  trigger: "cron",
  startedAt: "2026-09-06T03:00:00.000Z",
  finishedAt: "2026-09-06T03:00:03.000Z",
  outcome: "approval_requested",
  skipReason: null,
  hook: null,
  reason: "6 позиций ниже нормы",
  action: "заказать 6 позиций",
  taskId: "t1",
  approvalId: "a1",
};
const SYNC: FlowSummary = {
  id: "r2",
  agent: "system",
  skill: "ourvend:sync",
  trigger: "cron",
  startedAt: "2026-09-06T01:00:00.000Z",
  finishedAt: "2026-09-06T01:00:09.000Z",
  outcome: "skipped",
  skipReason: "no_signal",
  hook: null,
  reason: "нечего предлагать",
  action: null,
  taskId: null,
  approvalId: null,
};

const PLAYBACK: FlowPlayback = {
  run: {
    ...STOCK,
    cron: "0 8 * * *",
    scheduledAt: "2026-09-06T03:00:00.000Z",
    review: "норму по Olma стоит пересчитать",
    requestKey: "vendhub-ops:monitor-stock:2026-09-06",
  },
  phases: [
    { name: "trigger", state: "ok", at: "2026-09-06T03:00:00.000Z", title: "cron 0 8 * * * · план 08:00" },
    { name: "skill", state: "ok", title: "monitor-stock · llm · T3" },
    { name: "proposal", state: "ok", at: "2026-09-06T03:00:03.000Z", title: "заказать 6 позиций" },
    { name: "approval", state: "warn", at: "2026-09-06T03:00:04.000Z", title: "ждёт решения с 08:00 · T3", href: "/inbox" },
    { name: "execution", state: "skip", title: "выполнения не было" },
    { name: "delivery", state: "ok", title: "telegram ✓" },
  ],
  events: [{ at: "2026-09-06T03:00:02.000Z", type: "agent.action", payload: { skill: "monitor-stock" } }],
  audit: [{ at: "2026-09-06T03:00:01.000Z", action: "task.claimed", actorRef: "vendhub-ops", target: "t1" }],
};

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`, никогда через
 * `mockResolvedValue`: иначе vitest 3.2 отслеживает промисы мока, и соседний
 * тест с синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  flows.mockImplementation(async () => ({ runs: [STOCK, SYNC] }));
  flow.mockImplementation(async () => PLAYBACK);
});

describe("Экран «Прогоны»", () => {
  it("список прогонов: время, задание, исход одной фразой и вход в плейбэк", async () => {
    render(await FlowsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Прогоны" })).toBeInTheDocument();
    const rows = screen.getAllByRole("link");
    expect(rows[0]).toHaveTextContent("08:00");
    expect(rows[0]).toHaveTextContent("vendhub-ops/monitor-stock");
    expect(rows[0]).toHaveTextContent("предложение отправлено — 6 позиций ниже нормы");
    expect(rows[0]).toHaveAttribute("href", "/flows?run=r1");
    expect(rows[1]).toHaveTextContent("пропущено: повода нет — нечего предлагать");
    expect(rows[1]).toHaveAttribute("href", "/flows?run=r2");
  });

  it("выбран прогон — полоса шести фаз, причина и лента событий с аудитом", async () => {
    render(await FlowsPage({ searchParams: Promise.resolve({ run: "r1" }) }));

    expect(flow).toHaveBeenCalledWith("r1");
    const strip = within(screen.getByRole("list", { name: "Фазы прогона" }));
    const cells = strip.getAllByRole("listitem");
    expect(cells).toHaveLength(6);
    expect(cells.map((c) => c.getAttribute("data-state"))).toEqual(["ok", "ok", "ok", "warn", "skip", "ok"]);
    for (const label of ["Триггер", "Навык", "Предложение", "Согласование", "Выполнение", "Доставка"]) {
      expect(strip.getByText(label)).toBeVisible();
    }

    // Причина словами владельца плюс разбор коуча и ключ идемпотентности.
    const reason = within(screen.getByRole("region", { name: "Причина прогона" }));
    expect(reason.getByText("предложение отправлено — 6 позиций ниже нормы")).toBeVisible();
    expect(reason.getByText("коуч: норму по Olma стоит пересчитать")).toBeVisible();
    expect(reason.getByText("vendhub-ops:monitor-stock:2026-09-06")).toBeVisible();

    // Лента — одна колонка по времени: аудит 03:00:01 стоит перед событием 03:00:02.
    const line = within(screen.getByRole("list", { name: "Лента прогона" })).getAllByRole("listitem");
    expect(line).toHaveLength(2);
    expect(line[0]).toHaveTextContent("аудит");
    expect(line[0]).toHaveTextContent("task.claimed · vendhub-ops");
    expect(line[0]).toHaveTextContent("t1");
    expect(line[1]).toHaveTextContent("событие");
    expect(line[1]).toHaveTextContent("agent.action");
    expect(line[1]).toHaveTextContent('{"skill":"monitor-stock"}');
  });

  it("фильтры уходят в Core и остаются в ссылках строк и в полях формы", async () => {
    render(
      await FlowsPage({
        searchParams: Promise.resolve({ agent: "vendhub-ops", skill: "monitor-stock", outcome: "executed" }),
      }),
    );

    expect(flows).toHaveBeenCalledWith({
      agent: "vendhub-ops",
      skill: "monitor-stock",
      outcome: "executed",
      limit: "50",
    });
    // Ссылка строки НЕ сбрасывает фильтр: иначе возврат из плейбэка
    // высаживал бы владельца в полный журнал.
    expect(screen.getAllByRole("link")[0]).toHaveAttribute(
      "href",
      "/flows?agent=vendhub-ops&skill=monitor-stock&outcome=executed&run=r1",
    );
    expect(screen.getByLabelText("Агент")).toHaveValue("vendhub-ops");
    expect(screen.getByLabelText("Навык")).toHaveValue("monitor-stock");
    expect(screen.getByLabelText("Исход")).toHaveValue("executed");
  });

  it("журнал пуст — экран говорит, что прогонов ещё не было", async () => {
    flows.mockImplementation(async () => ({ runs: [] }));
    render(await FlowsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Прогонов ещё нет")).toBeVisible();
  });

  it("Core недоступен — экран не белый, а с деталью отказа", async () => {
    flows.mockImplementation(async () => {
      throw new CoreUnavailable("connect ECONNREFUSED");
    });
    render(await FlowsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Нет связи с ядром MYDON/)).toBeVisible();
    expect(screen.getByText(/ECONNREFUSED/)).toBeVisible();
  });

  it("прогона по ссылке нет — список остаётся, плейбэк говорит «не найден»", async () => {
    flow.mockImplementation(async () => {
      throw new CoreUnavailable("HTTP 404 на /routines/flows/r9");
    });
    render(await FlowsPage({ searchParams: Promise.resolve({ run: "r9" }) }));

    expect(screen.getByText("Прогон не найден")).toBeVisible();
    // Ошибка одного прогона не уносит журнал: соседние строки на месте.
    expect(screen.getByText(/vendhub-ops\/monitor-stock/)).toBeVisible();
    expect(screen.queryByText(/Нет связи с ядром MYDON/)).toBeNull();
  });

  it("плейбэк не открылся не из-за 404 — это авария, а не «прогона нет»", async () => {
    flow.mockImplementation(async () => {
      throw new CoreUnavailable("HTTP 500 на /routines/flows/r1");
    });
    render(await FlowsPage({ searchParams: Promise.resolve({ run: "r1" }) }));

    expect(screen.getByText("Прогон не открылся")).toBeVisible();
    expect(screen.getByText(/HTTP 500/)).toBeVisible();
    expect(screen.getByText(/vendhub-ops\/monitor-stock/)).toBeVisible();
  });
});
