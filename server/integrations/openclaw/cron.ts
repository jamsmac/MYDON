/**
 * OpenClaw Cron Job Management
 *
 * Schedules and manages recurring tasks via OpenClaw Gateway:
 * - Daily digest (9:00 AM)
 * - Deadline checks (every hour)
 * - Weekly reports (Monday 10:00 AM)
 * - Overdue alerts (6:00 PM daily)
 */

import { getDb } from '../../db';
import { openclawCronJobs, openclawPreferences, tasks, users, taskReminders } from '../../../drizzle/schema';
import { eq, and, lte, or, sql } from 'drizzle-orm';
import { getOpenClawClient } from './client';
import { logger } from '../../utils/logger';
import { getNotificationTriggers } from './triggers';
import { getNotificationService } from './notifications';
import type { InferSelectModel } from 'drizzle-orm';

type TaskRecord = InferSelectModel<typeof tasks>;

/**
 * Predefined cron jobs for MYDON
 */
export const MYDON_CRON_JOBS = {
  DAILY_DIGEST: {
    name: 'mydon-daily-digest',
    description: 'Утренняя сводка задач на день',
    schedule: '0 9 * * *', // 9:00 AM daily
    command: 'daily-digest',
  },
  DEADLINE_CHECK: {
    name: 'mydon-deadline-check',
    description: 'Проверка приближающихся дедлайнов',
    schedule: '0 * * * *', // Every hour
    command: 'deadline-check',
  },
  WEEKLY_REPORT: {
    name: 'mydon-weekly-report',
    description: 'Еженедельный отчёт по понедельникам',
    schedule: '0 10 * * 1', // Monday 10:00 AM
    command: 'weekly-report',
  },
  OVERDUE_ALERT: {
    name: 'mydon-overdue-alert',
    description: 'Вечерняя проверка просроченных задач',
    schedule: '0 18 * * *', // 6:00 PM daily
    command: 'overdue-alert',
  },
  STANDUP_REMINDER: {
    name: 'mydon-standup-reminder',
    description: 'Напоминание о стендапе в рабочие дни',
    schedule: '0 10 * * 1-5', // 10:00 AM Mon-Fri
    command: 'standup-reminder',
  },
  REMINDER_CHECK: {
    name: 'mydon-reminder-check',
    description: 'Проверка и отправка запланированных напоминаний',
    schedule: '* * * * *', // Every minute
    command: 'reminder-check',
  },
} as const;

/**
 * Cron job execution results
 */
export interface CronExecutionResult {
  job: string;
  success: boolean;
  processed: number;
  notified: number;
  errors: string[];
  duration: number;
}

/**
 * Cron Manager Class
 */
export class CronManager {
  private client = getOpenClawClient();
  private triggers = getNotificationTriggers();
  private notifications = getNotificationService();

  /**
   * Initialize all MYDON cron jobs in OpenClaw
   */
  async initializeJobs(): Promise<{ registered: number; failed: number }> {
    if (!this.client.isEnabled()) {
      logger.cron.info('[Cron] OpenClaw disabled, skipping cron initialization');
      return { registered: 0, failed: 0 };
    }

    const db = await getDb();
    if (!db) return { registered: 0, failed: 0 };

    let registered = 0;
    let failed = 0;

    const appUrl = process.env.VITE_APP_URL || 'http://localhost:3000';

    for (const [key, job] of Object.entries(MYDON_CRON_JOBS)) {
      try {
        // Check if job exists in database
        const [existing] = await db
          .select()
          .from(openclawCronJobs)
          .where(eq(openclawCronJobs.name, job.name))
          .limit(1);

        if (!existing) {
          // Register with OpenClaw
          const webhookUrl = `${appUrl}/api/cron/${job.command}`;
          const jobId = await this.client.addCronJob({
            name: job.name,
            schedule: job.schedule,
            command: `curl -X POST ${webhookUrl}`,
          });

          // Save to database
          await db.insert(openclawCronJobs).values({
            openclawJobId: jobId,
            name: job.name,
            description: job.description,
            schedule: job.schedule,
            command: job.command,
            enabled: true,
          });

          logger.cron.info(`[Cron] Registered job: ${job.name}`);
          registered++;
        }
      } catch (error) {
        logger.cron.error(`[Cron] Failed to register job ${job.name}:`, error as Error);
        failed++;
      }
    }

    return { registered, failed };
  }

