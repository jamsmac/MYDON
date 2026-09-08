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

    const retry = await screen.findByRole("button", { name: "повторить · Тема не сохранилась" });
    expect(retry).toBeVisible();
    // ГЛАГОЛ ПЕРВЫМ: кнопку режет многоточие (`max-width: 180px`), и в прежнем
    // порядке «<сообщение> · повторить» на 390px глаголу оставалось ~46px из
    // нужных ~212px — владелец видел «Тема н…» вместо действия.
    expect(retry.textContent ?? "", "сообщение вперёд глагола — многоточие съест действие").toMatch(
      /^повторить/,
    );
    expect(themeSwitch()).toHaveValue("dark");
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.setTheme.mockResolvedValue({ ok: true });
    await user.click(retry);

    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark");
    await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /повторить/ })).toBeNull();
  });

  it("пока сохраняется — переключатель заперт: второй выбор не уходит в action", async () => {
    // `disabled={pending}` заявлен кодом, но не был пришпилен: снятие атрибута
    // оставляло набор зелёным. Косметика (двойной клик по списку во время
    // сохранения), поэтому один ассерт, а не сценарий.
    let отпустить: (() => void) | undefined;
    mocks.setTheme.mockImplementation(
      () =>
        new Promise((resolve) => {
          отпустить = () => resolve({ ok: true });
        }),
    );
    const user = userEvent.setup();
    render(<HeaderActions pendingCount={0} themeChoice="system" />);

    await user.selectOptions(themeSwitch(), "dark");
    await vi.waitFor(() => expect(themeSwitch()).toBeDisabled());

    отпустить?.();
    await vi.waitFor(() => expect(themeSwitch()).toBeEnabled());
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

  it("кнопку «повторить» режет многоточие, а не перенос строки", () => {
    /*
     * §4.1 навыка требует арифметику узкой колонки: ширина кнопки заперта
     * (`max-width: 180px`), а «Не удалось сохранить тему · повторить» ≈212px —
     * что-то обязано уйти в многоточие. Уходит ПРИЧИНА, потому что глагол в
     * разметке первый (проверено выше по доступному имени); здесь CSS-половина:
     * без `nowrap` кнопка переносилась бы и ломала шапку 54px, без `ellipsis`
     * текст обрывался бы без знака обрезки.
     */
    const тело = последнееПравило(стилиПанели, ".hdr .theme-retry")?.тело ?? "";
    expect(тело, "в globals.css нет правила .hdr .theme-retry").not.toBe("");
    expect(тело, "ширина кнопки не заперта — сообщение растянет шапку").toMatch(/max-width\s*:\s*\d+px/);
    expect(тело, "нет ellipsis — текст обрежется без знака обрезки").toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(тело, "нет nowrap — кнопка перенесётся и сломает шапку").toMatch(/white-space\s*:\s*nowrap/);
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
