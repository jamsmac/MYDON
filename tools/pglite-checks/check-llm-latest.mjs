// Строка «Модели» на НАСТОЯЩЕМ SQL: последний завершённый вызов берётся по
// маршруту моделей, а не по всей таблице `llm_spend` (круг починок 2, Ф-2).
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ СЦЕНАРИЙ. Правка живёт в условии запроса, а юнит-тесты ядра
// ходят в заглушку drizzle: она `where` не исполняет, поэтому «зелёное» на ней
// доказывает только форму условия (это проверено в
// `llm-ledger.service.test.ts`), но не то, КАКУЮ строку вернёт база. Здесь
// кладутся два настоящих вызова в одну таблицу и спрашивается настоящий
// Postgres.
//
// Вход воспроизводит аварию: отозван ключ модели — каждый вызов агентов падает,
// но следом штатно оседает успешный вызов эмбеддингов (у них свой ключ и свой
// адрес, `EMBED_*`, и та же таблица). До правки строка после этого зеленела, а
// вердикт мерцал `ok`↔`bad` по тому, чей вызов завершился последним.
import assert from "node:assert/strict";
import path from "node:path";
import { coreDb, reqCore, ENGINE } from "./svc-harness.mjs";
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { LlmLedgerService } = reqCore(path.join(REPO, "apps/core/dist/llm-ledger/llm-ledger.service.js"));
const { ledgerСловами } = reqCore(path.join(REPO, "apps/core/dist/apps/apps-health.service.js"));
const { rowFromLlm, FACES } = reqCore(path.join(REPO, "apps/core/dist/apps/apps-health.js"));
const { db, run, close } = await coreDb();
try {
  const NOW = new Date("2026-08-30T12:00:00.000Z"); // 17:00 в Ташкенте — те же сутки
  const DAY = "2026-08-30";
  await run(`insert into system_config (key, value) values
    ('LLM_ENABLED', '1'),
    ('LLM_ROUTE', 'openai-api'),
    ('LLM_PRICE_PROVIDER_ID', 'openai'),
    ('LLM_MODEL', 'gpt-5.6-sol'),
    ('LLM_GLOBAL_DAILY_BUDGET_USD', '10')`);
  await run(`insert into llm_model_price (provider, model, valid_from)
    values ('openai', 'gpt-5.6-sol', '2026-08-01T00:00:00Z')`);

  /** Одна завершённая физическая попытка в леджере. */
  const вызов = (key, consumer, model, status, at, outcome) =>
    run(
      `insert into llm_spend (request_key, request_hash, consumer, feature, provider, model, status, outcome, day,
         input_token_ceiling, output_token_ceiling, actual_usd, ${status === "settled" ? "settled_at" : "failed_at"})
       values ($1, $2, $3, 'assistant', 'openai', $4, $5, $6, $7, 0, 0, 0.001, $8)`,
      [key, `hash-${key}`, consumer, model, status, outcome, DAY, at],
    );

  const строка = async () => {
    const снимок = await new LlmLedgerService(db).monitoring(NOW);
    return { снимок, row: rowFromLlm(FACES.llm, { monitoring: ledgerСловами(снимок), now: NOW }) };
  };

  // 1. Ключ модели отозван: вызов агентов упал, ПОЗЖЕ прошёл вызов эмбеддингов.
  await вызов("main-failed", "agents", "gpt-5.6-sol", "failed", "2026-08-30T11:00:00Z", "provider_error");
  await вызов("embed-ok", "embeddings", "text-embedding-3-small", "settled", "2026-08-30T11:30:00Z", "success");
  let { снимок, row } = await строка();
  assert.equal(снимок.latestCompleted.consumer, "agents", "последним завершённым посчитан чужой маршрут");
  assert.equal(снимок.latestCompleted.status, "failed");
  assert.equal(row.state, "bad", "строка зеленеет от успеха эмбеддингов над отозванным ключом модели");
  assert.match(row.summary, /отказал/);
  assert.equal(снимок.failuresToday.count, 1, "отказ эмбеддингов не потерян для счётчика");

  // 2. Зеркально: маршрут моделей жив, упали эмбеддинги — строка не краснеет.
  await вызов("main-ok", "agents", "gpt-5.6-sol", "settled", "2026-08-30T11:45:00Z", "success");
  await вызов("embed-failed", "embeddings", "text-embedding-3-small", "failed", "2026-08-30T11:50:00Z", "provider_error");
  ({ снимок, row } = await строка());
  assert.equal(снимок.latestCompleted.consumer, "agents");
  assert.equal(снимок.latestCompleted.status, "settled");
  assert.equal(row.state, "ok", "отказ эмбеддингов красит строку про модель");
  assert.equal(снимок.failuresToday.count, 2, "оба отказа по-прежнему видны в числах дня");

  console.log(`Ф-2 (${ENGINE}): строка «Модели» судит по своему маршруту, а не по последнему вызову в таблице ✔`);
} finally {
  await close();
}
