/**
 * OpenClaw Chat Commands
 *
 * Parses and executes commands from messenger channels
 * Commands: /tasks, /task, /done, /add, /remind, /status, /blockers, /standup, /help
 */

import { getDb } from '../../db';
import { tasks, projects, projectMembers, users, taskReminders } from '../../../drizzle/schema';
import { eq, and, or, lte, isNull, desc } from 'drizzle-orm';
import { taskAI } from './ai';
import type { InferSelectModel } from 'drizzle-orm';

type TaskRecord = InferSelectModel<typeof tasks>;

/**
 * Command types
 */
export type CommandName =
  | 'tasks'
  | 'task'
  | 'done'
  | 'add'
  | 'remind'
  | 'status'
  | 'blockers'
  | 'standup'
  | 'help'
  | 'unknown';

export interface ParsedCommand {
  command: CommandName;
  args: string[];
  rawArgs: string;
}

export interface CommandContext {
  userId: number;
  userName?: string;
  channel: string;
  chatId: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Parse command from message text
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  // Check if it's a command
  if (!trimmed.startsWith('/')) {
    return { command: 'unknown', args: [], rawArgs: trimmed };
  }

  // Extract command and arguments
  const parts = trimmed.slice(1).split(/\s+/);
  const commandName = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);
  const rawArgs = parts.slice(1).join(' ');

  // Map to known commands
  const knownCommands: CommandName[] = [
    'tasks', 'task', 'done', 'add', 'remind',
    'status', 'blockers', 'standup', 'help'
  ];

  const command = knownCommands.includes(commandName as CommandName)
    ? (commandName as CommandName)
    : 'unknown';

  return { command, args, rawArgs };
}

/**
 * Format task for display
 */
function formatTask(task: TaskRecord, includeId = true): string {
  const statusEmoji = {
    not_started: '⬜',
    in_progress: '🔄',
    completed: '✅',
  }[task.status || 'not_started'] || '⬜';

  const priorityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  }[task.priority || 'medium'] || '🟡';

  const deadlineStr = task.deadline
    ? ` 📅 ${new Date(task.deadline).toLocaleDateString('ru-RU')}`
    : '';

  const idStr = includeId ? ` #${task.id}` : '';

  return `${statusEmoji} ${priorityEmoji}${idStr} ${task.title}${deadlineStr}`;
}

/**
 * Format date for Russian locale
 */
