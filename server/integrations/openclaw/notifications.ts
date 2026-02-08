/**
 * OpenClaw Notification Service
 *
 * Sends notifications to users via their preferred channels
 */

import { getOpenClawClient } from './client';
import { logger } from '../../utils/logger';
import type {
  OpenClawChannel,
  NotificationType,
  NotificationPreferences,
} from './types';

// Default notification templates (Russian)
const NOTIFICATION_TEMPLATES: Record<NotificationType, (data: any) => string> = {
  deadline_warning: (data) =>
    `⏰ Напоминание: задача "${data.taskTitle}" должна быть завершена через ${data.timeLeft}`,

  deadline_urgent: (data) =>
    `🚨 СРОЧНО: задача "${data.taskTitle}" просрочена или истекает через ${data.timeLeft}!`,

  deadline_reminder: (data) =>
    data.message || `⏰ Напоминание о задаче "${data.taskTitle}"`,

  task_assigned: (data) =>
    `📋 Вам назначена задача: "${data.taskTitle}"${data.deadline ? ` (дедлайн: ${data.deadline})` : ''}`,

  task_completed: (data) =>
    `✅ Задача "${data.taskTitle}" отмечена как выполненная${data.completedBy ? ` (${data.completedBy})` : ''}`,

  task_comment: (data) =>
    `💬 Новый комментарий к задаче "${data.taskTitle}" от ${data.author}`,

  task_mention: (data) =>
    `👋 ${data.author} упомянул вас в задаче "${data.taskTitle}"`,

  blocker_added: (data) =>
    `🚫 Добавлен блокер для задачи "${data.taskTitle}": ${data.blockerTitle}`,

  status_changed: (data) =>
    `🔄 Статус задачи "${data.taskTitle}" изменён: ${data.oldStatus} → ${data.newStatus}`,

  daily_digest: (data) =>
    `📊 Ваши задачи на сегодня:\n\n` +
    `📌 Активных: ${data.active}\n` +
    `⏰ С дедлайном сегодня: ${data.dueToday}\n` +
    `⚠️ Просроченных: ${data.overdue}\n\n` +
    (data.tasks?.length > 0
      ? `Приоритетные:\n${data.tasks.map((t: any) => `• ${t.title}`).join('\n')}`
      : 'Отличная работа! Все задачи под контролем 🎉'),

  weekly_report: (data) =>
    `📈 Еженедельный отчёт:\n\n` +
    `✅ Выполнено: ${data.completed}\n` +
    `🆕 Создано: ${data.created}\n` +
    `📊 Прогресс: ${data.progressPercent}%\n\n` +
    `Лучший день: ${data.bestDay}\n` +
    `Всего часов: ${data.totalHours}`,
};

// Priority mapping for channels
const PRIORITY_CHANNELS: Record<NotificationType, OpenClawChannel[]> = {
  deadline_urgent: ['whatsapp', 'telegram'],
  deadline_warning: ['telegram', 'whatsapp'],
  deadline_reminder: ['telegram', 'whatsapp'],
  task_assigned: ['telegram', 'slack'],
  task_completed: ['slack', 'discord'],
  task_comment: ['telegram', 'slack'],
  task_mention: ['whatsapp', 'telegram'],
  blocker_added: ['whatsapp', 'telegram'],
  status_changed: ['slack', 'discord'],
  daily_digest: ['telegram', 'whatsapp'],
  weekly_report: ['telegram', 'slack'],
};

interface SendNotificationOptions {
  userId: number;
  type: NotificationType;
  data: Record<string, any>;
  preferences?: NotificationPreferences;
  forceChannel?: OpenClawChannel;
}

interface NotificationResult {
  success: boolean;
  channel?: OpenClawChannel;
  error?: string;
}

/**
 * OpenClaw Notification Service
 */
export class NotificationService {
  private client = getOpenClawClient();

  /**
   * Send notification to user
   */
  async send(options: SendNotificationOptions): Promise<NotificationResult> {
    const { userId, type, data, preferences, forceChannel } = options;

    // Check if OpenClaw is enabled
    if (!this.client.isEnabled()) {
      logger.notifications.info(`[Notifications] OpenClaw disabled, skipping notification for user ${userId}`);
      return { success: false, error: 'OpenClaw disabled' };
    }

    // Get message from template
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      return { success: false, error: `Unknown notification type: ${type}` };
    }
    const message = template(data);

