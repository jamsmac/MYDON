// Срез A3, миграция 0089 на настоящем SQL: 0088 → строка полевого контура → 0089 →
// строка цела, колонки с честными значениями → откат из комментария миграции →
// колонок нет, строки на месте → повторный прогон 0089 (IF NOT EXISTS) применяется заново.
// Движок — pglite локально, сервис postgres:17 в CI (см. run-migrations.mjs).
import assert from "node:assert/strict";
import { migratedDb, ENGINE } from "./run-migrations.mjs";

const OWNER = "00000000-0000-0000-0000-00000000a301";
const ФОТО = "00000000-0000-0000-0000-00000000a389";
const ДОК = "00000000-0000-0000-0000-00000000a390";

const { client, applyMigrations } = await migratedDb({ upto: 88 });
const run = async (sql) => (await client.query(sql)).rows;
const колонки = async () =>
  run(
    `select column_name, udt_name, is_nullable, column_default
       from information_schema.columns
      where table_name = 'attachment' and column_name in ('title', 'domain', 'tags')
      order by column_name`,
  );

// Строка полевого контура ДО 0089: фото карточки, без названия и направления.
await run(
  `insert into attachment (id, owner_type, owner_id, kind, storage_key, mime, bytes, created_by)
   values ('${ФОТО}', 'entity', '${OWNER}', 'photo', 'k/a389.jpg', 'image/jpeg', 100, 'staff:1')`,
);
// Копия массива, а не сам результат: в режиме CHECKS_DATABASE_URL сюда приходит
// сырой результат драйвера postgres-js — `class Result extends Array`, — а
// deepEqual из node:assert/strict сравнивает ещё и ПРОТОТИПЫ, поэтому пустой
// Result не равен []. Соседние сценарии этого не ловят: они сравнивают с []
// выдачу drizzle-СЕРВИСА, то есть обычный массив.
assert.deepEqual([...(await колонки())], [], "на 0088 новых колонок ещё нет");

await applyMigrations();

let cols = await колонки();
assert.deepEqual(
  cols.map((c) => [c.column_name, c.udt_name, c.is_nullable]),
  [
    ["domain", "domain", "YES"],
    ["tags", "jsonb", "NO"],
    ["title", "text", "YES"],
  ],
  "типы и nullable трёх колонок",
);
assert.match(String(cols.find((c) => c.column_name === "tags").column_default), /'\[\]'::jsonb/);

// Старая строка цела и читается без null-веток: tags = [] от DEFAULT, title/domain NULL.
const [старая] = await run(
  `select title, domain, tags::text as tags, storage_key from attachment where id = '${ФОТО}'`,
);
assert.equal(старая.title, null);
assert.equal(старая.domain, null);
assert.equal(старая.tags, "[]");
assert.equal(старая.storage_key, "k/a389.jpg");

// Новая строка-артефакт: enum принимает значения money_flow, метки пишутся; чужое значение отвергается.
await run(
  `insert into attachment (id, owner_type, owner_id, kind, storage_key, title, domain, tags)
   values ('${ДОК}', 'person', '${OWNER}', 'doc', 'k/a390.docx', 'Дебиторка GLOBERENT за август', 'globerent', '["bot"]'::jsonb)`,
);
await assert.rejects(
  run(
    `insert into attachment (id, owner_type, owner_id, kind, storage_key, domain)
     values ('00000000-0000-0000-0000-00000000a391', 'person', '${OWNER}', 'doc', 'k/a391', 'nope')`,
  ),
  /invalid input value for enum domain/,
);
const [док] = await run(`select title, domain, tags::text as tags from attachment where id = '${ДОК}'`);
assert.deepEqual([док.title, док.domain, док.tags], ["Дебиторка GLOBERENT за август", "globerent", '["bot"]']);

// Индекс есть, не уникальный, по (kind, created_at DESC).
const [idx] = await run(
  `select indexdef from pg_indexes where tablename = 'attachment' and indexname = 'attachment_kind_created_idx'`,
);
assert.ok(idx, "индекса attachment_kind_created_idx нет");
// NULLS LAST не выпадает из вывода: для DESC-колонки в Postgres умолчание —
// NULLS FIRST, поэтому pg_get_indexdef() всегда печатает явную NULLS LAST,
// которую задаёт .desc() в schema.ts (реальный SQL проверен и на pglite, и
// на postgres:17 — брифовая версия регэкспа без "NULLS LAST" не совпадает
// ни с одним из движков).
assert.match(
  idx.indexdef,
  /^CREATE INDEX attachment_kind_created_idx ON public\.attachment USING btree \(kind, created_at DESC NULLS LAST\)$/,
);

// Откат — ровно операторы из заголовка миграции 0089.
await run(`DROP INDEX IF EXISTS "attachment_kind_created_idx"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "tags"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "domain"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "title"`);
await run(
  `DELETE FROM "drizzle"."__drizzle_migrations"
    WHERE "created_at" = (select max("created_at") from "drizzle"."__drizzle_migrations")`,
);
assert.deepEqual([...(await колонки())], [], "после отката колонок быть не должно");
const [n] = await run(`select count(*)::int as n from attachment`);
assert.equal(n.n, 2, "откат не удаляет строк — файлы остаются");

// Повторный прогон: IF NOT EXISTS + журнал мигратора без 0089 → применяется заново без ошибок.
await applyMigrations();
cols = await колонки();
assert.equal(cols.length, 3, "после повторного прогона колонки снова на месте");
const [idx2] = await run(
  `select 1 from pg_indexes where tablename = 'attachment' and indexname = 'attachment_kind_created_idx'`,
);
assert.ok(idx2, "после повторного прогона индекс снова на месте");
const [m] = await run(`select count(*)::int as n from "drizzle"."__drizzle_migrations"`);
assert.equal(m.n, 90, "журнал мигратора: 0000…0089 = 90 записей");

console.log(`0088 → 0089 → откат → 0089 (${ENGINE}): attachment расширена, старые строки целы, откат обратим`);
await client.close();
