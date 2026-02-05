import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  GripVertical,
  Type,
  Hash,
  Calendar,
  List,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

type TemplateVariable = {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect';
  label: string;
  labelRu?: string;
  description?: string;
  defaultValue?: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

interface TemplateVariableEditorProps {
  variables: TemplateVariable[];
  onChange: (variables: TemplateVariable[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const VARIABLE_TYPES = [
  { value: 'text', label: 'Текст', icon: Type },
  { value: 'number', label: 'Число', icon: Hash },
  { value: 'date', label: 'Дата', icon: Calendar },
  { value: 'select', label: 'Выбор', icon: List },
  { value: 'multiselect', label: 'Множественный выбор', icon: List },
] as const;

export function TemplateVariableEditor({ 
  variables, 
  onChange,
  onSave,
  isSaving 
}: TemplateVariableEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: `var_${Date.now()}`,
      type: 'text',
      label: 'Новая переменная',
      required: false,
    };
    onChange([...variables, newVariable]);
    setEditingIndex(variables.length);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], ...updates };
    onChange(newVariables);
  };

  const removeVariable = (index: number) => {
    const newVariables = variables.filter((_, i) => i !== index);
    onChange(newVariables);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const moveVariable = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= variables.length) return;
    const newVariables = [...variables];
    const [moved] = newVariables.splice(fromIndex, 1);
    newVariables.splice(toIndex, 0, moved);
    onChange(newVariables);
    if (editingIndex === fromIndex) {
      setEditingIndex(toIndex);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = VARIABLE_TYPES.find(t => t.value === type);
    if (!typeConfig) return Type;
    return typeConfig.icon;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Переменные шаблона</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addVariable}
            className="border-slate-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить переменную
          </Button>
          {onSave && (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          )}
        </div>
      </div>

      {variables.length === 0 ? (
        <Card className="bg-slate-800/30 border-slate-700 border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-slate-400 mb-4">
              Переменные позволяют настраивать шаблон при использовании.
              <br />
              Используйте <code className="bg-slate-700 px-1 rounded">{"{{имя_переменной}}"}</code> в названиях блоков, секций и задач.
            </p>
            <Button
              variant="outline"
              onClick={addVariable}
              className="border-slate-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить первую переменную
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {variables.map((variable, index) => {
            const TypeIcon = getTypeIcon(variable.type);
            const isEditing = editingIndex === index;

            return (
              <Card 
                key={index} 
                className={`bg-slate-800/50 border-slate-700 transition-all ${
                  isEditing ? 'ring-2 ring-amber-500/50' : ''
                }`}
              >
                <CardContent className="p-4">
                  {isEditing ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Имя переменной (для кода)</Label>
                          <Input
                            value={variable.name}
                            onChange={(e) => updateVariable(index, { 
                              name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') 
                            })}
                            placeholder="project_name"
                            className="bg-slate-900/50 border-slate-600 font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Тип</Label>
                          <Select
                            value={variable.type}
                            onValueChange={(value) => updateVariable(index, { 
                              type: value as TemplateVariable['type'],
                              options: value === 'select' || value === 'multiselect' ? [] : undefined
                            })}
                          >
                            <SelectTrigger className="bg-slate-900/50 border-slate-600">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VARIABLE_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <type.icon className="w-4 h-4" />
                                    {type.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Название (EN)</Label>
                          <Input
                            value={variable.label}
                            onChange={(e) => updateVariable(index, { label: e.target.value })}
                            placeholder="Project Name"
                            className="bg-slate-900/50 border-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Название (RU)</Label>
                          <Input
                            value={variable.labelRu || ''}
                            onChange={(e) => updateVariable(index, { labelRu: e.target.value })}
                            placeholder="Название проекта"
                            className="bg-slate-900/50 border-slate-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Значение по умолчанию</Label>
                          <Input
                            value={variable.defaultValue || ''}
                            onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                            placeholder="Мой проект"
                            className="bg-slate-900/50 border-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Placeholder</Label>
                          <Input
                            value={variable.placeholder || ''}
                            onChange={(e) => updateVariable(index, { placeholder: e.target.value })}
                            placeholder="Введите название..."
                            className="bg-slate-900/50 border-slate-600"
                          />
                        </div>
                      </div>

                      {(variable.type === 'select' || variable.type === 'multiselect') && (
                        <div className="space-y-2">
                          <Label className="text-slate-300">Варианты (по одному на строку)</Label>
                          <Textarea
                            value={(variable.options || []).join('\n')}
                            onChange={(e) => updateVariable(index, { 
                              options: e.target.value.split('\n').filter(Boolean) 
                            })}
                            placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3"
                            className="bg-slate-900/50 border-slate-600 min-h-[100px]"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-slate-300">Описание</Label>
                        <Textarea
                          value={variable.description || ''}
                          onChange={(e) => updateVariable(index, { description: e.target.value })}
                          placeholder="Подсказка для пользователя..."
                          className="bg-slate-900/50 border-slate-600"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variable.required || false}
                            onCheckedChange={(checked) => updateVariable(index, { required: checked })}
                          />
                          <Label className="text-slate-300">Обязательное поле</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                          className="border-slate-600"
                        >
                          Готово
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 cursor-move text-slate-500">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      
                      <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">
                            {variable.labelRu || variable.label}
                          </span>
                          <code className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-amber-400">
                            {`{{${variable.name}}}`}
                          </code>
                          {variable.required && (
                            <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">
                              Обязательно
                            </Badge>
                          )}
                        </div>
                        {variable.description && (
                          <p className="text-sm text-slate-500 mt-1">{variable.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIndex(index)}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          Редактировать
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {variables.length > 0 && (
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="py-4">
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">Подсказка:</strong> Используйте переменные в названиях блоков, секций и задач.
              Например: <code className="bg-slate-700 px-1 rounded">{"Разработка {{project_name}}"}</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
