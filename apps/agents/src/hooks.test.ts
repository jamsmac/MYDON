import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { coachLite, hooksFromCore, inQuietHours, parseHooks, runPostRunHooks, runPreRunHooks } from "./hooks";
import { loadAgents } from "./registry";

/** Перехват console.warn: тест, который ЖДЁТ предупреждения, не должен пачкать вывод прогона. */
async function captureWarn(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]): void => {
    lines.push(args.map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return lines;
}

describe("parseHooks (R-R-4)", () => {
  it("разбирает kinds и параметры, чужой kind → unknown + problem", () => {
    const { hooks, problems } = parseHooks({
      pre_run: [
        { kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 },
        { kind: "quiet_hours", from: "22:00", to: "07:00" },
        { kind: "moon_phase" },
      ],
      post_run: [{ kind: "coach_lite" }, { kind: "telepathy" }],
    });
    assert.equal(hooks.preRun.length, 3);
    assert.deepEqual(hooks.preRun[0], { kind: "source_fresh", run: "system/ourvend:sync", maxAgeHours: 6 });
    assert.deepEqual(hooks.preRun[2], { kind: "unknown", raw: "moon_phase" });
    assert.deepEqual(hooks.postRun[1], { kind: "unknown", raw: "telepathy" });
    assert.equal(problems.length, 2);
    assert.match(problems[0]!, /moon_phase/);
  });
  it("битые параметры → problems, хук помечен unknown + broken (сообщение отличается от чужого kind)", () => {
    const { hooks, problems } = parseHooks({ pre_run: [{ kind: "source_fresh", run: "nope", max_age_hours: 0 }, { kind: "quiet_hours", from: "25:00", to: "x" }] });
    assert.equal(hooks.preRun.every((h) => h.kind === "unknown"), true);
    assert.deepEqual(hooks.preRun[0], { kind: "unknown", raw: "source_fresh", broken: true });
    assert.equal(problems.length >= 2, true);
  });
  it("нет раздела → пусто без problems", () => {
    const { hooks, problems } = parseHooks(undefined);
    assert.deepEqual(hooks, { preRun: [], postRun: [] });
    assert.equal(problems.length, 0);
  });
  it("нечитаемый раздел не «отменяет» охрану: problem + блокирующий pre_run", () => {
    const notObject = parseHooks("хуки");
    assert.equal(notObject.problems.length, 1);
    assert.deepEqual(notObject.hooks.preRun, [{ kind: "unknown", raw: "hooks", broken: true }]);

    const notList = parseHooks({ pre_run: "источник" });
    assert.equal(notList.problems.length, 1);
    assert.deepEqual(notList.hooks.preRun, [{ kind: "unknown", raw: "pre_run", broken: true }]);
  });

  it("пункт-строка вместо объекта: pre_run блокирует, post_run только замечание", () => {
    const pre = parseHooks({ pre_run: ["source_fresh", { kind: "quiet_hours", from: "22:00", to: "07:00" }] });
    assert.equal(pre.problems.length, 1);
    assert.match(pre.problems[0]!, /source_fresh/);
    assert.deepEqual(pre.hooks.preRun[0], { kind: "unknown", raw: "source_fresh" });
    assert.equal(pre.hooks.preRun.length, 2, "второй, целый хук не потерян");

    const post = parseHooks({ post_run: ["coach_lite"] });
    assert.equal(post.problems.length, 1);
    assert.deepEqual(post.hooks.postRun, [], "разбор постфактум ничего не охраняет — блокировать нечего");
  });

  it("camelCase-раздел из карточки Core читается как свой", () => {
    // Владелец увидел в карточке форму `preRun` и написал её в config.yaml.
    // До фикса это давало пустые списки И пустой problems — check:passports
    // молчал ровно там, где паспорт просил охрану.
    const { hooks, problems } = parseHooks({
      preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
      postRun: [{ kind: "coach_lite" }],
    });
    assert.deepEqual(hooks.preRun, [{ kind: "quiet_hours", from: "22:00", to: "07:00" }]);
    assert.deepEqual(hooks.postRun, [{ kind: "coach_lite" }]);
    assert.deepEqual(problems, []);
  });

  it("оба написания рядом: берём непустое и говорим владельцу оставить одно", () => {
    const { hooks, problems } = parseHooks({
      pre_run: [],
      preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
    });
    assert.deepEqual(hooks.preRun, [{ kind: "quiet_hours", from: "22:00", to: "07:00" }]);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /pre_run.*preRun/);
  });

  it("нечитаемый camelCase-раздел блокирует так же, как snake_case", () => {
    const { hooks, problems } = parseHooks({ preRun: "источник" });
    assert.deepEqual(hooks.preRun, [{ kind: "unknown", raw: "pre_run", broken: true }]);
    assert.equal(problems.length, 1);
    assert.match(problems[0]!, /hooks\.preRun/);
  });

  it("параметры хука остаются snake_case, но молчания больше нет", () => {
    // `maxAgeHours` в паспорте — не «хука нет»: problem для check:passports
    // плюс блокирующий хук, чтобы навык не пошёл без проверки свежести.
    const { hooks, problems } = parseHooks({
      preRun: [{ kind: "source_fresh", run: "system/ourvend:sync", maxAgeHours: 6 }],
    });
    assert.deepEqual(hooks.preRun, [{ kind: "unknown", raw: "source_fresh", broken: true }]);
    assert.match(problems.join(" | "), /max_age_hours/);
  });
});

