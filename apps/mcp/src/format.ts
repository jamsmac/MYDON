import { DOMAIN_LABELS, tashkentInstant, tashkentMinute } from "@mydon/shared";
import type {
  Agent,
  AgentRun,
  Approval,
  Briefing,
  CoreEvent,
  DocFile,
  EntityCard,
  OwnerKind,
  PendingEntities,
  SkillDeck,
  Task,
  TaskPriority,
  TaskStatus,
} from "./core-client";

/**
 * Компактные форматтеры ответов Core (Р-5, R-A1-1).
 *
 * Единственная форма вывода для MCP-сервера (инструменты модели) И CLI
 * (терминал владельца): обе оболочки печатают ровно то, что вернула функция
 * отсюда, — модель и терминал НИКОГДА не видят сырой JSON Core.
 *
 * Все функции ЧИСТЫЕ: без сети, без побочных эффектов. Единственный источник
 * «текущего момента» — `ageLabel` (возраст согласования), остальные даты
 * читаются из полей самого ответа.
 */

// ── Пределы (спека волны A1) ──

/** Список по умолчанию — не больше этого числа записей на один ответ. */
export const MAX_LIST_ITEMS = 50;

/** Текст ответа — не больше этого числа символов; сверх — `clamp`. */
export const MAX_RESPONSE_CHARS = 8_000;

/** `kb_read` — не больше этого числа БАЙТ содержимого документа. */
export const MAX_KB_BYTES = 64 * 1024;

const TRUNCATION_MARK = "…(обрезано)";

/**
 * Обрезает текст ровно по `limit` символов, честно помечая обрезку меткой
 * `…(обрезано)` (сама метка входит в лимит — результат никогда не длиннее
 * `limit`). Текст короче лимита возвращается как есть.
 */
export function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;
  if (limit <= 0) return "";
  const keep = Math.max(0, limit - TRUNCATION_MARK.length);
  return text.slice(0, keep) + TRUNCATION_MARK;
}

/**
 * Обрезает строку по БАЙТАМ UTF-8, а не по символам: кириллица — два байта
 * на букву, символьный `clamp` соврал бы о фактическом размере документа
 * вдвое. Незавершённая многобайтовая последовательность на границе
 * заменяется Node на U+FFFD — это честнее тихого искажения байт.
 */
function truncateUtf8(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString("utf8");
}

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Момент источника → «YYYY-MM-DD HH:mm» по Ташкенту (часовой пояс проекта). */
function stamp(iso: string): string {
  const at = tashkentInstant(iso);
  // Кривая строка не должна пропадать молча — печатаем её как есть.
  if (!at) return iso;
  return tashkentMinute(at).replace("T", " ");
}

/** Срок задачи/дата документа: голая дата — без времени, иначе — со временем. */
function dueLabel(value: string): string {
  const trimmed = value.trim();
  return BARE_DATE.test(trimmed) ? trimmed : stamp(trimmed);
}

