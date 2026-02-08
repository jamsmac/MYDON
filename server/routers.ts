import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import * as db from "./db";
import * as googleDrive from "./googleDrive";
import * as googleCalendar from "./googleCalendar";
import { subscriptionRouter, aiIntegrationsRouter } from "./subscriptionRouter";
import { agentsRouter, skillsRouter, mcpServersRouter, orchestratorRouter } from "./orchestratorRouter";
import { stripeRouter } from "./stripe/stripeRouter";
import { checkProjectLimit, checkAiRequestLimit, incrementAiUsage, getUserUsageStats } from "./limits/limitsService";
import { limitsRouter } from "./limits/limitsRouter";
import { collaborationRouter } from "./collaborationRouter";
import { notificationsRouter } from "./notificationsRouter";
import { teamRouter } from "./teamRouter";
import { analyticsRouter } from "./analyticsRouter";
import { analyticsExportRouter } from "./analyticsExport";
import { templateEnhancedRouter } from "./templateEnhancedRouter";
import { aiEnhancementsRouter } from "./aiEnhancementsRouter";
import { icalRouter } from "./icalRouter";
import { webhookRouter } from "./webhookRouter";
import { restApiRouter } from "./restApiRouter";
import { apiKeysRouter } from "./apiKeysRouter";
import { timeTrackingRouter } from "./timeTrackingRouter";
import { gamificationRouter } from "./gamificationRouter";
import { aiTrpcRouter } from "./aiTrpcRouter";
import { relationsRouter } from './relationsRouter';
import { aiDecisionRouter } from './aiDecisionRouter';
import { aiSessionRouter } from './aiSessionRouter';
import { adminRouter } from './adminRouter';
import { adminUsersRouter } from './adminUsersRouter';
import { adminCreditsRouter } from './adminCreditsRouter';
import { adminPricingRouter } from './adminPricingRouter';
import { adminPromptsRouter } from './adminPromptsRouter';
import { adminContentRouter } from './adminContentRouter';
import { adminUIRouter } from './adminUIRouter';
import { adminIntegrationsRouter } from './adminIntegrationsRouter';
import { adminModelRatingsRouter } from './adminModelRatingsRouter';
import { skillExecutionRouter } from './skillExecutionRouter';
import { adminLogsRouter } from './adminLogsRouter';
import { usageRouter } from './usageRouter';
import { customFieldsRouter } from './customFieldsRouter';
import { savedViewsRouter } from './savedViewsRouter';
import { openclawRouter } from './openclawRouter';
import { attachmentsRouter } from './attachmentsRouter';
import { getDefaultTags } from './utils/defaultTags';
import { getNotificationTriggers } from './integrations/openclaw';
import { checkAndAwardAchievements, type AchievementResult } from "./achievementService";
import * as schema from '../drizzle/schema';
import { getDb } from './db';
import { TRPCError } from "@trpc/server";
import {
  checkProjectAccess,
  checkBlockAccess,
  checkSectionAccess,
  checkTaskAccess,
  checkSubtaskAccess,
  checkEntityAccess,
  requireAccessOrNotFound,
} from './utils/authorization';
import {
  paginationInputSchema,
  optionalPaginationInputSchema,
  applyPaginationDefaults,
  createPaginatedResponse,
  calculateOffset,
} from './utils/pagination';

// ============ PROJECT ROUTER ============
const projectRouter = router({
  list: protectedProcedure
    .input(optionalPaginationInputSchema.optional())
    .query(async ({ ctx, input }) => {
      // Support both paginated and non-paginated requests for backward compatibility
      if (input?.page !== undefined || input?.pageSize !== undefined) {
        const { page, pageSize } = applyPaginationDefaults(input);
        const { data, total } = await db.getProjectsByUserPaginated(ctx.user.id, page, pageSize);
        return createPaginatedResponse(data, page, pageSize, total);
      }
      // Non-paginated fallback for existing clients
      return db.getProjectsByUser(ctx.user.id);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getProjectById(input.id, ctx.user.id);
    }),

  getFull: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getFullProject(input.id, ctx.user.id);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      startDate: z.date().optional(),
      targetDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check project limit before creation
      const limitCheck = await checkProjectLimit(ctx.user.id);
      if (!limitCheck.allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: limitCheck.message || 'Project limit reached',
        });
      }
      
      const project = await db.createProject({
        ...input,
        userId: ctx.user.id,
      });
      
      // Seed default tags for the new project
      try {
        const database = await getDb();
        if (database && project.id) {
          const defaultTags = getDefaultTags(true); // Use Russian names
          const tagValues = defaultTags.map(tag => ({
            projectId: project.id,
            userId: ctx.user.id,
            name: tag.name,
            color: tag.color,
            icon: tag.icon || null,
            tagType: tag.tagType,
            description: tag.description || null,
            usageCount: 0,
            isArchived: false,
          }));
          await database.insert(schema.tags).values(tagValues);
        }
      } catch (error) {
        // Log but don't fail project creation if tags fail
        console.error('Failed to seed default tags:', error);
      }
      
      // Check achievements for project creation
      const achievements = await checkAndAwardAchievements(ctx.user.id, "project_created");
      
      return {
        ...project,
        achievements,
      };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      status: z.enum(["active", "archived", "completed"]).optional(),
      startDate: z.date().optional(),
      targetDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, status, ...rest } = input;
      
      // Get current project to check if status is changing to completed
      const currentProject = await db.getProjectById(id, ctx.user.id);
      const isCompletingProject = status === "completed" && currentProject?.status !== "completed";
      
      const updatedProject = await db.updateProject(id, ctx.user.id, { ...rest, status });
      
      // Check achievements if project was completed
      let achievements: AchievementResult | null = null;
      if (isCompletingProject) {
        achievements = await checkAndAwardAchievements(ctx.user.id, "project_completed");
      }
      
      return {
        ...updatedProject,
        achievements,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteProject(input.id, ctx.user.id);
    }),

  createFromRoadmap: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      blocks: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        duration: z.string().optional(),
        sections: z.array(z.object({
          title: z.string(),
          tasks: z.array(z.object({
            title: z.string(),
            description: z.string().optional(),
          })).optional(),
        })).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create project
      const project = await db.createProject({
        name: input.name,
        description: input.description,
        userId: ctx.user.id,
      });

      // Create blocks, sections, and tasks
      for (let blockIndex = 0; blockIndex < input.blocks.length; blockIndex++) {
        const blockData = input.blocks[blockIndex];
        const block = await db.createBlock({
          projectId: project.id,
          number: blockIndex + 1,
          title: blockData.title,
          description: blockData.description,
          duration: blockData.duration,
          sortOrder: blockIndex,
        });

        if (blockData.sections) {
          for (let sectionIndex = 0; sectionIndex < blockData.sections.length; sectionIndex++) {
            const sectionData = blockData.sections[sectionIndex];
            const section = await db.createSection({
              blockId: block.id,
              title: sectionData.title,
              sortOrder: sectionIndex,
            });

            if (sectionData.tasks) {
              for (let taskIndex = 0; taskIndex < sectionData.tasks.length; taskIndex++) {
                const taskData = sectionData.tasks[taskIndex];
                await db.createTask({
                  sectionId: section.id,
                  title: taskData.title,
                  description: taskData.description,
                  sortOrder: taskIndex,
                  status: 'not_started',
                });
              }
            }
          }
        }
      }

      return project;
    }),
});

