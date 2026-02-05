/**
 * Relations Router - tRPC procedures for entity relations, tags, lookup, and rollup
 */

import { z } from 'zod';
import { protectedProcedure, router } from './_core/trpc';
import { getDb } from './db';
import * as schema from '../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { RelationResolver, EntityType, RelationType } from './utils/relationResolver';
import { LookupCalculator, LookupEntityType } from './utils/lookupCalculator';
import { RollupCalculator, RollupEntityType } from './utils/rollupCalculator';

// Zod schemas
const entityTypeSchema = z.enum(['project', 'block', 'section', 'task', 'subtask']);
const lookupEntityTypeSchema = z.enum(['project', 'block', 'section', 'task']);
const relationTypeSchema = z.enum([
  'parent_child', 'blocks', 'blocked_by', 'related_to', 'duplicate_of',
  'depends_on', 'required_by', 'subtask_of', 'linked', 'cloned_from', 'moved_from'
]);

export const relationsRouter = router({
  // ============================================================================
  // ENTITY RELATIONS
  // ============================================================================

  /**
   * Create a relation between two entities
   */
  createRelation: protectedProcedure
    .input(z.object({
      sourceType: entityTypeSchema,
      sourceId: z.number(),
      targetType: entityTypeSchema,
      targetId: z.number(),
      relationType: relationTypeSchema,
      isBidirectional: z.boolean().optional().default(true),
      metadata: z.object({
        label: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
        strength: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return RelationResolver.createRelation(input as any, ctx.user.id);
    }),

  /**
   * Get all relations for an entity
   */
  getRelations: protectedProcedure
    .input(z.object({
      entityType: entityTypeSchema,
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      return RelationResolver.getRelations(input.entityType, input.entityId);
    }),

  /**
   * Get related entities with full data
   */
  getRelatedEntities: protectedProcedure
    .input(z.object({
      entityType: entityTypeSchema,
      entityId: z.number(),
      relationType: relationTypeSchema.optional(),
    }))
    .query(async ({ input }) => {
      return RelationResolver.getRelatedEntities(
        input.entityType,
        input.entityId,
        input.relationType as RelationType | undefined
      );
    }),

  /**
   * Delete a relation
   */
  deleteRelation: protectedProcedure
    .input(z.object({ relationId: z.number() }))
    .mutation(async ({ input }) => {
      return RelationResolver.deleteRelation(input.relationId);
    }),

  /**
   * Link two records (convenience method)
   */
  linkRecords: protectedProcedure
    .input(z.object({
      sourceType: entityTypeSchema,
      sourceId: z.number(),
      targetType: entityTypeSchema,
      targetId: z.number(),
      relationType: relationTypeSchema.optional().default('related_to'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if relation already exists
      const exists = await RelationResolver.relationExists(
        input.sourceType,
        input.sourceId,
        input.targetType,
        input.targetId,
        input.relationType as RelationType
      );

      if (exists) {
        return { success: false, message: 'Relation already exists' };
      }

      await RelationResolver.createRelation({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        relationType: input.relationType as RelationType,
      }, ctx.user.id);

      return { success: true };
    }),

  /**
   * Unlink two records
   */
  unlinkRecords: protectedProcedure
    .input(z.object({
      sourceType: entityTypeSchema,
      sourceId: z.number(),
      targetType: entityTypeSchema,
      targetId: z.number(),
      relationType: relationTypeSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const conditions = [
        eq(schema.entityRelations.sourceType, input.sourceType),
        eq(schema.entityRelations.sourceId, input.sourceId),
        eq(schema.entityRelations.targetType, input.targetType),
        eq(schema.entityRelations.targetId, input.targetId),
      ];

      if (input.relationType) {
        conditions.push(eq(schema.entityRelations.relationType, input.relationType));
      }

      await db.delete(schema.entityRelations).where(and(...conditions));
      return { success: true };
    }),

  // ============================================================================
  // TAGS
  // ============================================================================

  /**
   * Create a tag
   */
  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().optional().default('#6366f1'),
      icon: z.string().optional(),
      description: z.string().optional(),
      tagType: z.enum(['label', 'category', 'status', 'sprint', 'epic', 'component', 'custom']).optional().default('label'),
      projectId: z.number().optional(), // null = global tag
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const result = await db.insert(schema.tags).values({
        name: input.name,
        color: input.color,
        icon: input.icon || null,
        description: input.description || null,
        tagType: input.tagType,
        projectId: input.projectId || null,
        userId: ctx.user.id,
      });

      return { id: (result as any)[0]?.insertId || result[0] };
    }),

  /**
   * Get tags (project-specific + global)
   */
  getTags: protectedProcedure
    .input(z.object({
      projectId: z.number().optional(),
      tagType: z.enum(['label', 'category', 'status', 'sprint', 'epic', 'component', 'custom']).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const allTags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.isArchived, false))
        .orderBy(desc(schema.tags.usageCount));

      // Filter: project-specific + global tags
      let filtered = allTags;
      if (input.projectId) {
        filtered = allTags.filter(t => t.projectId === null || t.projectId === input.projectId);
      }

      if (input.tagType) {
        filtered = filtered.filter(t => t.tagType === input.tagType);
      }

      return filtered;
    }),

  /**
   * Update a tag
   */
  updateTag: protectedProcedure
    .input(z.object({
      tagId: z.number(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().optional(),
      icon: z.string().optional(),
      description: z.string().optional(),
      isArchived: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      const { tagId, ...updates } = input;
      await db.update(schema.tags).set(updates).where(eq(schema.tags.id, tagId));
      return { success: true };
    }),

  /**
   * Delete a tag
   */
  deleteTag: protectedProcedure
    .input(z.object({ tagId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Delete tag associations first
      await db.delete(schema.taskTags).where(eq(schema.taskTags.tagId, input.tagId));
      // Delete the tag
      await db.delete(schema.tags).where(eq(schema.tags.id, input.tagId));
      return { success: true };
    }),

  /**
   * Add tag to task
   */
  addTagToTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      tagId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Check if already exists
      const existing = await db
        .select()
        .from(schema.taskTags)
        .where(and(
          eq(schema.taskTags.taskId, input.taskId),
          eq(schema.taskTags.tagId, input.tagId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, message: 'Tag already added' };
      }

      await db.insert(schema.taskTags).values({
        taskId: input.taskId,
        tagId: input.tagId,
        addedBy: ctx.user.id,
      });

      // Increment usage count - fetch current and increment
      const tagData = await db.select().from(schema.tags).where(eq(schema.tags.id, input.tagId)).limit(1);
      if (tagData.length > 0) {
        await db.update(schema.tags)
          .set({ usageCount: (tagData[0].usageCount || 0) + 1 })
          .where(eq(schema.tags.id, input.tagId));
      }

      return { success: true };
    }),

  /**
   * Remove tag from task
   */
  removeTagFromTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      tagId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.delete(schema.taskTags).where(and(
        eq(schema.taskTags.taskId, input.taskId),
        eq(schema.taskTags.tagId, input.tagId)
      ));

      return { success: true };
    }),

  /**
   * Get tags for a task
   */
  getTaskTags: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const taskTagRecords = await db
        .select()
        .from(schema.taskTags)
        .where(eq(schema.taskTags.taskId, input.taskId));

      if (taskTagRecords.length === 0) return [];

      const tagIds = taskTagRecords.map(tt => tt.tagId);
      const tags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.isArchived, false));

      return tags.filter(t => tagIds.includes(t.id));
    }),

  // ============================================================================
  // LOOKUP FIELDS
  // ============================================================================

  /**
   * Create a lookup field
   */
  createLookupField: protectedProcedure
    .input(z.object({
      entityType: lookupEntityTypeSchema,
      entityId: z.number().optional(),
      name: z.string().min(1).max(100),
      displayName: z.string().min(1).max(255),
      relationType: z.string(),
      sourceProperty: z.string(),
      displayFormat: z.enum(['text', 'badge', 'avatar', 'date', 'datetime', 'progress_bar', 'link', 'list', 'number', 'currency', 'percentage']).optional(),
      aggregation: z.enum(['first', 'last', 'all', 'count', 'comma_list', 'unique']).optional(),
      formatOptions: z.object({
        dateFormat: z.string().optional(),
        numberFormat: z.string().optional(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        maxItems: z.number().optional(),
        emptyText: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return LookupCalculator.createLookupField(input as any, ctx.user.id);
    }),

  /**
   * Calculate lookup value
   */
  calculateLookup: protectedProcedure
    .input(z.object({
      lookupFieldId: z.number(),
      entityType: lookupEntityTypeSchema,
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      return LookupCalculator.calculateLookup(
        input.lookupFieldId,
        input.entityType as LookupEntityType,
        input.entityId
      );
    }),

  /**
   * Get lookup fields for entity type
   */
  getLookupFields: protectedProcedure
    .input(z.object({
      entityType: lookupEntityTypeSchema,
      entityId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return LookupCalculator.getLookupFields(input.entityType as LookupEntityType, input.entityId);
    }),

  /**
   * Delete lookup field
   */
  deleteLookupField: protectedProcedure
    .input(z.object({ lookupFieldId: z.number() }))
    .mutation(async ({ input }) => {
      return LookupCalculator.deleteLookupField(input.lookupFieldId);
    }),

  // ============================================================================
  // ROLLUP FIELDS
  // ============================================================================

  /**
   * Create a rollup field
   */
  createRollupField: protectedProcedure
    .input(z.object({
      entityType: lookupEntityTypeSchema,
      entityId: z.number().optional(),
      name: z.string().min(1).max(100),
      displayName: z.string().min(1).max(255),
      sourceRelationType: z.string(),
      sourceProperty: z.string(),
      aggregationFunction: z.enum([
        'count', 'count_values', 'count_unique', 'count_checked', 'count_unchecked',
        'sum', 'average', 'median', 'min', 'max', 'range',
        'percent_empty', 'percent_not_empty', 'percent_checked', 'percent_unchecked',
        'earliest_date', 'latest_date', 'date_range_days',
        'show_original', 'concatenate'
      ]),
      filterConditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      })).optional(),
      displayFormat: z.enum(['number', 'percentage', 'currency', 'duration', 'date', 'progress_bar', 'text', 'fraction']).optional(),
      decimalPlaces: z.number().optional(),
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      progressBarMax: z.number().optional(),
      progressBarColor: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return RollupCalculator.createRollupField(input as any, ctx.user.id);
    }),

  /**
   * Calculate rollup value
   */
  calculateRollup: protectedProcedure
    .input(z.object({
      rollupFieldId: z.number(),
      entityType: lookupEntityTypeSchema,
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      // Try cache first
      const cached = await RollupCalculator.getCachedValue(input.rollupFieldId);
      if (cached) return cached;

      return RollupCalculator.calculateRollup(
        input.rollupFieldId,
        input.entityType as RollupEntityType,
        input.entityId
      );
    }),

  /**
   * Get rollup fields for entity type
   */
  getRollupFields: protectedProcedure
    .input(z.object({
      entityType: lookupEntityTypeSchema,
      entityId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return RollupCalculator.getRollupFields(input.entityType as RollupEntityType, input.entityId);
    }),

  /**
   * Delete rollup field
   */
  deleteRollupField: protectedProcedure
    .input(z.object({ rollupFieldId: z.number() }))
    .mutation(async ({ input }) => {
      return RollupCalculator.deleteRollupField(input.rollupFieldId);
    }),

  /**
   * Get all task-tag associations for filtering
   * Returns all task tags with their tag data for client-side filtering
   */
  getAllTaskTags: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      // Get all task-tag associations with tag data
      const taskTags = await db
        .select({
          taskId: schema.taskTags.taskId,
          tagId: schema.taskTags.tagId,
        })
        .from(schema.taskTags);

      // Get all non-archived tags
      const tags = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.isArchived, false));

      // Create a map of tag id to tag data
      const tagMap = new Map(tags.map(t => [t.id, t]));

      // Return task tags with full tag data
      return taskTags
        .filter(tt => tagMap.has(tt.tagId))
        .map(tt => ({
          taskId: tt.taskId,
          tag: tagMap.get(tt.tagId)!,
        }));
    }),
});
