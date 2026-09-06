import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { EventsController, ListEventsDto } from "./events.controller";

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

  it("лимит зажат: потолок 200, мусор — умолчание 50", async () => {
    // Пайп такие значения отобьёт 400 (ниже), но контроллер не должен быть
    // без него беззащитным: NaN уехал бы в `limit NaN` и вернул 500 вместо ленты.
    const huge = stub();
    await huge.controller.list({ limit: 5000 });
    assert.equal(huge.calls[0]?.limit, 200);

    for (const bad of [0, -5, Number("abc"), 10.5]) {
      const junk = stub();
      await junk.controller.list({ limit: bad });
      assert.equal(
        junk.calls[0]?.limit,
        bad === 10.5 ? 10 : 50,
        `limit=${bad} — это «не задан», а не пустая лента`,
      );
    }
  });

  it("без параметров лента не сужается ни одним отбором", async () => {
    // Регресс-страховка волны A1: новые поля не должны появляться в фильтре
    // сами по себе — пустой `?` обязан читать всю ленту, а не её кусок.
    const { controller, calls } = stub();
    await controller.list({});
    const filter = calls[0]!;
    for (const key of ["source", "type", "typePrefix", "since", "until", "types", "after"]) {
      assert.equal(key in filter, false, `пустой запрос не должен сужать ленту по ${key}`);
    }
    assert.deepEqual(filter, { limit: 50, order: "desc" }, "остаются только заявленные рамки выборки");
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
