# ФИНАЛЬНЫЙ ПРОМПТ (v3, полный): Система вложений и расширенных обсуждений для MYDON

---

## КОНТЕКСТ ПРОЕКТА

MYDON — система управления проектами с иерархией **Project → Block (этап) → Section (раздел) → Task (задача)**. Стек: React + TypeScript + tRPC + Drizzle ORM (MySQL) + Tailwind + shadcn/ui + Streamdown (markdown). Тёмная тема: `bg-slate-800/900`, amber акценты, `text-slate-300/400`. Иконки: lucide-react.

---

## ЧТО УЖЕ ЕСТЬ (ТОЧНОЕ СОСТОЯНИЕ)

### 1. Обсуждения — `DiscussionPanel.tsx`

- Поддерживает **4 типа сущностей**: project, block, section, task
- Интерфейс `Comment`: `{ id, content, userId, isSummary?, parentId?, userName?, createdAt, mentions?, reactions?, isEdited? }`
- **Нет поля для вложений** — ни в интерфейсе, ни в мутации
- Текущий вызов мутации: `addDiscussion.mutate({ entityType, entityId, content, parentId })`
- Серверная валидация (collaborationRouter): `{ entityType, entityId, content (1-5000 chars), parentId?, mentions?, isSummary? }`
- Replies через `parentId`, emoji-реакции (6 штук: 👍❤️😊🎉🤔👀), AI-финализация (markdown-саммари из ≥2 сообщений), AI-дистрибуция (автосоздание задач из обсуждения через DistributeDialog)
- Область ввода: `<Avatar> + <Textarea> + <Button Send>` — нет кнопки прикрепления файла
- В `BlockDetailPanel` и `SectionDetailPanel` обсуждение **toggle по кнопке "Обсудить"** (`showDiscussion` state), не встроено постоянно

### 2. AI-чат на сущностях — `EntityAIChat.tsx`

- Поддерживает **3 типа**: `'block' | 'section' | 'task'` (НЕ поддерживает `'project'`)
- Поле ввода — **однострочный `<Input>`**, не Textarea. Layout: `[Input] [Send/Stop] [Trash]`
- Стриминг через SSE `POST /api/ai/stream` с `{ messages, taskType: 'chat', projectContext }`
- В LLM отправляются последние 10 сообщений из истории + текущий запрос
- Персистентная история через `EntityAIChatStore` (LRU: max 30 сущностей, 50 сообщений) + БД через `trpc.chat.history`
- Props: `entityType, entityId, entityTitle, projectId, quickPrompts?, defaultExpanded?, onInsertResult?, onSaveAsDocument?, entityContext?`
- Callbacks на ответы AI: "Копировать", "В заметки" (`onInsertResult`), "Как документ" (`onSaveAsDocument`)
- Нет возможности прикрепить файл ни к запросу, ни к контексту
- Quick prompts по типам:
  - **Block (4)**: Создать roadmap, Декомпозировать, Оценить риски, Сформировать отчёт
  - **Section (4)**: Создать задачи, Составить план, Оценить раздел, Найти зависимости
  - **Task (8)**: 💬 Обсудить, 🔍 Проработать, 📄 Создать документ, 📊 Составить таблицу, 📋 План действий, 📑 Подготовить презентацию, ⚡ Подзадачи, ⚠️ Риски

### 3. Плавающий AI-чат — `FloatingAIChatContent.tsx`

- Глобальный чат, сессии в БД (`aiChatSessions` + `aiChatMessages`)
- Поиск по сессиям, контекст из `useAIContext` hook
- Не-стриминговый (ждёт полный ответ), парсит suggested actions

### 4. Файловое хранилище — `storage.ts`

- Forge API proxy: `storagePut(relKey, data, contentType)` → `{ key, url }`, `storageGet(relKey)` → `{ key, url }`
- Express body limit: 50MB (настроен в `server/_core/index.ts`)
- Уже используется для `uploadTeamPhoto`: base64 → `Buffer.from(imageData, 'base64')` → `storagePut(path, buffer, mimeType)` → `{ url }`
- Путь: `team-photos/{userId}/{timestamp}-{random}.{ext}`
- AWS S3 SDK установлен (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) но не используется

