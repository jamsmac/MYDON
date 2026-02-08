/**
 * useTableSelection - Hook for managing table row selection
 * Extracted from TableView.tsx for reusability
 */

import { useState, useCallback, useMemo } from 'react';

interface UseTableSelectionOptions {
  initialSelected?: number[];
}

interface UseTableSelectionReturn {
  // State
  selectedTasks: Set<number>;
  selectedTaskIds: number[];
  hasSelection: boolean;
  selectionCount: number;

  // Actions
  toggleTask: (taskId: number) => void;
  toggleAll: (taskIds: number[]) => void;
  selectAll: (taskIds: number[]) => void;
  clearSelection: () => void;
  isSelected: (taskId: number) => boolean;
  areAllSelected: (taskIds: number[]) => boolean;
}

export function useTableSelection({
  initialSelected = [],
}: UseTableSelectionOptions = {}): UseTableSelectionReturn {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(
    () => new Set(initialSelected)
  );

  const toggleTask = useCallback((taskId: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((taskIds: number[]) => {
    setSelectedTasks(prev => {
      const allSelected = taskIds.every(id => prev.has(id));
      if (allSelected) {
        // Deselect all
        return new Set();
      } else {
        // Select all
        return new Set(taskIds);
      }
    });
  }, []);

  const selectAll = useCallback((taskIds: number[]) => {
    setSelectedTasks(new Set(taskIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
  }, []);

  const isSelected = useCallback((taskId: number) => {
    return selectedTasks.has(taskId);
  }, [selectedTasks]);

  const areAllSelected = useCallback((taskIds: number[]) => {
    return taskIds.length > 0 && taskIds.every(id => selectedTasks.has(id));
  }, [selectedTasks]);

  const selectedTaskIds = useMemo(() => Array.from(selectedTasks), [selectedTasks]);
  const hasSelection = selectedTasks.size > 0;
  const selectionCount = selectedTasks.size;

  return {
    selectedTasks,
    selectedTaskIds,
    hasSelection,
    selectionCount,
    toggleTask,
    toggleAll,
    selectAll,
    clearSelection,
    isSelected,
    areAllSelected,
  };
}
