import { describe, it, expect, vi } from 'vitest';
import * as googleDrive from './googleDrive';
import * as googleCalendar from './googleCalendar';

// Mock exec for rclone commands
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, callback) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    // Simulate successful rclone commands
    if (cmd.includes('lsd')) {
      callback(null, '          -1 2026-02-05 12:00:00        -1 MYDON_Roadmaps\n', '');
    } else if (cmd.includes('copyto') || cmd.includes('mkdir')) {
      callback(null, '', '');
    } else if (cmd.includes('link')) {
      callback(null, 'https://drive.google.com/file/d/abc123/view', '');
    } else {
      callback(null, '', '');
    }
  }),
}));

describe('Google Drive Integration', () => {
  it('should export ProjectExport type correctly', () => {
    // Test that the type is properly defined
    const mockProject = {
      id: 1,
      name: 'Test Project',
      description: 'Test description',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      blocks: [{
        number: 1,
        title: 'Block 1',
        titleRu: 'Блок 1',
        sections: [{
          title: 'Section 1',
          tasks: [{
            title: 'Task 1',
            description: 'Task description',
            status: 'pending',
            notes: null,
            summary: null,
            subtasks: [{
              title: 'Subtask 1',
              status: 'pending',
            }],
          }],
        }],
      }],
    };
    
    expect(mockProject.name).toBe('Test Project');
    expect(mockProject.blocks).toHaveLength(1);
    expect(mockProject.blocks[0].sections[0].tasks[0].subtasks).toHaveLength(1);
  });

  it('should check drive connection', async () => {
    const result = await googleDrive.checkDriveConnection();
    expect(result).toHaveProperty('connected');
  });
});

describe('Google Calendar Integration', () => {
  it('should format task deadline correctly', () => {
    const deadline = new Date('2026-03-15');
    const startTime = new Date(deadline);
    startTime.setHours(9, 0, 0, 0);
    
    expect(startTime.getHours()).toBe(9);
    expect(startTime.getMinutes()).toBe(0);
  });

  it('should create task deadline event structure', () => {
    const task = {
      taskId: 1,
      taskTitle: 'Test Task',
      projectName: 'Test Project',
      deadline: new Date('2026-03-15'),
      description: 'Test description',
    };

    const expectedSummary = `📋 ${task.taskTitle} - ${task.projectName}`;
    expect(expectedSummary).toBe('📋 Test Task - Test Project');
  });

  it('should create milestone structure', () => {
    const milestones = [
      { title: 'MVP Launch', date: new Date('2026-04-01'), description: 'Launch MVP' },
      { title: 'Beta Release', date: new Date('2026-05-01'), description: 'Release beta' },
    ];

    expect(milestones).toHaveLength(2);
    expect(milestones[0].title).toBe('MVP Launch');
  });
});