### 5. Google Drive — `googleDrive.ts`

- Экспорт/импорт проектов через rclone, сохранение в JSON, экспорт в Google Docs

### 6. Карточки сущностей (единый скроллируемый вид, БЕЗ табов)

**`TaskDetailPanel.tsx`** — секции сверху вниз внутри `<ScrollArea>`:
1. Header: title + кнопка AI (открывает TaskAIPanel drawer) + кнопка Close
2. Статус (кнопки: not_started / in_progress / completed)
3. Приоритет (PrioritySelector)
4. Дедлайн (Calendar Popover + TaskDeadlineBadge)
5. Зависимости (список + DropdownMenu для добавления + AIDependencySuggestions)
6. AI Quick Actions (QuickActionsBar compact)
7. EntityAIChat (`defaultExpanded={false}`)
8. Кастомные поля (CustomFieldsForm)
9. Описание (read-only, если есть)
10. Заметки (editable Textarea с toggle)
11. Итоговый документ (Streamdown markdown, read-only)
12. Подзадачи (SubtasksSection → SubtasksChecklist)
13. Комментарии (TaskComments)
- \+ TaskAIPanel (Sheet/drawer, отдельная панель)
- \+ AlertDialog для подтверждения перезаписи документа (Replace / Append / Cancel)

**`BlockDetailPanel.tsx`** — секции в `<div className="space-y-5">`:
1. BreadcrumbNav (Project → Block)
2. Block Header (titleRu + title + description + duration + deadline + badge "Блок #N")
3. Progress Card (прогресс %, всего/готово/в работе/просрочено)
4. Action Buttons: "Обсудить" (toggle) + "Добавить раздел"
5. AI Quick Actions (QuickActionsBar compact)
6. EntityAIChat (`defaultExpanded` = true, `onInsertResult` копирует в clipboard)
7. DiscussionPanel (показывается по toggle кнопки "Обсудить")
8. Sections List (expandable карточки секций → задачи внутри)

**`SectionDetailPanel.tsx`** — аналогичная структура:
1. BreadcrumbNav (Project → Block → Section)
2. Section Header
3. Progress Card (+ количество critical/high задач)
4. Action Buttons: "Обсудить" + "Добавить задачу" + "Объединить" + Selection mode
5. AI Quick Actions
6. EntityAIChat
7. DiscussionPanel (toggle)
8. Tasks List (с dropdown-меню: Split/Duplicate/Convert/Delete, bulk selection)

### 7. Создание сущностей — `CreateEntityDialogs.tsx`

- **CreateBlockDialog**: `title` (EN) + `titleRu` (RU) → кнопка "Создать". Минимальный Dialog.
- **CreateSectionDialog**: `title` → кнопка "Создать"
- **CreateTaskDialog**: `title` + `description` (Textarea) → кнопка "Создать"
- Все используют `Dialog/DialogContent` из shadcn, стиль `bg-slate-800 border-slate-700`
- Нет возможности прикрепить файлы ни в одном из диалогов

### 8. БД — таблица `task_comments` (schema.ts:1060-1086)

```
id (int PK), taskId (int null — legacy), entityType (enum: project/block/section/task),
entityId (int), userId (int), content (text), parentId (int null),
mentions (json: number[]), isEdited (bool), isSummary (bool),
createdAt (timestamp), updatedAt (timestamp)
```

Индексы: `tc_entity_idx(entityType, entityId)`, `tc_user_idx(userId)`
FK: userId → users.id CASCADE, taskId → tasks.id CASCADE

**Таблиц `file_attachments`, `attachment_settings` НЕ СУЩЕСТВУЕТ.**

### 9. Админ-панель лимитов — `AdminLimits.tsx`

