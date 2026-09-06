import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderAudit, upsertSection } from "./repo-audit.mjs";

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
