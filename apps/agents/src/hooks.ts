/**
 * Хуки паспорта агента: `hooks.pre_run` и `hooks.post_run` (волна R, Р-4).
 *
 * Зачем отдельно от рантайма: встроенные проверки (пауза, статус, бюджет,
 * потолок, дельта-память, ledger) — это правила ДВИЖКА, одинаковые для всех.
 * Хук — правило ЭТОГО агента, которое владелец пишет в паспорте: «не запускай,
 * пока синк не отработал», «не буди меня ночью». Поэтому список хуков объявлен
 * данными, а не кодом.
 *
 * Главное правило разбора: чужой kind НЕ выбрасывается. `pre_run` с неизвестным
 * kind блокирует навык — паспорт просил проверку, которой движок не умеет, и
 * угадывать намерение владельца опаснее, чем пропустить прогон. `post_run`
 * (разбор постфактум) только предупреждает: работа уже сделана.
 */
import { tashkentHour, tashkentMinute, type RunTrigger, type SkipReason } from "@mydon/shared";

export type PreRunHook =
  | { kind: "source_fresh"; run: string; maxAgeHours: number }
  | { kind: "quiet_hours"; from: string; to: string }
  /** Хук, который движок исполнить не может: чужой kind либо `broken` — знакомый
   *  kind с битыми параметрами. Оба блокируют навык, но говорят владельцу разное. */
  | { kind: "unknown"; raw: string; broken?: true };
export type PostRunHook = { kind: "coach_lite" } | { kind: "unknown"; raw: string };
export interface AgentHooks {
  preRun: PreRunHook[];
  postRun: PostRunHook[];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const RUN_REF = /^[a-z0-9_-]+\/[a-z0-9:_-]+$/i;

/** Разбор `hooks:` паспорта. Чужой kind не отбрасываем, а помечаем unknown: pre_run с ним блокирует навык (Р-4). */
export function parseHooks(raw: unknown): { hooks: AgentHooks; problems: string[] } {
  const problems: string[] = [];
  const hooks: AgentHooks = { preRun: [], postRun: [] };
  if (raw === undefined || raw === null) return { hooks, problems };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    // Нечитаемый раздел НЕ равен «хуков нет»: паспорт просил охрану, а движок её
    // не понял — запускать навык без охраны опаснее, чем пропустить прогон.
    return {
      hooks: { preRun: [{ kind: "unknown", raw: "hooks", broken: true }], postRun: [] },
      problems: ["hooks: ожидается объект с pre_run/post_run"],
    };
  }
  const o = raw as Record<string, unknown>;
  /** Записи раздела; `null` — сам раздел нечитаем (не список). */
  const list = (v: unknown, name: string): unknown[] | null => {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      problems.push(`hooks.${name}: ожидается список`);
      return null;
    }
    return v;
  };

  const preRunEntries = list(o.pre_run, "pre_run");
  if (preRunEntries === null) hooks.preRun.push({ kind: "unknown", raw: "pre_run", broken: true });
  for (const entry of preRunEntries ?? []) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      // `- source_fresh` вместо `- kind: source_fresh`: имя есть, параметров нет.
      problems.push(`hooks.pre_run: пункт «${String(entry)}» должен быть объектом с полем kind`);
      hooks.preRun.push({ kind: "unknown", raw: String(entry) });
      continue;
    }
    const h = entry as Record<string, unknown>;
    const kind = String(h.kind ?? "");
    if (kind === "source_fresh") {
      const run = typeof h.run === "string" ? h.run : "";
      const hours = typeof h.max_age_hours === "number" ? h.max_age_hours : NaN;
      if (!RUN_REF.test(run)) {
        problems.push(`hooks.pre_run source_fresh: run должен быть вида agent/skill, получено «${run}»`);
      }
      if (!(hours > 0)) problems.push("hooks.pre_run source_fresh: max_age_hours должен быть > 0");
      hooks.preRun.push(
        RUN_REF.test(run) && hours > 0
          ? { kind, run, maxAgeHours: hours }
          : { kind: "unknown", raw: kind, broken: true },
      );
    } else if (kind === "quiet_hours") {
      const from = String(h.from ?? "");
      const to = String(h.to ?? "");
      if (!HHMM.test(from) || !HHMM.test(to)) {
        problems.push(`hooks.pre_run quiet_hours: from/to в формате HH:MM, получено «${from}»–«${to}»`);
      }
      hooks.preRun.push(
        HHMM.test(from) && HHMM.test(to) ? { kind, from, to } : { kind: "unknown", raw: kind, broken: true },
      );
    } else {
      problems.push(`hooks.pre_run: неизвестный kind «${kind}» — навык будет блокироваться`);
      hooks.preRun.push({ kind: "unknown", raw: kind });
    }
  }

  // post_run — разбор ПОСЛЕ работы: нечитаемый пункт ничего не охраняет, поэтому
  // только замечание, без блокировки.
  for (const entry of list(o.post_run, "post_run") ?? []) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      problems.push(`hooks.post_run: пункт «${String(entry)}» должен быть объектом с полем kind`);
      continue;
    }
    const kind = String((entry as Record<string, unknown>).kind ?? "");
    if (kind === "coach_lite") hooks.postRun.push({ kind });
    else {
      problems.push(`hooks.post_run: неизвестный kind «${kind}» — будет пропущен`);
      hooks.postRun.push({ kind: "unknown", raw: kind });
    }
  }
  return { hooks, problems };
}

