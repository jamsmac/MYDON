import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  FileStack, 
  Plus, 
  Save, 
  Trash2, 
  ChevronDown,
  Folder,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface SubtaskTemplateItem {
  id: number;
  templateId: number;
  title: string;
  sortOrder: number | null;
  createdAt: Date;
}

interface SubtaskTemplate {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  category: string | null;
  isPublic: boolean | null;
  usageCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  items: SubtaskTemplateItem[];
}

interface SubtaskTemplateSelectorProps {
  taskId: number;
  currentSubtasks: { title: string }[];
  onApplyTemplate: () => void;
}

const TEMPLATE_CATEGORIES = [
  { value: 'development', label: 'Разработка', icon: '💻' },
  { value: 'design', label: 'Дизайн', icon: '🎨' },
  { value: 'marketing', label: 'Маркетинг', icon: '📢' },
  { value: 'research', label: 'Исследование', icon: '🔍' },
  { value: 'testing', label: 'Тестирование', icon: '🧪' },
  { value: 'documentation', label: 'Документация', icon: '📝' },
  { value: 'other', label: 'Другое', icon: '📁' },
];

export function SubtaskTemplateSelector({ 
  taskId, 
  currentSubtasks,
  onApplyTemplate 
}: SubtaskTemplateSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');

  const utils = trpc.useUtils();

  const { data: templates = [], isLoading } = trpc.subtask.listTemplates.useQuery();

  const applyTemplateMutation = trpc.subtask.applyTemplate.useMutation({
    onSuccess: () => {
      toast.success('Шаблон применён');
      onApplyTemplate();
      utils.subtask.list.invalidate({ taskId });
    },
    onError: (error) => {
      toast.error('Ошибка применения шаблона: ' + error.message);
    },
  });

  const saveAsTemplateMutation = trpc.subtask.saveAsTemplate.useMutation({
    onSuccess: () => {
      toast.success('Шаблон сохранён');
      setSaveDialogOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateCategory('');
      utils.subtask.listTemplates.invalidate();
    },
    onError: (error) => {
      toast.error('Ошибка сохранения шаблона: ' + error.message);
    },
  });

  const deleteTemplateMutation = trpc.subtask.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Шаблон удалён');
      utils.subtask.listTemplates.invalidate();
    },
    onError: (error) => {
      toast.error('Ошибка удаления шаблона: ' + error.message);
    },
  });

  const handleApplyTemplate = (templateId: number) => {
    applyTemplateMutation.mutate({ templateId, taskId });
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }
    if (currentSubtasks.length === 0) {
      toast.error('Нет подзадач для сохранения');
      return;
    }
    saveAsTemplateMutation.mutate({
      taskId,
      name: templateName.trim(),
      description: templateDescription.trim() || undefined,
      category: templateCategory || undefined,
    });
  };

  const handleDeleteTemplate = (templateId: number) => {
    if (confirm('Удалить этот шаблон?')) {
      deleteTemplateMutation.mutate({ templateId });
    }
  };

  const getCategoryIcon = (category: string | null) => {
    const cat = TEMPLATE_CATEGORIES.find(c => c.value === category);
    return cat?.icon || '📁';
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const cat = template.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, SubtaskTemplate[]>);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileStack className="w-4 h-4" />
            Шаблоны
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            Шаблоны подзадач
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {isLoading ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Загрузка...
            </div>
          ) : templates.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Нет сохранённых шаблонов
            </div>
          ) : (
            Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
              <div key={category}>
                <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                  <span>{getCategoryIcon(category)}</span>
                  {TEMPLATE_CATEGORIES.find(c => c.value === category)?.label || 'Другое'}
                </DropdownMenuLabel>
                {categoryTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{template.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {template.items.length} пунктов
                        </span>
                        {(template.usageCount ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {template.usageCount}×
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))
          )}
          
          <DropdownMenuSeparator />
          
          {currentSubtasks.length > 0 && (
            <DropdownMenuItem onClick={() => setSaveDialogOpen(true)} className="cursor-pointer">
              <Save className="w-4 h-4 mr-2" />
              Сохранить как шаблон
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={() => setManageDialogOpen(true)} className="cursor-pointer">
            <Folder className="w-4 h-4 mr-2" />
            Управление шаблонами
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save as Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить как шаблон</DialogTitle>
            <DialogDescription>
              Сохраните текущие подзадачи ({currentSubtasks.length} шт.) как шаблон для повторного использования.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Название шаблона *</Label>
              <Input
                id="template-name"
                placeholder="Например: Чеклист код-ревью"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template-category">Категория</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template-description">Описание</Label>
              <Textarea
                id="template-description"
                placeholder="Краткое описание шаблона..."
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={2}
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Подзадачи в шаблоне:</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {currentSubtasks.slice(0, 5).map((subtask, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="truncate">{subtask.title}</span>
                  </li>
                ))}
                {currentSubtasks.length > 5 && (
                  <li className="text-xs">...и ещё {currentSubtasks.length - 5}</li>
                )}
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSaveAsTemplate}
              disabled={saveAsTemplateMutation.isPending}
            >
              {saveAsTemplateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Templates Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Управление шаблонами</DialogTitle>
            <DialogDescription>
              Просмотр и удаление сохранённых шаблонов подзадач.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileStack className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Нет сохранённых шаблонов</p>
                <p className="text-sm">Сохраните подзадачи как шаблон для повторного использования</p>
              </div>
            ) : (
              templates.map((template) => (
                <div 
                  key={template.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="text-2xl">{getCategoryIcon(template.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {template.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span>{template.items.length} пунктов</span>
                      <span>Использован {template.usageCount ?? 0} раз</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {template.items.slice(0, 3).map(item => item.title).join(', ')}
                      {template.items.length > 3 && '...'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
