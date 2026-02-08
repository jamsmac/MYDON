# ФИНАЛЬНЫЙ ПРОМПТ: Система скиллов, агентов, рейтингов AI и интеллектуального роутинга для MYDON

---

## КОНТЕКСТ ПРОЕКТА

MYDON — система управления проектами с иерархией **Project → Block (этап) → Section (раздел) → Task (задача)**. Стек: React + TypeScript + tRPC + Drizzle ORM (MySQL) + Tailwind + shadcn/ui + Streamdown (markdown). Тёмная тема: `bg-slate-800/900`, amber акценты, `text-slate-300/400`. Иконки: lucide-react.

---

## ЧТО УЖЕ ЕСТЬ (ТОЧНОЕ СОСТОЯНИЕ КОДА)

### 1. Быстрые кнопки — `QuickActionsBar.tsx`

Компонент с кнопками быстрых AI-действий, показывается в `BlockDetailPanel`, `SectionDetailPanel`, `TaskDetailPanel`.

**Текущие кнопки (13 штук):**

| # | ID | Тип сущности | Название | Команда | additionalContext (инструкция) |
|---|---|---|---|---|---|
| 1 | `block-roadmap` | block | Создать roadmap | `suggest` | "Создай детальный roadmap для этого блока. Включи этапы, сроки и ключевые вехи. Формат: markdown с таблицей." |
| 2 | `block-decompose` | block | Декомпозировать | `suggest` | "Декомпозируй блок на разделы и задачи. Для каждого раздела предложи 3-5 задач. Формат: markdown со списками." |
| 3 | `block-risks` | block | Оценить риски | `risks` | "Определи 5-7 ключевых рисков блока. Для каждого: описание, вероятность, влияние, стратегия митигации." |
| 4 | `block-report` | block | Отчёт | `summarize` | "Сформируй краткий отчёт по блоку: прогресс, ключевые достижения, проблемы, следующие шаги." |
| 5 | `section-tasks` | section | Создать задачи | `suggest` | "Предложи 5-8 задач для этого раздела. Для каждой: название, описание, приоритет. Формат: нумерованный список." |
| 6 | `section-plan` | section | Сгенерировать план | `suggest` | "Создай план работ по разделу: последовательность задач, зависимости, оценка сроков. Формат: markdown." |
| 7 | `section-evaluate` | section | Оценить задачи | `analyze` | "Оцени все задачи раздела: сложность (1-10), примерные сроки, необходимые ресурсы. Формат: таблица." |
| 8 | `section-deps` | section | Найти зависимости | `analyze` | "Определи зависимости между задачами раздела. Какие задачи блокируют другие? Формат: список связей." |
| 9 | `task-subtasks` | task | Подзадачи | `suggest` | "Разбей задачу на 3-7 подзадач. Для каждой: название, описание, оценка времени." |
| 10 | `task-estimate` | task | Оценить | `analyze` | "Оцени задачу: сложность (1-10), примерное время, необходимые навыки, возможные блокеры." |
| 11 | `task-risks` | task | Риски | `risks` | "Определи риски задачи: технические, организационные, внешние. Для каждого — стратегия митигации." |
| 12 | `task-spec` | task | ТЗ | `suggest` | "Напиши техническое задание для задачи: цель, требования, критерии приёмки, ограничения." |
| 13 | `task-howto` | task | Как выполнить | `suggest` | "Объясни пошагово, как лучше выполнить эту задачу. Включи рекомендации и лучшие практики." |

**Текущий механизм:** Все кнопки вызывают `trpc.aiEnhancements.processCommand.useMutation()` с одной из 4 команд: `summarize | analyze | suggest | risks`. Результат показывается в Dialog с кнопками "Копировать" и "Вставить в заметки".

**Проблемы:**
1. Все 13 кнопок проходят через **один** обобщённый `processCommand` — нет специализации по агентам/скиллам
2. Инструкция (`additionalContext`) отправляется как дополнительный текст к generic промпту, а не через специализированный скилл
3. Нет выбора модели — все запросы идут к одной захардкоженной модели
4. Нет оценки качества/рейтинга результата
5. Результаты нельзя автоматически применить (создать задачи, подзадачи, обновить статус)

### 2. Quick Prompts в EntityAIChat — `EntityAIChat.tsx`

Кнопки-подсказки внутри AI-чата сущности (показываются, когда чат пуст):

| # | Тип | Текст кнопки | Prompt (отправляется в чат) |
|---|---|---|---|
| 1 | block | Создать roadmap | `Создай детальный roadmap для блока "{title}" с этапами, сроками и метриками` |
| 2 | block | Декомпозировать | `Разбей блок "{title}" на конкретные разделы и задачи с оценкой трудозатрат` |
| 3 | block | Оценить риски | `Какие основные риски у блока "{title}" и как их минимизировать?` |
| 4 | block | Сформировать отчёт | `Сформируй отчёт о текущем состоянии блока "{title}" с рекомендациями` |
| 5 | section | Создать задачи | `Предложи список задач для раздела "{title}" с приоритетами и оценкой времени` |
| 6 | section | Составить план | `Составь детальный план работ для раздела "{title}" с этапами и зависимостями` |
| 7 | section | Оценить раздел | `Оцени текущее состояние раздела "{title}" и предложи улучшения` |
| 8 | section | Найти зависимости | `Какие зависимости и блокеры могут быть у раздела "{title}"?` |
| 9 | task | 💬 Обсудить | `Давай обсудим задачу "{title}". Какие ключевые вопросы нужно проработать? Предложи темы для обсуждения и возможные решения.` |
| 10 | task | 🔍 Проработать | `Проведи глубокий анализ задачи "{title}". Исследуй тему, собери ключевые факты, лучшие практики и рекомендации.` |
| 11 | task | 📄 Создать документ | `Создай структурированный документ по задаче "{title}". Включи цели, описание, требования, критерии приёмки и сроки.` |
| 12 | task | 📊 Составить таблицу | `Составь таблицу (в формате Markdown) для задачи "{title}" с ключевыми параметрами, метриками, ответственными и сроками.` |
| 13 | task | 📋 План действий | `Напиши пошаговый план действий для задачи "{title}" с конкретными шагами, ответственными, сроками и ожидаемыми результатами.` |
| 14 | task | 📑 Подготовить презентацию | `Подготовь структуру презентации по задаче "{title}". Предложи слайды с заголовками, ключевыми тезисами и визуальными элементами.` |
| 15 | task | ⚡ Подзадачи | `Разбей задачу "{title}" на конкретные подзадачи с оценкой времени и приоритетами.` |
| 16 | task | ⚠️ Риски | `Какие риски и блокеры могут возникнуть при выполнении задачи "{title}"? Как их минимизировать?` |

**Текущий механизм:** Quick prompts просто вставляют текст в `<Input>` и автоматически отправляют через `POST /api/ai/stream`. Контекст: 10 последних сообщений + `entityContext` (тип и название сущности).

**Проблемы:**
1. Нет связи со скиллами — промпт просто текст, не маршрутизируется через оркестратор
2. Результат только текстовый — нельзя автоматически создать задачи, обновить поля, экспортировать
3. Один и тот же промпт для любой модели — нет оптимизации под capabilities конкретной модели

### 3. Серверная обработка — `aiEnhancementsRouter.ts`

**`processCommand`** — центральный эндпоинт для QuickActionsBar:
- Input: `{ command: summarize|analyze|suggest|risks, projectId, blockId?, sectionId?, taskId?, additionalContext? }`
- Загружает данные сущности из БД
- Формирует один из 4 шаблонных промптов (summarize/analyze/suggest/risks)
- Добавляет `additionalContext` как дополнительный текст
- Вызывает `invokeLLM()` с generic system prompt: `"You are a helpful project management assistant. Respond in Russian."`
- Логирует в `aiChatHistory`
- Возвращает `{ result: string, command: string }`

**Другие AI-эндпоинты:**
- `getTaskSuggestions` — предложения задач для раздела (JSON schema response)
- `detectPriority` — автоопределение приоритета задачи (ключевые слова + AI fallback)
- `findSimilarTasks` — поиск дублей (word overlap heuristic)
- `detectRisks` — детекция рисков проекта (просроченные, заблокированные, scope)
- `suggestDependencies` — AI-подсказки зависимостей задачи (JSON schema response)
- `generateExecutiveSummary` — генерация executive summary проекта

### 4. Агенты — таблица `ai_agents` и `orchestratorRouter.ts`

**Схема таблицы `ai_agents`:**
```
id, name, nameRu, slug, description, descriptionRu,
type: ENUM("code", "research", "writing", "planning", "analysis", "general"),
capabilities: JSON<string[]>,
systemPrompt: TEXT,
modelPreference: VARCHAR(50),  ← ИГНОРИРУЕТСЯ (см. баг)
fallbackModel: VARCHAR(50),
temperature: INT (0-100),
maxTokens: INT (default 4096),
triggerPatterns: JSON<string[]>,  ← regex паттерны для авто-роутинга
priority: INT (0+, higher = first),
isActive, isSystem,
totalRequests, avgResponseTime, successRate
```

**Текущее состояние: 0 агентов в БД** — таблица пустая, нет предустановленных агентов.

**Оркестратор (`orchestratorRouter.route`):**
1. Загружает orchestratorConfig
2. Загружает активных агентов, отсортированных по `priority DESC`
3. Перебирает `triggerPatterns` каждого агента — `new RegExp(pattern, 'i').test(message)`
4. Первый совпавший — `selectedAgent`
5. Fallback: агент с `type === "general"` → первый агент → нет агента
6. Использует `selectedAgent.systemPrompt` как system message
7. Вызывает `invokeLLM()` — **КРИТИЧЕСКИЙ БАГ: model ВСЕГДА = DEFAULT_MODEL, агент.modelPreference ИГНОРИРУЕТСЯ**
8. Логирует в `aiRequestLogs`, обновляет статистику агента

### 5. Скиллы — таблица `ai_skills`

**Схема таблицы `ai_skills`:**
```
id, name, nameRu, slug, description,
agentId: INT (FK → ai_agents, опционально),
triggerPatterns: JSON<string[]>,
handlerType: ENUM("prompt", "function", "mcp", "webhook"),
handlerConfig: JSON<SkillHandlerConfig>,
  → prompt?: string
  → functionName?: string
  → mcpServerId?: number
  → mcpToolName?: string
  → webhookUrl?: string
  → webhookMethod?: string
inputSchema: JSON,
outputSchema: JSON,
isActive, isSystem,
totalInvocations, avgExecutionTime
```

**Текущее состояние: 0 скиллов в БД** — таблица пустая.

**Проблемы:**
1. Скиллы НЕ вызываются нигде в коде — есть CRUD, но нет invocation engine
2. `handlerConfig.prompt` хранит промпт, но нет механизма его выполнения
3. `handlerType: "function"` — нет маппинга functionName → реальные функции
4. `handlerType: "mcp"` — MCP connection test = TODO stub
5. Нет связи между QuickActionsBar и скиллами

