import { z } from "zod";
import { eq, desc, like, and, asc } from "drizzle-orm";
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

export const adminUIRouter = router({
  // ==================== BRANDING ====================
  
  // Get current branding settings
  getBranding: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;
      
      // Get branding settings by key
      const brandingKeys = ["platform_name", "logo_url", "favicon_url", "primary_color", "accent_color", "theme"];
      const settings = await db
        .select()
        .from(schema.uiSettings)
        .where(like(schema.uiSettings.key, "branding_%"));
      
      // Convert to key-value object
      const branding: Record<string, unknown> = {};
      for (const setting of settings) {
        const shortKey = setting.key.replace("branding_", "");
        branding[shortKey] = setting.value;
      }
      
      return {
        platformName: (branding["platform_name"] as Record<string, string>)?.value || "TechRent Roadmap",
        logoUrl: (branding["logo_url"] as Record<string, string>)?.value || null,
        faviconUrl: (branding["favicon_url"] as Record<string, string>)?.value || null,
        primaryColor: (branding["primary_color"] as Record<string, string>)?.value || "#f59e0b",
        accentColor: (branding["accent_color"] as Record<string, string>)?.value || "#10b981",
        theme: (branding["theme"] as Record<string, string>)?.value || "dark",
      };
    }),

  // Update branding settings
  updateBranding: adminProcedure
    .input(z.object({
      platformName: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      faviconUrl: z.string().nullable().optional(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      theme: z.enum(["light", "dark"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const settingsMap: Record<string, string | null | undefined> = {
        "platform_name": input.platformName,
        "logo_url": input.logoUrl,
        "favicon_url": input.faviconUrl,
        "primary_color": input.primaryColor,
        "accent_color": input.accentColor,
        "theme": input.theme,
      };
      
      for (const [shortKey, value] of Object.entries(settingsMap)) {
        if (value !== undefined) {
          const key = `branding_${shortKey}`;
          // Check if setting exists
          const [existing] = await db
            .select()
            .from(schema.uiSettings)
            .where(eq(schema.uiSettings.key, key));
          
          if (existing) {
            await db.update(schema.uiSettings)
              .set({ value: { value } })
              .where(eq(schema.uiSettings.id, existing.id));
          } else {
            await db.insert(schema.uiSettings).values({
              key,
              value: { value },
            });
          }
        }
      }
      
      return { success: true };
    }),

  // ==================== NAVBAR ====================
  
  // Get navbar items
  getNavbarItems: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      const items = await db
        .select()
        .from(schema.navbarItems)
        .orderBy(asc(schema.navbarItems.displayOrder));
      
      return items;
    }),

  // Update navbar item
  updateNavbarItem: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      icon: z.string().optional(),
      path: z.string().optional(),
      isEnabled: z.boolean().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, ...updateData } = input;
      
      await db.update(schema.navbarItems)
        .set(updateData)
        .where(eq(schema.navbarItems.id, id));
      
      return { success: true };
    }),

  // Create custom navbar item
  createNavbarItem: adminProcedure
    .input(z.object({
      name: z.string(),
      icon: z.string().optional(),
      path: z.string().optional(),
      externalUrl: z.string().optional(),
      isEnabled: z.boolean().default(true),
      isCustom: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get max sort order
      const items = await db
        .select({ sortOrder: schema.navbarItems.displayOrder })
        .from(schema.navbarItems)
        .orderBy(desc(schema.navbarItems.displayOrder))
        .limit(1);
      
      const maxOrder = items[0]?.sortOrder ?? 0;
      
      const [result] = await db.insert(schema.navbarItems).values({
        ...input,
        displayOrder: maxOrder + 1,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Delete custom navbar item
  deleteNavbarItem: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Only allow deleting custom items
      const [item] = await db
        .select()
        .from(schema.navbarItems)
        .where(eq(schema.navbarItems.id, input.id));
      
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      
      if (!item.isCustom) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete system navbar items" });
      }
      
      await db.delete(schema.navbarItems).where(eq(schema.navbarItems.id, input.id));
      
      return { success: true };
    }),

  // Reorder navbar items
  reorderNavbarItems: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number(),
        displayOrder: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      for (const item of input.items) {
        await db.update(schema.navbarItems)
          .set({ displayOrder: item.displayOrder })
          .where(eq(schema.navbarItems.id, item.id));
      }
      
      return { success: true };
    }),

  // ==================== LOCALIZATION ====================
  
  // Get available languages
  getLanguages: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { languages: ["ru", "en", "uz"], defaultLanguage: "ru" };
      
      // Get default language from settings
      const [defaultLangSetting] = await db
        .select()
        .from(schema.uiSettings)
        .where(eq(schema.uiSettings.key, "default_language"));
      
      const defaultLang = (defaultLangSetting?.value as Record<string, string>)?.value || "ru";
      
      return {
        languages: ["ru", "en", "uz"],
        defaultLanguage: defaultLang,
      };
    }),

  // Set default language
  setDefaultLanguage: adminProcedure
    .input(z.object({ language: z.enum(["ru", "en", "uz"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [existing] = await db
        .select()
        .from(schema.uiSettings)
        .where(eq(schema.uiSettings.key, "default_language"));
      
      if (existing) {
        await db.update(schema.uiSettings)
          .set({ value: { value: input.language } })
          .where(eq(schema.uiSettings.id, existing.id));
      } else {
        await db.insert(schema.uiSettings).values({
          key: "default_language",
          value: { value: input.language },
        });
      }
      
      return { success: true };
    }),

  // Get localization strings
  getLocalizationStrings: adminProcedure
    .input(z.object({
      locale: z.enum(["ru", "en", "uz"]).optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { strings: [], total: 0 };
      
      const conditions = [];
      
      if (input?.locale) {
        conditions.push(eq(schema.localizationStrings.locale, input.locale));
      }
      
      if (input?.search) {
        conditions.push(
          like(schema.localizationStrings.key, `%${input.search}%`)
        );
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const strings = await db
        .select()
        .from(schema.localizationStrings)
        .where(whereClause)
        .orderBy(asc(schema.localizationStrings.key))
        .limit(input?.limit ?? 50)
        .offset(((input?.page ?? 1) - 1) * (input?.limit ?? 50));
      
      return { strings, total: strings.length };
    }),

  // Update localization string
  updateLocalizationString: adminProcedure
    .input(z.object({
      id: z.number(),
      value: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(schema.localizationStrings)
        .set({ value: input.value })
        .where(eq(schema.localizationStrings.id, input.id));
      
      return { success: true };
    }),

  // Create localization string
  createLocalizationString: adminProcedure
    .input(z.object({
      key: z.string(),
      locale: z.enum(["en", "ru", "uz"]),
      value: z.string(),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [result] = await db.insert(schema.localizationStrings).values({
        key: input.key,
        locale: input.locale,
        value: input.value,
        context: input.context,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Delete localization string
  deleteLocalizationString: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.delete(schema.localizationStrings).where(eq(schema.localizationStrings.id, input.id));
      
      return { success: true };
    }),

  // Export localization to JSON
  exportLocalization: adminProcedure
    .input(z.object({ locale: z.enum(["en", "ru", "uz"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { json: "{}" };
      
      const strings = await db
        .select()
        .from(schema.localizationStrings)
        .where(eq(schema.localizationStrings.locale, input.locale))
        .orderBy(asc(schema.localizationStrings.key));
      
      const localization: Record<string, string> = {};
      for (const s of strings) {
        localization[s.key] = s.value;
      }
      
      return { json: JSON.stringify(localization, null, 2) };
    }),

  // Import localization from JSON
  importLocalization: adminProcedure
    .input(z.object({
      locale: z.enum(["en", "ru", "uz"]),
      json: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      let localization: Record<string, string>;
      try {
        localization = JSON.parse(input.json);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid JSON" });
      }
      
      let imported = 0;
      for (const [key, value] of Object.entries(localization)) {
        if (typeof value !== "string") continue;
        
        // Check if exists
        const [existing] = await db
          .select()
          .from(schema.localizationStrings)
          .where(and(
            eq(schema.localizationStrings.locale, input.locale),
            eq(schema.localizationStrings.key, key)
          ));
        
        if (existing) {
          await db.update(schema.localizationStrings)
            .set({ value })
            .where(eq(schema.localizationStrings.id, existing.id));
        } else {
          await db.insert(schema.localizationStrings).values({
            key,
            locale: input.locale,
            value,
          });
        }
        imported++;
      }
      
      return { success: true, imported };
    }),
});
