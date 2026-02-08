/**
 * CustomFieldCell - Inline editable custom field cell for tables
 * Extracted from TableView.tsx
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

// Types for custom field data - use 'any' for complex fields to match actual schema
export interface CustomFieldData {
  id: number;
  name: string;
  type: string;
  options?: unknown; // Can be string or parsed array depending on context
  formula?: string | null;
  rollupConfig?: unknown;
  showInTable?: boolean | null;
  showOnCard?: boolean | null;
}

export interface CustomFieldValueData {
  id: number;
  customFieldId: number;
  taskId: number;
  value?: string | null;
  numericValue?: string | null;
  dateValue?: Date | string | null;
  booleanValue?: boolean | null;
  jsonValue?: unknown; // Can be string or array depending on context
}

interface CustomFieldCellProps {
  field: CustomFieldData;
  value?: CustomFieldValueData;
  taskId: number;
}

export function CustomFieldCell({ field, value, taskId }: CustomFieldCellProps) {
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

  const saveValue = (overrideData?: Record<string, unknown>) => {
    setIsSaving(true);
    const data: Record<string, unknown> = { customFieldId: field.id, taskId };
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
    setValueMutation.mutate(data as Parameters<typeof setValueMutation.mutate>[0]);
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
    try {
      if (Array.isArray(field.options)) options = field.options;
      else if (typeof field.options === 'string') options = JSON.parse(field.options);
    } catch { /* ignore */ }
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
    try {
      if (Array.isArray(field.options)) options = field.options;
      else if (typeof field.options === 'string') options = JSON.parse(field.options);
    } catch { /* ignore */ }
    let selected: string[] = [];
    try {
      if (Array.isArray(value?.jsonValue)) selected = value.jsonValue as string[];
      else if (typeof value?.jsonValue === 'string') selected = JSON.parse(value.jsonValue);
    } catch { /* ignore */ }

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
