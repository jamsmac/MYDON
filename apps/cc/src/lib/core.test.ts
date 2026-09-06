import { MAX_FIND_LIMIT } from "@mydon/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
// Клиент Core первой строкой импортирует пакет `server-only`, которого вне RSC
// не существует. Обычно тесты панели глушат сам клиент (vi.mock("../lib/core")),
// но здесь предмет теста — ИМЕННО клиент: пакет подменён заглушкой алиасом
// `server-only` → src/test/server-only.ts в vitest.config.mts.
import { core } from "./core";

/** Перехват fetch: возвращаем пустой успешный ответ, копим запрошенные URL. */
function stubFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      urls.push(String(url));
      return { ok: true, json: async () => [] } as unknown as Response;
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Регресс аудита 31.08 (п. 6): реестр GLOBERENT — 988 строк и 704 счёта, а на
 * умолчании Core (limit=500) панель молча показывала 500 «всех» записей и 459
 * счетов — усечение без признака усечения читалось как полный реестр. Панель
 * ходит в Core через entitiesOf/entitiesOfType — откат явного limit здесь
 * обязан ронять тест, а не только комментарий.
 */
describe("Реестр направления: клиент просит потолок Core, а не умолчание в 500", () => {
  it("entitiesOf шлёт limit=MAX_FIND_LIMIT", async () => {
    const urls = stubFetch();
    await core.entitiesOf("globerent");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/entities?domain=globerent&limit=${MAX_FIND_LIMIT}`);
  });

  it("entitiesOfType шлёт limit=MAX_FIND_LIMIT", async () => {
    const urls = stubFetch();
    await core.entitiesOfType("globerent", "invoice");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/entities?domain=globerent&type=invoice&limit=${MAX_FIND_LIMIT}`);
  });

  it("contractorsAll шлёт limit=MAX_FIND_LIMIT (тот же класс усечения)", async () => {
    const urls = stubFetch();
    await core.contractorsAll();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/entities?type=contractor&limit=${MAX_FIND_LIMIT}`);
  });

  it("потолок вмещает текущий реестр GLOBERENT целиком", () => {
    // 988 registry-строк на проде — сверено read-only при аудите.
    expect(MAX_FIND_LIMIT).toBeGreaterThanOrEqual(988);
  });
});

/** Перехват fetch с методом: для маршрутов, где важен не только адрес. */
function stubCalls(): { url: string; method: string; body: unknown }[] {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }),
  );
  return calls;
}

/**
 * Дефект Р-7 (волна A2): автономию агента меняет ТОЛЬКО отдельный маршрут.
 * Общий `PATCH /agents/:name` поле `autonomyDefault` сознательно отбрасывает
 * (`agents.controller.ts`), поэтому панель, слав его туда, писала «Сохранено»
 * над неизменённым тиром.
 */
describe("Автономия агента: отдельный маршрут, а не общий patch карточки", () => {
  it("setAgentAutonomy шлёт PATCH /agents/:name/autonomy", async () => {
    const calls = stubCalls();
    await core.setAgentAutonomy("vendhub-ops", "T2");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/agents/vendhub-ops/autonomy");
    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[0]?.body).toEqual({ autonomyDefault: "T2", actor: "owner" });
  });

  it("память агента спрашивается префиксом типа — перебором навыков её не собрать", async () => {
    const calls = stubCalls();
    await core.agentMemory("vendhub-ops");
    expect(calls[0]?.url).toContain("source=agent%3Avendhub-ops");
    expect(calls[0]?.url).toContain("typePrefix=agent.memory%3A");
  });
});

/**
 * Круг починок, C-1: `GET /agents/status` и `GET /apps/health` печатают наружу
 * `agent_run.reason` — то же поле, ради которого волна R закрыла журнал
 * прогонов гардом. Оба маршрута закрыты `ReadTokenGuard`, и панель обязана
 * нести токен: без него она получила бы 401 вместо сетки агентов и здоровья.
 */
describe("Состояние агентов и здоровье приложений читаются С ТОКЕНОМ (C-1)", () => {
  /** Токен читается на импорте модуля — поэтому клиент грузим заново. */
  async function сТокеном(): Promise<typeof core> {
    vi.stubEnv("SERVICE_TOKEN", "secret-token");
    vi.resetModules();
    return (await import("./core")).core;
  }

  /** Перехват fetch с заголовками запроса. */
  function stubHeaders(): Record<string, string>[] {
    const headers: Record<string, string>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        headers.push((init?.headers as Record<string, string>) ?? {});
        return { ok: true, json: async () => ({ agents: [], outside: [], internal: [] }) } as unknown as Response;
      }),
    );
    return headers;
  }

  it("agentsStatus несёт x-service-token", async () => {
    const заголовки = stubHeaders();
    await (await сТокеном()).agentsStatus();
    expect(заголовки[0]?.["x-service-token"]).toBe("secret-token");
  });

  it("skillDeck несёт x-service-token", async () => {
    // Дека отдаёт `blockedReason`/`resultNote` прогонов, поэтому маршрут закрыт
    // тем же гардом. Возврат на обычный `get()` даст здесь `undefined`.
    const заголовки = stubHeaders();
    await (await сТокеном()).skillDeck();
    expect(заголовки[0]?.["x-service-token"]).toBe("secret-token");
  });

  it("appsHealth несёт x-service-token", async () => {
    const заголовки = stubHeaders();
    await (await сТокеном()).appsHealth();
    expect(заголовки[0]?.["x-service-token"]).toBe("secret-token");
  });
});
