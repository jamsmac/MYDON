# Missing Database Tables Report

**Project:** MYDON Roadmap Hub  
**Author:** Manus AI  
**Date:** February 6, 2026

---

## Executive Summary

This report provides a comprehensive analysis of the database tables that are currently missing from the MYDON Roadmap Hub project. These tables would enable Notion-style relational database features, multiple view configurations, and enhanced task organization capabilities. The report includes detailed schema definitions, use cases, implementation priorities, and migration strategies for each missing table.

---

## 1. Entity Relations Table

### 1.1 Purpose

The `entity_relations` table enables Notion-style bidirectional relationships between different entities (tasks, projects, blocks, sections). This allows users to create linked databases where changes in one entity automatically reflect in related entities.

### 1.2 Schema Definition

```typescript
export const entityRelations = mysqlTable("entity_relations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source entity
  sourceType: mysqlEnum("sourceType", ["project", "block", "section", "task", "subtask"]).notNull(),
  sourceId: int("sourceId").notNull(),
  
  // Target entity
  targetType: mysqlEnum("targetType", ["project", "block", "section", "task", "subtask"]).notNull(),
  targetId: int("targetId").notNull(),
  
  // Relation metadata
  relationType: mysqlEnum("relationType", [
    "parent_child",      // Hierarchical relationship
    "blocks",            // Task blocks another task
    "related_to",        // Generic relation
    "duplicate_of",      // Duplicate detection
    "depends_on",        // Dependency (extends taskDependencies)
    "subtask_of",        // Subtask relationship
    "linked"             // Simple link without hierarchy
  ]).notNull(),
  
  // Bidirectional support
  isBidirectional: boolean("isBidirectional").default(true),
  reverseRelationType: varchar("reverseRelationType", { length: 50 }),
  
  // User who created the relation
  createdBy: int("createdBy").notNull(),
  
  // Metadata
  metadata: json("metadata").$type<{
    label?: string;
    color?: string;
    notes?: string;
  }>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sourceIdx: index("er_source_idx").on(table.sourceType, table.sourceId),
  targetIdx: index("er_target_idx").on(table.targetType, table.targetId),
  relationTypeIdx: index("er_relation_type_idx").on(table.relationType),
}));
```

### 1.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Task Linking | Link related tasks across different projects or sections |
| Duplicate Detection | Mark tasks as duplicates to avoid redundant work |
| Cross-Project Dependencies | Create dependencies between tasks in different projects |
| Parent-Child Hierarchies | Build complex task hierarchies beyond subtasks |
| Knowledge Graph | Build a network of related items for AI context |

### 1.4 Implementation Priority

**Priority: HIGH** — This table is foundational for implementing Notion-style relational features and would significantly enhance the project management capabilities.

---

## 2. Lookup Fields Table

### 2.1 Purpose

The `lookup_fields` table stores configuration for lookup fields that pull data from related entities. When a task is linked to another task via `entity_relations`, lookup fields can automatically display properties from the linked task (e.g., show the assignee of a blocking task).

### 2.2 Schema Definition

```typescript
export const lookupFields = mysqlTable("lookup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  // Owner entity (where the lookup field is displayed)
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task"]).notNull(),
  entityId: int("entityId"), // null = applies to all entities of this type
  
  // Field configuration
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  
  // Source relation
  relationId: int("relationId"), // Links to entity_relations or relation type
  relationType: varchar("relationType", { length: 50 }), // Alternative: match by type
  
  // Property to look up from related entity
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  // Examples: "title", "status", "priority", "assigneeId", "deadline", "progress"
  
  // Display options
  displayFormat: mysqlEnum("displayFormat", [
    "text",
    "badge",
    "avatar",
    "date",
    "progress_bar",
    "link",
    "list"
  ]).default("text"),
  
  // Aggregation for multiple relations
  aggregation: mysqlEnum("aggregation", [
    "first",       // Show first related item
    "last",        // Show last related item
    "all",         // Show all as list
    "count",       // Count of related items
    "comma_list"   // Comma-separated list
  ]).default("first"),
  
  // Visibility
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  
  // Creator
  createdBy: int("createdBy").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("lf_entity_idx").on(table.entityType, table.entityId),
}));
```

### 2.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Show Blocker Status | Display the status of blocking tasks directly on the blocked task |
| Display Assignee Chain | Show who is assigned to dependent tasks |
| Cross-Reference Deadlines | View deadlines of related tasks without navigating away |
| Project Rollup Preview | Show key metrics from linked projects |