/**
 * Разобранные хуки из базы (jsonb карточки агента) обратно в рантайм.
 *
 * Агенты грузятся из Core, а не из файлов, — без этой обратной дороги хуки
 * паспорта доехали бы до базы и там и остались. Форма в базе — уже разобранная
 * (`{preRun, postRun}`), но проверяем её заново: битую запись превращаем в
 * `unknown` (то есть в БЛОКИРОВКУ), а не в «хука нет». Потерянный параметр не
 * должен молча отключить проверку, ради которой хук и заводили.
 *
 * Понимаем и запись паспорта (`pre_run`/`max_age_hours`): `POST/PATCH /agents`
 * принимает `hooks` как произвольный объект, и владелец может вставить в
 * карточку кусок config.yaml — терять из-за этого охрану нельзя.
 */
export function hooksFromCore(raw: unknown): AgentHooks | undefined {
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = raw as { preRun?: unknown; postRun?: unknown; pre_run?: unknown; post_run?: unknown };
  const o = { preRun: src.preRun ?? src.pre_run, postRun: src.postRun ?? src.post_run };
  const items = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];

  const preRun: PreRunHook[] = items(o.preRun).map((h) => {
    const kind = String(h.kind ?? "");
    const maxAge = typeof h.maxAgeHours === "number" ? h.maxAgeHours : h.max_age_hours;
    if (kind === "source_fresh" && typeof h.run === "string" && RUN_REF.test(h.run) && typeof maxAge === "number" && maxAge > 0) {
      return { kind, run: h.run, maxAgeHours: maxAge };
    }
    if (kind === "quiet_hours" && typeof h.from === "string" && HHMM.test(h.from) && typeof h.to === "string" && HHMM.test(h.to)) {
      return { kind, from: h.from, to: h.to };
    }
    // Знакомый kind, не прошедший проверку, — «битые параметры»; чужой kind
    // приезжает из базы уже помеченным, его признак сохраняем как есть.
    const wasUnknown = kind === "unknown";
    const broken = wasUnknown ? h.broken === true : true;
    return {
      kind: "unknown",
      raw: wasUnknown && typeof h.raw === "string" ? h.raw : kind,
      ...(broken ? { broken: true as const } : {}),
    };
  });
  const postRun: PostRunHook[] = items(o.postRun).map((h) => {
    const kind = String(h.kind ?? "");
    if (kind === "coach_lite") return { kind };
    return { kind: "unknown", raw: kind === "unknown" && typeof h.raw === "string" ? h.raw : kind };
  });

  return preRun.length === 0 && postRun.length === 0 ? undefined : { preRun, postRun };
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Попадание в интервал по Ташкенту; `from > to` — интервал через полночь; `to` не включается.
 *
 * Минуту берём из хвоста `tashkentMinute` (`YYYY-MM-DDTHH:mm`): своё смещение
 * зоны здесь не считаем — вторая копия смещения в коде и есть та развилка, на
 * которой донор VendCash уехал на пять часов.
 */
export function inQuietHours(now: Date, from: string, to: string): boolean {
  const cur = tashkentHour(now) * 60 + Number(tashkentMinute(now).slice(-2));
  const a = minutes(from);
  const b = minutes(to);
  return a <= b ? cur >= a && cur < b : cur >= a || cur < b;
}

export type HookVerdict = { ok: true } | { ok: false; hook: string; reason: string };
interface LastRunLite {
  outcome: string;
  finishedAt: string;
}

/**
 * Проверка pre_run-хуков ПЕРЕД навыком. Первый провал останавливает прогон:
 * дальше спрашивать нечего, а лишний поход в журнал стоил бы времени и запроса.
 */
