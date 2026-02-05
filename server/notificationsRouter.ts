import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { notifications, notificationPreferences, users } from "../drizzle/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Helper to create notification
export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message?: string,
  data?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const [result] = await db.insert(notifications).values({
      userId,
      type: type as any,
      title,
      message,
      data,
    });
    return result.insertId;
  } catch (error) {
    console.error("[Notifications] Failed to create notification:", error);
    return null;
  }
}

// Helper to send Telegram notification
async function sendTelegramNotification(chatId: string, message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[Telegram] Failed to send notification:", error);
    return false;
  }
}

export const notificationsRouter = router({
  // Get all notifications for current user
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      unreadOnly: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input.unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }
      
      const items = await db.select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      // Get unread count
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        ));
      
      return {
        items,
        unreadCount: countResult?.count || 0,
      };
    }),
  
  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return 0;
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.isRead, false)
      ));
    
    return result?.count || 0;
  }),
  
  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      await db.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(notifications.id, input.id),
          eq(notifications.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),
  
  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.isRead, false)
      ));
    
    return { success: true };
  }),
  
  // Delete notification
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      await db.delete(notifications)
        .where(and(
          eq(notifications.id, input.id),
          eq(notifications.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),
  
  // Clear all notifications
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    await db.delete(notifications)
      .where(eq(notifications.userId, ctx.user.id));
    
    return { success: true };
  }),
  
  // ============ PREFERENCES ============
  
  // Get notification preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const [prefs] = await db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, ctx.user.id))
      .limit(1);
    
    // Return defaults if no preferences exist
    if (!prefs) {
      return {
        inAppEnabled: true,
        emailEnabled: true,
        emailDigestFrequency: "daily" as const,
        emailDigestTime: "09:00",
        telegramEnabled: false,
        telegramChatId: null,
        telegramUsername: null,
        pushEnabled: false,
        notifyTaskAssigned: true,
        notifyTaskCompleted: true,
        notifyTaskOverdue: true,
        notifyComments: true,
        notifyMentions: true,
        notifyProjectUpdates: true,
        notifyDeadlines: true,
      };
    }
    
    return prefs;
  }),
  
  // Update notification preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      inAppEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      emailDigestFrequency: z.enum(["none", "daily", "weekly"]).optional(),
      emailDigestTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      telegramEnabled: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      notifyTaskAssigned: z.boolean().optional(),
      notifyTaskCompleted: z.boolean().optional(),
      notifyTaskOverdue: z.boolean().optional(),
      notifyComments: z.boolean().optional(),
      notifyMentions: z.boolean().optional(),
      notifyProjectUpdates: z.boolean().optional(),
      notifyDeadlines: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if preferences exist
      const [existing] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, ctx.user.id))
        .limit(1);
      
      if (existing) {
        await db.update(notificationPreferences)
          .set(input)
          .where(eq(notificationPreferences.userId, ctx.user.id));
      } else {
        await db.insert(notificationPreferences).values({
          userId: ctx.user.id,
          ...input,
        });
      }
      
      return { success: true };
    }),
  
  // ============ TELEGRAM INTEGRATION ============
  
  // Get Telegram bot link
  getTelegramBotLink: protectedProcedure.query(async ({ ctx }) => {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "mydon_roadmap_bot";
    const startParam = Buffer.from(`user_${ctx.user.id}`).toString("base64");
    return {
      link: `https://t.me/${botUsername}?start=${startParam}`,
      botUsername,
    };
  }),
  
  // Connect Telegram (called after user starts bot)
  connectTelegram: protectedProcedure
    .input(z.object({
      chatId: z.string(),
      username: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if preferences exist
      const [existing] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, ctx.user.id))
        .limit(1);
      
      if (existing) {
        await db.update(notificationPreferences)
          .set({
            telegramEnabled: true,
            telegramChatId: input.chatId,
            telegramUsername: input.username,
          })
          .where(eq(notificationPreferences.userId, ctx.user.id));
      } else {
        await db.insert(notificationPreferences).values({
          userId: ctx.user.id,
          telegramEnabled: true,
          telegramChatId: input.chatId,
          telegramUsername: input.username,
        });
      }
      
      // Send welcome message
      await sendTelegramNotification(
        input.chatId,
        "🎉 <b>MYDON Connected!</b>\n\nYou will now receive notifications about your roadmaps here."
      );
      
      return { success: true };
    }),
  
  // Disconnect Telegram
  disconnectTelegram: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    await db.update(notificationPreferences)
      .set({
        telegramEnabled: false,
        telegramChatId: null,
        telegramUsername: null,
      })
      .where(eq(notificationPreferences.userId, ctx.user.id));
    
    return { success: true };
  }),
  
  // Test Telegram notification
  testTelegram: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const [prefs] = await db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, ctx.user.id))
      .limit(1);
    
    if (!prefs?.telegramChatId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Telegram not connected" });
    }
    
    const success = await sendTelegramNotification(
      prefs.telegramChatId,
      "🔔 <b>Test Notification</b>\n\nIf you see this message, Telegram notifications are working correctly!"
    );
    
    if (!success) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to send test notification" });
    }
    
    return { success: true };
  }),
});
