import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CronBoard } from "../../lib/core";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const cronBoard = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { cronBoard },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));
// Тумблеры паузы — клиентские: здесь проверяется доска, а не запись настройки.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../system/actions", () => ({ saveSystemConfig: vi.fn(async () => ({ ok: true })) }));

// Типы берутся у настоящего модуля, реализация — у мока выше.
import { CoreUnavailable } from "../../lib/core";
import CronsPage from "./page";

const OURVEND: CronBoard["jobs"][number] = {
  id: "system/ourvend:sync",
  kind: "monitor",
  agent: "system",
  skill: "ourvend:sync",
  cron: "0 */3 * * *",
  mode: "monitor",
  enabled: true,
  paused: false,
  nextRun: "2026-09-06T04:00:00.000Z",
  last: { at: "2026-09-06T01:00:00.000Z", outcome: "executed", skipReason: null, hook: null, reason: "автоматов 26/26", runId: "r1" },
};
// У навыка ключ строки несёт cron (`агент/навык@cron`): у монитора и у
// неподключённого навыка расписание одно, у навыка их может быть несколько.
const STOCK: CronBoard["jobs"][number] = {
  id: "vendhub-ops/monitor-stock@0 8 * * *",
  kind: "skill",
  agent: "vendhub-ops",
  skill: "monitor-stock",
  cron: "0 8 * * *",
  mode: "legacy",
  enabled: true,
  paused: false,
  nextRun: "2026-09-07T03:00:00.000Z",
  last: null,
};

