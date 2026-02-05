import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, LayoutTemplate, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
}

export function SaveAsTemplateDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName 
}: SaveAsTemplateDialogProps) {
  const [templateName, setTemplateName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const saveAsTemplate = trpc.template.saveProjectAsTemplate.useMutation({
    onSuccess: () => {
      toast.success('Шаблон успешно сохранён!');
      onOpenChange(false);
      // Reset form
      setTemplateName(projectName);
      setDescription('');
      setIsPublic(false);
    },
    onError: (error) => {
      toast.error('Ошибка сохранения шаблона: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!templateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }
    saveAsTemplate.mutate({
      projectId,
      name: templateName.trim(),
      description: description.trim() || undefined,
      isPublic,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-purple-500" />
            Сохранить как шаблон
          </DialogTitle>
          <DialogDescription>
            Сохраните структуру проекта как шаблон для повторного использования
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Название шаблона *</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Например: Запуск стартапа"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Описание</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите для чего подходит этот шаблон..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isPublic ? 'Публичный шаблон' : 'Приватный шаблон'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPublic 
                    ? 'Другие пользователи смогут использовать этот шаблон' 
                    : 'Только вы сможете использовать этот шаблон'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saveAsTemplate.isPending || !templateName.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {saveAsTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Сохранить шаблон
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
