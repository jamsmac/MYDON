import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  ARTIFACT_KINDS,
  ArtifactsService,
  LIST_MAX,
  decodeCursor,
  encodeCursor,
  titleMatches,
} from "./artifacts.service";

type Row = Record<string, unknown>;

/** Стаб выборки: запоминает столбцы, условие, порядок и limit; отдаёт заданные строки. */
function listStub(rows: Row[] = []) {
  const captured: {
    columns: Record<string, unknown> | undefined;
    where: unknown;
    orderBy: unknown[];
    limit: number | null;
    selects: number;
  } = { columns: undefined, where: undefined, orderBy: [], limit: null, selects: 0 };
  const chain = {
    where: (c: unknown) => {
      captured.where = c;
      return chain;
    },
    orderBy: (...o: unknown[]) => {
      captured.orderBy = o;
      return chain;
    },
    limit: async (n: number) => {
      captured.limit = n;
      return rows;
    },
  };
  const db = {
    select: (columns: Record<string, unknown>) => {
      captured.selects += 1;
      captured.columns = columns;
      return { from: () => chain };
    },
  } as never;
  return { db, captured };
}

/** Текст и параметры условия — заглушка SQL не исполняет, а перепутанный столбец обязан падать. */
function render(query: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
}

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const AT = new Date("2026-09-08T10:00:00.000Z");
const NOW = new Date("2026-09-08T12:00:00.000Z");

/**
 * Время в форме, в которой его печатает САМА БАЗА (`to_char … '.US'`): шесть
 * знаков доли секунды. Драйвер отдаёт рядом ещё и `Date`, но он теряет
 * микросекунды — фикстура обязана отличать одно от другого, иначе сторож
 * курсора слеп ровно к тому дефекту, который чинил круг 3 (A-4).
 */
const мкс = (d: Date, микро = "000"): string => `${d.toISOString().slice(0, -1)}${микро}Z`;

/** Строка, как если бы её вернул `select *`: storageKey внутри — наружу уезжать не должен. */
const row = (id: string, over: Row = {}): Row => {
  const base: Row = {
    id,
    ownerType: "person",
    ownerId: ID1,
    kind: "doc",
    title: "Дебиторка GLOBERENT за август",
    domain: "globerent",
    tags: ["bot"],
    mime: "application/pdf",
    bytes: 12345,
    createdBy: "bot",
    createdAt: AT,
    storageKey: "person/x/f.pdf",
    ...over,
  };
  // Служебный столбец курсора идёт из того же времени, если его не задали
  // явно: так фикстура остаётся согласованной, а тесту про микросекунды
  // ничто не мешает подставить своё.
  return { createdAtCursor: мкс(base.createdAt as Date), ...base };
};

describe("ArtifactsService.list — рамки страницы", () => {
  it("по умолчанию 50, потолок LIST_MAX, мусорный limit не уезжает в SQL", async () => {
    const plain = listStub();
    await new ArtifactsService(plain.db).list();
    assert.equal(plain.captured.limit, 50);
    assert.equal(plain.captured.where, undefined, "без фильтров условие не добавляем");

    const huge = listStub();
    await new ArtifactsService(huge.db).list({ limit: 5000 });
    assert.equal(huge.captured.limit, LIST_MAX);

    for (const bad of [Number("abc"), 0, -5]) {
      const s = listStub();
      await new ArtifactsService(s.db).list({ limit: bad });
      assert.equal(s.captured.limit, 50, `limit=${bad} — это «не задан», а не пустой архив и не 500`);
    }
    const fraction = listStub();
    await new ArtifactsService(fraction.db).list({ limit: 10.5 });
    assert.equal(fraction.captured.limit, 10, "дробь драйвер не примет в LIMIT");
  });

  it("новые сверху: порядок — created_at desc, id desc (та же пара, что режет курсор)", async () => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list();
    assert.equal(captured.orderBy.length, 2, "сортировка по одному created_at не даёт устойчивых страниц");
    assert.match(render(captured.orderBy[0]).sql, /"attachment"\."created_at" desc/);
    assert.match(render(captured.orderBy[1]).sql, /"attachment"\."id" desc/);
  });

  it("часы Core уезжают в ответ строкой ISO", async () => {
    const { db } = listStub();
    const page = await new ArtifactsService(db).list({}, { now: NOW });
    assert.equal(page.now, "2026-09-08T12:00:00.000Z");
  });

  it("типы вложений — те же, что принимает UploadDto.kind", () => {
    assert.deepEqual([...ARTIFACT_KINDS], ["photo", "receipt", "doc"]);
  });
});

