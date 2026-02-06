/**
 * Usage Router - Cost tracking, model selection, and activity feed
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, desc, and, gte, sql, count, isNotNull } from "drizzle-orm";

const { userCredits, aiRequestLogs, modelPricing, activityLog, aiSettings, platformApiKeys } = schema;

export const usageRouter = router({
  // Get current user's credit balance and stats
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const credits = await db.select().from(userCredits).where(eq(userCredits.userId, ctx.user.id)).limit(1).then(r => r[0]);

    if (!credits) {
      // Create default credits for new user
      await db.insert(userCredits).values({
        userId: ctx.user.id,
        credits: 1000,
        totalEarned: 1000,
        totalSpent: 0,
        useBYOK: false,
      });
      return {
        credits: 1000,
        totalEarned: 1000,
        totalSpent: 0,
        useBYOK: false,
      };
    }

    return {
      credits: credits.credits,
      totalEarned: credits.totalEarned,
      totalSpent: credits.totalSpent,
      useBYOK: credits.useBYOK,
    };
  }),

  // Get spending history for last N days
  getSpendingHistory: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const logs = await db
        .select({
          date: sql<string>`DATE(${aiRequestLogs.createdAt})`.as("date"),
          totalCost: sql<number>`COALESCE(SUM(${aiRequestLogs.creditsCost}), 0)`.as("totalCost"),
          requestCount: count(),
        })
        .from(aiRequestLogs)
        .where(
          and(
            eq(aiRequestLogs.userId, ctx.user.id),
            gte(aiRequestLogs.createdAt, startDate)
          )
        )
        .groupBy(sql`DATE(${aiRequestLogs.createdAt})`)
        .orderBy(sql`DATE(${aiRequestLogs.createdAt})`);

      return logs;
    }),

  // Get recent AI requests with details
  getRecentRequests: protectedProcedure
    .input(z.object({ 
      limit: z.number().default(20),
      offset: z.number().default(0)
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const requests = await db
        .select({
          id: aiRequestLogs.id,
          requestType: aiRequestLogs.requestType,
          model: aiRequestLogs.model,
          provider: aiRequestLogs.provider,
          tokensUsed: aiRequestLogs.tokensUsed,
          creditsCost: aiRequestLogs.creditsCost,
          status: aiRequestLogs.status,
          createdAt: aiRequestLogs.createdAt,
        })
        .from(aiRequestLogs)
        .where(eq(aiRequestLogs.userId, ctx.user.id))
        .orderBy(desc(aiRequestLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const totalCount = await db
        .select({ count: count() })
        .from(aiRequestLogs)
        .where(eq(aiRequestLogs.userId, ctx.user.id));

      return {
        requests,
        total: totalCount[0]?.count || 0,
      };
    }),

  // Get usage statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total requests
    const totalRequests = await db
      .select({ count: count() })
      .from(aiRequestLogs)
      .where(eq(aiRequestLogs.userId, ctx.user.id));

    // Requests this month
    const monthlyRequests = await db
      .select({ count: count() })
      .from(aiRequestLogs)
      .where(
        and(
          eq(aiRequestLogs.userId, ctx.user.id),
          gte(aiRequestLogs.createdAt, thirtyDaysAgo)
        )
      );

    // Average cost per request
    const avgCost = await db
      .select({ 
        avg: sql<number>`COALESCE(AVG(${aiRequestLogs.creditsCost}), 0)`.as("avg") 
      })
      .from(aiRequestLogs)
      .where(eq(aiRequestLogs.userId, ctx.user.id));

    // Most used model
    const mostUsedModel = await db
      .select({
        model: aiRequestLogs.model,
        count: count(),
      })
      .from(aiRequestLogs)
      .where(
        and(
          eq(aiRequestLogs.userId, ctx.user.id),
          isNotNull(aiRequestLogs.model)
        )
      )
      .groupBy(aiRequestLogs.model)
      .orderBy(desc(count()))
      .limit(1);

    // Total tokens used
    const totalTokens = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${aiRequestLogs.tokensUsed}), 0)`.as("total") 
      })
      .from(aiRequestLogs)
      .where(eq(aiRequestLogs.userId, ctx.user.id));

    return {
      totalRequests: totalRequests[0]?.count || 0,
      monthlyRequests: monthlyRequests[0]?.count || 0,
      avgCostPerRequest: Number(avgCost[0]?.avg || 0).toFixed(2),
      mostUsedModel: mostUsedModel[0]?.model || "N/A",
      totalTokensUsed: totalTokens[0]?.total || 0,
    };
  }),

  // Get available models for selection
  getAvailableModels: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    // Check if user is in BYOK mode
    const credits = await db.select().from(userCredits).where(eq(userCredits.userId, ctx.user.id)).limit(1).then(r => r[0]);
    const useBYOK = credits?.useBYOK || false;

    // Get all enabled models with pricing
    const models = await db
      .select()
      .from(modelPricing)
      .where(eq(modelPricing.isEnabled, true))
      .orderBy(modelPricing.displayOrder);

    if (useBYOK) {
      // Get user's configured providers
      const userProviders = await db
        .select({ provider: aiSettings.provider })
        .from(aiSettings)
        .where(
          and(
            eq(aiSettings.userId, ctx.user.id),
            eq(aiSettings.isEnabled, true)
          )
        );
      
      const userProviderSet = new Set(userProviders.map((p: { provider: string }) => p.provider));
      
      // Filter models to only those with user's configured providers
      return models.filter((m) => {
        const providerLower = m.provider.toLowerCase();
        return userProviderSet.has(providerLower) || 
               userProviderSet.has("openai") && providerLower.includes("gpt") ||
               userProviderSet.has("anthropic") && providerLower.includes("claude") ||
               userProviderSet.has("google") && providerLower.includes("gemini");
      });
    } else {
      // Platform mode - check which providers have global keys
      const platformKeys = await db
        .select({ provider: platformApiKeys.provider })
        .from(platformApiKeys)
        .where(eq(platformApiKeys.isEnabled, true));
      
      const platformProviderSet = new Set(platformKeys.map((p: { provider: string }) => p.provider));
      
      // If no platform keys configured, return all models
      if (platformProviderSet.size === 0) {
        return models;
      }
      
      // Filter models to only those with platform keys
      return models.filter((m) => {
        const providerLower = m.provider.toLowerCase();
        return platformProviderSet.has(providerLower) ||
               platformProviderSet.has("openai") && providerLower.includes("gpt") ||
               platformProviderSet.has("anthropic") && providerLower.includes("claude") ||
               platformProviderSet.has("google") && providerLower.includes("gemini");
      });
    }
  }),

  // Get activity feed for user
  getActivityFeed: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
      filter: z.enum(["all", "projects", "tasks", "ai", "decisions"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      let whereConditions: any[] = [eq(activityLog.userId, ctx.user.id)];

      // Apply filter
      if (input.filter === "projects") {
        whereConditions.push(
          sql`${activityLog.action} IN ('project_created', 'project_updated')`
        );
      } else if (input.filter === "tasks") {
        whereConditions.push(
          sql`${activityLog.action} IN ('task_created', 'task_completed', 'task_updated', 'task_deleted')`
        );
      } else if (input.filter === "ai") {
        whereConditions.push(
          sql`${activityLog.action} IN ('ai_request', 'ai_analysis', 'ai_code_generation')`
        );
      } else if (input.filter === "decisions") {
        whereConditions.push(
          sql`${activityLog.action} IN ('decision_created', 'decision_finalized')`
        );
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      const activities = await db!
        .select()
        .from(activityLog)
        .where(whereClause)
        .orderBy(desc(activityLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const totalCount = await db!
        .select({ count: count() })
        .from(activityLog)
        .where(whereClause);

      return {
        activities,
        total: totalCount[0]?.count || 0,
      };
    }),

  // Log an activity
  logActivity: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.number().optional(),
      entityTitle: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.insert(activityLog).values({
        userId: ctx.user.id,
        projectId: input.projectId,
        action: input.action as any,
        entityType: input.entityType as any,
        entityId: input.entityId,
        entityTitle: input.entityTitle,
        metadata: input.metadata,
      });
      return { success: true };
    }),
});
