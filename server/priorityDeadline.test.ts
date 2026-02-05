import { describe, it, expect, vi } from 'vitest';

// Test priority badge color mapping
describe('Priority Badge Colors', () => {
  const priorityColors = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
  };

  it('should have correct colors for critical priority', () => {
    expect(priorityColors.critical.text).toBe('text-red-400');
    expect(priorityColors.critical.bg).toContain('red-500');
  });

  it('should have correct colors for high priority', () => {
    expect(priorityColors.high.text).toBe('text-orange-400');
    expect(priorityColors.high.bg).toContain('orange-500');
  });

  it('should have correct colors for medium priority', () => {
    expect(priorityColors.medium.text).toBe('text-yellow-400');
    expect(priorityColors.medium.bg).toContain('yellow-500');
  });

  it('should have correct colors for low priority', () => {
    expect(priorityColors.low.text).toBe('text-slate-400');
    expect(priorityColors.low.bg).toContain('slate-500');
  });
});

// Test deadline status calculation
describe('Deadline Status Calculation', () => {
  const getDeadlineStatus = (deadline: Date | string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'overdue', daysOverdue: Math.abs(diffDays), color: 'red' };
    } else if (diffDays <= 3) {
      return { status: 'due_soon', daysRemaining: diffDays, color: 'orange' };
    } else {
      return { status: 'on_track', daysRemaining: diffDays, color: 'emerald' };
    }
  };

  it('should return overdue status for past deadlines', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const result = getDeadlineStatus(pastDate);
    expect(result.status).toBe('overdue');
    expect(result.color).toBe('red');
  });

  it('should return due_soon status for deadlines within 3 days', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 2);
    const result = getDeadlineStatus(soonDate);
    expect(result.status).toBe('due_soon');
    expect(result.color).toBe('orange');
  });

  it('should return on_track status for deadlines more than 3 days away', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const result = getDeadlineStatus(futureDate);
    expect(result.status).toBe('on_track');
    expect(result.color).toBe('emerald');
  });

  it('should handle string date input', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const result = getDeadlineStatus(futureDate.toISOString());
    expect(result.status).toBe('on_track');
  });
});

// Test dependencies logic
describe('Task Dependencies Logic', () => {
  const tasks = [
    { id: 1, title: 'Task 1', status: 'completed', dependencies: null },
    { id: 2, title: 'Task 2', status: 'in_progress', dependencies: [1] },
    { id: 3, title: 'Task 3', status: 'not_started', dependencies: [1, 2] },
    { id: 4, title: 'Task 4', status: 'not_started', dependencies: null },
  ];

  const isTaskBlocked = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return false;
    }
    return task.dependencies.some(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && depTask.status !== 'completed';
    });
  };

  const getBlockingTasks = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.dependencies) return [];
    return task.dependencies
      .map(depId => tasks.find(t => t.id === depId))
      .filter(t => t && t.status !== 'completed');
  };

  it('should return false for task with no dependencies', () => {
    expect(isTaskBlocked(1)).toBe(false);
    expect(isTaskBlocked(4)).toBe(false);
  });

  it('should return false for task with all completed dependencies', () => {
    expect(isTaskBlocked(2)).toBe(false);
  });

  it('should return true for task with incomplete dependencies', () => {
    expect(isTaskBlocked(3)).toBe(true);
  });

  it('should return blocking tasks correctly', () => {
    const blocking = getBlockingTasks(3);
    expect(blocking.length).toBe(1);
    expect(blocking[0]?.id).toBe(2);
  });

  it('should return empty array for task with no blocking dependencies', () => {
    const blocking = getBlockingTasks(2);
    expect(blocking.length).toBe(0);
  });
});

// Test notification message generation
describe('Deadline Notification Messages', () => {
  const generateDeadlineMessage = (taskTitle: string, daysRemaining: number) => {
    if (daysRemaining === 0) {
      return `Задача "${taskTitle}" должна быть выполнена сегодня!`;
    } else if (daysRemaining === 1) {
      return `Задача "${taskTitle}" должна быть выполнена завтра!`;
    } else {
      return `Задача "${taskTitle}" должна быть выполнена через ${daysRemaining} дней`;
    }
  };

  const generateOverdueMessage = (taskTitle: string, daysOverdue: number) => {
    if (daysOverdue === 1) {
      return `Задача "${taskTitle}" просрочена на 1 день`;
    }
    return `Задача "${taskTitle}" просрочена на ${daysOverdue} дней`;
  };

  it('should generate correct message for today deadline', () => {
    const message = generateDeadlineMessage('Test Task', 0);
    expect(message).toContain('сегодня');
  });

  it('should generate correct message for tomorrow deadline', () => {
    const message = generateDeadlineMessage('Test Task', 1);
    expect(message).toContain('завтра');
  });

  it('should generate correct message for future deadline', () => {
    const message = generateDeadlineMessage('Test Task', 5);
    expect(message).toContain('через 5 дней');
  });

  it('should generate correct message for 1 day overdue', () => {
    const message = generateOverdueMessage('Test Task', 1);
    expect(message).toContain('на 1 день');
  });

  it('should generate correct message for multiple days overdue', () => {
    const message = generateOverdueMessage('Test Task', 3);
    expect(message).toContain('на 3 дней');
  });
});
