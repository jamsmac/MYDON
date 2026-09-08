# Срез A3 «Кольцо артефактов» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** документы, которые бот производит через `@mydon/documents`, перестают теряться —
сохраняются в `attachment` ДО отправки, а витрина `/artifacts` находит их по типу, направлению,
периоду и названию.

**Architecture:** субстрат — `attachment` (живое хранилище, пять маршрутов, расширяемый
`ownerType`), не мёртвая `document`. Единственная миграция волны A (0089): `title`, `domain`,
`tags`, индекс `(kind, created_at)`. Новый модуль `apps/core/src/artifacts/` с `GET /artifacts` за
`ReadTokenGuard` и курсорной пагинацией. Бот сохраняет с владельцем `person` ДО отправки; сбой
хранилища не блокирует отправку. Витрина в грамматике Д1.

**Tech Stack:** TypeScript strict · NestJS (`apps/core`, node:test из dist) · Next.js 16 (`apps/cc`,
vitest) · Telegram-бот (`apps/bot`, node:test) · Drizzle + postgres-js · S3/локальное хранилище

**Spec:** `docs/superpowers/specs/2026-09-07-artifacts-ring-design.md`

## Global Constraints

- Русский язык кода и комментариев; комментарий объясняет ПРИЧИНУ.
- TypeScript strict, `exactOptionalPropertyTypes: true`, `any` и `@ts-ignore` запрещены.
- **Миграция ОДНА (0089), обратима, существующие строки `attachment` не трогает.** Файл, снапшот
  и запись журнала создаёт ТОЛЬКО `drizzle-kit generate` (тест сверяет head-снапшот со `schema.ts`
  тем же движком); руками дописывается лишь тело SQL. `when` в журнале не менять.
- **`CREATE INDEX CONCURRENTLY` невозможен:** мигратор применяет все файлы в одной транзакции.
  Обычный индекс с оговоркой в SQL (как 0070/0071/0073).
- **`domainEnum` уже объявлен** (`schema.ts:29`) — второй `pgEnum("domain")` уронил бы миграцию.
- `document` не сносится, помечается комментарием; экспорт и регистрация сохраняются.
- Читающий маршрут с содержанием работы агентов — за `ReadTokenGuard`; `storageKey` наружу не едет.
- Словари слов/классов — только в `apps/cc/src/lib/state.ts`; относительное время — `ago` от `now` Core.
- Бот: сохранение СТРОГО раньше отправки; сбой сохранения не блокирует отправку и назван словами;
  гость без `person` — не сохраняем и говорим об этом.
- Каждая правка закрыта ассертом, падающим при откате.

---

## Интерфейсы задач (сводка контроллера)

Порядок: 1 → 2 → 3 → 4 → 5 → 6. Задачи 2 и 3 потребляют схему из 1; 4 потребляет `POST` из 3;
5 потребляет `GET` из 2; 6 описывает всё.


---

### Интерфейсы задачи 1

Что этот раздел отдаёт остальным разделам (Задачи 2–5), ровно в таком виде:

1. Колонки `attachment` в `@mydon/db` (`import { attachment, domainEnum } from "@mydon/db"`):
   - `attachment.title` — `text`, nullable, без default → в `$inferSelect`: `title: string | null`.
   - `attachment.domain` — `domainEnum("domain")` (ТОТ ЖЕ объект `domainEnum`, что у `moneyFlow.domain`), nullable → `domain: "globerent" | "vendhub" | "personal" | "mydon" | null`. Значения для class-validator в `POST /attachments`: `domainEnum.enumValues`.
   - `attachment.tags` — `jsonb("tags").$type<string[]>().default([]).notNull()` → `tags: string[]`; в insert поле необязательно (DEFAULT '[]' в БД).
   - Прежние колонки без изменений: `ownerId uuid NOT NULL`, `storageKey NOT NULL`, `kind default 'photo'`, `stage`, `mime`, `bytes`, `createdBy`, `createdAt`.
2. Индекс `attachment_kind_created_idx` ON attachment (kind, created_at DESC NULLS LAST), не уникальный, сплошной — под `GET /artifacts` с `ORDER BY created_at DESC, id` при фильтре `kind`. Прежний `attachment_owner_idx (owner_type, owner_id)` остаётся.
3. Миграция: тег `0089_attachment_artifacts`, четыре оператора с `IF NOT EXISTS`, без бэкфилла, без CONCURRENTLY (мигратор — одна транзакция), откат описан в её заголовке. Точка отсчёта архива — день её выката; константа `ARTIFACTS_SINCE = "2026-09-08"` в `apps/cc/src/lib/artifacts.ts` (Задача 5) ссылается на «день выката миграции 0089».
4. `document` — только помечена комментарием `/** УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment (срез A3). */`; экспорт и регистрация в `schema` сохраняются (тест «11 таблиц реестра» неизменен). Никто из последующих задач в `document` не пишет.
5. Тестовые крючки: `tools/pglite-checks/check-0089.mjs` показывает, как поднять базу на 0088/0089 (`migratedDb({ upto: 88 })`, `applyMigrations()`) — Задача 2 (`GET /artifacts`) может переиспользовать этот приём для сценария на настоящем SQL.

---

### Интерфейсы задачи 2

HTTP: `GET /artifacts` за `ReadTokenGuard` на классе (заголовок `x-service-token: <SERVICE_TOKEN>` или `Authorization: Bearer`; без него 401 даже на GET). Query (все необязательны, чужое значение — 400 по полю, лишний параметр — 400 от глобального ValidationPipe с forbidNonWhitelisted): `kind` ∈ photo|receipt|doc · `ownerType` /^[a-z][a-z0-9_]{0,31}$/ · `ownerId` UUID · `domain` ∈ globerent|vendhub|personal|mydon · `from`,`to` ISO-8601 по createdAt включительно (дата без времени = полночь UTC) · `q` строка ≤200, ILIKE по title с экранированием %/_/\ и COLLATE "pg_c_utf8", пустая/пробельная = «не задан» · `limit` целое 1..100, дефолт 50 · `cursor` строка ≤256 = `next` предыдущего ответа (base64url от `${created_at ISO}|${id}`, испорченный — 400). Ответ 200: `{ items: ArtifactRow[], next: string | null, now: string }`, `ArtifactRow = { id, ownerType, ownerId, kind, title: string|null, domain: Domain|null, tags: string[], mime: string|null, bytes: number|null, createdBy: string|null, createdAt: ISO }` — БЕЗ storageKey и без содержимого; порядок created_at desc, id desc; `next` = курсор последней строки, только если строк ровно limit. Личный контур: без `domain` в запросе при OWNER_IDENTITY_ENFORCED=1 и без owner-токена строки domain='personal' вырезаются (`is distinct from`, NULL-домен остаётся); `?domain=personal` под ужесточением без owner-токена — 403 глобальным PersonalDomainGuard (существующее поведение). TS-экспорты `apps/core/src/artifacts/artifacts.service.ts`: `ArtifactsService.list(filter: ArtifactsFilter = {}, opts: { excludePersonal?: boolean; now?: Date } = {}): Promise<ArtifactsPage>`, типы `ArtifactsFilter`, `ArtifactRow`, `ArtifactsPage`, `ArtifactKind`, константы `ARTIFACT_KINDS = ["photo","receipt","doc"] as const`, `LIST_MAX = 100`, функции `encodeCursor({createdAt, id})`, `decodeCursor(raw): {createdAt, id} | null`, `titleMatches(q): SQL`. `artifacts.controller.ts`: `ArtifactsQueryDto` (class-validator), `ArtifactsController.list(q, req)`. `artifacts.module.ts`: `ArtifactsModule` (controllers: [ArtifactsController], providers: [ArtifactsService, ReadTokenGuard]; AttachmentsModule не импортирует — в хранилище не ходит). Панель (задача 5) зовёт ровно эти 9 имён параметров и берёт содержимое по `GET /attachments/:id/raw`.

---

### Интерфейсы задачи 3

**Что ждём от Задачи 1 (schema.ts, таблица `attachment`):**
```ts
title: text("title"),
domain: domainEnum("domain"),
tags: jsonb("tags").$type<string[]>().default([]).notNull(),
```
Если Задача 1 объявит `tags` без `.$type<string[]>()`, эта задача всё равно компилируется: чтение идёт через `tagsOf(value: unknown)`, вставка `string[]` в `unknown` проходит.

**Контракт `POST /attachments` после этой задачи (multipart/form-data, глобальный `ValidationPipe` с `whitelist+forbidNonWhitelisted+transform`, `apps/core/src/main.ts:13-19`):**
- прежние поля без изменений: `ownerType` (шаблон `^[a-z][a-z0-9_]{0,31}$`), `ownerId` (uuid), `kind` (`photo|receipt|doc`, дефолт `photo`), `createdBy` (≤128), `stage` (`before|after|plate|counter`), `file`;
- `title?: string` — любой длины на входе; сервер обрезает до 120 символов (по code point, эмодзи не рвутся), пробелы по краям срезает, пустую строку считает отсутствующей; НЕ строка → 400;
- `domain?: "globerent"|"vendhub"|"personal"|"mydon"` — проверяется по `domainEnum.enumValues` из `@mydon/db`; `""` считается отсутствующим; любое другое значение → 400;
- `tags?: string[]` — в multipart это ПОВТОРЁННОЕ поле: `for (const t of tags) form.append("tags", t)`. Одно поле multer отдаёт строкой, повторённое — массивом; сервер приводит к массиву сам. Пустые/пробельные теги выбрасываются; не-строка внутри, тег длиннее 64 или больше 20 тегов → 400. НЕ слать JSON-строку `'["bot"]'` — она станет одним тегом `["bot"]`.
- белый список файла для `kind=doc|receipt`: изображения из `IMAGE_EXT`, `application/pdf`, и ТЕПЕРЬ `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `...spreadsheetml.sheet` (.xlsx), `...presentationml.presentation` (.pptx). `text/html` по-прежнему 400 (защита #244).

**Ответ `POST /attachments` / `GET /attachments` / `GET /attachments/batch` / `GET /attachments/:id` — `AttachmentMeta` расширен:**
```ts
export interface AttachmentMeta {
  id: string; ownerType: string; ownerId: string; kind: string;
  stage: string | null; mime: string | null; bytes: number | null;
  url: string; createdAt: string;
  title: string | null;   // новое
  domain: string | null;  // новое
  tags: string[];         // новое, у старых строк []
}
```

**Экспорты для других задач:**
- `apps/core/src/attachments/attachments.controller.ts`: `ATTACHMENT_TITLE_MAX = 120`, `ATTACHMENT_TAGS_MAX = 20`, `ATTACHMENT_TAG_MAX = 64`, `clampAttachmentTitle(value: unknown): unknown`, `normalizeAttachmentTags(value: unknown): unknown`.
- `apps/core/src/attachments/attachments.service.ts`: `tagsOf(value: unknown): string[]` — Задаче 2 (`GET /artifacts`, `ArtifactRow.tags`) читать jsonb через неё, а не через `as string[]`.
- Сигнатура сервиса: `upload(input: { ownerType; ownerId; kind?; createdBy?; stage?; title?: string; domain?: Domain; tags?: string[] }, file)`, где `Domain` — из `@mydon/shared`.

**Для Задачи 4 (бот, `deps.core.saveAttachment`):** Blob файла обязан нести mime из белого списка выше (по расширению `filename` из `@mydon/documents`: `.docx/.xlsx/.pptx/.pdf`), иначе Core ответит 400 «Недопустимый тип файла для «doc»». `title` можно слать полный `doc.summary` — обрезка на сервере.

---

### Интерфейсы задачи 4

1) `CoreClient.saveAttachment(input: { ownerType: string; ownerId: string; kind: "doc"; title: string; mime: string; filename: string; content: Buffer; tags: string[]; domain?: Domain; createdBy: string }): Promise<{ id: string; url: string }>` — multipart `POST /attachments`, поля: ownerType, ownerId, kind, createdBy, title, tags (JSON-строка, напр. `["bot"]`), domain (только если задан), file (Blob с type=mime, имя=filename); заголовок x-service-token; таймаут PHOTO_TIMEOUT_MS (60 с); отказ → `CoreError(status, "/attachments", body)`.
2) `apps/bot/src/document-archive.ts`: `interface DocumentArchiveDeps { resolveOwner(): Promise<PersonRow | null | "core-down">; save(input: {ownerType: "person"; ownerId: string; kind: "doc"; title: string; mime: string; filename: string; content: Buffer; tags: string[]; domain?: Domain; createdBy: string}): Promise<{ id: string }>; sendDocument(filename: string, content: Buffer): Promise<void>; sendMessage(text: string): Promise<void>; panelUrl: string; log(message: string, error: unknown): void }`; `interface DocumentToDeliver { filename: string; content: Buffer; domain?: Domain }`; `interface DeliveryOutcome { savedId: string | null; sent: boolean }`; `доставитьДокумент(deps, doc): Promise<DeliveryOutcome>`; `mimeПоРасширению(filename): string`; `заголовокИзИмени(filename): string`; `TITLE_MAX = 120`; `ярлыкПричины(error: unknown): string`; `ссылкаНаАрхив(panelUrl: string, title: string): string` → `${panelUrl}/artifacts?q=<encodeURIComponent(title)>`.
3) `Reply.document` в handler.ts расширяется до `{ filename: string; content: Buffer; caption?: string; domain?: Domain }`; `ReportPlan.domain?: Domain` (reports.ts) — заполняется для дебиторки (резолвленный домен, дефолт "globerent"), отсутствует у отчёта по задачам.
4) Тексты владельцу (дословно): успех обоих шагов — тишина; сохранение упало, отправка прошла — `⚠️ Файл отправлен, но в архив не лёг: <ярлык>.`; гость без person — тот же шаблон с ярлыком `чат не привязан к человеку в MYDON`; Core недоступен при поиске владельца — ярлык `Core не ответил`; отправка упала, файл сохранён — `Отправить в чат не вышло, файл в архиве: <panelUrl>/artifacts?q=<title>`; оба упали — `⚠️ Файл не отправился и в архив не лёг: <ярлык>. Он потерян — запроси отчёт заново.` Ярлыки: CoreError 400 → «Core отверг файл», 401/403 → «нет доступа к Core», 413 → «файл слишком большой», иной статус → «Core ответил <status>», TimeoutError/AbortError → «Core не ответил вовремя», прочее → «Core недоступен».
5) Env: `CC_PUBLIC_URL` (публичный адрес панели без завершающего «/»; пусто → ссылка путём `/artifacts?q=…`).
6) Записанные поля вложения: ownerType="person", ownerId=person.id владельца по chatId, kind="doc", title=имя файла без расширения (≤120), mime по расширению (.xlsx/.docx/.pptx/.pdf), tags=["bot"], domain из плана отчёта (если есть), createdBy="owner".

---

### Интерфейсы задачи 5

lib/artifacts.ts: `ARTIFACTS_SINCE = "2026-09-08"`, `ARTIFACT_KINDS = ["doc","photo","receipt"] as const`, `type ArtifactKind`, `ARTIFACTS_LIMIT = "50"`, `isArtifactKind(v?: string): v is ArtifactKind`, `isDomain(v?: string): v is Domain`, `sinceWord(day = ARTIFACTS_SINCE): string` → «8 сентября 2026», `периодВМоменты(from?: string, to?: string): { from?: string; to?: string }` (ташкентские сутки включительно → ISO), `fileHref(id): string` → `/api/attachments/<id>/raw`, `opensInNewTab(mime: string|null): boolean` (только text/html), `ownerCard(ownerType, ownerId): { label: string; href: string|null }`, `authorWord(createdBy: string|null): string|null`. lib/state.ts: `ARTIFACT_KIND_WORD: Record<ArtifactKind,string>` = {doc:"документ", photo:"фото", receipt:"чек"}, `ARTIFACT_KIND_LED: Record<ArtifactKind,string>` = все "led". lib/core.ts: `interface ArtifactRow { id; ownerType; ownerId; kind: string; title: string|null; domain: Domain|null; tags: string[]; mime: string|null; bytes: number|null; createdBy: string|null; createdAt: string }` (без storageKey), `interface ArtifactList { items: ArtifactRow[]; next: string|null; now: string }`, `core.artifacts(params: Record<string,string> = {}) => getWithToken<ArtifactList>("/artifacts?…", { owner: true })`. Страница: GET-параметры `kind`, `domain`, `from`, `to` (YYYY-MM-DD), `q`, `cursor`; в Core уходят `kind`, `domain`, `from`/`to` (ISO), `q`, `cursor`, `limit: "50"`. Навигация: `{ href: "/artifacts", icon: "jour", label: "Артефакты" }` в SYSTEM (не в MAIN/таббар).

---

### Интерфейсы задачи 6

Вариант темы ПРОВЕРЕН ПО ДЕРЕВУ (feat/design-wave-grammar, 08.09.2026): `apps/cc/src/lib/theme.ts` и `CONSOLE_ROUTES` ОТСУТСТВУЮТ, маркера `<!-- CONSOLE_ROUTES -->` в rules.md §4 НЕТ (только рукописный список в строке 44, где `/artifacts` уже назван) → `/artifacts` берёт `<ConsoleTheme/>` (apps/cc/src/components/console-theme.tsx) как /crons, /flows, /skills, /brain, /apps; §9 rules.md правится руками, тест дрейфа Д2 его не обновит. Константы, на которые опирается раздел (зафиксированы контроллером): `ARTIFACTS_SINCE = "2026-09-08"` в apps/cc/src/lib/artifacts.ts; `ARTIFACT_KIND_WORD`/`ARTIFACT_KIND_LED` в apps/cc/src/lib/state.ts; миграция 0089 с индексом `attachment_kind_created_idx` (ОБЫЧНЫЙ, не CONCURRENTLY — мигратор packages/db/src/migrate.ts → drizzle-orm/postgres-js/migrator оборачивает все миграции в одну транзакцию, `session.transaction` в pg-core/dialect.js; тот же мигратор на pglite в tools/pglite-checks/run-migrations.mjs); комментарий у `document` в схеме дословно `УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment (срез A3).`; `GET /attachments/:id/raw` — `@Public()` (панель проксирует через apps/cc/src/app/api/attachments/[id]/raw/route.ts → `coreBytes`, который токен НЕ шлёт) — остаётся открытым, записано ruling'ом. Экспортов кода раздел не добавляет; единственный новый TS — тест apps/cc/src/test/artifacts-docs.test.ts с константами СПЕКА, ЗАПИСКА, РЕШЕНИЕ = "docs/decisions/2026-09-07-artifacts-ring.md", ПЛАН, НАВЫК. Сторож зеркал навыка — существующий apps/cc/src/test/design-skill.test.ts (rules/tokens/primitives/checklist побайтно в обоих зеркалах; SKILL.md стартера побайтно, SKILL.md Codex — с двумя заменами).

---

# Задачи

## Задача 1: миграция 0089 и схема `attachment`

Контекст для исполнителя: монорепо `/Users/js/Developer/mydon`, ветка `feat/design-wave-grammar` — читать как будущий `main`. Схема — Drizzle, `packages/db/src/schema.ts`; миграции — `packages/db/drizzle/NNNN_*.sql` + `meta/_journal.json` + `meta/NNNN_snapshot.json`. Тесты `packages/db` — `node:test` из собранного `dist` (`pnpm --filter @mydon/db test` = `find dist -name '*.test.js' | xargs node --test`). Язык кода и комментариев — русский, комментарий объясняет ПРИЧИНУ.

Проверенные факты, от которых зависит форма правки:
- Мигратор — `packages/db/src/migrate.ts` → `drizzle-orm/postgres-js/migrator` → `pg-core/dialect.js: migrate()`, который применяет ВСЕ ожидающие файлы внутри одной `session.transaction(...)`. `CREATE INDEX CONCURRENTLY` в транзакции запрещён → обычный индекс с оговоркой в SQL (так же решено в 0070/0071/0073).
- Мигратор применяет запись, только если её `when` (folderMillis) больше `created_at` последней применённой в `drizzle.__drizzle_migrations`. `when` пишет генератор — руками не трогать.
- `migrations.test.ts` требует снапшот на каждую запись журнала и совпадение head-снапшота со `schema.ts` (in-process `drizzle-kit/api`). Поэтому файл, снапшот и запись журнала создаёт ТОЛЬКО `drizzle-kit generate`; вручную дописывается лишь тело SQL.
- `domainEnum` уже объявлен: `packages/db/src/schema.ts:29` — `export const domainEnum = pgEnum("domain", ["globerent", "vendhub", "personal", "mydon"]);`. Второй `pgEnum("domain", …)` заводить НЕЛЬЗЯ (генератор выпустил бы `CREATE TYPE`, миграция упала бы на проде).
- Строки `attachment` в Core типизируются `typeof attachment.$inferSelect` (`apps/core/src/attachments/attachments.service.ts:7`); моки в тестах — `as never`, расширение типа typecheck не ломает.

### Шаг 1. `packages/db/src/schema.ts` — таблица `attachment`

- [ ] 1.1. Заменить заголовок таблицы (стр. 1138–1143). Старый текст:

```ts
// ── attachment: файлы (фото номенклатуры, чеки), привязанные к записи ──
//
// Полиморфная привязка: одна таблица под фото карточек, чеки приходов и т.п.
// Сам файл лежит в объектном хранилище (S3/MinIO) или на диске — здесь только
// ключ и метаданные. Так фото товара/запчасти, снятое сотрудником в Telegram,
// привязывается к карточке (owner_type='entity') или движению склада.
```

Новый текст:

```ts
// ── attachment: файлы (фото номенклатуры, чеки, артефакты), привязанные к записи ──
//
// Полиморфная привязка: одна таблица под фото карточек, чеки приходов и т.п.
// Сам файл лежит в объектном хранилище (S3/MinIO) или на диске — здесь только
// ключ и метаданные. Так фото товара/запчасти, снятое сотрудником в Telegram,
// привязывается к карточке (owner_type='entity') или движению склада.
//
// Срез A3 «Кольцо артефактов» (миграция 0089): та же таблица — субстрат
// артефактов агентов и бота (owner_type='person' | 'task', kind='doc').
// Не `document`: у неё ноль писателей и читателей, а здесь живое хранилище
// (StorageService) и пять маршрутов. Артефакт — ещё один owner_type, а не
// новая сущность (спека 2026-09-07-artifacts-ring-design §1).
```

- [ ] 1.2. Заменить комментарий у `ownerType`. Старый: `    /** К чему привязано: 'entity' | 'stock_movement' | ... */` → новый:

```ts
    /** К чему привязано: 'entity' | 'stock_movement' | 'person' (артефакт бота) | 'task' | ... */
```

- [ ] 1.3. Сразу ПОСЛЕ строки `    stage: text("stage"),` и ПЕРЕД строкой `    /** Ключ в хранилище (S3-ключ или относительный путь на диске). */` вставить три колонки:

```ts
    /**
     * Человеческое имя артефакта: «Дебиторка GLOBERENT за август». NULL у фото
     * и чеков полевого контура — у них имени нет, и требовать его значило бы
     * бэкфиллить тысячи строк выдумкой. Витрина /artifacts ищет по нему (ILIKE).
     */
    title: text("title"),
    /**
     * Направление бизнеса — ТОТ ЖЕ enum, что у money_flow: «всё по VendHub»
     * должно означать одно и то же для денег и для документов. NULL — «вне
     * направления» (фото карточки в реестре, документ бота без контекста).
     */
    domain: domainEnum("domain"),
    /**
     * Метки артефакта (`["bot"]`, `["kp"]`…) — то, ради чего заводили `document`.
     * NOT NULL с default '[]': читатель не разбирает null-ветку, а старые строки
     * получают пустой список без бэкфилла (default постоянный — Postgres не
     * переписывает таблицу).
     */
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
```

- [ ] 1.4. Заменить список индексов. Старый: `  (t) => [index("attachment_owner_idx").on(t.ownerType, t.ownerId)],` → новый:

```ts
  (t) => [
    index("attachment_owner_idx").on(t.ownerType, t.ownerId),
    // Витрина /artifacts: «последние артефакты такого рода». До среза A3 был
    // только (owner_type, owner_id) — запрос по kind шёл бы полным сканом по
    // таблице с фото полевого контура. `.desc()` на колонке, а не `desc()`
    // из drizzle-orm: так генератор пишет "created_at" DESC NULLS LAST, и
    // снапшот хранит колонку, а не выражение.
    index("attachment_kind_created_idx").on(t.kind, t.createdAt.desc()),
  ],
