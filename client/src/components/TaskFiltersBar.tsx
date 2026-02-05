import { useState, useEffect, useMemo } from 'react';
import { FilterChipGroup, DeadlineFilter, useDeadlineFilter, matchesDeadlineFilter } from './FilterChip';
import { SortDropdown, SortField, SortDirection, useSortSettings, sortTasks } from './SortDropdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Task {
  id: number;
  title: string;
  status: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  deadline?: Date | string | null;
  createdAt?: Date | string | null;
}

interface TaskFiltersBarProps {
  tasks: Task[];
  projectId: number;
  onFilteredTasksChange: (taskIds: Set<number>) => void;
  className?: string;
}

export function TaskFiltersBar({ tasks, projectId, onFilteredTasksChange, className }: TaskFiltersBarProps) {
  const { getInitialFilter, saveFilter } = useDeadlineFilter(`mydon-deadline-filter-${projectId}`);
  const { getInitialSort, saveSort } = useSortSettings(`mydon-sort-settings-${projectId}`);
  
  const [activeFilter, setActiveFilter] = useState<DeadlineFilter>(() => getInitialFilter());
  const [sortField, setSortField] = useState<SortField>(() => getInitialSort().field);
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => getInitialSort().direction);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let todayCount = 0;
    let weekCount = 0;
    let overdueCount = 0;

    tasks.forEach(task => {
      if (!task.deadline) return;
      
      const deadlineDate = new Date(task.deadline);
      const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
      const diffTime = deadlineDay.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        overdueCount++;
      } else if (diffDays === 0) {
        todayCount++;
      }
      if (diffDays >= 0 && diffDays <= 7) {
        weekCount++;
      }
    });

    return {
      all: tasks.length,
      today: todayCount,
      week: weekCount,
      overdue: overdueCount,
    };
  }, [tasks]);

  const filters = [
    { value: 'all' as DeadlineFilter, label: 'Все', count: filterCounts.all, color: 'default' as const },
    { value: 'today' as DeadlineFilter, label: 'Сегодня', count: filterCounts.today, color: 'warning' as const },
    { value: 'week' as DeadlineFilter, label: 'Неделя', count: filterCounts.week, color: 'default' as const },
    { value: 'overdue' as DeadlineFilter, label: 'Просрочено', count: filterCounts.overdue, color: 'danger' as const },
  ];

  // Handle filter change
  const handleFilterChange = (filter: DeadlineFilter) => {
    setActiveFilter(filter);
    saveFilter(filter);
  };

  // Handle sort change
  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    saveSort(field, direction);
  };

  // Apply filters and sorting, notify parent
  useEffect(() => {
    let filteredTasks = tasks;

    // Apply deadline filter
    if (activeFilter !== 'all') {
      filteredTasks = filteredTasks.filter(task => 
        matchesDeadlineFilter(task.deadline, activeFilter)
      );
    }

    // Apply sorting
    filteredTasks = sortTasks(filteredTasks, sortField, sortDirection);

    // Notify parent of filtered task IDs
    onFilteredTasksChange(new Set(filteredTasks.map(t => t.id)));
  }, [tasks, activeFilter, sortField, sortDirection, onFilteredTasksChange]);

  const hasActiveFilters = activeFilter !== 'all';

  return (
    <div className={cn("border-b border-slate-700/50", className)}>
      {/* Compact header */}
      <div className="flex items-center justify-between px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "h-7 px-2 text-xs",
            hasActiveFilters ? "text-amber-400" : "text-slate-400"
          )}
        >
          <Filter className="w-3.5 h-3.5 mr-1.5" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 rounded text-[10px]">
              {activeFilter === 'overdue' ? 'Просрочено' : activeFilter === 'today' ? 'Сегодня' : 'Неделя'}
            </span>
          )}
        </Button>

        <SortDropdown
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              <FilterChipGroup
                filters={filters}
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
              />
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange('all')}
                  className="mt-2 h-6 px-2 text-xs text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3 mr-1" />
                  Сбросить фильтр
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Standalone hook for using filters in other components
export function useTaskFilters(tasks: Task[], projectId: number) {
  const { getInitialFilter, saveFilter } = useDeadlineFilter(`mydon-deadline-filter-${projectId}`);
  const { getInitialSort, saveSort } = useSortSettings(`mydon-sort-settings-${projectId}`);
  
  const [activeFilter, setActiveFilter] = useState<DeadlineFilter>(() => getInitialFilter());
  const [sortField, setSortField] = useState<SortField>(() => getInitialSort().field);
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => getInitialSort().direction);

  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks;

    // Apply deadline filter
    if (activeFilter !== 'all') {
      result = result.filter(task => 
        matchesDeadlineFilter(task.deadline, activeFilter)
      );
    }

    // Apply sorting
    result = sortTasks(result, sortField, sortDirection);

    return result;
  }, [tasks, activeFilter, sortField, sortDirection]);

  const handleFilterChange = (filter: DeadlineFilter) => {
    setActiveFilter(filter);
    saveFilter(filter);
  };

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
    saveSort(field, direction);
  };

  return {
    activeFilter,
    sortField,
    sortDirection,
    filteredTasks: filteredAndSortedTasks,
    setFilter: handleFilterChange,
    setSort: handleSortChange,
  };
}
