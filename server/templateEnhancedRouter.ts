import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { 
  projectTemplates, 
  templateCategories, 
  templateTags, 
  templateToTags, 
  templateRatings, 
  templateDownloads,
  projects,
  blocks,
  sections,
  tasks,
  type TemplateStructure,
  type TemplateVariable
} from "../drizzle/schema";
import { eq, sql, and, desc, asc, like, or, inArray } from "drizzle-orm";

// Variable substitution engine
function substituteVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    // Replace {{variableName}} patterns
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, value);
  }
  return result;
}

// Apply variables to template structure
function applyVariablesToStructure(
  structure: TemplateStructure, 
  variableValues: Record<string, string>
): TemplateStructure {
  const applyToString = (str: string | undefined) => 
    str ? substituteVariables(str, variableValues) : str;
  
  return {
    ...structure,
    blocks: structure.blocks.map(block => ({
      ...block,
      title: applyToString(block.title) || block.title,
      description: applyToString(block.description),
      sections: block.sections.map(section => ({
        ...section,
        title: applyToString(section.title) || section.title,
        description: applyToString(section.description),
        tasks: section.tasks.map(task => ({
          ...task,
          title: applyToString(task.title) || task.title,
          description: applyToString(task.description),
        }))
      }))
    }))
  };
}

// Zod schema for template variable
const templateVariableSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['text', 'number', 'date', 'select', 'multiselect']),
  label: z.string().min(1).max(128),
  labelRu: z.string().max(128).optional(),
  description: z.string().max(500).optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(128).optional(),
});

