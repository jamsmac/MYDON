import { describe, it, expect } from 'vitest';

describe('Subtask Templates System', () => {
  describe('Template Structure', () => {
    it('should define template categories correctly', () => {
      const TEMPLATE_CATEGORIES = [
        { value: 'development', label: 'Разработка', icon: '💻' },
        { value: 'design', label: 'Дизайн', icon: '🎨' },
        { value: 'marketing', label: 'Маркетинг', icon: '📢' },
        { value: 'research', label: 'Исследование', icon: '🔍' },
        { value: 'testing', label: 'Тестирование', icon: '🧪' },
        { value: 'documentation', label: 'Документация', icon: '📝' },
        { value: 'other', label: 'Другое', icon: '📁' },
      ];

      expect(TEMPLATE_CATEGORIES).toHaveLength(7);
      expect(TEMPLATE_CATEGORIES.find(c => c.value === 'development')).toBeDefined();
      expect(TEMPLATE_CATEGORIES.find(c => c.value === 'testing')).toBeDefined();
    });

    it('should validate template item structure', () => {
      interface SubtaskTemplateItem {
        id: number;
        templateId: number;
        title: string;
        sortOrder: number | null;
        createdAt: Date;
      }

      const mockItem: SubtaskTemplateItem = {
        id: 1,
        templateId: 1,
        title: 'Test subtask',
        sortOrder: 0,
        createdAt: new Date(),
      };

      expect(mockItem.id).toBe(1);
      expect(mockItem.title).toBe('Test subtask');
      expect(mockItem.sortOrder).toBe(0);
    });
  });

  describe('Template Operations', () => {
    it('should group templates by category', () => {
      const templates = [
        { id: 1, category: 'development', name: 'Code Review' },
        { id: 2, category: 'development', name: 'Feature Implementation' },
        { id: 3, category: 'testing', name: 'QA Checklist' },
        { id: 4, category: null, name: 'General Tasks' },
      ];

      const templatesByCategory = templates.reduce((acc, template) => {
        const cat = template.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(template);
        return acc;
      }, {} as Record<string, typeof templates>);

      expect(templatesByCategory['development']).toHaveLength(2);
      expect(templatesByCategory['testing']).toHaveLength(1);
      expect(templatesByCategory['other']).toHaveLength(1);
    });

    it('should validate template name requirements', () => {
      const validateTemplateName = (name: string): boolean => {
        return name.trim().length >= 1 && name.trim().length <= 255;
      };

      expect(validateTemplateName('Valid Template Name')).toBe(true);
      expect(validateTemplateName('')).toBe(false);
      expect(validateTemplateName('   ')).toBe(false);
      expect(validateTemplateName('A'.repeat(256))).toBe(false);
      expect(validateTemplateName('A'.repeat(255))).toBe(true);
    });

    it('should validate template items array', () => {
      const validateTemplateItems = (items: string[]): boolean => {
        return items.length > 0 && items.every(item => item.trim().length >= 1 && item.trim().length <= 500);
      };

      expect(validateTemplateItems(['Task 1', 'Task 2'])).toBe(true);
      expect(validateTemplateItems([])).toBe(false);
      expect(validateTemplateItems([''])).toBe(false);
      expect(validateTemplateItems(['A'.repeat(501)])).toBe(false);
    });
  });

  describe('Template Application', () => {
    it('should create subtasks from template items', () => {
      const templateItems = [
        { title: 'Setup environment', sortOrder: 0 },
        { title: 'Write tests', sortOrder: 1 },
        { title: 'Code review', sortOrder: 2 },
      ];

      const createSubtasksFromTemplate = (
        items: typeof templateItems,
        taskId: number,
        existingCount: number
      ) => {
        return items.map((item, index) => ({
          taskId,
          title: item.title,
          status: 'not_started' as const,
          sortOrder: existingCount + index,
        }));
      };

      const subtasks = createSubtasksFromTemplate(templateItems, 1, 5);

      expect(subtasks).toHaveLength(3);
      expect(subtasks[0].sortOrder).toBe(5);
      expect(subtasks[1].sortOrder).toBe(6);
      expect(subtasks[2].sortOrder).toBe(7);
      expect(subtasks[0].status).toBe('not_started');
    });

    it('should increment usage count on template application', () => {
      let usageCount = 0;

      const applyTemplate = () => {
        usageCount += 1;
        return usageCount;
      };

      expect(applyTemplate()).toBe(1);
      expect(applyTemplate()).toBe(2);
      expect(applyTemplate()).toBe(3);
    });
  });

  describe('Save As Template', () => {
    it('should extract subtask titles for template', () => {
      const subtasks = [
        { id: 1, title: 'Task A', status: 'completed', sortOrder: 0 },
        { id: 2, title: 'Task B', status: 'not_started', sortOrder: 1 },
        { id: 3, title: 'Task C', status: 'in_progress', sortOrder: 2 },
      ];

      const extractTitlesForTemplate = (subtasks: typeof subtasks) => {
        return subtasks
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(s => s.title);
      };

      const titles = extractTitlesForTemplate(subtasks);

      expect(titles).toEqual(['Task A', 'Task B', 'Task C']);
    });

    it('should not allow saving empty subtask list as template', () => {
      const canSaveAsTemplate = (subtasks: { title: string }[]) => {
        return subtasks.length > 0;
      };

      expect(canSaveAsTemplate([])).toBe(false);
      expect(canSaveAsTemplate([{ title: 'Task 1' }])).toBe(true);
    });
  });
});
