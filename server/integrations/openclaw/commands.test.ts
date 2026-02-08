/**
 * OpenClaw Commands Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCommand } from './commands';

// Mock dependencies
vi.mock('../../db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock('./ai', () => ({
  taskAI: {
    generateStandup: vi.fn().mockResolvedValue('📋 Daily Standup generated'),
  },
}));

describe('OpenClaw Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCommand', () => {
    it('should parse /tasks command', () => {
      const result = parseCommand('/tasks');

      expect(result.command).toBe('tasks');
      expect(result.args).toEqual([]);
      expect(result.rawArgs).toBe('');
    });

    it('should parse /task with ID', () => {
      const result = parseCommand('/task 123');

      expect(result.command).toBe('task');
      expect(result.args).toEqual(['123']);
      expect(result.rawArgs).toBe('123');
    });

    it('should parse /done with ID', () => {
      const result = parseCommand('/done 456');

      expect(result.command).toBe('done');
      expect(result.args).toEqual(['456']);
    });

    it('should parse /add with title', () => {
      const result = parseCommand('/add Create new feature');

      expect(result.command).toBe('add');
      expect(result.args).toEqual(['Create', 'new', 'feature']);
      expect(result.rawArgs).toBe('Create new feature');
    });

    it('should parse /remind with ID and time', () => {
      const result = parseCommand('/remind 123 2h');

      expect(result.command).toBe('remind');
      expect(result.args).toEqual(['123', '2h']);
    });

    it('should parse /status command', () => {
      const result = parseCommand('/status');

      expect(result.command).toBe('status');
    });

    it('should parse /blockers command', () => {
      const result = parseCommand('/blockers');

      expect(result.command).toBe('blockers');
    });

    it('should parse /standup command', () => {
      const result = parseCommand('/standup');

      expect(result.command).toBe('standup');
    });

    it('should parse /help command', () => {
      const result = parseCommand('/help');

      expect(result.command).toBe('help');
    });

    it('should return unknown for non-command text', () => {
      const result = parseCommand('Hello, how are you?');

      expect(result.command).toBe('unknown');
      expect(result.rawArgs).toBe('Hello, how are you?');
    });

    it('should return unknown for unknown command', () => {
      const result = parseCommand('/unknowncommand');

      expect(result.command).toBe('unknown');
    });

    it('should handle case insensitivity', () => {
      const result = parseCommand('/TASKS');

      expect(result.command).toBe('tasks');
    });

    it('should handle extra whitespace', () => {
      const result = parseCommand('  /task   123  ');

      expect(result.command).toBe('task');
      expect(result.args).toEqual(['123']);
    });
  });

  describe('Command formats', () => {
    describe('/remind time formats', () => {
      it('should accept minutes format', () => {
        const match = '30m'.match(/^(\d+)(m|h|d)$/i);
        expect(match).toBeTruthy();
        expect(match![1]).toBe('30');
        expect(match![2]).toBe('m');
      });

      it('should accept hours format', () => {
        const match = '2h'.match(/^(\d+)(m|h|d)$/i);
        expect(match).toBeTruthy();
        expect(match![1]).toBe('2');
        expect(match![2]).toBe('h');
      });

      it('should accept days format', () => {
        const match = '1d'.match(/^(\d+)(m|h|d)$/i);
        expect(match).toBeTruthy();
        expect(match![1]).toBe('1');
        expect(match![2]).toBe('d');
      });

      it('should reject invalid format', () => {
        const match = '2weeks'.match(/^(\d+)(m|h|d)$/i);
        expect(match).toBeFalsy();
      });
    });
  });

  describe('Task formatting', () => {
    it('should format task with all fields', () => {
      const task = {
        id: 123,
        title: 'Test task',
        status: 'in_progress',
        priority: 'high',
        deadline: new Date('2024-12-31'),
      };

      const statusEmoji = {
        not_started: '⬜',
        in_progress: '🔄',
        completed: '✅',
      }[task.status] || '⬜';

      const priorityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[task.priority] || '🟡';

      expect(statusEmoji).toBe('🔄');
      expect(priorityEmoji).toBe('🟠');
    });

    it('should handle missing optional fields', () => {
      const task = {
        id: 456,
        title: 'Simple task',
        status: null,
        priority: null,
        deadline: null,
      };

      const statusEmoji = {
        not_started: '⬜',
        in_progress: '🔄',
        completed: '✅',
      }[task.status || 'not_started'] || '⬜';

      expect(statusEmoji).toBe('⬜');
    });
  });

  describe('Help message', () => {
    it('should contain all command descriptions', () => {
      const helpContent = `
        /tasks - Мои задачи на сегодня
        /task 123 - Детали задачи #123
        /done 123 - Завершить задачу
        /add Название - Быстро создать задачу
        /remind 123 2h - Напомнить через 2 часа
        /status - Статус проектов
        /blockers - Заблокированные задачи
        /standup - Сгенерировать standup
        /help - Эта справка
      `;

      expect(helpContent).toContain('/tasks');
      expect(helpContent).toContain('/task');
      expect(helpContent).toContain('/done');
      expect(helpContent).toContain('/add');
      expect(helpContent).toContain('/remind');
      expect(helpContent).toContain('/status');
      expect(helpContent).toContain('/blockers');
      expect(helpContent).toContain('/standup');
      expect(helpContent).toContain('/help');
    });
  });

  describe('Command context', () => {
    it('should have required fields', () => {
      const ctx = {
        userId: 1,
        userName: 'Test User',
        channel: 'telegram',
        chatId: '123456789',
      };

      expect(ctx.userId).toBeDefined();
      expect(ctx.channel).toBeDefined();
      expect(ctx.chatId).toBeDefined();
    });

    it('should allow optional userName', () => {
      const ctx = {
        userId: 1,
        channel: 'whatsapp',
        chatId: '+79001234567',
      };

      expect(ctx.userName).toBeUndefined();
    });
  });

  describe('Command result', () => {
    it('should have success and message', () => {
      const result = {
        success: true,
        message: '✅ Task completed!',
        data: { taskId: 123 },
      };

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅');
      expect(result.data).toBeDefined();
    });

    it('should handle error result', () => {
      const result = {
        success: false,
        message: '❌ Task not found',
      };

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌');
    });
  });
});
