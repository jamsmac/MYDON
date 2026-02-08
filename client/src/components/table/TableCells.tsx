/**
 * Table Cell Components
 * Extracted from TableView.tsx for reusability and cleaner code
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableRow, TableCell } from '@/components/ui/table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/constants/projectConstants';

// ============ TYPES ============

export type SortField = 'title' | 'status' | 'priority' | 'deadline' | 'assignedTo' | 'blockTitle';
export type SortDirection = 'asc' | 'desc';
export type GroupBy = 'none' | 'status' | 'priority' | 'block' | 'assignee';

// ============ EDITABLE CELL ============

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'textarea';
}

export function EditableCell({ value, onSave, type = 'text' }: EditableCellProps) {
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

// ============ STATUS CELL ============

interface StatusCellProps {
  status: string | null;
  onChange: (status: string) => void;
}

export function StatusCell({ status, onChange }: StatusCellProps) {
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

// ============ PRIORITY CELL ============

interface PriorityCellProps {
  priority: string | null;
  onChange: (priority: string) => void;
}

export function PriorityCell({ priority, onChange }: PriorityCellProps) {
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

// ============ SORTABLE HEADER ============

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField | null;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}

export function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: SortableHeaderProps) {
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

// ============ GROUP HEADER ============

interface GroupHeaderProps {
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  colSpan?: number;
}

export function GroupHeader({
  label,
  count,
  isExpanded,
  onToggle,
  colSpan = 7,
}: GroupHeaderProps) {
  return (
    <TableRow className="bg-slate-800/50 hover:bg-slate-800/70">
      <TableCell colSpan={colSpan} className="py-2">
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
