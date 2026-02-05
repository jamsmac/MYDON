import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { webhooks, webhookDeliveries } from "../drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import crypto from "crypto";

// Supported webhook events
export const WEBHOOK_EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "task.deleted",
  "subtask.created",
  "subtask.completed",
  "project.created",
  "project.updated",
  "block.created",
  "block.updated",
  "section.created",
  "section.updated",
  "member.invited",
  "member.joined",
  "member.removed",
  "deadline.approaching",
  "deadline.passed",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

// Generate webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Generate webhook signature
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

// Webhook delivery with retry logic
async function deliverWebhook(
  webhook: {
    id: number;
    url: string;
    secret: string | null;
    headers: Record<string, string> | null;
  },
  event: string,
  payload: Record<string, unknown>
): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": event,
    "X-Webhook-Delivery-Id": crypto.randomUUID(),
    "X-Webhook-Timestamp": new Date().toISOString(),
    ...(webhook.headers || {}),
  };

  // Add signature if secret is set
  if (webhook.secret) {
    headers["X-Webhook-Signature"] = `sha256=${generateSignature(payloadString, webhook.secret)}`;
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => "");

    // Log delivery
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event,
      payload,
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 10000), // Limit response body size
      duration,
      success: response.ok,
      attempts: 1,
    });

    // Update webhook last triggered
    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        failureCount: response.ok ? 0 : sql`${webhooks.failureCount} + 1`,
      })
      .where(eq(webhooks.id, webhook.id));

    return {
      success: response.ok,
      statusCode: response.status,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log failed delivery
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event,
      payload,
      duration,
      success: false,
      error: errorMessage,
      attempts: 1,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
    });

    // Update failure count
    await db
      .update(webhooks)
      .set({
        failureCount: sql`${webhooks.failureCount} + 1`,
      })
      .where(eq(webhooks.id, webhook.id));

    return {
      success: false,
      error: errorMessage,
      duration,
    };
  }
}

// Trigger webhooks for an event
export async function triggerWebhooks(
  userId: number,
  projectId: number | null,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Find matching webhooks
  const matchingWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.userId, userId),
        eq(webhooks.isActive, true),
        sql`${webhooks.failureCount} < 10` // Disable after 10 consecutive failures
      )
    );

  // Filter by project and event
  const webhooksToTrigger = matchingWebhooks.filter(webhook => {
    // Check project match (null means all projects)
    if (webhook.projectId !== null && webhook.projectId !== projectId) {
      return false;
    }

    // Check event match
    const events = webhook.events as string[];
    return events.includes(event) || events.includes("*");
  });

  // Deliver to all matching webhooks in parallel
  await Promise.allSettled(
    webhooksToTrigger.map(webhook =>
      deliverWebhook(webhook, event, {
        event,
        timestamp: new Date().toISOString(),
        projectId,
        ...payload,
      })
    )
  );
}

export const webhookRouter = router({
  // List user's webhooks
  list: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(webhooks.userId, ctx.user.id)];
      if (input?.projectId) {
        conditions.push(eq(webhooks.projectId, input.projectId));
      }

      return db
        .select()
        .from(webhooks)
        .where(and(...conditions))
        .orderBy(desc(webhooks.createdAt));
    }),

  // Get webhook by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)));

      if (!webhook) {
        throw new Error("Webhook not found");
      }

      return webhook;
    }),

  // Create webhook
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      url: z.string().url().max(2048),
      projectId: z.number().optional(),
      events: z.array(z.string()).min(1),
      headers: z.record(z.string(), z.string()).optional(),
      generateSecret: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const secret = input.generateSecret ? generateWebhookSecret() : null;

      const [result] = await db.insert(webhooks).values({
        userId: ctx.user.id,
        name: input.name,
        url: input.url,
        projectId: input.projectId || null,
        events: input.events,
        headers: (input.headers || null) as Record<string, string> | null,
        secret,
        isActive: true,
        failureCount: 0,
      });

      const insertId = result.insertId;

      return {
        id: insertId,
        secret, // Return secret only on creation
      };
    }),

  // Update webhook
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      url: z.string().url().max(2048).optional(),
      events: z.array(z.string()).min(1).optional(),
      headers: z.record(z.string(), z.string()).nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...data } = input;

      await db
        .update(webhooks)
        .set(data)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, ctx.user.id)));

      return { success: true };
    }),

  // Regenerate webhook secret
  regenerateSecret: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const newSecret = generateWebhookSecret();

      await db
        .update(webhooks)
        .set({ secret: newSecret })
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)));

      return { secret: newSecret };
    }),

  // Delete webhook
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)));

      return { success: true };
    }),

  // Test webhook
  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)));

      if (!webhook) {
        throw new Error("Webhook not found");
      }

      const result = await deliverWebhook(
        webhook,
        "test",
        {
          message: "This is a test webhook delivery",
          timestamp: new Date().toISOString(),
        }
      );

      return result;
    }),

  // Get webhook deliveries
  getDeliveries: protectedProcedure
    .input(z.object({
      webhookId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, ctx.user.id)));

      if (!webhook) {
        throw new Error("Webhook not found");
      }

      return db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.limit);
    }),

  // Get available events
  getAvailableEvents: publicProcedure.query(() => {
    return WEBHOOK_EVENTS.map(event => ({
      value: event,
      label: event.replace(".", " ").replace(/\b\w/g, c => c.toUpperCase()),
      category: event.split(".")[0],
    }));
  }),

  // Retry failed delivery
  retryDelivery: protectedProcedure
    .input(z.object({ deliveryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [delivery] = await db
        .select({
          delivery: webhookDeliveries,
          webhook: webhooks,
        })
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
        .where(
          and(
            eq(webhookDeliveries.id, input.deliveryId),
            eq(webhooks.userId, ctx.user.id)
          )
        );

      if (!delivery) {
        throw new Error("Delivery not found");
      }

      const result = await deliverWebhook(
        delivery.webhook,
        delivery.delivery.event,
        delivery.delivery.payload as Record<string, unknown>
      );

      // Update retry count
      await db
        .update(webhookDeliveries)
        .set({
          attempts: sql`${webhookDeliveries.attempts} + 1`,
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveries.id, input.deliveryId));

      return result;
    }),
});
