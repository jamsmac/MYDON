import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, it } from "node:test";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { MUTATING_TOOLS, READING_TOOLS } from "./tools";

/**
 * Протокольный слой сервера целиком: собранный `dist/server.js` поднимается
 * настоящим процессом и разговаривает по stdio.
 *
 * Раньше это проверял РУЧНОЙ смоук (описан в отчёте Task 4), то есть правило
 * «в stdout только протокол» держалось на памяти о том, что кто-то однажды
 * запустил скрипт. Любая строка в stdout — сломанный кадр JSON-RPC, и клиент
 * видит не «сервер что-то написал», а «сервер сломался»; такую регрессию
 * должен ловить обычный прогон тестов.
 *
 * У теста ЖЁСТКИЙ предел времени и обязательное убийство процесса: подвисший
 * дочерний процесс не должен превращаться в подвисшую сборку.
 */

/** Дольше этого сервер не отвечает никогда — дальше это зависание. */
const HARD_TIMEOUT_MS = 20_000;

interface JsonRpcFrame {
  jsonrpc?: unknown;
  id?: unknown;
  result?: Record<string, unknown>;
  error?: unknown;
}

/** Стаб Core на петлевом адресе: сервер обязан подняться и ответить без сети. */
async function startStubCore(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const body = req.url?.startsWith("/system/config")
      ? JSON.stringify([
          { key: "OWNER_IDENTITY_ENFORCED", label: "Пояс владельца", value: "0", source: "db" },
        ])
      : JSON.stringify({
          generatedAt: "2026-09-06T05:00:00.000Z",
          tz: "Asia/Tashkent",
          overdueMoney: 0,
          idleMachines: 1,
          pendingApprovals: 2,
          contractsDueSoon: 0,
          contractsBadDate: 0,
          overdueTasks: 3,
        });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

interface Session {
  /** Каждая строка stdout как есть — по ним и проверяется чистота потока. */
  stdoutLines: string[];
  stderr: string;
  frames: JsonRpcFrame[];
}

/**
 * Один разговор с сервером: запросы уходят по порядку, ответы собираются, пока
 * не пришёл ответ с последним идентификатором или не истекло время.
 */
async function talk(coreUrl: string, requests: Record<string, unknown>[]): Promise<Session> {
  // Тест гоняется из `dist`, рядом лежит собранная точка входа.
  const entry = path.join(__dirname, "server.js");
  const child = spawn(process.execPath, [entry], {
    env: {
      PATH: process.env.PATH ?? "",
      CORE_API_URL: coreUrl,
      // Только ASCII: заголовок HTTP — ByteString, и кириллица в токене
      // падает ещё в fetch, до всякого разговора с Core.
      SERVICE_TOKEN: "test-service-token",
      OWNER_ACTION_TOKEN: "test-owner-token",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: Session = { stdoutLines: [], stderr: "", frames: [] };
  const lastId = requests.filter((r) => r.id !== undefined).length;

  const done = new Promise<void>((resolve, reject) => {
    let buffer = "";
    let answered = 0;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.trim() === "") continue;
        session.stdoutLines.push(line);
        try {
          const frame = JSON.parse(line) as JsonRpcFrame;
          session.frames.push(frame);
          if (frame.id !== undefined) answered += 1;
        } catch {
          // Непарсящуюся строку не бросаем здесь: её покажет проверка ниже
          // вместе со всем потоком — так в отчёте видно, ЧТО именно попало
          // в stdout.
          answered = lastId;
        }
      }
      if (answered >= lastId) resolve();
    });
    child.stderr.on("data", (chunk: string) => {
      session.stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      // Ранний выход — тоже ответ: без него тест ждал бы до таймаута и врал
      // бы про «зависание» там, где сервер просто упал на старте.
      if (answered < lastId) reject(new Error(`сервер вышел раньше времени, код ${String(code)}`));
    });
  });

  const timer = setTimeout(() => child.kill("SIGKILL"), HARD_TIMEOUT_MS);
  try {
    for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
    await done;
  } finally {
    clearTimeout(timer);
    child.stdin.end();
    child.kill("SIGKILL");
  }
  return session;
}

describe("Протокол stdio: в stdout только JSON-RPC", () => {
  it(
    "initialize, tools/list и tools/call проходят, а диагностика уходит в stderr",
    { timeout: HARD_TIMEOUT_MS + 5_000 },
    async () => {
      const core = await startStubCore();
      let session: Session;
      try {
        session = await talk(core.url, [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: LATEST_PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "protocol-test", version: "0.0.0" },
            },
          },
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "briefing_get", arguments: {} },
          },
        ]);
      } finally {
        await core.close();
      }

      // Главное правило транспорта: ни одной посторонней строки в stdout.
      for (const line of session.stdoutLines) {
        let parsed: JsonRpcFrame;
        try {
          parsed = JSON.parse(line) as JsonRpcFrame;
        } catch {
          assert.fail(`в stdout не-JSON строка: ${line.slice(0, 200)}`);
        }
        assert.equal(parsed.jsonrpc, "2.0", `кадр без версии JSON-RPC: ${line.slice(0, 200)}`);
      }

      const byId = (id: number): JsonRpcFrame => {
        const frame = session.frames.find((f) => f.id === id);
        assert.ok(frame, `нет ответа на запрос ${id}`);
        assert.equal(frame.error, undefined, `запрос ${id} вернул ошибку протокола`);
        return frame;
      };

      const info = byId(1).result?.serverInfo as { name?: string } | undefined;
      assert.equal(info?.name, "mydon-core");

      const tools = byId(2).result?.tools as { name: string }[] | undefined;
      assert.ok(tools, "tools/list без списка инструментов");
      assert.deepEqual(
        tools.map((t) => t.name).sort(),
        [...READING_TOOLS, ...MUTATING_TOOLS].sort(),
      );

      // Инструмент дошёл до стаба Core и вернул текст, а не JSON и не ошибку.
      const call = byId(3).result as { content?: { text?: string }[]; isError?: boolean };
      assert.notEqual(call.isError, true, `briefing_get вернул ошибку: ${JSON.stringify(call)}`);
      assert.match(call.content?.[0]?.text ?? "", /Брифинг/);

      // Диагностика жива, но живёт в stderr — иначе она рвала бы кадры.
      assert.match(session.stderr, /\[mydon-core\] готов/);
    },
  );
});
