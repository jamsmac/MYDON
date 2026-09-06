import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  AUTONOMY_TIERS,
  DOMAINS,
  RUN_OUTCOMES,
  type AutonomyTier,
  type Domain,
} from "@mydon/shared";
import type {
  Agent,
  AgentInput,
  CoreClient,
  CreateTaskInput,
  DocsTreeItem,
  EntityCard,
  EventsQuery,
  OwnerKind,
  RunsQuery,
  TaskPriority,
  TaskStatus,
  TasksQuery,
} from "./core-client";
import {
  MAX_LIST_ITEMS,
  MAX_RESPONSE_CHARS,
  clamp,
  inlineText,
  formatAgents,
  formatBriefing,
  formatDeck,
  formatDoc,
  formatEntities,
  formatEvents,
  formatInbox,
  formatRuns,
  formatTask,
  formatTasks,
  type CorePage,
} from "./format";

/**
 * Инструменты MCP-сервера `mydon-core` (R-A1-2, Р-2…Р-5, Р-9).
 *
 * Здесь ЧИСТАЯ сборка: `buildTools` берёт клиента и состояние пояса владельца
 * и отдаёт описания с обработчиками; ни транспорта, ни окружения, ни вывода в
 * поток — это забота `server.ts`. Поэтому всё поведение проверяется тестом на
 * стабе клиента, без сети и без запуска процесса.
 *
 * Правила, которые здесь ЖИВУТ, а не декларируются:
 *  • Р-2 — имя `<область>_<действие>`; описание меняющего инструмента первым
 *    предложением говорит, что изменится и где владелец это увидит;
 *  • Р-3 — состояние пояса идентичности честно написано в описании
 *    `approval_decide`, а не подразумевается;
 *  • Р-4 — личный контур исключается ЯВНО: безадресные чтения отсеивают
 *    `domain = personal` сами, а запрос личного идёт только по явному
 *    `domain: "personal"` (клиент добавит к нему owner-токен);
 *  • Р-5 — ответ модели компактный текст: список ≤ 50 (потолок 200), текст
 *    ≤ 8000 символов, документ знаний — свой бюджет 64 КБ;
 *  • Р-9 — ошибка Core приходит уже переведённой и становится `isError`.
 */

// ── Пределы (Р-5) ──

/** Сколько записей просим у Core, если владелец не сказал иначе. */
export const DEFAULT_LIMIT = MAX_LIST_ITEMS;

/** Потолок: `limit: 1000` от модели не должен ни падать, ни тащить тысячу строк. */
export const MAX_LIMIT = 200;

/** Тип карточки кандидата фабрики направлений (реестр — обычные `entity`). */
const VENTURE_TYPE = "venture_candidate";

/** Домен, в котором лежат кандидаты, пока у Ventures нет своего домена. */
const VENTURE_DOMAIN: Domain = "mydon";

/**
 * Подпись MCP во ВСЕХ меняющих вызовах: источник и автор задачи, актор смены
 * статуса, автор комментария, актор решения по согласованию.
 *
 * Константа одна, потому что подпись одна, и она обязательна: без неё Core
 * подставляет «owner» (`dto.actor ?? "owner"`, `dto.author ?? "owner"`), и в
 * `audit_log` решение модели становится неотличимо от нажатия владельца, а
 * комментарий модели ложится в карточку как комментарий владельца.
 */
const MCP_ACTOR = "mcp";

// ── Типы описаний ──

export interface JsonSchemaProperty {
  type: "string" | "integer" | "boolean" | "array";
  description: string;
  enum?: string[];
  items?: { type: "string" };
  minimum?: number;
  maximum?: number;
}

/**
 * Схема входа инструмента. Индексная сигнатура здесь не украшение: тип
 * `Tool` из SDK объявлен через zod-схему с catchall, и без неё описания
 * не присваиваются ответу `tools/list`.
 */
export interface ToolInputSchema {
  [key: string]: unknown;
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties: false;
}

export type ToolArgs = Record<string, unknown>;

/**
 * Ответ инструмента. Индексная сигнатура — по той же причине, что у схемы
 * входа: `ServerResult` в SDK выведен из zod-схемы с catchall.
 */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  /** Меняет ли инструмент состояние Core (Р-2: деление по последствию). */
  mutates: boolean;
  run(args: ToolArgs): Promise<string>;
}

/**
 * Состояние пояса идентичности владельца на момент старта сервера (Р-3).
 * `beltUnknown` — Core не ответил на `GET /system/config`: сервер поднялся,
 * но врать о поясе не станет.
 */
export interface OwnerPosture {
  ownerEnforced: boolean;
  ownerTokenPresent: boolean;
  beltUnknown?: boolean;
}

/** Имена читающих инструментов (Р-2). */
export const READING_TOOLS: string[] = [
  "briefing_get",
  "inbox_list",
  "tasks_list",
  "task_get",
  "registry_search",
  "events_recent",
  "memory_recall",
  "kb_read",
  "kb_tree",
  "agents_list",
  "skills_deck",
  "runs_recent",
  "ventures_list",
];

