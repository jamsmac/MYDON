import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  AlertTriangle,
  Calendar,
  Type,
  Clock
} from 'lucide-react';

export type SortField = 'priority' | 'deadline' | 'title' | 'created';
export type SortDirection = 'asc' | 'desc';

interface SortOption {
  value: SortField;
  label: string;
  icon: typeof AlertTriangle;
}

const sortOptions: SortOption[] = [
  { value: 'priority', label: 'По приоритету', icon: AlertTriangle },
  { value: 'deadline', label: 'По дедлайну', icon: Calendar },
  { value: 'title', label: 'По названию', icon: Type },
  { value: 'created', label: 'По дате создания', icon: Clock },
];

interface SortDropdownProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  className?: string;
}

export function SortDropdown({ sortField, sortDirection, onSortChange, className }: SortDropdownProps) {
  const currentOption = sortOptions.find(o => o.value === sortField) || sortOptions[0];
  const Icon = currentOption.icon;

  const toggleDirection = () => {
    onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-slate-400 hover:text-white"
          >
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            <span className="text-xs">{currentOption.label}</span>
            <ArrowUpDown className="w-3 h-3 ml-1.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700">
          {sortOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortChange(option.value, sortDirection)}
                className={cn(
                  "text-slate-300 hover:bg-slate-700 cursor-pointer",
                  sortField === option.value && "bg-slate-700/50 text-white"
                )}
              >
                <OptionIcon className="w-4 h-4 mr-2" />
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleDirection}
        className="h-7 w-7 p-0 text-slate-400 hover:text-white"
        title={sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
      >
        {sortDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// Hook for persisting sort settings in localStorage
export function useSortSettings(storageKey: string = 'mydon-sort-settings') {
  const getInitialSort = (): { field: SortField; direction: SortDirection } => {
    if (typeof window === 'undefined') return { field: 'priority', direction: 'desc' };
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.field && parsed.direction) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return { field: 'priority', direction: 'desc' };
  };

  const saveSort = (field: SortField, direction: SortDirection) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({ field, direction }));
    }
  };

  return { getInitialSort, saveSort };
}

// Priority values for sorting
const priorityOrder: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Sort function for tasks
export function sortTasks<T extends {
  title: string;
  priority?: string | null;
  deadline?: Date | string | null;
  createdAt?: Date | string | null;
  id: number;
}>(
  tasks: T[],
  field: SortField,
  direction: SortDirection
): T[] {
  const sorted = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'priority': {
        const aPriority = priorityOrder[a.priority || 'medium'] || 2;
        const bPriority = priorityOrder[b.priority || 'medium'] || 2;
        comparison = bPriority - aPriority; // Higher priority first by default
        break;
      }
      case 'deadline': {
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        comparison = aDeadline - bDeadline; // Earlier deadline first by default
        break;
      }
      case 'title': {
        comparison = a.title.localeCompare(b.title, 'ru');
        break;
      }
      case 'created': {
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = bCreated - aCreated; // Newer first by default
        break;
      }
    }

    return direction === 'asc' ? -comparison : comparison;
  });

  return sorted;
}
