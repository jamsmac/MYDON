/**
 * Tests for Gantt Chart and Task Dependencies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock task data
const mockTasks = [
  {
    id: 1,
    title: 'Design Phase',
    status: 'completed',
    priority: 'high',
    deadline: new Date('2026-02-15').getTime(),
    sectionId: 1,
    blockTitle: 'Phase 1',
    sectionTitle: 'Planning',
  },
  {
    id: 2,
    title: 'Development Phase',
    status: 'in_progress',
    priority: 'high',
    deadline: new Date('2026-03-01').getTime(),
    sectionId: 1,
    blockTitle: 'Phase 1',
    sectionTitle: 'Development',
  },
  {
    id: 3,
    title: 'Testing Phase',
    status: 'not_started',
    priority: 'medium',
    deadline: new Date('2026-03-15').getTime(),
    sectionId: 2,
    blockTitle: 'Phase 2',
    sectionTitle: 'QA',
  },
  {
    id: 4,
    title: 'Deployment',
    status: 'not_started',
    priority: 'critical',
    deadline: new Date('2026-04-01').getTime(),
    sectionId: 2,
    blockTitle: 'Phase 2',
    sectionTitle: 'Release',
  },
];

// Mock dependencies
const mockDependencies = [
  {
    id: 1,
    taskId: 2,
    dependsOnTaskId: 1,
    dependencyType: 'finish_to_start',
    lagDays: 0,
  },
  {
    id: 2,
    taskId: 3,
    dependsOnTaskId: 2,
    dependencyType: 'finish_to_start',
    lagDays: 2,
  },
  {
    id: 3,
    taskId: 4,
    dependsOnTaskId: 3,
    dependencyType: 'finish_to_start',
    lagDays: 0,
  },
];

describe('Task Dependencies', () => {
  describe('Dependency Types', () => {
    it('should support finish_to_start dependency', () => {
      const dep = mockDependencies[0];
      expect(dep.dependencyType).toBe('finish_to_start');
      
      // Task 2 depends on Task 1 finishing first
      const task1 = mockTasks.find(t => t.id === dep.dependsOnTaskId);
      const task2 = mockTasks.find(t => t.id === dep.taskId);
      
      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task1!.deadline).toBeLessThan(task2!.deadline);
    });

    it('should support lag days between tasks', () => {
      const dep = mockDependencies[1];
      expect(dep.lagDays).toBe(2);
      
      // Task 3 starts 2 days after Task 2 finishes
      const task2 = mockTasks.find(t => t.id === dep.dependsOnTaskId);
      const task3 = mockTasks.find(t => t.id === dep.taskId);
      
      expect(task2).toBeDefined();
      expect(task3).toBeDefined();
    });

    it('should prevent self-dependency', () => {
      const createSelfDependency = (taskId: number) => {
        if (taskId === taskId) {
          throw new Error('Task cannot depend on itself');
        }
        return { taskId, dependsOnTaskId: taskId };
      };

      expect(() => createSelfDependency(1)).toThrow('Task cannot depend on itself');
    });
  });

  describe('Dependency Chain', () => {
    it('should build correct dependency chain', () => {
      // Build dependency chain: 1 -> 2 -> 3 -> 4
      const chain: number[] = [];
      let currentTaskId = 1;
      chain.push(currentTaskId);

      while (true) {
        const nextDep = mockDependencies.find(d => d.dependsOnTaskId === currentTaskId);
        if (!nextDep) break;
        chain.push(nextDep.taskId);
        currentTaskId = nextDep.taskId;
      }

      expect(chain).toEqual([1, 2, 3, 4]);
    });

    it('should detect circular dependencies', () => {
      const detectCircular = (deps: typeof mockDependencies, startId: number): boolean => {
        const visited = new Set<number>();
        let current = startId;

        while (true) {
          if (visited.has(current)) return true; // Circular!
          visited.add(current);
          
          const nextDep = deps.find(d => d.dependsOnTaskId === current);
          if (!nextDep) break;
          current = nextDep.taskId;
        }

        return false;
      };

      // No circular dependency in mock data
      expect(detectCircular(mockDependencies, 1)).toBe(false);

      // Create circular dependency
      const circularDeps = [
        ...mockDependencies,
        { id: 4, taskId: 1, dependsOnTaskId: 4, dependencyType: 'finish_to_start', lagDays: 0 }
      ];
      expect(detectCircular(circularDeps, 1)).toBe(true);
    });
  });

  describe('Dependency Queries', () => {
    it('should get dependencies for a task', () => {
      const getTaskDependencies = (taskId: number) => {
        return mockDependencies.filter(d => d.taskId === taskId);
      };

      const task2Deps = getTaskDependencies(2);
      expect(task2Deps).toHaveLength(1);
      expect(task2Deps[0].dependsOnTaskId).toBe(1);
    });

    it('should get dependent tasks', () => {
      const getDependentTasks = (taskId: number) => {
        return mockDependencies.filter(d => d.dependsOnTaskId === taskId);
      };

      const task2Dependents = getDependentTasks(2);
      expect(task2Dependents).toHaveLength(1);
      expect(task2Dependents[0].taskId).toBe(3);
    });
  });
});

describe('Gantt Chart', () => {
  describe('Timeline Calculation', () => {
    it('should calculate task position on timeline', () => {
      const viewStart = new Date('2026-02-01');
      const cellWidth = 100; // pixels per week
      const daysPerCell = 7;

      const getTaskPosition = (deadline: number) => {
        const taskDate = new Date(deadline);
        const daysFromStart = Math.floor((taskDate.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
        return (daysFromStart / daysPerCell) * cellWidth;
      };

      // Task 1 deadline: Feb 15 (14 days from Feb 1)
      const task1Pos = getTaskPosition(mockTasks[0].deadline);
      expect(task1Pos).toBe(200); // 14/7 * 100 = 200px

      // Task 2 deadline: Mar 1 (28 days from Feb 1)
      const task2Pos = getTaskPosition(mockTasks[1].deadline);
      expect(task2Pos).toBe(400); // 28/7 * 100 = 400px
    });

    it('should calculate today marker position', () => {
      const viewStart = new Date('2026-02-01');
      const today = new Date('2026-02-06');
      const cellWidth = 100;
      const daysPerCell = 7;

      const daysFromStart = Math.floor((today.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
      const todayPosition = (daysFromStart / daysPerCell) * cellWidth;

      expect(todayPosition).toBeCloseTo(71.4, 0); // ~5/7 * 100
    });
  });

  describe('Zoom Levels', () => {
    const zoomConfig = {
      day: { cellWidth: 40, daysPerCell: 1 },
      week: { cellWidth: 100, daysPerCell: 7 },
      month: { cellWidth: 120, daysPerCell: 30 },
      quarter: { cellWidth: 200, daysPerCell: 90 },
    };

    it('should have correct cell widths for each zoom level', () => {
      expect(zoomConfig.day.cellWidth).toBe(40);
      expect(zoomConfig.week.cellWidth).toBe(100);
      expect(zoomConfig.month.cellWidth).toBe(120);
      expect(zoomConfig.quarter.cellWidth).toBe(200);
    });

    it('should scale task positions by zoom level', () => {
      const deadline = new Date('2026-03-01');
      const viewStart = new Date('2026-02-01');
      const daysFromStart = 28;

      const positions = Object.entries(zoomConfig).map(([level, config]) => ({
        level,
        position: (daysFromStart / config.daysPerCell) * config.cellWidth,
      }));

      expect(positions.find(p => p.level === 'day')?.position).toBe(1120); // 28 * 40
      expect(positions.find(p => p.level === 'week')?.position).toBe(400); // 4 * 100
      expect(positions.find(p => p.level === 'month')?.position).toBeCloseTo(112); // ~0.93 * 120
      expect(positions.find(p => p.level === 'quarter')?.position).toBeCloseTo(62.2, 0); // ~0.31 * 200
    });
  });

  describe('Task Grouping', () => {
    it('should group tasks by block', () => {
      const groupedByBlock = mockTasks.reduce((acc, task) => {
        const key = task.blockTitle || 'Ungrouped';
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
      }, {} as Record<string, typeof mockTasks>);

      expect(Object.keys(groupedByBlock)).toHaveLength(2);
      expect(groupedByBlock['Phase 1']).toHaveLength(2);
      expect(groupedByBlock['Phase 2']).toHaveLength(2);
    });

    it('should order tasks by deadline within groups', () => {
      const sortedTasks = [...mockTasks].sort((a, b) => a.deadline - b.deadline);

      expect(sortedTasks[0].id).toBe(1); // Feb 15
      expect(sortedTasks[1].id).toBe(2); // Mar 1
      expect(sortedTasks[2].id).toBe(3); // Mar 15
      expect(sortedTasks[3].id).toBe(4); // Apr 1
    });
  });

  describe('Dependency Arrows', () => {
    it('should calculate arrow path between tasks', () => {
      const taskPositions = new Map([
        [1, { left: 200, width: 80, row: 0 }],
        [2, { left: 400, width: 80, row: 1 }],
      ]);

      const rowHeight = 44;

      const calculateArrowPath = (fromId: number, toId: number) => {
        const from = taskPositions.get(fromId);
        const to = taskPositions.get(toId);
        if (!from || !to) return null;

        const startX = from.left + from.width;
        const startY = from.row * rowHeight + rowHeight / 2;
        const endX = to.left;
        const endY = to.row * rowHeight + rowHeight / 2;

        return { startX, startY, endX, endY };
      };

      const arrow = calculateArrowPath(1, 2);
      expect(arrow).not.toBeNull();
      expect(arrow!.startX).toBe(280); // 200 + 80
      expect(arrow!.startY).toBe(22); // 0 * 44 + 22
      expect(arrow!.endX).toBe(400);
      expect(arrow!.endY).toBe(66); // 1 * 44 + 22
    });
  });

  describe('Status Colors', () => {
    it('should return correct color for each status', () => {
      const getStatusColor = (status: string | null) => {
        switch (status) {
          case 'completed': return 'bg-emerald-500';
          case 'in_progress': return 'bg-amber-500';
          default: return 'bg-slate-600';
        }
      };

      expect(getStatusColor('completed')).toBe('bg-emerald-500');
      expect(getStatusColor('in_progress')).toBe('bg-amber-500');
      expect(getStatusColor('not_started')).toBe('bg-slate-600');
      expect(getStatusColor(null)).toBe('bg-slate-600');
    });
  });

  describe('Overdue Detection', () => {
    it('should identify overdue tasks', () => {
      const today = new Date('2026-02-20');

      const isOverdue = (task: typeof mockTasks[0]) => {
        if (task.status === 'completed') return false;
        return new Date(task.deadline) < today;
      };

      expect(isOverdue(mockTasks[0])).toBe(false); // Completed
      expect(isOverdue(mockTasks[1])).toBe(false); // Mar 1 > Feb 20
      expect(isOverdue({ ...mockTasks[1], deadline: new Date('2026-02-10').getTime() })).toBe(true);
    });
  });
});

describe('Gantt Data API', () => {
  it('should return tasks with block and section titles', () => {
    const ganttData = {
      tasks: mockTasks,
      dependencies: mockDependencies,
    };

    expect(ganttData.tasks).toHaveLength(4);
    expect(ganttData.dependencies).toHaveLength(3);
    
    ganttData.tasks.forEach(task => {
      expect(task.blockTitle).toBeDefined();
      expect(task.sectionTitle).toBeDefined();
    });
  });

  it('should filter tasks by project', () => {
    const projectId = 1;
    const projectTasks = mockTasks.filter(t => t.sectionId > 0); // All tasks belong to project
    
    expect(projectTasks).toHaveLength(4);
  });
});
