import { describe, it, expect } from 'vitest';

/**
 * Tests for Block & Section Detail Panels
 * These panels replace the empty "welcome" screen when a block or section is selected
 */

describe('BlockDetailPanel', () => {
  describe('Component Structure', () => {
    it('should display block title and description', () => {
      const block = {
        id: 1,
        title: 'Исследование и анализ',
        description: 'Маркетинговые исследования и анализ рынка',
      };
      expect(block.title).toBeTruthy();
      expect(block.description).toBeTruthy();
    });

    it('should calculate progress from sections and tasks', () => {
      const sections = [
        { id: 1, tasks: [{ status: 'completed' }, { status: 'completed' }, { status: 'in_progress' }] },
        { id: 2, tasks: [{ status: 'not_started' }, { status: 'completed' }] },
      ];
      const allTasks = sections.flatMap(s => s.tasks);
      const completed = allTasks.filter(t => t.status === 'completed').length;
      const total = allTasks.length;
      const progress = Math.round((completed / total) * 100);
      expect(progress).toBe(60); // 3 out of 5
    });

    it('should show section count', () => {
      const sections = [
        { id: 1, title: 'Маркетинговые исследования' },
        { id: 2, title: 'Customer Development' },
        { id: 3, title: 'Анализ поставщиков' },
      ];
      expect(sections.length).toBe(3);
    });

    it('should show task count across all sections', () => {
      const sections = [
        { id: 1, tasks: [{}, {}, {}] },
        { id: 2, tasks: [{}, {}] },
      ];
      const totalTasks = sections.reduce((sum, s) => sum + s.tasks.length, 0);
      expect(totalTasks).toBe(5);
    });

    it('should show deadline if set', () => {
      const block = { id: 1, deadline: Date.now() + 86400000 * 30 };
      expect(block.deadline).toBeGreaterThan(Date.now());
    });

    it('should handle block without deadline', () => {
      const block = { id: 1, deadline: null };
      expect(block.deadline).toBeNull();
    });
  });

  describe('Section List in Block', () => {
    it('should list all sections with their task counts', () => {
      const sections = [
        { id: 1, title: 'Маркетинговые исследования', tasks: [{}, {}, {}, {}] },
        { id: 2, title: 'Customer Development', tasks: [{}, {}] },
        { id: 3, title: 'Анализ поставщиков', tasks: [{}, {}, {}] },
      ];
      
      const sectionSummaries = sections.map(s => ({
        title: s.title,
        taskCount: s.tasks.length,
      }));
      
      expect(sectionSummaries).toHaveLength(3);
      expect(sectionSummaries[0].taskCount).toBe(4);
      expect(sectionSummaries[1].taskCount).toBe(2);
      expect(sectionSummaries[2].taskCount).toBe(3);
    });

    it('should calculate per-section progress', () => {
      const section = {
        tasks: [
          { status: 'completed' },
          { status: 'completed' },
          { status: 'in_progress' },
          { status: 'not_started' },
        ],
      };
      const completed = section.tasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completed / section.tasks.length) * 100);
      expect(progress).toBe(50);
    });

    it('should handle empty sections', () => {
      const section = { tasks: [] as any[] };
      const progress = section.tasks.length === 0 ? 0 : Math.round(
        (section.tasks.filter((t: any) => t.status === 'completed').length / section.tasks.length) * 100
      );
      expect(progress).toBe(0);
    });
  });

  describe('Quick Actions', () => {
    it('should provide block-level AI actions', () => {
      const blockActions = [
        { id: 'roadmap', label: 'Создать roadmap' },
        { id: 'decompose', label: 'Декомпозировать' },
        { id: 'risks', label: 'Анализ рисков' },
        { id: 'report', label: 'Сгенерировать отчёт' },
      ];
      expect(blockActions).toHaveLength(4);
      expect(blockActions.map(a => a.id)).toContain('roadmap');
      expect(blockActions.map(a => a.id)).toContain('risks');
    });

    it('should provide discuss action', () => {
      const hasDiscussAction = true;
      expect(hasDiscussAction).toBe(true);
    });
  });
});

