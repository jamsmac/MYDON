import { z } from "zod";
import { eq, desc, like, and, asc, gte, lte, sql, count } from "drizzle-orm";
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

// Available webhook events
const WEBHOOK_EVENTS = [
  "project.created",
  "project.completed",
  "project.archived",
  "task.created",
  "task.completed",
  "task.overdue",
  "ai.request",
  "ai.decision_finalized",
  "user.registered",
  "user.invited",
  "credits.low",
  "credits.depleted",
] as const;

export const adminIntegrationsRouter = router({
  // ==================== WEBHOOKS ====================
  
  // List all webhooks
  listWebhooks: adminProcedure
    .input(z.object({
      status: z.enum(["active", "paused", "failed"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input?.status) {
        conditions.push(eq(schema.webhooks.isActive, input.status === "active"));
      }
      
      if (input?.search) {
        conditions.push(like(schema.webhooks.name, `%${input.search}%`));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const webhooks = await db
        .select()
        .from(schema.webhooks)
        .where(whereClause)
        .orderBy(desc(schema.webhooks.createdAt));
      
      return webhooks;
    }),

  // Create webhook
  createWebhook: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      secret: z.string().optional(),
      events: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [result] = await db.insert(schema.webhooks).values({
        name: input.name,
        url: input.url,
        secret: input.secret,
        events: input.events,
        userId: ctx.user.id,
        isActive: true,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Update webhook
  updateWebhook: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      url: z.string().url().optional(),
      secret: z.string().optional(),
      events: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, ...updateData } = input;
      
      await db.update(schema.webhooks)
        .set(updateData)
        .where(eq(schema.webhooks.id, id));
      
      return { success: true };
    }),

  // Delete webhook
  deleteWebhook: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.delete(schema.webhooks).where(eq(schema.webhooks.id, input.id));
      
      return { success: true };
    }),

  // Test webhook
  testWebhook: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [webhook] = await db
        .select()
        .from(schema.webhooks)
        .where(eq(schema.webhooks.id, input.id));
      
      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }
      
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook delivery",
          webhookId: webhook.id,
          webhookName: webhook.name,
        },
      };
      
      const startTime = Date.now();
      let success = false;
      let responseStatus = 0;
      let responseBody = "";
      let errorMessage = "";
      
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        if (webhook.secret) {
          // Add signature header
          const crypto = await import("crypto");
          const signature = crypto
            .createHmac("sha256", webhook.secret)
            .update(JSON.stringify(testPayload))
            .digest("hex");
          headers["X-Webhook-Signature"] = signature;
        }
        
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(testPayload),
        });
        
        responseStatus = response.status;
        responseBody = await response.text();
        success = response.ok;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }
      
      const duration = Date.now() - startTime;
      
      // Log the delivery
      await db.insert(schema.webhookDeliveries).values({
        webhookId: webhook.id,
        event: "test",
        payload: testPayload,
        responseStatus,
        responseBody: responseBody.substring(0, 1000),
        duration,
        success,
        error: errorMessage || null,
      });
      
      // Update webhook stats
      await db.update(schema.webhooks)
        .set({
          lastTriggeredAt: new Date(),
          failureCount: success ? 0 : (webhook.failureCount || 0) + 1,
        })
        .where(eq(schema.webhooks.id, webhook.id));
      
      return {
        success,
        responseStatus,
        responseBody: responseBody.substring(0, 500),
        duration,
        error: errorMessage,
      };
    }),

  // Get webhook delivery history
  getWebhookHistory: adminProcedure
    .input(z.object({
      webhookId: z.number(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const deliveries = await db
        .select()
        .from(schema.webhookDeliveries)
        .where(eq(schema.webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(schema.webhookDeliveries.createdAt))
        .limit(input.limit);
      
      return deliveries;
    }),

  // Get available webhook events
  getWebhookEvents: adminProcedure.query(() => {
    return WEBHOOK_EVENTS;
  }),

  // ==================== API KEYS ====================
  
  // List platform API keys
  listPlatformApiKeys: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    
    const keys = await db
      .select({
        id: schema.platformApiKeys.id,
        provider: schema.platformApiKeys.provider,
        status: schema.platformApiKeys.status,
        lastVerifiedAt: schema.platformApiKeys.lastVerifiedAt,
        lastErrorMessage: schema.platformApiKeys.lastErrorMessage,
        totalRequests: schema.platformApiKeys.totalRequests,
        totalTokens: schema.platformApiKeys.totalTokens,
        isEnabled: schema.platformApiKeys.isEnabled,
        createdAt: schema.platformApiKeys.createdAt,
      })
      .from(schema.platformApiKeys)
      .orderBy(asc(schema.platformApiKeys.provider));
    
    return keys;
  }),

  // Add platform API key
  addPlatformApiKey: adminProcedure
    .input(z.object({
      provider: z.string(),
      apiKey: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Check if provider already exists
      const [existing] = await db
        .select()
        .from(schema.platformApiKeys)
        .where(eq(schema.platformApiKeys.provider, input.provider));
      
      if (existing) {
        // Update existing
        await db.update(schema.platformApiKeys)
          .set({
            apiKey: input.apiKey,
            status: "valid",
            lastVerifiedAt: null,
            lastErrorMessage: null,
          })
          .where(eq(schema.platformApiKeys.id, existing.id));
        
        return { id: existing.id, success: true };
      }
      
      const [result] = await db.insert(schema.platformApiKeys).values({
        provider: input.provider,
        apiKey: input.apiKey,
        status: "valid",
        createdBy: ctx.user.id,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Verify API key
  verifyApiKey: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [key] = await db
        .select()
        .from(schema.platformApiKeys)
        .where(eq(schema.platformApiKeys.id, input.id));
      
      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }
      
      // Test the API key based on provider
      let isValid = false;
      let errorMessage = "";
      
      try {
        switch (key.provider.toLowerCase()) {
          case "openai":
            const openaiResponse = await fetch("https://api.openai.com/v1/models", {
              headers: { Authorization: `Bearer ${key.apiKey}` },
            });
            isValid = openaiResponse.ok;
            if (!isValid) errorMessage = `HTTP ${openaiResponse.status}`;
            break;
            
          case "anthropic":
            // Anthropic doesn't have a simple validation endpoint
            isValid = key.apiKey.startsWith("sk-ant-");
            if (!isValid) errorMessage = "Invalid key format";
            break;
            
          case "google":
          case "gemini":
            isValid = key.apiKey.length > 20;
            if (!isValid) errorMessage = "Key too short";
            break;
            
          default:
            isValid = key.apiKey.length > 10;
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Verification failed";
      }
      
      await db.update(schema.platformApiKeys)
        .set({
          status: isValid ? "valid" : "invalid",
          lastVerifiedAt: new Date(),
          lastErrorMessage: errorMessage || null,
        })
        .where(eq(schema.platformApiKeys.id, input.id));
      
      return { valid: isValid, error: errorMessage };
    }),

  // Toggle API key
  toggleApiKey: adminProcedure
    .input(z.object({
      id: z.number(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(schema.platformApiKeys)
        .set({ isEnabled: input.isEnabled })
        .where(eq(schema.platformApiKeys.id, input.id));
      
      return { success: true };
    }),

  // Delete API key
  deleteApiKey: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.delete(schema.platformApiKeys).where(eq(schema.platformApiKeys.id, input.id));
      
      return { success: true };
    }),

  // ==================== EMAIL SETTINGS ====================
  
  // Get email settings
  getEmailSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    
    const [settings] = await db.select().from(schema.emailSettings).limit(1);
    
    if (settings) {
      // Hide password
      return {
        ...settings,
        smtpPassword: settings.smtpPassword ? "********" : null,
      };
    }
    
    return null;
  }),

  // Update email settings
  updateEmailSettings: adminProcedure
    .input(z.object({
      smtpHost: z.string().optional(),
      smtpPort: z.number().optional(),
      smtpUser: z.string().optional(),
      smtpPassword: z.string().optional(),
      smtpSecure: z.boolean().optional(),
      fromEmail: z.string().email().optional(),
      fromName: z.string().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [existing] = await db.select().from(schema.emailSettings).limit(1);
      
      // Don't update password if it's the masked value
      const updateData = { ...input };
      if (updateData.smtpPassword === "********") {
        delete updateData.smtpPassword;
      }
      
      if (existing) {
        await db.update(schema.emailSettings)
          .set({ ...updateData, updatedBy: ctx.user.id })
          .where(eq(schema.emailSettings.id, existing.id));
      } else {
        await db.insert(schema.emailSettings).values({
          ...updateData,
          updatedBy: ctx.user.id,
        });
      }
      
      return { success: true };
    }),

  // Test email
  testEmail: adminProcedure
    .input(z.object({ toEmail: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [settings] = await db.select().from(schema.emailSettings).limit(1);
      
      if (!settings || !settings.smtpHost) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email settings not configured" });
      }
      
      // In a real implementation, we would send an actual email here
      // For now, we'll simulate it
      const testResult = {
        success: true,
        message: `Test email would be sent to ${input.toEmail}`,
      };
      
      await db.update(schema.emailSettings)
        .set({
          lastTestedAt: new Date(),
          lastTestResult: testResult.success ? "success" : "failed",
          lastTestError: testResult.success ? null : testResult.message,
        })
        .where(eq(schema.emailSettings.id, settings.id));
      
      return testResult;
    }),

  // ==================== EMAIL TEMPLATES ====================
  
  // List email templates
  listEmailTemplates: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    
    const templates = await db
      .select()
      .from(schema.emailTemplates)
      .orderBy(asc(schema.emailTemplates.name));
    
    return templates;
  }),

  // Get email template
  getEmailTemplate: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [template] = await db
        .select()
        .from(schema.emailTemplates)
        .where(eq(schema.emailTemplates.id, input.id));
      
      return template;
    }),

  // Update email template
  updateEmailTemplate: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      subject: z.string().optional(),
      bodyHtml: z.string().optional(),
      bodyText: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, ...updateData } = input;
      
      await db.update(schema.emailTemplates)
        .set({ ...updateData, updatedBy: ctx.user.id })
        .where(eq(schema.emailTemplates.id, id));
      
      return { success: true };
    }),

  // Create default email templates
  initEmailTemplates: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    
    const defaultTemplates = [
      {
        slug: "user_invite",
        name: "Приглашение пользователя",
        subject: "Приглашение в {{platformName}}",
        bodyHtml: "<h1>Вас пригласили в {{platformName}}</h1><p>{{inviterName}} приглашает вас присоединиться к проекту.</p><a href=\"{{inviteLink}}\">Принять приглашение</a>",
        bodyText: "Вас пригласили в {{platformName}}. {{inviterName}} приглашает вас присоединиться к проекту. Ссылка: {{inviteLink}}",
        variables: ["platformName", "inviterName", "inviteLink"],
      },
      {
        slug: "password_reset",
        name: "Сброс пароля",
        subject: "Сброс пароля в {{platformName}}",
        bodyHtml: "<h1>Сброс пароля</h1><p>Вы запросили сброс пароля.</p><a href=\"{{resetLink}}\">Сбросить пароль</a>",
        bodyText: "Сброс пароля. Ссылка: {{resetLink}}",
        variables: ["platformName", "resetLink"],
      },
      {
        slug: "credits_low",
        name: "Низкий баланс кредитов",
        subject: "Низкий баланс кредитов в {{platformName}}",
        bodyHtml: "<h1>Низкий баланс</h1><p>У вас осталось {{credits}} кредитов.</p><a href=\"{{topupLink}}\">Пополнить баланс</a>",
        bodyText: "У вас осталось {{credits}} кредитов. Пополните баланс: {{topupLink}}",
        variables: ["platformName", "credits", "topupLink"],
      },
      {
        slug: "task_overdue",
        name: "Просроченная задача",
        subject: "Задача просрочена: {{taskName}}",
        bodyHtml: "<h1>Задача просрочена</h1><p>Задача \"{{taskName}}\" в проекте \"{{projectName}}\" просрочена.</p><a href=\"{{taskLink}}\">Открыть задачу</a>",
        bodyText: "Задача \"{{taskName}}\" в проекте \"{{projectName}}\" просрочена. Ссылка: {{taskLink}}",
        variables: ["taskName", "projectName", "taskLink"],
      },
    ];
    
    let created = 0;
    for (const template of defaultTemplates) {
      const [existing] = await db
        .select()
        .from(schema.emailTemplates)
        .where(eq(schema.emailTemplates.slug, template.slug));
      
      if (!existing) {
        await db.insert(schema.emailTemplates).values({
          ...template,
          isActive: true,
          updatedBy: ctx.user.id,
        });
        created++;
      }
    }
    
    return { created };
  }),

  // ==================== SYSTEM ALERTS ====================
  
  // Get system alerts
  getSystemAlerts: adminProcedure
    .input(z.object({
      resolved: z.boolean().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input?.resolved !== undefined) {
        conditions.push(eq(schema.systemAlerts.isResolved, input.resolved));
      }
      
      if (input?.severity) {
        conditions.push(eq(schema.systemAlerts.severity, input.severity));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const alerts = await db
        .select()
        .from(schema.systemAlerts)
        .where(whereClause)
        .orderBy(desc(schema.systemAlerts.createdAt))
        .limit(input?.limit || 50);
      
      return alerts;
    }),

  // Resolve alert
  resolveAlert: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(schema.systemAlerts)
        .set({
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(schema.systemAlerts.id, input.id));
      
      return { success: true };
    }),

  // Get unresolved alerts count
  getUnresolvedAlertsCount: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return 0;
    
    const [result] = await db
      .select({ count: count() })
      .from(schema.systemAlerts)
      .where(eq(schema.systemAlerts.isResolved, false));
    
    return result?.count || 0;
  }),
});