### 6. MCP серверы — таблица `mcp_servers`

**Схема:**
```
id, name, slug, description,
endpoint: VARCHAR(500),
protocol: ENUM("stdio", "http", "websocket"),
authType: ENUM("none", "api_key", "oauth", "basic"),
authConfig: JSON<MCPAuthConfig>,
tools: JSON<MCPTool[]>,
status: ENUM("active", "inactive", "error", "connecting"),
lastHealthCheck, lastError,
totalRequests, avgResponseTime
```

**Текущее состояние:**
- CRUD роутер работает
- `test` mutation = заглушка (просто ставит `status: "active"`)
- НЕТ реального MCP протокола — нет клиента, нет вызова tools

### 7. Выбор модели — `llm.ts` + `llmStream.ts`

**КРИТИЧЕСКИЙ БАГ:**
```typescript
// llm.ts:222-224
const DEFAULT_MODEL = isOpenRouter()
  ? "google/gemini-2.0-flash-001"
  : "gemini-2.5-flash";

// llm.ts:307-308
const payload = {
  model: DEFAULT_MODEL,  // ← ВСЕГДА ОДНА И ТА ЖЕ МОДЕЛЬ
  ...
};
```

**Та же проблема в `llmStream.ts:73-75, 115-116`:**
```typescript
const DEFAULT_MODEL = isOpenRouter()
  ? "google/gemini-2.0-flash-001"
  : "gemini-2.5-flash";
// ...
payload.model = DEFAULT_MODEL;
```

**Функция `invokeLLM(params)` НЕ принимает параметр `model`** — в `InvokeParams` нет поля model.

**`AIRouter.selectProvider()` в `aiRouter.ts`:**
```typescript
private static selectProvider(taskType, requestedModel) {
  // Может разобрать gpt-/claude-/gemini- по префиксу
  // Но DEFAULT_TASK_MODEL_MAPPING все 7 типов → { provider: 'builtin', model: 'default' }
}
```

### 8. ModelSelector UI — `ModelSelector.tsx`

- Показывает список моделей из `trpc.usage.getAvailableModels`
- Сохраняет выбор в `localStorage.setItem('selectedAIModel', ...)`
- **Бэкенд НЕ читает localStorage** — выбор модели пользователем нигде не используется

### 9. ModelComparison UI — `ModelComparison.tsx`

- Сравнение ответов 2-4 моделей side-by-side
- `trpc.usage.compareModels` — отправляет промпт нескольким моделям, показывает результаты
- `trpc.usage.getComparisonCost` — оценка стоимости
- Сохраняет результат в `modelComparisons` таблицу с `preferredModel`

### 10. Ценообразование моделей — таблица `model_pricing`

```
id, modelName, modelDisplayName, provider,
inputCostPer1K: DECIMAL(10,4), outputCostPer1K: DECIMAL(10,4),
planRestrictions: JSON { allowedPlanIds, minPlanLevel },
capabilities: JSON { maxTokens, supportsVision, supportsStreaming, supportsFunctionCalling },
isEnabled, displayOrder
```

### 11. Orchestrator Config — таблица `orchestrator_config`

```
routingRules: JSON<OrchestratorRoutingRule[]>,
  → { id, name, condition: { type: "pattern"|"context"|"user_preference", value }, targetAgentId, priority, isActive }
fallbackAgentId, fallbackModel (default "gpt-4o-mini"),
loggingLevel, logRetentionDays (30),
globalRateLimit (100 req/min),
enableAgentRouting, enableSkillMatching, enableMCPIntegration
```

### 12. Логирование — таблица `ai_request_logs`

```
id, userId,
requestType: ENUM("chat", "generate", "skill", "mcp"),
agentId, skillId, mcpServerId,
input, output,
model, provider,
tokensUsed, responseTimeMs,
status: ENUM("success", "error", "timeout", "rate_limited"),
errorMessage, creditsCost
```

### 13. Админ-панели (уже есть)

- **`AdminAgents.tsx`** — CRUD агентов: type, systemPrompt, temperature, maxTokens, triggerPatterns, priority, modelPreference, тестирование
- **`AdminSkills.tsx`** — CRUD скиллов: handlerType (LLM/Code/API/MCP), handlerConfig, agentId binding, inputSchema, outputSchema
- **`AdminMCP.tsx`** — CRUD MCP серверов: endpoint, protocol, auth, health check, tools discovery
- **`AdminPrompts.tsx`** — библиотека системных промптов по категориям
- **`AdminModelCosts.tsx`** — управление ценами моделей (modelPricing)

---

## ЧТО НУЖНО ДОРАБОТАТЬ

### ЧАСТЬ 1: ИСПРАВЛЕНИЕ КРИТИЧЕСКИХ БАГОВ

#### 1.1 Параметр `model` в `invokeLLM` и `streamLLM`

**Файлы:** `server/_core/llm.ts`, `server/_core/llmStream.ts`

**Что сделать:**
1. Добавить `model?: string` в `InvokeParams` и `StreamParams`
2. Использовать `params.model || DEFAULT_MODEL` вместо просто `DEFAULT_MODEL`:

```typescript
// llm.ts — InvokeParams
export type InvokeParams = {
  messages: Message[];
  model?: string;          // ← ДОБАВИТЬ
  tools?: Tool[];
  toolChoice?: ToolChoice;
  // ... остальные поля
};

// llm.ts — invokeLLM
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // ...
  const payload: Record<string, unknown> = {
    model: params.model || DEFAULT_MODEL,   // ← ИСПОЛЬЗОВАТЬ params.model
    messages: messages.map(normalizeMessage),
  };
  // ...
}

// llmStream.ts — StreamParams
export type StreamParams = {
  messages: Message[];
  model?: string;          // ← ДОБАВИТЬ
  tools?: Tool[];
  // ...
};

// llmStream.ts — streamLLM
export async function streamLLM(params: StreamParams): Promise<ReadableStream<Uint8Array>> {
  // ...
  const payload: Record<string, unknown> = {
    model: params.model || DEFAULT_MODEL,   // ← ИСПОЛЬЗОВАТЬ params.model
    messages: messages.map(normalizeMessage),
    stream: true,
  };
  // ...
}
```

#### 1.2 Передача model из агента в invokeLLM

**Файл:** `server/orchestratorRouter.ts` (строка ~537)

**Что сделать:** Передавать `selectedAgent.modelPreference` в `invokeLLM`:

```typescript
const response = await invokeLLM({
  model: selectedAgent?.modelPreference || undefined,  // ← ДОБАВИТЬ
  messages: [
    { role: "system", content: systemPrompt },
    // ...
  ],
});
```

#### 1.3 Активация DEFAULT_TASK_MODEL_MAPPING

**Файл:** `server/utils/aiTypes.ts`

**Что сделать:** Заменить все `{ provider: 'builtin', model: 'default' }` на реальные модели:

```typescript
export const DEFAULT_TASK_MODEL_MAPPING: Record<TaskType, { provider: AIProvider; model: string }> = {
  reasoning: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  coding: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  vision: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  chat: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  translation: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  summarization: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
  creative: { provider: 'builtin', model: 'google/gemini-2.0-flash-001' },
};
```

В дальнейшем (после реализации рейтинга) эти значения будут загружаться из БД (из `orchestrator_config` или новой таблицы `ai_model_ratings`).

---

### ЧАСТЬ 2: СИСТЕМА РЕЙТИНГОВ AI-ИНСТРУМЕНТОВ

#### 2.1 Новая таблица `ai_model_ratings`

```sql
CREATE TABLE ai_model_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modelName VARCHAR(128) NOT NULL,      -- "google/gemini-2.0-flash-001", "anthropic/claude-3.5-sonnet"
  provider VARCHAR(64) NOT NULL,

  -- Рейтинги по категориям (0-100)
  ratingReasoning INT DEFAULT 50,       -- Сложный анализ, логика
  ratingCoding INT DEFAULT 50,          -- Генерация/отладка кода
  ratingCreative INT DEFAULT 50,        -- Креативное письмо
  ratingTranslation INT DEFAULT 50,     -- Перевод
  ratingSummarization INT DEFAULT 50,   -- Суммаризация
  ratingPlanning INT DEFAULT 50,        -- Планирование проектов
  ratingRiskAnalysis INT DEFAULT 50,    -- Анализ рисков
  ratingDataAnalysis INT DEFAULT 50,    -- Анализ данных
  ratingDocumentation INT DEFAULT 50,   -- Документирование
  ratingChat INT DEFAULT 50,            -- Общий чат

  -- Общие метрики
  overallRating INT DEFAULT 50,         -- Средневзвешенный рейтинг
  speedRating INT DEFAULT 50,           -- Скорость ответа
  costEfficiency INT DEFAULT 50,        -- Соотношение цена/качество

  -- Авто-метрики (заполняются из ai_request_logs)
  avgResponseTimeMs INT DEFAULT 0,
  avgTokensPerRequest INT DEFAULT 0,
  successRate INT DEFAULT 100,
  totalRequests INT DEFAULT 0,

  -- Источники рейтингов
  ratingSource ENUM('manual', 'benchmark', 'user_feedback', 'auto') DEFAULT 'manual',
  lastBenchmarkAt TIMESTAMP NULL,

  -- Для привязки к model_pricing
  modelPricingId INT NULL,              -- FK → model_pricing.id

  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),

  UNIQUE KEY (modelName)
);
```

#### 2.2 Новая таблица `ai_model_task_assignments`

Связывает конкретные типы задач с рекомендованной моделью:

```sql
CREATE TABLE ai_model_task_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,

  taskCategory VARCHAR(64) NOT NULL,    -- 'roadmap', 'decompose', 'risks', 'report', 'subtasks', 'spec', 'chat', etc.
  entityType ENUM('project', 'block', 'section', 'task', 'any') DEFAULT 'any',

  -- Назначенная модель (приоритетная)
  primaryModelName VARCHAR(128) NOT NULL,
  fallbackModelName VARCHAR(128) NULL,

  -- Назначенный агент (если есть)
  agentId INT NULL,                     -- FK → ai_agents.id

  -- Назначенный скилл (если есть)
  skillId INT NULL,                     -- FK → ai_skills.id

  -- Критерий выбора этой модели
  selectionReason VARCHAR(255),         -- "Best rating for planning (92/100)"

  -- Администратор может зафиксировать выбор
  isManualOverride BOOLEAN DEFAULT FALSE,

  isActive BOOLEAN DEFAULT TRUE,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),

  UNIQUE KEY (taskCategory, entityType)
);
```

#### 2.3 Админ-панель рейтингов — `AdminModelRatings.tsx`