export const templateEnhancedRouter = router({
  // ============ CATEGORIES ============
  
  // List all categories
  listCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    
    const categories = await db.select().from(templateCategories)
      .orderBy(asc(templateCategories.sortOrder));
    
    return categories;
  }),
  
  // Create category (admin only)
  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      nameRu: z.string().max(100).optional(),
      icon: z.string().max(64).optional(),
      color: z.string().max(32).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check if admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
      
      const [result] = await db.insert(templateCategories).values({
        name: input.name,
        nameRu: input.nameRu,
        icon: input.icon || 'folder',
        color: input.color || '#f59e0b',
      });
      
      return { id: result.insertId };
    }),
  
  // ============ TAGS ============
  
  // List all tags
  listTags: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    
    const tags = await db.select().from(templateTags)
      .orderBy(desc(templateTags.usageCount));
    
    return tags;
  }),
  
  // Create or get tag
  getOrCreateTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      nameRu: z.string().max(64).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check if tag exists
      const [existing] = await db.select().from(templateTags)
        .where(eq(templateTags.name, input.name.toLowerCase()));
      
      if (existing) {
        return existing;
      }
      
      // Create new tag
      const [result] = await db.insert(templateTags).values({
        name: input.name.toLowerCase(),
        nameRu: input.nameRu,
      });
      
      return { id: result.insertId, name: input.name.toLowerCase(), nameRu: input.nameRu };
    }),
  
  // ============ TEMPLATE VARIABLES ============
  
  // Update template variables
  updateTemplateVariables: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      variables: z.array(templateVariableSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check ownership
      const [template] = await db.select().from(projectTemplates)
        .where(and(
          eq(projectTemplates.id, input.templateId),
          eq(projectTemplates.authorId, ctx.user.id)
        ));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Update structure with new variables
      const currentStructure = template.structure as TemplateStructure || { blocks: [] };
      const updatedStructure: TemplateStructure = {
        ...currentStructure,
        variables: input.variables,
      };
      
      await db.update(projectTemplates)
        .set({ structure: updatedStructure })
        .where(eq(projectTemplates.id, input.templateId));
      
      return { success: true };
    }),
  
  // Preview template with variable values
  previewTemplate: publicProcedure
    .input(z.object({
      templateId: z.number(),
      variableValues: z.record(z.string(), z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      const [template] = await db.select().from(projectTemplates)
        .where(eq(projectTemplates.id, input.templateId));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      const structure = template.structure as TemplateStructure;
      if (!structure) {
        return { ...template, previewStructure: null };
      }
      
      // Apply variable values if provided
      const previewStructure = input.variableValues 
        ? applyVariablesToStructure(structure, input.variableValues)
        : structure;
      
      return {
        ...template,
        previewStructure,
        variables: structure.variables || [],
      };
    }),
  
  // ============ COMMUNITY TEMPLATES ============
  
  // List community templates with filters
  listCommunityTemplates: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      tagIds: z.array(z.number()).optional(),
      search: z.string().optional(),
      sortBy: z.enum(['popular', 'newest', 'rating']).default('popular'),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { templates: [], total: 0 };
      
      // Build conditions
      const conditions = [eq(projectTemplates.isPublic, true)];
      
      if (input.categoryId) {
        conditions.push(eq(projectTemplates.categoryId, input.categoryId));
      }
      
      if (input.search) {
        conditions.push(
          or(
            like(projectTemplates.name, `%${input.search}%`),
            like(projectTemplates.description, `%${input.search}%`)
          )!
        );
      }
      
      // Get templates with sorting
      const offset = (input.page - 1) * input.limit;
      
      let orderByClause;
      if (input.sortBy === 'popular') {
        orderByClause = desc(projectTemplates.usageCount);
      } else if (input.sortBy === 'newest') {
        orderByClause = desc(projectTemplates.createdAt);
      } else {
        orderByClause = desc(projectTemplates.rating);
      }
      
      const templates = await db.select().from(projectTemplates)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(input.limit)
        .offset(offset);
      
      // Get total count
      const [countResult] = await db.select({ count: sql<number>`count(*)` })
        .from(projectTemplates)
        .where(and(...conditions));
      
      // Get tags for each template
      const templateIds = templates.map((t: { id: number }) => t.id);
      let tagsMap: Record<number, { id: number; name: string }[]> = {};

      if (templateIds.length > 0) {
        const tagMappings = await db.select({
          templateId: templateToTags.templateId,
          tagId: templateToTags.tagId,
          tagName: templateTags.name,
        })
          .from(templateToTags)
          .leftJoin(templateTags, eq(templateToTags.tagId, templateTags.id))
          .where(sql`${templateToTags.templateId} IN (${sql.join(templateIds.map((id: number) => sql`${id}`), sql`, `)})`);

        for (const mapping of tagMappings) {
          if (!tagsMap[mapping.templateId]) {
            tagsMap[mapping.templateId] = [];
          }
          if (mapping.tagId && mapping.tagName) {
            tagsMap[mapping.templateId].push({ id: mapping.tagId, name: mapping.tagName });
          }
        }
      }

      return {
        templates: templates.map((t: { id: number; rating: number | null }) => ({
          ...t,
          tags: tagsMap[t.id] || [],
          ratingDisplay: t.rating ? (t.rating / 100).toFixed(1) : '0.0',
        })),
        total: countResult?.count || 0,
      };
    }),
  
  // Publish template to community
  publishTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      categoryId: z.number().optional(),
      tagNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check ownership
      const [template] = await db.select().from(projectTemplates)
        .where(and(
          eq(projectTemplates.id, input.templateId),
          eq(projectTemplates.authorId, ctx.user.id)
        ));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Update template
      await db.update(projectTemplates)
        .set({ 
          isPublic: true,
          categoryId: input.categoryId,
          authorName: ctx.user.name || 'Anonymous',
        })
        .where(eq(projectTemplates.id, input.templateId));
      
      // Add tags
      if (input.tagNames && input.tagNames.length > 0) {
        for (const tagName of input.tagNames) {
          // Get or create tag
          let [tag] = await db.select().from(templateTags)
            .where(eq(templateTags.name, tagName.toLowerCase()));
          
          if (!tag) {
            const [result] = await db.insert(templateTags).values({
              name: tagName.toLowerCase(),
            });
            tag = { id: result.insertId, name: tagName.toLowerCase(), nameRu: null, usageCount: 0, createdAt: new Date() };
          }
          
          // Link tag to template
          await db.insert(templateToTags).values({
            templateId: input.templateId,
            tagId: tag.id,
          });
          
          // Increment usage count
          await db.update(templateTags)
            .set({ usageCount: sql`${templateTags.usageCount} + 1` })
            .where(eq(templateTags.id, tag.id));
        }
      }
      
      return { success: true };
    }),
  
  // Unpublish template
  unpublishTemplate: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check ownership
      const [template] = await db.select().from(projectTemplates)
        .where(and(
          eq(projectTemplates.id, input.templateId),
          eq(projectTemplates.authorId, ctx.user.id)
        ));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      await db.update(projectTemplates)
        .set({ isPublic: false })
        .where(eq(projectTemplates.id, input.templateId));
      
      return { success: true };
    }),
  
  // ============ RATINGS ============
  
  // Rate a template
  rateTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      rating: z.number().min(1).max(5),
      review: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Check if template exists and is public
      const [template] = await db.select().from(projectTemplates)
        .where(and(
          eq(projectTemplates.id, input.templateId),
          eq(projectTemplates.isPublic, true)
        ));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Check if user already rated
      const [existingRating] = await db.select().from(templateRatings)
        .where(and(
          eq(templateRatings.templateId, input.templateId),
          eq(templateRatings.userId, ctx.user.id)
        ));
      
      if (existingRating) {
        // Update existing rating
        await db.update(templateRatings)
          .set({ rating: input.rating, review: input.review })
          .where(eq(templateRatings.id, existingRating.id));
      } else {
        // Create new rating
        await db.insert(templateRatings).values({
          templateId: input.templateId,
          userId: ctx.user.id,
          rating: input.rating,
          review: input.review,
        });
      }
      
      // Recalculate average rating
      const [avgResult] = await db.select({ 
        avg: sql<number>`AVG(${templateRatings.rating}) * 100` 
      })
        .from(templateRatings)
        .where(eq(templateRatings.templateId, input.templateId));
      
      await db.update(projectTemplates)
        .set({ rating: Math.round(avgResult?.avg || 0) })
        .where(eq(projectTemplates.id, input.templateId));
      
      return { success: true };
    }),
  
  // Get template ratings
  getTemplateRatings: publicProcedure
    .input(z.object({
      templateId: z.number(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const ratings = await db.select().from(templateRatings)
        .where(eq(templateRatings.templateId, input.templateId))
        .orderBy(desc(templateRatings.createdAt))
        .limit(input.limit);
      
      return ratings;
    }),
  
  // ============ DOWNLOADS / USAGE ============
  
  // Use template (create project from template)
  useTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      projectName: z.string().min(1).max(255),
      variableValues: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Get template
      const [template] = await db.select().from(projectTemplates)
        .where(eq(projectTemplates.id, input.templateId));
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Check if template is public or owned by user
      if (!template.isPublic && template.authorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Template not accessible" });
      }
      
      let structure = template.structure as TemplateStructure;
      if (!structure || !structure.blocks) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid template structure" });
      }
      
      // Apply variable values
      if (input.variableValues) {
        structure = applyVariablesToStructure(structure, input.variableValues as Record<string, string>);
      }
      
      // Create project
      const [projectResult] = await db.insert(projects).values({
        userId: ctx.user.id,
        name: input.projectName,
        description: template.description,
        icon: template.icon,
        color: template.color,
      });
      
      const projectId = projectResult.insertId;
      
      // Create blocks, sections, tasks
      for (let blockIndex = 0; blockIndex < structure.blocks.length; blockIndex++) {
        const blockData = structure.blocks[blockIndex];
        
        const [blockResult] = await db.insert(blocks).values({
          projectId,
          title: blockData.title,
          description: blockData.description,
          number: blockIndex + 1,
          sortOrder: blockIndex,
        });
        
        const blockId = blockResult.insertId;
        
        for (let sectionIndex = 0; sectionIndex < blockData.sections.length; sectionIndex++) {
          const sectionData = blockData.sections[sectionIndex];
          
          const [sectionResult] = await db.insert(sections).values({
            blockId,
            title: sectionData.title,
            description: sectionData.description,
            sortOrder: sectionIndex,
          });
          
          const sectionId = sectionResult.insertId;
          
          for (let taskIndex = 0; taskIndex < sectionData.tasks.length; taskIndex++) {
            const taskData = sectionData.tasks[taskIndex];
            
            await db.insert(tasks).values({
              sectionId,
              title: taskData.title,
              description: taskData.description,
              priority: taskData.priority || 'medium',
              status: 'not_started',
              sortOrder: taskIndex,
            });
          }
        }
      }
      
      // Record download
      await db.insert(templateDownloads).values({
        templateId: input.templateId,
        userId: ctx.user.id,
        createdProjectId: projectId,
      });
      
      // Increment usage count
      await db.update(projectTemplates)
        .set({ usageCount: sql`${projectTemplates.usageCount} + 1` })
        .where(eq(projectTemplates.id, input.templateId));
      
      return { projectId };
    }),
  
  // ============ COPY PROJECT AS TEMPLATE ============
  
  // Create template from existing project
  createFromProject: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      variables: z.array(templateVariableSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      
      // Get project
      const [project] = await db.select().from(projects)
        .where(and(
          eq(projects.id, input.projectId),
          eq(projects.userId, ctx.user.id)
        ));
      
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      // Get all blocks
      const projectBlocks = await db.select().from(blocks)
        .where(eq(blocks.projectId, input.projectId))
        .orderBy(asc(blocks.sortOrder));
      
      const blockIds = projectBlocks.map((b: { id: number }) => b.id);

      // Get all sections
      let allSections: any[] = [];
      if (blockIds.length > 0) {
        allSections = await db.select().from(sections)
          .where(sql`${sections.blockId} IN (${sql.join(blockIds.map((id: number) => sql`${id}`), sql`, `)})`)
          .orderBy(asc(sections.sortOrder));
      }

      const sectionIds = allSections.map((s: { id: number }) => s.id);

      // Get all tasks
      let allTasks: any[] = [];
      if (sectionIds.length > 0) {
        allTasks = await db.select().from(tasks)
          .where(sql`${tasks.sectionId} IN (${sql.join(sectionIds.map((id: number) => sql`${id}`), sql`, `)})`)
          .orderBy(asc(tasks.sortOrder));
      }

      // Build structure
      const structure: TemplateStructure = {
        variables: input.variables || [],
        blocks: projectBlocks.map((block: { id: number; title: string; description: string | null; duration: number | null }) => ({
          title: block.title,
          description: block.description || undefined,
          duration: block.duration || undefined,
          sections: allSections
            .filter((s: { blockId: number }) => s.blockId === block.id)
            .map((section: { id: number; title: string; description: string | null }) => ({
              title: section.title,
              description: section.description || undefined,
              tasks: allTasks
                .filter((t: { sectionId: number }) => t.sectionId === section.id)
                .map((task: { title: string; description: string | null; priority: string | null }) => ({
                  title: task.title,
                  description: task.description || undefined,
                  priority: task.priority || undefined,
                }))
            }))
        }))
      };
      
      // Create template
      const [result] = await db.insert(projectTemplates).values({
        name: input.name,
        description: input.description || project.description,
        icon: project.icon || 'layout-template',
        color: project.color || '#8b5cf6',
        structure,
        authorId: ctx.user.id,
        authorName: ctx.user.name || 'Anonymous',
        blocksCount: projectBlocks.length,
        sectionsCount: allSections.length,
        tasksCount: allTasks.length,
        isPublic: false,
      });
      
      return { templateId: result.insertId };
    }),
});
