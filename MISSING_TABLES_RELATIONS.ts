/**
 * MYDON Roadmap Hub - Drizzle Relations for Missing Tables
 * 
 * This file contains the Drizzle ORM relations definitions for the new tables.
 * Merge this code into your existing drizzle/relations.ts file.
 * 
 * @author Manus AI
 * @date February 6, 2026
 */

import { relations } from "drizzle-orm";

// ============================================================================
// IMPORTS TO ADD TO relations.ts
// ============================================================================

/*
Add these imports to the existing import statement in drizzle/relations.ts:

import { 
  users, 
  projects,
  blocks,
  sections,
  tasks,
  subtasks,
  aiRequests, 
  aiSessions, 
  aiUsageStats,
  // New tables
  tags,
  taskTags,
  entityRelations,
  viewConfigs,
  kanbanColumns,
  lookupFields,
  rollupFields,
} from "./schema";
*/

// ============================================================================
// TAGS RELATIONS
// ============================================================================

/**
 * Tags table relations
 * - Belongs to a project (optional - null means global tag)
 * - Created by a user
 * - Has many task-tag associations
 */
export const tagsRelations = relations(tags, ({ one, many }) => ({
  // Project this tag belongs to (null = global tag)
  project: one(projects, {
    fields: [tags.projectId],
    references: [projects.id],
    relationName: "projectTags",
  }),
  
  // User who created this tag
  creator: one(users, {
    fields: [tags.userId],
    references: [users.id],
    relationName: "userCreatedTags",
  }),
  
  // All task-tag associations using this tag
  taskTags: many(taskTags, {
    relationName: "tagTaskAssociations",
  }),
}));

/**
 * TaskTags junction table relations
 * - Belongs to a task
 * - Belongs to a tag
 * - Added by a user
 */
export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  // The task being tagged
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
    relationName: "taskTagAssociations",
  }),
  
  // The tag being applied
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
    relationName: "tagTaskAssociations",
  }),
  
  // User who added this tag to the task
  addedByUser: one(users, {
    fields: [taskTags.addedBy],
    references: [users.id],
    relationName: "userAddedTags",
  }),
}));

// ============================================================================
// ENTITY RELATIONS
// ============================================================================

/**
 * EntityRelations table relations
 * - Created by a user
 * Note: Source and target entities are polymorphic (handled in application code)
 */
export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  // User who created this relation
  creator: one(users, {
    fields: [entityRelations.createdBy],
    references: [users.id],
    relationName: "userCreatedEntityRelations",
  }),
}));

// ============================================================================
// VIEW CONFIGS RELATIONS
// ============================================================================

/**
 * ViewConfigs table relations
 * - Belongs to a project
 * - Owned by a user
 * - Has many Kanban columns (if viewType is 'kanban')
 */
export const viewConfigsRelations = relations(viewConfigs, ({ one, many }) => ({
  // Project this view belongs to
  project: one(projects, {
    fields: [viewConfigs.projectId],
    references: [projects.id],
    relationName: "projectViews",
  }),
  
  // User who owns this view configuration
  owner: one(users, {
    fields: [viewConfigs.userId],
    references: [users.id],
    relationName: "userViewConfigs",
  }),
  
  // Kanban columns for this view (only applicable for kanban viewType)
  kanbanColumns: many(kanbanColumns, {
    relationName: "viewKanbanColumns",
  }),
}));

// ============================================================================
// KANBAN COLUMNS RELATIONS
// ============================================================================

/**
 * KanbanColumns table relations
 * - Belongs to a view configuration
 */
export const kanbanColumnsRelations = relations(kanbanColumns, ({ one }) => ({
  // Parent view configuration
  viewConfig: one(viewConfigs, {
    fields: [kanbanColumns.viewConfigId],
    references: [viewConfigs.id],
    relationName: "viewKanbanColumns",
  }),
}));

// ============================================================================
// LOOKUP FIELDS RELATIONS
// ============================================================================

/**
 * LookupFields table relations
 * - Created by a user
 * - Optionally linked to a specific entity relation
 * Note: Entity type/id are polymorphic (handled in application code)
 */
