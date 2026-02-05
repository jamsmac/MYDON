import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { apiKeys, apiUsage } from "../drizzle/schema";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import { generateApiKey, API_SCOPES } from "./restApiRouter";

export const apiKeysRouter = router({
  // List user's API keys
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        rateLimit: apiKeys.rateLimit,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(desc(apiKeys.createdAt));

    return keys;
  }),

  // Get API key details with usage stats
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [key] = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          rateLimit: apiKeys.rateLimit,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

      if (!key) {
        throw new Error("API key not found");
      }

      // Get usage stats for last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [usageStats] = await db
        .select({
          totalRequests: count(),
          avgResponseTime: sql<number>`AVG(${apiUsage.responseTime})`,
        })
        .from(apiUsage)
        .where(
          and(
            eq(apiUsage.apiKeyId, input.id),
            gte(apiUsage.createdAt, oneDayAgo)
          )
        );

      // Get hourly usage for rate limit check
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [hourlyUsage] = await db
        .select({ count: count() })
        .from(apiUsage)
        .where(
          and(
            eq(apiUsage.apiKeyId, input.id),
            gte(apiUsage.createdAt, oneHourAgo)
          )
        );

      return {
        ...key,
        usage: {
          last24Hours: usageStats?.totalRequests || 0,
          avgResponseTime: Math.round(usageStats?.avgResponseTime || 0),
          currentHour: hourlyUsage?.count || 0,
          rateLimitRemaining: Math.max(0, (key.rateLimit || 1000) - (hourlyUsage?.count || 0)),
        },
      };
    }),

  // Create new API key
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      scopes: z.array(z.enum(API_SCOPES)).min(1),
      rateLimit: z.number().min(100).max(10000).default(1000),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check max API keys limit (10 per user)
      const [existingCount] = await db
        .select({ count: count() })
        .from(apiKeys)
        .where(eq(apiKeys.userId, ctx.user.id));

      if (existingCount && existingCount.count >= 10) {
        throw new Error("Maximum API keys limit reached (10)");
      }

      const { key, hash, prefix } = generateApiKey();

      const [result] = await db.insert(apiKeys).values({
        userId: ctx.user.id,
        name: input.name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes: input.scopes,
        rateLimit: input.rateLimit,
        expiresAt: input.expiresAt || null,
        isActive: true,
      });

      return {
        id: result.insertId,
        key, // Return full key only on creation - user must save it
        prefix,
        name: input.name,
        scopes: input.scopes,
        rateLimit: input.rateLimit,
        expiresAt: input.expiresAt,
      };
    }),

  // Update API key
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
      rateLimit: z.number().min(100).max(10000).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...data } = input;

      await db
        .update(apiKeys)
        .set(data)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, ctx.user.id)));

      return { success: true };
    }),

  // Regenerate API key
  regenerate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { key, hash, prefix } = generateApiKey();

      await db
        .update(apiKeys)
        .set({
          keyHash: hash,
          keyPrefix: prefix,
          lastUsedAt: null,
        })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

      return { key, prefix };
    }),

  // Delete API key
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete usage logs first
      await db.delete(apiUsage).where(eq(apiUsage.apiKeyId, input.id));

      // Delete the key
      await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

      return { success: true };
    }),

  // Get usage history
  getUsageHistory: protectedProcedure
    .input(z.object({
      id: z.number(),
      days: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

      if (!key) {
        throw new Error("API key not found");
      }

      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      // Get daily aggregated usage
      const usage = await db
        .select({
          date: sql<string>`DATE(${apiUsage.createdAt})`,
          requests: count(),
          avgResponseTime: sql<number>`AVG(${apiUsage.responseTime})`,
          errors: sql<number>`SUM(CASE WHEN ${apiUsage.statusCode} >= 400 THEN 1 ELSE 0 END)`,
        })
        .from(apiUsage)
        .where(
          and(
            eq(apiUsage.apiKeyId, input.id),
            gte(apiUsage.createdAt, startDate)
          )
        )
        .groupBy(sql`DATE(${apiUsage.createdAt})`)
        .orderBy(sql`DATE(${apiUsage.createdAt})`);

      return usage;
    }),

  // Get endpoint breakdown
  getEndpointStats: protectedProcedure
    .input(z.object({
      id: z.number(),
      days: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

      if (!key) {
        throw new Error("API key not found");
      }

      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const stats = await db
        .select({
          endpoint: apiUsage.endpoint,
          method: apiUsage.method,
          requests: count(),
          avgResponseTime: sql<number>`AVG(${apiUsage.responseTime})`,
          errors: sql<number>`SUM(CASE WHEN ${apiUsage.statusCode} >= 400 THEN 1 ELSE 0 END)`,
        })
        .from(apiUsage)
        .where(
          and(
            eq(apiUsage.apiKeyId, input.id),
            gte(apiUsage.createdAt, startDate)
          )
        )
        .groupBy(apiUsage.endpoint, apiUsage.method)
        .orderBy(desc(count()));

      return stats;
    }),
});
