/**
 * Custom Fields Form - Renders and manages custom field values for a task
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  CalendarIcon,
  Star,
  Link as LinkIcon,
  Mail,
  Calculator,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomFieldsFormProps {
  projectId: number;
  taskId: number;
  compact?: boolean;
}

interface FieldOption {
  label: string;
  value: string;
  color?: string;
}

export function CustomFieldsForm({ projectId, taskId, compact = false }: CustomFieldsFormProps) {
  const [localValues, setLocalValues] = useState<Record<number, any>>({});
  
  const utils = trpc.useUtils();
  
  const { data: fields = [] } = trpc.customFields.getByProject.useQuery({ projectId });
  const { data: values = [] } = trpc.customFields.getValuesByTask.useQuery({ taskId });
  
  const setValue = trpc.customFields.setValue.useMutation({
    onSuccess: () => {
      utils.customFields.getValuesByTask.invalidate({ taskId });
    },
    onError: (error) => {
      toast.error(`Ошибка сохранения: ${error.message}`);
    },
  });
  
  // Initialize local values from server
  useEffect(() => {
    const initial: Record<number, any> = {};
    for (const field of fields) {
      const value = values.find(v => v.customFieldId === field.id);
      if (value) {
        switch (field.type) {
          case 'number':
          case 'currency':
          case 'percent':
          case 'rating':
            initial[field.id] = value.numericValue ? parseFloat(value.numericValue) : '';
            break;
          case 'checkbox':
            initial[field.id] = value.booleanValue ?? false;
            break;
          case 'date':
            initial[field.id] = value.dateValue ? new Date(value.dateValue) : null;
            break;
          case 'multiselect':
            initial[field.id] = value.jsonValue || [];
            break;
          default:
            initial[field.id] = value.value || '';
        }
      } else {
        // Use default value
        initial[field.id] = field.defaultValue || (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '');
      }
    }
    setLocalValues(initial);
  }, [fields, values]);
  
  const handleChange = (fieldId: number, value: any, fieldType: string) => {
    setLocalValues(prev => ({ ...prev, [fieldId]: value }));
    
    // Prepare value for API
    const apiValue: any = { customFieldId: fieldId, taskId };
    
    switch (fieldType) {
      case 'number':
      case 'currency':
      case 'percent':
      case 'rating':
        apiValue.numericValue = value === '' ? null : Number(value);
        break;
      case 'checkbox':
        apiValue.booleanValue = value;
        break;
      case 'date':
        apiValue.dateValue = value ? value.getTime() : null;
        break;
      case 'multiselect':
        apiValue.jsonValue = value;
        break;
      default:
        apiValue.value = value || null;
    }
    
    setValue.mutate(apiValue);
  };
  
  if (fields.length === 0) {
    return null;
  }
  
  const renderField = (field: typeof fields[0]) => {
    const value = localValues[field.id];
    const options = (field.options as FieldOption[]) || [];
    
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleChange(field.id, e.target.value, field.type)}
            placeholder={`Введите ${field.name.toLowerCase()}...`}
            className="bg-slate-800 border-slate-700"
          />
        );
        
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(field.id, e.target.value, field.type)}
            placeholder="0"
            className="bg-slate-800 border-slate-700"
          />
        );
        
      case 'currency':
        const currencySymbol = field.currencyCode === 'USD' ? '$' : 
                              field.currencyCode === 'EUR' ? '€' : 
                              field.currencyCode === 'RUB' ? '₽' : 
                              field.currencyCode === 'GBP' ? '£' : 
                              field.currencyCode || '$';
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {currencySymbol}
            </span>
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => handleChange(field.id, e.target.value, field.type)}
              placeholder="0.00"
              className="bg-slate-800 border-slate-700 pl-8"
            />
          </div>
        );
        
      case 'percent':
        return (
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              value={value || ''}
              onChange={(e) => handleChange(field.id, e.target.value, field.type)}
              placeholder="0"
              className="bg-slate-800 border-slate-700 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
          </div>
        );
        
      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleChange(field.id, value === star ? 0 : star, field.type)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={cn(
                    "w-5 h-5 transition-colors",
                    star <= (value || 0) ? "fill-amber-400 text-amber-400" : "text-slate-600"
                  )}
                />
              </button>
            ))}
          </div>
        );
        
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-slate-800 border-slate-700",
                  !value && "text-slate-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(value, 'd MMMM yyyy', { locale: ru }) : 'Выберите дату'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
              <Calendar
                mode="single"
                selected={value}
                onSelect={(date) => handleChange(field.id, date, field.type)}
                locale={ru}
              />
            </PopoverContent>
          </Popover>
        );
        
      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={value || false}
              onCheckedChange={(checked) => handleChange(field.id, checked, field.type)}
            />
            <span className="text-sm text-slate-400">
              {value ? 'Да' : 'Нет'}
            </span>
          </div>
        );
        
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(v) => handleChange(field.id, v, field.type)}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700">
              <SelectValue placeholder="Выберите..." />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.color && (
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
        
      case 'multiselect':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <Badge
                    key={option.value}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected 
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50" 
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    )}
                    style={isSelected && option.color ? { 
                      backgroundColor: `${option.color}20`,
                      borderColor: `${option.color}50`,
                      color: option.color,
                    } : undefined}
                    onClick={() => {
                      const newValues = isSelected
                        ? selectedValues.filter((v: string) => v !== option.value)
                        : [...selectedValues, option.value];
                      handleChange(field.id, newValues, field.type);
                    }}
                  >
                    {option.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        );
        
      case 'url':
        return (
          <div className="flex gap-2">
            <Input
              type="url"
              value={value || ''}
              onChange={(e) => handleChange(field.id, e.target.value, field.type)}
              placeholder="https://..."
              className="bg-slate-800 border-slate-700 flex-1"
            />
            {value && (
              <Button
                variant="outline"
                size="icon"
                className="border-slate-700"
                onClick={() => window.open(value, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
        
      case 'email':
        return (
          <div className="flex gap-2">
            <Input
              type="email"
              value={value || ''}
              onChange={(e) => handleChange(field.id, e.target.value, field.type)}
              placeholder="email@example.com"
              className="bg-slate-800 border-slate-700 flex-1"
            />
            {value && (
              <Button
                variant="outline"
                size="icon"
                className="border-slate-700"
                onClick={() => window.location.href = `mailto:${value}`}
              >
                <Mail className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
        
      case 'formula':
        // Formula fields are read-only, show calculated value
        return (
          <FormulaValue 
            projectId={projectId} 
            taskId={taskId} 
            formula={field.formula || ''} 
          />
        );
        
      case 'rollup':
        // Rollup fields are read-only
        return (
          <RollupValue 
            projectId={projectId} 
            fieldId={field.id} 
          />
        );
        
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleChange(field.id, e.target.value, field.type)}
            className="bg-slate-800 border-slate-700"
          />
        );
    }
  };
  
  if (compact) {
    // Compact view for Kanban cards - only show fields marked for card display
    const cardFields = fields.filter(f => f.showOnCard);
    if (cardFields.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {cardFields.map((field) => {
          const value = localValues[field.id];
          if (!value && value !== 0 && value !== false) return null;
          
          return (
            <Badge 
              key={field.id} 
              variant="outline" 
              className="text-xs border-slate-600 text-slate-400"
            >
              {field.name}: {formatDisplayValue(value, field.type)}
            </Badge>
          );
        })}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Calculator className="w-4 h-4" />
        Кастомные поля
      </h4>
      
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-sm text-slate-400 flex items-center gap-1">
              {field.name}
              {field.isRequired && <span className="text-red-400">*</span>}
            </Label>
            {renderField(field)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper component for formula values
function FormulaValue({ projectId, taskId, formula }: { projectId: number; taskId: number; formula: string }) {
  const { data, isLoading } = trpc.customFields.evaluateFormula.useQuery(
    { formula, taskId, projectId },
    { enabled: !!formula }
  );
  
  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-slate-500" />;
  }
  
  if (!data?.success) {
    return (
      <span className="text-red-400 text-sm font-mono">
        {(data as any)?.errorCode || '#ERROR!'}
      </span>
    );
  }
  
  const successData = data as { success: true; value: any; type: string };
  
  return (
    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md">
      <span className="text-slate-200 font-mono">
        {formatDisplayValue(successData.value, successData.type)}
      </span>
    </div>
  );
}

// Helper component for rollup values
function RollupValue({ projectId, fieldId }: { projectId: number; fieldId: number }) {
  const { data, isLoading } = trpc.customFields.evaluateRollup.useQuery(
    { fieldId, projectId }
  );
  
  if (isLoading) {
    return <Loader2 className="w-4 h-4 animate-spin text-slate-500" />;
  }
  
  if (!data?.success) {
    return (
      <span className="text-red-400 text-sm font-mono">
        {(data as any)?.errorCode || '#ERROR!'}
      </span>
    );
  }
  
  const successData = data as { success: true; value: any; type: string };
  
  return (
    <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md">
      <span className="text-slate-200 font-mono">
        {formatDisplayValue(successData.value, successData.type)}
      </span>
    </div>
  );
}

// Format value for display
function formatDisplayValue(value: any, type: string): string {
  if (value === null || value === undefined) return '—';
  
  switch (type) {
    case 'boolean':
      return value ? 'Да' : 'Нет';
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('ru-RU') : String(value);
    default:
      return String(value);
  }
}

export default CustomFieldsForm;
