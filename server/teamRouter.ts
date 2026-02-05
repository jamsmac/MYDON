import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectMemberByUserId,
  hasProjectPermission,
  createProjectInvitation,
  getProjectInvitationByCode,
  getPendingInvitations,
  useInvitation,
  deleteInvitation,
  logActivity,
  assignTask,
  getTasksAssignedToUser,
  getAssignedUserForTask,
  searchProjectMembers,
  getDashboardActivity,
  getProjectActivity,
} from "./db";
import { getDb } from "./db";
import { projects, users, tasks, blocks, sections } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";

// Generate random invite code
const generateInviteCode = () => crypto.randomBytes(16).toString("hex");

export const teamRouter = router({
  // ============ PROJECT MEMBERS ============
  
  // Get all members of a project
  getMembers: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user has access to project
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // User must be owner or member
      const isOwner = project.userId === ctx.user.id;
      const isMember = await getProjectMemberByUserId(input.projectId, ctx.user.id);
      
      if (!isOwner && !isMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project" });
      }
      
      // Get all members
      const members = await getProjectMembers(input.projectId);
      
      // Add owner to the list
      const [owner] = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
      }).from(users).where(eq(users.id, project.userId));
      
      return {
        owner: owner ? {
          ...owner,
          role: "owner" as const,
          joinedAt: project.createdAt,
        } : null,
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          invitedAt: m.invitedAt,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
      };
    }),
  
  // Invite a user to project
  inviteMember: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      email: z.string().email().optional(),
      role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is owner or admin
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      const hasAdmin = await hasProjectPermission(input.projectId, ctx.user.id, ["owner", "admin"]);
      
      if (!isOwner && !hasAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and admins can invite members" });
      }
      
      // Generate invite code
      const inviteCode = generateInviteCode();
      
      // Create invitation
      const invitation = await createProjectInvitation({
        projectId: input.projectId,
        email: input.email || null,
        inviteCode,
        role: input.role,
        invitedBy: ctx.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      
      if (!invitation) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create invitation" });
      }
      
      // Log activity
      await logActivity({
        projectId: input.projectId,
        userId: ctx.user.id,
        action: "member_invited",
        entityType: "member",
        entityId: invitation.id,
        entityTitle: input.email || "Invite link",
        metadata: { role: input.role, email: input.email },
      });
      
      return {
        inviteCode,
        inviteUrl: `/join/${inviteCode}`,
        expiresAt: invitation.expiresAt,
      };
    }),
  
  // Accept invitation and join project
  acceptInvite: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get invitation
      const invitation = await getProjectInvitationByCode(input.inviteCode);
      
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      }
      
      // Check if already used
      if (invitation.usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has already been used" });
      }
      
      // Check expiration
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }
      
      // Check if user is already a member
      const existingMember = await getProjectMemberByUserId(invitation.projectId, ctx.user.id);
      if (existingMember) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You are already a member of this project" });
      }
      
      // Add user as member
      const member = await addProjectMember({
        projectId: invitation.projectId,
        userId: ctx.user.id,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
        status: "active",
      });
      
      if (!member) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to join project" });
      }
      
      // Mark invitation as used
      await useInvitation(input.inviteCode, ctx.user.id);
      
      // Log activity
      await logActivity({
        projectId: invitation.projectId,
        userId: ctx.user.id,
        action: "member_joined",
        entityType: "member",
        entityId: member.id,
        entityTitle: ctx.user.name || "New member",
        metadata: { role: invitation.role },
      });
      
      return {
        projectId: invitation.projectId,
        role: invitation.role,
      };
    }),
  
  // Update member role
  updateRole: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      projectId: z.number(),
      role: z.enum(["admin", "editor", "viewer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is owner or admin
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      
      if (!isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can change member roles" });
      }
      
      const success = await updateProjectMemberRole(input.memberId, input.role);
      
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update role" });
      }
      
      return { success: true };
    }),
  
  // Remove member from project
  removeMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is owner
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      
      if (!isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can remove members" });
      }
      
      const success = await removeProjectMember(input.memberId);
      
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to remove member" });
      }
      
      // Log activity
      await logActivity({
        projectId: input.projectId,
        userId: ctx.user.id,
        action: "member_removed",
        entityType: "member",
        entityId: input.memberId,
        entityTitle: "Member removed",
      });
      
      return { success: true };
    }),
  
  // Get pending invitations
  getPendingInvites: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is owner or admin
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      const hasAdmin = await hasProjectPermission(input.projectId, ctx.user.id, ["owner", "admin"]);
      
      if (!isOwner && !hasAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No permission to view invitations" });
      }
      
      return getPendingInvitations(input.projectId);
    }),
  
  // Cancel/delete invitation
  cancelInvite: protectedProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await deleteInvitation(input.invitationId);
      
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to cancel invitation" });
      }
      
      return { success: true };
    }),
  
  // ============ TASK ASSIGNMENT ============
  
  // Assign task to user
  assignTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      userId: z.number().nullable(),
      projectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check permission
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      const hasEdit = await hasProjectPermission(input.projectId, ctx.user.id, ["owner", "admin", "editor"]);
      
      if (!isOwner && !hasEdit) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No permission to assign tasks" });
      }
      
      // Verify assignee is a member (if assigning)
      if (input.userId) {
        const isMember = await getProjectMemberByUserId(input.projectId, input.userId);
        const isAssigneeOwner = project.userId === input.userId;
        
        if (!isMember && !isAssigneeOwner) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User is not a member of this project" });
        }
      }
      
      const success = await assignTask(input.taskId, input.userId);
      
      if (!success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to assign task" });
      }
      
      // Get task title for activity log
      const [task] = await db.select({ title: tasks.title }).from(tasks)
        .where(eq(tasks.id, input.taskId));
      
      // Log activity
      await logActivity({
        projectId: input.projectId,
        userId: ctx.user.id,
        action: "assignment_changed",
        entityType: "task",
        entityId: input.taskId,
        entityTitle: task?.title || "Task",
        metadata: { assignedTo: input.userId },
      });
      
      return { success: true };
    }),
  
  // Get tasks assigned to current user
  getMyTasks: protectedProcedure
    .input(z.object({ projectId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return getTasksAssignedToUser(ctx.user.id, input.projectId);
    }),
  
  // Get assigned user for a task
  getTaskAssignee: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      return getAssignedUserForTask(input.taskId);
    }),
  
  // Search members for assignment dropdown
  searchMembers: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      query: z.string(),
    }))
    .query(async ({ input }) => {
      return searchProjectMembers(input.projectId, input.query);
    }),
  
  // ============ ACTIVITY FEED ============
  
  // Get activity feed for dashboard
  getDashboardActivity: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return getDashboardActivity(ctx.user.id, { limit: input.limit });
    }),
  
  // Get activity for a specific project
  getProjectActivity: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check access
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      const isOwner = project.userId === ctx.user.id;
      const isMember = await getProjectMemberByUserId(input.projectId, ctx.user.id);
      
      if (!isOwner && !isMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project" });
      }
      
      return getProjectActivity(input.projectId, {
        limit: input.limit,
        offset: input.offset,
      });
    }),
});
