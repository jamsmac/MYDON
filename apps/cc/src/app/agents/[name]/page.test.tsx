import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentCard } from "../../../lib/core";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const agentCard = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/core", () => ({
  core: { agent: agentCard, audit },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));
// Редактор карточки — клиентский и со своими формами; здесь проверяются хуки.
vi.mock("../../../components/agent-editor", () => ({
  AgentEditor: () => <div>Настройки агента</div>,
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

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с отказом
 * падает «необработанным» отказом при зелёном теле.
 */
beforeEach(() => {
  agentCard.mockImplementation(async () => card());
  audit.mockImplementation(async () => []);
});

const screenFor = () => AgentPage({ params: Promise.resolve({ name: "vendhub-ops" }) });

describe("Карточка агента: хуки прогона", () => {
  it("показывает хук, его параметры и фазу", async () => {
    agentCard.mockImplementation(async () =>
      card({ preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }], postRun: [{ kind: "coach_lite" }] }),
    );
    render(await screenFor());

    expect(screen.getByText("Хуки прогона")).toBeVisible();
    expect(screen.getByText("quiet_hours")).toBeVisible();
    expect(screen.getByText("from: 22:00 · to: 07:00")).toBeVisible();
    expect(screen.getByText("до прогона")).toBeVisible();
    expect(screen.getByText("coach_lite")).toBeVisible();
    expect(screen.getByText("без параметров")).toBeVisible();
    // Известные хуки ничего не блокируют — тревожной метки быть не должно.
    expect(screen.queryByText(/блокирует запуск/)).toBeNull();
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

    expect(screen.getByText("Хуки прогона")).toBeVisible();
    expect(screen.getByText("source_fresh")).toBeVisible();
    expect(screen.getByText("run: system/ourvend:sync · max_age_hours: 6")).toBeVisible();
    expect(screen.getByText("до прогона")).toBeVisible();
    expect(screen.getByText("coach_lite")).toBeVisible();
    expect(screen.queryByText(/блокирует запуск/)).toBeNull();
  });

  it("неизвестный pre_run назван по имени из паспорта и помечен как блокирующий", async () => {
    // Рантайм фейлится закрыто: навык с таким хуком не запускается ВООБЩЕ
    // (Р-4). Без метки владелец ищет причину молчания агента в cron.
    agentCard.mockImplementation(async () =>
      card({ preRun: [{ kind: "unknown", raw: "telepathy" }], postRun: [] }),
    );
    render(await screenFor());

    expect(screen.getByText("telepathy")).toBeVisible();
    expect(screen.getByText("блокирует запуск: неизвестный kind")).toBeVisible();
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
    expect(screen.getByText("Настройки агента")).toBeVisible();
    expect(screen.queryByText("Хуки прогона")).toBeNull();
  });

  it("хуков нет — блока нет", async () => {
    render(await screenFor());
    expect(screen.getByRole("heading", { name: "vendhub-ops" })).toBeVisible();
    expect(screen.queryByText("Хуки прогона")).toBeNull();
  });
});