// ============ BLOCK ROUTER ============
const blockRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "проект");
      return db.getBlocksByProject(input.projectId);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      number: z.number(),
      title: z.string().min(1).max(255),
      titleRu: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      duration: z.string().optional(),
      deadline: z.date().optional(),
      reminderDays: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId, "editor");
      requireAccessOrNotFound(access, "проект");
      return db.createBlock(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      titleRu: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      duration: z.string().optional(),
      deadline: z.date().nullable().optional(),
      reminderDays: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkBlockAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "блок");
      const { id, ...data } = input;
      return db.updateBlock(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkBlockAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "блок");
      return db.deleteBlock(input.id);
    }),

  reorder: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      blockIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId, "editor");
      requireAccessOrNotFound(access, "проект");
      return db.reorderBlocks(input.projectId, input.blockIds);
    }),
});

// ============ SECTION ROUTER ============
const sectionRouter = router({
  list: protectedProcedure
    .input(z.object({ blockId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkBlockAccess(ctx.user.id, input.blockId);
      requireAccessOrNotFound(access, "блок");
      return db.getSectionsByBlock(input.blockId);
    }),

  create: protectedProcedure
    .input(z.object({
      blockId: z.number(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkBlockAccess(ctx.user.id, input.blockId, "editor");
      requireAccessOrNotFound(access, "блок");
      return db.createSection(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSectionAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "раздел");
      const { id, ...data } = input;
      return db.updateSection(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSectionAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "раздел");
      return db.deleteSection(input.id);
    }),

  move: protectedProcedure
    .input(z.object({
      id: z.number(),
      blockId: z.number(),
      sortOrder: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to both source section and target block
      const sourceAccess = await checkSectionAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(sourceAccess, "раздел");
      const targetAccess = await checkBlockAccess(ctx.user.id, input.blockId, "editor");
      requireAccessOrNotFound(targetAccess, "блок");
      return db.moveSection(input.id, input.blockId, input.sortOrder);
    }),

  // Convert section to task
  convertToTask: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      targetSectionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sourceAccess = await checkSectionAccess(ctx.user.id, input.sectionId, "editor");
      requireAccessOrNotFound(sourceAccess, "раздел");
      const targetAccess = await checkSectionAccess(ctx.user.id, input.targetSectionId, "editor");
      requireAccessOrNotFound(targetAccess, "целевой раздел");
      return db.convertSectionToTask(input.sectionId, input.targetSectionId);
    }),

  // Reorder sections within a block
  reorder: protectedProcedure
    .input(z.object({
      blockId: z.number(),
      sectionIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkBlockAccess(ctx.user.id, input.blockId, "editor");
      requireAccessOrNotFound(access, "блок");
      return db.reorderSections(input.blockId, input.sectionIds);
    }),
});

// ============ TASK ROUTER ============
const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const access = await checkSectionAccess(ctx.user.id, input.sectionId);
      requireAccessOrNotFound(access, "раздел");

      // Support both paginated and non-paginated requests
      if (input.page !== undefined || input.pageSize !== undefined) {
        const page = input.page ?? 1;
        const pageSize = input.pageSize ?? 50;
        const { data, total } = await db.getTasksBySectionPaginated(input.sectionId, page, pageSize);
        return createPaginatedResponse(data, page, pageSize, total);
      }
      // Non-paginated fallback
      return db.getTasksBySection(input.sectionId);
    }),

  create: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      notes: z.string().optional(),
      summary: z.string().optional(),
      deadline: z.number().nullable().optional(), // Unix timestamp
      dependencies: z.array(z.number()).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSectionAccess(ctx.user.id, input.sectionId, "editor");
      requireAccessOrNotFound(access, "раздел");
      const { deadline, ...rest } = input;
      return db.createTask({
        ...rest,
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      notes: z.string().optional(),
      summary: z.string().optional(),
      dueDate: z.number().nullable().optional(), // Unix timestamp
      deadline: z.number().nullable().optional(), // Unix timestamp for hard deadline
      dependencies: z.array(z.number()).nullable().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "задача");

      const { id, dueDate, deadline, status, ...rest } = input;

      // Get current task to check if status is changing to completed
      const currentTask = await db.getTaskById(id);
      const isCompletingTask = status === "completed" && currentTask?.status !== "completed";

      const data = {
        ...rest,
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      };
      const updatedTask = await db.updateTask(id, data);

      // Check achievements if task was completed
      let achievements: AchievementResult | null = null;
      if (isCompletingTask) {
        achievements = await checkAndAwardAchievements(ctx.user.id, "task_completed");
      }

      // Send OpenClaw notifications (fire and forget)
      try {
        const triggers = getNotificationTriggers();
        const taskTitle = updatedTask?.title || currentTask?.title || "Задача";

        if (isCompletingTask && currentTask) {
          // Notify relevant users about task completion
          const notifyUserIds: number[] = [];
          // Add project owner/creator (would need to fetch from project)
          if (currentTask.assignedTo && currentTask.assignedTo !== ctx.user.id) {
            notifyUserIds.push(currentTask.assignedTo);
          }
          if (notifyUserIds.length > 0) {
            triggers.onTaskCompleted(
              id,
              taskTitle,
              ctx.user.id,
              ctx.user.name || ctx.user.email || "Пользователь",
              notifyUserIds
            ).catch(() => {});
          }
        } else if (status && currentTask && status !== currentTask.status) {
          // Status changed (but not to completed) - notify assignee
          const notifyUserIds = currentTask.assignedTo && currentTask.assignedTo !== ctx.user.id
            ? [currentTask.assignedTo]
            : [];
          if (notifyUserIds.length > 0 && currentTask.status) {
            triggers.onStatusChanged(
              id,
              taskTitle,
              currentTask.status,
              status,
              ctx.user.id,
              notifyUserIds
            ).catch(() => {});
          }
        }
      } catch {
        // Silently ignore notification errors
      }

      return {
        ...updatedTask,
        achievements,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.deleteTask(input.id);
    }),

  move: protectedProcedure
    .input(z.object({
      id: z.number(),
      sectionId: z.number(),
      sortOrder: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sourceAccess = await checkTaskAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(sourceAccess, "задача");
      const targetAccess = await checkSectionAccess(ctx.user.id, input.sectionId, "editor");
      requireAccessOrNotFound(targetAccess, "раздел");
      return db.moveTask(input.id, input.sectionId, input.sortOrder);
    }),

  // Split task into subtasks
  split: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      subtaskTitles: z.array(z.string().min(1)).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.splitTaskIntoSubtasks(input.taskId, input.subtaskTitles);
    }),

  // Merge multiple tasks into one
  merge: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(2),
      newTitle: z.string().min(1),
      sectionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to all tasks being merged
      for (const taskId of input.taskIds) {
        const access = await checkTaskAccess(ctx.user.id, taskId, "editor");
        requireAccessOrNotFound(access, "задача");
      }
      const targetAccess = await checkSectionAccess(ctx.user.id, input.sectionId, "editor");
      requireAccessOrNotFound(targetAccess, "раздел");
      return db.mergeTasks(input.taskIds, input.newTitle, input.sectionId);
    }),

  // Convert task to section
  convertToSection: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.convertTaskToSection(input.taskId);
    }),

  // Bulk update status
  bulkUpdateStatus: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(1),
      status: z.enum(["not_started", "in_progress", "completed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to first task to verify project access
      if (input.taskIds.length > 0) {
        const access = await checkTaskAccess(ctx.user.id, input.taskIds[0], "editor");
        requireAccessOrNotFound(access, "задача");
      }
      const count = await db.bulkUpdateTaskStatus(input.taskIds, input.status);
      return { updated: count };
    }),

  // Bulk update priority
  bulkUpdatePriority: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(1),
      priority: z.enum(["low", "medium", "high", "critical"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.taskIds.length > 0) {
        const access = await checkTaskAccess(ctx.user.id, input.taskIds[0], "editor");
        requireAccessOrNotFound(access, "задача");
      }
      const count = await db.bulkUpdateTaskPriority(input.taskIds, input.priority);
      return { updated: count };
    }),

  // Bulk update assignee
  bulkUpdateAssignee: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(1),
      assigneeId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.taskIds.length > 0) {
        const access = await checkTaskAccess(ctx.user.id, input.taskIds[0], "editor");
        requireAccessOrNotFound(access, "задача");
      }
      const count = await db.bulkUpdateTaskAssignee(input.taskIds, input.assigneeId);

      // Send OpenClaw notifications for task assignments (fire and forget)
      if (input.assigneeId && input.assigneeId !== ctx.user.id) {
        try {
          const triggers = getNotificationTriggers();
          // Get task details for notifications
          for (const taskId of input.taskIds.slice(0, 5)) { // Limit to first 5 to avoid spam
            const task = await db.getTaskById(taskId);
            if (task) {
              triggers.onTaskAssigned(
                taskId,
                task.title,
                input.assigneeId,
                task.deadline
              ).catch(() => {});
            }
          }
        } catch {
          // Silently ignore notification errors
        }
      }

      return { updated: count };
    }),

  // Bulk delete
  bulkDelete: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to all tasks
      for (const taskId of input.taskIds) {
        const access = await checkTaskAccess(ctx.user.id, taskId, "editor");
        requireAccessOrNotFound(access, "задача");
      }
      const count = await db.bulkDeleteTasks(input.taskIds);
      return { deleted: count };
    }),

  // Duplicate task
  duplicate: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.duplicateTask(input.taskId);
    }),

  // Reorder tasks within a section
  reorder: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      taskIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSectionAccess(ctx.user.id, input.sectionId, "editor");
      requireAccessOrNotFound(access, "раздел");
      return db.reorderTasks(input.sectionId, input.taskIds);
    }),
  // Reorder tasks globally (across sections) - used by Table View drag & drop
  reorderGlobal: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to first task to verify project access
      if (input.taskIds.length > 0) {
        const access = await checkTaskAccess(ctx.user.id, input.taskIds[0], "editor");
        requireAccessOrNotFound(access, "задача");
      }
      return db.reorderTasksGlobal(input.taskIds);
    }),

  // Get all overdue tasks for user
  getOverdue: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getOverdueTasks(ctx.user.id);
    }),

  // ============ TASK DEPENDENCIES (for Gantt Chart) ============

  // Get dependencies for a task
  getDependencies: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId);
      requireAccessOrNotFound(access, "задача");
      return db.getTaskDependencies(input.taskId);
    }),

  // Get tasks that depend on this task
  getDependentTasks: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId);
      requireAccessOrNotFound(access, "задача");
      return db.getDependentTasks(input.taskId);
    }),

  // Create a dependency between tasks
  addDependency: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      dependsOnTaskId: z.number(),
      dependencyType: z.enum(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]).optional(),
      lagDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to both tasks
      const access1 = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access1, "задача");
      const access2 = await checkTaskAccess(ctx.user.id, input.dependsOnTaskId);
      requireAccessOrNotFound(access2, "зависимая задача");

      // Prevent self-dependency
      if (input.taskId === input.dependsOnTaskId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task cannot depend on itself',
        });
      }
      return db.createTaskDependency({
        taskId: input.taskId,
        dependsOnTaskId: input.dependsOnTaskId,
        dependencyType: input.dependencyType || "finish_to_start",
        lagDays: input.lagDays || 0,
      });
    }),

  // Remove a dependency
  removeDependency: protectedProcedure
    .input(z.object({ dependencyId: z.number(), taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check access to the task that owns this dependency
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.deleteTaskDependency(input.dependencyId);
    }),

  // Get Gantt chart data for a project
  getGanttData: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "проект");
      return db.getGanttChartData(input.projectId);
    }),
});

