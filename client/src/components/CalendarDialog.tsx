import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Loader2, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  tasks?: Array<{
    id: number;
    title: string;
    description?: string | null;
  }>;
}

interface Milestone {
  title: string;
  date: string;
  description: string;
}

export function CalendarDialog({ open, onOpenChange, projectId, projectName, tasks = [] }: CalendarDialogProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: '', date: '', description: '' }
  ]);
  const [mode, setMode] = useState<'task' | 'milestones'>('task');

  const createTaskEvent = trpc.calendar.createTaskEvent.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Событие добавлено в Google Calendar', {
          description: 'Дедлайн задачи синхронизирован с календарём',
        });
        onOpenChange(false);
        resetForm();
      } else {
        toast.error('Ошибка создания события', {
          description: result.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const createMilestones = trpc.calendar.createProjectMilestones.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Создано ${result.created} событий в календаре`);
        onOpenChange(false);
        resetForm();
      } else {
        toast.warning(`Создано ${result.created} событий`, {
          description: `Ошибки: ${result.errors.join(', ')}`,
        });
      }
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const resetForm = () => {
    setSelectedTaskId(null);
    setDeadline('');
    setMilestones([{ title: '', date: '', description: '' }]);
  };

  const handleAddTaskEvent = () => {
    if (!selectedTaskId || !deadline) {
      toast.error('Выберите задачу и укажите дату');
      return;
    }

    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    createTaskEvent.mutate({
      taskId: task.id,
      taskTitle: task.title,
      projectName,
      deadline: new Date(deadline),
      description: task.description || undefined,
    });
  };

  const handleAddMilestones = () => {
    const validMilestones = milestones.filter(m => m.title && m.date);
    if (validMilestones.length === 0) {
      toast.error('Добавьте хотя бы одну веху с названием и датой');
      return;
    }

    createMilestones.mutate({
      projectId,
      projectName,
      milestones: validMilestones.map(m => ({
        title: m.title,
        date: new Date(m.date),
        description: m.description || undefined,
      })),
    });
  };

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', date: '', description: '' }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Google Calendar
          </DialogTitle>
          <DialogDescription>
            Добавьте дедлайны задач или вехи проекта в Google Calendar
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'task' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('task')}
            className={mode === 'task' ? 'bg-emerald-600' : ''}
          >
            Дедлайн задачи
          </Button>
          <Button
            variant={mode === 'milestones' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('milestones')}
            className={mode === 'milestones' ? 'bg-emerald-600' : ''}
          >
            Вехи проекта
          </Button>
        </div>

        {mode === 'task' ? (
          <div className="space-y-4">
            <div>
              <Label>Выберите задачу</Label>
              <select
                value={selectedTaskId || ''}
                onChange={(e) => setSelectedTaskId(Number(e.target.value) || null)}
                className="w-full mt-1 p-2 bg-slate-800 border border-slate-600 rounded-md text-white"
              >
                <option value="">-- Выберите задачу --</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Дата дедлайна</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {milestones.map((milestone, index) => (
              <div key={index} className="p-3 bg-slate-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Веха {index + 1}</span>
                  {milestones.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMilestone(index)}
                      className="h-6 w-6 text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Название вехи"
                  value={milestone.title}
                  onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                  className="bg-slate-700 border-slate-600"
                />
                <Input
                  type="date"
                  value={milestone.date}
                  onChange={(e) => updateMilestone(index, 'date', e.target.value)}
                  className="bg-slate-700 border-slate-600"
                />
                <Input
                  placeholder="Описание (опционально)"
                  value={milestone.description}
                  onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addMilestone}
              className="w-full border-dashed border-slate-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить веху
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={mode === 'task' ? handleAddTaskEvent : handleAddMilestones}
            disabled={createTaskEvent.isPending || createMilestones.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {(createTaskEvent.isPending || createMilestones.isPending) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4 mr-2" />
            )}
            Добавить в календарь
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
