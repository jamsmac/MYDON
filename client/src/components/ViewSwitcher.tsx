/**
 * View Switcher Component
 * Allows switching between different project views (List, Kanban, Table, Calendar, Gantt)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  List, 
  Kanban, 
  Table2, 
  Calendar, 
  GanttChart,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewType = 'list' | 'kanban' | 'table' | 'calendar' | 'gantt';

interface ViewConfig {
  id: ViewType;
  label: string;
  icon: typeof List;
  description: string;
  available: boolean;
}

const VIEW_CONFIGS: ViewConfig[] = [
  { 
    id: 'list', 
    label: 'Список', 
    icon: List, 
    description: 'Иерархический вид с блоками и секциями',
    available: true 
  },
  { 
    id: 'kanban', 
    label: 'Канбан', 
    icon: Kanban, 
    description: 'Доска с колонками по статусам',
    available: true 
  },
  { 
    id: 'table', 
    label: 'Таблица', 
    icon: Table2, 
    description: 'Табличный вид с сортировкой и фильтрами',
    available: true 
  },
  { 
    id: 'calendar', 
    label: 'Календарь', 
    icon: Calendar, 
    description: 'Задачи на календаре по дедлайнам',
    available: true 
  },
  { 
    id: 'gantt', 
    label: 'Гант', 
    icon: GanttChart, 
    description: 'Диаграмма Ганта (скоро)',
    available: false 
  },
];

interface ViewSwitcherProps {
  projectId: number;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  compact?: boolean;
}

// Local storage key for remembering view per project
const getStorageKey = (projectId: number) => `project_view_${projectId}`;

export function ViewSwitcher({
  projectId,
  currentView,
  onViewChange,
  compact = false,
}: ViewSwitcherProps) {
  // Load saved view on mount
  useEffect(() => {
    const savedView = localStorage.getItem(getStorageKey(projectId));
    if (savedView && VIEW_CONFIGS.find(v => v.id === savedView && v.available)) {
      onViewChange(savedView as ViewType);
    }
  }, [projectId]);

  // Save view when changed
  const handleViewChange = (view: ViewType) => {
    localStorage.setItem(getStorageKey(projectId), view);
    onViewChange(view);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
        {VIEW_CONFIGS.map(config => {
          const Icon = config.icon;
          const isActive = currentView === config.id;

          return (
            <Tooltip key={config.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    isActive && "bg-slate-700",
                    !config.available && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => config.available && handleViewChange(config.id)}
                  disabled={!config.available}
                >
                  <Icon className={cn(
                    "w-4 h-4",
                    isActive ? "text-white" : "text-slate-400"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
                <p className="font-medium">{config.label}</p>
                <p className="text-xs text-slate-400">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
      {VIEW_CONFIGS.map(config => {
        const Icon = config.icon;
        const isActive = currentView === config.id;

        return (
          <Tooltip key={config.id}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "h-8 gap-1.5",
                  isActive && "bg-slate-700",
                  !config.available && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => config.available && handleViewChange(config.id)}
                disabled={!config.available}
              >
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-white" : "text-slate-400"
                )} />
                <span className={cn(
                  "text-sm",
                  isActive ? "text-white" : "text-slate-400"
                )}>
                  {config.label}
                </span>
                {!config.available && (
                  <Badge variant="outline" className="text-xs px-1 py-0 border-slate-600 text-slate-500">
                    скоро
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700">
              <p className="text-xs text-slate-400">{config.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// Hook for managing view state with localStorage persistence
export function useProjectView(projectId: number, defaultView: ViewType = 'list') {
  const [view, setView] = useState<ViewType>(() => {
    if (typeof window === 'undefined') return defaultView;
    const saved = localStorage.getItem(getStorageKey(projectId));
    if (saved && VIEW_CONFIGS.find(v => v.id === saved && v.available)) {
      return saved as ViewType;
    }
    return defaultView;
  });

  const changeView = (newView: ViewType) => {
    localStorage.setItem(getStorageKey(projectId), newView);
    setView(newView);
  };

  return [view, changeView] as const;
}

export default ViewSwitcher;