- Существующие настройки: Global Daily Limit (credits), Max Tokens Per Request, Warning Threshold (%), Block On Limit (toggle), Allow Overage (toggle), Role-Based Limits (per-role sliders)
- UI-паттерн: Card-блоки с иконками, Slider + Number Input, Switch для toggles, кнопки Save/Reset
- API: `trpc.adminCredits.getLimitSettings` / `updateLimitSettings`
- Хранение: таблица `credit_limits` (global/role/user уровни)
- Таблица `pricing_plans`: поля `maxProjects`, `maxUsers`, `maxStorage` (MB)
- Enforcement: через `server/limits/limitsService.ts` — `checkProjectLimit()`, `checkAiRequestLimit()`, `checkFeatureAccess()`

---

## ЧТО НУЖНО РЕАЛИЗОВАТЬ

---

### ЧАСТЬ 1: Схема БД — две новые таблицы + расширение существующей

**1.1. Новая таблица `file_attachments` в `drizzle/schema.ts`:**

```typescript
export const fileAttachments = mysqlTable("file_attachments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task"]).notNull(),
  entityId: int("entityId").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: text("fileUrl"),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSize: int("fileSize").notNull(),  // bytes
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("fa_entity_idx").on(table.entityType, table.entityId),
  projectIdx: index("fa_project_idx").on(table.projectId),
  uploadedByIdx: index("fa_uploaded_by_idx").on(table.uploadedBy),
  projectFk: foreignKey({ columns: [table.projectId], foreignColumns: [projects.id], name: "fa_project_fk" }).onDelete("cascade"),
  uploadedByFk: foreignKey({ columns: [table.uploadedBy], foreignColumns: [users.id], name: "fa_uploaded_by_fk" }).onDelete("cascade"),
}));
```

**1.2. Новая таблица `attachment_settings` (одна строка — глобальные настройки):**

```typescript
export const attachmentSettings = mysqlTable("attachment_settings", {
  id: int("id").autoincrement().primaryKey(),
  maxFileSizeMB: int("maxFileSizeMB").default(100),
  maxTotalStorageMB: int("maxTotalStorageMB").default(10000),
  maxFilesPerEntity: int("maxFilesPerEntity").default(50),
  maxFilesPerMessage: int("maxFilesPerMessage").default(10),
  maxFileContentForAI_KB: int("maxFileContentForAI_KB").default(100),
  allowedMimeTypes: json("allowedMimeTypes").$type<string[]>().default([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
    "text/plain", "text/markdown", "text/csv",
    "application/json",
    "application/zip", "application/x-rar-compressed",
    "video/mp4", "audio/mpeg", "audio/wav",
  ]),
  planOverrides: json("planOverrides").$type<Record<string, Partial<{
    maxFileSizeMB: number;
    maxTotalStorageMB: number;
    maxFilesPerEntity: number;
  }>>>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
```

Дефолты: **100 MB/файл, 10 GB/проект, 50 файлов/сущность, 10 файлов/сообщение, 100 KB текста для AI-контекста, все основные MIME-типы разрешены**. При первом запуске создаётся запись с дефолтами.

**1.3. Расширить таблицу `task_comments`:**

Добавить поле:

```typescript
attachmentIds: json("attachmentIds").$type<number[]>(),
```

---

### ЧАСТЬ 2: Серверный API

**2.1. Новый `attachmentsRouter.ts` (зарегистрировать в `appRouter` как `attachments: attachmentsRouter`):**

Эндпоинты:

- `getSettings` (query, protectedProcedure) — текущие лимиты для пользователя (с учётом его плана):
  ```typescript
  // Берёт настройки из attachment_settings
  // Применяет planOverrides для плана пользователя (free/pro/enterprise)
  // Возвращает: { maxFileSizeMB, maxTotalStorageMB, maxFilesPerEntity, maxFilesPerMessage, maxFileContentForAI_KB, allowedMimeTypes }
  ```

- `getAdminSettings` (query, adminProcedure) — полные настройки включая planOverrides

