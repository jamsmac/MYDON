/**
 * Skill Execution Router
 *
 * tRPC endpoints for executing AI skills
 */

import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc';
import { getDb } from './db';
import { TRPCError } from '@trpc/server';
import { aiSkills, projects, blocks, sections, tasks } from '../drizzle/schema';
import { eq, and, or, like } from 'drizzle-orm';
import { SkillEngine, loadEntityData } from './utils/skillEngine';
import { checkProjectAccess, requireAccessOrNotFound } from './utils/authorization';

// Type for skill list items
interface SkillListItem {
  id: number;
  slug: string;
  name: string;
  nameRu: string | null;
  description: string | null;
  handlerType: 'prompt' | 'function' | 'mcp' | 'webhook' | null;
  agentId: number | null;
  triggerPatterns?: string[] | null;
}

export const skillExecutionRouter = router({
  /**
   * Execute a skill by slug
   */
  execute: protectedProcedure
    .input(z.object({
      skillSlug: z.string().min(1).max(50),
      projectId: z.number(),
      entityType: z.enum(['project', 'block', 'section', 'task']),
      entityId: z.number(),
      additionalContext: z.string().optional(),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify project access
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      const [project] = await db.select().from(projects)
        .where(eq(projects.id, input.projectId));

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Verify user has at least viewer access to execute skills
      const accessResult = await checkProjectAccess(ctx.user.id, input.projectId, 'viewer');
      requireAccessOrNotFound(accessResult, 'проекту');

      // 2. Load entity data
      const entityData = await loadEntityData(input.entityType, input.entityId);

      if (!entityData || Object.keys(entityData).length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.entityType} with id ${input.entityId} not found`,
        });
      }

      // 3. Execute skill
      try {
        const result = await SkillEngine.execute(input.skillSlug, {
          userId: ctx.user.id,
          projectId: input.projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          entityData,
          additionalContext: input.additionalContext,
          model: input.model,
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Skill execution failed';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get available skills for an entity type
   */
  getAvailableSkills: protectedProcedure
    .input(z.object({
      entityType: z.enum(['project', 'block', 'section', 'task']),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all active skills
      const skills = await db.select({
        id: aiSkills.id,
        slug: aiSkills.slug,
        name: aiSkills.name,
        nameRu: aiSkills.nameRu,
        description: aiSkills.description,
        handlerType: aiSkills.handlerType,
        agentId: aiSkills.agentId,
        triggerPatterns: aiSkills.triggerPatterns,
      }).from(aiSkills)
        .where(eq(aiSkills.isActive, true));

      // Filter by entity type using slug prefix convention
      // e.g., block-roadmap, section-tasks, task-discuss
      return skills.filter((s: SkillListItem) => {
        const slug = s.slug;
        // Match entity-specific skills (block-*, section-*, task-*)
        if (slug.startsWith(`${input.entityType}-`)) return true;
        // Match any-* skills
        if (slug.startsWith('any-')) return true;
        // Match skills without entity prefix (generic)
        if (!slug.includes('-')) return true;
        // Match project- skills for project entity
        if (input.entityType === 'project' && slug.startsWith('project-')) return true;
        return false;
      });
    }),

  /**
   * Get a single skill by slug
   */
  getBySlug: protectedProcedure
    .input(z.object({
      slug: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      const [skill] = await db.select().from(aiSkills)
        .where(eq(aiSkills.slug, input.slug));

      if (!skill) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Skill "${input.slug}" not found`,
        });
      }

      return skill;
    }),

  /**
   * Search skills by name or slug
   */
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(100),
      entityType: z.enum(['project', 'block', 'section', 'task']).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const searchPattern = `%${input.query}%`;

      let skills = await db.select({
        id: aiSkills.id,
        slug: aiSkills.slug,
        name: aiSkills.name,
        nameRu: aiSkills.nameRu,
        description: aiSkills.description,
        handlerType: aiSkills.handlerType,
        agentId: aiSkills.agentId,
      }).from(aiSkills)
        .where(and(
          eq(aiSkills.isActive, true),
          or(
            like(aiSkills.slug, searchPattern),
            like(aiSkills.name, searchPattern),
            like(aiSkills.nameRu, searchPattern)
          )
        ));

      // Filter by entity type if specified
      if (input.entityType) {
        skills = skills.filter((s: Omit<SkillListItem, 'triggerPatterns'>) => {
          const slug = s.slug;
          if (slug.startsWith(`${input.entityType}-`)) return true;
          if (slug.startsWith('any-')) return true;
          if (!slug.includes('-')) return true;
          return false;
        });
      }

      return skills;
    }),
});
