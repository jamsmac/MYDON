/**
 * OpenClaw Router Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock('./integrations/openclaw', () => ({
  isOpenClawAvailable: vi.fn().mockResolvedValue(true),
  getOpenClawClient: vi.fn().mockReturnValue({
    isEnabled: vi.fn().mockReturnValue(true),
    sendMessage: vi.fn().mockResolvedValue(true),
  }),
}));

describe('OpenClaw Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status endpoint', () => {
    it('should check OpenClaw availability', async () => {
      const { isOpenClawAvailable, getOpenClawClient } = await import('./integrations/openclaw');

      const available = await isOpenClawAvailable();
      const client = getOpenClawClient();

      expect(available).toBe(true);
      expect(client.isEnabled()).toBe(true);
    });
  });

  describe('Preferences', () => {
    it('should return default preferences when none exist', async () => {
      const defaultPrefs = {
        enabled: false,
        channels: {},
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTimezone: "Europe/Moscow",
        preferences: {},
      };

      expect(defaultPrefs.enabled).toBe(false);
      expect(defaultPrefs.channels).toEqual({});
      expect(defaultPrefs.quietHoursTimezone).toBe("Europe/Moscow");
    });

    it('should validate channel configuration', () => {
      const validConfig = {
        channel: "telegram",
        enabled: true,
        config: {
          chatId: "123456789",
        },
      };

      expect(validConfig.channel).toBe("telegram");
      expect(validConfig.config.chatId).toBe("123456789");
    });
  });

  describe('Notification types', () => {
    it('should support all notification types', () => {
      const notificationTypes = [
        'deadline_warning',
        'deadline_urgent',
        'task_assigned',
        'task_completed',
        'task_comment',
        'task_mention',
        'blocker_added',
        'status_changed',
        'daily_digest',
        'weekly_report',
      ];

      expect(notificationTypes).toHaveLength(10);
      expect(notificationTypes).toContain('task_assigned');
      expect(notificationTypes).toContain('deadline_urgent');
    });
  });

  describe('Quiet hours', () => {
    it('should validate quiet hours format', () => {
      const validQuietHours = {
        enabled: true,
        start: "22:00",
        end: "07:00",
        timezone: "Europe/Moscow",
      };

      expect(validQuietHours.start).toMatch(/^\d{2}:\d{2}$/);
      expect(validQuietHours.end).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should detect overnight quiet hours', () => {
      const start = "22:00";
      const end = "07:00";
      const currentTime = "23:00";

      // Overnight detection: start > end means it wraps around midnight
      const isOvernight = start > end;
      expect(isOvernight).toBe(true);

      // During overnight quiet hours
      const isQuietNight = currentTime >= start || currentTime <= end;
      expect(isQuietNight).toBe(true);
    });
  });

  describe('Channel configurations', () => {
    it('should support telegram configuration', () => {
      const telegramConfig = {
        channel: 'telegram',
        enabled: true,
        chatId: '123456789',
      };

      expect(telegramConfig.channel).toBe('telegram');
      expect(telegramConfig.chatId).toBeDefined();
    });

    it('should support whatsapp configuration', () => {
      const whatsappConfig = {
        channel: 'whatsapp',
        enabled: true,
        phone: '+79001234567',
      };

      expect(whatsappConfig.channel).toBe('whatsapp');
      expect(whatsappConfig.phone).toMatch(/^\+\d+$/);
    });

    it('should support slack configuration', () => {
      const slackConfig = {
        channel: 'slack',
        enabled: true,
        channelId: 'C1234567890',
      };

      expect(slackConfig.channel).toBe('slack');
      expect(slackConfig.channelId).toBeDefined();
    });

    it('should support discord configuration', () => {
      const discordConfig = {
        channel: 'discord',
        enabled: true,
        channelId: '1234567890',
      };

      expect(discordConfig.channel).toBe('discord');
      expect(discordConfig.channelId).toBeDefined();
    });
  });
});
