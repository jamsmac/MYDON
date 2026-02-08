/**
 * OpenClaw Smart AI Features
 *
 * Advanced AI-powered features for MYDON:
 * - Auto-prioritization
 * - Smart reminders
 * - Task similarity detection
 * - Workload balancing
 * - Intelligent scheduling
 */

import { getDb } from '../../db';
import { tasks, users, projectMembers } from '../../../drizzle/schema';
import { eq, and, or, desc, asc } from 'drizzle-orm';
import { complete, structured } from './ai';
import { getMemoryManager } from './memory';
import type { InferSelectModel } from 'drizzle-orm';

type TaskRecord = InferSelectModel<typeof tasks>;

/**
 * Priority suggestion with reasoning
 */
export interface PrioritySuggestion {
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  reasoning: string;
  factors: string[];
}

/**
 * Task similarity result
 */
export interface SimilarTask {
  taskId: number;
  title: string;
  similarity: number; // 0-1
  status: string;
}

/**
 * Workload analysis
 */
export interface WorkloadAnalysis {
  userId: number;
  userName: string;
  currentLoad: number; // 0-100
  activeTasks: number;
  highPriorityTasks: number;
  recommendation: 'available' | 'moderate' | 'overloaded';
}

/**
 * Smart scheduling suggestion
 */
export interface ScheduleSuggestion {
  suggestedDate: Date;
  reasoning: string;
  conflicts: string[];
  alternativeDates: Date[];
}

/**
 * Smart Features Manager
 */
export class SmartFeatures {
  private memory = getMemoryManager();

  /**
   * Auto-prioritize a task based on various factors
   */
  async autoPrioritize(
    taskId: number,
    context?: { projectId?: number; deadline?: Date }
  ): Promise<PrioritySuggestion | null> {
    const db = await getDb();
    if (!db) return null;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return null;

    // Gather context
    const factors: string[] = [];
    let urgencyScore = 0;

    // Factor 1: Deadline proximity
    if (task.deadline) {
      const daysUntilDeadline = Math.ceil(
        (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDeadline < 0) {
        factors.push('⚠️ Просрочено');
        urgencyScore += 40;
      } else if (daysUntilDeadline <= 1) {
        factors.push('🔴 Дедлайн сегодня/завтра');
        urgencyScore += 30;
      } else if (daysUntilDeadline <= 3) {
        factors.push('🟠 Дедлайн через 3 дня');
        urgencyScore += 20;
      } else if (daysUntilDeadline <= 7) {
        factors.push('🟡 Дедлайн на этой неделе');
        urgencyScore += 10;
      }
    }

    // Factor 2: Dependencies (if this task blocks others)
    const dependentTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.sectionId, task.sectionId));

    const blockedCount = dependentTasks.filter((t: TaskRecord) => {
      const deps = t.dependencies as number[] | null;
      return deps && deps.includes(taskId);
    }).length;

    if (blockedCount > 2) {
      factors.push(`🔗 Блокирует ${blockedCount} задач`);
      urgencyScore += 25;
    } else if (blockedCount > 0) {
      factors.push(`🔗 Блокирует ${blockedCount} задачу`);
      urgencyScore += 15;
    }

    // Factor 3: Title keywords
    const criticalKeywords = ['срочно', 'критично', 'asap', 'urgent', 'баг', 'bug', 'сломан', 'broken'];
    const highKeywords = ['важно', 'important', 'нужно', 'required'];

    const titleLower = task.title.toLowerCase();
    if (criticalKeywords.some(k => titleLower.includes(k))) {
      factors.push('📛 Критичные ключевые слова в названии');
      urgencyScore += 30;
    } else if (highKeywords.some(k => titleLower.includes(k))) {
      factors.push('📌 Важные ключевые слова в названии');
      urgencyScore += 15;
    }

