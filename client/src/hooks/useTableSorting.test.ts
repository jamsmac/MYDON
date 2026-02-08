/**
 * Tests for useTableSorting hook
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSorting } from "./useTableSorting";

describe("useTableSorting", () => {
  const mockTasks = [
    { id: 1, title: "Alpha Task", status: "not_started", priority: "high", deadline: new Date("2024-12-01") },
    { id: 2, title: "Beta Task", status: "in_progress", priority: "critical", deadline: new Date("2024-11-01") },
    { id: 3, title: "Gamma Task", status: "completed", priority: "low", deadline: null },
    { id: 4, title: "Delta Task", status: "not_started", priority: "medium", deadline: new Date("2024-10-01") },
  ];

  describe("initial state", () => {
    it("should initialize with no sorting", () => {
      const { result } = renderHook(() => useTableSorting({ tasks: mockTasks }));

      expect(result.current.sortField).toBeNull();
      expect(result.current.sortDirection).toBe("asc");
    });

    it("should initialize with provided sort field", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "desc" })
      );

      expect(result.current.sortField).toBe("title");
      expect(result.current.sortDirection).toBe("desc");
    });

    it("should initialize with provided search query", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSearchQuery: "Alpha" })
      );

      expect(result.current.searchQuery).toBe("Alpha");
    });
  });

  describe("handleSort", () => {
    it("should set sort field on first click", () => {
      const { result } = renderHook(() => useTableSorting({ tasks: mockTasks }));

      act(() => {
        result.current.handleSort("title");
      });

      expect(result.current.sortField).toBe("title");
      expect(result.current.sortDirection).toBe("asc");
    });

    it("should toggle direction on same field click", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "asc" })
      );

      expect(result.current.sortField).toBe("title");
      expect(result.current.sortDirection).toBe("asc");

      act(() => {
        result.current.handleSort("title");
      });
      expect(result.current.sortDirection).toBe("desc");

      act(() => {
        result.current.handleSort("title");
      });
      expect(result.current.sortDirection).toBe("asc");
    });

    it("should reset direction when switching fields", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "desc" })
      );

      expect(result.current.sortField).toBe("title");
      expect(result.current.sortDirection).toBe("desc");

      act(() => {
        result.current.handleSort("priority"); // New field
      });
      expect(result.current.sortField).toBe("priority");
      expect(result.current.sortDirection).toBe("asc");
    });
  });

  describe("processedTasks - sorting", () => {
    it("should sort by title ascending", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "asc" })
      );

      const titles = result.current.processedTasks.map((t) => t.title);
      expect(titles).toEqual(["Alpha Task", "Beta Task", "Delta Task", "Gamma Task"]);
    });

    it("should sort by title descending", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "desc" })
      );

      const titles = result.current.processedTasks.map((t) => t.title);
      expect(titles).toEqual(["Gamma Task", "Delta Task", "Beta Task", "Alpha Task"]);
    });

    it("should sort by priority with correct order (critical first)", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "priority", initialSortDirection: "asc" })
      );

      const priorities = result.current.processedTasks.map((t) => t.priority);
      expect(priorities[0]).toBe("critical");
      expect(priorities[priorities.length - 1]).toBe("low");
    });

    it("should sort by status with correct order", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "status", initialSortDirection: "asc" })
      );

      const statuses = result.current.processedTasks.map((t) => t.status);
      expect(statuses[0]).toBe("not_started");
    });

    it("should sort by deadline with nulls first (as 0)", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "deadline", initialSortDirection: "asc" })
      );

      const deadlines = result.current.processedTasks.map((t) => t.deadline);
      // Null is converted to 0, so appears first in ascending order
      expect(deadlines[0]).toBeNull();
    });
  });

  describe("processedTasks - filtering", () => {
    it("should filter by search query", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSearchQuery: "Beta" })
      );

      expect(result.current.processedTasks).toHaveLength(1);
      expect(result.current.processedTasks[0].title).toBe("Beta Task");
    });

    it("should filter case-insensitively", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSearchQuery: "ALPHA" })
      );

      expect(result.current.processedTasks).toHaveLength(1);
      expect(result.current.processedTasks[0].title).toBe("Alpha Task");
    });

    it("should return all tasks for empty search", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSearchQuery: "" })
      );

      expect(result.current.processedTasks).toHaveLength(4);
    });

    it("should return empty array for no matches", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSearchQuery: "XYZ" })
      );

      expect(result.current.processedTasks).toHaveLength(0);
    });
  });

  describe("setSearchQuery", () => {
    it("should update search query", () => {
      const { result } = renderHook(() => useTableSorting({ tasks: mockTasks }));

      act(() => {
        result.current.setSearchQuery("Delta");
      });

      expect(result.current.searchQuery).toBe("Delta");
      expect(result.current.processedTasks).toHaveLength(1);
    });
  });

  describe("resetSort", () => {
    it("should reset sort field and direction", () => {
      const { result } = renderHook(() =>
        useTableSorting({ tasks: mockTasks, initialSortField: "title", initialSortDirection: "desc" })
      );

      act(() => {
        result.current.resetSort();
      });

      expect(result.current.sortField).toBeNull();
      expect(result.current.sortDirection).toBe("asc");
    });
  });

  describe("combined sorting and filtering", () => {
    it("should apply both filter and sort", () => {
      const { result } = renderHook(() =>
        useTableSorting({
          tasks: mockTasks,
          initialSearchQuery: "Task", // All have "Task" in title
          initialSortField: "priority",
          initialSortDirection: "asc",
        })
      );

      expect(result.current.processedTasks).toHaveLength(4);
      expect(result.current.processedTasks[0].priority).toBe("critical");
    });
  });
});