**Новая страница в админке** (паттерн как `AdminModelCosts.tsx`):

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏆 Рейтинги AI-моделей                              [Benchmark All]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─ Фильтр ───────────────────────────────────────────────────┐      │
│ │ [Все] [Anthropic] [OpenAI] [Google] [Meta] [Mistral]       │      │
│ └────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─ Таблица ──────────────────────────────────────────────────┐      │
│ │ Модель        │ Общий │ Планир │ Анализ │ Код │ Крeат │ Скор│      │
│ │ 🟣 Claude 3.5 │  92   │   95   │   93   │  90 │   91  │  78 │      │
│ │ 🟢 GPT-4o     │  88   │   90   │   88   │  92 │   85  │  82 │      │
│ │ 🔵 Gemini 2.0 │  80   │   82   │   78   │  76 │   80  │  95 │      │
│ │ 🟠 Mistral L  │  75   │   77   │   72   │  80 │   73  │  88 │      │
│ └────────────────────────────────────────────────────────────┘      │
│                                                                      │
│ ┌─ Назначения моделей на задачи ─────────────────────────────┐      │
│ │ Категория      │ Сущность │ Модель         │ Агент    │ Пр │      │
│ │ roadmap         │ block    │ Claude 3.5     │ Planner  │ A  │      │
│ │ decompose       │ block    │ Claude 3.5     │ Planner  │ A  │      │
│ │ risks           │ any      │ GPT-4o         │ Analyst  │ A  │      │
│ │ subtasks        │ task     │ Gemini Flash   │ General  │ M  │      │
│ │ spec            │ task     │ Claude 3.5     │ Writer   │ A  │      │
│ └────────────────────────────────────────────────────────────┘      │
│   A = Auto (по рейтингу), M = Manual Override                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Функции:**
1. Просмотр/редактирование рейтингов каждой модели по категориям (Slider 0-100)
2. Авто-заполнение метрик из `ai_request_logs` (avgResponseTime, successRate, totalRequests)
3. Benchmark: отправить тестовый промпт всем моделям, сравнить результаты, обновить рейтинги
4. Таблица назначений: какая модель + агент используется для какой категории задач
5. Manual Override: зафиксировать конкретную модель для задачи (не переопределяется авто-рейтингом)

**tRPC роутер:** `adminModelRatings` с процедурами:
- `list` — все рейтинги
- `update` — обновить рейтинги модели
- `getAssignments` — получить назначения
- `updateAssignment` — изменить назначение
- `runBenchmark` — запустить бенчмарк
- `recalculateFromLogs` — пересчитать авто-метрики

---

### ЧАСТЬ 3: ДВИЖОК ИСПОЛНЕНИЯ СКИЛЛОВ (SKILL ENGINE)

#### 3.1 Новый серверный модуль — `server/utils/skillEngine.ts`

Центральный движок, который умеет выполнять скиллы разных типов:

```typescript
import { invokeLLM } from '../_core/llm';
import { streamLLM } from '../_core/llmStream';
import { getDb } from '../db';
import { aiSkills, aiAgents, aiRequestLogs } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

export interface SkillExecutionContext {
  userId: number;
  projectId: number;
  entityType: 'project' | 'block' | 'section' | 'task';
  entityId: number;
  entityData: Record<string, unknown>;  // данные из БД (title, status, description и т.д.)
  additionalContext?: string;
  model?: string;                        // переопределение модели
  stream?: boolean;                      // стриминг или нет
}

export interface SkillExecutionResult {
  success: boolean;
  content: string;                       // основной результат (markdown)
  structuredData?: unknown;              // JSON-структура (если outputSchema задана)
  model: string;
  tokensUsed?: number;
  responseTimeMs: number;
  agentId?: number;
  skillId: number;
}

export class SkillEngine {

  /**
   * Основной метод: найти и выполнить скилл
   */
  static async execute(
    skillSlug: string,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // 1. Найти скилл по slug
    const [skill] = await db.select().from(aiSkills)
      .where(eq(aiSkills.slug, skillSlug));

    if (!skill || !skill.isActive) {
      throw new Error(`Skill "${skillSlug}" not found or inactive`);
    }

    // 2. Найти агента (если привязан)
    let agent = null;
    if (skill.agentId) {
      const [a] = await db.select().from(aiAgents)
        .where(eq(aiAgents.id, skill.agentId));
      agent = a;
    }

    // 3. Определить модель:
    //    context.model (ручной выбор) → agent.modelPreference → задача-рейтинг → DEFAULT_MODEL
    const model = await this.resolveModel(context, agent, skill);

    // 4. Выполнить скилл в зависимости от handlerType
    const startTime = Date.now();
    let result: SkillExecutionResult;

    switch (skill.handlerType) {
      case 'prompt':
        result = await this.executePromptSkill(skill, agent, context, model);
        break;
      case 'function':
        result = await this.executeFunctionSkill(skill, context);
        break;
      case 'mcp':
        result = await this.executeMCPSkill(skill, context);
        break;
      case 'webhook':
        result = await this.executeWebhookSkill(skill, context);
        break;
      default:
        throw new Error(`Unknown handler type: ${skill.handlerType}`);
    }

    result.responseTimeMs = Date.now() - startTime;
    result.skillId = skill.id;
    result.agentId = agent?.id;

    // 5. Логировать
    await this.logExecution(context, skill, agent, result);

    // 6. Обновить статистику скилла
    await db.update(aiSkills).set({
      totalInvocations: sql`${aiSkills.totalInvocations} + 1`,
      avgExecutionTime: sql`(${aiSkills.avgExecutionTime} * ${aiSkills.totalInvocations} + ${result.responseTimeMs}) / (${aiSkills.totalInvocations} + 1)`,
    }).where(eq(aiSkills.id, skill.id));

    return result;
  }

  /**
   * Выполнение prompt-скилла: подставляет контекст в промпт и вызывает LLM
   */
  private static async executePromptSkill(
    skill: AISkill,
    agent: AIAgent | null,
    context: SkillExecutionContext,
    model: string
  ): Promise<SkillExecutionResult> {
    // Построить промпт из шаблона скилла
    const skillPrompt = this.buildPromptFromTemplate(
      skill.handlerConfig?.prompt || '',
      context
    );

    // System prompt = агент.systemPrompt или дефолт
    const systemPrompt = agent?.systemPrompt ||
      'Ты — AI-ассистент для управления проектами MYDON. Отвечай на русском языке. Формат: markdown.';

    const response = await invokeLLM({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(context.additionalContext
          ? [{ role: 'user' as const, content: `Контекст: ${context.additionalContext}` }]
          : []),
        { role: 'user', content: skillPrompt },
      ],
      // Если у скилла есть outputSchema, использовать JSON schema response
      ...(skill.outputSchema ? {
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: skill.slug,
            schema: skill.outputSchema,
          }
        }
      } : {}),
    });

    const content = typeof response.choices[0]?.message?.content === 'string'
      ? response.choices[0].message.content
      : '';

    return {
      success: true,
      content,
      structuredData: skill.outputSchema ? JSON.parse(content) : undefined,
      model: response.model,
      tokensUsed: response.usage?.total_tokens,
      responseTimeMs: 0,
      skillId: skill.id,
    };
  }

  /**
   * Шаблонизация промпта: подстановка переменных контекста
   */
  private static buildPromptFromTemplate(
    template: string,
    context: SkillExecutionContext
  ): string {
    return template
      .replace(/\{\{entityType\}\}/g, context.entityType)
      .replace(/\{\{entityId\}\}/g, String(context.entityId))
      .replace(/\{\{entityTitle\}\}/g, String(context.entityData.title || ''))
      .replace(/\{\{entityDescription\}\}/g, String(context.entityData.description || ''))
      .replace(/\{\{entityStatus\}\}/g, String(context.entityData.status || ''))
      .replace(/\{\{entityPriority\}\}/g, String(context.entityData.priority || ''))
      .replace(/\{\{entityDeadline\}\}/g, String(context.entityData.deadline || ''))
      .replace(/\{\{projectId\}\}/g, String(context.projectId))
      .replace(/\{\{entityData\}\}/g, JSON.stringify(context.entityData, null, 2));
  }

  /**
   * Определение модели: приоритет выбора
   */
  private static async resolveModel(
    context: SkillExecutionContext,
    agent: AIAgent | null,
    skill: AISkill
  ): Promise<string> {
    // 1. Ручной выбор пользователя (через ModelSelector)
    if (context.model) return context.model;

    // 2. Предпочтение агента
    if (agent?.modelPreference) return agent.modelPreference;

    // 3. Из ai_model_task_assignments (авто-рейтинг)
    const db = await getDb();
    if (db) {
      // Найти назначение по slug скилла и entityType
      const [assignment] = await db.select()
        .from(aiModelTaskAssignments)
        .where(and(
          eq(aiModelTaskAssignments.taskCategory, skill.slug),
          or(
            eq(aiModelTaskAssignments.entityType, context.entityType),
            eq(aiModelTaskAssignments.entityType, 'any')
          ),
          eq(aiModelTaskAssignments.isActive, true)
        ))
        .orderBy(/* entityType-specific first */ );

      if (assignment?.primaryModelName) return assignment.primaryModelName;
    }

    // 4. DEFAULT_MODEL
    return undefined; // invokeLLM использует DEFAULT_MODEL
  }

  /**
   * Выполнение function-скилла: вызов зарегистрированной функции
   */
  private static async executeFunctionSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const functionName = skill.handlerConfig?.functionName;
    if (!functionName) throw new Error('No functionName in skill config');

    const handler = REGISTERED_FUNCTIONS[functionName];
    if (!handler) throw new Error(`Function "${functionName}" not registered`);

    return handler(context);
  }

  /**
   * Выполнение MCP-скилла: вызов MCP tool через сервер
   */
  private static async executeMCPSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const { mcpServerId, mcpToolName } = skill.handlerConfig || {};
    if (!mcpServerId || !mcpToolName) throw new Error('MCP config incomplete');

    // TODO: Реализовать MCP протокол (см. часть 7)
    throw new Error('MCP execution not yet implemented');
  }

  /**
   * Выполнение webhook-скилла: HTTP-вызов внешнего сервиса
   */
  private static async executeWebhookSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const { webhookUrl, webhookMethod } = skill.handlerConfig || {};
    if (!webhookUrl) throw new Error('No webhookUrl in skill config');

    const response = await fetch(webhookUrl, {
      method: webhookMethod || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillSlug: skill.slug,
        context: {
          entityType: context.entityType,
          entityId: context.entityId,
          entityData: context.entityData,
          projectId: context.projectId,
        },
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      content: data.content || JSON.stringify(data),
      structuredData: data,
      model: 'webhook',
      responseTimeMs: 0,
      skillId: skill.id,
    };
  }
}

/**
 * Реестр встроенных функций для function-скиллов
 */
const REGISTERED_FUNCTIONS: Record<string, (ctx: SkillExecutionContext) => Promise<SkillExecutionResult>> = {
  // Будут добавлены: detectRisks, suggestDependencies, findSimilarTasks, и т.д.
};
```

#### 3.2 Новый tRPC-роутер — `server/skillExecutionRouter.ts`

