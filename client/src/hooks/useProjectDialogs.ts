/**
 * Hook for managing dialog state in ProjectView
 * Extracts dialog logic to reduce ProjectView complexity
 */

import { useState, useCallback } from 'react';

export interface UseProjectDialogsReturn {
  // Create dialogs
  createBlockOpen: boolean;
  setCreateBlockOpen: (open: boolean) => void;
  createSectionOpen: boolean;
  setCreateSectionOpen: (open: boolean) => void;
  createTaskOpen: boolean;
  setCreateTaskOpen: (open: boolean) => void;

  // Form values for create dialogs
  newBlockTitle: string;
  setNewBlockTitle: (title: string) => void;
  newBlockTitleRu: string;
  setNewBlockTitleRu: (title: string) => void;
  newSectionTitle: string;
  setNewSectionTitle: (title: string) => void;
  newTaskTitle: string;
  setNewTaskTitle: (title: string) => void;
  newTaskDescription: string;
  setNewTaskDescription: (desc: string) => void;

  // Target selection for create dialogs
  targetBlockId: number | null;
  setTargetBlockId: (id: number | null) => void;
  targetSectionId: number | null;
  setTargetSectionId: (id: number | null) => void;

  // Task management dialogs
  splitTaskOpen: boolean;
  setSplitTaskOpen: (open: boolean) => void;
  mergeTasksOpen: boolean;
  setMergeTasksOpen: (open: boolean) => void;
  convertToSectionOpen: boolean;
  setConvertToSectionOpen: (open: boolean) => void;
  convertToTaskOpen: boolean;
  setConvertToTaskOpen: (open: boolean) => void;
  bulkActionsOpen: boolean;
  setBulkActionsOpen: (open: boolean) => void;

  // Helper functions
  openCreateBlock: () => void;
  openCreateSection: (blockId: number) => void;
  openCreateTask: (sectionId: number) => void;
  resetCreateBlockForm: () => void;
  resetCreateSectionForm: () => void;
  resetCreateTaskForm: () => void;
  closeAllDialogs: () => void;
}

export function useProjectDialogs(): UseProjectDialogsReturn {
  // Create dialog states
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Form values
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockTitleRu, setNewBlockTitleRu] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');

  // Target selection
  const [targetBlockId, setTargetBlockId] = useState<number | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  // Task management dialogs
  const [splitTaskOpen, setSplitTaskOpen] = useState(false);
  const [mergeTasksOpen, setMergeTasksOpen] = useState(false);
  const [convertToSectionOpen, setConvertToSectionOpen] = useState(false);
  const [convertToTaskOpen, setConvertToTaskOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);

  // Helper functions
  const openCreateBlock = useCallback(() => {
    setNewBlockTitle('');
    setNewBlockTitleRu('');
    setCreateBlockOpen(true);
  }, []);

  const openCreateSection = useCallback((blockId: number) => {
    setTargetBlockId(blockId);
    setNewSectionTitle('');
    setCreateSectionOpen(true);
  }, []);

  const openCreateTask = useCallback((sectionId: number) => {
    setTargetSectionId(sectionId);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setCreateTaskOpen(true);
  }, []);

  const resetCreateBlockForm = useCallback(() => {
    setNewBlockTitle('');
    setNewBlockTitleRu('');
    setCreateBlockOpen(false);
  }, []);

  const resetCreateSectionForm = useCallback(() => {
    setNewSectionTitle('');
    setTargetBlockId(null);
    setCreateSectionOpen(false);
  }, []);

  const resetCreateTaskForm = useCallback(() => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setTargetSectionId(null);
    setCreateTaskOpen(false);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setCreateBlockOpen(false);
    setCreateSectionOpen(false);
    setCreateTaskOpen(false);
    setSplitTaskOpen(false);
    setMergeTasksOpen(false);
    setConvertToSectionOpen(false);
    setConvertToTaskOpen(false);
    setBulkActionsOpen(false);
    setNewBlockTitle('');
    setNewBlockTitleRu('');
    setNewSectionTitle('');
    setNewTaskTitle('');
    setNewTaskDescription('');
    setTargetBlockId(null);
    setTargetSectionId(null);
  }, []);

  return {
    // Create dialogs
    createBlockOpen,
    setCreateBlockOpen,
    createSectionOpen,
    setCreateSectionOpen,
    createTaskOpen,
    setCreateTaskOpen,

    // Form values
    newBlockTitle,
    setNewBlockTitle,
    newBlockTitleRu,
    setNewBlockTitleRu,
    newSectionTitle,
    setNewSectionTitle,
    newTaskTitle,
    setNewTaskTitle,
    newTaskDescription,
    setNewTaskDescription,

    // Target selection
    targetBlockId,
    setTargetBlockId,
    targetSectionId,
    setTargetSectionId,

    // Task management dialogs
    splitTaskOpen,
    setSplitTaskOpen,
    mergeTasksOpen,
    setMergeTasksOpen,
    convertToSectionOpen,
    setConvertToSectionOpen,
    convertToTaskOpen,
    setConvertToTaskOpen,
    bulkActionsOpen,
    setBulkActionsOpen,

    // Helpers
    openCreateBlock,
    openCreateSection,
    openCreateTask,
    resetCreateBlockForm,
    resetCreateSectionForm,
    resetCreateTaskForm,
    closeAllDialogs,
  };
}
