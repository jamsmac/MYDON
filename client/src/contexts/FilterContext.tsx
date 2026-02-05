import React, { createContext, useContext, useState, useCallback } from 'react';

export type FilterType = 'all' | 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type GroupByType = 'none' | 'tag' | 'status' | 'priority';

export interface TagFilter {
  id: number;
  name: string;
  color: string;
}

interface FilterState {
  activeFilter: FilterType;
  showOnlyWithDeadlines: boolean;
  selectedTags: TagFilter[];
  tagFilterMode: 'any' | 'all'; // 'any' = OR, 'all' = AND
  groupBy: GroupByType;
}

interface FilterContextType {
  state: FilterState;
  setFilter: (filter: FilterType) => void;
  toggleDeadlineFilter: () => void;
  getFilterLabel: (filter: FilterType) => string;
  getFilterCount: (filter: FilterType) => number;
  setFilterCounts: (counts: Record<FilterType, number>) => void;
  // Tag filter methods
  addTagFilter: (tag: TagFilter) => void;
  removeTagFilter: (tagId: number) => void;
  clearTagFilters: () => void;
  setTagFilterMode: (mode: 'any' | 'all') => void;
  isTagSelected: (tagId: number) => boolean;
  // Grouping methods
  setGroupBy: (groupBy: GroupByType) => void;
  getGroupByLabel: (groupBy: GroupByType) => string;
}

const FilterContext = createContext<FilterContextType | null>(null);

const filterLabels: Record<FilterType, string> = {
  all: 'Все задачи',
  not_started: 'Не начато',
  in_progress: 'В работе',
  completed: 'Готово',
  overdue: 'Просрочено',
};

const groupByLabels: Record<GroupByType, string> = {
  none: 'Без группировки',
  tag: 'По тегам',
  status: 'По статусу',
  priority: 'По приоритету',
};

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>({
    activeFilter: 'all',
    showOnlyWithDeadlines: false,
    selectedTags: [],
    tagFilterMode: 'any',
    groupBy: 'none',
  });

  const [filterCounts, setFilterCountsState] = useState<Record<FilterType, number>>({
    all: 0,
    not_started: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
  });

  const setFilter = useCallback((filter: FilterType) => {
    setState(prev => ({ ...prev, activeFilter: filter }));
  }, []);

  const toggleDeadlineFilter = useCallback(() => {
    setState(prev => ({ ...prev, showOnlyWithDeadlines: !prev.showOnlyWithDeadlines }));
  }, []);

  const getFilterLabel = useCallback((filter: FilterType): string => {
    return filterLabels[filter];
  }, []);

  const getFilterCount = useCallback((filter: FilterType): number => {
    return filterCounts[filter];
  }, [filterCounts]);

  const setFilterCounts = useCallback((counts: Record<FilterType, number>) => {
    setFilterCountsState(counts);
  }, []);

  // Tag filter methods
  const addTagFilter = useCallback((tag: TagFilter) => {
    setState(prev => {
      if (prev.selectedTags.some(t => t.id === tag.id)) {
        return prev; // Already selected
      }
      return { ...prev, selectedTags: [...prev.selectedTags, tag] };
    });
  }, []);

  const removeTagFilter = useCallback((tagId: number) => {
    setState(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.filter(t => t.id !== tagId),
    }));
  }, []);

  const clearTagFilters = useCallback(() => {
    setState(prev => ({ ...prev, selectedTags: [] }));
  }, []);

  const setTagFilterMode = useCallback((mode: 'any' | 'all') => {
    setState(prev => ({ ...prev, tagFilterMode: mode }));
  }, []);

  const isTagSelected = useCallback((tagId: number): boolean => {
    return state.selectedTags.some(t => t.id === tagId);
  }, [state.selectedTags]);

  // Grouping methods
  const setGroupBy = useCallback((groupBy: GroupByType) => {
    setState(prev => ({ ...prev, groupBy }));
  }, []);

  const getGroupByLabel = useCallback((groupBy: GroupByType): string => {
    return groupByLabels[groupBy];
  }, []);

  return (
    <FilterContext.Provider
      value={{
        state,
        setFilter,
        toggleDeadlineFilter,
        getFilterLabel,
        getFilterCount,
        setFilterCounts,
        addTagFilter,
        removeTagFilter,
        clearTagFilters,
        setTagFilterMode,
        isTagSelected,
        setGroupBy,
        getGroupByLabel,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
