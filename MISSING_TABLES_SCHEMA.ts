/**
 * MYDON Roadmap Hub - Missing Database Tables Schema
 * 
 * This file contains Drizzle ORM schema definitions for tables that need to be added
 * to enable Notion-style relational features, multiple views, and enhanced task organization.
 * 
 * To implement: Copy these definitions to drizzle/schema.ts and run `pnpm db:push`
 * 
 * @author Manus AI
 * @date February 6, 2026
 */

import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// Import existing tables for foreign key references
// import { users, projects, blocks, sections, tasks } from "./schema";

// ============================================================================
// 1. TAGS SYSTEM
// ============================================================================

/**
 * Tag definitions - reusable labels for categorizing tasks
 * Supports project-scoped and global tags with various types
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope - null projectId means global tag available to all projects
  projectId: int("projectId"), // References projects.id
  userId: int("userId").notNull(), // Creator - references users.id
  
  // Tag identity
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 32 }).notNull().default("#6366f1"),
  icon: varchar("icon", { length: 64 }), // Lucide icon name
  description: text("description"),
  
  // Tag type for different use cases
  tagType: mysqlEnum("tagType", [
    "label",      // Simple label (default)
    "category",   // Category grouping
    "status",     // Custom status beyond standard
    "sprint",     // Sprint/iteration marker
    "epic",       // Epic/feature grouping
    "component",  // System component (Frontend, Backend, etc.)
    "custom"      // User-defined type
  ]).default("label"),
  
  // Usage tracking
  usageCount: int("usageCount").default(0),
  
  // Visibility
  isArchived: boolean("isArchived").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("tags_project_idx").on(table.projectId),
  userIdx: index("tags_user_idx").on(table.userId),
  nameIdx: index("tags_name_idx").on(table.name),
  typeIdx: index("tags_type_idx").on(table.tagType),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Task-Tag junction table - many-to-many relationship
 * Enables flexible task categorization with multiple tags
 */
export const taskTags = mysqlTable("task_tags", {
  id: int("id").autoincrement().primaryKey(),
  
  taskId: int("taskId").notNull(), // References tasks.id
  tagId: int("tagId").notNull(), // References tags.id
  
  // Who added this tag to the task
  addedBy: int("addedBy").notNull(), // References users.id
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("tt_task_idx").on(table.taskId),
  tagIdx: index("tt_tag_idx").on(table.tagId),
  uniqueTaskTag: uniqueIndex("tt_unique_idx").on(table.taskId, table.tagId),
}));

export type TaskTag = typeof taskTags.$inferSelect;
export type InsertTaskTag = typeof taskTags.$inferInsert;

// ============================================================================
// 2. ENTITY RELATIONS (Notion-style linking)
// ============================================================================

/**
 * Entity Relations - bidirectional relationships between any entities
 * Enables Notion-style linked databases and cross-entity references
 */
export const entityRelations = mysqlTable("entity_relations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source entity (the entity that "owns" this relation)
  sourceType: mysqlEnum("sourceType", [
    "project", "block", "section", "task", "subtask"
  ]).notNull(),
  sourceId: int("sourceId").notNull(),
  
  // Target entity (the entity being linked to)
  targetType: mysqlEnum("targetType", [
    "project", "block", "section", "task", "subtask"
  ]).notNull(),
  targetId: int("targetId").notNull(),
  
  // Type of relationship
  relationType: mysqlEnum("relationType", [
    "parent_child",      // Hierarchical relationship
    "blocks",            // Task blocks another task
    "blocked_by",        // Reverse of blocks
    "related_to",        // Generic bidirectional relation
    "duplicate_of",      // Duplicate detection
    "depends_on",        // Dependency (extends taskDependencies)
    "required_by",       // Reverse of depends_on
    "subtask_of",        // Subtask relationship
    "linked",            // Simple link without hierarchy
    "cloned_from",       // Task was cloned from another
    "moved_from"         // Task was moved from another location
  ]).notNull(),
  
  // Bidirectional support
  isBidirectional: boolean("isBidirectional").default(true),
  reverseRelationType: varchar("reverseRelationType", { length: 50 }),
  
  // User who created the relation
  createdBy: int("createdBy").notNull(), // References users.id
  
  // Optional metadata
  metadata: json("metadata").$type<{
    label?: string;        // Custom label for this relation
    color?: string;        // Visual indicator color
    notes?: string;        // Additional notes
    strength?: number;     // Relation strength (1-10) for AI weighting
  }>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceIdx: index("er_source_idx").on(table.sourceType, table.sourceId),
  targetIdx: index("er_target_idx").on(table.targetType, table.targetId),
  relationTypeIdx: index("er_relation_type_idx").on(table.relationType),
  createdByIdx: index("er_created_by_idx").on(table.createdBy),
}));

