import { RUN_OUTCOME_LABELS, RUN_SKIP_REASONS, isRunOutcome, isSkipReason } from "@mydon/shared";

/**
 * Состояние агента словами (волна A2, R-A2-1; решения Р-1 и Р-2 — Р-2 в редакции
 * перепроверки прода 07.09.2026, корень 1).
 *
 * Чистая функция над уже прочитанными данными: сетка на главной и карточка
 * агента спрашивают одно и то же — «работает ли он прямо сейчас и почему нет».
 * Считать это в панели значило бы тянуть туда все задачи и повторять правило
 * лизы в третьем месте (worker, Core, панель), а разошедшиеся копии правила
 * показывают работающих агентов при выключенной системе.
 *
 * Паспортный `status` (`active | paused | draft | deprecated`) — это НЕ
 * занятость: на нём сетка отвечала бы «работают 12» у выключенных карточек.
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
   * ОБА ТУМБЛЕРА — НАСТРОЙКА СИСТЕМЫ, А НЕ ЗАНЯТОСТЬ АГЕНТА (перепроверка
   * прода, корень 1). Рантайм гейтит две очереди РАЗНЫМИ тумблерами
   * (`apps/agents/src/index.ts`: `pollTaskQueue("scheduled", schedulesPaused)`
   * и `pollTaskQueue("assigned", tasksPaused)`; `isAssignedTaskSql()` исключает
   * `source = agent-schedule`). Пауза задач останавливает только НОВЫЕ claim'ы
   * ПОРУЧЕННЫХ задач: уже начатая задача завершается (так написано у самого
   * ключа в `config-spec.ts`), а cron-навык при `AGENTS_SCHEDULES_PAUSED=0`
   * материализуется durable-задачей и исполняется — с платным вызовом, с
   * затыком от Core, со всем. Прежняя редакция Р-2 считала, что при паузе
   * задач «ни один агент не возьмёт задачу», и возвращала `paused` КАЖДОМУ
   * агенту раньше проверки живого claim: на проде (`AGENTS_TASKS_PAUSED=1`,
   * `AGENTS_SCHEDULES_PAUSED=0`) это были тринадцать одинаковых серых плиток
   * над работающими и заблокированными cron-агентами, а «Ближайшие 24 ч» на
   * том же экране перечисляли их предстоящие запуски.
   *
   * Поэтому `tasks` участвует в вердикте ТОЛЬКО когда сказать больше нечего:
   * ни живого claim, ни затыка, ни оборванной задачи. `schedules` в вердикте
   * не участвует вовсе (круг починок, C-4): назначенную задачу агент возьмёт и
   * при выключенных расписаниях. Обе паузы едут в ответе `GET /agents/status`
   * рядом с агентами, и панель называет каждую ОТДЕЛЬНОЙ строкой («настройка
   * системы, а не состояние агента») — на сетке главной и в карточке агента.
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

/**
 * Причина «на паузе» по системному тумблеру задач.
 *
 * Называет, ЧТО остановлено (назначенные задачи) и чего пауза НЕ трогает
 * (cron-прогоны): без второй половины плитка «на паузе» спорила бы с блоком
 * «Ближайшие 24 ч» на том же экране, где стоят предстоящие запуски этого же
 * агента. Оборот «этой паузой» точен и при включённой паузе расписаний — её
 * панель называет своей отдельной строкой.
 */
export const TASKS_PAUSED_REASON =
  "назначенные задачи на паузе (это настройка системы, а не агента); cron-прогоны этой паузой не остановлены";

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
 * Порядок правил (постановление ветки; перепроверка прода 07.09.2026 опустила
 * системную паузу задач ниже занятости и затыка): архив → паспортная пауза →
 * затык → работает → оборванный claim → упавший прогон → системная пауза задач
 * → молчит.
 *
 * ЗАНЯТОСТЬ И ЗАТЫК СТОЯТ ВЫШЕ СИСТЕМНОЙ ПАУЗЫ ЗАДАЧ. Если агент держит задачу,
 * он работает, что бы ни говорил тумблер: пауза задач не отбирает уже взятую
 * задачу и не касается cron-задач вовсе (см. `AgentStateInput.paused`). «На
 * паузе» над живым claim прятало бы платный прогон, над затыком — поломку,
 * которую надо разбирать, над оборванным claim — упавший worker. Тумблер —
 * настройка системы, и панель показывает его своей строкой; состоянием он
 * становится, только когда об агенте нечего сказать больше.
 *
 * Паспортная пауза ВЫШЕ занятости остаётся: это выключатель самого агента в
 * его карточке, и владелец, выключивший агента, должен видеть именно это.
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

  // 2. Паспортная пауза: причина называет статус, чтобы было понятно, что править.
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

  // 3. Затык: Core остановил исполнение и записал причину — цитируем её.
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

  // 4. Работает. Если рядом висит СТАРЫЙ неразобранный затык — говорим и о нём:
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

  // 5. Задача есть, но claim протух: worker упал или был убит на середине.
  //    Это не работа и не затык — задача свободна для нового захода. Выше
  //    системной паузы: оборванная задача — факт об ЭТОМ агенте, а тумблер
  //    ничего о ней не знает.
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

  // 6. Задач нет вовсе, а последний прогон упал — затык до разбора. Выше
  //    системной паузы: тумблер не разбирает поломку за владельца.
  if (input.lastRun !== null && input.lastRun.outcome === "failed") {
    return { state: "blocked", reason: `последний прогон упал: ${input.lastRun.reason}`, since: input.lastRun.at };
  }

  // 7. Системная пауза задач — только теперь, когда ни занятости, ни затыка:
  //    сказать об агенте больше нечего, и настройка системы объясняет молчание.
  if (input.paused.tasks) {
    return { state: "paused", reason: TASKS_PAUSED_REASON };
  }

  // 8. Молчит: последний прогон прошёл или тихо пропущен.
  if (input.lastRun !== null) {
    return { state: "idle", reason: runWords(input.lastRun), since: input.lastRun.at };
  }

  // 9. Ни задач, ни прогонов. «Всё спокойно» здесь было бы ложью: спокойствие
  //    и никогда не запускавшийся агент выглядят одинаково только на экране.
  return { state: "idle", reason: "ещё не запускался: в журнале прогонов нет ни одной записи" };
}
