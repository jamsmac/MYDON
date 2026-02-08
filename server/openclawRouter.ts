/**
 * OpenClaw Integration Router
 *
 * API endpoints for managing notification preferences,
 * viewing notification history, and cron job management.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { openclawPreferences, openclawNotifications, openclawCronJobs } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { isOpenClawAvailable, getOpenClawClient } from "./integrations/openclaw";
import type { OpenClawChannel } from "./integrations/openclaw/types";

// Validation schemas
const channelConfigSchema = z.object({
  enabled: z.boolean(),
  chatId: z.string().optional(), // Telegram
  phone: z.string().optional(), // WhatsApp
  channelId: z.string().optional(), // Discord/Slack
});

const channelsSchema = z.record(
  z.enum(["telegram", "whatsapp", "discord", "slack", "signal", "imessage"]),
  channelConfigSchema
);

const notificationTypeSchema = z.enum([
  "deadline_warning",
  "deadline_urgent",
  "task_assigned",
  "task_completed",
  "task_comment",
  "task_mention",
  "blocker_added",
  "status_changed",
  "daily_digest",
  "weekly_report",
]);

const typePreferencesSchema = z.record(
  notificationTypeSchema,
  z.object({
    enabled: z.boolean(),
    channels: z.array(z.enum(["telegram", "whatsapp", "discord", "slack", "signal", "imessage"])).optional(),
  })
);

export const openclawRouter = router({
  // Get OpenClaw status
  status: protectedProcedure.query(async () => {
    const available = await isOpenClawAvailable();
    const client = getOpenClawClient();

    return {
      available,
      enabled: client.isEnabled(),
      gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || null,
    };
  }),

  // Get user's notification preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const [prefs] = await db
      .select()
      .from(openclawPreferences)
      .where(eq(openclawPreferences.userId, ctx.user.id))
      .limit(1);

    if (!prefs) {
      // Return default preferences
      return {
        enabled: false,
        channels: {},
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTimezone: "Europe/Moscow",
        preferences: {},
      };
    }

    return {
      enabled: prefs.enabled ?? false,
      channels: (prefs.channels as Record<string, any>) || {},
      quietHoursEnabled: prefs.quietHoursEnabled ?? false,
      quietHoursStart: prefs.quietHoursStart ?? "22:00",
      quietHoursEnd: prefs.quietHoursEnd ?? "07:00",
      quietHoursTimezone: prefs.quietHoursTimezone ?? "Europe/Moscow",
      preferences: (prefs.preferences as Record<string, any>) || {},
    };
  }),

  // Update notification preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      channels: channelsSchema.optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      quietHoursTimezone: z.string().optional(),
      preferences: typePreferencesSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      // Check if preferences exist
      const [existing] = await db
        .select()
        .from(openclawPreferences)
        .where(eq(openclawPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(openclawPreferences)
          .set({
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            ...(input.channels && { channels: input.channels }),
            ...(input.quietHoursEnabled !== undefined && { quietHoursEnabled: input.quietHoursEnabled }),
            ...(input.quietHoursStart && { quietHoursStart: input.quietHoursStart }),
            ...(input.quietHoursEnd && { quietHoursEnd: input.quietHoursEnd }),
            ...(input.quietHoursTimezone && { quietHoursTimezone: input.quietHoursTimezone }),
            ...(input.preferences && { preferences: input.preferences }),
          })
          .where(eq(openclawPreferences.userId, ctx.user.id));
      } else {
        // Create new
        await db.insert(openclawPreferences).values({
          userId: ctx.user.id,
          enabled: input.enabled ?? false,
          channels: input.channels || {},
          quietHoursEnabled: input.quietHoursEnabled ?? false,
          quietHoursStart: input.quietHoursStart,
          quietHoursEnd: input.quietHoursEnd,
          quietHoursTimezone: input.quietHoursTimezone || "Europe/Moscow",
          preferences: input.preferences || {},
        });
      }

      return { success: true };
    }),

  // Configure a specific channel (e.g., link Telegram)
  configureChannel: protectedProcedure
    .input(z.object({
      channel: z.enum(["telegram", "whatsapp", "discord", "slack", "signal", "imessage"]),
      enabled: z.boolean(),
      config: z.object({
        chatId: z.string().optional(),
        phone: z.string().optional(),
        channelId: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      // Get current preferences
      const [existing] = await db
        .select()
        .from(openclawPreferences)
        .where(eq(openclawPreferences.userId, ctx.user.id))
        .limit(1);

      const currentChannels = (existing?.channels as Record<string, any>) || {};
      const updatedChannels = {
        ...currentChannels,
        [input.channel]: {
          enabled: input.enabled,
          ...input.config,
        },
      };

      if (existing) {
        await db
          .update(openclawPreferences)
          .set({ channels: updatedChannels })
          .where(eq(openclawPreferences.userId, ctx.user.id));
      } else {
        await db.insert(openclawPreferences).values({
          userId: ctx.user.id,
          enabled: true,
          channels: updatedChannels,
        });
      }

      return { success: true };
    }),

  // Get notification history
  getNotificationHistory: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      type: notificationTypeSchema.optional(),
      status: z.enum(["pending", "sent", "failed", "delivered"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const offset = (input.page - 1) * input.pageSize;

      // Build where conditions
      const conditions = [eq(openclawNotifications.userId, ctx.user.id)];
      if (input.type) {
        conditions.push(eq(openclawNotifications.type, input.type));
      }
      if (input.status) {
        conditions.push(eq(openclawNotifications.status, input.status));
      }

      // Get notifications
      const notifications = await db
        .select()
        .from(openclawNotifications)
        .where(and(...conditions))
        .orderBy(desc(openclawNotifications.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(openclawNotifications)
        .where(and(...conditions));

      return {
        data: notifications,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(count),
          hasMore: offset + notifications.length < Number(count),
        },
      };
    }),

  // Send test notification
  sendTest: protectedProcedure
    .input(z.object({
      channel: z.enum(["telegram", "whatsapp", "discord", "slack", "signal", "imessage"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = getOpenClawClient();

      if (!client.isEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OpenClaw is not enabled",
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      // Get user's channel config
      const [prefs] = await db
        .select()
        .from(openclawPreferences)
        .where(eq(openclawPreferences.userId, ctx.user.id))
        .limit(1);

      if (!prefs) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please configure your notification preferences first",
        });
      }

      const channels = (prefs.channels as Record<string, any>) || {};
      const channelConfig = channels[input.channel];

      if (!channelConfig?.enabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Channel ${input.channel} is not configured`,
        });
      }

      // Get target
      let target: string | undefined;
      switch (input.channel) {
        case "telegram":
          target = channelConfig.chatId;
          break;
        case "whatsapp":
          target = channelConfig.phone;
          break;
        case "discord":
        case "slack":
          target = channelConfig.channelId;
          break;
      }

      if (!target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No target configured for ${input.channel}`,
        });
      }

      // Send test message
      const success = await client.sendMessage({
        channel: input.channel as OpenClawChannel,
        target,
        message: "🧪 Тестовое уведомление от MYDON Roadmap Hub!\n\nЕсли вы видите это сообщение, уведомления настроены правильно ✅",
      });

      // Log the notification
      await db.insert(openclawNotifications).values({
        userId: ctx.user.id,
        type: "task_assigned", // Use a valid type for test
        channel: input.channel,
        target,
        message: "Test notification",
        status: success ? "sent" : "failed",
        sentAt: success ? new Date() : undefined,
      });

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send test notification",
        });
      }

      return { success: true };
    }),

  // Get cron jobs
  getCronJobs: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can view cron jobs
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    return db.select().from(openclawCronJobs).orderBy(openclawCronJobs.name);
  }),

  // Toggle cron job
  toggleCronJob: protectedProcedure
    .input(z.object({
      id: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      await db
        .update(openclawCronJobs)
        .set({ enabled: input.enabled })
        .where(eq(openclawCronJobs.id, input.id));

      return { success: true };
    }),

  // ============ AI ENDPOINTS ============

  // Run AI agent with prompt
  aiComplete: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(10000),
      thinking: z.enum(["off", "minimal", "low", "medium", "high"]).optional(),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { complete } = await import("./integrations/openclaw/ai");

      const result = await complete(input.prompt, {
        thinking: input.thinking,
        sessionId: input.sessionId,
      });

      return { result };
    }),

  // Task breakdown using AI
  aiTaskBreakdown: protectedProcedure
    .input(z.object({
      description: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const { taskAI } = await import("./integrations/openclaw/ai");

      const breakdown = await taskAI.breakdown(input.description);

      if (!breakdown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate task breakdown",
        });
      }

      return breakdown;
    }),

  // AI priority suggestion
  aiSuggestPriority: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      deadline: z.number().optional(), // Unix timestamp
    }))
    .mutation(async ({ input }) => {
      const { taskAI } = await import("./integrations/openclaw/ai");

      const priority = await taskAI.suggestPriority(
        input.title,
        input.description,
        input.deadline ? new Date(input.deadline) : undefined
      );

      return { priority };
    }),

  // Generate daily standup
  aiGenerateStandup: protectedProcedure
    .input(z.object({
      completedYesterday: z.array(z.object({
        id: z.number(),
        title: z.string(),
      })),
      plannedToday: z.array(z.object({
        id: z.number(),
        title: z.string(),
        priority: z.string().optional(),
      })),
      blockers: z.array(z.object({
        title: z.string(),
        reason: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { taskAI } = await import("./integrations/openclaw/ai");

      const standup = await taskAI.generateStandup(
        input.completedYesterday,
        input.plannedToday,
        input.blockers
      );

      return { standup };
    }),

  // Analyze project progress
  aiAnalyzeProgress: protectedProcedure
    .input(z.object({
      totalTasks: z.number().min(0),
      completedTasks: z.number().min(0),
      overdueTasks: z.number().min(0),
      upcomingDeadlines: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const { projectAI } = await import("./integrations/openclaw/ai");

      const analysis = await projectAI.analyzeProgress(input);

      return { analysis };
    }),

  // Suggest task ordering
  aiSuggestOrdering: protectedProcedure
    .input(z.object({
      tasks: z.array(z.object({
        id: z.number(),
        title: z.string(),
        priority: z.string().optional(),
        deadline: z.number().optional(), // Unix timestamp
      })),
    }))
    .mutation(async ({ input }) => {
      const { projectAI } = await import("./integrations/openclaw/ai");

      const tasks = input.tasks.map(t => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
      }));

      const ordering = await projectAI.suggestOrdering(tasks);

      return { ordering };
    }),

  // ============ SMART FEATURES ============

  // Auto-prioritize task
  smartAutoPrioritize: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      projectId: z.number().optional(),
      deadline: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const suggestion = await smart.autoPrioritize(input.taskId, {
        projectId: input.projectId,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
      });

      return suggestion;
    }),

  // Find similar tasks
  smartFindSimilar: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      limit: z.number().min(1).max(20).optional(),
    }))
    .query(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const similar = await smart.findSimilarTasks(input.taskId, input.limit);

      return { similar };
    }),

  // Analyze workload
  smartAnalyzeWorkload: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const workload = await smart.analyzeWorkload(input.projectId);

      return { workload };
    }),

  // Suggest assignee
  smartSuggestAssignee: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const suggestion = await smart.suggestAssignee(input.taskId, input.projectId);

      return suggestion;
    }),

  // Suggest schedule
  smartSuggestSchedule: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      estimatedHours: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const suggestion = await smart.suggestSchedule(input.taskId, input.estimatedHours);

      return suggestion;
    }),

  // Generate task summary
  smartGenerateSummary: protectedProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const summary = await smart.generateTaskSummary(input.taskId);

      return { summary };
    }),

  // Suggest task breakdown
  smartSuggestBreakdown: protectedProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { getSmartFeatures } = await import("./integrations/openclaw/smartFeatures");
      const smart = getSmartFeatures();

      const breakdown = await smart.suggestBreakdown(input.taskId);

      return breakdown;
    }),

  // ============ MEMORY ============

  // Search memory
  memorySearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(500),
      limit: z.number().min(1).max(20).optional(),
    }))
    .query(async ({ input }) => {
      const { getMemoryManager } = await import("./integrations/openclaw/memory");
      const memory = getMemoryManager();

      const results = await memory.search(input.query, input.limit);

      return { results };
    }),

  // Sync project context to memory
  memorySyncProject: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { getMemoryManager } = await import("./integrations/openclaw/memory");
      const memory = getMemoryManager();

      const success = await memory.syncProjectContext(input.projectId);

      return { success };
    }),

  // Store task decision
  memoryStoreDecision: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      decision: z.string().min(1).max(2000),
      reasoning: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { getMemoryManager } = await import("./integrations/openclaw/memory");
      const memory = getMemoryManager();

      const success = await memory.storeTaskDecision(
        input.taskId,
        input.decision,
        input.reasoning
      );

      return { success };
    }),

  // Get task context from memory
  memoryGetTaskContext: protectedProcedure
    .input(z.object({
      taskId: z.number(),
    }))
    .query(async ({ input }) => {
      const { getMemoryManager } = await import("./integrations/openclaw/memory");
      const memory = getMemoryManager();

      const context = await memory.getTaskContext(input.taskId);

      return { context };
    }),

  // Get project context from memory
  memoryGetProjectContext: protectedProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ input }) => {
      const { getMemoryManager } = await import("./integrations/openclaw/memory");
      const memory = getMemoryManager();

      const context = await memory.getProjectContext(input.projectId);

      return { context };
    }),
});