// ============ SUBTASK ROUTER ============
const subtaskRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId);
      requireAccessOrNotFound(access, "задача");
      return db.getSubtasksByTask(input.taskId);
    }),

  create: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      title: z.string().min(1).max(500),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.createSubtask(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      status: z.enum(["not_started", "in_progress", "completed"]).optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSubtaskAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "подзадача");
      const { id, ...data } = input;
      return db.updateSubtask(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkSubtaskAccess(ctx.user.id, input.id, "editor");
      requireAccessOrNotFound(access, "подзадача");
      return db.deleteSubtask(input.id);
    }),

  reorder: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      subtaskIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.reorderSubtasks(input.taskId, input.subtaskIds);
    }),

  // Template procedures
  listTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getSubtaskTemplatesByUser(ctx.user.id);
    }),

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      items: z.array(z.string().min(1).max(500)),
      description: z.string().max(1000).optional(),
      category: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.createSubtaskTemplate(
        ctx.user.id,
        input.name,
        input.items,
        input.description,
        input.category
      );
    }),

  saveAsTemplate: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      category: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId);
      requireAccessOrNotFound(access, "задача");
      return db.saveSubtasksAsTemplate(
        input.taskId,
        ctx.user.id,
        input.name,
        input.description,
        input.category
      );
    }),

  applyTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      taskId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      return db.applySubtaskTemplate(input.templateId, input.taskId, ctx.user.id);
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteSubtaskTemplate(input.templateId, ctx.user.id);
    }),

  applyBuiltinTemplate: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      templateKey: z.enum(["research", "analysis", "documentation", "review", "testing"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");
      const BUILTIN_TEMPLATES: Record<string, { title: string; items: string[] }> = {
        research: {
          title: "Исследование",
          items: [
            "Определить цели и вопросы исследования",
            "Собрать данные из открытых источников",
            "Провести интервью / опросы",
            "Проанализировать конкурентов",
            "Составить отчёт с выводами",
            "Подготовить презентацию результатов",
          ],
        },
        analysis: {
          title: "Анализ",
          items: [
            "Определить метрики и KPI для анализа",
            "Собрать и подготовить данные",
            "Провести количественный анализ",
            "Провести качественный анализ",
            "Выявить тренды и паттерны",
            "Сформулировать рекомендации",
            "Оформить аналитический отчёт",
          ],
        },
        documentation: {
          title: "Документация",
          items: [
            "Определить структуру документа",
            "Написать введение и обзор",
            "Описать основные разделы",
            "Добавить примеры и иллюстрации",
            "Провести вычитку и редактуру",
            "Согласовать с заинтересованными сторонами",
            "Опубликовать финальную версию",
          ],
        },
        review: {
          title: "Ревью",
          items: [
            "Ознакомиться с материалом / кодом",
            "Проверить соответствие требованиям",
            "Оценить качество и полноту",
            "Составить список замечаний",
            "Обсудить замечания с автором",
            "Проверить исправления",
            "Утвердить результат",
          ],
        },
        testing: {
          title: "Тестирование",
          items: [
            "Составить тест-план",
            "Подготовить тестовые данные",
            "Провести функциональное тестирование",
            "Провести регрессионное тестирование",
            "Проверить граничные случаи",
            "Зафиксировать найденные баги",
            "Провести повторное тестирование после исправлений",
            "Подготовить отчёт о тестировании",
          ],
        },
      };

      const template = BUILTIN_TEMPLATES[input.templateKey];
      if (!template) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown template key" });
      }

      // Create subtasks from template items
      const results = [];
      for (let i = 0; i < template.items.length; i++) {
        const subtask = await db.createSubtask({
          taskId: input.taskId,
          title: template.items[i],
          sortOrder: i,
        });
        results.push(subtask);
      }
      return { count: results.length, templateTitle: template.title };
    }),
});