describe("ArtifactsService.list — каждый фильтр своим столбцом", () => {
  const one = async (filter: Parameters<ArtifactsService["list"]>[0]) => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list(filter);
    return render(captured.where);
  };

  it("kind", async () => {
    const { sql, params } = await one({ kind: "doc" });
    assert.match(sql, /^"attachment"\."kind" = \$1$/);
    assert.deepEqual(params, ["doc"]);
  });

  it("ownerType", async () => {
    const { sql, params } = await one({ ownerType: "person" });
    assert.match(sql, /^"attachment"\."owner_type" = \$1$/);
    assert.deepEqual(params, ["person"]);
  });

  it("ownerId", async () => {
    const { sql, params } = await one({ ownerId: ID1 });
    assert.match(sql, /^"attachment"\."owner_id" = \$1$/);
    assert.deepEqual(params, [ID1]);
  });

  it("domain", async () => {
    const { sql, params } = await one({ domain: "vendhub" });
    assert.match(sql, /^"attachment"\."domain" = \$1$/);
    assert.deepEqual(params, ["vendhub"]);
  });

  it("from и to — окно по created_at, включительно с обеих сторон", async () => {
    const from = await one({ from: AT });
    assert.match(from.sql, /^"attachment"\."created_at" >= \$1$/);
    // Параметры-даты драйвер получает строками ISO — так их маппит колонка timestamp.
    assert.deepEqual(from.params, [AT.toISOString()]);
    const to = await one({ to: AT });
    assert.match(to.sql, /^"attachment"\."created_at" <= \$1$/);
    const both = await one({ from: AT, to: NOW });
    assert.match(both.sql, /"created_at" >= \$1 and "attachment"\."created_at" <= \$2/);
  });

  it("q — ILIKE по title с экранированием и явной коллацией", async () => {
    const { sql, params } = await one({ q: "Дебиторка 100%_" });
    assert.match(sql, /^"attachment"\."title" ILIKE \$1 ESCAPE '\\' COLLATE "pg_c_utf8"$/);
    assert.deepEqual(params, ["%Дебиторка 100\\%\\_%"]);
  });

  it("все шесть вместе — шесть условий, ни одно не потерялось", async () => {
    const { sql, params } = await one({
      kind: "doc",
      ownerType: "person",
      ownerId: ID1,
      domain: "globerent",
      from: AT,
      to: NOW,
    });
    assert.equal(params.length, 6);
    for (const col of ["kind", "owner_type", "owner_id", "domain"]) {
      assert.match(sql, new RegExp(`"attachment"\\."${col}" = \\$\\d`), `фильтр по ${col} потерян`);
    }
    assert.match(sql, /"created_at" >= \$\d/);
    assert.match(sql, /"created_at" <= \$\d/);
  });

  it("excludePersonal вырезает личный контур через is distinct from (NULL-домен остаётся)", async () => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list({}, { excludePersonal: true });
    assert.match(render(captured.where).sql, /^"attachment"\."domain" is distinct from 'personal'$/);

    const open = listStub();
    await new ArtifactsService(open.db).list({ kind: "doc" }, { excludePersonal: false });
    assert.doesNotMatch(render(open.captured.where).sql, /personal/, "по умолчанию выдача прода не меняется");
  });
});

