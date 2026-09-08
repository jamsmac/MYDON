import {
  AGENTS_SNAPSHOT_INTERVAL_MS,
  RUN_OUTCOME_LABELS,
  RUN_SKIP_REASONS,
  isRunOutcome,
  isSkipReason,
} from "@mydon/shared";

/**
 * Состояние агента словами (волна A2, R-A2-1; решения Р-1 и Р-2 — Р-2 отменено
 * перепроверкой прода 07.09.2026, корень 1, и ревью C-1: системные тумблеры
 * состоянием не являются вовсе).
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
  /**
   * Задача материализована расписанием (`source = agent-schedule`), а не
   * поручена через Core. Нужно ровно для одного: сказать, КТО подхватит
   * оборванную задачу — очередь расписаний или worker порученных, и не
   * обещать «можно взять заново» там, где тумблер это запрещает (ревью M-1).
   */
  scheduled: boolean;
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
   * СОСТОЯНИЕМ НЕ ЯВЛЯЕТСЯ НИ ОДИН ИЗ НИХ (перепроверка прода, корень 1;
   * ревью C-1). Рантайм гейтит две очереди РАЗНЫМИ тумблерами
   * (`apps/agents/src/index.ts`: `pollTaskQueue("scheduled", schedulesPaused)`
   * и `pollTaskQueue("assigned", tasksPaused)`; `isAssignedTaskSql()` исключает
   * `source = agent-schedule`). Пауза задач останавливает только НОВЫЕ claim'ы
   * ПОРУЧЕННЫХ задач: уже начатая завершается (так написано у самого ключа в
   * `config-spec.ts`), а cron-навык при `AGENTS_SCHEDULES_PAUSED=0`
   * материализуется durable-задачей и исполняется — с платным вызовом, с
   * затыком от Core, со всем. Прежняя редакция Р-2 возвращала `paused`
   * КАЖДОМУ агенту раньше проверки claim; первая починка опустила паузу ниже
   * занятости — и cron-агент между прогонами всё равно стоял «на паузе»
   * двадцать три часа в сутки без «последний прогон — выполнено · 2 ч назад»,
   * а поломка `skipped/llm_failed` пряталась за самой спокойной плиткой.
   *
   * Тумблер — свойство системы, которое агента не останавливает, и панель
   * показывает его ОТДЕЛЬНОЙ строкой на всех трёх поверхностях (сетка,
   * карточка, список). В вердикте оба участвуют только словами — в судьбе
   * оборванной задачи (правило 6): кто её подхватит и подхватит ли вообще.
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

/**
 * Самая ПОЗДНЯЯ задача по указанной отметке — обратная полярность `earliest`,
 * и заведена она отдельно, а `earliest` не тронут: у длительности и у затыка
 * разные вопросы.
 *
 * `earliest` отвечает «с каких пор это длится» — начало работы, начало
 * оборванного claim'а: там нужна самая ранняя отметка, иначе «с каких пор»
 * скачет между запросами при нескольких задачах. Затык отвечает на другое —
 * «что случилось ПОСЛЕДНИМ»: свежий затык описывает ТЕКУЩЕЕ положение агента,
 * старый — историю, а экран, называющий историю текущим состоянием, врёт.
 *
 * Что ломал здесь `earliest` (перепроверка A2, П1): затык неделю назад плюс
 * живой claim минуту назад плюс затык тридцать секунд назад — сравнение с
 * живым claim шло по НЕДЕЛЬНОЙ отметке, оказывалось ложным, и вердикт был
 * «работает; прежний затык Core не разобран». Свежий затык не назван ни
 * состоянием, ни хвостом — то есть Core только что остановил задачу, а экран
 * об этом молчал. Без живого claim состояние выходило верным, но `reason`,
 * `since` и `taskId` были от недельного затыка: причина не та.
 */
function latest(
  tasks: ClaimedTaskLite[],
  stamp: (t: ClaimedTaskLite) => Date | null,
): { task: ClaimedTaskLite; at: Date } | null {
  let best: { task: ClaimedTaskLite; at: Date } | null = null;
  for (const t of tasks) {
    const at = stamp(t);
    if (at === null) continue;
    if (best === null || at.getTime() > best.at.getTime()) best = { task: t, at };
  }
  return best;
}

/**
 * «Ещё N прежних затыков» — фраза без разделителя; `null`, когда затык один.
 *
 * Цитируем мы всегда ОДИН затык (самый свежий), а разбирать владельцу нужно
 * каждый: без этого счётчика прежние неразобранные молча исчезали бы за самым
 * новым — ровно то же исчезновение, из-за которого затык и брали `earliest`.
 */
