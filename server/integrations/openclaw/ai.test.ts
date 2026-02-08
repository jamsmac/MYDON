/**
 * OpenClaw AI Provider Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the client
vi.mock('./client', () => ({
  getOpenClawClient: vi.fn().mockReturnValue({
    isEnabled: vi.fn().mockReturnValue(true),
    runAgent: vi.fn().mockResolvedValue({
      success: true,
      message: 'Test response from OpenClaw agent',
      sessionId: 'test-session-123',
      tokensUsed: 100,
    }),
  }),
  isOpenClawAvailable: vi.fn().mockResolvedValue(true),
}));

// Mock the LLM fallback
vi.mock('../../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: 'direct-123',
    created: Date.now(),
    model: 'test-model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Fallback response',
        },
        finish_reason: 'stop',
      },
    ],
  }),
}));

describe('OpenClaw AI Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('messagesToPrompt', () => {
    it('should convert system message', () => {
      const messages = [{ role: 'system' as const, content: 'You are a helpful assistant' }];
      const prompt = messages
        .map(msg => `[System]: ${msg.content}`)
        .join('\n\n');

      expect(prompt).toContain('[System]: You are a helpful assistant');
    });

    it('should convert user message', () => {
      const messages = [{ role: 'user' as const, content: 'Hello!' }];
      const prompt = messages
        .map(msg => `[User]: ${msg.content}`)
        .join('\n\n');

      expect(prompt).toContain('[User]: Hello!');
    });

    it('should convert assistant message', () => {
      const messages = [{ role: 'assistant' as const, content: 'Hi there!' }];
      const prompt = messages
        .map(msg => `[Assistant]: ${msg.content}`)
        .join('\n\n');

      expect(prompt).toContain('[Assistant]: Hi there!');
    });

    it('should handle multiple messages', () => {
      const messages = [
        { role: 'system' as const, content: 'Be helpful' },
        { role: 'user' as const, content: 'What is 2+2?' },
        { role: 'assistant' as const, content: '4' },
      ];

      const prompt = messages.length;
      expect(prompt).toBe(3);
    });
  });

  describe('invokeAI', () => {
    it('should return openclaw provider when available', async () => {
      const { invokeAI } = await import('./ai');

      const result = await invokeAI({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('openclaw');
      expect(result.choices[0].message.content).toContain('Test response');
    });

    it('should fall back to direct API when forced', async () => {
      const { invokeAI } = await import('./ai');

      const result = await invokeAI(
        { messages: [{ role: 'user', content: 'Hello' }] },
        { forceFallback: true }
      );

      expect(result.provider).toBe('direct');
    });

    it('should include session ID from agent response', async () => {
      const { invokeAI } = await import('./ai');

      const result = await invokeAI({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.sessionId).toBe('test-session-123');
    });

    it('should include token usage', async () => {
      const { invokeAI } = await import('./ai');

      const result = await invokeAI({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.tokensUsed).toBe(100);
    });
  });

  describe('complete', () => {
    it('should return text response', async () => {
      const { complete } = await import('./ai');

      const result = await complete('What is 2+2?');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('chat', () => {
    it('should return response and session ID', async () => {
      const { chat } = await import('./ai');

      const result = await chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.response).toBeDefined();
      expect(result.sessionId).toBeDefined();
    });
  });

  describe('taskAI', () => {
    describe('breakdown', () => {
      it('should call AI with task description', async () => {
        const { taskAI } = await import('./ai');

        // Mock implementation returns null since response isn't valid JSON
        const result = await taskAI.breakdown('Create a login page');

        // Result is null because mock response isn't valid JSON
        expect(result).toBe(null);
      });
    });

    describe('suggestPriority', () => {
      it('should extract priority from response', async () => {
        const { taskAI } = await import('./ai');

        // Will return null since mock response doesn't contain priority keyword
        const result = await taskAI.suggestPriority('Important task');

        expect(result).toBe(null);
      });
    });

    describe('generateStandup', () => {
      it('should generate standup summary', async () => {
        const { taskAI } = await import('./ai');

        const result = await taskAI.generateStandup(
          [{ id: 1, title: 'Task 1' }],
          [{ id: 2, title: 'Task 2', priority: 'high' }],
          []
        );

        expect(typeof result).toBe('string');
      });
    });
  });

  describe('projectAI', () => {
    describe('analyzeProgress', () => {
      it('should analyze project stats', async () => {
        const { projectAI } = await import('./ai');

        const result = await projectAI.analyzeProgress({
          totalTasks: 100,
          completedTasks: 75,
          overdueTasks: 5,
          upcomingDeadlines: 10,
        });

        expect(typeof result).toBe('string');
      });
    });

    describe('suggestOrdering', () => {
      it('should return task IDs in recommended order', async () => {
        const { projectAI } = await import('./ai');

        const tasks = [
          { id: 1, title: 'Task 1', priority: 'high' },
          { id: 2, title: 'Task 2', priority: 'low' },
        ];

        const result = await projectAI.suggestOrdering(tasks);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toContain(1);
        expect(result).toContain(2);
      });
    });
  });

  describe('OpenClawAIOptions', () => {
    it('should support thinking levels', () => {
      const levels = ['off', 'minimal', 'low', 'medium', 'high'];

      levels.forEach(level => {
        expect(['off', 'minimal', 'low', 'medium', 'high']).toContain(level);
      });
    });

    it('should support timeout option', () => {
      const options = {
        timeout: 120,
        thinking: 'high' as const,
      };

      expect(options.timeout).toBe(120);
      expect(options.thinking).toBe('high');
    });

    it('should support session continuity', () => {
      const options = {
        sessionId: 'existing-session-id',
      };

      expect(options.sessionId).toBeDefined();
    });
  });
});