```

Итоговый вид таблицы после правок (для сверки):

```ts
export const attachment = pgTable(
  "attachment",
  {
    id: id(),
    /** К чему привязано: 'entity' | 'stock_movement' | 'person' (артефакт бота) | 'task' | ... */
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    /** Что это: photo | receipt | doc. */
    kind: text("kind").default("photo").notNull(),
    /**
     * Стадия съёмки: before | after | plate | counter. NULL — вне контекста
     * работы (фото карточки в реестре).
     *
     * Без неё две фотографии задачи неразличимы, и «до/после» существует
     * только в голове того, кто их прислал. Отдельная колонка, а не префикс
     * в `kind`: `kind` отвечает на «что это за файл», стадия — на «в какой
     * момент снят», и смешивать их значит терять одно из двух.
     */
    stage: text("stage"),
    /**
     * Человеческое имя артефакта: «Дебиторка GLOBERENT за август». NULL у фото
     * и чеков полевого контура — у них имени нет, и требовать его значило бы
     * бэкфиллить тысячи строк выдумкой. Витрина /artifacts ищет по нему (ILIKE).
     */
    title: text("title"),
    /**
     * Направление бизнеса — ТОТ ЖЕ enum, что у money_flow: «всё по VendHub»
     * должно означать одно и то же для денег и для документов. NULL — «вне
     * направления» (фото карточки в реестре, документ бота без контекста).
     */
    domain: domainEnum("domain"),
    /**
     * Метки артефакта (`["bot"]`, `["kp"]`…) — то, ради чего заводили `document`.
     * NOT NULL с default '[]': читатель не разбирает null-ветку, а старые строки
     * получают пустой список без бэкфилла (default постоянный — Postgres не
     * переписывает таблицу).
     */
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    /** Ключ в хранилище (S3-ключ или относительный путь на диске). */
    storageKey: text("storage_key").notNull(),
    mime: text("mime"),
    bytes: integer("bytes"),
    /** Кто загрузил: owner | staff:<id> | agent:<имя>. */
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("attachment_owner_idx").on(t.ownerType, t.ownerId),
    // Витрина /artifacts: «последние артефакты такого рода». До среза A3 был
    // только (owner_type, owner_id) — запрос по kind шёл бы полным сканом по
    // таблице с фото полевого контура. `.desc()` на колонке, а не `desc()`
    // из drizzle-orm: так генератор пишет "created_at" DESC NULLS LAST, и
    // снапшот хранит колонку, а не выражение.
    index("attachment_kind_created_idx").on(t.kind, t.createdAt.desc()),
  ],
);
```

### Шаг 2. `packages/db/src/schema.ts` — пометить `document`

- [ ] 2.1. Старый текст (стр. 1187–1188):

```ts
// ── document: ссылки на файлы (в архив/knowledge-curator) ──
export const document = pgTable("document", {
```

Новый текст (JSDoc-строка — ДОСЛОВНО, на неё стоит тест; сразу за ней без пустой строки — `export const document`):

```ts
// ── document: ссылки на файлы (в архив/knowledge-curator) ──
//
// Ни одного писателя и читателя во всём монорепо (проверено 06.09.2026,
// .superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md). Не сносится:
// снос таблицы необратим, а срез A3 — про письмо артефактов, не про уборку.
// Решение о сносе — за владельцем, когда /artifacts поработает. Экспорт и
// регистрация в `schema` остаются: тест «11 таблиц реестра» её по-прежнему ждёт.
/** УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment (срез A3). */
export const document = pgTable("document", {
```

Тело таблицы `document` (pathOrUrl, kind, orgId, entityId, tags, createdAt) не менять.

### Шаг 3. Сгенерировать миграцию, снапшот и запись журнала

- [ ] 3.1. Убедиться, что 0089 ещё нет и дерево не содержит чужих правок в `packages/db` (параллельно работает Codex — чужие свежие файлы не трогать):

```bash
ls /Users/js/Developer/mydon/packages/db/drizzle/ | tail -2          # ожидается: 0088_agent_run.sql, meta
git -C /Users/js/Developer/mydon status --short packages/db            # только ваши правки schema.ts
```

- [ ] 3.2. Сгенерировать (offline, `DATABASE_URL` не нужен — `drizzle.config.ts` требует его только для migrate/push/studio). Запускать РОВНО ОДИН РАЗ и ТОЛЬКО ПОСЛЕ шагов 1–2 (до правки схемы генератор скажет «No schema changes» и ничего не создаст; второй запуск породит 0090):

```bash
cd /Users/js/Developer/mydon/packages/db && pnpm exec drizzle-kit generate --name attachment_artifacts
```

Ожидаемый результат: созданы `drizzle/0089_attachment_artifacts.sql`, `drizzle/meta/0089_snapshot.json`, в `drizzle/meta/_journal.json` появилась запись:

```json
    {
      "idx": 89,
      "version": "7",
      "when": <миллисекунды генерации; ОБЯЗАН быть > 1788678467059 (when записи 0088)>,
      "tag": "0089_attachment_artifacts",
      "breakpoints": true
    }
```

Сгенерированное тело SQL должно быть ровно таким (это сверка, что схема правлена верно; если у вас другой текст — схема правлена не так, вернуться к шагу 1):

```sql
ALTER TABLE "attachment" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "domain" "domain";--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "attachment_kind_created_idx" ON "attachment" USING btree ("kind","created_at" DESC NULLS LAST);
```

Если в выводе есть `CREATE TYPE "public"."domain"` — в схеме появился второй `pgEnum("domain", …)`; удалить его, откатить сгенерированные файлы (`git checkout -- packages/db/drizzle && rm packages/db/drizzle/0089_attachment_artifacts.sql packages/db/drizzle/meta/0089_snapshot.json`) и повторить 3.2.

- [ ] 3.3. Проверить `when`:

```bash
node -e 'const j=require("/Users/js/Developer/mydon/packages/db/drizzle/meta/_journal.json").entries; const a=j.at(-2), b=j.at(-1); console.log(a.tag,a.when,b.tag,b.when, b.when>a.when?"OK":"ОШИБКА: when не растёт")'
```

### Шаг 4. Заменить содержимое `packages/db/drizzle/0089_attachment_artifacts.sql` дословно

- [ ] 4.1. Полное содержимое файла (заголовок обязан стоять ПЕРЕД первым оператором — мигратор режет файл по `--> statement-breakpoint` и отдаёт первый кусок вместе с комментарием; после последнего оператора ничего не дописывать, иначе появится пустой «оператор»). Разделителей `--> statement-breakpoint` ровно три:

```sql
-- Срез A3 «Кольцо артефактов»: attachment становится субстратом артефактов
-- (спека docs/superpowers/specs/2026-09-07-artifacts-ring-design.md §1, Р-A3-7).
--
-- Что добавляется и почему.
--   title  — человеческое имя артефакта; до среза у файла был только storage_key.
--   domain — направление бизнеса, ТОТ ЖЕ enum "domain", что у money_flow (с 0000):
--            нового типа нет, второй CREATE TYPE уронил бы миграцию.
--   tags   — метки, ради которых когда-то заводили мёртвую `document`.
--   индекс (kind, created_at DESC) — под витрину «последние артефакты такого рода»;
--            до него был только (owner_type, owner_id), и /artifacts шла бы полным
--            сканом по таблице с фото полевого контура.
--
-- Существующие строки (фото, чеки полевого контура) НЕ трогаются: title/domain
-- nullable, tags получает '[]' через DEFAULT — бэкфилла нет, UPDATE нет. Default
-- постоянный, поэтому ADD COLUMN … DEFAULT — правка каталога, без перезаписи таблицы.
--
-- Почему НЕ `CREATE INDEX CONCURRENTLY`. Мигратор drizzle (migrate.ts →
-- drizzle-orm/pg-core/dialect.js) применяет ВСЕ ожидающие файлы внутри одной
-- транзакции, а CONCURRENTLY в транзакции запрещён — оператор упал бы и
-- ПОВЕСИЛ БЫ автодеплой (тот же вывод в 0070/0071/0073). Обычный CREATE INDEX
-- на живой таблице с фото держит SHARE-блокировку (запись ждёт, чтение идёт)
-- доли секунды: строк тысячи, не миллионы.
--
-- IF NOT EXISTS — защитный паттерн 0067…0073: автодеплой применяет миграции без
-- отката, и каждый оператор обязан быть безопасен на повторном прогоне.
--
-- Откат (вручную; строки attachment и файлы в хранилище остаются, но названия,
-- направления и метки артефактов, записанных после выката, будут потеряны):
--   DROP INDEX IF EXISTS "attachment_kind_created_idx";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "tags";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "domain";
--   ALTER TABLE "attachment" DROP COLUMN IF EXISTS "title";
--   DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" = <when записи 0089 в meta/_journal.json>;
-- Последний шаг — чтобы мигратор применил 0089 заново при следующем деплое:
-- без него запись в журнале мигратора останется, а колонок в базе не будет.
-- Сценарий tools/pglite-checks/check-0089.mjs прогоняет этот откат на настоящем SQL.
--
-- Дата выката этой миграции — точка отсчёта архива: константа ARTIFACTS_SINCE
-- в apps/cc/src/lib/artifacts.ts печатается в пустом состоянии /artifacts.

ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "domain" "domain";--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachment_kind_created_idx" ON "attachment" USING btree ("kind","created_at" DESC NULLS LAST);
```

Файлы `meta/0089_snapshot.json` и `meta/_journal.json` после генерации НЕ редактировать.

### Шаг 5. Юнит-тест схемы — новый файл `packages/db/src/attachment-artifacts-schema.test.ts`

- [ ] 5.1. Создать файл с содержимым:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { attachment, document, domainEnum, moneyFlow } from "./schema";

/**
 * Срез A3 «Кольцо артефактов»: субстрат артефактов — `attachment`, а не мёртвая
 * `document` (спека 2026-09-07-artifacts-ring-design §1, миграция 0089).
 *
 * Что охраняется и почему:
 *  · три новые колонки nullable / с default — существующие фото и чеки полевого
 *    контура миграция не трогает (Р-A3-7);
 *  · `domain` — ТОТ ЖЕ объект enum, что у money_flow: второй pgEnum с теми же
 *    значениями генератор объявил бы заново, и миграция упала бы на CREATE TYPE;
 *  · индекс (kind, created_at desc) — под витрину «последние артефакты такого
 *    рода»; без него /artifacts идёт полным сканом по таблице с фото;
 *  · `document` помечена устаревшей — иначе следующий читатель схемы снова
 *    примет её за живой субстрат (так и родилась ошибка плана §6.4 п. 4).
 */
describe("attachment как субстрат артефактов (срез A3, миграция 0089)", () => {
  const c = getTableColumns(attachment);

  it("title — text, nullable, без default: у фото полевого контура названия нет", () => {
    assert.equal(getTableName(attachment), "attachment");
    assert.equal(c.title.name, "title");
    assert.equal(c.title.columnType, "PgText");
    assert.equal(c.title.notNull, false);
    assert.equal(c.title.hasDefault, false);
  });

  it("domain — тот же enum `domain`, что у money_flow, nullable", () => {
    assert.equal(c.domain.name, "domain");
    assert.equal(c.domain.columnType, "PgEnumColumn");
    assert.equal(c.domain.notNull, false);
    assert.equal(c.domain.hasDefault, false);
    assert.deepEqual(c.domain.enumValues, domainEnum.enumValues);
    // Один объект enum, а не «такие же значения»: второй pgEnum("domain", …)
    // генератор попытался бы создать ещё раз, и миграция упала бы на CREATE TYPE.
    const своё = (c.domain as unknown as { enum: unknown }).enum;
    const уДенег = (getTableColumns(moneyFlow).domain as unknown as { enum: unknown }).enum;
    assert.equal(своё, domainEnum);
    assert.equal(уДенег, domainEnum);
  });

  it("tags — jsonb NOT NULL DEFAULT '[]': старые строки читаются без null-веток", () => {
    assert.equal(c.tags.name, "tags");
    assert.equal(c.tags.columnType, "PgJsonb");
    assert.equal(c.tags.notNull, true);
    assert.equal(c.tags.hasDefault, true);
    assert.deepEqual(c.tags.default, []);
  });

  it("инвариант полевого контура цел: owner_id и storage_key по-прежнему NOT NULL", () => {
    // Спека §1, решение 2: «у вложения есть хозяин» — артефакт бота привязан к
    // person, а не к nullable owner_id.
    assert.equal(c.ownerId.notNull, true);
    assert.equal(c.storageKey.notNull, true);
    assert.equal(c.kind.default, "photo");
  });

  it("индекс attachment_kind_created_idx: (kind, created_at DESC), сплошной, не уникальный", () => {
    const индексы = getTableConfig(attachment).indexes;
    const idx = индексы.find((i) => i.config.name === "attachment_kind_created_idx");
    assert.ok(idx, "индекса attachment_kind_created_idx нет — витрина пойдёт полным сканом");
    assert.equal(idx.config.unique, false);
    assert.equal(idx.config.where, undefined, "индекс сплошной: фильтр по kind задаёт запрос");
    const колонки = idx.config.columns.map((col) => {
      const ic = col as unknown as { name?: string; indexConfig?: { order?: string } };
      return { name: ic.name, order: ic.indexConfig?.order };
    });
    assert.deepEqual(колонки, [
      { name: "kind", order: "asc" },
      { name: "created_at", order: "desc" },
    ]);
    assert.ok(
      индексы.some((i) => i.config.name === "attachment_owner_idx"),
      "старый индекс галереи (owner_type, owner_id) должен остаться",
    );
  });

  it("document помечена устаревшей ровно той строкой, что зафиксирована в спеке", () => {
    assert.equal(getTableName(document), "document");
    const исходник = readFileSync(path.join(__dirname, "..", "src", "schema.ts"), "utf8");
    assert.match(
      исходник,
      /\/\*\* УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment \(срез A3\)\. \*\/\nexport const document = pgTable\("document", \{/,
      "комментарий над `document` снят или изменён — следующий читатель снова примет её за живой субстрат",
    );
  });
});
```

### Шаг 6. Тесты миграции и журнала — правка `packages/db/src/migrations.test.ts`

- [ ] 6.1. Расширить интерфейс записи журнала. Старый текст:

```ts
interface ЗаписьЖурнала {
  idx: number;
  tag: string;
}
```

Новый текст:

```ts
interface ЗаписьЖурнала {
  idx: number;
  tag: string;
  /** Миллисекунды генерации; мигратор применяет только записи новее последней применённой. */
  when: number;
}
```

- [ ] 6.2. В конец describe «Цепочка миграций: файл ↔ журнал (сторож номера)» — после последнего `it("0082 backfills only verified VendHub maintenance-monitor tasks", …)` — добавить три теста. Старый хвост файла:

```ts
    assert.match(migration, /\^maint:/);
  });
});
```

Новый хвост файла:

```ts
    assert.match(migration, /\^maint:/);
  });

  it("0089 расширяет attachment под артефакты, не трогая существующие строки (Р-A3-7)", () => {
    const sql = readFileSync(path.join(ПАПКА, "0089_attachment_artifacts.sql"), "utf8");
    // Отрицательные проверки — по операторам без комментариев: заголовок
    // миграции сам называет CONCURRENTLY и CREATE TYPE, объясняя, почему их нет.
    const операторы = sql
      .split("\n")
      .filter((строка) => !строка.trimStart().startsWith("--"))
      .join("\n");

    assert.equal(sql.split("--> statement-breakpoint").length, 4, "ровно четыре оператора");
    assert.match(sql, /ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "title" text;/);
    assert.match(sql, /ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "domain" "domain";/);
    assert.match(
      sql,
      /ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '\[\]'::jsonb NOT NULL;/,
    );
    assert.doesNotMatch(
      операторы,
      /"title" text NOT NULL|"domain" "domain" NOT NULL/,
      "title/domain обязаны быть nullable — иначе старым фото нужен бэкфилл выдумкой",
    );
    assert.doesNotMatch(операторы, /CREATE TYPE/, "enum domain есть с 0000 — второй CREATE TYPE уронит миграцию");
    assert.match(
      sql,
      /CREATE INDEX IF NOT EXISTS "attachment_kind_created_idx" ON "attachment" USING btree \("kind","created_at" DESC NULLS LAST\);/,
    );
    // Мигратор drizzle применяет файл ВНУТРИ транзакции (pg-core/dialect.js:
    // session.transaction), CONCURRENTLY там запрещён: оператор упал бы и
    // повесил автодеплой (0070/0071/0073 — тот же вывод). Причина обязана быть
    // записана в самом файле, чтобы следующий автор не «улучшил» индекс.
    assert.doesNotMatch(операторы, /CONCURRENTLY/);
    assert.match(sql, /CONCURRENTLY в транзакции запрещён/);
    // Существующие фото и чеки не трогаем: ни UPDATE, ни DELETE, ни смены типов, ни DROP.
    assert.doesNotMatch(операторы, /^\s*(UPDATE|DELETE|DROP|ALTER TABLE "attachment" ALTER COLUMN)/m);
    assert.doesNotMatch(операторы, /"document"/, "document не сносится в этом срезе — только помечается в схеме");
    // Откат описан в самом файле — оператору не придётся выводить его из diff.
    for (const шаг of [
      'DROP INDEX IF EXISTS "attachment_kind_created_idx"',
      'ALTER TABLE "attachment" DROP COLUMN IF EXISTS "tags"',
      'ALTER TABLE "attachment" DROP COLUMN IF EXISTS "domain"',
      'ALTER TABLE "attachment" DROP COLUMN IF EXISTS "title"',
      'DELETE FROM "drizzle"."__drizzle_migrations" WHERE "created_at" =',
    ]) {
      assert.ok(sql.includes(`--   ${шаг}`), `в комментарии отката нет шага: ${шаг}`);
    }
  });

  it("0089_attachment_artifacts: запись журнала на месте, when позже 0088", () => {
    const пред = записи.find((e) => e.idx === 88);
    const своя = записи.find((e) => e.idx === 89);
    assert.ok(пред && своя, "в журнале нет записей 0088/0089");
    assert.equal(своя.tag, "0089_attachment_artifacts");
    assert.equal(пред.tag, "0088_agent_run");
    assert.ok(своя.when > пред.when, "when 0089 не позже 0088 — мигратор её молча пропустит");
  });

  it("when в журнале строго растёт: мигратор применяет только записи новее последней применённой", () => {
    // pg-core/dialect.js сравнивает folderMillis (= when) с created_at последней
    // применённой. Запись с меньшим when не применится — без ошибки, без строки в
    // логе, и колонок в проде не будет. Рукописная правка when — верный способ
    // получить ровно это.
    for (let i = 1; i < записи.length; i++) {
      assert.ok(
        записи[i].when > записи[i - 1].when,
        `${записи[i].tag}: when ${записи[i].when} не больше предыдущего ${записи[i - 1].when}`,
      );
    }
  });
});
```

### Шаг 7. Сценарий на настоящем SQL — новый файл `tools/pglite-checks/check-0089.mjs`

CI-шаг «Scenarios on real SQL» подхватывает все `check-*.mjs` каталога сам (поиск по каталогу, не список). Локально — pglite из `~/pgtest` (см. `tools/pglite-checks/README.md`).

- [ ] 7.1. Создать файл с содержимым:

```js
// Срез A3, миграция 0089 на настоящем SQL: 0088 → строка полевого контура → 0089 →
// строка цела, колонки с честными значениями → откат из комментария миграции →
// колонок нет, строки на месте → повторный прогон 0089 (IF NOT EXISTS) применяется заново.
// Движок — pglite локально, сервис postgres:17 в CI (см. run-migrations.mjs).
import assert from "node:assert/strict";
import { migratedDb, ENGINE } from "./run-migrations.mjs";

const OWNER = "00000000-0000-0000-0000-00000000a301";
const ФОТО = "00000000-0000-0000-0000-00000000a389";
const ДОК = "00000000-0000-0000-0000-00000000a390";

const { client, applyMigrations } = await migratedDb({ upto: 88 });
const run = async (sql) => (await client.query(sql)).rows;
const колонки = async () =>
  run(
    `select column_name, udt_name, is_nullable, column_default
       from information_schema.columns
      where table_name = 'attachment' and column_name in ('title', 'domain', 'tags')
      order by column_name`,
  );

// Строка полевого контура ДО 0089: фото карточки, без названия и направления.
await run(
  `insert into attachment (id, owner_type, owner_id, kind, storage_key, mime, bytes, created_by)
   values ('${ФОТО}', 'entity', '${OWNER}', 'photo', 'k/a389.jpg', 'image/jpeg', 100, 'staff:1')`,
);
assert.deepEqual(await колонки(), [], "на 0088 новых колонок ещё нет");

await applyMigrations();

let cols = await колонки();
assert.deepEqual(
  cols.map((c) => [c.column_name, c.udt_name, c.is_nullable]),
  [
    ["domain", "domain", "YES"],
    ["tags", "jsonb", "NO"],
    ["title", "text", "YES"],
  ],
  "типы и nullable трёх колонок",
);
assert.match(String(cols.find((c) => c.column_name === "tags").column_default), /'\[\]'::jsonb/);

// Старая строка цела и читается без null-веток: tags = [] от DEFAULT, title/domain NULL.
const [старая] = await run(
  `select title, domain, tags::text as tags, storage_key from attachment where id = '${ФОТО}'`,
);
assert.equal(старая.title, null);
assert.equal(старая.domain, null);
assert.equal(старая.tags, "[]");
assert.equal(старая.storage_key, "k/a389.jpg");

// Новая строка-артефакт: enum принимает значения money_flow, метки пишутся; чужое значение отвергается.
await run(
  `insert into attachment (id, owner_type, owner_id, kind, storage_key, title, domain, tags)
   values ('${ДОК}', 'person', '${OWNER}', 'doc', 'k/a390.docx', 'Дебиторка GLOBERENT за август', 'globerent', '["bot"]'::jsonb)`,
);
await assert.rejects(
  run(
    `insert into attachment (id, owner_type, owner_id, kind, storage_key, domain)
     values ('00000000-0000-0000-0000-00000000a391', 'person', '${OWNER}', 'doc', 'k/a391', 'nope')`,
  ),
  /invalid input value for enum domain/,
);
const [док] = await run(`select title, domain, tags::text as tags from attachment where id = '${ДОК}'`);
assert.deepEqual([док.title, док.domain, док.tags], ["Дебиторка GLOBERENT за август", "globerent", '["bot"]']);

// Индекс есть, не уникальный, по (kind, created_at DESC).
const [idx] = await run(
  `select indexdef from pg_indexes where tablename = 'attachment' and indexname = 'attachment_kind_created_idx'`,
);
assert.ok(idx, "индекса attachment_kind_created_idx нет");
assert.match(
  idx.indexdef,
  /^CREATE INDEX attachment_kind_created_idx ON public\.attachment USING btree \(kind, created_at DESC\)$/,
);

// Откат — ровно операторы из заголовка миграции 0089.
await run(`DROP INDEX IF EXISTS "attachment_kind_created_idx"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "tags"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "domain"`);
await run(`ALTER TABLE "attachment" DROP COLUMN IF EXISTS "title"`);
await run(
  `DELETE FROM "drizzle"."__drizzle_migrations"
    WHERE "created_at" = (select max("created_at") from "drizzle"."__drizzle_migrations")`,
);
assert.deepEqual(await колонки(), [], "после отката колонок быть не должно");
const [n] = await run(`select count(*)::int as n from attachment`);
assert.equal(n.n, 2, "откат не удаляет строк — файлы остаются");

// Повторный прогон: IF NOT EXISTS + журнал мигратора без 0089 → применяется заново без ошибок.
await applyMigrations();
cols = await колонки();
assert.equal(cols.length, 3, "после повторного прогона колонки снова на месте");
const [idx2] = await run(
  `select 1 from pg_indexes where tablename = 'attachment' and indexname = 'attachment_kind_created_idx'`,
);
assert.ok(idx2, "после повторного прогона индекс снова на месте");
const [m] = await run(`select count(*)::int as n from "drizzle"."__drizzle_migrations"`);
assert.equal(m.n, 90, "журнал мигратора: 0000…0089 = 90 записей");

console.log(`0088 → 0089 → откат → 0089 (${ENGINE}): attachment расширена, старые строки целы, откат обратим`);
await client.close();
```

### Шаг 8. Проверки

- [ ] 8.1. Сборка и юнит-тесты (dist чистим, чтобы не гонять «трупы» удалённых тестов):

```bash
cd /Users/js/Developer/mydon
rm -rf packages/db/dist
pnpm --filter @mydon/shared build && pnpm --filter @mydon/db build
pnpm --filter @mydon/db test
```

Ожидание: все тесты зелёные, среди них новые: «attachment как субстрат артефактов…» (6 тестов) и в «Цепочка миграций…» — «0089 расширяет attachment…», «0089_attachment_artifacts: запись журнала…», «when в журнале строго растёт…», а также прежний «head-снапшот совпадает со schema.ts» (он подтверждает, что снапшот 0089 снят с правленой схемы).

- [ ] 8.2. Типы и линт:

```bash
pnpm --filter @mydon/db typecheck && pnpm --filter @mydon/db lint
pnpm --filter @mydon/core typecheck    # AttachmentRow = $inferSelect расширился; должно пройти без правок Core
```

- [ ] 8.3. Настоящий SQL (любой из двух вариантов из `tools/pglite-checks/README.md`):

```bash
# вариант A — pglite без сервера (один раз: mkdir -p ~/pgtest && (cd ~/pgtest && npm i --no-save @electric-sql/pglite@0.3))
NODE_PATH=~/pgtest/node_modules node tools/pglite-checks/run-migrations.mjs
NODE_PATH=~/pgtest/node_modules node tools/pglite-checks/check-0089.mjs

# вариант B — postgres:17 в докере (та же версия, что прод)
docker run -d --name pg17 -e POSTGRES_USER=mydon -e POSTGRES_PASSWORD=mydon -e POSTGRES_DB=mydon -p 55432:5432 postgres:17
CHECKS_DATABASE_URL=postgres://mydon:mydon@127.0.0.1:55432/mydon node tools/pglite-checks/run-migrations.mjs
CHECKS_DATABASE_URL=postgres://mydon:mydon@127.0.0.1:55432/mydon node tools/pglite-checks/check-0089.mjs
```

Ожидаемый вывод: `ok (<движок>): таблиц N, миграций применено 90, … мс` и `0088 → 0089 → откат → 0089 (<движок>): attachment расширена, старые строки целы, откат обратим`.

- [ ] 8.4. Гейт миграций до мержа (CI на PR в этом репо отключён осознанно): `gh workflow run ci.yml --ref <ваша ветка>` и дождаться зелёных шагов «Migrations (real postgres)» и «Scenarios on real SQL».

- [ ] 8.5. Проверка «падает при откате» (каждая правка закрыта ассертом):

```bash
git stash push -- packages/db/src/schema.ts
pnpm --filter @mydon/db build 2>&1 | tail -5     # ожидание: ошибка tsc — у attachment нет title/domain/tags (тест схемы не компилируется)
git stash pop
git stash push -- packages/db/drizzle/0089_attachment_artifacts.sql
pnpm --filter @mydon/db build && pnpm --filter @mydon/db test 2>&1 | grep -E "0089|✖" | head   # ожидание: красные «0089 расширяет attachment…» и «у каждого .sql есть запись журнала…»
git stash pop
```

- [ ] 8.6. Коммит только своих файлов (в дереве есть чужие untracked `.agents/skills/*` от параллельного Codex — `git add -A` не использовать):

```bash
git add packages/db/src/schema.ts packages/db/src/migrations.test.ts packages/db/src/attachment-artifacts-schema.test.ts \
        packages/db/drizzle/0089_attachment_artifacts.sql packages/db/drizzle/meta/0089_snapshot.json packages/db/drizzle/meta/_journal.json \
        tools/pglite-checks/check-0089.mjs
git commit -m "feat(db): 0089 — attachment как субстрат артефактов: title/domain/tags, индекс (kind, created_at); document помечена устаревшей (срез A3)"
```

## Задача 2: модуль artifacts в Core — `GET /artifacts`

**Предусловие.** Задача 1 выполнена: в `packages/db/src/schema.ts` у `attachment` есть `title: text("title")`, `domain: domainEnum("domain")`, `tags: jsonb("tags")…default([]).notNull()` (с `.$type<string[]>()` или без — код ниже терпит оба варианта), и пакет пересобран: `pnpm --filter @mydon/db build`. Core компилируется против `packages/db/dist` — без пересборки `attachment.title` для tsc не существует.

**Что уже проверено автором раздела.** Весь код ниже скомпилирован с `strict` + `exactOptionalPropertyTypes` + `noUnusedLocals` против двойника схемы с колонками 0089; 31 юнит-тест зелёный; сценарий на настоящем SQL (pglite 17.5, вся цепочка миграций репо + DDL 0089) прошёл: три страницы по 2 при трёх равных `created_at` — без повторов и пропусков. Правки «по месту» не нужны — переносить дословно.

### 2.1. Сервис

- [ ] Создать `apps/core/src/artifacts/artifacts.service.ts`:

```ts
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { attachment } from "@mydon/db";
import type { Domain } from "@mydon/shared";
import { and, desc, eq, gte, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { DB, type Db } from "../db/db.module";

/**
 * Кольцо артефактов (срез A3): чтение вложений как архива произведённой
 * работы — документов бота, фото и чеков полевого контура — по типу,
 * владельцу, направлению, дате и названию.
 *
 * СУБСТРАТ — `attachment`, а не `document` (спека §1): у вложений живое
 * хранилище и настоящие строки, у `document` — ни писателей, ни читателей.
 * Артефакт агента — ещё один `ownerType`, а не новая сущность. Сервис ТОЛЬКО
 * читает: письмо остаётся за `AttachmentsService.upload` (`POST /attachments`),
 * чтобы белый список типов файла и ключ хранилища жили в одном месте, а
 * содержимое отдаёт существующий `GET /attachments/:id/raw`.
 */

/**
 * Типы вложений — ровно те, что принимает `UploadDto.kind`
 * (`attachments.controller.ts`). Чужое значение фильтра — 400, а не тихо
 * пустой архив: `?kind=video` иначе выглядел бы как «ничего не было».
 */
export const ARTIFACT_KINDS = ["photo", "receipt", "doc"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Потолок страницы: одна рамка на DTO и на сервис, как `LIST_MAX` у журнала прогонов. */
export const LIST_MAX = 100;
const DEFAULT_LIMIT = 50;

export interface ArtifactsFilter {
  kind?: ArtifactKind;
  ownerType?: string;
  ownerId?: string;
  domain?: Domain;
  /** Окно по `createdAt` — по нему же сортируется и режется страница. */
  from?: Date;
  to?: Date;
  /** Подстрока названия, без учёта регистра. */
  q?: string;
  limit?: number;
  /** `next` предыдущей страницы. */
  cursor?: string;
}

/** Строка витрины. `storageKey` и содержимого здесь нет намеренно (см. ARTIFACT_COLUMNS). */
export interface ArtifactRow {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  title: string | null;
  domain: Domain | null;
  tags: string[];
  mime: string | null;
  bytes: number | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ArtifactsPage {
  items: ArtifactRow[];
  /** Курсор следующей страницы; `null` — страница последняя. */
  next: string | null;
  /** Часы Core: панель считает давность от них, а не от своих. */
  now: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Курсор страницы: `base64url("<created_at ISO>|<id>")`.
 *
 * Непрозрачный для клиента, но составной для нас: страница режется по
 * кортежу `(created_at, id)`, а не по одному времени — бот кладёт документ
 * и связанные файлы в одну секунду, и на границе страницы строки с равным
 * временем либо пропадали бы, либо повторялись. `base64url`, а не `base64`:
 * курсор едет в строке запроса, где `+` декодируется в пробел, а `/` и `=`
 * требуют экранирования — «непрозрачный» курсор ломался бы при простом
 * копировании ссылки на страницу.
 */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

/** Обратный разбор; `null` — курсор чужой или испорчен (наружу — 400, а не 500 драйвера). */
export function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const sep = text.indexOf("|");
  if (sep <= 0) return null;
  const createdAt = new Date(text.slice(0, sep));
  const id = text.slice(sep + 1);
  if (!Number.isFinite(createdAt.getTime()) || !UUID_RE.test(id)) return null;
  return { createdAt, id };
}

/**
 * Поиск по названию — тот же приём, что `nameMatches` в entities.service.ts,
 * и по тем же двум причинам: `%`/`_` — подстановочные знаки LIKE (без
 * экранирования «100%» находил бы весь архив), а ILIKE не сворачивает регистр
 * кириллицы при локали C — «дебиторка» строчными не нашла бы «Дебиторка».
 *
 * Коллация `"pg_c_utf8"` — встроенный провайдер PostgreSQL 17 (прод, CI и
 * pglite — все 17-й версии), а не ICU `"und-x-icu"`, как у реестра: сценарии
 * на настоящем SQL идут локально на pglite, а он собран БЕЗ ICU — любая ICU-
 * коллация там падает «ICU is not supported in this build». Встроенная
 * сворачивает регистр по таблицам Unicode («Дебиторка» ↔ «дебиторка», «Ё» ↔
 * «ё») и не зависит ни от ICU, ни от локали, с которой создана база.
 */
export function titleMatches(q: string): SQL {
  const escaped = q.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return sql`${attachment.title} ILIKE ${`%${escaped}%`} ESCAPE '\\' COLLATE "pg_c_utf8"`;
}

/**
 * Столбцы витрины перечислены, а не `select()` целиком: `storageKey` — путь
 * в томе или ключ S3, наружу он не нужен и не должен попадать (Р-A3-3), а
 * явный список делает его отсутствие проверяемым тестом по ключам объекта.
 */
const ARTIFACT_COLUMNS = {
  id: attachment.id,
  ownerType: attachment.ownerType,
  ownerId: attachment.ownerId,
  kind: attachment.kind,
  title: attachment.title,
  domain: attachment.domain,
  tags: attachment.tags,
  mime: attachment.mime,
  bytes: attachment.bytes,
  createdBy: attachment.createdBy,
  createdAt: attachment.createdAt,
};

/** Что отдаёт выборка по ARTIFACT_COLUMNS; `tags` — jsonb, тип не доказан базой. */
interface Selected {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  title: string | null;
  domain: Domain | null;
  tags: unknown;
  mime: string | null;
  bytes: number | null;
  createdBy: string | null;
  createdAt: Date;
}

/** Теги — jsonb; в базу могли положить не список (ручной SQL) — наружу всегда список строк. */
function tagsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t: unknown): t is string => typeof t === "string") : [];
}

function toRow(r: Selected): ArtifactRow {
  return {
    id: r.id,
    ownerType: r.ownerType,
    ownerId: r.ownerId,
    kind: r.kind,
    title: r.title,
    domain: r.domain,
    tags: tagsOf(r.tags),
    mime: r.mime,
    bytes: r.bytes,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Целое в рамках 1..LIST_MAX; всё бессмысленное — «не задан» (как в
 * `RunsService.list`): DTO уже отвергает мусор 400-й, но сервис зовут и
 * напрямую (сценарии, будущий MCP), и NaN в `limit $1` — это 500 драйвера.
 */
function pageLimit(asked: number | undefined): number {
  const n = typeof asked === "number" && Number.isFinite(asked) ? Math.trunc(asked) : 0;
  return n > 0 ? Math.min(n, LIST_MAX) : DEFAULT_LIMIT;
}

@Injectable()
export class ArtifactsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Страница архива: новые сверху, режется по кортежу `(created_at, id)`.
   *
   * `excludePersonal` — тот же гейт, что у `GET /tasks` (R-P5-7b): без домена
   * в запросе выдача включала бы личный контур, и при включённом ужесточении
   * не-владелец видел бы названия его документов.
   */
  async list(
    filter: ArtifactsFilter = {},
    opts: { excludePersonal?: boolean; now?: Date } = {},
  ): Promise<ArtifactsPage> {
    const conds: SQL[] = [];
    if (filter.kind !== undefined) conds.push(eq(attachment.kind, filter.kind));
    if (filter.ownerType !== undefined) conds.push(eq(attachment.ownerType, filter.ownerType));
    if (filter.ownerId !== undefined) conds.push(eq(attachment.ownerId, filter.ownerId));
    if (filter.domain !== undefined) conds.push(eq(attachment.domain, filter.domain));
    if (filter.from !== undefined) conds.push(gte(attachment.createdAt, filter.from));
    if (filter.to !== undefined) conds.push(lte(attachment.createdAt, filter.to));
    if (filter.q !== undefined) conds.push(titleMatches(filter.q));
    if (filter.cursor !== undefined) {
      const c = decodeCursor(filter.cursor);
      if (c === null) {
        throw new BadRequestException("cursor: не распознан — возьмите `next` из предыдущего ответа");
      }
      // Строго «раньше кортежа» по той же паре столбцов, что в ORDER BY:
      // сравнение по одному created_at на равном времени либо теряло бы
      // строки, либо повторяло их на стыке страниц.
      const before = or(
        lt(attachment.createdAt, c.createdAt),
        and(eq(attachment.createdAt, c.createdAt), lt(attachment.id, c.id)),
      );
      if (before !== undefined) conds.push(before);
    }
    if (opts.excludePersonal === true) {
      // `is distinct from`, а не `<> 'personal'`: у вложений полевого контура
      // домен NULL, и обычное сравнение вычеркнуло бы их из архива.
      conds.push(sql`${attachment.domain} is distinct from 'personal'`);
    }

    const limit = pageLimit(filter.limit);
    const rows: Selected[] = await this.db
      .select(ARTIFACT_COLUMNS)
      .from(attachment)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(attachment.createdAt), desc(attachment.id))
      .limit(limit);
    const last = rows.length === limit ? rows[rows.length - 1] : undefined;
    return {
      items: rows.map(toRow),
      // Ровно `limit` строк — страница могла быть не последней; меньше —
      // точно последняя. Лишний пустой запрос дешевле пропущенной строки.
      next: last !== undefined ? encodeCursor(last) : null,
      now: (opts.now ?? new Date()).toISOString(),
    };
  }
}
```

### 2.2. Контроллер и DTO

- [ ] Создать `apps/core/src/artifacts/artifacts.controller.ts`:

```ts
import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { DOMAINS, type Domain } from "@mydon/shared";
import { excludePersonal } from "../common/owner-enforcement";
import { ReadTokenGuard } from "../common/read-token.guard";
import { DB, type Db } from "../db/db.module";
import {
  ARTIFACT_KINDS,
  ArtifactsService,
  LIST_MAX,
  type ArtifactKind,
  type ArtifactsFilter,
  type ArtifactsPage,
} from "./artifacts.service";

/**
 * Фильтры архива. Всё необязательно; чужое значение — 400 со списком
 * допустимых, а не тихо отброшенный фильтр (как `?outcome=` у журнала
 * прогонов): «отфильтрованный» ответ, который на деле полный, врёт.
 */
export class ArtifactsQueryDto {
  @IsOptional()
  @IsIn([...ARTIFACT_KINDS], { message: `kind: ${ARTIFACT_KINDS.join(" | ")}` })
  kind?: ArtifactKind;

  /** Тот же шаблон, что у `UploadDto.ownerType`: иной тип владельца в базе не появится. */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{0,31}$/, {
    message: "ownerType: латиница в нижнем регистре, цифры и подчёркивание, до 32 символов",
  })
  ownerType?: string;

  @IsOptional()
  @IsUUID(undefined, { message: "ownerId: нужен UUID" })
  ownerId?: string;

  @IsOptional()
  @IsIn([...DOMAINS], { message: `domain: ${DOMAINS.join(" | ")}` })
  domain?: Domain;

  /** Окно по `createdAt`; дата без времени — полночь UTC (05:00 Ташкента). */
  @IsOptional()
  @IsISO8601({}, { message: "from: дата в формате ISO" })
  from?: string;

  @IsOptional()
  @IsISO8601({}, { message: "to: дата в формате ISO" })
  to?: string;

  /** Подстрока названия. Пустая строка — «фильтр не задан», как `?agent=` у деки. */
  @IsOptional()
  @IsString({ message: "q: строка" })
  @MaxLength(200, { message: "q: не длиннее 200 символов" })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit должен быть целым числом" })
  @Min(1, { message: "limit не может быть меньше 1" })
  @Max(LIST_MAX, { message: `limit не может быть больше ${LIST_MAX}` })
  limit?: number;

  /** `next` предыдущего ответа; разбор — в сервисе, испорченный курсор — 400. */
  @IsOptional()
  @IsString({ message: "cursor: строка" })
  @MaxLength(256, { message: "cursor: не длиннее 256 символов" })
  cursor?: string;
}

/**
 * Архив артефактов (срез A3, Р-A3-3): строки вложений без содержимого и без
 * ключа хранилища; сам файл — `GET /attachments/:id/raw`.
 *
 * ТОКЕН ОБЯЗАТЕЛЕН И НА ЧТЕНИЕ: названия документов бота — пересказ работы
 * агентов по делам владельца («Дебиторка GLOBERENT за август»), то же
 * содержание, ради которого закрыты `/routines/runs` и `/agents/status`.
 * Guard на КЛАССЕ, а не на маршруте: будущие `@Get` архива закрыты по
 * умолчанию, а не по памяти автора (как `AppsController`).
 */
@Controller("artifacts")
@UseGuards(ReadTokenGuard)
export class ArtifactsController {
  constructor(
    private readonly artifacts: ArtifactsService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get()
  async list(@Query() q: ArtifactsQueryDto, @Req() req: Request): Promise<ArtifactsPage> {
    const text = q.q?.trim();
    const filter: ArtifactsFilter = {
      ...(q.kind !== undefined ? { kind: q.kind } : {}),
      ...(q.ownerType !== undefined ? { ownerType: q.ownerType } : {}),
      ...(q.ownerId !== undefined ? { ownerId: q.ownerId } : {}),
      ...(q.domain !== undefined ? { domain: q.domain } : {}),
      ...(q.from !== undefined ? { from: new Date(q.from) } : {}),
      ...(q.to !== undefined ? { to: new Date(q.to) } : {}),
      ...(text !== undefined && text.length > 0 ? { q: text } : {}),
      ...(q.limit !== undefined ? { limit: q.limit } : {}),
      ...(q.cursor !== undefined && q.cursor.length > 0 ? { cursor: q.cursor } : {}),
    };
    // Тот же domain-less обход, что у `GET /tasks` (R-P5-7b): ужесточение
    // включено И запрос не доказан owner-токеном → личный контур вырезается.
    // Флаг выключен (дефолт) → false → выдача прода не меняется.
    return this.artifacts.list(filter, { excludePersonal: await excludePersonal(req, this.db) });
  }
}
```

### 2.3. Модуль

- [ ] Создать `apps/core/src/artifacts/artifacts.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ReadTokenGuard } from "../common/read-token.guard";
import { ArtifactsController } from "./artifacts.controller";
import { ArtifactsService } from "./artifacts.service";

/**
 * Кольцо артефактов (срез A3): чтение архива вложений одним маршрутом.
 *
 * `AttachmentsModule` НЕ импортируем: витрина читает таблицу напрямую и в
 * хранилище не ходит — содержимое отдаёт существующий
 * `GET /attachments/:id/raw`. `ReadTokenGuard` — провайдером, чтобы Nest
 * резолвил его через DI (как в `AppsModule`), а не создавал вслепую.
 */
@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsService, ReadTokenGuard],
})
export class ArtifactsModule {}
```

### 2.4. Регистрация в `apps/core/src/app.module.ts`

- [ ] В блоке импортов после строки `import { ApprovalsModule } from "./approvals/approvals.module";` добавить:

```ts
import { ArtifactsModule } from "./artifacts/artifacts.module";
```

- [ ] В массиве `imports: [...]` после строки `    AttachmentsModule,` добавить строку:

```ts
    ArtifactsModule,
```

Итог фрагмента:

```ts
    DocsModule,
    AttachmentsModule,
    ArtifactsModule,
    AuditModule,
```

### 2.5. Тест сервиса

- [ ] Создать `apps/core/src/artifacts/artifacts.service.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  ARTIFACT_KINDS,
  ArtifactsService,
  LIST_MAX,
  decodeCursor,
  encodeCursor,
  titleMatches,
} from "./artifacts.service";

type Row = Record<string, unknown>;

/** Стаб выборки: запоминает столбцы, условие, порядок и limit; отдаёт заданные строки. */
function listStub(rows: Row[] = []) {
  const captured: {
    columns: Record<string, unknown> | undefined;
    where: unknown;
    orderBy: unknown[];
    limit: number | null;
    selects: number;
  } = { columns: undefined, where: undefined, orderBy: [], limit: null, selects: 0 };
  const chain = {
    where: (c: unknown) => {
      captured.where = c;
      return chain;
    },
    orderBy: (...o: unknown[]) => {
      captured.orderBy = o;
      return chain;
    },
    limit: async (n: number) => {
      captured.limit = n;
      return rows;
    },
  };
  const db = {
    select: (columns: Record<string, unknown>) => {
      captured.selects += 1;
      captured.columns = columns;
      return { from: () => chain };
    },
  } as never;
  return { db, captured };
}

/** Текст и параметры условия — заглушка SQL не исполняет, а перепутанный столбец обязан падать. */
function render(query: unknown): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
}

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const AT = new Date("2026-09-08T10:00:00.000Z");
const NOW = new Date("2026-09-08T12:00:00.000Z");

/** Строка, как если бы её вернул `select *`: storageKey внутри — наружу уезжать не должен. */
const row = (id: string, over: Row = {}): Row => ({
  id,
  ownerType: "person",
  ownerId: ID1,
  kind: "doc",
  title: "Дебиторка GLOBERENT за август",
  domain: "globerent",
  tags: ["bot"],
  mime: "application/pdf",
  bytes: 12345,
  createdBy: "bot",
  createdAt: AT,
  storageKey: "person/x/f.pdf",
  ...over,
});

describe("ArtifactsService.list — рамки страницы", () => {
  it("по умолчанию 50, потолок LIST_MAX, мусорный limit не уезжает в SQL", async () => {
    const plain = listStub();
    await new ArtifactsService(plain.db).list();
    assert.equal(plain.captured.limit, 50);
    assert.equal(plain.captured.where, undefined, "без фильтров условие не добавляем");

    const huge = listStub();
    await new ArtifactsService(huge.db).list({ limit: 5000 });
    assert.equal(huge.captured.limit, LIST_MAX);

    for (const bad of [Number("abc"), 0, -5]) {
      const s = listStub();
      await new ArtifactsService(s.db).list({ limit: bad });
      assert.equal(s.captured.limit, 50, `limit=${bad} — это «не задан», а не пустой архив и не 500`);
    }
    const fraction = listStub();
    await new ArtifactsService(fraction.db).list({ limit: 10.5 });
    assert.equal(fraction.captured.limit, 10, "дробь драйвер не примет в LIMIT");
  });

  it("новые сверху: порядок — created_at desc, id desc (та же пара, что режет курсор)", async () => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list();
    assert.equal(captured.orderBy.length, 2, "сортировка по одному created_at не даёт устойчивых страниц");
    assert.match(render(captured.orderBy[0]).sql, /"attachment"\."created_at" desc/);
    assert.match(render(captured.orderBy[1]).sql, /"attachment"\."id" desc/);
  });

  it("часы Core уезжают в ответ строкой ISO", async () => {
    const { db } = listStub();
    const page = await new ArtifactsService(db).list({}, { now: NOW });
    assert.equal(page.now, "2026-09-08T12:00:00.000Z");
  });

  it("типы вложений — те же, что принимает UploadDto.kind", () => {
    assert.deepEqual([...ARTIFACT_KINDS], ["photo", "receipt", "doc"]);
  });
});

describe("ArtifactsService.list — каждый фильтр своим столбцом", () => {
  const one = async (filter: Parameters<ArtifactsService["list"]>[0]) => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list(filter);
    return render(captured.where);
  };

  it("kind", async () => {
    const { sql, params } = await one({ kind: "doc" });
    assert.match(sql, /^"attachment"\."kind" = \$1$/);
    assert.deepEqual(params, ["doc"]);
  });

  it("ownerType", async () => {
    const { sql, params } = await one({ ownerType: "person" });
    assert.match(sql, /^"attachment"\."owner_type" = \$1$/);
    assert.deepEqual(params, ["person"]);
  });

  it("ownerId", async () => {
    const { sql, params } = await one({ ownerId: ID1 });
    assert.match(sql, /^"attachment"\."owner_id" = \$1$/);
    assert.deepEqual(params, [ID1]);
  });

  it("domain", async () => {
    const { sql, params } = await one({ domain: "vendhub" });
    assert.match(sql, /^"attachment"\."domain" = \$1$/);
    assert.deepEqual(params, ["vendhub"]);
  });

  it("from и to — окно по created_at, включительно с обеих сторон", async () => {
    const from = await one({ from: AT });
    assert.match(from.sql, /^"attachment"\."created_at" >= \$1$/);
    // Параметры-даты драйвер получает строками ISO — так их маппит колонка timestamp.
    assert.deepEqual(from.params, [AT.toISOString()]);
    const to = await one({ to: AT });
    assert.match(to.sql, /^"attachment"\."created_at" <= \$1$/);
    const both = await one({ from: AT, to: NOW });
    assert.match(both.sql, /"created_at" >= \$1 and "attachment"\."created_at" <= \$2/);
  });

  it("q — ILIKE по title с экранированием и явной коллацией", async () => {
    const { sql, params } = await one({ q: "Дебиторка 100%_" });
    assert.match(sql, /^"attachment"\."title" ILIKE \$1 ESCAPE '\\' COLLATE "pg_c_utf8"$/);
    assert.deepEqual(params, ["%Дебиторка 100\\%\\_%"]);
  });

  it("все шесть вместе — шесть условий, ни одно не потерялось", async () => {
    const { sql, params } = await one({
      kind: "doc",
      ownerType: "person",
      ownerId: ID1,
      domain: "globerent",
      from: AT,
      to: NOW,
    });
    assert.equal(params.length, 6);
    for (const col of ["kind", "owner_type", "owner_id", "domain"]) {
      assert.match(sql, new RegExp(`"attachment"\\."${col}" = \\$\\d`), `фильтр по ${col} потерян`);
    }
    assert.match(sql, /"created_at" >= \$\d/);
    assert.match(sql, /"created_at" <= \$\d/);
  });

  it("excludePersonal вырезает личный контур через is distinct from (NULL-домен остаётся)", async () => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list({}, { excludePersonal: true });
    assert.match(render(captured.where).sql, /^"attachment"\."domain" is distinct from 'personal'$/);

    const open = listStub();
    await new ArtifactsService(open.db).list({ kind: "doc" }, { excludePersonal: false });
    assert.doesNotMatch(render(open.captured.where).sql, /personal/, "по умолчанию выдача прода не меняется");
  });
});

describe("titleMatches — подстановочные знаки и регистр кириллицы", () => {
  it("экранирует %, _ и обратную косую", () => {
    assert.deepEqual(render(titleMatches("100%")).params, ["%100\\%%"]);
    assert.deepEqual(render(titleMatches("ООО _Строй")).params, ["%ООО \\_Строй%"]);
    assert.deepEqual(render(titleMatches("путь\\файл")).params, ["%путь\\\\файл%"]);
    assert.deepEqual(render(titleMatches("Глоберент")).params, ["%Глоберент%"]);
  });

  it("коллация встроенная (pg_c_utf8), а не ICU: сценарии идут и на pglite, где ICU нет", () => {
    const { sql } = render(titleMatches("тест"));
    assert.match(sql, /ILIKE/);
    assert.match(sql, /ESCAPE '\\'/);
    assert.match(sql, /COLLATE "pg_c_utf8"/);
    assert.doesNotMatch(sql, /und-x-icu/);
  });
});

describe("Курсор — кортеж (created_at, id)", () => {
  it("кодируется base64url и разбирается обратно без потерь", () => {
    const cur = encodeCursor({ createdAt: AT, id: ID1 });
    assert.match(cur, /^[A-Za-z0-9_-]+$/, "в строке запроса не должно быть +, / и =");
    assert.deepEqual(decodeCursor(cur), { createdAt: AT, id: ID1 });
    assert.equal(Buffer.from(cur, "base64url").toString("utf8"), `${AT.toISOString()}|${ID1}`);
  });

  it("испорченный курсор — null, а не Invalid Date в SQL", () => {
    for (const bad of ["", "abc", Buffer.from("|").toString("base64url"), Buffer.from("вчера|" + ID1).toString("base64url"),
      Buffer.from(AT.toISOString() + "|not-uuid").toString("base64url"), Buffer.from(AT.toISOString()).toString("base64url")]) {
      assert.equal(decodeCursor(bad), null, `«${bad}» обязан быть отвергнут`);
    }
  });

  it("испорченный курсор в list → 400, база не тронута", async () => {
    const { db, captured } = listStub();
    await assert.rejects(() => new ArtifactsService(db).list({ cursor: "abc" }), BadRequestException);
    assert.equal(captured.selects, 0);
  });

  it("условие страницы — строго раньше кортежа по тем же столбцам, что ORDER BY", async () => {
    const { db, captured } = listStub();
    await new ArtifactsService(db).list({ cursor: encodeCursor({ createdAt: AT, id: ID2 }) });
    const { sql, params } = render(captured.where);
    assert.match(
      sql,
      /^\("attachment"\."created_at" < \$1 or \("attachment"\."created_at" = \$2 and "attachment"\."id" < \$3\)\)$/,
    );
    assert.deepEqual(params, [AT.toISOString(), AT.toISOString(), ID2]);
  });

  it("next — курсор последней строки, только когда строк ровно limit", async () => {
    const full = listStub([row(ID1), row(ID2, { createdAt: new Date(AT.getTime() - 1000) })]);
    const page = await new ArtifactsService(full.db).list({ limit: 2 });
    assert.notEqual(page.next, null);
    assert.deepEqual(decodeCursor(page.next ?? ""), { createdAt: new Date(AT.getTime() - 1000), id: ID2 });

    const short = listStub([row(ID1)]);
    assert.equal((await new ArtifactsService(short.db).list({ limit: 2 })).next, null);

    const empty = listStub([]);
    assert.equal((await new ArtifactsService(empty.db).list({ limit: 2 })).next, null);
  });

  it("две страницы не пересекаются: вторая режется строго после последней строки первой", async () => {
    // Три строки с РАВНЫМ created_at — тот случай, где курсор по одному
    // времени терял бы или дублировал строку. Порядок базы: id desc.
    const первая = listStub([row(ID3), row(ID2)]);
    const p1 = await new ArtifactsService(первая.db).list({ limit: 2 });
    assert.deepEqual(p1.items.map((i) => i.id), [ID3, ID2]);

    const вторая = listStub([row(ID1)]);
    const p2 = await new ArtifactsService(вторая.db).list({ limit: 2, cursor: p1.next ?? "" });
    const { params } = render(вторая.captured.where);
    // Граница второй страницы — ровно последняя строка первой, сравнение строгое:
    // ID2 в неё попасть не может, ID1 (< ID2 при равном времени) — попадает.
    assert.deepEqual(params, [AT.toISOString(), AT.toISOString(), ID2]);
    assert.deepEqual(p2.items.map((i) => i.id), [ID1]);
    assert.equal(p2.next, null);
    const всего = new Set([...p1.items, ...p2.items].map((i) => i.id));
    assert.equal(всего.size, 3);
  });
});

describe("Форма строки — без storageKey и без содержимого", () => {
  it("в выборке нет столбца storage_key, в ответе нет ключа storageKey", async () => {
    const { db, captured } = listStub([row(ID1)]);
    const page = await new ArtifactsService(db).list();
    const columns = Object.keys(captured.columns ?? {});
    assert.ok(!columns.includes("storageKey"), "storage_key не должен выбираться из базы");
    assert.deepEqual(columns.sort(), [
      "bytes", "createdAt", "createdBy", "domain", "id", "kind", "mime", "ownerId", "ownerType", "tags", "title",
    ]);
    assert.deepEqual(Object.keys(page.items[0] ?? {}).sort(), [
      "bytes", "createdAt", "createdBy", "domain", "id", "kind", "mime", "ownerId", "ownerType", "tags", "title",
    ]);
    assert.equal(page.items[0]?.createdAt, "2026-09-08T10:00:00.000Z", "дата — строкой ISO, а не Date");
  });

  it("теги — всегда список строк, даже если в jsonb положили не то", async () => {
    const { db } = listStub([
      row(ID1, { tags: ["bot", 7, null, "vendhub"] }),
      row(ID2, { tags: { a: 1 } }),
      row(ID3, { tags: null, title: null, domain: null }),
    ]);
    const page = await new ArtifactsService(db).list();
    assert.deepEqual(page.items.map((i) => i.tags), [["bot", "vendhub"], [], []]);
    assert.equal(page.items[2]?.title, null);
    assert.equal(page.items[2]?.domain, null);
  });
});
```

### 2.6. Тест контроллера

- [ ] Создать `apps/core/src/artifacts/artifacts.controller.test.ts`:

```ts
import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Request } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AppModule } from "../app.module";
import { ReadTokenGuard } from "../common/read-token.guard";
import type { Db } from "../db/db.module";
import { ArtifactsController, ArtifactsQueryDto } from "./artifacts.controller";
import { ArtifactsModule } from "./artifacts.module";

/** Db-заглушка для excludePersonal: settingValue = `select().from(systemConfig)`. */
function fakeDb(rows: { key: string; value: string }[] = []): Db {
  return { select: () => ({ from: () => Promise.resolve(rows) }) } as unknown as Db;
}

/** Запрос с заголовками — owner-токен читается из `x-owner-action-token`. */
function req(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

/** Сервис-заглушка: наружу — аргументы вызова. */
function stub(db: Db = fakeDb()) {
  const calls: unknown[][] = [];
  const service = {
    list: async (...args: unknown[]) => {
      calls.push(args);
      return { items: [], next: null, now: "2026-09-08T00:00:00.000Z" };
    },
  };
  return { controller: new ArtifactsController(service as never, db), calls };
}

const ID = "11111111-1111-4111-8111-111111111111";
const dto = (input: Record<string, unknown>) => plainToInstance(ArtifactsQueryDto, input);

describe("GET /artifacts за сервисным токеном (Р-A3-3)", () => {
  const prev = process.env.SERVICE_TOKEN;
  afterEach(() => {
    if (prev === undefined) delete process.env.SERVICE_TOKEN;
    else process.env.SERVICE_TOKEN = prev;
  });

  const ctx = (headers: Record<string, string> = {}) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method: "GET", headers }) }),
      getHandler: () => (): void => undefined,
      getClass: () => class {},
    }) as unknown as Parameters<ReadTokenGuard["canActivate"]>[0];

  it("guard навешен на КОНТРОЛЛЕР — будущие маршруты архива закрыты по умолчанию", () => {
    const guards: unknown = Reflect.getMetadata("__guards__", ArtifactsController);
    assert.ok(
      Array.isArray(guards) && guards.includes(ReadTokenGuard),
      "нет @UseGuards(ReadTokenGuard) на ArtifactsController",
    );
  });

  it("модуль зарегистрирован в AppModule — иначе маршрута нет вовсе, а тесты зелёные", () => {
    // `dist/app.module.js` грузится без побочных эффектов (фабрика DbModule
    // ленивая): метаданные Nest — единственный дешёвый способ поймать
    // выпавшую строку в `imports` до старта процесса.
    const imports: unknown = Reflect.getMetadata("imports", AppModule);
    assert.ok(Array.isArray(imports) && imports.includes(ArtifactsModule), "ArtifactsModule не в imports AppModule");
  });

  it("guard — провайдер модуля, контроллер — в модуле: иначе Nest не соберёт маршрут", () => {
    const controllers: unknown = Reflect.getMetadata("controllers", ArtifactsModule);
    const providers: unknown = Reflect.getMetadata("providers", ArtifactsModule);
    assert.ok(Array.isArray(controllers) && controllers.includes(ArtifactsController));
    assert.ok(Array.isArray(providers) && providers.includes(ReadTokenGuard), "ReadTokenGuard резолвится через DI, как в AppsModule");
  });

  it("анонимный GET отклоняется, верный токен проходит", () => {
    process.env.SERVICE_TOKEN = "secret";
    assert.throws(() => new ReadTokenGuard().canActivate(ctx()), /токен/);
    assert.equal(new ReadTokenGuard().canActivate(ctx({ "x-service-token": "secret" })), true);
  });
});

describe("ArtifactsQueryDto — фильтры и рамки", () => {
  it("полный корректный набор проходит, limit становится числом", async () => {
    const q = dto({
      kind: "doc",
      ownerType: "person",
      ownerId: ID,
      domain: "vendhub",
      from: "2026-09-01",
      to: "2026-09-08T10:00:00.000Z",
      q: "дебиторка",
      limit: "20",
      cursor: "MjAyNg",
    });
    assert.deepEqual(await validate(q), []);
    assert.equal(q.limit, 20);
  });

  it("пустой запрос — тоже корректный (все фильтры необязательны)", async () => {
    assert.deepEqual(await validate(dto({})), []);
  });

  it("чужое значение — ошибка по своему полю, а не тихо отброшенный фильтр", async () => {
    for (const input of [
      { kind: "video" },
      { kind: ["doc", "photo"] },
      { ownerType: "../etc" },
      { ownerType: "Person" },
      { ownerId: "nope" },
      { domain: "trent" },
      { from: "вчера" },
      { to: "08.09.2026" },
      { q: ["a", "b"] },
      { q: "x".repeat(201) },
      { limit: "0" },
      { limit: "101" },
      { limit: "abc" },
      { limit: "1.5" },
      { limit: ["5"] },
      { cursor: ["a"] },
    ]) {
      const errors = await validate(dto(input));
      const field = Object.keys(input)[0];
      assert.ok(errors.some((e) => e.property === field), `${JSON.stringify(input)} обязан быть отклонён по ${field}`);
    }
  });
});

describe("ArtifactsController.list — проводка фильтра и личного контура", () => {
  it("даты становятся Date, q обрезается, пустые q/cursor — «не задан»; excludePersonal=false при выключенном флаге", async () => {
    const { controller, calls } = stub();
    await controller.list(
      dto({ kind: "doc", ownerType: "person", ownerId: ID, domain: "globerent", from: "2026-09-01", to: "2026-09-08T10:00:00.000Z", q: "  дебиторка ", limit: "20", cursor: "MjAyNg" }),
      req(),
    );
    await controller.list(dto({ q: "   ", cursor: "" }), req());
    assert.deepEqual(calls, [
      [
        {
          kind: "doc",
          ownerType: "person",
          ownerId: ID,
          domain: "globerent",
          from: new Date("2026-09-01T00:00:00.000Z"),
          to: new Date("2026-09-08T10:00:00.000Z"),
          q: "дебиторка",
          limit: 20,
          cursor: "MjAyNg",
        },
        { excludePersonal: false },
      ],
      [{}, { excludePersonal: false }],
    ]);
  });

  it("флаг включён + нет owner-токена → excludePersonal=true; с owner-токеном — снова false", async () => {
    const prevOwner = process.env.OWNER_ACTION_TOKEN;
    const prevService = process.env.SERVICE_TOKEN;
    process.env.SERVICE_TOKEN = "shared";
    process.env.OWNER_ACTION_TOKEN = "owner-secret";
    try {
      const { controller, calls } = stub(fakeDb([{ key: "OWNER_IDENTITY_ENFORCED", value: "1" }]));
      await controller.list(dto({}), req());
      await controller.list(dto({}), req({ "x-owner-action-token": "owner-secret" }));
      assert.deepEqual(
        calls.map((c) => c[1]),
        [{ excludePersonal: true }, { excludePersonal: false }],
      );
    } finally {
      if (prevOwner === undefined) delete process.env.OWNER_ACTION_TOKEN;
      else process.env.OWNER_ACTION_TOKEN = prevOwner;
      if (prevService === undefined) delete process.env.SERVICE_TOKEN;
      else process.env.SERVICE_TOKEN = prevService;
    }
  });
});
```

### 2.7. Сценарий на настоящем SQL (pglite локально, postgres:17 в CI — подхватывается глобом `check-*.mjs`)

Заглушка drizzle `where` не исполняет: «страницы не пересекаются» на ней доказывается только формой условия. Настоящее доказательство — здесь. Требует применённой цепочкой миграции 0089 (задача 1); без неё падает первым ассертом с внятной причиной.

- [ ] Создать `tools/pglite-checks/check-artifacts-a3.mjs`:

```js
// Кольцо артефактов (срез A3) на НАСТОЯЩЕМ SQL: страницы по курсору не
// пересекаются на равном created_at, поиск сворачивает регистр кириллицы,
// личный контур вырезается, storageKey наружу не едет.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ СЦЕНАРИЙ. Юнит-тесты ядра ходят в заглушку drizzle: она
// `where` не исполняет, поэтому «зелёное» на ней доказывает только форму
// условия (`artifacts.service.test.ts`), но не то, КАКИЕ строки вернёт база
// на стыке страниц. Здесь пять настоящих строк, три из них — с одним
// created_at, и три страницы по две строки.
import assert from "node:assert/strict";
import path from "node:path";
import { coreDb, reqCore, ENGINE } from "./svc-harness.mjs";
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { ArtifactsService, decodeCursor } = reqCore(path.join(REPO, "apps/core/dist/artifacts/artifacts.service.js"));
const { db, run, close } = await coreDb();
try {
  const cols = await run(
    `select column_name from information_schema.columns where table_name = 'attachment' and column_name in ('title', 'domain', 'tags')`,
  );
  assert.equal(cols.length, 3, "миграция 0089 (title/domain/tags у attachment) не применена цепочкой — сценарию A3 не на чем стоять");

  const P = "00000000-0000-4000-8000-0000000000a1";
  const T = "2026-09-08T10:00:00Z";
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ];
  await run(
    `insert into attachment (id, owner_type, owner_id, kind, storage_key, mime, bytes, created_by, created_at, title, domain, tags) values
      ($1, 'person', $6, 'doc', 'k1', 'application/pdf', 10, 'bot', $7, 'Дебиторка GLOBERENT за август', 'globerent', '["bot"]'),
      ($2, 'person', $6, 'doc', 'k2', 'application/pdf', 10, 'bot', $7, 'ООО 100% предоплата', 'vendhub', '["bot"]'),
      ($3, 'person', $6, 'doc', 'k3', 'application/pdf', 10, 'bot', $7, 'Накопления', 'personal', '[]'),
      ($4, 'entity', $6, 'photo', 'k4', 'image/jpeg', 10, 'staff', '2026-09-07T10:00:00Z', null, null, '[]'),
      ($5, 'person', $6, 'doc', 'k5', 'application/pdf', 10, 'bot', '2026-09-09T10:00:00Z', 'дебиторка сентябрь', null, '[]')`,
    [...ids, P, T],
  );
  const svc = new ArtifactsService(db);

  // 1. Три страницы по 2: стык страниц приходится на три строки с равным created_at.
  const seen = [];
  let cursor;
  let pages = 0;
  for (;;) {
    const page = await svc.list({ limit: 2, ...(cursor ? { cursor } : {}) });
    pages += 1;
    for (const it of page.items) {
      assert.ok(!seen.includes(it.id), `строка ${it.id} пришла дважды — страницы пересеклись`);
      seen.push(it.id);
    }
    if (page.next === null) break;
    cursor = page.next;
    assert.ok(pages < 10, "курсор зациклился");
  }
  assert.equal(pages, 3, `страниц ${pages}, ожидалось 3`);
  assert.deepEqual([...seen].sort(), [...ids].sort(), "все пять строк ровно по разу");
  assert.deepEqual(seen.slice(0, 3), [ids[4], ids[2], ids[1]], "новые сверху, при равном времени — id desc");

  // 2. Поиск: регистр кириллицы и подстановочные знаки — литералы.
  const q1 = await svc.list({ q: "дебиторка" });
  assert.deepEqual(q1.items.map((i) => i.id).sort(), [ids[0], ids[4]].sort(), "ILIKE обязан сворачивать кириллицу");
  const q2 = await svc.list({ q: "100%" });
  assert.deepEqual(q2.items.map((i) => i.id), [ids[1]], "«100%» — литерал, а не «всё, что начинается со 100»");
  const q3 = await svc.list({ q: "100_" });
  assert.deepEqual(q3.items, [], "«_» — литерал");

  // 3. Личный контур вырезан, NULL-домен полевого контура остался.
  const open = await svc.list({}, { excludePersonal: true });
  assert.deepEqual(open.items.map((i) => i.id).sort(), [ids[0], ids[1], ids[3], ids[4]].sort());

  // 4. Фильтры по одному.
  assert.deepEqual((await svc.list({ kind: "photo" })).items.map((i) => i.id), [ids[3]]);
  assert.deepEqual((await svc.list({ domain: "vendhub" })).items.map((i) => i.id), [ids[1]]);
  assert.deepEqual((await svc.list({ ownerType: "entity", ownerId: P })).items.map((i) => i.id), [ids[3]]);
  assert.deepEqual((await svc.list({ from: new Date("2026-09-09T00:00:00Z") })).items.map((i) => i.id), [ids[4]]);
  assert.deepEqual((await svc.list({ to: new Date("2026-09-07T23:59:59Z") })).items.map((i) => i.id), [ids[3]]);

  // 5. Форма строки и курсор.
  const first = (await svc.list({ limit: 1 })).items[0];
  assert.equal("storageKey" in first, false, "ключ хранилища наружу не едет");
  assert.deepEqual(first.tags, []);
  assert.equal(typeof first.createdAt, "string");
  const c = decodeCursor((await svc.list({ limit: 1 })).next);
  assert.equal(c.id, ids[4]);

  console.log(`A3 (${ENGINE}): страницы архива не пересекаются на равном created_at, поиск сворачивает кириллицу, storageKey наружу не едет ✔`);
} finally {
  await close();
}
```

### 2.8. Проверка

- [ ] Сборка и статика (из корня репо):

```bash
pnpm --filter @mydon/db build
pnpm --filter @mydon/core clean && pnpm --filter @mydon/core build   # clean — чтобы в dist не остались сироты старых тестов
pnpm --filter @mydon/core typecheck
pnpm --filter @mydon/core lint
```

- [ ] Юнит-тесты модуля — ожидаемо `# tests 31` / `# pass 31` / `# fail 0` (22 сервис + 9 контроллер):

```bash
node --test apps/core/dist/artifacts/artifacts.service.test.js apps/core/dist/artifacts/artifacts.controller.test.js
```

- [ ] Весь Core: `pnpm --filter @mydon/core test` — без падений.

- [ ] Сценарий на настоящем SQL (pglite поставлен по `tools/pglite-checks/README.md` в `~/pgtest`; `NODE_PATH` обязателен — драйвер `drizzle-orm/pglite` требует пакет):

```bash
NODE_PATH=~/pgtest/node_modules node tools/pglite-checks/run-migrations.mjs
NODE_PATH=~/pgtest/node_modules node tools/pglite-checks/check-artifacts-a3.mjs
# ожидаемо одна строка: A3 (pglite): страницы архива не пересекаются на равном created_at, поиск сворачивает кириллицу, storageKey наружу не едет ✔
```

- [ ] Ручной смоук на поднятом Core (локально `127.0.0.1:3001`, миграция 0089 применена):

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/artifacts                                   # 401 — токен обязателен и на GET
curl -s -H "x-service-token: $SERVICE_TOKEN" 'http://127.0.0.1:3001/artifacts?kind=doc&limit=2' | jq .       # {"items":[…],"next":…,"now":"…"}; в items нет storageKey
curl -s -H "x-service-token: $SERVICE_TOKEN" 'http://127.0.0.1:3001/artifacts?kind=video'                    # 400 «kind: photo | receipt | doc»
curl -s -H "x-service-token: $SERVICE_TOKEN" 'http://127.0.0.1:3001/artifacts?cursor=abc'                    # 400 «cursor: не распознан …»
curl -s -H "x-service-token: $SERVICE_TOKEN" 'http://127.0.0.1:3001/artifacts?q=дебиторка'                  # только строки с таким title (спека §5)
```

### 2.9. Что падает при откате (каждая правка закрыта ассертом)

| Откат | Падает |
|---|---|
| Снять `@UseGuards(ReadTokenGuard)` с класса | `guard навешен на КОНТРОЛЛЕР` |
| Убрать `ArtifactsModule` из `imports` AppModule | `модуль зарегистрирован в AppModule` |
| Убрать `ReadTokenGuard` из `providers` модуля | `guard — провайдер модуля` |
| `select(ARTIFACT_COLUMNS)` → `select()` | `в выборке нет столбца storage_key` (columns undefined) |
| Убрать `desc(attachment.id)` из ORDER BY | `новые сверху: порядок…` + сценарий (повтор/пропуск на равном времени) |
| Курсор по одному `created_at` вместо кортежа | `условие страницы — строго раньше кортежа…` + сценарий |
| Убрать экранирование в `titleMatches` | `экранирует %, _ и обратную косую` + сценарий `«100%» — литерал` |
| Убрать `COLLATE "pg_c_utf8"` | `коллация встроенная…` (+ сценарий на базе с локалью C) |
| Не пробрасывать `excludePersonal` | `флаг включён + нет owner-токена → excludePersonal=true` |
| `is distinct from` → `<> 'personal'` | сценарий п.3 (NULL-домен пропал) |
| `next` при неполной странице | `next — курсор последней строки, только когда строк ровно limit` |
| Мусорный limit в SQL | `по умолчанию 50, потолок LIST_MAX…` |
| Любой фильтр потерян/перепутан столбец | соответствующий тест «каждый фильтр своим столбцом» |

## Задача 3: `POST /attachments` принимает `title` / `domain` / `tags`

Предусловие: Задача 1 выполнена (в `packages/db/src/schema.ts` у `attachment` есть `title`, `domain`, `tags`; `packages/db` собран). Все пути абсолютные. Правки — точная замена блоков «БЫЛО → СТАЛО»; текст «БЫЛО» совпадает с файлом посимвольно.

### 3.1. Сервис — `/Users/js/Developer/mydon/apps/core/src/attachments/attachments.service.ts`

- [ ] **3.1.1. Импорт типа направления.** БЫЛО:
```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { attachment } from "@mydon/db";
import { and, desc, eq, inArray } from "drizzle-orm";
```
СТАЛО:
```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { attachment } from "@mydon/db";
import type { Domain } from "@mydon/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
```

- [ ] **3.1.2. `AttachmentMeta` получает три поля.** БЫЛО:
```ts
/** Метаданные вложения со ссылкой на файл. */
export interface AttachmentMeta {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  /** В какой момент снято: before | after | plate | counter. */
  stage: string | null;
  mime: string | null;
  bytes: number | null;
  url: string;
  createdAt: string;
}
```
СТАЛО:
```ts
/** Метаданные вложения со ссылкой на файл. */
export interface AttachmentMeta {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  /** В какой момент снято: before | after | plate | counter. */
  stage: string | null;
  mime: string | null;
  bytes: number | null;
  url: string;
  createdAt: string;
  /** Человеческое имя артефакта («Дебиторка GLOBERENT за август»). У полевых фото пусто. */
  title: string | null;
  /** Направление бизнеса (перечень `domainEnum`). Пусто — вложение вне направления. */
  domain: string | null;
  /** Метки: `["bot"]` у документов из Telegram; `[]` у полевого контура и старых строк. */
  tags: string[];
}
```

- [ ] **3.1.3. Белый список документов: docx/xlsx/pptx.** Без этого письмо среза A3 мёртвое: `@mydon/documents` производит ровно `xlsx | docx | pptx | pdf`, а `DOC_EXT` принимал только PDF — бот получал бы 400 на каждом Word/Excel. HTML остаётся под запретом (#244). БЫЛО:
```ts
/**
 * Что ещё принимаем к чеку и документу: только PDF. Бот и панель кладут в
 * вложения фотографии (`kind=photo`), чек с телефона — тоже фото; PDF нужен
 * счёту и акту, которые приходят файлом.
 */
const DOC_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
};
```
СТАЛО:
```ts
/**
 * Что ещё принимаем к чеку и документу: PDF и три формата Office.
 *
 * PDF нужен счёту и акту, которые приходят файлом. Office — это то, что
 * производит `@mydon/documents` (xlsx | docx | pptx) и что бот с среза A3
 * кладёт в архив ДО отправки в Telegram; без них письмо артефактов давало бы
 * 400 на каждом отчёте. Отдаются они через `raw` всегда вложением
 * (`Content-Disposition: attachment`, см. `isImageMime`), поэтому на origin
 * панели не исполняются. `text/html` здесь НЕТ намеренно: заявленный верно
 * HTML исполнился бы при прямом переходе, и `nosniff` этому не мешает.
 */
const DOC_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
};
```

- [ ] **3.1.4. Экспортируемый `tagsOf()` — сразу после `allowedExt`.** БЫЛО:
```ts
function allowedExt(kind: string, mimetype: string): string | undefined {
  const mime = mimetype.toLowerCase();
  return kind === "photo" ? IMAGE_EXT[mime] : (IMAGE_EXT[mime] ?? DOC_EXT[mime]);
}
```
СТАЛО:
```ts
function allowedExt(kind: string, mimetype: string): string | undefined {
  const mime = mimetype.toLowerCase();
  return kind === "photo" ? IMAGE_EXT[mime] : (IMAGE_EXT[mime] ?? DOC_EXT[mime]);
}

/**
 * Теги из jsonb — только строки.
 *
 * Колонка хранит произвольный JSON, и строка, записанная мимо `upload()`
 * (ручной SQL, импорт), не должна ронять список вложений целиком: чужеродные
 * элементы отбрасываем, а не бросаем. Одна дверь для всех читателей —
 * `GET /artifacts` (срез A3) читает теги через неё же.
 */
export function tagsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
}
```

- [ ] **3.1.5. Сигнатура `upload()`.** БЫЛО:
```ts
  /** Загрузить файл, привязать к записи. Тип файла проверяем по белому списку. */
  async upload(
    input: {
      ownerType: string;
      ownerId: string;
      kind?: string;
      createdBy?: string;
      stage?: AttachmentStage;
    },
    file: UploadedFile | undefined,
  ): Promise<AttachmentMeta> {
```
СТАЛО:
```ts
  /**
   * Загрузить файл, привязать к записи. Тип файла проверяем по белому списку.
   *
   * `title`/`domain`/`tags` — срез A3: у документа, сделанного ботом, есть имя,
   * направление и метки; у полевого фото их нет, и прежние вызывающие их не
   * шлют — тогда в строку идут null / null / []. Договор длины и перечня
   * стоит на DTO (`UploadDto`), здесь значения уже чистые.
   */
  async upload(
    input: {
      ownerType: string;
      ownerId: string;
      kind?: string;
      createdBy?: string;
      stage?: AttachmentStage;
      title?: string;
      domain?: Domain;
      tags?: string[];
    },
    file: UploadedFile | undefined,
  ): Promise<AttachmentMeta> {
```

- [ ] **3.1.6. Вставка трёх колонок.** БЫЛО:
```ts
        createdBy: input.createdBy ?? "owner",
        stage: input.stage ?? null,
      })
      .returning();
```
СТАЛО:
```ts
        createdBy: input.createdBy ?? "owner",
        stage: input.stage ?? null,
        title: input.title ?? null,
        domain: input.domain ?? null,
        tags: input.tags ?? [],
      })
      .returning();
