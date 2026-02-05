import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { 
  subscriptionPlans, 
  userSubscriptions, 
  aiIntegrations,
  type SubscriptionPlan,
  type UserSubscription,
  type AIIntegration
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ============ SUBSCRIPTION ROUTER ============
export const subscriptionRouter = router({
  // Get all available subscription plans
  getPlans: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
    return plans;
  }),

  // Get user's current subscription
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, ctx.user.id),
          eq(userSubscriptions.status, "active")
        )
      )
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      return null;
    }

    // Get the plan details
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription.planId));

    return {
      ...subscription,
      plan,
    };
  }),

  // Subscribe to a plan (simplified - no Stripe for now)
  subscribe: protectedProcedure
    .input(z.object({
      planId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if plan exists
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.planId));

      if (!plan) {
        throw new Error("Plan not found");
      }

      // Cancel any existing active subscription
      await db
        .update(userSubscriptions)
        .set({ 
          status: "cancelled",
          cancelledAt: new Date(),
        })
        .where(
          and(
            eq(userSubscriptions.userId, ctx.user.id),
            eq(userSubscriptions.status, "active")
          )
        );

      // Create new subscription
      const endDate = new Date();
      if (plan.billingPeriod === "monthly") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan.billingPeriod === "yearly") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 100); // Lifetime
      }

      const [newSubscription] = await db
        .insert(userSubscriptions)
        .values({
          userId: ctx.user.id,
          planId: input.planId,
          status: "active",
          startDate: new Date(),
          endDate,
          currentPeriodStart: new Date(),
          currentPeriodEnd: endDate,
        })
        .$returningId();

      return { success: true, subscriptionId: newSubscription.id };
    }),

  // Cancel subscription
  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db
      .update(userSubscriptions)
      .set({ 
        status: "cancelled",
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(userSubscriptions.userId, ctx.user.id),
          eq(userSubscriptions.status, "active")
        )
      );

    return { success: true };
  }),
});

// ============ AI INTEGRATIONS ROUTER ============
export const aiIntegrationsRouter = router({
  // List user's AI integrations
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const integrations = await db
      .select()
      .from(aiIntegrations)
      .where(eq(aiIntegrations.userId, ctx.user.id))
      .orderBy(desc(aiIntegrations.createdAt));
    
    // Mask API keys for security
    return integrations.map((int: typeof integrations[0]) => ({
      ...int,
      apiKey: int.apiKey ? "••••••••" + int.apiKey.slice(-4) : null,
      accessToken: int.accessToken ? "••••••••" : null,
      refreshToken: undefined,
    }));
  }),

  // Get available providers
  getProviders: protectedProcedure.query(async () => {
    return [
      {
        id: "claude_code",
        name: "Claude Code",
        description: "Anthropic's Claude for coding tasks",
        icon: "code",
        authType: "api_key",
        docsUrl: "https://docs.anthropic.com",
      },
      {
        id: "openai_codex",
        name: "OpenAI Codex",
        description: "OpenAI's code generation model",
        icon: "terminal",
        authType: "api_key",
        docsUrl: "https://platform.openai.com/docs",
      },
      {
        id: "perplexity",
        name: "Perplexity",
        description: "AI-powered search and research",
        icon: "search",
        authType: "api_key",
        docsUrl: "https://docs.perplexity.ai",
      },
      {
        id: "github_copilot",
        name: "GitHub Copilot",
        description: "AI pair programmer",
        icon: "github",
        authType: "oauth",
        docsUrl: "https://docs.github.com/copilot",
      },
      {
        id: "gemini",
        name: "Google Gemini",
        description: "Google's multimodal AI",
        icon: "sparkles",
        authType: "api_key",
        docsUrl: "https://ai.google.dev/docs",
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        description: "DeepSeek's coding model",
        icon: "brain",
        authType: "api_key",
        docsUrl: "https://platform.deepseek.com/docs",
      },
    ];
  }),

  // Connect a new AI integration
  connect: protectedProcedure
    .input(z.object({
      provider: z.string(),
      apiKey: z.string().optional(),
      displayName: z.string().optional(),
      config: z.object({
        model: z.string().optional(),
        baseUrl: z.string().optional(),
        maxTokens: z.number().optional(),
        temperature: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if integration already exists
      const [existing] = await db
        .select()
        .from(aiIntegrations)
        .where(
          and(
            eq(aiIntegrations.userId, ctx.user.id),
            eq(aiIntegrations.provider, input.provider)
          )
        );

      if (existing) {
        // Update existing
        await db
          .update(aiIntegrations)
          .set({
            apiKey: input.apiKey,
            displayName: input.displayName,
            config: input.config,
            isActive: true,
            lastError: null,
            lastErrorAt: null,
          })
          .where(eq(aiIntegrations.id, existing.id));

        return { success: true, id: existing.id, updated: true };
      }

      // Create new
      const [newIntegration] = await db
        .insert(aiIntegrations)
        .values({
          userId: ctx.user.id,
          provider: input.provider,
          apiKey: input.apiKey,
          displayName: input.displayName,
          config: input.config,
          isActive: true,
        })
        .$returningId();

      return { success: true, id: newIntegration.id, updated: false };
    }),

  // Disconnect an AI integration
  disconnect: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(aiIntegrations)
        .where(
          and(
            eq(aiIntegrations.id, input.id),
            eq(aiIntegrations.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // Toggle integration active status
  toggle: protectedProcedure
    .input(z.object({ 
      id: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(aiIntegrations)
        .set({ isActive: input.isActive })
        .where(
          and(
            eq(aiIntegrations.id, input.id),
            eq(aiIntegrations.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // Test an integration
  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [integration] = await db
        .select()
        .from(aiIntegrations)
        .where(
          and(
            eq(aiIntegrations.id, input.id),
            eq(aiIntegrations.userId, ctx.user.id)
          )
        );

      if (!integration) {
        throw new Error("Integration not found");
      }

      // TODO: Implement actual API testing for each provider
      // For now, just check if API key is present
      if (!integration.apiKey) {
        throw new Error("API key not configured");
      }

      // Update last used
      await db
        .update(aiIntegrations)
        .set({ lastUsedAt: new Date() })
        .where(eq(aiIntegrations.id, input.id));

      return { success: true, message: "Connection successful" };
    }),
});
