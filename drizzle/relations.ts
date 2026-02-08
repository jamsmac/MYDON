import { relations } from "drizzle-orm";
import {
  users,
  projects,
  blocks,
  sections,
  tasks,
  subtasks,
  projectMembers,
  taskComments,
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
// CORE ENTITY RELATIONS
// ============================================================================

// Projects relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  blocks: many(blocks),
  members: many(projectMembers),
  tags: many(tags),
  viewConfigs: many(viewConfigs),
}));

// Blocks relations
export const blocksRelations = relations(blocks, ({ one, many }) => ({
  project: one(projects, {
    fields: [blocks.projectId],
    references: [projects.id],
  }),
  sections: many(sections),
}));

// Sections relations
export const sectionsRelations = relations(sections, ({ one, many }) => ({
  block: one(blocks, {
    fields: [sections.blockId],
    references: [blocks.id],
  }),
  tasks: many(tasks),
}));

// Tasks relations
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  section: one(sections, {
    fields: [tasks.sectionId],
    references: [sections.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
  }),
  subtasks: many(subtasks),
  comments: many(taskComments),
  taskTags: many(taskTags),
}));

// Subtasks relations
export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
}));

// Project Members relations
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [projectMembers.invitedBy],
    references: [users.id],
    relationName: "invitedMembers",
  }),
}));

// Task Comments relations
export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

// Users relations (core)
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  assignedTasks: many(tasks),
  memberships: many(projectMembers),
  comments: many(taskComments),
  createdTags: many(tags),
  addedTaskTags: many(taskTags),
  createdEntityRelations: many(entityRelations),
  viewConfigs: many(viewConfigs),
  lookupFields: many(lookupFields),
  rollupFields: many(rollupFields),
}));

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

// Note: Core relations for users, projects, and tasks are defined above
// and include all relationships including tags, viewConfigs, etc.
