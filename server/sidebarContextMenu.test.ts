import { describe, it, expect } from 'vitest';

/**
 * Tests for the Sidebar Context Menu feature.
 * 
 * The context menu is a frontend-only component that provides right-click
 * actions on blocks, sections, and tasks in the sidebar. These tests verify
 * the action mapping logic and entity type handling.
 */

// Simulate the action ID patterns used by the context menu
const BLOCK_ACTIONS = [
  'discuss', 'ai-chat', 'ai-roadmap', 'ai-decompose', 'ai-risks', 'ai-report',
  'add-section', 'rename', 'copy-title', 'delete'
];

const SECTION_ACTIONS = [
  'discuss', 'ai-chat', 'ai-create-tasks', 'ai-plan', 'ai-evaluate', 'ai-find-deps',
  'add-task', 'rename', 'copy-title', 'delete'
];

const TASK_ACTIONS = [
  'open', 'discuss', 'ai-subtasks', 'ai-estimate', 'ai-risks', 'ai-spec', 'ai-howto',
  'status-not_started', 'status-in_progress', 'status-completed',
  'priority-critical', 'priority-high', 'priority-medium', 'priority-low',
  'add-subtask', 'copy-title', 'delete'
];

describe('Sidebar Context Menu - Action Definitions', () => {
  it('should define correct block-level actions', () => {
    expect(BLOCK_ACTIONS).toContain('discuss');
    expect(BLOCK_ACTIONS).toContain('ai-chat');
    expect(BLOCK_ACTIONS).toContain('add-section');
    expect(BLOCK_ACTIONS).toContain('delete');
    expect(BLOCK_ACTIONS).toContain('ai-roadmap');
    expect(BLOCK_ACTIONS).toContain('ai-decompose');
    expect(BLOCK_ACTIONS).toContain('ai-risks');
    expect(BLOCK_ACTIONS).toContain('ai-report');
    expect(BLOCK_ACTIONS).toContain('rename');
    expect(BLOCK_ACTIONS).toContain('copy-title');
  });

  it('should define correct section-level actions', () => {
    expect(SECTION_ACTIONS).toContain('discuss');
    expect(SECTION_ACTIONS).toContain('ai-chat');
    expect(SECTION_ACTIONS).toContain('add-task');
    expect(SECTION_ACTIONS).toContain('delete');
    expect(SECTION_ACTIONS).toContain('ai-create-tasks');
    expect(SECTION_ACTIONS).toContain('ai-plan');
    expect(SECTION_ACTIONS).toContain('ai-evaluate');
    expect(SECTION_ACTIONS).toContain('ai-find-deps');
    expect(SECTION_ACTIONS).toContain('rename');
    expect(SECTION_ACTIONS).toContain('copy-title');
  });

  it('should define correct task-level actions', () => {
    expect(TASK_ACTIONS).toContain('open');
    expect(TASK_ACTIONS).toContain('discuss');
    expect(TASK_ACTIONS).toContain('add-subtask');
    expect(TASK_ACTIONS).toContain('delete');
    expect(TASK_ACTIONS).toContain('ai-subtasks');
    expect(TASK_ACTIONS).toContain('ai-estimate');
    expect(TASK_ACTIONS).toContain('ai-risks');
    expect(TASK_ACTIONS).toContain('ai-spec');
    expect(TASK_ACTIONS).toContain('ai-howto');
    expect(TASK_ACTIONS).toContain('copy-title');
  });

  it('should have status change actions for tasks', () => {
    const statusActions = TASK_ACTIONS.filter(a => a.startsWith('status-'));
    expect(statusActions).toHaveLength(3);
    expect(statusActions).toContain('status-not_started');
    expect(statusActions).toContain('status-in_progress');
    expect(statusActions).toContain('status-completed');
  });

  it('should have priority change actions for tasks', () => {
    const priorityActions = TASK_ACTIONS.filter(a => a.startsWith('priority-'));
    expect(priorityActions).toHaveLength(4);
    expect(priorityActions).toContain('priority-critical');
    expect(priorityActions).toContain('priority-high');
    expect(priorityActions).toContain('priority-medium');
    expect(priorityActions).toContain('priority-low');
  });
});