function formatDateRu(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Command Handlers
 */
export class CommandHandler {
  /**
   * Execute a parsed command
   */
  async execute(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    switch (cmd.command) {
      case 'tasks':
        return this.handleTasks(cmd, ctx);
      case 'task':
        return this.handleTask(cmd, ctx);
      case 'done':
        return this.handleDone(cmd, ctx);
      case 'add':
        return this.handleAdd(cmd, ctx);
      case 'remind':
        return this.handleRemind(cmd, ctx);
      case 'status':
        return this.handleStatus(cmd, ctx);
      case 'blockers':
        return this.handleBlockers(cmd, ctx);
      case 'standup':
        return this.handleStandup(cmd, ctx);
      case 'help':
        return this.handleHelp();
      default:
        return this.handleUnknown(cmd);
    }
  }

  /**
   * /tasks - List user's tasks for today
   */
  private async handleTasks(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get user's incomplete tasks
    const userTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, ctx.userId),
          or(
            eq(tasks.status, 'not_started'),
            eq(tasks.status, 'in_progress')
          )
        )
      )
      .orderBy(tasks.deadline, tasks.priority)
      .limit(15);

    if (userTasks.length === 0) {
      return {
        success: true,
        message: '🎉 У вас нет активных задач! Отличная работа!',
      };
    }

    // Separate by urgency
    const overdue: TaskRecord[] = [];
    const dueToday: TaskRecord[] = [];
    const upcoming: TaskRecord[] = [];

    for (const task of userTasks) {
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        if (deadline < today) {
          overdue.push(task);
        } else if (deadline < tomorrow) {
          dueToday.push(task);
        } else {
          upcoming.push(task);
        }
      } else {
        upcoming.push(task);
      }
    }

    let message = '📋 **Ваши задачи:**\n\n';

    if (overdue.length > 0) {
      message += '🚨 **Просроченные:**\n';
      message += overdue.map(t => formatTask(t)).join('\n') + '\n\n';
    }

    if (dueToday.length > 0) {
      message += '⏰ **На сегодня:**\n';
      message += dueToday.map(t => formatTask(t)).join('\n') + '\n\n';
    }

    if (upcoming.length > 0) {
      message += '📌 **Предстоящие:**\n';
      message += upcoming.slice(0, 5).map(t => formatTask(t)).join('\n');
      if (upcoming.length > 5) {
        message += `\n... и ещё ${upcoming.length - 5}`;
      }
    }

    return { success: true, message, data: { overdue, dueToday, upcoming } };
  }

  /**
   * /task <id> - Show task details
   */
  private async handleTask(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const taskId = parseInt(cmd.args[0]);

    if (isNaN(taskId)) {
      return {
        success: false,
        message: '❌ Укажите ID задачи: `/task 123`',
      };
    }

    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return { success: false, message: `❌ Задача #${taskId} не найдена` };
    }

    const statusMap: Record<string, string> = {
      not_started: 'Не начата',
      in_progress: 'В работе',
      completed: 'Завершена',
    };
    const statusText = statusMap[task.status || 'not_started'] || 'Не начата';

    const priorityMap: Record<string, string> = {
      critical: '🔴 Критический',
      high: '🟠 Высокий',
      medium: '🟡 Средний',
      low: '🟢 Низкий',
    };
    const priorityText = priorityMap[task.priority || 'medium'] || '🟡 Средний';

    let message = `📌 **Задача #${task.id}**\n\n`;
    message += `**${task.title}**\n\n`;

    if (task.description) {
      message += `📝 ${task.description}\n\n`;
    }

    message += `📊 Статус: ${statusText}\n`;
    message += `⚡ Приоритет: ${priorityText}\n`;

    if (task.deadline) {
      message += `📅 Дедлайн: ${formatDateRu(new Date(task.deadline))}\n`;
    }

    if (task.notes) {
      message += `\n💡 Заметки: ${task.notes}`;
    }

    return { success: true, message, data: task };
  }

  /**
   * /done <id> - Mark task as completed
   */
  private async handleDone(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const taskId = parseInt(cmd.args[0]);

    if (isNaN(taskId)) {
      return {
        success: false,
        message: '❌ Укажите ID задачи: `/done 123`',
      };
    }

    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    // Check task exists and belongs to user
    const [task] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.assignedTo, ctx.userId)
        )
      )
      .limit(1);

    if (!task) {
      return {
        success: false,
        message: `❌ Задача #${taskId} не найдена или не назначена вам`,
      };
    }

    if (task.status === 'completed') {
      return {
        success: true,
        message: `✅ Задача #${taskId} уже завершена`,
      };
    }

    // Update task status
    await db
      .update(tasks)
      .set({ status: 'completed' })
      .where(eq(tasks.id, taskId));

    return {
      success: true,
      message: `✅ Задача завершена!\n\n${formatTask({ ...task, status: 'completed' })}`,
      data: { taskId },
    };
  }

  /**
   * /add <title> - Quick add task
   */
  private async handleAdd(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const title = cmd.rawArgs.trim();

    if (!title) {
      return {
        success: false,
        message: '❌ Укажите название задачи: `/add Название задачи`',
      };
    }

    if (title.length > 500) {
      return {
        success: false,
        message: '❌ Название слишком длинное (макс. 500 символов)',
      };
    }

    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    // Find user's default project (first project they're a member of)
    const [membership] = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, ctx.userId))
      .limit(1);

    if (!membership) {
      return {
        success: false,
        message: '❌ У вас нет доступных проектов. Создайте проект в MYDON.',
      };
    }

    // Get first section of the project to add task to
    const sectionResult = await db.execute(
      `SELECT s.id FROM sections s
       JOIN blocks b ON s.blockId = b.id
       WHERE b.projectId = ?
       ORDER BY b.sortOrder, s.sortOrder
       LIMIT 1`,
      [membership.projectId]
    ) as any;

    const sectionId = sectionResult?.[0]?.[0]?.id;
    if (!sectionId) {
      return {
        success: false,
        message: '❌ В проекте нет разделов. Создайте структуру в MYDON.',
      };
    }

    // Create task
    const result = await db.insert(tasks).values({
      sectionId,
      title,
      status: 'not_started',
      priority: 'medium',
      assignedTo: ctx.userId,
    });

    const taskId = (result as any).insertId;

    return {
      success: true,
      message: `✅ Задача создана!\n\n⬜ 🟡 #${taskId} ${title}`,
      data: { taskId, title },
    };
  }

  /**
   * /remind <id> <time> - Set reminder for task
   */
  private async handleRemind(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const taskId = parseInt(cmd.args[0]);
    const timeArg = cmd.args[1];

    if (isNaN(taskId) || !timeArg) {
      return {
        success: false,
        message: '❌ Формат: `/remind 123 2h` или `/remind 123 30m`\n\nПримеры:\n• `30m` - 30 минут\n• `2h` - 2 часа\n• `1d` - 1 день',
      };
    }

    // Parse time argument
    const timeMatch = timeArg.match(/^(\d+)(m|h|d)$/i);
    if (!timeMatch) {
      return {
        success: false,
        message: '❌ Неверный формат времени. Используйте: `30m`, `2h`, `1d`',
      };
    }

    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();

    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const ms = value * multipliers[unit];
    const reminderTime = new Date(Date.now() + ms);

    // Verify task exists
    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return { success: false, message: `❌ Задача #${taskId} не найдена` };
    }

    // Determine channel based on context
    const channel = ctx.channel === 'telegram' ? 'telegram' : 'web';

    // Store reminder in database
    await db.insert(taskReminders).values({
      userId: ctx.userId,
      taskId: taskId,
      remindAt: reminderTime,
      channel: channel as 'telegram' | 'web' | 'email',
      chatId: ctx.chatId || null,
      message: `⏰ Напоминание о задаче #${taskId}: ${task.title}`,
      status: 'pending',
    });

    const timeStr = formatDateRu(reminderTime);

    return {
      success: true,
      message: `⏰ Напоминание установлено!\n\nЗадача: #${taskId} ${task.title}\nВремя: ${timeStr}`,
      data: { taskId, reminderTime },
    };
  }

  /**
   * /status - Project status overview
   */
  private async handleStatus(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    // Get user's projects
    const userProjects = await db
      .select({
        projectId: projectMembers.projectId,
        projectName: projects.name,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, ctx.userId))
      .limit(5);

    if (userProjects.length === 0) {
      return {
        success: true,
        message: '📊 У вас нет проектов.',
      };
    }

    let message = '📊 **Статус проектов:**\n\n';

    for (const proj of userProjects) {
      // Get task stats for this project
      const projectTasks = await db.execute(
        `SELECT t.status, COUNT(*) as cnt
         FROM tasks t
         JOIN sections s ON t.sectionId = s.id
         JOIN blocks b ON s.blockId = b.id
         WHERE b.projectId = ?
         GROUP BY t.status`,
        [proj.projectId]
      ) as any;

      const stats: Record<string, number> = {
        not_started: 0,
        in_progress: 0,
        completed: 0,
      };

      for (const row of (projectTasks[0] || [])) {
        if (row.status && row.status in stats) {
          stats[row.status] = Number(row.cnt) || 0;
        }
      }

      const total = stats.not_started + stats.in_progress + stats.completed;
      const progress = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

      message += `**${proj.projectName}**\n`;
      message += `├ ⬜ Не начато: ${stats.not_started}\n`;
      message += `├ 🔄 В работе: ${stats.in_progress}\n`;
      message += `├ ✅ Завершено: ${stats.completed}\n`;
      message += `└ 📈 Прогресс: ${progress}%\n\n`;
    }

    return { success: true, message };
  }

  /**
   * /blockers - Show blocking issues
   */
  private async handleBlockers(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    // Get user's tasks with dependencies (blockers)
    const blockedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, ctx.userId),
          or(
            eq(tasks.status, 'not_started'),
            eq(tasks.status, 'in_progress')
          )
        )
      )
      .limit(20);

    // Filter tasks that have unresolved dependencies
    const blockers: { task: TaskRecord; blockerIds: number[] }[] = [];

    for (const task of blockedTasks) {
      if (task.dependencies && Array.isArray(task.dependencies) && task.dependencies.length > 0) {
        // Check if any dependency is not completed
        const depIds = task.dependencies as number[];
        const deps = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.id, depIds[0]), // Check first dependency
              or(
                eq(tasks.status, 'not_started'),
                eq(tasks.status, 'in_progress')
              )
            )
          );

        if (deps.length > 0) {
          blockers.push({ task, blockerIds: depIds });
        }
      }
    }

    if (blockers.length === 0) {
      return {
        success: true,
        message: '✅ У вас нет заблокированных задач!',
      };
    }

    let message = '🚫 **Заблокированные задачи:**\n\n';

    for (const { task, blockerIds } of blockers) {
      message += `${formatTask(task)}\n`;
      message += `  └ Ждёт: ${blockerIds.map(id => `#${id}`).join(', ')}\n\n`;
    }

    return { success: true, message, data: blockers };
  }

  /**
   * /standup - Generate daily standup
   */
  private async handleStandup(cmd: ParsedCommand, ctx: CommandContext): Promise<CommandResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: '❌ База данных недоступна' };
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get tasks completed yesterday
    const completedYesterday = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, ctx.userId),
          eq(tasks.status, 'completed')
        )
      )
      .orderBy(desc(tasks.id))
      .limit(10);

    // Get tasks planned for today
    const plannedToday = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, ctx.userId),
          or(
            eq(tasks.status, 'not_started'),
            eq(tasks.status, 'in_progress')
          )
        )
      )
      .orderBy(tasks.priority, tasks.deadline)
      .limit(10);

    // Get blockers
    const allTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, ctx.userId),
          or(
            eq(tasks.status, 'not_started'),
            eq(tasks.status, 'in_progress')
          )
        )
      );

    const blockers: { title: string; reason?: string }[] = [];
    for (const task of allTasks) {
      if (task.dependencies && Array.isArray(task.dependencies) && task.dependencies.length > 0) {
        blockers.push({
          title: task.title,
          reason: `Ждёт задачи: ${(task.dependencies as number[]).map(id => `#${id}`).join(', ')}`,
        });
      }
    }

    // Generate standup using AI
    try {
      const standup = await taskAI.generateStandup(
        completedYesterday.slice(0, 5).map((t: TaskRecord) => ({ id: t.id, title: t.title })),
        plannedToday.slice(0, 5).map((t: TaskRecord) => ({ id: t.id, title: t.title, priority: t.priority || undefined })),
        blockers.slice(0, 3)
      );

      return { success: true, message: standup };
    } catch {
      // Fallback to simple format
      let message = `📋 **Daily Standup**\n\n`;

      message += `✅ **Вчера:**\n`;
      if (completedYesterday.length > 0) {
        message += completedYesterday.slice(0, 5).map((t: TaskRecord) => `• ${t.title} (#${t.id})`).join('\n');
      } else {
        message += '• Нет завершённых задач';
      }

      message += `\n\n📌 **Сегодня:**\n`;
      if (plannedToday.length > 0) {
        message += plannedToday.slice(0, 5).map((t: TaskRecord) => `• ${t.title} (#${t.id})`).join('\n');
      } else {
        message += '• Нет запланированных задач';
      }

      if (blockers.length > 0) {
        message += `\n\n⚠️ **Блокеры:**\n`;
        message += blockers.slice(0, 3).map((b: { title: string }) => `• ${b.title}`).join('\n');
      }

      return { success: true, message };
    }
  }

  /**
   * /help - Show available commands
   */
  private handleHelp(): CommandResult {
    const message = `📚 **Команды MYDON:**

📋 **Задачи:**
• \`/tasks\` - Мои задачи на сегодня
• \`/task 123\` - Детали задачи #123
• \`/done 123\` - Завершить задачу
• \`/add Название\` - Быстро создать задачу

⏰ **Напоминания:**
• \`/remind 123 2h\` - Напомнить через 2 часа
• \`/remind 123 30m\` - Напомнить через 30 минут

📊 **Отчёты:**
• \`/status\` - Статус проектов
• \`/blockers\` - Заблокированные задачи
• \`/standup\` - Сгенерировать standup

❓ \`/help\` - Эта справка`;

    return { success: true, message };
  }

  /**
   * Handle unknown command
   */
  private handleUnknown(cmd: ParsedCommand): CommandResult {
    return {
      success: false,
      message: `❓ Неизвестная команда. Введите \`/help\` для списка команд.`,
    };
  }
}

// Singleton instance
let handlerInstance: CommandHandler | null = null;

export function getCommandHandler(): CommandHandler {
  if (!handlerInstance) {
    handlerInstance = new CommandHandler();
  }
  return handlerInstance;
}
