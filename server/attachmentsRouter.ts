/**
 * Attachments Router
 * Handles file attachments for projects, blocks, sections, and tasks
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { storagePut, storageGet } from "./storage";
import {
  fileAttachments,
  attachmentSettings,
  users,
  type FileAttachment,
  type AttachmentSettings,
} from "../drizzle/schema";
import { eq, and, desc, like, inArray, sql } from "drizzle-orm";
import {
  checkProjectAccess,
  checkEntityAccess,
  requireAccessOrNotFound,
} from "./utils/authorization";

// Entity type enum for validation
const entityTypeSchema = z.enum(["project", "block", "section", "task"]);

// Default settings (match schema defaults)
const DEFAULT_SETTINGS: Omit<AttachmentSettings, "id" | "updatedAt" | "updatedBy"> = {
  maxFileSizeMB: 100,
  maxTotalStorageMB: 10000, // 10 GB
  maxFilesPerEntity: 50,
  maxFilesPerMessage: 10,
  maxFileContentForAI_KB: 100,
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
    "application/zip",
    "application/x-rar-compressed",
    "video/mp4",
    "audio/mpeg",
    "audio/wav",
  ],
  planOverrides: null,
};

/**
 * Get or create attachment settings (ensures single row exists)
 */
async function getOrCreateSettings(): Promise<AttachmentSettings> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  const [existing] = await db.select().from(attachmentSettings).limit(1);
  if (existing) {
    return existing;
  }

  // Create default settings
  const [inserted] = await db.insert(attachmentSettings).values({});
  const [created] = await db.select().from(attachmentSettings).where(eq(attachmentSettings.id, inserted.insertId)).limit(1);
  return created || { ...DEFAULT_SETTINGS, id: inserted.insertId, updatedAt: new Date(), updatedBy: null } as AttachmentSettings;
}

/**
 * Apply plan overrides to settings
 */
function applyPlanOverrides(
  settings: AttachmentSettings,
  userPlan: string | null | undefined
): Omit<AttachmentSettings, "planOverrides" | "updatedAt" | "updatedBy" | "id"> {
  const baseSettings = {
    maxFileSizeMB: settings.maxFileSizeMB ?? DEFAULT_SETTINGS.maxFileSizeMB,
    maxTotalStorageMB: settings.maxTotalStorageMB ?? DEFAULT_SETTINGS.maxTotalStorageMB,
    maxFilesPerEntity: settings.maxFilesPerEntity ?? DEFAULT_SETTINGS.maxFilesPerEntity,
    maxFilesPerMessage: settings.maxFilesPerMessage ?? DEFAULT_SETTINGS.maxFilesPerMessage,
    maxFileContentForAI_KB: settings.maxFileContentForAI_KB ?? DEFAULT_SETTINGS.maxFileContentForAI_KB,
    allowedMimeTypes: settings.allowedMimeTypes ?? DEFAULT_SETTINGS.allowedMimeTypes,
  };

  if (!userPlan || !settings.planOverrides) {
    return baseSettings;
  }

  const overrides = settings.planOverrides as Record<string, Partial<{
    maxFileSizeMB: number;
    maxTotalStorageMB: number;
    maxFilesPerEntity: number;
  }>>;

  const planOverride = overrides[userPlan];
  if (!planOverride) {
    return baseSettings;
  }

  return {
    ...baseSettings,
    maxFileSizeMB: planOverride.maxFileSizeMB ?? baseSettings.maxFileSizeMB,
    maxTotalStorageMB: planOverride.maxTotalStorageMB ?? baseSettings.maxTotalStorageMB,
    maxFilesPerEntity: planOverride.maxFilesPerEntity ?? baseSettings.maxFilesPerEntity,
  };
}

/**
 * Get project total storage usage in bytes
 */
