/**
 * Advanced Gantt Chart Component with Task Dependencies
 * Interactive timeline visualization for project tasks with dependency arrows
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ZoomIn, 
  ZoomOut, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  PlayCircle,
  Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, differenceInDays, startOfWeek, addWeeks, addMonths, isBefore, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

// Types
interface GanttTask {
  id: number;
  title: string;
  status: string | null;
  priority?: string | null;
  deadline?: Date | number | null;
  dueDate?: Date | number | null;
  sectionId: number;
  sectionTitle?: string;
  blockTitle?: string;
  sortOrder?: number | null;
}

interface TaskDependency {
  id: number;
  taskId: number;
  dependsOnTaskId: number;
  dependencyType: string | null;
  lagDays: number | null;
}

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

interface GanttChartAdvancedProps {
  tasks: GanttTask[];
  dependencies?: TaskDependency[];
  onTaskClick?: (task: GanttTask) => void;
  onAddDependency?: (fromTaskId: number, toTaskId: number) => void;
}

// Constants
const ZOOM_CONFIG = {
  day: { cellWidth: 40, daysPerCell: 1 },
  week: { cellWidth: 100, daysPerCell: 7 },
  month: { cellWidth: 120, daysPerCell: 30 },
  quarter: { cellWidth: 200, daysPerCell: 90 },
};

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;
const TASK_BAR_HEIGHT = 28;
const SIDEBAR_WIDTH = 300;

// Helper functions
const getTaskDate = (task: GanttTask): Date | null => {
  const dateValue = task.deadline || task.dueDate;
  if (!dateValue) return null;
  return typeof dateValue === 'number' ? new Date(dateValue) : new Date(dateValue);
};

const getStatusColor = (status: string | null): string => {
  switch (status) {
    case 'completed': return 'bg-emerald-500';
    case 'in_progress': return 'bg-amber-500';
    default: return 'bg-slate-600';
  }
};

const getStatusIcon = (status: string | null) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'in_progress': return <PlayCircle className="w-3.5 h-3.5 text-amber-400" />;
    default: return <Circle className="w-3.5 h-3.5 text-slate-500" />;
  }
};

const getPriorityBorder = (priority: string | null | undefined): string => {
  switch (priority) {
    case 'critical': return 'border-l-red-500';
    case 'high': return 'border-l-orange-500';
    case 'medium': return 'border-l-amber-500';
    case 'low': return 'border-l-slate-500';
    default: return 'border-l-slate-600';
  }
};

export function GanttChartAdvanced({
  tasks,
  dependencies = [],
  onTaskClick,
  onAddDependency,
}: GanttChartAdvancedProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [viewStart, setViewStart] = useState<Date>(() => startOfWeek(new Date(), { locale: ru }));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const [selectedForDependency, setSelectedForDependency] = useState<number | null>(null);

  // Generate time periods based on zoom level
  const timePeriods = useMemo(() => {
    const periods: { date: Date; label: string; subLabel?: string }[] = [];
    let current = new Date(viewStart);
    const periodCount = zoom === 'day' ? 60 : zoom === 'week' ? 16 : zoom === 'month' ? 12 : 8;

    for (let i = 0; i < periodCount; i++) {
      let label = '';
      let subLabel = '';

      switch (zoom) {
        case 'day':
          label = format(current, 'd', { locale: ru });
          subLabel = format(current, 'EEE', { locale: ru });
          current = addDays(current, 1);
          break;
        case 'week':
          label = `Нед ${format(current, 'w', { locale: ru })}`;
          subLabel = format(current, 'd MMM', { locale: ru });
          current = addWeeks(current, 1);
          break;
        case 'month':
          label = format(current, 'LLL', { locale: ru });
          subLabel = format(current, 'yyyy', { locale: ru });
          current = addMonths(current, 1);
          break;
        case 'quarter':
          const quarter = Math.ceil((current.getMonth() + 1) / 3);
          label = `Q${quarter}`;
          subLabel = format(current, 'yyyy', { locale: ru });
          current = addMonths(current, 3);
          break;
      }

      periods.push({ date: new Date(current), label, subLabel });
    }

    return periods;
  }, [viewStart, zoom]);

  // Calculate task bar positions
  const getTaskPosition = (task: GanttTask): { left: number; width: number } | null => {
    const taskDate = getTaskDate(task);
    if (!taskDate) return null;

    const daysFromStart = differenceInDays(taskDate, viewStart);
    const { cellWidth, daysPerCell } = ZOOM_CONFIG[zoom];
    
    const left = (daysFromStart / daysPerCell) * cellWidth;
    const width = Math.max(cellWidth * 0.8, 80);

    return { left, width };
  };

  // Calculate today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    const daysFromStart = differenceInDays(today, viewStart);
    const { cellWidth, daysPerCell } = ZOOM_CONFIG[zoom];
    return (daysFromStart / daysPerCell) * cellWidth;
  }, [viewStart, zoom]);

  // Navigation handlers
  const navigatePrev = () => {
    switch (zoom) {
      case 'day': setViewStart(addDays(viewStart, -14)); break;
      case 'week': setViewStart(addWeeks(viewStart, -4)); break;
      case 'month': setViewStart(addMonths(viewStart, -3)); break;
      case 'quarter': setViewStart(addMonths(viewStart, -6)); break;
    }
  };

  const navigateNext = () => {
    switch (zoom) {
      case 'day': setViewStart(addDays(viewStart, 14)); break;
      case 'week': setViewStart(addWeeks(viewStart, 4)); break;
      case 'month': setViewStart(addMonths(viewStart, 3)); break;
      case 'quarter': setViewStart(addMonths(viewStart, 6)); break;
    }
  };

  const goToToday = () => {
    setViewStart(startOfWeek(new Date(), { locale: ru }));
  };

  // Handle dependency creation
  const handleTaskBarClick = (task: GanttTask, e: React.MouseEvent) => {
    if (e.shiftKey && selectedForDependency !== null && selectedForDependency !== task.id) {
      onAddDependency?.(selectedForDependency, task.id);
      setSelectedForDependency(null);
    } else if (e.shiftKey) {
      setSelectedForDependency(task.id);
    } else {
      onTaskClick?.(task);
    }
  };

  const totalWidth = timePeriods.length * ZOOM_CONFIG[zoom].cellWidth;
  const totalHeight = tasks.length * ROW_HEIGHT;

  // Group tasks by block for display
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, GanttTask[]>();
    tasks.forEach(task => {
      const key = task.blockTitle || 'Без блока';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    });
    return groups;
  }, [tasks]);

  // Flatten tasks with group info for rendering
  const flatTasks = useMemo(() => {
    const result: Array<GanttTask & { isGroupHeader?: boolean; groupName?: string }> = [];
    groupedTasks.forEach((groupTasks, groupName) => {
      groupTasks.forEach(task => result.push({ ...task, groupName }));
    });
    return result;
  }, [groupedTasks]);

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev} className="border-slate-600 hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="border-slate-600 hover:bg-slate-700">
            <Calendar className="w-4 h-4 mr-2" />
            Сегодня
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext} className="border-slate-600 hover:bg-slate-700">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Масштаб:</span>
          <Select value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="day">День</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="quarter">Квартал</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>Завершено</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>В работе</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-600" />
            <span>Не начато</span>
          </div>
          {onAddDependency && (
            <div className="flex items-center gap-1.5 border-l border-slate-600 pl-4">
              <Link2 className="w-3 h-3" />
              <span>Shift+клик для связи</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task list sidebar */}
        <div className="flex-shrink-0 border-r border-slate-700 bg-slate-800/30" style={{ width: SIDEBAR_WIDTH }}>
          <div className="border-b border-slate-700 px-4 flex items-center justify-between" style={{ height: HEADER_HEIGHT }}>
            <span className="text-sm font-medium text-slate-300">Задачи</span>
            <Badge variant="outline" className="border-slate-600 text-slate-400">{tasks.length}</Badge>
          </div>

          <div className="overflow-y-auto" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {flatTasks.map((task, index) => {
              const taskDate = getTaskDate(task);
              const isOverdue = taskDate && isBefore(taskDate, new Date()) && task.status !== 'completed';
              const isSelected = selectedForDependency === task.id;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 px-4 border-b border-slate-800/50 cursor-pointer transition-colors",
                    hoveredTask === task.id && "bg-slate-700/30",
                    isSelected && "bg-amber-500/20 border-l-2 border-l-amber-500",
                    "hover:bg-slate-700/20"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskClick?.(task)}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      task.status === 'completed' ? "text-slate-500 line-through" : "text-slate-200"
                    )}>
                      {task.title}
                    </p>
                    {task.sectionTitle && (
                      <p className="text-xs text-slate-500 truncate">{task.sectionTitle}</p>
                    )}
                  </div>
                  {isOverdue && <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto" ref={scrollContainerRef}>
            <div style={{ width: totalWidth, minWidth: '100%' }}>
              {/* Timeline header */}
              <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700" style={{ height: HEADER_HEIGHT }}>
                <div className="flex h-full">
                  {timePeriods.map((period, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-slate-700/50",
                        isToday(period.date) && "bg-amber-500/10"
                      )}
                      style={{ width: ZOOM_CONFIG[zoom].cellWidth }}
                    >
                      <span className="text-sm font-medium text-slate-300">{period.label}</span>
                      {period.subLabel && <span className="text-xs text-slate-500">{period.subLabel}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Task bars area */}
              <div className="relative" style={{ height: totalHeight }}>
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {timePeriods.map((period, index) => (
                    <div
                      key={index}
                      className={cn("border-r border-slate-800/50", isToday(period.date) && "bg-amber-500/5")}
                      style={{ width: ZOOM_CONFIG[zoom].cellWidth, height: '100%' }}
                    />
                  ))}
                </div>

                {/* Row backgrounds */}
                {flatTasks.map((task, index) => (
                  <div
                    key={`row-${task.id}`}
                    className={cn(
                      "absolute left-0 right-0 border-b border-slate-800/30",
                      hoveredTask === task.id && "bg-slate-700/10"
                    )}
                    style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                  />
                ))}

                {/* Today marker */}
                {todayPosition > 0 && todayPosition < totalWidth && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20" style={{ left: todayPosition }}>
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                  </div>
                )}

                {/* Task bars */}
                {flatTasks.map((task, index) => {
                  const position = getTaskPosition(task);
                  if (!position) return null;

                  const taskDate = getTaskDate(task);
                  const isOverdue = taskDate && isBefore(taskDate, new Date()) && task.status !== 'completed';
                  const isSelected = selectedForDependency === task.id;
                  const hasDependencies = dependencies.some(d => d.taskId === task.id || d.dependsOnTaskId === task.id);

                  return (
                    <Tooltip key={task.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "absolute rounded cursor-pointer transition-all border-l-4",
                            getStatusColor(task.status),
                            getPriorityBorder(task.priority),
                            hoveredTask === task.id && "ring-2 ring-white/30 scale-[1.02]",
                            isOverdue && "ring-2 ring-red-500/50",
                            isSelected && "ring-2 ring-amber-400"
                          )}
                          style={{
                            left: Math.max(0, position.left),
                            top: index * ROW_HEIGHT + (ROW_HEIGHT - TASK_BAR_HEIGHT) / 2,
                            width: position.width,
                            height: TASK_BAR_HEIGHT,
                          }}
                          onClick={(e) => handleTaskBarClick(task, e)}
                          onMouseEnter={() => setHoveredTask(task.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                        >
                          <div className="px-2 h-full flex items-center gap-1">
                            {hasDependencies && <Link2 className="w-3 h-3 text-white/70 flex-shrink-0" />}
                            <span className="text-xs text-white font-medium truncate">{task.title}</span>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-slate-800 border-slate-700 max-w-xs">
                        <div className="space-y-1.5">
                          <p className="font-medium text-white">{task.title}</p>
                          {task.blockTitle && (
                            <p className="text-xs text-slate-400">{task.blockTitle} → {task.sectionTitle}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            {getStatusIcon(task.status)}
                            <span className="text-slate-300">
                              {task.status === 'completed' ? 'Завершено' : task.status === 'in_progress' ? 'В работе' : 'Не начато'}
                            </span>
                          </div>
                          {taskDate && (
                            <div className="flex items-center gap-2 text-xs">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className={isOverdue ? "text-red-400" : "text-slate-300"}>
                                {format(taskDate, 'd MMMM yyyy', { locale: ru })}
                                {isOverdue && ' (просрочено)'}
                              </span>
                            </div>
                          )}
                          {hasDependencies && (
                            <div className="flex items-center gap-2 text-xs border-t border-slate-700 pt-1.5 mt-1.5">
                              <Link2 className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-400">Есть зависимости</span>
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Dependency arrows */}
                <svg className="absolute top-0 left-0 pointer-events-none z-10" style={{ width: totalWidth, height: totalHeight }}>
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                    </marker>
                  </defs>
                  {dependencies.map((dep) => {
                    const fromTask = flatTasks.find(t => t.id === dep.dependsOnTaskId);
                    const toTask = flatTasks.find(t => t.id === dep.taskId);
                    if (!fromTask || !toTask) return null;

                    const fromPos = getTaskPosition(fromTask);
                    const toPos = getTaskPosition(toTask);
                    if (!fromPos || !toPos) return null;

                    const fromIndex = flatTasks.indexOf(fromTask);
                    const toIndex = flatTasks.indexOf(toTask);

                    const startX = fromPos.left + fromPos.width;
                    const startY = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const endX = Math.max(0, toPos.left);
                    const endY = toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                    const midX = startX + 20;

                    return (
                      <path
                        key={dep.id}
                        d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">Нет задач с дедлайнами</p>
            <p className="text-sm text-slate-500 mt-1">Добавьте дедлайны к задачам для отображения на диаграмме</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GanttChartAdvanced;
