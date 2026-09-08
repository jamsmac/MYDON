// Срез A3, задача 3: `AttachmentsService.upload()` на НАСТОЯЩЕМ SQL.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ СЦЕНАРИЙ. Юнит-тесты сервиса (`attachments.test.ts`) ходят в
// заглушку db: `insert().values(v).returning()` там просто эхом отдаёт то, что
// в неё положили, — «зелёное» на ней доказывает форму объекта, но не то, что
// НАСТОЯЩИЙ drizzle-инсерт с типами колонки `tags: jsonb().$type<string[]>()`
// действительно принимает вставленный литерал и что jsonb-колонка после
// прогона через реальный Postgres читается обратно так, как ждёт `tagsOf()`.
// Отдельная ловушка (её назвал владелец по проверке живого дерева, не бриф):
// строка, залитая МИМО `upload()` (ручной SQL, импорт), может нести в jsonb
// СИНТАКСИЧЕСКИЙ `null` (валиден для NOT NULL колонки — это не SQL NULL,
// а JSON-значение null) или мусор внутри массива. Заглушка юнит-теста такую
// строку эмулирует руками; здесь она лежит в базе взаправду.
import assert from "node:assert/strict";
import path from "node:path";
import { coreDb, reqCore, ENGINE } from "./svc-harness.mjs";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { AttachmentsService, tagsOf } = reqCore(path.join(REPO, "apps/core/dist/attachments/attachments.service.js"));
const { db, run, close } = await coreDb();

/** Хранилище в памяти: сценарий проверяет БД, не диск/S3 — так же, как uploadHarness() в юнит-тестах. */
function fakeStorage() {
  const written = [];
  return {
    keyFor: (ownerType, ownerId, ext) => `${ownerType}/${ownerId}/f${ext}`,
    put: async (key, _bytes, mime) => {
      written.push({ key, mime });
    },
    url: async (id) => `/attachments/${id}/raw`,
    written,
  };
}

const file = (mimetype, buf = "x") => ({ buffer: Buffer.from(buf), mimetype, size: buf.length, originalname: "f" });

try {
  const cols = await run(
    `select column_name from information_schema.columns where table_name = 'attachment' and column_name in ('title', 'domain', 'tags')`,
  );
  assert.equal(cols.length, 3, "миграция 0089 не применена цепочкой — сценарию не на чем стоять");

  const OWNER = "00000000-0000-4000-8000-0000000000b1";

  // 1. Старый вызов (фото полевого контура) БЕЗ title/domain/tags — реальный
  //    insert через drizzle, не заглушка: колонки уходят null/null/[], как
  //    и раньше, а не падают из-за NOT NULL на tags.
  const storage1 = fakeStorage();
  const svc1 = new AttachmentsService(db, storage1);
  const photoMeta = await svc1.upload({ ownerType: "entity", ownerId: OWNER, kind: "photo" }, file("image/jpeg"));
  assert.equal(photoMeta.title, null);
  assert.equal(photoMeta.domain, null);
  assert.deepEqual(photoMeta.tags, []);
  const [photoRow] = await run(`select title, domain, tags from attachment where id = $1`, [photoMeta.id]);
  assert.equal(photoRow.title, null);
  assert.equal(photoRow.domain, null);
  assert.deepEqual(photoRow.tags, [], "реальная jsonb-колонка после инсерта без tags — литерал [], не SQL NULL");

  // 2. Новый вызов (документ бота) СО всеми тремя полями — реальный insert,
  //    реальный enum domain, реальный jsonb-массив меток.
  const storage2 = fakeStorage();
  const svc2 = new AttachmentsService(db, storage2);
  const docMeta = await svc2.upload(
    {
      ownerType: "person",
      ownerId: OWNER,
      kind: "doc",
      title: "Дебиторка GLOBERENT за август",
      domain: "globerent",
      tags: ["bot", "report"],
    },
    file("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "office-bytes"),
  );
  assert.equal(docMeta.title, "Дебиторка GLOBERENT за август");
  assert.equal(docMeta.domain, "globerent");
  assert.deepEqual(docMeta.tags, ["bot", "report"]);
  assert.deepEqual(storage2.written.map((w) => w.key), [`person/${OWNER}/f.docx`], "docx из белого списка — расширение по типу, реальная запись в хранилище");
  const [docRow] = await run(`select title, domain, tags from attachment where id = $1`, [docMeta.id]);
  assert.equal(docRow.title, "Дебиторка GLOBERENT за август");
  assert.equal(docRow.domain, "globerent");
  assert.deepEqual(docRow.tags, ["bot", "report"]);

  // 3. Ловушка владельца: строки МИМО upload() — jsonb `null` (не SQL NULL) и
  //    массив с мусором внутри. tagsOf() читает их через toMeta() (ofOwner),
  //    а не через ручной вызов функции на объекте, слепленном в тесте.
  const LEGACY_NULL = "00000000-0000-4000-8000-0000000000b2";
  const LEGACY_MIXED = "00000000-0000-4000-8000-0000000000b3";
  await run(
    `insert into attachment (id, owner_type, owner_id, kind, storage_key, created_by, tags) values
       ($1, 'entity', $3, 'photo', 'k/legacy-null', 'staff', 'null'::jsonb),
       ($2, 'entity', $3, 'photo', 'k/legacy-mixed', 'staff', '["bot", 7, null, "report"]'::jsonb)`,
    [LEGACY_NULL, LEGACY_MIXED, OWNER],
  );
  const svc3 = new AttachmentsService(db, fakeStorage());
  const legacy = await svc3.ofOwner("entity", OWNER);
  const byId = Object.fromEntries(legacy.map((m) => [m.id, m]));
  assert.deepEqual(byId[LEGACY_NULL].tags, [], "jsonb-значение null (не SQL NULL) — tagsOf() отдаёт [], а не падает");
  assert.deepEqual(byId[LEGACY_MIXED].tags, ["bot", "report"], "не-строки внутри массива отброшены, строки на месте, порядок сохранён");

  // 4. Прямой tagsOf() на настоящих значениях, вынутых из Postgres (не на
  //    объекте, вручную собранном в юните) — драйвер отдаёт jsonb уже как JS-значение.
  const [{ tags: nullTags }] = await run(`select tags from attachment where id = $1`, [LEGACY_NULL]);
  const [{ tags: mixedTags }] = await run(`select tags from attachment where id = $1`, [LEGACY_MIXED]);
  assert.deepEqual(tagsOf(nullTags), []);
  assert.deepEqual(tagsOf(mixedTags), ["bot", "report"]);

  // 5. Чужой domain отвергается настоящим enum'ом — упавший insert не должен
  //    портить сервис на следующей же вставке.
  await assert.rejects(
    run(`insert into attachment (id, owner_type, owner_id, kind, storage_key, domain) values ($1, 'person', $2, 'doc', 'k/bad', 'ozon')`, [
      "00000000-0000-4000-8000-0000000000b4",
      OWNER,
    ]),
    /invalid input value for enum domain/,
  );

  console.log(
    `A3 upload() (${ENGINE}): title/domain/tags идут в реальный insert и обратно, jsonb null и мусор в массиве не роняют tagsOf() ✔`,
  );
} finally {
  await close();
}
