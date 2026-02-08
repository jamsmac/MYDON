/**
 * useProjectContextSync - Syncs project data with global contexts
 * Extracted from ProjectView.tsx
 */

import { useEffect } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAIChatContext } from '@/contexts/AIChatContext';

interface ProjectBlock {
  id: number;
  title: string;
  sections?: ProjectSection[];
}

interface ProjectSection {
  id: number;
  title: string;
  tasks?: ProjectTask[];
}

interface ProjectTask {
  id: number;
  title: string;
  status: string | null;
  priority?: string | null;
}

interface Project {
  id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  blocks?: ProjectBlock[];
}

export function useProjectContextSync(project: Project | null | undefined) {
  const { setCurrentProject, clearProject } = useProjectContext();
  const { setProject: setAIChatProject, clearContext: clearAIChatContext } = useAIChatContext();

  useEffect(() => {
    if (project) {
      // Calculate task counts
      let totalTasks = 0;
      let completedTasks = 0;
      const recentTasks: Array<{ id: number; title: string; status: string; priority: string }> = [];
      const phases: Array<{ id: number; name: string; status: string; tasksCount: number }> = [];

      project.blocks?.forEach((block) => {
        let blockTasks = 0;
        block.sections?.forEach((section) => {
          section.tasks?.forEach((task) => {
            totalTasks++;
            blockTasks++;
            if (task.status === 'completed') {
              completedTasks++;
            }
            if (recentTasks.length < 10) {
              recentTasks.push({
                id: task.id,
                title: task.title,
                status: task.status || 'not_started',
                priority: task.priority || 'medium'
              });
            }
          });
        });
        phases.push({
          id: block.id,
          name: block.title,
          status: 'in_progress',
          tasksCount: blockTasks
        });
      });

      setCurrentProject({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        status: project.status || 'active',
        tasksCount: totalTasks,
        completedTasksCount: completedTasks,
        phases,
        recentTasks
      });

      // Also set AI chat context
      setAIChatProject({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        status: project.status || 'active'
      });
    }

    return () => {
      clearProject();
      clearAIChatContext();
    };
  }, [project, setCurrentProject, clearProject, setAIChatProject, clearAIChatContext]);
}