    // Determine priority based on score
    let priority: 'low' | 'medium' | 'high' | 'critical';
    if (urgencyScore >= 60) {
      priority = 'critical';
    } else if (urgencyScore >= 40) {
      priority = 'high';
    } else if (urgencyScore >= 20) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Calculate confidence
    const confidence = Math.min(0.5 + (factors.length * 0.15), 0.95);

    // Generate reasoning
    const reasoning = factors.length > 0
      ? `Приоритет определён на основе: ${factors.join(', ')}`
      : 'Стандартный приоритет - нет критичных факторов';

    return {
      priority,
      confidence,
      reasoning,
      factors,
    };
  }

  /**
   * Find similar tasks (for deduplication or reference)
   */
  async findSimilarTasks(
    taskId: number,
    limit = 5
  ): Promise<SimilarTask[]> {
    const db = await getDb();
    if (!db) return [];

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return [];

    // Get all tasks from the same project (via section)
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.sectionId, task.sectionId));

    // Simple similarity based on title words
    const taskWords = new Set<string>(
      task.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
    );

    const similarities: SimilarTask[] = [];

    for (const other of allTasks) {
      if (other.id === taskId) continue;

      const otherWords = new Set<string>(
        other.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2)
      );

      // Calculate Jaccard similarity
      const taskWordsArray = Array.from(taskWords);
      const intersection = taskWordsArray.filter((w: string) => otherWords.has(w)).length;
      const unionSet = new Set<string>([...taskWordsArray, ...Array.from(otherWords)]);
      const union = unionSet.size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity > 0.2) { // Threshold
        similarities.push({
          taskId: other.id,
          title: other.title,
          similarity,
          status: other.status || 'not_started',
        });
      }
    }

    // Sort by similarity and limit
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Analyze team workload
   */
  async analyzeWorkload(projectId: number): Promise<WorkloadAnalysis[]> {
    const db = await getDb();
    if (!db) return [];

    // Get project members
    const members = await db
      .select({
        userId: projectMembers.userId,
        userName: users.name,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));

    const analyses: WorkloadAnalysis[] = [];

    for (const member of members) {
      // Get member's active tasks
      const memberTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.assignedTo, member.userId),
            or(
              eq(tasks.status, 'not_started'),
              eq(tasks.status, 'in_progress')
            )
          )
        );

      const activeTasks = memberTasks.length;
      const highPriorityTasks = memberTasks.filter(
        (t: TaskRecord) => t.priority === 'high' || t.priority === 'critical'
      ).length;

      // Calculate load (simplified: 10 tasks = 100% load)
      const currentLoad = Math.min(activeTasks * 10, 100);

      let recommendation: 'available' | 'moderate' | 'overloaded';
      if (currentLoad <= 40) {
        recommendation = 'available';
      } else if (currentLoad <= 70) {
        recommendation = 'moderate';
      } else {
        recommendation = 'overloaded';
      }

      analyses.push({
        userId: member.userId,
        userName: member.userName || 'Unknown',
        currentLoad,
        activeTasks,
        highPriorityTasks,
        recommendation,
      });
    }

    return analyses.sort((a, b) => a.currentLoad - b.currentLoad);
  }

  /**
   * Suggest best assignee for a task
   */
  async suggestAssignee(
    taskId: number,
    projectId: number
  ): Promise<{ userId: number; userName: string; reason: string } | null> {
    const workload = await this.analyzeWorkload(projectId);

    if (workload.length === 0) return null;

    // Find available team member with lowest load
    const available = workload.filter(w => w.recommendation === 'available');

    if (available.length > 0) {
      const best = available[0];
      return {
        userId: best.userId,
        userName: best.userName,
        reason: `Наименьшая загрузка (${best.activeTasks} активных задач)`,
      };
    }

    // Fall back to moderate load
    const moderate = workload.filter(w => w.recommendation === 'moderate');
    if (moderate.length > 0) {
      const best = moderate[0];
      return {
        userId: best.userId,
        userName: best.userName,
        reason: `Умеренная загрузка (${best.activeTasks} активных задач)`,
      };
    }

    // Everyone is overloaded
    const least = workload[0];
    return {
      userId: least.userId,
      userName: least.userName,
      reason: `Все перегружены, наименьшая загрузка у ${least.userName}`,
    };
  }

  /**
   * Smart scheduling suggestion
   */
  async suggestSchedule(
    taskId: number,
    estimatedHours?: number
  ): Promise<ScheduleSuggestion | null> {
    const db = await getDb();
    if (!db) return null;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return null;

    const now = new Date();
    const conflicts: string[] = [];

    // Default: suggest tomorrow if no deadline
    let suggestedDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // If task has deadline, schedule before it
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const bufferDays = estimatedHours ? Math.ceil(estimatedHours / 8) : 1;
      suggestedDate = new Date(deadline.getTime() - bufferDays * 24 * 60 * 60 * 1000);

      if (suggestedDate < now) {
        conflicts.push('⚠️ Недостаточно времени до дедлайна');
        suggestedDate = now;
      }
    }

    // Skip weekends
    while (suggestedDate.getDay() === 0 || suggestedDate.getDay() === 6) {
      suggestedDate = new Date(suggestedDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Generate alternative dates
    const alternativeDates: Date[] = [];
    let altDate = new Date(suggestedDate.getTime() + 24 * 60 * 60 * 1000);
    for (let i = 0; i < 3; i++) {
      while (altDate.getDay() === 0 || altDate.getDay() === 6) {
        altDate = new Date(altDate.getTime() + 24 * 60 * 60 * 1000);
      }
      alternativeDates.push(new Date(altDate));
      altDate = new Date(altDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const reasoning = task.deadline
      ? `Запланировано с учётом дедлайна ${new Date(task.deadline).toLocaleDateString('ru-RU')}`
      : 'Запланировано на ближайший рабочий день';

    return {
      suggestedDate,
      reasoning,
      conflicts,
      alternativeDates,
    };
  }

  /**
   * Generate task summary using AI
   */
  async generateTaskSummary(taskId: number): Promise<string | null> {
    const db = await getDb();
    if (!db) return null;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return null;

    // Get memory context
    const context = await this.memory.getTaskContext(taskId);

    const prompt = `Создай краткое резюме для этой задачи на русском языке:

Название: ${task.title}
${task.description ? `Описание: ${task.description}` : ''}
${task.notes ? `Заметки: ${task.notes}` : ''}
Статус: ${task.status}
Приоритет: ${task.priority}
${context ? `Контекст: ${context}` : ''}

Резюме должно быть в 2-3 предложения, отражая суть задачи и её текущее состояние.`;

    try {
      const summary = await complete(prompt, { thinking: 'low' });
      return summary;
    } catch {
      return null;
    }
  }

  /**
   * Suggest task breakdown into subtasks
   */
  async suggestBreakdown(
    taskId: number
  ): Promise<{ subtasks: string[]; estimatedTotal: number } | null> {
    const db = await getDb();
    if (!db) return null;

    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) return null;

    const prompt = `Разбей эту задачу на подзадачи:

"${task.title}"
${task.description ? `Описание: ${task.description}` : ''}

Верни JSON в формате:
{
  "subtasks": ["подзадача 1", "подзадача 2", ...],
  "estimatedTotal": число_часов
}`;

    try {
      const result = await structured<{ subtasks: string[]; estimatedTotal: number }>(
        prompt,
        {
          name: 'task_breakdown',
          schema: {
            type: 'object',
            properties: {
              subtasks: { type: 'array', items: { type: 'string' } },
              estimatedTotal: { type: 'number' },
            },
            required: ['subtasks'],
          },
        },
        { thinking: 'medium' }
      );

      return result;
    } catch {
      return null;
    }
  }
}

// Singleton instance
let smartFeaturesInstance: SmartFeatures | null = null;

export function getSmartFeatures(): SmartFeatures {
  if (!smartFeaturesInstance) {
    smartFeaturesInstance = new SmartFeatures();
  }
  return smartFeaturesInstance;
}
