/**
 * Custom Field Filter Component
 * Reusable filter UI for filtering tasks by custom field values
 * Used in both TableView and KanbanBoard
 */

import { useState, useMemo } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  SlidersHorizontal,
  Plus,
  X,
  Trash2,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types matching the custom field data structure
export type CustomFieldForFilter = {
  id: number;
  name: string;
  type: string;
  options?: any;
};

export type CustomFieldValueForFilter = {
  id: number;
  customFieldId: number;
  taskId: number;
  value?: string | null;
  numericValue?: string | null;
  dateValue?: Date | string | null;
  booleanValue?: boolean | null;
  jsonValue?: any;
};

// Filter operator types per field type
type TextOperator = 'equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
type NumberOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'is_empty' | 'is_not_empty';
type DateOperator = 'equals' | 'before' | 'after' | 'is_empty' | 'is_not_empty';
type BooleanOperator = 'is_true' | 'is_false';
type SelectOperator = 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';
type RatingOperator = 'equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal';

export type FilterOperator = TextOperator | NumberOperator | DateOperator | BooleanOperator | SelectOperator | RatingOperator;

export interface CustomFieldFilterRule {
  id: string; // unique filter ID
  fieldId: number;
  operator: FilterOperator;
  value: string;
}

// Operator labels
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'равно',
  not_equals: 'не равно',
  contains: 'содержит',
  not_contains: 'не содержит',
  greater_than: 'больше',
  less_than: 'меньше',
  greater_or_equal: '≥',
  less_or_equal: '≤',
  before: 'до',
  after: 'после',
  is_true: 'да',
  is_false: 'нет',
  is_empty: 'пусто',
  is_not_empty: 'не пусто',
};

// Get available operators for a field type
function getOperatorsForType(type: string): FilterOperator[] {
  switch (type) {
    case 'text':
    case 'url':
    case 'email':
      return ['contains', 'equals', 'not_contains', 'is_empty', 'is_not_empty'];
    case 'number':
    case 'currency':
    case 'percent':
      return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'is_empty', 'is_not_empty'];
    case 'date':
      return ['equals', 'before', 'after', 'is_empty', 'is_not_empty'];
    case 'checkbox':
      return ['is_true', 'is_false'];
    case 'select':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
    case 'multiselect':
      return ['contains', 'not_contains', 'is_empty', 'is_not_empty'];
    case 'rating':
      return ['equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal'];
    case 'formula':
    case 'rollup':
      return ['equals', 'contains', 'is_empty', 'is_not_empty'];
    default:
      return ['equals', 'contains', 'is_empty', 'is_not_empty'];
  }
}

// Check if operator needs a value input
function operatorNeedsValue(op: FilterOperator): boolean {
  return !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(op);
}

