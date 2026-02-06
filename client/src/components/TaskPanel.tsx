import { useRoadmap } from '@/contexts/RoadmapContext';
import { Task } from '@/data/roadmapData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  X, Check, Clock, Circle, Save, FileText, 
  ChevronDown, ChevronRight, Sparkles, Tag
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TagSelector } from './TagSelector';

interface TaskPanelProps {
  task: Task;
  onClose: () => void;
}

// Helper to extract numeric ID from string task ID (e.g., "task-1-1-1" -> 111)
function getNumericTaskId(taskId: string): number {
  // Try to extract numbers from the task ID
  const numbers = taskId.replace(/\D/g, '');
  if (numbers) {
    return parseInt(numbers, 10);
  }
  // Fallback: hash the string to get a consistent number
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function TaskPanel({ task, onClose }: TaskPanelProps) {
  const { updateTaskStatus, updateTaskNotes, updateTaskSummary } = useRoadmap();
  const [notes, setNotes] = useState(task.notes);
  const [summary, setSummary] = useState(task.summary);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Get numeric task ID for tag operations
  const numericTaskId = getNumericTaskId(task.id);

  useEffect(() => {
    setNotes(task.notes);
    setSummary(task.summary);
    setHasChanges(false);
  }, [task.id, task.notes, task.summary]);

  useEffect(() => {
    const changed = notes !== task.notes || summary !== task.summary;
    setHasChanges(changed);
  }, [notes, summary, task.notes, task.summary]);

  const handleSave = () => {
    updateTaskNotes(task.id, notes);
    updateTaskSummary(task.id, summary);
    setHasChanges(false);
    toast.success('Изменения сохранены');
  };

  const handleStatusChange = (newStatus: Task['status']) => {
    updateTaskStatus(task.id, newStatus);
    if (newStatus === 'completed') {
      toast.success('Задача отмечена как готовая!', {
        icon: <Check className="w-4 h-4 text-emerald-500" />,
      });
    }
  };

  const toggleSubtask = (subtaskId: string) => {
    const newExpanded = new Set(expandedSubtasks);
    if (newExpanded.has(subtaskId)) {
      newExpanded.delete(subtaskId);
    } else {
      newExpanded.add(subtaskId);
    }
    setExpandedSubtasks(newExpanded);
  };

  const getStatusConfig = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return { 
          label: 'Готов', 
          icon: Check, 
          className: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
        };
      case 'in_progress':
        return { 
          label: 'В работе', 
          icon: Clock, 
          className: 'bg-amber-100 text-amber-700 border-amber-200' 
        };
      default:
        return { 
          label: 'Не начато', 
          icon: Circle, 
          className: 'bg-slate-100 text-slate-600 border-slate-200' 
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="h-full flex flex-col bg-card md:border-l border-border animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-mono font-semibold text-lg text-foreground leading-tight">
            {task.title}
          </h2>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Selection */}
      <div className="p-4 border-b border-border">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Статус задачи
        </label>
        <div className="flex gap-2">
          {(['not_started', 'in_progress', 'completed'] as const).map((status) => {
            const config = getStatusConfig(status);
            const Icon = config.icon;
            const isActive = task.status === status;
            
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-lg border transition-all duration-200 text-sm",
                  isActive 
                    ? config.className + " ring-2 ring-offset-2 ring-current/20"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && status === 'completed' && "animate-check-bounce")} />
                <span className="text-sm font-medium">{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags Section */}
      <div className="p-4 border-b border-border">
        <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Теги
        </label>
        <TagSelector taskId={numericTaskId} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6">
        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Подзадачи ({task.subtasks.filter(st => st.status === 'completed').length}/{task.subtasks.length})
            </label>
            <div className="space-y-2">
              {task.subtasks.map((subtask) => {
                const subConfig = getStatusConfig(subtask.status);
                const isExpanded = expandedSubtasks.has(subtask.id);
                
                return (
                  <SubtaskItem 
                    key={subtask.id}
                    subtask={subtask}
                    isExpanded={isExpanded}
                    onToggle={() => toggleSubtask(subtask.id)}
                    statusConfig={subConfig}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Заметки и обсуждение
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Добавьте заметки, детали обсуждения, ссылки на документы..."
            className="min-h-[150px] resize-none"
          />
        </div>

        {/* Summary */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Итоговый документ
          </label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Запишите итоговые выводы, решения, результаты работы над задачей..."
            className="min-h-[150px] resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusConfig.className}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>
          {hasChanges && (
            <span className="text-xs text-amber-600">Есть несохраненные изменения</span>
          )}
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          Сохранить
        </Button>
      </div>
    </div>
  );
}

interface SubtaskItemProps {
  subtask: Task;
  isExpanded: boolean;
  onToggle: () => void;
  statusConfig: ReturnType<typeof getStatusConfig>;
}

function getStatusConfig(status: Task['status']) {
  switch (status) {
    case 'completed':
      return { 
        label: 'Готов', 
        icon: Check, 
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200' 
      };
    case 'in_progress':
      return { 
        label: 'В работе', 
        icon: Clock, 
        className: 'bg-amber-100 text-amber-700 border-amber-200' 
      };
    default:
      return { 
        label: 'Не начато', 
        icon: Circle, 
        className: 'bg-slate-100 text-slate-600 border-slate-200' 
      };
  }
}

function SubtaskItem({ subtask, isExpanded, onToggle, statusConfig }: SubtaskItemProps) {
  const { updateTaskStatus, updateTaskNotes, updateTaskSummary } = useRoadmap();
  const [notes, setNotes] = useState(subtask.notes);
  const [summary, setSummary] = useState(subtask.summary);
  const StatusIcon = statusConfig.icon;

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = subtask.status === 'completed' ? 'not_started' : 'completed';
    updateTaskStatus(subtask.id, newStatus);
  };

  const handleSave = () => {
    updateTaskNotes(subtask.id, notes);
    updateTaskSummary(subtask.id, summary);
    toast.success('Подзадача сохранена');
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
      >
        <button
          onClick={handleStatusToggle}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            subtask.status === 'completed'
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 hover:border-slate-400"
          )}
        >
          {subtask.status === 'completed' && <Check className="w-3 h-3" />}
        </button>
        
        <span className={cn(
          "flex-1 text-sm text-left",
          subtask.status === 'completed' && "line-through text-muted-foreground"
        )}>
          {subtask.title}
        </span>
        
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-border bg-muted/30 animate-slide-in">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Заметки</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Заметки по подзадаче..."
              className="min-h-[80px] text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Итог</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Итоговый результат..."
              className="min-h-[60px] text-sm"
            />
          </div>
          <Button size="sm" onClick={handleSave} className="w-full">
            <Save className="w-3 h-3 mr-1" />
            Сохранить
          </Button>
        </div>
      )}
    </div>
  );
}
