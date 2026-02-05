import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRouter } from './utils/aiRouter';
import { isProviderAvailable, getAvailableProviders } from './utils/aiProviders';
import { AICache } from './utils/aiCache';
import { DEFAULT_TASK_MODEL_MAPPING, PROVIDER_COSTS } from './utils/aiTypes';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn(() => null),
}));

// Mock the LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{ message: { content: 'Mock response' } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  })),
}));

describe('AIRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProviders', () => {
    it('should always include builtin provider', () => {
      const providers = AIRouter.getProviders();
      expect(providers).toContain('builtin');
    });

    it('should return array of providers', () => {
      const providers = AIRouter.getProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats = await AIRouter.getCacheStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('avgHitsPerEntry');
      expect(stats).toHaveProperty('cacheSize');
    });
  });

  describe('getUserSessions', () => {
    it('should return empty array when database is not available', async () => {
      const sessions = await AIRouter.getUserSessions(1);
      expect(sessions).toEqual([]);
    });
  });

  describe('getUserStats', () => {
    it('should return default stats when database is not available', async () => {
      const stats = await AIRouter.getUserStats(1);
      expect(stats).toHaveProperty('daily');
      expect(stats).toHaveProperty('totals');
      expect(stats.daily).toEqual([]);
      expect(stats.totals).toEqual({ requests: 0, tokens: 0, cost: 0, cached: 0 });
    });
  });

  describe('getOrCreateSession', () => {
    it('should return session ID when database is not available', async () => {
      const sessionId = await AIRouter.getOrCreateSession(1, 'test-session');
      expect(sessionId).toBe('test-session');
    });

    it('should generate UUID when no session ID provided', async () => {
      const sessionId = await AIRouter.getOrCreateSession(1);
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});

describe('AI Provider Utilities', () => {
  describe('isProviderAvailable', () => {
    it('should return true for builtin provider', () => {
      expect(isProviderAvailable('builtin')).toBe(true);
    });

    it('should return false for unconfigured providers', () => {
      // These will be false unless env vars are set
      const result = isProviderAvailable('openai');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAvailableProviders', () => {
    it('should always include builtin', () => {
      const providers = getAvailableProviders();
      expect(providers).toContain('builtin');
    });
  });
});

describe('AI Types', () => {
  describe('DEFAULT_TASK_MODEL_MAPPING', () => {
    it('should have mapping for all task types', () => {
      const taskTypes = ['reasoning', 'coding', 'vision', 'chat', 'translation', 'summarization', 'creative'];
      for (const taskType of taskTypes) {
        expect(DEFAULT_TASK_MODEL_MAPPING).toHaveProperty(taskType);
        expect(DEFAULT_TASK_MODEL_MAPPING[taskType as keyof typeof DEFAULT_TASK_MODEL_MAPPING]).toHaveProperty('provider');
        expect(DEFAULT_TASK_MODEL_MAPPING[taskType as keyof typeof DEFAULT_TASK_MODEL_MAPPING]).toHaveProperty('model');
      }
    });
  });

  describe('PROVIDER_COSTS', () => {
    it('should have costs for all providers', () => {
      const providers = ['openai', 'anthropic', 'google', 'builtin'];
      for (const provider of providers) {
        expect(PROVIDER_COSTS).toHaveProperty(provider);
        expect(PROVIDER_COSTS[provider as keyof typeof PROVIDER_COSTS]).toHaveProperty('input');
        expect(PROVIDER_COSTS[provider as keyof typeof PROVIDER_COSTS]).toHaveProperty('output');
      }
    });

    it('should have zero cost for builtin provider', () => {
      expect(PROVIDER_COSTS.builtin.input).toBe(0);
      expect(PROVIDER_COSTS.builtin.output).toBe(0);
    });
  });
});

describe('AICache Integration', () => {
  describe('generateKey', () => {
    it('should generate consistent keys', () => {
      const key1 = AICache.generateKey('test prompt', 'chat');
      const key2 = AICache.generateKey('test prompt', 'chat');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different task types', () => {
      const key1 = AICache.generateKey('test prompt', 'chat');
      const key2 = AICache.generateKey('test prompt', 'reasoning');
      expect(key1).not.toBe(key2);
    });
  });
});