### 2.4 Implementation Priority

**Priority: MEDIUM** — Depends on `entity_relations` being implemented first. Provides significant UX improvement for complex project structures.

---

## 3. Rollup Fields Table

### 3.1 Purpose

The `rollup_fields` table stores configuration for rollup calculations that aggregate data from related entities. Unlike lookup fields that display individual values, rollup fields compute aggregates (sum, average, count, etc.) across all related entities.

### 3.2 Schema Definition

```typescript
export const rollupFields = mysqlTable("rollup_fields", {
  id: int("id").autoincrement().primaryKey(),
  
  // Owner entity
  entityType: mysqlEnum("entityType", ["project", "block", "section", "task"]).notNull(),
  entityId: int("entityId"), // null = template for all entities of this type
  
  // Field configuration
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  
  // Source configuration
  sourceRelationType: varchar("sourceRelationType", { length: 50 }).notNull(),
  sourceProperty: varchar("sourceProperty", { length: 100 }).notNull(),
  
  // Aggregation function
  aggregationFunction: mysqlEnum("aggregationFunction", [
    "count",              // Count of related items
    "count_values",       // Count non-empty values
    "count_unique",       // Count unique values
    "sum",                // Sum numeric values
    "average",            // Average numeric values
    "median",             // Median numeric value
    "min",                // Minimum value
    "max",                // Maximum value
    "range",              // Max - Min
    "percent_empty",      // Percentage of empty values
    "percent_not_empty",  // Percentage of non-empty values
    "percent_checked",    // For boolean fields
    "earliest_date",      // Earliest date
    "latest_date",        // Latest date
    "date_range",         // Days between earliest and latest
    "show_original"       // Show all values (no aggregation)
  ]).notNull(),
  
  // Filter conditions (optional)
  filterConditions: json("filterConditions").$type<{
    field: string;
    operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty";
    value: string | number | boolean | null;
  }[]>(),
  
  // Display options
  displayFormat: mysqlEnum("displayFormat", [
    "number",
    "percentage",
    "currency",
    "duration",
    "date",
    "progress_bar",
    "text"
  ]).default("number"),
  
  decimalPlaces: int("decimalPlaces").default(0),
  prefix: varchar("prefix", { length: 20 }),  // e.g., "$", "€"
  suffix: varchar("suffix", { length: 20 }),  // e.g., "%", "hrs"
  
  // Caching
  cachedValue: text("cachedValue"),
  lastCalculatedAt: timestamp("lastCalculatedAt"),
  
  // Visibility
  isVisible: boolean("isVisible").default(true),
  sortOrder: int("sortOrder").default(0),
  
  createdBy: int("createdBy").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("rf_entity_idx").on(table.entityType, table.entityId),
}));
```

### 3.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Total Time Estimate | Sum estimated hours across all subtasks |
| Completion Percentage | Calculate % of completed tasks in a section |
| Average Priority | Show average priority of tasks in a block |
| Budget Tracking | Sum costs across related tasks |
| Team Workload | Count tasks assigned to each team member |
| Deadline Analysis | Find earliest/latest deadlines in a group |

### 3.4 Implementation Priority

**Priority: MEDIUM** — Depends on `entity_relations`. Provides powerful analytics capabilities at the entity level.

---

## 4. View Configs Table

### 4.1 Purpose

The `view_configs` table stores user-defined view configurations for displaying project data in different formats (Table, Kanban, Calendar, Gallery, Timeline). Each user can have multiple saved views with custom filters, sorts, and groupings.

### 4.2 Schema Definition

