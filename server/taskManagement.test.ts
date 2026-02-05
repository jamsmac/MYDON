import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  splitTaskIntoSubtasks: vi.fn(),
  mergeTasks: vi.fn(),
  convertTaskToSection: vi.fn(),
  convertSectionToTask: vi.fn(),
  bulkUpdateTaskStatus: vi.fn(),
  bulkDeleteTasks: vi.fn(),
  duplicateTask: vi.fn(),
  getTaskById: vi.fn(),
  getSectionById: vi.fn(),
  getBlockById: vi.fn(),
}));

import * as db from './db';

describe('Advanced Task Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('splitTaskIntoSubtasks', () => {
    it('should split a task into multiple subtasks', async () => {
      const mockTask = { id: 1, title: 'Main Task', status: 'in_progress', sectionId: 1 };
      const mockSubtasks = [
        { id: 1, taskId: 1, title: 'Subtask 1', status: 'not_started', sortOrder: 0 },
        { id: 2, taskId: 1, title: 'Subtask 2', status: 'not_started', sortOrder: 1 },
      ];

      vi.mocked(db.splitTaskIntoSubtasks).mockResolvedValue({
        task: mockTask as any,
        subtasks: mockSubtasks as any[],
      });

      const result = await db.splitTaskIntoSubtasks(1, ['Subtask 1', 'Subtask 2']);

      expect(db.splitTaskIntoSubtasks).toHaveBeenCalledWith(1, ['Subtask 1', 'Subtask 2']);
      expect(result.subtasks).toHaveLength(2);
      expect(result.subtasks[0].title).toBe('Subtask 1');
      expect(result.subtasks[1].title).toBe('Subtask 2');
    });
  });

  describe('mergeTasks', () => {
    it('should merge multiple tasks into one', async () => {
      const mockMergedTask = {
        id: 10,
        title: 'Merged Task',
        sectionId: 1,
        status: 'not_started',
        description: '**Task 1**\n\n---\n\n**Task 2**',
      };

      vi.mocked(db.mergeTasks).mockResolvedValue(mockMergedTask as any);

      const result = await db.mergeTasks([1, 2], 'Merged Task', 1);

      expect(db.mergeTasks).toHaveBeenCalledWith([1, 2], 'Merged Task', 1);
      expect(result.title).toBe('Merged Task');
      expect(result.id).toBe(10);
    });

    it('should require at least 2 tasks to merge', async () => {
      vi.mocked(db.mergeTasks).mockRejectedValue(new Error('Need at least 2 tasks to merge'));

      await expect(db.mergeTasks([1], 'Single Task', 1)).rejects.toThrow('Need at least 2 tasks to merge');
    });
  });

  describe('convertTaskToSection', () => {
    it('should convert a task to a section', async () => {
      const mockSection = {
        id: 5,
        title: 'Promoted Section',
        blockId: 1,
        sortOrder: 3,
      };

      vi.mocked(db.convertTaskToSection).mockResolvedValue(mockSection as any);

      const result = await db.convertTaskToSection(1);

      expect(db.convertTaskToSection).toHaveBeenCalledWith(1);
      expect(result.title).toBe('Promoted Section');
      expect(result.blockId).toBe(1);
    });
  });

  describe('convertSectionToTask', () => {
    it('should convert a section to a task', async () => {
      const mockTask = {
        id: 15,
        title: 'Demoted Task',
        sectionId: 2,
        status: 'not_started',
      };

      vi.mocked(db.convertSectionToTask).mockResolvedValue(mockTask as any);

      const result = await db.convertSectionToTask(1, 2);

      expect(db.convertSectionToTask).toHaveBeenCalledWith(1, 2);
      expect(result.title).toBe('Demoted Task');
      expect(result.sectionId).toBe(2);
    });
  });

  describe('bulkUpdateTaskStatus', () => {
    it('should update status for multiple tasks', async () => {
      vi.mocked(db.bulkUpdateTaskStatus).mockResolvedValue(3);

      const result = await db.bulkUpdateTaskStatus([1, 2, 3], 'completed');

      expect(db.bulkUpdateTaskStatus).toHaveBeenCalledWith([1, 2, 3], 'completed');
      expect(result).toBe(3);
    });

    it('should handle empty task list', async () => {
      vi.mocked(db.bulkUpdateTaskStatus).mockResolvedValue(0);

      const result = await db.bulkUpdateTaskStatus([], 'completed');

      expect(result).toBe(0);
    });
  });

  describe('bulkDeleteTasks', () => {
    it('should delete multiple tasks', async () => {
      vi.mocked(db.bulkDeleteTasks).mockResolvedValue(2);

      const result = await db.bulkDeleteTasks([1, 2]);

      expect(db.bulkDeleteTasks).toHaveBeenCalledWith([1, 2]);
      expect(result).toBe(2);
    });
  });

  describe('duplicateTask', () => {
    it('should create a copy of a task', async () => {
      const mockDuplicatedTask = {
        id: 20,
        title: 'Original Task (копия)',
        sectionId: 1,
        status: 'not_started',
      };

      vi.mocked(db.duplicateTask).mockResolvedValue(mockDuplicatedTask as any);

      const result = await db.duplicateTask(1);

      expect(db.duplicateTask).toHaveBeenCalledWith(1);
      expect(result.title).toContain('(копия)');
      expect(result.status).toBe('not_started');
    });
  });
});