```typescript
export const skillExecutionRouter = router({
  // Выполнить скилл по slug
  execute: protectedProcedure
    .input(z.object({
      skillSlug: z.string(),
      projectId: z.number(),
      entityType: z.enum(['project', 'block', 'section', 'task']),
      entityId: z.number(),
      additionalContext: z.string().optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Загрузить данные сущности из БД
      const entityData = await loadEntityData(input.entityType, input.entityId);

      // 2. Выполнить скилл
      const result = await SkillEngine.execute(input.skillSlug, {
        userId: ctx.user.id,
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        entityData,
        additionalContext: input.additionalContext,
        model: input.model,
      });

      return result;
    }),

  // Стриминговое выполнение скилла (через /api/ai/skill-stream)
  // Регистрируется как Express endpoint, не tRPC

  // Получить доступные скиллы для сущности
  getAvailableSkills: protectedProcedure
    .input(z.object({
      entityType: z.enum(['project', 'block', 'section', 'task']),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const skills = await db.select().from(aiSkills)
        .where(eq(aiSkills.isActive, true));

      // Фильтровать по entityType через inputSchema или slug-prefix
      return skills.filter(s =>
        s.slug.startsWith(`${input.entityType}-`) ||
        s.slug.startsWith('any-') ||
        !s.slug.includes('-')
      );
    }),
});
```

---

### ЧАСТЬ 4: ПРЕДУСТАНОВЛЕННЫЕ АГЕНТЫ И СКИЛЛЫ (SEED DATA)

#### 4.1 Агенты (seed в `ai_agents`)

Создать 6 системных агентов:

| # | slug | name | nameRu | type | systemPrompt (краткое описание) | modelPreference | temperature | priority |
|---|---|---|---|---|---|---|---|---|
| 1 | `planner` | Planner | Планировщик | planning | "Ты — эксперт по планированию проектов. Создаёшь roadmap-ы, декомпозируешь задачи, определяешь зависимости. Формат: структурированный markdown с таблицами и списками." | (из рейтинга) | 60 | 10 |
| 2 | `analyst` | Analyst | Аналитик | analysis | "Ты — аналитик проектов. Оцениваешь риски, анализируешь прогресс, находишь слабые места. Даёшь количественные оценки (1-10, проценты). Формат: markdown с таблицами." | (из рейтинга) | 40 | 9 |
| 3 | `writer` | Writer | Документалист | writing | "Ты — технический писатель. Создаёшь документацию, ТЗ, спецификации, отчёты, презентации. Пишешь структурированно, с чёткими разделами. Формат: профессиональный markdown." | (из рейтинга) | 70 | 8 |
| 4 | `researcher` | Researcher | Исследователь | research | "Ты — исследователь. Глубоко прорабатываешь темы, собираешь факты, лучшие практики, рекомендации. Ссылаешься на источники. Формат: аналитический markdown." | (из рейтинга) | 50 | 7 |
| 5 | `facilitator` | Facilitator | Фасилитатор | general | "Ты — фасилитатор обсуждений. Помогаешь обсудить вопросы, предлагаешь темы, задаёшь наводящие вопросы, структурируешь дискуссию. Тон: дружелюбный, конструктивный." | (из рейтинга) | 75 | 6 |
| 6 | `general` | General Assistant | Ассистент | general | "Ты — AI-ассистент для MYDON. Помогаешь с любыми вопросами управления проектами. Отвечай на русском, формат: markdown." | (из рейтинга) | 70 | 0 |

**triggerPatterns для каждого агента:**
- `planner`: `["roadmap", "план", "декомпозиц", "спланируй", "этапы"]`
- `analyst`: `["анализ", "оцен", "риск", "метрик", "зависимост"]`
- `writer`: `["документ", "ТЗ", "спецификац", "отчёт", "презентац", "таблиц"]`
- `researcher`: `["исследуй", "проработай", "изучи", "практик", "рекомендац"]`
- `facilitator`: `["обсуд", "дискусс", "вопросы", "мнение"]`
- `general`: `[]` — fallback agent

#### 4.2 Скиллы (seed в `ai_skills`)

Создать скиллы, соответствующие каждой быстрой кнопке:

**Для блоков (block):**

| # | slug | name | nameRu | agentId → | handlerType | handlerConfig.prompt |
|---|---|---|---|---|---|---|
| 1 | `block-roadmap` | Create Roadmap | Создать roadmap | planner | prompt | "Создай детальный roadmap для блока «{{entityTitle}}».\n\nДанные блока:\n{{entityData}}\n\nВключи:\n1. Ключевые этапы с датами\n2. Milestones и KPI\n3. Зависимости между разделами\n4. Ресурсные потребности\n\nФормат: markdown с таблицей этапов и timeline." |
| 2 | `block-decompose` | Decompose Block | Декомпозировать | planner | prompt | "Декомпозируй блок «{{entityTitle}}» на разделы и задачи.\n\nДанные блока:\n{{entityData}}\n\nДля каждого раздела:\n- Название и описание\n- 3-5 конкретных задач\n- Оценка трудозатрат (в часах)\n- Приоритет (critical/high/medium/low)\n\nФормат: markdown с вложенными списками." |
| 3 | `block-risks` | Assess Block Risks | Оценить риски | analyst | prompt | "Проведи анализ рисков блока «{{entityTitle}}».\n\nДанные блока:\n{{entityData}}\n\nОпредели 5-7 рисков. Для каждого:\n- Описание риска\n- Вероятность (высокая/средняя/низкая)\n- Влияние (критическое/значительное/умеренное)\n- Стратегия митигации\n- Ответственный (роль)\n\nФормат: markdown-таблица рисков + матрица вероятность×влияние." |
| 4 | `block-report` | Block Report | Отчёт по блоку | writer | prompt | "Сформируй отчёт по блоку «{{entityTitle}}».\n\nДанные блока:\n{{entityData}}\n\nСтруктура отчёта:\n1. Резюме (2-3 предложения)\n2. Текущий прогресс (%, ключевые показатели)\n3. Достижения за период\n4. Проблемы и блокеры\n5. Следующие шаги\n6. Рекомендации\n\nФормат: профессиональный markdown-отчёт." |

**Для разделов (section):**

| # | slug | name | nameRu | agentId → | handlerType | handlerConfig.prompt |
|---|---|---|---|---|---|---|
| 5 | `section-tasks` | Generate Tasks | Создать задачи | planner | prompt | "Предложи задачи для раздела «{{entityTitle}}».\n\nДанные раздела:\n{{entityData}}\n\nДля каждой задачи (5-8 штук):\n- Название\n- Описание (2-3 предложения)\n- Приоритет (critical/high/medium/low)\n- Оценка времени\n- Подзадачи (если нужны)\n\nФормат: нумерованный список с подпунктами." |
| 6 | `section-plan` | Section Work Plan | План работ | planner | prompt | "Создай план работ для раздела «{{entityTitle}}».\n\nДанные раздела:\n{{entityData}}\n\nПлан должен включать:\n1. Последовательность выполнения задач\n2. Зависимости между задачами (что за чем)\n3. Критический путь\n4. Оценку сроков для каждого этапа\n5. Промежуточные контрольные точки\n\nФормат: markdown с диаграммой последовательности." |
| 7 | `section-evaluate` | Evaluate Tasks | Оценить задачи | analyst | prompt | "Оцени все задачи раздела «{{entityTitle}}».\n\nДанные раздела:\n{{entityData}}\n\nДля каждой задачи оцени:\n- Сложность (1-10)\n- Примерные сроки (часы/дни)\n- Необходимые навыки/ресурсы\n- Текущий статус и прогресс\n- Рекомендации по оптимизации\n\nФормат: markdown-таблица." |
| 8 | `section-deps` | Find Dependencies | Найти зависимости | analyst | prompt | "Определи зависимости в разделе «{{entityTitle}}».\n\nДанные раздела:\n{{entityData}}\n\nДля каждой зависимости:\n- Задача A → Задача B (A блокирует B)\n- Тип зависимости (техническая/данные/процесс)\n- Критичность (высокая/средняя/низкая)\n- Рекомендации по устранению блокеров\n\nФормат: список связей + граф зависимостей в текстовом формате." |

**Для задач (task):**

| # | slug | name | nameRu | agentId → | handlerType | handlerConfig.prompt |
|---|---|---|---|---|---|---|
| 9 | `task-discuss` | Discuss Task | Обсудить | facilitator | prompt | "Давай обсудим задачу «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nПредложи:\n1. 3-5 ключевых вопросов для обсуждения\n2. Возможные подходы к решению\n3. Потенциальные проблемы и как их избежать\n4. Критерии успешного завершения\n\nТон: конструктивный, задавай наводящие вопросы." |
| 10 | `task-research` | Research Task | Проработать | researcher | prompt | "Проведи глубокий анализ задачи «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nИсследуй:\n1. Ключевые аспекты и требования\n2. Лучшие практики и рекомендации\n3. Возможные технические подходы\n4. Примеры аналогичных решений\n5. Необходимые ресурсы и инструменты\n\nФормат: аналитический markdown с разделами." |
| 11 | `task-document` | Create Document | Создать документ | writer | prompt | "Создай структурированный документ по задаче «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nСтруктура документа:\n1. Цель и описание\n2. Требования (функциональные и нефункциональные)\n3. Критерии приёмки\n4. Сроки и этапы\n5. Ответственные и заинтересованные стороны\n6. Риски и зависимости\n\nФормат: профессиональный markdown-документ." |
| 12 | `task-table` | Create Table | Составить таблицу | writer | prompt | "Составь таблицу для задачи «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nТаблица должна включать:\n- Ключевые параметры и метрики\n- Ответственные за каждый пункт\n- Сроки выполнения\n- Статусы и индикаторы\n- KPI/показатели успеха\n\nФормат: markdown-таблица с колонками." |
| 13 | `task-actionplan` | Action Plan | План действий | planner | prompt | "Напиши пошаговый план действий для задачи «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nДля каждого шага:\n1. Конкретное действие\n2. Ответственный (роль)\n3. Срок выполнения\n4. Ожидаемый результат\n5. Зависимости от других шагов\n\nФормат: нумерованный список с подпунктами." |
| 14 | `task-presentation` | Prepare Presentation | Подготовить презентацию | writer | prompt | "Подготовь структуру презентации по задаче «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nДля каждого слайда (8-12 штук):\n- Заголовок слайда\n- 3-4 ключевых тезиса\n- Рекомендуемый визуальный элемент (график, диаграмма, таблица, иконки)\n- Заметки для выступающего\n\nФормат: markdown с разделами по слайдам." |
| 15 | `task-subtasks` | Generate Subtasks | Подзадачи | planner | prompt | "Разбей задачу «{{entityTitle}}» на подзадачи.\n\nДанные задачи:\n{{entityData}}\n\nДля каждой подзадачи (3-7 штук):\n- Название (краткое, конкретное)\n- Описание (1-2 предложения)\n- Оценка времени (часы)\n- Приоритет (high/medium/low)\n- Зависимости от других подзадач\n\nФормат: JSON-массив для автоматического создания." |
| 16 | `task-risks` | Task Risks | Риски задачи | analyst | prompt | "Определи риски задачи «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nКатегории рисков:\n1. Технические (сложность, неизвестность)\n2. Организационные (ресурсы, зависимости)\n3. Внешние (изменение требований, сторонние сервисы)\n\nДля каждого: описание, вероятность, влияние, стратегия митигации.\n\nФормат: markdown-таблица рисков." |
| 17 | `task-estimate` | Estimate Task | Оценить задачу | analyst | prompt | "Оцени задачу «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nОцени:\n- Сложность (1-10) с обоснованием\n- Примерное время выполнения (оптимистичное / реалистичное / пессимистичное)\n- Необходимые навыки и компетенции\n- Возможные блокеры\n- Story points (по Fibonacci: 1,2,3,5,8,13,21)\n\nФормат: структурированный markdown." |
| 18 | `task-spec` | Write Specification | Техническое задание | writer | prompt | "Напиши техническое задание для задачи «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nСтруктура ТЗ:\n1. Общие сведения (цель, заказчик)\n2. Описание задачи\n3. Функциональные требования\n4. Нефункциональные требования\n5. Ограничения и допущения\n6. Критерии приёмки\n7. Сроки и этапы\n\nФормат: формальный markdown-документ." |
| 19 | `task-howto` | How To Execute | Как выполнить | researcher | prompt | "Объясни, как лучше выполнить задачу «{{entityTitle}}».\n\nДанные задачи:\n{{entityData}}\n\nВключи:\n1. Подготовительные шаги\n2. Пошаговую инструкцию\n3. Лучшие практики\n4. Частые ошибки и как их избежать\n5. Полезные инструменты/ресурсы\n6. Чек-лист завершения\n\nФормат: markdown с нумерованными шагами." |

