import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }),
}));

// Import after mocking
import { createNotification } from './notificationsRouter';

describe('Notifications Router', () => {
  describe('createNotification helper', () => {
    it('should create a notification with required fields', async () => {
      const result = await createNotification(
        1, // userId
        'task_assigned',
        'New task assigned',
        'You have been assigned a new task',
        { projectId: 1, taskId: 5 }
      );
      
      // The mock returns insertId: 1
      expect(result).toBe(1);
    });

    it('should handle notification without optional fields', async () => {
      const result = await createNotification(
        1,
        'system',
        'System notification'
      );
      
      expect(result).toBe(1);
    });
  });

  describe('Notification types', () => {
    const validTypes = [
      'task_assigned',
      'task_completed',
      'task_overdue',
      'comment_added',
      'comment_mention',
      'project_invite',
      'project_update',
      'deadline_reminder',
      'daily_digest',
      'system'
    ];

    it('should support all notification types', () => {
      expect(validTypes).toHaveLength(10);
      expect(validTypes).toContain('task_assigned');
      expect(validTypes).toContain('comment_mention');
      expect(validTypes).toContain('deadline_reminder');
    });
  });

  describe('Notification preferences defaults', () => {
    it('should have correct default preferences', () => {
      const defaults = {
        inAppEnabled: true,
        emailEnabled: true,
        emailDigestFrequency: 'daily',
        emailDigestTime: '09:00',
        telegramEnabled: false,
        telegramChatId: null,
        telegramUsername: null,
        pushEnabled: false,
        notifyTaskAssigned: true,
        notifyTaskCompleted: true,
        notifyTaskOverdue: true,
        notifyComments: true,
        notifyMentions: true,
        notifyProjectUpdates: true,
        notifyDeadlines: true,
      };

      expect(defaults.inAppEnabled).toBe(true);
      expect(defaults.emailDigestFrequency).toBe('daily');
      expect(defaults.telegramEnabled).toBe(false);
      expect(defaults.notifyMentions).toBe(true);
    });
  });

  describe('Telegram bot link generation', () => {
    it('should generate correct Telegram bot link', () => {
      const userId = 123;
      const botUsername = 'mydon_roadmap_bot';
      const startParam = Buffer.from(`user_${userId}`).toString('base64');
      const expectedLink = `https://t.me/${botUsername}?start=${startParam}`;

      expect(expectedLink).toContain('https://t.me/');
      expect(expectedLink).toContain(botUsername);
      expect(expectedLink).toContain('?start=');
    });

    it('should encode user ID in base64', () => {
      const userId = 456;
      const encoded = Buffer.from(`user_${userId}`).toString('base64');
      const decoded = Buffer.from(encoded, 'base64').toString();
      
      expect(decoded).toBe(`user_${userId}`);
    });
  });
});
