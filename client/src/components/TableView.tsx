/**
 * Table View Component
 * Displays tasks in a sortable, filterable table with inline editing
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  ChevronRight,
  AlertTriangle,
  Users,
  UserX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Link as LinkIcon, Mail, DollarSign, Percent, Hash, Type, CalendarDays, CheckSquare, List, ListChecks, Calculator, Sigma } from 'lucide-react';
import { CustomFieldFilterPanel, CustomFieldFilterRule, taskPassesAllFilters, type CustomFieldForFilter, type CustomFieldValueForFilter } from '@/components/CustomFieldFilter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings2, Keyboard, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/constants/projectConstants';
import {
  EditableCell,
  StatusCell,
  PriorityCell,
  SortableHeader,
  GroupHeader,
  type SortField,
  type SortDirection,
  type GroupBy,
} from '@/components/table/TableCells';
import { CustomFieldCell, type CustomFieldData, type CustomFieldValueData } from '@/components/table/CustomFieldCell';
import { useTableSelection } from '@/hooks/useTableSelection';

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

// Note: CustomFieldData, CustomFieldValueData types imported from CustomFieldCell

interface TableViewProps {
  tasks: TableTask[];
  members?: { id: number; name: string; avatar?: string }[];
  projectId: number;
  onTaskUpdate: (taskId: number, data: Partial<TableTask>) => void;
  onTaskClick?: (task: TableTask) => void;
  onTaskDelete?: (taskId: number) => void;
  onExportCSV?: () => void;
  onViewStateChange?: (state: TableViewState) => void;
  initialViewState?: TableViewState;
}

export interface TableViewState {
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  groupBy: string;
  searchQuery: string;
  customFieldFilters: CustomFieldFilterRule[];
}

// Note: SortField, SortDirection, GroupBy types imported from TableCells
// Note: EditableCell, StatusCell, PriorityCell, SortableHeader, GroupHeader imported from TableCells

// Note: CustomFieldCell imported from @/components/table/CustomFieldCell

// Main Table View Component
// Sortable row wrapper for drag & drop
function SortableTableRow({
  id,
  children,
  className,
  onClick,
  isDragDisabled,
}: {
  id: number;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isDragDisabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' as const : undefined,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-task-id={id}
      className={cn(className, isDragging && 'bg-slate-700/80 shadow-lg')}
      onClick={onClick}
    >
      <TableCell className="w-8 px-1">
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors",
            isDragDisabled && "opacity-30 cursor-not-allowed"
          )}
          tabIndex={isDragDisabled ? -1 : 0}
          aria-label="Перетащить для изменения порядка"
          aria-roledescription="draggable"
          aria-disabled={isDragDisabled}
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}

export function TableView({
  tasks,
  members,
  projectId,
  onTaskUpdate,
  onTaskClick,
  onTaskDelete,
  onExportCSV,
  onViewStateChange,
  initialViewState,
}: TableViewProps) {
  // Fetch custom fields for project
  const { data: customFields = [] } = trpc.customFields.getByProject.useQuery({ projectId });
  
  // Get fields that should show in table
  const tableFields = customFields.filter((f: CustomFieldData) => f.showInTable) as CustomFieldData[];
  
  // Fetch all custom field values for all tasks
  const taskIds = tasks.map(t => t.id);
  const { data: allFieldValues = [] } = trpc.customFields.getValuesByTasks.useQuery(
    { taskIds },
    { enabled: taskIds.length > 0 && tableFields.length > 0 }
  );
  
  // Create a map for quick lookup: taskId -> fieldId -> value
  const fieldValuesMap = new Map<number, Map<number, CustomFieldValueData>>();
  allFieldValues.forEach((v: CustomFieldValueData) => {
    if (!fieldValuesMap.has(v.taskId)) {
      fieldValuesMap.set(v.taskId, new Map());
    }
    fieldValuesMap.get(v.taskId)!.set(v.customFieldId, v);
  });

  const [sortField, setSortField] = useState<SortField | null>(
    (initialViewState?.sortField as SortField) || null
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    initialViewState?.sortDirection || 'asc'
  );
  const [groupBy, setGroupBy] = useState<GroupBy>(
    (initialViewState?.groupBy as GroupBy) || 'none'
  );
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState(initialViewState?.searchQuery || '');
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterRule[]>(
    (initialViewState?.customFieldFilters as CustomFieldFilterRule[]) || []
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusedTaskIndex, setFocusedTaskIndex] = useState<number>(-1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Notify parent of state changes for saved views
  useEffect(() => {
    onViewStateChange?.({
      sortField,
      sortDirection,
      groupBy,
      searchQuery,
      customFieldFilters,
    });
  }, [sortField, sortDirection, groupBy, searchQuery, customFieldFilters]);

  // Bulk mutation hooks
  const utils = trpc.useUtils();
  const bulkUpdateStatus = trpc.task.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Статус обновлён для ${data.updated} задач`);
      utils.task.invalidate();
      setSelectedTasks(new Set());
    },
    onError: () => toast.error('Ошибка при обновлении статуса'),
  });
  const bulkUpdatePriority = trpc.task.bulkUpdatePriority.useMutation({
    onSuccess: (data) => {
      toast.success(`Приоритет обновлён для ${data.updated} задач`);
      utils.task.invalidate();
      setSelectedTasks(new Set());
    },
    onError: () => toast.error('Ошибка при обновлении приоритета'),
  });
  const bulkUpdateAssignee = trpc.task.bulkUpdateAssignee.useMutation({
    onSuccess: (data) => {
      toast.success(`Исполнитель обновлён для ${data.updated} задач`);
      utils.task.invalidate();
      setSelectedTasks(new Set());
    },
    onError: () => toast.error('Ошибка при обновлении исполнителя'),
  });
  const bulkDelete = trpc.task.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`Удалено ${data.deleted} задач`);
      utils.task.invalidate();
      setSelectedTasks(new Set());
      setShowDeleteConfirm(false);
    },
    onError: () => toast.error('Ошибка при удалении задач'),
  });

  const bulkSetCustomField = trpc.customFields.bulkSetValue.useMutation({
    onSuccess: (data) => {
      toast.success(`Кастомное поле обновлено для ${data.updated} задач`);
      utils.customFields.invalidate();
      utils.task.invalidate();
      setSelectedTasks(new Set());
      setBulkCustomFieldOpen(false);
    },
    onError: () => toast.error('Ошибка при обновлении кастомного поля'),
  });

  const [bulkCustomFieldOpen, setBulkCustomFieldOpen] = useState(false);
  const [bulkFieldId, setBulkFieldId] = useState<number | null>(null);
  const [bulkFieldValue, setBulkFieldValue] = useState<string>('');
  const [bulkFieldNumericValue, setBulkFieldNumericValue] = useState<number | null>(null);
  const [bulkFieldBooleanValue, setBulkFieldBooleanValue] = useState<boolean>(false);
  const [bulkFieldDateValue, setBulkFieldDateValue] = useState<string>('');
  const [bulkFieldJsonValue, setBulkFieldJsonValue] = useState<string[]>([]);

  // Drag & drop reorder mutation
  const reorderGlobal = trpc.task.reorderGlobal.useMutation({
    onSuccess: () => {
      toast.success('Порядок задач обновлён');
      utils.task.invalidate();
      utils.project.invalidate();
    },
    onError: () => toast.error('Ошибка при изменении порядка'),
  });

  // DnD sensors with activation distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Whether drag is allowed (only when no sort/group/search is active)
  const isDragEnabled = !sortField && groupBy === 'none' && !searchQuery && customFieldFilters.length === 0;

  const isBulkLoading = bulkUpdateStatus.isPending || bulkUpdatePriority.isPending || bulkUpdateAssignee.isPending || bulkDelete.isPending || bulkSetCustomField.isPending;
  const selectedTaskIds = Array.from(selectedTasks);

  // Get the selected custom field for bulk editing
  const selectedBulkField = customFields.find(f => f.id === bulkFieldId);

  // Reset bulk field value when field changes
  const handleBulkFieldChange = (fieldId: string) => {
    const id = parseInt(fieldId);
    setBulkFieldId(id);
    setBulkFieldValue('');
    setBulkFieldNumericValue(null);
    setBulkFieldBooleanValue(false);
    setBulkFieldDateValue('');
    setBulkFieldJsonValue([]);
  };

  // Apply bulk custom field value
  const handleBulkCustomFieldApply = () => {
    if (!bulkFieldId || selectedTaskIds.length === 0) return;
    const field = customFields.find(f => f.id === bulkFieldId);
    if (!field) return;

    const payload: any = { customFieldId: bulkFieldId, taskIds: selectedTaskIds };

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'select':
        payload.value = bulkFieldValue || null;
        break;
      case 'number':
      case 'currency':
      case 'percent':
      case 'rating':
        payload.numericValue = bulkFieldNumericValue;
        break;
      case 'date':
        payload.dateValue = bulkFieldDateValue ? new Date(bulkFieldDateValue).getTime() : null;
        break;
      case 'checkbox':
        payload.booleanValue = bulkFieldBooleanValue;
        break;
      case 'multiselect':
        payload.jsonValue = bulkFieldJsonValue.length > 0 ? bulkFieldJsonValue : null;
        break;
      default:
        payload.value = bulkFieldValue || null;
    }

    bulkSetCustomField.mutate(payload);
  };

  // Build fields map for filtering
  const fieldsMap = useMemo(() => {
    const map = new Map<number, CustomFieldForFilter>();
    customFields.forEach(f => map.set(f.id, f as CustomFieldForFilter));
    return map;
  }, [customFields]);

  // Build values map for filtering (reuse existing allFieldValues)
  const filterValuesMap = useMemo(() => {
    const map = new Map<number, Map<number, CustomFieldValueForFilter>>();
    if (!allFieldValues || allFieldValues.length === 0) return map;
    (allFieldValues as any[]).forEach((v: any) => {
      if (!map.has(v.taskId)) map.set(v.taskId, new Map());
      map.get(v.taskId)!.set(v.customFieldId, v as CustomFieldValueForFilter);
    });
    return map;
  }, [allFieldValues]);

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

    // Filter by custom fields
    if (customFieldFilters.length > 0) {
      result = result.filter(task =>
        taskPassesAllFilters(customFieldFilters, task.id, filterValuesMap, fieldsMap)
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
  }, [tasks, sortField, sortDirection, searchQuery, customFieldFilters, filterValuesMap, fieldsMap]);

  // Handle drag end - must be after processedTasks declaration
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = processedTasks.findIndex(t => t.id === active.id);
    const newIndex = processedTasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(processedTasks, oldIndex, newIndex);
    reorderGlobal.mutate({ taskIds: reordered.map(t => t.id) });
  }, [processedTasks, reorderGlobal]);

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

  // Scroll focused row into view
  useEffect(() => {
    if (focusedTaskIndex >= 0 && tableContainerRef.current) {
      const rows = tableContainerRef.current.querySelectorAll('tbody tr[data-task-id]');
      const row = rows[focusedTaskIndex] as HTMLElement | undefined;
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedTaskIndex]);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't fire when user is typing in an input, textarea, or select
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
      return;
    }

    // Don't fire when a dialog/alert is open
    if (document.querySelector('[role="alertdialog"]') || document.querySelector('[role="dialog"]')) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl+A / Cmd+A — Select all
    if (isCtrlOrMeta && e.key === 'a') {
      e.preventDefault();
      setSelectedTasks(new Set(processedTasks.map(t => t.id)));
      return;
    }

    // Delete / Backspace — Bulk delete selected
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTasks.size > 0) {
      e.preventDefault();
      setShowDeleteConfirm(true);
      return;
    }

    // Escape — Deselect all and clear focus
    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedTasks(new Set());
      setFocusedTaskIndex(-1);
      return;
    }

    // Arrow Down — Move focus down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedTaskIndex(prev => {
        const next = Math.min(prev + 1, processedTasks.length - 1);
        // Shift+ArrowDown extends selection
        if (e.shiftKey && processedTasks[next]) {
          setSelectedTasks(sel => {
            const newSel = new Set(sel);
            newSel.add(processedTasks[next].id);
            return newSel;
          });
        }
        return next;
      });
      return;
    }

    // Arrow Up — Move focus up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedTaskIndex(prev => {
        const next = Math.max(prev - 1, 0);
        // Shift+ArrowUp extends selection
        if (e.shiftKey && processedTasks[next]) {
          setSelectedTasks(sel => {
            const newSel = new Set(sel);
            newSel.add(processedTasks[next].id);
            return newSel;
          });
        }
        return next;
      });
      return;
    }

    // Enter — Open focused task
    if (e.key === 'Enter' && focusedTaskIndex >= 0 && processedTasks[focusedTaskIndex]) {
      e.preventDefault();
      onTaskClick?.(processedTasks[focusedTaskIndex]);
      return;
    }

    // Space — Toggle selection of focused task
    if (e.key === ' ' && focusedTaskIndex >= 0 && processedTasks[focusedTaskIndex]) {
      e.preventDefault();
      const taskId = processedTasks[focusedTaskIndex].id;
      setSelectedTasks(sel => {
        const newSel = new Set(sel);
        if (newSel.has(taskId)) {
          newSel.delete(taskId);
        } else {
          newSel.add(taskId);
        }
        return newSel;
      });
      return;
    }
  }, [processedTasks, selectedTasks.size, focusedTaskIndex, onTaskClick]);

  // Attach keyboard listener to the table container
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
    <div
      ref={tableContainerRef}
      className="h-full flex flex-col outline-none"
      tabIndex={0}
    >
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

          {/* Custom field filters */}
          {customFields.length > 0 && (
            <CustomFieldFilterPanel
              fields={customFields as CustomFieldForFilter[]}
              filters={customFieldFilters}
              onFiltersChange={setCustomFieldFilters}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
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

          {/* Keyboard shortcuts help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-300"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-xs max-w-[280px]">
              <div className="space-y-1 py-1">
                <div className="flex justify-between gap-4"><span className="text-slate-400">Выделить все</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Ctrl+A</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Удалить выбранные</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Delete</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Навигация</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">↑ ↓</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Расширить выделение</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Shift+↑↓</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Открыть задачу</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Enter</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Выбрать/снять</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Space</kbd></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Снять выделение</span><kbd className="bg-slate-700 px-1.5 rounded text-slate-300">Esc</kbd></div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedTasks.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border-y border-purple-500/20 animate-in slide-in-from-top-2">
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 font-mono">
            {selectedTasks.size}
          </Badge>
          <span className="text-sm text-purple-300 mr-2">выбрано</span>

          <div className="h-4 w-px bg-slate-700" />

          {/* Bulk Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-slate-800" disabled={isBulkLoading}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Статус
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-800 border-slate-700">
              <DropdownMenuItem
                className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdateStatus.mutate({ taskIds: selectedTaskIds, status: 'not_started' })}
              >
                <Circle className="w-3.5 h-3.5 mr-2 text-slate-400" />
                Не начато
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdateStatus.mutate({ taskIds: selectedTaskIds, status: 'in_progress' })}
              >
                <Clock className="w-3.5 h-3.5 mr-2 text-amber-400" />
                В работе
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdateStatus.mutate({ taskIds: selectedTaskIds, status: 'completed' })}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                Готово
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk Priority */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-slate-800" disabled={isBulkLoading}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Приоритет
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-800 border-slate-700">
              <DropdownMenuItem
                className="text-red-400 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdatePriority.mutate({ taskIds: selectedTaskIds, priority: 'critical' })}
              >
                Критический
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-orange-400 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdatePriority.mutate({ taskIds: selectedTaskIds, priority: 'high' })}
              >
                Высокий
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-amber-400 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdatePriority.mutate({ taskIds: selectedTaskIds, priority: 'medium' })}
              >
                Средний
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-blue-400 hover:bg-slate-700 cursor-pointer"
                onClick={() => bulkUpdatePriority.mutate({ taskIds: selectedTaskIds, priority: 'low' })}
              >
                Низкий
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk Assignee */}
          {members && members.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-slate-800" disabled={isBulkLoading}>
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Исполнитель
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem
                  className="text-slate-400 hover:bg-slate-700 cursor-pointer"
                  onClick={() => bulkUpdateAssignee.mutate({ taskIds: selectedTaskIds, assigneeId: null })}
                >
                  <UserX className="w-3.5 h-3.5 mr-2" />
                  Снять исполнителя
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                {members.map(member => (
                  <DropdownMenuItem
                    key={member.id}
                    className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                    onClick={() => bulkUpdateAssignee.mutate({ taskIds: selectedTaskIds, assigneeId: member.id })}
                  >
                    <Avatar className="w-5 h-5 mr-2">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="bg-slate-600 text-[10px]">
                        {member.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {member.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Bulk Custom Fields */}
          {customFields.length > 0 && (
            <Popover open={bulkCustomFieldOpen} onOpenChange={setBulkCustomFieldOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-slate-800" disabled={isBulkLoading}>
                  <Settings2 className="w-3.5 h-3.5 mr-1" />
                  Поля
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-slate-800 border-slate-700 p-4" align="start">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-200">
                    Массовое редактирование поля
                  </div>
                  <p className="text-xs text-slate-400">
                    Выберите поле и значение для {selectedTasks.size} задач
                  </p>

                  {/* Field selector */}
                  <Select value={bulkFieldId?.toString() || ''} onValueChange={handleBulkFieldChange}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-300 h-8 text-xs">
                      <SelectValue placeholder="Выберите поле" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {customFields
                        .filter(f => !['formula', 'rollup'].includes(f.type))
                        .map(field => (
                          <SelectItem key={field.id} value={field.id.toString()} className="text-slate-300">
                            {field.name}
                            <span className="text-slate-500 ml-1 text-[10px]">({field.type})</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Value input based on field type */}
                  {selectedBulkField && (
                    <div className="space-y-2">
                      {/* Text / URL / Email */}
                      {['text', 'url', 'email'].includes(selectedBulkField.type) && (
                        <Input
                          className="bg-slate-900 border-slate-700 text-slate-300 h-8 text-xs"
                          placeholder={`Введите ${selectedBulkField.name}`}
                          value={bulkFieldValue}
                          onChange={(e) => setBulkFieldValue(e.target.value)}
                          type={selectedBulkField.type === 'email' ? 'email' : selectedBulkField.type === 'url' ? 'url' : 'text'}
                        />
                      )}

                      {/* Number / Currency / Percent */}
                      {['number', 'currency', 'percent'].includes(selectedBulkField.type) && (
                        <div className="flex items-center gap-2">
                          {selectedBulkField.type === 'currency' && <span className="text-slate-400 text-xs">$</span>}
                          <Input
                            className="bg-slate-900 border-slate-700 text-slate-300 h-8 text-xs"
                            placeholder="0"
                            type="number"
                            value={bulkFieldNumericValue ?? ''}
                            onChange={(e) => setBulkFieldNumericValue(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                          {selectedBulkField.type === 'percent' && <span className="text-slate-400 text-xs">%</span>}
                        </div>
                      )}

                      {/* Rating */}
                      {selectedBulkField.type === 'rating' && (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onClick={() => setBulkFieldNumericValue(bulkFieldNumericValue === star ? null : star)}
                              className="p-0.5"
                            >
                              <Star
                                className={cn(
                                  'w-5 h-5 transition-colors',
                                  star <= (bulkFieldNumericValue || 0)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-600 hover:text-slate-400'
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Date */}
                      {selectedBulkField.type === 'date' && (
                        <Input
                          className="bg-slate-900 border-slate-700 text-slate-300 h-8 text-xs"
                          type="date"
                          value={bulkFieldDateValue}
                          onChange={(e) => setBulkFieldDateValue(e.target.value)}
                        />
                      )}

                      {/* Checkbox */}
                      {selectedBulkField.type === 'checkbox' && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={bulkFieldBooleanValue}
                            onCheckedChange={(checked) => setBulkFieldBooleanValue(!!checked)}
                            className="border-slate-600"
                          />
                          <span className="text-xs text-slate-300">
                            {bulkFieldBooleanValue ? 'Включено' : 'Выключено'}
                          </span>
                        </div>
                      )}

                      {/* Select */}
                      {selectedBulkField.type === 'select' && (
                        <Select value={bulkFieldValue} onValueChange={setBulkFieldValue}>
                          <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-300 h-8 text-xs">
                            <SelectValue placeholder="Выберите значение" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-700">
                            {(selectedBulkField.options as any[])?.map((opt: any) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-slate-300">
                                {opt.color && (
                                  <span
                                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                                    style={{ backgroundColor: opt.color }}
                                  />
                                )}
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Multiselect */}
                      {selectedBulkField.type === 'multiselect' && (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {(selectedBulkField.options as any[])?.map((opt: any) => (
                            <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded">
                              <Checkbox
                                checked={bulkFieldJsonValue.includes(opt.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setBulkFieldJsonValue([...bulkFieldJsonValue, opt.value]);
                                  } else {
                                    setBulkFieldJsonValue(bulkFieldJsonValue.filter(v => v !== opt.value));
                                  }
                                }}
                                className="border-slate-600 w-3.5 h-3.5"
                              />
                              {opt.color && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: opt.color }}
                                />
                              )}
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Apply button */}
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleBulkCustomFieldApply}
                        disabled={bulkSetCustomField.isPending}
                      >
                        {bulkSetCustomField.isPending ? 'Применение...' : `Применить к ${selectedTasks.size} задачам`}
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Bulk Delete */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            disabled={isBulkLoading}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Удалить
          </Button>

          <div className="flex-1" />

          {/* Clear selection */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setSelectedTasks(new Set())}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Снять выбор
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
        <Table>
          <TableHeader className="sticky top-0 bg-slate-900 z-10">
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="w-8 px-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn("flex items-center justify-center", !isDragEnabled && "opacity-30")}>
                      <GripVertical className="w-4 h-4 text-slate-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 border-slate-700">
                    {isDragEnabled
                      ? <p>Перетаскивание для сортировки</p>
                      : <p>Уберите сортировку, группировку и поиск для перетаскивания</p>
                    }
                  </TooltipContent>
                </Tooltip>
              </TableHead>
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
              {/* Custom field columns */}
              {tableFields.map((field: CustomFieldData) => (
                <TableHead key={field.id} className="w-[140px]">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-slate-400 font-medium cursor-help">
                        <span className="truncate">{field.name}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-800 border-slate-700">
                      <p>Тип: {field.type}</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <SortableContext items={processedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
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

                    const taskIndex = processedTasks.findIndex(t => t.id === task.id);
                    const isFocused = taskIndex === focusedTaskIndex;

                    return (
                      <SortableTableRow
                        key={task.id}
                        id={task.id}
                        isDragDisabled={!isDragEnabled}
                        className={cn(
                          "border-slate-700 hover:bg-slate-800/50 transition-colors",
                          isFocused && "bg-purple-500/10 ring-1 ring-inset ring-purple-500/40",
                          selectedTasks.has(task.id) && "bg-slate-800/60"
                        )}
                        onClick={() => setFocusedTaskIndex(taskIndex)}
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
                        {/* Custom field cells */}
                        {tableFields.map((field: CustomFieldData) => {
                          const taskValues = fieldValuesMap.get(task.id);
                          const fieldValue = taskValues?.get(field.id);
                          return (
                            <TableCell key={field.id}>
                              <CustomFieldCell field={field} value={fieldValue} taskId={task.id} />
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Действия с задачей: ${task.title}`}
                              >
                                <MoreHorizontal className="w-4 h-4 text-slate-400" aria-hidden="true" />
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
                      </SortableTableRow>
                    );
                  })}
              </>
            ))}
          </TableBody>
          </SortableContext>
        </Table>
        </DndContext>

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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              Удалить {selectedTasks.size} задач?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Это действие нельзя отменить. Все выбранные задачи и их подзадачи будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => bulkDelete.mutate({ taskIds: selectedTaskIds })}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? 'Удаление...' : `Удалить ${selectedTasks.size} задач`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TableView;
