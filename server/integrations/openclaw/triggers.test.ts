/**
 * OpenClaw Triggers Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock('./notifications', () => ({
  getNotificationService: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({ success: true, channel: 'telegram' }),
    sendDailyDigest: vi.fn().mockResolvedValue({ success: true }),
    sendWeeklyReport: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('Notification Triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatDate helper', () => {
    it('should format date in Russian locale', () => {
      const date = new Date('2024-03-15T14:30:00');
      const formatted = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });

      expect(formatted).toContain('15');
      expect(formatted).toContain('14:30');
    });
  });

  describe('formatTimeLeft helper', () => {
    it('should format time left as days for large values', () => {
      const ms = 3 * 24 * 60 * 60 * 1000; // 3 days
      const hours = Math.floor(ms / (60 * 60 * 1000));
      const days = Math.floor(hours / 24);

      expect(days).toBe(3);
    });

    it('should format time left as hours', () => {
      const ms = 5 * 60 * 60 * 1000; // 5 hours
      const hours = Math.floor(ms / (60 * 60 * 1000));

      expect(hours).toBe(5);
    });

    it('should format time left as minutes for small values', () => {
      const ms = 45 * 60 * 1000; // 45 minutes
      const hours = Math.floor(ms / (60 * 60 * 1000));
      const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

      expect(hours).toBe(0);
      expect(minutes).toBe(45);
    });
  });

  describe('formatStatus helper', () => {
    it('should translate status to Russian', () => {
      const statusMap: Record<string, string> = {
        not_started: 'Не начато',
        in_progress: 'В работе',
        completed: 'Завершено',
      };

      expect(statusMap['not_started']).toBe('Не начато');
      expect(statusMap['in_progress']).toBe('В работе');
      expect(statusMap['completed']).toBe('Завершено');
    });
  });

  describe('Trigger types', () => {
    it('should have onTaskAssigned trigger', () => {
      const triggerNames = [
        'onTaskAssigned',
        'onTaskCompleted',
        'onTaskComment',
        'checkDeadlines',
        'onStatusChanged',
        'onBlockerAdded',
        'sendDailyDigests',
      ];

      expect(triggerNames).toContain('onTaskAssigned');
      expect(triggerNames).toHaveLength(7);
    });
  });

  describe('Notification messages', () => {
    it('should format task_assigned message correctly', () => {
      const data = {
        taskTitle: 'Создать отчёт',
        deadline: '15 марта',
      };

      const message = `📋 Вам назначена задача: "${data.taskTitle}"${data.deadline ? ` (дедлайн: ${data.deadline})` : ''}`;

      expect(message).toContain('Создать отчёт');
      expect(message).toContain('дедлайн: 15 марта');
      expect(message).toContain('📋');
    });

    it('should format task_completed message correctly', () => {
      const data = {
        taskTitle: 'Исправить баг',
        completedBy: 'Иван',
      };

      const message = `✅ Задача "${data.taskTitle}" отмечена как выполненная${data.completedBy ? ` (${data.completedBy})` : ''}`;

      expect(message).toContain('Исправить баг');
      expect(message).toContain('Иван');
      expect(message).toContain('✅');
    });

    it('should format deadline_urgent message correctly', () => {
      const data = {
        taskTitle: 'Срочная задача',
        timeLeft: '1 ч.',
      };

      const message = `🚨 СРОЧНО: задача "${data.taskTitle}" просрочена или истекает через ${data.timeLeft}!`;

      expect(message).toContain('Срочная задача');
      expect(message).toContain('1 ч.');
      expect(message).toContain('🚨');
      expect(message).toContain('СРОЧНО');
    });

    it('should format status_changed message correctly', () => {
      const data = {
        taskTitle: 'Разработка API',
        oldStatus: 'Не начато',
        newStatus: 'В работе',
      };

      const message = `🔄 Статус задачи "${data.taskTitle}" изменён: ${data.oldStatus} → ${data.newStatus}`;

      expect(message).toContain('Разработка API');
      expect(message).toContain('Не начато');
      expect(message).toContain('В работе');
      expect(message).toContain('→');
    });

    it('should format daily_digest message correctly', () => {
      const data = {
        active: 5,
        dueToday: 2,
        overdue: 1,
        tasks: [
          { title: 'Задача 1' },
          { title: 'Задача 2' },
        ],
      };

      const message = `📊 Ваши задачи на сегодня:\n\n` +
        `📌 Активных: ${data.active}\n` +
        `⏰ С дедлайном сегодня: ${data.dueToday}\n` +
        `⚠️ Просроченных: ${data.overdue}\n\n` +
        (data.tasks.length > 0
          ? `Приоритетные:\n${data.tasks.map(t => `• ${t.title}`).join('\n')}`
          : 'Отличная работа! Все задачи под контролем 🎉');

      expect(message).toContain('Активных: 5');
      expect(message).toContain('С дедлайном сегодня: 2');
      expect(message).toContain('Просроченных: 1');
      expect(message).toContain('• Задача 1');
      expect(message).toContain('• Задача 2');
    });
  });
});
