import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attachment, document, domainEnum, moneyFlow } from "./schema";

/**
 * Срез A3 «Кольцо артефактов»: субстрат артефактов — `attachment`, а не мёртвая
 * `document` (спека 2026-09-07-artifacts-ring-design §1, миграция 0089).
 *
 * Что охраняется и почему:
 *  · три новые колонки nullable / с default — существующие фото и чеки полевого
 *    контура миграция не трогает (Р-A3-7);
 *  · `domain` — ТОТ ЖЕ объект enum, что у money_flow: второй pgEnum с теми же
 *    значениями генератор объявил бы заново, и миграция упала бы на CREATE TYPE;
 *  · индекс (kind, created_at desc) — под витрину «последние артефакты такого
 *    рода»; без него /artifacts идёт полным сканом по таблице с фото;
 *  · `document` помечена устаревшей — иначе следующий читатель схемы снова
 *    примет её за живой субстрат (так и родилась ошибка плана §6.4 п. 4).
 */
describe("attachment как субстрат артефактов (срез A3, миграция 0089)", () => {
  const c = getTableColumns(attachment);

  it("title — text, nullable, без default: у фото полевого контура названия нет", () => {
    assert.equal(getTableName(attachment), "attachment");
    assert.equal(c.title.name, "title");
    assert.equal(c.title.columnType, "PgText");
    assert.equal(c.title.notNull, false);
    assert.equal(c.title.hasDefault, false);
  });

  it("domain — тот же enum `domain`, что у money_flow, nullable", () => {
    assert.equal(c.domain.name, "domain");
    assert.equal(c.domain.columnType, "PgEnumColumn");
    assert.equal(c.domain.notNull, false);
    assert.equal(c.domain.hasDefault, false);
    assert.deepEqual(c.domain.enumValues, domainEnum.enumValues);
    // Один объект enum, а не «такие же значения»: второй pgEnum("domain", …)
    // генератор попытался бы создать ещё раз, и миграция упала бы на CREATE TYPE.
    const своё = (c.domain as unknown as { enum: unknown }).enum;
    const уДенег = (getTableColumns(moneyFlow).domain as unknown as { enum: unknown }).enum;
    assert.equal(своё, domainEnum);
    assert.equal(уДенег, domainEnum);
  });

  it("tags — jsonb NOT NULL DEFAULT '[]': старые строки читаются без null-веток", () => {
    assert.equal(c.tags.name, "tags");
    assert.equal(c.tags.columnType, "PgJsonb");
    assert.equal(c.tags.notNull, true);
    assert.equal(c.tags.hasDefault, true);
    assert.deepEqual(c.tags.default, []);
  });

  it("инвариант полевого контура цел: owner_id и storage_key по-прежнему NOT NULL", () => {
    // Спека §1, решение 2: «у вложения есть хозяин» — артефакт бота привязан к
    // person, а не к nullable owner_id.
    assert.equal(c.ownerId.notNull, true);
    assert.equal(c.storageKey.notNull, true);
    assert.equal(c.kind.default, "photo");
  });

  it("индекс attachment_kind_created_idx: (kind, created_at DESC), сплошной, не уникальный", () => {
    const индексы = getTableConfig(attachment).indexes;
    const idx = индексы.find((i) => i.config.name === "attachment_kind_created_idx");
    assert.ok(idx, "индекса attachment_kind_created_idx нет — витрина пойдёт полным сканом");
    assert.equal(idx.config.unique, false);
    assert.equal(idx.config.where, undefined, "индекс сплошной: фильтр по kind задаёт запрос");
    const колонки = idx.config.columns.map((col) => {
      const ic = col as unknown as { name?: string; indexConfig?: { order?: string } };
      return { name: ic.name, order: ic.indexConfig?.order };
    });
    assert.deepEqual(колонки, [
      { name: "kind", order: "asc" },
      { name: "created_at", order: "desc" },
    ]);
    assert.ok(
      индексы.some((i) => i.config.name === "attachment_owner_idx"),
      "старый индекс галереи (owner_type, owner_id) должен остаться",
    );
  });

  it("document помечена устаревшей ровно той строкой, что зафиксирована в спеке", () => {
    assert.equal(getTableName(document), "document");
    const исходник = readFileSync(path.join(__dirname, "..", "src", "schema.ts"), "utf8");
    assert.match(
      исходник,
      /\/\*\* УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment \(срез A3\)\. \*\/\nexport const document = pgTable\("document", \{/,
      "комментарий над `document` снят или изменён — следующий читатель снова примет её за живой субстрат",
    );
  });
});