```

- [ ] **3.1.7. `toMeta()` отдаёт новые поля.** БЫЛО:
```ts
  private async toMeta(row: AttachmentRow): Promise<AttachmentMeta> {
    return {
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      kind: row.kind,
      stage: row.stage,
      mime: row.mime,
      bytes: row.bytes,
      url: await this.storage.url(row.id, row.storageKey),
      createdAt: row.createdAt.toISOString(),
    };
  }
```
СТАЛО:
```ts
  private async toMeta(row: AttachmentRow): Promise<AttachmentMeta> {
    return {
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      kind: row.kind,
      stage: row.stage,
      mime: row.mime,
      bytes: row.bytes,
      url: await this.storage.url(row.id, row.storageKey),
      createdAt: row.createdAt.toISOString(),
      title: row.title,
      domain: row.domain,
      tags: tagsOf(row.tags),
    };
  }
```

### 3.2. Контроллер — `/Users/js/Developer/mydon/apps/core/src/attachments/attachments.controller.ts`

- [ ] **3.2.1. Импорты.** БЫЛО:
```ts
import { FileInterceptor } from "@nestjs/platform-express";
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { Public } from "../common/public.decorator";
```
СТАЛО:
```ts
import { FileInterceptor } from "@nestjs/platform-express";
import { domainEnum } from "@mydon/db";
import type { Domain } from "@mydon/shared";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import { Public } from "../common/public.decorator";
```

- [ ] **3.2.2. Константы и нормализаторы — вставить ПЕРЕД строкой `/** Куда привязать файл и что это. */`.** БЫЛО:
```ts
/** Куда привязать файл и что это. */
export class UploadDto {
```
СТАЛО:
```ts
/**
 * Предел названия артефакта. Одно число: зажим на входе и договор
 * `@MaxLength` — как `STOCK_COUNTS_PRODUCT_MAX` у поиска остатков.
 */
export const ATTACHMENT_TITLE_MAX = 120;
/** Сколько тегов принимаем на одно вложение. */
export const ATTACHMENT_TAGS_MAX = 20;
/** Длина одного тега. */
export const ATTACHMENT_TAG_MAX = 64;

/**
 * Название артефакта: ЗАЖИМ, А НЕ ОТКАЗ.
 *
 * Бот берёт название из summary документа, а summary модель пишет длиной в
 * абзац. Отвергать запрос за длину — терять файл, стоивший вызова модели с
 * исполнением кода; полный текст и так остаётся в caption сообщения Telegram
 * (спека A3 §6 п. 4). Режем по code point, а не `slice` по UTF-16: `slice`
 * разрубил бы эмодзи пополам и оставил бы в БД битую суррогатную половину.
 * Пустое после обрезки — как отсутствующее (в строку пойдёт null). Не строку
 * возвращаем как есть — её отвергнет `@IsString`, а не проглотит зажим.
 */
export function clampAttachmentTitle(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cut = Array.from(value.trim()).slice(0, ATTACHMENT_TITLE_MAX).join("").trimEnd();
  return cut.length === 0 ? undefined : cut;
}

/**
 * Теги из multipart — к массиву до валидации.
 *
 * Одно поле `tags` multer отдаёт строкой, повторённое — массивом; без
 * приведения один тег и два тега проходили бы `@IsArray` по-разному. Пустые
 * и пробельные теги выбрасываем. Не-массив и не-строку возвращаем как есть —
 * их отвергнет `@IsArray`/`@IsString`, а не молчаливая нормализация.
 */
export function normalizeAttachmentTags(value: unknown): unknown {
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list)) return list;
  return list.map((t) => (typeof t === "string" ? t.trim() : t)).filter((t) => t !== "");
}

/** Куда привязать файл и что это. */
export class UploadDto {
```

- [ ] **3.2.3. Три поля в `UploadDto` — после `stage`.** БЫЛО:
```ts
  /** В какой момент снято. Незнакомое значение отвергаем здесь, а не в БД. */
  @IsOptional() @IsIn([...ATTACHMENT_STAGES])
  stage?: AttachmentStage;
}
```
СТАЛО:
```ts
  /** В какой момент снято. Незнакомое значение отвергаем здесь, а не в БД. */
  @IsOptional() @IsIn([...ATTACHMENT_STAGES])
  stage?: AttachmentStage;

  /**
   * Человеческое имя артефакта (срез A3). Зажимается `clampAttachmentTitle`;
   * `@MaxLength` после зажима сработать не может, но фиксирует границу
   * договором для любого другого клиента.
   */
  @IsOptional()
  @Transform(({ value }) => clampAttachmentTitle(value))
  @IsString()
  @MaxLength(ATTACHMENT_TITLE_MAX)
  title?: string;

  /**
   * Направление бизнеса — тот же перечень, что у `money_flow.domain`.
   * Сверяем со значениями `domainEnum`, а не со свободной строкой: колонка —
   * pg-enum, и чужое значение упало бы уже в БД как 500, а не 400. Пустая
   * строка из формы — это «не указано», а не ошибка.
   */
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsIn([...domainEnum.enumValues])
  domain?: Domain;

  /**
   * Метки («bot», «report», …). В multipart — повторённое поле `tags`;
   * `normalizeAttachmentTags` приводит строку к массиву до `@IsArray`.
   */
  @IsOptional()
  @Transform(({ value }) => normalizeAttachmentTags(value))
  @IsArray()
  @ArrayMaxSize(ATTACHMENT_TAGS_MAX)
  @IsString({ each: true })
  @MaxLength(ATTACHMENT_TAG_MAX, { each: true })
  tags?: string[];
}
```
Метод `upload()` контроллера не меняется: `this.attachments.upload(dto, file)` — `dto` уже несёт три поля с теми же типами, что вход сервиса.

### 3.3. Тесты — `/Users/js/Developer/mydon/apps/core/src/attachments/attachments.test.ts`

- [ ] **3.3.1. Импорты.** БЫЛО:
```ts
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AttachmentsController, UploadDto, isImageMime } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { StorageService } from "./storage.service";
```
СТАЛО:
```ts
import { domainEnum } from "@mydon/db";
import { DOMAINS } from "@mydon/shared";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ATTACHMENT_TAGS_MAX,
  ATTACHMENT_TAG_MAX,
  ATTACHMENT_TITLE_MAX,
  AttachmentsController,
  UploadDto,
  isImageMime,
} from "./attachments.controller";
import { AttachmentsService, tagsOf } from "./attachments.service";
import { StorageService } from "./storage.service";
```

- [ ] **3.3.2. Хелпер `row` — строка как из БД после миграции 0089, плюс константы Office-типов.** БЫЛО:
```ts
const row = (id: string, ownerId: string, kind = "photo") => ({
  id,
  ownerType: "entity",
  ownerId,
  kind,
  storageKey: `k/${id}`,
  mime: "image/jpeg",
  bytes: 100,
  createdBy: "staff",
  createdAt: new Date("2026-08-01T00:00:00Z"),
});
```
СТАЛО:
```ts
const row = (id: string, ownerId: string, kind = "photo") => ({
  id,
  ownerType: "entity",
  ownerId,
  kind,
  storageKey: `k/${id}`,
  mime: "image/jpeg",
  bytes: 100,
  createdBy: "staff",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  // Как у строк, записанных до среза A3: колонки есть (миграция 0089), значения пустые.
  title: null,
  domain: null,
  tags: [],
});

