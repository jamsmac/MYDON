/**
 * useDetailPanelHandlers - Hook for BlockDetailPanel and SectionDetailPanel handlers
 * Consolidates callback logic for detail panels
 */

import { useCallback } from 'react';

interface SelectedContext {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
  content?: string;
}

interface SelectedTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  notes?: string | null;
  sectionId: number;
  priority?: string | null;
}

interface TaskForAction {
  id: number;
  title: string;
  sectionId: number;
  status: string;
}

interface SectionForAction {
  id: number;
  title: string;
  blockId: number;
  tasks: unknown[];
}

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
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
  description?: string | null;
  notes?: string | null;
  priority?: string | null;
}

interface UseDetailPanelHandlersOptions {
  project: { blocks: ProjectBlock[] };
  getContextContent: (type: string, id: number) => string;
  setSelectedContext: (ctx: SelectedContext | null) => void;
  setSelectedTask: (task: SelectedTask | null) => void;
  setSelectedTaskForAction: (task: TaskForAction | null) => void;
  setSelectedSectionForAction: (section: SectionForAction | null) => void;
  createDialogs: {
    openSection: (blockId: number) => void;
    openTask: (sectionId: number) => void;
  };
  taskActionDialogs: {
    setSplitOpen: (open: boolean) => void;
    setMergeOpen: (open: boolean) => void;
    setConvertToSectionOpen: (open: boolean) => void;
    setConvertToTaskOpen: (open: boolean) => void;
  };
  mutations: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deleteTask: { mutate: (data: any) => void };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    duplicateTask: { mutate: (data: any) => void };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateTask: { mutate: (data: any) => void };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markRead: { mutate: (data: any) => void };
  };
}

export function useDetailPanelHandlers({
  project,
  getContextContent,
  setSelectedContext,
  setSelectedTask,
  setSelectedTaskForAction,
  setSelectedSectionForAction,
  createDialogs,
  taskActionDialogs,
  mutations,
}: UseDetailPanelHandlersOptions) {

  const handleSelectSection = useCallback((sectionId: number, sectionTitle: string) => {
    setSelectedContext({
      type: 'section',
      id: sectionId,
      title: sectionTitle,
      content: getContextContent('section', sectionId)
    });
    setSelectedTask(null);
  }, [getContextContent, setSelectedContext, setSelectedTask]);

  const handleSelectTaskFromBlock = useCallback((taskId: number, taskTitle: string, sectionId: number, block: ProjectBlock) => {
    const task = block.sections?.flatMap((s) => s.tasks || []).find((t) => t.id === taskId);
    if (task) {
      setSelectedTask({ ...task, sectionId } as SelectedTask);
      setSelectedContext({
        type: 'task',
        id: taskId,
        title: taskTitle,
        content: getContextContent('task', taskId)
      });
    }
  }, [getContextContent, setSelectedContext, setSelectedTask]);

  const handleSelectTask = useCallback((task: ProjectTask, sectionId: number) => {
    setSelectedTask({ ...task, sectionId } as SelectedTask);
    setSelectedContext({
      type: 'task',
      id: task.id,
      title: task.title,
      content: getContextContent('task', task.id)
    });
  }, [getContextContent, setSelectedContext, setSelectedTask]);

  const handleNavigate = useCallback((item: { type: string; id: number; title: string }) => {
    setSelectedContext({
      type: item.type as SelectedContext['type'],
      id: item.id,
      title: item.title,
      content: getContextContent(item.type, item.id)
    });
    if (item.type !== 'task') setSelectedTask(null);
  }, [getContextContent, setSelectedContext, setSelectedTask]);

  const handleMarkRead = useCallback((entityType: string, entityId: number) => {
    mutations.markRead.mutate({
      entityType: entityType as 'project' | 'block' | 'section' | 'task',
      entityId
    });
  }, [mutations.markRead]);

  const handleDeleteTask = useCallback((taskId: number, confirm = true) => {
    if (!confirm || window.confirm('Удалить задачу?')) {
      mutations.deleteTask.mutate({ id: taskId });
    }
  }, [mutations.deleteTask]);

  const handleUpdateTaskStatus = useCallback((taskId: number, status: string) => {
    mutations.updateTask.mutate({
      id: taskId,
      status: status as 'not_started' | 'in_progress' | 'completed'
    });
  }, [mutations.updateTask]);

  const handleDuplicateTask = useCallback((taskId: number) => {
    mutations.duplicateTask.mutate({ taskId });
  }, [mutations.duplicateTask]);

  const handleSplitTask = useCallback((task: ProjectTask, sectionId: number) => {
    setSelectedTaskForAction({
      id: task.id,
      title: task.title,
      sectionId,
      status: task.status || 'not_started'
    });
    taskActionDialogs.setSplitOpen(true);
  }, [setSelectedTaskForAction, taskActionDialogs]);

  const handleConvertTaskToSection = useCallback((task: ProjectTask, sectionId: number) => {
    setSelectedTaskForAction({
      id: task.id,
      title: task.title,
      sectionId,
      status: task.status || 'not_started'
    });
    taskActionDialogs.setConvertToSectionOpen(true);
  }, [setSelectedTaskForAction, taskActionDialogs]);

  const handleMergeTasks = useCallback((sectionId: number, blockId: number) => {
    const section = project.blocks
      .flatMap((b) => b.sections || [])
      .find((s) => s.id === sectionId);
    if (section) {
      setSelectedSectionForAction({
        id: section.id,
        title: section.title,
        blockId,
        tasks: section.tasks || []
      });
      taskActionDialogs.setMergeOpen(true);
    }
  }, [project.blocks, setSelectedSectionForAction, taskActionDialogs]);

  const handleConvertSectionToTask = useCallback((sectionId: number, blockId: number) => {
    const section = project.blocks
      .flatMap((b) => b.sections || [])
      .find((s) => s.id === sectionId);
    if (section) {
      setSelectedSectionForAction({
        id: section.id,
        title: section.title,
        blockId,
        tasks: section.tasks || []
      });
      taskActionDialogs.setConvertToTaskOpen(true);
    }
  }, [project.blocks, setSelectedSectionForAction, taskActionDialogs]);

  return {
    // Block handlers
    onSelectSection: handleSelectSection,
    onSelectTaskFromBlock: handleSelectTaskFromBlock,
    onCreateSection: createDialogs.openSection,

    // Section handlers
    onSelectTask: handleSelectTask,
    onCreateTask: createDialogs.openTask,
    onDuplicateTask: handleDuplicateTask,
    onSplitTask: handleSplitTask,
    onConvertTaskToSection: handleConvertTaskToSection,
    onMergeTasks: handleMergeTasks,
    onConvertSectionToTask: handleConvertSectionToTask,

    // Shared handlers
    onNavigate: handleNavigate,
    onMarkRead: handleMarkRead,
    onDeleteTask: handleDeleteTask,
    onUpdateTaskStatus: handleUpdateTaskStatus,
  };
}