describe("inQuietHours — Ташкент, переход через полночь", () => {
  it("23:30 Ташкента (18:30Z) внутри 22:00–07:00; 12:00 — нет; 06:59 — да; 07:00 — нет", () => {
    assert.equal(inQuietHours(new Date("2026-09-06T18:30:00.000Z"), "22:00", "07:00"), true);
    assert.equal(inQuietHours(new Date("2026-09-06T07:00:00.000Z"), "22:00", "07:00"), false);
    assert.equal(inQuietHours(new Date("2026-09-06T01:59:00.000Z"), "22:00", "07:00"), true);
    assert.equal(inQuietHours(new Date("2026-09-06T02:00:00.000Z"), "22:00", "07:00"), false);
    assert.equal(inQuietHours(new Date("2026-09-06T08:00:00.000Z"), "12:00", "14:00"), true); // 13:00 Ташкент
  });
});

describe("runPreRunHooks", () => {
  const now = new Date("2026-09-06T03:00:00.000Z");
  const fresh = { id: "r", agentName: "system", skill: "ourvend:sync", outcome: "executed", finishedAt: "2026-09-06T01:00:00.000Z" };
  it("source_fresh: свежий executed → ok; старый → блок с часами; нет прогона → блок; ошибка Core → блок", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }] }).hooks;
    assert.deepEqual(await runPreRunHooks(hooks, { now, core: { lastRun: async () => fresh as never } }), { ok: true });
    const old = await runPreRunHooks(hooks, { now, core: { lastRun: async () => ({ ...fresh, finishedAt: "2026-09-05T03:00:00.000Z" }) as never } });
    assert.equal(old.ok, false);
    assert.match((old as { reason: string }).reason, /24 ч .*порог 6/);
    const none = await runPreRunHooks(hooks, { now, core: { lastRun: async () => null } });
    assert.equal(none.ok, false);
    const down = await runPreRunHooks(hooks, { now, core: { lastRun: async () => { throw new Error("x"); } } });
    assert.equal(down.ok, false);
    assert.match((down as { reason: string }).reason, /журнал недоступен/);
  });
  it("source_fresh: битое finishedAt — блок, а не «возраст NaN, значит порог не превышен»", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }] }).hooks;
    const v = await runPreRunHooks(hooks, {
      now,
      core: { lastRun: async () => ({ ...fresh, finishedAt: "не дата" }) as never },
    });
    assert.equal(v.ok, false);
    assert.match((v as { reason: string }).reason, /без времени завершения/);
  });
  it("quiet_hours: ночью блок, днём проход — повод прогона хук не спрашивает", async () => {
    // «Вручную пропустим» здесь НЕ проверяется: кто вообще доходит до хуков,
    // решает `preRunApplies` в runner.ts (task и manual туда не попадают).
    const hooks = parseHooks({ pre_run: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }] }).hooks;
    const night = new Date("2026-09-06T18:30:00.000Z"); // 23:30 Ташкент
    const blocked = await runPreRunHooks(hooks, { now: night, core: { lastRun: async () => null } });
    assert.equal(blocked.ok, false);
    assert.equal((blocked as { hook: string }).hook, "quiet_hours");
    const day = new Date("2026-09-06T05:00:00.000Z"); // 10:00 Ташкент
    assert.deepEqual(await runPreRunHooks(hooks, { now: day, core: { lastRun: async () => null } }), { ok: true });
  });
  it("unknown kind → блок «неизвестный хук»", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "moon_phase" }] }).hooks;
    const v = await runPreRunHooks(hooks, { now, core: { lastRun: async () => null } });
    assert.equal(v.ok, false);
    assert.match((v as { reason: string }).reason, /неизвестный хук moon_phase/);
  });
  it("знакомый kind с битыми параметрами → блок, но причина адресная", async () => {
    const hooks = parseHooks({ pre_run: [{ kind: "source_fresh", run: "нет-слеша", max_age_hours: 6 }] }).hooks;
    const v = await runPreRunHooks(hooks, { now, core: { lastRun: async () => null } });
    assert.equal(v.ok, false);
    assert.equal((v as { hook: string }).hook, "source_fresh");
    assert.match((v as { reason: string }).reason, /битые параметры хука source_fresh — см. check:passports/);
  });
  it("проверяет по порядку и останавливается на первом провале", async () => {
    const hooks = parseHooks({
      pre_run: [
        { kind: "quiet_hours", from: "22:00", to: "07:00" },
        { kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 },
      ],
    }).hooks;
    let asked = 0;
    const v = await runPreRunHooks(hooks, {
      now: new Date("2026-09-06T18:30:00.000Z"),
      core: {
        lastRun: async () => {
          asked += 1;
          return null;
        },
      },
    });
    assert.equal((v as { hook: string }).hook, "quiet_hours");
    assert.equal(asked, 0, "до второго хука дело не доходит — журнал не дёргаем");
  });
  it("пустой список хуков → ok, Core не спрашиваем", async () => {
    assert.deepEqual(
      await runPreRunHooks({ preRun: [], postRun: [] }, { now: new Date(), core: { lastRun: async () => { throw new Error("не должно вызываться"); } } }),
      { ok: true },
    );
  });
});