describe("titleMatches — подстановочные знаки и регистр кириллицы", () => {
  it("экранирует %, _ и обратную косую", () => {
    assert.deepEqual(render(titleMatches("100%")).params, ["%100\\%%"]);
    assert.deepEqual(render(titleMatches("ООО _Строй")).params, ["%ООО \\_Строй%"]);
    assert.deepEqual(render(titleMatches("путь\\файл")).params, ["%путь\\\\файл%"]);
    assert.deepEqual(render(titleMatches("Глоберент")).params, ["%Глоберент%"]);
  });

  it("коллация встроенная (pg_c_utf8), а не ICU: сценарии идут и на pglite, где ICU нет", () => {
    const { sql } = render(titleMatches("тест"));
    assert.match(sql, /ILIKE/);
    assert.match(sql, /ESCAPE '\\'/);
    assert.match(sql, /COLLATE "pg_c_utf8"/);
    assert.doesNotMatch(sql, /und-x-icu/);
  });
});

describe("Курсор — кортеж (created_at, id)", () => {
  it("кодируется base64url и разбирается обратно без потерь — включая микросекунды", () => {
    // МИКРОСЕКУНДЫ — НЕСУЩАЯ ЧАСТЬ (круг починок 3, A-4): `created_at` пишет
    // `now()`, то есть шесть знаков доли секунды. Пока курсор печатался через
    // `Date.toISOString()`, шестая цифра терялась, и строка с тем же
    // миллисекундным срезом времени не попадала НИ в «раньше», НИ в «равно» —
    // страница за курсором её не видела вовсе.
    const момент = "2026-09-08T10:00:00.123456Z";
    const cur = encodeCursor({ createdAtCursor: момент, id: ID1 });
    assert.match(cur, /^[A-Za-z0-9_-]+$/, "в строке запроса не должно быть +, / и =");
    assert.deepEqual(decodeCursor(cur), { createdAt: момент, id: ID1 });
    assert.equal(Buffer.from(cur, "base64url").toString("utf8"), `${момент}|${ID1}`);
    assert.equal(
      decodeCursor(cur)?.createdAt,
      момент,
      "разбор обязан вернуть тот же момент, а не его миллисекундную копию",
    );
  });

  it("испорченный курсор — null, а не Invalid Date в SQL", () => {
    for (const bad of ["", "abc", Buffer.from("|").toString("base64url"), Buffer.from("вчера|" + ID1).toString("base64url"),
      Buffer.from(AT.toISOString() + "|not-uuid").toString("base64url"), Buffer.from(AT.toISOString()).toString("base64url"),
      // Момент едет в SQL параметром с `::timestamptz`: форма без «Z», лишние
      // знаки доли секунды и несуществующий день дали бы 22P02 драйвера (500)
      // вместо честного 400.
      Buffer.from("2026-09-08 10:00:00|" + ID1).toString("base64url"),
      Buffer.from("2026-09-08T10:00:00.1234567Z|" + ID1).toString("base64url"),
      Buffer.from("2026-02-30T10:00:00Z|" + ID1).toString("base64url")]) {
      assert.equal(decodeCursor(bad), null, `«${bad}» обязан быть отвергнут`);
    }
  });

  it("испорченный курсор в list → 400, база не тронута", async () => {
    const { db, captured } = listStub();
    await assert.rejects(() => new ArtifactsService(db).list({ cursor: "abc" }), BadRequestException);
    assert.equal(captured.selects, 0);
  });

  it("условие страницы — строго раньше кортежа по тем же столбцам, что ORDER BY", async () => {
    const { db, captured } = listStub();
    const момент = "2026-09-08T10:00:00.123456Z";
    await new ArtifactsService(db).list({ cursor: encodeCursor({ createdAtCursor: момент, id: ID2 }) });
    const { sql, params } = render(captured.where);
    assert.match(
      sql,
      /^\("attachment"\."created_at" < \$1::timestamptz or \("attachment"\."created_at" = \$2::timestamptz and "attachment"\."id" < \$3\)\)$/,
    );
    // Параметры — СТРОКИ полной точности, а не `Date.toISOString()`: через
    // маппер колонки в SQL уехала бы миллисекундная копия, и ветка равенства
    // на живых строках не срабатывала бы никогда (A-4).
    assert.deepEqual(params, [момент, момент, ID2]);
  });

  it("next — курсор последней строки, только когда строк ровно limit", async () => {
    const раньше = new Date(AT.getTime() - 1000);
    const full = listStub([row(ID1), row(ID2, { createdAt: раньше })]);
    const page = await new ArtifactsService(full.db).list({ limit: 2 });
    assert.notEqual(page.next, null);
    assert.deepEqual(decodeCursor(page.next ?? ""), { createdAt: мкс(раньше), id: ID2 });

    const short = listStub([row(ID1)]);
    assert.equal((await new ArtifactsService(short.db).list({ limit: 2 })).next, null);

    const empty = listStub([]);
    assert.equal((await new ArtifactsService(empty.db).list({ limit: 2 })).next, null);
  });

  it("две страницы не пересекаются: вторая режется строго после последней строки первой", async () => {
    // Три строки с РАВНЫМ created_at — тот случай, где курсор по одному
    // времени терял бы или дублировал строку. Порядок базы: id desc.
    const первая = listStub([row(ID3), row(ID2)]);
    const p1 = await new ArtifactsService(первая.db).list({ limit: 2 });
    assert.deepEqual(p1.items.map((i) => i.id), [ID3, ID2]);

    const вторая = listStub([row(ID1)]);
    const p2 = await new ArtifactsService(вторая.db).list({ limit: 2, cursor: p1.next ?? "" });
    const { params } = render(вторая.captured.where);
    // Граница второй страницы — ровно последняя строка первой, сравнение строгое:
    // ID2 в неё попасть не может, ID1 (< ID2 при равном времени) — попадает.
    assert.deepEqual(params, [мкс(AT), мкс(AT), ID2]);
    assert.deepEqual(p2.items.map((i) => i.id), [ID1]);
    assert.equal(p2.next, null);
    const всего = new Set([...p1.items, ...p2.items].map((i) => i.id));
    assert.equal(всего.size, 3);
  });
});

