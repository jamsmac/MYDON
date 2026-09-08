// Кольцо артефактов (срез A3) на НАСТОЯЩЕМ SQL: страницы по курсору не
// пересекаются на равном created_at, поиск сворачивает регистр кириллицы,
// личный контур вырезается, storageKey наружу не едет.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ СЦЕНАРИЙ. Юнит-тесты ядра ходят в заглушку drizzle: она
// `where` не исполняет, поэтому «зелёное» на ней доказывает только форму
// условия (`artifacts.service.test.ts`), но не то, КАКИЕ строки вернёт база
// на стыке страниц. Здесь шесть настоящих строк, ЧЕТЫРЕ из них — с одним
// created_at, и обход страницами по две.
//
// ВРЕМЯ ФИКСТУРЫ — С МИКРОСЕКУНДАМИ, И ЭТО НЕСУЩАЯ ЧАСТЬ (круг починок 3,
// A-4). `created_at` пишет `now()`, то есть шесть знаков доли секунды, а JS
// `Date` держит три: пока курсор печатался через `Date.toISOString()`, строки
// с тем же миллисекундным срезом времени не попадали НИ в «раньше», НИ в
// «равно» и молча выпадали из обхода. На времени, выровненном по целой
// секунде, этого не увидеть — сторож был слеп именно из-за фикстуры.
import assert from "node:assert/strict";
import path from "node:path";
import { coreDb, reqCore, ENGINE } from "./svc-harness.mjs";
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { ArtifactsService, decodeCursor } = reqCore(path.join(REPO, "apps/core/dist/artifacts/artifacts.service.js"));
const { db, run, close } = await coreDb();
try {
  const cols = await run(
    `select column_name from information_schema.columns where table_name = 'attachment' and column_name in ('title', 'domain', 'tags')`,
  );
  assert.equal(cols.length, 3, "миграция 0089 (title/domain/tags у attachment) не применена цепочкой — сценарию A3 не на чем стоять");

  const P = "00000000-0000-4000-8000-0000000000a1";
  const T = "2026-09-08T10:00:00.123456Z";
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
  ];
  // Шестая строка — про ЭКРАНИРОВАНИЕ, а не про объём: «Акт 1005» содержит
  // подстроку «100» без знака процента. Пока такая строка была одна («ООО
  // 100% предоплата»), экранированный и неэкранированный шаблон давали
  // ОДИН результат, и проверка «`100%` — литерал» проходила вакуумно.
  await run(
    `insert into attachment (id, owner_type, owner_id, kind, storage_key, mime, bytes, created_by, created_at, title, domain, tags) values
      ($1, 'person', $7, 'doc', 'k1', 'application/pdf', 10, 'bot', $8, 'Дебиторка GLOBERENT за август', 'globerent', '["bot"]'),
      ($2, 'person', $7, 'doc', 'k2', 'application/pdf', 10, 'bot', $8, 'ООО 100% предоплата', 'vendhub', '["bot"]'),
      ($3, 'person', $7, 'doc', 'k3', 'application/pdf', 10, 'bot', $8, 'Накопления', 'personal', '[]'),
      ($4, 'entity', $7, 'photo', 'k4', 'image/jpeg', 10, 'staff', '2026-09-07T10:00:00Z', null, null, '[]'),
      ($5, 'person', $7, 'doc', 'k5', 'application/pdf', 10, 'bot', '2026-09-09T10:00:00Z', 'дебиторка сентябрь', null, '[]'),
      ($6, 'person', $7, 'doc', 'k6', 'application/pdf', 10, 'bot', $8, 'Акт 1005 по аренде', null, '[]')`,
    [...ids, P, T],
  );
  const svc = new ArtifactsService(db);

  // 1. Три страницы по 2: стык страниц приходится на три строки с равным created_at.
  const seen = [];
  let cursor;
  let pages = 0;
  for (;;) {
    const page = await svc.list({ limit: 2, ...(cursor ? { cursor } : {}) });
    pages += 1;
    for (const it of page.items) {
      assert.ok(!seen.includes(it.id), `строка ${it.id} пришла дважды — страницы пересеклись`);
      seen.push(it.id);
    }
    if (page.next === null) break;
    cursor = page.next;
    assert.ok(pages < 10, "курсор зациклился");
  }
  // Шесть строк по две — ТРИ полные порции и ПУСТАЯ ЧЕТВЁРТАЯ: на объёме,
  // кратном странице, последняя порция полна, и курсор у неё не null. Это не
  // дефект — это цена «лишний пустой запрос дешевле пропущенной строки»; и
  // ровно поэтому подпись витрины говорит «ВОЗМОЖНО, это не весь архив»
  // (круг починок 3, A-3), а не утверждает.
  assert.equal(pages, 4, `страниц ${pages}, ожидалось 4 (последняя пустая)`);
  assert.deepEqual([...seen].sort(), [...ids].sort(), "все шесть строк ровно по разу");
  assert.deepEqual(seen.slice(0, 3), [ids[4], ids[5], ids[2]], "новые сверху, при равном времени — id desc");

  // 2. Поиск: регистр кириллицы и подстановочные знаки — литералы.
  const q1 = await svc.list({ q: "дебиторка" });
  assert.deepEqual(q1.items.map((i) => i.id).sort(), [ids[0], ids[4]].sort(), "ILIKE обязан сворачивать кириллицу");
  const q2 = await svc.list({ q: "100%" });
  assert.deepEqual(q2.items.map((i) => i.id), [ids[1]], "«100%» — литерал, а не «всё, что начинается со 100»");
  const q3 = await svc.list({ q: "100_" });
  assert.deepEqual(q3.items, [], "«_» — литерал");

  // 3. Личный контур вырезан, NULL-домен полевого контура остался.
  const open = await svc.list({}, { excludePersonal: true });
  assert.deepEqual(open.items.map((i) => i.id).sort(), [ids[0], ids[1], ids[3], ids[4], ids[5]].sort());

  // 4. Фильтры по одному.
  assert.deepEqual((await svc.list({ kind: "photo" })).items.map((i) => i.id), [ids[3]]);
  assert.deepEqual((await svc.list({ domain: "vendhub" })).items.map((i) => i.id), [ids[1]]);
  assert.deepEqual((await svc.list({ ownerType: "entity", ownerId: P })).items.map((i) => i.id), [ids[3]]);
  assert.deepEqual((await svc.list({ from: new Date("2026-09-09T00:00:00Z") })).items.map((i) => i.id), [ids[4]]);
  assert.deepEqual((await svc.list({ to: new Date("2026-09-07T23:59:59Z") })).items.map((i) => i.id), [ids[3]]);

  // 5. Форма строки и курсор.
  const first = (await svc.list({ limit: 1 })).items[0];
  assert.equal("storageKey" in first, false, "ключ хранилища наружу не едет");
  assert.deepEqual(first.tags, []);
  assert.equal(typeof first.createdAt, "string");
  const c = decodeCursor((await svc.list({ limit: 1 })).next);
  assert.equal(c.id, ids[4]);
  // Микросекунды в курсоре — из САМОЙ базы (`to_char … '.US'`), а не пересказ
  // через JS `Date`: иначе страница за курсором теряет строки (A-4).
  assert.match(c.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/, `курсор без микросекунд: ${c.createdAt}`);
  const мкс = await svc.list({ limit: 1, cursor: (await svc.list({ limit: 1 })).next });
  assert.deepEqual(мкс.items.map((i) => i.id), [ids[5]], "первая строка равного времени обязана прийти следом");

  console.log(`A3 (${ENGINE}): страницы архива не пересекаются на равном created_at, поиск сворачивает кириллицу, storageKey наружу не едет ✔`);
} finally {
  await close();
}
