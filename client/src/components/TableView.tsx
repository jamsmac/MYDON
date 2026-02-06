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

// Use 'any' for custom fields since the actual schema types are complex
type CustomFieldData = {
  id: number;
  name: string;
  type: string;
  options?: any;
  formula?: string | null;
  rollupConfig?: any;
  showInTable?: boolean | null;
  showOnCard?: boolean | null;
};

type CustomFieldValueData = {
  id: number;
  customFieldId: number;
  taskId: number;
  value?: string | null;
  numericValue?: string | null;
  dateValue?: Date | string | null;
  booleanValue?: boolean | null;
  jsonValue?: any;
};

interface TableViewProps {
  tasks: TableTask[];
  members?: { id: number; name: string; avatar?: string }[];
  projectId: number;
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

// Inline-editable custom field cell component
function CustomFieldCell({ field, value, taskId }: { field: CustomFieldData; value?: CustomFieldValueData; taskId: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const utils = trpc.useUtils();

  const setValueMutation = trpc.customFields.setValue.useMutation({
    onSuccess: () => {
      utils.customFields.getValuesByTasks.invalidate();
      setIsEditing(false);
      setIsSaving(false);
    },
    onError: (err) => {
      toast.error('Ошибка сохранения: ' + err.message);
      setIsSaving(false);
    },
  });

  const startEditing = () => {
    if (field.type === 'formula' || field.type === 'rollup') return; // read-only
    setIsEditing(true);
    // Initialize edit values from current value
    if (value) {
      setEditText(value.value || '');
      setEditNumber(value.numericValue || '');
      setEditDate(value.dateValue ? new Date(value.dateValue).toISOString().split('T')[0] : '');
    } else {
      setEditText('');
      setEditNumber('');
      setEditDate('');
    }
  };

  const saveValue = (overrideData?: Record<string, any>) => {
    setIsSaving(true);
    const data: any = { customFieldId: field.id, taskId };
    if (overrideData) {
      Object.assign(data, overrideData);
    } else {
      switch (field.type) {
        case 'text': case 'url': case 'email':
          data.value = editText || null;
          break;
        case 'number': case 'currency': case 'percent':
          data.numericValue = editNumber ? parseFloat(editNumber) : null;
          break;
        case 'date':
          data.dateValue = editDate ? new Date(editDate).getTime() : null;
          break;
        default:
          data.value = editText || null;
      }
    }
    setValueMutation.mutate(data);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Checkbox: toggle directly without edit mode
  if (field.type === 'checkbox') {
    const checked = value?.booleanValue ?? false;
    return (
      <div
        className="cursor-pointer"
        onClick={() => {
          setIsSaving(true);
          setValueMutation.mutate({ customFieldId: field.id, taskId, booleanValue: !checked });
        }}
      >
        <div className={cn(
          "w-5 h-5 rounded border flex items-center justify-center transition-colors",
          checked ? "bg-emerald-500/20 border-emerald-500" : "border-slate-600 hover:border-slate-400",
          isSaving && "opacity-50"
        )}>
          {checked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        </div>
      </div>
    );
  }

  // Rating: click to set stars
  if (field.type === 'rating') {
    const currentRating = value?.numericValue ? parseInt(value.numericValue) : 0;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={cn(
              "w-3.5 h-3.5 cursor-pointer transition-colors",
              i <= currentRating ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-amber-300"
            )}
            onClick={() => {
              const newRating = i === currentRating ? 0 : i;
              setIsSaving(true);
              setValueMutation.mutate({ customFieldId: field.id, taskId, numericValue: newRating });
            }}
          />
        ))}
      </div>
    );
  }