export type EntityRelation = typeof entityRelations.$inferSelect;
export type InsertEntityRelation = typeof entityRelations.$inferInsert;

// ============================================================================
// 3. VIEW CONFIGURATIONS
// ============================================================================

/**
 * View filter type for JSON column
 */
type ViewFilter = {
  id: string;
  field: string;
  operator: 
    | "equals" | "not_equals" 
    | "contains" | "not_contains"
    | "starts_with" | "ends_with"
    | "gt" | "lt" | "gte" | "lte"
    | "is_empty" | "is_not_empty"
    | "is_before" | "is_after" | "is_between"
    | "in" | "not_in";
  value: unknown;
  conjunction: "and" | "or";
};

/**
 * View column configuration type
 */
type ViewColumn = {
  id: string;
  field: string;
  width?: number;
  isVisible: boolean;
  sortOrder: number;
  wrap?: boolean;
};

/**
 * View sort configuration type
 */
type ViewSort = {
  field: string;
  direction: "asc" | "desc";
};

/**
 * View Configs - user-defined view configurations for displaying project data
 * Supports multiple view types: Table, Kanban, Calendar, Gallery, Timeline
 */
export const viewConfigs = mysqlTable("view_configs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope
  projectId: int("projectId").notNull(), // References projects.id
  userId: int("userId").notNull(), // Owner - references users.id
  
  // View identity
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 64 }).default("table"),
  color: varchar("color", { length: 32 }),
  description: text("description"),
  
  // View type
  viewType: mysqlEnum("viewType", [
    "table",      // Spreadsheet-like table view
    "kanban",     // Kanban board with columns
    "calendar",   // Calendar view by date
    "gallery",    // Card gallery with images
    "timeline",   // Gantt/timeline view
    "list",       // Simple list view
    "board"       // Generic board layout
  ]).notNull(),
  
  // Data scope
  scope: mysqlEnum("scope", [
    "project",    // All tasks in project
    "block",      // Tasks in specific block
    "section",    // Tasks in specific section
    "filtered"    // Custom filter only
  ]).default("project"),
  scopeId: int("scopeId"), // blockId or sectionId if scope is block/section
  
  // Column configuration (for table view)
  columns: json("columns").$type<ViewColumn[]>(),
  
  // Filters
  filters: json("filters").$type<ViewFilter[]>(),
  
  // Sorting
  sorts: json("sorts").$type<ViewSort[]>(),
  
  // Grouping (for kanban/board views)
  groupBy: varchar("groupBy", { length: 100 }), // Field to group by: status, priority, assignee, tag
  subGroupBy: varchar("subGroupBy", { length: 100 }), // Secondary grouping
  
  // Calendar-specific options
  calendarDateField: varchar("calendarDateField", { length: 100 }), // deadline, startDate, createdAt
  calendarShowWeekends: boolean("calendarShowWeekends").default(true),
  
  // Gallery-specific options
  galleryCoverField: varchar("galleryCoverField", { length: 100 }), // Field for cover image
  galleryCardSize: mysqlEnum("galleryCardSize", ["small", "medium", "large"]).default("medium"),
  galleryShowDescription: boolean("galleryShowDescription").default(true),
  
  // Timeline-specific options
  timelineStartField: varchar("timelineStartField", { length: 100 }).default("startDate"),
  timelineEndField: varchar("timelineEndField", { length: 100 }).default("deadline"),
  timelineShowDependencies: boolean("timelineShowDependencies").default(true),
  
  // Layout options
  showCompletedTasks: boolean("showCompletedTasks").default(true),
  showSubtasks: boolean("showSubtasks").default(false),
  showEmptyGroups: boolean("showEmptyGroups").default(true),
  collapsedGroups: json("collapsedGroups").$type<string[]>(),
  
  // Row height for table view
  rowHeight: mysqlEnum("rowHeight", ["compact", "normal", "comfortable"]).default("normal"),
  
  // Sharing
  isShared: boolean("isShared").default(false), // Shared with team members
  isDefault: boolean("isDefault").default(false), // Default view for this project
  isLocked: boolean("isLocked").default(false), // Prevent modifications
  
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectUserIdx: index("vc_project_user_idx").on(table.projectId, table.userId),
  viewTypeIdx: index("vc_view_type_idx").on(table.viewType),
  isDefaultIdx: index("vc_is_default_idx").on(table.isDefault),
}));