/** Имена меняющих мир инструментов (Р-2). */
export const MUTATING_TOOLS: string[] = [
  "task_create",
  "task_comment",
  "task_status",
  "memory_remember",
  "agent_upsert",
  "approval_decide",
];

// ── Разбор аргументов ──
// Схема входа для модели — подсказка, а не гарантия: низкоуровневый сервер MCP
// аргументы не валидирует. Поэтому каждый параметр читается явно, и неверный
// вход становится понятным отказом ДО обращения к Core, а не 400-м из Nest.

function requireString(args: ToolArgs, key: string): string {
  const raw = args[key];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`Параметр «${key}» обязателен и должен быть непустой строкой.`);
  }
  return raw.trim();
}

function optionalString(args: ToolArgs, key: string): string | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") throw new Error(`Параметр «${key}» должен быть строкой.`);
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Тумблер. Строку «true»/«1» принимаем наравне с настоящим `true`: схема
 * входа для модели — подсказка, а не гарантия, и отказывать в понятном
 * значении из-за типа значило бы спорить о форме вместо дела.
 */
function optionalBoolean(args: ToolArgs, key: string): boolean | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`Параметр «${key}» — true или false.`);
}

function optionalEnum<T extends string>(
  args: ToolArgs,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = optionalString(args, key);
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Параметр «${key}»: допустимо ${allowed.join(", ")}; получено «${value}».`);
  }
  return value as T;
}

function requireEnum<T extends string>(args: ToolArgs, key: string, allowed: readonly T[]): T {
  requireString(args, key);
  const value = optionalEnum(args, key, allowed);
  if (value === undefined) throw new Error(`Параметр «${key}» обязателен.`);
  return value;
}

/**
 * Список строк. Пустой список — «не менять», а не «стереть»: случайный
 * `skills: []` от модели не должен вычищать навыки агента одним движением.
 * Чистка списка остаётся ручной работой владельца в панели.
 */
function optionalStringList(args: ToolArgs, key: string): string[] | undefined {
  const raw = args[key];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new Error(`Параметр «${key}» — список строк.`);
  }
  const items = (raw as string[]).map((item) => item.trim()).filter((item) => item !== "");
  return items.length > 0 ? items : undefined;
}

/**
 * Сколько записей просить у Core. Чужой `limit: 1000` не ошибка модели, а
 * непонимание предела, — отвечаем не отказом, а честным потолком (Р-5).
 */
function limitOf(args: ToolArgs): number {
  const raw = args.limit;
  if (raw === undefined || raw === null) return DEFAULT_LIMIT;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Параметр «limit» — целое число не меньше 1.");
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

const TASK_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
const TASK_PRIORITIES: readonly TaskPriority[] = ["low", "normal", "high", "urgent"];
const OWNER_KINDS: readonly OwnerKind[] = ["human", "agent"];
const DECISIONS = ["approved", "rejected", "clarify"] as const;

/**
 * Статусы карточки агента. Список закрытый: Core проверяет его `@IsIn` при
 * `forbidNonWhitelisted` (`apps/core/src/agents/agents.service.ts`,
 * `AGENT_STATUSES`). Объявлен здесь, а не импортирован: модуль Core тянет за
 * собой весь NestJS, а `@mydon/shared` этих статусов пока не знает.
 *
 * Рукописная копия перечисления сама по себе не заметит дрейфа, поэтому
 * экспортируется: `tools.test.ts` читает исходник Core и падает, если списки
 * разъехались (тот же приём, что у зеркал движка в `apps/agents`).
 */
export const AGENT_STATUSES = ["active", "paused", "draft", "deprecated"] as const;

/** Источник событий агента в шине Core — ровно тот, что пишет runner. */
function agentSource(name: string): string {
  return name.startsWith("agent:") ? name : `agent:${name}`;
}

/**
 * Личный контур виден только по явному запросу (Р-4).
 *
 * Отсев идёт по ОТВЕТУ, а не запросом: Core умеет `domain = X`, но не умеет
 * `domain != personal`, — поэтому страница может вернуться короче
 * запрошенного `limit`. Это честнее обратного: молча показать личное в
 * безадресном поиске (`PersonalDomainGuard` такие чтения не закрывает).
 */
function hidePersonal<T extends { domain?: Domain | null }>(
  rows: T[],
  asked: Domain | undefined,
): T[] {
  return asked ? rows : rows.filter((row) => row.domain !== "personal");
}

/**
 * Что пришло от Core и сколько снял отсев — для честной пометки о полноте
 * страницы. Считается ДО фильтрации: `hidePersonal` укорачивает список, и
 * форматтер по нему одинаково видит и «страница кончилась», и «страница была
 * полной, но часть записей не твоего круга».
 */
function pageOf<T>(received: readonly T[], shown: readonly T[]): CorePage {
  return { received: received.length, hidden: received.length - shown.length };
}

// ── Описания ──

function schema(
  properties: Record<string, JsonSchemaProperty>,
  required: string[] = [],
): ToolInputSchema {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

const LIMIT_PROP: JsonSchemaProperty = {
  type: "integer",
  description: `Сколько записей вернуть: по умолчанию ${DEFAULT_LIMIT}, потолок ${MAX_LIMIT} (больше — молча срежется до потолка).`,
  minimum: 1,
  maximum: MAX_LIMIT,
};

const DOMAIN_PROP: JsonSchemaProperty = {
  type: "string",
  description:
    'Направление. Без него личный контур скрыт; "personal" запрашивает личное явно — такой вызов уходит с owner-токеном.',
  enum: [...DOMAINS],
};

/** Хвост описания читающего инструмента: обещание не трогать состояние. */
const READ_ONLY = "Ничего не меняет.";

/**
 * Описание `approval_decide` собирается по фактическому состоянию пояса (Р-3):
 * подписать «только владелец» и надеяться — ложь, которую владелец обнаружит
 * поздно, в момент отказа.
 */
export function describeApprovalDecide(posture: OwnerPosture): string {
  return [
    "Проводит решение владельца по запросу согласования — запрос закрывается, агент получает ответ, и строка пропадает из /inbox.",
    "Решение уходит в журнал Core подписанным как mcp: в audit_log видно, что его провела модель, а не владелец нажал кнопку.",
    beltSentence(posture),
    "Одно решение за вызов; повторное решение по тому же id Core отклонит.",
  ].join(" ");
}

function beltSentence(posture: OwnerPosture): string {
  if (posture.beltUnknown) {
    const tail = posture.ownerTokenPresent
      ? "owner-токен задан и уходит с запросом"
      : "owner-токен не задан: вызов вернёт 401, если пояс всё-таки включён";
    return `Состояние пояса неизвестно: Core не ответил на GET /system/config при старте сервера — ${tail}.`;
  }
  if (!posture.ownerEnforced) {
    return "Сейчас Core пропускает это решение по сервисному токену — пояс идентичности выключен (OWNER_IDENTITY_ENFORCED=0).";
  }
  return posture.ownerTokenPresent
    ? "Сейчас Core требует owner-токен на это действие, и он задан в окружении сервера."
    : "Сейчас Core требует owner-токен на это действие, но owner-токен не задан: вызов вернёт 401.";
}

// ── Сборка инструментов ──

/**
 * Инструменты R-A1-2: тринадцать читающих и шесть меняющих мир (Р-2).
 * Порядок в массиве — порядок в `tools/list`: сначала чтения, потом
 * изменения, чтобы список читался по нарастанию последствий.
 */
export function buildTools(client: CoreClient, posture: OwnerPosture): ToolDefinition[] {
  return [
    // ── Читающие ──
    {
      name: "briefing_get",
      description: `Утренняя сводка владельца: просрочка денег, простаивающие автоматы, ждущие решения согласования, просроченные задачи и договоры. ${READ_ONLY}`,
      inputSchema: schema({}),
      mutates: false,
      run: async () => formatBriefing(await client.briefing()),
    },
    {
      name: "inbox_list",
      description: `Что ждёт решения владельца: согласования агентов и карточки/поля реестра на подтверждение — тот же список, что на /inbox. Это ответ на вопрос «что ждёт моего решения». ${READ_ONLY}`,
      inputSchema: schema({}),
      mutates: false,
      run: async () => {
        const [approvals, entities] = await Promise.all([
          client.pendingApprovals(),
          client.pendingEntities(),
        ]);
        return formatInbox(approvals, entities);
      },
    },
    {
      name: "tasks_list",
      description: `Список задач Core — тот же, что на /tasks. Личный контур по умолчанию скрыт: чтобы увидеть личные задачи, укажи domain="personal" — такой вызов уходит с owner-токеном. ${READ_ONLY}`,
      inputSchema: schema({
        status: {
          type: "string",
          description: "Статус задачи.",
          enum: [...TASK_STATUSES],
        },
        ownerRef: {
          type: "string",
          description: "Исполнитель: имя человека или имя агента, как записано в задаче.",
        },
        domain: DOMAIN_PROP,
        limit: LIMIT_PROP,
      }),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const domain = optionalEnum(args, "domain", DOMAINS);
        const status = optionalEnum(args, "status", TASK_STATUSES);
        const ownerRef = optionalString(args, "ownerRef");
        const query: TasksQuery = {
          limit,
          ...(domain ? { domain } : {}),
          ...(status ? { status } : {}),
          ...(ownerRef ? { ownerRef } : {}),
        };
        const rows = await client.tasks(query);
        const shown = hidePersonal(rows, domain);
        // Полноту страницы считает форматтер по ОТВЕТУ Core, а не по остатку
        // после отсева: иначе на полной странице с личными задачами пометка
        // «могут быть ещё» исчезала — ровно там, где она нужнее всего.
        return formatTasks(shown, limit, pageOf(rows, shown));
      },
    },
    {
      name: "task_get",
      description: `Карточка одной задачи целиком: статус, исполнитель, срок, описание и итог. ${READ_ONLY}`,
      inputSchema: schema({ id: { type: "string", description: "UUID задачи." } }, ["id"]),
      mutates: false,
      run: async (args) => formatTask(await client.task(requireString(args, "id"))),
    },
    {
      name: "registry_search",
      description: `Поиск карточек реестра (аппараты, договоры, контрагенты, кандидаты) по подстроке имени. Личный контур по умолчанию скрыт: чтобы искать в личном, укажи domain="personal" — такой вызов уходит с owner-токеном. ${READ_ONLY}`,
      inputSchema: schema(
        {
          q: { type: "string", description: "Подстрока имени карточки." },
          domain: DOMAIN_PROP,
          type: { type: "string", description: "Тип карточки, например machine или contract." },
          limit: LIMIT_PROP,
        },
        ["q"],
      ),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const domain = optionalEnum(args, "domain", DOMAINS);
        const type = optionalString(args, "type");
        const cards = await client.entities({
          q: requireString(args, "q"),
          limit,
          ...(domain ? { domain } : {}),
          ...(type ? { type } : {}),
        });
        const shown = hidePersonal(cards, domain);
        return formatEntities(shown, limit, pageOf(cards, shown));
      },
    },
    {
      name: "events_recent",
      description: `Последние записи шины событий Core: кто, что и когда записал. Фильтры — по источнику, точному типу, префиксу типа и времени. ${READ_ONLY}`,
      inputSchema: schema({
        source: {
          type: "string",
          description: 'Источник события, например "agent:vendhub-ops" или "bot".',
        },
        type: { type: "string", description: "Точный тип события, например agent.run." },
        typePrefix: {
          type: "string",
          description: 'Префикс типа, например "agent.memory:" — так перечисляется память агентов.',
        },
        since: { type: "string", description: "С какого момента (ISO 8601)." },
        limit: LIMIT_PROP,
      }),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const source = optionalString(args, "source");
        const type = optionalString(args, "type");
        const typePrefix = optionalString(args, "typePrefix");
        const since = optionalString(args, "since");
        const query: EventsQuery = {
          limit,
          ...(source ? { source } : {}),
          ...(type ? { type } : {}),
          ...(typePrefix ? { typePrefix } : {}),
          ...(since ? { since } : {}),
        };
        return formatEvents(await client.events(query), limit);
      },
    },
    {
      name: "memory_recall",
      description: `Дельта-память агента: события agent.memory:<навык>, по которым агент помнит собственный прошлый результат и не повторяет то же предложение. ${READ_ONLY}`,
      inputSchema: schema(
        {
          agent: { type: "string", description: 'Имя агента, например "vendhub-ops".' },
          skill: {
            type: "string",
            description: "Навык. Без него — вся память агента по всем навыкам.",
          },
          limit: LIMIT_PROP,
        },
        ["agent"],
      ),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const source = agentSource(requireString(args, "agent"));
        const skill = optionalString(args, "skill");
        const events = await client.events({
          source,
          limit,
          // Точный тип вместо префикса, когда навык назван: префикс
          // `agent.memory:refill` поймал бы и `agent.memory:refill-plan`.
          ...(skill ? { type: `agent.memory:${skill}` } : { typePrefix: "agent.memory:" }),
        });
        return formatEvents(events, limit);
      },
    },
    {
      name: "kb_read",
      description: `Страница знаний целиком из белого списка корней (docs/, memory/, routers/…) — то же, что открыто на /docs. Личный документ Core отдаёт только под owner-токеном и сам решает, показать ли его. ${READ_ONLY}`,
      inputSchema: schema(
        {
          path: {
            type: "string",
            description: 'Путь страницы от корня репозитория, например "docs/MCP.md".',
          },
        },
        ["path"],
      ),
      mutates: false,
      run: async (args) => {
        const file = await client.docFile(requireString(args, "path"));
        // Пометка нужна владельцу, а не Core: по тексту ответа должно быть
        // видно, что открыт ЛИЧНЫЙ круг, а не рабочая страница.
        // Почему Core её отдал — вопрос пояса (при выключенном сервисного
        // токена достаточно), и врать об этом в пометке нельзя: она говорит
        // ЧТО открыто, а не по какому праву.
        const mark = file.personal ? "Личный контур: страница из личного круга владельца.\n\n" : "";
        return mark + formatDoc(file);
      },
    },
    {
      name: "kb_tree",
      description: `Дерево доступных страниц знаний: путь, корень, заголовок, размер. Нужно, чтобы знать, что просить у kb_read. Без «root» — все корни сразу; так и узнаётся их полный список. ${READ_ONLY}`,
      inputSchema: schema({
        root: {
          type: "string",
          description:
            "Корень белого списка, оставить только его страницы. Набор корней ЗАКРЫТ и берётся из ответа Core: вызови kb_tree без root, чтобы увидеть их все. Промах по корню — отказ со списком настоящих корней, а не пустая выдача.",
        },
      }),
      mutates: false,
      run: async (args) => {
        const root = optionalString(args, "root");
        // Дерево приходит целиком (фильтра по корню у Core нет), поэтому отбор
        // и знание о настоящих корнях живут в одном месте: «страниц нет» на
        // выдуманном корне звучало бы как приговор всей базе знаний.
        const tree = await client.docsTree();
        const roots = rootsOf(tree);
        if (root && !roots.includes(root)) {
          throw new Error(
            `Корня «${inlineText(root)}» в дереве знаний нет. Есть такие: ${roots.join(", ")}.`,
          );
        }
        return formatTree(root ? tree.filter((item) => item.root === root) : tree, root);
      },
    },
    {
      name: "agents_list",
      description: `Карточки агентов: направление, статус, уровень автономии. Архивированные скрыты — чтобы увидеть и их, укажи archived: true. ${READ_ONLY}`,
      inputSchema: schema({
        archived: {
          type: "boolean",
          description:
            "Показать и архивированные карточки (Core отдаёт их только по этому запросу). По умолчанию — только действующие.",
        },
      }),
      mutates: false,
      run: async (args) => {
        const archived = optionalBoolean(args, "archived");
        return formatAgents(await client.agents(archived ? { archived } : {}));
      },
    },
    {
      name: "skills_deck",
      description: `Витрина навыков агентов — та же дека, что на /skills: навык, тир, кроны, дубли и найденные проблемы. Без «agent» — по всем агентам. ${READ_ONLY}`,
      inputSchema: schema({
        agent: {
          type: "string",
          description: "Имя агента — оставить только его навыки (см. agents_list).",
        },
        limit: LIMIT_PROP,
      }),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const agent = optionalString(args, "agent");
        // Отбор по агенту делает Core (`?agent=`), а не мы по ответу: дека
        // считает дубли и `tierFloor` по одноимённым навыкам ВСЕХ агентов, и
        // фильтрация на нашей стороне сохранила бы числа, но потеряла причину.
        const deck = await client.skillDeck(agent);
        return formatDeck(deck, limit);
      },
    },
    {
      name: "runs_recent",
      description: `Журнал прогонов агентов — та же лента, что на /flows: кто, какой навык, каким триггером и с каким исходом. ${READ_ONLY}`,
      inputSchema: schema({
        agent: { type: "string", description: "Имя агента." },
        skill: { type: "string", description: "Навык." },
        outcome: {
          type: "string",
          description:
            "Исход прогона: approval_requested — попросил разрешения, executed — сделал, skipped — промолчал, failed — упал.",
          enum: [...RUN_OUTCOMES],
        },
        limit: LIMIT_PROP,
      }),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const agent = optionalString(args, "agent");
        const skill = optionalString(args, "skill");
        // Значение вне словаря отбиваем ДО сети: Core с 31087ba отвечает на
        // него 400, и без `enum` модель получила бы отказ вместо подсказки,
        // какие исходы бывают. Дешевле и понятнее сказать это на месте.
        const outcome = optionalEnum(args, "outcome", RUN_OUTCOMES);
        const query: RunsQuery = {
          limit,
          ...(agent ? { agent } : {}),
          ...(skill ? { skill } : {}),
          ...(outcome ? { outcome } : {}),
        };
        const { runs } = await client.runs(query);
        return formatRuns(runs, limit);
      },
    },
    {
      name: "ventures_list",
      description: `Кандидаты фабрики направлений: карточки ${VENTURE_TYPE} в домене ${VENTURE_DOMAIN} с вердиктом сессии (GO / PARK / NO). ${READ_ONLY}`,
      inputSchema: schema({
        verdict: {
          type: "string",
          description: 'Вердикт из карточки, например "GO", "PARK" или "NO" (регистр не важен).',
        },
        limit: LIMIT_PROP,
      }),
      mutates: false,
      run: async (args) => {
        const limit = limitOf(args);
        const verdict = optionalString(args, "verdict");
        // Вердикт лежит в `attrs`, фильтровать по нему Core не умеет. Поэтому
        // при отборе просматриваем максимальное окно, а не запрошенную
        // страницу: «таких кандидатов нет» иначе было бы утверждением про
        // первые пятьдесят карточек, а звучало бы как про весь реестр.
        const scan = verdict ? MAX_LIMIT : limit;
        const cards = await client.entities({
          domain: VENTURE_DOMAIN,
          type: VENTURE_TYPE,
          limit: scan,
        });
        const picked = verdict
          ? cards.filter((card) => verdictOf(card).toLowerCase() === verdict.toLowerCase())
          : cards;
        // Окно заполнено доверху — значит, за ним может быть ещё; молчать об
        // этом нельзя ни при пустом ответе, ни при полном. Говорим это только
        // при отборе по вердикту: там просмотр шире страницы и о его границе
        // больше сказать некому. Без вердикта окно = страница, и о полной
        // странице уже честно сообщает `formatEntities` — двух одинаковых
        // строк подряд быть не должно.
        const capped =
          verdict && cards.length >= scan
            ? `\nПросмотрены первые ${cards.length} карточек — в реестре могут быть ещё.`
            : "";
        if (picked.length === 0) {
          const head = verdict ? `Кандидатов с вердиктом ${verdict} нет.` : "Кандидатов нет.";
          // Через `clamp`, как и непустая ветка: вердикт приходит от модели и
          // длину его никто не ограничивает — предел ответа один на обе ветки.
          return clamp(`${head}${capped}`, MAX_RESPONSE_CHARS);
        }
        return clamp(
          `${verdictSummary(picked)}\n${formatEntities(picked, limit)}${capped}`,
          MAX_RESPONSE_CHARS,
        );
      },
    },

    // ── Меняющие мир (Р-2: первым предложением — что изменится и где видно) ──
    {
      name: "task_create",
      description:
        "Создаёт задачу в Core — она сразу видна владельцу на /tasks и попадает исполнителю. Источник задачи — mcp, так что её всегда видно в журнале как поставленную отсюда. Одна задача за вызов: повторный вызов создаст вторую задачу, а не обновит первую.",
      inputSchema: schema(
        {
          title: { type: "string", description: "Заголовок задачи, до 512 символов." },
          ownerKind: {
            type: "string",
            description: "Кто исполняет: человек или агент.",
            enum: [...OWNER_KINDS],
          },
          ownerRef: { type: "string", description: "Имя исполнителя (человека или агента)." },
          description: { type: "string", description: "Подробности, до 4000 символов." },
          domain: {
            type: "string",
            description: "Направление задачи.",
            enum: [...DOMAINS],
          },
          due: {
            type: "string",
            description: "Срок в ISO 8601, например 2026-09-10T09:00:00+05:00.",
          },
          priority: {
            type: "string",
            description: "Приоритет задачи.",
            enum: [...TASK_PRIORITIES],
          },
        },
        ["title", "ownerKind"],
      ),
      mutates: true,
      run: async (args) => {
        const ownerRef = optionalString(args, "ownerRef");
        const description = optionalString(args, "description");
        const domain = optionalEnum(args, "domain", DOMAINS);
        const due = optionalString(args, "due");
        const priority = optionalEnum(args, "priority", TASK_PRIORITIES);
        const input: CreateTaskInput = {
          title: requireString(args, "title"),
          ownerKind: requireEnum(args, "ownerKind", OWNER_KINDS),
          source: MCP_ACTOR,
          // Автор задачи тоже подписан: без `createdBy` Core запишет её на
          // «system», и в карточке не видно, что задачу завела модель.
          createdBy: MCP_ACTOR,
          ...(ownerRef ? { ownerRef } : {}),
          ...(description ? { description } : {}),
          ...(domain ? { domain } : {}),
          ...(due ? { due } : {}),
          ...(priority ? { priority } : {}),
        };
        const created = await client.createTask(input);
        return clamp(`Задача создана: ${created.id}\n${formatTask(created)}`, MAX_RESPONSE_CHARS);
      },
    },
    {
      name: "task_comment",
      description:
        "Добавляет комментарий к задаче — владелец увидит его в карточке задачи на /tasks, подписанным как mcp. Комментарий ничего больше не меняет: ни статуса, ни исполнителя, ни срока.",
      inputSchema: schema(
        {
          id: { type: "string", description: "UUID задачи." },
          body: { type: "string", description: "Текст комментария." },
        },
        ["id", "body"],
      ),
      mutates: true,
      run: async (args) => {
        const comment = await client.commentTask(
          requireString(args, "id"),
          requireString(args, "body"),
          MCP_ACTOR,
        );
        // Автор берётся из ОТВЕТА Core (`authorRef`), а не из нашего намерения:
        // раньше здесь печаталось поле `author`, которого в ответе нет, и в
        // строке стояло «автор undefined».
        return `Комментарий добавлен к задаче ${comment.taskId} (автор ${inlineText(comment.authorRef)}).`;
      },
    },
    {
      name: "task_status",
      description:
        "Меняет статус задачи в Core — новый статус виден на /tasks и в карточке задачи, а смена подписана в журнале как mcp. Закрывая задачу, объясняй результат в note: без него в журнале останется голое «готово».",
      inputSchema: schema(
        {
          id: { type: "string", description: "UUID задачи." },
          status: {
            type: "string",
            description: "Новый статус задачи.",
            enum: [...TASK_STATUSES],
          },
          note: {
            type: "string",
            description: "Итог работы: что именно сделано или почему отменено.",
          },
        },
        ["id", "status"],
      ),
      mutates: true,
      run: async (args) => {
        const id = requireString(args, "id");
        const status = requireEnum(args, "status", TASK_STATUSES);
        const note = optionalString(args, "note");
        const updated = await client.setTaskStatus(id, {
          status,
          actor: MCP_ACTOR,
          ...(note ? { resultNote: note } : {}),
        });
        return clamp(
          `Статус задачи ${updated.id}: ${status}.\n${formatTask(updated)}`,
          MAX_RESPONSE_CHARS,
        );
      },
    },
    {
      name: "memory_remember",
      description:
        "Записывает дельта-память агента — событие agent.memory:<навык> в шине Core; его прочитает сам агент на следующем прогоне, а владелец увидит запись в ленте /flows и через events_recent. Прежняя память не стирается: события ложатся сверху, читается последнее.",
      inputSchema: schema(
        {
          agent: { type: "string", description: 'Имя агента, например "vendhub-ops".' },
          skill: { type: "string", description: "Навык, к которому относится память." },
          value: {
            type: "string",
            description:
              "Сигнатура прошлого результата — по ней агент понимает, изменилось ли что-то.",
          },
        },
        ["agent", "skill", "value"],
      ),
      mutates: true,
      run: async (args) => {
        const source = agentSource(requireString(args, "agent"));
        const skill = requireString(args, "skill");
        const value = requireString(args, "value");
        const recorded = await client.recordEvent({
          source,
          type: `agent.memory:${skill}`,
          // Ровно та форма, что пишет runner: агент читает payload.signature.
          payload: { signature: value },
        });
        return `Память записана: ${source} · ${recorded.type} (событие ${recorded.id}).`;
      },
    },
    {
      name: "agent_upsert",
      description:
        "Создаёт или обновляет карточку агента — изменения видны на /agents и действуют со следующего прогона. ВНИМАНИЕ: непустой список skills ЗАМЕНЯЕТ весь набор навыков агента целиком, а не добавляет к нему, — передавай полный список, иначе прежние навыки пропадут (пустой список ничего не стирает). Уровень автономии меняется отдельным owner-вызовом, потому что общий patch карточки его сознательно отбрасывает. Расписание и бюджеты отсюда не трогаются — они правятся в панели.",
      inputSchema: schema(
        {
          name: { type: "string", description: "Имя агента (оно же ключ карточки)." },
          business: { type: "string", description: "Направление агента, например vendhub." },
          status: {
            type: "string",
            description: "Статус карточки агента.",
            enum: [...AGENT_STATUSES],
          },
          description: { type: "string", description: "Короткое описание агента." },
          mission: { type: "string", description: "Миссия: за что агент отвечает." },
          skills: {
            type: "array",
            description:
              "ПОЛНЫЙ список навыков агента: он заменяет прежний набор целиком (добавляя один навык, перечисли и все прежние — см. agents_list). Пустой список ничего не стирает: чистка навыков — в панели.",
            items: { type: "string" },
          },
          autonomyDefault: {
            type: "string",
            description: "Уровень автономии по умолчанию (меняется отдельным owner-вызовом).",
            enum: [...AUTONOMY_TIERS],
          },
        },
        ["name"],
      ),
      mutates: true,
      run: async (args) => {
        const name = requireString(args, "name");
        const business = optionalString(args, "business");
        const status = optionalEnum(args, "status", AGENT_STATUSES);
        const description = optionalString(args, "description");
        const mission = optionalString(args, "mission");
        const skills = optionalStringList(args, "skills");
        // Пустой список `optionalStringList` превращает в «не менять»; чтобы
        // сказать об этом в ответе, отличаем его от «поля не было вовсе».
        const skillsIgnored = skills === undefined && Array.isArray(args.skills);
        const autonomy = optionalEnum(args, "autonomyDefault", AUTONOMY_TIERS);
        const patch: Omit<AgentInput, "name"> = {
          ...(business ? { business } : {}),
          ...(status ? { status } : {}),
          ...(description ? { description } : {}),
          ...(mission ? { mission } : {}),
          ...(skills ? { skills } : {}),
        };
        const existing = (await client.agents()).find((card) => card.name === name);
        const skillsBefore = existing?.skills.length ?? 0;
        const patched = Object.keys(patch).length > 0;
        let card = existing
          ? patched
            ? await client.updateAgent(name, patch, MCP_ACTOR)
            : existing
          : await client.createAgent({ name, ...patch }, MCP_ACTOR);
        const tierBefore = card.autonomyDefault;
        card = await applyAutonomy(client, card, autonomy);
        // Вызов без единой правки — это чтение, и отчитываться о нём как об
        // изменении нельзя: владелец решит, что карточку кто-то трогал.
        const headline = !existing
          ? `Создана карточка агента ${card.name}.`
          : patched || card.autonomyDefault !== tierBefore
            ? `Обновлена карточка агента ${card.name}.`
            : `Карточка агента ${card.name}: изменений не было.`;
        // Судьба набора навыков — отдельной строкой: список ЗАМЕНЯЕТСЯ целиком,
        // и «было 4 → стало 1» показывает это до того, как потерю заметят по
        // молчащим прогонам.
        const skillsLine = skills
          ? `Навыки: было ${skillsBefore} → стало ${card.skills.length} (список заменён целиком).`
          : skillsIgnored
            ? `Навыки не тронуты: пустой список ничего не стирает (осталось ${skillsBefore}).`
            : "";
        return clamp(
          [headline, skillsLine, formatAgents([card])].filter(Boolean).join("\n"),
          MAX_RESPONSE_CHARS,
        );
      },
    },
    {
      name: "approval_decide",
      description: describeApprovalDecide(posture),
      inputSchema: schema(
        {
          id: { type: "string", description: "UUID запроса согласования (его даёт inbox_list)." },
          decision: {
            type: "string",
            description: "Решение владельца. Инструмент не выбирает его сам.",
            enum: [...DECISIONS],
          },
        },
        ["id", "decision"],
      ),
      mutates: true,
      run: async (args) => {
        const id = requireString(args, "id");
        const decision = requireEnum(args, "decision", DECISIONS);
        const approval = await client.decideApproval(id, decision, MCP_ACTOR);
        // Имя агента и действие — текст из Core; в нашу строку он входит
        // однострочным, как и везде.
        return `Согласование ${approval.id} (${inlineText(approval.agent)} · ${inlineText(approval.action)}): решение ${decision}. Из /inbox запрос ушёл.`;
      },
    },
  ];
}

/**
 * Автономию меняет ТОЛЬКО собственный owner-маршрут (общий patch карточки её
 * отбрасывает) и только когда она правда другая: лишний owner-вызов на
 * включённом поясе — это лишний повод получить 401 там, где менять нечего.
 */
async function applyAutonomy(
  client: CoreClient,
  card: Agent,
  wanted: AutonomyTier | undefined,
): Promise<Agent> {
  if (wanted === undefined || wanted === card.autonomyDefault) return card;
  return client.setAutonomy(card.name, wanted, MCP_ACTOR);
}

/** Вердикт кандидата лежит в `attrs`; его отсутствие — тоже ответ. */
function verdictOf(card: EntityCard): string {
  const raw = card.attrs.verdict;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "без вердикта";
}

function verdictSummary(cards: EntityCard[]): string {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const verdict = verdictOf(card);
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  }
  // Вердикт лежит в `attrs` карточки — это чужой текст в нашей строке.
  const parts = [...counts.entries()].map(([verdict, count]) => `${inlineText(verdict)} ${count}`);
  return `Кандидаты: ${cards.length} (${parts.join(", ")})`;
}

/** Настоящие корни дерева — из ответа Core, а не из рукописной копии списка. */
function rootsOf(tree: DocsTreeItem[]): string[] {
  return [...new Set(tree.map((item) => item.root))].sort();
}

/**
 * Дерево знаний строкой на страницу. Свой форматтер, а не общий: в `format.ts`
 * дерева нет, а тащить туда правку из соседней задачи — значит спорить за файл.
 */
function formatTree(tree: DocsTreeItem[], root: string | undefined): string {
  if (tree.length === 0) {
    return root ? `Страниц знаний в корне ${root} нет.` : "Страниц знаний нет.";
  }
  const shown = tree.slice(0, MAX_LIST_ITEMS);
  const lines = [`Страницы знаний: ${tree.length}`];
  if (shown.length < tree.length) {
    lines.push(`Показаны первые ${shown.length} из ${tree.length} — сузь выборку параметром root.`);
  }
  for (const item of shown) {
    const personal = item.personal ? " · личное" : "";
    lines.push(`• ${item.path} · ${item.title} · ${item.bytes} Б${personal}`);
  }
  return clamp(lines.join("\n"), MAX_RESPONSE_CHARS);
}

// ── Вызов и регистрация ──

/** Текст ошибки для модели: переводы Р-9 приходят из клиента уже готовыми. */
function errorText(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return `Непредвиденная ошибка: ${String(cause)}`;
}

/**
 * Один вызов инструмента. Отдельная функция, а не тело обработчика SDK:
 * так превращение ошибки в `isError` проверяется тестом без транспорта.
 */
export async function callTool(
  tools: ToolDefinition[],
  name: string,
  args: ToolArgs = {},
): Promise<ToolResult> {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Инструмента «${name}» нет. Доступны: ${tools.map((item) => item.name).join(", ")}.`,
        },
      ],
      isError: true,
    };
  }
  try {
    return { content: [{ type: "text", text: await tool.run(args) }] };
  } catch (cause) {
    return { content: [{ type: "text", text: errorText(cause) }], isError: true };
  }
}

/** Вешает на сервер MCP список инструментов и их вызов. */
export function registerTools(server: Server, tools: ToolDefinition[]): void {
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      // Только readOnlyHint: у меняющего инструмента destructiveHint по
      // умолчанию считается истинным, и это ровно та осторожность, которая
      // здесь нужна, — обещать «неразрушающую» правку мы не готовы.
      annotations: { readOnlyHint: !tool.mutates },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) =>
    callTool(tools, request.params.name, request.params.arguments ?? {}),
  );
}