describe("Форма строки — без storageKey и без содержимого", () => {
  it("в выборке нет столбца storage_key, в ответе нет ключа storageKey", async () => {
    const { db, captured } = listStub([row(ID1)]);
    const page = await new ArtifactsService(db).list();
    const columns = Object.keys(captured.columns ?? {});
    assert.ok(!columns.includes("storageKey"), "storage_key не должен выбираться из базы");
    assert.deepEqual(columns.sort(), [
      // `createdAtCursor` — служебный столбец курсора (`to_char … '.US'`):
      // в выборке он есть, в строке наружу — нет (проверка ниже).
      "bytes", "createdAt", "createdAtCursor", "createdBy", "domain", "id", "kind", "mime", "ownerId", "ownerType", "tags", "title",
    ]);
    assert.deepEqual(Object.keys(page.items[0] ?? {}).sort(), [
      "bytes", "createdAt", "createdBy", "domain", "id", "kind", "mime", "ownerId", "ownerType", "tags", "title",
    ]);
    assert.equal(page.items[0]?.createdAt, "2026-09-08T10:00:00.000Z", "дата — строкой ISO, а не Date");
  });

  it("теги — всегда список строк, даже если в jsonb положили не то", async () => {
    const { db } = listStub([
      row(ID1, { tags: ["bot", 7, null, "vendhub"] }),
      row(ID2, { tags: { a: 1 } }),
      row(ID3, { tags: null, title: null, domain: null }),
    ]);
    const page = await new ArtifactsService(db).list();
    assert.deepEqual(page.items.map((i) => i.tags), [["bot", "vendhub"], [], []]);
    assert.equal(page.items[2]?.title, null);
    assert.equal(page.items[2]?.domain, null);
  });
});