```typescript
export const viewConfigs = mysqlTable("view_configs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),  // Owner of this view config
  
  // View identity
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 64 }).default("table"),
  color: varchar("color", { length: 32 }),
  
  // View type
  viewType: mysqlEnum("viewType", [
    "table",      // Spreadsheet-like table
    "kanban",     // Kanban board
    "calendar",   // Calendar view
    "gallery",    // Card gallery
    "timeline",   // Gantt/timeline
    "list",       // Simple list
    "board"       // Generic board
  ]).notNull(),
  
  // Scope of data
  scope: mysqlEnum("scope", [
    "project",    // All tasks in project
    "block",      // Tasks in specific block
    "section",    // Tasks in specific section
    "filtered"    // Custom filter
  ]).default("project"),
  scopeId: int("scopeId"),  // blockId or sectionId if scope is block/section
  
  // Column configuration (for table/kanban)
  columns: json("columns").$type<ViewColumn[]>(),
  
  // Filters
  filters: json("filters").$type<ViewFilter[]>(),
  
  // Sorting
  sorts: json("sorts").$type<ViewSort[]>(),
  
  // Grouping (for kanban/board)
  groupBy: varchar("groupBy", { length: 100 }),  // Field to group by
  subGroupBy: varchar("subGroupBy", { length: 100 }),
  
  // Calendar-specific
  calendarDateField: varchar("calendarDateField", { length: 100 }),  // deadline, startDate, createdAt
  
  // Gallery-specific
  galleryCoverField: varchar("galleryCoverField", { length: 100 }),
  galleryCardSize: mysqlEnum("galleryCardSize", ["small", "medium", "large"]).default("medium"),
  
  // Layout options
  showCompletedTasks: boolean("showCompletedTasks").default(true),
  showSubtasks: boolean("showSubtasks").default(false),
  collapsedGroups: json("collapsedGroups").$type<string[]>(),
  
  // Sharing
  isShared: boolean("isShared").default(false),  // Shared with team
  isDefault: boolean("isDefault").default(false),  // Default view for this project
  
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectUserIdx: index("vc_project_user_idx").on(table.projectId, table.userId),
  viewTypeIdx: index("vc_view_type_idx").on(table.viewType),
}));

// Type definitions for JSON fields
type ViewColumn = {
  id: string;
  field: string;
  width?: number;
  isVisible: boolean;
  sortOrder: number;
};

type ViewFilter = {
  id: string;
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | 
            "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty" |
            "is_before" | "is_after" | "is_between";
  value: unknown;
  conjunction: "and" | "or";
};

type ViewSort = {
  field: string;
  direction: "asc" | "desc";
};
```

### 4.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Personal Kanban | Each team member has their own Kanban view filtered to their tasks |
| Sprint Calendar | Calendar view showing only current sprint tasks |
| Overdue Tasks Table | Table view filtered to overdue tasks, sorted by priority |
| Gallery Portfolio | Gallery view of completed projects with cover images |
| Timeline Planning | Gantt view for deadline planning |

### 4.4 Implementation Priority

**Priority: HIGH** — Essential for providing flexible data visualization. Users expect multiple view options in modern project management tools.

---

## 5. Kanban Columns Table

### 5.1 Purpose

The `kanban_columns` table stores custom column configurations for Kanban boards. While the default Kanban uses task status, this table allows users to create custom columns based on any field (priority, assignee, custom tags).

### 5.2 Schema Definition

```typescript
export const kanbanColumns = mysqlTable("kanban_columns", {
  id: int("id").autoincrement().primaryKey(),
  
  // Parent view config
  viewConfigId: int("viewConfigId").notNull(),
  
  // Column identity
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 32 }),
  icon: varchar("icon", { length: 64 }),
  
  // Column type
  columnType: mysqlEnum("columnType", [
    "status",     // Based on task status
    "priority",   // Based on priority
    "assignee",   // Based on assignee
    "tag",        // Based on tag
    "custom"      // Custom filter
  ]).notNull(),
  
  // Value mapping (what tasks go in this column)
  matchValue: varchar("matchValue", { length: 255 }),  // e.g., "in_progress", "high", userId
  matchField: varchar("matchField", { length: 100 }),  // Field to match against
  
  // For custom columns
  customFilter: json("customFilter").$type<ViewFilter[]>(),
  
  // Column limits (WIP limits)
  taskLimit: int("taskLimit"),  // Max tasks allowed in column
  showLimitWarning: boolean("showLimitWarning").default(true),
  
  // Behavior
  isCollapsed: boolean("isCollapsed").default(false),
  isHidden: boolean("isHidden").default(false),
  
  // Auto-actions when task enters column
  autoActions: json("autoActions").$type<{
    setStatus?: string;
    setPriority?: string;
    setAssignee?: number;
    addTag?: string;
    notify?: number[];  // User IDs to notify
  }>(),
  
  sortOrder: int("sortOrder").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  viewConfigIdx: index("kc_view_config_idx").on(table.viewConfigId),
}));
```

### 5.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Status-Based Kanban | Classic To Do → In Progress → Done columns |
| Priority Kanban | Columns for Critical, High, Medium, Low priorities |
| Team Kanban | Columns per team member showing their tasks |
| Custom Workflow | Custom columns like "Needs Review", "Blocked", "Ready for QA" |
| WIP Limits | Limit tasks per column to prevent overload |

