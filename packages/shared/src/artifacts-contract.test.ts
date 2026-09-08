import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARTIFACTS_Q_MAX, ATTACHMENT_KINDS } from "./artifacts-contract";

/**
 * ЗДЕСЬ — ДОМ ЗНАЧЕНИЙ, ПОЭТОМУ ЗДЕСЬ И ЛИТЕРАЛ.
 *
 * Потребители (`UploadDto.kind` в Core, фильтр витрины, список формы панели)
 * сверяются с ЭТИМ модулем, а не каждый со своим литералом — иначе тест
 * доказывает лишь то, что автор дважды набрал одно и то же (круг починок 3,
 * B-1). Пин здесь ловит обратное: молчаливую правку самого договора.
 */
describe("Договор кольца артефактов", () => {
  it("виды вложений — ровно три, в порядке хранения", () => {
    assert.deepEqual([...ATTACHMENT_KINDS], ["photo", "receipt", "doc"]);
  });

  it("предел строки поиска — 200 символов", () => {
    assert.equal(ARTIFACTS_Q_MAX, 200);
  });
});
