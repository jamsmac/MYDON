/**
 * Saved Views Router - CRUD operations for saved view presets
 * Allows users to save and load filter/sort/group configurations
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";

// Config schema matching SavedViewConfig interface
const savedViewConfigSchema = z.object({
  viewType: z.string().optional(),
  sortField: z.string().nullable().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
  groupBy: z.string().optional(),
  searchQuery: z.string().optional(),
  kanbanFilters: z.object({
    priority: z.string().optional(),
    assignee: z.number().optional(),
    tag: z.number().optional(),
  }).optional(),
  customFieldFilters: z.array(z.object({
    id: z.string(),
    fieldId: z.number(),
    operator: z.string(),
    value: z.string(),
  })).optional(),
  calendarMode: z.enum(["month", "week"]).optional(),
  ganttZoom: z.string().optional(),
});

export const savedViewsRouter = router({
  // Get all saved views for a project
  getByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      return db.getSavedViewsByProject(input.projectId, ctx.user.id);
    }),

  // Create a new saved view
  create: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      name: z.string().min(1).max(100),
      viewType: z.enum(["table", "kanban", "calendar", "gantt", "all"]).default("all"),
      config: savedViewConfigSchema,
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createSavedView({
        projectId: input.projectId,
        userId: ctx.user.id,
        name: input.name,
        viewType: input.viewType,
        config: input.config,
        icon: input.icon || null,
        color: input.color || null,
        isDefault: false,
        sortOrder: 0,
      });
    }),

  // Update a saved view
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      config: savedViewConfigSchema.optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.config !== undefined) updates.config = input.config;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.color !== undefined) updates.color = input.color;
      return db.updateSavedView(input.id, updates);
    }),

  // Delete a saved view
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteSavedView(input.id);
    }),

  // Set default view for a project
  setDefault: protectedProcedure
    .input(z.object({
      id: z.number(), // 0 to clear default
      projectId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.setDefaultSavedView(input.id, input.projectId, ctx.user.id);
    }),
});

export type SavedViewsRouter = typeof savedViewsRouter;
