import React, { createContext, useContext, useState, useCallback } from 'react';

export type FilterType = 'all' | 'not_started' | 'in_progress' | 'completed' | 'overdue';

interface FilterState {
  activeFilter: FilterType;
  showOnlyWithDeadlines: boolean;
}

interface FilterContextType {
  state: FilterState;
  setFilter: (filter: FilterType) => void;
  toggleDeadlineFilter: () => void;
  getFilterLabel: (filter: FilterType) => string;
  getFilterCount: (filter: FilterType) => number;
  setFilterCounts: (counts: Record<FilterType, number>) => void;
}

const FilterContext = createContext<FilterContextType | null>(null);

const filterLabels: Record<FilterType, string> = {
  all: 'Все задачи',
  not_started: 'Не начато',
  in_progress: 'В работе',
  completed: 'Готово',
  overdue: 'Просрочено',
};

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FilterState>({
    activeFilter: 'all',
    showOnlyWithDeadlines: false,
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

  return (
    <FilterContext.Provider
      value={{
        state,
        setFilter,
        toggleDeadlineFilter,
        getFilterLabel,
        getFilterCount,
        setFilterCounts,
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
