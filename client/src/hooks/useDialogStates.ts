/**
 * useDialogStates - Hook for managing multiple dialog states
 * Extracted from ProjectView.tsx for cleaner state management
 *
 * Groups related dialogs and provides open/close/reset functions
 */

import { useState, useCallback } from "react";

// ============ CREATE DIALOGS ============

export interface CreateDialogState {
  // Open states
  blockOpen: boolean;
  sectionOpen: boolean;
  taskOpen: boolean;

  // Form values
  blockTitle: string;
  blockTitleRu: string;
  sectionTitle: string;
  taskTitle: string;
  taskDescription: string;

  // Target IDs for creation
  targetBlockId: number | null;
  targetSectionId: number | null;
}

export interface CreateDialogActions {
  openBlock: () => void;
  openSection: (blockId: number) => void;
  openTask: (sectionId: number) => void;
  closeBlock: () => void;
  closeSection: () => void;
  closeTask: () => void;
  // Dialog onOpenChange-compatible setters (auto-reset on close)
  setBlockOpen: (open: boolean) => void;
  setSectionOpen: (open: boolean) => void;
  setTaskOpen: (open: boolean) => void;
  setBlockTitle: (title: string) => void;
  setBlockTitleRu: (title: string) => void;
  setSectionTitle: (title: string) => void;
  setTaskTitle: (title: string) => void;
  setTaskDescription: (desc: string) => void;
  resetBlockForm: () => void;
  resetSectionForm: () => void;
  resetTaskForm: () => void;
}

// ============ TASK ACTION DIALOGS ============

export interface TaskActionDialogState {
  splitOpen: boolean;
  mergeOpen: boolean;
  convertToSectionOpen: boolean;
  convertToTaskOpen: boolean;
  bulkActionsOpen: boolean;
}

export interface TaskActionDialogActions {
  openSplit: () => void;
  openMerge: () => void;
  openConvertToSection: () => void;
  openConvertToTask: () => void;
  openBulkActions: () => void;
  closeSplit: () => void;
  closeMerge: () => void;
  closeConvertToSection: () => void;
  closeConvertToTask: () => void;
  closeBulkActions: () => void;
  closeAllTaskActions: () => void;
  // Dialog onOpenChange-compatible setters
  setSplitOpen: (open: boolean) => void;
  setMergeOpen: (open: boolean) => void;
  setConvertToSectionOpen: (open: boolean) => void;
  setConvertToTaskOpen: (open: boolean) => void;
  setBulkActionsOpen: (open: boolean) => void;
}

// ============ FEATURE DIALOGS ============

export interface FeatureDialogState {
  calendarOpen: boolean;
  saveTemplateOpen: boolean;
  pitchDeckOpen: boolean;
  aiAssistantOpen: boolean;
  riskPanelOpen: boolean;
  customFieldsOpen: boolean;
}

export interface FeatureDialogActions {
  openCalendar: () => void;
  openSaveTemplate: () => void;
  openPitchDeck: () => void;
  openAIAssistant: () => void;
  openRiskPanel: () => void;
  openCustomFields: () => void;
  closeCalendar: () => void;
  closeSaveTemplate: () => void;
  closePitchDeck: () => void;
  closeAIAssistant: () => void;
  closeRiskPanel: () => void;
  closeCustomFields: () => void;
  closeAllFeatures: () => void;
  // Dialog onOpenChange-compatible setters
  setCalendarOpen: (open: boolean) => void;
  setSaveTemplateOpen: (open: boolean) => void;
  setPitchDeckOpen: (open: boolean) => void;
  setAIAssistantOpen: (open: boolean) => void;
  setRiskPanelOpen: (open: boolean) => void;
  setCustomFieldsOpen: (open: boolean) => void;
}

// ============ COMBINED HOOK ============

export interface UseDialogStatesReturn {
  create: CreateDialogState & CreateDialogActions;
  taskAction: TaskActionDialogState & TaskActionDialogActions;
  feature: FeatureDialogState & FeatureDialogActions;
}

/**
 * Hook for managing all dialog states in ProjectView
 *
 * @example
 * const { create, taskAction, feature } = useDialogStates();
 *
 * // Open create block dialog
 * create.openBlock();
 *
 * // Check if any task action dialog is open
 * if (taskAction.splitOpen || taskAction.mergeOpen) { ... }
 *
 * // Open feature dialog
 * feature.openCalendar();
 */
