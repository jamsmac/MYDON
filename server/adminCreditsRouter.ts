import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { 
  users,
  userCredits, 
  creditTransactions,
  creditLimits,
  userRoles,
} from "../drizzle/schema";
import { eq, desc, and, or, gte, lte, sql, sum } from "drizzle-orm";

export const adminCreditsRouter = router({
  // Get platform-wide credit stats
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Total credits in circulation
    const [totalCredits] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${userCredits.credits}), 0)`,
        totalEarned: sql<number>`COALESCE(SUM(${userCredits.totalEarned}), 0)`,
        totalSpent: sql<number>`COALESCE(SUM(${userCredits.totalSpent}), 0)`,
      })
      .from(userCredits);

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats] = await db
      .select({
        spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
        earned: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN ${creditTransactions.amount} ELSE 0 END), 0)`,
        transactions: sql<number>`COUNT(*)`,
      })
      .from(creditTransactions)
      .where(gte(creditTransactions.createdAt, today));

    // This week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [weekStats] = await db
      .select({
        spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
        earned: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN ${creditTransactions.amount} ELSE 0 END), 0)`,
      })
      .from(creditTransactions)
      .where(gte(creditTransactions.createdAt, weekAgo));

    // This month's stats
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [monthStats] = await db
      .select({
        spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
        earned: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN ${creditTransactions.amount} ELSE 0 END), 0)`,
      })
      .from(creditTransactions)
      .where(gte(creditTransactions.createdAt, monthAgo));

    return {
      totalInCirculation: totalCredits?.total || 0,
      totalEverEarned: totalCredits?.totalEarned || 0,
      totalEverSpent: totalCredits?.totalSpent || 0,
      today: {
        spent: todayStats?.spent || 0,
        earned: todayStats?.earned || 0,
        transactions: todayStats?.transactions || 0,
      },
      week: {
        spent: weekStats?.spent || 0,
        earned: weekStats?.earned || 0,
      },
      month: {
        spent: monthStats?.spent || 0,
        earned: monthStats?.earned || 0,
      },
    };
  }),

  // Get credit usage chart data
  getChartData: adminProcedure
    .input(z.object({
      period: z.enum(["day", "week", "month"]).default("week"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const days = input.period === "day" ? 1 : input.period === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily aggregates
      const data = await db
        .select({
          date: sql<string>`DATE(${creditTransactions.createdAt})`,
          spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
          earned: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} > 0 THEN ${creditTransactions.amount} ELSE 0 END), 0)`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(creditTransactions)
        .where(gte(creditTransactions.createdAt, startDate))
        .groupBy(sql`DATE(${creditTransactions.createdAt})`)
        .orderBy(sql`DATE(${creditTransactions.createdAt})`);

      // Fill in missing days
      type DayData = { date: string; spent: number; earned: number; transactions: number };
      const result: DayData[] = [];
      const currentDate = new Date(startDate);
      const dataMap: Map<string, DayData> = new Map(data.map((d: DayData) => [d.date, d]));

      while (currentDate <= new Date()) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayData = dataMap.get(dateStr);

        result.push({
          date: dateStr,
          spent: dayData?.spent || 0,
          earned: dayData?.earned || 0,
          transactions: dayData?.transactions || 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return result;
    }),

  // Get transactions list
  getTransactions: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      type: z.enum(["initial", "bonus", "purchase", "ai_request", "ai_generate", "refund"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      
      if (input.userId) {
        conditions.push(eq(creditTransactions.userId, input.userId));
      }
      
      if (input.type) {
        conditions.push(eq(creditTransactions.type, input.type));
      }
      
      if (input.dateFrom) {
        conditions.push(gte(creditTransactions.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(creditTransactions.createdAt, new Date(input.dateTo)));
      }

      const transactions = await db
        .select({
          id: creditTransactions.id,
          userId: creditTransactions.userId,
          userName: users.name,
          userEmail: users.email,
          amount: creditTransactions.amount,
          balance: creditTransactions.balance,
          type: creditTransactions.type,
          description: creditTransactions.description,
          model: creditTransactions.model,
          tokensUsed: creditTransactions.tokensUsed,
          createdAt: creditTransactions.createdAt,
        })
        .from(creditTransactions)
        .leftJoin(users, eq(creditTransactions.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(creditTransactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(creditTransactions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        transactions,
        total: countResult?.count || 0,
      };
    }),

  // Export transactions to CSV format
  exportTransactions: adminProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      
      if (input.dateFrom) {
        conditions.push(gte(creditTransactions.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(creditTransactions.createdAt, new Date(input.dateTo)));
      }

      const transactions = await db
        .select({
          id: creditTransactions.id,
          userId: creditTransactions.userId,
          userName: users.name,
          userEmail: users.email,
          amount: creditTransactions.amount,
          balance: creditTransactions.balance,
          type: creditTransactions.type,
          description: creditTransactions.description,
          model: creditTransactions.model,
          tokensUsed: creditTransactions.tokensUsed,
          createdAt: creditTransactions.createdAt,
        })
        .from(creditTransactions)
        .leftJoin(users, eq(creditTransactions.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(creditTransactions.createdAt))
        .limit(10000);

      // Generate CSV
      const headers = ["ID", "User ID", "User Name", "Email", "Amount", "Balance", "Type", "Description", "Model", "Tokens", "Date"];
      const rows = transactions.map((t: { id: number; userId: number; userName: string | null; userEmail: string | null; amount: number; balance: number; type: string; description: string | null; model: string | null; tokensUsed: number | null; createdAt: Date | null }) => [
        t.id,
        t.userId,
        t.userName || "",
        t.userEmail || "",
        t.amount,
        t.balance,
        t.type,
        t.description || "",
        t.model || "",
        t.tokensUsed || "",
        t.createdAt?.toISOString() || "",
      ]);

      const csv = [headers.join(","), ...rows.map((r: (string | number)[]) => r.map((v: string | number) => `"${v}"`).join(","))].join("\n");

      return { csv, count: transactions.length };
    }),

  // ============ CREDIT LIMITS ============

  // Get all credit limits
  getLimits: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const limits = await db
      .select({
        id: creditLimits.id,
        roleId: creditLimits.roleId,
        userId: creditLimits.userId,
        roleName: userRoles.nameRu,
        roleColor: userRoles.color,
        userName: users.name,
        dailyLimit: creditLimits.dailyLimit,
        perRequestLimit: creditLimits.perRequestLimit,
        monthlyLimit: creditLimits.monthlyLimit,
        projectLimit: creditLimits.projectLimit,
        notifyAtPercent: creditLimits.notifyAtPercent,
        blockAtPercent: creditLimits.blockAtPercent,
        allowOverride: creditLimits.allowOverride,
        isActive: creditLimits.isActive,
      })
      .from(creditLimits)
      .leftJoin(userRoles, eq(creditLimits.roleId, userRoles.id))
      .leftJoin(users, eq(creditLimits.userId, users.id))
      .orderBy(desc(creditLimits.roleId));

    return limits;
  }),

  // Get limit for specific role
  getLimitByRole: adminProcedure
    .input(z.object({ roleId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [limit] = await db
        .select()
        .from(creditLimits)
        .where(eq(creditLimits.roleId, input.roleId))
        .limit(1);

      return limit;
    }),

  // Create or update limit
  upsertLimit: adminProcedure
    .input(z.object({
      id: z.number().optional(),
      roleId: z.number().optional(),
      userId: z.number().optional(),
      dailyLimit: z.number().default(100),
      perRequestLimit: z.number().default(50),
      monthlyLimit: z.number().default(3000),
      projectLimit: z.number().nullable().optional(),
      notifyAtPercent: z.number().default(80),
      blockAtPercent: z.number().default(100),
      allowOverride: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.id) {
        // Update existing
        await db
          .update(creditLimits)
          .set({
            dailyLimit: input.dailyLimit,
            perRequestLimit: input.perRequestLimit,
            monthlyLimit: input.monthlyLimit,
            projectLimit: input.projectLimit,
            notifyAtPercent: input.notifyAtPercent,
            blockAtPercent: input.blockAtPercent,
            allowOverride: input.allowOverride,
          })
          .where(eq(creditLimits.id, input.id));

        return { success: true, id: input.id };
      } else {
        // Create new
        const [result] = await db
          .insert(creditLimits)
          .values({
            roleId: input.roleId,
            userId: input.userId,
            dailyLimit: input.dailyLimit,
            perRequestLimit: input.perRequestLimit,
            monthlyLimit: input.monthlyLimit,
            projectLimit: input.projectLimit,
            notifyAtPercent: input.notifyAtPercent,
            blockAtPercent: input.blockAtPercent,
            allowOverride: input.allowOverride,
          })
          .$returningId();

        return { success: true, id: result.id };
      }
    }),

  // Delete limit
  deleteLimit: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(creditLimits).where(eq(creditLimits.id, input.id));

      return { success: true };
    }),

  // Get user's current usage against limits
  getUserUsage: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get today's usage
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayUsage] = await db
        .select({
          spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
          requests: sql<number>`COUNT(*)`,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, input.userId),
            gte(creditTransactions.createdAt, today)
          )
        );

      // Get this month's usage
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [monthUsage] = await db
        .select({
          spent: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.amount} < 0 THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)`,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, input.userId),
            gte(creditTransactions.createdAt, monthStart)
          )
        );

      // Get user's limit (check user-specific first, then role-based)
      const [userLimit] = await db
        .select()
        .from(creditLimits)
        .where(eq(creditLimits.userId, input.userId))
        .limit(1);

      return {
        today: {
          spent: todayUsage?.spent || 0,
          requests: todayUsage?.requests || 0,
        },
        month: {
          spent: monthUsage?.spent || 0,
        },
        limit: userLimit,
      };
    }),

  // Get global limit settings
  getLimitSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get global limit (no roleId and no userId = global)
    const [globalLimit] = await db
      .select()
      .from(creditLimits)
      .where(and(
        sql`${creditLimits.roleId} IS NULL`,
        sql`${creditLimits.userId} IS NULL`
      ))
      .limit(1);

    // Get role-based limits
    const roleLimits = await db
      .select({
        roleId: creditLimits.roleId,
        dailyLimit: creditLimits.dailyLimit,
        roleName: userRoles.name,
      })
      .from(creditLimits)
      .leftJoin(userRoles, eq(creditLimits.roleId, userRoles.id))
      .where(sql`${creditLimits.roleId} IS NOT NULL`);

    const roleLimitsMap: Record<string, number> = {};
    if (Array.isArray(roleLimits)) {
      roleLimits.forEach(rl => {
        if (rl.roleName) {
          roleLimitsMap[rl.roleName.toLowerCase()] = rl.dailyLimit || 0;
        }
      });
    }

    return {
      globalDailyLimit: globalLimit?.dailyLimit || 1000,
      maxTokensPerRequest: globalLimit?.perRequestLimit || 4000,
      warningThreshold: globalLimit?.notifyAtPercent || 80,
      blockOnLimit: globalLimit?.blockAtPercent === 100,
      allowOverage: globalLimit?.allowOverride ?? false,
      roleLimits: roleLimitsMap,
    };
  }),

  // Update global limit settings
  updateLimitSettings: adminProcedure
    .input(z.object({
      globalDailyLimit: z.number(),
      maxTokensPerRequest: z.number(),
      warningThreshold: z.number(),
      blockOnLimit: z.boolean(),
      allowOverage: z.boolean(),
      roleLimits: z.record(z.string(), z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update or create global limit (no roleId and no userId = global)
      const [existingGlobal] = await db
        .select()
        .from(creditLimits)
        .where(and(
          sql`${creditLimits.roleId} IS NULL`,
          sql`${creditLimits.userId} IS NULL`
        ))
        .limit(1);

      if (existingGlobal) {
        await db.update(creditLimits)
          .set({
            dailyLimit: input.globalDailyLimit,
            perRequestLimit: input.maxTokensPerRequest,
            notifyAtPercent: input.warningThreshold,
            blockAtPercent: input.blockOnLimit ? 100 : null,
            allowOverride: input.allowOverage,
          })
          .where(eq(creditLimits.id, existingGlobal.id));
      } else {
        await db.insert(creditLimits).values({
          dailyLimit: input.globalDailyLimit,
          perRequestLimit: input.maxTokensPerRequest,
          notifyAtPercent: input.warningThreshold,
          blockAtPercent: input.blockOnLimit ? 100 : null,
          allowOverride: input.allowOverage,
        });
      }

      // Update role limits
      for (const [roleName, limit] of Object.entries(input.roleLimits)) {
        const [role] = await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.name, roleName))
          .limit(1);

        if (role) {
          const [existingRoleLimit] = await db
            .select()
            .from(creditLimits)
            .where(eq(creditLimits.roleId, role.id))
            .limit(1);

          if (existingRoleLimit) {
            await db.update(creditLimits)
              .set({ dailyLimit: limit })
              .where(eq(creditLimits.id, existingRoleLimit.id));
          } else {
            await db.insert(creditLimits).values({
              roleId: role.id,
              dailyLimit: limit,
            });
          }
        }
      }

      return { success: true };
    }),
});
