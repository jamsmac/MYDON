import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CORE_URL, loadEnv } from "./env";

describe("Окружение MCP (R-A1-1)", () => {
  it("без SERVICE_TOKEN — понятная ошибка при старте, а не 401 позже", () => {
    assert.throws(
      () => loadEnv({ CORE_API_URL: "http://core" }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /SERVICE_TOKEN/);
        return true;
      },
    );
  });

  it("пробелы в SERVICE_TOKEN — то же отсутствие токена", () => {
    assert.throws(() => loadEnv({ SERVICE_TOKEN: "   " }), /SERVICE_TOKEN/);
  });

  it("ошибка не печатает значений окружения", () => {
    try {
      loadEnv({ SERVICE_TOKEN: "", OWNER_ACTION_TOKEN: "значение-владельца", CORE_API_URL: "http://core" });
      assert.fail("ожидалась ошибка про отсутствие токена");
    } catch (e) {
      assert.ok(e instanceof Error);
      assert.doesNotMatch(e.message, /значение-владельца/);
      assert.doesNotMatch(e.message, /http:\/\/core/);
    }
  });

  it("адрес Core по умолчанию — локальный порт", () => {
    assert.equal(DEFAULT_CORE_URL, "http://127.0.0.1:3001");
    assert.equal(loadEnv({ SERVICE_TOKEN: "s" }).baseUrl, "http://127.0.0.1:3001");
  });

  it("CORE_API_URL перекрывает адрес; хвостовая косая срезается", () => {
    assert.equal(loadEnv({ SERVICE_TOKEN: "s", CORE_API_URL: "http://core:3001/" }).baseUrl, "http://core:3001");
    assert.equal(loadEnv({ SERVICE_TOKEN: "s", CORE_API_URL: "  " }).baseUrl, DEFAULT_CORE_URL);
  });

  it("OWNER_ACTION_TOKEN необязателен", () => {
    assert.equal(loadEnv({ SERVICE_TOKEN: "s" }).ownerToken, undefined);
    assert.equal(loadEnv({ SERVICE_TOKEN: "s", OWNER_ACTION_TOKEN: "  " }).ownerToken, undefined);
    assert.equal(loadEnv({ SERVICE_TOKEN: "s", OWNER_ACTION_TOKEN: "o" }).ownerToken, "o");
  });

  it("по умолчанию читает process.env", () => {
    const было = process.env.SERVICE_TOKEN;
    process.env.SERVICE_TOKEN = "из-процесса";
    try {
      assert.equal(loadEnv().serviceToken, "из-процесса");
    } finally {
      if (было === undefined) delete process.env.SERVICE_TOKEN;
      else process.env.SERVICE_TOKEN = было;
    }
  });
});