// Apply a single filter rule to check if a task passes
export function taskPassesFilter(
  rule: CustomFieldFilterRule,
  fieldValue: CustomFieldValueForFilter | undefined,
  field: CustomFieldForFilter
): boolean {
  const { operator, value: filterValue } = rule;

  // Handle empty/not empty checks
  if (operator === 'is_empty') {
    if (!fieldValue) return true;
    if (field.type === 'checkbox') return fieldValue.booleanValue === null || fieldValue.booleanValue === undefined;
    if (['number', 'currency', 'percent', 'rating'].includes(field.type)) return !fieldValue.numericValue;
    if (field.type === 'date') return !fieldValue.dateValue;
    if (field.type === 'multiselect') return !fieldValue.jsonValue;
    return !fieldValue.value;
  }
  if (operator === 'is_not_empty') {
    return !taskPassesFilter({ ...rule, operator: 'is_empty' }, fieldValue, field);
  }

  // Boolean checks
  if (operator === 'is_true') return fieldValue?.booleanValue === true;
  if (operator === 'is_false') return !fieldValue?.booleanValue;

  // No value to compare against
  if (!fieldValue) return false;

  // Text-based comparisons
  if (['text', 'url', 'email', 'formula', 'rollup'].includes(field.type)) {
    const val = (fieldValue.value || '').toLowerCase();
    const fv = filterValue.toLowerCase();
    switch (operator) {
      case 'equals': return val === fv;
      case 'contains': return val.includes(fv);
      case 'not_contains': return !val.includes(fv);
      default: return true;
    }
  }

  // Number-based comparisons
  if (['number', 'currency', 'percent', 'rating'].includes(field.type)) {
    const val = fieldValue.numericValue ? parseFloat(fieldValue.numericValue) : null;
    const fv = parseFloat(filterValue);
    if (val === null || isNaN(fv)) return false;
    switch (operator) {
      case 'equals': return val === fv;
      case 'not_equals': return val !== fv;
      case 'greater_than': return val > fv;
      case 'less_than': return val < fv;
      case 'greater_or_equal': return val >= fv;
      case 'less_or_equal': return val <= fv;
      default: return true;
    }
  }

  // Date comparisons
  if (field.type === 'date') {
    if (!fieldValue.dateValue) return false;
    const val = new Date(fieldValue.dateValue).getTime();
    const fv = new Date(filterValue).getTime();
    if (isNaN(val) || isNaN(fv)) return false;
    switch (operator) {
      case 'equals': return Math.abs(val - fv) < 86400000; // same day
      case 'before': return val < fv;
      case 'after': return val > fv;
      default: return true;
    }
  }

  // Select comparisons
  if (field.type === 'select') {
    const val = fieldValue.value || '';
    switch (operator) {
      case 'equals': return val === filterValue;
      case 'not_equals': return val !== filterValue;
      default: return true;
    }
  }

  // Multiselect comparisons
  if (field.type === 'multiselect') {
    let selected: string[] = [];
    try { selected = fieldValue.jsonValue ? JSON.parse(fieldValue.jsonValue) : []; } catch {}
    switch (operator) {
      case 'contains': return selected.includes(filterValue);
      case 'not_contains': return !selected.includes(filterValue);
      default: return true;
    }
  }

  return true;
}

// Apply all filter rules to check if a task passes (AND logic)
export function taskPassesAllFilters(
  rules: CustomFieldFilterRule[],
  taskId: number,
  fieldValuesMap: Map<number, Map<number, CustomFieldValueForFilter>>,
  fieldsMap: Map<number, CustomFieldForFilter>
): boolean {
  if (rules.length === 0) return true;
  const taskValues = fieldValuesMap.get(taskId);
  return rules.every(rule => {
    const field = fieldsMap.get(rule.fieldId);
    if (!field) return true;
    const fieldValue = taskValues?.get(rule.fieldId);
    return taskPassesFilter(rule, fieldValue, field);
  });
}

// Filter value input component
function FilterValueInput({
  field,
  operator,
  value,
  onChange,
}: {
  field: CustomFieldForFilter;
  operator: FilterOperator;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!operatorNeedsValue(operator)) return null;

  // Select field: show options dropdown
  if (field.type === 'select' || (field.type === 'multiselect' && ['contains', 'not_contains'].includes(operator))) {
    let options: { label: string; value: string; color?: string }[] = [];
    try { options = field.options ? JSON.parse(field.options) : []; } catch {}
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-[130px] bg-slate-800 border-slate-600 text-sm">
          <SelectValue placeholder="Значение" />
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

  // Rating: show stars
  if (field.type === 'rating') {
    const currentVal = value ? parseInt(value) : 0;
    return (
      <div className="flex gap-0.5 items-center">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={cn(
              "w-4 h-4 cursor-pointer transition-colors",
              i <= currentVal ? "text-amber-400 fill-amber-400" : "text-slate-600 hover:text-amber-300"
            )}
            onClick={() => onChange(i.toString())}
          />
        ))}
      </div>
    );
  }

  // Date: date input
  if (field.type === 'date') {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-[140px] bg-slate-800 border-slate-600 text-sm text-white"
      />
    );
  }

  // Number types
  if (['number', 'currency', 'percent'].includes(field.type)) {
    return (
      <Input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="h-7 w-[100px] bg-slate-800 border-slate-600 text-sm text-white"
      />
    );
  }

  // Default: text input
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Значение..."
      className="h-7 w-[130px] bg-slate-800 border-slate-600 text-sm text-white"
    />
  );
}

