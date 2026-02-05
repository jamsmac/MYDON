/**
 * Project Context Provider
 * Tracks the current project for AI chat context awareness
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ProjectContextData {
  id: number;
  name: string;
  description?: string;
  status: string;
  tasksCount?: number;
  completedTasksCount?: number;
  phases?: Array<{
    id: number;
    name: string;
    status: string;
    tasksCount: number;
  }>;
  recentTasks?: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
  }>;
}

interface ProjectContextValue {
  currentProject: ProjectContextData | null;
  setCurrentProject: (project: ProjectContextData | null) => void;
  clearProject: () => void;
  getContextSummary: () => string;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectContextProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<ProjectContextData | null>(null);

  const clearProject = useCallback(() => {
    setCurrentProject(null);
  }, []);

  const getContextSummary = useCallback(() => {
    if (!currentProject) return '';

    const lines: string[] = [
      `Текущий проект: "${currentProject.name}"`,
      `Статус: ${currentProject.status}`,
    ];

    if (currentProject.description) {
      lines.push(`Описание: ${currentProject.description}`);
    }

    if (currentProject.tasksCount !== undefined) {
      const completed = currentProject.completedTasksCount || 0;
      const total = currentProject.tasksCount;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      lines.push(`Прогресс: ${completed}/${total} задач выполнено (${progress}%)`);
    }

    if (currentProject.phases && currentProject.phases.length > 0) {
      lines.push(`\nФазы проекта:`);
      currentProject.phases.forEach((phase, i) => {
        lines.push(`  ${i + 1}. ${phase.name} - ${phase.status} (${phase.tasksCount} задач)`);
      });
    }

    if (currentProject.recentTasks && currentProject.recentTasks.length > 0) {
      lines.push(`\nПоследние задачи:`);
      currentProject.recentTasks.slice(0, 5).forEach((task) => {
        lines.push(`  - [${task.status}] ${task.title} (${task.priority})`);
      });
    }

    return lines.join('\n');
  }, [currentProject]);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        clearProject,
        getContextSummary,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  return context;
}

// Hook for optional context (doesn't throw if not in provider)
export function useOptionalProjectContext() {
  return useContext(ProjectContext);
}