  // Select: dropdown inline
  if (field.type === 'select') {
    let options: { label: string; value: string; color?: string }[] = [];
    try { options = field.options ? JSON.parse(field.options) : []; } catch {}
    const currentVal = value?.value || '';
    const currentOption = options.find(o => o.value === currentVal);

    return (
      <Select
        value={currentVal}
        onValueChange={(val) => {
          setIsSaving(true);
          setValueMutation.mutate({ customFieldId: field.id, taskId, value: val });
        }}
      >
        <SelectTrigger className="h-7 bg-transparent border-transparent hover:border-slate-600 text-sm px-2 min-w-[80px]">
          <SelectValue placeholder="—">
            {currentOption ? (
              <Badge variant="outline" className="text-xs" style={{ borderColor: (currentOption.color || '#888') + '50', color: currentOption.color || '#888' }}>
                {currentOption.label}
              </Badge>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span style={{ color: opt.color }}>{opt.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Multiselect: show badges, click to toggle
  if (field.type === 'multiselect') {
    let options: { label: string; value: string; color?: string }[] = [];
    try { options = field.options ? JSON.parse(field.options) : []; } catch {}
    let selected: string[] = [];
    try { selected = value?.jsonValue ? JSON.parse(value.jsonValue) : []; } catch {}

    const toggleOption = (optVal: string) => {
      const newSelected = selected.includes(optVal)
        ? selected.filter(v => v !== optVal)
        : [...selected, optVal];
      setIsSaving(true);
      setValueMutation.mutate({ customFieldId: field.id, taskId, jsonValue: newSelected });
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex gap-1 flex-wrap min-h-[28px] items-center px-1 rounded hover:bg-slate-700/50 transition-colors w-full text-left">
            {selected.length > 0 ? (
              selected.slice(0, 2).map((val: string) => {
                const opt = options.find(o => o.value === val);
                return (
                  <Badge key={val} variant="outline" className="text-xs" style={{ borderColor: (opt?.color || '#888') + '50', color: opt?.color || '#888' }}>
                    {opt?.label || val}
                  </Badge>
                );
              })
            ) : (
              <span className="text-slate-500 text-sm">—</span>
            )}
            {selected.length > 2 && <Badge variant="secondary" className="text-xs">+{selected.length - 2}</Badge>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-slate-800 border-slate-700 max-h-48 overflow-y-auto">
          {options.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={(e) => { e.preventDefault(); toggleOption(opt.value); }}
              className="flex items-center gap-2"
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center",
                selected.includes(opt.value) ? "bg-emerald-500/20 border-emerald-500" : "border-slate-600"
              )}>
                {selected.includes(opt.value) && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </div>
              <span style={{ color: opt.color }}>{opt.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Formula / Rollup: read-only
  if (field.type === 'formula' || field.type === 'rollup') {
    return (
      <div className="text-sm text-cyan-400 font-mono">
        {value?.value || <span className="text-slate-500 italic">—</span>}
      </div>
    );
  }

  // Text, Number, Date, URL, Email, Currency, Percent: click-to-edit
  if (isEditing) {
    const isNumeric = field.type === 'number' || field.type === 'currency' || field.type === 'percent';
    const isDateType = field.type === 'date';

    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type={isDateType ? 'date' : isNumeric ? 'number' : 'text'}
          value={isDateType ? editDate : isNumeric ? editNumber : editText}
          onChange={(e) => {
            if (isDateType) setEditDate(e.target.value);
            else if (isNumeric) setEditNumber(e.target.value);
            else setEditText(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => saveValue()}
          placeholder={field.type === 'url' ? 'https://...' : field.type === 'email' ? 'email@...' : '—'}
          className={cn(
            "h-7 w-full bg-slate-800 border border-amber-500/50 rounded px-2 text-sm text-white outline-none focus:border-amber-500",
            isDateType && "text-slate-300",
            isSaving && "opacity-50"
          )}
          step={isNumeric ? 'any' : undefined}
        />
      </div>
    );
  }

  // Display mode: click to edit
  const renderDisplayValue = () => {
    if (!value) return <span className="text-slate-500">—</span>;
    switch (field.type) {
      case 'text':
        return value.value ? <span className="truncate max-w-[150px] block">{value.value}</span> : <span className="text-slate-500">—</span>;
      case 'url':
        return value.value ? (
          <a href={value.value} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline truncate max-w-[150px] block" onClick={(e) => e.stopPropagation()}>
            {value.value}
          </a>
        ) : <span className="text-slate-500">—</span>;
      case 'email':
        return value.value ? (
          <a href={`mailto:${value.value}`} className="text-purple-400 hover:underline" onClick={(e) => e.stopPropagation()}>
            {value.value}
          </a>
        ) : <span className="text-slate-500">—</span>;
      case 'number':
        return value.numericValue ? <span>{parseFloat(value.numericValue).toLocaleString()}</span> : <span className="text-slate-500">—</span>;
      case 'currency':
        return value.numericValue ? <span className="text-emerald-400">${parseFloat(value.numericValue).toLocaleString()}</span> : <span className="text-slate-500">—</span>;
      case 'percent':
        return value.numericValue ? <span>{parseFloat(value.numericValue)}%</span> : <span className="text-slate-500">—</span>;
      case 'date':
        return value.dateValue ? <span>{format(new Date(value.dateValue), 'd MMM yyyy', { locale: ru })}</span> : <span className="text-slate-500">—</span>;
      default:
        return value.value ? <span>{value.value}</span> : <span className="text-slate-500">—</span>;
    }
  };

  return (
    <div
      className="text-sm text-slate-300 cursor-pointer rounded px-1 py-0.5 -mx-1 hover:bg-slate-700/50 transition-colors min-h-[28px] flex items-center"
      onClick={startEditing}
      title="Нажмите для редактирования"
    >
      {renderDisplayValue()}
    </div>
  );
}

// Main Table View Component
export function TableView({
  tasks,
  members,
  projectId,
  onTaskUpdate,
  onTaskClick,
  onTaskDelete,
  onExportCSV,
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

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterRule[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const isBulkLoading = bulkUpdateStatus.isPending || bulkUpdatePriority.isPending || bulkUpdateAssignee.isPending || bulkDelete.isPending;
  const selectedTaskIds = Array.from(selectedTasks);

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
