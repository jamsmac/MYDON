/**
 * Default function handlers for function-type skills
 *
 * These handlers wrap existing business logic to make it available
 * via the skill execution system.
 */

import { registerSkillFunction, type SkillExecutionContext, type SkillExecutionResult } from './skillEngine';
import { getDb } from '../db';
import { tasks, sections, blocks, projects } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from './logger';

// ============================================================================
// Helper Types
// ============================================================================

interface Risk {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  taskId?: number;
  blockId?: number;
}

interface SimilarTask {
  id: number;
  title: string;
  similarity: number;
  status: string | null;
}

// ============================================================================
// Risk Detection Function
// ============================================================================

async function detectRisksHandler(ctx: SkillExecutionContext): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const db = await getDb();

  if (!db) {
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: 'Database not available',
    };
  }

  try {
    const risks: Risk[] = [];
    const now = new Date();

    // Get all tasks for the project
    const projectTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      deadline: tasks.deadline,
      dependencies: tasks.dependencies,
      sectionId: tasks.sectionId,
      blockId: blocks.id,
    })
      .from(tasks)
      .leftJoin(sections, eq(tasks.sectionId, sections.id))
      .leftJoin(blocks, eq(sections.blockId, blocks.id))
      .where(eq(blocks.projectId, ctx.projectId));

    type TaskRow = typeof projectTasks[number];
    const taskMap = new Map<number, TaskRow>(projectTasks.map((t: TaskRow) => [t.id, t]));

    // Check for overdue tasks
    for (const task of projectTasks) {
      if (task.deadline && task.status !== 'completed') {
        const daysOverdue = Math.ceil((now.getTime() - new Date(task.deadline).getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
          risks.push({
            type: 'overdue',
            severity: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
            title: `Просроченная задача: ${task.title}`,
            description: `Задача просрочена на ${daysOverdue} дней`,
            recommendation: 'Пересмотрите приоритеты или перенесите дедлайн',
            taskId: task.id,
            blockId: task.blockId ?? undefined,
          });
        } else if (daysOverdue >= -3) {
          risks.push({
            type: 'deadline',
            severity: 'medium',
            title: `Приближается дедлайн: ${task.title}`,
            description: `До дедлайна осталось ${Math.abs(daysOverdue)} дней`,
            recommendation: 'Убедитесь, что задача будет выполнена вовремя',
            taskId: task.id,
            blockId: task.blockId ?? undefined,
          });
        }
      }

      // Check for blocked dependencies
      if (task.dependencies && Array.isArray(task.dependencies) && task.status !== 'completed') {
        for (const depId of task.dependencies) {
          const depTask = taskMap.get(depId);
          if (depTask && depTask.status !== 'completed') {
            risks.push({
              type: 'blocked',
              severity: 'medium',
              title: `Заблокированная задача: ${task.title}`,
              description: `Ожидает завершения: ${depTask.title}`,
              recommendation: 'Сфокусируйтесь на завершении зависимой задачи',
              taskId: task.id,
            });
          }
        }
      }
    }

    // Check project task distribution
    const blocksWithTasks = new Map<number, number>();
    for (const task of projectTasks) {
      if (task.blockId) {
        blocksWithTasks.set(task.blockId, (blocksWithTasks.get(task.blockId) || 0) + 1);
      }
    }

    for (const [blockId, count] of Array.from(blocksWithTasks.entries())) {
      if (count > 50) {
        risks.push({
          type: 'scope',
          severity: 'high',
          title: 'Перегруженный блок',
          description: `Блок содержит ${count} задач - возможна потеря контроля`,
          recommendation: 'Рассмотрите разделение блока на подблоки',
          blockId,
        });
      }
    }

    const content = risks.length > 0
      ? `Обнаружено ${risks.length} рисков:\n\n` + risks.map(r =>
          `- **${r.severity.toUpperCase()}**: ${r.title}\n  ${r.description}\n  💡 ${r.recommendation}`
        ).join('\n\n')
      : 'Риски не обнаружены. Проект выглядит стабильно.';

    return {
      success: true,
      content,
      structuredData: { risks },
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
    };
  } catch (error) {
    logger.skill.error('detectRisks failed', error as Error);
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Similar Tasks Function
// ============================================================================

async function findSimilarTasksHandler(ctx: SkillExecutionContext): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const db = await getDb();

  if (!db) {
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: 'Database not available',
    };
  }

  try {
    const entityTitle = String(ctx.entityData.title || ctx.entityData.name || '');
    if (!entityTitle) {
      return {
        success: true,
        content: 'Не удалось определить название для поиска похожих задач.',
        structuredData: { similarTasks: [] },
        model: 'function',
        responseTimeMs: Date.now() - startTime,
        skillId: 0,
      };
    }

    // Get all tasks in the project
    const projectTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      sectionTitle: sections.title,
      blockTitle: blocks.title,
    })
      .from(tasks)
      .leftJoin(sections, eq(tasks.sectionId, sections.id))
      .leftJoin(blocks, eq(sections.blockId, blocks.id))
      .where(eq(blocks.projectId, ctx.projectId));

    // Simple word overlap similarity
    const inputWords = entityTitle.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const threshold = 50;

    type TaskRow = typeof projectTasks[number];
    const similarTasks: SimilarTask[] = projectTasks
      .filter((t: TaskRow) => ctx.entityType !== 'task' || t.id !== ctx.entityId)
      .map((task: TaskRow) => {
        const taskWords = task.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const intersection = inputWords.filter((w: string) => taskWords.includes(w));
        const similarity = taskWords.length > 0 && inputWords.length > 0
          ? Math.round((intersection.length * 2 / (inputWords.length + taskWords.length)) * 100)
          : 0;
        return {
          id: task.id,
          title: task.title,
          similarity,
          status: task.status,
        };
      })
      .filter((t: SimilarTask) => t.similarity >= threshold)
      .sort((a: SimilarTask, b: SimilarTask) => b.similarity - a.similarity)
      .slice(0, 5);

    const content = similarTasks.length > 0
      ? `Найдено ${similarTasks.length} похожих задач:\n\n` + similarTasks.map(t =>
          `- **${t.title}** (${t.similarity}% совпадение, статус: ${t.status || 'не указан'})`
        ).join('\n')
      : 'Похожих задач не найдено.';

    return {
      success: true,
      content,
      structuredData: { similarTasks },
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
    };
  } catch (error) {
    logger.skill.error('findSimilarTasks failed', error as Error);
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Dependency Suggestions Function (uses LLM internally)
// ============================================================================

async function suggestDependenciesHandler(ctx: SkillExecutionContext): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const db = await getDb();

  if (!db) {
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: 'Database not available',
    };
  }

  try {
    // This is a simpler heuristic-based approach
    // For AI-based suggestions, use the 'prompt' handler type instead

    const projectTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      sortOrder: tasks.sortOrder,
      sectionId: tasks.sectionId,
    })
      .from(tasks)
      .leftJoin(sections, eq(tasks.sectionId, sections.id))
      .leftJoin(blocks, eq(sections.blockId, blocks.id))
      .where(eq(blocks.projectId, ctx.projectId));

    const currentTitle = String(ctx.entityData.title || '').toLowerCase();
    const suggestions: Array<{ taskId: number; taskTitle: string; reason: string }> = [];

    // Simple heuristics for dependency suggestions
    for (const task of projectTasks) {
      if (ctx.entityType === 'task' && task.id === ctx.entityId) continue;
      if (task.status === 'completed') continue;

      const taskTitle = task.title.toLowerCase();

      // Check for setup/prepare patterns
      if (taskTitle.includes('подготов') || taskTitle.includes('настро') || taskTitle.includes('setup')) {
        if (!currentTitle.includes('подготов') && !currentTitle.includes('настро')) {
          suggestions.push({
            taskId: task.id,
            taskTitle: task.title,
            reason: 'Задача подготовки может быть необходима перед выполнением',
          });
        }
      }

      // Check for design/plan before implementation
      if ((taskTitle.includes('дизайн') || taskTitle.includes('план')) &&
          (currentTitle.includes('реализ') || currentTitle.includes('разработ'))) {
        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: 'Дизайн/планирование обычно предшествует реализации',
        });
      }
    }

    const content = suggestions.length > 0
      ? `Рекомендуемые зависимости:\n\n` + suggestions.slice(0, 3).map(s =>
          `- **${s.taskTitle}**\n  ${s.reason}`
        ).join('\n\n')
      : 'Зависимости не требуются или не удалось определить.';

    return {
      success: true,
      content,
      structuredData: { suggestions: suggestions.slice(0, 3) },
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
    };
  } catch (error) {
    logger.skill.error('suggestDependencies failed', error as Error);
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Project Summary Function
// ============================================================================

async function getProjectSummaryHandler(ctx: SkillExecutionContext): Promise<SkillExecutionResult> {
  const startTime = Date.now();
  const db = await getDb();

  if (!db) {
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: 'Database not available',
    };
  }

  try {
    const [project] = await db.select()
      .from(projects)
      .where(eq(projects.id, ctx.projectId));

    if (!project) {
      return {
        success: false,
        content: '',
        model: 'function',
        responseTimeMs: Date.now() - startTime,
        skillId: 0,
        error: 'Project not found',
      };
    }

    // Count blocks
    const projectBlocks = await db.select({ id: blocks.id })
      .from(blocks)
      .where(eq(blocks.projectId, ctx.projectId));

    // Count tasks by status
    const projectTasks = await db.select({
      status: tasks.status,
    })
      .from(tasks)
      .leftJoin(sections, eq(tasks.sectionId, sections.id))
      .leftJoin(blocks, eq(sections.blockId, blocks.id))
      .where(eq(blocks.projectId, ctx.projectId));

    const statusCounts = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
    };

    for (const task of projectTasks) {
      const status = task.status as keyof typeof statusCounts;
      if (status in statusCounts) {
        statusCounts[status]++;
      }
    }

    const total = projectTasks.length;
    const progress = total > 0 ? Math.round((statusCounts.completed / total) * 100) : 0;

    const content = `## Сводка проекта: ${project.name}

**Прогресс:** ${progress}%

### Статистика
- Блоков: ${projectBlocks.length}
- Всего задач: ${total}
  - Не начато: ${statusCounts.not_started}
  - В работе: ${statusCounts.in_progress}
  - Завершено: ${statusCounts.completed}

${project.description ? `### Описание\n${project.description}` : ''}`;

    return {
      success: true,
      content,
      structuredData: {
        project: { id: project.id, name: project.name },
        stats: {
          blocksCount: projectBlocks.length,
          tasksCount: total,
          progress,
          statusCounts,
        },
      },
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
    };
  } catch (error) {
    logger.skill.error('getProjectSummary failed', error as Error);
    return {
      success: false,
      content: '',
      model: 'function',
      responseTimeMs: Date.now() - startTime,
      skillId: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Register All Functions
// ============================================================================

export function registerDefaultSkillFunctions(): void {
  registerSkillFunction('detectRisks', detectRisksHandler);
  registerSkillFunction('findSimilarTasks', findSimilarTasksHandler);
  registerSkillFunction('suggestDependencies', suggestDependenciesHandler);
  registerSkillFunction('getProjectSummary', getProjectSummaryHandler);

  logger.skill.info('Registered default skill functions', {
    functions: ['detectRisks', 'findSimilarTasks', 'suggestDependencies', 'getProjectSummary'],
  });
}
