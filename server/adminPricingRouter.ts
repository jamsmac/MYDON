import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { 
  pricingPlans,
  modelPricing,
  users,
} from "../drizzle/schema";
import { eq, desc, asc, sql } from "drizzle-orm";

export const adminPricingRouter = router({
  // ============ PRICING PLANS ============

  // Get all pricing plans
  getPlans: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const plans = await db
      .select()
      .from(pricingPlans)
      .orderBy(asc(pricingPlans.displayOrder));

    // Get user count per plan
    const userCounts = await db
      .select({
        plan: users.subscriptionPlan,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.subscriptionPlan);

    const countMap = Object.fromEntries(
      userCounts.map(u => [u.plan, u.count])
    );

    return plans.map(plan => ({
      ...plan,
      userCount: countMap[plan.slug] || 0,
    }));
  }),

  // Get single plan
  getPlan: adminProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [plan] = await db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.id, input.planId))
        .limit(1);

      return plan;
    }),

  // Create pricing plan
  createPlan: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      nameRu: z.string().optional(),
      slug: z.string().min(2),
      description: z.string().optional(),
      descriptionRu: z.string().optional(),
      priceMonthly: z.number().default(0),
      priceYearly: z.number().default(0),
      currency: z.string().default("USD"),
      creditsPerMonth: z.number().default(1000),
      maxProjects: z.number().default(5),
      maxUsers: z.number().default(1),
      maxStorage: z.number().default(100),
      features: z.object({
        aiModels: z.array(z.string()).default([]),
        prioritySupport: z.boolean().default(false),
        customBranding: z.boolean().default(false),
        apiAccess: z.boolean().default(false),
        advancedAnalytics: z.boolean().default(false),
        exportFormats: z.array(z.string()).default(["md", "json"]),
      }).optional(),
      color: z.string().default("#6366f1"),
      icon: z.string().default("star"),
      isPopular: z.boolean().default(false),
      displayOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [plan] = await db
        .insert(pricingPlans)
        .values({
          name: input.name,
          nameRu: input.nameRu,
          slug: input.slug,
          description: input.description,
          descriptionRu: input.descriptionRu,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          currency: input.currency,
          creditsPerMonth: input.creditsPerMonth,
          maxProjects: input.maxProjects,
          maxUsers: input.maxUsers,
          maxStorage: input.maxStorage,
          features: input.features,
          color: input.color,
          icon: input.icon,
          isPopular: input.isPopular,
          displayOrder: input.displayOrder,
          isSystem: false,
        })
        .$returningId();

      return { success: true, planId: plan.id };
    }),

  // Update pricing plan
  updatePlan: adminProcedure
    .input(z.object({
      planId: z.number(),
      name: z.string().min(2).optional(),
      nameRu: z.string().optional(),
      description: z.string().optional(),
      descriptionRu: z.string().optional(),
      priceMonthly: z.number().optional(),
      priceYearly: z.number().optional(),
      creditsPerMonth: z.number().optional(),
      maxProjects: z.number().optional(),
      maxUsers: z.number().optional(),
      maxStorage: z.number().optional(),
      features: z.object({
        aiModels: z.array(z.string()),
        prioritySupport: z.boolean(),
        customBranding: z.boolean(),
        apiAccess: z.boolean(),
        advancedAnalytics: z.boolean(),
        exportFormats: z.array(z.string()),
      }).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      isPopular: z.boolean().optional(),
      isActive: z.boolean().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.nameRu !== undefined) updateData.nameRu = input.nameRu;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.descriptionRu !== undefined) updateData.descriptionRu = input.descriptionRu;
      if (input.priceMonthly !== undefined) updateData.priceMonthly = input.priceMonthly;
      if (input.priceYearly !== undefined) updateData.priceYearly = input.priceYearly;
      if (input.creditsPerMonth !== undefined) updateData.creditsPerMonth = input.creditsPerMonth;
      if (input.maxProjects !== undefined) updateData.maxProjects = input.maxProjects;
      if (input.maxUsers !== undefined) updateData.maxUsers = input.maxUsers;
      if (input.maxStorage !== undefined) updateData.maxStorage = input.maxStorage;
      if (input.features !== undefined) updateData.features = input.features;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.isPopular !== undefined) updateData.isPopular = input.isPopular;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      await db
        .update(pricingPlans)
        .set(updateData)
        .where(eq(pricingPlans.id, input.planId));

      return { success: true };
    }),

  // Delete pricing plan
  deletePlan: adminProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if system plan
      const [plan] = await db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.id, input.planId))
        .limit(1);

      if (plan?.isSystem) {
        throw new Error("Cannot delete system plans");
      }

      await db.delete(pricingPlans).where(eq(pricingPlans.id, input.planId));

      return { success: true };
    }),

  // ============ MODEL PRICING ============

  // Get all model pricing
  getModelPricing: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const models = await db
      .select()
      .from(modelPricing)
      .orderBy(asc(modelPricing.displayOrder));

    return models;
  }),

  // Create model pricing
  createModelPricing: adminProcedure
    .input(z.object({
      modelName: z.string().min(2),
      modelDisplayName: z.string().optional(),
      provider: z.string().min(2),
      inputCostPer1K: z.string().default("1.0000"),
      outputCostPer1K: z.string().default("2.0000"),
      planRestrictions: z.object({
        allowedPlanIds: z.array(z.number()),
        minPlanLevel: z.string(),
      }).optional(),
      capabilities: z.object({
        maxTokens: z.number(),
        supportsVision: z.boolean(),
        supportsStreaming: z.boolean(),
        supportsFunctionCalling: z.boolean(),
      }).optional(),
      displayOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [model] = await db
        .insert(modelPricing)
        .values({
          modelName: input.modelName,
          modelDisplayName: input.modelDisplayName,
          provider: input.provider,
          inputCostPer1K: input.inputCostPer1K,
          outputCostPer1K: input.outputCostPer1K,
          planRestrictions: input.planRestrictions,
          capabilities: input.capabilities,
          displayOrder: input.displayOrder,
          isEnabled: true,
        })
        .$returningId();

      return { success: true, modelId: model.id };
    }),

  // Update model pricing
  updateModelPricing: adminProcedure
    .input(z.object({
      modelId: z.number(),
      modelDisplayName: z.string().optional(),
      inputCostPer1K: z.string().optional(),
      outputCostPer1K: z.string().optional(),
      planRestrictions: z.object({
        allowedPlanIds: z.array(z.number()),
        minPlanLevel: z.string(),
      }).optional(),
      capabilities: z.object({
        maxTokens: z.number(),
        supportsVision: z.boolean(),
        supportsStreaming: z.boolean(),
        supportsFunctionCalling: z.boolean(),
      }).optional(),
      isEnabled: z.boolean().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, unknown> = {};
      
      if (input.modelDisplayName !== undefined) updateData.modelDisplayName = input.modelDisplayName;
      if (input.inputCostPer1K !== undefined) updateData.inputCostPer1K = input.inputCostPer1K;
      if (input.outputCostPer1K !== undefined) updateData.outputCostPer1K = input.outputCostPer1K;
      if (input.planRestrictions !== undefined) updateData.planRestrictions = input.planRestrictions;
      if (input.capabilities !== undefined) updateData.capabilities = input.capabilities;
      if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;

      await db
        .update(modelPricing)
        .set(updateData)
        .where(eq(modelPricing.id, input.modelId));

      return { success: true };
    }),

  // Delete model pricing
  deleteModelPricing: adminProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(modelPricing).where(eq(modelPricing.id, input.modelId));

      return { success: true };
    }),

  // Toggle model enabled status
  toggleModelEnabled: adminProcedure
    .input(z.object({
      modelId: z.number(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(modelPricing)
        .set({ isEnabled: input.isEnabled })
        .where(eq(modelPricing.id, input.modelId));

      return { success: true };
    }),

  // Get comparison table for plans
  getPlansComparison: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const plans = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(asc(pricingPlans.displayOrder));

    // Build comparison matrix
    const features = [
      { key: "creditsPerMonth", label: "Кредитов в месяц", labelEn: "Credits/month" },
      { key: "maxProjects", label: "Макс. проектов", labelEn: "Max projects" },
      { key: "maxUsers", label: "Пользователей", labelEn: "Team members" },
      { key: "maxStorage", label: "Хранилище (МБ)", labelEn: "Storage (MB)" },
      { key: "prioritySupport", label: "Приоритетная поддержка", labelEn: "Priority support" },
      { key: "customBranding", label: "Кастомный брендинг", labelEn: "Custom branding" },
      { key: "apiAccess", label: "API доступ", labelEn: "API access" },
      { key: "advancedAnalytics", label: "Расширенная аналитика", labelEn: "Advanced analytics" },
    ];

    return {
      plans,
      features,
    };
  }),
});