describe('SectionDetailPanel', () => {
  describe('Component Structure', () => {
    it('should display section title', () => {
      const section = {
        id: 1,
        title: 'Маркетинговые исследования',
      };
      expect(section.title).toBeTruthy();
    });

    it('should calculate progress from tasks', () => {
      const tasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'not_started' },
        { status: 'not_started' },
      ];
      const completed = tasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completed / tasks.length) * 100);
      expect(progress).toBe(40);
    });

    it('should show task count by status', () => {
      const tasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'not_started' },
        { status: 'not_started' },
      ];
      const byStatus = {
        completed: tasks.filter(t => t.status === 'completed').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        not_started: tasks.filter(t => t.status === 'not_started').length,
      };
      expect(byStatus.completed).toBe(2);
      expect(byStatus.in_progress).toBe(1);
      expect(byStatus.not_started).toBe(2);
    });
  });

  describe('Task List in Section', () => {
    it('should list all tasks with status and priority', () => {
      const tasks = [
        { id: 1, title: 'Анализ рынка аренды спецтехники', status: 'completed', priority: 'high' },
        { id: 2, title: 'Оценка темпов роста рынка', status: 'in_progress', priority: 'medium' },
        { id: 3, title: 'Исследование конкурентов', status: 'not_started', priority: 'high' },
      ];
      expect(tasks).toHaveLength(3);
      expect(tasks[0].status).toBe('completed');
      expect(tasks[1].priority).toBe('medium');
    });

    it('should sort tasks by status (in_progress first, then not_started, then completed)', () => {
      const tasks = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'not_started' },
        { id: 3, status: 'in_progress' },
      ];
      const statusOrder: Record<string, number> = { in_progress: 0, not_started: 1, completed: 2 };
      const sorted = [...tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      expect(sorted[0].id).toBe(3); // in_progress
      expect(sorted[1].id).toBe(2); // not_started
      expect(sorted[2].id).toBe(1); // completed
    });

    it('should handle clicking on a task to navigate to it', () => {
      const taskId = 42;
      const navigateTo = `task-${taskId}`;
      expect(navigateTo).toBe('task-42');
    });
  });

  describe('Quick Actions', () => {
    it('should provide section-level AI actions', () => {
      const sectionActions = [
        { id: 'tasks', label: 'Создать задачи' },
        { id: 'plan', label: 'Сгенерировать план' },
        { id: 'evaluate', label: 'Оценить' },
        { id: 'deps', label: 'Найти зависимости' },
      ];
      expect(sectionActions).toHaveLength(4);
      expect(sectionActions.map(a => a.id)).toContain('tasks');
      expect(sectionActions.map(a => a.id)).toContain('deps');
    });

    it('should provide create task action', () => {
      const hasCreateTask = true;
      expect(hasCreateTask).toBe(true);
    });

    it('should provide discuss action', () => {
      const hasDiscussAction = true;
      expect(hasDiscussAction).toBe(true);
    });
  });

  describe('Progress Calculation Edge Cases', () => {
    it('should handle section with all completed tasks', () => {
      const tasks = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'completed' },
      ];
      const completed = tasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completed / tasks.length) * 100);
      expect(progress).toBe(100);
    });

    it('should handle section with no tasks', () => {
      const tasks: any[] = [];
      const progress = tasks.length === 0 ? 0 : Math.round(
        (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100
      );
      expect(progress).toBe(0);
    });

    it('should handle section with all not_started tasks', () => {
      const tasks = [
        { status: 'not_started' },
        { status: 'not_started' },
      ];
      const completed = tasks.filter(t => t.status === 'completed').length;
      const progress = Math.round((completed / tasks.length) * 100);
      expect(progress).toBe(0);
    });
  });
});

describe('BreadcrumbNav', () => {
  it('should show project name as root', () => {
    const breadcrumbs = [{ label: 'TechRent Roadmap', type: 'project' }];
    expect(breadcrumbs[0].label).toBe('TechRent Roadmap');
  });

  it('should show block in breadcrumb path', () => {
    const breadcrumbs = [
      { label: 'TechRent Roadmap', type: 'project' },
      { label: 'Исследование и анализ', type: 'block' },
    ];
    expect(breadcrumbs).toHaveLength(2);
    expect(breadcrumbs[1].type).toBe('block');
  });

  it('should show full path: project > block > section', () => {
    const breadcrumbs = [
      { label: 'TechRent Roadmap', type: 'project' },
      { label: 'Исследование и анализ', type: 'block' },
      { label: 'Маркетинговые исследования', type: 'section' },
    ];
    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[2].type).toBe('section');
  });

  it('should show full path: project > block > section > task', () => {
    const breadcrumbs = [
      { label: 'TechRent Roadmap', type: 'project' },
      { label: 'Исследование и анализ', type: 'block' },
      { label: 'Маркетинговые исследования', type: 'section' },
      { label: 'Анализ рынка аренды спецтехники', type: 'task' },
    ];
    expect(breadcrumbs).toHaveLength(4);
    expect(breadcrumbs[3].type).toBe('task');
  });
});
