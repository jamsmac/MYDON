import { Cron } from "croner";
import { TZ } from "@mydon/shared";
import type { ScheduledJob, ScheduledInvocationMode } from "./schedule";

/** Состояние монитора рантайма: включён или почему нет. */
export interface MonitorState {
  name: string;
  cron: string;
  enabled: boolean;
  reason?: "off" | "no_credentials";
}

/**
 * Что рантайм агентов реально запланировал (тело `PUT /routines/snapshot`).
 *
 * Панель без этого снимка знала бы только паспорта из базы, а не то, что
 * действительно крутится в процессе: «расписание в карточке есть, а задание не
 * заведено» — самая дорогая из тихих поломок волны R.
 */
export interface ScheduleSnapshot {
  generatedAt: string;
  tz: typeof TZ;
  paused: { schedules: boolean; tasks: boolean };
  jobs: { agent: string; skill: string; cron: string; mode: ScheduledInvocationMode }[];
  notWired: {
    agent: string;
    skill: string;
    reason: "no_implementation" | "llm_route_off" | "inactive_agent";
  }[];
  monitors: MonitorState[];
}

export interface SnapshotInput {
  now: Date;
  jobs: readonly ScheduledJob[];
  modeOf: (skill: string) => ScheduledInvocationMode;
  /** Ссылки вида «агент/навык» из `desiredJobs`. */
  notWired: readonly string[];
  /** Расписания неактивных агентов (`inactiveScheduleRefs`) — ссылки той же формы. */
  inactive: readonly string[];
  isLlmSkill: (skill: string) => boolean;
  monitors: readonly MonitorState[];
  paused: { schedules: boolean; tasks: boolean };
}

/**
 * Расписание, которое примет Core.
 *
 * Той же библиотекой и в том же часовом поясе, что и `assertCron` в Core: там
 * битое выражение — 400 на ВЕСЬ снимок, то есть одно кривое задание оставило бы
 * владельца вообще без доски.
 */
function cronAccepted(cron: string): boolean {
  try {
    new Cron(cron, { timezone: TZ, paused: true }).stop();
    return true;
  } catch {
    return false;
  }
}

/** Ссылка «агент/навык» → пара. Имя навыка без «/», поэтому режем по первому. */
function splitRef(ref: string): { agent: string; skill: string } {
  const at = ref.indexOf("/");
  return { agent: ref.slice(0, at), skill: ref.slice(at + 1) };
}

/**
 * Снимок собирается ПО ЗАДАНИЮ и терпит порчу в одном из них.
 *
 * И битое расписание, и бросок `modeOf` (metered-навык без allowlist) — беда
 * ОДНОГО задания. Снимок целиком за неё платить не должен: доска нужна как раз
 * тогда, когда что-то сломано. Поэтому кривое задание выпадает с предупреждением,
 * а неопределимый режим становится `legacy` — и остальные задания доезжают.
 */
export function buildScheduleSnapshot(i: SnapshotInput): ScheduleSnapshot {
  const jobs: ScheduleSnapshot["jobs"] = [];
  for (const j of i.jobs) {
    if (!cronAccepted(j.cron)) {
      console.warn(
        `[snapshot] ${j.agent}/${j.skill}: расписание «${j.cron}» не принято — ` +
          "задание не попало в снимок.",
      );
      continue;
    }
    let mode: ScheduledInvocationMode;
    try {
      mode = i.modeOf(j.skill);
    } catch (err) {
      console.warn(
        `[snapshot] ${j.agent}/${j.skill}: режим вызова не определён (` +
          `${err instanceof Error ? err.message : String(err)}) — пишу legacy.`,
      );
      mode = "legacy";
    }
    jobs.push({ agent: j.agent, skill: j.skill, cron: j.cron, mode });
  }
  return {
    generatedAt: i.now.toISOString(),
    tz: TZ,
    paused: i.paused,
    jobs,
    // Навык без тела чинится файлом навыка, llm-навык без маршрута — ключом в
    // окружении, расписание паузного агента — статусом в карточке. Одна причина
    // на все три случая заставляла бы владельца гадать, что именно чинить.
    notWired: [
      ...i.notWired.map((ref) => {
        const { agent, skill } = splitRef(ref);
        return { agent, skill, reason: i.isLlmSkill(skill) ? ("llm_route_off" as const) : ("no_implementation" as const) };
      }),
      ...i.inactive.map((ref) => ({ ...splitRef(ref), reason: "inactive_agent" as const })),
    ],
    // Выключенный монитор может нести cron «off» — его Core не проверяет.
    // А вот ВКЛЮЧЁННЫЙ с битым выражением снова стоил бы всего снимка, поэтому
    // такой монитор честно показываем неработающим.
    monitors: i.monitors.map((m) => {
      if (!m.enabled || cronAccepted(m.cron)) return { ...m };
      console.warn(
        `[snapshot] монитор ${m.name}: расписание «${m.cron}» не принято — считаю выключенным.`,
      );
      return { ...m, enabled: false, reason: "off" as const };
    }),
  };
}
