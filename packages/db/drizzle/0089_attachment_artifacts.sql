-- Срез A3 «Кольцо артефактов»: attachment становится субстратом артефактов
-- (спека docs/superpowers/specs/2026-09-07-artifacts-ring-design.md §1, Р-A3-7).
--
-- Что добавляется и почему.
--   title  — человеческое имя артефакта; до среза у файла был только storage_key.
--   domain — направление бизнеса, ТОТ ЖЕ enum "domain", что у money_flow (с 0000):
--            нового типа нет, второй CREATE TYPE уронил бы миграцию.
--   tags   — метки, ради которых когда-то заводили мёртвую `document`.
--   индекс (kind, created_at DESC) — под витрину «последние артефакты такого рода»;
--            до него был только (owner_type, owner_id), и /artifacts шла бы полным
--            сканом по таблице с фото полевого контура.
--
-- Существующие строки (фото, чеки полевого контура) НЕ трогаются: title/domain
-- nullable, tags получает '[]' через DEFAULT — бэкфилла нет, UPDATE нет. Default
-- постоянный, поэтому ADD COLUMN … DEFAULT — правка каталога, без перезаписи таблицы.
--
-- Почему НЕ `CREATE INDEX CONCURRENTLY`. Мигратор drizzle (migrate.ts →
-- drizzle-orm/pg-core/dialect.js) применяет ВСЕ ожидающие файлы внутри одной
-- транзакции, а CONCURRENTLY в транзакции запрещён — оператор упал бы и
-- ПОВЕСИЛ БЫ автодеплой (тот же вывод в 0070/0071/0073). Обычный CREATE INDEX
-- на живой таблице с фото держит SHARE-блокировку (запись ждёт, чтение идёт)
-- доли секунды: строк тысячи, не миллионы.
--
-- IF NOT EXISTS — защитный паттерн 0067…0073: автодеплой применяет миграции без
-- отката, и каждый оператор обязан быть безопасен на повторном прогоне.
--
-- Откат (вручную; строки attachment и файлы в хранилище остаются, но названия,
-- направления и метки артефактов, записанных после выката, будут потеряны):
--   DROP INDEX IF EXISTS "attachment_kind_created_idx";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "tags";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "domain";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "title";
--   DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = <when записи 0089 в meta/_journal.json>;
-- Последний шаг — чтобы мигратор применил 0089 заново при следующем деплое:
-- без него запись в журнале мигратора останется, а колонок в базе не будет.
-- Сценарий tools/pglite-checks/check-0089.mjs прогоняет этот откат на настоящем SQL.
--
-- Дата выката этой миграции — точка отсчёта архива: константа ARTIFACTS_SINCE
-- в apps/cc/src/lib/artifacts.ts печатается в пустом состоянии /artifacts.

ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "domain" "domain";--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachment_kind_created_idx" ON "attachment" USING btree ("kind","created_at" DESC NULLS LAST);