describe("coachLite — правила по серии (без LLM)", () => {
  const r = (outcome: string, skipReason?: string) => ({ outcome, skipReason: skipReason ?? null, reason: "" });
  it("3 llm-сбоя подряд", () => {
    assert.match(coachLite([r("skipped", "llm_failed"), r("skipped", "llm_invalid_output")], r("skipped", "llm_failed")) ?? "", /LLM-маршрут падает 3/);
  });
  it("5 тихих подряд", () => {
    const h = Array.from({ length: 4 }, () => r("skipped", "no_signal"));
    assert.match(coachLite(h, r("skipped", "no_signal")) ?? "", /пять тихих/);
    assert.equal(coachLite(h.slice(1), r("skipped", "no_signal")), undefined);
  });
  it("3 предложения подряд; сбой дважды подряд", () => {
    assert.match(coachLite([r("approval_requested"), r("approval_requested")], r("approval_requested")) ?? "", /три предложения/);
    assert.match(coachLite([r("failed")], { outcome: "failed", skipReason: null, reason: "boom" }) ?? "", /второй раз подряд: boom/);
  });
  it("история новее→старее: обрывается на первом несовпадении", () => {
    assert.equal(coachLite([r("executed"), r("skipped", "no_signal"), r("skipped", "no_signal"), r("skipped", "no_signal"), r("skipped", "no_signal")], r("skipped", "no_signal")), undefined);
  });
});