// ============ AI SETTINGS ROUTER ============
import * as aiProviders from "./aiProviders";

const allProviders = z.enum([
  "anthropic", "openai", "google", "groq", "mistral",
  "gemini_free", "huggingface", "deepseek", "ollama", "cohere", "perplexity"
]);

const aiSettingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getAiSettingsByUser(ctx.user.id);
  }),

  // Get all available providers with their configurations
  getProviders: publicProcedure.query(() => {
    return {
      all: aiProviders.AI_PROVIDERS,
      free: aiProviders.getFreeProviders(),
      premium: aiProviders.getPremiumProviders(),
    };
  }),

  upsert: protectedProcedure
    .input(z.object({
      provider: allProviders,
      apiKey: z.string().optional(),
      model: z.string().optional(),
      baseUrl: z.string().optional(),
      isDefault: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
      isFree: z.boolean().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.upsertAiSetting({
        ...input,
        userId: ctx.user.id,
      });
    }),

  setDefault: protectedProcedure
    .input(z.object({
      provider: allProviders,
    }))
    .mutation(async ({ ctx, input }) => {
      await db.setDefaultAiProvider(ctx.user.id, input.provider);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteAiSetting(input.id, ctx.user.id);
    }),

  // Validate API key by making a test request
  validate: protectedProcedure
    .input(z.object({
      provider: allProviders,
      apiKey: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { provider, apiKey } = input;
      
      const patterns: Record<string, RegExp> = {
        anthropic: /^sk-ant-/,
        openai: /^sk-/,
        google: /^AI/,
        groq: /^gsk_/,
        mistral: /^[a-zA-Z0-9]+$/,
        gemini_free: /^AI/,
        huggingface: /^hf_/,
        deepseek: /^sk-/,
        ollama: /.*/, // No key required
        cohere: /^[a-zA-Z0-9]+$/,
        perplexity: /^pplx-/,
      };

      const pattern = patterns[provider];
      if (pattern && !pattern.test(apiKey)) {
        return { valid: false, error: "Invalid API key format" };
      }

      return { valid: true };
    }),

  // Get AI preferences for smart selection
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return db.getAiPreferences(ctx.user.id);
  }),

  // Update AI preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      autoSelectEnabled: z.boolean().optional(),
      preferFreeModels: z.boolean().optional(),
      simpleTaskProvider: z.number().nullable().optional(),
      analysisTaskProvider: z.number().nullable().optional(),
      codeTaskProvider: z.number().nullable().optional(),
      creativeTaskProvider: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.upsertAiPreferences(ctx.user.id, input);
    }),

  // Analyze question and recommend provider
  analyzeAndRecommend: protectedProcedure
    .input(z.object({
      question: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Analyze question type
      const taskType = aiProviders.analyzeQuestionType(input.question);
      
      // Get user's configured providers
      const userSettings = await db.getAiSettingsByUser(ctx.user.id);
      const preferences = await db.getAiPreferences(ctx.user.id);
      
      // Map to provider info
      const availableProviders = userSettings
        .filter(s => s.isEnabled)
        .map(s => ({
          providerId: s.provider,
          priority: s.priority || 0,
          isFree: s.isFree || false,
        }));
      
      // Get recommendation
      const recommendedProvider = aiProviders.recommendProvider(
        taskType,
        availableProviders,
        preferences?.preferFreeModels ?? true
      );
      
      // Get provider config for display
      const providerConfig = recommendedProvider 
        ? aiProviders.getProvider(recommendedProvider)
        : null;
      
      // Estimate cost
      const estimatedTokens = Math.ceil(input.question.length / 4) + 500; // Rough estimate
      const costEstimate = recommendedProvider 
        ? aiProviders.estimateCost(recommendedProvider, estimatedTokens)
        : null;
      
      return {
        taskType,
        taskTypeRu: {
          simple: 'Простой вопрос',
          analysis: 'Анализ/исследование',
          code: 'Программирование',
          creative: 'Творческая задача',
          general: 'Общий вопрос',
        }[taskType],
        recommendedProvider,
        providerConfig: providerConfig || null,
        costEstimate,
        reason: getRecommendationReason(taskType, providerConfig || null),
      };
    }),

  // Estimate cost for a message
  estimateCost: publicProcedure
    .input(z.object({
      providerId: z.string(),
      messageLength: z.number(),
    }))
    .query(({ input }) => {
      const estimatedTokens = Math.ceil(input.messageLength / 4) + 500;
      return aiProviders.estimateCost(input.providerId, estimatedTokens);
    }),
});