### 5.4 Implementation Priority

**Priority: HIGH** — Kanban is one of the most requested features in project management tools. This table enables flexible Kanban configurations.

---

## 6. Task Tags Table

### 6.1 Purpose

The `task_tags` table implements a many-to-many relationship between tasks and tags, enabling flexible task categorization. Tags can be used for filtering, grouping, and organizing tasks across projects.

### 6.2 Schema Definition

```typescript
// Tag definitions
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope
  projectId: int("projectId"),  // null = global tag
  userId: int("userId").notNull(),  // Creator
  
  // Tag identity
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 32 }).notNull(),
  icon: varchar("icon", { length: 64 }),
  description: text("description"),
  
  // Tag type
  tagType: mysqlEnum("tagType", [
    "label",      // Simple label
    "category",   // Category grouping
    "status",     // Custom status
    "sprint",     // Sprint/iteration
    "epic",       // Epic/feature
    "component",  // Component/module
    "custom"      // User-defined
  ]).default("label"),
  
  // Usage stats
  usageCount: int("usageCount").default(0),
  
  // Visibility
  isArchived: boolean("isArchived").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectIdx: index("tags_project_idx").on(table.projectId),
  nameIdx: index("tags_name_idx").on(table.name),
}));

// Junction table for task-tag relationships
export const taskTags = mysqlTable("task_tags", {
  id: int("id").autoincrement().primaryKey(),
  
  taskId: int("taskId").notNull(),
  tagId: int("tagId").notNull(),
  
  // Who added this tag
  addedBy: int("addedBy").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("tt_task_idx").on(table.taskId),
  tagIdx: index("tt_tag_idx").on(table.tagId),
  uniqueTaskTag: index("tt_unique_idx").on(table.taskId, table.tagId),
}));
```

### 6.3 Use Cases

| Use Case | Description |
|----------|-------------|
| Feature Labels | Tag tasks with "Bug", "Feature", "Enhancement" |
| Sprint Planning | Tag tasks with sprint numbers for filtering |
| Component Tracking | Tag tasks by system component (Frontend, Backend, Database) |
| Priority Override | Custom priority tags beyond the standard levels |
| Cross-Project Tags | Global tags that work across all projects |

### 6.4 Implementation Priority

**Priority: HIGH** — Tags are fundamental for task organization and are expected in any project management tool.

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Table | Effort | Dependencies |
|-------|--------|--------------|
| `tags` | 2 days | None |
| `taskTags` | 1 day | `tags` |
| `viewConfigs` | 3 days | None |

### Phase 2: Relations (Week 3-4)

| Table | Effort | Dependencies |
|-------|--------|--------------|
| `entityRelations` | 4 days | None |
| `kanbanColumns` | 2 days | `viewConfigs` |

### Phase 3: Advanced Fields (Week 5-6)

| Table | Effort | Dependencies |
|-------|--------|--------------|
| `lookupFields` | 3 days | `entityRelations` |
| `rollupFields` | 4 days | `entityRelations` |

---

## 8. Migration Strategy

### 8.1 Database Migration

All tables should be added using Drizzle migrations with the following approach:

```bash
# 1. Add table definitions to drizzle/schema.ts
# 2. Generate migration
pnpm db:push

# 3. Verify migration
npx drizzle-kit studio
```

### 8.2 Backward Compatibility

The new tables are additive and do not modify existing tables. Existing functionality will continue to work without changes. New features should be progressively enabled as the corresponding UI components are built.

### 8.3 Data Migration

For existing projects, consider:

1. **Auto-create default view configs** — When users first access a project after the update, create default Table and Kanban views.

2. **Migrate existing dependencies** — Copy data from `taskDependencies` to `entityRelations` with `relationType = 'depends_on'`.

3. **Suggest tags from task titles** — Use AI to suggest initial tags based on existing task titles and descriptions.

---

## 9. Conclusion

Implementing these six missing tables would transform MYDON Roadmap Hub from a traditional project management tool into a flexible, Notion-style workspace. The recommended implementation order prioritizes user-facing features (tags, views, Kanban) before advanced relational features (lookup, rollup).

The total estimated effort is approximately 6 weeks for a single developer, with the foundation phase providing immediate user value through tags and multiple view support.