**Скиллы outputSchema (для структурированных ответов):**

Для `task-subtasks` задать `outputSchema`:
```json
{
  "type": "object",
  "properties": {
    "subtasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "estimatedHours": { "type": "number" },
          "priority": { "type": "string", "enum": ["high", "medium", "low"] }
        },
        "required": ["title"]
      }
    }
  },
  "required": ["subtasks"]
}
```

Для `section-tasks` задать аналогичный `outputSchema` для автоматического создания задач.

---

### ЧАСТЬ 5: WORKFLOW — ПОЛНЫЙ РАБОЧИЙ ПРОЦЕСС

#### 5.1 Общая архитектура вызова

```
┌────────────────────────────────────────────────────────────────────┐
│ КЛИЕНТ (React)                                                      │
│                                                                      │
│  ┌─────────────────┐    ┌────────────────┐    ┌──────────────────┐ │
│  │ QuickActionsBar  │    │ EntityAIChat   │    │ FloatingAIChat   │ │
│  │ (кнопки)         │    │ (quick prompts)│    │ (глобальный)     │ │
│  └────────┬─────────┘    └───────┬────────┘    └────────┬─────────┘ │
│           │                       │                       │          │
│           v                       v                       v          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │             Unified AI Request Layer                            │ │
│  │  - Определяет skillSlug по действию                             │ │
│  │  - Подставляет model из ModelSelector (localStorage)            │ │
│  │  - Вызывает skillExecution.execute или /api/ai/skill-stream    │ │
│  └────────────────────────────────┬───────────────────────────────┘ │
└───────────────────────────────────┼────────────────────────────────┘
                                    │
                                    v
┌────────────────────────────────────────────────────────────────────┐
│ СЕРВЕР (Express + tRPC)                                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ skillExecution.execute / /api/ai/skill-stream               │   │
│  └──────────┬──────────────────────────────────────────────────┘   │
│             │                                                        │
│             v                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ SkillEngine.execute(skillSlug, context)                       │  │
│  │                                                                │  │
│  │  1. Найти скилл по slug в ai_skills                           │  │
│  │  2. Загрузить привязанного агента из ai_agents                │  │
│  │  3. Определить модель:                                         │  │
│  │     context.model → agent.modelPreference →                    │  │
│  │     ai_model_task_assignments → DEFAULT_MODEL                  │  │
│  │  4. Выполнить по handlerType:                                  │  │
│  │     prompt → invokeLLM(model, systemPrompt, skillPrompt)      │  │
│  │     function → REGISTERED_FUNCTIONS[name](ctx)                 │  │
│  │     mcp → MCP Client → mcpServer.endpoint                     │  │
│  │     webhook → fetch(webhookUrl, ctx)                           │  │
│  │  5. Залогировать в ai_request_logs                             │  │
│  │  6. Обновить статистику скилла и агента                        │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                        │
│             v                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ invokeLLM(params) / streamLLM(params)                         │  │
│  │   model: params.model || DEFAULT_MODEL                        │  │
│  │   → OpenRouter / Direct API                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

#### 5.2 Сценарии использования (Use Cases)

##### Сценарий 1: Пользователь нажимает "Создать roadmap" в BlockDetailPanel

```
1. [UI] Пользователь открывает карточку блока → видит QuickActionsBar
2. [UI] Нажимает кнопку "Создать roadmap" (action.id = "block-roadmap")
3. [UI] QuickActionsBar вместо processCommand вызывает:
   trpc.skillExecution.execute({
     skillSlug: "block-roadmap",
     projectId: currentProjectId,
     entityType: "block",
     entityId: block.id,
     model: localStorage.getItem('selectedAIModel') || undefined,
   })
4. [SERVER] skillExecutionRouter.execute():
   - Загружает данные блока (title, description, sections, tasks, progress)
   - Вызывает SkillEngine.execute("block-roadmap", context)
5. [ENGINE] SkillEngine:
   a. Находит скилл "block-roadmap" в ai_skills (handlerType: "prompt")
   b. Находит агента "planner" (agent.id = skill.agentId)
   c. Определяет модель:
      - Пользователь выбрал "anthropic/claude-3.5-sonnet" → используем
      - Иначе: agent.modelPreference → ai_model_task_assignments → DEFAULT_MODEL
   d. Подставляет шаблон: {{entityTitle}} → "Research & Analysis", {{entityData}} → JSON
   e. Вызывает invokeLLM({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: planner.systemPrompt },
          { role: "user", content: skillPrompt },
        ]
      })
   f. Получает ответ, логирует, обновляет статистику
6. [UI] Показывает результат в Dialog (как сейчас) + дополнительные действия:
   - "Копировать"
   - "Вставить в заметки"
   - "Создать разделы" (если скилл вернул structuredData с разделами)
```

##### Сценарий 2: Quick Prompt "📄 Создать документ" в EntityAIChat задачи

```
1. [UI] Пользователь открывает TaskDetailPanel → разворачивает EntityAIChat
2. [UI] Чат пуст → показаны quick prompts → нажимает "📄 Создать документ"
3. [UI] ВМЕСТО отправки текста в обычный /api/ai/stream:
   - Определяем skillSlug = "task-document"
   - Вызываем POST /api/ai/skill-stream {
       skillSlug: "task-document",
       projectId, entityType: "task", entityId: task.id,
       model: localStorage.getItem('selectedAIModel'),
     }
4. [SERVER] /api/ai/skill-stream endpoint:
   - Загружает скилл, агента, модель (как в SkillEngine)
   - Вызывает streamLLM({ model, messages: [...] })
   - Проксирует SSE ответ клиенту
5. [UI] Показывает стриминговый ответ в EntityAIChat (как сейчас)
   + дополнительная кнопка "Как документ" (onSaveAsDocument) → сохраняет как summary задачи
```

##### Сценарий 3: Оркестратор маршрутизирует свободный текст

```
1. [UI] Пользователь вводит в EntityAIChat: "Какие риски у этой задачи?"
2. [UI] Отправляет через /api/ai/stream (обычный чат)
3. [SERVER] /api/ai/stream получает message
4. [SERVER] НОВАЯ ЛОГИКА — Orchestrator middleware:
   a. Загружает orchestratorConfig
   b. Проверяет enableAgentRouting: true
   c. Перебирает агентов по triggerPatterns:
      - "analyst" → triggerPatterns: ["риск"] → MATCH!
   d. Использует analyst.systemPrompt и analyst.modelPreference
   e. Вызывает streamLLM({ model: analyst.modelPreference, messages: [...] })
5. [SERVER] Если enableSkillMatching: true
   a. Дополнительно ищет подходящий скилл по triggerPatterns
   b. Если найден — использует его промпт-шаблон вместо generic
6. [UI] Получает ответ, показывает в чате
   + Badge: "Агент: Аналитик 🔍" — показывает какой агент ответил
```

##### Сценарий 4: Function-скилл — автоматическое создание подзадач

```
1. [UI] Пользователь нажимает "⚡ Подзадачи" в QuickActionsBar задачи
2. [UI] Вызывает skillExecution.execute({ skillSlug: "task-subtasks", ... })
3. [ENGINE] SkillEngine:
   - Скилл "task-subtasks" с outputSchema (JSON)
   - Выполняет prompt с response_format: json_schema
   - Получает structuredData: { subtasks: [{title, description, estimatedHours, priority}] }
4. [UI] Показывает результат в СПЕЦИАЛЬНОМ Dialog:
   ┌────────────────────────────────────────────────────┐
   │ ⚡ Подзадачи                                       │
   │                                                     │
   │ AI предложил 5 подзадач:                           │
   │                                                     │
   │ ☑ Исследовать требования (2ч, high)               │
   │ ☑ Написать спецификацию (3ч, medium)              │
   │ ☐ Подготовить тестовые данные (1ч, low)           │
   │ ☑ Реализовать прототип (4ч, high)                 │
   │ ☑ Провести ревью (1ч, medium)                     │
   │                                                     │
   │ [Создать выбранные (4)]  [Копировать]  [Закрыть]  │
   └────────────────────────────────────────────────────┘
5. [UI] Пользователь нажимает "Создать выбранные" →
   вызывает mutation для создания subtasks в БД
```

##### Сценарий 5: MCP-скилл — интеграция с внешним инструментом

```
1. [ADMIN] Администратор добавляет MCP-сервер:
   - name: "Jira Integration"
   - endpoint: "https://mcp.example.com/jira"
   - tools: [{ name: "create_issue", ... }, { name: "get_issues", ... }]

2. [ADMIN] Создаёт скилл:
   - slug: "task-export-jira"
   - handlerType: "mcp"
   - handlerConfig: { mcpServerId: 1, mcpToolName: "create_issue" }

3. [UI] Кнопка "Экспорт в Jira" появляется в QuickActionsBar задачи
4. [ENGINE] SkillEngine.executeMCPSkill():
   - Загружает MCP-сервер конфигурацию
   - Отправляет JSON-RPC запрос к MCP-серверу
   - Получает результат
5. [UI] Показывает результат: "Задача создана в Jira: PROJ-123"
```

##### Сценарий 6: Webhook-скилл — вызов внешнего API

```
1. [ADMIN] Создаёт скилл:
   - slug: "task-estimate-external"
   - handlerType: "webhook"
   - handlerConfig: { webhookUrl: "https://api.estimator.io/estimate", webhookMethod: "POST" }

2. [UI] Кнопка "Внешняя оценка" в QuickActionsBar
3. [ENGINE] SkillEngine.executeWebhookSkill():
   - Отправляет POST с контекстом задачи на webhookUrl
   - Получает результат