// Helper function for recommendation reasons
function getRecommendationReason(taskType: aiProviders.TaskType, provider: aiProviders.ProviderConfig | null): string {
  if (!provider) return 'Нет доступных провайдеров';
  
  const reasons: Record<aiProviders.TaskType, string> = {
    simple: `${provider.nameRu} выбран для быстрого ответа на простой вопрос`,
    analysis: `${provider.nameRu} лучше всего подходит для глубокого анализа`,
    code: `${provider.nameRu} оптимален для задач программирования`,
    creative: `${provider.nameRu} отлично справляется с творческими задачами`,
    general: `${provider.nameRu} - универсальный выбор для общих вопросов`,
  };
  
  return reasons[taskType] + (provider.isFree ? ' (бесплатно)' : '');
}

// ============ CREDITS ROUTER ============
import * as aiRouter from "./aiRouter";

const creditsRouter = router({
  // Get user's credit balance
  balance: protectedProcedure.query(async ({ ctx }) => {
    let credits = await db.getUserCredits(ctx.user.id);
    if (!credits) {
      credits = await db.initializeUserCredits(ctx.user.id);
    }
    return credits;
  }),

  // Get credit transaction history
  history: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getCreditHistory(ctx.user.id, input.limit || 50);
    }),

  // Toggle BYOK mode
  toggleBYOK: protectedProcedure
    .input(z.object({ useBYOK: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db.toggleBYOKMode(ctx.user.id, input.useBYOK);
      return { success: true };
    }),

  // Get credit costs for display
  costs: publicProcedure.query(() => {
    return aiRouter.getCreditCosts();
  }),

  // Get available models
  models: publicProcedure.query(() => {
    return aiRouter.PLATFORM_MODELS;
  }),
});

// ============ CHAT ROUTER ============

const chatRouter = router({
  history: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Check access to the entity based on context type
      const access = await checkEntityAccess(ctx.user.id, input.contextType, input.contextId);
      requireAccessOrNotFound(access, input.contextType === "project" ? "проект" : input.contextType === "block" ? "блок" : input.contextType === "section" ? "раздел" : "задача");

      return db.getChatHistory(
        input.contextType,
        input.contextId,
        ctx.user.id,
        input.limit
      );
    }),

  send: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
      content: z.string().min(1),
      projectContext: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to the entity based on context type (editor role for sending messages)
      const access = await checkEntityAccess(ctx.user.id, input.contextType, input.contextId, "editor");
      requireAccessOrNotFound(access, input.contextType === "project" ? "проект" : input.contextType === "block" ? "блок" : input.contextType === "section" ? "раздел" : "задача");
      // Get or initialize user credits
      let userCredits = await db.getUserCredits(ctx.user.id);
      if (!userCredits) {
        userCredits = await db.initializeUserCredits(ctx.user.id);
      }

      // Check if using BYOK mode
      const useBYOK = userCredits.useBYOK;

      // Save user message
      const userMessage = await db.createChatMessage({
        userId: ctx.user.id,
        contextType: input.contextType,
        contextId: input.contextId,
        role: "user",
        content: input.content,
      });

      // Get chat history for context
      const history = await db.getChatHistory(
        input.contextType,
        input.contextId,
        ctx.user.id,
        10
      );

      // Build messages for LLM
      const systemPrompt = `Ты AI-ассистент для управления проектами и дорожными картами в платформе MYDON Roadmap Hub.
Ты помогаешь пользователю планировать, анализировать и выполнять задачи.
${input.projectContext ? `Контекст проекта: ${input.projectContext}` : ""}

Отвечай на русском языке, если пользователь пишет на русском.
Будь конкретным и полезным. Если нужна дополнительная информация, спроси.
Форматируй ответы с использованием markdown для лучшей читаемости.`;

      const filteredHistory = history.filter(msg => msg.id !== userMessage.id);

      const messages = [
        { role: "system", content: systemPrompt },
        ...filteredHistory.reverse().map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: input.content },
      ];

      try {
        // Use AI Router for smart model selection (Platform mode)
        if (!useBYOK) {
          const result = await aiRouter.routeAIRequest(
            messages,
            userCredits.credits,
            true // prefer free models
          );

          // Deduct credits
          const deductResult = await db.deductCredits(
            ctx.user.id,
            result.creditsUsed,
            `AI чат: ${result.model.nameRu}`,
            result.model.id,
            result.tokensUsed
          );

          const assistantMessage = await db.createChatMessage({
            userId: ctx.user.id,
            contextType: input.contextType,
            contextId: input.contextId,
            role: "assistant",
            content: result.content,
            provider: "platform",
            model: result.model.id,
          });

          return {
            userMessage,
            assistantMessage,
            aiMetadata: {
              model: result.model,
              taskType: result.taskType,
              creditsUsed: result.creditsUsed,
              newBalance: deductResult.newBalance,
              reason: result.reason,
            },
          };
        }

        // BYOK mode - use built-in Manus LLM (no credits deducted)
        const response = await invokeLLM({ messages: messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })) });
        const aiContent = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : 'Не удалось получить ответ от AI';

        const assistantMessage = await db.createChatMessage({
          userId: ctx.user.id,
          contextType: input.contextType,
          contextId: input.contextId,
          role: "assistant",
          content: aiContent,
          provider: "byok",
          model: "user-configured",
        });

        return {
          userMessage,
          assistantMessage,
          aiMetadata: {
            model: null,
            taskType: 'general' as const,
            creditsUsed: 0,
            newBalance: userCredits.credits,
            reason: 'BYOK режим - используются ваши API ключи',
          },
        };
      } catch (error) {
        console.error("AI call failed:", error);
        const assistantMessage = await db.createChatMessage({
          userId: ctx.user.id,
          contextType: input.contextType,
          contextId: input.contextId,
          role: "assistant",
          content: "⚠️ Произошла ошибка при обращении к AI. Попробуйте позже.",
        });
        return { userMessage, assistantMessage };
      }
    }),

  clear: protectedProcedure
    .input(z.object({
      contextType: z.enum(["project", "block", "section", "task"]),
      contextId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access to the entity based on context type (editor role for clearing)
      const access = await checkEntityAccess(ctx.user.id, input.contextType, input.contextId, "editor");
      requireAccessOrNotFound(access, input.contextType === "project" ? "проект" : input.contextType === "block" ? "блок" : input.contextType === "section" ? "раздел" : "задача");

      return db.clearChatHistory(input.contextType, input.contextId, ctx.user.id);
    }),
});

