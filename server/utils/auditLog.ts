/**
 * Audit logging service for tracking user activities
 *
 * Provides:
 * - Centralized activity logging
 * - Type-safe action and entity types
 * - Async non-blocking logging
 * - Batch logging support
 */

import { getDb } from "../db";
import { activityLog, type InsertActivityLog } from "../../drizzle/schema";
import { ACTIVITY_TYPE } from "@shared/const";

// Action types that can be logged
export type AuditAction = InsertActivityLog["action"];

// Entity types that can be logged
export type AuditEntityType = InsertActivityLog["entityType"];

// Audit log entry input
export interface AuditLogEntry {
  userId: number;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number;
  entityTitle?: string;
  projectId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log a single activity (fire and forget)
 * Does not throw errors to avoid disrupting the main flow
 */
export async function logActivity(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(activityLog).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityTitle: entry.entityTitle,
      projectId: entry.projectId,
      metadata: entry.metadata,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never break the main flow
    console.error("[AuditLog] Failed to log activity:", error);
  }
}

/**
 * Log multiple activities in a batch
 */
export async function logActivities(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  try {
    const db = await getDb();
    if (!db) return;

    const values = entries.map((entry) => ({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityTitle: entry.entityTitle,
      projectId: entry.projectId,
      metadata: entry.metadata,
    }));

    await db.insert(activityLog).values(values);
  } catch (error) {
    console.error("[AuditLog] Failed to batch log activities:", error);
  }
}

// ============ CONVENIENCE FUNCTIONS ============

/**
 * Log task-related activities
 */
export const taskAudit = {
  created: (userId: number, projectId: number, taskId: number, title: string, metadata?: Record<string, unknown>) =>
    logActivity({
      userId,
      projectId,
      action: "task_created",
      entityType: "task",
      entityId: taskId,
      entityTitle: title,
      metadata,
    }),

  updated: (userId: number, projectId: number, taskId: number, title: string, changes?: Record<string, unknown>) =>
    logActivity({
      userId,
      projectId,
      action: "task_updated",
      entityType: "task",
      entityId: taskId,
      entityTitle: title,
      metadata: changes ? { changes } : undefined,
    }),

  completed: (userId: number, projectId: number, taskId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "task_completed",
      entityType: "task",
      entityId: taskId,
      entityTitle: title,
    }),

  deleted: (userId: number, projectId: number, taskId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "task_deleted",
      entityType: "task",
      entityId: taskId,
      entityTitle: title,
    }),
};

/**
 * Log section-related activities
 */
export const sectionAudit = {
  created: (userId: number, projectId: number, sectionId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "section_created",
      entityType: "section",
      entityId: sectionId,
      entityTitle: title,
    }),

  updated: (userId: number, projectId: number, sectionId: number, title: string, changes?: Record<string, unknown>) =>
    logActivity({
      userId,
      projectId,
      action: "section_updated",
      entityType: "section",
      entityId: sectionId,
      entityTitle: title,
      metadata: changes ? { changes } : undefined,
    }),
};

/**
 * Log block-related activities
 */
export const blockAudit = {
  created: (userId: number, projectId: number, blockId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "block_created",
      entityType: "block",
      entityId: blockId,
      entityTitle: title,
    }),

  updated: (userId: number, projectId: number, blockId: number, title: string, changes?: Record<string, unknown>) =>
    logActivity({
      userId,
      projectId,
      action: "block_updated",
      entityType: "block",
      entityId: blockId,
      entityTitle: title,
      metadata: changes ? { changes } : undefined,
    }),
};

/**
 * Log project-related activities
 */
export const projectAudit = {
  created: (userId: number, projectId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "project_created",
      entityType: "project",
      entityId: projectId,
      entityTitle: title,
    }),

  updated: (userId: number, projectId: number, title: string, changes?: Record<string, unknown>) =>
    logActivity({
      userId,
      projectId,
      action: "project_updated",
      entityType: "project",
      entityId: projectId,
      entityTitle: title,
      metadata: changes ? { changes } : undefined,
    }),
};

/**
 * Log member-related activities
 */
export const memberAudit = {
  invited: (userId: number, projectId: number, invitedEmail: string) =>
    logActivity({
      userId,
      projectId,
      action: "member_invited",
      entityType: "member",
      metadata: { invitedEmail },
    }),

  joined: (userId: number, projectId: number, memberName: string) =>
    logActivity({
      userId,
      projectId,
      action: "member_joined",
      entityType: "member",
      entityTitle: memberName,
    }),

  removed: (userId: number, projectId: number, removedUserId: number, memberName: string) =>
    logActivity({
      userId,
      projectId,
      action: "member_removed",
      entityType: "member",
      entityId: removedUserId,
      entityTitle: memberName,
    }),
};

/**
 * Log AI-related activities
 */
export const aiAudit = {
  request: (userId: number, projectId: number | undefined, requestType: string, model?: string) =>
    logActivity({
      userId,
      projectId,
      action: "ai_request",
      entityType: "ai",
      metadata: { requestType, model },
    }),

  analysis: (userId: number, projectId: number, analysisType: string, entityId?: number) =>
    logActivity({
      userId,
      projectId,
      action: "ai_analysis",
      entityType: "ai",
      entityId,
      metadata: { analysisType },
    }),
};

/**
 * Log comment-related activities
 */
export const commentAudit = {
  added: (userId: number, projectId: number, taskId: number, commentId: number) =>
    logActivity({
      userId,
      projectId,
      action: "comment_added",
      entityType: "comment",
      entityId: commentId,
      metadata: { taskId },
    }),

  edited: (userId: number, projectId: number, commentId: number) =>
    logActivity({
      userId,
      projectId,
      action: "comment_edited",
      entityType: "comment",
      entityId: commentId,
    }),
};

/**
 * Log subtask-related activities
 */
export const subtaskAudit = {
  created: (userId: number, projectId: number, subtaskId: number, title: string, taskId: number) =>
    logActivity({
      userId,
      projectId,
      action: "subtask_created",
      entityType: "subtask",
      entityId: subtaskId,
      entityTitle: title,
      metadata: { taskId },
    }),

  completed: (userId: number, projectId: number, subtaskId: number, title: string) =>
    logActivity({
      userId,
      projectId,
      action: "subtask_completed",
      entityType: "subtask",
      entityId: subtaskId,
      entityTitle: title,
    }),
};