4. [UI] Показывает результат внешней оценки
```

#### 5.3 Маршрутизация: кто какой агент когда используется

```
┌──────────────────────────────────────────────────────────────────┐
│ МАРШРУТИЗАЦИЯ ЗАПРОСОВ К АГЕНТАМ                                  │
│                                                                    │
│ ПРИОРИТЕТ МАРШРУТИЗАЦИИ (сверху вниз):                            │
│                                                                    │
│ 1. Явный скилл (slug из QuickActionsBar)                          │
│    → skill.agentId → конкретный агент                              │
│                                                                    │
│ 2. OrchestratorConfig.routingRules (admin-defined)                │
│    → condition: { type: "pattern", value: "regex" }               │
│    → targetAgentId → конкретный агент                              │
│                                                                    │
│ 3. Agent triggerPatterns (regex match на message)                  │
│    → первый совпавший агент с наивысшим priority                   │
│                                                                    │
│ 4. Skill triggerPatterns (regex match на message)                  │
│    → skill.agentId → агент из скилла                               │
│                                                                    │
│ 5. Fallback: agent.type === "general"                             │
│    → или orchestratorConfig.fallbackAgentId                        │
│    → или DEFAULT_MODEL без агента                                  │
│                                                                    │
│ МАРШРУТИЗАЦИЯ ВЫБОРА МОДЕЛИ (сверху вниз):                        │
│                                                                    │
│ 1. context.model (ручной выбор через ModelSelector)               │
│ 2. agent.modelPreference (если агент задан)                       │
│ 3. ai_model_task_assignments (авто-рейтинг для категории)         │
│ 4. agent.fallbackModel (если есть)                                 │
│ 5. orchestratorConfig.fallbackModel                                │
│ 6. DEFAULT_MODEL (из ENV)                                          │
└──────────────────────────────────────────────────────────────────┘
```

#### 5.4 Таблица: кнопка → скилл → агент → модель

| Кнопка (UI) | skillSlug | agentId → type | Рекомендуемая категория рейтинга |
|---|---|---|---|
| Создать roadmap | `block-roadmap` | planner → planning | ratingPlanning |
| Декомпозировать | `block-decompose` | planner → planning | ratingPlanning |
| Оценить риски (block) | `block-risks` | analyst → analysis | ratingRiskAnalysis |
| Отчёт | `block-report` | writer → writing | ratingDocumentation |
| Создать задачи | `section-tasks` | planner → planning | ratingPlanning |
| Сгенерировать план | `section-plan` | planner → planning | ratingPlanning |
| Оценить задачи | `section-evaluate` | analyst → analysis | ratingDataAnalysis |
| Найти зависимости | `section-deps` | analyst → analysis | ratingReasoning |
| 💬 Обсудить | `task-discuss` | facilitator → general | ratingChat |
| 🔍 Проработать | `task-research` | researcher → research | ratingReasoning |
| 📄 Создать документ | `task-document` | writer → writing | ratingDocumentation |
| 📊 Составить таблицу | `task-table` | writer → writing | ratingDocumentation |
| 📋 План действий | `task-actionplan` | planner → planning | ratingPlanning |
| 📑 Презентация | `task-presentation` | writer → writing | ratingCreative |
| ⚡ Подзадачи | `task-subtasks` | planner → planning | ratingPlanning |
| ⚠️ Риски (task) | `task-risks` | analyst → analysis | ratingRiskAnalysis |
| Оценить (task) | `task-estimate` | analyst → analysis | ratingDataAnalysis |
| ТЗ | `task-spec` | writer → writing | ratingDocumentation |
| Как выполнить | `task-howto` | researcher → research | ratingReasoning |

---

### ЧАСТЬ 6: ИЗМЕНЕНИЯ В КЛИЕНТСКИХ КОМПОНЕНТАХ

#### 6.1 `QuickActionsBar.tsx` — перевод на скиллы

**Текущий:** вызывает `trpc.aiEnhancements.processCommand.useMutation()`

**Новый:** вызывает `trpc.skillExecution.execute.useMutation()` или показывает стриминг

```typescript
// Маппинг action.id → skillSlug
const ACTION_TO_SKILL: Record<string, string> = {
  'block-roadmap': 'block-roadmap',
  'block-decompose': 'block-decompose',
  'block-risks': 'block-risks',
  'block-report': 'block-report',
  'section-tasks': 'section-tasks',
  'section-plan': 'section-plan',
  'section-evaluate': 'section-evaluate',
  'section-deps': 'section-deps',
  'task-subtasks': 'task-subtasks',
  'task-estimate': 'task-estimate',
  'task-risks': 'task-risks',
  'task-spec': 'task-spec',
  'task-howto': 'task-howto',
};

const handleAction = (action: QuickAction) => {
  const skillSlug = ACTION_TO_SKILL[action.id];
  const selectedModel = localStorage.getItem('selectedAIModel') || undefined;

  executeSkill.mutate({
    skillSlug,
    projectId,
    entityType,
    entityId,
    model: selectedModel,
  });
};
```

**Новый Dialog для структурированных результатов:**
- Если результат содержит `structuredData` (например, подзадачи) — показать чекбоксы + кнопку "Создать"
- Если результат содержит разделы/задачи — показать кнопку "Создать в проекте"
- Всегда показывать: "Копировать", "Вставить в заметки", "Закрыть"

**Индикатор агента:**
```typescript
// В Dialog результата показывать:
{result.agentId && (
  <Badge variant="outline" className="text-xs border-slate-600">
    🤖 Агент: {result.agentName}
  </Badge>
)}
{result.model && (
  <Badge variant="outline" className="text-xs border-slate-600">
    Модель: {result.model}
  </Badge>
)}
```

#### 6.2 `EntityAIChat.tsx` — интеграция quick prompts со скиллами

**Текущий:** quick prompts отправляют текст в обычный чат

**Новый:** quick prompts определяют, есть ли подходящий скилл:

```typescript
const PROMPT_TO_SKILL: Record<string, string> = {
  // Block prompts
  'Создать roadmap': 'block-roadmap',
  'Декомпозировать': 'block-decompose',
  'Оценить риски': 'block-risks',
  'Сформировать отчёт': 'block-report',
  // Section prompts
  'Создать задачи': 'section-tasks',
  'Составить план': 'section-plan',
  'Оценить раздел': 'section-evaluate',
  'Найти зависимости': 'section-deps',
  // Task prompts
  '💬 Обсудить': 'task-discuss',
  '🔍 Проработать': 'task-research',
  '📄 Создать документ': 'task-document',
  '📊 Составить таблицу': 'task-table',
  '📋 План действий': 'task-actionplan',
  '📑 Подготовить презентацию': 'task-presentation',
  '⚡ Подзадачи': 'task-subtasks',
  '⚠️ Риски': 'task-risks',
};

const handleQuickPrompt = async (label: string, prompt: string) => {
  const skillSlug = PROMPT_TO_SKILL[label];

  if (skillSlug) {
    // Стриминговый вызов через скилл
    // Добавляем сообщение пользователя + стримим ответ через /api/ai/skill-stream
    await sendSkillStream(skillSlug, { entityType, entityId, projectId });
  } else {
    // Fallback: обычная отправка текста в чат
    setMessage(prompt);
    handleSend();
  }
};
```

#### 6.3 Передача выбранной модели из ModelSelector

**Текущий:** ModelSelector сохраняет в localStorage, но нигде не используется на бэкенде.

**Новый:**
1. `EntityAIChat.handleSend()` — читать из localStorage и добавлять в body:
```typescript
const response = await fetch('/api/ai/stream', {
  body: JSON.stringify({
    messages: messages_payload,
    taskType: 'chat',
    projectContext,
    model: localStorage.getItem('selectedAIModel') || undefined,  // ← ДОБАВИТЬ
  }),
});
```

2. `/api/ai/stream` endpoint — читать `model` из body и передавать в `streamLLM()`:
```typescript
const { messages, taskType, projectContext, model } = req.body;
const stream = await streamLLM({
  model,  // ← ДОБАВИТЬ
  messages: [...],
});
```

#### 6.4 Показ информации об агенте в чате

В EntityAIChat после каждого ответа AI показывать метаданные:

```typescript
{/* После Streamdown в ответе assistant */}
{msg.metadata?.agentName && (
  <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
    <span>🤖 {msg.metadata.agentName}</span>
    <span>· {msg.metadata.model}</span>
    <span>· {msg.metadata.responseTimeMs}ms</span>
  </div>
)}
```

---

### ЧАСТЬ 7: СЕРВЕРНЫЕ ИЗМЕНЕНИЯ

#### 7.1 Новый Express endpoint — `/api/ai/skill-stream`

```typescript
// server/_core/index.ts — рядом с существующим /api/ai/stream