export async function runPreRunHooks(
  hooks: AgentHooks,
  ctx: {
    trigger?: RunTrigger;
    now: Date;
    core: { lastRun(agent: string, skill: string): Promise<LastRunLite | null> };
  },
): Promise<HookVerdict> {
  for (const h of hooks.preRun) {
    if (h.kind === "unknown") {
      const name = h.raw || "?";
      return {
        ok: false,
        hook: name,
        reason: h.broken
          ? `битые параметры хука ${name} — см. check:passports`
          : `неизвестный хук ${name} — не угадываю, не запускаю`,
      };
    }
    if (h.kind === "quiet_hours") {
      if (ctx.trigger === "manual") continue; // владелец нажал сам
      if (inQuietHours(ctx.now, h.from, h.to)) {
        return { ok: false, hook: h.kind, reason: `тихие часы ${h.from}–${h.to}` };
      }
      continue;
    }
    // source_fresh
    const at = h.run.indexOf("/");
    let last: LastRunLite | null;
    try {
      last = await ctx.core.lastRun(h.run.slice(0, at), h.run.slice(at + 1));
    } catch (err) {
      // Fail closed: недоступный журнал — это «свежесть НЕ подтверждена», а не «всё в порядке».
      return {
        ok: false,
        hook: h.kind,
        reason: `журнал недоступен — свежесть ${h.run} не подтверждена (${err instanceof Error ? err.message : String(err)})`,
      };
    }
    if (!last || last.outcome !== "executed") {
      return { ok: false, hook: h.kind, reason: `источник ${h.run} ещё не отработал успешно` };
    }
    const ageH = (ctx.now.getTime() - new Date(last.finishedAt).getTime()) / 3_600_000;
    if (!Number.isFinite(ageH)) {
      // Возраст не посчитан — значит НЕ подтверждён: та же дверь, что и недоступный журнал.
      return {
        ok: false,
        hook: h.kind,
        reason: `журнал вернул прогон без времени завершения — свежесть ${h.run} не подтверждена`,
      };
    }
    if (ageH > h.maxAgeHours) {
      return {
        ok: false,
        hook: h.kind,
        reason: `источник ${h.run} не обновлялся ${Math.round(ageH)} ч (порог ${h.maxAgeHours})`,
      };
    }
  }
  return { ok: true };
}

export interface RunResultLite {
  outcome: string;
  skipReason: SkipReason | string | null;
  reason: string;
}

/** «Коуч-лайт» по серии прогонов (новые первыми в history). Только правила — без LLM. */
export function coachLite(history: RunResultLite[], current: RunResultLite): string | undefined {
  const seq = [current, ...history];
  const streak = (pred: (r: RunResultLite) => boolean): number => {
    let n = 0;
    for (const r of seq) {
      if (!pred(r)) break;
      n += 1;
    }
    return n;
  };
  const llm = streak(
    (r) => r.outcome === "skipped" && (r.skipReason === "llm_failed" || r.skipReason === "llm_invalid_output"),
  );
  if (llm >= 3) return `LLM-маршрут падает ${llm} прогона подряд — проверь ключ/модель в /system`;
  if (streak((r) => r.outcome === "skipped" && r.skipReason === "no_signal") >= 5) {
    return "пять тихих прогонов подряд — расписание можно проредить";
  }
  if (streak((r) => r.outcome === "approval_requested") >= 3) {
    return "три предложения подряд ждут решения — владелец не отвечает или предложение повторяется";
  }
  if (streak((r) => r.outcome === "failed") >= 2) return `сбой второй раз подряд: ${current.reason}`;
  return undefined;
}

/**
 * post_run-хуки ПОСЛЕ навыка. Разбор идёт до записи в журнал — заметка едет в
 * той же записи прогона (`review`), а не отдельной строкой без привязки.
 * Ошибка здесь не отменяет уже сделанную работу: гасим в warn.
 */
export async function runPostRunHooks(
  hooks: AgentHooks,
  ctx: {
    agent: string;
    skill: string;
    result: RunResultLite;
    core: { listRuns(agent: string, skill: string, limit: number): Promise<RunResultLite[]> };
  },
): Promise<{ review?: string }> {
  let review: string | undefined;
  for (const h of hooks.postRun) {
    if (h.kind === "unknown") {
      console.warn(`[hooks] ${ctx.agent}/${ctx.skill}: неизвестный post_run «${h.raw}» пропущен`);
      continue;
    }
    try {
      const history = await ctx.core.listRuns(ctx.agent, ctx.skill, 5);
      review = coachLite(history, ctx.result) ?? review;
    } catch (err) {
      console.warn(
        `[hooks] coach_lite ${ctx.agent}/${ctx.skill}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return review === undefined ? {} : { review };
}