describe("runPostRunHooks", () => {
  it("coach_lite читает историю и отдаёт review; ошибка Core → без review, без исключения", async () => {
    const hooks = parseHooks({ post_run: [{ kind: "coach_lite" }] }).hooks;
    const history = Array.from({ length: 4 }, () => ({ outcome: "skipped", skipReason: "no_signal", reason: "" }));
    const r = await runPostRunHooks(hooks, { agent: "a", skill: "s", result: { outcome: "skipped", skipReason: "no_signal", reason: "" }, core: { listRuns: async () => history as never } });
    assert.match(r.review ?? "", /пять тихих/);
    let down: { review?: string } = {};
    const warns = await captureWarn(async () => {
      down = await runPostRunHooks(hooks, { agent: "a", skill: "s", result: { outcome: "skipped", skipReason: "no_signal", reason: "" }, core: { listRuns: async () => { throw new Error("x"); } } });
    });
    assert.equal(down.review, undefined);
    assert.equal(warns.length, 1, "недоступный журнал объясняется в логе, а не молча");
  });
  it("неизвестный post_run только предупреждает и не мешает остальным", async () => {
    const hooks = parseHooks({ post_run: [{ kind: "telepathy" }, { kind: "coach_lite" }] }).hooks;
    let out: { review?: string } = {};
    const warns = await captureWarn(async () => {
      out = await runPostRunHooks(hooks, {
        agent: "a",
        skill: "s",
        result: { outcome: "failed", skipReason: null, reason: "boom" },
        core: { listRuns: async () => [{ outcome: "failed", skipReason: null, reason: "" }] as never },
      });
    });
    assert.match(out.review ?? "", /второй раз подряд: boom/);
    assert.equal(warns.length, 1);
    assert.match(warns[0]!, /telepathy/);
  });
});

