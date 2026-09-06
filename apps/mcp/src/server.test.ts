import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CoreError, type CoreClient, type SystemConfigItem } from "./core-client";
import { ownerTokenUsable, readPosture, sanitizeEnv } from "./server";

const silent = (): void => undefined;

function configClient(items: SystemConfigItem[] | Error): CoreClient {
  return {
    systemConfig: async () => {
      if (items instanceof Error) throw items;
      return items;
    },
  } as unknown as CoreClient;
}

function belt(value: string): SystemConfigItem[] {
  return [
    { key: "AGENT_AUTONOMY_MAX", label: "Порог автономии", value: "T0", source: "default" },
    { key: "OWNER_IDENTITY_ENFORCED", label: "Пояс владельца", value, source: "db" },
  ];
}

describe("Окружение сервера", () => {
  it("неразвёрнутая подстановка ${VAR} считается незаданной", () => {
    const clean = sanitizeEnv(
      { SERVICE_TOKEN: "${SERVICE_TOKEN}", OWNER_ACTION_TOKEN: " ${OWNER_ACTION_TOKEN} ", CORE_API_URL: "http://127.0.0.1:3001" },
      silent,
    );
    assert.equal(clean.SERVICE_TOKEN, "");
    assert.equal(clean.OWNER_ACTION_TOKEN, "");
    assert.equal(clean.CORE_API_URL, "http://127.0.0.1:3001");
  });

  it("настоящие значения не трогаются", () => {
    const clean = sanitizeEnv({ SERVICE_TOKEN: "живой-токен", PATH: "/usr/bin" }, silent);
    assert.equal(clean.SERVICE_TOKEN, "живой-токен");
    assert.equal(clean.PATH, "/usr/bin");
  });

  it("owner-токен, равный сервисному, Core не примет — считаем незаданным", () => {
    assert.equal(ownerTokenUsable({ baseUrl: "http://core", serviceToken: "s" }, silent), false);
    assert.equal(
      ownerTokenUsable({ baseUrl: "http://core", serviceToken: "s", ownerToken: "s" }, silent),
      false,
    );
    assert.equal(
      ownerTokenUsable({ baseUrl: "http://core", serviceToken: "s", ownerToken: "o" }, silent),
      true,
    );
  });
});

describe("Чтение пояса владельца при старте (Р-3)", () => {
  it("тумблер 1 — пояс включён", async () => {
    const posture = await readPosture(configClient(belt("1")), true, silent);
    assert.deepEqual(posture, { ownerEnforced: true, ownerTokenPresent: true });
  });

  it("пустое значение (как на проде 06.09.2026) — пояс выключен", async () => {
    const posture = await readPosture(configClient(belt("")), true, silent);
    assert.deepEqual(posture, { ownerEnforced: false, ownerTokenPresent: true });
  });

  it("Core недоступен — состояние пояса неизвестно, а не «выключен»", async () => {
    const posture = await readPosture(
      configClient(new CoreError(0, "/system/config", "Core недоступен по адресу http://127.0.0.1:3001")),
      false,
      silent,
    );
    assert.equal(posture.beltUnknown, true);
    assert.equal(posture.ownerTokenPresent, false);
  });

  it("тумблера в ответе нет — тоже неизвестно", async () => {
    const posture = await readPosture(configClient([]), true, silent);
    assert.equal(posture.beltUnknown, true);
  });
});
