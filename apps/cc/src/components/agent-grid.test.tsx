import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentStatusRow } from "../lib/core";
import { AgentGrid } from "./agent-grid";

const row = (over: Partial<AgentStatusRow> & { name: string }): AgentStatusRow => ({
  business: "vendhub",
  passportStatus: "active",
  state: "idle",
  reason: "ещё не запускался: в журнале прогонов нет ни одной записи",
  ...over,
});

/** Обычный день: кто-то работает, кто-то молчит, один выключен в карточке. */
const обычныйДень: AgentStatusRow[] = [
  row({
    name: "vendhub-ops",
    state: "working",
    reason: "выполняет задачу (навык «monitor-stock»)",
    skill: "monitor-stock",
  }),
  row({
    name: "chief-of-staff",
    reason: "последний прогон пропущен — повода нет",
    lastRun: {
      at: "2026-09-06T03:00:00.000Z",
      outcome: "skipped",
      skipReason: "no_signal",
      reason: "предлагать нечего",
    },
  }),
  row({
    name: "coach-agent",
    reason: "последний прогон пропущен — модель не ответила",
    lastRun: {
      at: "2026-09-06T03:00:00.000Z",
      outcome: "skipped",
      skipReason: "llm_failed",
      reason: "провайдер вернул 500",
    },
  }),
  row({
    name: "globerent-sales",
    state: "paused",
    passportStatus: "paused",
    reason: "агент выключен в карточке (статус paused)",
  }),
];

const безПаузы = { schedules: false, tasks: false };

describe("Сетка агентов: сводка", () => {
  it("печатает, сколько работают, молчат и стоят на паузе", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    expect(screen.getByText(/работают 1 · молчат 2 · на паузе 1/)).toBeInTheDocument();
  });

  it("затыки называет отдельно — их не прячут в «молчат»", () => {
    render(
      <AgentGrid
        rows={[row({ name: "knowledge-curator", state: "blocked", reason: "Core остановил задачу" })]}
        paused={безПаузы}
      />,
    );
    expect(screen.getByText(/в затыке 1/)).toBeInTheDocument();
  });
});

describe("Сетка агентов: системная пауза", () => {
  it("говорит отдельной строкой, что это настройка системы, а не состояние агентов", () => {
    const все = обычныйДень.map((a) => ({
      ...a,
      state: "paused" as const,
      reason: "задачи агентов на паузе (это настройка системы, а не агента)",
    }));
    const { container } = render(<AgentGrid rows={все} paused={{ schedules: false, tasks: true }} />);
    const строка = container.querySelector(".notice");
    expect(строка).not.toBeNull();
    expect(строка).toHaveTextContent(/настройка системы/i);
    expect(строка).toHaveTextContent(/AGENTS_TASKS_PAUSED/);
  });

  it("без системной паузы строки нет — иначе она перестанет что-либо значить", () => {
    const { container } = render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("пауза расписаний названа своим именем, а не общей паузой", () => {
    const { container } = render(
      <AgentGrid rows={обычныйДень} paused={{ schedules: true, tasks: false }} />,
    );
    expect(container.querySelector(".notice")).toHaveTextContent(/AGENTS_SCHEDULES_PAUSED/);
  });
});

describe("Сетка агентов: плитка", () => {
  it("несёт имя, состояние словом и причину", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    expect(screen.getByText("vendhub-ops")).toBeInTheDocument();
    expect(screen.getByText("работает")).toBeInTheDocument();
    expect(screen.getByText("выполняет задачу (навык «monitor-stock»)")).toBeInTheDocument();
  });

  it("ведёт на карточку агента", () => {
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    expect(screen.getByRole("link", { name: /vendhub-ops/ })).toHaveAttribute(
      "href",
      "/agents/vendhub-ops",
    );
  });

  it("выключенный агент НЕ рисуется классом «всё в норме»", () => {
    // Дефект витрины навыков (`skills-deck.tsx`): paused → `.led.idle`, то есть
    // зелёный. В сетке из двенадцати плиток взгляд ловит цвет, и ряд зелёных
    // ламп читается как «всё хорошо» над выключенной системой.
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    const лампа = screen.getByText("на паузе");
    expect(лампа).not.toHaveClass("idle");
    expect(лампа.closest(".agtile")).toHaveAttribute("data-state", "paused");
  });

  it("молчание из-за поломки весит больше, чем «повода нет»", () => {
    // Ревью задачи 1: «модель не ответила» — это не спокойное молчание.
    // Причина из Core уже называет поломку, но вес на экране обязан отличаться.
    render(<AgentGrid rows={обычныйДень} paused={безПаузы} />);
    const поломка = screen.getByText("последний прогон пропущен — модель не ответила");
    const спокойно = screen.getByText("последний прогон пропущен — повода нет");
    expect(поломка.closest(".agtile")).toHaveAttribute("data-attention", "true");
    expect(спокойно.closest(".agtile")).not.toHaveAttribute("data-attention");
  });

  it("работающему агенту прошлый сбой полосы не рисует — у него своё состояние", () => {
    // Полоса «поломки» объясняется словами причины, а причина работающего
    // агента говорит про текущую задачу. Полоса без объяснения — шум.
    render(
      <AgentGrid
        rows={[
          row({
            name: "vendhub-ops",
            state: "working",
            reason: "выполняет задачу (навык «monitor-stock»)",
            lastRun: {
              at: "2026-09-06T03:00:00.000Z",
              outcome: "failed",
              skipReason: null,
              reason: "провайдер вернул 500",
            },
          }),
        ]}
        paused={безПаузы}
      />,
    );
    expect(screen.getByText("работает").closest(".agtile")).not.toHaveAttribute("data-attention");
  });
});

describe("Сетка агентов: пусто", () => {
  it("пустой список говорит, что делать, а не молчит", () => {
    const { container } = render(<AgentGrid rows={[]} paused={безПаузы} />);
    expect(container.querySelector(".empty")).toHaveTextContent(/не назвал ни одного агента/i);
  });
});
