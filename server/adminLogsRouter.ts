import { z } from "zod";
import { eq, desc, and, gte, lte, sql, count, like, asc } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminLogsRouter = router({
  // ==================== AI REQUEST LOGS ====================
  
  // Get AI request logs with filters
  getAILogs: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      model: z.string().optional(),
      requestType: z.string().optional(),
      status: z.enum(["success", "error", "timeout", "rate_limited"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };
      
      const conditions = [];
      
      if (input.userId) {
        conditions.push(eq(schema.aiRequestLogs.userId, input.userId));
      }
      
      if (input.model) {
        conditions.push(eq(schema.aiRequestLogs.model, input.model));
      }
      
      if (input.requestType) {
        conditions.push(eq(schema.aiRequestLogs.requestType, input.requestType as any));
      }
      
      if (input.status) {
        conditions.push(eq(schema.aiRequestLogs.status, input.status));
      }
      
      if (input.dateFrom) {
        conditions.push(gte(schema.aiRequestLogs.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(schema.aiRequestLogs.createdAt, new Date(input.dateTo)));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const logs = await db
        .select({
          id: schema.aiRequestLogs.id,
          userId: schema.aiRequestLogs.userId,
          model: schema.aiRequestLogs.model,
          provider: schema.aiRequestLogs.provider,
          requestType: schema.aiRequestLogs.requestType,
          tokensUsed: schema.aiRequestLogs.tokensUsed,
          creditsCost: schema.aiRequestLogs.creditsCost,
          responseTimeMs: schema.aiRequestLogs.responseTimeMs,
          status: schema.aiRequestLogs.status,
          errorMessage: schema.aiRequestLogs.errorMessage,
          createdAt: schema.aiRequestLogs.createdAt,
        })
        .from(schema.aiRequestLogs)
        .where(whereClause)
        .orderBy(desc(schema.aiRequestLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      const [countResult] = await db
        .select({ count: count() })
        .from(schema.aiRequestLogs)
        .where(whereClause);
      
      return {
        logs,
        total: countResult?.count || 0,
      };
    }),

  // Get AI usage statistics over time
  getAIUsageOverTime: adminProcedure
    .input(z.object({
      days: z.number().default(30),
      groupBy: z.enum(["day", "week", "month"]).default("day"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);
      
      let dateFormat: string;
      switch (input.groupBy) {
        case "week":
          dateFormat = "%Y-%u";
          break;
        case "month":
          dateFormat = "%Y-%m";
          break;
        default:
          dateFormat = "%Y-%m-%d";
      }
      
      const stats = await db
        .select({
          date: sql<string>`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, ${dateFormat})`,
          requests: count(),
          totalTokens: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.tokensUsed}), 0)`,
          totalCredits: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.creditsCost}), 0)`,
          avgResponseTime: sql<number>`AVG(${schema.aiRequestLogs.responseTimeMs})`,
          errorCount: sql<number>`SUM(CASE WHEN ${schema.aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END)`,
        })
        .from(schema.aiRequestLogs)
        .where(gte(schema.aiRequestLogs.createdAt, startDate))
        .groupBy(sql`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, ${dateFormat})`)
        .orderBy(asc(sql`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, ${dateFormat})`));
      
      return stats;
    }),

  // Get top users by AI requests
  getTopUsersByRequests: adminProcedure
    .input(z.object({
      days: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      let startDate: Date;
      let endDate: Date | undefined;
      
      if (input.dateFrom) {
        startDate = new Date(input.dateFrom);
        endDate = input.dateTo ? new Date(input.dateTo) : undefined;
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - (input.days || 30));
      }
      
      const conditions = [gte(schema.aiRequestLogs.createdAt, startDate)];
      if (endDate) {
        conditions.push(lte(schema.aiRequestLogs.createdAt, endDate));
      }
      
      const topUsers = await db
        .select({
          userId: schema.aiRequestLogs.userId,
          userName: schema.users.name,
          userEmail: schema.users.email,
          requestCount: count(),
          totalCredits: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.creditsCost}), 0)`,
          totalTokens: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.tokensUsed}), 0)`,
        })
        .from(schema.aiRequestLogs)
        .leftJoin(schema.users, eq(schema.aiRequestLogs.userId, schema.users.id))
        .where(and(...conditions))
        .groupBy(schema.aiRequestLogs.userId, schema.users.name, schema.users.email)
        .orderBy(desc(count()))
        .limit(input.limit);
      
      return topUsers;
    }),

  // Get model usage breakdown
  getModelUsageBreakdown: adminProcedure
    .input(z.object({
      days: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      let startDate: Date;
      let endDate: Date | undefined;
      
      if (input.dateFrom) {
        startDate = new Date(input.dateFrom);
        endDate = input.dateTo ? new Date(input.dateTo) : undefined;
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - (input.days || 30));
      }
      
      const conditions = [gte(schema.aiRequestLogs.createdAt, startDate)];
      if (endDate) {
        conditions.push(lte(schema.aiRequestLogs.createdAt, endDate));
      }
      
      const breakdown = await db
        .select({
          model: schema.aiRequestLogs.model,
          requestCount: count(),
          totalCredits: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.creditsCost}), 0)`,
          totalTokens: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.tokensUsed}), 0)`,
          avgResponseTime: sql<number>`AVG(${schema.aiRequestLogs.responseTimeMs})`,
          errorRate: sql<number>`AVG(CASE WHEN ${schema.aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END) * 100`,
        })
        .from(schema.aiRequestLogs)
        .where(and(...conditions))
        .groupBy(schema.aiRequestLogs.model)
        .orderBy(desc(count()));
      
      return breakdown;
    }),

  // Get overall AI statistics
  getAIStats: adminProcedure
    .input(z.object({
      days: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      let startDate: Date;
      let endDate: Date | undefined;
      
      if (input.dateFrom) {
        startDate = new Date(input.dateFrom);
        endDate = input.dateTo ? new Date(input.dateTo) : undefined;
      } else {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - (input.days || 30));
      }
      
      const conditions = [gte(schema.aiRequestLogs.createdAt, startDate)];
      if (endDate) {
        conditions.push(lte(schema.aiRequestLogs.createdAt, endDate));
      }
      
      const [stats] = await db
        .select({
          totalRequests: count(),
          totalCredits: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.creditsCost}), 0)`,
          totalTokens: sql<number>`COALESCE(SUM(${schema.aiRequestLogs.tokensUsed}), 0)`,
          avgResponseTime: sql<number>`AVG(${schema.aiRequestLogs.responseTimeMs})`,
          avgCreditsPerRequest: sql<number>`AVG(${schema.aiRequestLogs.creditsCost})`,
          errorCount: sql<number>`SUM(CASE WHEN ${schema.aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END)`,
          uniqueUsers: sql<number>`COUNT(DISTINCT ${schema.aiRequestLogs.userId})`,
        })
        .from(schema.aiRequestLogs)
        .where(and(...conditions));
      
      return {
        ...stats,
        errorRate: stats.totalRequests > 0 
          ? ((stats.errorCount || 0) / stats.totalRequests * 100).toFixed(2)
          : "0",
      };
    }),

  // Export logs to CSV format
  exportLogs: adminProcedure
    .input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      userId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { csv: "" };
      
      const conditions = [];
      
      if (input.dateFrom) {
        conditions.push(gte(schema.aiRequestLogs.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(schema.aiRequestLogs.createdAt, new Date(input.dateTo)));
      }
      
      if (input.userId) {
        conditions.push(eq(schema.aiRequestLogs.userId, input.userId));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const logs = await db
        .select({
          id: schema.aiRequestLogs.id,
          userId: schema.aiRequestLogs.userId,
          model: schema.aiRequestLogs.model,
          requestType: schema.aiRequestLogs.requestType,
          tokensUsed: schema.aiRequestLogs.tokensUsed,
          creditsCost: schema.aiRequestLogs.creditsCost,
          responseTimeMs: schema.aiRequestLogs.responseTimeMs,
          status: schema.aiRequestLogs.status,
          createdAt: schema.aiRequestLogs.createdAt,
        })
        .from(schema.aiRequestLogs)
        .where(whereClause)
        .orderBy(desc(schema.aiRequestLogs.createdAt))
        .limit(10000);
      
      // Generate CSV
      const headers = ["ID", "User ID", "Model", "Request Type", "Tokens Used", "Credits Cost", "Response Time (ms)", "Status", "Created At"];
      const rows = logs.map((log: { id: number; userId: number; model: string | null; requestType: string | null; tokensUsed: number | null; creditsCost: number | null; responseTimeMs: number | null; status: string | null; createdAt: Date | null }) => [
        log.id,
        log.userId,
        log.model || "",
        log.requestType || "",
        log.tokensUsed || 0,
        log.creditsCost || 0,
        log.responseTimeMs || 0,
        log.status || "",
        log.createdAt?.toISOString() || "",
      ].join(","));
      
      const csv = [headers.join(","), ...rows].join("\n");
      
      return { csv };
    }),

  // ==================== ADMIN ACTIVITY LOGS ====================
  
  // Get admin activity logs
  getAdminActivityLogs: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      category: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };
      
      const conditions = [];
      
      if (input.userId) {
        conditions.push(eq(schema.adminActivityLogs.userId, input.userId));
      }
      
      if (input.action) {
        conditions.push(like(schema.adminActivityLogs.action, `%${input.action}%`));
      }
      
      if (input.category) {
        conditions.push(eq(schema.adminActivityLogs.category, input.category));
      }
      
      if (input.dateFrom) {
        conditions.push(gte(schema.adminActivityLogs.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(schema.adminActivityLogs.createdAt, new Date(input.dateTo)));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const logs = await db
        .select({
          id: schema.adminActivityLogs.id,
          userId: schema.adminActivityLogs.userId,
          userName: schema.users.name,
          action: schema.adminActivityLogs.action,
          category: schema.adminActivityLogs.category,
          targetType: schema.adminActivityLogs.targetType,
          targetId: schema.adminActivityLogs.targetId,
          details: schema.adminActivityLogs.details,
          ipAddress: schema.adminActivityLogs.ipAddress,
          createdAt: schema.adminActivityLogs.createdAt,
        })
        .from(schema.adminActivityLogs)
        .leftJoin(schema.users, eq(schema.adminActivityLogs.userId, schema.users.id))
        .where(whereClause)
        .orderBy(desc(schema.adminActivityLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      const [countResult] = await db
        .select({ count: count() })
        .from(schema.adminActivityLogs)
        .where(whereClause);
      
      return {
        logs,
        total: countResult?.count || 0,
      };
    }),

  // Log admin activity
  logActivity: adminProcedure
    .input(z.object({
      action: z.string(),
      category: z.string(),
      targetType: z.string().optional(),
      targetId: z.number().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      
      await db.insert(schema.adminActivityLogs).values({
        userId: ctx.user.id,
        action: input.action,
        category: input.category,
        targetType: input.targetType,
        targetId: input.targetId,
        details: input.details,
      });
      
      return { success: true };
    }),

  // ==================== ERROR MONITORING ====================
  
  // Get recent errors
  getRecentErrors: adminProcedure
    .input(z.object({
      hours: z.number().default(24),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);
      
      const errors = await db
        .select()
        .from(schema.aiRequestLogs)
        .where(and(
          eq(schema.aiRequestLogs.status, "error"),
          gte(schema.aiRequestLogs.createdAt, startDate)
        ))
        .orderBy(desc(schema.aiRequestLogs.createdAt))
        .limit(input.limit);
      
      return errors;
    }),

  // Get error rate per hour (for alerting)
  getErrorRatePerHour: adminProcedure
    .input(z.object({
      hours: z.number().default(24),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - input.hours);
      
      const errorRates = await db
        .select({
          hour: sql<string>`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, '%Y-%m-%d %H:00')`,
          totalRequests: count(),
          errorCount: sql<number>`SUM(CASE WHEN ${schema.aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END)`,
        })
        .from(schema.aiRequestLogs)
        .where(gte(schema.aiRequestLogs.createdAt, startDate))
        .groupBy(sql`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, '%Y-%m-%d %H:00')`)
        .orderBy(asc(sql`DATE_FORMAT(${schema.aiRequestLogs.createdAt}, '%Y-%m-%d %H:00')`));
      
      return errorRates.map((r: { hour: string; totalRequests: number; errorCount: number }) => ({
        ...r,
        errorRate: r.totalRequests > 0 ? ((r.errorCount || 0) / r.totalRequests * 100).toFixed(2) : "0",
      }));
    }),

  // Check for error spikes (>10 errors per hour)
  checkErrorSpikes: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { hasSpike: false, count: 0 };
    
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const [result] = await db
      .select({ count: count() })
      .from(schema.aiRequestLogs)
      .where(and(
        eq(schema.aiRequestLogs.status, "error"),
        gte(schema.aiRequestLogs.createdAt, oneHourAgo)
      ));
    
    const errorCount = result?.count || 0;
    
    return {
      hasSpike: errorCount > 10,
      count: errorCount,
      threshold: 10,
    };
  }),

  // Global search across admin entities
  globalSearch: adminProcedure
    .input(z.object({
      query: z.string().min(2),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [] };
      
      const searchTerm = `%${input.query}%`;
      const results: Array<{
        id: number;
        category: string;
        title: string;
        subtitle: string;
        url: string;
      }> = [];
      
      // Search users
      const users = await db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.users)
        .where(like(schema.users.name, searchTerm))
        .limit(5);
      
      for (const user of users) {
        results.push({
          id: user.id,
          category: "users",
          title: user.name || "Unnamed",
          subtitle: user.email || "",
          url: `/admin/users`,
        });
      }
      
      // Search projects
      const projects = await db
        .select({ id: schema.projects.id, name: schema.projects.name, description: schema.projects.description })
        .from(schema.projects)
        .where(like(schema.projects.name, searchTerm))
        .limit(5);
      
      for (const project of projects) {
        results.push({
          id: project.id,
          category: "projects",
          title: project.name,
          subtitle: project.description || "",
          url: `/admin/projects`,
        });
      }
      
      // Search AI agents
      const agents = await db
        .select({ id: schema.aiAgents.id, name: schema.aiAgents.name, description: schema.aiAgents.description })
        .from(schema.aiAgents)
        .where(like(schema.aiAgents.name, searchTerm))
        .limit(5);
      
      for (const agent of agents) {
        results.push({
          id: agent.id,
          category: "agents",
          title: agent.name,
          subtitle: agent.description || "",
          url: `/admin/agents`,
        });
      }
      
      // Search prompts
      const prompts = await db
        .select({ id: schema.systemPrompts.id, name: schema.systemPrompts.name, category: schema.systemPrompts.category })
        .from(schema.systemPrompts)
        .where(like(schema.systemPrompts.name, searchTerm))
        .limit(5);
      
      for (const prompt of prompts) {
        results.push({
          id: prompt.id,
          category: "prompts",
          title: prompt.name,
          subtitle: prompt.category || "",
          url: `/admin/prompts`,
        });
      }
      
      // Search skills
      const skills = await db
        .select({ id: schema.aiSkills.id, name: schema.aiSkills.name, description: schema.aiSkills.description })
        .from(schema.aiSkills)
        .where(like(schema.aiSkills.name, searchTerm))
        .limit(5);
      
      for (const skill of skills) {
        results.push({
          id: skill.id,
          category: "skills",
          title: skill.name,
          subtitle: skill.description || "",
          url: `/admin/skills`,
        });
      }
      
      // Add settings results for common terms
      const settingsKeywords = [
        { term: "бренд", title: "Брендинг", url: "/admin/branding" },
        { term: "навбар", title: "Настройки навбара", url: "/admin/navbar" },
        { term: "локализаци", title: "Локализация", url: "/admin/localization" },
        { term: "webhook", title: "Webhooks", url: "/admin/webhooks" },
        { term: "api", title: "API ключи", url: "/admin/api-keys" },
        { term: "уведомлени", title: "Уведомления", url: "/admin/notifications" },
        { term: "лог", title: "Логи и аналитика", url: "/admin/logs" },
      ];
      
      const lowerQuery = input.query.toLowerCase();
      for (const kw of settingsKeywords) {
        if (kw.term.includes(lowerQuery) || lowerQuery.includes(kw.term)) {
          results.push({
            id: 0,
            category: "settings",
            title: kw.title,
            subtitle: "Настройки",
            url: kw.url,
          });
        }
      }
      
      return { results: results.slice(0, 15) };
    }),
});
