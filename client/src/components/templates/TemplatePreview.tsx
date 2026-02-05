import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  FolderOpen, 
  CheckSquare,
  Calendar,
  Hash,
  Type,
  List,
  Eye
} from 'lucide-react';

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

type TemplateStructure = {
  variables?: TemplateVariable[];
  blocks: {
    title: string;
    description?: string;
    duration?: string;
    sections: {
      title: string;
      description?: string;
      tasks: {
        title: string;
        description?: string;
        priority?: 'critical' | 'high' | 'medium' | 'low';
      }[];
    }[];
  }[];
};

interface TemplatePreviewProps {
  template: {
    id: number;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    blocksCount?: number | null;
    sectionsCount?: number | null;
    tasksCount?: number | null;
    estimatedDuration?: string | null;
  };
  structure: TemplateStructure | null;
  onUseTemplate?: (variableValues: Record<string, string>) => void;
  isLoading?: boolean;
}

// Substitute variables in text
function substituteVariables(text: string, values: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, value || `{{${key}}}`);
  }
  return result;
}

export function TemplatePreview({ 
  template, 
  structure, 
  onUseTemplate,
  isLoading 
}: TemplatePreviewProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set([0]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  // Initialize default values
  useMemo(() => {
    if (structure?.variables) {
      const defaults: Record<string, string> = {};
      for (const variable of structure.variables) {
        if (variable.defaultValue) {
          defaults[variable.name] = variable.defaultValue;
        }
      }
      setVariableValues(prev => ({ ...defaults, ...prev }));
    }
  }, [structure?.variables]);

  const variables = structure?.variables || [];

  const toggleBlock = (index: number) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBlocks(newExpanded);
  };

  const toggleSection = (key: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSections(newExpanded);
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const getVariableIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'number': return <Hash className="w-4 h-4" />;
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'select': return <List className="w-4 h-4" />;
      case 'multiselect': return <List className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  // Apply variables to preview
  const previewStructure = useMemo(() => {
    if (!structure || !showPreview) return structure;
    
    return {
      ...structure,
      blocks: structure.blocks.map(block => ({
        ...block,
        title: substituteVariables(block.title, variableValues),
        description: block.description ? substituteVariables(block.description, variableValues) : undefined,
        sections: block.sections.map(section => ({
          ...section,
          title: substituteVariables(section.title, variableValues),
          description: section.description ? substituteVariables(section.description, variableValues) : undefined,
          tasks: section.tasks.map(task => ({
            ...task,
            title: substituteVariables(task.title, variableValues),
            description: task.description ? substituteVariables(task.description, variableValues) : undefined,
          }))
        }))
      }))
    };
  }, [structure, variableValues, showPreview]);

  const displayStructure = showPreview ? previewStructure : structure;

  return (
    <div className="space-y-6">
      {/* Template Info */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: template.color || '#8b5cf6' }}
              >
                <Layers className="w-4 h-4 text-white" />
              </div>
              {template.name}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Badge variant="outline" className="border-slate-600">
                {template.blocksCount || 0} блоков
              </Badge>
              <Badge variant="outline" className="border-slate-600">
                {template.sectionsCount || 0} секций
              </Badge>
              <Badge variant="outline" className="border-slate-600">
                {template.tasksCount || 0} задач
              </Badge>
            </div>
          </div>
          {template.description && (
            <p className="text-sm text-slate-400 mt-2">{template.description}</p>
          )}
        </CardHeader>
      </Card>

      {/* Variables Form */}
      {variables.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-slate-100">
                Параметры шаблона
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className={showPreview ? 'border-amber-500 text-amber-400' : ''}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showPreview ? 'Скрыть превью' : 'Показать превью'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variables.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    {getVariableIcon(variable.type)}
                    {variable.labelRu || variable.label}
                    {variable.required && <span className="text-red-400">*</span>}
                  </Label>
                  {variable.type === 'select' && variable.options ? (
                    <Select
                      value={variableValues[variable.name] || ''}
                      onValueChange={(value) => handleVariableChange(variable.name, value)}
                    >
                      <SelectTrigger className="bg-slate-900/50 border-slate-600">
                        <SelectValue placeholder={variable.placeholder || 'Выберите...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {variable.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : variable.type === 'number' ? (
                    <Input
                      type="number"
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={variable.placeholder}
                      className="bg-slate-900/50 border-slate-600"
                    />
                  ) : variable.type === 'date' ? (
                    <Input
                      type="date"
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      className="bg-slate-900/50 border-slate-600"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={variableValues[variable.name] || ''}
                      onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                      placeholder={variable.placeholder}
                      className="bg-slate-900/50 border-slate-600"
                    />
                  )}
                  {variable.description && (
                    <p className="text-xs text-slate-500">{variable.description}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structure Preview */}
      {displayStructure && displayStructure.blocks.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-100">
              Структура проекта
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {displayStructure.blocks.map((block, blockIndex) => (
              <div key={blockIndex} className="border border-slate-700 rounded-lg overflow-hidden">
                {/* Block Header */}
                <button
                  onClick={() => toggleBlock(blockIndex)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900/70 transition-colors"
                >
                  {expandedBlocks.has(blockIndex) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-400">{blockIndex + 1}</span>
                  </div>
                  <span className="font-medium text-slate-200">{block.title}</span>
                  {block.duration && (
                    <Badge variant="outline" className="ml-auto border-slate-600 text-slate-400">
                      {block.duration}
                    </Badge>
                  )}
                </button>

                {/* Block Content */}
                {expandedBlocks.has(blockIndex) && (
                  <div className="p-3 space-y-2 bg-slate-900/30">
                    {block.description && (
                      <p className="text-sm text-slate-400 mb-3">{block.description}</p>
                    )}
                    
                    {block.sections.map((section, sectionIndex) => {
                      const sectionKey = `${blockIndex}-${sectionIndex}`;
                      return (
                        <div key={sectionIndex} className="border border-slate-700/50 rounded-lg overflow-hidden">
                          {/* Section Header */}
                          <button
                            onClick={() => toggleSection(sectionKey)}
                            className="w-full flex items-center gap-3 p-2 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
                          >
                            {expandedSections.has(sectionKey) ? (
                              <ChevronDown className="w-3 h-3 text-slate-500" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-500" />
                            )}
                            <FolderOpen className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-slate-300">{section.title}</span>
                            <Badge variant="outline" className="ml-auto border-slate-600 text-xs">
                              {section.tasks.length} задач
                            </Badge>
                          </button>

                          {/* Section Tasks */}
                          {expandedSections.has(sectionKey) && (
                            <div className="p-2 space-y-1 bg-slate-900/20">
                              {section.tasks.map((task, taskIndex) => (
                                <div 
                                  key={taskIndex}
                                  className="flex items-center gap-2 p-2 rounded bg-slate-800/30"
                                >
                                  <CheckSquare className="w-3 h-3 text-slate-500" />
                                  <span className="text-sm text-slate-400 flex-1">{task.title}</span>
                                  {task.priority && (
                                    <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Use Template Button */}
      {onUseTemplate && (
        <div className="flex justify-end">
          <Button
            onClick={() => onUseTemplate(variableValues)}
            disabled={isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isLoading ? 'Создание...' : 'Использовать шаблон'}
          </Button>
        </div>
      )}
    </div>
  );
}
