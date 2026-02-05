import { relations } from "drizzle-orm";
import { 
  users, 
  projects,
  tasks,
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

// AI Requests relations
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

// AI Sessions relations
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

// AI Usage Stats relations
export const aiUsageStatsRelations = relations(aiUsageStats, ({ one }) => ({
  user: one(users, {
    fields: [aiUsageStats.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// RELATIONS SYSTEM
// ============================================================================

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

// TaskTags relations (junction table)
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

// Entity Relations relations
export const entityRelationsRelations = relations(entityRelations, ({ one }) => ({
  creator: one(users, {
    fields: [entityRelations.createdBy],
    references: [users.id],
  }),
}));

// View Configs relations
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

// Kanban Columns relations
export const kanbanColumnsRelations = relations(kanbanColumns, ({ one }) => ({
  viewConfig: one(viewConfigs, {
    fields: [kanbanColumns.viewConfigId],
    references: [viewConfigs.id],
  }),
}));

// Lookup Fields relations
export const lookupFieldsRelations = relations(lookupFields, ({ one }) => ({
  creator: one(users, {
    fields: [lookupFields.createdBy],
    references: [users.id],
  }),
}));

// Rollup Fields relations
export const rollupFieldsRelations = relations(rollupFields, ({ one }) => ({
  creator: one(users, {
    fields: [rollupFields.createdBy],
    references: [users.id],
  }),
}));

// Extended user relations for new tables
export const usersRelationsExtended = relations(users, ({ many }) => ({
  createdTags: many(tags),
  addedTaskTags: many(taskTags),
  createdEntityRelations: many(entityRelations),
  viewConfigs: many(viewConfigs),
  lookupFields: many(lookupFields),
  rollupFields: many(rollupFields),
}));

// Extended project relations for new tables
export const projectsRelationsExtended = relations(projects, ({ many }) => ({
  tags: many(tags),
  viewConfigs: many(viewConfigs),
}));

// Extended task relations for tags
export const tasksRelationsExtended = relations(tasks, ({ many }) => ({
  taskTags: many(taskTags),
}));
