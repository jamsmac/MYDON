"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, type ThemeChoice } from "../../lib/theme";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Срок куки темы — год (спека Д2 §1.2). Секундами, потому что `maxAge` у
 * `cookies().set` в секундах; `expires` не задаём — при обоих полях браузер
 * берёт `maxAge`, второе значение только вводило бы в заблуждение.
 * НЕ экспортировать: из файла с "use server" наружу уходят только async-функции.
 */
const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Значения, которые action вообще готов принять; всё остальное — чужой ввод. */
const ALLOWED: ReadonlySet<string> = new Set(["light", "dark", "system"]);

/**
 * Запомнить выбор темы. `light`/`dark` — кука `mydon_theme` на год; `system` —
 * куки нет вовсе: «как в системе» = отсутствие явного выбора, и хранить его
 * отдельным значением значило бы завести третье состояние, которого
 * `themeFor` в middleware не знает.
 *
 * Кука НЕ httpOnly и НЕ secure намеренно: её читает клиентский `ThemeSync`
 * через `document.cookie` при SPA-переходе, а панель живёт по http за
 * Tailscale — `Secure` отрезал бы куку целиком.
 *
 * Server action — публичная точка входа: значение приходит с клиента и может
 * быть любым, тип `ThemeChoice | "system"` этого не гарантирует. Чужое
 * значение отбиваем ДО записи, иначе в куке оказалась бы строка, которую
 * `themeFor` считает «нет куки», а переключатель — «выбрано».
 */
export async function setTheme(choice: ThemeChoice | "system"): Promise<ActionResult> {
  if (!ALLOWED.has(choice)) {
    return { ok: false, message: "Неизвестная тема" };
  }
  try {
    const store = await cookies();
    if (choice === "system") {
      // Path тот же, что при записи: браузер сопоставляет куки по паре
      // имя+путь, и удаление без пути могло бы не найти куку с `Path=/`.
      store.delete({ name: THEME_COOKIE, path: "/" });
    } else {
      store.set(THEME_COOKIE, choice, { path: "/", sameSite: "lax", maxAge: YEAR_SECONDS });
    }
    // Корневой layout ставит `data-theme` на <html> из заголовка middleware —
    // перерисовать нужно именно его, а не страницу.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Не удалось сохранить тему" };
  }
}