- `updateAdminSettings` (mutation, adminProcedure) — обновить настройки:
  ```typescript
  input: z.object({
    maxFileSizeMB: z.number().min(1).max(2000).optional(),
    maxTotalStorageMB: z.number().min(100).max(100000).optional(),
    maxFilesPerEntity: z.number().min(1).max(1000).optional(),
    maxFilesPerMessage: z.number().min(1).max(100).optional(),
    maxFileContentForAI_KB: z.number().min(1).max(5000).optional(),
    allowedMimeTypes: z.array(z.string()).optional(),
    planOverrides: z.record(z.string(), z.object({
      maxFileSizeMB: z.number().optional(),
      maxTotalStorageMB: z.number().optional(),
      maxFilesPerEntity: z.number().optional(),
    })).optional(),
  })
  ```

- `list` (query) — вложения сущности: `{ entityType, entityId }` → `FileAttachment[]`

- `listByProject` (query) — все вложения проекта: `{ projectId, search?, mimeTypeFilter? }` → `FileAttachment[]`

- `upload` (mutation) — загрузить файл: `{ projectId, entityType, entityId, fileData (base64), fileName, mimeType }`
  - **Enforcement**: перед загрузкой проверить ВСЕ лимиты из `attachment_settings` + `planOverrides`:
    1. Размер файла ≤ `maxFileSizeMB`
    2. MIME-тип в `allowedMimeTypes`
    3. Количество файлов сущности < `maxFilesPerEntity`
    4. Общий объём проекта + файл ≤ `maxTotalStorageMB`
  - Путь хранения: `attachments/{projectId}/{entityType}/{entityId}/{timestamp}-{random}.{ext}`
  - Паттерн: `Buffer.from(fileData, 'base64')` → `storagePut(path, buffer, mimeType)`
  - Права: editor+ (через `checkEntityAccess`)

- `delete` (mutation) — удалить: `{ attachmentId }` (владелец файла или admin проекта)

- `linkToEntity` (mutation) — прикрепить существующий файл к другой сущности: `{ attachmentId, targetEntityType, targetEntityId }` → создаёт новую запись с тем же `fileKey` (не копирует файл)

- `search` (query) — поиск по имени в проекте: `{ projectId, query }` → `FileAttachment[]`

- `recent` (query) — последние 5 файлов проекта: `{ projectId }` → `FileAttachment[]`

**2.2. Расширить `addDiscussion` в `collaborationRouter.ts`:**

Добавить в input schema: `attachmentIds: z.array(z.number()).optional()`
Сохранять в поле `attachmentIds` записи `task_comments`.
Проверить: количество attachmentIds ≤ `maxFilesPerMessage` из настроек.

---

### ЧАСТЬ 3: Админ-панель — настройки вложений

В `AdminLimits.tsx` добавить новый Card-блок **"Лимиты вложений"** (иконка `Paperclip`) после секции "Лимиты по ролям":

```
📎 Лимиты вложений

Макс. размер файла:                [Slider 1–2000] MB     [NumberInput]
Макс. хранилище на проект:         [Slider 100–100000] MB [NumberInput]
Макс. файлов на сущность:          [Slider 1–1000]        [NumberInput]
Макс. файлов в сообщении:          [Slider 1–100]         [NumberInput]
Макс. размер файла для AI-контекста: [Slider 1–5000] KB   [NumberInput]

Разрешённые типы файлов:           [Multiselect chips]
  ☑ PDF  ☑ DOCX  ☑ XLSX  ☑ PPTX  ☑ Изображения
  ☑ Текст/Markdown  ☑ JSON  ☑ CSV  ☑ ZIP/RAR  ☑ Видео  ☑ Аудио

Переопределения по планам:
  Free:       макс файл [___] MB, хранилище [___] MB, файлов [___]
  Pro:        макс файл [___] MB, хранилище [___] MB, файлов [___]
  Enterprise: макс файл [___] MB, хранилище [___] MB, файлов [___]
```

