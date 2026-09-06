#!/usr/bin/env node
import type { Domain } from "@mydon/shared";
import { DOMAIN_LABELS } from "@mydon/shared";
import { parseArgs, type ParsedArgs } from "./args";
import { loadEnv } from "./env";
import {
  CoreError,
  createClient,
  type ApprovalDecision,
  type CoreClient,
  type CreateTaskInput,
  type EntitiesQuery,
  type EventsQuery,
  type OwnerKind,
  type RunsQuery,
  type TaskPriority,
  type TasksQuery,
  type TaskStatus,
} from "./core-client";
import {
  formatAgents,
  formatBriefing,
  formatDoc,
  formatEntities,
  formatEvents,
  formatInbox,
  formatRuns,
  formatTask,
  formatTasks,
} from "./format";

/**
 * CLI `mydon` поверх того же клиента Core, что и MCP-сервер (Р-1, R-A1-3).
 *
 * `runCommand` — чистая функция: не читает `process.env`/`process.argv`, не
 * печатает и не завершает процесс, поэтому тестируется без реального Core
 * (стаб клиента). Печать и `process.exitCode` — только в `main()` ниже.
 */

export interface CliDeps {
  client: CoreClient;
}

/**
 * Флаг, который понимает ЛЮБАЯ команда: форма ответа — свойство вывода, а не
 * конкретной команды.
 */
const GLOBAL_FLAGS: readonly string[] = ["json"];

/**
 * Какие флаги применимы к какой команде (`--json` подразумевается везде).
 *
 * `parseArgs` знает только общий словарь флагов и ловит опечатки; он не знает,
 * какая команда что читает, — и `task-create --status done` проходил разбор,
 * а потом ТИХО пропадал: статус новой задачи не задаётся, а владелец уверен,
 * что задал. Эта карта закрывает разрыв на стороне CLI, не трогая контракт
 * `parseArgs(argv)`: чужой для команды флаг — usage-ошибка с кодом 2.
 *
 * Заодно это единственный список команд: диспетчер, подсказка и проверка
 * флагов читают его, и разъехаться им негде.
 */
const COMMAND_FLAGS = {
  inbox: [],
  tasks: ["status", "owner", "domain", "limit"],
  task: [],
  "task-create": [
    "yes",
    "title",
    "description",
    "owner",
    "owner-kind",
    "domain",
    "due",
    "priority",
  ],
  events: ["source", "type", "limit"],
  runs: ["agent", "skill", "limit"],
  kb: [],
  search: ["domain", "type", "limit"],
  briefing: [],
  agents: [],
  decide: ["yes"],
} as const satisfies Record<string, readonly string[]>;

type Command = keyof typeof COMMAND_FLAGS;

/** Список команд CLI — используется и для диспетчера, и для текста подсказки. */
const COMMANDS = Object.keys(COMMAND_FLAGS) as Command[];

function isCommand(value: string): value is Command {
  return Object.prototype.hasOwnProperty.call(COMMAND_FLAGS, value);
}

/**
 * Ошибка использования CLI (не хватает аргумента, неверное значение
 * перечисления, неизвестная команда). Отличается от `CoreError` кодом
 * возврата: усage-ошибка — код 2, ошибка Core — код 1.
 */
class UsageError extends Error {}

/**
 * Источник задач, созданных этой командой.
 *
 * Отличается от `mcp` у инструмента `task_create` намеренно: происхождение
 * задачи видно в карточке, и «модель завела сама» против «владелец набрал в
 * терминале» — разные истории. До волны A1 задача из CLI приходила вовсе без
 * источника и в ленте выглядела ничьей.
 */
const TASK_SOURCE = "mydon-cli";

/**
 * Строковое значение флага; отсутствие — `undefined`, флаг без значения —
 * usage-ошибка.
 *
 * Раньше `--status` в конце строки или перед другим флагом (парсер отдаёт
 * такой флаг как `true`) молча превращался в «не задано»: `mydon tasks
 * --status --limit 10` выводил ВСЕ задачи, а спрашивали про одно состояние.
 * Тихо отброшенный фильтр опаснее отказа — ответ выглядит здоровым и отвечает
 * не на тот вопрос. `numFlag` на том же вводе отказывает; правило у CLI одно.
 */
function strFlag(flags: ParsedArgs["flags"], name: string): string | undefined {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  // Не строка — флаг дан без значения (парсер отдаёт `true`); пустая строка
  // (`--status=`) — он же, только записанный иначе: значения нет ни там, ни там.
  if (typeof raw !== "string" || !raw.trim()) {
    throw new UsageError(`--${name} требует значения`);
  }
  return raw;
}

