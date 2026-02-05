import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { projectMembers, projectInvitations, taskComments, commentReactions, users, projects } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// Helper to generate invite token
const generateToken = () => crypto.randomBytes(32).toString("hex");

// Helper to check project access
async function checkProjectAccess(userId: number, projectId: number, requiredRole?: "owner" | "editor" | "viewer") {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  
  // Check if user is project owner
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  
  if (project?.userId === userId) {
    return { role: "owner" as const, hasAccess: true };
  }
  
  // Check membership
  const [membership] = await db.select().from(projectMembers).where(
    and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    )
  ).limit(1);
  
  if (!membership) {
    return { role: null, hasAccess: false };
  }
  
  const roleHierarchy: Record<string, number> = { owner: 3, editor: 2, viewer: 1 };
  const hasAccess = !requiredRole || (roleHierarchy[membership.role] || 0) >= (roleHierarchy[requiredRole] || 0);
  
  return { role: membership.role, hasAccess };
}

export const collaborationRouter = router({
  // ============ PROJECT MEMBERS ============
  
  // List project members
  listMembers: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { hasAccess } = await checkProjectAccess(ctx.user.id, input.projectId);
      
      if (!hasAccess) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project" });
      }
      
      // Get project owner
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
      
      // Get all members
      const members = await db.select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        invitedAt: projectMembers.invitedAt,
        acceptedAt: projectMembers.acceptedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, input.projectId));
      
      // Add owner to the list
      if (project) {
        const [owner] = await db.select().from(users).where(eq(users.id, project.userId)).limit(1);
        
        return [
          {
            id: 0,
            userId: project.userId,
            role: "owner" as const,
            invitedAt: project.createdAt,
            acceptedAt: project.createdAt,
            userName: owner?.name || "Unknown",
            userEmail: owner?.email || null,
          },
          ...members,
        ];
      }
      
      return members;
    }),
  
  // Update member role
  updateMemberRole: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      memberId: z.number(),
      role: z.enum(["editor", "viewer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { role } = await checkProjectAccess(ctx.user.id, input.projectId, "owner");
      
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can change roles" });
      }
      
      await db.update(projectMembers)
        .set({ role: input.role })
        .where(eq(projectMembers.id, input.memberId));
      
      return { success: true };
    }),
  
  // Remove member
  removeMember: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      memberId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { role } = await checkProjectAccess(ctx.user.id, input.projectId, "owner");
      
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can remove members" });
      }
      
      await db.delete(projectMembers)
        .where(eq(projectMembers.id, input.memberId));
      
      return { success: true };
    }),
  
  // Leave project
  leaveProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is owner
      const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
      
      if (project?.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner cannot leave the project" });
      }
      
      await db.delete(projectMembers)
        .where(and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),
  
  // ============ INVITATIONS ============
  
  // Send invitation
  sendInvitation: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      email: z.string().email(),
      role: z.enum(["editor", "viewer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { role } = await checkProjectAccess(ctx.user.id, input.projectId, "owner");
      
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can invite members" });
      }
      
      // Check if user already exists and is a member
      const [existingUser] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      
      if (existingUser) {
        const [existingMember] = await db.select().from(projectMembers).where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, existingUser.id)
          )
        ).limit(1);
        
        if (existingMember) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User is already a member" });
        }
      }
      
      // Check for pending invitation
      const [pendingInvite] = await db.select().from(projectInvitations).where(
        and(
          eq(projectInvitations.projectId, input.projectId),
          eq(projectInvitations.email, input.email),
          eq(projectInvitations.status, "pending")
        )
      ).limit(1);
      
      if (pendingInvite) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation already sent" });
      }
      
      // Create invitation
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await db.insert(projectInvitations).values({
        projectId: input.projectId,
        email: input.email,
        role: input.role,
        token,
        invitedBy: ctx.user.id,
        expiresAt,
      });
      
      return { 
        success: true, 
        inviteLink: `/invite/${token}`,
        message: `Invitation sent to ${input.email}`
      };
    }),
  
  // List pending invitations
  listInvitations: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { role } = await checkProjectAccess(ctx.user.id, input.projectId, "owner");
      
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can view invitations" });
      }
      
      return db.select().from(projectInvitations)
        .where(and(
          eq(projectInvitations.projectId, input.projectId),
          eq(projectInvitations.status, "pending")
        ))
        .orderBy(desc(projectInvitations.createdAt));
    }),
  
  // Cancel invitation
  cancelInvitation: protectedProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invitation] = await db.select().from(projectInvitations)
        .where(eq(projectInvitations.id, input.invitationId)).limit(1);
      
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      
      const { role } = await checkProjectAccess(ctx.user.id, invitation.projectId, "owner");
      
      if (role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only project owner can cancel invitations" });
      }
      
      await db.update(projectInvitations)
        .set({ status: "cancelled" })
        .where(eq(projectInvitations.id, input.invitationId));
      
      return { success: true };
    }),
  
  // Accept invitation
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invitation] = await db.select().from(projectInvitations)
        .where(and(
          eq(projectInvitations.token, input.token),
          eq(projectInvitations.status, "pending")
        )).limit(1);
      
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation" });
      }
      
      if (new Date() > invitation.expiresAt) {
        await db.update(projectInvitations)
          .set({ status: "expired" })
          .where(eq(projectInvitations.id, invitation.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
      }
      
      // Check if user email matches
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      
      if (user?.email !== invitation.email) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation was sent to a different email" });
      }
      
      // Add user as member
      await db.insert(projectMembers).values({
        projectId: invitation.projectId,
        userId: ctx.user.id,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        acceptedAt: new Date(),
      });
      
      // Update invitation status
      await db.update(projectInvitations)
        .set({ status: "accepted" })
        .where(eq(projectInvitations.id, invitation.id));
      
      return { success: true, projectId: invitation.projectId };
    }),
  
  // ============ COMMENTS ============
  
  // List comments for a task
  listComments: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const comments = await db.select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        userId: taskComments.userId,
        content: taskComments.content,
        parentId: taskComments.parentId,
        mentions: taskComments.mentions,
        isEdited: taskComments.isEdited,
        createdAt: taskComments.createdAt,
        updatedAt: taskComments.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.userId, users.id))
      .where(eq(taskComments.taskId, input.taskId))
      .orderBy(taskComments.createdAt);
      
      // Get reactions for all comments
      const commentIds = comments.map(c => c.id);
      const reactions = commentIds.length > 0 
        ? await db.select()
            .from(commentReactions)
            .where(inArray(commentReactions.commentId, commentIds))
        : [];
      
      // Group reactions by comment
      const reactionsByComment = reactions.reduce((acc, r) => {
        if (!acc[r.commentId]) acc[r.commentId] = [];
        acc[r.commentId].push(r);
        return acc;
      }, {} as Record<number, typeof reactions>);
      
      return comments.map(comment => ({
        ...comment,
        reactions: reactionsByComment[comment.id] || [],
      }));
    }),
  
  // Add comment
  addComment: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      content: z.string().min(1).max(5000),
      parentId: z.number().optional(),
      mentions: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [result] = await db.insert(taskComments).values({
        taskId: input.taskId,
        userId: ctx.user.id,
        content: input.content,
        parentId: input.parentId || null,
        mentions: input.mentions || [],
      });
      
      return { id: result.insertId };
    }),
  
  // Update comment
  updateComment: protectedProcedure
    .input(z.object({
      commentId: z.number(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [comment] = await db.select().from(taskComments)
        .where(eq(taskComments.id, input.commentId)).limit(1);
      
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      
      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own comments" });
      }
      
      await db.update(taskComments)
        .set({ content: input.content, isEdited: true })
        .where(eq(taskComments.id, input.commentId));
      
      return { success: true };
    }),
  
  // Delete comment
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [comment] = await db.select().from(taskComments)
        .where(eq(taskComments.id, input.commentId)).limit(1);
      
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      
      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own comments" });
      }
      
      // Delete reactions first
      await db.delete(commentReactions)
        .where(eq(commentReactions.commentId, input.commentId));
      
      // Delete replies
      await db.delete(taskComments)
        .where(eq(taskComments.parentId, input.commentId));
      
      // Delete comment
      await db.delete(taskComments)
        .where(eq(taskComments.id, input.commentId));
      
      return { success: true };
    }),
  
  // Add reaction
  addReaction: protectedProcedure
    .input(z.object({
      commentId: z.number(),
      emoji: z.string().max(32),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if already reacted with same emoji
      const [existing] = await db.select().from(commentReactions)
        .where(and(
          eq(commentReactions.commentId, input.commentId),
          eq(commentReactions.userId, ctx.user.id),
          eq(commentReactions.emoji, input.emoji)
        )).limit(1);
      
      if (existing) {
        // Remove reaction (toggle)
        await db.delete(commentReactions)
          .where(eq(commentReactions.id, existing.id));
        return { action: "removed" };
      }
      
      await db.insert(commentReactions).values({
        commentId: input.commentId,
        userId: ctx.user.id,
        emoji: input.emoji,
      });
      
      return { action: "added" };
    }),
  
  // Get users for @mentions
  searchUsers: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      query: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get project owner
      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId)).limit(1);
      
      // Get all members
      const members = await db.select({
        userId: projectMembers.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, input.projectId));
      
      // Add owner
      const allUsers: { id: number; name: string; email: string | null }[] = [];
      if (project) {
        const [owner] = await db.select().from(users)
          .where(eq(users.id, project.userId)).limit(1);
        if (owner) {
          allUsers.push({
            id: owner.id,
            name: owner.name || "Unknown",
            email: owner.email,
          });
        }
      }
      
      members.forEach(m => {
        if (m.userId && !allUsers.find(u => u.id === m.userId)) {
          allUsers.push({
            id: m.userId,
            name: m.userName || "Unknown",
            email: m.userEmail,
          });
        }
      });
      
      // Filter by query if provided
      if (input.query) {
        const q = input.query.toLowerCase();
        return allUsers.filter(u => 
          u.name?.toLowerCase().includes(q) || 
          u.email?.toLowerCase().includes(q)
        );
      }
      
      return allUsers;
    }),
});