UI-паттерн: **точно как существующие лимиты** — Slider + Number Input рядом, Card с иконкой, Save/Reset кнопки, Skeleton при загрузке. API: `trpc.attachments.getAdminSettings` / `updateAdminSettings`.

---

### ЧАСТЬ 4: UI-компоненты вложений

**4.1. `FileUploadZone.tsx` — универсальный компонент загрузки:**

- Drag & drop зона (HTML5 native `onDragOver`/`onDrop`) + кнопка-триггер (иконка `Paperclip`)
- При инициализации запрашивает `trpc.attachments.getSettings` для получения актуальных лимитов
- Превью перед загрузкой: имя + размер + иконка типа
- Валидация **до загрузки** на клиенте: размер, MIME-тип, количество — по данным из `getSettings`
- Подпись под зоной: "Макс. размер: {maxFileSizeMB} MB" (динамически из настроек)
- `<input accept={allowedMimeTypes.join(',')}>` — фильтр по разрешённым типам
- Индикатор загрузки (Loader2 animate-spin)
- **Два режима**:
  - **Полный** — зона drag & drop с текстом "Перетащите файлы сюда" + кнопка "Выбрать файл" + подпись лимита
  - **Компактный** — только кнопка-иконка `Paperclip` (для встраивания в обсуждения и AI-чат)
- Стиль: `bg-slate-800/40 border-slate-700 border-dashed`

**4.2. `AttachmentsPanel.tsx` — панель вложений сущности:**

- Список файлов: иконка типа + имя (truncate) + размер + дата + кто загрузил (аватар)
- Действия: скачать (открыть URL), удалить (с confirm), прикрепить к другой сущности (linkToEntity)
- Кнопка "Добавить файл" → показывает `FileUploadZone` в полном режиме
- Кнопка "Из проекта" → dropdown со всеми файлами проекта для быстрого переиспользования
- Секция "Недавние" — последние 5 файлов проекта через `attachments.recent`, одним кликом прикрепить через `linkToEntity`
- Поиск по имени файла (если файлов > 5)
- Props: `{ entityType, entityId, projectId }`

**4.3. `AttachmentChip.tsx` — компактное отображение файла:**

- Inline-элемент: иконка типа + имя (max 20 символов, truncate) + размер
- Клик → скачивание (window.open(fileUrl))
- Hover → tooltip с полным именем
- Кнопка × для удаления (если есть права)
- Стиль: `px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600 text-xs`

---

### ЧАСТЬ 5: Интеграция в существующие компоненты

**5.1. `DiscussionPanel.tsx` — вложения в сообщениях:**

- Кнопку-скрепку (`Paperclip`) **между Textarea и кнопкой Send** (строка ~699):
  ```
  <Textarea> [📎 Paperclip button] <Send button>
  ```
- При клике — `FileUploadZone` в компактном режиме (popup/popover над полем ввода)
- State: `pendingAttachments: File[]` — файлы, ожидающие отправки
- Перед полем ввода — chips загруженных файлов (AttachmentChip с кнопкой ×)
- При `handleSubmit`: сначала загрузить файлы через `attachments.upload`, получить ID, затем `addDiscussion.mutate({ ..., attachmentIds })`
- Проверка: количество файлов ≤ `maxFilesPerMessage` (из настроек)
- В отображении сообщений: под текстом `comment.content` показывать `AttachmentChip` для каждого вложения из `comment.attachmentIds`
- AI-финализация: в контекст для LLM добавлять имена вложенных файлов

**5.2. `TaskDetailPanel.tsx` — новая секция "Вложения":**

Вставить **между "Итоговый документ" (строка ~572) и "Подзадачи" (строка ~574)**:

```tsx
{/* Attachments */}
<div>
  <Label className="text-slate-400 text-xs mb-2 block flex items-center gap-2">
    <Paperclip className="w-4 h-4" />
    Вложения
  </Label>
  <AttachmentsPanel entityType="task" entityId={task.id} projectId={projectId} />
</div>
```

**5.3. `BlockDetailPanel.tsx` — секция "Вложения":**