describe("паспорт → база → рантайм (хуки не должны потеряться по дороге)", () => {
  it("registry читает hooks из config.yaml", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mydon-hooks-"));
    try {
      const dir = path.join(tmp, "sample");
      fs.mkdirSync(dir);
      fs.writeFileSync(
        path.join(dir, "config.yaml"),
        [
          "name: sample",
          "business: shared",
          "status: active",
          "autonomy_default: T1",
          "skills: []",
          "hooks:",
          "  pre_run:",
          "    - kind: quiet_hours",
          '      from: "22:00"',
          '      to: "07:00"',
          "  post_run:",
          "    - kind: coach_lite",
          "",
        ].join("\n"),
      );
      const { agents, errors } = loadAgents(tmp);
      assert.deepEqual(errors, []);
      assert.deepEqual(agents[0]?.hooks, {
        preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
        postRun: [{ kind: "coach_lite" }],
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("паспорт без hooks — поля нет (в базу не едет пустышка)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mydon-hooks-"));
    try {
      const dir = path.join(tmp, "sample");
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "config.yaml"), "name: sample\nbusiness: shared\nstatus: active\nskills: []\n");
      assert.equal(loadAgents(tmp).agents[0]?.hooks, undefined);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("hooksFromCore принимает то, что уехало в базу из toPassport", () => {
    const hooks = parseHooks({
      pre_run: [
        { kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 },
        { kind: "quiet_hours", from: "22:00", to: "07:00" },
      ],
      post_run: [{ kind: "coach_lite" }],
    }).hooks;
    // toPassport кладёт `a.hooks` как есть → jsonb → обратно тем же объектом.
    assert.deepEqual(hooksFromCore(JSON.parse(JSON.stringify(hooks))), hooks);
  });

  it("hooksFromCore: пусто и мусор → undefined; битое в базе остаётся хуком (unknown), а не исчезает", () => {
    assert.equal(hooksFromCore(undefined), undefined);
    assert.equal(hooksFromCore({ preRun: [], postRun: [] }), undefined);
    assert.equal(hooksFromCore("хуки"), undefined);
    // Потерянный max_age_hours не должен молча ОТКЛЮЧИТЬ проверку свежести.
    assert.deepEqual(hooksFromCore({ preRun: [{ kind: "source_fresh", run: "a/b" }], postRun: null }), {
      preRun: [{ kind: "unknown", raw: "source_fresh", broken: true }],
      postRun: [],
    });
    assert.deepEqual(hooksFromCore({ preRun: [{ kind: "unknown", raw: "moon_phase" }] }), {
      preRun: [{ kind: "unknown", raw: "moon_phase" }],
      postRun: [],
    });
  });

  it("hooksFromCore понимает и запись паспорта: карточку правят текстом из config.yaml", () => {
    assert.deepEqual(
      hooksFromCore({
        pre_run: [{ kind: "source_fresh", run: "system/ourvend:sync", max_age_hours: 6 }],
        post_run: [{ kind: "coach_lite" }],
      }),
      {
        preRun: [{ kind: "source_fresh", run: "system/ourvend:sync", maxAgeHours: 6 }],
        postRun: [{ kind: "coach_lite" }],
      },
    );
  });

  it("чужой kind из карточки — «неизвестный хук», а не «битые параметры»", async () => {
    // Владелец вписал в карточку хук, которого движок не знает. Прогон он
    // блокирует (так и задумано), но причина обязана указывать на СЛОВО, а не
    // отправлять искать опечатку в параметрах несуществующего хука.
    const hooks = hooksFromCore({ pre_run: [{ kind: "moon_phase" }] });
    assert.deepEqual(hooks, { preRun: [{ kind: "unknown", raw: "moon_phase" }], postRun: [] });
    const v = await runPreRunHooks(hooks!, { now: new Date(), core: { lastRun: async () => null } });
    assert.equal(v.ok, false);
    assert.match((v as { reason: string }).reason, /неизвестный хук moon_phase/);
  });

  it("битая форма из базы БЛОКИРУЕТ навык, а не означает «хуков нет» (fail-closed, как parseHooks)", async () => {
    // Один и тот же паспорт не может быть fail-closed из файла и fail-open из
    // базы: прод читает агентов ИМЕННО из базы, и молчаливое «хуков нет» здесь
    // снимало бы охрану, ради которой хук и написан.
    const cases: { raw: unknown; preRun: unknown }[] = [
      { raw: { preRun: "quiet_hours" }, preRun: [{ kind: "unknown", raw: "pre_run", broken: true }] },
      { raw: { preRun: [null] }, preRun: [{ kind: "unknown", raw: "null" }] },
      { raw: { preRun: [{}] }, preRun: [{ kind: "unknown", raw: "без kind" }] },
    ];
    for (const c of cases) {
      let hooks: ReturnType<typeof hooksFromCore>;
      const warns = await captureWarn(async () => {
        hooks = hooksFromCore(c.raw);
      });
      const label = JSON.stringify(c.raw);
      assert.notEqual(hooks!, undefined, `${label}: раздел нечитаем — это не «хуков нет»`);
      assert.deepEqual(hooks!.preRun, c.preRun, label);
      assert.equal(warns.length, 1, `${label}: владелец обязан увидеть предупреждение`);
      const v = await runPreRunHooks(hooks!, { now: new Date(), core: { lastRun: async () => null } });
      assert.equal(v.ok, false, `${label}: навык обязан блокироваться`);
    }
  });

  it("нечитаемый post_run из базы — предупреждение и пропуск: он ничего не охраняет", async () => {
    let hooks: ReturnType<typeof hooksFromCore>;
    const warns = await captureWarn(async () => {
      hooks = hooksFromCore({ preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }], postRun: "coach_lite" });
    });
    assert.deepEqual(hooks!, {
      preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
      postRun: [],
    });
    assert.equal(warns.length, 1);
  });

  it("два написания рядом: берём НЕПУСТОЕ, а не первое присутствующее", () => {
    // Так выглядит карточка, которую правили текстом config.yaml поверх уже
    // разобранной формы: `preRun: []` остался от прошлой записи. `??` пропустил
    // бы пустой список дальше (`[]` — не null) и молча снял бы охрану.
    assert.deepEqual(
      hooksFromCore({
        preRun: [],
        pre_run: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
        postRun: [],
        post_run: [{ kind: "coach_lite" }],
      }),
      {
        preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }],
        postRun: [{ kind: "coach_lite" }],
      },
    );
    // Обратный порядок читается так же: непустое написание побеждает.
    assert.deepEqual(
      hooksFromCore({ pre_run: [], preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }] }),
      { preRun: [{ kind: "quiet_hours", from: "22:00", to: "07:00" }], postRun: [] },
    );
  });
});
