/**
 * Окружение MCP-сервера и CLI (R-A1-1).
 *
 * Токены живут ТОЛЬКО в переменных окружения: `.mcp.json` называет их по
 * имени, значений не хранит. Ни одна ошибка этого модуля не печатает значений —
 * ни токена, ни адреса: текст ошибки уходит в лог и в окно модели.
 */

/** Core слушает петлевой адрес; с MacBook — тот же порт через SSH-туннель. */
export const DEFAULT_CORE_URL = "http://127.0.0.1:3001";

export interface CoreEnv {
  baseUrl: string;
  serviceToken: string;
  /** Owner-действия (решение по согласованию, смена автономии, личный контур). */
  ownerToken?: string;
}

/** Пустая строка и пробелы — то же самое, что «не задано». */
function value(raw: string | undefined): string {
  return (raw ?? "").trim();
}

/**
 * Хвостовая косая в `CORE_API_URL` превратила бы каждый путь в `//tasks`:
 * Nest такой маршрут не знает и отвечает 404 — ошибка выглядела бы как
 * «в Core нет задач», а не как опечатка в переменной.
 */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadEnv(env: Record<string, string | undefined> = process.env): CoreEnv {
  const serviceToken = value(env.SERVICE_TOKEN);
  if (!serviceToken) {
    // Падаем на старте, а не на первом 401: «Core не принял токен» посреди
    // работы владелец читает как поломку Core, а не как незаданную переменную.
    throw new Error(
      "Не задан SERVICE_TOKEN — Core не примет ни одного запроса. " +
        "Задайте переменную окружения SERVICE_TOKEN (тем же значением, что у панели и бота).",
    );
  }
  const baseUrl = normalizeBaseUrl(value(env.CORE_API_URL) || DEFAULT_CORE_URL);
  const ownerToken = value(env.OWNER_ACTION_TOKEN);
  return { baseUrl, serviceToken, ...(ownerToken ? { ownerToken } : {}) };
}
