/**
 * Calendar View Component
 * Displays tasks on a calendar grid with drag-and-drop deadline changes
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus,
  Circle,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  getDay
} from 'date-fns';
import { ru } from 'date-fns/locale';

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

// Status icons
const STATUS_ICONS = {
  not_started: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const STATUS_COLORS = {
  not_started: 'text-slate-400',
  in_progress: 'text-amber-400',
  completed: 'text-emerald-400',
};

interface CalendarTask {
  id: number;
  title: string;
  status: string | null;
  priority?: string | null;
  deadline?: Date | string | null;
  assignedTo?: number | null;
}

interface CalendarViewProps {
  tasks: CalendarTask[];
  onTaskClick?: (task: CalendarTask) => void;
  onTaskUpdate?: (taskId: number, data: { deadline?: number | null }) => void;
  onAddTask?: (date: Date) => void;
}

type ViewMode = 'month' | 'week';

// Task item on calendar
function CalendarTaskItem({
  task,
  compact = false,
  onClick,
  onEdit,
  onDelete,
}: {
  task: CalendarTask;
  compact?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const StatusIcon = STATUS_ICONS[task.status as keyof typeof STATUS_ICONS] || Circle;
  const statusColor = STATUS_COLORS[task.status as keyof typeof STATUS_COLORS] || 'text-slate-400';
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : 'bg-slate-500';

  if (compact) {
    return (
      <div
        className={cn(
          "group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer",
          "hover:bg-slate-700/50 transition-colors",
          "border-l-2",
          task.priority ? `border-l-${task.priority === 'critical' ? 'red' : task.priority === 'high' ? 'orange' : task.priority === 'medium' ? 'amber' : 'blue'}-500` : 'border-l-slate-500'
        )}
        style={{ borderLeftColor: task.priority ? PRIORITY_COLORS[task.priority]?.replace('bg-', '') : undefined }}
        onClick={onClick}
      >
        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", priorityColor)} />
        <span className="truncate text-slate-300">{task.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-2 p-2 rounded-lg cursor-pointer",
        "bg-slate-800/50 hover:bg-slate-800 transition-colors",
        "border-l-2",
      )}
      style={{ borderLeftColor: task.priority ? PRIORITY_COLORS[task.priority]?.replace('bg-', '#') : '#64748b' }}
      onClick={onClick}
    >
      <StatusIcon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", statusColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{task.title}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
            <Edit className="w-4 h-4 mr-2" />
            Редактировать
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="text-red-400">
            <Trash2 className="w-4 h-4 mr-2" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Day cell in calendar
function CalendarDay({
  date,
  tasks,
  isCurrentMonth,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onDropTask,
}: {
  date: Date;
  tasks: CalendarTask[];
  isCurrentMonth: boolean;
  onTaskClick?: (task: CalendarTask) => void;
  onTaskEdit?: (task: CalendarTask) => void;
  onTaskDelete?: (taskId: number) => void;
  onAddTask?: () => void;
  onDropTask?: (taskId: number) => void;
}) {
  const today = isToday(date);
  const dayNumber = format(date, 'd');
  const hasMoreTasks = tasks.length > 3;
  const visibleTasks = tasks.slice(0, 3);

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-purple-500/50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-purple-500/50');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-purple-500/50');
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    if (taskId && onDropTask) {
      onDropTask(taskId);
    }
  };

  return (
    <div
      className={cn(
        "min-h-[120px] p-1.5 border-r border-b border-slate-700/50 transition-colors",
        !isCurrentMonth && "bg-slate-900/50",
        today && "bg-purple-500/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "w-6 h-6 flex items-center justify-center rounded-full text-sm",
            today && "bg-purple-500 text-white font-medium",
            !today && isCurrentMonth && "text-slate-300",
            !today && !isCurrentMonth && "text-slate-600"
          )}
        >
          {dayNumber}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
          onClick={onAddTask}
        >
          <Plus className="w-3 h-3 text-slate-400" />
        </Button>
      </div>

      {/* Tasks */}
      <div className="space-y-0.5">
        {visibleTasks.map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('taskId', task.id.toString());
            }}
          >
            <CalendarTaskItem
              task={task}
              compact
              onClick={() => onTaskClick?.(task)}
              onEdit={() => onTaskEdit?.(task)}
              onDelete={() => onTaskDelete?.(task.id)}
            />
          </div>
        ))}
        {hasMoreTasks && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-xs text-slate-500 hover:text-slate-300 px-1.5">
                +{tasks.length - 3} ещё
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-slate-800 border-slate-700">
              <div className="space-y-1">
                {tasks.map(task => (
                  <CalendarTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    onEdit={() => onTaskEdit?.(task)}
                    onDelete={() => onTaskDelete?.(task.id)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

// Week view day
function WeekDay({
  date,
  tasks,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
  onDropTask,
}: {
  date: Date;
  tasks: CalendarTask[];
  onTaskClick?: (task: CalendarTask) => void;
  onTaskEdit?: (task: CalendarTask) => void;
  onTaskDelete?: (taskId: number) => void;
  onAddTask?: () => void;
  onDropTask?: (taskId: number) => void;
}) {
  const today = isToday(date);

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('ring-2', 'ring-purple-500/50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('ring-2', 'ring-purple-500/50');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('ring-2', 'ring-purple-500/50');
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    if (taskId && onDropTask) {
      onDropTask(taskId);
    }
  };

  return (
    <div
      className={cn(
        "flex-1 min-w-[140px] border-r border-slate-700/50 last:border-r-0",
        today && "bg-purple-500/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Day header */}
      <div className={cn(
        "p-2 border-b border-slate-700/50 text-center",
        today && "bg-purple-500/10"
      )}>
        <div className="text-xs text-slate-500 uppercase">
          {format(date, 'EEE', { locale: ru })}
        </div>
        <div className={cn(
          "text-lg font-medium",
          today ? "text-purple-400" : "text-slate-300"
        )}>
          {format(date, 'd')}
        </div>
      </div>

      {/* Tasks */}
      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="p-2 space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('taskId', task.id.toString());
              }}
            >
              <CalendarTaskItem
                task={task}
                onClick={() => onTaskClick?.(task)}
                onEdit={() => onTaskEdit?.(task)}
                onDelete={() => onTaskDelete?.(task.id)}
              />
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-300"
                onClick={onAddTask}
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Main Calendar View Component
export function CalendarView({
  tasks,
  onTaskClick,
  onTaskUpdate,
  onAddTask,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Get tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    
    tasks.forEach(task => {
      if (task.deadline) {
        const dateKey = format(startOfDay(new Date(task.deadline)), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });

    return map;
  }, [tasks]);

  // Get calendar days for month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get week days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Navigation
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle task drop (change deadline)
  const handleDropTask = (taskId: number, date: Date) => {
    onTaskUpdate?.(taskId, { deadline: date.getTime() });
  };

  // Week day names
  const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-700"
              onClick={goToPrevious}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-700"
              onClick={goToNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Current date */}
          <h2 className="text-lg font-medium text-white">
            {viewMode === 'month'
              ? format(currentDate, 'LLLL yyyy', { locale: ru })
              : `${format(weekDays[0], 'd MMM', { locale: ru })} - ${format(weekDays[6], 'd MMM yyyy', { locale: ru })}`
            }
          </h2>

          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={goToToday}
          >
            Сегодня
          </Button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <Button
            variant={viewMode === 'month' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-7",
              viewMode === 'month' ? 'bg-slate-700' : ''
            )}
            onClick={() => setViewMode('month')}
          >
            Месяц
          </Button>
          <Button
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              "h-7",
              viewMode === 'week' ? 'bg-slate-700' : ''
            )}
            onClick={() => setViewMode('week')}
          >
            Неделя
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'month' ? (
          // Month view
          <div className="h-full flex flex-col">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-slate-700">
              {weekDayNames.map((day, i) => (
                <div
                  key={day}
                  className={cn(
                    "py-2 text-center text-sm font-medium",
                    i >= 5 ? "text-slate-500" : "text-slate-400"
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 h-full">
                {monthDays.map(date => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayTasks = tasksByDate.get(dateKey) || [];

                  return (
                    <CalendarDay
                      key={dateKey}
                      date={date}
                      tasks={dayTasks}
                      isCurrentMonth={isSameMonth(date, currentDate)}
                      onTaskClick={onTaskClick}
                      onTaskEdit={onTaskClick}
                      onTaskDelete={(taskId) => onTaskUpdate?.(taskId, { deadline: null })}
                      onAddTask={() => onAddTask?.(date)}
                      onDropTask={(taskId) => handleDropTask(taskId, date)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // Week view
          <div className="h-full flex">
            {weekDays.map(date => {
              const dateKey = format(date, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(dateKey) || [];

              return (
                <WeekDay
                  key={dateKey}
                  date={date}
                  tasks={dayTasks}
                  onTaskClick={onTaskClick}
                  onTaskEdit={onTaskClick}
                  onTaskDelete={(taskId) => onTaskUpdate?.(taskId, { deadline: null })}
                  onAddTask={() => onAddTask?.(date)}
                  onDropTask={(taskId) => handleDropTask(taskId, date)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Критический</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Высокий</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Средний</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Низкий</span>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;
