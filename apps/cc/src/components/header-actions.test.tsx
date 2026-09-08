import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ВЕТКИ, палитраБлока, последнееПравило, стилиПанели } from "../test/css";
import { HeaderActions } from "./header-actions";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setTheme: vi.fn<(choice: string) => Promise<{ ok: boolean; message?: string }>>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../app/theme/actions", () => ({ setTheme: mocks.setTheme }));

/** `<select>` без multiple — роль combobox; имя — из aria-label. */
const themeSwitch = (): HTMLSelectElement => screen.getByRole<HTMLSelectElement>("combobox", { name: "Тема" });

describe("переключатель темы в шапке (Р-Д2-6)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("три состояния словами; текущее — из пропса layout, а не из data-theme", () => {
    // На /apps без куки <html data-theme="dark">, а выбор — «как в системе»:
    // контрол обязан показать ВЫБОР, не фактическую тему.
    document.documentElement.dataset.theme = "dark";
    render(<HeaderActions pendingCount={0} themeChoice="system" />);
    const sw = themeSwitch();
    expect(sw).toHaveValue("system");
    expect([...sw.options].map((o) => o.textContent)).toEqual(["как в системе", "светлая", "тёмная"]);
    delete document.documentElement.dataset.theme;
  });

  it("выбор «светлая» зовёт setTheme('light') и обновляет страницу; mydon_bg не трогает", async () => {
    mocks.setTheme.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<HeaderActions pendingCount={0} themeChoice="system" />);

    await user.selectOptions(themeSwitch(), "light");

    expect(mocks.setTheme).toHaveBeenCalledWith("light");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(themeSwitch()).toHaveValue("light");
    expect(screen.queryByRole("button", { name: /повторить/ })).toBeNull();
    // Фон остаётся своим тумблером с localStorage `mydon_bg` — тема туда не пишет.
    expect(localStorage.getItem("mydon_bg")).toBeNull();
  });

  it("отказ action: ошибка показана, выбор не потерян, страница не обновляется; «повторить» зовёт action снова", async () => {
    mocks.setTheme.mockResolvedValue({ ok: false, message: "Тема не сохранилась" });
    const user = userEvent.setup();
    render(<HeaderActions pendingCount={0} themeChoice="system" />);

    await user.selectOptions(themeSwitch(), "dark");

    const retry = await screen.findByRole("button", { name: "Тема не сохранилась · повторить" });
    expect(retry).toBeVisible();
    expect(themeSwitch()).toHaveValue("dark");
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.setTheme.mockResolvedValue({ ok: true });
    await user.click(retry);

    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /повторить/ })).toBeNull();
  });

  it("сервер побеждает: новый пропс после refresh переставляет контрол", () => {
    // Инициализатор useState выполняется один раз (ловушка App Router):
    // без синхронизации с пропсом кука, изменённая в другой вкладке, не
    // отразилась бы здесь никогда.
    const { rerender } = render(<HeaderActions pendingCount={0} themeChoice="system" />);
    rerender(<HeaderActions pendingCount={0} themeChoice="light" />);
    expect(themeSwitch()).toHaveValue("light");
  });
});

describe("переключатель читается в обеих темах (сторож globals.css)", () => {
  it("правило .hdr .theme-sw есть и красит контрол только токенами, объявленными во всех трёх ветках", () => {
    const rule = последнееПравило(стилиПанели, ".hdr .theme-sw");
    expect(rule, "в globals.css нет правила .hdr .theme-sw").not.toBeNull();
    const body = rule?.тело ?? "";
    // Ни одного литерала цвета: только так тема не «протекает» (чек-лист навыка).
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    const used = [...body.matchAll(/var\((--[a-z0-9-]+)\)/gi)].map((m) => m[1] ?? "");
    expect(used).toEqual(expect.arrayContaining(["--surf", "--tx-2", "--line"]));
    for (const ветка of ВЕТКИ) {
      const палитра = палитраБлока(стилиПанели, ветка);
      for (const token of ["--surf", "--tx-2", "--line"]) {
        expect(палитра.get(token), `${token} не объявлен в блоке «${ветка.имя}»`).toBeDefined();
      }
    }
  });

  it("стрелка родного select убрана — иначе контрол не влезает в шапку 390px", () => {
    expect(последнееПравило(стилиПанели, ".hdr .theme-sw")?.тело).toMatch(/appearance\s*:\s*none/);
  });
});

describe("корневой layout передаёт выбор темы из куки", () => {
  // Сторожим сам файл: рендер RootLayout в jsdom тянет next/font/local и Core.
  const layout = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app/layout.tsx"),
    "utf8",
  ).replace(/\s+/g, " ");

  it("выбор читается из cookies().get(THEME_COOKIE), а не из заголовка, и уходит в HeaderActions пропсом", () => {
    expect(layout).toContain("(await cookies()).get(THEME_COOKIE)?.value");
    expect(layout).toContain("<HeaderActions pendingCount={inbox} themeChoice={themeChoice} />");
  });
});
