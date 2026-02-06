import { z } from "zod";
import { router, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { 
  users, 
  userCredits, 
  creditTransactions,
  userRoles,
  userRoleAssignments,
  userInvitations,
  userActivityLog,
  creditLimits
} from "../drizzle/schema";
import { eq, desc, and, or, like, sql, gte, lte, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export const adminUsersRouter = router({
  // Get all users with stats
  list: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.string().optional(),
      status: z.enum(["active", "blocked", "pending"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build where conditions
      const conditions = [];
      
      if (input.search) {
        conditions.push(
          or(
            like(users.name, `%${input.search}%`),
            like(users.email, `%${input.search}%`)
          )
        );
      }
      
      if (input.role) {
        conditions.push(eq(users.role, input.role as "user" | "admin"));
      }
      
      if (input.dateFrom) {
        conditions.push(gte(users.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(users.createdAt, new Date(input.dateTo)));
      }

      // Get users with their credits
      const usersData = await db
        .select({
          id: users.id,
          openId: users.openId,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
          role: users.role,
          subscriptionPlan: users.subscriptionPlan,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
          credits: userCredits.credits,
          totalSpent: userCredits.totalSpent,
        })
        .from(users)
        .leftJoin(userCredits, eq(users.id, userCredits.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(users.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Get AI request counts for each user
      const userIds = usersData.map(u => u.id);
      let aiRequestCounts: Record<number, number> = {};
      
      if (userIds.length > 0) {
        const requestCounts = await db
          .select({
            userId: creditTransactions.userId,
            count: sql<number>`count(*)`,
          })
          .from(creditTransactions)
          .where(
            and(
              inArray(creditTransactions.userId, userIds),
              eq(creditTransactions.type, "ai_request")
            )
          )
          .groupBy(creditTransactions.userId);
        
        aiRequestCounts = Object.fromEntries(
          requestCounts.map(r => [r.userId, r.count])
        );
      }

      return {
        users: usersData.map(u => ({
          ...u,
          aiRequests: aiRequestCounts[u.id] || 0,
          status: "active" as const, // TODO: Add blocked status to users table
        })),
        total: countResult[0]?.count || 0,
      };
    }),

  // Get single user details
  getById: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new Error("User not found");

      // Get credits
      const [credits] = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, input.userId))
        .limit(1);

      // Get recent activity
      const activity = await db
        .select()
        .from(userActivityLog)
        .where(eq(userActivityLog.userId, input.userId))
        .orderBy(desc(userActivityLog.createdAt))
        .limit(20);

      // Get role assignments
      const roleAssignments = await db
        .select({
          roleId: userRoleAssignments.roleId,
          roleName: userRoles.name,
          roleNameRu: userRoles.nameRu,
          roleColor: userRoles.color,
        })
        .from(userRoleAssignments)
        .leftJoin(userRoles, eq(userRoleAssignments.roleId, userRoles.id))
        .where(eq(userRoleAssignments.userId, input.userId));

      return {
        user,
        credits,
        activity,
        roles: roleAssignments,
      };
    }),

  // Update user role
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      // Log activity
      await db.insert(userActivityLog).values({
        userId: input.userId,
        action: "role_changed",
        metadata: { newRole: input.role, changedBy: ctx.user.id },
      });

      return { success: true };
    }),

  // Block/unblock user
  toggleBlock: adminProcedure
    .input(z.object({
      userId: z.number(),
      blocked: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Log activity
      await db.insert(userActivityLog).values({
        userId: input.userId,
        action: input.blocked ? "blocked" : "unblocked",
        metadata: { changedBy: ctx.user.id },
      });

      return { success: true };
    }),

  // Delete user
  delete: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Don't allow deleting yourself
      if (input.userId === ctx.user.id) {
        throw new Error("Cannot delete your own account");
      }

      // Delete user and related data
      await db.delete(userCredits).where(eq(userCredits.userId, input.userId));
      await db.delete(creditTransactions).where(eq(creditTransactions.userId, input.userId));
      await db.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, input.userId));
      await db.delete(userActivityLog).where(eq(userActivityLog.userId, input.userId));
      await db.delete(users).where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Add credits to user
  addCredits: adminProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number().positive(),
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get current credits
      const [currentCredits] = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, input.userId))
        .limit(1);

      const newBalance = (currentCredits?.credits || 0) + input.amount;

      // Update credits
      if (currentCredits) {
        await db
          .update(userCredits)
          .set({ 
            credits: newBalance,
            totalEarned: sql`${userCredits.totalEarned} + ${input.amount}`,
          })
          .where(eq(userCredits.userId, input.userId));
      } else {
        await db.insert(userCredits).values({
          userId: input.userId,
          credits: input.amount,
          totalEarned: input.amount,
          totalSpent: 0,
        });
      }

      // Log transaction
      await db.insert(creditTransactions).values({
        userId: input.userId,
        amount: input.amount,
        balance: newBalance,
        type: "bonus",
        description: `${input.reason} (added by admin)`,
      });

      // Log activity
      await db.insert(userActivityLog).values({
        userId: input.userId,
        action: "credits_added",
        metadata: { amount: input.amount, reason: input.reason, addedBy: ctx.user.id },
      });

      return { success: true, newBalance };
    }),

  // ============ INVITATIONS ============

  // Get all invitations
  getInvitations: adminProcedure
    .input(z.object({
      status: z.enum(["pending", "accepted", "expired", "cancelled"]).optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      if (input.status) {
        conditions.push(eq(userInvitations.status, input.status));
      }

      const invitations = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          status: userInvitations.status,
          creditLimit: userInvitations.creditLimit,
          message: userInvitations.message,
          expiresAt: userInvitations.expiresAt,
          createdAt: userInvitations.createdAt,
          invitedByName: users.name,
          roleName: userRoles.nameRu,
        })
        .from(userInvitations)
        .leftJoin(users, eq(userInvitations.invitedBy, users.id))
        .leftJoin(userRoles, eq(userInvitations.roleId, userRoles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(userInvitations.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return invitations;
    }),

  // Create invitation
  createInvitation: adminProcedure
    .input(z.object({
      email: z.string().email(),
      roleId: z.number().optional(),
      creditLimit: z.number().default(1000),
      message: z.string().optional(),
      expiresInDays: z.number().default(7),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if email already invited
      const [existing] = await db
        .select()
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.email, input.email),
            eq(userInvitations.status, "pending")
          )
        )
        .limit(1);

      if (existing) {
        throw new Error("User already has a pending invitation");
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const [invitation] = await db
        .insert(userInvitations)
        .values({
          email: input.email,
          token,
          roleId: input.roleId,
          creditLimit: input.creditLimit,
          message: input.message,
          invitedBy: ctx.user.id,
          expiresAt,
        })
        .$returningId();

      // Log activity
      await db.insert(userActivityLog).values({
        userId: ctx.user.id,
        action: "invitation_sent",
        metadata: { email: input.email, invitationId: invitation.id },
      });

      return { 
        success: true, 
        invitationId: invitation.id,
        token,
      };
    }),

  // Cancel invitation
  cancelInvitation: adminProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(userInvitations)
        .set({ status: "cancelled" })
        .where(eq(userInvitations.id, input.invitationId));

      return { success: true };
    }),

  // Resend invitation
  resendInvitation: adminProcedure
    .input(z.object({ 
      invitationId: z.number(),
      expiresInDays: z.number().default(7),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const newToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      await db
        .update(userInvitations)
        .set({ 
          token: newToken,
          status: "pending",
          expiresAt,
        })
        .where(eq(userInvitations.id, input.invitationId));

      return { success: true, token: newToken };
    }),

  // ============ ROLES ============

  // Get all roles
  getRoles: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const roles = await db
      .select()
      .from(userRoles)
      .orderBy(desc(userRoles.priority));

    // Get user count per role
    const roleCounts = await db
      .select({
        roleId: userRoleAssignments.roleId,
        count: sql<number>`count(*)`,
      })
      .from(userRoleAssignments)
      .groupBy(userRoleAssignments.roleId);

    const countMap = Object.fromEntries(
      roleCounts.map(r => [r.roleId, r.count])
    );

    return roles.map(role => ({
      ...role,
      userCount: countMap[role.id] || 0,
    }));
  }),

  // Create role
  createRole: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      nameRu: z.string().optional(),
      description: z.string().optional(),
      color: z.string().default("#6366f1"),
      permissions: z.object({
        projectsCreate: z.boolean().default(false),
        projectsEdit: z.boolean().default(false),
        projectsDelete: z.boolean().default(false),
        projectsViewOnly: z.boolean().default(true),
        aiUseChat: z.boolean().default(true),
        aiCreateAgents: z.boolean().default(false),
        aiConfigureSkills: z.boolean().default(false),
        adminAccess: z.boolean().default(false),
        adminFullAccess: z.boolean().default(false),
        creditsUnlimited: z.boolean().default(false),
        creditsLimited: z.boolean().default(true),
      }),
      priority: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [role] = await db
        .insert(userRoles)
        .values({
          name: input.name,
          nameRu: input.nameRu,
          description: input.description,
          color: input.color,
          permissions: input.permissions,
          priority: input.priority,
          isSystem: false,
        })
        .$returningId();

      return { success: true, roleId: role.id };
    }),

  // Update role definition
  updateRoleDefinition: adminProcedure
    .input(z.object({
      roleId: z.number(),
      name: z.string().min(2).optional(),
      nameRu: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      permissions: z.object({
        projectsCreate: z.boolean(),
        projectsEdit: z.boolean(),
        projectsDelete: z.boolean(),
        projectsViewOnly: z.boolean(),
        aiUseChat: z.boolean(),
        aiCreateAgents: z.boolean(),
        aiConfigureSkills: z.boolean(),
        adminAccess: z.boolean(),
        adminFullAccess: z.boolean(),
        creditsUnlimited: z.boolean(),
        creditsLimited: z.boolean(),
      }).optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if system role
      const [role] = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.id, input.roleId))
        .limit(1);

      if (role?.isSystem) {
        throw new Error("Cannot modify system roles");
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.nameRu !== undefined) updateData.nameRu = input.nameRu;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.permissions !== undefined) updateData.permissions = input.permissions;
      if (input.priority !== undefined) updateData.priority = input.priority;

      await db
        .update(userRoles)
        .set(updateData)
        .where(eq(userRoles.id, input.roleId));

      return { success: true };
    }),

  // Delete role
  deleteRole: adminProcedure
    .input(z.object({ roleId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if system role
      const [role] = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.id, input.roleId))
        .limit(1);

      if (role?.isSystem) {
        throw new Error("Cannot delete system roles");
      }

      // Remove role assignments first
      await db.delete(userRoleAssignments).where(eq(userRoleAssignments.roleId, input.roleId));
      await db.delete(creditLimits).where(eq(creditLimits.roleId, input.roleId));
      await db.delete(userRoles).where(eq(userRoles.id, input.roleId));

      return { success: true };
    }),

  // Assign role to user
  assignRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if already assigned
      const [existing] = await db
        .select()
        .from(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.userId, input.userId),
            eq(userRoleAssignments.roleId, input.roleId)
          )
        )
        .limit(1);

      if (existing) {
        throw new Error("Role already assigned to user");
      }

      await db.insert(userRoleAssignments).values({
        userId: input.userId,
        roleId: input.roleId,
        assignedBy: ctx.user.id,
      });

      return { success: true };
    }),

  // Remove role from user
  removeRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.userId, input.userId),
            eq(userRoleAssignments.roleId, input.roleId)
          )
        );

      return { success: true };
    }),

  // Get user activity log
  getActivityLog: adminProcedure
    .input(z.object({
      userId: z.number().optional(),
      action: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      
      if (input.userId) {
        conditions.push(eq(userActivityLog.userId, input.userId));
      }
      
      if (input.dateFrom) {
        conditions.push(gte(userActivityLog.createdAt, new Date(input.dateFrom)));
      }
      
      if (input.dateTo) {
        conditions.push(lte(userActivityLog.createdAt, new Date(input.dateTo)));
      }

      const logs = await db
        .select({
          id: userActivityLog.id,
          userId: userActivityLog.userId,
          userName: users.name,
          userEmail: users.email,
          action: userActivityLog.action,
          metadata: userActivityLog.metadata,
          ipAddress: userActivityLog.ipAddress,
          createdAt: userActivityLog.createdAt,
        })
        .from(userActivityLog)
        .leftJoin(users, eq(userActivityLog.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(userActivityLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return logs;
    }),
});
