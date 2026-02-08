/**
 * CreateEntityDialogs - Dialogs for creating blocks, sections, and tasks
 * Extracted from ProjectView.tsx
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

interface CreateBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleRu: string;
  onTitleChange: (title: string) => void;
  onTitleRuChange: (titleRu: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  showTrigger?: boolean;
}

export function CreateBlockDialog({
  open,
  onOpenChange,
  title,
  titleRu,
  onTitleChange,
  onTitleRuChange,
  onSubmit,
  isPending,
  showTrigger = true,
}: CreateBlockDialogProps) {
  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Введите название');
      return;
    }
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300">
            <Plus className="w-4 h-4 mr-2" />
            Добавить блок
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Новый блок</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Название</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Research & Analysis"
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Название (RU)</Label>
            <Input
              value={titleRu}
              onChange={(e) => onTitleRuChange(e.target.value)}
              placeholder="Исследование и анализ"
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Создать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreateSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CreateSectionDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  onSubmit,
  isPending,
}: CreateSectionDialogProps) {
  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Введите название');
      return;
    }
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Новый раздел</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Название</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Название раздела"
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Создать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSubmit,
  isPending,
}: CreateTaskDialogProps) {
  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Введите название');
      return;
    }
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Новая задача</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Название</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Название задачи"
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Описание (опционально)</Label>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Описание задачи..."
              className="bg-slate-900 border-slate-600 text-white min-h-[80px]"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Paperclip className="w-3.5 h-3.5" />
            <span>Файлы можно прикрепить после создания задачи</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Создать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