// ============ GOOGLE DRIVE ROUTER ============
const driveRouter = router({
  checkConnection: protectedProcedure.query(async () => {
    return googleDrive.checkDriveConnection();
  }),

  listFiles: protectedProcedure.query(async ({ ctx }) => {
    // Get all files
    const allFiles = await googleDrive.listRoadmapFiles();

    // Filter to only show files for projects the user has access to
    const accessibleFiles = [];
    for (const file of allFiles) {
      // Extract projectId from filename pattern: {name}_{projectId}.json
      const match = file.name.match(/_(\d+)\.json$/);
      if (match) {
        const projectId = parseInt(match[1], 10);
        const access = await checkProjectAccess(ctx.user.id, projectId);
        if (access.hasAccess) {
          accessibleFiles.push(file);
        }
      }
    }
    return accessibleFiles;
  }),

  saveProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get full project data
      const project = await db.getFullProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error("Project not found");
      }

      // Transform to export format
      const exportData = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        blocks: project.blocks.map((block: schema.Block & { sections: (schema.Section & { tasks: (schema.Task & { subtasks: schema.Subtask[] })[] })[] }) => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          sections: block.sections.map((section: schema.Section & { tasks: (schema.Task & { subtasks: schema.Subtask[] })[] }) => ({
            title: section.title,
            tasks: section.tasks.map((task: schema.Task & { subtasks: schema.Subtask[] }) => ({
              title: task.title,
              description: task.description,
              status: task.status,
              notes: task.notes,
              summary: task.summary,
              subtasks: task.subtasks.map((subtask: schema.Subtask) => ({
                title: subtask.title,
                status: subtask.status,
              })),
            })),
          })),
        })),
      };

      return googleDrive.saveProjectToDrive(exportData);
    }),

  loadProject: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ ctx, input }) => {
      // Extract projectId from filename pattern: {name}_{projectId}.json
      const match = input.filename.match(/_(\d+)\.json$/);
      if (match) {
        const projectId = parseInt(match[1], 10);
        const access = await checkProjectAccess(ctx.user.id, projectId);
        if (!access.hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этому файлу" });
        }
      }
      return googleDrive.loadProjectFromDrive(input.filename);
    }),

  deleteFile: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Extract projectId from filename pattern: {name}_{projectId}.json
      const match = input.filename.match(/_(\d+)\.json$/);
      if (!match) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректное имя файла" });
      }
      const projectId = parseInt(match[1], 10);
      const access = await checkProjectAccess(ctx.user.id, projectId, "editor");
      if (!access.hasAccess) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа для удаления этого файла" });
      }
      return googleDrive.deleteProjectFromDrive(input.filename);
    }),

  getShareableLink: protectedProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ ctx, input }) => {
      // Extract projectId from filename pattern: {name}_{projectId}.json
      const match = input.filename.match(/_(\d+)\.json$/);
      if (match) {
        const projectId = parseInt(match[1], 10);
        const access = await checkProjectAccess(ctx.user.id, projectId);
        if (!access.hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этому файлу" });
        }
      }
      return googleDrive.getShareableLink(input.filename);
    }),

  exportToGoogleDocs: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Get full project data
      const project = await db.getFullProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error("Project not found");
      }

      // Transform to export format
      const exportData = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        blocks: project.blocks.map((block: schema.Block & { sections: (schema.Section & { tasks: (schema.Task & { subtasks: schema.Subtask[] })[] })[] }) => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          sections: block.sections.map((section: schema.Section & { tasks: (schema.Task & { subtasks: schema.Subtask[] })[] }) => ({
            title: section.title,
            tasks: section.tasks.map((task: schema.Task & { subtasks: schema.Subtask[] }) => ({
              title: task.title,
              description: task.description,
              status: task.status,
              notes: task.notes,
              summary: task.summary,
              subtasks: task.subtasks.map((subtask: schema.Subtask) => ({
                title: subtask.title,
                status: subtask.status,
              })),
            })),
          })),
        })),
      };

      return googleDrive.exportToGoogleDocs(exportData);
    }),
});