const board: CronBoard = {
  tz: "Asia/Tashkent",
  now: "2026-09-06T03:10:00.000Z",
  snapshot: { generatedAt: "2026-09-06T03:05:00.000Z", ageSec: 300, stale: false },
  paused: { schedules: false, tasks: true },
  jobs: [OURVEND, STOCK],
  upcoming24h: [
    { at: "2026-09-06T04:00:00.000Z", jobId: "system/ourvend:sync" },
    { at: "2026-09-07T03:00:00.000Z", jobId: "vendhub-ops/monitor-stock@0 8 * * *" },
  ],
};

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`, никогда через
 * `mockResolvedValue`: иначе vitest 3.2 отслеживает промисы мока, и соседний
 * тест с синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  cronBoard.mockImplementation(async () => board);
});

describe("Экран «Рутины»", () => {
  it("ближайшие сутки: время, задание, прошлый исход и ссылка на плейбэк", async () => {
    render(await CronsPage());

    expect(screen.getByRole("heading", { name: "Рутины" })).toBeInTheDocument();
    expect(screen.getByText(/Сейчас 08:10 по Ташкенту/)).toBeVisible();

    const soon = within(screen.getByRole("region", { name: "Ближайшие 24 ч" }));
    expect(soon.getByText("Сегодня")).toBeVisible();
    expect(soon.getByText("Завтра")).toBeVisible();

    const row = soon.getAllByRole("link")[0]!;
    expect(row).toHaveTextContent("09:00");
    expect(row).toHaveTextContent("ourvend:sync");
    // Подпись прошлого прогона рядом с будущим запуском — ответ на вопрос
    // «а прошлый раз-то отработало?» без перехода в журнал.
    expect(row).toHaveTextContent("выполнено — автоматов 26/26");
    expect(row).toHaveAttribute("href", "/flows?agent=system&skill=ourvend%3Async");
  });

  it("«Все расписания»: строка задания, режим и вход в плейбэк", async () => {
    render(await CronsPage());

    const table = within(screen.getByRole("table"));
    const line = table.getByRole("row", { name: /monitor-stock/ }) as HTMLTableRowElement;
    expect(line).toHaveTextContent("0 8 * * *");
    expect(line).toHaveTextContent("ещё не запускался");
    expect(within(line).getByRole("link")).toHaveAttribute(
      "href",
      "/flows?agent=vendhub-ops&skill=monitor-stock",
    );
  });

  it("«Следующий» называет день, а не только время", async () => {
    // Голое «08:00» у недельного расписания владелец прочитает как ближайшее
    // утро, а до запуска неделя. Час без дня — обещание не о том дне.
    const weekly: CronBoard["jobs"][number] = {
      ...STOCK,
      id: "vendhub-ops/parts-audit@30 8 * * 0",
      skill: "parts-audit",
      cron: "30 8 * * 0",
      nextRun: "2026-09-13T03:30:00.000Z",
    };
    cronBoard.mockImplementation(async () => ({ ...board, jobs: [...board.jobs, weekly] }));
    render(await CronsPage());

    const soon = screen.getByRole("row", { name: /monitor-stock/ }) as HTMLTableRowElement;
    expect(soon.cells[3]).toHaveTextContent("завтра 08:00");
    const later = screen.getByRole("row", { name: /parts-audit/ }) as HTMLTableRowElement;
    expect(later.cells[3]).toHaveTextContent("13.09 08:30");
  });

  it("«Последний исход» называет время: вчерашний прогон и мартовский — разные ответы", async () => {
    // Core отдаёт `last.at`, а таблица его не печатала: «выполнено» без даты
    // читается как «работает», хотя прогон мог быть полгода назад
    // (adversarial-ревью волны R, B2).
    const stale: CronBoard["jobs"][number] = {
      ...STOCK,
      id: "vendhub-ops/parts-audit@30 8 * * 1",
      skill: "parts-audit",
      last: { at: "2026-03-02T03:00:00.000Z", outcome: "executed", skipReason: null, hook: null, reason: "узлов 375", runId: "r9" },
    };
    cronBoard.mockImplementation(async () => ({ ...board, jobs: [...board.jobs, stale] }));
    render(await CronsPage());

    const fresh = screen.getByRole("row", { name: /ourvend:sync/ }) as HTMLTableRowElement;
    expect(fresh.cells[4]).toHaveTextContent("выполнено — автоматов 26/26");
    expect(fresh.cells[4]).toHaveTextContent("сегодня 06:00");

    const old = screen.getByRole("row", { name: /parts-audit/ }) as HTMLTableRowElement;
    expect(old.cells[4]).toHaveTextContent("02.03 08:00");

    // Не запускался — времени нет и выдумывать его нечем.
    const never = screen.getByRole("row", { name: /monitor-stock/ }) as HTMLTableRowElement;
    expect(never.cells[4]).toHaveTextContent("ещё не запускался");
  });

  it("два расписания одного навыка — две строки с разными ключами", async () => {
    // Доска различает строки по `агент/навык@cron`: с общим ключом React
    // получал бы дубли, а «Ближайшие 24 ч» не находили бы своё расписание.
    const morning: CronBoard["jobs"][number] = { ...STOCK, id: "vendhub-ops/monitor-stock@0 8 * * *" };
    const evening: CronBoard["jobs"][number] = {
      ...STOCK,
      id: "vendhub-ops/monitor-stock@0 20 * * *",
      cron: "0 20 * * *",
      nextRun: "2026-09-06T15:00:00.000Z",
    };
    cronBoard.mockImplementation(async () => ({
      ...board,
      jobs: [morning, evening],
      upcoming24h: [{ at: "2026-09-06T15:00:00.000Z", jobId: "vendhub-ops/monitor-stock@0 20 * * *" }],
    }));
    render(await CronsPage());

    const rows = screen.getAllByRole("row", { name: /monitor-stock/ }) as HTMLTableRowElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cells[1]).toHaveTextContent("0 8 * * *");
    expect(rows[1]!.cells[1]).toHaveTextContent("0 20 * * *");
    // Ссылка на плейбэк по-прежнему по паре агент/навык — cron в ней не нужен.
    expect(within(rows[1]!).getByRole("link")).toHaveAttribute(
      "href",
      "/flows?agent=vendhub-ops&skill=monitor-stock",
    );
    // Строка «Ближайшие 24 ч» нашла своё расписание по тому же ключу.
    const soon = within(screen.getByRole("region", { name: "Ближайшие 24 ч" }));
    expect(soon.getAllByRole("link")).toHaveLength(1);
    expect(soon.getAllByRole("link")[0]!).toHaveTextContent("20:00");
  });

  it("снимка нет — экран говорит, что молчат агенты, а не что расписаний нет", async () => {
    cronBoard.mockImplementation(async () => ({
      ...board,
      snapshot: null,
      jobs: [],
      upcoming24h: [],
    }));
    render(await CronsPage());

    expect(screen.getByText(/Агенты ещё не отчитались о расписаниях/)).toBeVisible();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("снимок протух — чип говорит, сколько агенты молчат", async () => {
    cronBoard.mockImplementation(async () => ({
      ...board,
      snapshot: { generatedAt: "2026-09-06T02:50:00.000Z", ageSec: 1200, stale: true },
    }));
    render(await CronsPage());

    expect(screen.getByText("агенты не отчитывались 20 мин")).toBeVisible();
  });

  it("Core недоступен — экран не белый, а с деталью отказа", async () => {
    cronBoard.mockImplementation(async () => {
      throw new CoreUnavailable("connect ECONNREFUSED");
    });
    render(await CronsPage());

    expect(screen.getByText(/Нет связи с ядром MYDON/)).toBeVisible();
    expect(screen.getByText(/ECONNREFUSED/)).toBeVisible();
  });

  it("выключенное задание объясняет причину и не обещает время", async () => {
    const dead: CronBoard["jobs"][number] = {
      id: "vendhub-ops/coach",
      kind: "skill",
      agent: "vendhub-ops",
      skill: "coach",
      cron: "",
      mode: "legacy",
      enabled: false,
      disabledReason: "навык не подключён: нет кода в SKILLS и нет executor: llm",
      paused: false,
      nextRun: null,
      last: null,
    };
    cronBoard.mockImplementation(async () => ({ ...board, jobs: [...board.jobs, dead] }));
    render(await CronsPage());

    const line = screen.getByRole("row", { name: /coach/ }) as HTMLTableRowElement;
    expect(line).toHaveTextContent("навык не подключён");
    // Следующего запуска нет — прочерк, а не пустая клетка и не время соседа.
    expect(line.cells[3]).toHaveTextContent("—");
  });

  it("запусков в сутки нет и расписания на паузе — пустое состояние называет причину", async () => {
    cronBoard.mockImplementation(async () => ({
      ...board,
      paused: { schedules: true, tasks: true },
      jobs: [{ ...OURVEND, paused: true }],
      upcoming24h: [],
    }));
    render(await CronsPage());

    const soon = within(screen.getByRole("region", { name: "Ближайшие 24 ч" }));
    expect(soon.getByText(/В ближайшие сутки запусков нет/)).toBeVisible();
    expect(soon.getByText(/расписания на паузе/i)).toBeVisible();
  });
});