async function getProjectStorageUsage(projectId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${fileAttachments.fileSize}), 0)` })
    .from(fileAttachments)
    .where(eq(fileAttachments.projectId, projectId));

  return result[0]?.total ?? 0;
}

/**
 * Get entity attachment count
 */
async function getEntityAttachmentCount(
  entityType: "project" | "block" | "section" | "task",
  entityId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(fileAttachments)
    .where(
      and(
        eq(fileAttachments.entityType, entityType),
        eq(fileAttachments.entityId, entityId)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Generate unique file key for storage
 */
function generateFileKey(
  projectId: number,
  entityType: string,
  entityId: number,
  fileName: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  return `attachments/${projectId}/${entityType}/${entityId}/${timestamp}-${random}${ext ? `.${ext}` : ""}`;
}

export const attachmentsRouter = router({
  /**
   * Get settings for current user (with plan overrides applied)
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    }

    const settings = await getOrCreateSettings();

    // Get user's plan
    const [user] = await db
      .select({ subscriptionPlan: users.subscriptionPlan })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return applyPlanOverrides(settings, user?.subscriptionPlan);
  }),

  /**
   * Get full admin settings including plan overrides
   */
  getAdminSettings: adminProcedure.query(async () => {
    return getOrCreateSettings();
  }),

  /**
   * Update admin settings
   */
  updateAdminSettings: adminProcedure
    .input(
      z.object({
        maxFileSizeMB: z.number().min(1).max(2000).optional(),
        maxTotalStorageMB: z.number().min(100).max(100000).optional(),
        maxFilesPerEntity: z.number().min(1).max(1000).optional(),
        maxFilesPerMessage: z.number().min(1).max(100).optional(),
        maxFileContentForAI_KB: z.number().min(1).max(5000).optional(),
        allowedMimeTypes: z.array(z.string()).optional(),
        planOverrides: z
          .record(
            z.string(),
            z.object({
              maxFileSizeMB: z.number().optional(),
              maxTotalStorageMB: z.number().optional(),
              maxFilesPerEntity: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const current = await getOrCreateSettings();

      await db
        .update(attachmentSettings)
        .set({
          ...(input.maxFileSizeMB !== undefined && { maxFileSizeMB: input.maxFileSizeMB }),
          ...(input.maxTotalStorageMB !== undefined && { maxTotalStorageMB: input.maxTotalStorageMB }),
          ...(input.maxFilesPerEntity !== undefined && { maxFilesPerEntity: input.maxFilesPerEntity }),
          ...(input.maxFilesPerMessage !== undefined && { maxFilesPerMessage: input.maxFilesPerMessage }),
          ...(input.maxFileContentForAI_KB !== undefined && { maxFileContentForAI_KB: input.maxFileContentForAI_KB }),
          ...(input.allowedMimeTypes !== undefined && { allowedMimeTypes: input.allowedMimeTypes }),
          ...(input.planOverrides !== undefined && { planOverrides: input.planOverrides }),
          updatedBy: ctx.user.id,
        })
        .where(eq(attachmentSettings.id, current.id));

      return getOrCreateSettings();
    }),

  /**
   * List attachments for an entity
   */
  list: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check access to entity
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId);
      requireAccessOrNotFound(access, input.entityType);

      const attachments = await db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(
          and(
            eq(fileAttachments.entityType, input.entityType),
            eq(fileAttachments.entityId, input.entityId)
          )
        )
        .orderBy(desc(fileAttachments.createdAt));

      return attachments;
    }),

  /**
   * List all attachments in a project
   */
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        search: z.string().optional(),
        mimeTypeFilter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check project access
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "project");

      let query = db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(eq(fileAttachments.projectId, input.projectId))
        .orderBy(desc(fileAttachments.createdAt));

      const results = await query;

      // Apply filters in memory for simplicity
      type AttachmentResult = typeof results[number];
      let filtered: AttachmentResult[] = results;

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        filtered = filtered.filter((a: AttachmentResult) =>
          a.fileName.toLowerCase().includes(searchLower)
        );
      }

      if (input.mimeTypeFilter) {
        filtered = filtered.filter((a: AttachmentResult) =>
          a.mimeType.startsWith(input.mimeTypeFilter!)
        );
      }

      return filtered;
    }),

  /**
   * Upload a file attachment
   */
  upload: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        entityType: entityTypeSchema,
        entityId: z.number(),
        fileData: z.string(), // base64
        fileName: z.string().min(1).max(512),
        mimeType: z.string().min(1).max(128),
        description: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check access (require editor role)
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId, "editor");
      requireAccessOrNotFound(access, input.entityType);

      // Get user's plan for settings
      const [user] = await db
        .select({ subscriptionPlan: users.subscriptionPlan })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const rawSettings = await getOrCreateSettings();
      const settings = applyPlanOverrides(rawSettings, user?.subscriptionPlan);

      // Decode file and check size
      const buffer = Buffer.from(input.fileData, "base64");
      const fileSizeBytes = buffer.length;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);

      // Enforcement 1: File size
      if (fileSizeMB > (settings.maxFileSizeMB ?? 100)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Размер файла (${fileSizeMB.toFixed(1)} MB) превышает лимит (${settings.maxFileSizeMB} MB)`,
        });
      }

      // Enforcement 2: MIME type
      const allowedTypes = settings.allowedMimeTypes ?? DEFAULT_SETTINGS.allowedMimeTypes;
      if (!allowedTypes!.includes(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Тип файла ${input.mimeType} не разрешён`,
        });
      }

      // Enforcement 3: Files per entity
      const entityFileCount = await getEntityAttachmentCount(input.entityType, input.entityId);
      if (entityFileCount >= (settings.maxFilesPerEntity ?? 50)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Достигнут лимит файлов для этой сущности (${settings.maxFilesPerEntity})`,
        });
      }

      // Enforcement 4: Total project storage
      const currentUsage = await getProjectStorageUsage(input.projectId);
      const maxStorageBytes = (settings.maxTotalStorageMB ?? 10000) * 1024 * 1024;
      if (currentUsage + fileSizeBytes > maxStorageBytes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Превышен лимит хранилища проекта (${settings.maxTotalStorageMB} MB)`,
        });
      }

      // Generate storage key and upload
      const fileKey = generateFileKey(input.projectId, input.entityType, input.entityId, input.fileName);

      try {
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Save to database
        const [result] = await db.insert(fileAttachments).values({
          projectId: input.projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          uploadedBy: ctx.user.id,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: fileSizeBytes,
          description: input.description,
        });

        // Return the created attachment
        const [attachment] = await db
          .select()
          .from(fileAttachments)
          .where(eq(fileAttachments.id, result.insertId))
          .limit(1);

        return attachment;
      } catch (error) {
        console.error("File upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Ошибка загрузки файла",
        });
      }
    }),

  /**
   * Delete an attachment
   */
  delete: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get the attachment
      const [attachment] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, input.attachmentId))
        .limit(1);

      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Вложение не найдено" });
      }

      // Check access - owner of file or admin of project
      const isOwner = attachment.uploadedBy === ctx.user.id;
      const projectAccess = await checkProjectAccess(ctx.user.id, attachment.projectId, "admin");

      if (!isOwner && !projectAccess.hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Нет прав для удаления этого файла",
        });
      }

      // Delete from database (storage cleanup can be done later via cron if needed)
      await db.delete(fileAttachments).where(eq(fileAttachments.id, input.attachmentId));

      return { success: true };
    }),

  /**
   * Link existing attachment to another entity (creates new record with same fileKey)
   */
  linkToEntity: protectedProcedure
    .input(
      z.object({
        attachmentId: z.number(),
        targetEntityType: entityTypeSchema,
        targetEntityId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Get source attachment
      const [source] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, input.attachmentId))
        .limit(1);

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Вложение не найдено" });
      }

      // Check access to source project
      const sourceAccess = await checkProjectAccess(ctx.user.id, source.projectId);
      requireAccessOrNotFound(sourceAccess, "project");

      // Check access to target entity (require editor)
      const targetAccess = await checkEntityAccess(
        ctx.user.id,
        input.targetEntityType,
        input.targetEntityId,
        "editor"
      );
      requireAccessOrNotFound(targetAccess, input.targetEntityType);

      // Get user's plan for settings
      const [user] = await db
        .select({ subscriptionPlan: users.subscriptionPlan })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const rawSettings = await getOrCreateSettings();
      const settings = applyPlanOverrides(rawSettings, user?.subscriptionPlan);

      // Check entity file limit
      const targetFileCount = await getEntityAttachmentCount(
        input.targetEntityType,
        input.targetEntityId
      );
      if (targetFileCount >= (settings.maxFilesPerEntity ?? 50)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Достигнут лимит файлов для этой сущности (${settings.maxFilesPerEntity})`,
        });
      }

      // Create new record with same fileKey (no file duplication)
      const [result] = await db.insert(fileAttachments).values({
        projectId: targetAccess.projectId!,
        entityType: input.targetEntityType,
        entityId: input.targetEntityId,
        uploadedBy: ctx.user.id,
        fileName: source.fileName,
        fileKey: source.fileKey,
        fileUrl: source.fileUrl,
        mimeType: source.mimeType,
        fileSize: source.fileSize,
        description: source.description,
      });

      const [attachment] = await db
        .select()
        .from(fileAttachments)
        .where(eq(fileAttachments.id, result.insertId))
        .limit(1);

      return attachment;
    }),

  /**
   * Search attachments by filename in project
   */
  search: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        query: z.string().min(1).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check project access
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "project");

      const results = await db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(
          and(
            eq(fileAttachments.projectId, input.projectId),
            like(fileAttachments.fileName, `%${input.query}%`)
          )
        )
        .orderBy(desc(fileAttachments.createdAt))
        .limit(20);

      return results;
    }),

  /**
   * Get recent attachments in project
   */
  recent: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check project access
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "project");

      const results = await db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(eq(fileAttachments.projectId, input.projectId))
        .orderBy(desc(fileAttachments.createdAt))
        .limit(5);

      return results;
    }),

  /**
   * Get attachment by ID
   */
  get: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [attachment] = await db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(eq(fileAttachments.id, input.attachmentId))
        .limit(1);

      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Вложение не найдено" });
      }

      // Check access
      const access = await checkProjectAccess(ctx.user.id, attachment.projectId);
      requireAccessOrNotFound(access, "project");

      return attachment;
    }),

  /**
   * Get multiple attachments by IDs
   */
  getMany: protectedProcedure
    .input(z.object({ attachmentIds: z.array(z.number()) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      if (input.attachmentIds.length === 0) {
        return [];
      }

      const attachments = await db
        .select({
          id: fileAttachments.id,
          projectId: fileAttachments.projectId,
          entityType: fileAttachments.entityType,
          entityId: fileAttachments.entityId,
          uploadedBy: fileAttachments.uploadedBy,
          fileName: fileAttachments.fileName,
          fileKey: fileAttachments.fileKey,
          fileUrl: fileAttachments.fileUrl,
          mimeType: fileAttachments.mimeType,
          fileSize: fileAttachments.fileSize,
          description: fileAttachments.description,
          createdAt: fileAttachments.createdAt,
          uploaderName: users.name,
          uploaderAvatar: users.avatar,
        })
        .from(fileAttachments)
        .leftJoin(users, eq(users.id, fileAttachments.uploadedBy))
        .where(inArray(fileAttachments.id, input.attachmentIds));

      // Check access to all attachments (they must be in accessible projects)
      const projectIdSet = new Set<number>();
      for (const a of attachments) {
        projectIdSet.add(a.projectId);
      }
      const projectIds = Array.from(projectIdSet);
      for (const projectId of projectIds) {
        const access = await checkProjectAccess(ctx.user.id, projectId);
        if (!access.hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Нет доступа к одному или нескольким файлам",
          });
        }
      }

      return attachments;
    }),

  /**
   * Get project storage stats
   */
  getProjectStats: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Check project access
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "project");

      // Get user's plan for settings
      const [user] = await db
        .select({ subscriptionPlan: users.subscriptionPlan })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const rawSettings = await getOrCreateSettings();
      const settings = applyPlanOverrides(rawSettings, user?.subscriptionPlan);

      // Get usage stats
      const usageBytes = await getProjectStorageUsage(input.projectId);
      const maxBytes = (settings.maxTotalStorageMB ?? 10000) * 1024 * 1024;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(fileAttachments)
        .where(eq(fileAttachments.projectId, input.projectId));

      return {
        usedBytes: usageBytes,
        usedMB: Math.round(usageBytes / (1024 * 1024) * 100) / 100,
        maxMB: settings.maxTotalStorageMB ?? 10000,
        usagePercent: Math.round((usageBytes / maxBytes) * 100),
        fileCount: countResult?.count ?? 0,
      };
    }),
});
