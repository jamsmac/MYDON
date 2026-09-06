import { RUN_OUTCOME_LABELS, RUN_SKIP_REASONS, isRunOutcome, isSkipReason } from "@mydon/shared";

/**
 * Состояние агента словами (волна A2, R-A2-1; решения Р-1 и Р-2).
 *
 * Чистая функция над уже прочитанными данными: сетка на главной и карточка
 * агента спрашивают одно и то же — «работает ли он прямо сейчас и почему нет».
 * Считать это в панели значило бы тянуть туда все задачи и повторять правило
 * лизы в третьем месте (worker, Core, панель), а разошедшиеся копии правила
 * показывают работающих агентов при выключенной системе.
 *
 * Паспортный `status` (`active | paused | draft | deprecated`) — это НЕ
 * занятость: на нём сетка отвечала бы «работают 12» при `AGENTS_TASKS_PAUSED=1`.
 */
export const AGENT_STATES = ["working", "blocked", "paused", "idle"] as const;
export type AgentState = (typeof AGENT_STATES)[number];

/** Задача агента, которая сейчас держит его внимание: в работе или остановлена Core. */
export interface ClaimedTaskLite {
  id: string;
  skill: string | null;
  /** Момент захвата задачи worker'ом; NULL — задача отпущена или ещё не бралась. */
  claimedAt: Date | null;
  blockedAt: Date | null;
  blockedReason: string | null;
}

/** Последний прогон агента из журнала `agent_run` — история, а не «прямо сейчас». */
export interface LastRunLite {
  at: Date;
  outcome: string;
  skipReason: string | null;
  reason: string;
}

export interface AgentStateInput {
  passportStatus: string;
  archivedAt: Date | null;
  /**
   * Задачи ЭТОГО агента, о которых стоит говорить: `status = in_progress`
   * (там живёт claim) плюс остановленные Core (`agent_execution_blocked_at`) —
   * их Core возвращает в `todo`, и по одному `in_progress` затык был бы не виден.
   */
  claimedTasks: ClaimedTaskLite[];
  lastRun: LastRunLite | null;
  /**
   * Системные тумблеры парка.
   *
   * ВЕРДИКТ ЧИТАЕТ ТОЛЬКО `tasks`, И ЭТО НАРОЧНО (круг починок, C-4). Пауза
   * задач ОТНИМАЕТ У АГЕНТА ЗАНЯТОСТЬ: взять работу он не может, и «работает»
   * было бы ложью. Пауза РАСПИСАНИЙ занятости не отменяет — назначенную задачу
   * агент возьмёт и выполнит, — поэтому состоянием она не является и в
   * приоритет правил не встраивается: сделать её четвёртым `paused` значило бы
   * показать «на паузе» у агента, который прямо сейчас работает.
   *
   * Но и молчать о ней нельзя: `schedules` едет в ответе `GET /agents/status`
   * рядом с агентами, и ОБЕ поверхности панели называют её отдельной строкой
   * («настройка системы, а не состояние агента») — сетка на главной и карточка
   * агента с расписанием.
   */
  paused: { tasks: boolean; schedules: boolean };
  now: Date;
  /** `TasksService.AGENT_RUN_LEASE_MS`: после лизы claim протух, задача свободна. */
  leaseMs: number;
}

export interface AgentStateVerdict {
  state: AgentState;
  /** Одна фраза по-русски, называющая источник вывода: навык, статус или настройку. */
  reason: string;
  /** С какого момента состояние держится; отсутствует, когда честно неизвестно. */
  since?: Date;
  taskId?: string;
  skill?: string;
}

/** Паспортный статус → фраза, называющая сам статус: владельцу править карточку. */
const PASSPORT_REASON: Record<string, string> = {
  paused: "агент выключен в карточке (статус paused)",
  draft: "агент ещё не введён в работу (статус draft)",
  deprecated: "агент выведен из работы (статус deprecated)",
};

/** «Навык X» или честное «навык не указан»: задачу агенту мог назначить и владелец. */
function skillWords(skill: string | null): string {
  return skill === null ? "навык не указан" : `навык «${skill}»`;
}

/** Самая ранняя задача по указанной отметке: «с каких пор» не должно скакать между запросами. */
function earliest(
  tasks: ClaimedTaskLite[],
  stamp: (t: ClaimedTaskLite) => Date | null,
): { task: ClaimedTaskLite; at: Date } | null {
  let best: { task: ClaimedTaskLite; at: Date } | null = null;
  for (const t of tasks) {
    const at = stamp(t);
    if (at === null) continue;
    if (best === null || at.getTime() < best.at.getTime()) best = { task: t, at };
  }
  return best;
}

/** Исход прогона словами из общего словаря (`@mydon/shared`), а не второй формулировкой. */
function runWords(run: LastRunLite): string {
  if (run.outcome === "skipped") {
    const label = isSkipReason(run.skipReason) ? RUN_SKIP_REASONS[run.skipReason].label : null;
    return `последний прогон пропущен — ${label ?? run.reason}`;
  }
  const label = isRunOutcome(run.outcome) ? RUN_OUTCOME_LABELS[run.outcome] : run.outcome;
  return `последний прогон — ${label}`;
}

