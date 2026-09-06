import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PauseToggles } from "./pause-toggles";

const mocks = vi.hoisted(() => ({
  saveSystemConfig: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../app/system/actions", () => ({ saveSystemConfig: mocks.saveSystemConfig }));

beforeEach(() => {
  // Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
  // заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с отказом
  // падает «необработанным» отказом при зелёном теле.
  mocks.saveSystemConfig.mockImplementation(async () => ({ ok: true }));
});

describe("тумблеры паузы агентов", () => {
  it("снимает расписания с паузы: было «1» — пишет «0»", async () => {
    const user = userEvent.setup();
    render(<PauseToggles schedules tasks={false} />);

    const toggle = screen.getByRole("switch", { name: /Расписания/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(mocks.saveSystemConfig).toHaveBeenCalledWith("AGENTS_SCHEDULES_PAUSED", "0");
    expect(await screen.findByRole("switch", { name: /Расписания/ })).toHaveAttribute("aria-checked", "false");
  });

  it("ставит назначенные задачи на паузу: было «0» — пишет «1»", async () => {
    const user = userEvent.setup();
    render(<PauseToggles schedules={false} tasks={false} />);

    await user.click(screen.getByRole("switch", { name: /Назначенные задачи/ }));
    expect(mocks.saveSystemConfig).toHaveBeenCalledWith("AGENTS_TASKS_PAUSED", "1");
  });

  it("после успеха обещает не мгновение, а десять минут", async () => {
    // Агенты перечитывают настройки по своему циклу: «Сохранено» без срока
    // владелец прочитал бы как «уже выключено» и пошёл бы искать поломку,
    // увидев следующий запуск по расписанию.
    const user = userEvent.setup();
    render(<PauseToggles schedules={false} tasks={false} />);

    await user.click(screen.getByRole("switch", { name: /Расписания/ }));
    expect(await screen.findByText(/применится в течение 10 минут/)).toBeVisible();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("отказ Core показывает причину и НЕ переключает тумблер", async () => {
    mocks.saveSystemConfig.mockImplementation(async () => ({ ok: false, error: "HTTP 401 на /system/config" }));
    const user = userEvent.setup();
    render(<PauseToggles schedules tasks={false} />);

    await user.click(screen.getByRole("switch", { name: /Расписания/ }));
    expect(await screen.findByText("HTTP 401 на /system/config")).toBeVisible();
    // Соврать про снятую паузу опаснее, чем не снять её: владелец ушёл бы,
    // считая расписания включёнными.
    expect(screen.getByRole("switch", { name: /Расписания/ })).toHaveAttribute("aria-checked", "true");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("подпись под тумблером — та же, что в «Системе»", () => {
    render(<PauseToggles schedules tasks={false} />);
    expect(screen.getByText(/запуски по cron выключены/)).toBeVisible();
    expect(screen.getByText(/прекращает новые claims задач/)).toBeVisible();
  });
});
