import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Config schema matching the router's schema
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

const createInputSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1).max(100),
  viewType: z.enum(["table", "kanban", "calendar", "gantt", "all"]).default("all"),
  config: savedViewConfigSchema,
  icon: z.string().optional(),
  color: z.string().optional(),
});

const updateInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(100).optional(),
  config: savedViewConfigSchema.optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

const deleteInputSchema = z.object({ id: z.number() });

const setDefaultInputSchema = z.object({
  id: z.number(),
  projectId: z.number(),
});

describe('Saved Views Feature', () => {
  describe('Config Schema Validation', () => {
    it('should accept a minimal empty config', () => {
      const result = savedViewConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept a full table view config', () => {
      const config = {
        viewType: 'table',
        sortField: 'priority',
        sortDirection: 'desc' as const,
        groupBy: 'status',
        searchQuery: 'urgent',
        customFieldFilters: [
          { id: 'f1', fieldId: 1, operator: 'equals', value: 'high' },
          { id: 'f2', fieldId: 2, operator: 'contains', value: 'test' },
        ],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortField).toBe('priority');
        expect(result.data.sortDirection).toBe('desc');
        expect(result.data.groupBy).toBe('status');
        expect(result.data.customFieldFilters).toHaveLength(2);
      }
    });

    it('should accept a kanban view config with filters', () => {
      const config = {
        viewType: 'kanban',
        kanbanFilters: {
          priority: 'high',
          assignee: 5,
          tag: 3,
        },
        customFieldFilters: [],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kanbanFilters?.priority).toBe('high');
        expect(result.data.kanbanFilters?.assignee).toBe(5);
        expect(result.data.kanbanFilters?.tag).toBe(3);
      }
    });

    it('should accept calendar mode config', () => {
      const config = {
        calendarMode: 'week' as const,
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.calendarMode).toBe('week');
      }
    });

    it('should accept gantt zoom config', () => {
      const config = {
        ganttZoom: '3months',
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid sort direction', () => {
      const config = {
        sortDirection: 'up',
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid calendar mode', () => {
      const config = {
        calendarMode: 'year',
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept null sortField', () => {
      const config = {
        sortField: null,
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortField).toBeNull();
      }
    });

    it('should accept config with only customFieldFilters', () => {
      const config = {
        customFieldFilters: [
          { id: 'cf-1', fieldId: 10, operator: 'greater_than', value: '100' },
        ],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customFieldFilters![0].fieldId).toBe(10);
      }
    });

    it('should reject customFieldFilter with missing required fields', () => {
      const config = {
        customFieldFilters: [
          { id: 'cf-1', operator: 'equals', value: 'test' }, // missing fieldId
        ],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should accept partial kanbanFilters', () => {
      const config = {
        kanbanFilters: {
          priority: 'medium',
        },
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kanbanFilters?.priority).toBe('medium');
        expect(result.data.kanbanFilters?.assignee).toBeUndefined();
      }
    });
  });

  describe('Create Input Validation', () => {
    it('should accept valid create input', () => {
      const input = {
        projectId: 1,
        name: 'My Table View',
        viewType: 'table' as const,
        config: { sortField: 'title', sortDirection: 'asc' as const },
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should default viewType to "all"', () => {
      const input = {
        projectId: 1,
        name: 'Default View',
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.viewType).toBe('all');
      }
    });

    it('should reject empty name', () => {
      const input = {
        projectId: 1,
        name: '',
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const input = {
        projectId: 1,
        name: 'A'.repeat(101),
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept name with exactly 100 characters', () => {
      const input = {
        projectId: 1,
        name: 'A'.repeat(100),
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid viewType', () => {
      const input = {
        projectId: 1,
        name: 'Test',
        viewType: 'timeline',
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept all valid viewType values', () => {
      const viewTypes = ['table', 'kanban', 'calendar', 'gantt', 'all'] as const;
      viewTypes.forEach(viewType => {
        const result = createInputSchema.safeParse({
          projectId: 1,
          name: `View ${viewType}`,
          viewType,
          config: {},
        });
        expect(result.success).toBe(true);
      });
    });

    it('should accept optional icon and color', () => {
      const input = {
        projectId: 1,
        name: 'Colored View',
        config: {},
        icon: 'star',
        color: '#ff5500',
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.icon).toBe('star');
        expect(result.data.color).toBe('#ff5500');
      }
    });

    it('should reject missing projectId', () => {
      const input = {
        name: 'No Project',
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing config', () => {
      const input = {
        projectId: 1,
        name: 'No Config',
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Update Input Validation', () => {
    it('should accept valid update with name only', () => {
      const input = {
        id: 1,
        name: 'Updated Name',
      };
      const result = updateInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid update with config only', () => {
      const input = {
        id: 1,
        config: { sortField: 'deadline', sortDirection: 'desc' as const },
      };
      const result = updateInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept update with all fields', () => {
      const input = {
        id: 5,
        name: 'Full Update',
        config: { groupBy: 'priority' },
        icon: 'filter',
        color: '#00ff00',
      };
      const result = updateInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require id', () => {
      const input = {
        name: 'No ID',
      };
      const result = updateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty name in update', () => {
      const input = {
        id: 1,
        name: '',
      };
      const result = updateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Delete Input Validation', () => {
    it('should accept valid delete input', () => {
      const result = deleteInputSchema.safeParse({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = deleteInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('Set Default Input Validation', () => {
    it('should accept valid setDefault input', () => {
      const result = setDefaultInputSchema.safeParse({ id: 1, projectId: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept id=0 to clear default', () => {
      const result = setDefaultInputSchema.safeParse({ id: 0, projectId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject missing projectId', () => {
      const result = setDefaultInputSchema.safeParse({ id: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe('View State Serialization', () => {
    it('should round-trip a table view state through config schema', () => {
      const tableState = {
        sortField: 'priority',
        sortDirection: 'desc' as const,
        groupBy: 'status',
        searchQuery: 'deploy',
        customFieldFilters: [
          { id: 'f1', fieldId: 1, operator: 'equals', value: 'production' },
        ],
      };
      const parsed = savedViewConfigSchema.parse(tableState);
      expect(parsed.sortField).toBe(tableState.sortField);
      expect(parsed.sortDirection).toBe(tableState.sortDirection);
      expect(parsed.groupBy).toBe(tableState.groupBy);
      expect(parsed.searchQuery).toBe(tableState.searchQuery);
      expect(parsed.customFieldFilters).toEqual(tableState.customFieldFilters);
    });

    it('should round-trip a kanban view state through config schema', () => {
      const kanbanState = {
        kanbanFilters: { priority: 'high', assignee: 3 },
        customFieldFilters: [
          { id: 'kf1', fieldId: 5, operator: 'not_empty', value: '' },
        ],
      };
      const parsed = savedViewConfigSchema.parse(kanbanState);
      expect(parsed.kanbanFilters).toEqual(kanbanState.kanbanFilters);
      expect(parsed.customFieldFilters).toEqual(kanbanState.customFieldFilters);
    });

    it('should handle empty custom field filters array', () => {
      const state = {
        sortField: 'title',
        customFieldFilters: [],
      };
      const parsed = savedViewConfigSchema.parse(state);
      expect(parsed.customFieldFilters).toEqual([]);
    });

    it('should preserve all kanban filter fields', () => {
      const state = {
        kanbanFilters: {
          priority: 'critical',
          assignee: 42,
          tag: 7,
        },
      };
      const parsed = savedViewConfigSchema.parse(state);
      expect(parsed.kanbanFilters?.priority).toBe('critical');
      expect(parsed.kanbanFilters?.assignee).toBe(42);
      expect(parsed.kanbanFilters?.tag).toBe(7);
    });
  });

  describe('Multiple Custom Field Filters', () => {
    it('should accept multiple filters of different types', () => {
      const config = {
        customFieldFilters: [
          { id: 'f1', fieldId: 1, operator: 'equals', value: 'active' },
          { id: 'f2', fieldId: 2, operator: 'greater_than', value: '50' },
          { id: 'f3', fieldId: 3, operator: 'contains', value: 'sprint' },
          { id: 'f4', fieldId: 4, operator: 'is_empty', value: '' },
          { id: 'f5', fieldId: 5, operator: 'not_equals', value: 'false' },
        ],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customFieldFilters).toHaveLength(5);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with all fields populated', () => {
      const fullConfig = {
        viewType: 'table',
        sortField: 'deadline',
        sortDirection: 'asc' as const,
        groupBy: 'assignee',
        searchQuery: 'milestone',
        kanbanFilters: { priority: 'high', assignee: 1, tag: 2 },
        customFieldFilters: [
          { id: 'cf1', fieldId: 10, operator: 'equals', value: 'done' },
        ],
        calendarMode: 'month' as const,
        ganttZoom: '6months',
      };
      const result = savedViewConfigSchema.safeParse(fullConfig);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in view name', () => {
      const input = {
        projectId: 1,
        name: 'Мой вид задач 📋',
        config: {},
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should handle unicode in search query', () => {
      const config = {
        searchQuery: 'задача по деплою',
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.searchQuery).toBe('задача по деплою');
      }
    });

    it('should handle special characters in filter values', () => {
      const config = {
        customFieldFilters: [
          { id: 'f1', fieldId: 1, operator: 'contains', value: 'test & <script>' },
        ],
      };
      const result = savedViewConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});