/**
 * Порядок правил (постановление ветки): архив → системная пауза задач →
 * паспортная пауза → blocked → working → idle.
 *
 * Занятость стоит НИЖЕ пауз сознательно (Р-2): при выключенных задачах агент
 * не может взять работу, и «работает» было бы ложью на самом заметном экране.
 *
 * Внутри «blocked» есть уточнение (постановление ветки, раунд правок 1): затык
 * перекрывает занятость, только если он относится к ТЕКУЩЕЙ работе (та же
 * задача или отметка не старше живого claim) либо живой работы нет вовсе. Иначе
 * один неразобранный затык недельной давности навсегда показывал бы агента
 * заблокированным, пока тот в эту минуту выполняет другую задачу.
 */
export function computeAgentState(input: AgentStateInput): AgentStateVerdict {
  // 1. Архив: карточка снята с работы, остальные признаки уже неважны.
  if (input.archivedAt !== null) {
    return { state: "paused", reason: "агент в архиве: карточка снята с работы", since: input.archivedAt };
  }

  // 2. Системная пауза задач перекрывает занятость и говорит об этом (Р-2).
  if (input.paused.tasks) {
    return {
      state: "paused",
      reason: "задачи агентов на паузе (это настройка системы, а не агента)",
    };
  }

  // 3. Паспортная пауза: причина называет статус, чтобы было понятно, что править.
  if (input.passportStatus !== "active") {
    return {
      state: "paused",
      reason: PASSPORT_REASON[input.passportStatus] ?? `агент не в работе (статус ${input.passportStatus})`,
    };
  }

  // Живая работа: claim свежее лизы. Знак сравнения тот же, что в предикате
  // `claimAgentRun` (`claimed_at <= now - lease` — уже свободна): свой знак
  // здесь развёл бы показ с тем, что реально делает worker.
  const staleBefore = input.now.getTime() - input.leaseMs;
  const live = earliest(input.claimedTasks, (t) =>
    t.claimedAt !== null && t.claimedAt.getTime() > staleBefore ? t.claimedAt : null,
  );
  const blocked = earliest(input.claimedTasks, (t) => t.blockedAt);

  // 4. Затык: Core остановил исполнение и записал причину — цитируем её.
  //    Перекрывает работу, только если относится к текущему заходу: та же
  //    задача, отметка не старше живого claim, или живой работы нет.
  const затыкОтноситсяКРаботе =
    blocked !== null &&
    (live === null || blocked.task.id === live.task.id || blocked.at.getTime() >= live.at.getTime());
  if (blocked !== null && затыкОтноситсяКРаботе) {
    const { task, at } = blocked;
    return {
      state: "blocked",
      reason: `Core остановил задачу (${skillWords(task.skill)}): ${task.blockedReason ?? "причина не записана"}`,
      since: at,
      taskId: task.id,
      ...(task.skill !== null ? { skill: task.skill } : {}),
    };
  }

  // 5. Работает. Если рядом висит СТАРЫЙ неразобранный затык — говорим и о нём:
  //    состояние честное («работает»), но хвост не должен пропасть с экрана.
  if (live !== null) {
    const { task, at } = live;
    const хвост =
      blocked !== null
        ? `; прежний затык Core не разобран (${skillWords(blocked.task.skill)})`
        : "";
    return {
      state: "working",
      reason: `выполняет задачу (${skillWords(task.skill)})${хвост}`,
      since: at,
      taskId: task.id,
      ...(task.skill !== null ? { skill: task.skill } : {}),
    };
  }

  // 6. Задача есть, но claim протух: worker упал или был убит на середине.
  //    Это не работа и не затык — задача свободна для нового захода.
  const stale = earliest(input.claimedTasks, (t) => t.claimedAt);
  if (stale !== null) {
    const { task, at } = stale;
    return {
      state: "idle",
      reason: `прошлый прогон не завершился, lease истёк (${skillWords(task.skill)}) — задачу можно взять заново`,
      since: at,
      taskId: task.id,
      ...(task.skill !== null ? { skill: task.skill } : {}),
    };
  }

  // 7. Задач нет вовсе: смотрим журнал. Упавший прогон — затык до разбора.
  if (input.lastRun !== null) {
    const run = input.lastRun;
    if (run.outcome === "failed") {
      return { state: "blocked", reason: `последний прогон упал: ${run.reason}`, since: run.at };
    }
    return { state: "idle", reason: runWords(run), since: run.at };
  }

  // 8. Ни задач, ни прогонов. «Всё спокойно» здесь было бы ложью: спокойствие
  //    и никогда не запускавшийся агент выглядят одинаково только на экране.
  return { state: "idle", reason: "ещё не запускался: в журнале прогонов нет ни одной записи" };
}
