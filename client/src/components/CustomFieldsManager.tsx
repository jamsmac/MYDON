/**
 * Custom Fields Manager - UI for managing custom fields in project settings
 * Supports all field types including formulas and rollups
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Plus,
  GripVertical,
  MoreVertical,
  Pencil,
  Trash2,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Link,
  Mail,
  Calculator,
  BarChart3,
  DollarSign,
  Percent,
  Star,
  Eye,
  EyeOff,
  Table,
  Layers,
  HelpCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomFieldsManagerProps {
  projectId: number;
}

type FieldType = 
  | 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'multiselect'
  | 'url' | 'email' | 'formula' | 'rollup' | 'currency' | 'percent' | 'rating';

interface FieldOption {
  label: string;
  value: string;
  color?: string;
}

interface NewFieldData {
  name: string;
  type: FieldType;
  description: string;
  options: FieldOption[];
  formula: string;
  rollupConfig: {
    sourceField: string;
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'concat';
  };
  currencyCode: string;
  isRequired: boolean;
  showOnCard: boolean;
  showInTable: boolean;
  defaultValue: string;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text', label: 'Текст', icon: <Type className="w-4 h-4" />, description: 'Простое текстовое поле' },
  { value: 'number', label: 'Число', icon: <Hash className="w-4 h-4" />, description: 'Числовое значение' },
  { value: 'date', label: 'Дата', icon: <Calendar className="w-4 h-4" />, description: 'Выбор даты' },
  { value: 'checkbox', label: 'Чекбокс', icon: <CheckSquare className="w-4 h-4" />, description: 'Да/Нет переключатель' },
  { value: 'select', label: 'Выбор', icon: <List className="w-4 h-4" />, description: 'Выпадающий список' },
  { value: 'multiselect', label: 'Мультивыбор', icon: <Layers className="w-4 h-4" />, description: 'Множественный выбор' },
  { value: 'url', label: 'URL', icon: <Link className="w-4 h-4" />, description: 'Ссылка на ресурс' },
  { value: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, description: 'Адрес электронной почты' },
  { value: 'formula', label: 'Формула', icon: <Calculator className="w-4 h-4" />, description: 'Вычисляемое поле' },
  { value: 'rollup', label: 'Агрегация', icon: <BarChart3 className="w-4 h-4" />, description: 'Сумма/среднее по полям' },
  { value: 'currency', label: 'Валюта', icon: <DollarSign className="w-4 h-4" />, description: 'Денежное значение' },
  { value: 'percent', label: 'Процент', icon: <Percent className="w-4 h-4" />, description: 'Процентное значение' },
  { value: 'rating', label: 'Рейтинг', icon: <Star className="w-4 h-4" />, description: 'Оценка от 1 до 5' },
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#a855f7', '#d946ef', '#ec4899', '#64748b',
];

const DEFAULT_FIELD_DATA: NewFieldData = {
  name: '',
  type: 'text',
  description: '',
  options: [],
  formula: '',
  rollupConfig: { sourceField: '', aggregation: 'sum' },
  currencyCode: 'USD',
  isRequired: false,
  showOnCard: false,
  showInTable: true,
  defaultValue: '',
};

export function CustomFieldsManager({ projectId }: CustomFieldsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [fieldData, setFieldData] = useState<NewFieldData>(DEFAULT_FIELD_DATA);
  const [newOption, setNewOption] = useState('');
  
  const utils = trpc.useUtils();
  
  const { data: fields = [], isLoading } = trpc.customFields.getByProject.useQuery({ projectId });
  const { data: availableFunctions = [] } = trpc.customFields.getAvailableFunctions.useQuery();
  
  const createField = trpc.customFields.create.useMutation({
    onSuccess: () => {
      utils.customFields.getByProject.invalidate({ projectId });
      toast.success('Поле создано');
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });
  
  const updateField = trpc.customFields.update.useMutation({
    onSuccess: () => {
      utils.customFields.getByProject.invalidate({ projectId });
      toast.success('Поле обновлено');
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });
  
  const deleteField = trpc.customFields.delete.useMutation({
    onSuccess: () => {
      utils.customFields.getByProject.invalidate({ projectId });
      toast.success('Поле удалено');
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    },
  });
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFieldId(null);
    setFieldData(DEFAULT_FIELD_DATA);
    setNewOption('');
  };
  
  const openCreateDialog = () => {
    setFieldData(DEFAULT_FIELD_DATA);
    setEditingFieldId(null);
    setIsDialogOpen(true);
  };
  
  const openEditDialog = (field: typeof fields[0]) => {
    setFieldData({
      name: field.name,
      type: field.type as FieldType,
      description: field.description || '',
      options: (field.options as FieldOption[]) || [],
      formula: field.formula || '',
      rollupConfig: (field.rollupConfig as any) || { sourceField: '', aggregation: 'sum' },
      currencyCode: field.currencyCode || 'USD',
      isRequired: field.isRequired || false,
      showOnCard: field.showOnCard || false,
      showInTable: field.showInTable ?? true,
      defaultValue: field.defaultValue || '',
    });
    setEditingFieldId(field.id);
    setIsDialogOpen(true);
  };
  
  const handleSave = () => {
    if (!fieldData.name.trim()) {
      toast.error('Введите название поля');
      return;
    }
    
    const data = {
      projectId,
      name: fieldData.name.trim(),
      type: fieldData.type,
      description: fieldData.description || undefined,
      options: ['select', 'multiselect'].includes(fieldData.type) ? fieldData.options : undefined,
      formula: fieldData.type === 'formula' ? fieldData.formula : undefined,
      rollupConfig: fieldData.type === 'rollup' ? fieldData.rollupConfig : undefined,
      currencyCode: fieldData.type === 'currency' ? fieldData.currencyCode : undefined,
      isRequired: fieldData.isRequired,
      showOnCard: fieldData.showOnCard,
      showInTable: fieldData.showInTable,
      defaultValue: fieldData.defaultValue || undefined,
    };
    
    if (editingFieldId) {
      updateField.mutate({ id: editingFieldId, updates: data });
    } else {
      createField.mutate(data);
    }
  };
  
  const handleAddOption = () => {
    if (!newOption.trim()) return;
    
    const value = newOption.trim().toLowerCase().replace(/\s+/g, '_');
    if (fieldData.options.some(o => o.value === value)) {
      toast.error('Такой вариант уже существует');
      return;
    }
    
    setFieldData({
      ...fieldData,
      options: [...fieldData.options, { 
        label: newOption.trim(), 
        value,
        color: COLORS[fieldData.options.length % COLORS.length],
      }],
    });
    setNewOption('');
  };
  
  const handleRemoveOption = (value: string) => {
    setFieldData({
      ...fieldData,
      options: fieldData.options.filter(o => o.value !== value),
    });
  };
  
  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(f => f.value === type);
    return fieldType?.icon || <Type className="w-4 h-4" />;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Кастомные поля</h3>
          <p className="text-sm text-slate-400">
            Добавьте дополнительные поля для задач проекта
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить поле
        </Button>
      </div>
      
      {fields.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-center">
              Нет кастомных полей. Создайте первое поле для расширения возможностей задач.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <Card key={field.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <GripVertical className="w-4 h-4 text-slate-600 cursor-grab" />
                
                <div className="flex items-center gap-2 text-slate-400">
                  {getFieldIcon(field.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{field.name}</span>
                    {field.isRequired && (
                      <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
                        Обязательное
                      </Badge>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-xs text-slate-500 truncate">{field.description}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {field.showOnCard && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 gap-1">
                      <Eye className="w-3 h-3" />
                      Карточка
                    </Badge>
                  )}
                  {field.showInTable && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400 gap-1">
                      <Table className="w-3 h-3" />
                      Таблица
                    </Badge>
                  )}
                </div>
                
                <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                  {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem onClick={() => openEditDialog(field)} className="gap-2">
                      <Pencil className="w-4 h-4" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteField.mutate({ id: field.id })}
                      className="gap-2 text-red-400 focus:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingFieldId ? 'Редактировать поле' : 'Создать поле'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-slate-300">Название поля *</Label>
                <Input
                  value={fieldData.name}
                  onChange={(e) => setFieldData({ ...fieldData, name: e.target.value })}
                  placeholder="Например: Бюджет, Ответственный, Приоритет..."
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              
              {/* Type */}
              <div className="space-y-2">
                <Label className="text-slate-300">Тип поля</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FIELD_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setFieldData({ ...fieldData, type: type.value })}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border transition-colors text-left",
                        fieldData.type === type.value
                          ? "border-amber-500 bg-amber-500/10 text-amber-400"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      {type.icon}
                      <span className="text-sm">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label className="text-slate-300">Описание</Label>
                <Textarea
                  value={fieldData.description}
                  onChange={(e) => setFieldData({ ...fieldData, description: e.target.value })}
                  placeholder="Опишите назначение поля..."
                  className="bg-slate-800 border-slate-700 resize-none"
                  rows={2}
                />
              </div>
              
              {/* Options for select/multiselect */}
              {['select', 'multiselect'].includes(fieldData.type) && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Варианты выбора</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Добавить вариант..."
                      className="bg-slate-800 border-slate-700"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                    />
                    <Button onClick={handleAddOption} variant="outline" className="border-slate-700">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {fieldData.options.map((option) => (
                      <Badge
                        key={option.value}
                        variant="outline"
                        className="gap-1 pr-1"
                        style={{ borderColor: option.color, color: option.color }}
                      >
                        {option.label}
                        <button
                          onClick={() => handleRemoveOption(option.value)}
                          className="ml-1 hover:bg-slate-700 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Formula editor */}
              {fieldData.type === 'formula' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Формула</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 text-slate-400">
                          <HelpCircle className="w-4 h-4" />
                          Функции
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 w-80">
                        <ScrollArea className="h-64">
                          {availableFunctions.map((func) => (
                            <DropdownMenuItem
                              key={func.name}
                              onClick={() => setFieldData({ 
                                ...fieldData, 
                                formula: fieldData.formula + func.name + '()' 
                              })}
                              className="flex flex-col items-start gap-1"
                            >
                              <span className="font-mono text-amber-400">{func.syntax}</span>
                              <span className="text-xs text-slate-500">{func.description}</span>
                            </DropdownMenuItem>
                          ))}
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Textarea
                    value={fieldData.formula}
                    onChange={(e) => setFieldData({ ...fieldData, formula: e.target.value })}
                    placeholder="IF({priority} == 'high', {estimate} * 1.5, {estimate})"
                    className="bg-slate-800 border-slate-700 font-mono text-sm resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-slate-500">
                    Используйте {'{'}field_name{'}'} для ссылки на поля. Доступны: {'{'}status{'}'}, {'{'}priority{'}'}, {'{'}deadline{'}'}, {'{'}progress{'}'}
                  </p>
                </div>
              )}
              
              {/* Rollup config */}
              {fieldData.type === 'rollup' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Исходное поле</Label>
                    <Select
                      value={fieldData.rollupConfig.sourceField}
                      onValueChange={(v) => setFieldData({
                        ...fieldData,
                        rollupConfig: { ...fieldData.rollupConfig, sourceField: v }
                      })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Выберите поле..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {fields.filter(f => f.id !== editingFieldId && ['number', 'currency', 'percent'].includes(f.type)).map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Функция агрегации</Label>
                    <Select
                      value={fieldData.rollupConfig.aggregation}
                      onValueChange={(v: any) => setFieldData({
                        ...fieldData,
                        rollupConfig: { ...fieldData.rollupConfig, aggregation: v }
                      })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="sum">Сумма (SUM)</SelectItem>
                        <SelectItem value="avg">Среднее (AVG)</SelectItem>
                        <SelectItem value="count">Количество (COUNT)</SelectItem>
                        <SelectItem value="min">Минимум (MIN)</SelectItem>
                        <SelectItem value="max">Максимум (MAX)</SelectItem>
                        <SelectItem value="concat">Объединение (CONCAT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Currency code */}
              {fieldData.type === 'currency' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Валюта</Label>
                  <Select
                    value={fieldData.currencyCode}
                    onValueChange={(v) => setFieldData({ ...fieldData, currencyCode: v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="RUB">RUB (₽)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="UZS">UZS (сўм)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Default value */}
              {!['formula', 'rollup'].includes(fieldData.type) && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Значение по умолчанию</Label>
                  <Input
                    value={fieldData.defaultValue}
                    onChange={(e) => setFieldData({ ...fieldData, defaultValue: e.target.value })}
                    placeholder="Оставьте пустым, если не нужно"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              )}
              
              {/* Display options */}
              <div className="space-y-4 pt-4 border-t border-slate-700">
                <h4 className="text-sm font-medium text-slate-300">Настройки отображения</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300">Обязательное поле</Label>
                    <p className="text-xs text-slate-500">Требовать заполнение при создании задачи</p>
                  </div>
                  <Switch
                    checked={fieldData.isRequired}
                    onCheckedChange={(v) => setFieldData({ ...fieldData, isRequired: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300">Показывать на карточке</Label>
                    <p className="text-xs text-slate-500">Отображать в Kanban карточках</p>
                  </div>
                  <Switch
                    checked={fieldData.showOnCard}
                    onCheckedChange={(v) => setFieldData({ ...fieldData, showOnCard: v })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300">Показывать в таблице</Label>
                    <p className="text-xs text-slate-500">Отображать как колонку в Table View</p>
                  </div>
                  <Switch
                    checked={fieldData.showInTable}
                    onCheckedChange={(v) => setFieldData({ ...fieldData, showInTable: v })}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="outline" onClick={closeDialog} className="border-slate-700">
              Отмена
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createField.isPending || updateField.isPending}
            >
              {editingFieldId ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomFieldsManager;