export const lookupFieldsRelations = relations(lookupFields, ({ one }) => ({
  // User who created this lookup field
  creator: one(users, {
    fields: [lookupFields.createdBy],
    references: [users.id],
    relationName: "userCreatedLookupFields",
  }),
  
  // Specific entity relation this lookup is based on (optional)
  relation: one(entityRelations, {
    fields: [lookupFields.relationId],
    references: [entityRelations.id],
    relationName: "lookupFieldEntityRelation",
  }),
}));

// ============================================================================
// ROLLUP FIELDS RELATIONS
// ============================================================================

/**
 * RollupFields table relations
 * - Created by a user
 * Note: Entity type/id are polymorphic (handled in application code)
 */
export const rollupFieldsRelations = relations(rollupFields, ({ one }) => ({
  // User who created this rollup field
  creator: one(users, {
    fields: [rollupFields.createdBy],
    references: [users.id],
    relationName: "userCreatedRollupFields",
  }),
}));

// ============================================================================
// EXTENDED RELATIONS FOR EXISTING TABLES
// ============================================================================

/**
 * Add these relations to existing table relation definitions
 */

/*
// Add to usersRelations (extend existing):
export const usersRelations = relations(users, ({ many }) => ({
  // ... existing relations ...
  
  // New relations for tags system
  createdTags: many(tags, {
    relationName: "userCreatedTags",
  }),
  addedTaskTags: many(taskTags, {
    relationName: "userAddedTags",
  }),
  
  // New relations for entity relations
  createdEntityRelations: many(entityRelations, {
    relationName: "userCreatedEntityRelations",
  }),
  
  // New relations for view configs
  viewConfigs: many(viewConfigs, {
    relationName: "userViewConfigs",
  }),
  
  // New relations for lookup/rollup fields
  createdLookupFields: many(lookupFields, {
    relationName: "userCreatedLookupFields",
  }),
  createdRollupFields: many(rollupFields, {
    relationName: "userCreatedRollupFields",
  }),
}));

// Add to projectsRelations (extend existing):
export const projectsRelations = relations(projects, ({ many }) => ({
  // ... existing relations ...
  
  // New relations for tags
  tags: many(tags, {
    relationName: "projectTags",
  }),
  
  // New relations for view configs
  viewConfigs: many(viewConfigs, {
    relationName: "projectViews",
  }),
}));

// Add to tasksRelations (extend existing):
export const tasksRelations = relations(tasks, ({ many }) => ({
  // ... existing relations ...
  
  // New relations for tags
  taskTags: many(taskTags, {
    relationName: "taskTagAssociations",
  }),
}));
*/

// ============================================================================
// COMPLETE UPDATED relations.ts FILE
// ============================================================================

/*
Here is the complete updated relations.ts file with all relations:

import { relations } from "drizzle-orm";
import { 
  users, 
  projects,
  blocks,
  sections,
  tasks,
  subtasks,
  aiRequests, 
  aiSessions, 
  aiUsageStats,
  tags,
  taskTags,
  entityRelations,
  viewConfigs,
  kanbanColumns,
  lookupFields,
  rollupFields,
} from "./schema";

// ============================================================================
// EXISTING AI RELATIONS
// ============================================================================

export const aiRequestsRelations = relations(aiRequests, ({ one }) => ({
  user: one(users, {
    fields: [aiRequests.userId],
    references: [users.id],
  }),
  session: one(aiSessions, {
    fields: [aiRequests.sessionId],
    references: [aiSessions.id],
  }),
}));

export const aiSessionsRelations = relations(aiSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [aiSessions.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [aiSessions.projectId],
    references: [projects.id],
  }),
  requests: many(aiRequests),
}));

export const aiUsageStatsRelations = relations(aiUsageStats, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageStats.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// TAGS RELATIONS
// ============================================================================

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, {
    fields: [tags.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.taskId],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tagId],
    references: [tags.id],
  }),
  addedByUser: one(users, {
    fields: [taskTags.addedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// ENTITY RELATIONS
// ============================================================================

export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  creator: one(users, {
    fields: [entityRelations.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// VIEW CONFIGS RELATIONS
// ============================================================================

export const viewConfigsRelations = relations(viewConfigs, ({ one, many }) => ({
  project: one(projects, {
    fields: [viewConfigs.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [viewConfigs.userId],
    references: [users.id],
  }),
  kanbanColumns: many(kanbanColumns),
}));

export const kanbanColumnsRelations = relations(kanbanColumns, ({ one }) => ({
  viewConfig: one(viewConfigs, {
    fields: [kanbanColumns.viewConfigId],
    references: [viewConfigs.id],
  }),
}));

// ============================================================================
// LOOKUP & ROLLUP FIELDS RELATIONS
// ============================================================================

export const lookupFieldsRelations = relations(lookupFields, ({ one }) => ({
  creator: one(users, {
    fields: [lookupFields.createdBy],
    references: [users.id],
  }),
  relation: one(entityRelations, {
    fields: [lookupFields.relationId],
    references: [entityRelations.id],
  }),
}));

export const rollupFieldsRelations = relations(rollupFields, ({ one }) => ({
  creator: one(users, {
    fields: [rollupFields.createdBy],
    references: [users.id],
  }),
}));
*/

