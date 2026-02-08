/**
 * Shared filter utilities for tasks, projects, and other entities
 *
 * Provides:
 * - Type-safe filter functions
 * - Common filter predicates
 * - Counting utilities
 * - Sorting utilities
 */

import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_PRIORITY_ORDER,
  type TaskStatus,
  type TaskPriority,
} from "@shared/const";

// ============ GENERIC FILTER TYPES ============

export interface HasStatus {
  status?: string | null;
}

export interface HasPriority {
  priority?: string | null;
}

export interface HasDeadline {
  deadline?: Date | string | number | null;
  dueDate?: Date | string | number | null;
}

export interface HasTitle {
  title?: string | null;
  name?: string | null;
}

// ============ STATUS FILTERS ============

/**
 * Filter items by status
 */
export function filterByStatus<T extends HasStatus>(
  items: T[],
  status: string | string[]
): T[] {
  const statuses = Array.isArray(status) ? status : [status];
  return items.filter((item) => statuses.includes(item.status ?? ""));
}

/**
 * Get items with completed status
 */
export function filterCompleted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === TASK_STATUS.COMPLETED);
}

/**
 * Get items that are not completed
 */
export function filterNotCompleted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status !== TASK_STATUS.COMPLETED);
}

/**
 * Get items in progress
 */
export function filterInProgress<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === TASK_STATUS.IN_PROGRESS);
}

/**
 * Get items not started
 */
export function filterNotStarted<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === TASK_STATUS.NOT_STARTED);
}

/**
 * Get active items (not completed)
 */
export function filterActive<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === "active" || item.status !== TASK_STATUS.COMPLETED);
}

// ============ PRIORITY FILTERS ============

/**
 * Filter items by priority
 */
export function filterByPriority<T extends HasPriority>(
  items: T[],
  priority: TaskPriority | TaskPriority[]
): T[] {
  const priorities = Array.isArray(priority) ? priority : [priority];
  return items.filter((item) => priorities.includes(item.priority as TaskPriority));
}

/**
 * Get high priority items (critical or high)
 */
export function filterHighPriority<T extends HasPriority>(items: T[]): T[] {
  return items.filter(
    (item) =>
      item.priority === TASK_PRIORITY.CRITICAL ||
      item.priority === TASK_PRIORITY.HIGH
  );
}

/**
 * Get critical items only
 */
export function filterCritical<T extends HasPriority>(items: T[]): T[] {
  return items.filter((item) => item.priority === TASK_PRIORITY.CRITICAL);
}

// ============ DEADLINE FILTERS ============

/**
 * Get items with a deadline
 */
export function filterWithDeadline<T extends HasDeadline>(items: T[]): T[] {
  return items.filter((item) => item.deadline || item.dueDate);
}

/**
 * Get items without a deadline
 */
export function filterWithoutDeadline<T extends HasDeadline>(items: T[]): T[] {
  return items.filter((item) => !item.deadline && !item.dueDate);
}

/**
 * Get overdue items (deadline in the past)
 */
export function filterOverdue<T extends HasDeadline & HasStatus>(items: T[]): T[] {
  const now = new Date();
  return items.filter((item) => {
    if (item.status === TASK_STATUS.COMPLETED) return false;
    const deadline = item.deadline || item.dueDate;
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    return deadlineDate < now;
  });
}

/**
 * Get items due today
 */
export function filterDueToday<T extends HasDeadline>(items: T[]): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return items.filter((item) => {
    const deadline = item.deadline || item.dueDate;
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    return deadlineDate >= today && deadlineDate < tomorrow;
  });
}

/**
 * Get items due this week
 */
export function filterDueThisWeek<T extends HasDeadline>(items: T[]): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return items.filter((item) => {
    const deadline = item.deadline || item.dueDate;
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    return deadlineDate >= today && deadlineDate < weekEnd;
  });
}

// ============ TEXT SEARCH ============

/**
 * Filter items by text search (case-insensitive)
 */
export function filterBySearch<T extends HasTitle>(
  items: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return items;
  const term = searchTerm.toLowerCase().trim();
  return items.filter((item) => {
    const title = (item.title || item.name || "").toLowerCase();
    return title.includes(term);
  });
}

// ============ COUNTING UTILITIES ============

/**
 * Count items by status
 */