export type ViewConfig = typeof viewConfigs.$inferSelect;
export type InsertViewConfig = typeof viewConfigs.$inferInsert;

// ============================================================================
// 4. KANBAN COLUMNS
// ============================================================================

/**
 * Auto-action configuration type for Kanban columns
 */
type KanbanAutoAction = {
  setStatus?: string;
  setPriority?: string;
  setAssignee?: number;
  addTag?: number;
  removeTag?: number;
  notify?: number[]; // User IDs to notify
  setDeadline?: {
    type: "relative" | "absolute";
    value: number | string; // Days from now or ISO date
  };
};

/**
 * Kanban Columns - custom column configurations for Kanban boards
 * Allows custom columns based on any field with WIP limits and auto-actions
 */
export const kanbanColumns = mysqlTable("kanban_columns", {
  id: int("id").autoincrement().primaryKey(),
  
  // Parent view config
  viewConfigId: int("viewConfigId").notNull(), // References viewConfigs.id
  
  // Column identity
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 32 }),
  icon: varchar("icon", { length: 64 }),
  description: text("description"),
  
  // Column type - what determines which tasks appear here
  columnType: mysqlEnum("columnType", [
    "status",     // Based on task status field
    "priority",   // Based on priority field
    "assignee",   // Based on assignee field
    "tag",        // Based on specific tag
    "custom"      // Custom filter conditions
  ]).notNull(),
  
  // Value mapping - what tasks go in this column
  matchValue: varchar("matchValue", { length: 255 }), // e.g., "in_progress", "high", userId
  matchField: varchar("matchField", { length: 100 }), // Field to match against
  
  // For custom columns - complex filter conditions
  customFilter: json("customFilter").$type<ViewFilter[]>(),
  
  // WIP (Work In Progress) limits
  taskLimit: int("taskLimit"), // Max tasks allowed in column (null = unlimited)
  showLimitWarning: boolean("showLimitWarning").default(true),
  limitWarningThreshold: int("limitWarningThreshold").default(80), // Percentage to show warning
  
  // Column behavior
  isCollapsed: boolean("isCollapsed").default(false),
  isHidden: boolean("isHidden").default(false),
  allowDrop: boolean("allowDrop").default(true), // Can tasks be dropped here?
  
  // Auto-actions when task enters this column
  autoActions: json("autoActions").$type<KanbanAutoAction>(),
  
  // Default values for new tasks created in this column
  defaultValues: json("defaultValues").$type<{
    status?: string;
    priority?: string;
    assigneeId?: number;
    tags?: number[];
  }>(),
  
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  viewConfigIdx: index("kc_view_config_idx").on(table.viewConfigId),
  columnTypeIdx: index("kc_column_type_idx").on(table.columnType),
}));

export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type InsertKanbanColumn = typeof kanbanColumns.$inferInsert;

// ============================================================================
// 5. LOOKUP FIELDS
// ============================================================================

/**
 * Lookup Fields - pull data from related entities
 * Displays properties from linked entities (e.g., show blocker's status)
 */
