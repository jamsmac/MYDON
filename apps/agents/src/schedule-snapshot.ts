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
  notWired: { agent: string; skill: string; reason: "no_implementation" | "llm_route_off" }[];
  monitors: MonitorState[];
}

export interface SnapshotInput {
  now: Date;
  jobs: readonly ScheduledJob[];
  modeOf: (skill: string) => ScheduledInvocationMode;
  /** Ссылки вида «агент/навык» из `desiredJobs`. */
  notWired: readonly string[];
  isLlmSkill: (skill: string) => boolean;
  monitors: readonly MonitorState[];
  paused: { schedules: boolean; tasks: boolean };
}

export function buildScheduleSnapshot(i: SnapshotInput): ScheduleSnapshot {
  return {
    generatedAt: i.now.toISOString(),
    tz: TZ,
    paused: i.paused,
    jobs: i.jobs.map((j) => ({ agent: j.agent, skill: j.skill, cron: j.cron, mode: i.modeOf(j.skill) })),
    // Навык без тела чинится файлом навыка, llm-навык без маршрута — ключом в
    // окружении. Одна причина на оба случая заставляла бы владельца гадать.
    notWired: i.notWired.map((ref) => {
      const at = ref.indexOf("/");
      const agent = ref.slice(0, at), skill = ref.slice(at + 1);
      return { agent, skill, reason: i.isLlmSkill(skill) ? ("llm_route_off" as const) : ("no_implementation" as const) };
    }),
    monitors: i.monitors.map((m) => ({ ...m })),
  };
}