/** Возраст записи от `createdAt` до текущего момента, компактно («2 ч», «3 д»). */
function ageLabel(createdAt: string): string {
  const then = tashkentInstant(createdAt) ?? new Date(createdAt);
  const diffMs = Math.max(0, Date.now() - then.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} д`;
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "к выполнению",
  in_progress: "в работе",
  done: "готово",
  cancelled: "отменено",
};

const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "низкий",
  normal: "обычный",
  high: "высокий",
  urgent: "срочно",
};

const OWNER_KIND_LABELS: Record<OwnerKind, string> = {
  human: "человек",
  agent: "агент",
};

function ownerLabel(task: Task): string {
  const kind = OWNER_KIND_LABELS[task.ownerKind];
  return task.ownerRef ? `${kind}: ${task.ownerRef}` : `${kind} (не назначен)`;
}

interface Limited<T> {
  shown: T[];
  total: number;
  truncated: boolean;
}

/** Отбирает первые `limit` записей, честно храня, сколько их было всего. */
function limitList<T>(items: readonly T[], limit: number): Limited<T> {
  const total = items.length;
  if (total <= limit) return { shown: [...items], total, truncated: false };
  return { shown: items.slice(0, limit), total, truncated: true };
}

/** Строка-пометка обрезки списка; пустая строка, если список не резался. */
function truncationNote(l: Limited<unknown>): string {
  return l.truncated ? `Показаны первые ${l.shown.length} из ${l.total}.` : "";
}

// ── Форматтеры ──

/**
 * Очередь решений владельца: согласования + карточки/поля реестра, ждущие
 * подтверждения. Пустой вход — честная фраза, а не пустая строка: агент,
 * который не видит текста, не отличит «всё решено» от «сломался запрос».
 */
export function formatInbox(
  approvals: Approval[],
  entities: PendingEntities,
  limit: number = MAX_LIST_ITEMS,
): string {
  const entityTotal = entities.cards.length + entities.fields.length;
  if (approvals.length === 0 && entityTotal === 0) return "Ничего не ждёт решения";

  const lines = [`Ждёт решения: ${approvals.length} согласований, ${entityTotal} записей`];

  if (approvals.length > 0) {
    const l = limitList(approvals, limit);
    const note = truncationNote(l);
    if (note) lines.push(note);
    for (const a of l.shown) {
      lines.push(`• ${a.id} · ${a.agent} · ${a.action} · ${a.tier} · ${ageLabel(a.createdAt)}`);
    }
  }

  if (entities.cards.length > 0) {
    const l = limitList(entities.cards, limit);
    lines.push(`Карточки на подтверждение: ${l.total}`);
    const note = truncationNote(l);
    if (note) lines.push(note);
    for (const c of l.shown) {
      lines.push(`• карточка ${c.id} · ${c.type} · ${c.name}`);
    }
  }

  if (entities.fields.length > 0) {
    const l = limitList(entities.fields, limit);
    lines.push(`Поля на подтверждение: ${l.total}`);
    const note = truncationNote(l);
    if (note) lines.push(note);
    for (const f of l.shown) {
      lines.push(`• поле ${f.id} · ${f.entityName}.${f.field} = ${f.value}`);
    }
  }

  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Список задач: статус, владелец и срок (по Ташкенту) в одну строку на задачу. */
export function formatTasks(tasks: Task[], limit: number = MAX_LIST_ITEMS): string {
  if (tasks.length === 0) return "Задач нет.";
  const l = limitList(tasks, limit);
  const lines = [`Задачи: ${l.total}`];
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const t of l.shown) {
    const due = t.due ? `, срок ${dueLabel(t.due)}` : "";
    lines.push(`• ${t.id} [${TASK_STATUS_LABELS[t.status]}] ${t.title} — ${ownerLabel(t)}${due}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Карточка одной задачи: полный набор полей, компактно. */
export function formatTask(task: Task): string {
  const lines = [
    `Задача ${task.id}`,
    task.title,
    `Статус: ${TASK_STATUS_LABELS[task.status]} · Владелец: ${ownerLabel(task)} · Приоритет: ${TASK_PRIORITY_LABELS[task.priority]}`,
    `Домен: ${task.domain ? DOMAIN_LABELS[task.domain] : "—"} · Срок: ${task.due ? dueLabel(task.due) : "не задан"}`,
  ];
  if (task.description) lines.push(`Описание: ${task.description}`);
  lines.push(`Источник: ${task.source ?? "—"} · Создано: ${stamp(task.createdAt)}`);
  if (task.completedAt) lines.push(`Завершено: ${stamp(task.completedAt)}`);
  if (task.resultNote) lines.push(`Итог: ${task.resultNote}`);
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

const PAYLOAD_PREVIEW_CHARS = 120;

/** Первые 120 символов JSON-полезной нагрузки события — не весь payload. */
function payloadPreview(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return json.length > PAYLOAD_PREVIEW_CHARS ? `${json.slice(0, PAYLOAD_PREVIEW_CHARS)}…` : json;
}

/** Журнал событий: время (по Ташкенту), источник, тип и превью payload. */
export function formatEvents(events: CoreEvent[], limit: number = MAX_LIST_ITEMS): string {
  if (events.length === 0) return "Событий нет.";
  const l = limitList(events, limit);
  const lines = [`События: ${l.total}`];
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const e of l.shown) {
    lines.push(`• ${stamp(e.occurredAt)} · ${e.source} · ${e.type} · ${payloadPreview(e.payload)}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/**
 * Запуски агентов: кто, какой навык, по какому триггеру и с каким исходом.
 * Принимает САМ массив: `CoreClient.runs()` отдаёт `{ runs: AgentRun[] }` —
 * вызывающая сторона (Task 4/5) передаёт сюда поле `.runs`, а не весь ответ.
 */
export function formatRuns(runs: AgentRun[], limit: number = MAX_LIST_ITEMS): string {
  if (runs.length === 0) return "Запусков нет.";
  const l = limitList(runs, limit);
  const lines = [`Запуски: ${l.total}`];
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const r of l.shown) {
    const reason = r.reason ? ` (${r.reason})` : r.skipReason ? ` (пропуск: ${r.skipReason})` : "";
    lines.push(`• ${r.id} · ${r.agentName}/${r.skill} · ${r.trigger} · ${stamp(r.startedAt)} → ${r.outcome}${reason}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Карточки реестра: id, тип, имя и отметка «ждёт подтверждения». */
export function formatEntities(entities: EntityCard[], limit: number = MAX_LIST_ITEMS): string {
  if (entities.length === 0) return "Карточек нет.";
  const l = limitList(entities, limit);
  const lines = [`Карточки: ${l.total}`];
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const c of l.shown) {
    const ref = c.externalRef ? ` (${c.externalRef})` : "";
    const pending = c.approvedAt ? "" : " · ждёт подтверждения";
    lines.push(`• ${c.id} · ${c.type} · ${c.name}${ref}${pending}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Список агентов: имя, направление, статус и уровень автономии. */
export function formatAgents(agents: Agent[], limit: number = MAX_LIST_ITEMS): string {
  if (agents.length === 0) return "Агентов нет.";
  const l = limitList(agents, limit);
  const lines = [`Агенты: ${l.total}`];
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const a of l.shown) {
    const archived = a.archivedAt ? " · архивирован" : "";
    lines.push(`• ${a.name} · ${a.business} · ${a.status} · автономия ${a.autonomyDefault}${archived}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Колода навыков: модель синка + по строке на пункт (агент/навык/тир/проблемы). */
export function formatDeck(deck: SkillDeck, limit: number = MAX_LIST_ITEMS): string {
  const synced = deck.syncedAt ? stamp(deck.syncedAt) : "никогда";
  const fallback = deck.models.fallbacks.length ? ` (резерв: ${deck.models.fallbacks.join(", ")})` : "";
  const lines = [`Синхронизировано: ${synced} · модель: ${deck.models.primary ?? "не задана"}${fallback}`];

  if (deck.items.length === 0) {
    lines.push("Навыков нет.");
    return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
  }

  const l = limitList(deck.items, limit);
  lines.push(`Навыки: ${l.total}`);
  const note = truncationNote(l);
  if (note) lines.push(note);
  for (const item of l.shown) {
    const tier = item.tier ?? "—";
    const disabled = item.enabled ? "" : " · выключен";
    const problems = item.problems.length ? ` · проблемы: ${item.problems.join("; ")}` : "";
    lines.push(`• ${item.agent}/${item.skill} · ${item.description} · тир ${tier}${disabled}${problems}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/** Утренняя сводка одним блоком: деньги, простой, согласования, договоры. */
export function formatBriefing(briefing: Briefing): string {
  const money = briefing.overdueMoney.toLocaleString("ru-RU");
  const lines = [
    `Брифинг на ${stamp(briefing.generatedAt)} (${briefing.tz})`,
    `Просрочка денег: ${money} UZS · Простаивающие автоматы: ${briefing.idleMachines}`,
    `Ждёт решения: ${briefing.pendingApprovals} · Просроченные задачи: ${briefing.overdueTasks}`,
    `Договоры: скоро истекают ${briefing.contractsDueSoon} · с плохой датой ${briefing.contractsBadDate}`,
  ];
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

/**
 * Содержимое документа знаний (`kb_read`). Core всегда отдаёт файл целиком —
 * предел в 64 КБ держит эта функция: длинные страницы обрезаются по байтам
 * UTF-8 с честной пометкой, сколько байт показано и сколько их всего
 * (`file.bytes` — размер на диске, из метаданных Core).
 */
export function formatDoc(file: DocFile): string {
  const header = `# ${file.title}\n${file.path} (${file.root}) · ${file.bytes} Б · обновлено ${dueLabel(file.updatedAt)}\n\n`;
  const bodyBytes = Buffer.byteLength(file.markdown, "utf8");
  if (bodyBytes <= MAX_KB_BYTES) return header + file.markdown;

  const shown = truncateUtf8(file.markdown, MAX_KB_BYTES);
  const shownBytes = Buffer.byteLength(shown, "utf8");
  return `${header}${shown}\n\n…(обрезано: показано ${shownBytes} из ${file.bytes} байт)`;
}