// ============ GOOGLE CALENDAR ROUTER ============
const calendarRouter = router({
  createTaskEvent: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      taskTitle: z.string(),
      projectName: z.string(),
      deadline: z.date(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check task access before creating calendar event
      const access = await checkTaskAccess(ctx.user.id, input.taskId, "editor");
      requireAccessOrNotFound(access, "задача");

      return googleCalendar.createTaskDeadlineEvent({
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        projectName: input.projectName,
        deadline: input.deadline,
        description: input.description,
      });
    }),

  createProjectMilestones: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      projectName: z.string(),
      milestones: z.array(z.object({
        title: z.string(),
        date: z.date(),
        description: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check project access before creating milestones
      const access = await checkProjectAccess(ctx.user.id, input.projectId, "editor");
      requireAccessOrNotFound(access, "проект");

      return googleCalendar.createProjectMilestones(input.projectName, input.milestones);
    }),

  searchProjectEvents: protectedProcedure
    .input(z.object({ projectId: z.number(), projectName: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check project access before searching events
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "проект");

      return googleCalendar.searchProjectEvents(input.projectName);
    }),

  deleteEvent: protectedProcedure
    .input(z.object({ eventId: z.string(), projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check project access before deleting event
      const access = await checkProjectAccess(ctx.user.id, input.projectId, "editor");
      requireAccessOrNotFound(access, "проект");

      return googleCalendar.deleteCalendarEvent(input.eventId);
    }),
});

// ============ AI GENERATION ROUTER ============
const aiGenerationRouter = router({
  generateRoadmap: protectedProcedure
    .input(z.object({
      goal: z.string().min(1),
      category: z.string(),
      answers: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const prompt = `You are an expert project planner. Generate a detailed roadmap for the following goal.

Goal: ${input.goal}
Category: ${input.category}
Additional context:
${Object.entries(input.answers).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Generate a structured roadmap in JSON format with the following structure:
{
  "name": "Project name (short, descriptive)",
  "description": "Brief project description",
  "blocks": [
    {
      "title": "Block title",
      "description": "Block description",
      "duration": "Estimated duration (e.g., '2 weeks')",
      "sections": [
        {
          "title": "Section title",
          "tasks": [
            { "title": "Task title", "description": "Task description" }
          ]
        }
      ]
    }
  ]
}

Create 4-8 blocks covering all phases needed to achieve the goal. Each block should have 2-4 sections with 3-6 tasks each.
Respond ONLY with valid JSON, no additional text.`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a project planning expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      });

      const rawContent = response.choices[0]?.message?.content || '{}';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
      
      // Parse JSON from response
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(content);
      } catch (e) {
        // Return a default structure if parsing fails
        return {
          name: input.goal.slice(0, 50),
          description: input.goal,
          blocks: [
            {
              title: 'Планирование',
              description: 'Начальный этап планирования',
              duration: '1 неделя',
              sections: [
                {
                  title: 'Анализ',
                  tasks: [
                    { title: 'Определить цели', description: 'Чётко сформулировать цели проекта' },
                    { title: 'Собрать информацию', description: 'Исследовать тему' },
                  ],
                },
              ],
            },
          ],
        };
      }
    }),
});

// ============ TEMPLATE ROUTER ============
const templateRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getTemplates(ctx.user.id);
  }),

  listPublic: publicProcedure.query(async () => {
    return db.getPublicTemplates();
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const template = await db.getTemplateById(input.id);
      // Only return if public or owned by user
      if (template && (template.isPublic || template.authorId === ctx.user.id)) {
        return template;
      }
      return null;
    }),

  saveProjectAsTemplate: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.saveProjectAsTemplate(
        input.projectId,
        ctx.user.id,
        ctx.user.name || 'Anonymous',
        input.name,
        input.description || '',
        input.isPublic
      );
    }),

  createProjectFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      projectName: z.string().min(1).max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.getTemplateById(input.templateId);
      if (!template || !template.structure) {
        throw new Error('Template not found');
      }

      // Increment usage count
      await db.incrementTemplateUsage(input.templateId);

      // Create project from template structure
      const project = await db.createProject({
        name: input.projectName || template.name,
        description: template.description || undefined,
        icon: template.icon || 'folder',
        color: template.color || '#f59e0b',
        userId: ctx.user.id,
      });

      // Create blocks, sections, and tasks from template structure
      for (let blockIndex = 0; blockIndex < template.structure.blocks.length; blockIndex++) {
        const blockData = template.structure.blocks[blockIndex];
        const block = await db.createBlock({
          projectId: project.id,
          number: blockIndex + 1,
          title: blockData.title,
          description: blockData.description,
          duration: blockData.duration,
          sortOrder: blockIndex,
        });

        for (let sectionIndex = 0; sectionIndex < blockData.sections.length; sectionIndex++) {
          const sectionData = blockData.sections[sectionIndex];
          const section = await db.createSection({
            blockId: block.id,
            title: sectionData.title,
            description: sectionData.description,
            sortOrder: sectionIndex,
          });

          for (let taskIndex = 0; taskIndex < sectionData.tasks.length; taskIndex++) {
            const taskData = sectionData.tasks[taskIndex];
            await db.createTask({
              sectionId: section.id,
              title: taskData.title,
              description: taskData.description,
              sortOrder: taskIndex,
            });
          }
        }
      }

      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deleteTemplate(input.id, ctx.user.id);
    }),
});

// ============ DAILY BRIEFING ROUTER ============
const briefingRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return db.getDailyBriefing(ctx.user.id);
  }),
});

