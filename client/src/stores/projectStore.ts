/**
 * Project Store - Zustand state management
 *
 * Centralizes project-related state that was previously passed through props/context
 * Includes:
 * - Current project data
 * - Selected entities (block, section, task)
 * - UI state (sidebar, panels)
 * - Filter state
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { TaskStatus, TaskPriority } from "@shared/const";

// ============ TYPES ============

export interface ProjectData {
  id: number;
  name: string;
  description?: string | null;
  status?: string;
  icon?: string | null;
  color?: string | null;
}

export interface SelectedContext {
  type: "project" | "block" | "section" | "task";
  id: number;
  title: string;
}

export interface FilterState {
  search: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  assignee: number | null;
  hasDeadline: boolean | null;
  isOverdue: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  detailPanelOpen: boolean;
  bulkActionsOpen: boolean;
  createDialogOpen: boolean;
  createDialogType: "block" | "section" | "task" | null;
}

// ============ STORE STATE ============

interface ProjectState {
  // Current project
  currentProject: ProjectData | null;

  // Selected context
  selectedContext: SelectedContext | null;

  // Selected items for bulk operations
  selectedTaskIds: number[];

  // Filters
  filters: FilterState;

  // UI state
  ui: UIState;

  // Actions - Project
  setCurrentProject: (project: ProjectData | null) => void;
  clearProject: () => void;

  // Actions - Selection
  setSelectedContext: (context: SelectedContext | null) => void;
  selectBlock: (id: number, title: string) => void;
  selectSection: (id: number, title: string) => void;
  selectTask: (id: number, title: string) => void;
  clearSelection: () => void;

  // Actions - Bulk selection
  toggleTaskSelection: (taskId: number) => void;
  selectAllTasks: (taskIds: number[]) => void;
  clearTaskSelection: () => void;
  isTaskSelected: (taskId: number) => boolean;

  // Actions - Filters
  setSearchFilter: (search: string) => void;
  setStatusFilter: (status: TaskStatus[]) => void;
  setPriorityFilter: (priority: TaskPriority[]) => void;
  setAssigneeFilter: (assignee: number | null) => void;
  setDeadlineFilter: (hasDeadline: boolean | null) => void;
  setOverdueFilter: (isOverdue: boolean) => void;
  clearFilters: () => void;
  hasActiveFilters: () => boolean;

  // Actions - UI
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  openBulkActions: () => void;
  closeBulkActions: () => void;
  openCreateDialog: (type: "block" | "section" | "task") => void;
  closeCreateDialog: () => void;

  // Reset
  reset: () => void;
}

// ============ INITIAL STATE ============

const initialFilters: FilterState = {
  search: "",
  status: [],
  priority: [],
  assignee: null,
  hasDeadline: null,
  isOverdue: false,
};

const initialUI: UIState = {
  sidebarOpen: true,
  detailPanelOpen: false,
  bulkActionsOpen: false,
  createDialogOpen: false,
  createDialogType: null,
};

// ============ STORE ============

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentProject: null,
        selectedContext: null,
        selectedTaskIds: [],
        filters: initialFilters,
        ui: initialUI,

        // Project actions
        setCurrentProject: (project) =>
          set({ currentProject: project }, false, "setCurrentProject"),

        clearProject: () =>
          set(
            {
              currentProject: null,
              selectedContext: null,
              selectedTaskIds: [],
              filters: initialFilters,
            },
            false,
            "clearProject"
          ),

        // Selection actions
        setSelectedContext: (context) =>
          set({ selectedContext: context, ui: { ...get().ui, detailPanelOpen: !!context } }, false, "setSelectedContext"),

        selectBlock: (id, title) =>
          set(
            {
              selectedContext: { type: "block", id, title },
              ui: { ...get().ui, detailPanelOpen: true },
            },
            false,
            "selectBlock"
          ),

        selectSection: (id, title) =>
          set(
            {
              selectedContext: { type: "section", id, title },
              ui: { ...get().ui, detailPanelOpen: true },
            },
            false,
            "selectSection"
          ),

        selectTask: (id, title) =>
          set(
            {
              selectedContext: { type: "task", id, title },
              ui: { ...get().ui, detailPanelOpen: true },
            },
            false,
            "selectTask"
          ),

        clearSelection: () =>
          set(
            {
              selectedContext: null,
              ui: { ...get().ui, detailPanelOpen: false },
            },
            false,
            "clearSelection"
          ),

        // Bulk selection actions
        toggleTaskSelection: (taskId) =>
          set(
            (state) => ({
              selectedTaskIds: state.selectedTaskIds.includes(taskId)
                ? state.selectedTaskIds.filter((id) => id !== taskId)
                : [...state.selectedTaskIds, taskId],
            }),
            false,
            "toggleTaskSelection"
          ),

        selectAllTasks: (taskIds) =>
          set({ selectedTaskIds: taskIds }, false, "selectAllTasks"),

        clearTaskSelection: () =>
          set({ selectedTaskIds: [] }, false, "clearTaskSelection"),

        isTaskSelected: (taskId) => get().selectedTaskIds.includes(taskId),

        // Filter actions
        setSearchFilter: (search) =>
          set(
            (state) => ({ filters: { ...state.filters, search } }),
            false,
            "setSearchFilter"
          ),

        setStatusFilter: (status) =>
          set(
            (state) => ({ filters: { ...state.filters, status } }),
            false,
            "setStatusFilter"
          ),

        setPriorityFilter: (priority) =>
          set(
            (state) => ({ filters: { ...state.filters, priority } }),
            false,
            "setPriorityFilter"
          ),

        setAssigneeFilter: (assignee) =>
          set(
            (state) => ({ filters: { ...state.filters, assignee } }),
            false,
            "setAssigneeFilter"
          ),

        setDeadlineFilter: (hasDeadline) =>
          set(
            (state) => ({ filters: { ...state.filters, hasDeadline } }),
            false,
            "setDeadlineFilter"
          ),

        setOverdueFilter: (isOverdue) =>
          set(
            (state) => ({ filters: { ...state.filters, isOverdue } }),
            false,
            "setOverdueFilter"
          ),

        clearFilters: () =>
          set({ filters: initialFilters }, false, "clearFilters"),

        hasActiveFilters: () => {
          const { filters } = get();
          return (
            filters.search !== "" ||
            filters.status.length > 0 ||
            filters.priority.length > 0 ||
            filters.assignee !== null ||
            filters.hasDeadline !== null ||
            filters.isOverdue
          );
        },

        // UI actions
        toggleSidebar: () =>
          set(
            (state) => ({
              ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
            }),
            false,
            "toggleSidebar"
          ),

        setSidebarOpen: (open) =>
          set(
            (state) => ({ ui: { ...state.ui, sidebarOpen: open } }),
            false,
            "setSidebarOpen"
          ),

        toggleDetailPanel: () =>
          set(
            (state) => ({
              ui: { ...state.ui, detailPanelOpen: !state.ui.detailPanelOpen },
            }),
            false,
            "toggleDetailPanel"
          ),

        setDetailPanelOpen: (open) =>
          set(
            (state) => ({ ui: { ...state.ui, detailPanelOpen: open } }),
            false,
            "setDetailPanelOpen"
          ),

        openBulkActions: () =>
          set(
            (state) => ({ ui: { ...state.ui, bulkActionsOpen: true } }),
            false,
            "openBulkActions"
          ),

        closeBulkActions: () =>
          set(
            (state) => ({
              ui: { ...state.ui, bulkActionsOpen: false },
              selectedTaskIds: [],
            }),
            false,
            "closeBulkActions"
          ),

        openCreateDialog: (type) =>
          set(
            (state) => ({
              ui: { ...state.ui, createDialogOpen: true, createDialogType: type },
            }),
            false,
            "openCreateDialog"
          ),

        closeCreateDialog: () =>
          set(
            (state) => ({
              ui: { ...state.ui, createDialogOpen: false, createDialogType: null },
            }),
            false,
            "closeCreateDialog"
          ),

        // Reset
        reset: () =>
          set(
            {
              currentProject: null,
              selectedContext: null,
              selectedTaskIds: [],
              filters: initialFilters,
              ui: initialUI,
            },
            false,
            "reset"
          ),
      }),
      {
        name: "project-store",
        // Only persist UI preferences, not current project/selection
        partialize: (state) => ({
          ui: {
            sidebarOpen: state.ui.sidebarOpen,
          },
        }),
      }
    ),
    { name: "ProjectStore" }
  )
);

// ============ SELECTORS ============

// Memoized selectors for common use cases
export const selectCurrentProject = (state: ProjectState) => state.currentProject;
export const selectSelectedContext = (state: ProjectState) => state.selectedContext;
export const selectFilters = (state: ProjectState) => state.filters;
export const selectUI = (state: ProjectState) => state.ui;
export const selectSelectedTaskIds = (state: ProjectState) => state.selectedTaskIds;

// Derived selectors
export const selectHasActiveFilters = (state: ProjectState) =>
  state.filters.search !== "" ||
  state.filters.status.length > 0 ||
  state.filters.priority.length > 0 ||
  state.filters.assignee !== null ||
  state.filters.hasDeadline !== null ||
  state.filters.isOverdue;

export const selectSelectedTaskCount = (state: ProjectState) =>
  state.selectedTaskIds.length;
