import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ВТОРАЯ ПОЛОВИНА ЗАКРЫТИЯ ВЛОЖЕНИЙ (срез A3, ловушка спеки §6 п. 3).
 *
 * `AttachmentsController` в Core закрыт классовым `ReadTokenGuard`: без
 * заголовка `GET /attachments/:id/raw` отвечает 401. Байты вложения попадают в
 * браузер владельца ровно одним путём — через этот прокси, — поэтому «дверь
 * закрыта» и «фото на карточке ещё видно» обязаны проверяться ОДНОЙ парой
 * ассертов, а не двумя тестами в разных приложениях: закрытие Core без токена
 * в прокси сломало бы полевой контур молча, отдав в `<img>` текст ошибки.
 *
 * Соседний `route.test.ts` глушит `lib/core` и проверяет заголовки ОТДАЧИ; здесь
 * `lib/core` НАСТОЯЩИЙ, а подменён только `fetch` — предмет проверки в том, что
 * запрос, который прокси делает в Core, несёт токен, и что файл при этом
 * доезжает до браузера.
 */

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Перехват fetch: копим адреса и заголовки, отвечаем картинкой. */
function стубCore(): { url: string; headers: Record<string, string> }[] {
  const вызовы: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      вызовы.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
      return {
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("байты").buffer,
        headers: { get: () => "image/jpeg" },
      } as unknown as Response;
    }),
  );
  return вызовы;
}

/** Токен читается на импорте `lib/core` — модули грузим заново после stubEnv. */
async function прокси(): Promise<(req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>> {
  vi.stubEnv("SERVICE_TOKEN", "secret-token");
  vi.resetModules();
  const { GET } = await import("./route");
  return GET;
}

describe("Прокси вложения носит сервисный токен, и файл доезжает (A3, §6 п. 3)", () => {
  it("запрос в Core несёт x-service-token — маршрут закрыт ReadTokenGuard", async () => {
    const вызовы = стубCore();
    const GET = await прокси();
    await GET(new Request("http://cc.local"), { params: Promise.resolve({ id: ID }) });
    expect(вызовы).toHaveLength(1);
    expect(вызовы[0]?.url).toContain(`/attachments/${ID}/raw`);
    expect(
      вызовы[0]?.headers["x-service-token"],
      "прокси без токена = 401 из Core и пустая галерея на карточке",
    ).toBe("secret-token");
  });

  it("полевой контур цел: картинка отдаётся 200 и байтами, а не текстом ошибки", async () => {
    стубCore();
    const GET = await прокси();
    const res = await GET(new Request("http://cc.local"), { params: Promise.resolve({ id: ID }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    // Картинка из белого списка идёт inline: `<img>` на карточке её покажет.
    expect(res.headers.get("Content-Disposition")).toBeNull();
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("байты");
  });
});
