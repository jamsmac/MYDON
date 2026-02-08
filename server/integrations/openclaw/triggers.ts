/**
 * OpenClaw Notification Triggers
 *
 * Hooks into MYDON events to send notifications via OpenClaw
 */

import { getDb } from '../../db';
import { openclawPreferences, openclawNotifications, tasks, users } from '../../../drizzle/schema';
import { eq, and, lte, or } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { getNotificationService } from './notifications';
import type { NotificationType, NotificationPreferences } from './types';

// Type for task records
type TaskRecord = InferSelectModel<typeof tasks>;

/**
 * Convert DB preferences to NotificationPreferences type
 */
function toNotificationPreferences(dbPrefs: any): NotificationPreferences | null {
  if (!dbPrefs || !dbPrefs.enabled) return null;

  return {
    channels: dbPrefs.channels || {},
    quietHours: dbPrefs.quietHoursEnabled ? {
      enabled: true,
      start: dbPrefs.quietHoursStart || '22:00',
      end: dbPrefs.quietHoursEnd || '07:00',
      timezone: dbPrefs.quietHoursTimezone || 'Europe/Moscow',
    } : undefined,
    preferences: dbPrefs.preferences || {},
  };
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPrefs(userId: number): Promise<NotificationPreferences | null> {
  const db = await getDb();
  if (!db) return null;

  const [prefs] = await db
    .select()
    .from(openclawPreferences)
    .where(eq(openclawPreferences.userId, userId))
    .limit(1);

  return toNotificationPreferences(prefs);
}

/**
 * Log notification to database
 */
async function logNotification(
  userId: number,
  type: NotificationType,
  channel: string | undefined,
  target: string | undefined,
  message: string,
  status: 'sent' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(openclawNotifications).values({
    userId,
    type,
    channel: channel || 'unknown',
    target,
    message,
    status,
    errorMessage: error,
    sentAt: status === 'sent' ? new Date() : undefined,
  });
}

/**
 * Notification Triggers Class
 */
export class NotificationTriggers {
  private notificationService = getNotificationService();

  /**
   * Trigger: Task assigned to user
   */
  async onTaskAssigned(
    taskId: number,
    taskTitle: string,
    assignedToUserId: number,
    deadline?: Date | null
  ): Promise<void> {
    const prefs = await getUserNotificationPrefs(assignedToUserId);
    if (!prefs) return;

    const result = await this.notificationService.send({
      userId: assignedToUserId,
      type: 'task_assigned',
      data: {
        taskId,
        taskTitle,
        deadline: deadline ? formatDate(deadline) : null,
      },
      preferences: prefs,
    });

    await logNotification(
      assignedToUserId,
      'task_assigned',
      result.channel,
      undefined,
      `Назначена задача: ${taskTitle}`,
      result.success ? 'sent' : 'failed',
      result.error
    );
  }

  /**
   * Trigger: Task completed
   */
  async onTaskCompleted(
    taskId: number,
    taskTitle: string,
    completedByUserId: number,
    completedByName: string,
    notifyUserIds: number[]
  ): Promise<void> {
    for (const userId of notifyUserIds) {
      if (userId === completedByUserId) continue; // Don't notify the completer

      const prefs = await getUserNotificationPrefs(userId);
      if (!prefs) continue;

      const result = await this.notificationService.send({
        userId,
        type: 'task_completed',
        data: {
          taskId,
          taskTitle,
          completedBy: completedByName,
        },
        preferences: prefs,
      });

      await logNotification(
        userId,
        'task_completed',
        result.channel,
        undefined,
        `Задача завершена: ${taskTitle}`,
        result.success ? 'sent' : 'failed',
        result.error
      );
    }
  }

  /**
   * Trigger: Comment added to task
   */
  async onTaskComment(
    taskId: number,
    taskTitle: string,
    authorName: string,
    authorUserId: number,
    mentionedUserIds: number[],
    taskAssigneeId?: number
  ): Promise<void> {
    // Notify mentioned users first (higher priority)
    for (const userId of mentionedUserIds) {
      if (userId === authorUserId) continue;

      const prefs = await getUserNotificationPrefs(userId);
      if (!prefs) continue;

      await this.notificationService.send({
        userId,
        type: 'task_mention',
        data: { taskId, taskTitle, author: authorName },
        preferences: prefs,
      });
    }

    // Notify task assignee (if not mentioned and not the author)
    if (
      taskAssigneeId &&
      taskAssigneeId !== authorUserId &&
      !mentionedUserIds.includes(taskAssigneeId)
    ) {
      const prefs = await getUserNotificationPrefs(taskAssigneeId);
      if (prefs) {
        await this.notificationService.send({
          userId: taskAssigneeId,
          type: 'task_comment',
          data: { taskId, taskTitle, author: authorName },
          preferences: prefs,
        });
      }
    }
  }

  /**
   * Trigger: Deadline approaching (called by cron)
   */
  async checkDeadlines(): Promise<{ checked: number; notified: number }> {
    const db = await getDb();
    if (!db) return { checked: 0, notified: 0 };

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);

    // Find tasks with upcoming deadlines
    const upcomingTasks = await db
      .select({
        taskId: tasks.id,
        taskTitle: tasks.title,
        deadline: tasks.deadline,
        assignedTo: tasks.assignedTo,
      })
      .from(tasks)
      .where(
        and(
          lte(tasks.deadline, in24Hours),
          or(
            eq(tasks.status, 'not_started'),
            eq(tasks.status, 'in_progress')
          )
        )
      );

    let notified = 0;

    for (const task of upcomingTasks) {
      if (!task.assignedTo || !task.deadline) continue;

      const prefs = await getUserNotificationPrefs(task.assignedTo);
      if (!prefs) continue;

      const deadlineTime = new Date(task.deadline).getTime();
      const isUrgent = deadlineTime <= in1Hour.getTime();
      const timeLeft = formatTimeLeft(deadlineTime - now.getTime());

      const result = await this.notificationService.send({
        userId: task.assignedTo,
        type: isUrgent ? 'deadline_urgent' : 'deadline_warning',
        data: {
          taskId: task.taskId,
          taskTitle: task.taskTitle,
          timeLeft,
        },
        preferences: prefs,
      });

      if (result.success) notified++;
    }

    return { checked: upcomingTasks.length, notified };
  }

  /**
   * Trigger: Task status changed
   */
  async onStatusChanged(
    taskId: number,
    taskTitle: string,
    oldStatus: string,
    newStatus: string,
    changedByUserId: number,
    notifyUserIds: number[]
  ): Promise<void> {
    for (const userId of notifyUserIds) {
      if (userId === changedByUserId) continue;

      const prefs = await getUserNotificationPrefs(userId);
      if (!prefs) continue;

      await this.notificationService.send({
        userId,
        type: 'status_changed',
        data: {
          taskId,
          taskTitle,
          oldStatus: formatStatus(oldStatus),
          newStatus: formatStatus(newStatus),
        },
        preferences: prefs,
      });
    }
  }

  /**
   * Trigger: Blocker added
   */
  async onBlockerAdded(
    taskId: number,
    taskTitle: string,
    blockerTitle: string,
    taskAssigneeId?: number
  ): Promise<void> {
    if (!taskAssigneeId) return;

    const prefs = await getUserNotificationPrefs(taskAssigneeId);
    if (!prefs) return;

    await this.notificationService.send({
      userId: taskAssigneeId,
      type: 'blocker_added',
      data: { taskId, taskTitle, blockerTitle },
      preferences: prefs,
    });
  }

  /**
   * Send daily digest to all users with enabled notifications
   */
  async sendDailyDigests(): Promise<{ sent: number; failed: number }> {
    const db = await getDb();
    if (!db) return { sent: 0, failed: 0 };

    // Get all users with enabled OpenClaw preferences
    const usersWithPrefs = await db
      .select({
        userId: openclawPreferences.userId,
        prefs: openclawPreferences,
      })
      .from(openclawPreferences)
      .where(eq(openclawPreferences.enabled, true));

    let sent = 0;
    let failed = 0;

    for (const { userId, prefs } of usersWithPrefs) {
      const notifPrefs = toNotificationPreferences(prefs);
      if (!notifPrefs) continue;

      // Get user's task stats
      const userTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.assignedTo, userId));

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const stats = {
        active: userTasks.filter((t: TaskRecord) => t.status !== 'completed').length,
        dueToday: userTasks.filter((t: TaskRecord) => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline);
          return d >= today && d < tomorrow;
        }).length,
        overdue: userTasks.filter((t: TaskRecord) => {
          if (!t.deadline || t.status === 'completed') return false;
          return new Date(t.deadline) < today;
        }).length,
        tasks: userTasks
          .filter((t: TaskRecord) => t.status !== 'completed')
          .slice(0, 5)
          .map((t: TaskRecord) => ({ title: t.title, priority: t.priority })),
      };

      const result = await this.notificationService.sendDailyDigest(
        userId,
        notifPrefs,
        stats
      );

      if (result.success) sent++;
      else failed++;
    }

    return { sent, failed };
  }
}

// Helper functions
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeLeft(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} дн.`;
  }
  if (hours > 0) {
    return `${hours} ч.`;
  }
  return `${minutes} мин.`;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    not_started: 'Не начато',
    in_progress: 'В работе',
    completed: 'Завершено',
  };
  return map[status] || status;
}

// Singleton instance
let triggersInstance: NotificationTriggers | null = null;

export function getNotificationTriggers(): NotificationTriggers {
  if (!triggersInstance) {
    triggersInstance = new NotificationTriggers();
  }
  return triggersInstance;
}
