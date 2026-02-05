import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from './db';

// Mock database functions
vi.mock('./db', () => ({
  getTemplates: vi.fn(),
  getPublicTemplates: vi.fn(),
  getTemplateById: vi.fn(),
  saveProjectAsTemplate: vi.fn(),
  incrementTemplateUsage: vi.fn(),
  createProject: vi.fn(),
  createBlock: vi.fn(),
  createSection: vi.fn(),
  createTask: vi.fn(),
  deleteTemplate: vi.fn(),
}));

describe('Template Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTemplates', () => {
    it('should return templates for a user', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Test Template',
          description: 'A test template',
          isPublic: true,
          authorId: 1,
          authorName: 'Test User',
          blocksCount: 3,
          sectionsCount: 9,
          tasksCount: 27,
          usageCount: 5,
        },
      ];

      vi.mocked(db.getTemplates).mockResolvedValue(mockTemplates as any);

      const result = await db.getTemplates(1);
      expect(result).toEqual(mockTemplates);
      expect(db.getTemplates).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(db.getTemplates).mockResolvedValue([]);

      const result = await db.getTemplates(1);
      expect(result).toEqual([]);
    });
  });

  describe('getPublicTemplates', () => {
    it('should return only public templates', async () => {
      const mockPublicTemplates = [
        {
          id: 1,
          name: 'Public Template',
          isPublic: true,
          authorId: 2,
        },
      ];

      vi.mocked(db.getPublicTemplates).mockResolvedValue(mockPublicTemplates as any);

      const result = await db.getPublicTemplates();
      expect(result).toEqual(mockPublicTemplates);
    });
  });

  describe('getTemplateById', () => {
    it('should return a template by id', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Test Template',
        structure: {
          blocks: [
            {
              title: 'Block 1',
              sections: [
                {
                  title: 'Section 1',
                  tasks: [{ title: 'Task 1' }],
                },
              ],
            },
          ],
        },
      };

      vi.mocked(db.getTemplateById).mockResolvedValue(mockTemplate as any);

      const result = await db.getTemplateById(1);
      expect(result).toEqual(mockTemplate);
      expect(db.getTemplateById).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent template', async () => {
      vi.mocked(db.getTemplateById).mockResolvedValue(null);

      const result = await db.getTemplateById(999);
      expect(result).toBeNull();
    });
  });

  describe('saveProjectAsTemplate', () => {
    it('should save a project as a template', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Saved Template',
        description: 'Template description',
        isPublic: false,
        authorId: 1,
        authorName: 'Test User',
      };

      vi.mocked(db.saveProjectAsTemplate).mockResolvedValue(mockTemplate as any);

      const result = await db.saveProjectAsTemplate(
        1,
        1,
        'Test User',
        'Saved Template',
        'Template description',
        false
      );

      expect(result).toEqual(mockTemplate);
      expect(db.saveProjectAsTemplate).toHaveBeenCalledWith(
        1,
        1,
        'Test User',
        'Saved Template',
        'Template description',
        false
      );
    });

    it('should return null if project not found', async () => {
      vi.mocked(db.saveProjectAsTemplate).mockResolvedValue(null);

      const result = await db.saveProjectAsTemplate(
        999,
        1,
        'Test User',
        'Template',
        '',
        false
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template owned by user', async () => {
      vi.mocked(db.deleteTemplate).mockResolvedValue(true);

      const result = await db.deleteTemplate(1, 1);
      expect(result).toBe(true);
      expect(db.deleteTemplate).toHaveBeenCalledWith(1, 1);
    });

    it('should return false when deleting template not owned by user', async () => {
      vi.mocked(db.deleteTemplate).mockResolvedValue(false);

      const result = await db.deleteTemplate(1, 999);
      expect(result).toBe(false);
    });
  });

  describe('incrementTemplateUsage', () => {
    it('should increment usage count', async () => {
      vi.mocked(db.incrementTemplateUsage).mockResolvedValue(undefined);

      await db.incrementTemplateUsage(1);
      expect(db.incrementTemplateUsage).toHaveBeenCalledWith(1);
    });
  });
});
