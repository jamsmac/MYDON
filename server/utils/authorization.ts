/**
 * Authorization utilities for checking access to project entities
 * Provides consistent access control across all routers
 */

import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { projects, blocks, sections, tasks, subtasks, projectMembers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export type ProjectRole = "owner" | "admin" | "editor" | "viewer";

export interface AccessCheckResult {
  hasAccess: boolean;
  role: ProjectRole | null;
  projectId: number | null;
}

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

/**
 * Check if user has access to a project with optional role requirement
 */
export async function checkProjectAccess(
  userId: number,
  projectId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  // Check if user is project owner
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    return { hasAccess: false, role: null, projectId: null };
  }

  if (project.userId === userId) {
    return { hasAccess: true, role: "owner", projectId };
  }

  // Check membership
  const [membership] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId), eq(projectMembers.status, "active")))
    .limit(1);

  if (!membership) {
    return { hasAccess: false, role: null, projectId };
  }

  const memberRole = membership.role as ProjectRole;
  const hasAccess = !requiredRole || (ROLE_HIERARCHY[memberRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);

  return { hasAccess, role: memberRole, projectId };
}

/**
 * Check access to a block and return the project it belongs to
 */
export async function checkBlockAccess(
  userId: number,
  blockId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  const [block] = await db.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);

  if (!block) {
    return { hasAccess: false, role: null, projectId: null };
  }

  return checkProjectAccess(userId, block.projectId, requiredRole);
}

/**
 * Check access to a section and return the project it belongs to
 */
export async function checkSectionAccess(
  userId: number,
  sectionId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);

  if (!section) {
    return { hasAccess: false, role: null, projectId: null };
  }

  return checkBlockAccess(userId, section.blockId, requiredRole);
}

/**
 * Check access to a task and return the project it belongs to
 */
export async function checkTaskAccess(
  userId: number,
  taskId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

  if (!task) {
    return { hasAccess: false, role: null, projectId: null };
  }

  return checkSectionAccess(userId, task.sectionId, requiredRole);
}

/**
 * Check access to a subtask and return the project it belongs to
 */
export async function checkSubtaskAccess(
  userId: number,
  subtaskId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }

  const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, subtaskId)).limit(1);

  if (!subtask) {
    return { hasAccess: false, role: null, projectId: null };
  }

  return checkTaskAccess(userId, subtask.taskId, requiredRole);
}

/**
 * Helper to throw FORBIDDEN error if access is denied
 */
export function requireAccess(
  result: AccessCheckResult,
  entityType: string = "resource"
): asserts result is AccessCheckResult & { hasAccess: true } {
  if (!result.hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `У вас нет доступа к этому ${entityType}`,
    });
  }
}

/**
 * Helper to throw NOT_FOUND error if entity doesn't exist
 */
export function requireExists(
  result: AccessCheckResult,
  entityType: string = "resource"
): void {
  if (result.projectId === null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${entityType} не найден`,
    });
  }
}

/**
 * Combined check: entity exists and user has access
 */
export function requireAccessOrNotFound(
  result: AccessCheckResult,
  entityType: string = "resource"
): asserts result is AccessCheckResult & { hasAccess: true; projectId: number } {
  requireExists(result, entityType);
  requireAccess(result, entityType);
}

/**
 * Check access to any entity type by routing to the appropriate check function
 */
export async function checkEntityAccess(
  userId: number,
  entityType: "project" | "block" | "section" | "task" | "subtask",
  entityId: number,
  requiredRole?: ProjectRole
): Promise<AccessCheckResult> {
  switch (entityType) {
    case "project":
      return checkProjectAccess(userId, entityId, requiredRole);
    case "block":
      return checkBlockAccess(userId, entityId, requiredRole);
    case "section":
      return checkSectionAccess(userId, entityId, requiredRole);
    case "task":
      return checkTaskAccess(userId, entityId, requiredRole);
    case "subtask":
      return checkSubtaskAccess(userId, entityId, requiredRole);
    default:
      return { hasAccess: false, role: null, projectId: null };
  }
}
