import { z } from "zod";
import { eq, desc, like, and, or, sql, count } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "../drizzle/schema";
import { router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminPromptsRouter = router({
  // List all prompts with filters
  list: adminProcedure
    .input(z.object({
      category: z.enum(["analysis", "code", "translation", "creative", "custom", "all"]).optional(),
      search: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input?.category && input.category !== "all") {
        conditions.push(eq(schema.systemPrompts.category, input.category));
      }
      
      if (input?.isActive !== undefined) {
        conditions.push(eq(schema.systemPrompts.isActive, input.isActive));
      }
      
      if (input?.search) {
        conditions.push(
          or(
            like(schema.systemPrompts.name, `%${input.search}%`),
            like(schema.systemPrompts.description, `%${input.search}%`),
            like(schema.systemPrompts.content, `%${input.search}%`)
          )
        );
      }
      
      const prompts = await db
        .select()
        .from(schema.systemPrompts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.systemPrompts.updatedAt));
      
      return prompts;
    }),

  // Get single prompt by ID
  getById: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [prompt] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, input.id));
      
      return prompt || null;
    }),

  // Create new prompt
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      category: z.enum(["analysis", "code", "translation", "creative", "custom"]),
      description: z.string().optional(),
      content: z.string().min(1),
      variables: z.array(z.string()).optional(),
      linkedAgents: z.array(z.number()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [result] = await db.insert(schema.systemPrompts).values({
        name: input.name,
        slug: input.slug,
        category: input.category,
        description: input.description,
        content: input.content,
        variables: input.variables,
        linkedAgents: input.linkedAgents,
        isActive: input.isActive ?? true,
        version: 1,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      
      // Create initial version
      await db.insert(schema.promptVersions).values({
        promptId: result.insertId,
        version: 1,
        content: input.content,
        variables: input.variables,
        changeNote: "Initial version",
        changedBy: ctx.user.id,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Update prompt
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      category: z.enum(["analysis", "code", "translation", "creative", "custom"]).optional(),
      description: z.string().optional(),
      content: z.string().min(1).optional(),
      variables: z.array(z.string()).optional(),
      linkedAgents: z.array(z.number()).optional(),
      isActive: z.boolean().optional(),
      changeNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const { id, changeNote, ...updateData } = input;
      
      // Get current prompt
      const [currentPrompt] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, id));
      
      if (!currentPrompt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prompt not found" });
      }
      
      // If content changed, create new version
      if (updateData.content && updateData.content !== currentPrompt.content) {
        const newVersion = currentPrompt.version + 1;
        
        await db.insert(schema.promptVersions).values({
          promptId: id,
          version: newVersion,
          content: updateData.content,
          variables: updateData.variables || currentPrompt.variables,
          changeNote: changeNote || `Version ${newVersion}`,
          changedBy: ctx.user.id,
        });
        
        await db.update(schema.systemPrompts)
          .set({
            ...updateData,
            version: newVersion,
            updatedBy: ctx.user.id,
          })
          .where(eq(schema.systemPrompts.id, id));
      } else {
        await db.update(schema.systemPrompts)
          .set({
            ...updateData,
            updatedBy: ctx.user.id,
          })
          .where(eq(schema.systemPrompts.id, id));
      }
      
      return { success: true };
    }),

  // Delete prompt
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Delete versions first
      await db.delete(schema.promptVersions).where(eq(schema.promptVersions.promptId, input.id));
      
      // Delete prompt
      await db.delete(schema.systemPrompts).where(eq(schema.systemPrompts.id, input.id));
      
      return { success: true };
    }),

  // Clone prompt
  clone: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [original] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, input.id));
      
      if (!original) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prompt not found" });
      }
      
      // Generate unique slug
      const newSlug = `${original.slug}-copy-${Date.now()}`;
      
      const [result] = await db.insert(schema.systemPrompts).values({
        name: `${original.name} (копия)`,
        slug: newSlug,
        category: original.category,
        description: original.description,
        content: original.content,
        variables: original.variables,
        linkedAgents: original.linkedAgents,
        isActive: false,
        isSystem: false,
        version: 1,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      });
      
      // Create initial version for clone
      await db.insert(schema.promptVersions).values({
        promptId: result.insertId,
        version: 1,
        content: original.content,
        variables: original.variables,
        changeNote: `Cloned from "${original.name}"`,
        changedBy: ctx.user.id,
      });
      
      return { id: result.insertId, success: true };
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [prompt] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, input.id));
      
      if (!prompt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prompt not found" });
      }
      
      await db.update(schema.systemPrompts)
        .set({
          isActive: !prompt.isActive,
          updatedBy: ctx.user.id,
        })
        .where(eq(schema.systemPrompts.id, input.id));
      
      return { success: true, isActive: !prompt.isActive };
    }),

  // Get version history
  getVersionHistory: adminProcedure
    .input(z.object({ promptId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const versions = await db
        .select()
        .from(schema.promptVersions)
        .where(eq(schema.promptVersions.promptId, input.promptId))
        .orderBy(desc(schema.promptVersions.version));
      
      return versions;
    }),

  // Restore specific version
  restoreVersion: adminProcedure
    .input(z.object({
      promptId: z.number(),
      versionId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      const [version] = await db
        .select()
        .from(schema.promptVersions)
        .where(eq(schema.promptVersions.id, input.versionId));
      
      if (!version) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      }
      
      const [currentPrompt] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, input.promptId));
      
      if (!currentPrompt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Prompt not found" });
      }
      
      const newVersion = currentPrompt.version + 1;
      
      // Create new version from restored content
      await db.insert(schema.promptVersions).values({
        promptId: input.promptId,
        version: newVersion,
        content: version.content,
        variables: version.variables,
        changeNote: `Restored from version ${version.version}`,
        changedBy: ctx.user.id,
      });
      
      // Update prompt
      await db.update(schema.systemPrompts)
        .set({
          content: version.content,
          variables: version.variables,
          version: newVersion,
          updatedBy: ctx.user.id,
        })
        .where(eq(schema.systemPrompts.id, input.promptId));
      
      return { success: true };
    }),

  // Test prompt with AI
  testPrompt: adminProcedure
    .input(z.object({
      content: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
      testMessage: z.string(),
    }))
    .mutation(async ({ input }) => {
      let processedContent = input.content;
      
      // Replace variables
      if (input.variables) {
        for (const [key, value] of Object.entries(input.variables)) {
          processedContent = processedContent.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            String(value)
          );
        }
      }
      
      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: processedContent },
            { role: "user", content: input.testMessage },
          ],
        });
        
        const content = response.choices[0]?.message?.content;
        return {
          success: true,
          response: typeof content === 'string' ? content : JSON.stringify(content),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  // Get linked agents for a prompt
  getLinkedAgents: adminProcedure
    .input(z.object({ promptId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const [prompt] = await db
        .select()
        .from(schema.systemPrompts)
        .where(eq(schema.systemPrompts.id, input.promptId));
      
      if (!prompt || !prompt.linkedAgents || !Array.isArray(prompt.linkedAgents)) {
        return [];
      }
      
      const linkedAgentIds = prompt.linkedAgents as number[];
      if (linkedAgentIds.length === 0) {
        return [];
      }
      
      const linkedAgents = await db
        .select()
        .from(schema.aiAgents)
        .where(sql`${schema.aiAgents.id} IN (${linkedAgentIds.join(',')})`);
      
      return linkedAgents;
    }),

  // Get prompt categories with counts
  getCategoryCounts: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      const counts = await db
        .select({
          category: schema.systemPrompts.category,
          count: count(),
        })
        .from(schema.systemPrompts)
        .groupBy(schema.systemPrompts.category);
      
      return counts;
    }),

  // Extract variables from prompt content
  extractVariables: adminProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input }) => {
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      
      while ((match = variableRegex.exec(input.content)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }
      
      return { variables };
    }),
});
