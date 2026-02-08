import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { projectMembers, projectInvitations, taskComments, commentReactions, users, projects, blocks, sections, tasks, discussionReadStatus, attachmentSettings } from "../drizzle/schema";
import { eq, and, desc, inArray, gt, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { invokeLLM } from "./_core/llm";
import { checkEntityAccess, checkTaskAccess, checkSectionAccess, requireAccessOrNotFound } from "./utils/authorization";

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
        joinedAt: projectMembers.joinedAt,
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
            joinedAt: project.createdAt,
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
      
      // Check for pending invitation (not yet used)
      const existingInvites = await db.select().from(projectInvitations).where(
        and(
          eq(projectInvitations.projectId, input.projectId),
          eq(projectInvitations.email, input.email)
        )
      );
      
      const pendingInvite = existingInvites.find((inv: { usedAt: Date | null }) => !inv.usedAt);
      if (pendingInvite) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation already sent" });
      }
      
      // Create invitation
      const inviteCode = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await db.insert(projectInvitations).values({
        projectId: input.projectId,
        email: input.email,
        role: input.role,
        inviteCode,
        invitedBy: ctx.user.id,
        expiresAt,
      });
      
      return { 
        success: true, 
        inviteLink: `/invite/${inviteCode}`,
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
      
      // Get all invitations for project and filter unused ones
      const allInvitations = await db.select().from(projectInvitations)
        .where(eq(projectInvitations.projectId, input.projectId))
        .orderBy(desc(projectInvitations.createdAt));
      
      return allInvitations.filter((inv: { usedAt: Date | null }) => !inv.usedAt);
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
      
      // Delete the invitation instead of setting status
      await db.delete(projectInvitations)
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
        .where(eq(projectInvitations.inviteCode, input.token)).limit(1);
      
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation" });
      }
      
      // Check if already used
      if (invitation.usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has already been used" });
      }
      
      // Check if expired
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
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
        joinedAt: new Date(),
      });
      
      // Mark invitation as used
      await db.update(projectInvitations)
        .set({ usedAt: new Date(), usedBy: ctx.user.id })
        .where(eq(projectInvitations.id, invitation.id));
      
      return { success: true, projectId: invitation.projectId };
    }),
  
  // ============ COMMENTS ============
  
  // List comments for a task
  // Universal discussion list - supports project, block, section, task
  listDiscussions: protectedProcedure
    .input(z.object({
      entityType: z.enum(["project", "block", "section", "task"]),
      entityId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Check access to the entity
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId);
      requireAccessOrNotFound(access, input.entityType);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const comments = await db.select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        entityType: taskComments.entityType,
        entityId: taskComments.entityId,
        userId: taskComments.userId,
        content: taskComments.content,
        parentId: taskComments.parentId,
        mentions: taskComments.mentions,
        attachmentIds: taskComments.attachmentIds,
        isEdited: taskComments.isEdited,
        isSummary: taskComments.isSummary,
        createdAt: taskComments.createdAt,
        updatedAt: taskComments.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.userId, users.id))
      .where(and(
        eq(taskComments.entityType, input.entityType),
        eq(taskComments.entityId, input.entityId)
      ))
      .orderBy(taskComments.createdAt);
      
      // Get reactions for all comments
      const commentIds = comments.map((c: { id: number }) => c.id);
      const reactions = commentIds.length > 0
        ? await db.select()
            .from(commentReactions)
            .where(inArray(commentReactions.commentId, commentIds))
        : [];

      // Group reactions by comment
      const reactionsByComment = reactions.reduce((acc: Record<number, typeof reactions>, r: { commentId: number; id: number; userId: number; emoji: string; createdAt: Date }) => {
        if (!acc[r.commentId]) acc[r.commentId] = [];
        acc[r.commentId].push(r);
        return acc;
      }, {} as Record<number, typeof reactions>);

      return comments.map((comment: { id: number; taskId: number | null; entityType: string | null; entityId: number | null; userId: number; content: string; parentId: number | null; mentions: number[] | null; isEdited: boolean | null; isSummary: boolean | null; createdAt: Date; updatedAt: Date | null; userName: string | null; userEmail: string | null }) => ({
        ...comment,
        reactions: reactionsByComment[comment.id] || [],
      }));
    }),

  // Universal add discussion message
  addDiscussion: protectedProcedure
    .input(z.object({
      entityType: z.enum(["project", "block", "section", "task"]),
      entityId: z.number(),
      content: z.string().min(1).max(5000),
      parentId: z.number().optional(),
      mentions: z.array(z.number()).optional(),
      isSummary: z.boolean().optional(),
      attachmentIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check editor access to add comments
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId, "viewer");
      requireAccessOrNotFound(access, input.entityType);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check attachment limit if attachments are provided
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        const [settings] = await db.select().from(attachmentSettings).limit(1);
        const maxFilesPerMessage = settings?.maxFilesPerMessage ?? 10;

        if (input.attachmentIds.length > maxFilesPerMessage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Превышен лимит вложений на сообщение (${maxFilesPerMessage})`,
          });
        }
      }

      const [result] = await db.insert(taskComments).values({
        taskId: input.entityType === "task" ? input.entityId : null,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: ctx.user.id,
        content: input.content,
        parentId: input.parentId || null,
        mentions: input.mentions || [],
        isSummary: input.isSummary || false,
        attachmentIds: input.attachmentIds || null,
      });

      return { id: result.insertId };
    }),

  // Legacy listComments - backward compatible
  listComments: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check access to the task
      const access = await checkTaskAccess(ctx.user.id, input.taskId);
      requireAccessOrNotFound(access, "задача");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const comments = await db.select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        userId: taskComments.userId,
        content: taskComments.content,
        parentId: taskComments.parentId,
        mentions: taskComments.mentions,
        attachmentIds: taskComments.attachmentIds,
        isEdited: taskComments.isEdited,
        isSummary: taskComments.isSummary,
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
      const commentIds = comments.map((c: { id: number }) => c.id);
      const reactions = commentIds.length > 0
        ? await db.select()
            .from(commentReactions)
            .where(inArray(commentReactions.commentId, commentIds))
        : [];

      // Group reactions by comment
      const reactionsByComment = reactions.reduce((acc: Record<number, typeof reactions>, r: { commentId: number; id: number; userId: number; emoji: string; createdAt: Date }) => {
        if (!acc[r.commentId]) acc[r.commentId] = [];
        acc[r.commentId].push(r);
        return acc;
      }, {} as Record<number, typeof reactions>);

      return comments.map((comment: { id: number; taskId: number | null; userId: number; content: string; parentId: number | null; mentions: number[] | null; isEdited: boolean | null; isSummary: boolean | null; createdAt: Date; updatedAt: Date | null; userName: string | null; userEmail: string | null }) => ({
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
      // Check viewer access (commenters can view)
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "viewer");
      requireAccessOrNotFound(access, "задача");

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

      // Get the comment to check access to its entity
      const [comment] = await db.select().from(taskComments)
        .where(eq(taskComments.id, input.commentId)).limit(1);

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Комментарий не найден" });
      }

      // Check access to the entity the comment belongs to
      if (comment.entityType && comment.entityId) {
        const access = await checkEntityAccess(ctx.user.id, comment.entityType as "project" | "block" | "section" | "task", comment.entityId, "viewer");
        requireAccessOrNotFound(access, comment.entityType);
      } else if (comment.taskId) {
        const access = await checkTaskAccess(ctx.user.id, comment.taskId, "viewer");
        requireAccessOrNotFound(access, "задача");
      }

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
  
  // ============ AI DISCUSSION TOOLS ============

  // AI-powered finalize: summarize discussion into structured document
  finalizeDiscussion: protectedProcedure
    .input(z.object({
      entityType: z.enum(["project", "block", "section", "task"]),
      entityId: z.number(),
      entityTitle: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check editor access for AI finalization
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId, "editor");
      requireAccessOrNotFound(access, input.entityType);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Fetch all non-summary comments for this entity
      const comments = await db.select({
        id: taskComments.id,
        content: taskComments.content,
        userName: users.name,
        createdAt: taskComments.createdAt,
        isSummary: taskComments.isSummary,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.userId, users.id))
      .where(and(
        eq(taskComments.entityType, input.entityType),
        eq(taskComments.entityId, input.entityId)
      ))
      .orderBy(taskComments.createdAt);

      const regularComments = comments.filter((c: { isSummary: boolean | null }) => !c.isSummary);
      if (regularComments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No messages to finalize" });
      }

      const discussionText = regularComments
        .map((c: { userName: string | null; createdAt: Date; content: string }) => `${c.userName || 'User'} (${new Date(c.createdAt).toLocaleDateString('ru')}): ${c.content}`)
        .join('\n');

      const entityLabel = { project: 'проекта', block: 'блока', section: 'раздела', task: 'задачи' }[input.entityType];

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Ты — помощник по управлению проектами. Создай структурированный итоговый документ из обсуждения. Пиши на русском. Формат: markdown с заголовками. Включи: 1) Ключевые решения, 2) Открытые вопросы, 3) Следующие шаги. Будь кратким и конкретным.`
            },
            {
              role: "user",
              content: `Финализируй обсуждение ${entityLabel} "${input.entityTitle}":\n\n${discussionText}`
            }
          ],
        });

        const summary = response.choices[0]?.message?.content;
        if (typeof summary !== 'string' || !summary.trim()) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned empty response" });
        }

        // Save as summary comment
        const [result] = await db.insert(taskComments).values({
          taskId: input.entityType === 'task' ? input.entityId : null,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: ctx.user.id,
          content: summary.trim(),
          isSummary: true,
        });

        return { id: result.insertId, summary: summary.trim() };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI error: ${error.message}` });
      }
    }),

  // AI-powered distribute: analyze discussion and suggest tasks
  distributeDiscussion: protectedProcedure
    .input(z.object({
      entityType: z.enum(["project", "block", "section", "task"]),
      entityId: z.number(),
      entityTitle: z.string(),
      projectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check editor access for AI distribution
      const access = await checkEntityAccess(ctx.user.id, input.entityType, input.entityId, "editor");
      requireAccessOrNotFound(access, input.entityType);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Fetch discussion
      const comments = await db.select({
        content: taskComments.content,
        userName: users.name,
        isSummary: taskComments.isSummary,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.userId, users.id))
      .where(and(
        eq(taskComments.entityType, input.entityType),
        eq(taskComments.entityId, input.entityId)
      ))
      .orderBy(taskComments.createdAt);

      const regularComments = comments.filter((c: { isSummary: boolean | null }) => !c.isSummary);
      if (regularComments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No messages to distribute" });
      }

      // Get project structure for context
      const projectBlocks = await db.select({
        id: blocks.id,
        title: blocks.title,
      }).from(blocks).where(eq(blocks.projectId, input.projectId));

      const allSections: { id: number; title: string; blockId: number; blockTitle: string }[] = [];
      for (const block of projectBlocks) {
        const secs = await db.select({
          id: sections.id,
          title: sections.title,
          blockId: sections.blockId,
        }).from(sections).where(eq(sections.blockId, block.id));
        allSections.push(...secs.map((s: { id: number; title: string; blockId: number }) => ({ ...s, blockTitle: block.title })));
      }

      const discussionText = regularComments
        .map((c: { userName: string | null; content: string }) => `${c.userName || 'User'}: ${c.content}`)
        .join('\n');

      const structureText = allSections.map(s => 
        `Блок "${s.blockTitle}" → Раздел "${s.title}" (id: ${s.id})`
      ).join('\n');

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Ты — помощник по управлению проектами. Проанализируй обсуждение и предложи задачи. Ответ — строго JSON. Формат:\n{"tasks": [{"title": "...", "description": "...", "sectionId": <number>, "priority": "medium|high|low|critical"}]}\nВыбирай sectionId из предоставленной структуры проекта. Если подходящего раздела нет, используй sectionId: null. Пиши названия задач на русском.`
            },
            {
              role: "user",
              content: `Обсуждение по "${input.entityTitle}":\n\n${discussionText}\n\nСтруктура проекта:\n${structureText}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content;
        if (typeof content !== 'string') return { tasks: [] };

        try {
          const parsed = JSON.parse(content);
          const suggestedTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
          return {
            tasks: suggestedTasks.map((t: any) => ({
              title: String(t.title || '').substring(0, 500),
              description: String(t.description || '').substring(0, 2000),
              sectionId: typeof t.sectionId === 'number' ? t.sectionId : null,
              priority: ['critical', 'high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
            })),
            sections: allSections.map(s => ({ id: s.id, title: s.title, blockTitle: s.blockTitle })),
          };
        } catch {
          return { tasks: [], sections: [] };
        }
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI error: ${error.message}` });
      }
    }),

  // Create tasks from distributed discussion results
  createTasksFromDiscussion: protectedProcedure
    .input(z.object({
      tasks: z.array(z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        sectionId: z.number(),
        priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check editor access to all sections where tasks will be created
      const uniqueSectionIds = Array.from(new Set(input.tasks.map(t => t.sectionId)));
      for (const sectionId of uniqueSectionIds) {
        const access = await checkSectionAccess(ctx.user.id, sectionId, "editor");
        requireAccessOrNotFound(access, "секция");
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const createdIds: number[] = [];
      for (const task of input.tasks) {
        const [result] = await db.insert(tasks).values({
          sectionId: task.sectionId,
          title: task.title,
          description: task.description || null,
          priority: task.priority || 'medium',
          status: 'not_started',
        });
        createdIds.push(Number(result.insertId));
      }

      return { createdIds, count: createdIds.length };
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
      
      members.forEach((m: { userId: number; userName: string | null; userEmail: string | null }) => {
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

  // ============ UNREAD DISCUSSION TRACKING ============

  // Get unread discussion counts for all blocks and sections in a project
  getUnreadCounts: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const userId = ctx.user.id;

      // Get all blocks for this project
      const projectBlocks = await db.select({ id: blocks.id }).from(blocks).where(eq(blocks.projectId, input.projectId));
      const blockIds = projectBlocks.map((b: { id: number }) => b.id);

      // Get all sections for these blocks
      let sectionIds: number[] = [];
      if (blockIds.length > 0) {
        const projectSections = await db.select({ id: sections.id }).from(sections).where(inArray(sections.blockId, blockIds));
        sectionIds = projectSections.map((s: { id: number }) => s.id);
      }

      // Get all read statuses for this user
      const readStatuses = await db.select().from(discussionReadStatus).where(
        eq(discussionReadStatus.userId, userId)
      );

      const readStatusMap = new Map<string, Date>();
      for (const rs of readStatuses) {
        readStatusMap.set(`${rs.entityType}-${rs.entityId}`, rs.lastReadAt);
      }

      // Count unread comments for blocks
      const blockUnreads: Record<number, number> = {};
      for (const blockId of blockIds) {
        const lastRead = readStatusMap.get(`block-${blockId}`);
        let unreadCount: { count: number }[];
        if (lastRead) {
          unreadCount = await db.select({ count: count() }).from(taskComments).where(
            and(
              eq(taskComments.entityType, "block"),
              eq(taskComments.entityId, blockId),
              gt(taskComments.createdAt, lastRead)
            )
          );
        } else {
          unreadCount = await db.select({ count: count() }).from(taskComments).where(
            and(
              eq(taskComments.entityType, "block"),
              eq(taskComments.entityId, blockId)
            )
          );
        }
        const c = unreadCount[0]?.count || 0;
        if (c > 0) blockUnreads[blockId] = c;
      }

      // Count unread comments for sections
      const sectionUnreads: Record<number, number> = {};
      for (const sectionId of sectionIds) {
        const lastRead = readStatusMap.get(`section-${sectionId}`);
        let unreadCount: { count: number }[];
        if (lastRead) {
          unreadCount = await db.select({ count: count() }).from(taskComments).where(
            and(
              eq(taskComments.entityType, "section"),
              eq(taskComments.entityId, sectionId),
              gt(taskComments.createdAt, lastRead)
            )
          );
        } else {
          unreadCount = await db.select({ count: count() }).from(taskComments).where(
            and(
              eq(taskComments.entityType, "section"),
              eq(taskComments.entityId, sectionId)
            )
          );
        }
        const c = unreadCount[0]?.count || 0;
        if (c > 0) sectionUnreads[sectionId] = c;
      }

      return { blockUnreads, sectionUnreads };
    }),

  // Mark discussions as read for a specific entity
  markDiscussionRead: protectedProcedure
    .input(z.object({
      entityType: z.enum(["project", "block", "section", "task"]),
      entityId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const userId = ctx.user.id;

      // Upsert: check if record exists
      const existing = await db.select().from(discussionReadStatus).where(
        and(
          eq(discussionReadStatus.userId, userId),
          eq(discussionReadStatus.entityType, input.entityType),
          eq(discussionReadStatus.entityId, input.entityId)
        )
      ).limit(1);

      if (existing.length > 0) {
        await db.update(discussionReadStatus)
          .set({ lastReadAt: new Date() })
          .where(eq(discussionReadStatus.id, existing[0].id));
      } else {
        await db.insert(discussionReadStatus).values({
          userId,
          entityType: input.entityType,
          entityId: input.entityId,
          lastReadAt: new Date(),
        });
      }

      return { success: true };
    }),
});
