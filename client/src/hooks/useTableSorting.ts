/**
 * useTableSorting - Hook for table sorting and filtering logic
 * Extracted from TableView.tsx for reusability
 */

import { useState, useMemo, useCallback } from 'react';
import { type CustomFieldFilterRule, taskPassesAllFilters } from '@/components/CustomFieldFilter';

export type SortField = 'title' | 'status' | 'priority' | 'deadline' | 'assignedTo' | 'blockTitle';
export type SortDirection = 'asc' | 'desc';

interface TableTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  deadline?: Date | string | null;
  assignedTo?: number | null;
  blockTitle?: string;
  [key: string]: unknown;
}

interface UseTableSortingOptions<T extends TableTask> {
  tasks: T[];
  initialSortField?: SortField | null;
  initialSortDirection?: SortDirection;
  initialSearchQuery?: string;
  initialCustomFieldFilters?: CustomFieldFilterRule[];
  filterValuesMap?: Map<number, Map<number, unknown>>;
  fieldsMap?: Map<number, unknown>;
}

interface UseTableSortingReturn<T extends TableTask> {
  // State
  sortField: SortField | null;
  sortDirection: SortDirection;
  searchQuery: string;
  customFieldFilters: CustomFieldFilterRule[];

  // Processed data
  processedTasks: T[];

  // Actions
  handleSort: (field: SortField) => void;
  setSearchQuery: (query: string) => void;
  setCustomFieldFilters: (filters: CustomFieldFilterRule[]) => void;
  resetSort: () => void;
}

// Priority sort order
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  '': 4,
};

// Status sort order
const STATUS_ORDER: Record<string, number> = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
};

export function useTableSorting<T extends TableTask>({
  tasks,
  initialSortField = null,
  initialSortDirection = 'asc',
  initialSearchQuery = '',
  initialCustomFieldFilters = [],
  filterValuesMap,
  fieldsMap,
}: UseTableSortingOptions<T>): UseTableSortingReturn<T> {
  const [sortField, setSortField] = useState<SortField | null>(initialSortField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterRule[]>(initialCustomFieldFilters);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const resetSort = useCallback(() => {
    setSortField(null);
    setSortDirection('asc');
  }, []);

  const processedTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    }

    // Filter by custom fields
    if (customFieldFilters.length > 0 && filterValuesMap && fieldsMap) {
      result = result.filter(task =>
        taskPassesAllFilters(customFieldFilters, task.id, filterValuesMap as any, fieldsMap as any)
      );
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal: unknown = a[sortField];
        let bVal: unknown = b[sortField];

        // Handle null values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        // Handle dates
        if (sortField === 'deadline') {
          aVal = aVal ? new Date(aVal as string | Date).getTime() : 0;
          bVal = bVal ? new Date(bVal as string | Date).getTime() : 0;
        }

        // Handle priority order
        if (sortField === 'priority') {
          aVal = PRIORITY_ORDER[aVal as string] ?? 4;
          bVal = PRIORITY_ORDER[bVal as string] ?? 4;
        }

        // Handle status order
        if (sortField === 'status') {
          aVal = STATUS_ORDER[aVal as string] ?? 0;
          bVal = STATUS_ORDER[bVal as string] ?? 0;
        }

        // Compare values (cast to any for comparison)
        const aComp = aVal as string | number;
        const bComp = bVal as string | number;
        if (aComp < bComp) return sortDirection === 'asc' ? -1 : 1;
        if (aComp > bComp) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tasks, sortField, sortDirection, searchQuery, customFieldFilters, filterValuesMap, fieldsMap]);

  return {
    sortField,
    sortDirection,
    searchQuery,
    customFieldFilters,
    processedTasks,
    handleSort,
    setSearchQuery,
    setCustomFieldFilters,
    resetSort,
  };
}
