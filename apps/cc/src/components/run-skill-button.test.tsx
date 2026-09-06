import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunSkillButton } from "./run-skill-button";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), runSkill: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));

// Действие запуска — то же, что у витрины навыков: второго пути запуска нет.
vi.mock("../app/skills/actions", () => ({ runSkill: mocks.runSkill }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Кнопка «Запустить» в карточке агента", () => {
  it("ставит задачу тем же действием, что и витрина навыков, и даёт ссылку на неё", async () => {
    mocks.runSkill.mockResolvedValue({ ok: true, taskId: "t-7", goTo: "/tasks/t-7" });
    const user = userEvent.setup();
    render(<RunSkillButton agent="vendhub-ops" skill="monitor-stock" />);

    await user.click(screen.getByRole("button", { name: "Запустить" }));

    expect(mocks.runSkill).toHaveBeenCalledTimes(1);
    expect(mocks.runSkill.mock.calls[0]?.[0]).toBe("vendhub-ops");
    expect(mocks.runSkill.mock.calls[0]?.[1]).toBe("monitor-stock");
    expect(await screen.findByRole("link", { name: "задача поставлена" })).toHaveAttribute(
      "href",
      "/tasks/t-7",
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("отказ Core показывается его словами, а не «не получилось»", async () => {
    mocks.runSkill.mockResolvedValue({ ok: false, error: "Агент выключен" });
    const user = userEvent.setup();
    render(<RunSkillButton agent="vendhub-ops" skill="monitor-stock" />);

    await user.click(screen.getByRole("button", { name: "Запустить" }));

    expect(await screen.findByText("Агент выключен")).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("нечего запускать — кнопка недоступна и объясняет, почему", async () => {
    const user = userEvent.setup();
    render(
      <RunSkillButton
        agent="vendhub-ops"
        skill="monitor-stock"
        disabledReason="Включи агента в его карточке"
      />,
    );

    const btn = screen.getByRole("button", { name: "Запустить" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Включи агента в его карточке");
    await user.click(btn);
    expect(mocks.runSkill).not.toHaveBeenCalled();
  });
});
