/**
 * Kanban Board Component
 * Displays tasks in columns by status with drag-and-drop support
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Loader2, 
  Calendar, 
  User, 
  Tag,
  GripVertical,
  MoreHorizontal,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Filter,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

// Status column configuration
const STATUS_COLUMNS = [
  { id: 'not_started', title: 'Бэклог', icon: Circle, color: 'text-slate-400', bgColor: 'bg-slate-500/10' },
  { id: 'in_progress', title: 'В работе', icon: Clock, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  { id: 'completed', title: 'Готово', icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
] as const;

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  critical: { label: 'Критический', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: 'Высокий', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { label: 'Средний', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low: { label: 'Низкий', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

interface KanbanTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  deadline?: Date | string | null;
  assignedTo?: number | null;
  sectionId: number;
  sortOrder?: number | null;
  tags?: { id: number; name: string; color: string }[];
}

interface KanbanBoardProps {
  projectId: number;
  tasks: KanbanTask[];
  members?: { id: number; name: string; avatar?: string }[];
  tags?: { id: number; name: string; color: string }[];
  onTaskUpdate: (taskId: number, data: { status?: string; sortOrder?: number }) => void;
  onTaskClick?: (task: KanbanTask) => void;
  onAddTask?: (status: string) => void;
}

// Sortable Task Card Component
function SortableTaskCard({ 
  task, 
  members,
  onClick,
  onEdit,
  onDelete,
}: { 
  task: KanbanTask;
  members?: { id: number; name: string; avatar?: string }[];
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = members?.find(m => m.id === task.assignedTo);
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-slate-800 rounded-lg border border-slate-700 hover:border-slate-600 transition-all cursor-pointer",
        "border-l-4",
        task.priority ? PRIORITY_COLORS[task.priority] : 'border-l-slate-600',
        isDragging && "opacity-50 shadow-xl"
      )}
    >
      <div className="p-3">
        {/* Drag handle and menu */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 -ml-1 -mt-1"
          >
            <GripVertical className="w-4 h-4 text-slate-500" />
          </div>
          
          <div className="flex-1 min-w-0" onClick={onClick}>
            <h4 className="text-sm font-medium text-white line-clamp-2">{task.title}</h4>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
              <DropdownMenuItem onClick={onEdit} className="text-slate-300">
                <Edit className="w-4 h-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2" onClick={onClick}>
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map(tag => (
              <Badge 
                key={tag.id} 
                variant="outline" 
                className="text-xs px-1.5 py-0"
                style={{ 
                  borderColor: tag.color + '50',
                  color: tag.color,
                  backgroundColor: tag.color + '10'
                }}
              >
                {tag.name}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-600 text-slate-400">
                +{task.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer: deadline, assignee, priority */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            {/* Deadline */}
            {task.deadline && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isOverdue ? "text-red-400" : "text-slate-500"
              )}>
                {isOverdue ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                {format(new Date(task.deadline), 'd MMM', { locale: ru })}
              </div>
            )}

            {/* Priority badge */}
            {task.priority && PRIORITY_BADGES[task.priority] && (
              <Badge 
                variant="outline" 
                className={cn("text-xs px-1.5 py-0", PRIORITY_BADGES[task.priority].className)}
              >
                {PRIORITY_BADGES[task.priority].label.charAt(0)}
              </Badge>
            )}
          </div>

          {/* Assignee */}
          {assignee && (
            <Avatar className="w-5 h-5">
              <AvatarImage src={assignee.avatar} />
              <AvatarFallback className="text-xs bg-slate-700 text-slate-300">
                {assignee.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}

// Task Card for Drag Overlay
function TaskCardOverlay({ task }: { task: KanbanTask }) {
  return (
    <div className={cn(
      "bg-slate-800 rounded-lg border border-purple-500 shadow-xl p-3",
      "border-l-4",
      task.priority ? PRIORITY_COLORS[task.priority] : 'border-l-slate-600'
    )}>
      <h4 className="text-sm font-medium text-white">{task.title}</h4>
    </div>
  );
}

// Droppable Column Component
function KanbanColumn({
  column,
  tasks,
  members,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onAddTask,
}: {
  column: typeof STATUS_COLUMNS[number];
  tasks: KanbanTask[];
  members?: { id: number; name: string; avatar?: string }[];
  onTaskClick?: (task: KanbanTask) => void;
  onTaskEdit?: (task: KanbanTask) => void;
  onTaskDelete?: (taskId: number) => void;
  onAddTask?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const Icon = column.icon;

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <Card className={cn(
        "bg-slate-900/50 border-slate-700 h-full flex flex-col",
        isOver && "ring-2 ring-purple-500/50"
      )}>
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", column.bgColor)}>
                <Icon className={cn("w-4 h-4", column.color)} />
              </div>
              <CardTitle className="text-sm font-medium text-white">
                {column.title}
              </CardTitle>
              <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
                {tasks.length}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-400 hover:text-white"
              onClick={onAddTask}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-2">
            <div
              ref={setNodeRef}
              className="space-y-2 min-h-[200px]"
            >
              <SortableContext
                items={tasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {tasks.map(task => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    members={members}
                    onClick={() => onTaskClick?.(task)}
                    onEdit={() => onTaskEdit?.(task)}
                    onDelete={() => onTaskDelete?.(task.id)}
                  />
                ))}
              </SortableContext>
              
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <Circle className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Нет задач</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Quick Add Task Dialog
function QuickAddTaskDialog({
  open,
  onOpenChange,
  status,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: string;
  onAdd: (data: { title: string; description?: string; priority?: string }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Введите название задачи');
      return;
    }
    onAdd({ title: title.trim(), description: description.trim() || undefined, priority });
    setTitle('');
    setDescription('');
    setPriority('medium');
    onOpenChange(false);
  };

  const statusLabel = STATUS_COLUMNS.find(c => c.id === status)?.title || status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Новая задача в "{statusLabel}"</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-slate-400">Название</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название задачи..."
              className="bg-slate-800 border-slate-700 text-white mt-1"
              autoFocus
            />
          </div>
          
          <div>
            <Label className="text-slate-400">Описание (опционально)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Добавьте описание..."
              className="bg-slate-800 border-slate-700 text-white mt-1 min-h-[80px]"
            />
          </div>
          
          <div>
            <Label className="text-slate-400">Приоритет</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="critical">🔴 Критический</SelectItem>
                <SelectItem value="high">🟠 Высокий</SelectItem>
                <SelectItem value="medium">🟡 Средний</SelectItem>
                <SelectItem value="low">🔵 Низкий</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600">
            Отмена
          </Button>
          <Button onClick={handleSubmit} className="bg-purple-600 hover:bg-purple-700">
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Filters Component
function KanbanFilters({
  filters,
  onFiltersChange,
  members,
  tags,
}: {
  filters: {
    priority?: string;
    assignee?: number;
    tag?: number;
  };
  onFiltersChange: (filters: { priority?: string; assignee?: number; tag?: number }) => void;
  members?: { id: number; name: string }[];
  tags?: { id: number; name: string; color: string }[];
}) {
  const hasFilters = filters.priority || filters.assignee || filters.tag;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 text-slate-400">
        <Filter className="w-4 h-4" />
        <span className="text-sm">Фильтры:</span>
      </div>
      
      {/* Priority filter */}
      <Select 
        value={filters.priority || 'all'} 
        onValueChange={(v) => onFiltersChange({ ...filters, priority: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[140px] h-8 bg-slate-800 border-slate-700 text-sm">
          <SelectValue placeholder="Приоритет" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          <SelectItem value="all">Все приоритеты</SelectItem>
          <SelectItem value="critical">🔴 Критический</SelectItem>
          <SelectItem value="high">🟠 Высокий</SelectItem>
          <SelectItem value="medium">🟡 Средний</SelectItem>
          <SelectItem value="low">🔵 Низкий</SelectItem>
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      {members && members.length > 0 && (
        <Select 
          value={filters.assignee?.toString() || 'all'} 
          onValueChange={(v) => onFiltersChange({ ...filters, assignee: v === 'all' ? undefined : parseInt(v) })}
        >
          <SelectTrigger className="w-[150px] h-8 bg-slate-800 border-slate-700 text-sm">
            <SelectValue placeholder="Исполнитель" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">Все исполнители</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Tag filter */}
      {tags && tags.length > 0 && (
        <Select 
          value={filters.tag?.toString() || 'all'} 
          onValueChange={(v) => onFiltersChange({ ...filters, tag: v === 'all' ? undefined : parseInt(v) })}
        >
          <SelectTrigger className="w-[130px] h-8 bg-slate-800 border-slate-700 text-sm">
            <SelectValue placeholder="Тег" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">Все теги</SelectItem>
            {tags.map(t => (
              <SelectItem key={t.id} value={t.id.toString()}>
                <span style={{ color: t.color }}>●</span> {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-slate-400 hover:text-white"
          onClick={() => onFiltersChange({})}
        >
          <X className="w-4 h-4 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  );
}

// Main Kanban Board Component
export function KanbanBoard({
  projectId,
  tasks,
  members,
  tags,
  onTaskUpdate,
  onTaskClick,
  onAddTask,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [addTaskStatus, setAddTaskStatus] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    priority?: string;
    assignee?: number;
    tag?: number;
  }>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignee && task.assignedTo !== filters.assignee) return false;
      if (filters.tag && (!task.tags || !task.tags.some(t => t.id === filters.tag))) return false;
      return true;
    });
  }, [tasks, filters]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, KanbanTask[]> = {
      not_started: [],
      in_progress: [],
      completed: [],
    };

    filteredTasks.forEach(task => {
      const status = task.status || 'not_started';
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    // Sort by sortOrder within each column
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    });

    return grouped;
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as number;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Check if dropped on a column
    const newStatus = STATUS_COLUMNS.find(c => c.id === over.id)?.id;
    
    if (newStatus && newStatus !== task.status) {
      onTaskUpdate(taskId, { status: newStatus });
      toast.success(`Задача перемещена в "${STATUS_COLUMNS.find(c => c.id === newStatus)?.title}"`);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over for reordering within columns if needed
  };

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success('Задача создана');
      setAddTaskStatus(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteTaskMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success('Задача удалена');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleQuickAddTask = (data: { title: string; description?: string; priority?: string }) => {
    if (!addTaskStatus) return;
    
    // Find first section in project to add task to
    // This is a simplified approach - in real app you might want to select section
    if (onAddTask) {
      onAddTask(addTaskStatus);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b border-slate-700">
        <KanbanFilters
          filters={filters}
          onFiltersChange={setFilters}
          members={members}
          tags={tags}
        />
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-4 h-full min-w-max">
            {STATUS_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.id] || []}
                members={members}
                onTaskClick={onTaskClick}
                onTaskEdit={(task) => onTaskClick?.(task)}
                onTaskDelete={(taskId) => deleteTaskMutation.mutate({ id: taskId })}
                onAddTask={() => setAddTaskStatus(column.id)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && <TaskCardOverlay task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Quick Add Task Dialog */}
      <QuickAddTaskDialog
        open={!!addTaskStatus}
        onOpenChange={(open) => !open && setAddTaskStatus(null)}
        status={addTaskStatus || 'not_started'}
        onAdd={handleQuickAddTask}
      />
    </div>
  );
}

export default KanbanBoard;
