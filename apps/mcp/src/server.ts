#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type CoreClient } from "./core-client";
import { loadEnv, type CoreEnv } from "./env";
import { buildTools, registerTools, type OwnerPosture } from "./tools";

/**
 * MCP-сервер `mydon-core` (R-A1-2): владелец обращается к MYDON прямо из
 * своего Claude Code, не открывая панель и не вспоминая маршруты.
 *
 * Транспорт — stdio, а значит stdout ЗАНЯТ протоколом: любая посторонняя
 * строка туда ломает кадр JSON-RPC, и клиент видит не «сервер что-то написал»,
 * а «сервер сломался». Поэтому вся диагностика уходит в stderr, включая
 * перехваченный `console.log` ниже.
 */

// Страховка на будущее: случайный `console.log` в любой строке этого процесса
// уехал бы в stdout и разорвал кадр JSON-RPC. Перенаправляем его в stderr —
// диагностика останется видимой, протокол — целым.
console.log = (...args: unknown[]): void => {
  console.error(...args);
};

const SERVER_NAME = "mydon-core";
const SERVER_VERSION = "0.1.0";

/** Тумблер пояса идентичности владельца в `GET /system/config` (Р-3). */
const OWNER_BELT_KEY = "OWNER_IDENTITY_ENFORCED";

/** Переменные, которые Claude Code подставляет в `.mcp.json`. */
const SUBSTITUTED_KEYS = ["CORE_API_URL", "SERVICE_TOKEN", "OWNER_ACTION_TOKEN"];

/**
 * Незаменённая подстановка `${VAR}`: так Claude Code передаёт переменную,
 * которой нет в окружении (в `.mcp.json` она остаётся текстом как есть).
 */
const PLACEHOLDER = /^\$\{[^}]*\}$/;

/** Единственный канал диагностики — stderr. */
function log(message: string): void {
  console.error(`[${SERVER_NAME}] ${message}`);
}

/**
 * Неразвёрнутая подстановка — это «переменная не задана», а не значение.
 * Иначе сервер ушёл бы в Core с токеном «${SERVICE_TOKEN}» и получил 401
 * вместо понятного «не задан SERVICE_TOKEN» на старте.
 */
export function sanitizeEnv(
  raw: Record<string, string | undefined>,
  warn: (message: string) => void = log,
): Record<string, string | undefined> {
  const clean: Record<string, string | undefined> = { ...raw };
  for (const key of SUBSTITUTED_KEYS) {
    const value = clean[key];
    if (typeof value === "string" && PLACEHOLDER.test(value.trim())) {
      // Печатаем ИМЯ переменной, никогда значение.
      warn(`переменная ${key} пришла неразвёрнутой подстановкой — считаю её незаданной`);
      clean[key] = "";
    }
  }
  return clean;
}

/**
 * Годится ли owner-токен на owner-действия. Core отвергает owner-токен,
 * равный сервисному (`owner-enforcement.ts`), — такой токен всё равно что
 * незаданный, и обещать по нему owner-действия было бы враньём.
 */
export function ownerTokenUsable(env: CoreEnv, warn: (message: string) => void = log): boolean {
  if (!env.ownerToken) return false;
  if (env.ownerToken === env.serviceToken) {
    warn("OWNER_ACTION_TOKEN равен SERVICE_TOKEN — Core такой токен не примет, считаю owner-токен незаданным");
    return false;
  }
  return true;
}

/**
 * Состояние пояса владельца на момент старта (Р-3). Core недоступен — сервер
 * всё равно поднимается, но описание `approval_decide` честно скажет, что
 * состояние пояса неизвестно, вместо удобного «пояс выключен».
 */
export async function readPosture(
  client: CoreClient,
  tokenPresent: boolean,
  warn: (message: string) => void = log,
): Promise<OwnerPosture> {
  try {
    const config = await client.systemConfig();
    const item = config.find((entry) => entry.key === OWNER_BELT_KEY);
    if (!item) {
      warn(`Core не вернул тумблер ${OWNER_BELT_KEY} — состояние пояса неизвестно`);
      return { ownerEnforced: false, ownerTokenPresent: tokenPresent, beltUnknown: true };
    }
    // `effective` важнее сырого значения там, где Core его считает.
    const value = (item.effective ?? item.value).trim();
    return { ownerEnforced: value === "1", ownerTokenPresent: tokenPresent };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    warn(`не удалось прочитать ${OWNER_BELT_KEY}: ${reason} — состояние пояса неизвестно`);
    return { ownerEnforced: false, ownerTokenPresent: tokenPresent, beltUnknown: true };
  }
}

/** Одна строка о том, что подняли: её читает владелец в логе клиента. */
function startupLine(env: CoreEnv, posture: OwnerPosture, toolCount: number): string {
  const belt = posture.beltUnknown
    ? "пояс владельца: состояние неизвестно"
    : posture.ownerEnforced
      ? `пояс владельца включён, owner-токен ${posture.ownerTokenPresent ? "задан" : "НЕ задан"}`
      : "пояс владельца выключен (Core пропускает owner-действия по сервисному токену)";
  return `готов: Core ${env.baseUrl}, инструментов ${toolCount}, ${belt}`;
}

async function main(): Promise<void> {
  const env = loadEnv(sanitizeEnv(process.env));
  const client = createClient({
    baseUrl: env.baseUrl,
    serviceToken: env.serviceToken,
    ...(env.ownerToken ? { ownerToken: env.ownerToken } : {}),
  });

  const posture = await readPosture(client, ownerTokenUsable(env));
  const tools = buildTools(client, posture);

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "MYDON Core: очередь решений владельца, задачи, реестр, события, память агентов и страницы знаний. " +
        "Читающие инструменты ничего не меняют; меняющие названы в описании и работают по одной операции за вызов. " +
        "Личный контур скрыт, пока его не запросили явно.",
    },
  );
  registerTools(server, tools);

  await server.connect(new StdioServerTransport());
  log(startupLine(env, posture, tools.length));
}

// Запуск только как программы: тест импортирует функции этого модуля и не
// должен поднимать транспорт.
if (require.main === module) {
  main().catch((cause: unknown) => {
    log(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  });
}
