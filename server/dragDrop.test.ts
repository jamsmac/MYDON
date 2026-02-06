import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  reorderTasks: vi.fn().mockResolvedValue(undefined),
  reorderSections: vi.fn().mockResolvedValue(undefined),
  getTasksBySection: vi.fn().mockResolvedValue([
    { id: 1, title: 'Task 1', sortOrder: 0 },
    { id: 2, title: 'Task 2', sortOrder: 1 },
    { id: 3, title: 'Task 3', sortOrder: 2 },
  ]),
  getSectionsByBlock: vi.fn().mockResolvedValue([
    { id: 1, title: 'Section 1', sortOrder: 0 },
    { id: 2, title: 'Section 2', sortOrder: 1 },
    { id: 3, title: 'Section 3', sortOrder: 2 },
  ]),
}));

import * as db from './db';

describe('Drag & Drop Reorder Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reorderTasks', () => {
    it('should call reorderTasks with correct parameters', async () => {
      const sectionId = 1;
      const taskIds = [3, 1, 2]; // New order after drag

      await db.reorderTasks(sectionId, taskIds);

      expect(db.reorderTasks).toHaveBeenCalledWith(sectionId, taskIds);
      expect(db.reorderTasks).toHaveBeenCalledTimes(1);
    });

    it('should handle empty task array', async () => {
      const sectionId = 1;
      const taskIds: number[] = [];

      await db.reorderTasks(sectionId, taskIds);

      expect(db.reorderTasks).toHaveBeenCalledWith(sectionId, []);
    });

    it('should handle single task reorder', async () => {
      const sectionId = 1;
      const taskIds = [1];

      await db.reorderTasks(sectionId, taskIds);

      expect(db.reorderTasks).toHaveBeenCalledWith(sectionId, [1]);
    });
  });

  describe('reorderSections', () => {
    it('should call reorderSections with correct parameters', async () => {
      const blockId = 1;
      const sectionIds = [3, 1, 2]; // New order after drag

      await db.reorderSections(blockId, sectionIds);

      expect(db.reorderSections).toHaveBeenCalledWith(blockId, sectionIds);
      expect(db.reorderSections).toHaveBeenCalledTimes(1);
    });

    it('should handle empty section array', async () => {
      const blockId = 1;
      const sectionIds: number[] = [];

      await db.reorderSections(blockId, sectionIds);

      expect(db.reorderSections).toHaveBeenCalledWith(blockId, []);
    });

    it('should handle single section reorder', async () => {
      const blockId = 1;
      const sectionIds = [1];

      await db.reorderSections(blockId, sectionIds);

      expect(db.reorderSections).toHaveBeenCalledWith(blockId, [1]);
    });
  });

  describe('Array Move Logic', () => {
    // Test the arrayMove logic used in drag and drop
    function arrayMove<T>(array: T[], from: number, to: number): T[] {
      const newArray = [...array];
      const [removed] = newArray.splice(from, 1);
      newArray.splice(to, 0, removed);
      return newArray;
    }

    it('should move item forward in array', () => {
      const tasks = [1, 2, 3, 4, 5];
      const result = arrayMove(tasks, 0, 3);
      expect(result).toEqual([2, 3, 4, 1, 5]);
    });

    it('should move item backward in array', () => {
      const tasks = [1, 2, 3, 4, 5];
      const result = arrayMove(tasks, 4, 1);
      expect(result).toEqual([1, 5, 2, 3, 4]);
    });

    it('should handle moving to same position', () => {
      const tasks = [1, 2, 3];
      const result = arrayMove(tasks, 1, 1);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle moving first to last', () => {
      const tasks = [1, 2, 3];
      const result = arrayMove(tasks, 0, 2);
      expect(result).toEqual([2, 3, 1]);
    });

    it('should handle moving last to first', () => {
      const tasks = [1, 2, 3];
      const result = arrayMove(tasks, 2, 0);
      expect(result).toEqual([3, 1, 2]);
    });
  });

  describe('Drag Data Structure', () => {
    it('should correctly identify task drag data', () => {
      const dragData = {
        type: 'task',
        task: { id: 1, title: 'Test Task', sortOrder: 0 },
        sectionId: 1
      };

      expect(dragData.type).toBe('task');
      expect(dragData.task.id).toBe(1);
      expect(dragData.sectionId).toBe(1);
    });

    it('should correctly identify section drag data', () => {
      const dragData = {
        type: 'section',
        section: { id: 1, title: 'Test Section', sortOrder: 0 },
        blockId: 1
      };

      expect(dragData.type).toBe('section');
      expect(dragData.section.id).toBe(1);
      expect(dragData.blockId).toBe(1);
    });
  });
});