function ещёЗатыки(затыковВсего: number): string | null {
  return затыковВсего > 1 ? `прежних затыков не разобрано ещё: ${затыковВсего - 1}` : null;
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
 * Порядок правил (постановление ветки; перепроверка прода 07.09.2026 и ревью
 * C-1/I-1): архив → живая работа (затык на ней → затык, иначе работает) →
 * паспортная пауза → затык без живой работы → оборванный claim → упавший
 * прогон → молчит. Системные тумблеры состояния не дают вовсе.
 *
 * ЖИВОЙ CLAIM — ВЫШЕ ВСЕГО, КРОМЕ АРХИВА. Если агент держит задачу, он
 * работает, что бы ни говорил тумблер системы и что бы ни стояло в его
 * карточке: рантайм перечитывает карточки раз в `AGENTS_SNAPSHOT_INTERVAL_MS`,
 * и выключенный владельцем агент до перечитки берёт задачи и жжёт cron (ревью
 * I-1) — «на паузе» над таким claim врало бы в обратную сторону. Такой агент —
 * «работает: дорабатывает начатую задачу», а паспорт назван в причине.
 * Паспортная пауза решает, только когда живой работы нет: тогда это ответ
 * «почему молчит», и он точнее старого затыка или журнала.
 *
 * Внутри «blocked» есть уточнение (постановление ветки, раунд правок 1): затык
 * перекрывает занятость, только если он относится к ТЕКУЩЕЙ работе (та же
 * задача или отметка не старше живого claim) либо живой работы нет вовсе. Иначе
 * один неразобранный затык недельной давности навсегда показывал бы агента
 * заблокированным, пока тот в эту минуту выполняет другую задачу.
 *
 * И сравнивается с живым claim, и цитируется САМЫЙ СВЕЖИЙ затык (`latest`;
 * перепроверка A2, П1) — тот, что описывает текущее положение. Прежние
 * неразобранные названы счётчиком `ещёЗатыки`, чтобы не пропали.
 */
export function computeAgentState(input: AgentStateInput): AgentStateVerdict {
  // 1. Архив: карточка снята с работы, остальные признаки уже неважны.
  if (input.archivedAt !== null) {
    return { state: "paused", reason: "агент в архиве: карточка снята с работы", since: input.archivedAt };
  }

  // Живая работа: claim свежее лизы. Знак сравнения тот же, что в предикате
  // `claimAgentRun` (`claimed_at <= now - lease` — уже свободна): свой знак
  // здесь развёл бы показ с тем, что реально делает worker.
  const staleBefore = input.now.getTime() - input.leaseMs;
  const live = earliest(input.claimedTasks, (t) =>
    t.claimedAt !== null && t.claimedAt.getTime() > staleBefore ? t.claimedAt : null,
  );
  // Затык — САМЫЙ НОВЫЙ (`latest`, не `earliest`): полярность объяснена у
  // самой функции. Он и сравнивается с живым claim, и попадает в цитату.
  const blocked = latest(input.claimedTasks, (t) => t.blockedAt);
  // Прежние неразобранные затыки не должны пропасть за процитированным.
  const затыковВсего = input.claimedTasks.reduce((n, t) => n + (t.blockedAt !== null ? 1 : 0), 0);
  const паспортВыключен = input.passportStatus !== "active";

  if (live !== null) {
    // 2. Затык на ТЕКУЩЕЙ работе (та же задача или отметка не старше живого
    //    claim) перекрывает работу: Core остановил именно этот заход.
    if (blocked !== null && (blocked.task.id === live.task.id || blocked.at.getTime() >= live.at.getTime())) {
      return затык(blocked.task, blocked.at, затыковВсего);
    }
    // 3. Работает. Старый неразобранный затык и выключенная карточка — хвостом:
    //    состояние честное («работает»), но ни то ни другое не должно пропасть.
    const { task, at } = live;
    const хвосты = [
      blocked !== null ? `прежний затык Core не разобран (${skillWords(blocked.task.skill)})` : null,
      // Хвост называет САМЫЙ СВЕЖИЙ из прежних затыков (все они старше живого
      // claim — иначе сработало бы правило 2), а счётчик держит на виду
      // остальные: их тоже некому разобрать, кроме владельца.
      blocked !== null ? ещёЗатыки(затыковВсего) : null,
      // «НЕ ВОЗЬМЁТ ПОСЛЕ ПЕРЕЧИТКИ», А НЕ «НЕ ВОЗЬМЁТ» (ревью Ф-5): оба гейта
      // рантайма (`index.ts`, `task-worker.ts`) читают карточки из памяти,
      // которую тик обновляет раз в `AGENTS_SNAPSHOT_INTERVAL_MS`, а у Core
      // предиката по статусу агента в claim нет вовсе — в этом окне worker
      // берёт и новые задачи.
      паспортВыключен
        ? `в карточке выключен (статус ${input.passportStatus}) — дорабатывает начатую задачу, ` +
          `новых не возьмёт после перечитки карточек (до ${AGENTS_SNAPSHOT_INTERVAL_MS / 60_000} мин)`
        : null,
    ].filter((х): х is string => х !== null);
    return {
      state: "working",
      reason: `выполняет задачу (${skillWords(task.skill)})${хвосты.length > 0 ? `; ${хвосты.join("; ")}` : ""}`,
      since: at,
      taskId: task.id,
      ...(task.skill !== null ? { skill: task.skill } : {}),
    };
  }

  // 4. Паспортная пауза: живой работы нет, и причина называет статус, чтобы
  //    было понятно, что править.
  //
  //    НЕРАЗОБРАННАЯ ПОЛОМКА УХОДИТ В ПРИЧИНУ ХВОСТОМ (ревью Ф-3). Сценарий
  //    бытовой: Core остановил задачу (`skill_failed`, возможно с оплаченным
  //    вызовом в неизвестном исходе), владелец гасит карточку, чтобы
  //    остановить кровотечение, — и затык пропадал с экрана совсем: «на паузе:
  //    агент выключен в карточке», ни слова о задаче, полосы внимания нет (она
  //    только у `idle`), в сводке он среди «на паузе». То же для упавшего
  //    прогона. Состояние остаётся `paused` — это честный ответ на «почему
  //    молчит», — но хвост не даёт поломке исчезнуть, как уже сделано для
  //    `working` под выключенной карточкой.
  if (паспортВыключен) {
    const статус = PASSPORT_REASON[input.passportStatus] ?? `агент не в работе (статус ${input.passportStatus})`;
    const ещё = ещёЗатыки(затыковВсего);
    const хвост =
      blocked !== null
        ? `; неразобранный затык Core (${skillWords(blocked.task.skill)}): ` +
          `${blocked.task.blockedReason ?? "причина не записана"}${ещё !== null ? `; ${ещё}` : ""}`
        : input.lastRun !== null && input.lastRun.outcome === "failed"
          ? `; последний прогон упал: ${input.lastRun.reason}`
          : "";
    return {
      state: "paused",
      reason: `${статус}${хвост}`,
      // Ссылку на задачу отдаём, чтобы затык был куда открыть; `since` не
      // ставим — момент выключения карточки нам неизвестен, а датировать
      // «на паузе» временем затыка значило бы соврать о другом факте.
      ...(blocked !== null ? { taskId: blocked.task.id } : {}),
      ...(blocked !== null && blocked.task.skill !== null ? { skill: blocked.task.skill } : {}),
    };
  }

  // 5. Затык без живой работы: Core остановил исполнение и записал причину.
  if (blocked !== null) return затык(blocked.task, blocked.at, затыковВсего);

  // 6. Задача есть, но claim протух: worker упал или был убит на середине.
  //    Это не работа и не затык — но КТО подхватит задачу, зависит от её
  //    источника и тумблера (ревью M-1): порученную при паузе задач никто не
  //    возьмёт, cron-задачу — следующий опрос расписаний, если они не на паузе.
  const stale = earliest(input.claimedTasks, (t) => t.claimedAt);
  if (stale !== null) {
    const { task, at } = stale;
    const судьба = task.scheduled
      ? input.paused.schedules
        ? "cron-задачу никто не возьмёт, пока расписания на паузе"
        : "cron-задачу подхватит следующий опрос расписаний"
      : input.paused.tasks
        ? "порученную задачу никто не возьмёт, пока задачи на паузе"
        : "задачу можно взять заново";
    return {
      state: "idle",
      reason: `прошлый прогон не завершился, lease истёк (${skillWords(task.skill)}) — ${судьба}`,
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

/**
 * Вердикт «затык»: Core остановил задачу — цитируем его причину.
 *
 * Задача сюда приходит самая СВЕЖАЯ из заблокированных (`latest`), а
 * `затыковВсего` нужен, чтобы прежние неразобранные не исчезли за ней.
 */
function затык(task: ClaimedTaskLite, at: Date, затыковВсего: number): AgentStateVerdict {
  const ещё = ещёЗатыки(затыковВсего);
  return {
    state: "blocked",
    reason:
      `Core остановил задачу (${skillWords(task.skill)}): ` +
      `${task.blockedReason ?? "причина не записана"}${ещё !== null ? `; ${ещё}` : ""}`,
    since: at,
    taskId: task.id,
    ...(task.skill !== null ? { skill: task.skill } : {}),
  };
}
