import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  collectFindings,
  parsePorcelainUntracked,
  renderAudit,
  unquotePath,
  upsertSection,
} from "./repo-audit.mjs";

const findings = {
  date: "2026-09-08",
  staleBranches: [{ name: "origin/feat/old", days: 41 }],
  worktrees: ["/tmp/wt-a"],
  untracked: { count: 3, sample: [".agents/skills/x", "notes.md", "tmp.log"] },
  specsWithoutDecision: ["docs/superpowers/specs/2026-08-01-foo-design.md"],
  plansWithoutLedger: [],
  migrationsNotInJournal: ["0089_x.sql"],
  passports: { ok: false, output: "vendhub-ops: расписание зовёт навык «x»" },
  staleQuestions: [{ heading: "2026-06-01 — что с RAG", days: 99 }],
};

describe("renderAudit", () => {
  it("секция с датой, счётчиками и списками; пустые группы — «нет»", () => {
    const md = renderAudit(findings);
    assert.match(md, /^## Аудит репо 2026-09-08/m);
    assert.match(md, /Ветки старше 30 дней \(1\)/);
    assert.match(md, /origin\/feat\/old — 41 дн/);
    assert.match(md, /Планы без леджера \(0\): нет/);
    assert.match(md, /Паспорта: ПРОБЛЕМЫ/);
    assert.match(md, /2026-06-01 — что с RAG — 99 дн/);
  });

  it("без errors предупреждения нет", () => {
    assert.doesNotMatch(renderAudit(findings), /Проверки не выполнены/);
  });

  it("сорванная проверка — первой строкой, чтобы «(0): нет» не читалось как «чисто»", () => {
    const md = renderAudit({
      ...findings,
      staleBranches: [],
      errors: ["git for-each-ref → exit 128: fatal: not a git repository", "git status → exit 128"],
    });
    const строки = md.split("\n");
    assert.match(строки[2], /^- ⚠️ Проверки не выполнены \(2\): git for-each-ref → exit 128/);
    assert.match(строки[2], /git status → exit 128/);
    // Пустой список рядом с предупреждением остаётся — но теперь понятно, почему он пуст.
    assert.match(md, /Ветки старше 30 дней \(0\): нет/);
  });
});

describe("unquotePath / parsePorcelainUntracked", () => {
  it("восьмеричные escape-последовательности git собираются в UTF-8, а не в мохяброзяблики", () => {
    const кавычки = '"\\321\\200\\320\\260\\320\\261\\320\\276\\321\\202\\320\\260/\\320\\276\\321\\202\\321\\207\\321\\221\\321\\202 \\"\\320\\270\\321\\202\\320\\276\\320\\263\\".md"';
    assert.equal(unquotePath(кавычки), 'работа/отчёт "итог".md');
  });

  it("путь без кавычек отдаётся как есть, пробел внутри имени сохраняется", () => {
    assert.equal(unquotePath("docs/мой отчёт.md"), "docs/мой отчёт.md");
  });

  it("берёт только `??`, не трогает изменённые и не режет хвостовой пробел", () => {
    const вывод = [
      " M apps/core/src/main.ts",
      "?? docs/мой отчёт.md",
      '?? "\\321\\200\\320\\260\\320\\261\\320\\276\\321\\202\\320\\260.md"',
      "?? tmp ",
      "",
    ].join("\n");
    assert.deepEqual(parsePorcelainUntracked(вывод), ["docs/мой отчёт.md", "работа.md", "tmp "]);
  });
});

describe("collectFindings — упавший git виден, а не «всё чисто»", () => {
  it("провал одной команды попадает в errors, остальные проверки идут дальше", async () => {
    const корень = fs.mkdtempSync(path.join(os.tmpdir(), "repo-audit-"));
    try {
      const вызовы = [];
      const exec = (file, args) => {
        вызовы.push([file, ...args].join(" "));
        if (file !== "git") return { code: 0, stdout: "паспорта в порядке\n" };
        // `-c core.quotepath=false` обязан стоять перед подкомандой: без него
        // кириллица в путях вернётся восьмеричными последовательностями.
        assert.deepEqual(args.slice(0, 2), ["-c", "core.quotepath=false"]);
        if (args[2] === "for-each-ref") return { code: 128, stdout: "fatal: not a git repository\n" };
        if (args[2] === "worktree") return { code: 0, stdout: `worktree ${корень}\nworktree /tmp/wt-a\n` };
        return { code: 0, stdout: "?? notes.md\n M src/a.ts\n" };
      };

      const f = await collectFindings(корень, { now: new Date("2026-09-08T05:00:00Z"), exec });

      assert.equal(f.date, "2026-09-08");
      assert.equal(f.errors.length, 1);
      assert.match(f.errors[0], /^git for-each-ref → exit 128: fatal: not a git repository$/);
      assert.deepEqual(f.staleBranches, []);
      // Соседние проверки провалом одной не отменяются.
      assert.deepEqual(f.worktrees, ["/tmp/wt-a"]);
      assert.deepEqual(f.untracked, { count: 1, sample: ["notes.md"] });
      // Ненулевой код у паспортов — находка, а не сорванная проверка.
      assert.equal(f.passports.ok, true);
      assert.ok(вызовы.some((c) => c.startsWith("pnpm --filter @mydon/agents")));
    } finally {
      fs.rmSync(корень, { recursive: true, force: true });
    }
  });

  it("падение паспортов остаётся находкой и в errors не дублируется", async () => {
    const корень = fs.mkdtempSync(path.join(os.tmpdir(), "repo-audit-"));
    try {
      const exec = (file) =>
        file === "git"
          ? { code: 0, stdout: "" }
          : { code: 1, stdout: "vendhub-ops: расписание зовёт навык «x»\n" };
      const f = await collectFindings(корень, { now: new Date("2026-09-08T05:00:00Z"), exec });
      assert.deepEqual(f.errors, []);
      assert.equal(f.passports.ok, false);
      assert.match(f.passports.output, /расписание зовёт навык/);
    } finally {
      fs.rmSync(корень, { recursive: true, force: true });
    }
  });
});

describe("upsertSection", () => {
  const doc = "# Открытые вопросы\n\n## 2026-06-01 — что с RAG\nтекст\n\n## Аудит репо 2026-09-01\nстарое\n";
  it("заменяет секцию той же даты, иначе добавляет в конец", () => {
    const same = upsertSection(doc, "2026-09-01", "## Аудит репо 2026-09-01\nновое\n");
    assert.equal((same.match(/## Аудит репо 2026-09-01/g) ?? []).length, 1);
    assert.match(same, /новое/);
    assert.doesNotMatch(same, /старое/);
    const added = upsertSection(doc, "2026-09-08", "## Аудит репо 2026-09-08\nx\n");
    assert.match(added, /старое[\s\S]*## Аудит репо 2026-09-08/);
  });
});
