/**
 * Tests for useTableSelection hook
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSelection } from "./useTableSelection";

describe("useTableSelection", () => {
  describe("initial state", () => {
    it("should initialize with empty selection", () => {
      const { result } = renderHook(() => useTableSelection());

      expect(result.current.selectedTasks.size).toBe(0);
      expect(result.current.selectionCount).toBe(0);
    });

    it("should initialize with provided selection", () => {
      const { result } = renderHook(() => useTableSelection({ initialSelected: [1, 2, 3] }));

      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isSelected(1)).toBe(true);
      expect(result.current.isSelected(2)).toBe(true);
      expect(result.current.isSelected(3)).toBe(true);
    });
  });

  describe("toggleTask", () => {
    it("should add task to selection", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
      });

      expect(result.current.selectedTasks.has(1)).toBe(true);
      expect(result.current.selectionCount).toBe(1);
    });

    it("should remove task from selection on second toggle", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
      });
      expect(result.current.selectedTasks.has(1)).toBe(true);

      act(() => {
        result.current.toggleTask(1);
      });
      expect(result.current.selectedTasks.has(1)).toBe(false);
      expect(result.current.selectionCount).toBe(0);
    });

    it("should handle multiple task selections", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
        result.current.toggleTask(3);
      });

      expect(result.current.selectionCount).toBe(3);
      expect(result.current.selectedTasks.has(1)).toBe(true);
      expect(result.current.selectedTasks.has(2)).toBe(true);
      expect(result.current.selectedTasks.has(3)).toBe(true);
    });
  });

  describe("isSelected", () => {
    it("should return true for selected task", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(42);
      });

      expect(result.current.isSelected(42)).toBe(true);
    });

    it("should return false for unselected task", () => {
      const { result } = renderHook(() => useTableSelection());

      expect(result.current.isSelected(999)).toBe(false);
    });
  });

  describe("toggleAll", () => {
    const taskIds = [1, 2, 3, 4, 5];

    it("should select all tasks when none selected", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleAll(taskIds);
      });

      expect(result.current.selectionCount).toBe(5);
      taskIds.forEach((id) => {
        expect(result.current.isSelected(id)).toBe(true);
      });
    });

    it("should deselect all when all are selected", () => {
      const { result } = renderHook(() => useTableSelection());

      // Select all
      act(() => {
        result.current.toggleAll(taskIds);
      });
      expect(result.current.selectionCount).toBe(5);

      // Toggle again should deselect all
      act(() => {
        result.current.toggleAll(taskIds);
      });
      expect(result.current.selectionCount).toBe(0);
    });

    it("should select all when only some are selected", () => {
      const { result } = renderHook(() => useTableSelection());

      // Select some
      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
      });
      expect(result.current.selectionCount).toBe(2);

      // Toggle all should select all (since not all are selected)
      act(() => {
        result.current.toggleAll(taskIds);
      });
      expect(result.current.selectionCount).toBe(5);
    });
  });

  describe("selectAll", () => {
    it("should select only specified tasks", () => {
      const { result } = renderHook(() => useTableSelection());

      // Select some tasks
      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
      });

      // Select all with different tasks
      act(() => {
        result.current.selectAll([5, 6, 7]);
      });

      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isSelected(1)).toBe(false);
      expect(result.current.isSelected(2)).toBe(false);
      expect(result.current.isSelected(5)).toBe(true);
      expect(result.current.isSelected(6)).toBe(true);
      expect(result.current.isSelected(7)).toBe(true);
    });

    it("should clear selection when passed empty array", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
      });

      act(() => {
        result.current.selectAll([]);
      });

      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe("clearSelection", () => {
    it("should clear all selections", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
        result.current.toggleTask(3);
      });
      expect(result.current.selectionCount).toBe(3);

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectionCount).toBe(0);
      expect(result.current.selectedTasks.size).toBe(0);
    });

    it("should work on empty selection", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.clearSelection();
      });
      expect(result.current.selectionCount).toBe(0);
    });
  });

  describe("selectedTaskIds", () => {
    it("should return array of selected ids", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(3);
        result.current.toggleTask(1);
        result.current.toggleTask(2);
      });

      const ids = result.current.selectedTaskIds;
      expect(ids).toHaveLength(3);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
    });

    it("should return empty array when nothing selected", () => {
      const { result } = renderHook(() => useTableSelection());

      const ids = result.current.selectedTaskIds;
      expect(ids).toEqual([]);
    });
  });

  describe("hasSelection", () => {
    it("should return false when nothing selected", () => {
      const { result } = renderHook(() => useTableSelection());

      expect(result.current.hasSelection).toBe(false);
    });

    it("should return true when something is selected", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
      });

      expect(result.current.hasSelection).toBe(true);
    });
  });

  describe("areAllSelected", () => {
    it("should return true when all specified tasks are selected", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.selectAll([1, 2, 3]);
      });

      expect(result.current.areAllSelected([1, 2, 3])).toBe(true);
    });

    it("should return false when not all specified tasks are selected", () => {
      const { result } = renderHook(() => useTableSelection());

      act(() => {
        result.current.toggleTask(1);
      });

      expect(result.current.areAllSelected([1, 2, 3])).toBe(false);
    });

    it("should return false for empty array", () => {
      const { result } = renderHook(() => useTableSelection());

      expect(result.current.areAllSelected([])).toBe(false);
    });
  });
});
