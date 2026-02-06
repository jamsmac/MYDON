import { z } from "zod";
import { eq, desc, like, and, or, sql, count, gte, lte } from "drizzle-orm";
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

export const adminContentRouter = router({
  // ==================== PROJECTS ====================
  
  // List all projects with filters
  listProjects: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      ownerId: z.number().optional(),
      status: z.enum(["active", "archived", "completed", "all"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { projects: [], total: 0 };
      
      const conditions = [];
      
      if (input?.search) {
        conditions.push(
          or(
            like(schema.projects.name, `%${input.search}%`),
            like(schema.projects.description, `%${input.search}%`)
          )
        );
      }
      
      if (input?.ownerId) {
        conditions.push(eq(schema.projects.userId, input.ownerId));
      }
      
      if (input?.status && input.status !== "all") {
        const statusValue = input.status as "active" | "archived" | "completed";
        conditions.push(eq(schema.projects.status, statusValue));
      }
      
      if (input?.dateFrom) {
        conditions.push(gte(schema.projects.createdAt, new Date(input.dateFrom)));
      }
      
      if (input?.dateTo) {
        conditions.push(lte(schema.projects.createdAt, new Date(input.dateTo)));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get total count
      const [countResult] = await db
        .select({ count: count() })
        .from(schema.projects)
        .where(whereClause);
      
      const total = countResult?.count ?? 0;
      
      // Get projects with pagination
      const offset = ((input?.page ?? 1) - 1) * (input?.limit ?? 20);
      
      const projects = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          description: schema.projects.description,
          userId: schema.projects.userId,
          status: schema.projects.status,
          createdAt: schema.projects.createdAt,
          updatedAt: schema.projects.updatedAt,
        })
        .from(schema.projects)
        .where(whereClause)
        .orderBy(desc(schema.projects.createdAt))
        .limit(input?.limit ?? 20)
        .offset(offset);
      
      // Get owner info and stats for each project
      const projectsWithStats = await Promise.all(
        projects.map(async (project) => {
          // Get owner
          const [owner] = await db
            .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
            .from(schema.users)
            .where(eq(schema.users.id, project.userId));
          
          // Get block count
          const [blockCount] = await db
            .select({ count: count() })
            .from(schema.blocks)
            .where(eq(schema.blocks.projectId, project.id));
          
          // Get task count via blocks and sections
          let taskCountNum = 0;
          const projectBlocks = await db.select({ id: schema.blocks.id }).from(schema.blocks).where(eq(schema.blocks.projectId, project.id));
          if (projectBlocks.length > 0) {
            const blockIds = projectBlocks.map(b => b.id);
            const projectSections = await db.select({ id: schema.sections.id }).from(schema.sections).where(sql`${schema.sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
            if (projectSections.length > 0) {
              const sectionIds = projectSections.map(s => s.id);
              const [taskCount] = await db.select({ count: count() }).from(schema.tasks).where(sql`${schema.tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
              taskCountNum = taskCount?.count ?? 0;
            }
          }
          
          return {
            ...project,
            owner,
            taskCount: taskCountNum,
            blockCount: blockCount?.count ?? 0,
            aiRequestCount: 0
          };
        })
      );
      
      return { projects: projectsWithStats, total };
    }),

  // Get project details
  getProject: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.id));
      
      if (!project) return null;
      
      // Get owner
      const [owner] = await db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, project.userId));
      
      // Get stats
      // Get task count via blocks and sections
      const projectBlocks = await db.select({ id: schema.blocks.id }).from(schema.blocks).where(eq(schema.blocks.projectId, project.id));
      let taskCountNum = 0;
      if (projectBlocks.length > 0) {
        const blockIds = projectBlocks.map(b => b.id);
        const projectSections = await db.select({ id: schema.sections.id }).from(schema.sections).where(sql`${schema.sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
        if (projectSections.length > 0) {
          const sectionIds = projectSections.map(s => s.id);
          const [taskCount] = await db.select({ count: count() }).from(schema.tasks).where(sql`${schema.tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
          taskCountNum = taskCount?.count ?? 0;
        }
      }
      
      const [blockCount] = await db
        .select({ count: count() })
        .from(schema.blocks)
        .where(eq(schema.blocks.projectId, project.id));
      
      // Get section count via blocks
      let sectionCountNum = 0;
      if (projectBlocks.length > 0) {
        const blockIds = projectBlocks.map(b => b.id);
        const [sectionCount] = await db.select({ count: count() }).from(schema.sections).where(sql`${schema.sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
        sectionCountNum = sectionCount?.count ?? 0;
      }
      
      return {
        ...project,
        owner,
        stats: {
          tasks: taskCountNum,
          blocks: blockCount?.count ?? 0,
          sections: sectionCountNum,
        },
      };
    }),

  // Archive project
  archiveProject: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(schema.projects)
        .set({ status: "archived" })
        .where(eq(schema.projects.id, input.id));
      
      return { success: true };
    }),

  // Restore project
  restoreProject: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.update(schema.projects)
        .set({ status: "active" })
        .where(eq(schema.projects.id, input.id));
      
      return { success: true };
    }),

  // Transfer project to another user
  transferProject: adminProcedure
    .input(z.object({
      projectId: z.number(),
      newOwnerId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Verify new owner exists
      const [newOwner] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, input.newOwnerId));
      
      if (!newOwner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "New owner not found" });
      }
      
      await db.update(schema.projects)
        .set({ userId: input.newOwnerId })
        .where(eq(schema.projects.id, input.projectId));
      
      return { success: true };
    }),

  // Delete project permanently
  deleteProject: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get all blocks for this project
      const blocks = await db.select({ id: schema.blocks.id }).from(schema.blocks).where(eq(schema.blocks.projectId, input.id));
      const blockIds = blocks.map(b => b.id);
      
      if (blockIds.length > 0) {
        // Get all sections for these blocks
        const sections = await db.select({ id: schema.sections.id }).from(schema.sections).where(sql`${schema.sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
        const sectionIds = sections.map(s => s.id);
        
        if (sectionIds.length > 0) {
          // Get all tasks for these sections
          const tasks = await db.select({ id: schema.tasks.id }).from(schema.tasks).where(sql`${schema.tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
          const taskIds = tasks.map(t => t.id);
          
          // Delete subtasks for these tasks
          if (taskIds.length > 0) {
            await db.delete(schema.subtasks).where(sql`${schema.subtasks.taskId} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`);
          }
          
          // Delete tasks
          await db.delete(schema.tasks).where(sql`${schema.tasks.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
        }
        
        // Delete sections
        await db.delete(schema.sections).where(sql`${schema.sections.blockId} IN (${sql.join(blockIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      // Delete blocks
      await db.delete(schema.blocks).where(eq(schema.blocks.projectId, input.id));
      
      // Delete project
      await db.delete(schema.projects).where(eq(schema.projects.id, input.id));
      
      return { success: true };
    }),

  // ==================== TEMPLATES ====================
  
  // List all templates
  listTemplates: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      categoryId: z.number().optional(),
      isPublic: z.boolean().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { templates: [], total: 0 };
      
      const conditions = [];
      
      if (input?.search) {
        conditions.push(
          or(
            like(schema.projectTemplates.name, `%${input.search}%`),
            like(schema.projectTemplates.description, `%${input.search}%`)
          )
        );
      }
      
      if (input?.categoryId) {
        conditions.push(eq(schema.projectTemplates.categoryId, input.categoryId));
      }
      
      if (input?.isPublic !== undefined) {
        conditions.push(eq(schema.projectTemplates.isPublic, input.isPublic));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get total count
      const [countResult] = await db
        .select({ count: count() })
        .from(schema.projectTemplates)
        .where(whereClause);
      
      const total = countResult?.count ?? 0;
      
      // Get templates with pagination
      const offset = ((input?.page ?? 1) - 1) * (input?.limit ?? 20);
      
      const templates = await db
        .select()
        .from(schema.projectTemplates)
        .where(whereClause)
        .orderBy(desc(schema.projectTemplates.createdAt))
        .limit(input?.limit ?? 20)
        .offset(offset);
      
      return { templates, total };
    }),

  // Get template by ID
  getTemplate: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [template] = await db
        .select()
        .from(schema.projectTemplates)
        .where(eq(schema.projectTemplates.id, input.id));
      
      return template || null;
    }),

  // Create template from project
  createTemplateFromProject: adminProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get project with structure
      const [project] = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, input.projectId));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get blocks
      const blocks = await db
        .select()
        .from(schema.blocks)
        .where(eq(schema.blocks.projectId, input.projectId))
        .orderBy(schema.blocks.sortOrder);
      
      // Get sections for each block
      const structure: any = {
        blocks: await Promise.all(blocks.map(async (block) => {
          const sections = await db
            .select()
            .from(schema.sections)
            .where(eq(schema.sections.blockId, block.id))
            .orderBy(schema.sections.sortOrder);
          
          // Get tasks for each section
          const sectionsWithTasks = await Promise.all(sections.map(async (section) => {
            const tasks = await db
              .select()
              .from(schema.tasks)
              .where(eq(schema.tasks.sectionId, section.id))
              .orderBy(schema.tasks.sortOrder);
            
            return {
              title: section.title,
              description: section.description,
              tasks: tasks.map(t => ({
                title: t.title,
                description: t.description,
                priority: t.priority,
              })),
            };
          }));
          
          return {
            title: block.title,
            description: block.description,
            icon: block.icon,
            sections: sectionsWithTasks,
          };
        })),
      };
      
      // Create template
      const [result] = await db.insert(schema.projectTemplates).values({
        name: input.name,
        description: input.description || project.description,
        categoryId: input.categoryId,
        structure,
        isPublic: input.isPublic,
        authorId: ctx.user.id,
        authorName: ctx.user.name,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Update template
  updateTemplate: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      categoryId: z.number().optional(),
      structure: z.any().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, ...updateData } = input;
      
      await db.update(schema.projectTemplates)
        .set(updateData)
        .where(eq(schema.projectTemplates.id, id));
      
      return { success: true };
    }),

  // Delete template
  deleteTemplate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      await db.delete(schema.projectTemplates).where(eq(schema.projectTemplates.id, input.id));
      
      return { success: true };
    }),

  // Toggle template public status
  toggleTemplatePublic: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [template] = await db
        .select()
        .from(schema.projectTemplates)
        .where(eq(schema.projectTemplates.id, input.id));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      await db.update(schema.projectTemplates)
        .set({ isPublic: !template.isPublic })
        .where(eq(schema.projectTemplates.id, input.id));
      
      return { success: true, isPublic: !template.isPublic };
    }),

  // ==================== TEMPLATE CATEGORIES ====================
  
  // List template categories
  listCategories: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      const categories = await db
        .select()
        .from(schema.templateCategories)
        .orderBy(schema.templateCategories.name);
      
      // Get template count for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const [countResult] = await db
            .select({ count: count() })
            .from(schema.projectTemplates)
            .where(eq(schema.projectTemplates.categoryId, category.id));
          
          return {
            ...category,
            templateCount: countResult?.count ?? 0,
          };
        })
      );
      
      return categoriesWithCounts;
    }),

  // Create category
  createCategory: adminProcedure
    .input(z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [result] = await db.insert(schema.templateCategories).values(input);
      
      return { id: result.insertId, success: true };
    }),

  // Update category
  updateCategory: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, ...updateData } = input;
      
      await db.update(schema.templateCategories)
        .set(updateData)
        .where(eq(schema.templateCategories.id, id));
      
      return { success: true };
    }),

  // Delete category
  deleteCategory: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Set templates in this category to null
      await db.update(schema.projectTemplates)
        .set({ categoryId: null })
        .where(eq(schema.projectTemplates.categoryId, input.id));
      
      await db.delete(schema.templateCategories).where(eq(schema.templateCategories.id, input.id));
      
      return { success: true };
    }),

  // Export projects to CSV
  exportProjectsCSV: adminProcedure
    .input(z.object({
      ownerId: z.number().optional(),
      status: z.enum(["active", "archived", "all"]).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { csv: "" };
      
      const conditions = [];
      
      if (input?.ownerId) {
        conditions.push(eq(schema.projects.userId, input.ownerId));
      }
      
      if (input?.status && input.status !== "all") {
        const statusValue = input.status as "active" | "archived" | "completed";
        conditions.push(eq(schema.projects.status, statusValue));
      }
      
      const projects = await db
        .select()
        .from(schema.projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.projects.createdAt));
      
      // Build CSV
      const headers = ["ID", "Name", "Description", "Owner ID", "Status", "Created At"];
      const rows = projects.map(p => [
        p.id,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.description || "").replace(/"/g, '""')}"`,
        p.userId,
        p.status || "active",
        p.createdAt?.toISOString() || "",
      ]);
      
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
      return { csv };
    }),
});