export const lookupFields = mysqlTable("lookup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  // Owner entity (where the lookup field is displayed)
  entityType: mysqlEnum("entityType", [
    "project", "block", "section", "task"
  ]).notNull(),
  entityId: int("entityId"), // null = template for all entities of this type
  
  // Field configuration
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  
  // Source relation - which relation to look up from
  relationId: int("relationId"), // Specific relation ID
  relationType: varchar("relationType", { length: 50 }), // Or match by relation type
  
  // Property to look up from related entity
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  // Examples: "title", "status", "priority", "assigneeId", "deadline", "progress", "description"
  
  // Display format
  displayFormat: mysqlEnum("displayFormat", [
    "text",           // Plain text
    "badge",          // Colored badge
    "avatar",         // User avatar
    "date",           // Formatted date
    "datetime",       // Formatted datetime
    "progress_bar",   // Progress bar
    "link",           // Clickable link
    "list",           // Bulleted list
    "number",         // Formatted number
    "currency",       // Currency format
    "percentage"      // Percentage format
  ]).default("text"),
  
  // Aggregation for multiple relations
  aggregation: mysqlEnum("aggregation", [
    "first",          // Show first related item
    "last",           // Show last related item
    "all",            // Show all as list
    "count",          // Count of related items
    "comma_list",     // Comma-separated list
    "unique"          // Unique values only
  ]).default("first"),
  
  // Formatting options
  formatOptions: json("formatOptions").$type<{
    dateFormat?: string;      // e.g., "MMM dd, yyyy"
    numberFormat?: string;    // e.g., "0,0.00"
    prefix?: string;          // e.g., "$"
    suffix?: string;          // e.g., "%"
    maxItems?: number;        // Max items to show in list
    emptyText?: string;       // Text when no value
  }>(),
  
  // Visibility
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  
  // Creator
  createdBy: int("createdBy").notNull(), // References users.id
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("lf_entity_idx").on(table.entityType, table.entityId),
  relationTypeIdx: index("lf_relation_type_idx").on(table.relationType),
}));

export type LookupField = typeof lookupFields.$inferSelect;
export type InsertLookupField = typeof lookupFields.$inferInsert;

// ============================================================================
// 6. ROLLUP FIELDS
// ============================================================================

/**
 * Filter condition type for rollup calculations
 */
type RollupFilterCondition = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty";
  value: string | number | boolean | null;
};

/**
 * Rollup Fields - aggregate calculations from related entities
 * Computes sum, average, count, etc. across all related entities
 */
export const rollupFields = mysqlTable("rollup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  // Owner entity
  entityType: mysqlEnum("entityType", [
    "project", "block", "section", "task"
  ]).notNull(),
  entityId: int("entityId"), // null = template for all entities of this type
  
  // Field configuration
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  
  // Source configuration
  sourceRelationType: varchar("sourceRelationType", { length: 50 }).notNull(),
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  
  // Aggregation function
  aggregationFunction: mysqlEnum("aggregationFunction", [
    // Count functions
    "count",              // Count of related items
    "count_values",       // Count non-empty values
    "count_unique",       // Count unique values
    "count_checked",      // Count checked/completed items
    "count_unchecked",    // Count unchecked/incomplete items
    
    // Numeric functions
    "sum",                // Sum numeric values
    "average",            // Average numeric values
    "median",             // Median numeric value
    "min",                // Minimum value
    "max",                // Maximum value
    "range",              // Max - Min
    
    // Percentage functions
    "percent_empty",      // Percentage of empty values
    "percent_not_empty",  // Percentage of non-empty values
    "percent_checked",    // Percentage of checked items
    "percent_unchecked",  // Percentage of unchecked items
    
    // Date functions
    "earliest_date",      // Earliest date
    "latest_date",        // Latest date
    "date_range_days",    // Days between earliest and latest
    
    // Text functions
    "show_original",      // Show all values (no aggregation)
    "concatenate"         // Concatenate all values
  ]).notNull(),
  
  // Filter conditions (optional) - only include items matching these conditions
  filterConditions: json("filterConditions").$type<RollupFilterCondition[]>(),
  
  // Display format
  displayFormat: mysqlEnum("displayFormat", [
    "number",
    "percentage",
    "currency",
    "duration",
    "date",
    "progress_bar",
    "text",
    "fraction"            // e.g., "5/10"
  ]).default("number"),
  
  // Formatting options
  decimalPlaces: int("decimalPlaces").default(0),
  prefix: varchar("prefix", { length: 20 }),  // e.g., "$", "€"
  suffix: varchar("suffix", { length: 20 }),  // e.g., "%", "hrs", "tasks"
  
  // Progress bar specific
  progressBarMax: int("progressBarMax"), // Max value for progress bar
  progressBarColor: varchar("progressBarColor", { length: 32 }),
  
  // Caching for performance
  cachedValue: text("cachedValue"),
  lastCalculatedAt: timestamp("lastCalculatedAt"),
  cacheExpiresAt: timestamp("cacheExpiresAt"),
  
  // Visibility
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  
  // Creator
  createdBy: int("createdBy").notNull(), // References users.id
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("rf_entity_idx").on(table.entityType, table.entityId),
  sourceRelationIdx: index("rf_source_relation_idx").on(table.sourceRelationType),
}));

