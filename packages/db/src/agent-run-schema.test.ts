import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { agent, agentRun, agentRuntimeSnapshot } from "./schema";

describe("Журнал прогонов и снимок расписаний (R-R-1, R-R-2)", () => {
  it("agent_run: ключ запроса уникален, исход и причина обязательны", () => {
    assert.equal(getTableName(agentRun), "agent_run");
    const c = getTableColumns(agentRun);
    assert.equal(c.requestKey.notNull, true);
    assert.equal(c.requestKey.isUnique, true);
    assert.equal(c.outcome.notNull, true);
    assert.equal(c.reason.notNull, true);
    assert.equal(c.startedAt.notNull, true);
    assert.equal(c.finishedAt.notNull, true);
    assert.equal(c.skipReason.notNull, false);
    assert.equal(c.taskId.notNull, false);
  });

  it("agent_runtime_snapshot: ключ + jsonb", () => {
    assert.equal(getTableName(agentRuntimeSnapshot), "agent_runtime_snapshot");
    const c = getTableColumns(agentRuntimeSnapshot);
    assert.equal(c.key.primary, true);
    assert.equal(c.payload.notNull, true);
  });

  it("agent.hooks — jsonb с дефолтом {}", () => {
    const c = getTableColumns(agent);
    assert.equal(c.hooks.notNull, true);
    assert.equal(c.hooks.hasDefault, true);
  });
});
