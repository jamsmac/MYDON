/**
 * useProjectProgress - Hook for calculating project completion progress
 * Extracted from ProjectView.tsx for reusability
 */

import { useMemo } from "react";

export interface ProjectBlock {
  id: number;
  sections?: ProjectSection[];
}

export interface ProjectSection {
  id: number;
  tasks?: ProjectTask[];
}

export interface ProjectTask {
  id: number;
  status: string | null;
}

export interface ProgressResult {
  total: number;
  completed: number;
  percentage: number;
}

/**
 * Calculate project progress based on task completion
 *
 * @param blocks - Array of project blocks with nested sections and tasks
 * @returns Object with total tasks, completed tasks, and percentage
 *
 * @example
 * const progress = useProjectProgress(project?.blocks);
 * console.log(`${progress.percentage}% complete`);
 */
export function useProjectProgress(
  blocks: ProjectBlock[] | undefined | null
): ProgressResult {
  return useMemo(() => {
    if (!blocks) return { total: 0, completed: 0, percentage: 0 };

    let total = 0;
    let completed = 0;

    blocks.forEach((block) => {
      block.sections?.forEach((section) => {
        section.tasks?.forEach((task) => {
          total++;
          if (task.status === "completed") completed++;
        });
      });
    });

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [blocks]);
}
