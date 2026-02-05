import { describe, it, expect } from 'vitest';

// ============ FILTER CHIP TESTS ============
describe('Deadline Filter Logic', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  function matchesDeadlineFilter(deadline: Date | string | null | undefined, filter: string): boolean {
    if (!deadline) return filter === 'all';
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(deadline);
    const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const diffTime = deadlineDay.getTime() - todayStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (filter) {
      case 'all':
        return true;
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays >= 0 && diffDays <= 7;
      case 'overdue':
        return diffDays < 0;
      default:
        return true;
    }
  }

  it('should match all tasks with "all" filter', () => {
    expect(matchesDeadlineFilter(today, 'all')).toBe(true);
    expect(matchesDeadlineFilter(yesterday, 'all')).toBe(true);
    expect(matchesDeadlineFilter(null, 'all')).toBe(true);
  });

  it('should match only today tasks with "today" filter', () => {
    expect(matchesDeadlineFilter(today, 'today')).toBe(true);
    expect(matchesDeadlineFilter(tomorrow, 'today')).toBe(false);
    expect(matchesDeadlineFilter(yesterday, 'today')).toBe(false);
  });

  it('should match tasks within 7 days with "week" filter', () => {
    expect(matchesDeadlineFilter(today, 'week')).toBe(true);
    expect(matchesDeadlineFilter(tomorrow, 'week')).toBe(true);
    expect(matchesDeadlineFilter(nextWeek, 'week')).toBe(true);
    expect(matchesDeadlineFilter(yesterday, 'week')).toBe(false);
  });

  it('should match overdue tasks with "overdue" filter', () => {
    expect(matchesDeadlineFilter(yesterday, 'overdue')).toBe(true);
    expect(matchesDeadlineFilter(lastWeek, 'overdue')).toBe(true);
    expect(matchesDeadlineFilter(today, 'overdue')).toBe(false);
    expect(matchesDeadlineFilter(tomorrow, 'overdue')).toBe(false);
  });
});

// ============ SORT LOGIC TESTS ============
describe('Priority Sorting Logic', () => {
  interface Task {
    id: number;
    title: string;
    priority?: 'critical' | 'high' | 'medium' | 'low' | null;
    deadline?: Date | string | null;
    createdAt?: Date | string | null;
  }

  function sortTasks(tasks: Task[], field: string, direction: 'asc' | 'desc'): Task[] {
    const sorted = [...tasks].sort((a, b) => {
      let comparison = 0;

      switch (field) {
        case 'priority': {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aVal = priorityOrder[a.priority || 'medium'] || 2;
          const bVal = priorityOrder[b.priority || 'medium'] || 2;
          comparison = bVal - aVal;
          break;
        }
        case 'deadline': {
          const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        }
        case 'title': {
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        }
        case 'createdAt': {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = bDate - aDate;
          break;
        }
      }

      return direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  const tasks: Task[] = [
    { id: 1, title: 'Task A', priority: 'low' },
    { id: 2, title: 'Task B', priority: 'critical' },
    { id: 3, title: 'Task C', priority: 'medium' },
    { id: 4, title: 'Task D', priority: 'high' },
  ];

  it('should sort by priority descending (critical first)', () => {
    const sorted = sortTasks(tasks, 'priority', 'asc'); // asc gives critical first due to bVal - aVal
    expect(sorted[0].priority).toBe('critical');
    expect(sorted[1].priority).toBe('high');
    expect(sorted[2].priority).toBe('medium');
    expect(sorted[3].priority).toBe('low');
  });

  it('should sort by priority ascending (low first)', () => {
    const sorted = sortTasks(tasks, 'priority', 'desc'); // desc reverses, giving low first
    expect(sorted[0].priority).toBe('low');
    expect(sorted[3].priority).toBe('critical');
  });

  it('should sort by title alphabetically', () => {
    const sorted = sortTasks(tasks, 'title', 'asc');
    expect(sorted[0].title).toBe('Task A');
    expect(sorted[1].title).toBe('Task B');
    expect(sorted[2].title).toBe('Task C');
    expect(sorted[3].title).toBe('Task D');
  });

  it('should sort by deadline (earliest first)', () => {
    const tasksWithDeadlines: Task[] = [
      { id: 1, title: 'Task 1', deadline: '2026-02-10' },
      { id: 2, title: 'Task 2', deadline: '2026-02-05' },
      { id: 3, title: 'Task 3', deadline: '2026-02-15' },
    ];
    const sorted = sortTasks(tasksWithDeadlines, 'deadline', 'asc');
    expect(sorted[0].id).toBe(2);
    expect(sorted[1].id).toBe(1);
    expect(sorted[2].id).toBe(3);
  });
});

// ============ OVERDUE DETECTION TESTS ============
describe('Overdue Task Detection', () => {
  function isOverdue(deadline: Date | string | null | undefined, status: string | null): boolean {
    if (!deadline || status === 'completed') return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineDate = new Date(deadline);
    const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    
    return deadlineDay < today;
  }

  it('should detect overdue tasks', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    expect(isOverdue(yesterday, 'not_started')).toBe(true);
    expect(isOverdue(yesterday, 'in_progress')).toBe(true);
  });

  it('should not mark completed tasks as overdue', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    expect(isOverdue(yesterday, 'completed')).toBe(false);
  });

  it('should not mark future tasks as overdue', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    expect(isOverdue(tomorrow, 'not_started')).toBe(false);
  });

  it('should not mark tasks without deadline as overdue', () => {
    expect(isOverdue(null, 'not_started')).toBe(false);
    expect(isOverdue(undefined, 'in_progress')).toBe(false);
  });
});

