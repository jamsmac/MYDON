import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EffectiveItem } from "../system/config-spec";
import type { SystemService } from "../system/system.service";
import { BoardService } from "./board.service";
import type { AgentRunRow, RunsService, ScheduleSnapshot } from "./runs.service";

/**
 * Сборка доски: пауза берётся из `system_config`, а не из снимка рантайма
 * (adversarial-ревью волны R, B5).
 *
 * Единственной проверкой этой связки был дымовой прогон, а он сравнивал
 * `paused` сам с собой («не true и не false») — то есть не проверял ничего.
 * Здесь снимок ВСЕГДА присылает значения, противоположные конфигу: совпадение
 * с конфигом возможно только если доска взяла тумблер владельца.
 */
const NOW = new Date("2026-09-06T03:10:00.000Z"); // 08:10 Ташкент

const SNAPSHOT: ScheduleSnapshot = {
  generatedAt: "2026-09-06T03:05:00.000Z",
  tz: "Asia/Tashkent",
  paused: { schedules: false, tasks: false },
  jobs: [{ agent: "vendhub-ops", skill: "monitor-stock", cron: "0 8 * * *", mode: "legacy" }],
  notWired: [],
  monitors: [{ name: "ourvend:sync", cron: "0 */3 * * *", enabled: true }],
};

/** Ответ `SystemService.effective()`: только то, что читает доска. */
function config(values: Record<string, string>): EffectiveItem[] {
  return Object.entries(values).map(([key, value]) => ({ key, label: key, kind: "bool", value, source: "db" }));
}

/**
 * Доска на заглушках двух сервисов. Снимок несёт `paused`, ОБРАТНЫЙ ожидаемому:
 * доска, читающая снимок, ответила бы ровно наоборот.
 */
function board(values: Record<string, string>, expected: { schedules: boolean; tasks: boolean }) {
  const runs = {
    snapshot: async () => ({
      payload: { ...SNAPSHOT, paused: { schedules: !expected.schedules, tasks: !expected.tasks } },
      updatedAt: new Date("2026-09-06T03:05:00.000Z"),
    }),
    lastPerJob: async (): Promise<AgentRunRow[]> => [],
  };
  const system = { effective: async (): Promise<EffectiveItem[]> => config(values) };
  return new BoardService(runs as unknown as RunsService, system as unknown as SystemService).board(NOW);
}

describe("BoardService.board (R-R-3)", () => {
  it("паузу берёт из system_config, а не из снимка рантайма", async () => {
    const b = await board({ AGENTS_SCHEDULES_PAUSED: "1", AGENTS_TASKS_PAUSED: "0" }, { schedules: true, tasks: false });

    assert.deepEqual(b.paused, { schedules: true, tasks: false });
    // Пауза расписаний доехала до строки задания и убрала его из суток.
    const job = b.jobs.find((j) => j.agent === "vendhub-ops")!;
    assert.equal(job.paused, true);
    assert.equal(b.upcoming24h.some((u) => u.jobId === job.id), false);
    // Мониторы паузе агентов не подчиняются: синк источника продолжает идти.
    assert.ok(b.upcoming24h.every((u) => u.jobId.startsWith("system/")));
  });

  it("обратный случай: тумблеры сняты — доска работает, хотя снимок пришёл паузным", async () => {
    const b = await board({ AGENTS_SCHEDULES_PAUSED: "0", AGENTS_TASKS_PAUSED: "1" }, { schedules: false, tasks: true });

    assert.deepEqual(b.paused, { schedules: false, tasks: true });
    const job = b.jobs.find((j) => j.agent === "vendhub-ops")!;
    assert.equal(job.paused, false);
    assert.equal(b.upcoming24h.some((u) => u.jobId === job.id), true);
  });

  it("ключа нет в конфиге — считаем «не на паузе», а не гадаем по снимку", async () => {
    // `effective()` отдаёт весь белый список, но ключ могли из него убрать.
    // Тогда доска обязана ответить «работает»: обещание запуска, которого не
    // будет, чинится быстрее молчания, выданного за паузу.
    const b = await board({}, { schedules: false, tasks: false });

    assert.deepEqual(b.paused, { schedules: false, tasks: false });
    assert.equal(b.jobs.find((j) => j.agent === "vendhub-ops")!.paused, false);
  });

  it("значение не «1» паузой не считается", async () => {
    const b = await board({ AGENTS_SCHEDULES_PAUSED: "0", AGENTS_TASKS_PAUSED: "0" }, { schedules: false, tasks: false });
    assert.deepEqual(b.paused, { schedules: false, tasks: false });
  });
});