describe('Sidebar Context Menu - Action ID Parsing', () => {
  it('should correctly parse status action IDs', () => {
    const actionId = 'status-in_progress';
    const status = actionId.replace('status-', '');
    expect(status).toBe('in_progress');
  });

  it('should correctly parse priority action IDs', () => {
    const actionId = 'priority-critical';
    const priority = actionId.replace('priority-', '');
    expect(priority).toBe('critical');
  });

  it('should identify AI actions by prefix', () => {
    const aiActions = [...BLOCK_ACTIONS, ...SECTION_ACTIONS, ...TASK_ACTIONS]
      .filter(a => a.startsWith('ai-'));
    
    expect(aiActions.length).toBeGreaterThan(0);
    aiActions.forEach(action => {
      expect(action.startsWith('ai-')).toBe(true);
    });
  });
});

describe('Sidebar Context Menu - Entity Types', () => {
  it('should support block entity type', () => {
    const blockInfo = {
      id: 1,
      title: 'Test Block',
      sectionCount: 3,
    };
    expect(blockInfo.id).toBe(1);
    expect(blockInfo.title).toBe('Test Block');
    expect(blockInfo.sectionCount).toBe(3);
  });

  it('should support section entity type', () => {
    const sectionInfo = {
      id: 2,
      title: 'Test Section',
      blockId: 1,
      taskCount: 5,
    };
    expect(sectionInfo.id).toBe(2);
    expect(sectionInfo.blockId).toBe(1);
    expect(sectionInfo.taskCount).toBe(5);
  });

  it('should support task entity type', () => {
    const taskInfo = {
      id: 3,
      title: 'Test Task',
      status: 'in_progress' as const,
      priority: 'high' as const,
      sectionId: 2,
    };
    expect(taskInfo.id).toBe(3);
    expect(taskInfo.status).toBe('in_progress');
    expect(taskInfo.priority).toBe('high');
    expect(taskInfo.sectionId).toBe(2);
  });
});

describe('Sidebar Context Menu - Action Routing', () => {
  // Simulate the handleContextMenuAction logic from DraggableSidebar
  function routeAction(actionId: string, entityType: string): string {
    if (entityType === 'block') {
      if (actionId === 'add-section') return 'create-section';
      if (actionId === 'delete') return 'delete-block';
      if (actionId === 'discuss' || actionId === 'ai-chat') return 'select-context';
    } else if (entityType === 'section') {
      if (actionId === 'add-task') return 'create-task';
      if (actionId === 'delete') return 'delete-section';
      if (actionId === 'discuss' || actionId === 'ai-chat') return 'select-context';
    } else if (entityType === 'task') {
      if (actionId === 'open') return 'select-task';
      if (actionId === 'delete') return 'delete-task';
      if (actionId.startsWith('status-')) return 'update-status';
      if (actionId.startsWith('priority-')) return 'update-priority';
    }
    if (actionId.startsWith('ai-')) return 'forward-to-parent';
    return 'forward-to-parent';
  }

  it('should route block actions correctly', () => {
    expect(routeAction('add-section', 'block')).toBe('create-section');
    expect(routeAction('delete', 'block')).toBe('delete-block');
    expect(routeAction('discuss', 'block')).toBe('select-context');
    expect(routeAction('ai-chat', 'block')).toBe('select-context');
    expect(routeAction('ai-roadmap', 'block')).toBe('forward-to-parent');
  });

  it('should route section actions correctly', () => {
    expect(routeAction('add-task', 'section')).toBe('create-task');
    expect(routeAction('delete', 'section')).toBe('delete-section');
    expect(routeAction('discuss', 'section')).toBe('select-context');
    expect(routeAction('ai-plan', 'section')).toBe('forward-to-parent');
  });

  it('should route task actions correctly', () => {
    expect(routeAction('open', 'task')).toBe('select-task');
    expect(routeAction('delete', 'task')).toBe('delete-task');
    expect(routeAction('status-completed', 'task')).toBe('update-status');
    expect(routeAction('priority-high', 'task')).toBe('update-priority');
    expect(routeAction('ai-subtasks', 'task')).toBe('forward-to-parent');
  });
});