Вставить **между "AI Quick Actions" (строка ~270) и EntityAIChat (строка ~273)**:

```tsx
{/* Attachments */}
<div>
  <div className="flex items-center gap-2 mb-2">
    <Paperclip className="w-3.5 h-3.5 text-slate-400" />
    <span className="text-xs text-slate-400">Вложения</span>
  </div>
  <AttachmentsPanel entityType="block" entityId={block.id} projectId={projectId} />
</div>
```

**5.4. `SectionDetailPanel.tsx`** — аналогично BlockDetailPanel, вставить между AI Quick Actions и EntityAIChat.

**5.5. `CreateEntityDialogs.tsx` — вложения при создании:**

- В `CreateBlockDialog` — под полями title/titleRu добавить сворачиваемую секцию:
  ```tsx
  <Collapsible>
    <CollapsibleTrigger className="text-xs text-slate-400">
      <Paperclip /> Прикрепить файлы (опционально)
    </CollapsibleTrigger>
    <CollapsibleContent>
      <FileUploadZone mode="full" />
    </CollapsibleContent>
  </Collapsible>
  ```
- В `CreateTaskDialog` — под Textarea описания добавить аналогичную секцию
- При сабмите: сначала создать сущность → получить ID → загрузить файлы и привязать к созданной сущности

---

### ЧАСТЬ 6: AI-анализ на основе файлов

**6.1. `EntityAIChat.tsx` — файлы в контексте AI:**

В область ввода (строка ~470, рядом с однострочным `<Input>`):
```
[Input] [📎 Attach] [Send/Stop] [Trash]
```

- Кнопка `📎` (Paperclip) слева от Send — два варианта в Popover:
  - "Загрузить файл" → FileUploadZone компактный
  - "Выбрать из вложений" → dropdown со списком вложений текущей сущности (`attachments.list`)
- State: `attachedFiles: Array<{ id: number, fileName: string, content?: string }>` — файлы для AI-запроса
- Над `<Input>` — chips выбранных файлов (AttachmentChip с ×)
- Лимит размера для AI-контекста берётся из `trpc.attachments.getSettings` → `maxFileContentForAI_KB`
- При `handleSend`:
  - Для текстовых файлов (text/plain, text/markdown, text/csv, application/json) размером ≤ `maxFileContentForAI_KB` KB — извлечь содержимое и добавить в промпт:
    ```
    ${userMsg}

    --- Содержимое файла "${fileName}" ---
    ${fileContent}
    ---
    ```
  - Для файлов > лимита или бинарных (PDF, DOCX, XLSX, изображения) — добавить только метаданные:
    ```
    ${userMsg}

    [Прикреплён файл: "${fileName}" (${mimeType}, ${fileSize})]
    ```

**6.2. Новые quick prompts (добавить к существующим):**

В `defaultBlockPrompts`:
```typescript
{ label: '📎 Анализ документов', prompt: `Проанализируй прикреплённые документы блока "${title}" и сделай выводы, рекомендации и план действий` }
```

В `defaultSectionPrompts`:
```typescript
{ label: '📎 Анализ материалов', prompt: `Изучи прикреплённые материалы раздела "${title}" и предложи конкретные задачи на их основе` }
```

В `defaultTaskPrompts` (2 новых):
```typescript
{ label: '📎 Анализ файлов', prompt: `Проанализируй прикреплённые файлы задачи "${title}". Сделай саммари, выдели ключевые моменты и сформируй рекомендации.` },
{ label: '📎 План из документа', prompt: `На основе прикреплённых документов создай пошаговый план действий для задачи "${title}" с ответственными и сроками.` },
```

**6.3. Автоматический контекст из вложений:**

При формировании `entityContext` / `projectContext` в EntityAIChat и при AI-финализации в DiscussionPanel — если у сущности есть вложения, автоматически добавлять:
```
Прикреплённые файлы:
- document.pdf (1.2 MB, загружен 05.02.2026)
- action-plan.md (содержимое: [первые N символов по лимиту...])
- requirements.docx (340 KB, загружен 01.02.2026)
```

