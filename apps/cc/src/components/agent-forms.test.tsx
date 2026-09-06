import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentCard } from "../lib/core";
import { AgentEditor } from "./agent-editor";
import { NewAgentForm } from "./agent-new";

const mocks = vi.hoisted(() => ({
  createAgent: vi.fn(),
  deleteAgent: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  saveAgent: vi.fn(),
  setAgentAutonomy: vi.fn(),
  toggleAgent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("../app/agents/actions", () => ({
  createAgent: mocks.createAgent,
  deleteAgent: mocks.deleteAgent,
  saveAgent: mocks.saveAgent,
  setAgentAutonomy: mocks.setAgentAutonomy,
  toggleAgent: mocks.toggleAgent,
}));

const agent: AgentCard = {
  id: "agent-1",
  name: "finance",
  business: "shared",
  status: "paused",
  autonomyDefault: "T1",
  description: "Финансовый контроль",
  mission: "Следить за платежами",
  nonGoals: ["Не платит сам"],
  skills: ["watch-money"],
  schedule: [{ cron: "0 9 * * *", skill: "watch-money" }],
  budgetPerDayUsd: "3",
  budgetOnExceeded: "ask",
  ideaChannels: [],
  webSources: [],
  breakGlass: [],
  kbPages: ["shared/kb/globerent/heli-models.md"],
  archivedAt: null,
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("формы агентов", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("передаёт конфигурацию нового агента и не очищает её при ошибке", async () => {
    mocks.createAgent.mockResolvedValue({ ok: false, error: "Имя уже занято" });
    const user = userEvent.setup();
    render(<NewAgentForm />);

    await user.click(screen.getByRole("button", { name: "+ Новый агент" }));
    const name = screen.getByLabelText(/Имя \(машинное\)/);
    await user.type(name, "stock-watch");
    await user.selectOptions(screen.getByLabelText("Направление"), "vendhub");
    await user.type(screen.getByLabelText("Короткое описание"), "Контроль остатков");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Имя уже занято")).toBeVisible();
    const form = mocks.createAgent.mock.calls[0]?.[0] as FormData;
    expect(form.get("name")).toBe("stock-watch");
    expect(form.get("business")).toBe("vendhub");
    expect(name).toHaveValue("stock-watch");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("сохраняет отредактированную конфигурацию при отказе API", async () => {
    mocks.saveAgent.mockResolvedValue({ ok: false, error: "Некорректный cron" });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    const mission = screen.getByLabelText("Зачем нужен (миссия)");
    await user.clear(mission);
    await user.type(mission, "Сверять деньги каждый день");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Некорректный cron")).toBeVisible();
    const form = mocks.saveAgent.mock.calls[0]?.[1] as FormData;
    expect(form.get("mission")).toBe("Сверять деньги каждый день");
    expect(mission).toHaveValue("Сверять деньги каждый день");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("страницы знаний (kbPages) редактируются и уходят в сохранение по одной на строку", async () => {
    mocks.saveAgent.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    const kb = screen.getByLabelText(/Страницы знаний \(KB\)/);
    expect(kb).toHaveValue("shared/kb/globerent/heli-models.md");
    await user.type(kb, "{enter}shared/kb/globerent/pricelist.md");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Сохранено")).toBeVisible();
    const form = mocks.saveAgent.mock.calls[0]?.[1] as FormData;
    expect(form.get("kbPages")).toBe("shared/kb/globerent/heli-models.md\nshared/kb/globerent/pricelist.md");
  });

  it("показывает ошибку включения агента", async () => {
    mocks.toggleAgent.mockResolvedValue({ ok: false, error: "Расписания на паузе" });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    await user.click(screen.getByRole("button", { name: "Включить" }));

    expect(await screen.findByText("Расписания на паузе")).toBeVisible();
    expect(mocks.toggleAgent).toHaveBeenCalledWith("finance", true);
  });

  it("удаляет агента только после второго подтверждающего действия", async () => {
    mocks.deleteAgent.mockResolvedValue({ ok: true, goTo: "/agents" });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    await user.click(screen.getByRole("button", { name: "Удалить агента" }));
    expect(mocks.deleteAgent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Да, удалить" }));

    expect(mocks.deleteAgent).toHaveBeenCalledWith("finance");
    expect(mocks.push).toHaveBeenCalledWith("/agents");
  });
});

/**
 * Дефект Р-7: селект слал тир общим PATCH карточки, Core его сознательно
 * отбрасывает (`agents.controller.ts`, `@Patch(":name")`), а панель писала
 * «Сохранено». Экран врал о самом чувствительном поле карточки.
 */
describe("Самостоятельность агента", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("селект зовёт действие автономии, а не общее сохранение карточки", async () => {
    mocks.setAgentAutonomy.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    await user.selectOptions(screen.getByLabelText(/Самостоятельность/), "T3");

    expect(mocks.setAgentAutonomy).toHaveBeenCalledWith("finance", "T3");
    expect(mocks.saveAgent).not.toHaveBeenCalled();
    expect(await screen.findByText("Самостоятельность изменена")).toBeVisible();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("общее сохранение карточки тир вообще не отправляет", async () => {
    mocks.saveAgent.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const form = mocks.saveAgent.mock.calls[0]?.[1] as FormData;
    // Поле в форме = обещание, которого Core не исполняет: его там быть не должно.
    expect(form.get("autonomyDefault")).toBeNull();
  });

  it("отказ Core возвращает селект к прежнему тиру — экран не обещает лишнего", async () => {
    mocks.setAgentAutonomy.mockResolvedValue({ ok: false, error: "нужен OWNER_ACTION_TOKEN" });
    const user = userEvent.setup();
    render(<AgentEditor agent={agent} autonomyMax="T0" />);

    const select = screen.getByLabelText(/Самостоятельность/);
    await user.selectOptions(select, "T3");

    expect(await screen.findByText("нужен OWNER_ACTION_TOKEN")).toBeVisible();
    expect(select).toHaveValue("T1");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("подсказка печатает ДЕЙСТВУЮЩИЙ порог системы, а не захардкоженный T0", async () => {
    render(<AgentEditor agent={agent} autonomyMax="T2" />);

    expect(screen.getByText(/Общий порог системы сейчас T2/)).toBeVisible();
    expect(screen.queryByText(/порог системы сейчас T0/)).toBeNull();
  });

  it("порог не прочитался — подсказка говорит это, а не называет число наугад", async () => {
    render(<AgentEditor agent={agent} autonomyMax={null} />);

    expect(screen.getByText(/порог системы прочитать не удалось/i)).toBeVisible();
  });
});
