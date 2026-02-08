/**
 * Usage Router - Cost tracking, model selection, and activity feed
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, desc, and, gte, sql, count, isNotNull } from "drizzle-orm";

const { userCredits, aiRequestLogs, modelPricing, activityLog, aiSettings, platformApiKeys, modelComparisons } = schema;

export const usageRouter = router({
  // Get current user's credit balance and stats
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const credits = await db.select().from(userCredits).where(eq(userCredits.userId, ctx.user.id)).limit(1).then((r: schema.UserCredits[]) => r[0]);

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
    const credits = await db.select().from(userCredits).where(eq(userCredits.userId, ctx.user.id)).limit(1).then((r: schema.UserCredits[]) => r[0]);
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
      return models.filter((m: schema.ModelPricing) => {
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
      return models.filter((m: schema.ModelPricing) => {
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

  // Compare multiple AI models with the same prompt
  compareModels: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      modelIds: z.array(z.number()).min(2).max(4),
      systemPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      // Get selected models with pricing
      const models = await db
        .select()
        .from(modelPricing)
        .where(
          sql`${modelPricing.id} IN (${sql.join(input.modelIds.map(id => sql`${id}`), sql`, `)})`
        );

      if (models.length === 0) {
        throw new Error('No valid models selected');
      }

      // Check user credits
      const credits = await db.select().from(userCredits).where(eq(userCredits.userId, ctx.user.id)).limit(1).then((r: schema.UserCredits[]) => r[0]);
      const totalEstimatedCost = models.reduce((sum: number, m: schema.ModelPricing) => sum + (parseFloat(m.inputCostPer1K) || 1), 0);
      
      if (!credits?.useBYOK && (credits?.credits || 0) < totalEstimatedCost) {
        throw new Error(`Insufficient credits. Need ${totalEstimatedCost}, have ${credits?.credits || 0}`);
      }

      // Call all models in parallel
      const results = await Promise.allSettled(
        models.map(async (model: schema.ModelPricing) => {
          const startTime = Date.now();
          try {
            // Use the built-in LLM API with model specification
            const { invokeLLM } = await import('./_core/llm');
            const response = await invokeLLM({
              messages: [
                ...(input.systemPrompt ? [{ role: 'system' as const, content: input.systemPrompt }] : []),
                { role: 'user' as const, content: input.prompt },
              ],
            });

            const endTime = Date.now();
            const responseTime = endTime - startTime;
            const content = response.choices[0]?.message?.content || '';
            const tokensUsed = response.usage?.total_tokens || 0;

            // Log the request
            await db.insert(aiRequestLogs).values({
              userId: ctx.user.id,
              requestType: 'chat',
              model: model.modelName,
              provider: model.provider,
              tokensUsed,
              creditsCost: parseFloat(model.inputCostPer1K) || 1,
              status: 'success',
              responseTimeMs: responseTime,
            });

            // Deduct credits if not BYOK
            if (!credits?.useBYOK) {
              await db.update(userCredits)
                .set({
                  credits: sql`${userCredits.credits} - ${parseFloat(model.inputCostPer1K) || 1}`,
                  totalSpent: sql`${userCredits.totalSpent} + ${parseFloat(model.inputCostPer1K) || 1}`,
                })
                .where(eq(userCredits.userId, ctx.user.id));
            }

            return {
              modelId: model.id,
              modelName: model.modelName,
              provider: model.provider,
              response: typeof content === 'string' ? content : JSON.stringify(content),
              tokensUsed,
              cost: parseFloat(model.inputCostPer1K) || 1,
              responseTimeMs: responseTime,
              status: 'success' as const,
            };
          } catch (error) {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Log failed request
            await db.insert(aiRequestLogs).values({
              userId: ctx.user.id,
              requestType: 'chat',
              model: model.modelName,
              provider: model.provider,
              tokensUsed: 0,
              creditsCost: 0,
              status: 'error',
              responseTimeMs: responseTime,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
              modelId: model.id,
              modelName: model.modelName,
              provider: model.provider,
              response: '',
              tokensUsed: 0,
              cost: 0,
              responseTimeMs: responseTime,
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      // Process results
      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            modelId: models[index].id,
            modelName: models[index].modelName,
            provider: models[index].provider,
            response: '',
            tokensUsed: 0,
            cost: 0,
            responseTimeMs: 0,
            status: 'error' as const,
            error: result.reason?.message || 'Unknown error',
          };
        }
      });

      // Log activity
      await db.insert(activityLog).values({
        userId: ctx.user.id,
        action: 'ai_comparison' as any,
        entityType: 'ai' as any,
        entityTitle: `Compared ${models.length} models`,
        metadata: {
          models: models.map((m: schema.ModelPricing) => m.modelName),
          prompt: input.prompt.substring(0, 100),
        },
      });

      return {
        prompt: input.prompt,
        results: processedResults,
        totalCost: processedResults.reduce((sum, r) => sum + r.cost, 0),
        totalTokens: processedResults.reduce((sum, r) => sum + r.tokensUsed, 0),
      };
    }),

  // Get estimated cost for model comparison
  getComparisonCost: protectedProcedure
    .input(z.object({
      modelIds: z.array(z.number()).min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const models = await db
        .select({
          id: modelPricing.id,
          modelName: modelPricing.modelName,
          provider: modelPricing.provider,
          inputCostPer1K: modelPricing.inputCostPer1K,
        })
        .from(modelPricing)
        .where(
          sql`${modelPricing.id} IN (${sql.join(input.modelIds.map(id => sql`${id}`), sql`, `)})`
        );

      const totalCost = models.reduce((sum: number, m: { id: number; modelName: string; provider: string; inputCostPer1K: string }) => sum + (parseFloat(m.inputCostPer1K) || 1), 0);

      return {
        models: models.map((m: { id: number; modelName: string; provider: string; inputCostPer1K: string }) => ({
          id: m.id,
          name: m.modelName,
          provider: m.provider,
          cost: parseFloat(m.inputCostPer1K) || 1,
        })),
        totalCost,
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

  // Save a model comparison result
  saveComparison: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      title: z.string().optional(),
      results: z.array(z.object({
        modelId: z.string(),
        modelName: z.string(),
        provider: z.string(),
        response: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        cost: z.number(),
        responseTime: z.number(),
      })),
      totalCost: z.number(),
      preferredModel: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const [result] = await db.insert(modelComparisons).values({
        userId: ctx.user.id,
        prompt: input.prompt,
        title: input.title || `Comparison: ${input.prompt.substring(0, 50)}...`,
        results: input.results,
        totalCost: input.totalCost.toFixed(4),
        modelsCompared: input.results.length,
        preferredModel: input.preferredModel,
        notes: input.notes,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Get user's saved comparisons
  getSavedComparisons: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const comparisons = await db
        .select()
        .from(modelComparisons)
        .where(eq(modelComparisons.userId, ctx.user.id))
        .orderBy(desc(modelComparisons.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      const [{ total }] = await db
        .select({ total: count() })
        .from(modelComparisons)
        .where(eq(modelComparisons.userId, ctx.user.id));
      
      return {
        comparisons: comparisons.map((c: schema.ModelComparison) => ({
          id: c.id,
          title: c.title,
          prompt: c.prompt,
          modelsCompared: c.modelsCompared,
          totalCost: parseFloat(c.totalCost || '0'),
          preferredModel: c.preferredModel,
          createdAt: c.createdAt,
        })),
        total,
      };
    }),

  // Get single comparison by ID
  getComparisonById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const [comparison] = await db
        .select()
        .from(modelComparisons)
        .where(and(
          eq(modelComparisons.id, input.id),
          eq(modelComparisons.userId, ctx.user.id)
        ))
        .limit(1);
      
      if (!comparison) {
        throw new Error('Comparison not found');
      }
      
      return {
        id: comparison.id,
        title: comparison.title,
        prompt: comparison.prompt,
        results: comparison.results,
        totalCost: parseFloat(comparison.totalCost || '0'),
        modelsCompared: comparison.modelsCompared,
        preferredModel: comparison.preferredModel,
        notes: comparison.notes,
        createdAt: comparison.createdAt,
      };
    }),

  // Update comparison (add notes, preferred model)
  updateComparison: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      preferredModel: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.preferredModel !== undefined) updateData.preferredModel = input.preferredModel;
      if (input.notes !== undefined) updateData.notes = input.notes;
      
      await db
        .update(modelComparisons)
        .set(updateData)
        .where(and(
          eq(modelComparisons.id, input.id),
          eq(modelComparisons.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),

  // Delete a saved comparison
  deleteComparison: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db
        .delete(modelComparisons)
        .where(and(
          eq(modelComparisons.id, input.id),
          eq(modelComparisons.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),
});
