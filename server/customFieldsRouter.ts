/**
 * Custom Fields Router - CRUD operations for custom fields and values
 * Includes formula evaluation and rollup calculations
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import * as db from "./db";
import { evaluateFormula, evaluateRollup, validateFormula, extractFieldRefs, getAvailableFunctions } from "../shared/lib/formulaEngine";
import type { FormulaContext } from "../shared/lib/formulaEngine";
import {
  checkProjectAccess,
  checkTaskAccess,
  requireAccessOrNotFound,
} from "./utils/authorization";

// Field type enum
const fieldTypeEnum = z.enum([
  "text", "number", "date", "checkbox", "select", "multiselect",
  "url", "email", "formula", "rollup", "currency", "percent", "rating"
]);

// Option schema for select/multiselect
const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

// Rollup config schema
const rollupConfigSchema = z.object({
  sourceField: z.string(),
  aggregation: z.enum(["sum", "avg", "count", "min", "max", "concat"]),
});

// Custom field input schema
const customFieldInputSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1).max(100),
  type: fieldTypeEnum,
  description: z.string().optional(),
  options: z.array(optionSchema).optional(),
  formula: z.string().optional(),
  rollupConfig: rollupConfigSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  sortOrder: z.number().optional(),
  isRequired: z.boolean().optional(),
  showOnCard: z.boolean().optional(),
  showInTable: z.boolean().optional(),
  defaultValue: z.string().optional(),
});

// Value input schema
const valueInputSchema = z.object({
  customFieldId: z.number(),
  taskId: z.number(),
  value: z.string().nullable().optional(),
  numericValue: z.number().nullable().optional(),
  dateValue: z.number().nullable().optional(), // timestamp
  booleanValue: z.boolean().nullable().optional(),
  jsonValue: z.array(z.string()).nullable().optional(),
});

export const customFieldsRouter = router({
  // ============ FIELD CRUD ============
  
  // Get all fields for a project
  getByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId);
      requireAccessOrNotFound(access, "проект");
      return db.getCustomFieldsByProject(input.projectId);
    }),
  
  // Get single field
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getCustomFieldById(input.id);
    }),
  
  // Create field
  create: protectedProcedure
    .input(customFieldInputSchema)
    .mutation(async ({ ctx, input }) => {
      const access = await checkProjectAccess(ctx.user.id, input.projectId, "editor");
      requireAccessOrNotFound(access, "проект");

      // Validate formula if provided
      if (input.type === "formula" && input.formula) {
        const validation = validateFormula(input.formula);
        if (!validation.valid) {
          throw new Error(`Invalid formula: ${validation.error}`);
        }
      }

      return db.createCustomField(input);
    }),
  
  // Update field
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      updates: customFieldInputSchema.partial(),
    }))
    .mutation(async ({ input }) => {
      // Validate formula if provided
      if (input.updates.formula) {
        const validation = validateFormula(input.updates.formula);
        if (!validation.valid) {
          throw new Error(`Invalid formula: ${validation.error}`);
        }
      }
      
      return db.updateCustomField(input.id, input.updates);
    }),
  
  // Delete field
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteCustomField(input.id);
    }),
  
  // Reorder fields
  reorder: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      fieldIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      await db.reorderCustomFields(input.projectId, input.fieldIds);
      return { success: true };
    }),
  
  // ============ VALUES CRUD ============
  
  // Get values for a task
  getValuesByTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      return db.getCustomFieldValuesByTask(input.taskId);
    }),
  
  // Get values for multiple tasks
  getValuesByTasks: protectedProcedure
    .input(z.object({ taskIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      if (input.taskIds.length === 0) return [];
      return db.getCustomFieldValuesByTasks(input.taskIds);
    }),
  
  // Get all values for a project (fields + values grouped by task)
  getValuesForProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return db.getCustomFieldValuesForProject(input.projectId);
    }),
  
  // Set value for a field on a task
  setValue: protectedProcedure
    .input(valueInputSchema)
    .mutation(async ({ input }) => {
      const { customFieldId, taskId, ...valueData } = input;
      
      // Convert dateValue timestamp to Date if provided
      const processedValue: any = { ...valueData };
      if (valueData.dateValue !== undefined && valueData.dateValue !== null) {
        processedValue.dateValue = new Date(valueData.dateValue);
      }
      
      return db.setCustomFieldValue(customFieldId, taskId, processedValue);
    }),
  
  // Bulk set value for a field on multiple tasks
  bulkSetValue: protectedProcedure
    .input(z.object({
      customFieldId: z.number(),
      taskIds: z.array(z.number()).min(1),
      value: z.string().nullable().optional(),
      numericValue: z.number().nullable().optional(),
      dateValue: z.number().nullable().optional(),
      booleanValue: z.boolean().nullable().optional(),
      jsonValue: z.array(z.string()).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { customFieldId, taskIds, ...valueData } = input;
      
      const processedValue: any = { ...valueData };
      if (valueData.dateValue !== undefined && valueData.dateValue !== null) {
        processedValue.dateValue = new Date(valueData.dateValue);
      }
      
      const results = await Promise.all(
        taskIds.map(taskId => db.setCustomFieldValue(customFieldId, taskId, processedValue))
      );
      
      return { updated: results.length };
    }),
  
  // Delete value
  deleteValue: protectedProcedure
    .input(z.object({
      customFieldId: z.number(),
      taskId: z.number(),
    }))
    .mutation(async ({ input }) => {
      return db.deleteCustomFieldValue(input.customFieldId, input.taskId);
    }),
  
  // ============ FORMULA EVALUATION ============
  
  // Evaluate a formula for a task
  evaluateFormula: protectedProcedure
    .input(z.object({
      formula: z.string(),
      taskId: z.number(),
      projectId: z.number(),
    }))
    .query(async ({ input }) => {
      // Get task data
      const task = await db.getTaskById(input.taskId);
      if (!task) {
        return { success: false, error: "Task not found", errorCode: "#REF!" as const };
      }
      
      // Get custom field values for this task
      const values = await db.getCustomFieldValuesByTask(input.taskId);
      const fields = await db.getCustomFieldsByProject(input.projectId);
      
      // Build field values map
      const fieldValues: Record<string, string | number | boolean | null> = {};
      for (const field of fields) {
        const value = values.find(v => v.customFieldId === field.id);
        if (value) {
          switch (field.type) {
            case "number":
            case "currency":
            case "percent":
            case "rating":
              fieldValues[field.name] = value.numericValue ? parseFloat(value.numericValue) : null;
              break;
            case "checkbox":
              fieldValues[field.name] = value.booleanValue ?? null;
              break;
            case "date":
              fieldValues[field.name] = value.dateValue?.getTime() ?? null;
              break;
            default:
              fieldValues[field.name] = value.value ?? null;
          }
        }
      }
      
      // Build context
      const context: FormulaContext = {
        status: task.status,
        priority: task.priority,
        deadline: task.deadline?.getTime() ?? null,
        progress: (task as any).progress ?? null,
        title: task.title,
        description: task.description,
        fields: fieldValues,
      };
      
      return evaluateFormula(input.formula, context);
    }),
  
  // Evaluate rollup for a field
  evaluateRollup: protectedProcedure
    .input(z.object({
      fieldId: z.number(),
      projectId: z.number(),
    }))
    .query(async ({ input }) => {
      const field = await db.getCustomFieldById(input.fieldId);
      if (!field || field.type !== "rollup" || !field.rollupConfig) {
        return { success: false, error: "Invalid rollup field", errorCode: "#REF!" as const };
      }
      
      const config = field.rollupConfig as { sourceField: string; aggregation: "sum" | "avg" | "count" | "min" | "max" | "concat" };
      
      // Get all values for the source field
      const allFields = await db.getCustomFieldsByProject(input.projectId);
      const sourceField = allFields.find(f => f.name === config.sourceField);
      
      if (!sourceField) {
        return { success: false, error: `Source field not found: ${config.sourceField}`, errorCode: "#REF!" as const };
      }
      
      const sourceValues = await db.getCustomFieldValuesByField(sourceField.id);
      
      // Extract values based on source field type
      const values: (string | number | boolean | null)[] = sourceValues.map(v => {
        switch (sourceField.type) {
          case "number":
          case "currency":
          case "percent":
          case "rating":
            return v.numericValue ? parseFloat(v.numericValue) : null;
          case "checkbox":
            return v.booleanValue ?? null;
          default:
            return v.value ?? null;
        }
      });
      
      return evaluateRollup(config.aggregation, values);
    }),
  
  // Validate a formula
  validateFormula: protectedProcedure
    .input(z.object({ formula: z.string() }))
    .query(async ({ input }) => {
      return validateFormula(input.formula);
    }),
  
  // Extract field references from formula
  extractFieldRefs: protectedProcedure
    .input(z.object({ formula: z.string() }))
    .query(async ({ input }) => {
      return extractFieldRefs(input.formula);
    }),
  
  // Get available functions
  getAvailableFunctions: protectedProcedure
    .query(async () => {
      return getAvailableFunctions();
    }),
});

export type CustomFieldsRouter = typeof customFieldsRouter;