    // Determine channel and target
    let channel: OpenClawChannel | undefined;
    let target: string | undefined;

    if (forceChannel && preferences?.channels[forceChannel]?.enabled) {
      channel = forceChannel;
      target = this.getTargetFromPreferences(preferences, forceChannel);
    } else if (preferences) {
      // Check user preferences for this notification type
      const typePrefs = preferences.preferences[type];
      if (typePrefs?.enabled === false) {
        return { success: false, error: 'Notification type disabled by user' };
      }

      // Check quiet hours
      if (this.isQuietHours(preferences)) {
        // Only allow urgent notifications during quiet hours
        if (type !== 'deadline_urgent' && type !== 'blocker_added') {
          return { success: false, error: 'Quiet hours active' };
        }
      }

      // Find first available channel
      const preferredChannels = typePrefs?.channels || PRIORITY_CHANNELS[type];
      for (const ch of preferredChannels) {
        const channelConfig = preferences.channels[ch];
        if (channelConfig?.enabled) {
          channel = ch;
          target = this.getTargetFromPreferences(preferences, ch);
          break;
        }
      }
    } else {
      // No preferences, try default channels
      for (const ch of PRIORITY_CHANNELS[type]) {
        channel = ch;
        break;
      }
    }

    if (!channel || !target) {
      return { success: false, error: 'No available channel configured' };
    }

    // Send notification
    const success = await this.client.sendMessage({
      channel,
      target,
      message,
    });

    if (success) {
      logger.notifications.info(`[Notifications] Sent ${type} to user ${userId} via ${channel}`);
      return { success: true, channel };
    } else {
      return { success: false, channel, error: 'Failed to send message' };
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulk(
    userPreferences: Map<number, NotificationPreferences>,
    type: NotificationType,
    data: Record<string, any>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    const entries = Array.from(userPreferences.entries());
    for (const [userId, preferences] of entries) {
      const result = await this.send({ userId, type, data, preferences });
      if (result.success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  /**
   * Send daily digest to user
   */
  async sendDailyDigest(
    userId: number,
    preferences: NotificationPreferences,
    stats: {
      active: number;
      dueToday: number;
      overdue: number;
      tasks: { title: string; priority: string }[];
    }
  ): Promise<NotificationResult> {
    return this.send({
      userId,
      type: 'daily_digest',
      data: stats,
      preferences,
    });
  }

  /**
   * Send weekly report to user
   */
  async sendWeeklyReport(
    userId: number,
    preferences: NotificationPreferences,
    stats: {
      completed: number;
      created: number;
      progressPercent: number;
      bestDay: string;
      totalHours: number;
    }
  ): Promise<NotificationResult> {
    return this.send({
      userId,
      type: 'weekly_report',
      data: stats,
      preferences,
    });
  }

  /**
   * Get target (phone, chat id, etc.) from preferences
   */
  private getTargetFromPreferences(
    preferences: NotificationPreferences,
    channel: OpenClawChannel
  ): string | undefined {
    const config = preferences.channels[channel];
    if (!config) return undefined;

    switch (channel) {
      case 'telegram':
        return (config as any).chatId;
      case 'whatsapp':
        return (config as any).phone;
      case 'discord':
      case 'slack':
        return (config as any).channelId;
      default:
        return undefined;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    const quietHours = preferences.quietHours;
    if (!quietHours?.enabled) return false;

    try {
      const now = new Date();
      // Simple check - compare HH:mm strings
      const currentTime = now.toTimeString().slice(0, 5);
      const { start, end } = quietHours;

      if (start <= end) {
        // Same day (e.g., 22:00 - 23:00)
        return currentTime >= start && currentTime <= end;
      } else {
        // Overnight (e.g., 22:00 - 07:00)
        return currentTime >= start || currentTime <= end;
      }
    } catch {
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: NotificationService | null = null;

/**
 * Get notification service instance
 */
export function getNotificationService(): NotificationService {
  if (!serviceInstance) {
    serviceInstance = new NotificationService();
  }
  return serviceInstance;
}