export function countByStatus<T extends HasStatus>(items: T[]): Record<string, number> {
  return items.reduce((acc, item) => {
    const status = item.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Count completed items
 */
export function countCompleted<T extends HasStatus>(items: T[]): number {
  return items.filter((item) => item.status === TASK_STATUS.COMPLETED).length;
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage<T extends HasStatus>(items: T[]): number {
  if (items.length === 0) return 0;
  return Math.round((countCompleted(items) / items.length) * 100);
}

/**
 * Count items by priority
 */
export function countByPriority<T extends HasPriority>(items: T[]): Record<string, number> {
  return items.reduce((acc, item) => {
    const priority = item.priority || "none";
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ============ SORTING UTILITIES ============

/**
 * Sort by priority (critical first)
 */
export function sortByPriority<T extends HasPriority>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aIndex = TASK_PRIORITY_ORDER.indexOf(a.priority as TaskPriority);
    const bIndex = TASK_PRIORITY_ORDER.indexOf(b.priority as TaskPriority);
    // -1 means not found, put at end
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;
    return aOrder - bOrder;
  });
}

/**
 * Sort by deadline (earliest first)
 */
export function sortByDeadline<T extends HasDeadline>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aDeadline = a.deadline || a.dueDate;
    const bDeadline = b.deadline || b.dueDate;
    if (!aDeadline && !bDeadline) return 0;
    if (!aDeadline) return 1;
    if (!bDeadline) return -1;
    return new Date(aDeadline).getTime() - new Date(bDeadline).getTime();
  });
}

/**
 * Sort by status (in_progress first, then not_started, then completed)
 */
export function sortByStatus<T extends HasStatus>(items: T[]): T[] {
  const statusOrder: Record<string, number> = {
    [TASK_STATUS.IN_PROGRESS]: 0,
    [TASK_STATUS.NOT_STARTED]: 1,
    [TASK_STATUS.COMPLETED]: 2,
  };

  return [...items].sort((a, b) => {
    const aOrder = statusOrder[a.status ?? ""] ?? 99;
    const bOrder = statusOrder[b.status ?? ""] ?? 99;
    return aOrder - bOrder;
  });
}

// ============ COMBINED FILTERS ============

export interface FilterOptions {
  status?: string | string[];
  priority?: TaskPriority | TaskPriority[];
  search?: string;
  hasDeadline?: boolean;
  isOverdue?: boolean;
}

/**
 * Apply multiple filters at once
 */
export function applyFilters<T extends HasStatus & HasPriority & HasTitle & HasDeadline>(
  items: T[],
  options: FilterOptions
): T[] {
  let result = items;

  if (options.status) {
    result = filterByStatus(result, options.status);
  }

  if (options.priority) {
    result = filterByPriority(result, options.priority);
  }

  if (options.search) {
    result = filterBySearch(result, options.search);
  }

  if (options.hasDeadline !== undefined) {
    result = options.hasDeadline
      ? filterWithDeadline(result)
      : filterWithoutDeadline(result);
  }

  if (options.isOverdue) {
    result = filterOverdue(result);
  }

  return result;
}

// ============ PROJECT FILTERS ============

export interface HasTargetDate {
  targetDate?: Date | string | number | null;
}

export interface HasName {
  name?: string | null;
  description?: string | null;
}

/**
 * Filter projects by active status
 */
export function filterActiveProjects<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === "active");
}

/**
 * Filter projects by completed status
 */
export function filterCompletedProjects<T extends HasStatus>(items: T[]): T[] {
  return items.filter((item) => item.status === "completed");
}

/**
 * Filter overdue projects (target date in the past and not completed)
 */
export function filterOverdueProjects<T extends HasStatus & HasTargetDate>(items: T[]): T[] {
  const now = new Date();
  return items.filter((item) => {
    if (item.status === "completed") return false;
    if (!item.targetDate) return false;
    return new Date(item.targetDate) < now;
  });
}

/**
 * Search projects by name and description
 */
export function searchProjects<T extends HasName>(items: T[], query: string): T[] {
  if (!query.trim()) return items;
  const term = query.toLowerCase().trim();
  return items.filter((item) => {
    const name = (item.name || "").toLowerCase();
    const description = (item.description || "").toLowerCase();
    return name.includes(term) || description.includes(term);
  });
}

/**
 * Count active projects
 */
export function countActiveProjects<T extends HasStatus>(items: T[]): number {
  return filterActiveProjects(items).length;
}

/**
 * Count completed projects
 */
export function countCompletedProjects<T extends HasStatus>(items: T[]): number {
  return filterCompletedProjects(items).length;
}

/**
 * Count overdue projects
 */
export function countOverdueProjects<T extends HasStatus & HasTargetDate>(items: T[]): number {
  return filterOverdueProjects(items).length;
}

// ============ GENERIC CATEGORY FILTERS ============

export interface HasCategory {
  category?: string | null;
}

export interface HasUnlocked {
  unlocked?: boolean;
}

/**
 * Filter items by category
 */
export function filterByCategory<T extends HasCategory>(items: T[], category: string): T[] {
  return items.filter((item) => item.category === category);
}

/**
 * Filter unlocked items (e.g., achievements)
 */
export function filterUnlocked<T extends HasUnlocked>(items: T[]): T[] {
  return items.filter((item) => item.unlocked);
}

/**
 * Count items in category
 */
export function countByCategory<T extends HasCategory>(items: T[], category: string): number {
  return filterByCategory(items, category).length;
}

/**
 * Count unlocked items in category
 */
export function countUnlockedInCategory<T extends HasCategory & HasUnlocked>(
  items: T[],
  category: string
): number {
  return items.filter((item) => item.category === category && item.unlocked).length;
}
