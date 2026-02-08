# OpenClaw Integration Plan for MYDON

## Overview

OpenClaw - платформа AI-агентов и мультиканальных сообщений.
- **Gateway:** http://127.0.0.1:18789
- **Version:** 2026.1.29
- **AI Model:** Claude Opus 4.5

---

## Phase 1: Базовая интеграция (1-2 дня)

### 1.1 OpenClaw Client Library
Создать TypeScript клиент для взаимодействия с OpenClaw Gateway.

```typescript
// server/integrations/openclaw/client.ts
interface OpenClawClient {
  // Отправка сообщений
  sendMessage(channel: Channel, target: string, message: string): Promise<void>

  // AI Agent запросы
  runAgent(message: string, options?: AgentOptions): Promise<AgentResponse>

  // Cron задачи
  scheduleCron(job: CronJob): Promise<string>
  removeCron(jobId: string): Promise<void>
}
```

### 1.2 Environment Variables
```env
# OpenClaw Integration
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_ENABLED=true
```

---

## Phase 2: Уведомления (2-3 дня)

### 2.1 Каналы доставки
- **Telegram** - личные уведомления
- **WhatsApp** - деловые уведомления
- **Discord** - командные уведомления
- **Slack** - корпоративные уведомления

### 2.2 Типы уведомлений

| Событие | Срочность | Канал по умолчанию |
|---------|-----------|-------------------|
| Дедлайн через 24ч | Высокая | WhatsApp/Telegram |
| Дедлайн через 1ч | Критическая | WhatsApp + Push |
| Задача назначена | Средняя | Telegram |
| Комментарий | Низкая | Email/Discord |
| Упоминание (@user) | Высокая | Telegram |
| Статус изменён | Низкая | Discord |
| Блокер добавлен | Критическая | WhatsApp |

### 2.3 Настройки пользователя
```typescript
interface UserNotificationPreferences {
  channels: {
    telegram?: { chatId: string; enabled: boolean }
    whatsapp?: { phone: string; enabled: boolean }
    discord?: { userId: string; enabled: boolean }
    slack?: { userId: string; enabled: boolean }
  }
  quietHours?: { start: string; end: string; timezone: string }
  urgentOnly?: boolean
}
```

---

## Phase 3: AI через OpenClaw (1-2 дня)

### 3.1 Использование OpenClaw как AI Backend
Вместо прямых вызовов к Anthropic/OpenAI, роутить через OpenClaw.

**Преимущества:**
- Единый billing через OpenClaw
- Автоматические fallbacks
- Логирование и аналитика
- Rate limiting

### 3.2 Интеграция
```typescript
// server/integrations/openclaw/ai.ts
export async function invokeAI(prompt: string, options?: AIOptions) {
  if (ENV.openclawEnabled) {
    return openclawClient.runAgent(prompt, {
      thinking: options?.thinking || 'medium',
      timeout: 300,
    })
  }
  // Fallback to direct API
  return invokeLLM({ messages: [{ role: 'user', content: prompt }] })
}
```

---

## Phase 4: Чат-бот команды (3-4 дня)

### 4.1 Команды через мессенджеры

```
/tasks - Список моих задач на сегодня
/task 123 - Детали задачи #123
/done 123 - Отметить задачу как выполненную
/add "Название" - Создать быструю задачу
/remind 123 2h - Напомнить о задаче через 2 часа
/status - Статус проекта
/blockers - Показать блокеры
/standup - Сгенерировать daily standup
```

### 4.2 Webhook для входящих сообщений
```typescript
// server/integrations/openclaw/webhook.ts
app.post('/api/openclaw/webhook', async (req, res) => {
  const { channel, sender, message } = req.body

  // Parse command
  const command = parseCommand(message)

  // Execute and respond
  const response = await executeCommand(command, sender)
  await openclawClient.sendMessage(channel, sender, response)
})
```

---

## Phase 5: Scheduled Jobs (2 дня)

### 5.1 Cron задачи через OpenClaw

| Job | Schedule | Описание |
|-----|----------|----------|
| daily-digest | 0 9 * * * | Утренняя сводка задач |
| deadline-check | 0 * * * * | Проверка дедлайнов каждый час |
| weekly-report | 0 10 * * 1 | Еженедельный отчёт в понедельник |
| standup-reminder | 0 10 * * 1-5 | Напоминание о стендапе |
| overdue-alert | 0 18 * * * | Вечерняя проверка просроченных |

### 5.2 Регистрация задач
```bash
openclaw cron add \
  --name "mydon-daily-digest" \
  --schedule "0 9 * * *" \
  --command "curl -X POST http://localhost:3005/api/cron/daily-digest"
```

---

## Phase 6: AI-Powered Features (3-4 дня)

### 6.1 Smart Task Assistant
- Автоматическое разбиение крупных задач
- Оценка времени выполнения
- Предложение приоритетов
- Поиск похожих задач

### 6.2 Daily Standup Generator
```
Доброе утро! Ваш стендап на сегодня:

📋 Вчера:
- ✅ Завершил интеграцию API (#234)
- ✅ Исправил баг в авторизации (#235)

📌 Сегодня:
- 🔄 Тестирование модуля экспорта (#236)
- ⏳ Ревью PR от Ивана (#237)

⚠️ Блокеры:
- Ожидаю ответ от дизайнера по макетам
```

### 6.3 Intelligent Reminders
AI анализирует паттерны работы и предлагает оптимальное время для напоминаний.

---

## Phase 7: Memory & Context (2 дня)

### 7.1 Синхронизация контекста
OpenClaw Memory для хранения контекста проекта:
- История решений
- Заметки по задачам
- Информация о команде

### 7.2 Поиск по памяти
```typescript
const relevantContext = await openclawClient.memory.search({
  query: "authentication implementation decisions",
  limit: 5
})
```

---

## Implementation Order

```
Week 1:
├── Phase 1: OpenClaw Client (1 день)
├── Phase 2: Notifications (2 дня)
└── Phase 3: AI Backend (1 день)

Week 2:
├── Phase 4: Chat Commands (3 дня)
└── Phase 5: Cron Jobs (2 дня)

Week 3:
├── Phase 6: AI Features (3 дня)
└── Phase 7: Memory (2 дня)
```

---

## File Structure

```
server/integrations/openclaw/
├── client.ts          # OpenClaw Gateway client
├── channels.ts        # Channel-specific handlers
├── notifications.ts   # Notification logic
├── commands.ts        # Chat command parser
├── cron.ts           # Cron job management
├── ai.ts             # AI proxy
├── memory.ts         # Memory sync
├── webhook.ts        # Incoming webhook handler
└── types.ts          # TypeScript types
```

---

## Database Schema Additions

```sql
-- User notification preferences
ALTER TABLE users ADD COLUMN openclaw_preferences JSON;

-- Notification log
CREATE TABLE openclaw_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  channel VARCHAR(32) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON,
  status ENUM('pending', 'sent', 'failed', 'delivered'),
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Cron job tracking
CREATE TABLE openclaw_cron_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  openclaw_job_id VARCHAR(64) UNIQUE,
  name VARCHAR(128) NOT NULL,
  schedule VARCHAR(64) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