// Single filter row
function FilterRow({
  rule,
  fields,
  onUpdate,
  onRemove,
}: {
  rule: CustomFieldFilterRule;
  fields: CustomFieldForFilter[];
  onUpdate: (updated: CustomFieldFilterRule) => void;
  onRemove: () => void;
}) {
  const selectedField = fields.find(f => f.id === rule.fieldId);
  const operators = selectedField ? getOperatorsForType(selectedField.type) : [];

  return (
    <div className="flex items-center gap-2 py-1">
      {/* Field selector */}
      <Select
        value={rule.fieldId.toString()}
        onValueChange={(v) => {
          const newFieldId = parseInt(v);
          const newField = fields.find(f => f.id === newFieldId);
          const newOps = newField ? getOperatorsForType(newField.type) : [];
          onUpdate({
            ...rule,
            fieldId: newFieldId,
            operator: newOps[0] || 'equals',
            value: '',
          });
        }}
      >
        <SelectTrigger className="h-7 w-[140px] bg-slate-800 border-slate-600 text-sm">
          <SelectValue placeholder="Поле" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {fields.map(f => (
            <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select
        value={rule.operator}
        onValueChange={(v) => {
          const newOp = v as FilterOperator;
          onUpdate({
            ...rule,
            operator: newOp,
            value: operatorNeedsValue(newOp) ? rule.value : '',
          });
        }}
      >
        <SelectTrigger className="h-7 w-[120px] bg-slate-800 border-slate-600 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700">
          {operators.map(op => (
            <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {selectedField && (
        <FilterValueInput
          field={selectedField}
          operator={rule.operator}
          value={rule.value}
          onChange={(v) => onUpdate({ ...rule, value: v })}
        />
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-slate-400 hover:text-red-400"
        onClick={onRemove}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// Main CustomFieldFilter component
export function CustomFieldFilterPanel({
  fields,
  filters,
  onFiltersChange,
}: {
  fields: CustomFieldForFilter[];
  filters: CustomFieldFilterRule[];
  onFiltersChange: (filters: CustomFieldFilterRule[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const addFilter = () => {
    if (fields.length === 0) return;
    const firstField = fields[0];
    const ops = getOperatorsForType(firstField.type);
    onFiltersChange([
      ...filters,
      {
        id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fieldId: firstField.id,
        operator: ops[0] || 'equals',
        value: '',
      },
    ]);
  };

  const updateFilter = (index: number, updated: CustomFieldFilterRule) => {
    const newFilters = [...filters];
    newFilters[index] = updated;
    onFiltersChange(newFilters);
  };

  const removeFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    onFiltersChange([]);
  };

  const activeCount = filters.length;

  if (fields.length === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 border-slate-700 gap-1.5",
            activeCount > 0 && "border-amber-500/50 text-amber-400"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Фильтры полей</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1 bg-amber-500/20 text-amber-400 text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[460px] bg-slate-850 border-slate-700 p-4"
        align="start"
        side="bottom"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Фильтры по кастомным полям</h4>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-400 hover:text-white"
                onClick={clearAll}
              >
                <X className="w-3 h-3 mr-1" />
                Сбросить все
              </Button>
            )}
          </div>

          {/* Filter rules */}
          {filters.length > 0 ? (
            <div className="space-y-1">
              {filters.map((rule, index) => (
                <FilterRow
                  key={rule.id}
                  rule={rule}
                  fields={fields}
                  onUpdate={(updated) => updateFilter(index, updated)}
                  onRemove={() => removeFilter(index)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-2">Нет активных фильтров</p>
          )}

          {/* Add filter button */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-slate-700 border-dashed"
            onClick={addFilter}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Добавить фильтр
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
