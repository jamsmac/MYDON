import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { first } from "./query-param";

describe("first — параметр строки запроса", () => {
  it("строку возвращает как есть", () => {
    assert.equal(first("vendhub-ops"), "vendhub-ops");
  });

  it("повторённый параметр сводит к первому значению, а не к массиву", () => {
    // Массив уехал бы в `eq(column, [...])` и вернул 500 от драйвера.
    assert.equal(first(["vendhub-ops", "vendhub-ceo"]), "vendhub-ops");
  });

  it("пустая строка — «не задан», а не фильтр по пустому имени", () => {
    assert.equal(first(""), undefined);
    assert.equal(first([""]), undefined);
  });

  it("отсутствие и не-строка — undefined", () => {
    assert.equal(first(undefined), undefined);
    assert.equal(first(null), undefined);
    assert.equal(first(42), undefined);
    assert.equal(first([]), undefined);
    assert.equal(first({ agent: "x" }), undefined);
  });
});