// ============ SUBTASK PROGRESS TESTS ============
describe('Subtask Progress Calculation', () => {
  interface Subtask {
    id: number;
    status: 'not_started' | 'in_progress' | 'completed';
  }

  function calculateProgress(subtasks: Subtask[]): { completed: number; total: number; percent: number } {
    const total = subtasks.length;
    const completed = subtasks.filter(s => s.status === 'completed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }

  it('should calculate 0% for empty subtasks', () => {
    const result = calculateProgress([]);
    expect(result.percent).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should calculate correct percentage', () => {
    const subtasks: Subtask[] = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'not_started' },
      { id: 4, status: 'in_progress' },
    ];
    const result = calculateProgress(subtasks);
    expect(result.completed).toBe(2);
    expect(result.total).toBe(4);
    expect(result.percent).toBe(50);
  });

  it('should calculate 100% when all completed', () => {
    const subtasks: Subtask[] = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'completed' },
    ];
    const result = calculateProgress(subtasks);
    expect(result.percent).toBe(100);
  });
});

// ============ DEPENDENCY STATUS TESTS ============
describe('Dependency Status Logic', () => {
  interface Task {
    id: number;
    status: string | null;
    dependencies?: number[] | null;
  }

  function getDependencyStatus(task: Task, allTasks: Task[]): 'blocked' | 'ready' | 'no_deps' {
    if (!task.dependencies || task.dependencies.length === 0) {
      return 'no_deps';
    }

    const incompleteDeps = task.dependencies.filter(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask && depTask.status !== 'completed';
    });

    return incompleteDeps.length > 0 ? 'blocked' : 'ready';
  }

  const allTasks: Task[] = [
    { id: 1, status: 'completed', dependencies: null },
    { id: 2, status: 'not_started', dependencies: null },
    { id: 3, status: 'not_started', dependencies: [1] },
    { id: 4, status: 'not_started', dependencies: [2] },
    { id: 5, status: 'not_started', dependencies: [1, 2] },
  ];

  it('should return no_deps for tasks without dependencies', () => {
    expect(getDependencyStatus(allTasks[0], allTasks)).toBe('no_deps');
    expect(getDependencyStatus(allTasks[1], allTasks)).toBe('no_deps');
  });

  it('should return ready when all dependencies are completed', () => {
    expect(getDependencyStatus(allTasks[2], allTasks)).toBe('ready');
  });

  it('should return blocked when any dependency is incomplete', () => {
    expect(getDependencyStatus(allTasks[3], allTasks)).toBe('blocked');
    expect(getDependencyStatus(allTasks[4], allTasks)).toBe('blocked');
  });
});
