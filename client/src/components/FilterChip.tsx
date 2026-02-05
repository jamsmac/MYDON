import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type DeadlineFilter = 'all' | 'today' | 'week' | 'overdue';

interface FilterChipProps {
  label: string;
  value: DeadlineFilter;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color?: 'default' | 'warning' | 'danger';
}

const colorStyles = {
  default: {
    active: 'bg-slate-600 text-white border-slate-500',
    inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300',
    badge: 'bg-slate-500 text-white',
  },
  warning: {
    active: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-amber-500/10 hover:text-amber-400',
    badge: 'bg-amber-500 text-slate-900',
  },
  danger: {
    active: 'bg-red-500/20 text-red-400 border-red-500/50',
    inactive: 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-red-500/10 hover:text-red-400',
    badge: 'bg-red-500 text-white',
  },
};

export function FilterChip({ label, value, count, isActive, onClick, color = 'default' }: FilterChipProps) {
  const styles = colorStyles[color];
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200",
        isActive ? styles.active : styles.inactive
      )}
    >
      <span>{label}</span>
      {count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold",
            isActive ? styles.badge : "bg-slate-600 text-slate-300"
          )}
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </motion.button>
  );
}

interface FilterChipGroupProps {
  filters: {
    value: DeadlineFilter;
    label: string;
    count: number;
    color?: 'default' | 'warning' | 'danger';
  }[];
  activeFilter: DeadlineFilter;
  onFilterChange: (filter: DeadlineFilter) => void;
}

export function FilterChipGroup({ filters, activeFilter, onFilterChange }: FilterChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <FilterChip
          key={filter.value}
          value={filter.value}
          label={filter.label}
          count={filter.count}
          color={filter.color}
          isActive={activeFilter === filter.value}
          onClick={() => onFilterChange(filter.value)}
        />
      ))}
    </div>
  );
}

// Hook for persisting filter in localStorage
export function useDeadlineFilter(storageKey: string = 'mydon-deadline-filter') {
  const getInitialFilter = (): DeadlineFilter => {
    if (typeof window === 'undefined') return 'all';
    const stored = localStorage.getItem(storageKey);
    if (stored && ['all', 'today', 'week', 'overdue'].includes(stored)) {
      return stored as DeadlineFilter;
    }
    return 'all';
  };

  const saveFilter = (filter: DeadlineFilter) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, filter);
    }
  };

  return { getInitialFilter, saveFilter };
}

// Helper to check if a deadline matches a filter
export function matchesDeadlineFilter(
  deadline: Date | string | null | undefined,
  filter: DeadlineFilter
): boolean {
  if (filter === 'all') return true;
  if (!deadline) return false;

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
  
  const diffTime = deadlineDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  switch (filter) {
    case 'today':
      return diffDays === 0;
    case 'week':
      return diffDays >= 0 && diffDays <= 7;
    case 'overdue':
      return diffDays < 0;
    default:
      return true;
  }
}
