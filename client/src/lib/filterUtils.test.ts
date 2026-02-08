/**
 * Tests for filter utilities
 */

import { describe, it, expect } from "vitest";
import {
  filterByStatus,
  filterCompleted,
  filterNotCompleted,
  filterByPriority,
  filterHighPriority,
  filterOverdue,
  filterBySearch,
  countCompleted,
  calculateCompletionPercentage,
  sortByPriority,
  sortByDeadline,
  applyFilters,
} from "./filterUtils";

describe("filterUtils", () => {
  // Test data with dynamic dates
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1); // 1 year in the future

  const pastDate = new Date();
  pastDate.setFullYear(pastDate.getFullYear() - 1); // 1 year in the past

  const tasks = [
    { id: 1, title: "Task 1", status: "completed", priority: "high", deadline: null },
    { id: 2, title: "Task 2", status: "in_progress", priority: "medium", deadline: futureDate },
    { id: 3, title: "Task 3", status: "not_started", priority: "critical", deadline: pastDate },
    { id: 4, title: "Another Task", status: "completed", priority: "low", deadline: null },
  ];

  describe("filterByStatus", () => {
    it("should filter by single status", () => {
      const result = filterByStatus(tasks, "completed");
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === "completed")).toBe(true);
    });

    it("should filter by multiple statuses", () => {
      const result = filterByStatus(tasks, ["completed", "in_progress"]);
      expect(result).toHaveLength(3);
    });
  });

  describe("filterCompleted", () => {
    it("should return only completed tasks", () => {
      const result = filterCompleted(tasks);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === "completed")).toBe(true);
    });
  });

  describe("filterNotCompleted", () => {
    it("should return tasks that are not completed", () => {
      const result = filterNotCompleted(tasks);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status !== "completed")).toBe(true);
    });
  });

  describe("filterByPriority", () => {
    it("should filter by single priority", () => {
      const result = filterByPriority(tasks, "high");
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe("high");
    });

    it("should filter by multiple priorities", () => {
      const result = filterByPriority(tasks, ["high", "critical"]);
      expect(result).toHaveLength(2);
    });
  });

  describe("filterHighPriority", () => {
    it("should return high and critical priority tasks", () => {
      const result = filterHighPriority(tasks);
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.priority === "high" || t.priority === "critical")).toBe(true);
    });
  });

  describe("filterOverdue", () => {
    it("should return overdue tasks", () => {
      // Task 3 has deadline in the past and is not completed
      const result = filterOverdue(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it("should not include completed tasks", () => {
      const tasksWithCompletedOverdue = [
        ...tasks,
        { id: 5, title: "Old Completed", status: "completed", priority: "medium", deadline: new Date("2020-01-01") },
      ];
      const result = filterOverdue(tasksWithCompletedOverdue);
      expect(result.every((t) => t.status !== "completed")).toBe(true);
    });
  });

  describe("filterBySearch", () => {
    it("should filter by search term (case-insensitive)", () => {
      const result = filterBySearch(tasks, "another");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Another Task");
    });

    it("should return all items for empty search", () => {
      const result = filterBySearch(tasks, "");
      expect(result).toHaveLength(tasks.length);
    });

    it("should return empty array for no matches", () => {
      const result = filterBySearch(tasks, "xyz");
      expect(result).toHaveLength(0);
    });
  });

  describe("countCompleted", () => {
    it("should count completed tasks", () => {
      const count = countCompleted(tasks);
      expect(count).toBe(2);
    });
  });

  describe("calculateCompletionPercentage", () => {
    it("should calculate correct percentage", () => {
      const percentage = calculateCompletionPercentage(tasks);
      expect(percentage).toBe(50); // 2 out of 4
    });

    it("should return 0 for empty array", () => {
      const percentage = calculateCompletionPercentage([]);
      expect(percentage).toBe(0);
    });
  });

  describe("sortByPriority", () => {
    it("should sort by priority (critical first)", () => {
      const result = sortByPriority(tasks);
      expect(result[0].priority).toBe("critical");
      expect(result[1].priority).toBe("high");
    });

    it("should not mutate original array", () => {
      const original = [...tasks];
      sortByPriority(tasks);
      expect(tasks).toEqual(original);
    });
  });

  describe("sortByDeadline", () => {
    it("should sort by deadline (earliest first)", () => {
      const result = sortByDeadline(tasks);
      // Tasks with deadlines should come first
      expect(result[0].deadline).not.toBeNull();
    });

    it("should put tasks without deadline at the end", () => {
      const result = sortByDeadline(tasks);
      const lastTwo = result.slice(-2);
      expect(lastTwo.every((t) => t.deadline === null)).toBe(true);
    });
  });

  describe("applyFilters", () => {
    it("should apply multiple filters", () => {
      const result = applyFilters(tasks, {
        status: "completed",
        search: "task",
      });
      expect(result).toHaveLength(2);
    });

    it("should return all items with no filters", () => {
      const result = applyFilters(tasks, {});
      expect(result).toHaveLength(tasks.length);
    });
  });
});