// ============================================================================
// HELPER TYPES FOR APPLICATION CODE
// ============================================================================

/**
 * Type for resolving polymorphic entity relations
 * Use this in your application code to handle source/target entities
 */
export type EntityType = "project" | "block" | "section" | "task" | "subtask";

export interface ResolvedEntityRelation {
  id: number;
  sourceType: EntityType;
  sourceId: number;
  sourceEntity?: unknown; // Resolved entity object
  targetType: EntityType;
  targetId: number;
  targetEntity?: unknown; // Resolved entity object
  relationType: string;
  isBidirectional: boolean;
  reverseRelationType?: string;
  metadata?: {
    label?: string;
    color?: string;
    notes?: string;
    strength?: number;
  };
}

/**
 * Helper function to resolve entity by type and id
 * Implement this in your db.ts or a separate resolver file
 */
/*
export async function resolveEntity(
  db: Database,
  entityType: EntityType,
  entityId: number
): Promise<unknown> {
  switch (entityType) {
    case "project":
      return db.query.projects.findFirst({ where: eq(projects.id, entityId) });
    case "block":
      return db.query.blocks.findFirst({ where: eq(blocks.id, entityId) });
    case "section":
      return db.query.sections.findFirst({ where: eq(sections.id, entityId) });
    case "task":
      return db.query.tasks.findFirst({ where: eq(tasks.id, entityId) });
    case "subtask":
      return db.query.subtasks.findFirst({ where: eq(subtasks.id, entityId) });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}
*/

// ============================================================================
// QUERY EXAMPLES
// ============================================================================

/*
Example queries using the new relations:

// 1. Get all tags for a task with creator info
const taskWithTags = await db.query.tasks.findFirst({
  where: eq(tasks.id, taskId),
  with: {
    taskTags: {
      with: {
        tag: true,
        addedByUser: {
          columns: { id: true, name: true, avatar: true }
        }
      }
    }
  }
});

// 2. Get all view configs for a project with kanban columns
const projectViews = await db.query.viewConfigs.findMany({
  where: eq(viewConfigs.projectId, projectId),
  with: {
    owner: {
      columns: { id: true, name: true }
    },
    kanbanColumns: {
      orderBy: [asc(kanbanColumns.sortOrder)]
    }
  }
});

// 3. Get entity relations for a task (as source)
const taskRelations = await db.query.entityRelations.findMany({
  where: and(
    eq(entityRelations.sourceType, "task"),
    eq(entityRelations.sourceId, taskId)
  ),
  with: {
    creator: {
      columns: { id: true, name: true }
    }
  }
});

// 4. Get all tags for a project including global tags
const projectTags = await db.query.tags.findMany({
  where: or(
    eq(tags.projectId, projectId),
    isNull(tags.projectId) // Global tags
  ),
  orderBy: [desc(tags.usageCount)]
});

// 5. Get lookup fields for a task type
const taskLookupFields = await db.query.lookupFields.findMany({
  where: eq(lookupFields.entityType, "task"),
  with: {
    creator: true,
    relation: true
  }
});

// 6. Get rollup fields with cached values
const rollupFieldsWithCache = await db.query.rollupFields.findMany({
  where: and(
    eq(rollupFields.entityType, "project"),
    eq(rollupFields.entityId, projectId)
  )
});
*/
