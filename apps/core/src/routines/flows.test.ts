import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPhases, type FlowContext } from "./flows";

const run = {
  id: "r1", agentName: "vendhub-ops", skill: "monitor-stock", trigger: "cron", cron: "0 8 * * *",
  scheduledAt: new Date("2026-09-06T03:00:00.000Z"), requestKey: "k", traceKey: null, taskId: null, approvalId: null,
  startedAt: new Date("2026-09-06T03:00:01.000Z"), finishedAt: new Date("2026-09-06T03:00:04.000Z"),
  outcome: "skipped", skipReason: "no_signal", hook: null, reason: "повода нет", action: null, review: null, createdAt: new Date(),
};
const ctx0: FlowContext = { run, catalog: { executor: "code", tier: "T1" }, task: null, execution: null, approval: null, deliveries: [] };

const names = (p: ReturnType<typeof buildPhases>) => p.map((x) => `${x.name}:${x.state}`);

describe("buildPhases (R-R-5)", () => {
  it("legacy skipped — trigger ok, proposal skip с подписью словаря, остальное skip", () => {
    // Причина взята НЕ `no_signal`: у него подпись словаря («повода нет»)
    // совпадает с `reason` фикстуры, и тест прошёл бы даже после удаления
    // словарной ветки. У `capped` подпись («потолок действий») и сырая причина
    // — разные строки, и подмена одного другим сразу видна.
    const p = buildPhases({ ...ctx0, run: { ...run, skipReason: "capped", reason: "дневной лимит действий исчерпан" } });
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:skip", "approval:skip", "execution:skip", "delivery:skip"]);
    assert.match(p[0]!.title, /0 8 \* \* \*/);
    assert.equal(p[2]!.note, "потолок действий");
    assert.match(p[1]!.title, /monitor-stock · code · T1/);
  });

  it("legacy executed без согласования — execution ok «выполнено напрямую», approval skip (T0/T1)", () => {
    const p = buildPhases({ ...ctx0, run: { ...run, outcome: "executed", skipReason: null, action: "Курс обновлён" } });
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:ok", "approval:skip", "execution:ok", "delivery:skip"]);
    assert.equal(p[2]!.title, "Курс обновлён");
  });

  it("task approval pending — approval warn со ссылкой /inbox, execution по статусу committed", () => {
    const p = buildPhases({
      ...ctx0,
      run: { ...run, trigger: "task", taskId: "11111111-1111-4111-8111-111111111111", outcome: "approval_requested", skipReason: null, action: "Пополнить автомат 12" },
      task: { id: "11111111-1111-4111-8111-111111111111", status: "todo" },
      execution: { id: "e1", status: "committed", committedAt: new Date("2026-09-06T03:00:03.000Z"), abandonReason: null },
      approval: { id: "a1", decision: "pending", decidedAt: null, tier: "T2", createdAt: new Date("2026-09-06T03:00:03.000Z") },
      deliveries: [{ destination: "notion-report", status: "pending", lastError: null, completedAt: null }],
    });
    assert.deepEqual(names(p), ["trigger:ok", "skill:ok", "proposal:ok", "approval:warn", "execution:ok", "delivery:warn"]);
    assert.equal(p[3]!.href, "/inbox");
    assert.equal(p[4]!.href, "/tasks/11111111-1111-4111-8111-111111111111");
  });

  it("hook_blocked — proposal skip «хук quiet_hours: …»; failed — proposal fail", () => {
    const h = buildPhases({ ...ctx0, run: { ...run, skipReason: "hook_blocked", hook: "quiet_hours", reason: "тихие часы 22:00–07:00" } });
    assert.equal(h[2]!.state, "skip");
    assert.match(h[2]!.note ?? "", /хук quiet_hours: тихие часы/);
    const f = buildPhases({ ...ctx0, run: { ...run, outcome: "failed", skipReason: null, reason: "ECONNREFUSED" } });
    assert.equal(f[2]!.state, "fail");
    assert.equal(f[2]!.note, "ECONNREFUSED");
  });

  it("монитор — skill ok «системный монитор» без каталога; навык вне каталога — warn", () => {
    const m = buildPhases({ ...ctx0, run: { ...run, agentName: "system", skill: "fx:refresh", outcome: "executed", skipReason: null }, catalog: null });
    assert.equal(m[1]!.state, "ok");
    assert.match(m[1]!.title, /системный монитор/);
    const w = buildPhases({ ...ctx0, catalog: null });
    assert.equal(w[1]!.state, "warn");
  });

  it("delivery: каждый статус outbox_delivery_status получает свою фазу", () => {
    // Перечисление `outbox_delivery_status` — pending | dispatching | sent |
    // skipped | unknown | dead. Веток на `failed`/`claimed`/`delivered`, которых
    // в базе нет, здесь быть не должно: их «ok» по умолчанию красил зелёным
    // неподтверждённую доставку (adversarial-ревью волны R, B1).
    const phase = (status: string, lastError: string | null = null) =>
      buildPhases({ ...ctx0, deliveries: [{ destination: "notion-report", status, lastError, completedAt: null }] })[5]!;

    assert.equal(phase("sent").state, "ok");
    assert.equal(phase("sent").title, "notion-report ✓");
    assert.equal(phase("skipped").state, "ok");
    // Галочка у `skipped` читалась бы как «доставлено» — там её быть не должно.
    assert.equal(phase("skipped").title, "notion-report пропущено");
    assert.equal(phase("pending").state, "warn");
    assert.equal(phase("dispatching").state, "warn");

    const dead = phase("dead", "401");
    assert.equal(dead.state, "fail");
    assert.equal(dead.title, "notion-report провалено");
    assert.match(dead.note ?? "", /401/);

    // Неподтверждённая доставка — жёлтая со словами, что делать, и с ошибкой
    // очереди, если она есть: раньше и то и другое молча терялось.
    const unknown = phase("unknown");
    assert.equal(unknown.state, "warn");
    assert.equal(unknown.title, "notion-report не подтверждено");
    assert.equal(unknown.note, "доставка не подтверждена — нужна сверка");
    assert.equal(phase("unknown", "timeout").note, "доставка не подтверждена — нужна сверка: timeout");
  });

  it("delivery: провал важнее неподтверждённой, неподтверждённая — открытой; статус вне перечисления виден сырым", () => {
    const mixed = buildPhases({
      ...ctx0,
      deliveries: [
        { destination: "telegram", status: "sent", lastError: null, completedAt: new Date("2026-09-06T03:00:05.000Z") },
        { destination: "notion-report", status: "unknown", lastError: null, completedAt: null },
        { destination: "email", status: "dead", lastError: "401", completedAt: null },
      ],
    })[5]!;
    assert.equal(mixed.state, "fail");
    assert.equal(mixed.title, "telegram ✓, notion-report не подтверждено, email провалено");

    const открытая = buildPhases({
      ...ctx0,
      deliveries: [
        { destination: "telegram", status: "pending", lastError: null, completedAt: null },
        { destination: "notion-report", status: "unknown", lastError: null, completedAt: null },
      ],
    })[5]!;
    assert.equal(открытая.state, "warn");
    assert.equal(открытая.note, "доставка не подтверждена — нужна сверка");

    // Чужое слово в колонке статуса не должно молча стать зелёной галочкой.
    const чужой = buildPhases({ ...ctx0, deliveries: [{ destination: "telegram", status: "held", lastError: null, completedAt: null }] })[5]!;
    assert.equal(чужой.title, "telegram held");
  });

  it("исполнение: abandoned → fail с причиной отказа; active/ready → warn «ещё идёт»", () => {
    // Статусы берём из перечисления `task_agent_execution_status`
    // (active | ready | committed | abandoned) — пятого там нет, и фаза не
    // должна знать о статусах, которых база не отдаёт.
    const base = { ...ctx0, task: { id: "11111111-1111-4111-8111-111111111111", status: "todo" } };
    const dropped = buildPhases({
      ...base,
      execution: { id: "e1", status: "abandoned", committedAt: null, abandonReason: "лизинг не подтверждён" },
    });
    assert.equal(dropped[4]!.state, "fail");
    assert.equal(dropped[4]!.title, "abandoned");
    assert.equal(dropped[4]!.note, "лизинг не подтверждён");
    assert.equal(dropped[4]!.href, "/tasks/11111111-1111-4111-8111-111111111111");

    for (const status of ["active", "ready"]) {
      const going = buildPhases({ ...base, execution: { id: "e1", status, committedAt: null, abandonReason: null } });
      assert.equal(going[4]!.state, "warn", status);
      assert.equal(going[4]!.title, `выполнение: ${status}`);
    }
  });
});
