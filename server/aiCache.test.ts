import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AICache } from './utils/aiCache';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn(() => null),
}));

describe('AICache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate consistent MD5 hash for same input', () => {
      const key1 = AICache.generateKey('Hello world', 'chat');
      const key2 = AICache.generateKey('Hello world', 'chat');
      expect(key1).toBe(key2);
    });

    it('should generate different hash for different prompts', () => {
      const key1 = AICache.generateKey('Hello world', 'chat');
      const key2 = AICache.generateKey('Goodbye world', 'chat');
      expect(key1).not.toBe(key2);
    });

    it('should generate different hash for different task types', () => {
      const key1 = AICache.generateKey('Hello world', 'chat');
      const key2 = AICache.generateKey('Hello world', 'reasoning');
      expect(key1).not.toBe(key2);
    });

    it('should normalize case and whitespace', () => {
      const key1 = AICache.generateKey('Hello World', 'chat');
      const key2 = AICache.generateKey('  hello world  ', 'chat');
      expect(key1).toBe(key2);
    });

    it('should return 32-character hex string', () => {
      const key = AICache.generateKey('test prompt', 'chat');
      expect(key).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('get', () => {
    it('should return null when database is not available', async () => {
      const result = await AICache.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should not throw when database is not available', async () => {
      await expect(AICache.set('test-key', {
        prompt: 'test',
        response: 'response',
        model: 'gpt-4',
      })).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('should not throw when database is not available', async () => {
      await expect(AICache.delete('test-key')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should return 0 when database is not available', async () => {
      const result = await AICache.cleanup();
      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return default stats when database is not available', async () => {
      const stats = await AICache.getStats();
      expect(stats).toEqual({
        totalEntries: 0,
        totalHits: 0,
        avgHitsPerEntry: '0',
        cacheSize: '0 KB',
      });
    });
  });

  describe('getSessionContext', () => {
    it('should return empty array when database is not available', async () => {
      const context = await AICache.getSessionContext('test-session');
      expect(context).toEqual([]);
    });
  });
});