export type RollupField = typeof rollupFields.$inferSelect;
export type InsertRollupField = typeof rollupFields.$inferInsert;

// ============================================================================
// RELATIONS (for drizzle/relations.ts)
// ============================================================================

/*
Add these relations to drizzle/relations.ts:

import { relations } from "drizzle-orm";
import { 
  tags, taskTags, entityRelations, viewConfigs, 
  kanbanColumns, lookupFields, rollupFields,
  users, projects, tasks 
} from "./schema";

// Tags relations
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

// Entity relations
export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  creator: one(users, {
    fields: [entityRelations.createdBy],
    references: [users.id],
  }),
}));

// View configs relations
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

// Kanban columns relations
export const kanbanColumnsRelations = relations(kanbanColumns, ({ one }) => ({
  viewConfig: one(viewConfigs, {
    fields: [kanbanColumns.viewConfigId],
    references: [viewConfigs.id],
  }),
}));

// Lookup fields relations
export const lookupFieldsRelations = relations(lookupFields, ({ one }) => ({
  creator: one(users, {
    fields: [lookupFields.createdBy],
    references: [users.id],
  }),
}));

// Rollup fields relations
export const rollupFieldsRelations = relations(rollupFields, ({ one }) => ({
  creator: one(users, {
    fields: [rollupFields.createdBy],
    references: [users.id],
  }),
}));
*/

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
Example: Creating a Kanban view with custom columns

// 1. Create view config
const viewConfig = await db.insert(viewConfigs).values({
  projectId: 1,
  userId: 1,
  name: "Sprint Board",
  viewType: "kanban",
  groupBy: "status",
});

// 2. Create custom columns
await db.insert(kanbanColumns).values([
  {
    viewConfigId: viewConfig.insertId,
    name: "Backlog",
    columnType: "status",
    matchValue: "backlog",
    color: "#6b7280",
    sortOrder: 0,
  },
  {
    viewConfigId: viewConfig.insertId,
    name: "In Progress",
    columnType: "status",
    matchValue: "in_progress",
    color: "#3b82f6",
    taskLimit: 5, // WIP limit
    sortOrder: 1,
    autoActions: {
      notify: [1, 2], // Notify team leads
    },
  },
  {
    viewConfigId: viewConfig.insertId,
    name: "Done",
    columnType: "status",
    matchValue: "completed",
    color: "#22c55e",
    sortOrder: 2,
  },
]);

// 3. Create tags
await db.insert(tags).values([
  { projectId: 1, userId: 1, name: "Bug", color: "#ef4444", tagType: "label" },
  { projectId: 1, userId: 1, name: "Feature", color: "#3b82f6", tagType: "label" },
  { projectId: 1, userId: 1, name: "Sprint 1", color: "#8b5cf6", tagType: "sprint" },
]);

// 4. Tag a task
await db.insert(taskTags).values({
  taskId: 1,
  tagId: 1, // Bug tag
  addedBy: 1,
});

// 5. Create entity relation
await db.insert(entityRelations).values({
  sourceType: "task",
  sourceId: 1,
  targetType: "task",
  targetId: 2,
  relationType: "blocks",
  isBidirectional: true,
  reverseRelationType: "blocked_by",
  createdBy: 1,
});

// 6. Create lookup field to show blocker status
await db.insert(lookupFields).values({
  entityType: "task",
  name: "blocker_status",
  displayName: "Blocker Status",
  relationType: "blocked_by",
  sourceProperty: "status",
  displayFormat: "badge",
  createdBy: 1,
});

// 7. Create rollup field to count subtasks
await db.insert(rollupFields).values({
  entityType: "task",
  name: "subtask_progress",
  displayName: "Subtask Progress",
  sourceRelationType: "subtask_of",
  sourceProperty: "status",
  aggregationFunction: "percent_checked",
  displayFormat: "progress_bar",
  createdBy: 1,
});
*/
