/**
 * Relation Resolver - Resolves entity relations and provides related records
 */

import { getDb } from '../db';
import * as schema from '../../drizzle/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export type EntityType = 'project' | 'block' | 'section' | 'task' | 'subtask';
export type RelationType = 
  | 'parent_child' | 'blocks' | 'blocked_by' | 'related_to' | 'duplicate_of'
  | 'depends_on' | 'required_by' | 'subtask_of' | 'linked' | 'cloned_from' | 'moved_from';

// Reverse relation mapping
const REVERSE_RELATIONS: Record<RelationType, RelationType | null> = {
  'parent_child': 'parent_child',
  'blocks': 'blocked_by',
  'blocked_by': 'blocks',
  'related_to': 'related_to',
  'duplicate_of': 'duplicate_of',
  'depends_on': 'required_by',
  'required_by': 'depends_on',
  'subtask_of': 'parent_child',
  'linked': 'linked',
  'cloned_from': null,
  'moved_from': null,
};

export interface RelationInput {
  sourceType: EntityType;
  sourceId: number;
  targetType: EntityType;
  targetId: number;
  relationType: RelationType;
  isBidirectional?: boolean;
  metadata?: {
    label?: string;
    color?: string;
    notes?: string;
    strength?: number;
  };
}

export class RelationResolver {
  /**
   * Create a new relation between entities
   */
  static async createRelation(input: RelationInput, userId: number) {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const reverseRelationType = input.isBidirectional !== false 
      ? REVERSE_RELATIONS[input.relationType] 
      : null;

    const result = await db.insert(schema.entityRelations).values({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relationType: input.relationType,
      isBidirectional: input.isBidirectional ?? true,
      reverseRelationType: reverseRelationType || undefined,
      createdBy: userId,
      metadata: input.metadata || null,
    });

    return { id: (result as any)[0]?.insertId || result[0] };
  }

  /**
   * Get all relations for an entity
   */
  static async getRelations(entityType: EntityType, entityId: number) {
    const db = await getDb();
    if (!db) return [];

    // Get relations where this entity is the source
    const asSource = await db
      .select()
      .from(schema.entityRelations)
      .where(
        and(
          eq(schema.entityRelations.sourceType, entityType),
          eq(schema.entityRelations.sourceId, entityId)
        )
      );

    // Get relations where this entity is the target (for bidirectional)
    const asTarget = await db
      .select()
      .from(schema.entityRelations)
      .where(
        and(
          eq(schema.entityRelations.targetType, entityType),
          eq(schema.entityRelations.targetId, entityId),
          eq(schema.entityRelations.isBidirectional, true)
        )
      );

    return {
      outgoing: asSource,
      incoming: asTarget,
      all: [...asSource, ...asTarget],
    };
  }

  /**
   * Get related entities of a specific type
   */
  static async getRelatedEntities(
    entityType: EntityType,
    entityId: number,
    relationType?: RelationType
  ) {
    const db = await getDb();
    if (!db) return [];

    const conditions = [
      and(
        eq(schema.entityRelations.sourceType, entityType),
        eq(schema.entityRelations.sourceId, entityId)
      ),
    ];

    if (relationType) {
      conditions.push(eq(schema.entityRelations.relationType, relationType) as any);
    }

    const relations = await db
      .select()
      .from(schema.entityRelations)
      .where(and(...conditions));

    // Fetch actual entity data based on target type
    const entityData = await Promise.all(
      relations.map(async (rel) => {
        const entity = await this.fetchEntity(rel.targetType, rel.targetId);
        return {
          relation: rel,
          entity,
        };
      })
    );

    return entityData.filter((e) => e.entity !== null);
  }

  /**
   * Fetch an entity by type and ID
   */
  static async fetchEntity(entityType: EntityType, entityId: number) {
    const db = await getDb();
    if (!db) return null;

    switch (entityType) {
      case 'project':
        const projects = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, entityId))
          .limit(1);
        return projects[0] || null;

      case 'block':
        const blocks = await db
          .select()
          .from(schema.blocks)
          .where(eq(schema.blocks.id, entityId))
          .limit(1);
        return blocks[0] || null;

      case 'section':
        const sections = await db
          .select()
          .from(schema.sections)
          .where(eq(schema.sections.id, entityId))
          .limit(1);
        return sections[0] || null;

      case 'task':
        const tasks = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, entityId))
          .limit(1);
        return tasks[0] || null;

      case 'subtask':
        const subtasks = await db
          .select()
          .from(schema.subtasks)
          .where(eq(schema.subtasks.id, entityId))
          .limit(1);
        return subtasks[0] || null;

      default:
        return null;
    }
  }

  /**
   * Delete a relation
   */
  static async deleteRelation(relationId: number) {
    const db = await getDb();
    if (!db) return false;

    await db
      .delete(schema.entityRelations)
      .where(eq(schema.entityRelations.id, relationId));

    return true;
  }

  /**
   * Check if a relation exists
   */
  static async relationExists(
    sourceType: EntityType,
    sourceId: number,
    targetType: EntityType,
    targetId: number,
    relationType?: RelationType
  ) {
    const db = await getDb();
    if (!db) return false;

    const conditions = [
      eq(schema.entityRelations.sourceType, sourceType),
      eq(schema.entityRelations.sourceId, sourceId),
      eq(schema.entityRelations.targetType, targetType),
      eq(schema.entityRelations.targetId, targetId),
    ];

    if (relationType) {
      conditions.push(eq(schema.entityRelations.relationType, relationType));
    }

    const result = await db
      .select()
      .from(schema.entityRelations)
      .where(and(...conditions))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get blocking tasks for a task
   */
  static async getBlockingTasks(taskId: number) {
    return this.getRelatedEntities('task', taskId, 'blocked_by');
  }

  /**
   * Get tasks that this task blocks
   */
  static async getBlockedTasks(taskId: number) {
    return this.getRelatedEntities('task', taskId, 'blocks');
  }

  /**
   * Get task dependencies
   */
  static async getDependencies(taskId: number) {
    return this.getRelatedEntities('task', taskId, 'depends_on');
  }

  /**
   * Get tasks that depend on this task
   */
  static async getDependents(taskId: number) {
    return this.getRelatedEntities('task', taskId, 'required_by');
  }
}
