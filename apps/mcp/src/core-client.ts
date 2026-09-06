import type { AutonomyTier, Domain } from "@mydon/shared";

/**
 * Единственная дверь в Core для MCP-сервера и CLI (Р-1, R-A1-1).
 *
 * Обе оболочки — тонкие: здесь fetch, токены и перевод кодов ответа, там
 * только формат вывода. Третья копия того же fetch (после `tools/*.mjs` и
 * клиентов панели/агентов) не заводится.
 *
 * Формы ответов объявлены ЛОКАЛЬНО и намеренно: типы `apps/cc` тянут за собой
 * `server-only` и сборку Next.js, а типы Core — весь NestJS.
 */

/** Дольше пятнадцати секунд Core не отвечает никогда: это уже обрыв туннеля. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Ошибка обращения к Core с переведённым текстом (Р-9).
 *
 * `status` = 0 означает «до Core не дошли» (сеть, туннель, таймаут).
 * Ни одно сообщение не печатает значение токена — ни своего, ни чужого.
 */
export class CoreError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoreError";
    this.status = status;
    this.path = path;
  }
}

// ── Формы ответов Core ──

export type ApprovalDecision = "pending" | "approved" | "rejected" | "clarify";

export interface Approval {
  id: string;
  agent: string;
  action: string;
  tier: AutonomyTier;
  payload: Record<string, unknown>;
  decision: ApprovalDecision;
  decidedAt: string | null;
  createdAt: string;
}

export interface EntityCard {
  id: string;
  type: string;
  name: string;
  externalRef: string | null;
  attrs: Record<string, unknown>;
  approvedAt: string | null;
  approvedBy: string | null;
  createdFrom: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Направление карточки (код организации). Есть только у `GET /entities`:
   * очередь `pending` домена не считает. По нему инструменты отсекают личный
   * контур из безадресных поисков (Р-4).
   */
  domain?: Domain | null;
  geo?: { lat: number; lng: number; address: string | null } | null;
}

