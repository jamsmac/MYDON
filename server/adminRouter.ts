/**
 * Admin Router - Dashboard stats and admin-only operations
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { eq, sql, and, gte, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminRouter = router({
  /**
   * Get dashboard statistics
   */
  getDashboardStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalUsers: 0,
        usersChange: 0,
        aiRequestsToday: 0,
        aiRequestsChange: 0,
        creditsSpentToday: 0,
        creditsChange: 0,
        activeProjects: 0,
        projectsChange: 0,
        errorsToday: 0,
        errorsChange: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Total users
    const usersResult = await db.select({ count: count() }).from(schema.users);
    const totalUsers = usersResult[0]?.count ?? 0;

    // Active projects
    const projectsResult = await db
      .select({ count: count() })
      .from(schema.projects)
      .where(eq(schema.projects.status, "active"));
    const activeProjects = projectsResult[0]?.count ?? 0;

    // AI requests today (from ai_request_logs)
    let aiRequestsToday = 0;
    let errorsToday = 0;
    try {
      const logsResult = await db
        .select({ count: count() })
        .from(schema.aiRequestLogs)
        .where(gte(schema.aiRequestLogs.createdAt, today));
      aiRequestsToday = logsResult[0]?.count ?? 0;

      const errorsResult = await db
        .select({ count: count() })
        .from(schema.aiRequestLogs)
        .where(
          and(
            gte(schema.aiRequestLogs.createdAt, today),
            eq(schema.aiRequestLogs.status, "error")
          )
        );
      errorsToday = errorsResult[0]?.count ?? 0;
    } catch (e) {
      // Table might not exist
    }

    // Credits spent today
    let creditsSpentToday = 0;
    try {
      const creditsResult = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(schema.creditTransactions)
        .where(
          and(
            gte(schema.creditTransactions.createdAt, today),
            sql`${schema.creditTransactions.amount} < 0`
          )
        );
      creditsSpentToday = Math.abs(creditsResult[0]?.total ?? 0);
    } catch (e) {
      // Table might not exist
    }

    return {
      totalUsers,
      usersChange: 0, // Would need historical data
      aiRequestsToday,
      aiRequestsChange: 0,
      creditsSpentToday,
      creditsChange: 0,
      activeProjects,
      projectsChange: 0,
      errorsToday,
      errorsChange: 0,
    };
  }),

  /**
   * Get system status (API providers)
   */
  getSystemStatus: adminProcedure.query(async () => {
    // Check various services
    const providers = [
      { name: "OpenAI", status: "online" },
      { name: "Anthropic", status: "online" },
      { name: "Database", status: "online" },
    ];

    // Check database connection
    try {
      const db = await getDb();
      if (!db) {
        providers[2].status = "offline";
      }
    } catch {
      providers[2].status = "offline";
    }

    return { providers };
  }),

  /**
   * List all users (admin only)
   */
  listUsers: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { users: [], total: 0 };

      let query = db.select().from(schema.users);
      
      // Note: search would need LIKE clause if implemented
      const users = await query
        .orderBy(desc(schema.users.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const totalResult = await db.select({ count: count() }).from(schema.users);
      const total = totalResult[0]?.count ?? 0;

      return { users, total };
    }),

  /**
   * Update user role
   */
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(schema.users)
        .set({ role: input.role })
        .where(eq(schema.users.id, input.userId));

      return { success: true };
    }),

  /**
   * Get credits overview
   */
  getCreditsOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalCreditsIssued: 0,
        totalCreditsSpent: 0,
        totalCreditsRemaining: 0,
        transactionsToday: 0,
      };
    }

    try {
      // Total credits in system
      const creditsResult = await db
        .select({ total: sql<number>`COALESCE(SUM(credits), 0)` })
        .from(schema.userCredits);
      const totalCreditsRemaining = creditsResult[0]?.total ?? 0;

      // Transactions today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const txResult = await db
        .select({ count: count() })
        .from(schema.creditTransactions)
        .where(gte(schema.creditTransactions.createdAt, today));
      const transactionsToday = txResult[0]?.count ?? 0;

      return {
        totalCreditsIssued: 0, // Would need to track separately
        totalCreditsSpent: 0,
        totalCreditsRemaining,
        transactionsToday,
      };
    } catch {
      return {
        totalCreditsIssued: 0,
        totalCreditsSpent: 0,
        totalCreditsRemaining: 0,
        transactionsToday: 0,
      };
    }
  }),

  /**
   * Add credits to user
   */
  addCreditsToUser: adminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().min(1),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Update user credits
      await db
        .update(schema.userCredits)
        .set({
          credits: sql`${schema.userCredits.credits} + ${input.amount}`,
        })
        .where(eq(schema.userCredits.userId, input.userId));

      // Log transaction
      await db.insert(schema.creditTransactions).values({
        userId: input.userId,
        amount: input.amount,
        balance: 0, // Will be updated by trigger or next query
        type: "bonus",
        description: input.reason || "Admin credit grant",
      });

      return { success: true };
    }),
});

export type AdminRouter = typeof adminRouter;
