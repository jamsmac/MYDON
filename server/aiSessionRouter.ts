/**
 * AI Session Router - Chat Session Persistence
 * 
 * Handles saving and loading AI chat sessions across browser sessions
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { aiChatSessions, aiChatMessages } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";

// Helper to get db with null check
async function getDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }
  return database;
}

// Metadata schema for messages
const messageMetadataSchema = z.object({
  model: z.string().optional(),
  tokens: z.number().optional(),
  creditsUsed: z.number().optional(),
  fromCache: z.boolean().optional(),
  executionTime: z.number().optional(),
  suggestedActions: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    confidence: z.enum(["high", "medium", "low"]),
  })).optional(),
}).optional();

export const aiSessionRouter = router({
  /**
   * Create a new chat session
   */
  createSession: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.string().optional(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const sessionUuid = uuidv4();
      
      const [session] = await db.insert(aiChatSessions).values({
        sessionUuid,
        userId: ctx.user.id,
        projectId: input.projectId,
        taskId: input.taskId,
        title: input.title || "Новый чат",
        messageCount: 0,
      }).$returningId();

      return {
        id: session.id,
        sessionUuid,
        title: input.title || "Новый чат",
        projectId: input.projectId,
        taskId: input.taskId,
        messageCount: 0,
        createdAt: new Date(),
      };
    }),

  /**
   * Get a session by UUID
   */
  getSession: protectedProcedure
    .input(z.object({
      sessionUuid: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [session] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.sessionUuid, input.sessionUuid),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      return session;
    }),

  /**
   * Get or create session for context
   * Returns existing session for project/task or creates new one
   */
  getOrCreateSession: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      taskId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      
      // Try to find existing session for this context
      const conditions = [
        eq(aiChatSessions.userId, ctx.user.id),
        eq(aiChatSessions.isArchived, false),
      ];
      
      if (input.projectId) {
        conditions.push(eq(aiChatSessions.projectId, input.projectId));
      } else {
        conditions.push(sql`${aiChatSessions.projectId} IS NULL`);
      }
      
      if (input.taskId) {
        conditions.push(eq(aiChatSessions.taskId, input.taskId));
      } else {
        conditions.push(sql`${aiChatSessions.taskId} IS NULL`);
      }

      const [existingSession] = await db.select()
        .from(aiChatSessions)
        .where(and(...conditions))
        .orderBy(desc(aiChatSessions.lastMessageAt))
        .limit(1);

      if (existingSession) {
        return existingSession;
      }

      // Create new session
      const sessionUuid = uuidv4();
      const [newSession] = await db.insert(aiChatSessions).values({
        sessionUuid,
        userId: ctx.user.id,
        projectId: input.projectId,
        taskId: input.taskId,
        title: "Новый чат",
        messageCount: 0,
      }).$returningId();

      return {
        id: newSession.id,
        sessionUuid,
        userId: ctx.user.id,
        projectId: input.projectId,
        taskId: input.taskId,
        title: "Новый чат",
        messageCount: 0,
        isArchived: false,
        isPinned: false,
        lastMessageAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  /**
   * List user's chat sessions
   */
  listSessions: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      includeArchived: z.boolean().default(false),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const conditions = [eq(aiChatSessions.userId, ctx.user.id)];

      if (input.projectId) {
        conditions.push(eq(aiChatSessions.projectId, input.projectId));
      }

      if (!input.includeArchived) {
        conditions.push(eq(aiChatSessions.isArchived, false));
      }

      const sessions = await db.select()
        .from(aiChatSessions)
        .where(and(...conditions))
        .orderBy(desc(aiChatSessions.isPinned), desc(aiChatSessions.lastMessageAt))
        .limit(input.limit)
        .offset(input.offset);

      return sessions;
    }),

  /**
   * Update session (title, archive, pin)
   */
  updateSession: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      title: z.string().optional(),
      isArchived: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const { sessionId, ...updates } = input;

      // Verify ownership
      const [existing] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.id, sessionId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      await db.update(aiChatSessions)
        .set(updates)
        .where(eq(aiChatSessions.id, sessionId));

      return { success: true, message: "Сессия обновлена" };
    }),

  /**
   * Delete a session and all its messages
   */
  deleteSession: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Verify ownership
      const [existing] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.id, input.sessionId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      // Delete all messages first
      await db.delete(aiChatMessages)
        .where(eq(aiChatMessages.sessionId, input.sessionId));

      // Delete session
      await db.delete(aiChatSessions)
        .where(eq(aiChatSessions.id, input.sessionId));

      return { success: true, message: "Сессия удалена" };
    }),

  /**
   * Add a message to a session
   */
  addMessage: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
      metadata: messageMetadataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Verify session ownership
      const [session] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.id, input.sessionId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      // Insert message
      const [message] = await db.insert(aiChatMessages).values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        metadata: input.metadata || null,
      }).$returningId();

      // Update session stats
      await db.update(aiChatSessions)
        .set({
          messageCount: sql`${aiChatSessions.messageCount} + 1`,
          lastMessageAt: new Date(),
        })
        .where(eq(aiChatSessions.id, input.sessionId));

      // Auto-generate title from first user message
      if (session.messageCount === 0 && input.role === "user") {
        const title = input.content.substring(0, 50) + (input.content.length > 50 ? "..." : "");
        await db.update(aiChatSessions)
          .set({ title })
          .where(eq(aiChatSessions.id, input.sessionId));
      }

      return {
        id: message.id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        metadata: input.metadata,
        createdAt: new Date(),
      };
    }),

  /**
   * Get messages for a session
   */
  getMessages: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Verify session ownership
      const [session] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.id, input.sessionId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      const messages = await db.select()
        .from(aiChatMessages)
        .where(eq(aiChatMessages.sessionId, input.sessionId))
        .orderBy(aiChatMessages.createdAt)
        .limit(input.limit)
        .offset(input.offset);

      return messages;
    }),

  /**
   * Mark message as finalized (linked to decision record)
   */
  markMessageFinalized: protectedProcedure
    .input(z.object({
      messageId: z.number(),
      decisionRecordId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Get message and verify ownership through session
      const [message] = await db.select({
        message: aiChatMessages,
        session: aiChatSessions,
      })
        .from(aiChatMessages)
        .innerJoin(aiChatSessions, eq(aiChatMessages.sessionId, aiChatSessions.id))
        .where(and(
          eq(aiChatMessages.id, input.messageId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сообщение не найдено" });
      }

      await db.update(aiChatMessages)
        .set({
          isFinalized: true,
          decisionRecordId: input.decisionRecordId,
        })
        .where(eq(aiChatMessages.id, input.messageId));

      return { success: true };
    }),

  /**
   * Clear all messages in a session (start fresh)
   */
  clearSession: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();

      // Verify ownership
      const [session] = await db.select()
        .from(aiChatSessions)
        .where(and(
          eq(aiChatSessions.id, input.sessionId),
          eq(aiChatSessions.userId, ctx.user.id)
        ))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      // Delete all messages
      await db.delete(aiChatMessages)
        .where(eq(aiChatMessages.sessionId, input.sessionId));

      // Reset session stats
      await db.update(aiChatSessions)
        .set({
          messageCount: 0,
          lastMessageAt: null,
          title: "Новый чат",
        })
        .where(eq(aiChatSessions.id, input.sessionId));

      return { success: true, message: "История очищена" };
    }),
});

export type AISessionRouter = typeof aiSessionRouter;