/** Значение поля карточки, предложенное не владельцем и ждущее слова. */
export interface EntityDraftField {
  id: string;
  entityId: string;
  entityName: string;
  entityType: string;
  field: string;
  value: string;
  current: string | null;
  origin: string;
  setBy: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingEntities {
  cards: EntityCard[];
  fields: EntityDraftField[];
}

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type OwnerKind = "human" | "agent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  ownerKind: OwnerKind;
  ownerRef: string | null;
  domain: Domain | null;
  entityId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due: string | null;
  source: string | null;
  createdBy: string | null;
  resultNote: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Комментарий задачи в том виде, в каком его отдаёт Core: строка таблицы
 * `task_comment` с полем `authorRef` («owner», «person:<id>», «agent:<имя>»).
 *
 * Раньше здесь стояло `author`, которого в ответе НЕТ: компилятор молчал, а
 * `task_comment` печатал «автор undefined». Имя поля тут — не вкусовое: оно
 * ровно то, что приходит по сети.
 */
export interface TaskComment {
  id: string;
  taskId: string;
  authorRef: string;
  body: string;
  createdAt: string;
}

export interface CoreEvent {
  id: string;
  source: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

/** Страница знаний из белого списка корней (`docs/`, `memory/`, `routers/`…). */
export interface DocsTreeItem {
  path: string;
  root: string;
  title: string;
  bytes: number;
  updatedAt: string;
  /** Личный контур владельца: содержимое отдаётся только под owner-токеном. */
  personal?: boolean;
}

export interface DocFile extends DocsTreeItem {
  markdown: string;
}

export interface Agent {
  id: string;
  name: string;
  business: string;
  status: string;
  description: string | null;
  mission: string | null;
  autonomyDefault: AutonomyTier;
  skills: string[];
  schedule: { cron: string; skill: string }[];
  archivedAt: string | null;
  updatedAt: string;
}

export interface SkillDeckItem {
  agent: string;
  skill: string;
  description: string;
  executor: string;
  /**
   * Тир навыка. Необязательный, как в Core (`CatalogSkillInput.tier?: Tier`):
   * у навыка без тира поля в ответе НЕТ, а не `null`. Раньше здесь стояло
   * `tier: AutonomyTier | null`, и `item.tier ?? "—"` спасал только случайно —
   * любая проверка `tier === null` считала бы такой навык описанным.
   */
  tier?: AutonomyTier;
  agentStatus: string;
  autonomyDefault: AutonomyTier;
  enabled: boolean;
  crons: string[];
  /** Сколько агентов несут навык с этим именем (себя включая): 1 — уникальный. */
  duplicates: number;
  /** Самый строгий тир среди одноимённых навыков; `null` — тира нет ни у кого. */
  tierFloor: AutonomyTier | null;
  problems: string[];
  hasCode: boolean;
}

export interface SkillDeck {
  syncedAt: string | null;
  models: { primary: string | null; fallbacks: string[] };
  items: SkillDeckItem[];
}

export interface AgentRun {
  id: string;
  agentName: string;
  skill: string;
  trigger: string;
  cron: string | null;
  scheduledAt: string | null;
  taskId: string | null;
  approvalId: string | null;
  startedAt: string;
  finishedAt: string;
  outcome: string;
  skipReason: string | null;
  hook: string | null;
  reason: string;
  action: string | null;
  review: string | null;
}

export interface Briefing {
  generatedAt: string;
  tz: string;
  overdueMoney: number;
  idleMachines: number;
  pendingApprovals: number;
  contractsDueSoon: number;
  contractsBadDate: number;
  overdueTasks: number;
}

/** Действующий тумблер системы: значение из базы, окружения или по умолчанию. */
export interface SystemConfigItem {
  key: string;
  label: string;
  value: string;
  source: "db" | "env" | "default";
  effective?: string;
}

// ── Входы мутаций ──

export interface CreateTaskInput {
  title: string;
  ownerKind: OwnerKind;
  ownerRef?: string;
  domain?: Domain;
  due?: string;
  description?: string;
  priority?: TaskPriority;
  source?: string;
  createdBy?: string;
  clientKey?: string;
}

export interface SetTaskStatusInput {
  status: TaskStatus;
  actor?: string;
  resultNote?: string;
}

export interface RecordEventInput {
  source: string;
  type: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
  clientKey?: string;
}

export interface AgentInput {
  name: string;
  business?: string;
  status?: string;
  description?: string;
  mission?: string;
  nonGoals?: string[];
  autonomyDefault?: AutonomyTier;
  skills?: string[];
  schedule?: { cron: string; skill: string }[];
  budgetPerDayUsd?: number;
  budgetOnExceeded?: string;
  kbPages?: string[];
}

// ── Параметры чтений ──

export interface TasksQuery {
  status?: TaskStatus;
  domain?: Domain;
  ownerKind?: OwnerKind;
  ownerRef?: string;
  /** Только незакрытые. */
  open?: boolean;
  /** Только свободные (ничей `ownerRef`). */
  unassigned?: boolean;
  /** Сделанные, но не принятые. */
  awaiting?: boolean;
  limit?: number;
  offset?: number;
}

export interface EventsQuery {
  source?: string;
  type?: string;
  /** Префикс типа: так перечисляется память агента (`agent.memory:`). */
  typePrefix?: string;
  since?: string;
  until?: string;
  order?: "asc" | "desc";
  limit?: number;
}

export interface EntitiesQuery {
  domain?: Domain;
  type?: string;
  q?: string;
  /** `1` — только автоматы в эксплуатации. */
  operational?: string;
  id?: string;
  /**
   * Сколько карточек вернуть (Core: по умолчанию 500, потолок 5000).
   * Обрезать выдачу должен Core, а не туннель: без параметра каждый поиск
   * тащил бы полтысячи карточек со всеми `attrs` ради десятка строк.
   */
  limit?: number;
}

export interface AgentsQuery {
  /**
   * Показывать ли архивированные карточки. Core прячет их по умолчанию и
   * отдаёт только по `?archived=1`: без параметра «архив» в описании
   * инструмента был бы обещанием, которого ответ не выполняет.
   */
  archived?: boolean;
}

export interface RunsQuery {
  agent?: string;
  skill?: string;
  outcome?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface CoreClientConfig {
  baseUrl: string;
  serviceToken: string;
  ownerToken?: string;
  /** Подменяется в тестах; в бою — глобальный `fetch` Node. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type QueryValue = string | number | undefined;

/**
 * Собранная строка запроса. Пустые значения НЕ добавляются: `?ownerRef=`
 * Core читает как «владелец с пустым именем» и возвращает пустой список —
 * молчаливо неверный ответ вместо ожидаемого «все».
 */
function queryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined) continue;
    const value = typeof raw === "number" ? String(raw) : raw.trim();
    if (!value) continue;
    search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

/** Текст ошибки Nest: `{ message: string | string[] }`. */
function coreMessage(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") return "";
    const message = (parsed as { message?: unknown }).message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join("; ");
    return "";
  } catch {
    // Не JSON — отдаём как есть, обрезав: html-страница прокси в текст ошибки не нужна.
    return trimmed.slice(0, 300);
  }
}

/**
 * Перевод кода ответа в предложение, по которому понятно, что чинить (Р-9).
 * Значение токена сюда не попадает ни при каком коде.
 */
function translate(status: number, path: string, body: string): string {
  const fromCore = coreMessage(body);
  switch (status) {
    case 401:
      return "Core не принял токен: проверь SERVICE_TOKEN в окружении (то же значение, что у панели и бота).";
    case 403:
      return `Личный контур закрыт: нужен owner-токен (переменная OWNER_ACTION_TOKEN)${fromCore ? ` — ${fromCore}` : ""}.`;
    case 404:
      return `Не найдено: ${path}${fromCore ? ` — ${fromCore}` : ""}.`;
    case 409:
      // Конфликт объясняет сам Core («запрос уже закрыт решением…»): своими
      // словами это пересказать нельзя, не потеряв причину.
      return fromCore || `Конфликт состояния на ${path}.`;
    case 429:
      return "Core ограничил частоту запросов — повтори через несколько секунд.";
    default:
      return fromCore
        ? `Core ответил ${status} на ${path}: ${fromCore}`
        : `Core ответил ${status} на ${path}.`;
  }
}

/**
 * Причина обрыва. Про таймаут знает вызывающий (он сам его и объявил): у
 * прерванного запроса имя ошибки — общее `AbortError`, и по нему «истекло
 * время» не отличить от «соединение отвергнуто».
 */
function networkReason(cause: unknown, timeoutMs: number, timedOut: boolean): string {
  if (timedOut) return `истекло время ожидания (${Math.round(timeoutMs / 1000)} с)`;
  return cause instanceof Error ? cause.message : String(cause);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /**
   * Owner-действие или явно запрошенный личный контур (Р-4): только здесь
   * добавляется `x-owner-action-token`.
   */
  owner?: boolean;
}

export interface CoreClient {
  pendingApprovals(): Promise<Approval[]>;
  pendingEntities(): Promise<PendingEntities>;
  /**
   * `actor` — подпись того, кто решает. Core без неё подставляет «owner»
   * (`approvals.controller.ts`), и решение модели в `audit_log` становится
   * неотличимо от нажатия владельца. Необязательный: у CLI за клавиатурой
   * действительно владелец, и врать про «mcp» там нельзя так же.
   */
  decideApproval(
    id: string,
    decision: Exclude<ApprovalDecision, "pending">,
    actor?: string,
  ): Promise<Approval>;
  tasks(params: TasksQuery): Promise<Task[]>;
  task(id: string): Promise<Task>;
  createTask(input: CreateTaskInput): Promise<Task>;
  /** `author` — та же подпись, что у `decideApproval`, и по той же причине. */
  commentTask(id: string, body: string, author?: string): Promise<TaskComment>;
  setTaskStatus(id: string, input: SetTaskStatusInput): Promise<Task>;
  events(params: EventsQuery): Promise<CoreEvent[]>;
  recordEvent(input: RecordEventInput): Promise<CoreEvent>;
  entities(params: EntitiesQuery): Promise<EntityCard[]>;
  /**
   * Дерево знаний целиком, как его отдаёт Core: фильтра по корню у `GET
   * /docs/tree` нет. Отбор делает вызывающая сторона — там же, где из полного
   * дерева видно, какие корни вообще бывают: «страниц нет» на выдуманном корне
   * должно называть настоящие, а не молчать.
   */
  docsTree(): Promise<DocsTreeItem[]>;
  docFile(path: string): Promise<DocFile>;
  agents(params?: AgentsQuery): Promise<Agent[]>;
  skillDeck(agent?: string): Promise<SkillDeck>;
  /** `actor` — подпись правки: без неё Core запишет в журнал владельца. */
  createAgent(input: AgentInput, actor?: string): Promise<Agent>;
  updateAgent(name: string, patch: Omit<AgentInput, "name">, actor?: string): Promise<Agent>;
  setAutonomy(name: string, tier: AutonomyTier, actor?: string): Promise<Agent>;
  runs(params: RunsQuery): Promise<{ runs: AgentRun[] }>;
  briefing(): Promise<Briefing>;
  systemConfig(): Promise<SystemConfigItem[]>;
}

export function createClient(cfg: CoreClientConfig): CoreClient {
  const baseUrl = cfg.baseUrl.replace(/\/+$/, "");
  const doFetch = cfg.fetchImpl ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? REQUEST_TIMEOUT_MS;

  /**
   * Один сетевой вызов целиком: и заголовки, и ТЕЛО.
   *
   * Тело читается внутри той же защиты сознательно: `fetch` резолвится, как
   * только пришли заголовки, — обрыв туннеля или срабатывание таймаута посреди
   * потока тела выбрасывает сырой `DOMException`/`TypeError` уже ПОСЛЕ него.
   * Оставь чтение снаружи — и такая ошибка ушла бы наверх мимо `CoreError`,
   * то есть мимо единственного контракта этого модуля (Р-9).
   */
  async function fetchBody(
    url: string,
    path: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status: number; body: string }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const res = await doFetch(url, { ...init, signal: controller.signal });
      return { ok: res.ok, status: res.status, body: await res.text() };
    } catch (cause) {
      throw new CoreError(
        0,
        path,
        `Core недоступен по адресу ${url}: ${networkReason(cause, timeoutMs, timedOut)}`,
        { cause },
      );
    } finally {
      // Ради этой строки здесь свой контроллер, а не `AbortSignal.timeout`:
      // тот держит таймер до конца срока и после давно полученного ответа.
      clearTimeout(timer);
    }
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = `${baseUrl}${path}${queryString(opts.query ?? {})}`;
    const headers: Record<string, string> = { "x-service-token": cfg.serviceToken };
    // Тип содержимого — только там, где содержимое есть: на GET он ничего не
    // описывает и лишь путает прокси и журнал запросов.
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    // Заголовок закладывается сразу (Р-3): включение пояса идентичности не
    // должно превращать owner-действия в 401.
    if (opts.owner && cfg.ownerToken) headers["x-owner-action-token"] = cfg.ownerToken;

