import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, 
  Plus, 
  X, 
  Split, 
  Merge, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Trash2,
  CheckCircle2
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  sectionId: number;
  status: string | null;
}

interface Section {
  id: number;
  title: string;
  blockId: number;
  tasks: Task[];
}

// ============ SPLIT TASK DIALOG ============
interface SplitTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSuccess: () => void;
}

export function SplitTaskDialog({ open, onOpenChange, task, onSuccess }: SplitTaskDialogProps) {
  const [subtaskTitles, setSubtaskTitles] = useState<string[]>(["", ""]);

  const splitMutation = trpc.task.split.useMutation({
    onSuccess: () => {
      toast.success("Задача разделена на подзадачи");
      onOpenChange(false);
      setSubtaskTitles(["", ""]);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const addSubtask = () => {
    setSubtaskTitles([...subtaskTitles, ""]);
  };

  const removeSubtask = (index: number) => {
    if (subtaskTitles.length > 2) {
      setSubtaskTitles(subtaskTitles.filter((_, i) => i !== index));
    }
  };

  const updateSubtask = (index: number, value: string) => {
    const newTitles = [...subtaskTitles];
    newTitles[index] = value;
    setSubtaskTitles(newTitles);
  };

  const handleSplit = () => {
    if (!task) return;
    const validTitles = subtaskTitles.filter(t => t.trim());
    if (validTitles.length < 1) {
      toast.error("Добавьте хотя бы одну подзадачу");
      return;
    }
    splitMutation.mutate({
      taskId: task.id,
      subtaskTitles: validTitles,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="w-5 h-5 text-amber-400" />
            Разделить задачу
          </DialogTitle>
          <DialogDescription>
            {task?.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label>Подзадачи</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {subtaskTitles.map((title, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={title}
                  onChange={(e) => updateSubtask(index, e.target.value)}
                  placeholder={`Подзадача ${index + 1}`}
                />
                {subtaskTitles.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubtask(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addSubtask} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Добавить подзадачу
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleSplit}
            disabled={splitMutation.isPending}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {splitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Разделить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MERGE TASKS DIALOG ============
interface MergeTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section | null;
  onSuccess: () => void;
}

export function MergeTasksDialog({ open, onOpenChange, section, onSuccess }: MergeTasksDialogProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [newTitle, setNewTitle] = useState("");

  const mergeMutation = trpc.task.merge.useMutation({
    onSuccess: () => {
      toast.success("Задачи объединены");
      onOpenChange(false);
      setSelectedTaskIds([]);
      setNewTitle("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleTask = (taskId: number) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleMerge = () => {
    if (!section || selectedTaskIds.length < 2) {
      toast.error("Выберите минимум 2 задачи");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Введите название новой задачи");
      return;
    }
    mergeMutation.mutate({
      taskIds: selectedTaskIds,
      newTitle: newTitle.trim(),
      sectionId: section.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-emerald-400" />
            Объединить задачи
          </DialogTitle>
          <DialogDescription>
            Выберите задачи для объединения в разделе "{section?.title}"
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Название новой задачи</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Введите название..."
            />
          </div>
          <div className="space-y-2">
            <Label>Выберите задачи ({selectedTaskIds.length} выбрано)</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
              {section?.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => toggleTask(task.id)}
                >
                  <Checkbox
                    checked={selectedTaskIds.includes(task.id)}
                    onCheckedChange={() => toggleTask(task.id)}
                  />
                  <span className="text-sm">{task.title}</span>
                </div>
              ))}
              {(!section?.tasks || section.tasks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Нет задач в этом разделе
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleMerge}
            disabled={mergeMutation.isPending || selectedTaskIds.length < 2}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {mergeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Объединить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CONVERT TASK TO SECTION DIALOG ============
interface ConvertTaskToSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSuccess: () => void;
}

export function ConvertTaskToSectionDialog({ open, onOpenChange, task, onSuccess }: ConvertTaskToSectionDialogProps) {
  const convertMutation = trpc.task.convertToSection.useMutation({
    onSuccess: () => {
      toast.success("Задача преобразована в раздел");
      onOpenChange(false);
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConvert = () => {
    if (!task) return;
    convertMutation.mutate({ taskId: task.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-blue-400" />
            Преобразовать в раздел
          </DialogTitle>
          <DialogDescription>
            Задача "{task?.title}" будет преобразована в раздел. 
            Все подзадачи станут задачами нового раздела.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleConvert}
            disabled={convertMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {convertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Преобразовать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CONVERT SECTION TO TASK DIALOG ============
interface ConvertSectionToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section | null;
  sections: Section[];
  onSuccess: () => void;
}

export function ConvertSectionToTaskDialog({ 
  open, 
  onOpenChange, 
  section, 
  sections,
  onSuccess 
}: ConvertSectionToTaskDialogProps) {
  const [targetSectionId, setTargetSectionId] = useState<string>("");

  const convertMutation = trpc.section.convertToTask.useMutation({
    onSuccess: () => {
      toast.success("Раздел преобразован в задачу");
      onOpenChange(false);
      setTargetSectionId("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleConvert = () => {
    if (!section || !targetSectionId) {
      toast.error("Выберите целевой раздел");
      return;
    }
    convertMutation.mutate({ 
      sectionId: section.id, 
      targetSectionId: parseInt(targetSectionId) 
    });
  };

  // Filter out the current section from targets
  const availableSections = sections.filter(s => s.id !== section?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-purple-400" />
            Преобразовать в задачу
          </DialogTitle>
          <DialogDescription>
            Раздел "{section?.title}" будет преобразован в задачу. 
            Все задачи раздела станут подзадачами.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Целевой раздел</Label>
            <Select value={targetSectionId} onValueChange={setTargetSectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите раздел..." />
              </SelectTrigger>
              <SelectContent>
                {availableSections.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleConvert}
            disabled={convertMutation.isPending || !targetSectionId}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {convertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Преобразовать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ BULK ACTIONS DIALOG ============
interface BulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTaskIds: number[];
  onSuccess: () => void;
  onClearSelection: () => void;
}

export function BulkActionsDialog({ 
  open, 
  onOpenChange, 
  selectedTaskIds, 
  onSuccess,
  onClearSelection
}: BulkActionsDialogProps) {
  const [action, setAction] = useState<"status" | "delete" | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const bulkStatusMutation = trpc.task.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Обновлено ${data.updated} задач`);
      onOpenChange(false);
      setAction(null);
      setNewStatus("");
      onClearSelection();
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkDeleteMutation = trpc.task.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`Удалено ${data.deleted} задач`);
      onOpenChange(false);
      setAction(null);
      onClearSelection();
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBulkStatus = () => {
    if (!newStatus) {
      toast.error("Выберите статус");
      return;
    }
    bulkStatusMutation.mutate({
      taskIds: selectedTaskIds,
      status: newStatus as "not_started" | "in_progress" | "completed",
    });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate({ taskIds: selectedTaskIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Массовые действия</DialogTitle>
          <DialogDescription>
            Выбрано {selectedTaskIds.length} задач
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!action && (
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => setAction("status")}
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>Изменить статус</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 hover:border-red-500"
                onClick={() => setAction("delete")}
              >
                <Trash2 className="w-6 h-6 text-red-400" />
                <span>Удалить</span>
              </Button>
            </div>
          )}

          {action === "status" && (
            <div className="space-y-4">
              <Label>Новый статус</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Не начато</SelectItem>
                  <SelectItem value="in_progress">В процессе</SelectItem>
                  <SelectItem value="completed">Завершено</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAction(null)}>
                  Назад
                </Button>
                <Button 
                  onClick={handleBulkStatus}
                  disabled={bulkStatusMutation.isPending || !newStatus}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  {bulkStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Применить
                </Button>
              </div>
            </div>
          )}

          {action === "delete" && (
            <div className="space-y-4">
              <p className="text-sm text-red-400">
                Вы уверены, что хотите удалить {selectedTaskIds.length} задач? 
                Это действие нельзя отменить.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAction(null)}>
                  Назад
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex-1"
                >
                  {bulkDeleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Удалить
                </Button>
              </div>
            </div>
          )}
        </div>
        {!action && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
