/**
 * AI Session Router Tests
 * Tests for chat session persistence functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// Mock the database module
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        $returningId: vi.fn(() => Promise.resolve([{ id: 1 }])),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([{
                session: {
                  id: 1,
                  sessionUuid: 'test-uuid-123',
                  userId: 1,
                  title: 'Test Session',
                  messageCount: 5,
                  lastMessageAt: new Date(),
                  isPinned: false,
                  isArchived: false,
                  createdAt: new Date(),
                },
                matchedContent: 'This is a test message content',
              }])),
            })),
            limit: vi.fn(() => Promise.resolve([{
              message: { id: 1, sessionId: 1 },
              session: { id: 1, userId: 1 },
            }])),
          })),
        })),
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn((n) => {
              // If called with offset, it's for listSessions
              // If called without offset, it's for searchSessions title matches
              return {
                offset: vi.fn(() => Promise.resolve([])),
                then: (resolve: Function) => resolve([{
                  id: 1,
                  sessionUuid: 'test-uuid-123',
                  userId: 1,
                  title: 'Test Session',
                  messageCount: 5,
                  lastMessageAt: new Date(),
                  isPinned: false,
                  isArchived: false,
                  createdAt: new Date(),
                }]),
              };
            }),
          })),
          limit: vi.fn(() => Promise.resolve([{
            id: 1,
            sessionUuid: 'test-uuid-123',
            userId: 1,
            projectId: null,
            taskId: null,
            title: 'Test Session',
            messageCount: 0,
            isArchived: false,
            isPinned: false,
            lastMessageAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
  // Add other db exports that might be needed
  getProjectsByUser: vi.fn(),
  getProjectById: vi.fn(),
  getFullProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getBlocksByProject: vi.fn(),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  getSectionsByBlock: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
  getTasksBySection: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getSubtasksByTask: vi.fn(),
  createSubtask: vi.fn(),
  updateSubtask: vi.fn(),
  deleteSubtask: vi.fn(),
  getAiSettings: vi.fn(),
  updateAiSettings: vi.fn(),
  getCredits: vi.fn(),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  getChatHistory: vi.fn(),
  addChatMessage: vi.fn(),
  clearChatHistory: vi.fn(),
  getUserById: vi.fn(),
  getOrCreateUser: vi.fn(),
  updateUser: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe('aiSessionRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.createSession({
        projectId: 1,
        title: 'Test Chat',
      });

      expect(result).toBeDefined();
      expect(result.sessionUuid).toBe('test-uuid-123');
      expect(result.title).toBe('Test Chat');
    });

    it('should create session with default title', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.createSession({});

      expect(result.title).toBe('Новый чат');
    });
  });

  describe('getSession', () => {
    it('should return session by UUID', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.getSession({
        sessionUuid: 'test-uuid-123',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
  });

  describe('listSessions', () => {
    it('should list user sessions', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.listSessions({
        limit: 20,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by projectId', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.listSessions({
        projectId: 1,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.updateSession({
        sessionId: 1,
        title: 'Updated Title',
      });

      expect(result.success).toBe(true);
    });

    it('should archive session', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.updateSession({
        sessionId: 1,
        isArchived: true,
      });

      expect(result.success).toBe(true);
    });

    it('should pin session', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.updateSession({
        sessionId: 1,
        isPinned: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and messages', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.deleteSession({
        sessionId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Сессия удалена');
    });
  });

  describe('addMessage', () => {
    it('should add user message', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.addMessage({
        sessionId: 1,
        role: 'user',
        content: 'Hello AI',
      });

      expect(result).toBeDefined();
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello AI');
    });

    it('should add assistant message with metadata', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.addMessage({
        sessionId: 1,
        role: 'assistant',
        content: 'Hello! How can I help?',
        metadata: {
          model: 'gpt-4',
          tokens: 50,
          suggestedActions: [
            { 
              id: 'action-1', 
              type: 'create_subtask', 
              title: 'Create subtask',
              confidence: 'high' as const,
            },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(result.role).toBe('assistant');
    });
  });

  describe('getMessages', () => {
    it('should return messages for session', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.getMessages({
        sessionId: 1,
        limit: 100,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('clearSession', () => {
    it('should clear all messages and reset session', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.clearSession({
        sessionId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('История очищена');
    });
  });

  describe('markMessageFinalized', () => {
    it('should mark message as finalized', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.markMessageFinalized({
        messageId: 1,
        decisionRecordId: 5,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('searchSessions', () => {
    it('should search sessions by query', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.searchSessions({
        query: 'test',
        limit: 20,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should search sessions with projectId filter', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.searchSessions({
        query: 'test',
        projectId: 1,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return results with matchType', async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.aiSession.searchSessions({
        query: 'chat',
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
      // Results should have matchType field
      if (result.length > 0) {
        expect(['title', 'content']).toContain(result[0].matchType);
      }
    });
  });
});