export function useDialogStates(): UseDialogStatesReturn {
  // ============ CREATE DIALOGS STATE ============
  const [blockOpen, setBlockOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const [blockTitle, setBlockTitle] = useState("");
  const [blockTitleRu, setBlockTitleRu] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");

  const [targetBlockId, setTargetBlockId] = useState<number | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  const resetBlockForm = useCallback(() => {
    setBlockTitle("");
    setBlockTitleRu("");
  }, []);

  const resetSectionForm = useCallback(() => {
    setSectionTitle("");
    setTargetBlockId(null);
  }, []);

  const resetTaskForm = useCallback(() => {
    setTaskTitle("");
    setTaskDescription("");
    setTargetSectionId(null);
  }, []);

  // ============ TASK ACTION DIALOGS STATE ============
  const [splitOpen, setSplitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [convertToSectionOpen, setConvertToSectionOpen] = useState(false);
  const [convertToTaskOpen, setConvertToTaskOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);

  const closeAllTaskActions = useCallback(() => {
    setSplitOpen(false);
    setMergeOpen(false);
    setConvertToSectionOpen(false);
    setConvertToTaskOpen(false);
    setBulkActionsOpen(false);
  }, []);

  // ============ FEATURE DIALOGS STATE ============
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [pitchDeckOpen, setPitchDeckOpen] = useState(false);
  const [aiAssistantOpen, setAIAssistantOpen] = useState(false);
  const [riskPanelOpen, setRiskPanelOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);

  const closeAllFeatures = useCallback(() => {
    setCalendarOpen(false);
    setSaveTemplateOpen(false);
    setPitchDeckOpen(false);
    setAIAssistantOpen(false);
    setRiskPanelOpen(false);
    setCustomFieldsOpen(false);
  }, []);

  return {
    create: {
      // State
      blockOpen,
      sectionOpen,
      taskOpen,
      blockTitle,
      blockTitleRu,
      sectionTitle,
      taskTitle,
      taskDescription,
      targetBlockId,
      targetSectionId,

      // Actions
      openBlock: () => setBlockOpen(true),
      openSection: (blockId: number) => {
        setTargetBlockId(blockId);
        setSectionOpen(true);
      },
      openTask: (sectionId: number) => {
        setTargetSectionId(sectionId);
        setTaskOpen(true);
      },
      closeBlock: () => {
        setBlockOpen(false);
        resetBlockForm();
      },
      closeSection: () => {
        setSectionOpen(false);
        resetSectionForm();
      },
      closeTask: () => {
        setTaskOpen(false);
        resetTaskForm();
      },
      // Dialog onOpenChange-compatible setters
      setBlockOpen: (open: boolean) => {
        if (open) setBlockOpen(true);
        else { setBlockOpen(false); resetBlockForm(); }
      },
      setSectionOpen: (open: boolean) => {
        if (open) setSectionOpen(true);
        else { setSectionOpen(false); resetSectionForm(); }
      },
      setTaskOpen: (open: boolean) => {
        if (open) setTaskOpen(true);
        else { setTaskOpen(false); resetTaskForm(); }
      },
      setBlockTitle,
      setBlockTitleRu,
      setSectionTitle,
      setTaskTitle,
      setTaskDescription,
      resetBlockForm,
      resetSectionForm,
      resetTaskForm,
    },

    taskAction: {
      // State
      splitOpen,
      mergeOpen,
      convertToSectionOpen,
      convertToTaskOpen,
      bulkActionsOpen,

      // Actions
      openSplit: () => setSplitOpen(true),
      openMerge: () => setMergeOpen(true),
      openConvertToSection: () => setConvertToSectionOpen(true),
      openConvertToTask: () => setConvertToTaskOpen(true),
      openBulkActions: () => setBulkActionsOpen(true),
      closeSplit: () => setSplitOpen(false),
      closeMerge: () => setMergeOpen(false),
      closeConvertToSection: () => setConvertToSectionOpen(false),
      closeConvertToTask: () => setConvertToTaskOpen(false),
      closeBulkActions: () => setBulkActionsOpen(false),
      closeAllTaskActions,
      // Dialog onOpenChange-compatible setters
      setSplitOpen,
      setMergeOpen,
      setConvertToSectionOpen,
      setConvertToTaskOpen,
      setBulkActionsOpen,
    },

    feature: {
      // State
      calendarOpen,
      saveTemplateOpen,
      pitchDeckOpen,
      aiAssistantOpen,
      riskPanelOpen,
      customFieldsOpen,

      // Actions
      openCalendar: () => setCalendarOpen(true),
      openSaveTemplate: () => setSaveTemplateOpen(true),
      openPitchDeck: () => setPitchDeckOpen(true),
      openAIAssistant: () => setAIAssistantOpen(true),
      openRiskPanel: () => setRiskPanelOpen(true),
      openCustomFields: () => setCustomFieldsOpen(true),
      closeCalendar: () => setCalendarOpen(false),
      closeSaveTemplate: () => setSaveTemplateOpen(false),
      closePitchDeck: () => setPitchDeckOpen(false),
      closeAIAssistant: () => setAIAssistantOpen(false),
      closeRiskPanel: () => setRiskPanelOpen(false),
      closeCustomFields: () => setCustomFieldsOpen(false),
      closeAllFeatures,
      // Dialog onOpenChange-compatible setters
      setCalendarOpen,
      setSaveTemplateOpen,
      setPitchDeckOpen,
      setAIAssistantOpen,
      setRiskPanelOpen,
      setCustomFieldsOpen,
    },
  };
}
