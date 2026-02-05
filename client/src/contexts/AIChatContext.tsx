/**
 * AI Chat Context Provider
 * Manages current project and task context for the floating AI chat
 * Provides context information for AI suggestions and actions
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useRoute } from 'wouter';

interface TaskContextData {
  id: string;
  numericId?: number;
  title: string;
  status?: string;
  priority?: string;
  deadline?: number | null;
  notes?: string;
  blockId?: string;
  sectionId?: string;
}

interface ProjectContextData {
  id: number;
  name: string;
  description?: string;
  status?: string;
}

interface AIChatContextValue {
  // Current context
  projectId: number | undefined;
  projectName: string | undefined;
  taskId: string | undefined;
  taskTitle: string | undefined;
  
  // Full context data
  projectData: ProjectContextData | null;
  taskData: TaskContextData | null;
  
  // Setters
  setProject: (project: ProjectContextData | null) => void;
  setTask: (task: TaskContextData | null) => void;
  clearContext: () => void;
  
  // Context summary for AI
  getContextSummary: () => string;
  getContextForPrompt: () => string;
  
  // Context status
  hasContext: boolean;
  contextLabel: string;
}

const AIChatContext = createContext<AIChatContextValue | undefined>(undefined);

export function AIChatContextProvider({ children }: { children: ReactNode }) {
  const [projectData, setProjectData] = useState<ProjectContextData | null>(null);
  const [taskData, setTaskData] = useState<TaskContextData | null>(null);
  
  // Auto-detect project from route
  const [matchProject, paramsProject] = useRoute('/project/:id');
  const [matchProjectTeam, paramsProjectTeam] = useRoute('/project/:id/team');
  const [matchProjectTags, paramsProjectTags] = useRoute('/project/:id/tags');
  const [matchProjectAnalytics, paramsProjectAnalytics] = useRoute('/project/:id/analytics');
  
  // Get project ID from any project-related route
  const routeProjectId = matchProject ? paramsProject?.id :
                         matchProjectTeam ? paramsProjectTeam?.id :
                         matchProjectTags ? paramsProjectTags?.id :
                         matchProjectAnalytics ? paramsProjectAnalytics?.id : undefined;

  // Update project ID from route when it changes
  useEffect(() => {
    if (routeProjectId) {
      const numericId = parseInt(routeProjectId, 10);
      if (!isNaN(numericId) && (!projectData || projectData.id !== numericId)) {
        // Only update ID, keep other data if available
        setProjectData(prev => prev?.id === numericId ? prev : { id: numericId, name: `Проект #${numericId}` });
      }
    }
  }, [routeProjectId, projectData]);

  const setProject = useCallback((project: ProjectContextData | null) => {
    setProjectData(project);
    // Clear task when project changes
    if (project?.id !== projectData?.id) {
      setTaskData(null);
    }
  }, [projectData?.id]);

  const setTask = useCallback((task: TaskContextData | null) => {
    setTaskData(task);
  }, []);

  const clearContext = useCallback(() => {
    setProjectData(null);
    setTaskData(null);
  }, []);

  const getContextSummary = useCallback(() => {
    const parts: string[] = [];
    
    if (projectData) {
      parts.push(`📁 ${projectData.name}`);
    }
    
    if (taskData) {
      parts.push(`📋 ${taskData.title}`);
    }
    
    return parts.join(' → ');
  }, [projectData, taskData]);

  const getContextForPrompt = useCallback(() => {
    const lines: string[] = [];
    
    if (projectData) {
      lines.push(`=== ТЕКУЩИЙ КОНТЕКСТ ===`);
      lines.push(`Проект: "${projectData.name}" (ID: ${projectData.id})`);
      if (projectData.description) {
        lines.push(`Описание проекта: ${projectData.description}`);
      }
      if (projectData.status) {
        lines.push(`Статус проекта: ${projectData.status}`);
      }
    }
    
    if (taskData) {
      lines.push(``);
      lines.push(`Текущая задача: "${taskData.title}" (ID: ${taskData.id})`);
      if (taskData.status) {
        lines.push(`Статус задачи: ${taskData.status}`);
      }
      if (taskData.priority) {
        lines.push(`Приоритет: ${taskData.priority}`);
      }
      if (taskData.deadline) {
        const deadlineDate = new Date(taskData.deadline);
        lines.push(`Дедлайн: ${deadlineDate.toLocaleDateString('ru-RU')}`);
      }
      if (taskData.notes) {
        lines.push(`Заметки: ${taskData.notes.substring(0, 200)}${taskData.notes.length > 200 ? '...' : ''}`);
      }
    }
    
    if (lines.length > 0) {
      lines.push(`=== КОНЕЦ КОНТЕКСТА ===`);
      lines.push(``);
    }
    
    return lines.join('\n');
  }, [projectData, taskData]);

  const hasContext = Boolean(projectData || taskData);
  
  const contextLabel = taskData 
    ? `${projectData?.name || 'Проект'} → ${taskData.title}`
    : projectData?.name || '';

  return (
    <AIChatContext.Provider
      value={{
        projectId: projectData?.id,
        projectName: projectData?.name,
        taskId: taskData?.id,
        taskTitle: taskData?.title,
        projectData,
        taskData,
        setProject,
        setTask,
        clearContext,
        getContextSummary,
        getContextForPrompt,
        hasContext,
        contextLabel,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChatContext() {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChatContext must be used within an AIChatContextProvider');
  }
  return context;
}

// Hook for optional context (doesn't throw if not in provider)
export function useOptionalAIChatContext() {
  return useContext(AIChatContext);
}
