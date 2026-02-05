import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserUsageStats, checkProjectLimit, checkAiRequestLimit } from "./limitsService";
import { getPlanLimits } from "./config";

export const limitsRouter = router({
  // Get current user's usage statistics
  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    return getUserUsageStats(ctx.user.id);
  }),

  // Check if user can create a new project
  canCreateProject: protectedProcedure.query(async ({ ctx }) => {
    return checkProjectLimit(ctx.user.id);
  }),

  // Check if user can make an AI request
  canMakeAiRequest: protectedProcedure.query(async ({ ctx }) => {
    return checkAiRequestLimit(ctx.user.id);
  }),

  // Get plan limits configuration
  getPlanLimits: protectedProcedure
    .input(z.object({ plan: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const plan = input.plan || ctx.user.subscriptionPlan || 'free';
      return getPlanLimits(plan);
    }),
});
