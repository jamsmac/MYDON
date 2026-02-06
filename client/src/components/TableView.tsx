/**
 * Table View Component
 * Displays tasks in a sortable, filterable table with inline editing
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Filter,
  Group,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

// Status configuration
const STATUS_CONFIG = {
  not_started: { label: 'Не начато', icon: Circle, color: 'text-slate-400' },
  in_progress: { label: 'В работе', icon: Clock, color: 'text-amber-400' },
  completed: { label: 'Готово', icon: CheckCircle2, color: 'text-emerald-400' },
};

// Priority configuration
const PRIORITY_CONFIG = {
  critical: { label: 'Критический', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { label: 'Высокий', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { label: 'Средний', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low: { label: 'Низкий', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

interface TableTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  deadline?: Date | string | null;
  assignedTo?: number | null;
  sectionId: number;
  sectionTitle?: string;
  blockTitle?: string;
  progress?: number;
  tags?: { id: number; name: string; color: string }[];
}

interface TableViewProps {
  tasks: TableTask[];
  members?: { id: number; name: string; avatar?: string }[];
  onTaskUpdate: (taskId: number, data: Partial<TableTask>) => void;
  onTaskClick?: (task: TableTask) => void;
  onTaskDelete?: (taskId: number) => void;
  onExportCSV?: () => void;
}

type SortField = 'title' | 'status' | 'priority' | 'deadline' | 'assignedTo' | 'blockTitle';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'status' | 'priority' | 'block' | 'assignee';

// Inline editable cell
function EditableCell({
  value,
  onSave,
  type = 'text',
}: {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'textarea';
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 bg-slate-800 border-slate-600 text-white text-sm"
        autoFocus
      />
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-slate-800/50 px-2 py-1 rounded -mx-2 -my-1"
      onClick={() => setIsEditing(true)}
    >
      {value || <span className="text-slate-500 italic">—</span>}
    </div>
  );
}

// Status selector cell
function StatusCell({
  status,
  onChange,
}: {
  status: string | null;
  onChange: (status: string) => void;
}) {
  const currentStatus = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.not_started;
  const Icon = currentStatus.icon;

  return (
    <Select value={status || 'not_started'} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[130px] bg-transparent border-0 hover:bg-slate-800/50">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-3.5 h-3.5", currentStatus.color)} />
          <span className="text-sm">{currentStatus.label}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        {Object.entries(STATUS_CONFIG).map(([value, config]) => {
          const StatusIcon = config.icon;
          return (
            <SelectItem key={value} value={value}>
              <div className="flex items-center gap-1.5">
                <StatusIcon className={cn("w-3.5 h-3.5", config.color)} />
                <span>{config.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Priority selector cell
function PriorityCell({
  priority,
  onChange,
}: {
  priority: string | null;
  onChange: (priority: string) => void;
}) {
  const currentPriority = priority ? PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] : null;

  return (
    <Select value={priority || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger className="h-7 w-[120px] bg-transparent border-0 hover:bg-slate-800/50">
        {currentPriority ? (
          <Badge variant="outline" className={cn("text-xs", currentPriority.color)}>
            {currentPriority.label}
          </Badge>
        ) : (
          <span className="text-slate-500 text-sm">—</span>
        )}
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        <SelectItem value="none">Без приоритета</SelectItem>
        {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
          <SelectItem key={value} value={value}>
            <Badge variant="outline" className={cn("text-xs", config.color)}>
              {config.label}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Sortable header
function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField | null;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 -ml-3 font-medium text-slate-400 hover:text-white"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="ml-1 w-3.5 h-3.5" />
        ) : (
          <ArrowDown className="ml-1 w-3.5 h-3.5" />
        )
      ) : (
        <ArrowUpDown className="ml-1 w-3.5 h-3.5 opacity-50" />
      )}
    </Button>
  );
}

// Group header row
function GroupHeader({
  label,
  count,
  isExpanded,
  onToggle,
}: {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TableRow className="bg-slate-800/50 hover:bg-slate-800/70">
      <TableCell colSpan={7} className="py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-slate-300 hover:text-white"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 mr-1" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-1" />
          )}
          {label}
          <Badge variant="secondary" className="ml-2 bg-slate-700 text-slate-300">
            {count}
          </Badge>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Main Table View Component
export function TableView({
  tasks,
  members,
  onTaskUpdate,
  onTaskClick,
  onTaskDelete,
  onExportCSV,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort tasks
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

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal: any = a[sortField];
        let bVal: any = b[sortField];

        // Handle null values
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        // Handle dates
        if (sortField === 'deadline') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // Handle priority order
        if (sortField === 'priority') {
          const order = { critical: 0, high: 1, medium: 2, low: 3, '': 4 };
          aVal = order[aVal as keyof typeof order] ?? 4;
          bVal = order[bVal as keyof typeof order] ?? 4;
        }

        // Handle status order
        if (sortField === 'status') {
          const order = { not_started: 0, in_progress: 1, completed: 2 };
          aVal = order[aVal as keyof typeof order] ?? 0;
          bVal = order[bVal as keyof typeof order] ?? 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tasks, sortField, sortDirection, searchQuery]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { '': processedTasks };
    }

    const groups: Record<string, TableTask[]> = {};

    processedTasks.forEach(task => {
      let key = '';
      switch (groupBy) {
        case 'status':
          key = task.status || 'not_started';
          break;
        case 'priority':
          key = task.priority || 'none';
          break;
        case 'block':
          key = task.blockTitle || 'Без блока';
          break;
        case 'assignee':
          const member = members?.find(m => m.id === task.assignedTo);
          key = member?.name || 'Не назначено';
          break;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(task);
    });

    return groups;
  }, [processedTasks, groupBy, members]);

  // Get group label
  const getGroupLabel = (key: string) => {
    if (groupBy === 'status') {
      return STATUS_CONFIG[key as keyof typeof STATUS_CONFIG]?.label || key;
    }
    if (groupBy === 'priority') {
      return key === 'none' ? 'Без приоритета' : PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG]?.label || key;
    }
    return key;
  };

  // Toggle group expansion
  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  // Initialize all groups as expanded
  useMemo(() => {
    if (groupBy !== 'none' && expandedGroups.size === 0) {
      setExpandedGroups(new Set(Object.keys(groupedTasks)));
    }
  }, [groupBy, groupedTasks]);

  // Toggle task selection
  const toggleTaskSelection = (taskId: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  // Select all tasks
  const toggleSelectAll = () => {
    if (selectedTasks.size === processedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(processedTasks.map(t => t.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Название', 'Статус', 'Приоритет', 'Дедлайн', 'Исполнитель', 'Блок', 'Секция'];
    const rows = processedTasks.map(task => {
      const assignee = members?.find(m => m.id === task.assignedTo);
      return [
        task.title,
        STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.label || '',
        task.priority ? PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label : '',
        task.deadline ? format(new Date(task.deadline), 'dd.MM.yyyy') : '',
        assignee?.name || '',
        task.blockTitle || '',
        task.sectionTitle || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Экспорт завершён');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Search */}
          <Input
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] h-8 bg-slate-800 border-slate-700 text-white"
          />

          {/* Group by */}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-[160px] h-8 bg-slate-800 border-slate-700">
              <Group className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Группировка" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="none">Без группировки</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
              <SelectItem value="priority">По приоритету</SelectItem>
              <SelectItem value="block">По блоку</SelectItem>
              <SelectItem value="assignee">По исполнителю</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk actions */}
          {selectedTasks.size > 0 && (
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
              Выбрано: {selectedTasks.size}
            </Badge>
          )}

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-slate-700"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-900 z-10">
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedTasks.size === processedTasks.length && processedTasks.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="min-w-[300px]">
                <SortableHeader
                  label="Название"
                  field="title"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[140px]">
                <SortableHeader
                  label="Статус"
                  field="status"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[130px]">
                <SortableHeader
                  label="Приоритет"
                  field="priority"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[120px]">
                <SortableHeader
                  label="Дедлайн"
                  field="deadline"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-[150px]">
                <SortableHeader
                  label="Исполнитель"
                  field="assignedTo"
                  currentSort={sortField}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedTasks).map(([groupKey, groupTasks]) => (
              <>
                {groupBy !== 'none' && (
                  <GroupHeader
                    key={`group-${groupKey}`}
                    label={getGroupLabel(groupKey)}
                    count={groupTasks.length}
                    isExpanded={expandedGroups.has(groupKey)}
                    onToggle={() => toggleGroup(groupKey)}
                  />
                )}
                {(groupBy === 'none' || expandedGroups.has(groupKey)) &&
                  groupTasks.map(task => {
                    const assignee = members?.find(m => m.id === task.assignedTo);
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';

                    return (
                      <TableRow
                        key={task.id}
                        className="border-slate-700 hover:bg-slate-800/50"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            className="cursor-pointer hover:text-purple-400 transition-colors"
                            onClick={() => onTaskClick?.(task)}
                          >
                            <EditableCell
                              value={task.title}
                              onSave={(title) => onTaskUpdate(task.id, { title })}
                            />
                          </div>
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {task.tags.slice(0, 3).map(tag => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  className="text-xs px-1 py-0"
                                  style={{
                                    borderColor: tag.color + '50',
                                    color: tag.color,
                                  }}
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusCell
                            status={task.status}
                            onChange={(status) => onTaskUpdate(task.id, { status: status as any })}
                          />
                        </TableCell>
                        <TableCell>
                          <PriorityCell
                            priority={task.priority || null}
                            onChange={(priority) => onTaskUpdate(task.id, { priority })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "flex items-center gap-1 text-sm",
                            isOverdue ? "text-red-400" : "text-slate-400"
                          )}>
                            {task.deadline ? (
                              <>
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(task.deadline), 'd MMM', { locale: ru })}
                              </>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={assignee.avatar} />
                                <AvatarFallback className="text-xs bg-slate-700">
                                  {assignee.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-slate-300 truncate">
                                {assignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                              <DropdownMenuItem onClick={() => onTaskClick?.(task)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                navigator.clipboard.writeText(task.title);
                                toast.success('Скопировано');
                              }}>
                                <Copy className="w-4 h-4 mr-2" />
                                Копировать
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem
                                className="text-red-400"
                                onClick={() => onTaskDelete?.(task.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </>
            ))}
          </TableBody>
        </Table>

        {processedTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Filter className="w-12 h-12 mb-4 opacity-50" />
            <p>Нет задач</p>
            {searchQuery && (
              <p className="text-sm mt-1">Попробуйте изменить поисковый запрос</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TableView;