/** Типы файлов `@mydon/documents` — то, что бот с среза A3 кладёт в архив. */
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
```

- [ ] **3.3.3. Хелпер `uploadHarness` наружу отдаёт и записанные в БД значения.** БЫЛО:
```ts
/** Мок хранилища и базы для загрузки: ключ и записанная строка наружу. */
function uploadHarness() {
  const written: { key: string; mime: string | null }[] = [];
  const storage = {
    keyFor: (ownerType: string, ownerId: string, ext: string) => `${ownerType}/${ownerId}/f${ext}`,
    put: async (key: string, _bytes: Buffer, mime: string | null) => {
      written.push({ key, mime });
    },
    url: async (id: string) => `/attachments/${id}/raw`,
  } as never;
  const db = {
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => [{ ...v, id: "a1", stage: null, createdAt: new Date("2026-08-01T00:00:00Z") }],
      }),
    }),
  } as never;
  return { service: new AttachmentsService(db, storage), written };
}
```
СТАЛО:
```ts
/** Мок хранилища и базы для загрузки: ключ в хранилище и строка, ушедшая в insert, — наружу. */
function uploadHarness() {
  const written: { key: string; mime: string | null }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const storage = {
    keyFor: (ownerType: string, ownerId: string, ext: string) => `${ownerType}/${ownerId}/f${ext}`,
    put: async (key: string, _bytes: Buffer, mime: string | null) => {
      written.push({ key, mime });
    },
    url: async (id: string) => `/attachments/${id}/raw`,
  } as never;
  const db = {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return {
          returning: async () => [{ ...v, id: "a1", stage: null, createdAt: new Date("2026-08-01T00:00:00Z") }],
        };
      },
    }),
  } as never;
  return { service: new AttachmentsService(db, storage), written, inserted };
}
```

- [ ] **3.3.4. Office-документ при отдаче — вложением (инвариант #244 распространяется на новые типы).** БЫЛО:
```ts
    for (const mime of ["application/pdf", "text/html", null]) {
```
СТАЛО:
```ts
    for (const mime of ["application/pdf", DOCX_MIME, "text/html", null]) {
```

- [ ] **3.3.5. Новые блоки — добавить В КОНЕЦ файла (после последнего `});`).** Дословно:
```ts
// ── Срез A3: title / domain / tags и документы бота ──────────────────────────

const OWNER_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

/** Вход как реально приходит из multipart: строки, без приведения типов. */
const artifactDto = (extra: Record<string, unknown>) =>
  plainToInstance(UploadDto, { ownerType: "person", ownerId: OWNER_ID, kind: "doc", ...extra });

describe("Артефакты: старый вызов без новых полей — как раньше", () => {
  it("DTO без title/domain/tags проходит валидацию, поля не выдумываются", async () => {
    const dto = artifactDto({ createdBy: "staff:1", stage: "before" });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title, undefined);
    assert.equal(dto.domain, undefined);
    assert.equal(dto.tags, undefined);
  });

  it("сервис пишет null / null / [] — фото и чеки полевого контура не меняются", async () => {
    const { service, inserted } = uploadHarness();
    const meta = await service.upload(upload("photo"), file("image/jpeg"));
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].title, null);
    assert.equal(inserted[0].domain, null);
    assert.deepEqual(inserted[0].tags, []);
    assert.equal(meta.title, null);
    assert.equal(meta.domain, null);
    assert.deepEqual(meta.tags, []);
  });
});

describe("Артефакты: title/domain/tags сохраняются и возвращаются", () => {
  it("DTO принимает все три поля как есть", async () => {
    const dto = artifactDto({ title: "Дебиторка GLOBERENT за август", domain: "globerent", tags: ["bot"] });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title, "Дебиторка GLOBERENT за август");
    assert.equal(dto.domain, "globerent");
    assert.deepEqual(dto.tags, ["bot"]);
  });

  it("сервис кладёт поля в строку и отдаёт их в метаданных", async () => {
    const { service, inserted } = uploadHarness();
    const meta = await service.upload(
      {
        ownerType: "person",
        ownerId: OWNER_ID,
        kind: "doc",
        title: "Дебиторка",
        domain: "globerent",
        tags: ["bot", "report"],
      },
      file("application/pdf"),
    );
    assert.equal(inserted[0].title, "Дебиторка");
    assert.equal(inserted[0].domain, "globerent");
    assert.deepEqual(inserted[0].tags, ["bot", "report"]);
    assert.equal(meta.title, "Дебиторка");
    assert.equal(meta.domain, "globerent");
    assert.deepEqual(meta.tags, ["bot", "report"]);
  });

  it("теги из jsonb: не-строки отбрасываются, а не роняют список", async () => {
    const s = new AttachmentsService(dbReturning([{ ...row("a1", "e1"), tags: ["bot", 7, null] }]), storage);
    const res = await s.ofOwner("entity", "e1");
    assert.deepEqual(res[0].tags, ["bot"]);
    assert.equal(res[0].title, null);
    assert.equal(res[0].domain, null);
  });

  it("tagsOf: не-массив — пустой список, а не исключение", () => {
    assert.deepEqual(tagsOf(null), []);
    assert.deepEqual(tagsOf("bot"), []);
    assert.deepEqual(tagsOf({ a: 1 }), []);
    assert.deepEqual(tagsOf(["a", 1, "b"]), ["a", "b"]);
  });
});

describe("Артефакты: длинное название зажимается, а не отвергается", () => {
  it("200 символов → ровно 120, без ошибки валидации", async () => {
    const dto = artifactDto({ title: "д".repeat(200) });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.title?.length, ATTACHMENT_TITLE_MAX);
  });

  it("режем по символам, а не по UTF-16: эмодзи не разрубается пополам", async () => {
    const dto = artifactDto({ title: "😀".repeat(150) });
    assert.deepEqual(await validate(dto), []);
    assert.equal(Array.from(dto.title ?? "").length, ATTACHMENT_TITLE_MAX);
    assert.equal(
      dto.title?.length,
      ATTACHMENT_TITLE_MAX * 2,
      "каждый эмодзи — пара суррогатов, обе половины на месте",
    );
  });

  it("пробелы по краям срезаются; пустое название — как отсутствующее", async () => {
    assert.equal(artifactDto({ title: "  Отчёт  " }).title, "Отчёт");
    const empty = artifactDto({ title: "   " });
    assert.deepEqual(await validate(empty), []);
    assert.equal(empty.title, undefined);
  });

  it("не строка — не зажимается молча, а отвергается", async () => {
    const errors = await validate(artifactDto({ title: 42 }));
    assert.ok(
      errors.some((e) => e.property === "title"),
      "число в title обязано быть отклонено",
    );
  });
});

describe("Артефакты: направление — только из перечня domainEnum", () => {
  it("перечень DTO и DOMAINS из @mydon/shared — один и тот же список", () => {
    assert.deepEqual([...domainEnum.enumValues], [...DOMAINS]);
  });

  it("каждое значение перечня проходит", async () => {
    for (const d of domainEnum.enumValues) {
      assert.deepEqual(await validate(artifactDto({ domain: d })), [], `${d} должен проходить`);
    }
  });

  it("пустая строка из формы — «не указано», а не ошибка", async () => {
    const dto = artifactDto({ domain: "" });
    assert.deepEqual(await validate(dto), []);
    assert.equal(dto.domain, undefined);
  });

  it("чужое направление → ошибка валидации (ValidationPipe отдаст 400)", async () => {
    for (const bad of ["ozon", "GLOBERENT", "vendhub ", 7]) {
      const errors = await validate(artifactDto({ domain: bad }));
      assert.ok(
        errors.some((e) => e.property === "domain"),
        `«${String(bad)}» обязано быть отклонено`,
      );
    }
  });
});

describe("Артефакты: теги из multipart", () => {
  it("одно поле приходит строкой — становится массивом из одного тега", async () => {
    const dto = artifactDto({ tags: "bot" });
    assert.deepEqual(await validate(dto), []);
    assert.deepEqual(dto.tags, ["bot"]);
  });

  it("повторённое поле — массив; пробелы срезаются, пустые теги выбрасываются", async () => {
    const dto = artifactDto({ tags: ["bot", " report ", "", "  "] });
    assert.deepEqual(await validate(dto), []);
    assert.deepEqual(dto.tags, ["bot", "report"]);
  });

  it("не строка внутри, слишком длинный тег, слишком много тегов, не массив — отказ", async () => {
    const cases: unknown[] = [
      [7],
      ["x".repeat(ATTACHMENT_TAG_MAX + 1)],
      Array.from({ length: ATTACHMENT_TAGS_MAX + 1 }, (_, i) => `t${i}`),
      { bot: true },
    ];
    for (const bad of cases) {
      const errors = await validate(artifactDto({ tags: bad }));
      assert.ok(
        errors.some((e) => e.property === "tags"),
        `${JSON.stringify(bad).slice(0, 40)} обязано быть отклонено`,
      );
    }
  });
});

describe("Документ: файлы @mydon/documents проходят белый список", () => {
  it("docx/xlsx/pptx принимаются для kind=doc, расширение по типу", async () => {
    const { service, written } = uploadHarness();
    const cases: [string, string][] = [
      [DOCX_MIME, ".docx"],
      [XLSX_MIME, ".xlsx"],
      [PPTX_MIME, ".pptx"],
    ];
    for (const [mime] of cases) await service.upload(upload("doc"), file(mime));
    assert.deepEqual(
      written.map((w) => w.key),
      cases.map(([, ext]) => `entity/e1/f${ext}`),
    );
  });

  it("для фото Office-тип по-прежнему «не изображение»", async () => {
    const { service, written } = uploadHarness();
    await assert.rejects(() => service.upload(upload("photo"), file(DOCX_MIME)), /Не изображение/);
    assert.deepEqual(written, []);
  });

  it("HTML для документа по-прежнему отклоняется — белый список расширен, а не открыт", async () => {
    const { service, written } = uploadHarness();
    await assert.rejects(() => service.upload(upload("doc"), file("text/html")), /Недопустимый тип файла/);
    assert.deepEqual(written, []);
  });
});
```

### 3.4. Сборка и прогон

- [ ] Собрать зависимости и ядро (тесты гоняются по `dist`, поэтому строго после сборки):
```bash
cd /Users/js/Developer/mydon && pnpm exec turbo run build --filter=@mydon/core
```
- [ ] Прогнать только этот файл (быстро), затем весь пакет:
```bash
cd /Users/js/Developer/mydon && node --test apps/core/dist/attachments/attachments.test.js
cd /Users/js/Developer/mydon && pnpm --filter @mydon/core test
```
- [ ] Типы и линт:
```bash
cd /Users/js/Developer/mydon && pnpm --filter @mydon/core typecheck && pnpm --filter @mydon/core lint
```
- [ ] Ожидание: все `it` из 3.3.5 зелёные; существующие 20+ тестов файла не изменили результата.

### 3.5. Проверка обратной совместимости по вызывающим

- [ ] Выполнить и убедиться, что список НЕ изменился и ни один вызов не шлёт полей вне DTO:
```bash
cd /Users/js/Developer/mydon && grep -rn "/attachments" apps/bot/src apps/cc/src apps/agents/src | grep -v "\.test\." | grep -v "app/api/attachments"
```
Ожидаемые вызывающие: `apps/bot/src/core-client.ts` (`uploadPhoto` → `ownerType/ownerId/kind/createdBy/stage` + `file`; `attachmentsOfOwner`), `apps/cc/src/lib/core.ts` (`attachments`, `attachmentsBatch` — только GET). Ни один из них не правится.

### 3.6. Ассерты, падающие при откате

| Откат чего | Какой тест падает |
|---|---|
| `title/domain/tags` из insert (3.1.6) | «сервис кладёт поля в строку…» — `inserted[0].title` undefined |
| `toMeta` (3.1.7) | «…отдаёт их в метаданных» и «теги из jsonb…» |
| `tagsOf` фильтр строк | «теги из jsonb: не-строки отбрасываются…», «tagsOf: не-массив…» |
| `DOC_EXT` Office (3.1.3) | «docx/xlsx/pptx принимаются…» — `Недопустимый тип файла` |
| `@Transform(clampAttachmentTitle)` | «200 символов → ровно 120…» — `@MaxLength` даст ошибку |
| обрезка по code point (`Array.from`) | «режем по символам…» — длина 240 ≠ 300 |
| `@IsIn([...domainEnum.enumValues])` | «чужое направление…» |
| `@Transform("" → undefined)` у domain | «пустая строка из формы…» |
| `normalizeAttachmentTags` | «одно поле приходит строкой…» — `@IsArray` на строке |
| `Content-Disposition: attachment` для docx | 3.3.4 «не картинка: nosniff и отдача вложением» |

## Задача 4: бот сохраняет документ ДО отправки

**Что есть сейчас.** `apps/bot/src/index.ts`, внутри `main()` → `processUpdate` → ветка владельца, блок (строки ~1000–1013):

```ts
          // Файл идёт отдельным сообщением: у документа своя доставка,
          // и она не должна мешать тексту, если сорвётся.
          if (reply.document) {
            try {
              await tg.sendDocument(chatId, reply.document.filename, reply.document.content);
            } catch (err) {
              console.error("Файл не отправлен:", err);
              await tg.sendMessage(
                chatId,
                "Файл получился, но отправить не вышло. Повтори запрос.",
              );
            }
          }
```

Файл из `@mydon/documents` (`GeneratedDocument = { filename, content: Buffer, summary }`) отправляется и не сохраняется. `reply.document` приходит из `handler.ts` case `"report"` как `{ filename: doc.filename, content: doc.content }`. Оператор/владелец резолвится в `person` замыканием `personOf(chatId)` (index.ts:188) → `PersonRow | null | "core-down"` через `deps.core.personByChat(String(chatId))` (`GET /people/by-chat/:chatId`, `{found:false}` = нет человека). Образец multipart к Core — `CoreClient.uploadPhoto` (core-client.ts:1575). Образец «необратимые шаги вынесены в deps, порядок проверяется массивом» — `tasks-push.ts` + `tasks-push.test.ts`.

**Решения раздела (причины в комментариях кода):**
- Логика доставки выносится в новый модуль `document-archive.ts` с узкими deps — `processUpdate` не экспортируется, тестировать замыкание нельзя; в index.ts остаются только провода.
- `title` = имя файла без расширения, НЕ `doc.summary`: сводка модели начинается с «Готово, я построил…», а имя файла бот собирает сам («Дебиторка GLOBERENT 08.09.2026») — по нему ищут через `q`. Спека §2.1 допускает «из summary ИЛИ filename».
- Домен едет из `planReport` → `ReportPlan.domain` → `Reply.document.domain` (дебиторка знает направление, отчёт по задачам — сквозной, домена нет).
- Ссылка в панель требует публичный адрес — новая переменная `CC_PUBLIC_URL` (у бота её нет; compose передаёт env явным списком).
- `tags` в multipart уезжает JSON-строкой `["bot"]`: multer одно поле отдаёт строкой, два — массивом, форма зависела бы от числа тегов.

Порядок шагов: 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6.

---

### - [ ] 4.1 `CoreClient.saveAttachment` + тест

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/core-client.ts`. Найти конец метода `uploadPhoto` — строки:

```ts
    if (!res.ok) throw new Error(`Core ответил ${res.status} на /attachments`);
    return (await res.json()) as { id: string; url: string };
  }

  /** Вложения записи: сколько фото «до» и «после» уже приложено к задаче. */
```

Вставить между `}` и `/** Вложения записи …` следующий метод дословно:

```ts
  /**
   * Положить готовый документ в архив (срез A3, спека §2.1): `POST /attachments`
   * с `kind=doc` и человеческим именем. Multipart, как и фото, и тот же
   * таймаут: документ мельче снимка с точки, но Core за ним ещё ходит в S3.
   *
   * Отказ — `CoreError`, а не голый `Error`, как у `uploadPhoto`: вызывающему
   * нужен статус, чтобы назвать владельцу причину словами («Core отверг файл»),
   * а не показывать текст исключения.
   *
   * `tags` уезжает JSON-строкой в одном поле: multer складывает повторяющиеся
   * поля в массив, но ОДНО поле `tags=bot` отдаёт строкой — форма ответа
   * зависела бы от числа тегов. JSON — одна форма на любой размер.
   *
   * `domain` без значения не шлётся вовсе: пустая строка не проходит enum на
   * стороне Core, и весь файл был бы отвергнут из-за необязательного поля.
   */
  async saveAttachment(input: {
    ownerType: string;
    ownerId: string;
    kind: "doc";
    title: string;
    mime: string;
    filename: string;
    content: Buffer;
    tags: string[];
    domain?: Domain;
    createdBy: string;
  }): Promise<{ id: string; url: string }> {
    const form = new FormData();
    form.append("ownerType", input.ownerType);
    form.append("ownerId", input.ownerId);
    form.append("kind", input.kind);
    form.append("createdBy", input.createdBy);
    form.append("title", input.title);
    form.append("tags", JSON.stringify(input.tags));
    if (input.domain) form.append("domain", input.domain);
    form.append(
      "file",
      new Blob([new Uint8Array(input.content)], { type: input.mime }),
      input.filename,
    );
    const path = "/attachments";
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
      headers: this.serviceToken ? { "x-service-token": this.serviceToken } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new CoreError(res.status, path, body.slice(0, 500));
    }
    return (await res.json()) as { id: string; url: string };
  }
```

(`Domain` уже импортирован в core-client.ts: `import { normalizeMachineSerial, type Domain } from "@mydon/shared";`; `CoreError` и `PHOTO_TIMEOUT_MS` объявлены в этом же файле.)

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/core-client.test.ts`. В импорте из `"./core-client"` после строки `  CoreClient,` добавить строку `  CoreError,`. В конец файла добавить:

```ts
describe("Архив документов (срез A3): saveAttachment", () => {
  const ОСНОВА = {
    ownerType: "person",
    ownerId: "11111111-1111-4111-8111-111111111111",
    kind: "doc" as const,
    title: "Дебиторка GLOBERENT 08.09.2026",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "Дебиторка GLOBERENT 08.09.2026.xlsx",
    content: Buffer.from("PK-xlsx"),
    tags: ["bot"],
    createdBy: "owner",
  };
  const ВХОД = { ...ОСНОВА, domain: "globerent" as const };

  it("шлёт multipart в POST /attachments: title, domain, tags JSON-строкой, файл с MIME", async () => {
    const { calls } = стубFetchТело(201, { id: "a1", url: "/attachments/a1/raw" });
    const core = new CoreClient("http://core", 1000, "секрет");
    const res = await core.saveAttachment(ВХОД);
    assert.deepEqual(res, { id: "a1", url: "/attachments/a1/raw" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "http://core/attachments");
    assert.equal(calls[0]!.init?.method, "POST");
    const headers = calls[0]!.init?.headers as Record<string, string>;
    assert.equal(headers["x-service-token"], "секрет");
    const form = calls[0]!.init?.body as FormData;
    assert.equal(form.get("ownerType"), "person");
    assert.equal(form.get("ownerId"), ОСНОВА.ownerId);
    assert.equal(form.get("kind"), "doc");
    assert.equal(form.get("createdBy"), "owner");
    assert.equal(form.get("title"), "Дебиторка GLOBERENT 08.09.2026");
    assert.equal(form.get("domain"), "globerent");
    assert.equal(form.get("tags"), '["bot"]');
    const file = form.get("file");
    assert.ok(file !== null && typeof file !== "string");
    assert.equal(file.type, ОСНОВА.mime);
    assert.equal(file.name, ОСНОВА.filename);
  });

  it("без domain поле не шлётся вовсе — пустую строку enum Core отверг бы", async () => {
    const { calls } = стубFetchТело(201, { id: "a1", url: "u" });
    const core = new CoreClient("http://core", 1000, "секрет");
    await core.saveAttachment(ОСНОВА);
    const form = calls[0]!.init?.body as FormData;
    assert.equal(form.has("domain"), false);
  });

  it("отказ Core — CoreError со статусом, чтобы бот назвал причину словами", async () => {
    стубFetchТело(400, { message: "Недопустимый тип файла" });
    const core = new CoreClient("http://core", 1000, "секрет");
    await assert.rejects(core.saveAttachment(ВХОД), (err: unknown) => {
      assert.ok(err instanceof CoreError);
      assert.equal(err.status, 400);
      assert.equal(err.path, "/attachments");
      return true;
    });
  });
});
```

---

### - [ ] 4.2 Домен отчёта: `ReportPlan.domain` → `Reply.document.domain` + тест

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/reports.ts`. Заменить

```ts
export interface ReportPlan {
  kind: "xlsx" | "docx";
  filename: string;
  instruction: string;
  data: unknown;
  /** Что сказать владельцу, если строить нечего. */
  emptyReason?: string;
}
```

на

```ts
export interface ReportPlan {
  kind: "xlsx" | "docx";
  filename: string;
  instruction: string;
  data: unknown;
  /** Что сказать владельцу, если строить нечего. */
  emptyReason?: string;
  /**
   * Направление, о котором отчёт: с ним документ ляжет в архив (срез A3) и
   * найдётся на /artifacts «всё по VendHub». Нет у сквозных отчётов (задачи).
   */
  domain?: Domain;
}
```

В том же файле в возврате ветки дебиторки заменить

```ts
  return {
    kind: req.format,
    filename: `Дебиторка ${label} ${today()}`,
```

на

```ts
  return {
    kind: req.format,
    filename: `Дебиторка ${label} ${today()}`,
    domain,
```

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/handler.ts`.

1. Заменить импорт `import { DOMAIN_LABELS, normalizeProductName, type LlmCallContext } from "@mydon/shared";` на
   `import { DOMAIN_LABELS, normalizeProductName, type Domain, type LlmCallContext } from "@mydon/shared";`
2. В `export interface Reply` заменить

```ts
  /** Готовый файл: владелец получает его в чат, а не текст для переписывания. */
  document?: { filename: string; content: Buffer; caption?: string };
```

на

```ts
  /**
   * Готовый файл: владелец получает его в чат, а не текст для переписывания.
   * `domain` — направление, если отчёт о нём: с ним файл ляжет в архив
   * (срез A3) и найдётся на /artifacts по направлению.
   */
  document?: { filename: string; content: Buffer; caption?: string; domain?: Domain };
```

3. В `case "report":` заменить

```ts
        return {
          text: doc.summary.length > 0 ? doc.summary : "Готово.",
          document: { filename: doc.filename, content: doc.content },
        };
```

на

```ts
        return {
          text: doc.summary.length > 0 ? doc.summary : "Готово.",
          document: {
            filename: doc.filename,
            content: doc.content,
            ...(plan.domain ? { domain: plan.domain } : {}),
          },
        };
```

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/staff.test.ts`, внутри `describe("Отчёты файлами", () => {` после теста `"нет просрочек — файл не строим, объясняем словами"` (перед закрывающей `});` этого describe) добавить:

```ts
  it("направление отчёта едет в план — по нему документ ляжет в архив (срез A3)", async () => {
    const core = {
      obligations: async (domain: string) => ({
        domain,
        totals: [{ status: "plan", count: 1 }],
        overdue: [{ id: "1", amount: "5000000", currency: "UZS", date: "2026-03-01" }],
        overdueTotal: 1,
        overdueTruncated: false,
      }),
    } as never;
    assert.equal(
      (await planReport({ format: "xlsx", topic: "receivables" }, core)).domain,
      "globerent",
    );
    assert.equal(
      (await planReport({ format: "xlsx", topic: "receivables", domain: "vendhub" }, core)).domain,
      "vendhub",
    );
    // Задачи — сквозь все направления: домена у плана нет, в архив он не поедет.
    const tasks = { myTasks: async () => [] } as never;
    assert.equal((await planReport({ format: "docx", topic: "tasks" }, tasks)).domain, undefined);
  });
```

---

### - [ ] 4.3 Новый модуль `document-archive.ts`

**Создать файл** `/Users/js/Developer/mydon/apps/bot/src/document-archive.ts` дословно:

```ts
import path from "node:path";
import type { Domain } from "@mydon/shared";
import { CoreError, type PersonRow } from "./core-client";

/**
 * Архив документов бота (срез A3, спека §2.1).
 *
 * Файл из `@mydon/documents` стоил вызова модели с исполнением кода в
 * контейнере — и до этого среза жил секунды: бот отправлял его в чат и
 * забывал. Сорвалась отправка — файл потерян, владельцу писали «повтори
 * запрос». Теперь порядок обратный: СНАЧАЛА `POST /attachments`, ПОТОМ
 * `sendDocument`. Сбой архива отправку не блокирует (файл у нас в руках,
 * терять его из-за хранилища нельзя), но называется владельцу словами.
 *
 * Каждый необратимый шаг — зависимость: порядок «сохранили → отправили»
 * проверяется без живого Telegram и Core, как в tasks-push.ts.
 */

export interface DocumentToDeliver {
  filename: string;
  content: Buffer;
  /** Направление, о котором документ, если бот его знает. */
  domain?: Domain;
}

export interface DocumentArchiveDeps {
  /** Кто попросил — по chatId, тем же путём, что решается доступ бота (`personOf`). */
  resolveOwner(): Promise<PersonRow | null | "core-down">;
  save(input: {
    ownerType: "person";
    ownerId: string;
    kind: "doc";
    title: string;
    mime: string;
    filename: string;
    content: Buffer;
    tags: string[];
    domain?: Domain;
    createdBy: string;
  }): Promise<{ id: string }>;
  sendDocument(filename: string, content: Buffer): Promise<void>;
  sendMessage(text: string): Promise<void>;
  /** Публичный адрес панели без завершающего «/»; пусто — ссылка будет путём. */
  panelUrl: string;
  log(message: string, error: unknown): void;
}

export interface DeliveryOutcome {
  /** id вложения в архиве; null — не сохранено (владельцу названа причина). */
  savedId: string | null;
  sent: boolean;
}

/**
 * MIME по расширению. `@mydon/documents` отдаёт только имя и байты — тип
 * файла из контейнера модели не приходит, а Core принимает вложение по
 * белому списку MIME (`allowedExt` в attachments.service.ts) и возвращает
 * этот же тип заголовком при отдаче. Расширение — не догадка: его ставит
 * сам пакет по `DocumentKind` (`EXT` в packages/documents/src/index.ts).
 */
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
};

/**
 * Неизвестное расширение → octet-stream: Core его отвергнет, и владелец
 * услышит «Core отверг файл», а не молчание и не выдуманный тип.
 */
export function mimeПоРасширению(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** Предел длины имени артефакта — спека §6 п. 4. */
export const TITLE_MAX = 120;

/**
 * Имя артефакта — имя файла без расширения. Не `doc.summary`: сводка модели
 * начинается с «Готово, я построил…» и в списке /artifacts читалась бы как
 * болтовня, а имя файла бот собирает сам («Дебиторка GLOBERENT 08.09.2026»)
 * — по нему и ищут (`q` ILIKE по title). Сводка остаётся текстом в чате.
 */
export function заголовокИзИмени(filename: string): string {
  const base = path.basename(filename, path.extname(filename)).trim();
  const name = base.length > 0 ? base : filename;
  return name.length > TITLE_MAX ? name.slice(0, TITLE_MAX) : name;
}

/**
 * Ярлык причины для владельца. Текст исключения наружу не едет: он для
 * лога, а владельцу нужно одно из немногих слов, по которому ясно, к кому идти.
 */
export function ярлыкПричины(error: unknown): string {
  if (error instanceof CoreError) {
    if (error.status === 400) return "Core отверг файл";
    if (error.status === 401 || error.status === 403) return "нет доступа к Core";
    if (error.status === 413) return "файл слишком большой";
    return `Core ответил ${error.status}`;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Core не ответил вовремя";
  }
  return "Core недоступен";
}

/**
 * Ссылка в витрину. Поиск по названию — фильтр, который у /artifacts есть по
 * спеке §2.3; владелец открывает список и видит ровно этот файл.
 */
export function ссылкаНаАрхив(panelUrl: string, title: string): string {
  return `${panelUrl}/artifacts?q=${encodeURIComponent(title)}`;
}

/**
 * Доставка документа владельцу: архив → Telegram → одна строка о судьбе
 * файла, только если что-то пошло не так (Р-A3-1, Р-A3-2).
 */
export async function доставитьДокумент(
  deps: DocumentArchiveDeps,
  doc: DocumentToDeliver,
): Promise<DeliveryOutcome> {
  const title = заголовокИзИмени(doc.filename);

  // 1. Архив — ДО отправки (Р-A3-1): сорвётся Telegram — файл уже есть.
  let savedId: string | null = null;
  let archiveNote: string | null = null;
  const owner = await deps.resolveOwner();
  if (owner === "core-down") {
    archiveNote = "Core не ответил";
  } else if (owner === null) {
    // Гость: у файла нет владельца, а вложения без владельца не бывает
    // (спека §1, ownerId NOT NULL). Не выдумываем хозяина — говорим.
    archiveNote = "чат не привязан к человеку в MYDON";
  } else {
    try {
      const saved = await deps.save({
        ownerType: "person",
        ownerId: owner.id,
        kind: "doc",
        title,
        mime: mimeПоРасширению(doc.filename),
        filename: doc.filename,
        content: doc.content,
        tags: ["bot"],
        ...(doc.domain ? { domain: doc.domain } : {}),
        createdBy: "owner",
      });
      savedId = saved.id;
    } catch (error) {
      deps.log("Документ не лёг в архив", error);
      archiveNote = ярлыкПричины(error);
    }
  }

  // 2. Отправка — всегда, независимо от архива: файл у нас в руках, и
  //    терять его из-за хранилища нельзя (Р-A3-2).
  let sent = false;
  try {
    await deps.sendDocument(doc.filename, doc.content);
    sent = true;
  } catch (error) {
    deps.log("Файл не отправлен", error);
  }

  // 3. Строка владельцу — только когда что-то сорвалось. Оба шага удались —
  //    молчим, как и раньше: файл в чате говорит сам за себя. Прежнего
  //    «повтори запрос» нет: файл в архиве, повторять незачем.
  let note: string | null = null;
  if (sent && archiveNote !== null) {
    note = `⚠️ Файл отправлен, но в архив не лёг: ${archiveNote}.`;
  } else if (!sent && savedId !== null) {
    note = `Отправить в чат не вышло, файл в архиве: ${ссылкаНаАрхив(deps.panelUrl, title)}`;
  } else if (!sent && archiveNote !== null) {
    note = `⚠️ Файл не отправился и в архив не лёг: ${archiveNote}. Он потерян — запроси отчёт заново.`;
  }
  if (note !== null) {
    await deps
      .sendMessage(note)
      .catch((error: unknown) => deps.log("Владелец не узнал о судьбе файла", error));
  }
  return { savedId, sent };
}
```

---

### - [ ] 4.4 Тесты модуля `document-archive.test.ts`

**Создать файл** `/Users/js/Developer/mydon/apps/bot/src/document-archive.test.ts` дословно:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CoreError, type PersonRow } from "./core-client";
import {
  TITLE_MAX,
  доставитьДокумент,
  заголовокИзИмени,
  mimeПоРасширению,
  ссылкаНаАрхив,
  ярлыкПричины,
  type DocumentArchiveDeps,
} from "./document-archive";

const ВЛАДЕЛЕЦ: PersonRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Жамшид",
  role: null,
  roles: ["owner"],
  tgUsername: "owner",
  tgChatId: "111",
  active: "yes",
};

const ФАЙЛ = {
  filename: "Дебиторка GLOBERENT 08.09.2026.xlsx",
  content: Buffer.from("PK-xlsx"),
  domain: "globerent" as const,
};

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function стенд(
  opts: {
    владелец?: PersonRow | null | "core-down";
    архивПадает?: unknown;
    отправкаПадает?: unknown;
    уведомлениеПадает?: boolean;
    panelUrl?: string;
  } = {},
) {
  const порядок: string[] = [];
  const сохранено: Parameters<DocumentArchiveDeps["save"]>[0][] = [];
  const отправлено: { filename: string; bytes: number }[] = [];
  const сообщения: string[] = [];
  const лог: string[] = [];
  const deps: DocumentArchiveDeps = {
    resolveOwner: async () => (opts.владелец === undefined ? ВЛАДЕЛЕЦ : opts.владелец),
    save: async (input) => {
      порядок.push("save");
      if (opts.архивПадает !== undefined) throw opts.архивПадает;
      сохранено.push(input);
      return { id: "a1" };
    },
    sendDocument: async (filename, content) => {
      порядок.push("send");
      if (opts.отправкаПадает !== undefined) throw opts.отправкаПадает;
      отправлено.push({ filename, bytes: content.length });
    },
    sendMessage: async (text) => {
      if (opts.уведомлениеПадает) throw new Error("Telegram ответил 400 на sendMessage");
      сообщения.push(text);
    },
    panelUrl: opts.panelUrl ?? "https://panel.example",
    log: (message) => {
      лог.push(message);
    },
  };
  return { deps, порядок, сохранено, отправлено, сообщения, лог };
}

describe("Архив документов бота (срез A3, Р-A3-1/Р-A3-2)", () => {
  it("сохранение СТРОГО раньше отправки; оба удались — владельцу тишина", async () => {
    const st = стенд();
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.сохранено.length, 1);
    const запись = st.сохранено[0]!;
    assert.equal(запись.ownerType, "person");
    assert.equal(запись.ownerId, ВЛАДЕЛЕЦ.id);
    assert.equal(запись.kind, "doc");
    assert.equal(запись.title, "Дебиторка GLOBERENT 08.09.2026");
    assert.equal(запись.mime, XLSX);
    assert.equal(запись.filename, ФАЙЛ.filename);
    assert.deepEqual(запись.tags, ["bot"]);
    assert.equal(запись.domain, "globerent");
    assert.equal(запись.createdBy, "owner");
    assert.deepEqual(st.отправлено, [{ filename: ФАЙЛ.filename, bytes: ФАЙЛ.content.length }]);
    assert.deepEqual(st.сообщения, []);
    assert.deepEqual(итог, { savedId: "a1", sent: true });
  });

  it("архив бросил → файл всё равно отправлен, владельцу «в архив не лёг: …»", async () => {
    const st = стенд({ архивПадает: new CoreError(400, "/attachments", "Недопустимый тип файла") });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.отправлено.length, 1);
    assert.equal(st.сообщения.length, 1);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core отверг файл/);
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.ok(st.лог.includes("Документ не лёг в архив"));
    assert.deepEqual(итог, { savedId: null, sent: true });
  });

  it("отправка бросила при удавшемся сохранении → ссылка в архив, без «повтори запрос»", async () => {
    const st = стенд({ отправкаПадает: new Error("Telegram ответил 500 на sendDocument") });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.equal(st.сохранено.length, 1);
    assert.equal(
      st.сообщения[0],
      `Отправить в чат не вышло, файл в архиве: https://panel.example/artifacts?q=${encodeURIComponent("Дебиторка GLOBERENT 08.09.2026")}`,
    );
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.ok(st.лог.includes("Файл не отправлен"));
    assert.deepEqual(итог, { savedId: "a1", sent: false });
  });

  it("гость без person: сохранения нет, файл отправлен, сказано словами", async () => {
    const st = стенд({ владелец: null });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["send"]);
    assert.deepEqual(st.сохранено, []);
    assert.equal(st.отправлено.length, 1);
    assert.match(st.сообщения[0]!, /в архив не лёг: чат не привязан к человеку/);
    assert.deepEqual(итог, { savedId: null, sent: true });
  });

  it("Core недоступен при поиске владельца: не сохраняем, файл отправлен, причина названа", async () => {
    const st = стенд({ владелец: "core-down" });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["send"]);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core не ответил\./);
  });

  it("оба шага сорвались: файл потерян, сказано прямо, без старого «повтори запрос»", async () => {
    const st = стенд({
      архивПадает: new CoreError(500, "/attachments", "boom"),
      отправкаПадает: new Error("Telegram ответил 502 на sendDocument"),
    });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.deepEqual(st.порядок, ["save", "send"]);
    assert.match(st.сообщения[0]!, /не отправился и в архив не лёг: Core ответил 500/);
    assert.match(st.сообщения[0]!, /потерян/);
    assert.doesNotMatch(st.сообщения[0]!, /[Пп]овтори запрос/);
    assert.deepEqual(итог, { savedId: null, sent: false });
  });

  it("текст исключения наружу не едет — только ярлык", async () => {
    const st = стенд({ архивПадает: new Error("ECONNREFUSED 127.0.0.1:3001 /secret/path") });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.doesNotMatch(st.сообщения[0]!, /ECONNREFUSED|secret/);
    assert.match(st.сообщения[0]!, /в архив не лёг: Core недоступен\./);
  });

  it("сбой самой строки-уведомления не роняет доставку", async () => {
    const st = стенд({ владелец: null, уведомлениеПадает: true });
    const итог = await доставитьДокумент(st.deps, ФАЙЛ);
    assert.equal(итог.sent, true);
    assert.ok(st.лог.includes("Владелец не узнал о судьбе файла"));
  });

  it("без домена поле в архив не передаётся вовсе", async () => {
    const st = стенд();
    await доставитьДокумент(st.deps, { filename: "Задачи 08.09.2026.docx", content: Buffer.from("x") });
    assert.equal(Object.hasOwn(st.сохранено[0]!, "domain"), false);
  });

  it("ссылка без CC_PUBLIC_URL — путь, место всё равно названо", async () => {
    const st = стенд({ panelUrl: "", отправкаПадает: new Error("500") });
    await доставитьДокумент(st.deps, ФАЙЛ);
    assert.match(st.сообщения[0]!, /файл в архиве: \/artifacts\?q=/);
  });
});

