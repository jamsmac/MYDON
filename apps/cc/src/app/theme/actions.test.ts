import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeChoice } from "../../lib/theme";
import { setTheme } from "./actions";

/*
 * `next/headers` вне request-скоупа не работает — глушим фабрикой, как
 * `lib/owner.test.ts`; `next/cache` — как `tasks/actions.test.ts`. Через
 * `mocks.set`/`mocks.delete` видно, ЧТО action попросил у хранилища куки.
 */
const mocks = vi.hoisted(() => ({
  set: vi.fn<(name: string, value: string, attrs: Record<string, unknown>) => void>(),
  delete: vi.fn<(options: { name: string; path: string }) => void>(),
  revalidatePath: vi.fn<(path: string, type: "layout" | "page") => void>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.set, delete: mocks.delete }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

/** Атрибуты куки — ровно те, что требует спека Д2 §1.2: Path=/, SameSite=Lax, год. */
const COOKIE_ATTRS = { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 };

describe("setTheme — кука выбора темы (Р-Д2-2, Р-Д2-6)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("«тёмная» пишет mydon_theme=dark с Path=/, SameSite=Lax на год и перерисовывает корневой layout", async () => {
    await expect(setTheme("dark")).resolves.toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith("mydon_theme", "dark", COOKIE_ATTRS);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("«светлая» пишет mydon_theme=light с теми же атрибутами", async () => {
    await expect(setTheme("light")).resolves.toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledWith("mydon_theme", "light", COOKIE_ATTRS);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("«как в системе» удаляет куку по тому же Path и ничего не пишет", async () => {
    await expect(setTheme("system")).resolves.toEqual({ ok: true });
    expect(mocks.delete).toHaveBeenCalledWith({ name: "mydon_theme", path: "/" });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("кука не httpOnly и не secure: её читает ThemeSync из document.cookie, а панель живёт по http", async () => {
    await setTheme("dark");
    const attrs = mocks.set.mock.calls[0]?.[2];
    expect(attrs).toBeDefined();
    expect(attrs).not.toHaveProperty("httpOnly");
    expect(attrs).not.toHaveProperty("secure");
  });

  it("чужое значение отбивается словами: куку не трогает, layout не перерисовывает", async () => {
    // Тип не защищает: server action — публичная точка входа, с клиента
    // может прийти любая строка.
    await expect(setTheme("blue" as unknown as ThemeChoice)).resolves.toEqual({
      ok: false,
      message: "Неизвестная тема",
    });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("сбой хранилища куки → ok:false с текстом причины, без перерисовки", async () => {
    mocks.set.mockImplementation(() => {
      throw new Error("cookies() вне запроса");
    });
    await expect(setTheme("light")).resolves.toEqual({ ok: false, message: "cookies() вне запроса" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