/** Числовое значение флага; отсутствие — `undefined`, а не число, кривое значение — usage-ошибка. */
function numFlag(flags: ParsedArgs["flags"], name: string): number | undefined {
  const raw = flags[name];
  if (raw === undefined) return undefined;
  if (raw === true) throw new UsageError(`--${name} требует числового значения`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new UsageError(`--${name} должен быть числом, получено: ${raw}`);
  return n;
}

function requirePositional(parsed: ParsedArgs, index: number, label: string): string {
  const value = parsed.positional[index];
  if (!value) throw new UsageError(`нужен аргумент: ${label}`);
  return value;
}

// ── Читающие команды ──

async function handleInbox(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const [approvals, entities] = await Promise.all([
    deps.client.pendingApprovals(),
    deps.client.pendingEntities(),
  ]);
  if (parsed.flags.json) return JSON.stringify({ approvals, entities });
  return formatInbox(approvals, entities);
}

async function handleTasks(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const query: TasksQuery = {
    status: strFlag(parsed.flags, "status") as TaskStatus | undefined,
    ownerRef: strFlag(parsed.flags, "owner"),
    domain: strFlag(parsed.flags, "domain") as Domain | undefined,
    limit: numFlag(parsed.flags, "limit"),
  };
  const tasks = await deps.client.tasks(query);
  if (parsed.flags.json) return JSON.stringify(tasks);
  return formatTasks(tasks);
}

async function handleTask(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const id = requirePositional(parsed, 0, "id задачи");
  const task = await deps.client.task(id);
  if (parsed.flags.json) return JSON.stringify(task);
  return formatTask(task);
}

async function handleEvents(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const query: EventsQuery = {
    source: strFlag(parsed.flags, "source"),
    type: strFlag(parsed.flags, "type"),
    limit: numFlag(parsed.flags, "limit"),
  };
  const events = await deps.client.events(query);
  if (parsed.flags.json) return JSON.stringify(events);
  return formatEvents(events);
}

async function handleRuns(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const query: RunsQuery = {
    agent: strFlag(parsed.flags, "agent"),
    skill: strFlag(parsed.flags, "skill"),
    limit: numFlag(parsed.flags, "limit"),
  };
  const result = await deps.client.runs(query);
  if (parsed.flags.json) return JSON.stringify(result);
  return formatRuns(result.runs);
}

async function handleKb(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const path = requirePositional(parsed, 0, "путь страницы знаний");
  const file = await deps.client.docFile(path);
  if (parsed.flags.json) return JSON.stringify(file);
  return formatDoc(file);
}

async function handleSearch(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const q = requirePositional(parsed, 0, "поисковый запрос");
  const query: EntitiesQuery = {
    q,
    domain: strFlag(parsed.flags, "domain") as Domain | undefined,
    type: strFlag(parsed.flags, "type"),
    limit: numFlag(parsed.flags, "limit"),
  };
  const entities = await deps.client.entities(query);
  if (parsed.flags.json) return JSON.stringify(entities);
  return formatEntities(entities);
}

async function handleBriefing(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const briefing = await deps.client.briefing();
  if (parsed.flags.json) return JSON.stringify(briefing);
  return formatBriefing(briefing);
}

async function handleAgents(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const agents = await deps.client.agents();
  if (parsed.flags.json) return JSON.stringify(agents);
  return formatAgents(agents);
}

// ── Меняющие команды: без явного --yes только печатают намерение (Р-7) ──

/** Текст намерения `task-create` без вызова Core — ровно то, что будет создано. */
function taskCreateIntention(input: CreateTaskInput): string {
  const owner = input.ownerRef
    ? `${input.ownerKind}: ${input.ownerRef}`
    : `${input.ownerKind} (не назначен)`;
  const domain = input.domain ? DOMAIN_LABELS[input.domain] : "—";
  const lines = [
    `Будет создана задача «${input.title}»`,
    `владелец: ${owner} · домен: ${domain} · срок: ${input.due ?? "не задан"} · приоритет: ${input.priority ?? "normal"}`,
  ];
  if (input.description) lines.push(`описание: ${input.description}`);
  lines.push("Добавьте --yes, чтобы выполнить.");
  return lines.join("\n");
}

async function handleTaskCreate(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const title = strFlag(parsed.flags, "title");
  if (!title) throw new UsageError('нужен заголовок: --title "текст задачи"');

  const ownerKindRaw = strFlag(parsed.flags, "owner-kind") ?? "human";
  if (ownerKindRaw !== "human" && ownerKindRaw !== "agent") {
    throw new UsageError(`--owner-kind должен быть human или agent, получено: ${ownerKindRaw}`);
  }
  const ownerKind: OwnerKind = ownerKindRaw;

  const input: CreateTaskInput = {
    title,
    ownerKind,
    source: TASK_SOURCE,
    ownerRef: strFlag(parsed.flags, "owner"),
    domain: strFlag(parsed.flags, "domain") as Domain | undefined,
    due: strFlag(parsed.flags, "due"),
    description: strFlag(parsed.flags, "description"),
    priority: strFlag(parsed.flags, "priority") as TaskPriority | undefined,
  };

  if (!parsed.flags.yes) {
    if (parsed.flags.json) return JSON.stringify({ dryRun: true, input });
    return taskCreateIntention(input);
  }

  const created = await deps.client.createTask(input);
  if (parsed.flags.json) return JSON.stringify(created);
  return formatTask(created);
}

const DECISIONS: readonly ApprovalDecision[] = ["approved", "rejected"];

async function handleDecide(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const id = requirePositional(parsed, 0, "id согласования");
  const decisionRaw = requirePositional(parsed, 1, "решение: approved|rejected");
  if (!DECISIONS.includes(decisionRaw as ApprovalDecision)) {
    throw new UsageError(`решение должно быть approved или rejected, получено: ${decisionRaw}`);
  }
  const decision = decisionRaw as Exclude<ApprovalDecision, "pending" | "clarify">;

  if (!parsed.flags.yes) {
    if (parsed.flags.json) return JSON.stringify({ dryRun: true, id, decision });
    return `Будет вынесено решение «${decision}» по согласованию ${id}. Добавьте --yes, чтобы выполнить.`;
  }

  const approval = await deps.client.decideApproval(id, decision);
  if (parsed.flags.json) return JSON.stringify(approval);
  return `Решение принято: ${approval.id} · ${approval.agent} · ${approval.action} → ${approval.decision}`;
}

// ── Диспетчер ──

function unknownCommandText(command: string): string {
  const name = command || "(пусто)";
  return `неизвестная команда: ${name}\nДоступные команды: ${COMMANDS.join(", ")}`;
}

/**
 * Отбивает флаг, известный CLI вообще, но не этой команде. Сообщение
 * перечисляет применимые флаги: «не годится» без «а что годится» заставляет
 * лезть в исходник.
 */
function checkCommandFlags(command: Command, flags: ParsedArgs["flags"]): void {
  const allowed = new Set<string>([...GLOBAL_FLAGS, ...COMMAND_FLAGS[command]]);
  for (const name of Object.keys(flags)) {
    if (allowed.has(name)) continue;
    // Набор непустой всегда: `--json` понимает любая команда.
    const list = [...allowed]
      .sort()
      .map((f) => `--${f}`)
      .join(", ");
    throw new UsageError(
      `флаг --${name} не применим к команде ${command}; здесь понимаются: ${list}`,
    );
  }
}

async function dispatch(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  if (!isCommand(parsed.command)) throw new UsageError(unknownCommandText(parsed.command));
  checkCommandFlags(parsed.command, parsed.flags);

  switch (parsed.command) {
    case "inbox":
      return handleInbox(parsed, deps);
    case "tasks":
      return handleTasks(parsed, deps);
    case "task":
      return handleTask(parsed, deps);
    case "task-create":
      return handleTaskCreate(parsed, deps);
    case "events":
      return handleEvents(parsed, deps);
    case "runs":
      return handleRuns(parsed, deps);
    case "kb":
      return handleKb(parsed, deps);
    case "search":
      return handleSearch(parsed, deps);
    case "briefing":
      return handleBriefing(parsed, deps);
    case "agents":
      return handleAgents(parsed, deps);
    case "decide":
      return handleDecide(parsed, deps);
    default:
      throw new UsageError(unknownCommandText(parsed.command));
  }
}

/**
 * Чистая функция над клиентом (тестируемая без сети): разбирает результат
 * команды в `{ text, code }`. Ни печати, ни `process.exitCode` — этим
 * занимается только `main()`.
 *
 * Коды возврата: 0 — успех (включая «намерение напечатано, Core не звали»),
 * 1 — Core ответил ошибкой (переведённый текст, без токена), 2 — ошибка
 * использования CLI (не хватает аргумента, неизвестная команда).
 */
export async function runCommand(
  parsed: ParsedArgs,
  deps: CliDeps,
): Promise<{ text: string; code: number }> {
  try {
    const text = await dispatch(parsed, deps);
    return { text, code: 0 };
  } catch (e) {
    if (e instanceof UsageError) return { text: e.message, code: 2 };
    if (e instanceof CoreError) return { text: e.message, code: 1 };
    return { text: e instanceof Error ? e.message : String(e), code: 1 };
  }
}

// ── Точка входа (`bin: mydon`) ──

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
    return;
  }

  let client: CoreClient;
  try {
    // Падаем на старте, а не на первом 401 (та же дисциплина, что у env.ts):
    // отсутствие SERVICE_TOKEN — понятная ошибка раньше первого сетевого вызова.
    client = createClient(loadEnv());
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
    return;
  }

  const { text, code } = await runCommand(parsed, { client });
  // Успех — в stdout, ошибка — в stderr: `--json | jq` не должен видеть
  // сообщения об ошибке вперемешку с данными.
  (code === 0 ? process.stdout : process.stderr).write(`${text}\n`);
  process.exitCode = code;
}

// CommonJS-точка входа: импорт модуля тестами (`cli.test.ts`) не должен
// запускать `main()` — только прямой запуск `node dist/cli.js`.
if (require.main === module) {
  void main();
}
