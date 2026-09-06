import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journaledMonitor, monitorRequestKey, scheduleMonitor } from "./monitors";

/**
 * Итог монитора, его сбой и предупреждение журнала печатает сам
 * `journaledMonitor` — в выводе тестов это шум, а не проверяемое поведение.
 */
async function quietly(fn: () => Promise<void>): Promise<void> {
  const { log, error, warn } = console;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.log = log;
    console.error = error;
    console.warn = warn;
  }
}

describe("journaledMonitor (R-R-6)", () => {
  const occurrence = new Date("2026-09-06T04:00:00.000Z");
  it("успех → executed с итоговой строкой, requestKey от occurrence", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("fx:refresh", "5 9 * * *", core, async () => "[fx:refresh] обновлено: USD");
    await quietly(() => run(occurrence));
    assert.equal(entries[0]!.agentName, "system");
    assert.equal(entries[0]!.skill, "fx:refresh");
    assert.equal(entries[0]!.outcome, "executed");
    assert.equal(entries[0]!.reason, "[fx:refresh] обновлено: USD");
    assert.equal(entries[0]!.requestKey, monitorRequestKey("fx:refresh", "5 9 * * *", occurrence));
    assert.equal(entries[0]!.scheduledAt, occurrence.toISOString());
  });
  it("исключение → failed, и ошибка не всплывает наружу", async () => {
    const entries: Record<string, unknown>[] = [];
    const core = { reportRun: async (e: Record<string, unknown>) => { entries.push(e); return { id: "r", created: true }; } };
    const run = journaledMonitor("coffee:monitor", "0 7 * * *", core, async () => { throw new Error("db down"); });
    await quietly(() => run(occurrence));
    assert.equal(entries[0]!.outcome, "failed");
    assert.equal(entries[0]!.reason, "db down");
  });
  it("падение журнала не роняет монитор", async () => {
    const core = { reportRun: async () => { throw new Error("core down"); } };
    let ran = false;
    const run = journaledMonitor("x", "* * * * *", core, async () => { ran = true; return "ok"; });
    await quietly(() => run(occurrence));
    assert.equal(ran, true);
  });
});

describe("scheduleMonitor — ключ прогона от ПЛАНОВОГО времени (R-R-6)", () => {
  it("две реплики одного планового срабатывания дают один requestKey", async () => {
    // Ключ считается от occurrence, а не от `new Date()` внутри колбэка:
    // иначе задержка event loop развела бы одну работу по двум строкам журнала.
    const keys: unknown[] = [];
    const core = {
      reportRun: async (e: Record<string, unknown>) => {
        keys.push(e.requestKey);
        return { id: "r", created: true };
      },
    };
    const planned = new Date("2026-09-06T04:00:00.000Z");
    const replicaA = journaledMonitor("fx:refresh", "5 9 * * *", core, async () => "ok");
    const replicaB = journaledMonitor("fx:refresh", "5 9 * * *", core, async () => "ok");
    await quietly(async () => {
      await replicaA(planned);
      // Второй процесс держит СВОЙ объект Date того же планового момента.
      await replicaB(new Date(planned.getTime()));
    });
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
  });

  it("заводит задание в Ташкенте и заранее знает следующее плановое время", async () => {
    const core = { reportRun: async () => ({ id: "r", created: true }) };
    const job = scheduleMonitor("fx:refresh", "5 9 * * *", core, async () => "ok");
    try {
      assert.equal(job.name, "fx:refresh");
      assert.ok((job.nextRun()?.getTime() ?? 0) > Date.now(), "следующее срабатывание в будущем");
    } finally {
      job.stop();
    }
  });

  it("битое расписание бросает при заведении — вызывающий сам пишет монитор выключенным", () => {
    const core = { reportRun: async () => ({ id: "r", created: true }) };
    assert.throws(() => scheduleMonitor("x", "99 99 * * *", core, async () => "ok"));
  });
});