describe("MIME по расширению — то, что примет белый список Core", () => {
  it("четыре формата @mydon/documents", () => {
    assert.equal(mimeПоРасширению("а.xlsx"), XLSX);
    assert.equal(
      mimeПоРасширению("а.docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(
      mimeПоРасширению("а.pptx"),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    assert.equal(mimeПоРасширению("а.pdf"), "application/pdf");
  });

  it("регистр расширения не важен, неизвестное → octet-stream (Core отвергнет вслух)", () => {
    assert.equal(mimeПоРасширению("Отчёт.XLSX"), XLSX);
    assert.equal(mimeПоРасширению("script.html"), "application/octet-stream");
    assert.equal(mimeПоРасширению("без-расширения"), "application/octet-stream");
  });
});

describe("Имя артефакта", () => {
  it("имя файла без расширения", () => {
    assert.equal(заголовокИзИмени("Дебиторка GLOBERENT 08.09.2026.xlsx"), "Дебиторка GLOBERENT 08.09.2026");
    assert.equal(заголовокИзИмени("без-расширения"), "без-расширения");
  });

  it("длинное имя режется до 120 символов (спека §6 п.4)", () => {
    const имя = заголовокИзИмени(`${"а".repeat(200)}.docx`);
    assert.equal(имя.length, TITLE_MAX);
  });
});

describe("Ярлык причины", () => {
  it("статусы Core → слова, без текста тела", () => {
    assert.equal(ярлыкПричины(new CoreError(400, "/attachments", "тело")), "Core отверг файл");
    assert.equal(ярлыкПричины(new CoreError(403, "/attachments", "")), "нет доступа к Core");
    assert.equal(ярлыкПричины(new CoreError(413, "/attachments", "")), "файл слишком большой");
    assert.equal(ярлыкПричины(new CoreError(503, "/attachments", "")), "Core ответил 503");
  });

  it("таймаут и прочее", () => {
    assert.equal(ярлыкПричины(Object.assign(new Error("x"), { name: "TimeoutError" })), "Core не ответил вовремя");
    assert.equal(ярлыкПричины(new Error("ECONNREFUSED")), "Core недоступен");
    assert.equal(ярлыкПричины("строка"), "Core недоступен");
  });
});

describe("Ссылка в витрину", () => {
  it("кодирует название и клеится к базе", () => {
    assert.equal(
      ссылкаНаАрхив("https://panel.example", "Дебиторка GLOBERENT"),
      "https://panel.example/artifacts?q=%D0%94%D0%B5%D0%B1%D0%B8%D1%82%D0%BE%D1%80%D0%BA%D0%B0%20GLOBERENT",
    );
    assert.equal(ссылкаНаАрхив("", "x"), "/artifacts?q=x");
  });
});
```

---

### - [ ] 4.5 Провода в `index.ts`, env, compose

**Файл:** `/Users/js/Developer/mydon/apps/bot/src/index.ts`.

1. После строки `import { handleMessage, parseApprovalCallback, type HandlerDeps } from "./handler";` добавить строку:
   `import { доставитьДокумент } from "./document-archive";`
2. После строки `  const coreUrl = process.env.CORE_API_URL ?? "http://127.0.0.1:3001";` добавить:

```ts
  // Публичный адрес панели — для строки «файл в архиве: <ссылка>» (срез A3).
  // Пусто → ссылка будет путём `/artifacts?…`: место названо, хоть и не
  // кликается. Хвостовой «/» срезаем, чтобы не клеить `//artifacts`.
  const panelUrl = (process.env.CC_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
```

3. Заменить блок (в `processUpdate`, ветка `if (reply) {` владельца):

```ts
          // Файл идёт отдельным сообщением: у документа своя доставка,
          // и она не должна мешать тексту, если сорвётся.
          if (reply.document) {
            try {
              await tg.sendDocument(chatId, reply.document.filename, reply.document.content);
            } catch (err) {
              console.error("Файл не отправлен:", err);
              await tg.sendMessage(
                chatId,
                "Файл получился, но отправить не вышло. Повтори запрос.",
              );
            }
          }
```

на

```ts
          // Файл идёт отдельным сообщением: у документа своя доставка,
          // и она не должна мешать тексту, если сорвётся.
          //
          // СНАЧАЛА архив, ПОТОМ Telegram (срез A3): документ стоил вызова
          // модели с исполнением кода, а до этого жил секунды. Порядок и
          // тексты — в document-archive.ts, здесь только провода.
          if (reply.document) {
            await доставитьДокумент(
              {
                resolveOwner: () => personOf(chatId),
                save: (input) => deps.core.saveAttachment(input),
                sendDocument: (filename, content) => tg.sendDocument(chatId, filename, content),
                sendMessage: (text) => tg.sendMessage(chatId, text),
                panelUrl,
                log: (message, error) => console.error(`${message}:`, error),
              },
              reply.document,
            );
          }
```

(`personOf` — замыкание, объявленное выше в `main()` (строка ~188); `tg` и `deps` там же.)

**Файл:** `/Users/js/Developer/mydon/.env.example`. В блоке `# ── Бот ──` после строки `CORE_API_URL=http://127.0.0.1:3001` добавить:

```
# Публичный адрес панели (за tailscale serve, напр. https://mydon.tail1234.ts.net):
# бот даёт ссылку «файл в архиве: …/artifacts?…», когда документ лёг в архив,
# а в чат не отправился (срез A3). Пусто → ссылка будет путём без хоста.
CC_PUBLIC_URL=
```

**Файл:** `/Users/js/Developer/mydon/deploy/docker-compose.yml`, сервис `mydon-bot`, блок `environment:`. После строки `      TELEGRAM_ALLOWED_CHAT_IDS: ${TELEGRAM_ALLOWED_CHAT_IDS:-}` добавить:

```yaml
      # Ссылка «файл в архиве» (срез A3). Пусто → путь без хоста.
      CC_PUBLIC_URL: ${CC_PUBLIC_URL:-}
```

---

### - [ ] 4.6 Проверка и коммит

Из корня `/Users/js/Developer/mydon`:

```bash
pnpm --filter @mydon/bot typecheck
pnpm turbo run build --filter=@mydon/bot
pnpm --filter @mydon/bot test
```

Ожидаемо: typecheck без ошибок (`noUnusedLocals` включён — лишних импортов нет); в выводе тестов новые группы «Архив документов (срез A3, Р-A3-1/Р-A3-2)» (10 тестов), «Архив документов (срез A3): saveAttachment» (3), «направление отчёта едет в план…» (1) — все зелёные. Тесты бегут из `dist` — сборка перед `test` обязательна.

Сторож старой строки (должен вернуть пусто):

```bash
grep -rn "Повтори запрос" apps/bot/src/index.ts; echo "exit=$?"
```

Ассерты, падающие при откате: `deepEqual(порядок, ["save","send"])` (откат порядка); `отправлено.length === 1` при упавшем архиве (откат «не блокирует»); `doesNotMatch(/[Пп]овтори запрос/)` (возврат старой строки); `сохранено.length === 0` для гостя; `form.get("tags") === '["bot"]'` и `form.has("domain") === false` (формат провода); `plan.domain === "globerent"` (домен в плане).

Коммит (Conventional Commits, ветка фичи, НЕ main):

```
feat(bot): документ ложится в архив до отправки в Telegram (срез A3, задача 4)
```

## Задача 5: витрина `/artifacts` в панели

Все пути — от корня монорепо `/Users/js/Developer/mydon`. Ветка — та, что мержится в main (сейчас `feat/design-wave-grammar`). Зависимость от Задачи 2 (маршрут `GET /artifacts` в Core) — только по контракту ответа `{ items, next, now }`: панель тестируется с моком, живой Core для тестов не нужен.

**Решение по теме (проверено по дереву):** файла `apps/cc/src/lib/theme.ts` и константы `CONSOLE_ROUTES` НЕТ — срез Д2 не смержен, тёмную тему включает клиентский `<ConsoleTheme />` (`apps/cc/src/components/console-theme.tsx`) на пяти страницах (`/crons`, `/flows`, `/skills`, `/brain`, `/apps`). Страница `/artifacts` делает то же самое. Если к моменту исполнения `lib/theme.ts` уже появится (Д2 смержен раньше) — вместо `<ConsoleTheme />` добавить `"/artifacts"` в `CONSOLE_ROUTES` и убрать импорт; всё остальное ниже не меняется.

Порядок шагов важен: сначала словарь и его сторож (шаги 1–3), потом клиент Core (4), потом страница (5–6), потом навигация (7) и документ навыка (8).

---

### Шаг 1. `apps/cc/src/lib/artifacts.ts` — константы и чистые функции витрины (НОВЫЙ файл)

- [ ] Создать файл со следующим содержимым ДОСЛОВНО:

```ts
import { DOMAINS, TZ, type Domain } from "@mydon/shared";

/**
 * Витрина артефактов (срез A3): константы и чистые функции без Core и без
 * React. Страница `/artifacts` только рисует; всё, что проверяется без
 * рендера, живёт здесь и закрыто `artifacts.test.ts`.
 *
 * Модуль читают и серверная страница, и `lib/state.ts` (тип `ArtifactKind`),
 * который импортируют клиентские компоненты, — поэтому здесь нет ни
 * `server-only`, ни импорта из `./core`.
 */

/**
 * ДЕНЬ, С КОТОРОГО ВЕДЁТСЯ АРХИВ.
 *
 * 2026-09-08 — день выката миграции `0089_attachment_artifacts` (колонки
 * `title`/`domain`/`tags` у `attachment`) и первого сохранения документа
 * ботом ДО отправки в Telegram. Раньше этого дня документы бота не сохранялись
 * нигде: пакет `@mydon/documents` делал файл, бот отправлял его и терял
 * (`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`). Поэтому
 * пустой экран обязан НАЗВАТЬ дату, а не сказать «ничего не найдено»:
 * «ничего» здесь значит «до этого дня архива не существовало» — факт о
 * системе, а не результат поиска (спека §0, Р-A3-5).
 *
 * КОНСТАНТА, А НЕ ЧТЕНИЕ ЖУРНАЛА DRIZZLE: `meta/_journal.json` хранит `when`
 * ГЕНЕРАЦИИ миграции на машине разработчика, а не день выката на прод, и
 * панель до файлов миграций не дотягивается. Если миграция выкатится в другой
 * день — править здесь; `artifacts.test.ts` пришпиливает слово к константе.
 */
export const ARTIFACTS_SINCE = "2026-09-08";

/**
 * Типы вложений на витрине — ровно те три, что принимает `POST /attachments`
 * (`UploadDto.kind` в `apps/core/src/attachments/attachments.controller.ts`).
 * Порядок — порядок в выпадающем списке: документ первым, потому что ради него
 * срез и затевался.
 */
export const ARTIFACT_KINDS = ["doc", "photo", "receipt"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

/** Сколько строк за раз: архив длинный, экран — нет; дальше — по курсору `next`. */
export const ARTIFACTS_LIMIT = "50";

/** Значение из адреса — один из трёх типов? Чужое (`?kind=video`) в Core не уходит: он ответит 400. */
export function isArtifactKind(v: string | undefined): v is ArtifactKind {
  return v !== undefined && (ARTIFACT_KINDS as readonly string[]).includes(v);
}

/** Значение из адреса — одно из направлений? Тот же довод, что у типа. */
export function isDomain(v: string | undefined): v is Domain {
  return v !== undefined && (DOMAINS as readonly string[]).includes(v);
}

/** Сутки в форме `YYYY-MM-DD` — единственная форма, которую страница принимает из адреса. */
const ДЕНЬ = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Дата начала архива словами: «8 сентября 2026».
 *
 * Год дописывается руками: `toLocaleDateString` с `year: "numeric"` печатает
 * «8 сентября 2026 г.», а сокращение «г.» в заголовке пустого экрана — шум.
 * Полдень UTC — чтобы день не уехал на границе суток ни в одном поясе.
 * Мусор на входе возвращается как есть: это константа из кода, и тест
 * увидит её раньше владельца.
 */
export function sinceWord(day: string = ARTIFACTS_SINCE): string {
  const m = ДЕНЬ.exec(day);
  if (m === null) return day;
  const год = Number(m[1]);
  const дата = new Date(Date.UTC(год, Number(m[2]) - 1, Number(m[3]), 12));
  if (!Number.isFinite(дата.getTime())) return day;
  return `${дата.toLocaleDateString("ru-RU", { timeZone: TZ, day: "numeric", month: "long" })} ${год}`;
}

/**
 * Смещение Ташкента: UTC+5 круглый год — Узбекистан не переводит часы с 1991
 * года, поэтому константа честна, а `TZ` из `@mydon/shared` нужен только для
 * печати. Границы периода считаются от суток ВЛАДЕЛЬЦА: «с 1 сентября» значит
 * с полуночи по Ташкенту, а не по UTC, — иначе документ, сделанный вечером
 * 31-го по местному времени, попадал бы «в сентябрь».
 */
const СМЕЩЕНИЕ = "+05:00";

/** Ташкентские сутки → ISO-момент; мусор и «2026-13-45» — `undefined`, а не бросок из `toISOString`. */
function момент(day: string | undefined, время: string): string | undefined {
  if (day === undefined || !ДЕНЬ.test(day)) return undefined;
  const d = new Date(`${day}T${время}${СМЕЩЕНИЕ}`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

/**
 * Период фильтра (две даты из адреса) → границы `from`/`to` для Core.
 *
 * Сутки включительно с обеих сторон: `to=2026-09-08` значит «до конца 8-го»,
 * а не «до его полуночи» — иначе однодневный период `from=to` был бы пустым.
 * Нечитаемая граница просто выпадает: страница скажет об этом словами, а
 * Core получит остальные фильтры.
 */
export function периодВМоменты(
  from: string | undefined,
  to: string | undefined,
): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  const f = момент(from, "00:00:00");
  const t = момент(to, "23:59:59.999");
  if (f !== undefined) out.from = f;
  if (t !== undefined) out.to = t;
  return out;
}

/**
 * Ссылка на сам файл — через прокси панели, а не на Core: Core наружу не
 * открыт, браузер владельца до него не дотянется
 * (`app/api/attachments/[id]/raw/route.ts` ходит в `GET /attachments/:id/raw`).
 * Прокси и Core отдают всё, что не картинка, с `Content-Disposition:
 * attachment` — docx/xlsx/pdf скачиваются, а не открываются в origin панели.
 */
export function fileHref(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}/raw`;
}

/**
 * HTML — в новой вкладке (спека §2.3): такой артефакт читают, а не кладут в
 * папку. Прочие типы — обычной ссылкой: браузер и так предложит сохранить.
 * По MIME, а не по расширению названия: `title` пишет человек или модель, и
 * расширения в нём может не быть вовсе. Параметры типа (`;charset=…`)
 * отбрасываем.
 */
export function opensInNewTab(mime: string | null): boolean {
  return mime !== null && mime.toLowerCase().split(";")[0].trim() === "text/html";
}

/**
 * «Для кого» — владелец вложения: слово и, если у него есть карточка в
 * панели, ссылка на неё. Имени в строке `/artifacts` нет намеренно: Core
 * отдаёт `ownerId`, а не имя, и дотягивать имена по 50 строкам — второй
 * запрос на каждую; карточка по ссылке назовёт имя за один переход.
 *
 * Слова здесь — подписи ТИПА ВЛАДЕЛЬЦА, а не состояния: их дом не
 * `lib/state.ts`. Незнакомый тип печатается как есть — это данные, и
 * придумывать им слово нельзя.
 */
export function ownerCard(ownerType: string, ownerId: string): { label: string; href: string | null } {
  switch (ownerType) {
    case "person":
      return { label: "для человека", href: `/team/${encodeURIComponent(ownerId)}` };
    case "task":
      return { label: "по задаче", href: `/tasks/${encodeURIComponent(ownerId)}` };
    case "entity":
      return { label: "к карточке", href: `/card/${encodeURIComponent(ownerId)}` };
    default:
      return { label: ownerType, href: null };
  }
}

/**
 * «Кто» — автор записи из `createdBy` (`owner | staff:<id> | agent:<имя>`,
 * см. `packages/db/src/schema.ts`, таблица `attachment`). `null` — не
 * записано, и строка это слово не печатает вовсе: «автор неизвестен» было бы
 * утверждением о мире, которого система не делает.
 */
export function authorWord(createdBy: string | null): string | null {
  if (createdBy === null || createdBy.length === 0) return null;
  if (createdBy === "owner") return "владелец";
  if (createdBy.startsWith("agent:")) return `агент ${createdBy.slice("agent:".length)}`;
  if (createdBy.startsWith("staff:")) return "сотрудник";
  return createdBy;
}
```

### Шаг 2. `apps/cc/src/lib/artifacts.test.ts` — тесты чистых функций (НОВЫЙ файл)

- [ ] Создать файл ДОСЛОВНО:

```ts
// @vitest-environment node
//
// Без DOM: здесь только даты, строки и ссылки (тот же приём, что в
// `lib/state.test.ts`).
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_KINDS,
  ARTIFACTS_LIMIT,
  ARTIFACTS_SINCE,
  authorWord,
  fileHref,
  isArtifactKind,
  isDomain,
  opensInNewTab,
  ownerCard,
  периодВМоменты,
  sinceWord,
} from "./artifacts";

describe("Дата начала архива (срез A3, Р-A3-5)", () => {
  it("константа — день выката миграции 0089, и слово пришпилено к ней", () => {
    // Если миграция выкатится в другой день, менять надо И константу, И этот
    // ассерт — сознательно, а не «сам собой».
    expect(ARTIFACTS_SINCE).toBe("2026-09-08");
    expect(sinceWord()).toBe("8 сентября 2026");
  });

  it("год без «г.», день без ведущего нуля, месяц в родительном падеже", () => {
    expect(sinceWord("2026-01-01")).toBe("1 января 2026");
    expect(sinceWord("2027-11-30")).toBe("30 ноября 2027");
  });

  it("мусор возвращается как есть, а не «Invalid Date»", () => {
    expect(sinceWord("вчера")).toBe("вчера");
    expect(sinceWord("2026-13-45")).toBe("2026-13-45");
  });
});

describe("Период фильтра → границы для Core", () => {
  it("ташкентские сутки включительно с обеих сторон", () => {
    expect(периодВМоменты("2026-09-01", "2026-09-08")).toEqual({
      from: "2026-08-31T19:00:00.000Z",
      to: "2026-09-08T18:59:59.999Z",
    });
  });

  it("однодневный период from=to не пуст", () => {
    const { from, to } = периодВМоменты("2026-09-08", "2026-09-08");
    expect(from).toBe("2026-09-07T19:00:00.000Z");
    expect(to).toBe("2026-09-08T18:59:59.999Z");
  });

  it("одна граница без другой — допустимо", () => {
    expect(периодВМоменты("2026-09-01", undefined)).toEqual({ from: "2026-08-31T19:00:00.000Z" });
    expect(периодВМоменты(undefined, "2026-09-01")).toEqual({ to: "2026-09-01T18:59:59.999Z" });
  });

  it("мусор и несуществующая дата выпадают, а не бросают", () => {
    expect(периодВМоменты("вчера", "2026-13-45")).toEqual({});
    expect(периодВМоменты("", "01.09.2026")).toEqual({});
  });
});

describe("Сужение значений из адреса", () => {
  it("типов ровно три, и они те же, что у UploadDto Core", () => {
    expect([...ARTIFACT_KINDS]).toEqual(["doc", "photo", "receipt"]);
    expect(isArtifactKind("doc")).toBe(true);
    expect(isArtifactKind("video")).toBe(false);
    expect(isArtifactKind(undefined)).toBe(false);
  });

  it("направления — из @mydon/shared", () => {
    expect(isDomain("vendhub")).toBe(true);
    expect(isDomain("trent")).toBe(false);
    expect(isDomain(undefined)).toBe(false);
  });

  it("страница просит 50 строк — потолок Core по контракту", () => {
    expect(ARTIFACTS_LIMIT).toBe("50");
  });
});

describe("Ссылка на файл и способ открытия", () => {
  it("файл — через прокси панели, не через Core", () => {
    expect(fileHref("8b1f2d3e-0000-4000-8000-000000000001")).toBe(
      "/api/attachments/8b1f2d3e-0000-4000-8000-000000000001/raw",
    );
  });

  it("в новой вкладке — только HTML, параметры типа не мешают", () => {
    expect(opensInNewTab("text/html")).toBe(true);
    expect(opensInNewTab("Text/HTML; charset=utf-8")).toBe(true);
    expect(
      opensInNewTab("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe(false);
    expect(opensInNewTab("application/pdf")).toBe(false);
    expect(opensInNewTab(null)).toBe(false);
  });
});

describe("Кто / для кого", () => {
  it("владелец с карточкой в панели получает ссылку, незнакомый — только слово", () => {
    expect(ownerCard("person", "2f6c9a7e-0000-4000-8000-0000000000aa")).toEqual({
      label: "для человека",
      href: "/team/2f6c9a7e-0000-4000-8000-0000000000aa",
    });
    expect(ownerCard("task", "t1")).toEqual({ label: "по задаче", href: "/tasks/t1" });
    expect(ownerCard("entity", "e1")).toEqual({ label: "к карточке", href: "/card/e1" });
    expect(ownerCard("stock_movement", "s1")).toEqual({ label: "stock_movement", href: null });
  });

  it("автор — словом, отсутствие автора — ничем", () => {
    expect(authorWord(null)).toBeNull();
    expect(authorWord("")).toBeNull();
    expect(authorWord("owner")).toBe("владелец");
    expect(authorWord("agent:finance")).toBe("агент finance");
    expect(authorWord("staff:2f6c9a7e")).toBe("сотрудник");
    expect(authorWord("bot")).toBe("bot");
  });
});
```

### Шаг 3. Словарь типов в `apps/cc/src/lib/state.ts` и его сторож `state.test.ts`

- [ ] В `apps/cc/src/lib/state.ts` заменить две первые строки импорта:

```ts
import { isSkipReason, type SkipReason } from "@mydon/shared";
import type { AgentCard, AgentState, AgentStatusRow, HealthState } from "./core";
```
на
```ts
import { isSkipReason, type SkipReason } from "@mydon/shared";
import type { ArtifactKind } from "./artifacts";
import type { AgentCard, AgentState, AgentStatusRow, HealthState } from "./core";
```

- [ ] В шапочном докблоке того же файла заменить абзац
```
 * увидеть это разом можно только здесь: в этом и смысл сведения в один файл, а
 * не в экономии строк.
```
на
```
 * увидеть это разом можно только здесь: в этом и смысл сведения в один файл, а
 * не в экономии строк. Пятый словарь в конце файла — ТИП артефакта
 * (`ARTIFACT_KIND_WORD`, срез A3) — осью состояния не является; почему он всё
 * равно живёт здесь, сказано у него.
```

- [ ] В конец `apps/cc/src/lib/state.ts` (после `PAUSE_LED`) дописать ДОСЛОВНО:

```ts

/**
 * ТИП АРТЕФАКТА → слово (срез A3, Р-A3-6).
 *
 * ПЯТЫЙ СЛОВАРЬ, И ЭТО НЕ СОСТОЯНИЕ. Четыре оси выше отвечают на вопрос «что
 * с ним сейчас»; тип вложения отвечает «что это за файл» и со временем не
 * меняется. Живёт он всё равно здесь, потому что причина у файла та же: слово
 * печатает витрина `/artifacts` (и выпадающий список её фильтра, и строка), а
 * завтра — карточка владельца; второй словарь разошёлся бы с первым на первой
 * же правке. Сторож `state.test.ts` ловит литерал «документ» мимо этого дома
 * так же, как «сломано».
 *
 * Ключи — ровно `UploadDto.kind` Core (`apps/core/src/attachments`), список —
 * `ARTIFACT_KINDS` в `lib/artifacts.ts`; новый тип на проводе сначала
 * появляется там, и компилятор (`Record<ArtifactKind, …>`) не даст забыть
 * слово здесь.
 */
export const ARTIFACT_KIND_WORD: Record<ArtifactKind, string> = {
  doc: "документ",
  photo: "фото",
  receipt: "чек",
};

/**
 * ТИП АРТЕФАКТА → класс лампы.
 *
 * У ВСЕХ ТРЁХ — БАЗОВАЯ ЛАМПА, И ЭТО РЕШЕНИЕ, А НЕ ЗАГЛУШКА. Цвет лампы в
 * панели значит здоровье (`.idle` — норма, `.blocked` — поломка, `.unknown` —
 * нет данных), а у документа здоровья нет: покрасить чек в зелёный значило бы
 * сказать «с чеком всё в порядке» — утверждение, которого система не делает.
 * Залитый серый квадрат — «ответ есть» (тип известен всегда), и он держит
 * анатомию строки Д1 (форма + слово + время) на одном листе с `/apps`.
 * Словарь существует ради двери: появится у типа свой вид — он меняется здесь
 * одним движением вместе со словом, а не в разметке.
 */
export const ARTIFACT_KIND_LED: Record<ArtifactKind, string> = {
  doc: "led",
  photo: "led",
  receipt: "led",
};
```

- [ ] В `apps/cc/src/lib/state.test.ts` — шесть правок якорями:

1. Импорт из `./state`: заменить
```ts
import {
  AGENT_BREAKDOWN_LED,
  AGENT_STATE_LED,
  AGENT_STATE_WORD,
  CARD_CHIP,
```
на
```ts
import {
  AGENT_BREAKDOWN_LED,
  AGENT_STATE_LED,
  AGENT_STATE_WORD,
  ARTIFACT_KIND_LED,
  ARTIFACT_KIND_WORD,
  CARD_CHIP,
```

2. Список `СЛОВА`: заменить
```ts
  "в архиве",
  "работают",
] as const;
```
на
```ts
  "в архиве",
  "работают",
  // Тип артефакта (срез A3, Р-A3-6) — не состояние, но дом у него тот же и
  // сторож тот же: «документ» мимо `lib/state.ts` — второй словарь.
  "документ",
  "фото",
  "чек",
] as const;
```

3. `ИСКЛЮЧЕНИЯ` — заменить весь блок (докблок + константу)
```ts
/**
 * Чужие дома, разрешённые ЯВНО, — с причиной у каждого.
 *
 * Единственный вход: сотрудник — не система. Его «работает» значит «в штате» и
 * стоит рядом с кнопкой «Больше не работает». Свести человеческую занятость в
 * словарь состояний СИСТЕМЫ значило бы положить «в штате» рядом с «занят прямо
 * сейчас» — то самое смешение, от которого этот модуль и заводился.
 */
const ИСКЛЮЧЕНИЯ: Record<string, readonly string[]> = {
  [path.join("components", "person-editor.tsx")]: ["работает"],
};
```
на
```ts
/**
 * Чужие дома, разрешённые ЯВНО, — с причиной у каждого.
 *
 * Сотрудник — не система. Его «работает» значит «в штате» и стоит рядом с
 * кнопкой «Больше не работает». Свести человеческую занятость в словарь
 * состояний СИСТЕМЫ значило бы положить «в штате» рядом с «занят прямо
 * сейчас» — то самое смешение, от которого этот модуль и заводился.
 *
 * Два входа ниже — не тип артефакта (срез A3), а ОМОНИМЫ на других осях.
 * «Документ» в легенде графа «Мозг» — вид УЗЛА (файл знаний с диска образа
 * рядом с «роутером» и «памятью»), а не вид вложения в хранилище. «Чек» в
 * карточке ингредиента — КЛЮЧ КОЛОНКИ импортированной таблицы закупок
 * (`row["чек"]`), то есть данные, а не слово панели. Оба — не второй словарь
 * типов, и записать их сюда честнее, чем переименовывать чужие оси ради
 * сторожа. Протухание исключений держит тест ниже.
 */
const ИСКЛЮЧЕНИЯ: Record<string, readonly string[]> = {
  [path.join("components", "person-editor.tsx")]: ["работает"],
  [path.join("lib", "brain-layout.ts")]: ["документ"],
  [path.join("components", "ingredient-card-360.tsx")]: ["чек"],
};
```

4. `ПОТРЕБИТЕЛИ`: заменить строку
```ts
  { файл: path.join("app", "apps", "page.tsx"), берёт: ["HEALTH_WORD", "HEALTH_LED"] },
```
на
```ts
  { файл: path.join("app", "apps", "page.tsx"), берёт: ["HEALTH_WORD", "HEALTH_LED"] },
  // Витрина артефактов (срез A3, Р-A3-6): тип вложения — слово и лампа из
  // пятого словаря; сам тип состоянием не является, дисциплина та же.
  {
    файл: path.join("app", "artifacts", "page.tsx"),
    берёт: ["ARTIFACT_KIND_WORD", "ARTIFACT_KIND_LED"],
  },
```

5. `КЛАССОВЫЕ_СЛОВАРИ`: заменить
```ts
  { имя: "PAUSE_LED", примитив: "led", карта: PAUSE_LED, слова: PAUSE_WORD },
] as const;
```
на
```ts
  { имя: "PAUSE_LED", примитив: "led", карта: PAUSE_LED, слова: PAUSE_WORD },
  { имя: "ARTIFACT_KIND_LED", примитив: "led", карта: ARTIFACT_KIND_LED, слова: ARTIFACT_KIND_WORD },
] as const;
```

6. Тест «список сторожа сходится с самими словарями»: заменить
```ts
      ...Object.values(CARD_WORD),
      ...Object.values(PAUSE_WORD),
    ]);
```
на
```ts
      ...Object.values(CARD_WORD),
      ...Object.values(PAUSE_WORD),
      ...Object.values(ARTIFACT_KIND_WORD),
    ]);
```
и имя теста
```ts
  it("исключение не протухло: person-editor.tsx всё ещё печатает «работает» сам", () => {
```
на
```ts
  it("исключения не протухли: каждый файл из списка всё ещё печатает своё слово сам", () => {
```

- [ ] Проверка шага: `pnpm --filter @mydon/cc test -- src/lib/state.test.ts src/lib/artifacts.test.ts` — зелёно. Контроль отката: убрать `"документ"` из `СЛОВА` → падает «список сторожа сходится»; написать в будущем `page.tsx` литерал `"документ"` → падает «второго словаря в apps/cc/src не осталось».

### Шаг 4. Клиент Core: `apps/cc/src/lib/core.ts` + `core.test.ts`

- [ ] В `apps/cc/src/lib/core.ts` в блок `import type { … } from "@mydon/shared";` (первые строки файла) добавить `Domain` — заменить
```ts
  DenominationCounts,
  LlmLedgerMonitoring,
```
на
```ts
  DenominationCounts,
  Domain,
  LlmLedgerMonitoring,
```

- [ ] Там же после интерфейса `AppsHealth` (якорь — его конец и начало докблока `coreWriteHeaders`) вставить типы. Заменить
```ts
  /** «Внутренние мониторы» — читают только Core: их здоровье — здоровье данных. */
  internal: AppsHealthRow[];
}

/**
 * Заголовки записи в Core: тип тела и внутренний токен.
```
на
```ts
  /** «Внутренние мониторы» — читают только Core: их здоровье — здоровье данных. */
  internal: AppsHealthRow[];
}

/**
 * Строка кольца артефактов — `GET /artifacts` (срез A3, Р-A3-3).
 *
 * БЕЗ `storageKey` И БЕЗ СОДЕРЖИМОГО: ключ хранилища — путь на томе Core, и
 * панели он не нужен ни для чего, кроме утечки; сам файл отдаёт
 * `GET /attachments/:id/raw` через прокси панели. `kind` — `string`, а не
 * союз трёх типов: колонка в БД текстовая, и строка, записанная мимо
 * `UploadDto`, не должна ронять витрину — экран сужает тип сам
 * (`isArtifactKind` в `lib/artifacts.ts`).
 */
export interface ArtifactRow {
  id: string;
  ownerType: string;
  ownerId: string;
  kind: string;
  /** Человеческое имя; `null` у полевых вложений (фото, чеки), снятых до среза A3. */
  title: string | null;
  domain: Domain | null;
  tags: string[];
  mime: string | null;
  bytes: number | null;
  /** Кто загрузил: owner | staff:<id> | agent:<имя>; `null` — не записано. */
  createdBy: string | null;
  createdAt: string;
}

/** Ответ `GET /artifacts`: страница, курсор следующей и часы Core для давности. */
export interface ArtifactList {
  items: ArtifactRow[];
  /** Непрозрачный курсор по `(created_at, id)`; `null` — страница последняя. */
  next: string | null;
  /** Часы Core: давность строк считается от них (Р-A3-6), а не от `Date.now()` панели. */
  now: string;
}

/**
 * Заголовки записи в Core: тип тела и внутренний токен.
```

- [ ] В объекте `core` после метода `appsHealth` вставить `artifacts`. Заменить
```ts
  appsHealth: () => getWithToken<AppsHealth>("/apps/health"),

  // ── Задачи ──
```
на
```ts
  appsHealth: () => getWithToken<AppsHealth>("/apps/health"),

  /**
   * Кольцо артефактов (срез A3, Р-A3-3): вложения по типу, владельцу,
   * направлению, периоду и названию, страницами по курсору.
   *
   * С ТОКЕНОМ: на `ArtifactsController` висит классовый `ReadTokenGuard` — в
   * названиях артефактов содержательный пересказ работы агентов по делам
   * владельца («Дебиторка GLOBERENT за август»), то же основание, что у
   * `/agents/status`. `owner: true` — тот же довод, что у `agentsStatus`:
   * артефакты с `domain=personal` — личный контур, и без второго пояса при
   * включённом ужесточении владелец молча не видел бы собственных документов.
   * Токен проставится, только если серверный контекст подтвердил владельца.
   *
   * Параметры уходят КАК ЕСТЬ: что считать фильтром, решает страница
   * (`app/artifacts/page.tsx`) — она же не пропускает в Core чужие значения из
   * адреса, на которые тот отвечает 400.
   */
  artifacts: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return getWithToken<ArtifactList>(`/artifacts${q ? `?${q}` : ""}`, { owner: true });
  },

  // ── Задачи ──
```

- [ ] В `apps/cc/src/lib/core.test.ts` внутри describe «Состояние агентов и здоровье приложений читаются С ТОКЕНОМ (C-1)» после теста `appsHealth` добавить тест. Заменить
```ts
  it("appsHealth несёт x-service-token", async () => {
    const заголовки = stubHeaders();
    await (await сТокеном()).appsHealth();
    expect(заголовки[0]?.["x-service-token"]).toBe("secret-token");
  });
});
```
на
```ts
  it("appsHealth несёт x-service-token", async () => {
    const заголовки = stubHeaders();
    await (await сТокеном()).appsHealth();
    expect(заголовки[0]?.["x-service-token"]).toBe("secret-token");
  });

  it("artifacts несёт x-service-token, а фильтры — в строке запроса (срез A3, Р-A3-3)", async () => {
    // Названия артефактов — пересказ работы агентов по делам владельца, и
    // `GET /artifacts` закрыт `ReadTokenGuard`: возврат на `get()` дал бы
    // здесь `undefined` и 401 на проде вместо витрины.
    const вызовы: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        вызовы.push({ url: String(url), headers: (init?.headers as Record<string, string>) ?? {} });
        return {
          ok: true,
          json: async () => ({ items: [], next: null, now: "2026-09-08T00:00:00.000Z" }),
        } as unknown as Response;
      }),
    );
    await (await сТокеном()).artifacts({ kind: "doc", q: "дебиторка", limit: "50" });
    expect(вызовы).toHaveLength(1);
    expect(вызовы[0]?.headers["x-service-token"]).toBe("secret-token");
    // Параметры не переписываются клиентом: страница решает, что фильтр.
    expect(decodeURIComponent(вызовы[0]?.url ?? "")).toContain("/artifacts?kind=doc&q=дебиторка&limit=50");
  });
});
```

- [ ] Проверка: `pnpm --filter @mydon/cc test -- src/lib/core.test.ts` зелёно; `pnpm --filter @mydon/cc typecheck` без ошибок (если tsc ругается на `.next/types/**` — `rm -rf apps/cc/.next` и повторить: протухший кеш роутов даёт ложные ошибки, известная ловушка репо).

### Шаг 5. Страница `apps/cc/src/app/artifacts/page.tsx` (НОВЫЙ файл)

- [ ] Создать каталог `apps/cc/src/app/artifacts/` и файл `page.tsx` ДОСЛОВНО:

```tsx
import { DOMAINS, DOMAIN_LABELS } from "@mydon/shared";
import Link from "next/link";
import { ConsoleTheme } from "../../components/console-theme";
import { CoreDown } from "../../components/core-down";
import { core, CoreUnavailable, type ArtifactList, type ArtifactRow } from "../../lib/core";
import {
  ARTIFACT_KINDS,
  ARTIFACTS_LIMIT,
  authorWord,
  fileHref,
  isArtifactKind,
  isDomain,
  opensInNewTab,
  ownerCard,
  периодВМоменты,
  sinceWord,
} from "../../lib/artifacts";
import { ago, plural } from "../../lib/format";
import { ARTIFACT_KIND_LED, ARTIFACT_KIND_WORD } from "../../lib/state";

export const dynamic = "force-dynamic";

/** Пустую строку запроса считаем отсутствующим фильтром: `?kind=` — это не фильтр. */
const pick = (v: string | undefined): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Кольцо артефактов (срез A3, Р-A3-4 … Р-A3-6).
 *
 * Отвечает на один вопрос: «где тот файл, который бот (агент) сделал для
 * меня». До среза ответа не было вовсе: документ, стоивший вызова модели с
 * исполнением кода, уходил в Telegram и не сохранялся нигде
 * (`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`). Поэтому
 * экран честен о прошлом: пустое состояние НАЗЫВАЕТ ДАТУ, с которой архив
 * ведётся, а не говорит «ничего не найдено» (`ARTIFACTS_SINCE`).
 *
 * ФИЛЬТРЫ ЖИВУТ В АДРЕСЕ, а не в состоянии клиента: форма GET без JS, как на
 * `/flows`, — выборку можно сохранить закладкой и переслать. Тип, направление
 * и даты из адреса СУЖАЮТСЯ до известных значений ПЕРЕД походом в Core: на
 * чужое значение Core отвечает 400, и экран показал бы «нет связи» вместо
 * витрины из-за опечатки в закладке. Непринятый фильтр называется словами.
 *
 * ГРАММАТИКА СТРОКИ — Д1 (`rules.md` §4.1): слово (тип из `lib/state.ts`) +
 * лампа + давность по ЧАСАМ CORE (`list.now`, а не `Date.now()` — тот же
 * довод, что у `/apps`: на границе суток «сегодня» панели и Core разъезжаются).
 * Классы — те, что уже стоят на этом листе (`.approw`, `.search`,
 * `.flows-filter`, `.empty`, `.warn`, `.hint`): новых токенов и классов срез
 * не заводит.
 *
 * ССЫЛКА НА ФАЙЛ — через прокси панели (`fileHref`), не на Core напрямую: Core
 * наружу не открыт. HTML — в новой вкладке, прочее — обычной ссылкой.
 *
 * Тёмная тема: это экран агентского слоя, как `/apps`, `/flows`, `/crons`, —
 * через `ConsoleTheme`, как соседи. `CONSOLE_ROUTES` (`lib/theme.ts`, срез Д2)
 * в дереве на момент среза нет; Д2 переведёт этот экран вместе с остальными.
 */