  /**
   * Execute daily digest job
   */
  async executeDailyDigest(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    try {
      const result = await this.triggers.sendDailyDigests();
      processed = result.sent + result.failed;
      notified = result.sent;

      await this.logJobExecution('mydon-daily-digest', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-daily-digest', false, error.message);
    }

    return {
      job: 'daily-digest',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Execute deadline check job
   */
  async executeDeadlineCheck(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    try {
      const result = await this.triggers.checkDeadlines();
      processed = result.checked;
      notified = result.notified;

      await this.logJobExecution('mydon-deadline-check', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-deadline-check', false, error.message);
    }

    return {
      job: 'deadline-check',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Execute weekly report job
   */
  async executeWeeklyReport(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    const db = await getDb();
    if (!db) {
      return {
        job: 'weekly-report',
        success: false,
        processed: 0,
        notified: 0,
        errors: ['Database unavailable'],
        duration: Date.now() - start,
      };
    }

    try {
      // Get all users with enabled notifications
      const usersWithPrefs = await db
        .select({
          userId: openclawPreferences.userId,
          prefs: openclawPreferences,
        })
        .from(openclawPreferences)
        .where(eq(openclawPreferences.enabled, true));

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (const { userId, prefs } of usersWithPrefs) {
        processed++;

        try {
          // Get weekly stats for user
          const userTasks = await db
            .select()
            .from(tasks)
            .where(eq(tasks.assignedTo, userId));

          const completedThisWeek = userTasks.filter((t: TaskRecord) =>
            t.status === 'completed'
          ).length;

          const createdThisWeek = userTasks.filter((t: TaskRecord) =>
            t.createdAt && new Date(t.createdAt) >= weekAgo
          ).length;

          const total = userTasks.length;
          const progressPercent = total > 0
            ? Math.round((completedThisWeek / total) * 100)
            : 0;

          // Determine best day (simplified - just use current day)
          const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
          const bestDay = days[now.getDay()];

          const notifPrefs = {
            channels: (prefs.channels as Record<string, any>) || {},
            quietHours: prefs.quietHoursEnabled ? {
              enabled: true,
              start: prefs.quietHoursStart || '22:00',
              end: prefs.quietHoursEnd || '07:00',
              timezone: prefs.quietHoursTimezone || 'Europe/Moscow',
            } : undefined,
            preferences: (prefs.preferences as Record<string, any>) || {},
          };

          const result = await this.notifications.sendWeeklyReport(userId, notifPrefs, {
            completed: completedThisWeek,
            created: createdThisWeek,
            progressPercent,
            bestDay,
            totalHours: Math.round(completedThisWeek * 2), // Estimate 2h per task
          });

          if (result.success) notified++;
        } catch (error: any) {
          errors.push(`User ${userId}: ${error.message}`);
        }
      }

      await this.logJobExecution('mydon-weekly-report', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-weekly-report', false, error.message);
    }

    return {
      job: 'weekly-report',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Execute overdue alert job
   */
  async executeOverdueAlert(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    const db = await getDb();
    if (!db) {
      return {
        job: 'overdue-alert',
        success: false,
        processed: 0,
        notified: 0,
        errors: ['Database unavailable'],
        duration: Date.now() - start,
      };
    }

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find overdue tasks
      type OverdueTask = {
        taskId: number;
        taskTitle: string;
        deadline: Date | null;
        assignedTo: number | null;
      };

      const overdueTasks: OverdueTask[] = await db
        .select({
          taskId: tasks.id,
          taskTitle: tasks.title,
          deadline: tasks.deadline,
          assignedTo: tasks.assignedTo,
        })
        .from(tasks)
        .where(
          and(
            lte(tasks.deadline, today),
            or(
              eq(tasks.status, 'not_started'),
              eq(tasks.status, 'in_progress')
            )
          )
        );

      // Group by user
      const userTasks = new Map<number, OverdueTask[]>();
      for (const task of overdueTasks) {
        if (!task.assignedTo) continue;
        processed++;

        const existing = userTasks.get(task.assignedTo) || [];
        existing.push(task);
        userTasks.set(task.assignedTo, existing);
      }

      // Send alerts
      for (const [userId, userOverdue] of Array.from(userTasks.entries())) {
        const prefs = await this.getUserPrefs(userId);
        if (!prefs) continue;

        const message = `⚠️ **Просроченные задачи (${userOverdue.length}):**\n\n` +
          userOverdue.slice(0, 5).map(t =>
            `• ${t.taskTitle} (#${t.taskId})`
          ).join('\n') +
          (userOverdue.length > 5 ? `\n... и ещё ${userOverdue.length - 5}` : '');

        const result = await this.notifications.send({
          userId,
          type: 'deadline_urgent',
          data: { message },
          preferences: prefs,
        });

        if (result.success) notified++;
      }

      await this.logJobExecution('mydon-overdue-alert', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-overdue-alert', false, error.message);
    }

    return {
      job: 'overdue-alert',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Execute standup reminder job
   */
  async executeStandupReminder(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    const db = await getDb();
    if (!db) {
      return {
        job: 'standup-reminder',
        success: false,
        processed: 0,
        notified: 0,
        errors: ['Database unavailable'],
        duration: Date.now() - start,
      };
    }

    try {
      // Get all users with enabled notifications
      const usersWithPrefs = await db
        .select({
          userId: openclawPreferences.userId,
        })
        .from(openclawPreferences)
        .where(eq(openclawPreferences.enabled, true));

      for (const { userId } of usersWithPrefs) {
        processed++;

        const prefs = await this.getUserPrefs(userId);
        if (!prefs) continue;

        const result = await this.notifications.send({
          userId,
          type: 'task_assigned', // Reuse type for reminder
          data: {
            taskTitle: 'Время для стендапа! 📋',
            taskId: 0,
          },
          preferences: prefs,
        });

        if (result.success) notified++;
      }

      await this.logJobExecution('mydon-standup-reminder', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-standup-reminder', false, error.message);
    }

    return {
      job: 'standup-reminder',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Execute reminder check job - process pending task reminders
   */
  async executeReminderCheck(): Promise<CronExecutionResult> {
    const start = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let notified = 0;

    const db = await getDb();
    if (!db) {
      return {
        job: 'reminder-check',
        success: false,
        processed: 0,
        notified: 0,
        errors: ['Database unavailable'],
        duration: Date.now() - start,
      };
    }

    try {
      const now = new Date();

      // Get pending reminders that are due
      const dueReminders = await db
        .select({
          reminder: taskReminders,
          taskTitle: tasks.title,
          userName: users.name,
        })
        .from(taskReminders)
        .leftJoin(tasks, eq(taskReminders.taskId, tasks.id))
        .leftJoin(users, eq(taskReminders.userId, users.id))
        .where(
          and(
            eq(taskReminders.status, 'pending'),
            lte(taskReminders.remindAt, now)
          )
        )
        .limit(100); // Process in batches

      for (const { reminder, taskTitle, userName } of dueReminders) {
        processed++;

        try {
          const message = reminder.message || `⏰ Напоминание о задаче: ${taskTitle}`;

          // Get user preferences
          const prefs = await this.getUserPrefs(reminder.userId);

          if (prefs) {
            // Send notification
            const result = await this.notifications.send({
              userId: reminder.userId,
              type: 'deadline_reminder',
              data: {
                taskId: reminder.taskId,
                taskTitle: taskTitle || 'Задача',
                message,
              },
              preferences: prefs,
            });

            if (result.success) {
              notified++;
            }
          }

          // Mark reminder as sent
          await db
            .update(taskReminders)
            .set({
              status: 'sent',
              sentAt: now,
            })
            .where(eq(taskReminders.id, reminder.id));

        } catch (error: any) {
          errors.push(`Reminder ${reminder.id}: ${error.message}`);
          logger.cron.error(`Failed to process reminder ${reminder.id}:`, error);
        }
      }

      if (processed > 0) {
        logger.cron.info(`[Cron] Reminder check: processed ${processed}, sent ${notified}`);
      }

      await this.logJobExecution('mydon-reminder-check', true);
    } catch (error: any) {
      errors.push(error.message);
      await this.logJobExecution('mydon-reminder-check', false, error.message);
    }

    return {
      job: 'reminder-check',
      success: errors.length === 0,
      processed,
      notified,
      errors,
      duration: Date.now() - start,
    };
  }

  /**
   * Get user notification preferences
   */
  private async getUserPrefs(userId: number) {
    const db = await getDb();
    if (!db) return null;

    const [prefs] = await db
      .select()
      .from(openclawPreferences)
      .where(eq(openclawPreferences.userId, userId))
      .limit(1);

    if (!prefs || !prefs.enabled) return null;

    return {
      channels: (prefs.channels as Record<string, any>) || {},
      quietHours: prefs.quietHoursEnabled ? {
        enabled: true,
        start: prefs.quietHoursStart || '22:00',
        end: prefs.quietHoursEnd || '07:00',
        timezone: prefs.quietHoursTimezone || 'Europe/Moscow',
      } : undefined,
      preferences: (prefs.preferences as Record<string, any>) || {},
    };
  }

  /**
   * Log job execution to database
   */
  private async logJobExecution(
    jobName: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(openclawCronJobs)
      .set({
        lastRun: new Date(),
        lastStatus: success ? 'success' : 'failed',
        lastError: error || null,
        runCount: sql`${openclawCronJobs.runCount} + 1`,
      })
      .where(eq(openclawCronJobs.name, jobName));
  }

  /**
   * Get job status
   */
  async getJobStatus(jobName: string) {
    const db = await getDb();
    if (!db) return null;

    const [job] = await db
      .select()
      .from(openclawCronJobs)
      .where(eq(openclawCronJobs.name, jobName))
      .limit(1);

    return job;
  }

  /**
   * Enable/disable job
   */
  async setJobEnabled(jobName: string, enabled: boolean): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const [job] = await db
      .select()
      .from(openclawCronJobs)
      .where(eq(openclawCronJobs.name, jobName))
      .limit(1);

    if (!job) return false;

    // Update in OpenClaw
    if (job.openclawJobId) {
      await this.client.setCronJobEnabled(job.openclawJobId, enabled);
    }

    // Update in database
    await db
      .update(openclawCronJobs)
      .set({ enabled })
      .where(eq(openclawCronJobs.name, jobName));

    return true;
  }
}

// Singleton instance
let cronManagerInstance: CronManager | null = null;

export function getCronManager(): CronManager {
  if (!cronManagerInstance) {
    cronManagerInstance = new CronManager();
  }
  return cronManagerInstance;
}