    const { ok, status, body } = await fetchBody(url, path, {
      method: opts.method ?? "GET",
      headers,
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });

    if (!ok) throw new CoreError(status, path, translate(status, path, body));

    const trimmed = body.trim();
    // Пустое тело на успехе — не «ничего не вернулось», а сломанный ответ: все
    // обёрнутые здесь маршруты Core отдают JSON. Тихо вернуть `undefined` под
    // объявленным типом значило бы уронить форматтер в рантайме при молчащем
    // компиляторе.
    if (!trimmed) {
      throw new CoreError(status, path, `Core вернул пустой ответ на ${path} — ожидались данные.`);
    }
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new CoreError(status, path, `Core вернул на ${path} не JSON — отвечает не тот адрес.`);
    }
  }

  /** Личный контур запрашивают явно — и тогда с owner-токеном (Р-4). */
  const personal = (domain?: Domain): boolean => domain === "personal";

  return {
    pendingApprovals: () => request<Approval[]>("/approvals/pending"),

    // Owner-токен нужен и на ЧТЕНИЕ: `/entities/pending` проходит через
    // `excludePersonal`, и без заголовка очередь входящих недосчитала бы
    // карточки личного контура — молча, «пусто» вместо «не тебе».
    pendingEntities: () => request<PendingEntities>("/entities/pending", { owner: true }),

    // Подпись уходит вместе с решением: Core без неё пишет в журнал «owner»
    // (`dto.actor ?? "owner"`), и решение модели становится неотличимо от
    // нажатия владельца.
    decideApproval: (id, decision, actor) =>
      request<Approval>(`/approvals/${encodeURIComponent(id)}/decide`, {
        method: "POST",
        body: { decision, ...(actor ? { actor } : {}) },
        owner: true,
      }),

    tasks: (params) =>
      request<Task[]>("/tasks", {
        query: {
          status: params.status,
          domain: params.domain,
          ownerKind: params.ownerKind,
          ownerRef: params.ownerRef,
          ...(params.open ? { open: "1" } : {}),
          ...(params.unassigned ? { unassigned: "1" } : {}),
          ...(params.awaiting ? { awaiting: "1" } : {}),
          limit: params.limit,
          offset: params.offset,
        },
        owner: personal(params.domain),
      }),

    // Задача по идентификатору — с owner-токеном: `GET /tasks/:id` гейтит
    // личный контур и отвечает на него 404 «не найдено». Без заголовка
    // `task_get` говорил бы «нет такой», хотя `task_status` её меняет.
    task: (id) => request<Task>(`/tasks/${encodeURIComponent(id)}`, { owner: true }),

    createTask: (input) => request<Task>("/tasks", { method: "POST", body: input }),

    // Та же подпись, что у решения: без `author` комментарий модели ложится в
    // карточку задачи как комментарий владельца (`dto.author ?? "owner"`).
    commentTask: (id, body, author) =>
      request<TaskComment>(`/tasks/${encodeURIComponent(id)}/comments`, {
        method: "POST",
        body: { body, ...(author ? { author } : {}) },
      }),

    // Статус меняет `PATCH /tasks/:id` — отдельного `/status` в Core нет.
    setTaskStatus: (id, input) =>
      request<Task>(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: input }),

    events: (params) =>
      request<CoreEvent[]>("/events", {
        query: {
          source: params.source,
          type: params.type,
          typePrefix: params.typePrefix,
          since: params.since,
          until: params.until,
          order: params.order,
          limit: params.limit,
        },
      }),

    recordEvent: (input) => request<CoreEvent>("/events", { method: "POST", body: input }),

    entities: (params) =>
      request<EntityCard[]>("/entities", {
        query: {
          domain: params.domain,
          type: params.type,
          q: params.q,
          operational: params.operational,
          id: params.id,
          limit: params.limit,
        },
        owner: personal(params.domain),
      }),

    // У `GET /docs/tree` фильтра по корню нет — дерево целиком отдаётся всегда.
    // Отбор по корню делает `kb_tree`: клиент остаётся дверью в Core и ничего
    // не прячет сам, а инструменту для честного отказа нужны ВСЕ корни ответа.
    docsTree: () => request<DocsTreeItem[]>("/docs/tree"),

    // Личный документ Core отдаёт только владельцу (`personalVisible`), поэтому
    // owner-токен идёт вместе с запросом, когда он задан; решение об отказе
    // остаётся за Core, клиент ничего не прячет сам.
    docFile: (path) => request<DocFile>("/docs/file", { query: { path }, owner: true }),

    // Архив Core отдаёт только по `?archived=1`; без параметра его в ответе нет.
    agents: (params) =>
      request<Agent[]>("/agents", {
        query: { ...(params?.archived ? { archived: "1" } : {}) },
      }),

    // `agent` — необязательный отбор: без него дека приходит целиком (её и
    // показывает панель `/skills`).
    skillDeck: (agent) => request<SkillDeck>("/agents/skills", { query: { agent } }),

    createAgent: (input, actor) =>
      request<Agent>("/agents", { method: "POST", body: { ...input, ...(actor ? { actor } : {}) } }),

    updateAgent: (name, patch, actor) =>
      request<Agent>(`/agents/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: { ...patch, ...(actor ? { actor } : {}) },
      }),

    // Автономию Core меняет ТОЛЬКО этим маршрутом: общий patch карточки её
    // сознательно отбрасывает (иначе тир поднимался бы любой правкой).
    setAutonomy: (name, tier, actor) =>
      request<Agent>(`/agents/${encodeURIComponent(name)}/autonomy`, {
        method: "PATCH",
        body: { autonomyDefault: tier, ...(actor ? { actor } : {}) },
        owner: true,
      }),

    runs: (params) =>
      request<{ runs: AgentRun[] }>("/routines/runs", {
        query: {
          agent: params.agent,
          skill: params.skill,
          outcome: params.outcome,
          from: params.from,
          to: params.to,
          limit: params.limit,
        },
      }),

    // Брифинг тоже под `excludePersonal`: без owner-токена владелец получил бы
    // сводку без собственных дел и счёл бы её полной.
    briefing: () => request<Briefing>("/registry/briefing", { owner: true }),

    systemConfig: () => request<SystemConfigItem[]>("/system/config"),
  };
}
