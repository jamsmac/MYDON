/**
 * Hook for managing selection state in ProjectView
 * Extracts selection logic to reduce ProjectView complexity
 */

import { useState, useCallback } from 'react';

export interface SelectedContext {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
  content?: string;
}

export interface SelectedTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  notes?: string | null;
  summary?: string | null;
  sectionId: number;
  sortOrder?: number | null;
}

export interface TaskForAction {
  id: number;
  title: string;
  sectionId: number;
  status: string;
}

export interface SectionForAction {
  id: number;
  title: string;
  blockId: number;
  tasks: Array<{ id: number; title: string }>;
}

export interface DiscussionEntity {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
}

export interface UseProjectSelectionOptions {
  isMobile: boolean;
  onMobileShowDetail?: () => void;
  onMobileHideSidebar?: () => void;
}

export interface UseProjectSelectionReturn {
  // Context selection
  selectedContext: SelectedContext | null;
  setSelectedContext: (ctx: SelectedContext | null) => void;
  selectContext: (ctx: SelectedContext | null) => void;
  clearContext: () => void;

  // Task selection
  selectedTask: SelectedTask | null;
  setSelectedTask: (task: SelectedTask | null) => void;
  selectTask: (task: SelectedTask | null) => void;
  clearTask: () => void;

  // Multi-select for bulk actions
  selectedTaskIds: number[];
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<number[]>>;
  selectionMode: boolean;
  setSelectionMode: (mode: boolean) => void;
  toggleTaskSelection: (taskId: number) => void;
  selectAllTasks: (taskIds: number[]) => void;
  clearSelection: () => void;

  // Action targets
  selectedTaskForAction: TaskForAction | null;
  setSelectedTaskForAction: (task: TaskForAction | null) => void;
  selectedSectionForAction: SectionForAction | null;
  setSelectedSectionForAction: (section: SectionForAction | null) => void;

  // Discussion
  discussionEntity: DiscussionEntity | null;
  setDiscussionEntity: (entity: DiscussionEntity | null) => void;
  openDiscussion: (entity: DiscussionEntity) => void;
  closeDiscussion: () => void;

  // Clear all
  clearAllSelections: () => void;
}

export function useProjectSelection(options: UseProjectSelectionOptions): UseProjectSelectionReturn {
  const { isMobile, onMobileShowDetail, onMobileHideSidebar } = options;

  // Context selection
  const [selectedContext, setSelectedContext] = useState<SelectedContext | null>(null);

  // Task selection
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);

  // Multi-select
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Action targets
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<TaskForAction | null>(null);
  const [selectedSectionForAction, setSelectedSectionForAction] = useState<SectionForAction | null>(null);

  // Discussion
  const [discussionEntity, setDiscussionEntity] = useState<DiscussionEntity | null>(null);

  // Mobile-aware context selection
  const selectContext = useCallback((ctx: SelectedContext | null) => {
    setSelectedContext(ctx);
    if (isMobile && ctx) {
      onMobileShowDetail?.();
      onMobileHideSidebar?.();
    }
  }, [isMobile, onMobileShowDetail, onMobileHideSidebar]);

  const clearContext = useCallback(() => {
    setSelectedContext(null);
  }, []);

  // Mobile-aware task selection
  const selectTask = useCallback((task: SelectedTask | null) => {
    setSelectedTask(task);
    if (isMobile && task) {
      onMobileShowDetail?.();
      onMobileHideSidebar?.();
    }
  }, [isMobile, onMobileShowDetail, onMobileHideSidebar]);

  const clearTask = useCallback(() => {
    setSelectedTask(null);
  }, []);

  // Multi-select operations
  const toggleTaskSelection = useCallback((taskId: number) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  }, []);

  const selectAllTasks = useCallback((taskIds: number[]) => {
    setSelectedTaskIds(taskIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds([]);
    setSelectionMode(false);
  }, []);

  // Discussion operations
  const openDiscussion = useCallback((entity: DiscussionEntity) => {
    setDiscussionEntity(entity);
  }, []);

  const closeDiscussion = useCallback(() => {
    setDiscussionEntity(null);
  }, []);

  // Clear all
  const clearAllSelections = useCallback(() => {
    setSelectedContext(null);
    setSelectedTask(null);
    setSelectedTaskIds([]);
    setSelectionMode(false);
    setSelectedTaskForAction(null);
    setSelectedSectionForAction(null);
    setDiscussionEntity(null);
  }, []);

  return {
    // Context
    selectedContext,
    setSelectedContext,
    selectContext,
    clearContext,

    // Task
    selectedTask,
    setSelectedTask,
    selectTask,
    clearTask,

    // Multi-select
    selectedTaskIds,
    setSelectedTaskIds,
    selectionMode,
    setSelectionMode,
    toggleTaskSelection,
    selectAllTasks,
    clearSelection,

    // Action targets
    selectedTaskForAction,
    setSelectedTaskForAction,
    selectedSectionForAction,
    setSelectedSectionForAction,

    // Discussion
    discussionEntity,
    setDiscussionEntity,
    openDiscussion,
    closeDiscussion,

    // Clear all
    clearAllSelections,
  };
}
