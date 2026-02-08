/**
 * Admin Model Ratings Router
 * Manages AI model ratings and task assignments
 */

import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import {
  aiModelRatings,
  aiModelTaskAssignments,
  aiRequestLogs,
  aiAgents,
  aiSkills,
} from "../drizzle/schema";
import { eq, sql, desc, and } from "drizzle-orm";

// Default models to seed
const DEFAULT_MODELS = [
  { modelName: "google/gemini-2.0-flash-001", provider: "google", overallRating: 80 },
  { modelName: "google/gemini-2.5-pro-preview", provider: "google", overallRating: 88 },
  { modelName: "anthropic/claude-3.5-sonnet", provider: "anthropic", overallRating: 92 },
  { modelName: "anthropic/claude-3-haiku", provider: "anthropic", overallRating: 75 },
  { modelName: "openai/gpt-4o", provider: "openai", overallRating: 90 },
  { modelName: "openai/gpt-4o-mini", provider: "openai", overallRating: 78 },
  { modelName: "meta-llama/llama-3.3-70b-instruct", provider: "meta", overallRating: 82 },
  { modelName: "mistralai/mistral-large-latest", provider: "mistral", overallRating: 80 },
  { modelName: "deepseek/deepseek-chat", provider: "deepseek", overallRating: 76 },
];

// Default task assignments
const DEFAULT_TASK_ASSIGNMENTS = [
  { taskCategory: "roadmap", entityType: "block" as const, primaryModelName: "anthropic/claude-3.5-sonnet" },
  { taskCategory: "decompose", entityType: "block" as const, primaryModelName: "anthropic/claude-3.5-sonnet" },
  { taskCategory: "risks", entityType: "any" as const, primaryModelName: "openai/gpt-4o" },
  { taskCategory: "report", entityType: "block" as const, primaryModelName: "google/gemini-2.0-flash-001" },
  { taskCategory: "tasks", entityType: "section" as const, primaryModelName: "anthropic/claude-3.5-sonnet" },
  { taskCategory: "plan", entityType: "section" as const, primaryModelName: "anthropic/claude-3.5-sonnet" },
  { taskCategory: "subtasks", entityType: "task" as const, primaryModelName: "google/gemini-2.0-flash-001" },
  { taskCategory: "spec", entityType: "task" as const, primaryModelName: "anthropic/claude-3.5-sonnet" },
  { taskCategory: "estimate", entityType: "task" as const, primaryModelName: "openai/gpt-4o" },
  { taskCategory: "chat", entityType: "any" as const, primaryModelName: "google/gemini-2.0-flash-001" },
];

