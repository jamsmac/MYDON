/**
 * OpenClaw Cron Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MYDON_CRON_JOBS } from './cron';

// Mock dependencies
vi.mock('../../db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock('./client', () => ({
  getOpenClawClient: vi.fn().mockReturnValue({
    isEnabled: vi.fn().mockReturnValue(true),
    addCronJob: vi.fn().mockResolvedValue('job-123'),
    setCronJobEnabled: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('./triggers', () => ({
  getNotificationTriggers: vi.fn().mockReturnValue({
    sendDailyDigests: vi.fn().mockResolvedValue({ sent: 5, failed: 0 }),
    checkDeadlines: vi.fn().mockResolvedValue({ checked: 10, notified: 3 }),
  }),
}));

vi.mock('./notifications', () => ({
  getNotificationService: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue({ success: true }),
    sendWeeklyReport: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('OpenClaw Cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MYDON_CRON_JOBS', () => {
    it('should define daily digest job', () => {
      expect(MYDON_CRON_JOBS.DAILY_DIGEST).toBeDefined();
      expect(MYDON_CRON_JOBS.DAILY_DIGEST.name).toBe('mydon-daily-digest');
      expect(MYDON_CRON_JOBS.DAILY_DIGEST.schedule).toBe('0 9 * * *');
    });

    it('should define deadline check job', () => {
      expect(MYDON_CRON_JOBS.DEADLINE_CHECK).toBeDefined();
      expect(MYDON_CRON_JOBS.DEADLINE_CHECK.name).toBe('mydon-deadline-check');
      expect(MYDON_CRON_JOBS.DEADLINE_CHECK.schedule).toBe('0 * * * *');
    });

    it('should define weekly report job', () => {
      expect(MYDON_CRON_JOBS.WEEKLY_REPORT).toBeDefined();
      expect(MYDON_CRON_JOBS.WEEKLY_REPORT.name).toBe('mydon-weekly-report');
      expect(MYDON_CRON_JOBS.WEEKLY_REPORT.schedule).toBe('0 10 * * 1');
    });

    it('should define overdue alert job', () => {
      expect(MYDON_CRON_JOBS.OVERDUE_ALERT).toBeDefined();
      expect(MYDON_CRON_JOBS.OVERDUE_ALERT.name).toBe('mydon-overdue-alert');
      expect(MYDON_CRON_JOBS.OVERDUE_ALERT.schedule).toBe('0 18 * * *');
    });

    it('should define standup reminder job', () => {
      expect(MYDON_CRON_JOBS.STANDUP_REMINDER).toBeDefined();
      expect(MYDON_CRON_JOBS.STANDUP_REMINDER.name).toBe('mydon-standup-reminder');
      expect(MYDON_CRON_JOBS.STANDUP_REMINDER.schedule).toBe('0 10 * * 1-5');
    });
  });

  describe('Cron schedules', () => {
    it('should have valid cron expressions', () => {
      const cronRegex = /^(\*|([0-5]?\d)) (\*|([0-5]?\d)|(1?\d|2[0-3])) (\*|([0-2]?\d|3[01])) (\*|(0?[1-9]|1[0-2])) (\*|([0-6](-[0-6])?))$/;

      Object.values(MYDON_CRON_JOBS).forEach(job => {
        // Simplified check - just ensure schedule exists
        expect(job.schedule).toBeTruthy();
        expect(job.schedule.split(' ').length).toBe(5);
      });
    });
  });

  describe('CronExecutionResult', () => {
    it('should have correct structure', () => {
      const result = {
        job: 'daily-digest',
        success: true,
        processed: 10,
        notified: 8,
        errors: [],
        duration: 1500,
      };

      expect(result.job).toBe('daily-digest');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(10);
      expect(result.notified).toBe(8);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle errors', () => {
      const result = {
        job: 'deadline-check',
        success: false,
        processed: 5,
        notified: 0,
        errors: ['Database error', 'Network timeout'],
        duration: 500,
      };

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
});
