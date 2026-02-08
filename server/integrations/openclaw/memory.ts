/**
 * OpenClaw Memory Integration
 *
 * Syncs project context, decisions, and team knowledge
 * with OpenClaw's persistent memory for AI context.
 */

import { getOpenClawClient } from './client';
import { getDb } from '../../db';
import { projects, tasks, users, projectMembers } from '../../../drizzle/schema';
import { logger } from '../../utils/logger';
import { eq, desc, and } from 'drizzle-orm';
import type { MemorySearchResult } from './types';

/**
 * Memory entry types
 */
export type MemoryType =
  | 'project_context'
  | 'task_decision'
  | 'team_info'
  | 'workflow_pattern'
  | 'user_preference';

/**
 * Memory entry
 */
export interface MemoryEntry {
  type: MemoryType;
  content: string;
  metadata: {
    projectId?: number;
    taskId?: number;
    userId?: number;
    timestamp: string;
    tags?: string[];
  };
}

/**
 * Memory Manager Class
 */
export class MemoryManager {
  private client = getOpenClawClient();

  /**
   * Store memory entry in OpenClaw
   */
  async store(entry: MemoryEntry): Promise<boolean> {
    if (!this.client.isEnabled()) {
      logger.memory.info('[Memory] OpenClaw disabled, skipping memory store');
      return false;
    }

    try {
      // Format content with metadata
      const formattedContent = this.formatMemoryContent(entry);

      // Store via agent with memory flag
      const response = await this.client.runAgent(
        `Remember this for future context: ${formattedContent}`,
        {
          agentId: 'memory-writer',
          thinking: 'off',
          timeout: 30,
        }
      );

      return response.success;
    } catch (error) {
      logger.memory.error('[Memory] Failed to store entry:', error as Error);
      return false;
    }
  }

  /**
   * Search memory for relevant context
   */
  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    if (!this.client.isEnabled()) {
      return [];
    }

    return this.client.searchMemory(query, limit);
  }

  /**
   * Sync project context to memory
   */
  async syncProjectContext(projectId: number): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    // Get project details
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return false;

    // Get project members
    const members = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        userName: users.name,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));

    // Get recent tasks summary
    const recentTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.sectionId, projectId)) // Simplified - would need proper join
      .orderBy(desc(tasks.createdAt))
      .limit(10);

    const context = `
Project: ${project.name}
Description: ${project.description || 'No description'}
Team: ${members.map((m: { userName: string | null; role: string | null }) => `${m.userName} (${m.role})`).join(', ')}
Recent activity: ${recentTasks.length} recent tasks
Status: Active
    `.trim();

    return this.store({
      type: 'project_context',
      content: context,
      metadata: {
        projectId,
        timestamp: new Date().toISOString(),
        tags: ['project', 'context', project.name],
      },
    });
  }

  /**
   * Store task decision/resolution
   */
  async storeTaskDecision(
    taskId: number,
    decision: string,
    reasoning?: string
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return false;

    const content = `
Task: ${task.title} (#${taskId})
Decision: ${decision}
${reasoning ? `Reasoning: ${reasoning}` : ''}
Date: ${new Date().toISOString()}
    `.trim();

    return this.store({
      type: 'task_decision',
      content,
      metadata: {
        taskId,
        timestamp: new Date().toISOString(),
        tags: ['task', 'decision'],
      },
    });
  }

  /**
   * Store team information
   */
  async storeTeamInfo(
    userId: number,
    info: {
      expertise?: string[];
      workingHours?: string;
      preferences?: string;
    }
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return false;

    const content = `
Team Member: ${user.name || user.email}
${info.expertise ? `Expertise: ${info.expertise.join(', ')}` : ''}
${info.workingHours ? `Working Hours: ${info.workingHours}` : ''}
${info.preferences ? `Preferences: ${info.preferences}` : ''}
    `.trim();

    return this.store({
      type: 'team_info',
      content,
      metadata: {
        userId,
        timestamp: new Date().toISOString(),
        tags: ['team', 'member', user.name || 'user'],
      },
    });
  }

  /**
   * Store workflow pattern
   */
  async storeWorkflowPattern(
    name: string,
    description: string,
    steps: string[]
  ): Promise<boolean> {
    const content = `
Workflow: ${name}
Description: ${description}
Steps:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
    `.trim();

    return this.store({
      type: 'workflow_pattern',
      content,
      metadata: {
        timestamp: new Date().toISOString(),
        tags: ['workflow', 'pattern', name],
      },
    });
  }

  /**
   * Get relevant context for a task
   */
  async getTaskContext(taskId: number): Promise<string> {
    const db = await getDb();
    if (!db) return '';

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return '';

    // Search memory for related context
    const results = await this.search(`task ${task.title}`, 3);

    if (results.length === 0) {
      return '';
    }

    return results
      .map(r => r.content)
      .join('\n\n---\n\n');
  }

  /**
   * Get relevant context for a project
   */
  async getProjectContext(projectId: number): Promise<string> {
    const db = await getDb();
    if (!db) return '';

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return '';

    // Search memory for project context
    const results = await this.search(`project ${project.name}`, 5);

    if (results.length === 0) {
      return '';
    }

    return results
      .map(r => r.content)
      .join('\n\n---\n\n');
  }

  /**
   * Format memory content with type prefix
   */
  private formatMemoryContent(entry: MemoryEntry): string {
    const typeLabels: Record<MemoryType, string> = {
      project_context: '[PROJECT]',
      task_decision: '[DECISION]',
      team_info: '[TEAM]',
      workflow_pattern: '[WORKFLOW]',
      user_preference: '[PREFERENCE]',
    };

    const label = typeLabels[entry.type];
    const tags = entry.metadata.tags?.length
      ? `Tags: ${entry.metadata.tags.join(', ')}`
      : '';

    return `${label} ${entry.content}\n${tags}`.trim();
  }

  /**
   * Bulk sync all projects
   */
  async syncAllProjects(): Promise<{ synced: number; failed: number }> {
    const db = await getDb();
    if (!db) return { synced: 0, failed: 0 };

    const allProjects = await db.select().from(projects);

    let synced = 0;
    let failed = 0;

    for (const project of allProjects) {
      const success = await this.syncProjectContext(project.id);
      if (success) synced++;
      else failed++;
    }

    return { synced, failed };
  }
}

// Singleton instance
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}