// ============ PITCH DECK ROUTER ============
const pitchDeckRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getPitchDecksByUser(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getPitchDeckById(input.id, ctx.user.id);
    }),

  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getPitchDecksByProject(input.projectId, ctx.user.id);
    }),

  generate: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      language: z.enum(['ru', 'en']).default('ru'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get full project data
      const project = await db.getFullProject(input.projectId, ctx.user.id);
      if (!project) {
        throw new Error('Project not found');
      }

      // Deduct credits
      const creditResult = await db.deductCredits(ctx.user.id, 50, 'ai_generate', 'Pitch Deck generation');
      if (!creditResult.success) {
        throw new Error(creditResult.error || 'Insufficient credits');
      }

      // Prepare project summary for AI
      const projectSummary = {
        name: project.name,
        description: project.description,
        blocks: project.blocks.map((b: schema.Block & { sections: (schema.Section & { tasks: schema.Task[] })[] }) => ({
          title: b.title,
          titleRu: b.titleRu,
          duration: b.duration,
          sections: b.sections.map((s: schema.Section & { tasks: schema.Task[] }) => ({
            title: s.title,
            tasks: s.tasks.map((t: schema.Task) => t.title)
          }))
        }))
      };

      const lang = input.language === 'ru' ? 'Russian' : 'English';

      // Generate pitch deck content using AI
      const prompt = `You are an expert startup pitch deck creator. Based on the following project roadmap, create a professional 10-slide investor pitch deck.

Project: ${project.name}
Description: ${project.description || 'No description provided'}

Roadmap Structure:
${JSON.stringify(projectSummary.blocks, null, 2)}

Generate a pitch deck with exactly 10 slides in ${lang}. Return a JSON array with this exact structure:
[
  { "id": "1", "type": "title", "title": "Company Name", "content": "Tagline or one-sentence description", "bullets": [] },
  { "id": "2", "type": "problem", "title": "Problem", "content": "Main problem description", "bullets": ["Pain point 1", "Pain point 2", "Pain point 3"] },
  { "id": "3", "type": "solution", "title": "Solution", "content": "Our solution", "bullets": ["Feature 1", "Feature 2", "Feature 3"] },
  { "id": "4", "type": "market", "title": "Market Size", "content": "Market opportunity", "metrics": [{"label": "TAM", "value": "$XXB"}, {"label": "SAM", "value": "$XXB"}, {"label": "SOM", "value": "$XXM"}] },
  { "id": "5", "type": "business_model", "title": "Business Model", "content": "How we make money", "bullets": ["Revenue stream 1", "Revenue stream 2"] },
  { "id": "6", "type": "competition", "title": "Competition", "content": "Our competitive advantage", "bullets": ["Competitor 1 - weakness", "Competitor 2 - weakness", "Our advantage"] },
  { "id": "7", "type": "roadmap", "title": "Roadmap", "content": "12-18 month plan", "bullets": ["Q1: ...", "Q2: ...", "Q3: ...", "Q4: ..."] },
  { "id": "8", "type": "team", "title": "Team", "content": "Our team", "bullets": ["CEO - background", "CTO - background", "Key hire needed"] },
  { "id": "9", "type": "financials", "title": "Financials", "content": "3-year projection", "metrics": [{"label": "Year 1", "value": "$XXK"}, {"label": "Year 2", "value": "$XXM"}, {"label": "Year 3", "value": "$XXM"}] },
  { "id": "10", "type": "ask", "title": "The Ask", "content": "Investment request", "bullets": ["Amount: $X", "Use of funds 1", "Use of funds 2", "Use of funds 3"] }
]

Make the content realistic and compelling based on the project's roadmap. Use actual data from the roadmap for the Roadmap slide. Return ONLY the JSON array, no other text.`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are an expert startup pitch deck creator. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
      });

      let slides;
      try {
        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '[]';
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        slides = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        throw new Error('Failed to generate pitch deck content');
      }

      // Save to database
      const pitchDeck = await db.createPitchDeck({
        userId: ctx.user.id,
        projectId: input.projectId,
        title: `${project.name} - Pitch Deck`,
        subtitle: project.description || undefined,
        slides,
      });

      return pitchDeck;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
      slides: z.array(z.object({
        id: z.string(),
        type: z.string(),
        title: z.string(),
        content: z.string(),
        bullets: z.array(z.string()).optional(),
        metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
        teamMembers: z.array(z.object({
          name: z.string(),
          role: z.string(),
          photoUrl: z.string().optional(),
        })).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updatePitchDeck(id, ctx.user.id, data as any);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return db.deletePitchDeck(input.id, ctx.user.id);
    }),

  uploadTeamPhoto: protectedProcedure
    .input(z.object({
      imageData: z.string(), // base64 encoded image
      filename: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import('./storage');
      
      // Decode base64 to buffer
      const buffer = Buffer.from(input.imageData, 'base64');
      
      // Generate unique filename
      const ext = input.filename.split('.').pop() || 'jpg';
      const uniqueFilename = `team-photos/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      // Upload to S3
      const { url } = await storagePut(uniqueFilename, buffer, input.mimeType);
      
      return { url };
    }),

  exportPptx: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pitchDeck = await db.getPitchDeckById(input.id, ctx.user.id);
      if (!pitchDeck) {
        throw new Error('Pitch deck not found');
      }

      const { generatePptx } = await import('./pptxExport');
      const buffer = await generatePptx(pitchDeck as any);
      
      // Return base64 encoded buffer
      return {
        filename: `${pitchDeck.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`,
        data: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };
    }),
});

// ============ MAIN ROUTER ============
export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  project: projectRouter,
  block: blockRouter,
  section: sectionRouter,
  task: taskRouter,
  subtask: subtaskRouter,
  aiSettings: aiSettingsRouter,
  credits: creditsRouter,
  chat: chatRouter,
  drive: driveRouter,
  calendar: calendarRouter,
  ai: aiGenerationRouter,
  template: templateRouter,
  briefing: briefingRouter,
  pitchDeck: pitchDeckRouter,
  subscription: subscriptionRouter,
  aiIntegrations: aiIntegrationsRouter,
  agents: agentsRouter,
  skills: skillsRouter,
  mcpServers: mcpServersRouter,
  orchestrator: orchestratorRouter,
  stripe: stripeRouter,
  limits: limitsRouter,
  collaboration: collaborationRouter,
  notifications: notificationsRouter,
  team: teamRouter,
  analytics: analyticsRouter,
  analyticsExport: analyticsExportRouter,
  templateEnhanced: templateEnhancedRouter,
  aiEnhancements: aiEnhancementsRouter,
  ical: icalRouter,
  webhook: webhookRouter,
  restApi: restApiRouter,
  apiKeys: apiKeysRouter,
  timeTracking: timeTrackingRouter,
  gamification: gamificationRouter,
  aiRouter: aiTrpcRouter,
  relations: relationsRouter,
  aiDecision: aiDecisionRouter,
  aiSession: aiSessionRouter,
  admin: adminRouter,
  adminUsers: adminUsersRouter,
  adminCredits: adminCreditsRouter,
  adminPricing: adminPricingRouter,
  adminPrompts: adminPromptsRouter,
  adminContent: adminContentRouter,
  adminUI: adminUIRouter,
  adminIntegrations: adminIntegrationsRouter,
  adminModelRatings: adminModelRatingsRouter,
  adminLogs: adminLogsRouter,
  usage: usageRouter,
  customFields: customFieldsRouter,
  savedViews: savedViewsRouter,
  openclaw: openclawRouter,
  attachments: attachmentsRouter,
  skillExecution: skillExecutionRouter,
});

export type AppRouter = typeof appRouter;