export default async function ArtifactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    domain?: string;
    from?: string;
    to?: string;
    q?: string;
    cursor?: string;
  }>;
}) {
  const sp = await searchParams;
  const askedKind = pick(sp.kind);
  const askedDomain = pick(sp.domain);
  const askedFrom = pick(sp.from);
  const askedTo = pick(sp.to);
  const q = pick(sp.q);
  const cursor = pick(sp.cursor);

  const kind = isArtifactKind(askedKind) ? askedKind : undefined;
  const domain = isDomain(askedDomain) ? askedDomain : undefined;
  const период = периодВМоменты(askedFrom, askedTo);
  // Дни из адреса, которые разобрались: они же возвращаются в поля формы и в
  // ссылку «дальше». Мусор (`from=вчера`) в форму не возвращаем — иначе
  // владелец отправил бы его повторно, не заметив.
  const from = период.from !== undefined ? askedFrom : undefined;
  const to = период.to !== undefined ? askedTo : undefined;

  const неПрименены: string[] = [];
  if (askedKind !== undefined && kind === undefined) неПрименены.push(`тип «${askedKind}»`);
  if (askedDomain !== undefined && domain === undefined) {
    неПрименены.push(`направление «${askedDomain}»`);
  }
  if (askedFrom !== undefined && from === undefined) неПрименены.push(`дата с «${askedFrom}»`);
  if (askedTo !== undefined && to === undefined) неПрименены.push(`дата по «${askedTo}»`);

  /** Фильтры страницы, пережившие проверку, — в форме адреса (дни, не ISO). */
  const filters: Record<string, string> = {
    ...(kind !== undefined ? { kind } : {}),
    ...(domain !== undefined ? { domain } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(q !== undefined ? { q } : {}),
  };
  const filtered = Object.keys(filters).length > 0;

  let list: ArtifactList;
  try {
    list = await core.artifacts({
      ...(kind !== undefined ? { kind } : {}),
      ...(domain !== undefined ? { domain } : {}),
      ...(период.from !== undefined ? { from: период.from } : {}),
      ...(период.to !== undefined ? { to: период.to } : {}),
      ...(q !== undefined ? { q } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
      limit: ARTIFACTS_LIMIT,
    });
  } catch (err) {
    return <CoreDown detail={err instanceof CoreUnavailable ? err.detail : String(err)} />;
  }

  // Момент, от которого считается давность: часы ЯДРА, не браузера (Р-A3-6).
  const момент = new Date(list.now);
  const n = list.items.length;
  const с = sinceWord();
  /** Адрес с текущими фильтрами плюс что-то ещё (курсор): возврат и «дальше» не теряют выборку. */
  const адрес = (extra: Record<string, string>): string => {
    const qs = new URLSearchParams({ ...filters, ...extra }).toString();
    return qs ? `/artifacts?${qs}` : "/artifacts";
  };

  return (
    <>
      <ConsoleTheme />
      <div className="page-head">
        <h1>Артефакты</h1>
        <p className="lead">
          {n === 0
            ? `архив ведётся с ${с}`
            : `${n} ${plural(n, "артефакт", "артефакта", "артефактов")} · последние сверху · архив ведётся с ${с}`}
        </p>
      </div>

      {неПрименены.length > 0 && (
        <div className="warn" style={{ marginBottom: 12 }}>
          <b>Часть фильтров не применена</b>
          В адресе: {неПрименены.join(", ")} — таких значений нет. Показана выборка без них.
        </div>
      )}

      {/* Форма GET, без JS: фильтр живёт в адресе, значит его можно сохранить
          в закладке и переслать — и он работает даже когда клиент не поднялся. */}
      <form className="search flows-filter" action="/artifacts" method="get">
        <select name="kind" defaultValue={kind ?? ""} aria-label="Тип">
          <option value="">Любой тип</option>
          {ARTIFACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {ARTIFACT_KIND_WORD[k]}
            </option>
          ))}
        </select>
        <select name="domain" defaultValue={domain ?? ""} aria-label="Направление">
          <option value="">Любое направление</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d]}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from ?? ""} aria-label="С даты" />
        <input type="date" name="to" defaultValue={to ?? ""} aria-label="По дату" />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Название"
          aria-label="Название"
        />
        <button className="btn" type="submit" style={{ flex: "none", padding: "11px 18px" }}>
          Показать
        </button>
      </form>

      {n === 0 ? (
        <EmptyState filtered={filtered} cursor={cursor} since={с} back={адрес({})} />
      ) : (
        <section aria-label="Список артефактов">
          {list.items.map((row) => (
            <ArtifactRowView key={row.id} row={row} now={момент} />
          ))}
          {list.next !== null && (
            <p className="hint">
              Показаны {n} {plural(n, "строка", "строки", "строк")} ·{" "}
              <Link href={адрес({ cursor: list.next })}>дальше →</Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}

/**
 * Пустое состояние ГОВОРИТ ПРАВДУ И НАЗЫВАЕТ ДАТУ (Р-A3-5) — в обеих ветках
 * фильтра, а не только в «чистой»: под фильтром владелец так же должен знать,
 * что искать раньше `ARTIFACTS_SINCE` нечего. «Ничего не найдено» здесь не
 * звучит нигде: до этого дня ничего и не сохранялось — это факт о системе, а
 * не результат поиска. Третья ветка — курсор за последней страницей: это не
 * «пусто», это «список кончился», и дата тут ни при чём.
 */
function EmptyState({
  filtered,
  cursor,
  since,
  back,
}: {
  filtered: boolean;
  cursor: string | undefined;
  since: string;
  back: string;
}) {
  if (cursor !== undefined) {
    return (
      <div className="empty">
        <b>Дальше пусто</b>
        Страница за курсором закончилась — <Link href={back}>к началу списка</Link>.
      </div>
    );
  }
  if (filtered) {
    return (
      <div className="empty">
        <b>Под фильтр ничего не попало</b>
        Архив ведётся с {since}: раньше этой даты артефактов не существует. Сними фильтр или
        расширь период.
      </div>
    );
  }
  return (
    <div className="empty">
      <b>Артефактов с {since} ещё нет</b>
      До этого дня документы бота не сохранялись — искать раньше нечего. Первый файл, который
      бот сделает по запросу, появится здесь.
    </div>
  );
}

/**
 * Строка артефакта (грамматика Д1): тип словом и лампой, название-ссылка на
 * файл, кто / для кого / направление, давность по часам Core.
 *
 * Название и владелец — ДВЕ ссылки в одной строке, поэтому строка не `<Link>`
 * целиком, как на `/apps`: вложенные `<a>` — невалидная разметка, и браузер
 * разорвал бы её сам, непредсказуемо.
 */
function ArtifactRowView({ row, now }: { row: ArtifactRow; now: Date }) {
  // Тип мимо словаря (строка, записанная не через `UploadDto`) печатается КАК
  // ЕСТЬ и с базовой лампой: это данные, а сочинять им слово нельзя.
  const kind = isArtifactKind(row.kind) ? row.kind : null;
  const владелец = ownerCard(row.ownerType, row.ownerId);
  const автор = authorWord(row.createdBy);
  return (
    <div className="approw" data-kind={row.kind}>
      <span className={kind !== null ? ARTIFACT_KIND_LED[kind] : "led"}>
        {kind !== null ? ARTIFACT_KIND_WORD[kind] : row.kind}
      </span>
      <div className="ab">
        <div className="an">
          <a
            href={fileHref(row.id)}
            {...(opensInNewTab(row.mime) ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {row.title ?? "без названия"}
          </a>
        </div>
        <div className="as">
          {автор !== null && `${автор} · `}
          {владелец.href !== null ? (
            <Link href={владелец.href}>{владелец.label}</Link>
          ) : (
            владелец.label
          )}
          {row.domain !== null && ` · ${DOMAIN_LABELS[row.domain]}`}
        </div>
      </div>
      <div className="aw">{ago(row.createdAt, now)}</div>
    </div>
  );
}
```

### Шаг 6. Тесты страницы `apps/cc/src/app/artifacts/page.test.tsx` (НОВЫЙ файл)

- [ ] Создать ДОСЛОВНО:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARTIFACTS_SINCE } from "../../lib/artifacts";
import type { ArtifactList, ArtifactRow } from "../../lib/core";
import { ago } from "../../lib/format";
import { ARTIFACT_KIND_WORD } from "../../lib/state";

// `page.tsx` тянет клиент Core, а тот первой строкой импортирует пакет
// `server-only`, которого вне RSC не существует.
const artifacts = vi.hoisted(() => vi.fn());
vi.mock("../../lib/core", () => ({
  core: { artifacts },
  CoreUnavailable: class CoreUnavailable extends Error {
    constructor(readonly detail: string) {
      super("Core недоступен");
    }
  },
}));

import ArtifactsPage from "./page";

/** Часы Core в ответе: от них считается давность, а не от часов машины. */
const СЕЙЧАС = "2026-09-08T10:00:00.000Z";

/** Строка архива: остальное — «документ бота для человека по GLOBERENT». */
function строка(over: Partial<ArtifactRow>): ArtifactRow {
  return {
    id: "8b1f2d3e-0000-4000-8000-000000000001",
    ownerType: "person",
    ownerId: "2f6c9a7e-0000-4000-8000-0000000000aa",
    kind: "doc",
    title: "Дебиторка GLOBERENT за август",
    domain: "globerent",
    tags: ["bot"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: 24_576,
    createdBy: null,
    createdAt: "2026-09-08T09:30:00.000Z",
    ...over,
  };
}

const пусто: ArtifactList = { items: [], next: null, now: СЕЙЧАС };

/** Рендер серверной страницы с адресом: `searchParams` в Next 16 — промис. */
async function страница(sp: Record<string, string> = {}) {
  return render(await ArtifactsPage({ searchParams: Promise.resolve(sp) }));
}

/*
 * Реализацию задаём ТОЛЬКО через `mockImplementation`: `mockResolvedValue`
 * заставляет vitest 3.2 отслеживать промисы мока, и соседний тест с
 * синхронным исключением падает «необработанным» отказом.
 */
beforeEach(() => {
  artifacts.mockImplementation(async () => пусто);
});

/* Часы машины возвращаются ВСЕГДА: один подменённый `Date` протёк бы дальше. */
afterEach(() => {
  vi.useRealTimers();
});

describe("Витрина «Артефакты»: пустое состояние называет дату (Р-A3-5)", () => {
  it("без фильтра: «Артефактов с 8 сентября 2026 ещё нет», а не «ничего не найдено»", async () => {
    const { container } = await страница();
    const пустое = container.querySelector(".empty");
    expect(пустое).toHaveTextContent("Артефактов с 8 сентября 2026 ещё нет");
    expect(пустое).not.toHaveTextContent(/ничего не найдено/i);
    // Дата на экране — та самая константа, а не второе число, живущее в разметке.
    expect(ARTIFACTS_SINCE).toBe("2026-09-08");
    // Ни одной лампы: показывать нечего.
    expect(container.querySelector(".led")).toBeNull();
  });

  it("под фильтром дата тоже названа: пусто не в архиве, а в выборке", async () => {
    const { container } = await страница({ kind: "photo" });
    const пустое = container.querySelector(".empty");
    expect(пустое).toHaveTextContent("Под фильтр ничего не попало");
    expect(пустое).toHaveTextContent("8 сентября 2026");
    expect(пустое).not.toHaveTextContent(/ничего не найдено/i);
  });

  it("курсор за последней страницей — «дальше пусто» со ссылкой к началу, без даты", async () => {
    await страница({ kind: "doc", cursor: "eyJ" });
    expect(screen.getByText("Дальше пусто")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "к началу списка" })).toHaveAttribute(
      "href",
      "/artifacts?kind=doc",
    );
  });
});

describe("Витрина «Артефакты»: фильтры уходят в запрос (Р-A3-3, Р-A3-4)", () => {
  it("тип, направление, период и название — в Core одним вызовом, даты — границами суток Ташкента", async () => {
    await страница({
      kind: "doc",
      domain: "vendhub",
      from: "2026-09-01",
      to: "2026-09-08",
      q: "дебиторка",
    });
    expect(artifacts).toHaveBeenCalledTimes(1);
    expect(artifacts).toHaveBeenCalledWith({
      kind: "doc",
      domain: "vendhub",
      from: "2026-08-31T19:00:00.000Z",
      to: "2026-09-08T18:59:59.999Z",
      q: "дебиторка",
      limit: "50",
    });
  });

  it("без фильтров — только потолок строк", async () => {
    await страница();
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
  });

  it("чужие значения из адреса в Core не уходят и названы словами", async () => {
    // На `kind=video` Core ответит 400, и экран показал бы «нет связи» из-за
    // опечатки в закладке. Фильтр снимается, а не проглатывается молча.
    await страница({ kind: "video", domain: "trent", from: "вчера", to: "2026-13-45" });
    expect(artifacts).toHaveBeenCalledWith({ limit: "50" });
    const предупреждение = screen.getByText("Часть фильтров не применена").closest(".warn");
    expect(предупреждение).toHaveTextContent("тип «video»");
    expect(предупреждение).toHaveTextContent("направление «trent»");
    expect(предупреждение).toHaveTextContent("дата с «вчера»");
    expect(предупреждение).toHaveTextContent("дата по «2026-13-45»");
  });

  it("курсор передаётся как есть, а ссылка «дальше» несёт фильтры и новый курсор", async () => {
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: "eyJ", now: СЕЙЧАС }));
    await страница({ kind: "doc", cursor: "abc" });
    expect(artifacts).toHaveBeenCalledWith({ kind: "doc", cursor: "abc", limit: "50" });
    expect(screen.getByRole("link", { name: "дальше →" })).toHaveAttribute(
      "href",
      "/artifacts?kind=doc&cursor=eyJ",
    );
  });

  it("поля формы возвращают принятые фильтры, а не мусор из адреса", async () => {
    await страница({ kind: "doc", from: "2026-09-01", to: "вчера", q: "дебиторка" });
    expect(screen.getByLabelText("Тип")).toHaveValue("doc");
    expect(screen.getByLabelText("С даты")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("По дату")).toHaveValue("");
    expect(screen.getByLabelText("Название")).toHaveValue("дебиторка");
  });
});

describe("Витрина «Артефакты»: строка в грамматике Д1 (Р-A3-6)", () => {
  it("давность считается от часов CORE, а не от часов машины", async () => {
    /*
     * ЧАСЫ МАШИНЫ УВЕДЕНЫ НА ТРИ НЕДЕЛИ ВПЕРЁД, и это не декорация: от
     * `list.now` (08.09) давность — «2 дня назад», от `Date.now()` вышло бы
     * «24 дня назад». Только на разошедшихся часах ассерт что-то проверяет.
     * Подменяется ТОЛЬКО `Date`: фальшивые таймеры целиком остановили бы
     * планировщик, на котором держится рендер.
     */
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-30T10:00:00.000Z") });
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdAt: "2026-09-06T10:00:00.000Z" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const ячейка = container.querySelector(".approw .aw");
    const отCore = ago("2026-09-06T10:00:00.000Z", new Date(СЕЙЧАС));
    expect(отCore).toBe("2 дня назад");
    expect(ячейка).toHaveTextContent(отCore);
    expect(ячейка).not.toHaveTextContent(ago("2026-09-06T10:00:00.000Z", new Date()));
  });

  it("тип — словом из lib/state и лампой; строка несёт тип атрибутом", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ kind: "receipt", title: "Чек за кофе" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const лампа = screen.getByText(ARTIFACT_KIND_WORD.receipt);
    expect(лампа).toHaveClass("led");
    // Тип — не здоровье: ни зелёной, ни красной лампы у чека быть не может.
    expect(лампа).not.toHaveClass("idle");
    expect(лампа).not.toHaveClass("blocked");
    expect(container.querySelector('.approw[data-kind="receipt"]')).not.toBeNull();
  });

  it("тип мимо словаря печатается как есть и не роняет витрину", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ kind: "scan" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    expect(screen.getByText("scan")).toHaveClass("led");
  });

  it("название — ссылка на файл через прокси панели; docx — не в новой вкладке", async () => {
    artifacts.mockImplementation(async () => ({ items: [строка({})], next: null, now: СЕЙЧАС }));
    await страница();
    const ссылка = screen.getByRole("link", { name: "Дебиторка GLOBERENT за август" });
    expect(ссылка).toHaveAttribute("href", "/api/attachments/8b1f2d3e-0000-4000-8000-000000000001/raw");
    expect(ссылка).not.toHaveAttribute("target");
  });

  it("HTML открывается в новой вкладке", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ mime: "text/html; charset=utf-8", title: "Отчёт о продажах" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    const ссылка = screen.getByRole("link", { name: "Отчёт о продажах" });
    expect(ссылка).toHaveAttribute("target", "_blank");
    expect(ссылка).toHaveAttribute("rel", "noreferrer");
  });

  it("кто / для кого / направление — одной строкой, владелец — ссылкой на карточку", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: "agent:finance", domain: "vendhub" })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    const мета = container.querySelector(".approw .as");
    expect(мета).toHaveTextContent("агент finance · для человека · VendHub");
    expect(screen.getByRole("link", { name: "для человека" })).toHaveAttribute(
      "href",
      "/team/2f6c9a7e-0000-4000-8000-0000000000aa",
    );
  });

  it("без автора и направления строка не выдумывает слов", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({ createdBy: null, domain: null, title: null })],
      next: null,
      now: СЕЙЧАС,
    }));
    const { container } = await страница();
    expect(container.querySelector(".approw .as")).toHaveTextContent(/^для человека$/);
    expect(screen.getByRole("link", { name: "без названия" })).toBeInTheDocument();
  });

  it("storageKey и содержимое файла на экран не попадают", async () => {
    // Core по контракту `storageKey` не отдаёт; но если отдаст (регресс в
    // сервисе), панель обязана его не печатать — ни текстом, ни атрибутом.
    const сУтечкой = {
      ...строка({}),
      storageKey: "person/2f6c9a7e/secret-tail.docx",
    } as ArtifactRow;
    artifacts.mockImplementation(async () => ({ items: [сУтечкой], next: null, now: СЕЙЧАС }));
    const { container } = await страница();
    expect(container.innerHTML).not.toContain("secret-tail");
    expect(container.innerHTML).not.toContain("storageKey");
  });

  it("сводка в шапке считает строки и называет дату архива", async () => {
    artifacts.mockImplementation(async () => ({
      items: [строка({}), строка({ id: "8b1f2d3e-0000-4000-8000-000000000002" })],
      next: null,
      now: СЕЙЧАС,
    }));
    await страница();
    expect(screen.getByText(/^2 артефакта · последние сверху · архив ведётся с 8 сентября 2026$/)).toBeInTheDocument();
  });
});

describe("Витрина «Артефакты»: оболочка", () => {
  it("экран агентского слоя — тёмная тема через ConsoleTheme, как у /apps", async () => {
    await страница();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("отказ Core показывает «Core недоступен», а не пустую витрину с датой", async () => {
    artifacts.mockImplementation(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    await страница();
    expect(screen.getByText(/Нет связи с ядром MYDON/i)).toBeInTheDocument();
    expect(screen.queryByText(/ещё нет/)).toBeNull();
  });
});
```

- [ ] Проверка: `pnpm --filter @mydon/cc test -- src/app/artifacts src/lib/state.test.ts` — зелёно (сторож `ПОТРЕБИТЕЛИ` теперь находит `app/artifacts/page.tsx` и проверяет, что в нём есть `ARTIFACT_KIND_WORD` и `ARTIFACT_KIND_LED` и нет литералов «документ»/«фото»/«чек»).

### Шаг 7. Навигация: `apps/cc/src/components/nav.tsx` + `nav.test.tsx`

- [ ] В `apps/cc/src/components/nav.tsx` в массиве `SYSTEM` заменить строку
```ts
  { href: "/brain", icon: "sky", label: "Мозг" },
```
на
```ts
  { href: "/brain", icon: "sky", label: "Мозг" },
  // «Артефакты» — кольцо того, что произвели бот и агенты: документы, фото,
  // чеки из хранилища `attachment` (срез A3). Рядом с «Документами» и «Мозгом»
  // намеренно: те — знания с диска образа, это — файлы из хранилища; три
  // взгляда на «что у нас есть». В SYSTEM, а не в MAIN: таббар телефона
  // занят семью пунктами.
  { href: "/artifacts", icon: "jour", label: "Артефакты" },
```

- [ ] Создать `apps/cc/src/components/nav.test.tsx` ДОСЛОВНО:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `usePathname` живёт только внутри маршрутизатора Next; вне него — подмена.
const mocks = vi.hoisted(() => ({ pathname: "/artifacts" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

import { Sidebar, TabBar } from "./nav";

describe("Навигация: пункт «Артефакты» (срез A3)", () => {
  it("сайдбар ведёт на /artifacts и подсвечивает его как текущий", () => {
    render(<Sidebar pendingCount={0} />);
    const пункт = screen.getByRole("link", { name: "Артефакты" });
    expect(пункт).toHaveAttribute("href", "/artifacts");
    expect(пункт).toHaveAttribute("aria-current", "page");
  });

  it("в таббар телефона пункт НЕ попадает: он сквозной, а таббар занят семью", () => {
    render(<TabBar pendingCount={0} />);
    expect(screen.queryByRole("link", { name: "Артефакты" })).toBeNull();
  });
});
```

- [ ] Проверка: `pnpm --filter @mydon/cc test -- src/components/nav.test.tsx` зелёно; откат пункта в `nav.tsx` роняет первый тест.

### Шаг 8. Навык дизайна: §9 `rules.md` больше не утверждает, что `/artifacts` не существует

Сторож `apps/cc/src/test/design-skill.test.ts` (описание «зеркала навыка не разъезжаются») сравнивает `rules.md` побайтно в трёх копиях — правка вносится во ВСЕ ТРИ одинаково:
`.claude/skills/mydon-design/rules.md`, `.agents/skills/mydon-design/rules.md`, `docs/agentic-os-starter/claude-skills/mydon-design/rules.md`.

- [ ] В каждом из трёх файлов в разделе «## 9. Долг среза Д2» заменить фрагмент
```
  (`apps/cc/src/components/console-theme.tsx`), и стоит он ровно на ПЯТИ страницах: `/crons`, `/flows`,
  `/skills`, `/brain`, `/apps`. В §4 при этом названы `/mydon` и `/agents` — они СВЕТЛЫЕ; `/apps` тёмный,
  но в списке не назван; `/docs` не назван нигде, хотя маршрут есть и он светлый; `/artifacts` не
  существует как маршрут вовсе (это срез A3). Список исправляется вместе с механизмом темы — хранение
  выбора, переключатель, серверный канал без мигания первого кадра — в срезе Д2.
```
на
```
  (`apps/cc/src/components/console-theme.tsx`), и стоит он ровно на ШЕСТИ страницах: `/crons`, `/flows`,
  `/skills`, `/brain`, `/apps`, `/artifacts`. В §4 при этом названы `/mydon` и `/agents` — они СВЕТЛЫЕ;
  `/apps` тёмный, но в списке не назван; `/docs` не назван нигде, хотя маршрут есть и он светлый;
  `/artifacts` появился в срезе A3 и взял `ConsoleTheme`, как соседи, — `CONSOLE_ROUTES` в
  `lib/theme.ts` на тот момент не существовало. Список исправляется вместе с механизмом темы — хранение
  выбора, переключатель, серверный канал без мигания первого кадра — в срезе Д2.
```
- [ ] Проверка: `cmp .claude/skills/mydon-design/rules.md .agents/skills/mydon-design/rules.md && cmp .claude/skills/mydon-design/rules.md docs/agentic-os-starter/claude-skills/mydon-design/rules.md` — тишина; `pnpm --filter @mydon/cc test -- src/test/design-skill.test.ts` зелёно (тест §9 требует упоминания `/artifacts` — оно осталось).

### Шаг 9. Полная проверка панели

- [ ] `pnpm --filter @mydon/cc test` — весь пакет зелёный (в том числе `state.test.ts`: «второго словаря в apps/cc/src не осталось» с тремя новыми словами и двумя исключениями; `state-weight.test.tsx`; `palette.test.ts`).
- [ ] `pnpm --filter @mydon/cc typecheck` — чисто (при ошибках из `.next/types` — `rm -rf apps/cc/.next` и повторить).
- [ ] `pnpm --filter @mydon/cc lint` — чисто.
- [ ] Ручная проверка (после мержа Задачи 2 и деплоя, локально через `pnpm --filter cc dev` + SSH-туннель 3001 с `SERVICE_TOKEN` в `.env.local`): открыть `/artifacts` — тёмная тема, пункт «Артефакты» подсвечен, пустое состояние с датой; `/artifacts?kind=video` — предупреждение о непринятом фильтре, а не «Core недоступен»; после сохранения документа ботом — строка с типом «документ», «для человека» ведёт на `/team/<id>`, клик по названию скачивает файл через `/api/attachments/<id>/raw`.

### Ассерты, падающие при откате (сводно)
- откат `ARTIFACTS_SINCE`/`sinceWord` → `artifacts.test.ts` и «пустое состояние называет дату»;
- литерал типа мимо `lib/state.ts` или лампа от руки в `page.tsx` → `state.test.ts` (сторож слов, сторож классов, `ПОТРЕБИТЕЛИ`);
- `core.artifacts` без токена или с переписанными параметрами → `core.test.ts`;
- давность от `Date.now()` → «давность считается от часов CORE» (часы машины уведены на 3 недели);
- фильтр не ушёл в Core / чужое значение ушло → «фильтры уходят в запрос», «чужие значения…»;
- `storageKey` в разметке → «storageKey и содержимое файла на экран не попадают»;
- пункт меню снят → `nav.test.tsx`;
- расхождение зеркал `rules.md` → `design-skill.test.ts`.

## Задача 6: решение, навык, документация

**Исполняется ПОСЛЕ задач 1–5** (читает их файлы: миграцию 0089, `ARTIFACTS_SINCE`, словари в `state.ts`, `page.tsx`). Файлы не в репо — сторож и `verify-paths.mjs` красные по построению.

**Вариант темы — проверен по дереву:** `apps/cc/src/lib/theme.ts` НЕТ, маркера `<!-- CONSOLE_ROUTES -->` в `rules.md` §4 НЕТ → `/artifacts` тёмный через `<ConsoleTheme/>`, §9 `rules.md` правится руками. Перед началом выполнить:

```sh
cd /Users/js/Developer/mydon && test -e apps/cc/src/lib/theme.ts && echo "Д2 СМЕРЖЕН — раздел написан под вариант без Д2, вернуть контроллеру (вопрос 4)" || echo "вариант ConsoleTheme — продолжать"
```

Если напечатало «Д2 СМЕРЖЕН» — остановиться, задачу не выполнять.

**Имя файла решения — `docs/decisions/2026-09-07-artifacts-ring.md` (дата СПЕКИ).** Причина: `tools/repo-audit.mjs`, функция `спекиБезРешения`, ищет `docs/decisions/<дата спеки>-<slug>.md`; спека — `2026-09-07-artifacts-ring-design.md`. Файл `2026-09-08-…` числился бы «спекой без решения» вечно. Все ссылки ниже — на `2026-09-07-artifacts-ring.md`.

### Шаг 1. Решение среза

- [ ] Создать `/Users/js/Developer/mydon/docs/decisions/2026-09-07-artifacts-ring.md` ровно с этим содержимым. Единственная подстановка: в шапке вместо `feat/artifacts-ring` подставить вывод `git branch --show-current`.

````markdown
# Решения среза A3 «Кольцо артефактов» — письмо раньше витрины — 07.09.2026

Записано 08.09.2026, в день выката, по образцу 22.08, 05.09 и 06.09 (волны M, R, A1, A2). Спека:
`docs/superpowers/specs/2026-09-07-artifacts-ring-design.md` (решения контроллера в §7, требования
Р-A3-1…Р-A3-8 в §4, проверки в §5, ловушки в §6), записка о премисе —
`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`, план ARMS `docs/AGENTIC_OS_ARMS_PLAN.md`
§6.4 пп. 4, 7. Ветка `feat/artifacts-ring`. Имя файла — по дате спеки, а не выката: так его находит
`tools/repo-audit.mjs` (группа «Спеки без решения» сверяет `<дата спеки>-<slug>.md`). Два ruling в
конце родились не в спеке, а из проверки её ловушек (§6) по коду — записаны отдельным разделом с той
же структурой «Почему / Цена ошибки».

---

## Р-0. Премиса плана не подтвердилась — срез начинается с письма, а не с витрины

**Решение: пункт §6.4 п. 4 плана («данные уже в Core — нужна витрина») признан неверным в обе
стороны и переписан фактом. Первая половина среза — ПИСЬМО: документ, произведённый ботом, попадает
в хранилище до того, как уйдёт в Telegram. Витрина — вторая половина.**

**Почему.** Проверено по коду (записка о премисе): таблица `document` объявлена в
`packages/db/src/schema.ts`, но во всём монорепо в неё никто не пишет и никто не читает, модуля
`documents` в Core нет — витрина над ней показывала бы пустой экран всегда. КП и договоры
(`apps/core/src/kp/kp.controller.ts`, `apps/core/src/contracts/contracts.controller.ts`) рендерятся в
буфер и отдаются потоком — «рендер без побочных эффектов». А документы, которые РЕАЛЬНО производит
пакет `@mydon/documents` (Excel, Word, PowerPoint, PDF через навыки Anthropic с исполнением кода в
контейнере), единственный потребитель — Telegram-бот — отправлял и не сохранял
(`apps/bot/src/index.ts`, ветка `reply.document`); при сбое отправки файл терялся совсем, а
пользователю писали «повтори запрос». Документ, стоивший вызова модели с исполнением кода, жил
секунды.

**Цена ошибки.** Начать с витрины значило бы построить экран над пустой таблицей и три недели
показывать владельцу «ничего не найдено» там, где артефакты производятся ежедневно и выбрасываются.
Хуже: критерий плана («артефакт трёхнедельной давности находится за 10 секунд») проверял бы
несуществующее прошлое — приёмка не могла бы ни пройти, ни честно провалиться.

## Р-1. Субстрат — `attachment`, не `document`

**Решение: артефакт агента — ещё один `ownerType` в существующей таблице `attachment`, а не новая
сущность и не оживление `document`. Миграция `packages/db/drizzle/0089_attachment_artifacts.sql`
добавляет `attachment` три колонки — `title text` (nullable), `domain` (тот же `domainEnum`, что у
`money_flow`, nullable), `tags jsonb NOT NULL DEFAULT '[]'` — и индекс
`attachment_kind_created_idx (kind, created_at DESC)`.**

**Почему.** У `attachment` живое хранилище (`apps/core/src/attachments/storage.service.ts`: S3 через
`STORAGE_*` либо локальный каталог), пять маршрутов (`POST`, `GET`, `GET /batch`, `GET /:id`,
`GET /:id/raw`), настоящие строки полевого контура (фото, чеки) и `ownerType`, задуманный
расширяемым («`entity` | `stock_movement` | …»). У `document` — ноль кода: оживить её значило бы либо
строить второе хранилище, либо продублировать `attachment`, и оба варианта хуже. Чего у `attachment`
не было и что даёт миграция: человеческое имя артефакта (`title` — до неё было только `storageKey`),
направление бизнеса (`domain` — чтобы искать «всё по VendHub»), теги (`tags` — то, ради чего
`document` и заводили) и индекс под витрину «последние артефакты такого рода» — до среза был только
`(owner_type, owner_id)`.

**Цена ошибки.** Второе хранилище — второй набор `STORAGE_*`, второй `raw`, второй проход по
безопасности типов (`nosniff`, `sandbox`, замкнутый список inline-картинок — всё это уже оплачено в
`attachments.controller.ts`) и две таблицы, отвечающие на вопрос «где файл». Первая же правка одной
из них разошлась бы с другой.

## Р-2. Владелец чат-документа — `person`; `ownerId` остаётся `NOT NULL`

**Решение: документ, сделанный ботом по чат-запросу, сохраняется с `ownerType = "person"` и
`ownerId = person.id` того, кто попросил, — оператор резолвится по `chatId` так же, как резолвится
доступ бота. Гость без `person` — не сохраняем и говорим об этом. Будущий отчёт агента по задаче —
`ownerType = "task"`. Инвариант «у вложения есть хозяин» не ослабляется.**

**Почему.** Из трёх вариантов (nullable `ownerId`; привязка к человеку; «синтетический» владелец)
только второй — правда: документ произведён для этого человека. Nullable `ownerId` ломает инвариант,
на котором стоит полевой контур; синтетический владелец — выдумка, которую пришлось бы объяснять на
каждом экране. Гостю архив не положен — это совпадает с правилом доступа бота (память: «доступ решает
`person.roles`») и честнее, чем молча сохранить под чужим именем.

**Цена ошибки.** Nullable `ownerId` — и `GET /attachments?ownerType=…&ownerId=…` (галерея карточки,
очередь утверждения) получает строки без адреса, которые ни один экран не умеет показать; фото без
хозяина неотличимо от фото, чей хозяин удалён.

## Р-3. Бот сохраняет ДО отправки; сбой хранилища не блокирует отправку; «повтори запрос» исчезает

**Решение: в `apps/bot/src/index.ts`, ветка `reply.document`, порядок строго такой: СНАЧАЛА
`deps.core.saveAttachment({ ownerType: "person", ownerId, kind: "doc", title, mime, tags: ["bot"],
domain? })`, ПОТОМ `tg.sendDocument`. Сбой сохранения НЕ блокирует отправку и назван пользователю
строкой «в архив не лёг: <ярлык причины>» (ярлык, не `err.message`). Сбой отправки при удавшемся
сохранении → «файл в архиве: <ссылка на /artifacts?…>». Прежнее «Файл получился, но отправить не
вышло. Повтори запрос.» удалено: повторять больше незачем.**

**Почему.** Файл в этот момент у нас в руках, и терять его из-за хранилища нельзя — поэтому отправка
идёт при любом исходе сохранения. Но и молчать о сбое нельзя: пользователь должен знать, что искать
этот файл в `/artifacts` бесполезно. Ярлык причины вместо текста исключения — правило волны A2
(«текст исключения наружу не едет»): сообщения драйвера хранилища несут хост и bucket. Порядок
«сначала архив» — это Р-A3-1: документ существует в `attachment` до того, как ушёл в Telegram, и
сбой отправки его не теряет.

**Цена ошибки.** Порядок наоборот («сначала отправить, потом сохранить») возвращает ровно тот
дефект, с которого срез начался: упавший `sendDocument` — и файла нет нигде. Блокировать отправку
сбоем хранилища — обменять надёжную доставку в чат на надёжность S3, то есть сделать хуже в
единственном месте, где сегодня работает.

## Р-4. `GET /artifacts` — новая дверь за `ReadTokenGuard`; без содержимого и без `storageKey`

**Решение: новый модуль `apps/core/src/artifacts/` (controller, service, module, tests) отдаёт
список вложений по фильтрам `kind`, `ownerType`, `ownerId`, `domain`, `from`/`to` (ISO, по
`createdAt`), `q` (ILIKE по `title`), с `limit` (1..100, по умолчанию 50) и непрозрачным `cursor` по
`(created_at, id)`. Ответ `{ items: ArtifactRow[], next: string | null, now: string }`, где
`ArtifactRow = { id, ownerType, ownerId, kind, title, domain, tags, mime, bytes, createdBy, createdAt }`
— ни `storageKey`, ни байтов. Класс-гард — общий `ReadTokenGuard`
(`apps/core/src/common/read-token.guard.ts`). Существующий `GET /attachments` не трогается: он требует
`ownerType`+`ownerId` и обслуживает полевой контур. `POST /attachments` расширен необязательными
`title`, `domain`, `tags` — прежние вызывающие не ломаются.**

**Почему.** Список артефактов — содержательный пересказ работы агентов и бота по делам владельца
(«Дебиторка GLOBERENT за август»), ровно то, что волна R закрыла на `/routines/runs`, а круг починок
A2 — на `/agents/status` и `/apps/health`. Глобальный гард Core пропускает GET намеренно (реестр,
продажи, задачи читают все в закрытой сети), поэтому дверь ставится по месту — и это третий
пользователь общего `ReadTokenGuard` (после `agents` и `apps`), а не четвёртая копия класса.
`storageKey` не отдаётся, потому что это путь на диске или ключ S3: панели он не нужен (содержимое —
через `GET /attachments/:id/raw`), а наружу он раскрывает раскладку хранилища. `now` в ответе — часы
Core для давности на экране (Р-8).

**Цена ошибки.** Открытый список со `storageKey` — карта хранилища любому, кто постучится в Core без
заголовка; отдельная дверь для галереи карточки и для архива — два маршрута с разной семантикой
фильтров на одной таблице, которые разъедутся при первой правке.

## Р-5. Миграция 0089 — единственная в волне A, обратимая; индекс обычный, не `CONCURRENTLY`

**Решение: новые колонки nullable либо с default — существующие строки `attachment` не
переписываются; индекс `attachment_kind_created_idx` строится обычным `CREATE INDEX`, а не
`CONCURRENTLY`, и причина записана в комментарии самой миграции. Строка в
`packages/db/drizzle/meta/_journal.json` — в том же коммите (аудит репо ловит «миграции вне
журнала»).**

**Почему.** `CONCURRENTLY` нельзя выполнить внутри транзакции, а мигратор репо
(`packages/db/src/migrate.ts` → `drizzle-orm/postgres-js/migrator`) оборачивает все ожидающие
миграции в ОДНУ транзакцию (`session.transaction` в `pg-core/dialect.js`); тот же мигратор гоняет их
на pglite в `tools/pglite-checks/run-migrations.mjs`. Значит `CONCURRENTLY` упал бы на первом же
прогоне — и локально, и на проде. Обычный индекс по `attachment` допустим: таблица маленькая (фото и
чеки полевого контура), а `ALTER TABLE … ADD COLUMN` с nullable/default на Postgres ≥ 11 — правка
каталога без переписывания строк, блокировка короткая. Ловушка спеки §6 п. 1 проверена, а не
обойдена.

**Цена ошибки.** `CONCURRENTLY` в файле — красный автодеплой с «cannot run inside a transaction
block» и ни одной применённой миграции волны; `NOT NULL` без default на `title` — переписывание всех
строк полевого контура и неоткатываемая миграция.

## Р-6. `document` помечается устаревшей, не сносится

**Решение: таблица `document` остаётся в схеме с комментарием `/** УСТАРЕЛА: писателей нет,
читателей нет; субстрат артефактов — attachment (срез A3). */`. Снос — отдельным решением владельца,
когда `/artifacts` поработает.**

**Почему.** Таблица пуста, но `DROP TABLE` — необратимая операция, а фокус среза — письмо
артефактов, не уборка. Комментарий в схеме — единственное место, куда заглянет следующий автор,
прежде чем «оживить» её для нового модуля.

**Цена ошибки.** Снос в этом же срезе — миграция с двумя несвязанными предметами: откат A3 уносил бы
и таблицу, которую A3 не создавал. Оставить без пометки — и через волну кто-то напишет модуль
`documents` поверх мёртвой таблицы, как чуть не сделал план.

## Р-7. Критерий приёмки переформулирован; дата начала архива — константа `ARTIFACTS_SINCE`

**Решение: критерий §6.4 п. 7 плана «артефакт трёхнедельной давности находится за 10 секунд»
заменён: любой артефакт, произведённый ПОСЛЕ выката среза, находится по типу, владельцу и дате за 10
секунд; про время до среза экран говорит прямо. Пустое состояние `/artifacts` печатает дату начала
архива — `ARTIFACTS_SINCE = "2026-09-08"` в `apps/cc/src/lib/artifacts.ts` с комментарием, откуда
дата (день выката миграции 0089), — а не «ничего не найдено».**

**Почему.** Для документов, созданных до среза, прежний критерий недостижим: их не существует, и
приёмка проверяла бы несуществующее прошлое. Пустой экран без даты неотличим от «ничего не было» — а
это ложь: документы были, их выбрасывали. Дата константой в коде, а не из `created_at` журнала
Drizzle: журнал знает момент генерации файла, не выката, и читать его из панели — лишняя зависимость
ради одного числа.

**Цена ошибки.** Владелец открывает `/artifacts` через неделю, видит «ничего не найдено» и решает,
что бот документов не делает; либо приёмка «находит» артефакт трёхнедельной давности, которого не
может быть, — и срез принимается по ложному критерию.

## Р-8. Витрина: `ConsoleTheme` как у соседей; словарь типов — в `lib/state.ts`; давность — по часам Core

**Решение: `apps/cc/src/app/artifacts/page.tsx` — серверная, `force-dynamic`, тёмная через
`<ConsoleTheme/>` (`apps/cc/src/components/console-theme.tsx`), как `/crons`, `/flows`, `/skills`,
`/brain`, `/apps`. Клиент — `core.artifacts(params)` через `getWithToken` в `apps/cc/src/lib/core.ts`.
Слово и класс типа — `ARTIFACT_KIND_WORD` / `ARTIFACT_KIND_LED` в `apps/cc/src/lib/state.ts`.
Давность строки — `ago(createdAt, now)` из `apps/cc/src/lib/format.ts`, где `now` — из ответа Core.
Пункт «Артефакты» — в `apps/cc/src/components/nav.tsx`.**

**Почему.** На 08.09.2026 срез Д2 «Два мира» не смержен: `apps/cc/src/lib/theme.ts` и
`CONSOLE_ROUTES` в дереве нет, поэтому берётся тот же клиентский `ConsoleTheme`, что у пяти соседей
(спека §6 п. 5, вариант «раньше Д2»); Д2 снесёт его вместе с остальными. Словарь — в единственном
доме, потому что сторож `state.test.ts` роняет сборку на втором словаре (Р-A3-6); давность — по
часам Core, потому что часы браузера владельца и сервера расходятся, и «5 минут назад» с двух часов
— два разных факта.

**Цена ошибки.** Свой `data-theme` на странице — вторая реализация темы, которую Д2 не найдёт и не
снесёт; словарь типов в `page.tsx` — красный `state.test.ts`; давность по часам браузера — на
телефоне владельца строка стареет или молодеет на разницу часовых поясов.

---

## Ruling из проверки ловушек спеки (§6, по коду)

### `GET /attachments/:id/raw` остаётся `@Public()` — перебор невозможен, а закрытие ломает прокси панели

**Решение: ловушка §6 п. 3 проверена. `raw` действительно открыт (`@Public()` в
`apps/core/src/attachments/attachments.controller.ts`, «панель кладёт это в `<img>`»), и в этом срезе
он таким остаётся. Закрытие — отдельная правка (раздел «Отложено»).**

**Почему.** Перебор id `/artifacts` не делает тривиальным: `id` вложения — `uuid("id").defaultRandom()`
(UUID v4, `packages/db/src/schema.ts`), угадать его нельзя, а единственный список id — сам
`GET /artifacts` — стоит за токеном. Кто знает id, тот уже держит токен. Закрыть `raw`
`ReadTokenGuard` сегодня нельзя без второй правки: панель проксирует файл через
`apps/cc/src/app/api/attachments/[id]/raw/route.ts` → `coreBytes` (`apps/cc/src/lib/core.ts`), а
`coreBytes` токен НЕ шлёт — галереи карточек и очередь утверждения получили бы 401 в `<img>`.

**Цена ошибки.** Закрыть без правки прокси — сломать полевой контур (фото, чеки) ради защиты от
перебора, которого нет. Не записать — следующий автор либо «закроет» и сломает, либо решит, что
проверка не делалась.

### Долг волны A2 по `agent_run` в миграцию 0089 не вошёл

**Решение: индекс под `distinct on (agent_name)` в `agent_run` и ретенция журнала прогонов, принятые
решением A2 «как долг волны A3», в миграцию 0089 НЕ включены и остаются долгом.**

**Почему.** Миграция среза ограничена его предметом — таблицей `attachment`: откат A3 не должен
уносить индекс чужой таблицы, а индекс `agent_run` заслуживает замера на настоящем журнале (память
репо: «фикстуры прячут масштаб»), а не строки «заодно».

**Цена ошибки.** «Заодно» — миграция с двумя предметами и два среза, спорящие за один откат; без
записи — долг A2 растворяется, потому что в его тексте написано «принято волной A3».

## Чего срез НЕ делает и почему (спека §3, дословно)

- Не сохраняет КП и договоры при каждом рендере: они рендерятся владельцем по требованию, и
  автосохранение каждого черновика забило бы архив. Кнопка «в архив» у КП — отдельное решение после
  того, как `/artifacts` поработает.
- Не делает coach-diff и экспорт: их существование не подтверждено (заметка по премисе), обещать
  несуществующее нельзя.
- Не сносит `document`.
- Не заводит полнотекстовый поиск по содержимому — только по `title`.
- Не трогает полевой контур `attachment` (фото/чеки): их `ownerType` и маршруты как были.

## Что решением НЕ отменяется

- «Читающая дверь с содержанием работы агентов — за токеном» (волны M, R, A2): `/artifacts` —
  третий пользователь общего `ReadTokenGuard`; любой будущий маршрут над `attachment` с фильтрами
  шире «одного владельца» — за ним же.
- «Текст исключения наружу не едет» (A2): бот печатает ярлык причины, не `err.message` хранилища;
  `GET /artifacts` не отдаёт ни `storageKey`, ни текста ошибок.
- «Дом словарей один» (Д1, `apps/cc/src/lib/state.ts`) и «давность — только `ago(iso, now)`»
  (`apps/cc/src/lib/format.ts`).
- Инвариант полевого контура «у вложения есть хозяин» (`ownerId NOT NULL`) — Р-2.
- «Миграция — одна и по предмету среза» — Р-5 и ruling про долг A2.

## Отложено сознательно

- Кнопка «в архив» у КП и договоров — после того, как `/artifacts` поработает (спека §3).
- Снос `document` — отдельное решение владельца (Р-6).
- Закрытие `GET /attachments/:id/raw` `ReadTokenGuard` вместе с токеном в `coreBytes` панели —
  ruling выше; до этого `raw` открыт, и это записано.
- Полнотекстовый поиск по содержимому артефактов — только `title`.
- `ownerType = "task"` для отчётов агентов по задаче — когда появится первый писатель.
- MCP-инструмент `artifacts_list` над `GET /artifacts` — записан кандидатом в `docs/MCP.md`, не
  добавлен: сначала витрина должна показать, какие фильтры нужны из терминала.
- Перенос `/artifacts` в `CONSOLE_ROUTES` при мерже Д2: в плане Д2
  (`docs/superpowers/plans/2026-09-07-design-wave-theme.md`) список из восьми префиксов БЕЗ
  `/artifacts` — без правки страница потеряет тёмную тему в момент, когда Д2 снесёт `ConsoleTheme`.
  Сторож `apps/cc/src/test/artifacts-docs.test.ts` падает при появлении `apps/cc/src/lib/theme.ts`
  ровно с этим сообщением.
- Индекс под `distinct on (agent_name)` и ретенция `agent_run` — долг A2, ruling выше.
````

### Шаг 2. Указатель в памяти

- [ ] В `/Users/js/Developer/mydon/memory/decisions.md` — Edit. `old_string` (пустая строка перед последним абзацем плюс сам абзац):

```
\n\nНовое решение: добавь строку сюда и файл в `docs/decisions/`. Не дублируй текст.\n
```

`new_string` (строка таблицы встаёт сразу после строки волны M, затем пустая строка и прежний абзац):

```
\n| 2026-09-07 | Срез A3 «Кольцо артефактов»: премиса плана («данные уже в Core — нужна витрина») не подтвердилась — `document` мёртвая, бот терял документы; субстрат — `attachment` (+`title`/`domain`/`tags`, миграция 0089, индекс обычный — мигратор держит одну транзакцию), `document` помечена, не снесена; владелец чат-документа — `person`, гость не сохраняется; бот сохраняет ДО отправки, сбой хранилища не блокирует отправку и назван ярлыком; `GET /artifacts` за `ReadTokenGuard`, без содержимого и `storageKey`; `raw` остаётся публичным (UUID v4, список за токеном, прокси панели без токена); критерий плана переформулирован — только артефакты после `ARTIFACTS_SINCE`; КП/договоры, coach-diff, полнотекст — не в срезе; долг A2 по `agent_run` в 0089 не вошёл | `docs/decisions/2026-09-07-artifacts-ring.md` |\n\nНовое решение: добавь строку сюда и файл в `docs/decisions/`. Не дублируй текст.\n
```

(Здесь `\n` — переводы строк; в Edit передавать настоящие переводы. Файл заканчивается одним `\n`, как и был.)

### Шаг 3. План ARMS §6.4 — пп. 4 и 7 по факту

- [ ] `/Users/js/Developer/mydon/docs/AGENTIC_OS_ARMS_PLAN.md`, Edit 1. `old_string` (строки 368–370 дословно):

```
4. **Кольцо артефактов** (`/artifacts`): всё, что произвели агенты и Claude Code — `document`
   (КП docx, отчёты навыков, clone-spec), coach-diff, экспорт; поиск по контрагенту, направлению,
   дате; открытие HTML/docx. Данные уже в Core — нужна витрина.
```

`new_string`:

```
4. **Кольцо артефактов** (`/artifacts`) — **СДЕЛАНО 08.09.2026 (срез A3)**, и премиса пункта не
   подтвердилась (`.superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md`): «данные уже в Core —
   нужна витрина» было неверно в обе стороны. Таблица `document` мёртвая — ни писателей, ни
   читателей, модуля `documents` в Core нет; КП и договоры рендерятся в буфер и не сохраняются; а
   документы, которые бот реально производит через `@mydon/documents` (Excel/Word/PowerPoint/PDF с
   исполнением кода в контейнере), отправлялись в Telegram и терялись — при сбое отправки навсегда.
   Поэтому срез начался с ПИСЬМА, а не с витрины: субстрат — `attachment` (живое хранилище и
   маршруты), не `document` (помечена устаревшей, не снесена); миграция `0089` (`title`, `domain`,
   `tags`, индекс `(kind, created_at)`) — единственная в волне A; бот сохраняет документ ДО отправки
   (`ownerType = "person"` — тот, кто попросил; гость не сохраняется), сбой хранилища не блокирует
   отправку и назван словами; `GET /artifacts` за `ReadTokenGuard`, без содержимого и `storageKey`;
   витрина `/artifacts` с пустым состоянием, печатающим дату начала архива (`ARTIFACTS_SINCE`).
   Coach-diff и экспорт из формулировки убраны: их существование не подтверждено. Спека
   `docs/superpowers/specs/2026-09-07-artifacts-ring-design.md` (Р-A3-1…Р-A3-8), решения —
   `docs/decisions/2026-09-07-artifacts-ring.md`.
```

- [ ] Тот же файл, Edit 2. `old_string` (строки 385–388 дословно):

```
7. **Критерий:** 12+ агентов видны на одном экране с состоянием — **выполнено в срезе A2**
   (`/mydon`, сетка); Claude Code владельца отвечает «что ждёт моего решения» через MCP — выполнено
   в срезе A1; артефакт трёхнедельной давности находится за 10 секунд — ждёт п. 4 (`/artifacts`,
   срез A3).
```

`new_string`:

```
7. **Критерий:** 12+ агентов видны на одном экране с состоянием — **выполнено в срезе A2**
   (`/mydon`, сетка); Claude Code владельца отвечает «что ждёт моего решения» через MCP — выполнено
   в срезе A1; артефакт находится за 10 секунд — **переформулировано и выполнено в срезе A3**: любой
   артефакт, произведённый ПОСЛЕ выката среза (с `ARTIFACTS_SINCE`, 08.09.2026), находится по типу,
   владельцу и дате за 10 секунд; про время до среза экран говорит прямо, а не показывает пустоту
   как «ничего не было». Прежнее «артефакт трёхнедельной давности» для документов, созданных до
   среза, недостижимо — их не существует (спека §0).
```

### Шаг 4. Навык `mydon-design`: строка артефакта в `primitives.md`

- [ ] `/Users/js/Developer/mydon/.claude/skills/mydon-design/primitives.md`, Edit. `old_string` (последняя строка таблицы «Контейнеры и списки», дословно):

```
| `.aggrid` → `.agtile` (+ `.av8` лицо · `.agn` имя · `.agled` состояние · `.agr` причина, в ней `.agw` — давность) | сетка агентов 1/2/3; левая полоса по состоянию — `rules.md` §4.2, §4.3 |
```

`new_string` (та же строка плюс новая под ней):

```
| `.aggrid` → `.agtile` (+ `.av8` лицо · `.agn` имя · `.agled` состояние · `.agr` причина, в ней `.agw` — давность) | сетка агентов 1/2/3; левая полоса по состоянию — `rules.md` §4.2, §4.3 |
| **строка артефакта** = `.rows` → `.row.rowlink` → `.led` (тип: слово `ARTIFACT_KIND_WORD[kind]`, класс `ARTIFACT_KIND_LED[kind]` из `apps/cc/src/lib/state.ts`) · `.t` (`b` название · `small` кто/для кого · направление) · `.when` (давность `ago(createdAt, now)`, `now` — часы Core из ответа `GET /artifacts`) | архив `/artifacts` (документ / фото / чек), срез A3; своего класса НЕТ — собирается из `.row`; пустое состояние — `.empty` с датой начала архива `ARTIFACTS_SINCE` (`apps/cc/src/lib/artifacts.ts`), не «ничего не найдено»; эталон `app/artifacts/page.tsx` |
```

- [ ] Сверить состав строки с фактической вёрсткой задачи 5:

```sh
grep -n 'className="rows"\|className="row rowlink"\|className="led\|className="when"' /Users/js/Developer/mydon/apps/cc/src/app/artifacts/page.tsx
```

Ожидание — все четыре класса найдены. Если задача 5 завела свой класс строки (grep пуст по `row rowlink`), в новой строке `primitives.md` заменить `` `.rows` → `.row.rowlink` `` на фактический селектор из `page.tsx` и фразу «своего класса НЕТ — собирается из `.row`» на «класс объявлен в `globals.css` рядом с `.row`». Сторож шага 8 проверяет только имена словарей, дату и эталон — состав классов он не пришпиливает.

### Шаг 5. Навык `mydon-design`: §9 `rules.md` — `/artifacts` существует

- [ ] `/Users/js/Developer/mydon/.claude/skills/mydon-design/rules.md`, Edit. `old_string` (первый буллет §9, строки 233–238 дословно):

```
- **Маршрутный список §4 разошёлся с реальностью.** Тёмную тему включает `<ConsoleTheme/>`
  (`apps/cc/src/components/console-theme.tsx`), и стоит он ровно на ПЯТИ страницах: `/crons`, `/flows`,
  `/skills`, `/brain`, `/apps`. В §4 при этом названы `/mydon` и `/agents` — они СВЕТЛЫЕ; `/apps` тёмный,
  но в списке не назван; `/docs` не назван нигде, хотя маршрут есть и он светлый; `/artifacts` не
  существует как маршрут вовсе (это срез A3). Список исправляется вместе с механизмом темы — хранение
  выбора, переключатель, серверный канал без мигания первого кадра — в срезе Д2.
```

`new_string`:

```
- **Маршрутный список §4 разошёлся с реальностью.** Тёмную тему включает `<ConsoleTheme/>`
  (`apps/cc/src/components/console-theme.tsx`), и стоит он ровно на ШЕСТИ страницах: `/crons`, `/flows`,
  `/skills`, `/brain`, `/apps` и — со среза A3 (08.09.2026) — `/artifacts`
  (`apps/cc/src/app/artifacts/page.tsx`: выкачен раньше Д2, поэтому взял `ConsoleTheme` как соседи, и
  Д2 снесёт его вместе с остальными; в списке маршрутов плана Д2 его нет — добавить при мерже). В §4
  при этом названы `/mydon` и `/agents` — они СВЕТЛЫЕ; `/apps` тёмный, но в списке не назван; `/docs`
  не назван нигде, хотя маршрут есть и он светлый. Список исправляется вместе с механизмом темы —
  хранение выбора, переключатель, серверный канал без мигания первого кадра — в срезе Д2.
```

(§4, строка 44 «Для `/mydon`, `/agents`, `/crons`, `/flows`, `/skills`, `/brain`, `/artifacts`:» — не трогать: `/artifacts` там уже назван, а расхождение списка — долг Д2.)

### Шаг 6. Зеркала навыка — побайтно

- [ ] Скопировать два правленых файла в оба зеркала и убедиться, что расхождений нет:

```sh
cd /Users/js/Developer/mydon
cp .claude/skills/mydon-design/primitives.md .agents/skills/mydon-design/primitives.md
cp .claude/skills/mydon-design/rules.md      .agents/skills/mydon-design/rules.md
cp .claude/skills/mydon-design/primitives.md docs/agentic-os-starter/claude-skills/mydon-design/primitives.md
cp .claude/skills/mydon-design/rules.md      docs/agentic-os-starter/claude-skills/mydon-design/rules.md
for f in rules.md tokens.md primitives.md checklist.md; do
  cmp .claude/skills/mydon-design/$f .agents/skills/mydon-design/$f || echo "ДРЕЙФ .agents/$f"
  cmp .claude/skills/mydon-design/$f docs/agentic-os-starter/claude-skills/mydon-design/$f || echo "ДРЕЙФ starter/$f"
done
echo "зеркала сверены"
```

Ожидание: ни одной строки «ДРЕЙФ». `SKILL.md` НЕ копировать: зеркало Codex отличается двумя объявленными заменами (`CLAUDE.md`→`AGENTS.md`, «макеты Claude Design»→«макеты Codex Design»), это держит `design-skill.test.ts`.

### Шаг 7. `docs/MCP.md` — `artifacts_list` записан кандидатом, НЕ добавлен

- [ ] `/Users/js/Developer/mydon/docs/MCP.md`, Edit. `old_string` (пустая строка после таблицы «Меняющие мир» и заголовок следующего раздела):

```
\n\n## Подпись действий в журнале Core\n
```

`new_string`:

```
\n\n### Кандидаты (не добавлены)\n\nЗаписаны, чтобы следующий срез не выяснял заново, обсуждалось ли. В `apps/mcp/src/tools.ts` их\nнет, стартовая строка сервера по-прежнему «инструментов 19».\n\n| Инструмент | Что дал бы | Почему не добавлен |\n|---|---|---|\n| `artifacts_list` | Список артефактов из `GET /artifacts` (срез A3, 08.09.2026): фильтры `kind`, `ownerType`, `ownerId`, `domain`, `from`/`to`, `q`, курсор — без содержимого и без `storageKey`. Ответ на «что бот сделал мне за неделю» из Claude Code владельца. | Маршрут только выкачен: сначала витрина `/artifacts` должна поработать и показать, какие фильтры нужны из терминала, а какие — только с экрана. Добавление — отдельное решение с правкой `tools.ts`, `core-client.ts`, `format.ts`, теста «девятнадцать инструментов присутствуют по именам, и ровно они» (`apps/mcp/src/tools.test.ts`) и этой таблицы. |\n\n## Подпись действий в журнале Core\n
```

(`\n` — настоящие переводы строк.)

### Шаг 8. Сторож документации среза

- [ ] Создать `/Users/js/Developer/mydon/apps/cc/src/test/artifacts-docs.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Сторож документации среза A3 «Кольцо артефактов».
 *
 * Решение, план ARMS, указатель памяти, рунбук MCP и навык дизайна — markdown:
 * их откат не роняет ни сборку, ни рантайм. Премиса «данные уже в Core —
 * нужна витрина» прожила в плане три волны ровно потому, что её никто не
 * сверял с кодом. Здесь ПРОВЕРЯЮТСЯ ФАКТЫ, а не формулировки: имена файлов,
 * констант, маршрутов, дата начала архива и пять причин «чего срез не делает»
 * из спеки §3. Переписать абзац другими словами можно; вынуть из него факт —
 * нет. Утверждения о коде сверяются с самим кодом (как в `design-skill.test.ts`).
 */

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const есть = (относительный: string): boolean => existsSync(path.join(КОРЕНЬ, относительный));
const читать = (относительный: string): string =>
  readFileSync(path.join(КОРЕНЬ, относительный), "utf8");

/** Проверки идут по тексту без переносов: абзац можно перенести иначе. */
const склеить = (s: string): string => s.replace(/\s+/g, " ");

const СПЕКА = "docs/superpowers/specs/2026-09-07-artifacts-ring-design.md";
const ЗАПИСКА = ".superpowers/sdd/notes/2026-09-06-a3-artifacts-premise.md";
const РЕШЕНИЕ = "docs/decisions/2026-09-07-artifacts-ring.md";
const ПЛАН = "docs/AGENTIC_OS_ARMS_PLAN.md";
const НАВЫК = ".claude/skills/mydon-design";

const решение = склеить(читать(РЕШЕНИЕ));
const план = читать(ПЛАН);

/** §6.4 плана целиком — нумерация пунктов повторяется в §6.1–6.3, резать надо внутри волны. */
const волнаA = план.slice(план.indexOf("### 6.4 Волна A"), план.indexOf("### 6.5"));

/** Пункт нумерованного списка §6.4 — от «N. **» до «N+1. **»; последний — до конца раздела. */
function пунктВолныA(номер: number): string {
  const начало = волнаA.indexOf(`\n${номер}. **`);
  expect(начало, `в §6.4 плана нет пункта ${номер}`).toBeGreaterThan(-1);
  const конец = волнаA.indexOf(`\n${номер + 1}. **`, начало + 1);
  return склеить(волнаA.slice(начало, конец === -1 ? undefined : конец));
}

/** Дата начала архива из кода — ОДИН источник для экрана, плана и решения. */
function датаНачалаАрхива(): { iso: string; печатная: string } {
  const m = /ARTIFACTS_SINCE\s*=\s*"(\d{4})-(\d{2})-(\d{2})"/.exec(читать("apps/cc/src/lib/artifacts.ts"));
  expect(m, 'в apps/cc/src/lib/artifacts.ts нет ARTIFACTS_SINCE = "YYYY-MM-DD"').not.toBeNull();
  const год = m?.[1] ?? "";
  const месяц = m?.[2] ?? "";
  const день = m?.[3] ?? "";
  return { iso: `${год}-${месяц}-${день}`, печатная: `${день}.${месяц}.${год}` };
}

describe("решение среза A3 записано и названо по конвенции аудита", () => {
  it("имя файла — дата спеки + slug: так его ищет tools/repo-audit.mjs («Спеки без решения»)", () => {
    const m = /^(\d{4}-\d{2}-\d{2})-(.+)-design\.md$/.exec(path.basename(СПЕКА));
    expect(m, "имя спеки не по шаблону <дата>-<slug>-design.md").not.toBeNull();
    const дата = m?.[1] ?? "";
    const slug = m?.[2] ?? "";
    expect(РЕШЕНИЕ).toBe(`docs/decisions/${дата}-${slug}.md`);
    expect(есть(РЕШЕНИЕ), `нет файла ${РЕШЕНИЕ}`).toBe(true);
  });

  it("решение ссылается на спеку и записку о премисе", () => {
    expect(решение).toContain(СПЕКА);
    expect(решение).toContain(ЗАПИСКА);
  });

  it("субстрат назван, и `document` помечена в схеме, а не снесена (Р-A3-8)", () => {
    expect(решение).toContain("## Р-1. Субстрат — `attachment`, не `document`");
    const схема = читать("packages/db/src/schema.ts");
    expect(схема, "таблица document снесена — Р-6 говорит обратное").toContain('pgTable("document"');
    expect(схема, "в схеме нет пометки об устаревшей document").toContain(
      "УСТАРЕЛА: писателей нет, читателей нет; субстрат артефактов — attachment (срез A3).",
    );
  });

  it("«чего срез НЕ делает» — все пять причин спеки §3 на месте", () => {
    for (const причина of [
      "автосохранение каждого черновика забило бы архив",
      "их существование не подтверждено",
      "Не сносит `document`",
      "только по `title`",
      "их `ownerType` и маршруты как были",
    ]) {
      expect(решение, `в решении нет причины «${причина}»`).toContain(причина);
    }
  });

  it("ruling про raw не врёт про код: маршрут открыт, прокси панели без токена", () => {
    const контроллер = читать("apps/core/src/attachments/attachments.controller.ts");
    expect(контроллер, "raw закрыт — перепиши ruling и убери пункт из «Отложено»").toMatch(
      /@Public\(\)\s*@Get\(":id\/raw"\)/,
    );
    const core = читать("apps/cc/src/lib/core.ts");
    const начало = core.indexOf("export async function coreBytes(");
    expect(начало, "в core.ts нет coreBytes").toBeGreaterThan(-1);
    const конец = core.indexOf("\nexport ", начало + 1);
    const тело = core.slice(начало, конец === -1 ? undefined : конец);
    expect(тело, "coreBytes шлёт токен — ruling про прокси устарел").not.toContain("x-service-token");
    for (const факт of ["@Public()", "coreBytes", "defaultRandom()"]) {
      expect(решение, `ruling про raw не называет ${факт}`).toContain(факт);
    }
  });

  it("миграция 0089 — обычный индекс, и решение объясняет, почему не CONCURRENTLY", () => {
    const миграция = читать("packages/db/drizzle/0089_attachment_artifacts.sql");
    expect(миграция).toContain("attachment_kind_created_idx");
    expect(миграция, "CONCURRENTLY внутри транзакции мигратора упадёт — Р-5").not.toContain(
      "CONCURRENTLY",
    );
    expect(решение).toContain("drizzle-orm/postgres-js/migrator");
    expect(решение).toContain("CONCURRENTLY");
  });
});

describe("план ARMS §6.4 больше не повторяет опровергнутую премису", () => {
  it("п. 4 — факт вместо «данные уже в Core — нужна витрина»", () => {
    const п4 = пунктВолныA(4);
    expect(п4, "премиса вернулась в план").not.toContain("Данные уже в Core — нужна витрина");
    for (const факт of ["СДЕЛАНО 08.09.2026 (срез A3)", "`attachment`", "`document`", ЗАПИСКА, РЕШЕНИЕ]) {
      expect(п4, `в п. 4 нет факта «${факт}»`).toContain(факт);
    }
  });

  it("п. 7 — критерий переформулирован, дата совпадает с ARTIFACTS_SINCE в коде", () => {
    const п7 = пунктВолныA(7);
    expect(п7, "критерий снова «ждёт п. 4»").not.toContain("ждёт п. 4");
    const { iso, печатная } = датаНачалаАрхива();
    expect(п7, `в п. 7 нет даты ${печатная}`).toContain(печатная);
    expect(п7).toContain("ARTIFACTS_SINCE");
    expect(решение, "решение печатает не ту дату начала архива").toContain(iso);
  });
});

describe("указатели ведут к решению", () => {
  it("memory/decisions.md — строка-указатель с датой спеки и путём к файлу", () => {
    const строка = читать("memory/decisions.md")
      .split("\n")
      .find((s) => s.startsWith("| 2026-09-07 |") && s.includes(РЕШЕНИЕ));
    expect(строка, "в memory/decisions.md нет строки среза A3").toBeDefined();
  });

  it("docs/MCP.md — artifacts_list записан кандидатом и НЕ добавлен в сервер", () => {
    const mcp = читать("docs/MCP.md");
    expect(mcp).toContain("### Кандидаты (не добавлены)");
    expect(mcp).toContain("`artifacts_list`");
    expect(
      читать("apps/mcp/src/tools.ts"),
      "artifacts_list появился в tools.ts — перенеси строку из «Кандидатов» в таблицу читающих",
    ).not.toContain("artifacts_list");
  });
});

describe("навык mydon-design знает строку артефакта и маршрут /artifacts", () => {
  const примитивы = склеить(читать(`${НАВЫК}/primitives.md`));
  const правила = склеить(читать(`${НАВЫК}/rules.md`));
  const долг = правила.slice(правила.indexOf("## 9. Долг среза Д2"));

  it("строка артефакта в primitives.md называет словари, дату и эталон", () => {
    for (const факт of [
      "ARTIFACT_KIND_WORD",
      "ARTIFACT_KIND_LED",
      "ARTIFACTS_SINCE",
      "app/artifacts/page.tsx",
    ]) {
      expect(примитивы, `в primitives.md нет ${факт}`).toContain(факт);
    }
    const state = читать("apps/cc/src/lib/state.ts");
    expect(state).toContain("export const ARTIFACT_KIND_WORD");
    expect(state).toContain("export const ARTIFACT_KIND_LED");
  });

  it("§9 rules.md: /artifacts существует, тёмный через ConsoleTheme, и это правда про код", () => {
    expect(долг, "§9 снова утверждает, что /artifacts нет").not.toContain(
      "не существует как маршрут вовсе",
    );
    expect(долг).toContain("apps/cc/src/app/artifacts/page.tsx");
    expect(
      читать("apps/cc/src/app/artifacts/page.tsx"),
      "страница /artifacts без ConsoleTheme — §9 врёт про код",
    ).toContain("ConsoleTheme");
  });

  it("растяжка на Д2: с появлением lib/theme.ts /artifacts обязан войти в CONSOLE_ROUTES", () => {
    // План Д2 перечисляет восемь префиксов БЕЗ `/artifacts`. Когда Д2 снесёт
    // `ConsoleTheme`, страница молча посветлеет — если этот тест не остановит.
    expect(
      есть("apps/cc/src/lib/theme.ts"),
      "Д2 смержен: добавь /artifacts в CONSOLE_ROUTES, перепиши §9 rules.md и сними эту растяжку",
    ).toBe(false);
  });
});
```

### Шаг 9. Проверки

- [ ] Сторож и зеркала:

```sh
cd /Users/js/Developer/mydon && pnpm --filter @mydon/cc test -- src/test/artifacts-docs.test.ts src/test/design-skill.test.ts
```

Ожидание: оба файла зелёные (у `design-skill.test.ts` — в том числе блок «зеркала навыка mydon-design не разъезжаются»).

- [ ] Ссылки стартера (правленые `rules.md`/`primitives.md` лежат в `docs/agentic-os-starter/claude-skills/`, скрипт проверяет пути в обратных кавычках — `apps/cc/src/app/artifacts/page.tsx`, `apps/cc/src/lib/artifacts.ts`, `apps/cc/src/lib/state.ts` должны существовать):

```sh
cd /Users/js/Developer/mydon && node docs/agentic-os-starter/verify-paths.mjs
```

Ожидание: строка `Проверено ссылок: N. Битых нет.`

- [ ] Аудит репо — спека A3 больше не «без решения» (`--dry-run` обязателен: без него скрипт дописывает секцию в `memory/open-questions.md`):

```sh
cd /Users/js/Developer/mydon && node tools/repo-audit.mjs --dry-run | grep -c "2026-09-07-artifacts-ring-design.md"
```

Ожидание: `0`.

- [ ] Откат-проверка (ассерт падает при откате): временно вернуть в `docs/AGENTIC_OS_ARMS_PLAN.md` фразу `Данные уже в Core — нужна витрина` в п. 4 → `pnpm --filter @mydon/cc test -- src/test/artifacts-docs.test.ts` красный на «п. 4 — факт вместо …»; вернуть правку. Затем `git stash push .agents/skills/mydon-design/rules.md` → `design-skill.test.ts` красный на «.agents/skills/mydon-design/rules.md совпадает с .claude/skills дословно»; `git stash pop`.

- [ ] Линт и типы панели (новый тест — TS strict, без `any`):

```sh
cd /Users/js/Developer/mydon && pnpm --filter @mydon/cc lint && pnpm --filter @mydon/cc typecheck
```

### Шаг 10. Коммит

- [ ] Только эти файлы (`git add` по именам, не `-A`: рядом могут лежать чужие некоммиченные файлы Codex):

```sh
cd /Users/js/Developer/mydon && git add \
  docs/decisions/2026-09-07-artifacts-ring.md \
  memory/decisions.md \
  docs/AGENTIC_OS_ARMS_PLAN.md \
  docs/MCP.md \
  .claude/skills/mydon-design/primitives.md .claude/skills/mydon-design/rules.md \
  .agents/skills/mydon-design/primitives.md .agents/skills/mydon-design/rules.md \
  docs/agentic-os-starter/claude-skills/mydon-design/primitives.md \
  docs/agentic-os-starter/claude-skills/mydon-design/rules.md \
  apps/cc/src/test/artifacts-docs.test.ts
git commit -m "docs(a3): решение «Кольцо артефактов» — премиса плана опровергнута, субстрат attachment; §6.4 по факту, навык mydon-design знает строку артефакта, artifacts_list — кандидат MCP, сторож документации

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01NkuNnPz229PW2EbZ7E4YPa"
```

---

## Ловушки, названные авторами задач

- **(задача 1)** Мигратор drizzle (packages/db/src/migrate.ts → drizzle-orm/pg-core/dialect.js) применяет ВСЕ ожидающие файлы внутри одной session.transaction — CREATE INDEX CONCURRENTLY невозможен: оператор упадёт и повесит автодеплой молча. Обычный индекс + IF NOT EXISTS + причина в заголовке SQL (0070/0071/0073 — тот же вывод).

- **(задача 1)** Файл 0089, снапшот 0089_snapshot.json и запись журнала создаёт ТОЛЬКО `drizzle-kit generate` — migrations.test.ts требует снапшот на каждую запись и совпадение head-снапшота со schema.ts. Запускать генератор строго ПОСЛЕ правки схемы (иначе «No schema changes», файла нет) и строго ОДИН раз (второй запуск даст 0090). Потом только тело SQL заменяется дословно.

- **(задача 1)** `when` в _journal.json не править руками: мигратор применяет запись только при when > created_at последней применённой (folderMillis). Меньший when = молчаливый пропуск, колонок в проде не будет. Новый тест «when в журнале строго растёт» это ловит.

- **(задача 1)** domainEnum уже объявлен в schema.ts:29 — второй pgEnum("domain", …) заставит генератор выпустить CREATE TYPE "public"."domain", и миграция упадёт на проде (тип существует с 0000). Тест схемы сверяет, что у attachment.domain и moneyFlow.domain ОДИН объект enum.

- **(задача 1)** Индекс объявлять через `t.createdAt.desc()` (IndexedColumn → "created_at" DESC NULLS LAST в SQL и колонка в снапшоте), а не `desc(t.createdAt)` из drizzle-orm (выражение в снапшоте, другой текст SQL); иначе тест по составу индекса и сверка со сгенерированным SQL разойдутся.

- **(задача 1)** Заголовок-комментарий миграции обязан стоять ПЕРЕД первым оператором (мигратор режет файл по `--> statement-breakpoint`, комментарий уходит в первый кусок вместе с ALTER); после последнего оператора ничего не дописывать — получится пустой «оператор». Разделителей ровно три на четыре оператора.

- **(задача 1)** Отрицательные проверки в тесте 0089 (нет CONCURRENTLY / CREATE TYPE / "document" / UPDATE) идут по операторам БЕЗ комментариев: заголовок сам называет эти слова, объясняя, почему их нет. Проверка на полном тексте дала бы ложное падение.

- **(задача 1)** tsconfig.base.json репо НЕ включает exactOptionalPropertyTypes (только strict) — код тестов написан совместимо с обоими режимами (касты через `as unknown as {…}`, без присваивания `string | undefined` в необязательные поля).

- **(задача 1)** Тесты гоняются из dist: перед `pnpm --filter @mydon/db test` чистить packages/db/dist (сироты *.test.js удалённых тестов дают ложные падения — урок из памяти). Сборка требует собранного @mydon/shared.

- **(задача 1)** В дереве есть чужие untracked файлы `.agents/skills/*` (параллельно работает Codex) — коммитить только перечисленные файлы, не `git add -A`; перед правкой schema.ts сверить `git status packages/db`, что там нет чужих свежих изменений.

- **(задача 1)** Не пушить в main: ветка → PR → merge (пуш в main = немедленный прод-деплой без CI-гейта). CI на PR отключён осознанно — гейт миграций вручную: `gh workflow run ci.yml --ref <ветка>`.

- **(задача 1)** ADD COLUMN … DEFAULT '[]'::jsonb NOT NULL — правка каталога без перезаписи таблицы (default постоянный, PG11+); CREATE INDEX без CONCURRENTLY держит SHARE-блокировку (запись ждёт, чтение идёт) на секунды — при текущих объёмах приемлемо; при росте таблицы до миллионов строк индекс строить отдельным ручным CONCURRENTLY вне мигратора.

- **(задача 1)** Откат теряет title/domain/tags артефактов, записанных после выката (строки и файлы в хранилище остаются) — это записано в заголовке миграции; после DROP COLUMN обязателен DELETE записи 0089 из drizzle.__drizzle_migrations, иначе мигратор считает её применённой и колонок не вернёт. check-0089.mjs прогоняет ровно эту последовательность.

- **(задача 2)** ПОРЯДОК: сначала задача 1 (миграция 0089 + schema.ts) и `pnpm --filter @mydon/db build` — Core компилируется против `packages/db/dist`; без пересборки `attachment.title/domain/tags` для tsc не существуют, и ошибка выглядит как «в схеме нет колонки», а не как «пакет не пересобран».

- **(задача 2)** pglite (локальные сценарии) собран БЕЗ ICU: `COLLATE "und-x-icu"` (как у `nameMatches` в entities.service.ts) и `COLLATE "unicode"` там падают «ICU is not supported in this build» — проверено. Поэтому `pg_c_utf8` (встроенный провайдер PG 17). Оборотная сторона: `pg_c_utf8` существует только с PostgreSQL 17 — DEPLOY.md говорит, что прод на 17, но перед выкатом сверить на проде `select 1 from pg_collation where collname = 'pg_c_utf8'`; если вдруг 16 — `GET /artifacts?q=` даст 500, откат на `und-x-icu` + пропуск шага 2 сценария на pglite с громкой строкой.

- **(задача 2)** `PgDialect().sqlToQuery` отдаёт параметры-даты СТРОКАМИ ISO (маппинг драйвера у колонки timestamp), а не `Date` — в ассертах сравнивать с `AT.toISOString()`, иначе deepEqual падает на здоровом коде (наступил сам).

- **(задача 2)** Глобальный ValidationPipe с `forbidNonWhitelisted: true`: любой лишний query-параметр к `GET /artifacts` (например `page=`, `offset=`) — 400. Панель (задача 5) шлёт только девять имён: kind, ownerType, ownerId, domain, from, to, q, limit, cursor.

- **(задача 2)** `to=2026-09-08` (дата без времени) — это 00:00 UTC = 05:00 Ташкента, то есть «до начала дня». Панель должна слать конец дня явным ISO (`2026-09-08T23:59:59.999+05:00` или следующую полночь по Ташкенту); Core намеренно не угадывает.

- **(задача 2)** `?domain=personal` при `OWNER_IDENTITY_ENFORCED=1` без `x-owner-action-token` → 403 от глобального `PersonalDomainGuard` ещё до контроллера — это существующее поведение, кода не требует, но в смоуке не принимать за поломку маршрута.

- **(задача 2)** Курсор — `base64url`, а не `base64` (буква интерфейса контроллера): в строке запроса `+` декодируется в пробел, `/` и `=` требуют экранирования, и скопированная ссылка на страницу ломалась бы. Клиент курсор не разбирает, формат `${ISO}|${id}` внутри сохранён.

- **(задача 2)** `next` при ровно `limit` строках выдаётся даже если дальше пусто — следующая страница может прийти пустой с `next: null`. Это намеренно (иначе нужен `limit+1` запрос); панель обязана переносить это без «ничего не найдено».

- **(задача 2)** Сценарий 2.7 локально требует `NODE_PATH=~/pgtest/node_modules` — драйвер `drizzle-orm/pglite` резолвит `@electric-sql/pglite` через него; без переменной падает MODULE_NOT_FOUND из `driver.cjs`, а не из сценария (наступил сам). В CI `CHECKS_DATABASE_URL` переключает на postgres:17.

- **(задача 2)** Тест контроллера импортирует `../app.module` — грузит метаданные всех 39 модулей Core (0,4 с, без побочных эффектов, проверено на dist). Если кто-то заведёт модуль с сайд-эффектом на импорт (например, чтение env с throw), первым упадёт этот тест — это сигнал про тот модуль, а не про artifacts.

- **(задача 2)** Перед `pnpm --filter @mydon/core test` — `clean`: раннер гоняет `find dist -name '*.test.js'`, и сироты переименованных тестов дают ложные падения (память feedback_dist_orphan_tests).

- **(задача 2)** `ARTIFACT_KINDS` в artifacts.service.ts дублирует inline-список `@IsIn(["photo","receipt","doc"])` в `UploadDto.kind` (attachments.controller.ts); связь закрыта только тестом `deepEqual`. Если задача 3 (расширение POST /attachments) добавит четвёртый kind — обновить обе точки, тест напомнит.

- **(задача 3)** Порядок задач: глобальный ValidationPipe стоит с `forbidNonWhitelisted: true` (apps/core/src/main.ts:13-19) — ПОКА эта задача не выкачена, любой вызов с полем `title`/`domain`/`tags` получает 400 «property title should not exist». Задача 4 (бот) обязана идти строго после Задачи 3, и в одном релизе.

- **(задача 3)** Белый список файлов: `DOC_EXT` принимал ТОЛЬКО `application/pdf`; `@mydon/documents` производит xlsx/docx/pptx/pdf — без п. 3.1.3 письмо среза A3 давало бы 400 на каждом Word/Excel-отчёте, и «сбой сохранения не блокирует отправку» превратилось бы в «архив никогда не наполняется». Правка сделана здесь, потому что файл тот же; контроллер вправе перенести её в отдельный пункт — но не выбросить.

- **(задача 3)** HTML НЕ добавлен в белый список намеренно (защита #244: заявленный верно `text/html` исполняется при прямом переходе на origin, `nosniff` не помогает). Спека §2.3 говорит «HTML — в новой вкладке», но производителя HTML-артефактов в репо нет; открывать дверь без производителя — только риск.

- **(задача 3)** multer (append-field 1.0.0): одно поле `tags` приходит СТРОКОЙ, повторённое — массивом. Без `normalizeAttachmentTags` один тег падал бы на `@IsArray`, два проходили бы. Бот шлёт `form.append("tags", t)` на каждый тег, а НЕ JSON-строку массива — иначе в БД ляжет один тег `["bot"]`.

- **(задача 3)** Обрезка `title` — `Array.from(...).slice(0, 120)`, не `String.prototype.slice`: последний рубит суррогатную пару эмодзи пополам и оставляет в БД битый символ. `@MaxLength(120)` считает суррогатную пару за один символ (validator.js 13.15 `isLength`), поэтому 120 эмодзи проходят — тест на это опирается; проверено на node_modules репо.

- **(задача 3)** `domain=""` из формы приводится к «не указано» (`@Transform`), а не отвергается — `@IsOptional` пропускает только null/undefined, пустую строку без трансформа `@IsIn` дал бы 400.

- **(задача 3)** Типизация `attachment.tags` в schema.ts зависит от Задачи 1: если там нет `.$type<string[]>()`, `row.tags` — `unknown`; `tagsOf(value: unknown)` компилируется в обоих случаях, а `as string[]` в чтении был бы ложью — Задаче 2 (`GET /artifacts`) использовать `tagsOf`, не каст.

- **(задача 3)** Тесты ядра гоняются по `dist` (`find dist -name '*.test.js'`) — перед прогоном ОБЯЗАТЕЛЬНО `pnpm exec turbo run build --filter=@mydon/core`, иначе проверяется прежняя сборка. Не `pnpm build --filter` — pnpm перехватит `--filter` и запустит tsc без сборки зависимостей. Сироты в dist (удалённые тесты) дают ложные падения — при странных ошибках `find apps/core/dist -name '*.test.js'` и сверить с src.

- **(задача 3)** `GET /attachments/:id/raw` помечен `@Public()` (спека §6 п. 3: перебор id через витрину тривиален). Эта задача его НЕ трогает — решение за Задачей 2/контроллером; но Office-файлы через него уходят `Content-Disposition: attachment` (тест 3.3.4), так что XSS-инвариант держится.

- **(задача 3)** `Domain` из `@mydon/shared` и `domainEnum.enumValues` из `@mydon/db` — два источника одного списка; тест «перечень DTO и DOMAINS — один и тот же список» падает при дрейфе любого из них.

- **(задача 3)** `exactOptionalPropertyTypes`: сервис принимает `title?: string` (не `string | undefined`) — `input.title ?? null` в insert; DTO-класс с теми же `?:` полями передаётся в сервис без каста.

- **(задача 4)** КРИТИЧНО, вне этого раздела: Core `attachments.service.ts` `allowedExt(kind, mimetype)` для `kind=doc` принимает ТОЛЬКО картинки и `application/pdf` (`DOC_EXT`). Без расширения `DOC_EXT` тремя OOXML-MIME (`…spreadsheetml.sheet`→`.xlsx`, `…wordprocessingml.document`→`.docx`, `…presentationml.presentation`→`.pptx`) КАЖДЫЙ xlsx/docx/pptx получит 400 и владелец увидит «в архив не лёг: Core отверг файл» — половина среза «письмо» мёртвая. Раздел `POST /attachments` обязан это сделать; смоук на живом Postgres — с xlsx, не с pdf.

- **(задача 4)** Формат `tags` в multipart: multer одиночное поле отдаёт строкой, повторённое — массивом; бот шлёт ОДНО поле `tags` JSON-строкой `["bot"]`. DTO Core должен парсить JSON-строку (`@Transform` + `@IsArray`), иначе `@IsArray()` на строке = 400 на каждом файле.

- **(задача 4)** Владелец обязан быть в `person` с `tg_chat_id` = его chatId: `handleMessage` — только владелец, и `personOf` для чата без строки даёт null → «чат не привязан к человеку», сохранения не будет НИКОГДА. Проверить на проде: `select id,name from person where tg_chat_id='<chat владельца>'`.

- **(задача 4)** `personOf`, `tg`, `deps` — замыкания внутри `main()`; блок `reply.document` тоже там. Не выносить `personOf` наружу и не пытаться тестировать `processUpdate` — логика вынесена в `document-archive.ts` именно поэтому.

- **(задача 4)** Тесты бота бегут из `dist` (`find dist -name '*.test.js'`): без `turbo run build --filter=@mydon/bot` новый тест не запустится, а после удаления/переименования тестов в dist остаются трупы (память: «Сироты в dist»).

- **(задача 4)** Env бота в `deploy/docker-compose.yml` — ЯВНЫЙ список, без `env_file`: `CC_PUBLIC_URL` в `.env` без строки в compose до контейнера не доедет, ссылка молча станет путём без хоста.

- **(задача 4)** `title` берётся из имени файла, не из `doc.summary` (спека §2.1 говорит «из summary или filename»): сводка модели — «Готово, я построил…», в витрине это болтовня. `Reply.document` сводку не несёт, менять `Reply.text` не нужно.

- **(задача 4)** Ссылка `/artifacts?q=<title>` предполагает, что страница панели читает `q` из searchParams (раздел панели). Если параметр назовут иначе — править только `ссылкаНаАрхив` и один тест.

- **(задача 4)** `domain` при отсутствии НЕ шлётся (spread), не пустая строка: `domainEnum` на стороне Core отверг бы `""` и утащил бы весь файл в 400 из-за необязательного поля.

- **(задача 4)** `noUnusedLocals`/`noUnusedParameters` включены в tsconfig.base: `type Domain` в handler.ts используется только в типе `Reply` — это нормально; но лишний импорт (например `CoreError` в index.ts) уронит typecheck.

- **(задача 4)** `saveAttachment` бросает `CoreError`, а `uploadPhoto` — голый `Error`; не «унифицировать» uploadPhoto в этом срезе (у его вызывающих свои тексты).

- **(задача 4)** Текст «оба сорвались» содержит «запроси отчёт заново» — это не прежнее «Повтори запрос» (тесты `doesNotMatch(/[Пп]овтори запрос/)`), но единственный честный совет, когда файл потерян в обе стороны.

- **(задача 5)** Сторож `state.test.ts` сканирует ВСЕ `.ts/.tsx` в `apps/cc/src` (кроме тестов) на литералы `"документ"`, `"фото"`, `"чек"`. Проверено грэпом: два настоящих попадания — `lib/brain-layout.ts:129` (`doc: "документ"`, вид узла графа «Мозг») и `components/ingredient-card-360.tsx:617` (`row["чек"]`, ключ колонки импорта). Без двух исключений в `ИСКЛЮЧЕНИЯ` (шаг 3) сторож покраснеет. В `page.tsx` слова типов брать ТОЛЬКО из `ARTIFACT_KIND_WORD`, в текстах пустых состояний слово «документы» стоит внутри длинного JSX-текста — сторож литералов его не видит, это нормально.

- **(задача 5)** Имя типа ответа Core НЕ `ArtifactsPage`: так называется компонент страницы по конвенции соседей (`AppsPage`, `FlowsPage`), и одноимённый `import type` дал бы дубль идентификатора. Тип называется `ArtifactList`.

- **(задача 5)** Ссылка на файл — `/api/attachments/<id>/raw` (прокси панели `app/api/attachments/[id]/raw/route.ts`), а НЕ `/attachments/:id/raw` Core: Core наружу не открыт, браузер до него не дойдёт. Тест страницы пришпиливает именно путь прокси.

- **(задача 5)** «HTML в новой вкладке» = `target=_blank` на ссылке; но и Core, и прокси панели отдают всё, что не картинка, с `Content-Disposition: attachment` + CSP `sandbox` — HTML в новой вкладке СКАЧАЕТСЯ, а не откроется. Это осознанная защита origin панели (SVG/HTML со скриптом), менять её в этом разделе нельзя; если владельцу нужен просмотр HTML — отдельное решение (sandboxed iframe/отдельный origin).

- **(задача 5)** `lib/theme.ts` и `CONSOLE_ROUTES` в дереве НЕТ (спека `2026-09-07-design-wave-theme-design.md` есть, кода нет) → берётся `<ConsoleTheme />`. Если Д2 смержат раньше исполнения этого раздела — вместо `<ConsoleTheme />` добавить `"/artifacts"` в `CONSOLE_ROUTES`, снять тест «тёмная тема через ConsoleTheme» и абзац §9 rules.md править по факту Д2.

- **(задача 5)** `rules.md` навыка живёт в ТРЁХ копиях и сравнивается побайтно (`design-skill.test.ts`, `ЗЕРКАЛЬНЫЕ_ФАЙЛЫ`); правка §9 обязана быть идентичной во всех трёх, включая переносы строк. Тест §9 требует, чтобы там упоминались `/mydon`, `/agents`, `/apps`, `/artifacts`, `/docs` — новый текст их сохраняет.

- **(задача 5)** Границы периода: адрес несёт сутки `YYYY-MM-DD`, в Core уходит ISO с фиксированным смещением `+05:00` (Узбекистан без DST с 1991). `new Date("2026-13-45T…")` даёт NaN, и `toISOString()` на нём БРОСАЕТ RangeError — поэтому `момент()` проверяет `Number.isFinite` до преобразования. Не заменять на `Date.parse` без этой проверки.

- **(задача 5)** `core.artifacts` идёт с `owner: true` (как `agentsStatus`): без второго пояса при `OWNER_IDENTITY_ENFORCED=1` владелец не увидел бы артефактов `domain=personal`, если Core (Задача 2) гейтит личный контур. Если Задача 2 гейта не делает — заголовок безвреден: он проставляется только подтверждённому владельцу.

- **(задача 5)** В тесте давности часы машины уводятся на 3 недели вперёд (`vi.useFakeTimers({ toFake: ["Date"] })`) — иначе ассерт «от часов Core» проходил бы и при откате на `new Date()` (проверено на `/apps`). Подменять ТОЛЬКО `Date`, полные фальшивые таймеры вешают рендер RTL.

- **(задача 5)** `typecheck` панели может ложно падать из-за протухшего `apps/cc/.next/types` после появления нового роута — чистить `.next` перед `tsc` (известная ловушка репо).

- **(задача 5)** `Record<string, string>` + `exactOptionalPropertyTypes`: параметры в `core.artifacts` собирать условными спредами `...(x !== undefined ? { x } : {})`, а не спредом объекта с optional-полями (`...период`) — иначе тип поля станет `string | undefined` и не пройдёт в `Record<string,string>`.

- **(задача 5)** `kind` в строке — `string`, а не союз: колонка `attachment.kind` текстовая; незнакомое значение печатается как есть с базовой лампой (тест «тип мимо словаря»), `ARTIFACT_KIND_WORD[row.kind]` без сужения не скомпилируется — это намеренно.

- **(задача 6)** Имя решения ≠ имя контроллера: `tools/repo-audit.mjs` («Спеки без решения») сверяет `docs/decisions/<дата СПЕКИ>-<slug>.md`; спека датирована 2026-09-07, поэтому файл `2026-09-08-artifacts-ring.md` числился бы «спекой без решения» вечно. Раздел использует `2026-09-07-artifacts-ring.md` везде (решение, memory, план, тест). Если контроллер настаивает на 09-08 — менять четыре ссылки и константу РЕШЕНИЕ в тесте, а тест «имя файла — дата спеки + slug» снести (он станет ложью).

- **(задача 6)** Порядок задач: раздел читает миграцию 0089, `apps/cc/src/lib/artifacts.ts` (ARTIFACTS_SINCE), `apps/cc/src/lib/state.ts` (ARTIFACT_KIND_WORD/LED), `apps/cc/src/app/artifacts/page.tsx`, пометку `document` в схеме. `verify-paths.mjs` проверяет `apps/cc/src/app/artifacts/page.tsx` и `apps/cc/src/lib/artifacts.ts` из правленого `rules.md`/`primitives.md` стартера — до задач 1–5 всё красное по построению, это не дефект раздела.

- **(задача 6)** Зеркала: `design-skill.test.ts` сравнивает rules/tokens/primitives/checklist ПОБАЙТНО в `.agents/skills/mydon-design` и `docs/agentic-os-starter/claude-skills/mydon-design`; SKILL.md Codex-зеркала отличается двумя объявленными заменами (`CLAUDE.md`→`AGENTS.md`, «макеты Claude Design»→«макеты Codex Design») — SKILL.md НЕ копировать. Правки только через `cp` из `.claude/skills`, не руками в зеркале.

- **(задача 6)** `rules.md` §9 обязан по-прежнему содержать все пять строк `/mydon`, `/agents`, `/apps`, `/artifacts`, `/docs` — существующий тест «названы все расхождения маршрутного списка»; нельзя просто вычеркнуть `/artifacts` из §9, только переформулировать (новый текст это учитывает).

- **(задача 6)** Д2 не смержен (нет `apps/cc/src/lib/theme.ts`, нет маркера `<!-- CONSOLE_ROUTES -->`), но его план (`docs/superpowers/plans/2026-09-07-design-wave-theme.md`) перечисляет `CONSOLE_ROUTES` из 8 префиксов БЕЗ `/artifacts`: при мерже Д2 страница молча посветлеет. Растяжка в `artifacts-docs.test.ts` падает при появлении `theme.ts` с сообщением, что делать; при мерже Д2 её снимают вместе с переписыванием §9. Маркерный контракт Д2 касается §4 (между «## 4.» и «## 5.»), новый текст §9 его не задевает.

- **(задача 6)** `GET /attachments/:id/raw` — `@Public()`, и панель проксирует его через `coreBytes` БЕЗ токена; закрыть `raw` гардом «как сказано в спеке §6 п.3» без правки прокси = 401 в `<img>` галерей полевого контура. Ruling записывает «остаётся открытым», тест пришпиливает это к коду: если задача 2 закрыла raw, тест «ruling про raw не врёт про код» краснеет — тогда переписать ruling, а не ослаблять тест.

- **(задача 6)** Мигратор (`packages/db/src/migrate.ts` → drizzle-orm/postgres-js/migrator) держит все миграции в одной транзакции (`session.transaction` в pg-core/dialect.js) и гоняет их же на pglite — `CREATE INDEX CONCURRENTLY` упадёт; решение Р-5 и тест утверждают «обычный индекс». Если задача 1 всё же написала CONCURRENTLY — это дефект задачи 1, не повод править Р-5.

- **(задача 6)** `node tools/repo-audit.mjs` БЕЗ `--dry-run` дописывает секцию в `memory/open-questions.md` — единственная запись скрипта; в проверках всегда `--dry-run`.

- **(задача 6)** Решение A2 (`docs/decisions/2026-09-06-wave-a2-faces.md`, «Отложено») передало волне A3 долг: индекс под `distinct on (agent_name)` в `agent_run` и ретенцию журнала. Миграция 0089 контроллера их не содержит — ruling в решении фиксирует «не вошло и остаётся долгом», иначе долг растворяется (в тексте A2 написано «принято волной A3»).

- **(задача 6)** `memory/decisions.md` отстаёт: строк для волн R, A1, A2 (06.09) в указателе нет — раздел добавляет только строку A3, чтобы не сочинять чужие резюме (вопрос 3).

- **(задача 6)** zsh: `=====` без кавычек и `--include=*.ts` без кавычек ломают команды («not found» / «no matches found») — в проверочных командах раздела глобов и знаков равенства без кавычек нет; `cat -A` на macOS не существует (использовать `od -c`).

## Решения, принятые авторами задач самостоятельно

- **(задача 1)** Р-A3-8 требует запись в docs/decisions/, почему субстрат — attachment (формат — как 2026-09-06-wave-r-crons-flows.md: «Решение / Почему / Цена ошибки»). В этом разделе она не написана — за каким разделом плана закреплена (по смыслу — за финальным разделом навигации/документации)?

- **(задача 1)** Нужен ли абзац в docs/DEPLOY.md о выкате 0089 (по образцу «Rollout … 0075 → 0079»)? Миграция без бэкфилла и без ручных шагов — по-моему, достаточно заголовка в SQL; решите, добавлять ли строку в DEPLOY.md.

- **(задача 1)** ARTIFACTS_SINCE = "2026-09-08" (Задача 5) — дата выката = день мержа PR. Если мерж сдвинется, константу правит тот, кто мержит; в заголовке миграции на неё есть ссылка, но само значение там намеренно не продублировано — подтвердить, что источник истины один (lib/artifacts.ts).

- **(задача 1)** check-0089.mjs в CI гоняется автоматически (поиск по каталогу), локально требует ~/pgtest с pglite или докер postgres:17 — если у исполнителя нет ни того, ни другого, шаг 8.3 закрывается прогоном `gh workflow run ci.yml --ref <ветка>` (8.4). Достаточно ли этого как гейта, или требовать локальный прогон обязательно?

- **(задача 2)** Единый дом для списка kind'ов: сейчас `ARTIFACT_KINDS` живёт в artifacts.service.ts и зеркалит inline-список `UploadDto.kind`. Предложение контроллеру: задача 3 экспортирует `ATTACHMENT_KINDS` из attachments.service.ts (или `@mydon/shared`), artifacts импортирует его, а панельный словарь `ARTIFACT_KIND_WORD` (state.ts) проверяется тестом на равенство ключей. Принять или оставить как есть (три точки, связанные тестами)?

- **(задача 2)** Коллация `pg_c_utf8` требует PostgreSQL ≥ 17. DEPLOY.md: прод на 17. Подтвердить на живом проде до мержа (`select 1 from pg_collation where collname='pg_c_utf8'`) — включить в чек-лист выката задачи 1 или в смоук `tools/smoke-core.mjs`?

- **(задача 2)** Шаг 2.7 (сценарий `tools/pglite-checks/check-artifacts-a3.mjs`) выходит за пять файлов, названных для раздела, но только он доказывает «две страницы не пересекаются» на настоящем SQL и подхватывается CI автоматически. Оставить в этом разделе или перенести в раздел задачи 1/смоука?

- **(задача 2)** Р-A3-8 (`docs/decisions/…` — почему субстрат `attachment`) — чей раздел? В этом не делается.

- **(задача 2)** Спека §6 п.3: `GET /attachments/:id/raw` помечен `@Public()` и отдаёт файл по id без токена и без проверки владельца; после `/artifacts` (UUID виден в списке) это тривиальный перебор. Панель кладёт raw в `<img>` без заголовков, так что просто навесить `ReadTokenGuard` нельзя — нужен прокси в панели (`apps/cc/src/app/api/attachments/[id]/raw` уже упоминается в коде) или решение отложить. В каком разделе закрывать?

- **(задача 2)** Спека §5 «смоук на живом Postgres: POST /attachments с title/domain/tags → GET /artifacts?domain=… находит» — стык задач 2 и 3; предложение добавить его в `tools/smoke-core.mjs` в разделе задачи 3, когда POST уже принимает новые поля.

- **(задача 3)** Принимать ли `text/html` как тип артефакта (спека §2.3 «HTML — в новой вкладке»)? Сейчас запрещён защитой #244 и производителя HTML в репо нет. Предложение: НЕ принимать до появления производителя; тогда отдельным решением — отдача HTML только вложением или с `sandbox` и отдельного origin.

- **(задача 3)** Расширение `DOC_EXT` (docx/xlsx/pptx) — оставить внутри Задачи 3 (сделано, тот же файл) или вынести отдельным пунктом плана? Без него Задача 4 нерабочая на 3 из 4 форматов `@mydon/documents`.

- **(задача 3)** `createdBy` для документов бота: DTO уже принимает поле; по комментарию схемы формат `owner | staff:<id> | agent:<имя>`. Задаче 4 предлагается слать `staff:<person.id>` (кто попросил), а `ownerType="person"`/`ownerId=person.id` — как зафиксировал контроллер. Подтвердить.

- **(задача 3)** Нужно ли `tags` и `title` на `GET /attachments?ownerType&ownerId` панели (галерея карточки) — они теперь есть в `AttachmentMeta`; тип `Attachment` в `apps/cc/src/lib/core.ts` НЕ расширен (лишние поля ответа панели не мешают). Расширять ли тип панели в Задаче 5 или оставить только `ArtifactRow`?

- **(задача 4)** Раздел Core `POST /attachments`: подтвердить, что `DOC_EXT` расширен тремя OOXML-MIME (.xlsx/.docx/.pptx) и что `tags` принимается JSON-строкой из multipart, а `title` допускает ≥120 символов — иначе бот-часть среза не работает.

- **(задача 4)** Есть ли у владельца строка `person` с `tg_chat_id` его чата на проде? Если нет — завести ДО выката, иначе все его отчёты уйдут с «чат не привязан к человеку».

- **(задача 4)** Имя параметра поиска на странице `/artifacts` панели — `q`? Бот строит ссылку `/artifacts?q=<title>`.

- **(задача 4)** Значение `CC_PUBLIC_URL` на проде: хост панели за tailscale serve (https://…ts.net) — вписать в `.env` на сервере вместе с выкатом compose.

- **(задача 4)** Принимается ли выбор `title` = имя файла (а не `doc.summary`)? Если владелец хочет и сводку модели в архиве — это отдельное поле `note` в attachment, не в этом срезе.

- **(задача 5)** Спека §2.4: «`primitives.md` получает описание строки артефакта» — это документ навыка в трёх зеркалах; в этом разделе НЕ правится (описание строки = `.approw` с `data-kind`, ссылка в `.an`, мета `.as`, давность `.aw`). Кому из задач плана это принадлежит — Задаче 6 (docs/decisions + навык) или сюда? Если сюда — добавить строку в таблицу «Контейнеры и списки» во все три копии `primitives.md`.

- **(задача 5)** Имя владельца в строке: Core отдаёт `ownerId`, не имя; строка печатает «для человека» со ссылкой на `/team/<id>`. Если владелец захочет имя прямо в списке — Задаче 2 нужно отдавать `ownerTitle` в `ArtifactRow` (один JOIN на person/task), панель тогда допечатает его в `.as`. Оставлено как вопрос, не как долг.

- **(задача 5)** Слово для `tags` в строке не печатается (контроллер в составе строки их не назвал). Нужны ли чипы тегов (`bot`, …) в `.as` — или это шум, пока тег один?

- **(задача 5)** Дата начала архива `ARTIFACTS_SINCE = "2026-09-08"` — день выката миграции 0089 по спеке; если выкат сдвинется, править константу И ассерт в `artifacts.test.ts` (сознательно). Подтвердить фактическую дату выката перед мержем.

- **(задача 5)** Период по умолчанию — «за всё время» (без `from`/`to`). Нужен ли предустановленный «последние 30 дней» как на `/team/actions`, или закладки с явными датами достаточно?

- **(задача 6)** 1. Имя файла решения: контроллер назвал `docs/decisions/2026-09-08-artifacts-ring.md`, раздел использует `2026-09-07-artifacts-ring.md` — по конвенции `tools/repo-audit.mjs` («<дата спеки>-<slug>.md», спека 2026-09-07). Подтвердить 09-07 или вернуть 09-08 (тогда снять тест «имя файла — дата спеки + slug» и заменить четыре ссылки + константу РЕШЕНИЕ).

- **(задача 6)** 2. Ruling про `GET /attachments/:id/raw`: в дереве он `@Public()`, прокси панели `coreBytes` токен не шлёт; раздел записывает «остаётся открытым в этом срезе» с причинами и пришпиливает тестом. Закрывает ли raw задача 2 (Core)? Если да — заменить ruling на «закрыт `ReadTokenGuard`, `coreBytes` шлёт токен» и перевернуть две проверки в тесте.

- **(задача 6)** 3. `memory/decisions.md` не содержит строк для волн R, A1, A2 (06.09) — добавить их в этом же срезе (три строки-указателя) или оставить владельцу?

- **(задача 6)** 4. Если к моменту исполнения Д2 уже смержен (`apps/cc/src/lib/theme.ts` существует): раздел меняется — §9 rules.md переписывает тест дрейфа Д2, `/artifacts` идёт в `CONSOLE_ROUTES`, растяжка в тесте убирается, Р-8 в решении переформулируется на вариант «после Д2». Кто владеет этой развилкой — задача 5 или задача 6?

- **(задача 6)** 5. `routers/mydon.md:72` (и копия в `docs/agentic-os-starter/routers/mydon.md:70`) говорит «Нет живого статуса агентов, доски расписаний, плейбэка прогонов, кольца артефактов» — устарело уже для R/A2, теперь и для A3. Тест дрейфа между корневым роутером и стартером не найден. Править в этом срезе одной строкой или оставить аудиту роутеров?

- **(задача 6)** 6. Спека §6 п.4 требует обрезать `title` до 120 символов на входе бота (полный текст — в caption). В интерфейсе `saveAttachment` контроллера это не зафиксировано; в решении не упомянуто, чтобы не утверждать непроверенное. Делает ли это задача 3? Если да — добавить фразу в Р-3.

- **(задача 6)** 7. Растяжка «падает при появлении lib/theme.ts» — сознательно ломающий будущий мерж Д2 тест с инструкцией в сообщении. Оставить (защита от молчаливой потери тёмной темы `/artifacts`) или заменить на пункт в «Отложено» без теста?
