import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { EventsService } from "./events.service";
import { EventsController, FilterEventsDto, ListEventsDto } from "./events.controller";

type Filter = Record<string, unknown>;

/** Стаб сервиса: копит фильтр, чтобы видеть, что контроллер до него донёс. */
function stub() {
  const calls: Filter[] = [];
  const events = {
    list: async (filter: Filter) => {
      calls.push(filter);
      return [];
    },
    count: async (filter: Filter) => {
      calls.push(filter);
      return 0;
    },
    latest: async (filter: Filter) => {
      calls.push(filter);
      return undefined;
    },
  };
  return { controller: new EventsController(events as never), calls };
}

/** Стаб выборки: запоминает предел, дошедший до самой базы. */
function listStub() {
  const captured: { limit: number | null } = { limit: null };
  const chain = {
    where: () => chain,
    orderBy: () => chain,
    limit: async (n: number) => {
      captured.limit = n;
      return [];
    },
  };
  const db = { select: () => ({ from: () => chain }) } as never;
  return { db, captured };
}

/**
 * Проверки ДТО через НАСТОЯЩИЙ `ValidationPipe` с опциями из `main.ts`: голый
 * `validate()` не включает `forbidNonWhitelisted` и не приводит типы, поэтому
 * не увидел бы ни отказа на `?order=вверх`, ни превращения «50» в число.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const черезПайп = (query: Record<string, unknown>): Promise<ListEventsDto> =>
  pipe.transform(query, { type: "query", metatype: ListEventsDto, data: "" }) as Promise<ListEventsDto>;

/**
 * Текст отказа пайпа. Сообщения лежат в ТЕЛЕ ответа, а у самой ошибки message
 * всегда «Bad Request Exception»: проверка по ней зеленела бы на любом отказе,
 * в том числе не на том поле, о котором тест.
 */
async function отказПайпа(query: Record<string, unknown>): Promise<string> {
  try {
    await черезПайп(query);
  } catch (e) {
    const body = (e as BadRequestException).getResponse();
    const messages = (body as { message?: unknown }).message;
    return Array.isArray(messages) ? messages.join("; ") : String(messages ?? body);
  }
  throw new Error(`ожидали отказ на ${JSON.stringify(query)}`);
}

