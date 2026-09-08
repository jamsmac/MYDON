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
-- Почему в индексе NULLS FIRST, а не LAST. Это не про NULL в данных
-- (created_at — NOT NULL с 0000), а про совпадение ПУТЕЙ СОРТИРОВКИ: у DESC в
-- PostgreSQL умолчание — NULLS FIRST, и ORDER BY витрины (`desc(createdAt),
-- desc(id)` в apps/core/src/artifacts/artifacts.service.ts) даёт именно его.
-- С NULLS LAST планировщик брал из индекса ОДНО равенство по kind и сортировал
-- заново; замер на 50 000 строках (PostgreSQL 15.14 и pglite 17.5) — Bitmap
-- Heap Scan + top-N heapsort, 859 буферов, против Index Scan + Incremental Sort
-- и 5 буферов. Обязательство держит один автор индекса, а не каждый будущий
-- читатель таблицы, которому иначе пришлось бы помнить про NULLS LAST.
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
-- Две заставы DO $$ … RAISE EXCEPTION — плата за это IF NOT EXISTS. Он молчит не
-- только на повторном прогоне: если колонка (или индекс) УЖЕ есть ЛЮБОЙ ДРУГОЙ
-- формы, оператор пропускается без ошибки. Опыт на базе уровня 0088: руками
-- добавленная `alter table attachment add column tags text` — и 0089 применяется
-- БЕЗ ОШИБКИ, журнал говорит «90 записей», а читатель получает в tags NULL там,
-- где тип обещает string[]. Для этого проекта правки через редактор Supabase не
-- гипотетика, поэтому расхождение обязано падать ГРОМКО и до первого чтения.
-- Заставы не мешают повторному прогону: на уже применённой 0089 форма совпадает.
-- Откатывать их нечем и не нужно — они ничего не меняют, только читают каталог.
-- Сценарий tools/pglite-checks/check-0089-shape.mjs воспроизводит этот опыт.
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
DO $$
DECLARE mismatch text;
BEGIN
  SELECT string_agg(format('%s %s %s default %s', column_name, udt_name,
                           case when is_nullable = 'YES' then 'NULL' else 'NOT NULL' end,
                           coalesce(column_default, '<нет>')), '; ' ORDER BY column_name)
    INTO mismatch
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'attachment'
     AND column_name IN ('title', 'domain', 'tags')
     AND (column_name::text, udt_name::text, is_nullable::text) NOT IN
         (('title', 'text', 'YES'), ('domain', 'domain', 'YES'), ('tags', 'jsonb', 'NO'));
  IF mismatch IS NOT NULL THEN
    RAISE EXCEPTION '0089: форма колонок attachment расходится с ожидаемой (%); ожидалось title text NULL, domain domain NULL, tags jsonb NOT NULL', mismatch
      USING HINT = 'Колонку почти наверняка добавили в базу вручную, и ADD COLUMN IF NOT EXISTS выше её МОЛЧА пропустил. Приведите форму (тип, NOT NULL, DEFAULT ''[]''::jsonb у tags) и примените миграцию заново.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'attachment'
                    AND column_name = 'tags' AND column_default LIKE '%[]%::jsonb%') THEN
    RAISE EXCEPTION '0089: у attachment.tags нет DEFAULT ''[]''::jsonb — старые строки останутся без пустого списка'
      USING HINT = 'Тот же случай, что выше: колонка уже существовала, и ADD COLUMN IF NOT EXISTS её пропустил.';
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachment_kind_created_idx" ON "attachment" USING btree ("kind","created_at" DESC NULLS FIRST);--> statement-breakpoint
DO $$
BEGIN
  IF (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'attachment_kind_created_idx')
     <> 'CREATE INDEX attachment_kind_created_idx ON public.attachment USING btree (kind, created_at DESC)' THEN
    RAISE EXCEPTION '0089: индекс attachment_kind_created_idx не той формы: %',
      (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'attachment_kind_created_idx')
      USING HINT = 'CREATE INDEX IF NOT EXISTS выше молча пропускает уже существующий индекс любой формы. Ожидается (kind, created_at DESC), то есть DESC NULLS FIRST — путь сортировки витрины /artifacts; с NULLS LAST сортировочная половина индекса мертва. Пересоздайте индекс и примените миграцию заново.';
  END IF;
END $$;