app.post('/api/ai/skill-stream', async (req, res) => {
  const { skillSlug, projectId, entityType, entityId, model, additionalContext } = req.body;
  const userId = req.user?.id;

  // 1. Загрузить данные сущности
  const entityData = await loadEntityData(entityType, entityId);

  // 2. Найти скилл и агент
  const skill = await findSkill(skillSlug);
  const agent = skill.agentId ? await findAgent(skill.agentId) : null;

  // 3. Определить модель
  const resolvedModel = model || agent?.modelPreference || DEFAULT_MODEL;

  // 4. Построить промпт
  const systemPrompt = agent?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const skillPrompt = buildPromptFromTemplate(skill.handlerConfig?.prompt, entityData);

  // 5. SSE стриминг
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const stream = await streamLLM({
    model: resolvedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(additionalContext ? [{ role: 'user', content: `Контекст: ${additionalContext}` }] : []),
      { role: 'user', content: skillPrompt },
    ],
  });

  // Проксировать поток клиенту + отправить metadata в конце
  // ...

  // В конце: data: {"type":"done","metadata":{"agentName":"...","model":"...","skillSlug":"..."}}
});
```

#### 7.2 Модифицировать `/api/ai/stream` — добавить оркестрацию

В существующем `/api/ai/stream` endpoint добавить слой оркестрации:

```typescript
app.post('/api/ai/stream', async (req, res) => {
  const { messages, taskType, projectContext, model } = req.body;

  // НОВАЯ ЛОГИКА: определить агента по содержимому
  let resolvedModel = model;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let agentName = null;

  if (!model) {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const matchedAgent = await findMatchingAgent(lastMessage);

    if (matchedAgent) {
      resolvedModel = matchedAgent.modelPreference || undefined;
      systemPrompt = matchedAgent.systemPrompt || systemPrompt;
      agentName = matchedAgent.nameRu || matchedAgent.name;
    }
  }

  const stream = await streamLLM({
    model: resolvedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(projectContext ? [{ role: 'user', content: `Контекст: ${projectContext}` }] : []),
      ...messages,
    ],
  });

  // Стриминг + в конце metadata
});
```

#### 7.3 Seed script — `server/seeds/seedAgentsAndSkills.ts`

```typescript
export async function seedAgentsAndSkills() {
  const db = await getDb();
  if (!db) return;

  // Seed agents (6 штук, isSystem: true)
  const agents = [ /* все 6 агентов из таблицы 4.1 */ ];

  for (const agent of agents) {
    const existing = await db.select().from(aiAgents)
      .where(eq(aiAgents.slug, agent.slug));
    if (existing.length === 0) {
      await db.insert(aiAgents).values({ ...agent, isSystem: true, isActive: true });
    }
  }

  // Seed skills (19 штук, isSystem: true)
  const skills = [ /* все 19 скиллов из таблицы 4.2 */ ];

  for (const skill of skills) {
    // Найти agentId по slug
    const [agent] = await db.select().from(aiAgents)
      .where(eq(aiAgents.slug, skill.agentSlug));

    const existing = await db.select().from(aiSkills)
      .where(eq(aiSkills.slug, skill.slug));
    if (existing.length === 0) {
      await db.insert(aiSkills).values({
        ...skill,
        agentId: agent?.id,
        isSystem: true,
        isActive: true,
      });
    }
  }

  // Seed model ratings (если таблица создана)
  // ...
}
```

#### 7.4 Автоматический recalc рейтингов из логов

Scheduled job или admin-triggered:

```typescript
export async function recalculateModelRatings() {
  const db = await getDb();
  if (!db) return;

  // Для каждой модели в ai_request_logs за последние 30 дней:
  // - avgResponseTimeMs
  // - successRate (success / total * 100)
  // - totalRequests
  // - avgTokensPerRequest

  // Обновить speedRating (инверсия от avgResponseTimeMs, нормализация 0-100)
  // Обновить costEfficiency (инверсия от cost per request)

  // Обновить ai_model_task_assignments:
  // Для каждой taskCategory — выбрать модель с наивысшим рейтингом в соответствующей категории
  // НЕ перезаписывать isManualOverride: true
}
```

---

### ЧАСТЬ 8: АДМИН-ПАНЕЛИ ОБНОВЛЕНИЯ

#### 8.1 Новая страница `AdminModelRatings.tsx` (описано в 2.3)

#### 8.2 Обновление `AdminAgents.tsx`

Добавить:
- Поле `modelPreference` с `<ModelSelector>` (dropdown из modelPricing)
- Показ статистики агента: totalRequests, avgResponseTime, successRate
- Тестирование агента: ввести промпт → увидеть ответ с метаданными (модель, время, токены)
- Привязка скиллов: список скиллов, назначенных этому агенту (из ai_skills.agentId)

#### 8.3 Обновление `AdminSkills.tsx`

Добавить:
- Шаблонные переменные: подсказка с доступными `{{entityTitle}}`, `{{entityData}}`, `{{entityType}}`, etc.
- Тестирование скилла: выбрать сущность из проекта → запустить → увидеть результат
- Preview промпта: показать промпт с подставленными данными тестовой сущности
- outputSchema editor: визуальный JSON schema builder или текстовый JSON editor

#### 8.4 Навигация в `AdminNavbar.tsx`

Добавить пункт меню:
```
🏆 Рейтинги моделей → /admin/model-ratings
```

---

### ЧАСТЬ 9: МИГРАЦИЯ БАЗЫ ДАННЫХ

```sql
-- 1. Новая таблица рейтингов моделей
CREATE TABLE ai_model_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  modelName VARCHAR(128) NOT NULL UNIQUE,
  provider VARCHAR(64) NOT NULL,
  ratingReasoning INT DEFAULT 50,
  ratingCoding INT DEFAULT 50,
  ratingCreative INT DEFAULT 50,
  ratingTranslation INT DEFAULT 50,
  ratingSummarization INT DEFAULT 50,
  ratingPlanning INT DEFAULT 50,
  ratingRiskAnalysis INT DEFAULT 50,
  ratingDataAnalysis INT DEFAULT 50,
  ratingDocumentation INT DEFAULT 50,
  ratingChat INT DEFAULT 50,
  overallRating INT DEFAULT 50,
  speedRating INT DEFAULT 50,
  costEfficiency INT DEFAULT 50,
  avgResponseTimeMs INT DEFAULT 0,
  avgTokensPerRequest INT DEFAULT 0,
  successRate INT DEFAULT 100,
  totalRequests INT DEFAULT 0,
  ratingSource ENUM('manual', 'benchmark', 'user_feedback', 'auto') DEFAULT 'manual',
  lastBenchmarkAt TIMESTAMP NULL,
  modelPricingId INT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);