describe("GET /events — фильтры доходят до сервиса", () => {
  it("источник доезжает до выборки — раньше он молча терялся", async () => {
    // `?source=` объявлялся в ДТО и работал в /events/count и /events/latest,
    // а в самой ленте отбрасывался: владелец видел чужие события под своим
    // фильтром и считал, что смотрит один источник.
    const { controller, calls } = stub();
    await controller.list({ source: "agent:vendhub-ops" });
    assert.equal(calls[0]?.source, "agent:vendhub-ops");
  });

  it("префикс типа, окно и порядок доезжают своими значениями", async () => {
    const { controller, calls } = stub();
    await controller.list({
      typePrefix: "agent.memory:",
      since: "2026-09-01T00:00:00.000Z",
      until: "2026-09-06T00:00:00.000Z",
      order: "asc",
      limit: 25,
    });
    const filter = calls[0]!;
    assert.equal(filter.typePrefix, "agent.memory:");
    assert.ok(filter.since instanceof Date, "since уходит датой, а не строкой");
    assert.ok(filter.until instanceof Date, "until уходит датой, а не строкой");
    assert.equal((filter.since as Date).toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal((filter.until as Date).toISOString(), "2026-09-06T00:00:00.000Z");
    assert.equal(filter.order, "asc");
    assert.equal(filter.limit, 25);
  });

  it("лимит зажат потолком, мусор считается «не задан»", async () => {
    // Пайп такие значения отобьёт 400 (ниже), но контроллер не должен быть
    // без него беззащитным: NaN уехал бы в `limit NaN` и вернул 500 вместо ленты.
    const huge = stub();
    await huge.controller.list({ limit: 5000 });
    assert.equal(huge.calls[0]?.limit, 200);

    const fraction = stub();
    await fraction.controller.list({ limit: 10.5 });
    assert.equal(fraction.calls[0]?.limit, 10, "дробь драйвер не примет в LIMIT");

    for (const bad of [0, -5, Number("abc")]) {
      const junk = stub();
      await junk.controller.list({ limit: bad });
      assert.equal(
        "limit" in junk.calls[0]!,
        false,
        `limit=${bad} — это «не задан»: умолчание остаётся за сервисом, а не пустая лента`,
      );
    }
  });

  it("без параметров лента не сужается ни одним отбором", async () => {
    // Регресс-страховка волны A1: новые поля не должны появляться в фильтре
    // сами по себе — пустой `?` обязан читать всю ленту, а не её кусок.
    const { controller, calls } = stub();
    await controller.list({});
    const filter = calls[0]!;
    for (const key of ["source", "type", "typePrefix", "since", "until", "types", "after", "limit"]) {
      assert.equal(key in filter, false, `пустой запрос не должен сужать ленту по ${key}`);
    }
    assert.deepEqual(filter, { order: "desc" }, "порядок и был убыванием — остальное решает сервис");
  });

  it("без ?limit= у базы просят столько же строк, сколько до волны A1", async () => {
    // Умолчание принадлежит сервису и НЕ переезжает в контроллер: новому
    // клиенту (MCP) нужна страница поменьше — он присылает предел явно.
    // Сдвинь умолчание «ради удобства» — и `CoreClient.listEvents`
    // (memory-rag) начал бы молча видеть меньше событий, чем вчера.
    const прежде = listStub();
    await new EventsService(прежде.db).list();
    assert.equal(прежде.captured.limit, 100, "умолчание сервиса — то же, что до волны A1");

    const черезКонтроллер = listStub();
    await new EventsController(new EventsService(черезКонтроллер.db)).list({});
    assert.equal(
      черезКонтроллер.captured.limit,
      прежде.captured.limit,
      "лента без ?limit= обязана просить у базы ровно столько же строк",
    );

    const сПределом = listStub();
    await new EventsController(new EventsService(сПределом.db)).list({ limit: 25 });
    assert.equal(сПределом.captured.limit, 25, "явный предел клиента доезжает до базы");
  });
});

describe("ListEventsDto через ValidationPipe (main.ts: whitelist + forbidNonWhitelisted)", () => {
  it("строка запроса приводится к типам: limit становится числом", async () => {
    const dto = await черезПайп({ source: "agent:a", typePrefix: "agent.memory:", limit: "50", order: "desc" });
    assert.equal(dto.limit, 50);
    assert.equal(typeof dto.limit, "number");
    assert.equal(dto.typePrefix, "agent.memory:");
    assert.equal(dto.order, "desc");
  });

  it("порядок вне asc|desc отвергается, а не уезжает в SQL", async () => {
    assert.match(await отказПайпа({ order: "вверх" }), /order: asc \| desc/);
    assert.equal((await черезПайп({ order: "asc" })).order, "asc");
  });

  it("лимит вне 1…200 и не-число отвергаются", async () => {
    for (const bad of ["500", "0", "-3", "abc", "10.5"]) {
      assert.match(await отказПайпа({ limit: bad }), /limit/, `limit=${bad} обязан быть отвергнут по имени поля`);
    }
  });

  it("незнакомое поле — 400, опечатка в фильтре не уходит в тишину", async () => {
    assert.match(await отказПайпа({ typeprefix: "agent.memory:" }), /typeprefix/);
  });

  it("until — дата ISO, иначе 400 вместо 500 от драйвера", async () => {
    assert.match(await отказПайпа({ until: "вчера" }), /until/);
    assert.equal((await черезПайп({ until: "2026-09-06T00:00:00.000Z" })).until, "2026-09-06T00:00:00.000Z");
  });
});

describe("Счётчик и «самое свежее» не молчат о полях, которых не учитывают", () => {
  // Общее ДТО с лентой означало бы, что `?typePrefix=` на /events/count
  // проходит валидацию и НЕ сужает счёт: ответ выглядел бы здоровым и был бы
  // неверным. Молчаливое игнорирование хуже 400 — у вызывающего не остаётся
  // ни одной подсказки, поэтому у этих маршрутов своё узкое ДТО.
  const узкийПайп = (query: Record<string, unknown>) =>
    pipe.transform(query, { type: "query", metatype: FilterEventsDto, data: "" });

  const отказУзкого = async (query: Record<string, unknown>): Promise<string> => {
    try {
      await узкийПайп(query);
    } catch (e) {
      const body = (e as BadRequestException).getResponse();
      const messages = (body as { message?: unknown }).message;
      return Array.isArray(messages) ? messages.join("; ") : String(messages ?? body);
    }
    throw new Error(`ожидали отказ на ${JSON.stringify(query)}`);
  };

  /** Какое ДТО Nest реально привяжет к маршруту — метаданные его сигнатуры. */
  const дтоМаршрута = (method: "list" | "count" | "latest"): unknown =>
    (Reflect.getMetadata("design:paramtypes", EventsController.prototype, method) as unknown[])[0];

  it("GET /events/count отвергает поля, которых не учитывает", async () => {
    assert.equal(дтоМаршрута("count"), FilterEventsDto, "счётчик обязан брать узкое ДТО");
    for (const поле of ["typePrefix", "until", "order", "limit"]) {
      assert.match(await отказУзкого({ [поле]: "1" }), new RegExp(поле), `${поле} обязан быть отвергнут`);
    }
    assert.equal((await узкийПайп({ source: "agent:a", type: "agent.action" })).source, "agent:a");
  });

  it("GET /events/latest отвергает поля, которых не учитывает", async () => {
    assert.equal(дтоМаршрута("latest"), FilterEventsDto, "«самое свежее» обязано брать узкое ДТО");
    assert.match(await отказУзкого({ typePrefix: "agent.memory:" }), /typePrefix/);
  });

  it("лента, наоборот, берёт широкое ДТО — иначе её собственные поля отбились бы", () => {
    assert.equal(дтоМаршрута("list"), ListEventsDto);
  });
});