export const adminModelRatingsRouter = router({
  /**
   * List all model ratings
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const ratings = await db.select().from(aiModelRatings).orderBy(desc(aiModelRatings.overallRating));

    // If empty, seed with defaults
    if (ratings.length === 0) {
      for (const model of DEFAULT_MODELS) {
        await db.insert(aiModelRatings).values(model);
      }
      return db.select().from(aiModelRatings).orderBy(desc(aiModelRatings.overallRating));
    }

    return ratings;
  }),

  /**
   * Get a single model rating
   */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const [rating] = await db.select().from(aiModelRatings).where(eq(aiModelRatings.id, input.id));
      if (!rating) throw new TRPCError({ code: "NOT_FOUND", message: "Model rating not found" });

      return rating;
    }),

  /**
   * Create a new model rating
   */
  create: adminProcedure
    .input(z.object({
      modelName: z.string().min(1).max(128),
      provider: z.string().min(1).max(64),
      overallRating: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const [result] = await db.insert(aiModelRatings).values({
        modelName: input.modelName,
        provider: input.provider,
        overallRating: input.overallRating ?? 50,
      });

      return { id: result.insertId };
    }),

  /**
   * Update model ratings
   */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      ratingReasoning: z.number().min(0).max(100).optional(),
      ratingCoding: z.number().min(0).max(100).optional(),
      ratingCreative: z.number().min(0).max(100).optional(),
      ratingTranslation: z.number().min(0).max(100).optional(),
      ratingSummarization: z.number().min(0).max(100).optional(),
      ratingPlanning: z.number().min(0).max(100).optional(),
      ratingRiskAnalysis: z.number().min(0).max(100).optional(),
      ratingDataAnalysis: z.number().min(0).max(100).optional(),
      ratingDocumentation: z.number().min(0).max(100).optional(),
      ratingChat: z.number().min(0).max(100).optional(),
      overallRating: z.number().min(0).max(100).optional(),
      speedRating: z.number().min(0).max(100).optional(),
      costEfficiency: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const { id, ...updates } = input;

      // Filter out undefined values
      const filteredUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return { success: true };
      }

      // Also update ratingSource to 'manual' when ratings are changed manually
      filteredUpdates.ratingSource = "manual";

      await db.update(aiModelRatings)
        .set(filteredUpdates)
        .where(eq(aiModelRatings.id, id));

      return { success: true };
    }),

  /**
   * Delete a model rating
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      await db.delete(aiModelRatings).where(eq(aiModelRatings.id, input.id));
      return { success: true };
    }),

  /**
   * Get task assignments
   */
  getAssignments: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const assignments = await db.select().from(aiModelTaskAssignments).orderBy(aiModelTaskAssignments.taskCategory);

    // If empty, seed with defaults
    if (assignments.length === 0) {
      for (const assignment of DEFAULT_TASK_ASSIGNMENTS) {
        await db.insert(aiModelTaskAssignments).values({
          ...assignment,
          selectionReason: "Default assignment",
        });
      }
      return db.select().from(aiModelTaskAssignments).orderBy(aiModelTaskAssignments.taskCategory);
    }

    // Join with agents and skills names
    const agents = await db.select({ id: aiAgents.id, name: aiAgents.name }).from(aiAgents);
    const skills = await db.select({ id: aiSkills.id, name: aiSkills.name }).from(aiSkills);

    const agentsMap = new Map(agents.map((a: { id: number; name: string | null }) => [a.id, a.name]));
    const skillsMap = new Map(skills.map((s: { id: number; name: string }) => [s.id, s.name]));

    return assignments.map((a: typeof assignments[number]) => ({
      ...a,
      agentName: a.agentId ? agentsMap.get(a.agentId) || null : null,
      skillName: a.skillId ? skillsMap.get(a.skillId) || null : null,
    }));
  }),

  /**
   * Update task assignment
   */
  updateAssignment: adminProcedure
    .input(z.object({
      id: z.number(),
      primaryModelName: z.string().min(1).max(128).optional(),
      fallbackModelName: z.string().max(128).nullable().optional(),
      agentId: z.number().nullable().optional(),
      skillId: z.number().nullable().optional(),
      selectionReason: z.string().max(255).optional(),
      isManualOverride: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const { id, ...updates } = input;

      const filteredUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return { success: true };
      }

      await db.update(aiModelTaskAssignments)
        .set(filteredUpdates)
        .where(eq(aiModelTaskAssignments.id, id));

      return { success: true };
    }),

  /**
   * Create task assignment
   */
  createAssignment: adminProcedure
    .input(z.object({
      taskCategory: z.string().min(1).max(64),
      entityType: z.enum(["project", "block", "section", "task", "any"]),
      primaryModelName: z.string().min(1).max(128),
      fallbackModelName: z.string().max(128).optional(),
      agentId: z.number().optional(),
      skillId: z.number().optional(),
      selectionReason: z.string().max(255).optional(),
      isManualOverride: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const [result] = await db.insert(aiModelTaskAssignments).values(input);
      return { id: result.insertId };
    }),

  /**
   * Delete task assignment
   */
  deleteAssignment: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      await db.delete(aiModelTaskAssignments).where(eq(aiModelTaskAssignments.id, input.id));
      return { success: true };
    }),

  /**
   * Recalculate metrics from ai_request_logs
   */
  recalculateFromLogs: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    // Get aggregated stats per model
    const stats = await db.select({
      model: aiRequestLogs.model,
      avgResponseTimeMs: sql<number>`AVG(${aiRequestLogs.responseTimeMs})`,
      avgTokensPerRequest: sql<number>`AVG(${aiRequestLogs.tokensUsed})`,
      totalRequests: sql<number>`COUNT(*)`,
      successCount: sql<number>`SUM(CASE WHEN ${aiRequestLogs.output} IS NOT NULL AND ${aiRequestLogs.output} != '' THEN 1 ELSE 0 END)`,
    })
      .from(aiRequestLogs)
      .groupBy(aiRequestLogs.model);

    // Update ratings for each model
    for (const stat of stats) {
      if (!stat.model) continue;

      const successRate = stat.totalRequests > 0
        ? Math.round((Number(stat.successCount) / Number(stat.totalRequests)) * 100)
        : 100;

      await db.update(aiModelRatings)
        .set({
          avgResponseTimeMs: Math.round(Number(stat.avgResponseTimeMs) || 0),
          avgTokensPerRequest: Math.round(Number(stat.avgTokensPerRequest) || 0),
          totalRequests: Number(stat.totalRequests) || 0,
          successRate,
          ratingSource: "auto",
        })
        .where(eq(aiModelRatings.modelName, stat.model));
    }

    return { success: true, modelsUpdated: stats.length };
  }),

  /**
   * Get model for task category
   * Used by skill engine for intelligent routing
   */
  getModelForTask: adminProcedure
    .input(z.object({
      taskCategory: z.string(),
      entityType: z.enum(["project", "block", "section", "task", "any"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      // Try exact match first
      let [assignment] = await db.select()
        .from(aiModelTaskAssignments)
        .where(and(
          eq(aiModelTaskAssignments.taskCategory, input.taskCategory),
          eq(aiModelTaskAssignments.entityType, input.entityType || "any"),
          eq(aiModelTaskAssignments.isActive, true),
        ));

      // Fallback to 'any' entity type
      if (!assignment && input.entityType !== "any") {
        [assignment] = await db.select()
          .from(aiModelTaskAssignments)
          .where(and(
            eq(aiModelTaskAssignments.taskCategory, input.taskCategory),
            eq(aiModelTaskAssignments.entityType, "any"),
            eq(aiModelTaskAssignments.isActive, true),
          ));
      }

      if (!assignment) {
        // Return default model
        return { modelName: "google/gemini-2.0-flash-001", agentId: null, skillId: null };
      }

      return {
        modelName: assignment.primaryModelName,
        fallbackModelName: assignment.fallbackModelName,
        agentId: assignment.agentId,
        skillId: assignment.skillId,
      };
    }),
});