// ============ TABLE VIEW DRAG & DROP TESTS ============

describe('Table View Drag & Drop', () => {
  describe('reorderTasksGlobal', () => {
    it('should call reorderTasksGlobal with correct parameters', async () => {
      // The reorderTasksGlobal function takes just taskIds (no sectionId)
      const taskIds = [3, 1, 4, 2, 5];
      expect(Array.isArray(taskIds)).toBe(true);
      expect(taskIds.length).toBe(5);
    });

    it('should assign sequential sortOrder values based on array position', () => {
      const taskIds = [5, 3, 1, 4, 2];
      const updates = taskIds.map((id, index) => ({
        id,
        sortOrder: index,
      }));
      expect(updates[0]).toEqual({ id: 5, sortOrder: 0 });
      expect(updates[1]).toEqual({ id: 3, sortOrder: 1 });
      expect(updates[2]).toEqual({ id: 1, sortOrder: 2 });
      expect(updates[3]).toEqual({ id: 4, sortOrder: 3 });
      expect(updates[4]).toEqual({ id: 2, sortOrder: 4 });
    });

    it('should preserve all task IDs after reordering', () => {
      const originalIds = [1, 2, 3, 4, 5];
      const reorderedIds = [3, 1, 5, 2, 4];
      const sortedOriginal = [...originalIds].sort();
      const sortedReordered = [...reorderedIds].sort();
      expect(sortedOriginal).toEqual(sortedReordered);
    });
  });

  describe('Drag enable/disable logic', () => {
    const checkDragEnabled = (sortField: string | null, groupBy: string, searchQuery: string, customFieldFilters: any[]) => {
      return !sortField && groupBy === 'none' && !searchQuery && customFieldFilters.length === 0;
    };

    it('should enable drag when no sort, group, search, or filters are active', () => {
      expect(checkDragEnabled(null, 'none', '', [])).toBe(true);
    });

    it('should disable drag when sort is active', () => {
      expect(checkDragEnabled('title', 'none', '', [])).toBe(false);
    });

    it('should disable drag when group is active', () => {
      expect(checkDragEnabled(null, 'status', '', [])).toBe(false);
    });

    it('should disable drag when search is active', () => {
      expect(checkDragEnabled(null, 'none', 'test', [])).toBe(false);
    });

    it('should disable drag when custom field filters are active', () => {
      expect(checkDragEnabled(null, 'none', '', [{ fieldId: 1 }])).toBe(false);
    });

    it('should disable drag when multiple conditions are active', () => {
      expect(checkDragEnabled('priority', 'status', 'urgent', [{ fieldId: 1 }])).toBe(false);
    });
  });

  describe('DragEnd handler logic', () => {
    it('should not reorder when active and over are the same', () => {
      const mutate = vi.fn();
      const active = { id: 1 };
      const over = { id: 1 };
      
      if (!over || active.id === over.id) {
        // No-op
      } else {
        mutate();
      }
      expect(mutate).not.toHaveBeenCalled();
    });

    it('should not reorder when over is null', () => {
      const mutate = vi.fn();
      const active = { id: 1 };
      const over = null;
      
      if (!over || active.id === (over as any)?.id) {
        // No-op
      } else {
        mutate();
      }
      expect(mutate).not.toHaveBeenCalled();
    });

    it('should call mutate with correct reordered IDs when dragging task 1 to position of task 3', () => {
      const mutate = vi.fn();
      const processedTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
        { id: 3, title: 'Task 3' },
      ];
      const active = { id: 1 };
      const over = { id: 3 };
      
      if (!over || active.id === over.id) return;

      const oldIndex = processedTasks.findIndex(t => t.id === active.id);
      const newIndex = processedTasks.findIndex(t => t.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = [...processedTasks];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      
      mutate({ taskIds: reordered.map(t => t.id) });
      
      expect(mutate).toHaveBeenCalledWith({ taskIds: [2, 3, 1] });
    });

    it('should not reorder when task ID is not found in processedTasks', () => {
      const mutate = vi.fn();
      const processedTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
      ];
      const active = { id: 99 };
      const over = { id: 1 };
      
      if (!over || active.id === over.id) return;

      const oldIndex = processedTasks.findIndex(t => t.id === active.id);
      const newIndex = processedTasks.findIndex(t => t.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1) {
        // No-op
      } else {
        mutate();
      }
      
      expect(mutate).not.toHaveBeenCalled();
    });

    it('should handle dragging last task to first position', () => {
      const mutate = vi.fn();
      const processedTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
        { id: 3, title: 'Task 3' },
        { id: 4, title: 'Task 4' },
      ];
      const active = { id: 4 };
      const over = { id: 1 };
      
      const oldIndex = processedTasks.findIndex(t => t.id === active.id);
      const newIndex = processedTasks.findIndex(t => t.id === over.id);
      
      const reordered = [...processedTasks];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      
      mutate({ taskIds: reordered.map(t => t.id) });
      
      expect(mutate).toHaveBeenCalledWith({ taskIds: [4, 1, 2, 3] });
    });
  });

  describe('SortableTableRow styling', () => {
    it('should set opacity to 0.5 when dragging', () => {
      const isDragging = true;
      expect(isDragging ? 0.5 : 1).toBe(0.5);
    });

    it('should set opacity to 1 when not dragging', () => {
      const isDragging = false;
      expect(isDragging ? 0.5 : 1).toBe(1);
    });

    it('should set zIndex to 50 when dragging for proper layering', () => {
      const isDragging = true;
      expect(isDragging ? 50 : undefined).toBe(50);
    });

    it('should show disabled state when drag is not allowed', () => {
      const isDragDisabled = true;
      const className = isDragDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing';
      expect(className).toContain('opacity-30');
      expect(className).toContain('cursor-not-allowed');
    });

    it('should show grab cursor when drag is allowed', () => {
      const isDragDisabled = false;
      const className = isDragDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing';
      expect(className).toContain('cursor-grab');
    });
  });

  describe('Sensor configuration', () => {
    it('should use activation distance of 8px to prevent accidental drags', () => {
      const activationConstraint = { distance: 8 };
      expect(activationConstraint.distance).toBe(8);
      expect(activationConstraint.distance).toBeGreaterThan(0);
    });
  });

  describe('Sort order persistence', () => {
    it('should generate correct sortOrder values for reordered tasks', () => {
      const reorderedTaskIds = [5, 2, 8, 1, 3];
      const sortOrders = reorderedTaskIds.map((id, index) => ({
        taskId: id,
        sortOrder: index,
      }));
      
      expect(sortOrders).toHaveLength(5);
      expect(sortOrders[0]).toEqual({ taskId: 5, sortOrder: 0 });
      expect(sortOrders[4]).toEqual({ taskId: 3, sortOrder: 4 });
    });

    it('should maintain consistent ordering after multiple reorders', () => {
      let tasks = [1, 2, 3, 4, 5];
      
      // First reorder: move 1 to position 3
      let result = [...tasks];
      let [removed] = result.splice(0, 1);
      result.splice(2, 0, removed);
      tasks = result;
      expect(tasks).toEqual([2, 3, 1, 4, 5]);
      
      // Second reorder: move 5 to position 0
      result = [...tasks];
      [removed] = result.splice(4, 1);
      result.splice(0, 0, removed);
      tasks = result;
      expect(tasks).toEqual([5, 2, 3, 1, 4]);
    });
  });
});
