/**
 * AI tRPC Router
 * Provides API endpoints for AI chat, sessions, and usage statistics
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from './_core/trpc';
import { AIRouter } from './utils/aiRouter';
import { AICache } from './utils/aiCache';
import { getDb } from './db';
import * as schema from '../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import type { TaskType, AIMessage } from './utils/aiTypes';

// Input schemas
const chatInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  sessionId: z.string().optional(),
  taskType: z.enum(['reasoning', 'coding', 'vision', 'chat', 'translation', 'summarization', 'creative']).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(32000).optional(),
  useCache: z.boolean().optional(),
});

const getSessionMessagesSchema = z.object({
  sessionId: z.string(),
  limit: z.number().min(1).max(100).optional(),
});

const getUsageStatsSchema = z.object({
  days: z.number().min(1).max(365).optional(),
});

const createSessionSchema = z.object({
  title: z.string().optional(),
  projectId: z.number().optional(),
});

const updateSessionSchema = z.object({
  sessionId: z.string(),
  title: z.string(),
});

const deleteSessionSchema = z.object({
  sessionId: z.string(),
});

export const aiTrpcRouter = router({
  /**
   * Send a chat message to AI
   */
  chat: protectedProcedure
    .input(chatInputSchema)
    .mutation(async ({ ctx, input }) => {
      const response = await AIRouter.chat({
        messages: input.messages as AIMessage[],
        sessionId: input.sessionId,
        taskType: input.taskType as TaskType,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        useCache: input.useCache,
        userId: ctx.user.id,
      });

      // Update session if provided
      if (input.sessionId) {
        await AIRouter.updateSession(input.sessionId);
      }

      return {
        content: response.content,
        model: response.model,
        provider: response.provider,
        tokens: response.tokens,
        cost: response.cost,
        fromCache: response.fromCache,
        executionTime: response.executionTime,
      };
    }),

  /**
   * Get user's chat sessions
   */
  getSessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const sessions = await AIRouter.getUserSessions(ctx.user.id, input?.limit || 20);
      return sessions;
    }),

  /**
   * Get messages for a specific session
   */
  getSessionMessages: protectedProcedure
    .input(getSessionMessagesSchema)
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const messages = await db
        .select()
        .from(schema.aiRequests)
        .where(eq(schema.aiRequests.sessionId, input.sessionId))
        .orderBy(desc(schema.aiRequests.createdAt))
        .limit(input.limit || 50);

      // Verify user owns this session
      if (messages.length > 0 && messages[0].userId !== ctx.user.id) {
        return [];
      }

      return messages.reverse().map(m => ({
        id: m.id,
        prompt: m.prompt,
        response: m.response,
        model: m.model,
        taskType: m.taskType,
        tokens: m.tokens,
        cost: m.cost,
        fromCache: m.fromCache,
        executionTime: m.executionTime,
        createdAt: m.createdAt,
      }));
    }),

  /**
   * Create a new chat session
   */
  createSession: protectedProcedure
    .input(createSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const sessionId = await AIRouter.getOrCreateSession(
        ctx.user.id,
        undefined,
        input.projectId,
        input.title
      );
      return { sessionId };
    }),

  /**
   * Update session title
   */
  updateSession: protectedProcedure
    .input(updateSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Verify ownership
      const session = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, input.sessionId))
        .limit(1);

      if (session.length === 0 || session[0].userId !== ctx.user.id) {
        return { success: false };
      }

      await db
        .update(schema.aiSessions)
        .set({ title: input.title })
        .where(eq(schema.aiSessions.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Delete a chat session
   */
  deleteSession: protectedProcedure
    .input(deleteSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Verify ownership
      const session = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, input.sessionId))
        .limit(1);

      if (session.length === 0 || session[0].userId !== ctx.user.id) {
        return { success: false };
      }

      // Delete session and related requests
      await db
        .delete(schema.aiRequests)
        .where(eq(schema.aiRequests.sessionId, input.sessionId));
      
      await db
        .delete(schema.aiSessions)
        .where(eq(schema.aiSessions.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Get user's usage statistics
   */
  getUsageStats: protectedProcedure
    .input(getUsageStatsSchema.optional())
    .query(async ({ ctx, input }) => {
      const stats = await AIRouter.getUserStats(ctx.user.id, input?.days || 30);
      return stats;
    }),

  /**
   * Get cache statistics (admin only or for current user)
   */
  getCacheStats: protectedProcedure
    .query(async () => {
      const stats = await AIRouter.getCacheStats();
      return stats;
    }),

  /**
   * Get available AI providers
   */
  getProviders: publicProcedure
    .query(async () => {
      const providers = AIRouter.getProviders();
      return providers.map(p => ({
        id: p,
        name: p.charAt(0).toUpperCase() + p.slice(1),
        available: true,
      }));
    }),

  /**
   * Quick chat - simplified endpoint for single message
   */
  quickChat: protectedProcedure
    .input(z.object({
      message: z.string(),
      taskType: z.enum(['reasoning', 'coding', 'vision', 'chat', 'translation', 'summarization', 'creative']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const response = await AIRouter.chat({
        messages: [{ role: 'user', content: input.message }],
        taskType: input.taskType as TaskType || 'chat',
        userId: ctx.user.id,
        useCache: true,
      });

      return {
        content: response.content,
        model: response.model,
        fromCache: response.fromCache,
      };
    }),

  /**
   * Get session context (for continuing conversations)
   */
  getSessionContext: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      limit: z.number().min(1).max(20).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const context = await AICache.getSessionContext(input.sessionId, input.limit || 10);
      return context;
    }),
});

export type AITrpcRouter = typeof aiTrpcRouter;