-- 2. Новая таблица назначений модель→задача
CREATE TABLE ai_model_task_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  taskCategory VARCHAR(64) NOT NULL,
  entityType ENUM('project', 'block', 'section', 'task', 'any') DEFAULT 'any',
  primaryModelName VARCHAR(128) NOT NULL,
  fallbackModelName VARCHAR(128) NULL,
  agentId INT NULL,
  skillId INT NULL,
  selectionReason VARCHAR(255),
  isManualOverride BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY (taskCategory, entityType)
);
```

---

### ЧАСТЬ 10: ПОРЯДОК РЕАЛИЗАЦИИ

#### Этап 1: Исправление критических багов (базовые)
1. Добавить `model?: string` в `InvokeParams` и `StreamParams`
2. Использовать `params.model || DEFAULT_MODEL` в `invokeLLM` и `streamLLM`
3. Передавать model из оркестратора в `invokeLLM`
4. Передавать model из `/api/ai/stream` body в `streamLLM`

#### Этап 2: Таблицы и seed данные
1. Создать миграцию: `ai_model_ratings` + `ai_model_task_assignments`
2. Добавить таблицы в `drizzle/schema.ts`
3. Написать seed-скрипт: 6 агентов + 19 скиллов
4. Запустить seed при старте приложения (или через admin endpoint)

#### Этап 3: SkillEngine
1. Реализовать `server/utils/skillEngine.ts`
2. Реализовать prompt execution (с шаблонизацией)
3. Реализовать model resolution chain
4. Добавить `skillExecutionRouter.ts` (tRPC)
5. Добавить `/api/ai/skill-stream` (Express endpoint для стриминга)

#### Этап 4: Клиентские компоненты
1. Обновить `QuickActionsBar.tsx` — вызов скиллов вместо processCommand
2. Обновить `EntityAIChat.tsx` — quick prompts через скиллы
3. Показ метаданных агента/модели в UI
4. Dialog для структурированных результатов (подзадачи, задачи)

#### Этап 5: Рейтинги и автоматический выбор модели
1. `AdminModelRatings.tsx` — страница рейтингов
2. tRPC роутер `adminModelRatings`
3. Автозаполнение метрик из логов
4. Авто-назначение моделей на категории задач
5. Benchmark функция

#### Этап 6: Оркестрация свободного текста
1. Добавить агентскую маршрутизацию в `/api/ai/stream`
2. Skill matching для свободного текста
3. Показ информации об агенте в чате

#### Этап 7: MCP и webhook (отложено)
1. MCP Client протокол
2. Webhook executor с retry и error handling
3. Function registry для встроенных function-скиллов

---

### ЧАСТЬ 11: ИМПОРТ КОНТЕКСТА ИЗ ВНЕШНИХ AI (Claude, ChatGPT, и др.)

#### 11.1 Проблема

Пользователь часто работает параллельно в нескольких AI-инструментах:
- Обсудил идею в **Claude** → хочет вставить результат в задачу проекта
- Проработал план в **ChatGPT** → хочет продолжить работу в MYDON с этим контекстом
- Получил анализ от **GPT** → хочет вставить в описание блока или раздела
- Скопировал код/текст из AI → хочет прикрепить как контекст к обсуждению

Сейчас **нет удобного способа** перенести контекст из внешнего AI в MYDON. Пользователю приходится вручную копировать текст и вставлять в заметки или описание — контекст теряется, нет связи с AI-чатом.

#### 11.2 Решение — 3 способа импорта

##### Способ 1: Быстрая вставка в AI-чат (Paste Context)

**Где:** `EntityAIChat.tsx` — новая кнопка `📋` рядом с кнопкой прикрепления файлов

**UI:**
```
┌─ AI-ассистент ─────────────────────────────────────────┐
│                                                          │
│  [📋 Вставить контекст]  ← кнопка в пустом чате         │
│  или                                                     │
│  [📎] [📋] [Input.....................] [Send] [🗑]      │
│        ↑ кнопка рядом с Paperclip                        │
└──────────────────────────────────────────────────────────┘
```

**Нажатие на `📋`** открывает Dialog:

```
┌─ Вставить контекст из AI ────────────────────────────────┐
│                                                            │
│ Вставьте текст из Claude, ChatGPT или другого AI:         │
│ ┌──────────────────────────────────────────────────────┐  │
│ │                                                        │  │
│ │  (Textarea, min-h-[200px], placeholder:                │  │
│ │   "Вставьте сюда текст беседы, анализ,                │  │
│ │    план или любой контекст из AI...")                   │  │
│ │                                                        │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                            │
│ Источник (опционально):                                   │
│ [Claude ▾] [ChatGPT] [GPT] [Другое]                      │
│                                                            │
│ Как использовать:                                          │
│ ○ Как контекст для AI-чата (по умолчанию)                 │
│   → Текст станет фоновым контекстом, AI будет его учитывать│
│ ○ Вставить в заметки сущности                              │
│   → Текст добавится в поле заметок                         │
│ ○ Сохранить как документ                                   │
│   → Текст станет итоговым документом / summary              │
│ ○ Добавить как комментарий в обсуждение                    │
│   → Текст появится как комментарий в DiscussionPanel       │
│                                                            │
│ [Отмена]                              [Вставить контекст] │
└────────────────────────────────────────────────────────────┘
```

**Логика каждого варианта:**

1. **Как контекст для AI-чата:**
   - Текст сохраняется в `importedContext` state
   - При следующем запросе в чат, `importedContext` добавляется как system/user context перед сообщением
   - Показывается Badge в чате: `📋 Импортированный контекст (2.3 KB)` с кнопкой `×` для удаления
   - AI учитывает этот контекст при ответах: `"Контекст из внешнего AI:\n${importedContext}"`

2. **В заметки сущности:**
   - Для Task: вызывает `onInsertResult(text)` → записывает в task.notes
   - Для Block/Section: вставляет в description или notes (через mutation)

3. **Как документ:**
   - Для Task: вызывает `onSaveAsDocument(text)` → с проверкой на существующий документ (Replace/Append/Cancel AlertDialog)
   - Для Block/Section: сохраняет как summary

4. **В обсуждение:**
   - Вызывает `trpc.collaboration.addDiscussion({ entityType, entityId, content: text })` с пометкой `[Импорт из ${source}]`

##### Способ 2: Импорт файла беседы (Import Conversation)

**Где:** Новая кнопка в `EntityAIChat` (в Popover прикрепления файлов) или отдельная кнопка

**Поддерживаемые форматы:**
1. **ChatGPT export** (JSON): `conversations.json` — стандартный экспорт из ChatGPT
2. **Claude export** (markdown/text): копия диалога
3. **Plain text/markdown**: любой текст
4. **JSON**: `{ messages: [{ role: "user"|"assistant", content: "..." }] }`

**Логика:**

```typescript
interface ImportedConversation {
  source: 'claude' | 'chatgpt' | 'gpt' | 'other';
  title?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  rawText: string;  // Оригинальный текст, если не удалось распарсить
}

// Парсер для ChatGPT JSON export
function parseChatGPTExport(json: any): ImportedConversation { ... }

// Парсер для markdown-диалога (Claude-style)
function parseMarkdownConversation(text: string): ImportedConversation { ... }

// Парсер для обычного текста
function parsePlainText(text: string): ImportedConversation { ... }
```

**UI после импорта:**
```
┌─ Импорт беседы ─────────────────────────────────────────┐
│                                                           │
│ 📥 Импортировано из ChatGPT: "Анализ рынка 2025"        │
│ 12 сообщений, ~4.2 KB                                    │
│                                                           │
│ ☑ Загрузить в AI-чат как историю                         │
│   → Сообщения появятся в чате как будто были здесь        │
│ ☐ Только как контекст (фоновый)                          │
│   → AI видит всю беседу, но в UI только ваш новый чат    │
│ ☐ Извлечь итог и сохранить как документ                  │
│   → AI сделает саммари импортированной беседы             │
│                                                           │
│ [Отмена]                                     [Импорт]    │
└───────────────────────────────────────────────────────────┘
```

##### Способ 3: Drag & Drop текста в карточку

**Где:** `TaskDetailPanel`, `BlockDetailPanel`, `SectionDetailPanel`

**Механизм:**
1. Пользователь копирует текст из Claude/ChatGPT
2. Перетаскивает (drag) или вставляет (Ctrl+V) в карточку сущности
3. Появляется floating indicator:
```
┌─────────────────────────────────────────────┐
│ 📋 Вставить текст (2.1 KB)                  │
│                                               │
│ [В AI-чат]  [В заметки]  [В обсуждение]  [×] │
└─────────────────────────────────────────────┘
```
4. Пользователь выбирает куда вставить

#### 11.3 Хранение импортированного контекста

**Новое поле в EntityAIChat state:**

```typescript
// В EntityAIChat.tsx
const [importedContext, setImportedContext] = useState<{
  text: string;
  source: 'claude' | 'chatgpt' | 'gpt' | 'other';
  importedAt: Date;
} | null>(null);
```

**При отправке сообщения в AI-чат:**

```typescript
// В handleSend()
let projectContext = '';
// ... existing entity context ...

// Добавить импортированный контекст
if (importedContext) {
  projectContext += `\n\nИмпортированный контекст из ${importedContext.source}:\n${importedContext.text}`;
}

// Добавить контекст из прикреплённых файлов (уже реализовано)
const fileContext = buildFileContext();
if (fileContext) {
  userMsg = `${userMsg}\n\n${fileContext}`;
}
```

**Отображение в UI:**

```typescript
{/* Перед Input area, после attached files */}
{importedContext && (
  <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
    <ClipboardPaste className="w-4 h-4 text-blue-400 shrink-0" />
    <span className="text-xs text-blue-300 truncate">
      Контекст из {importedContext.source} ({(importedContext.text.length / 1024).toFixed(1)} KB)
    </span>
    <Button
      size="icon"
      variant="ghost"
      className="w-5 h-5 text-blue-400 hover:text-red-400 shrink-0"
      onClick={() => setImportedContext(null)}
    >
      <X className="w-3 h-3" />
    </Button>
  </div>
)}
```

#### 11.4 Новый скилл — "Продолжить из AI"

Добавить в seed скиллов:

| slug | name | nameRu | agentId | handlerConfig.prompt |
|---|---|---|---|---|
| `any-continue-from-ai` | Continue from AI | Продолжить из AI | general | "Пользователь импортировал контекст из внешнего AI-инструмента ({{importSource}}).\n\nИмпортированный контекст:\n{{importedContext}}\n\nТекущая сущность: {{entityType}} «{{entityTitle}}»\n{{entityData}}\n\nЗадача: Проанализируй импортированный контекст в привязке к текущей сущности. Определи:\n1. Какие выводы/решения уже сделаны\n2. Что нужно доработать\n3. Какие конкретные действия предпринять в рамках текущего проекта\n4. Предложи следующие шаги\n\nФормат: markdown с разделами." |
| `any-summarize-import` | Summarize Import | Саммари импорта | writer | "Сделай структурированное саммари импортированного контекста из {{importSource}}:\n\n{{importedContext}}\n\nСтруктура саммари:\n1. Ключевые решения и выводы\n2. Открытые вопросы\n3. Следующие шаги\n4. Связь с текущей сущностью: {{entityType}} «{{entityTitle}}»\n\nФормат: краткий markdown, не более 500 слов." |

**Quick prompts в EntityAIChat когда есть importedContext:**

```typescript
// Показывать дополнительные quick prompts когда есть импортированный контекст
const importContextPrompts = importedContext ? [
  { label: '🔄 Продолжить из AI', prompt: 'Продолжи работу на основе импортированного контекста. Что ещё нужно сделать?' },
  { label: '📝 Саммари импорта', prompt: 'Сделай краткое саммари импортированного контекста с ключевыми выводами.' },
  { label: '✅ План действий', prompt: 'На основе импортированного контекста составь конкретный план действий для текущей задачи.' },
] : [];
```

#### 11.5 tRPC endpoint — импорт контекста

```typescript
// В collaborationRouter или новый importRouter

importContext: protectedProcedure
  .input(z.object({
    entityType: z.enum(['project', 'block', 'section', 'task']),
    entityId: z.number(),
    content: z.string().min(1).max(100000), // До 100KB текста
    source: z.enum(['claude', 'chatgpt', 'gpt', 'other']),
    destination: z.enum(['ai_context', 'notes', 'document', 'discussion']),
    title: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    switch (input.destination) {
      case 'notes':
        // Обновить notes сущности
        await updateEntityNotes(input.entityType, input.entityId, input.content);
        break;

      case 'document':
        // Сохранить как summary/document сущности
        await updateEntityDocument(input.entityType, input.entityId, input.content);
        break;

      case 'discussion':
        // Добавить как комментарий в обсуждение
        await db.insert(taskComments).values({
          entityType: input.entityType,
          entityId: input.entityId,
          userId: ctx.user.id,
          content: `📋 *Импорт из ${input.source}${input.title ? `: ${input.title}` : ''}*\n\n${input.content}`,
        });
        break;

      case 'ai_context':
        // Сохранить в ai_chat_history как контекст
        await db.insert(aiChatHistory).values({
          userId: ctx.user.id,
          projectId: null, // Определить из entityType/entityId
          [input.entityType + 'Id']: input.entityId,
          role: 'system',
          content: `[Импорт из ${input.source}] ${input.content}`,
          metadata: { importSource: input.source, importTitle: input.title },
        });
        break;
    }

    return { success: true };
  }),
```

#### 11.6 Keyboard Shortcut

Глобальный хоткей для быстрой вставки:
- **Ctrl+Shift+V** (или **Cmd+Shift+V** на Mac) в открытой карточке сущности → открывает Dialog "Вставить контекст из AI"
- Работает только когда фокус внутри Detail Panel

#### 11.7 Сценарии использования

##### Сценарий A: Пользователь обсудил план в Claude → продолжает в MYDON

```
1. Пользователь работал в Claude: "Помоги спланировать этап Research"
2. Claude дал развёрнутый план с этапами и сроками
3. Пользователь копирует ответ Claude (Ctrl+C)
4. Открывает в MYDON карточку блока "Research & Analysis"
5. Нажимает 📋 в AI-чате → Dialog "Вставить контекст"
6. Вставляет текст, выбирает "Claude", выбирает "Как контекст для AI-чата"
7. [Вставить контекст]
8. В чате появляется Badge: "📋 Контекст из Claude (3.2 KB) ×"
9. Нажимает quick prompt "🔄 Продолжить из AI"
10. AI MYDON анализирует план из Claude в контексте текущего блока:
    "На основе плана из Claude, для блока Research & Analysis предлагаю..."
11. Пользователь продолжает работу в MYDON, AI учитывает весь контекст из Claude
```

##### Сценарий B: Результат ChatGPT → сразу в задачу как документ

```
1. Пользователь получил ТЗ от ChatGPT
2. Копирует → открывает задачу → 📋 → "Сохранить как документ"
3. Текст сохраняется как summary/document задачи
4. AlertDialog если документ уже существует: Replace/Append/Cancel
```

##### Сценарий C: Импорт JSON файла беседы ChatGPT

```
1. Пользователь экспортирует беседу из ChatGPT (Settings → Export)
2. В MYDON открывает блок → AI-чат → 📎 → загружает conversations.json
3. Парсер определяет формат ChatGPT, извлекает сообщения
4. Dialog: "Импортировано 24 сообщения. Загрузить в чат?"
5. Сообщения появляются в EntityAIChat как история
6. Пользователь продолжает беседу уже в MYDON
```

#### 11.8 Лимиты

- Максимальный размер вставляемого текста: **100 KB** (настраивается через админ-панель `attachment_settings.maxImportContextSize_KB`)
- Максимум сообщений при импорте файла беседы: **100 сообщений**
- Импортированный контекст как AI context: отправляется в LLM **только первые N токенов** (настраивается, default 4000 токенов ≈ 16 KB) — остальное обрезается с пометкой `[...контекст обрезан, полный текст: X KB]`
- При повторной вставке — предыдущий импортированный контекст заменяется (не накапливается)

---

### ЧАСТЬ 12: ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Обратная совместимость**: `processCommand` в `aiEnhancementsRouter.ts` НЕ удалять. Он остаётся как fallback для случаев, когда скилл не найден. QuickActionsBar пытается вызвать скилл → если скилл не найден → fallback на processCommand.

2. **Стиль UI**: Все новые компоненты следуют текущему стилю: `bg-slate-800/900`, `border-slate-700`, amber акценты, `text-slate-300/400`. Иконки из lucide-react.

3. **Типизация**: Все новые типы добавлять в `shared/types.ts` или в schema через `$inferSelect`. Zod-валидация на всех tRPC input.

4. **Логирование**: Все вызовы скиллов логируются в `ai_request_logs` с `requestType: "skill"`, `skillId`, `agentId`.

5. **Кредиты**: Каждый вызов скилла расходует кредиты. Стоимость = модель.inputCostPer1K × inputTokens/1000 + модель.outputCostPer1K × outputTokens/1000 (из `model_pricing`).

6. **Rate limiting**: Соблюдать `orchestratorConfig.globalRateLimit` (100 req/min по умолчанию).

7. **processCommand compatibility**: Существующий код `aiEnhancementsRouter.processCommand` (summarize/analyze/suggest/risks) остаётся рабочим. Новые скиллы дополняют, не заменяют. Переход происходит на клиенте: `QuickActionsBar` переключается на `skillExecution.execute`, при ошибке fallback на `processCommand`.
