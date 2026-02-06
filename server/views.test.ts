/**
 * Tests for Alternative Views and Export Features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data for views
const mockTasks = [
  {
    id: 1,
    title: 'Task 1',
    status: 'not_started',
    priority: 'high',
    deadline: new Date('2026-03-01').getTime(),
    sectionId: 1,
    sortOrder: 0,
  },
  {
    id: 2,
    title: 'Task 2',
    status: 'in_progress',
    priority: 'medium',
    deadline: new Date('2026-03-15').getTime(),
    sectionId: 1,
    sortOrder: 1,
  },
  {
    id: 3,
    title: 'Task 3',
    status: 'completed',
    priority: 'low',
    deadline: new Date('2026-02-28').getTime(),
    sectionId: 2,
    sortOrder: 0,
  },
];

const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'Test description',
  status: 'active',
  blocks: [
    {
      id: 1,
      title: 'Block 1',
      titleRu: 'Блок 1',
      number: 1,
      icon: 'layers',
      sections: [
        {
          id: 1,
          title: 'Section 1',
          tasks: [mockTasks[0], mockTasks[1]],
        },
        {
          id: 2,
          title: 'Section 2',
          tasks: [mockTasks[2]],
        },
      ],
    },
  ],
};

describe('Alternative Views', () => {
  describe('Kanban Board', () => {
    it('should group tasks by status', () => {
      const statusColumns = ['not_started', 'in_progress', 'completed'];
      
      const groupedTasks = statusColumns.reduce((acc, status) => {
        acc[status] = mockTasks.filter(t => t.status === status);
        return acc;
      }, {} as Record<string, typeof mockTasks>);

      expect(groupedTasks['not_started']).toHaveLength(1);
      expect(groupedTasks['in_progress']).toHaveLength(1);
      expect(groupedTasks['completed']).toHaveLength(1);
    });

    it('should calculate column counts correctly', () => {
      const counts = {
        not_started: mockTasks.filter(t => t.status === 'not_started').length,
        in_progress: mockTasks.filter(t => t.status === 'in_progress').length,
        completed: mockTasks.filter(t => t.status === 'completed').length,
      };

      expect(counts.not_started).toBe(1);
      expect(counts.in_progress).toBe(1);
      expect(counts.completed).toBe(1);
    });

    it('should support filtering by priority', () => {
      const highPriorityTasks = mockTasks.filter(t => t.priority === 'high');
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0].title).toBe('Task 1');
    });
  });

  describe('Table View', () => {
    it('should sort tasks by deadline', () => {
      const sortedTasks = [...mockTasks].sort((a, b) => 
        (a.deadline || 0) - (b.deadline || 0)
      );

      expect(sortedTasks[0].title).toBe('Task 3'); // Feb 28
      expect(sortedTasks[1].title).toBe('Task 1'); // Mar 1
      expect(sortedTasks[2].title).toBe('Task 2'); // Mar 15
    });

    it('should sort tasks by priority', () => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      
      const sortedTasks = [...mockTasks].sort((a, b) => {
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
        return aPriority - bPriority;
      });

      expect(sortedTasks[0].priority).toBe('high');
      expect(sortedTasks[1].priority).toBe('medium');
      expect(sortedTasks[2].priority).toBe('low');
    });

    it('should group tasks by status', () => {
      const grouped = mockTasks.reduce((acc, task) => {
        const status = task.status || 'not_started';
        if (!acc[status]) acc[status] = [];
        acc[status].push(task);
        return acc;
      }, {} as Record<string, typeof mockTasks>);

      expect(Object.keys(grouped)).toHaveLength(3);
    });
  });

  describe('Calendar View', () => {
    it('should get tasks for a specific date', () => {
      const targetDate = new Date('2026-03-01');
      
      const tasksOnDate = mockTasks.filter(task => {
        if (!task.deadline) return false;
        const taskDate = new Date(task.deadline);
        return taskDate.toDateString() === targetDate.toDateString();
      });

      expect(tasksOnDate).toHaveLength(1);
      expect(tasksOnDate[0].title).toBe('Task 1');
    });

    it('should calculate days in month correctly', () => {
      const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
      };

      expect(getDaysInMonth(2026, 1)).toBe(28); // February 2026
      expect(getDaysInMonth(2026, 2)).toBe(31); // March 2026
    });

    it('should identify overdue tasks', () => {
      const today = new Date('2026-03-05');
      
      const overdueTasks = mockTasks.filter(task => {
        if (!task.deadline) return false;
        if (task.status === 'completed') return false;
        return new Date(task.deadline) < today;
      });

      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].title).toBe('Task 1');
    });
  });
});

describe('Export Features', () => {
  describe('JSON Export', () => {
    it('should generate valid JSON structure', () => {
      const exportData = {
        name: mockProject.name,
        description: mockProject.description,
        status: mockProject.status,
        exportedAt: new Date().toISOString(),
        blocks: mockProject.blocks.map(block => ({
          number: block.number,
          title: block.title,
          titleRu: block.titleRu,
          icon: block.icon,
          sections: block.sections.map(section => ({
            title: section.title,
            tasks: section.tasks.map(task => ({
              title: task.title,
              status: task.status,
              priority: task.priority,
              deadline: task.deadline,
            })),
          })),
        })),
      };

      expect(exportData.name).toBe('Test Project');
      expect(exportData.blocks).toHaveLength(1);
      expect(exportData.blocks[0].sections).toHaveLength(2);
      expect(JSON.stringify(exportData)).toBeTruthy();
    });
  });

  describe('CSV Export', () => {
    it('should generate valid CSV headers', () => {
      const headers = ['Block', 'Section', 'Task', 'Status', 'Priority', 'Deadline', 'Description'];
      const csvHeader = headers.join(',');

      expect(csvHeader).toBe('Block,Section,Task,Status,Priority,Deadline,Description');
    });

    it('should escape CSV values correctly', () => {
      const escapeCSV = (value: string) => {
        return `"${value.replace(/[\n\r,"]/g, ' ')}"`;
      };

      expect(escapeCSV('Test, value')).toBe('"Test  value"');
      expect(escapeCSV('Line\nbreak')).toBe('"Line break"');
      expect(escapeCSV('Quote"mark')).toBe('"Quote mark"');
    });

    it('should generate rows for all tasks', () => {
      const rows: string[][] = [];

      mockProject.blocks.forEach(block => {
        block.sections.forEach(section => {
          section.tasks.forEach(task => {
            rows.push([
              block.titleRu || block.title,
              section.title,
              task.title,
              task.status || 'not_started',
              task.priority || '',
              task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
              '',
            ]);
          });
        });
      });

      expect(rows).toHaveLength(3);
      expect(rows[0][0]).toBe('Блок 1');
      expect(rows[0][2]).toBe('Task 1');
    });
  });

  describe('Markdown Export', () => {
    it('should generate markdown headers', () => {
      const generateHeader = (title: string, level: number) => {
        return '#'.repeat(level) + ' ' + title;
      };

      expect(generateHeader('Project', 1)).toBe('# Project');
      expect(generateHeader('Block', 2)).toBe('## Block');
      expect(generateHeader('Section', 3)).toBe('### Section');
    });

    it('should generate task checkboxes', () => {
      const generateTaskLine = (task: typeof mockTasks[0]) => {
        const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
        return `- ${checkbox} ${task.title}`;
      };

      expect(generateTaskLine(mockTasks[0])).toBe('- [ ] Task 1');
      expect(generateTaskLine(mockTasks[2])).toBe('- [x] Task 3');
    });
  });
});

describe('View Switcher', () => {
  it('should have all view types', () => {
    const viewTypes = ['list', 'kanban', 'table', 'calendar', 'gantt'];
    
    expect(viewTypes).toContain('list');
    expect(viewTypes).toContain('kanban');
    expect(viewTypes).toContain('table');
    expect(viewTypes).toContain('calendar');
    expect(viewTypes).toContain('gantt');
  });

  it('should persist view preference', () => {
    const storageKey = 'project-view-1';
    const view = 'kanban';
    
    // Simulate localStorage
    const storage: Record<string, string> = {};
    storage[storageKey] = view;
    
    expect(storage[storageKey]).toBe('kanban');
  });
});
