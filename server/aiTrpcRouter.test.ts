import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiTrpcRouter } from './aiTrpcRouter';

// Mock the database
vi.mock('./db', () => ({
  getDb: vi.fn(() => null),
}));

// Mock the LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{ message: { content: 'Mock AI response' } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  })),
}));

describe('AI tRPC Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Router Structure', () => {
    it('should have chat procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('chat');
    });

    it('should have getSessions procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getSessions');
    });

    it('should have getSessionMessages procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getSessionMessages');
    });

    it('should have createSession procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('createSession');
    });

    it('should have updateSession procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('updateSession');
    });

    it('should have deleteSession procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('deleteSession');
    });

    it('should have getUsageStats procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getUsageStats');
    });

    it('should have getCacheStats procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getCacheStats');
    });

    it('should have getProviders procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getProviders');
    });

    it('should have quickChat procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('quickChat');
    });

    it('should have getSessionContext procedure', () => {
      expect(aiTrpcRouter).toHaveProperty('getSessionContext');
    });
  });

  describe('Procedure Types', () => {
    it('chat should be a mutation', () => {
      expect(aiTrpcRouter.chat._def.type).toBe('mutation');
    });

    it('getSessions should be a query', () => {
      expect(aiTrpcRouter.getSessions._def.type).toBe('query');
    });

    it('getSessionMessages should be a query', () => {
      expect(aiTrpcRouter.getSessionMessages._def.type).toBe('query');
    });

    it('createSession should be a mutation', () => {
      expect(aiTrpcRouter.createSession._def.type).toBe('mutation');
    });

    it('updateSession should be a mutation', () => {
      expect(aiTrpcRouter.updateSession._def.type).toBe('mutation');
    });

    it('deleteSession should be a mutation', () => {
      expect(aiTrpcRouter.deleteSession._def.type).toBe('mutation');
    });

    it('getUsageStats should be a query', () => {
      expect(aiTrpcRouter.getUsageStats._def.type).toBe('query');
    });

    it('getCacheStats should be a query', () => {
      expect(aiTrpcRouter.getCacheStats._def.type).toBe('query');
    });

    it('getProviders should be a query', () => {
      expect(aiTrpcRouter.getProviders._def.type).toBe('query');
    });

    it('quickChat should be a mutation', () => {
      expect(aiTrpcRouter.quickChat._def.type).toBe('mutation');
    });

    it('getSessionContext should be a query', () => {
      expect(aiTrpcRouter.getSessionContext._def.type).toBe('query');
    });
  });
});