Лимит включения содержимого определяется `maxFileContentForAI_KB` из настроек.

---

### ЧАСТЬ 7: UX-улучшения

**7.1. Глобальный поиск файлов проекта:**

В `ProjectView` — добавить иконку поиска файлов в header или sidebar. По клику — модалка (Dialog) с:
- Текстовый поиск по имени файла
- Фильтр по типу (документы, изображения, таблицы)
- Фильтр по сущности (в каком блоке/секции/задаче)
- Клик по файлу → навигация к сущности, где он прикреплён

**7.2. Визуальные индикаторы:**

- В sidebar (`DesktopSidebar`) — маленькая иконка скрепки рядом с блоком/секцией, если есть вложения
- В карточках секций внутри `BlockDetailPanel` — бейдж с числом вложений

**7.3. Мобильная адаптация:**

- `FileUploadZone` на мобильном — нативный `<input type="file" accept="..." capture>` (камера + галерея + файлы)
- `AttachmentsPanel` — вертикальный список с крупными touch-target (min 44px)
- Swipe-to-delete для файлов в списке (паттерн из `SwipeableTaskCard`)

---

## ПОРЯДОК РЕАЛИЗАЦИИ (9 шагов)

| Шаг | Что | Файлы |
|-----|-----|-------|
| 1 | Схема БД: `file_attachments` + `attachment_settings` + поле `attachmentIds` в `task_comments` + миграция | `drizzle/schema.ts`, `drizzle/relations.ts`, новая миграция |
| 2 | Серверный API: вложения + настройки + enforcement | Новый `server/attachmentsRouter.ts`, изменить `server/routers.ts` (appRouter) |
| 3 | Расширить обсуждения (attachmentIds) | Изменить `server/collaborationRouter.ts` |
| 4 | Админ-панель: секция лимитов вложений | Изменить `client/src/pages/admin/AdminLimits.tsx` |
| 5 | Базовые UI-компоненты | Новые: `FileUploadZone.tsx`, `AttachmentChip.tsx`, `AttachmentsPanel.tsx` |
| 6 | Интеграция в панели | Изменить: `TaskDetailPanel.tsx`, `BlockDetailPanel.tsx`, `SectionDetailPanel.tsx` |
| 7 | Интеграция в обсуждения | Изменить: `DiscussionPanel.tsx` |
| 8 | Интеграция в AI | Изменить: `EntityAIChat.tsx` (input + контекст + промпты) |
| 9 | Создание + UX (поиск, недавние, индикаторы, мобайл) | Изменить: `CreateEntityDialogs.tsx`, `ProjectView.tsx`, `DesktopSidebar.tsx` |

---

## ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ

- Использовать существующий `storagePut`/`storageGet` из `server/storage.ts`
- Файлы передавать как base64 через tRPC (паттерн из `uploadTeamPhoto` в `routers.ts:1892-1911`)
- **Все лимиты** (размер файла, хранилище проекта, количество файлов, типы файлов, размер контента для AI) — **настраиваемые через админ-панель**, хранятся в таблице `attachment_settings`
- Лимиты могут переопределяться per-plan (free/pro/enterprise) через `planOverrides`
- Enforcement: проверка лимитов **и на клиенте** (UX, не тратить трафик) **и на сервере** (безопасность)
- Express body limit 50MB уже настроен; для файлов > 50MB в будущем потребуется chunked upload (вне scope текущей задачи)
- Дефолты: 100 MB/файл, 10 GB/проект, 50 файлов/сущность, 10 файлов/сообщение, 100 KB текста для AI-контекста, все основные MIME-типы
- Права: `checkEntityAccess` / `checkProjectAccess` из `server/utils/authorization.ts`
- Стиль: dark theme `bg-slate-800/900`, amber акценты, shadcn/ui компоненты
- Иконки: lucide-react (Paperclip, Upload, File, FileText, Image, Trash2, Download, Link)
