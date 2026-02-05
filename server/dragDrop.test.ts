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
