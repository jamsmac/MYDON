import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parse as parseYaml } from "yaml";
import { AUTONOMY_TIERS, type AutonomyTier } from "@mydon/shared";

import { autonomyThreshold, requiresApproval } from "./policy";
import { TOOLTYPE_MIN, type ToolType } from "./tools";
import { COACH_OUTCOMES, PASS_THRESHOLD, RUBRIC } from "./coach";

/**
 * Тест дрейфа зеркал движка (R-M-1, spec 2026-09-06-wave-m-docs-brain, Р-1).
 *
 * `engine/autonomy.yaml` и `engine/eval-rubric.md` — рукописные читаемые зеркала
 * кода (policy.ts/tools.ts/coach.ts). Ничего их не генерирует, поэтому ничего и
 * не гарантирует, что они не разъедутся с кодом при следующей правке. Этот файл
 * сверяет факты зеркал с кодом построчно: любое расхождение — красный тест, а
 * не тихо устаревший markdown.
 */

const ENGINE_DIR = path.resolve(__dirname, "../../../engine");

interface AutonomyYaml {
  mirrored_at: string;
  threshold_env: string;
  threshold_default: AutonomyTier;
  tiers: Record<string, { label: string; meaning: string }>;
  tool_types: Record<string, { min_tier: AutonomyTier; match: string }>;
}

function readAutonomyYaml(): AutonomyYaml {
  const raw = fs.readFileSync(path.join(ENGINE_DIR, "autonomy.yaml"), "utf8");
  return parseYaml(raw) as AutonomyYaml;
}

function readEvalRubricMd(): string {
  return fs.readFileSync(path.join(ENGINE_DIR, "eval-rubric.md"), "utf8");
}

describe("engine/autonomy.yaml ↔ policy.ts / tools.ts", () => {
  it("тиры совпадают по составу и порядку с AUTONOMY_TIERS", () => {
    const doc = readAutonomyYaml();
    assert.deepEqual(Object.keys(doc.tiers), [...AUTONOMY_TIERS]);
  });

  it("пол тира по типу инструмента совпадает с TOOLTYPE_MIN", () => {
    const doc = readAutonomyYaml();
    assert.deepEqual(
      Object.keys(doc.tool_types).sort(),
      Object.keys(TOOLTYPE_MIN).sort(),
      "набор типов инструментов в yaml и в коде должен совпадать",
    );
    for (const [type, cfg] of Object.entries(doc.tool_types)) {
      assert.equal(cfg.min_tier, TOOLTYPE_MIN[type as ToolType], `min_tier для tool_types.${type}`);
    }
  });

  it("имя env-переменной порога и дефолт совпадают с autonomyThreshold()", () => {
    const doc = readAutonomyYaml();
    assert.equal(doc.threshold_env, "AGENT_AUTONOMY_MAX");
    assert.equal(autonomyThreshold(undefined), doc.threshold_default);
  });

  it("правило гейта (`rule` в yaml) совпадает с requiresApproval() на таблице примеров", () => {
    // Таблица — не свой мини-парсер строки `rule`, а фиксация её смысла на
    // конкретных парах (порог, тир действия). Если формула requiresApproval в
    // policy.ts изменится, красными станут и эта таблица, и (по договорённости)
    // строка `rule` в engine/autonomy.yaml — обе правятся вместе.
    const table: ReadonlyArray<{ threshold: AutonomyTier; actionTier: AutonomyTier; expected: boolean }> = [
      { threshold: "T0", actionTier: "T1", expected: true }, // порог T0 — согласования требует всё
      { threshold: "T1", actionTier: "T1", expected: false }, // тир действия не выше порога
      { threshold: "T1", actionTier: "T2", expected: true }, // тир действия выше порога
      { threshold: "T2", actionTier: "T2", expected: false },
      { threshold: "T3", actionTier: "T1", expected: false },
    ];
    for (const { threshold, actionTier, expected } of table) {
      assert.equal(
        requiresApproval(actionTier, threshold),
        expected,
        `requiresApproval(${actionTier}, ${threshold}) должно быть ${expected}`,
      );
    }
  });

  it("mirrored_at — дата в формате ISO (YYYY-MM-DD)", () => {
    const doc = readAutonomyYaml();
    assert.match(doc.mirrored_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Number.isNaN(Date.parse(doc.mirrored_at)), false);
  });
});

describe("engine/eval-rubric.md ↔ coach.ts", () => {
  it("ключи и веса таблицы критериев совпадают с RUBRIC", () => {
    const md = readEvalRubricMd();
    const rows = md.split("\n").filter((line) => /^\|\s*`\w+`\s*\|/.test(line));
    const parsed = rows.map((line) => {
      const key = /`(\w+)`/.exec(line)?.[1];
      const weight = /×(\d+)/.exec(line)?.[1];
      assert.ok(key && weight, `не удалось разобрать строку таблицы: ${line}`);
      return { key, weight: Number(weight) };
    });
    assert.deepEqual(
      parsed,
      RUBRIC.map((c) => ({ key: c.key, weight: c.weight })),
    );
  });

  it("PASS_THRESHOLD в блоке кода совпадает с coach.ts", () => {
    const md = readEvalRubricMd();
    const m = /PASS_THRESHOLD\s*=\s*([\d.]+)/.exec(md);
    assert.ok(m, "PASS_THRESHOLD не найден в eval-rubric.md");
    assert.equal(Number(m![1]), PASS_THRESHOLD);
  });

  it("таблица исходов упоминает каждое значение CoachOutcome", () => {
    const md = readEvalRubricMd();
    for (const outcome of COACH_OUTCOMES) {
      assert.ok(md.includes(`\`${outcome}\``), `исход ${outcome} отсутствует в таблице`);
    }
  });
});
