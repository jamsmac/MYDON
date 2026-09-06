import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs } from "./args";

describe("parseArgs (R-A1-3): разбор аргументов CLI", () => {
  it("--limit 5 и --limit=5 дают одно и то же значение", () => {
    const a = parseArgs(["events", "--limit", "5"]);
    const b = parseArgs(["events", "--limit=5"]);
    assert.deepEqual(a.flags, b.flags);
    assert.equal(a.flags.limit, "5");
  });

  it("--yes — булев флаг, не съедает следующий токен как значение", () => {
    const { flags, positional } = parseArgs(["decide", "appr-1", "approved", "--yes"]);
    assert.equal(flags.yes, true);
    assert.deepEqual(positional, ["appr-1", "approved"]);
  });

  it("--json — булев флаг, не съедает следующий позиционный аргумент", () => {
    const parsed = parseArgs(["tasks", "--json", "лишнее"]);
    assert.equal(parsed.flags.json, true);
    assert.deepEqual(parsed.positional, ["лишнее"]);
  });

  it("неизвестный флаг --limt даёт ошибку с подсказкой на --limit", () => {
    assert.throws(
      () => parseArgs(["events", "--limt", "5"]),
      /неизвестный флаг --limt; возможно, вы имели в виду --limit/,
    );
  });

  it("неизвестный флаг без похожего известного — ошибка без ложной подсказки", () => {
    assert.throws(() => parseArgs(["events", "--zzzqqqxxx"]), /неизвестный флаг --zzzqqqxxx/);
    assert.throws(
      () => parseArgs(["events", "--zzzqqqxxx"]),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.doesNotMatch(e.message, /возможно, вы имели в виду/);
        return true;
      },
    );
  });

  it("позиционные аргументы сохраняют порядок", () => {
    const { command, positional } = parseArgs(["decide", "approval-1", "approved"]);
    assert.equal(command, "decide");
    assert.deepEqual(positional, ["approval-1", "approved"]);
  });

  it("команда — первый токен, дальше без аргументов — пустые позиционные и флаги", () => {
    const parsed = parseArgs(["inbox"]);
    assert.equal(parsed.command, "inbox");
    assert.deepEqual(parsed.positional, []);
    assert.deepEqual(parsed.flags, {});
  });

  it("пустой argv — пустая команда, без падения", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.command, "");
    assert.deepEqual(parsed.positional, []);
  });

  it("значение-флаг без явного значения в конце строки — тоже true", () => {
    const parsed = parseArgs(["task-create", "--title"]);
    assert.equal(parsed.flags.title, true);
  });

  it("значение-флаг не путает следующий флаг с собственным значением", () => {
    const parsed = parseArgs(["tasks", "--status", "--owner", "jamshid"]);
    // `--status` не должен «съесть» `--owner` как своё значение.
    assert.equal(parsed.flags.status, true);
    assert.equal(parsed.flags.owner, "jamshid");
  });

  it("несколько флагов вперемешку с позиционными сохраняют оба списка верно", () => {
    const parsed = parseArgs(["search", "остатки", "--domain", "vendhub", "--limit=10"]);
    assert.deepEqual(parsed.positional, ["остатки"]);
    assert.equal(parsed.flags.domain, "vendhub");
    assert.equal(parsed.flags.limit, "10");
  });
});
