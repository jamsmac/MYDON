import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, LayoutTemplate, Users, Layers, ListTodo, Clock, ChevronRight, Sparkles, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

interface TemplateLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateLibrary({ open, onOpenChange }: TemplateLibraryProps) {
  const [, setLocation] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: templates, isLoading } = trpc.template.list.useQuery(undefined, {
    enabled: open,
  });

  const createFromTemplate = trpc.template.createProjectFromTemplate.useMutation({
    onSuccess: (project) => {
      toast.success('Проект создан из шаблона!');
      setShowCreateDialog(false);
      onOpenChange(false);
      setLocation(`/project/${project.id}`);
    },
    onError: (error) => {
      toast.error('Ошибка создания проекта: ' + error.message);
    },
  });

  const handleUseTemplate = (templateId: number, templateName: string) => {
    setSelectedTemplate(templateId);
    setProjectName(templateName);
    setShowCreateDialog(true);
  };

  const handleCreateProject = () => {
    if (!selectedTemplate) return;
    createFromTemplate.mutate({
      templateId: selectedTemplate,
      projectName: projectName || undefined,
    });
  };

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <LayoutTemplate className="h-6 w-6 text-purple-500" />
              Библиотека шаблонов
            </DialogTitle>
            <DialogDescription>
              Выберите готовый шаблон для быстрого старта проекта
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Templates Grid */}
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : filteredTemplates && filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                {filteredTemplates.map((template) => (
                  <Card 
                    key={template.id} 
                    className="group hover:border-purple-500/50 transition-colors cursor-pointer"
                    onClick={() => handleUseTemplate(template.id, template.name)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: template.color || '#8b5cf6' }}
                          >
                            <LayoutTemplate className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
                            {template.authorName && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {template.authorName}
                              </p>
                            )}
                          </div>
                        </div>
                        {template.isPublic && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Публичный
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      {template.description && (
                        <CardDescription className="line-clamp-2 text-sm">
                          {template.description}
                        </CardDescription>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {template.blocksCount || 0} блоков
                        </span>
                        <span className="flex items-center gap-1">
                          <ListTodo className="h-3 w-3" />
                          {template.tasksCount || 0} задач
                        </span>
                        {template.estimatedDuration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {template.estimatedDuration}
                          </span>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button 
                        variant="ghost" 
                        className="w-full group-hover:bg-purple-500/10 group-hover:text-purple-500"
                      >
                        Использовать шаблон
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutTemplate className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'Шаблоны не найдены' : 'Пока нет шаблонов'}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {searchQuery 
                    ? 'Попробуйте изменить поисковый запрос' 
                    : 'Сохраните свой первый проект как шаблон'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <p className="text-xs text-muted-foreground mr-auto">
              {filteredTemplates?.length || 0} шаблонов доступно
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project from Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать проект из шаблона</DialogTitle>
            <DialogDescription>
              Введите название для нового проекта или оставьте по умолчанию
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Название проекта</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Название проекта"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCreateProject}
              disabled={createFromTemplate.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createFromTemplate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать проект'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
