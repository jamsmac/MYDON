/**
 * TaskDetailPanel - Full task detail view with editing, AI chat, dependencies
 * Extracted from ProjectView.tsx
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X,
  Sparkles,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  Save,
  MessageSquare,
  Calendar,
  FileText,
  Settings,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Streamdown } from 'streamdown';

import { TASK_STATUS_OPTIONS, getStatusOption } from '@/constants/projectConstants';
import { PrioritySelector } from '@/components/PriorityBadge';
import { TaskDeadlineBadge } from '@/components/TaskDeadlineBadge';
import { AIDependencySuggestions } from '@/components/AIDependencySuggestions';
import { QuickActionsBar } from '@/components/QuickActionsBar';
import { EntityAIChat } from '@/components/EntityAIChat';
import CustomFieldsForm from '@/components/CustomFieldsForm';
import { TaskAIPanel } from '@/components/TaskAIPanel';
import { TaskComments } from '@/components/TaskComments';
import { SubtasksChecklist } from '@/components/SubtasksChecklist';
import { AttachmentsPanel } from '@/components/attachments';

// ============ SUBTASKS SECTION ============
function SubtasksSection({ taskId }: { taskId: number }) {
  const utils = trpc.useUtils();

  // Fetch subtasks for this task
  const { data: subtasks = [], isLoading } = trpc.subtask.list.useQuery({ taskId });

  // Mutations
  const createSubtask = trpc.subtask.create.useMutation({
    onSuccess: () => {
      utils.subtask.list.invalidate({ taskId });
    },
  });

  const updateSubtask = trpc.subtask.update.useMutation({
    onSuccess: () => {
      utils.subtask.list.invalidate({ taskId });
    },
  });

  const deleteSubtask = trpc.subtask.delete.useMutation({
    onSuccess: () => {
      utils.subtask.list.invalidate({ taskId });
    },
  });

  const reorderSubtasks = trpc.subtask.reorder.useMutation({
    onSuccess: () => {
      utils.subtask.list.invalidate({ taskId });
    },
  });

  return (
    <SubtasksChecklist
      taskId={taskId}
      subtasks={subtasks.map((s, index) => ({
        id: s.id,
        title: s.title,
        status: s.status as 'not_started' | 'in_progress' | 'completed',
        sortOrder: s.sortOrder ?? index,
      }))}
      onCreateSubtask={(title) => createSubtask.mutate({ taskId, title })}
      onUpdateSubtask={(id, data) => updateSubtask.mutate({ id, ...data })}
      onDeleteSubtask={(id) => deleteSubtask.mutate({ id })}
      onReorderSubtasks={(subtaskIds) => reorderSubtasks.mutate({ taskId, subtaskIds })}
      onRefresh={() => utils.subtask.list.invalidate({ taskId })}
      isLoading={isLoading || createSubtask.isPending || updateSubtask.isPending || deleteSubtask.isPending}
    />
  );
}

// ============ TYPES ============
export interface TaskDetailData {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  notes?: string | null;
  summary?: string | null;
  deadline?: Date | string | null;
  dependencies?: number[] | null;
}

export interface TaskUpdateData {
  status?: 'not_started' | 'in_progress' | 'completed';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  notes?: string;
  summary?: string;
  deadline?: number | null;
  dependencies?: number[] | null;
}

export interface TaskDetailPanelProps {
  task: TaskDetailData;
  projectId: number;
  allTasks: { id: number; title: string; status: string | null }[];
  onClose: () => void;
  onUpdate: (data: TaskUpdateData) => void;
  onSaveNote: (content: string) => void;
  onSaveDocument: (content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: { userId: number; userName: string }[];
}

// ============ MAIN COMPONENT ============
export function TaskDetailPanel({
  task,
  projectId,
  allTasks,
  onClose,
  onUpdate,
  onSaveNote,
  onSaveDocument,
  onTypingStart,
  onTypingStop,
  typingUsers,
}: TaskDetailPanelProps) {
  const [notes, setNotes] = useState(task.notes || '');
  const [summary, setSummary] = useState(task.summary || '');
  const [isEditing, setIsEditing] = useState(false);

  // Confirmation dialog state for save-as-document
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingDocContent, setPendingDocContent] = useState<string | null>(null);

  const handleSaveAsDocument = (content: string) => {
    // If summary already exists, show confirmation dialog
    if (summary && summary.trim().length > 0) {
      setPendingDocContent(content);
      setShowOverwriteDialog(true);
    } else {
      // No existing document — save directly
      setSummary(content);
      onUpdate({ summary: content });
      toast.success('Сохранено как итоговый документ');
    }
  };

  const handleOverwrite = () => {
    if (pendingDocContent) {
      setSummary(pendingDocContent);
      onUpdate({ summary: pendingDocContent });
      toast.success('Итоговый документ заменён');
    }
    setShowOverwriteDialog(false);
    setPendingDocContent(null);
  };

  const handleAppend = () => {
    if (pendingDocContent) {
      const appended = `${summary}\n\n---\n\n${pendingDocContent}`;
      setSummary(appended);
      onUpdate({ summary: appended });
      toast.success('Добавлено к итоговому документу');
    }
    setShowOverwriteDialog(false);
    setPendingDocContent(null);
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteDialog(false);
    setPendingDocContent(null);
  };

  // Build rich context string for AI chat
  const taskContext = useMemo(() => {
    const statusMap: Record<string, string> = {
      not_started: 'Не начата',
      in_progress: 'В работе',
      completed: 'Завершена',
    };
    const priorityMap: Record<string, string> = {
      critical: 'Критический',
      high: 'Высокий',
      medium: 'Средний',
      low: 'Низкий',
    };

    const parts: string[] = [];
    parts.push(`Задача: "${task.title}"`);
    if (task.description) parts.push(`Описание: ${task.description}`);
    parts.push(`Статус: ${statusMap[task.status || ''] || task.status || 'Не указан'}`);
    parts.push(`Приоритет: ${priorityMap[task.priority || ''] || task.priority || 'Не указан'}`);

    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      const now = new Date();
      const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const deadlineStr = deadlineDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      const urgency = diffDays < 0 ? `(просрочена на ${Math.abs(diffDays)} дн.)` : diffDays <= 3 ? `(осталось ${diffDays} дн., срочно!)` : `(осталось ${diffDays} дн.)`;
      parts.push(`Дедлайн: ${deadlineStr} ${urgency}`);
    } else {
      parts.push('Дедлайн: Не установлен');
    }

    if (task.dependencies && task.dependencies.length > 0) {
      const depNames = task.dependencies.map(depId => {
        const depTask = allTasks.find(t => t.id === depId);
        if (!depTask) return `#${depId}`;
        const depStatus = statusMap[depTask.status || ''] || depTask.status || '?';
        return `"${depTask.title}" (${depStatus})`;
      });
      parts.push(`Зависимости (блокирующие задачи): ${depNames.join(', ')}`);
    } else {
      parts.push('Зависимости: Нет');
    }

    if (notes) {
      const truncatedNotes = notes.length > 500 ? notes.slice(0, 500) + '...' : notes;
      parts.push(`Заметки: ${truncatedNotes}`);
    }

    return parts.join('\n');
  }, [task.id, task.title, task.description, task.status, task.priority, task.deadline, task.dependencies, allTasks, notes]);

  const handleSave = () => {
    onUpdate({ notes, summary });
    setIsEditing(false);
    toast.success('Сохранено');
  };

  const currentStatus = getStatusOption(task.status);

  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white truncate flex-1">{task.title}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAiPanelOpen(true)}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            aria-label="Открыть AI ассистент"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400"
            aria-label="Закрыть панель задачи"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Status */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Статус</Label>
            <div className="flex gap-2">
              {TASK_STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant={task.status === option.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      task.status === option.value
                        ? "bg-slate-700 text-white"
                        : "border-slate-600 text-slate-400"
                    )}
                    onClick={() => onUpdate({ status: option.value })}
                  >
                    <Icon className={cn("w-4 h-4 mr-1", option.color)} />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Приоритет</Label>
            <PrioritySelector
              value={task.priority}
              onChange={(priority) => onUpdate({ priority })}
            />
          </div>

          {/* Deadline */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Дедлайн</Label>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal border-slate-600",
                      !task.deadline && "text-slate-500"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {task.deadline ? (
                      format(new Date(task.deadline), "d MMMM yyyy", { locale: ru })
                    ) : (
                      "Выбрать дату"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={task.deadline ? new Date(task.deadline) : undefined}
                    onSelect={(date) => onUpdate({ deadline: date ? date.getTime() : null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {task.deadline && (
                <>
                  <TaskDeadlineBadge deadline={task.deadline} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-red-400"
                    onClick={() => onUpdate({ deadline: null })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Зависимости (блокирующие задачи)</Label>
            <div className="space-y-2">
              {task.dependencies && task.dependencies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.dependencies.map((depId) => {
                    const depTask = allTasks.find(t => t.id === depId);
                    if (!depTask) return null;
                    const isCompleted = depTask.status === 'completed';
                    return (
                      <div
                        key={depId}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded-lg border text-sm",
                          isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span className="truncate max-w-[150px]">{depTask.title}</span>
                        <button
                          onClick={() => {
                            const newDeps = task.dependencies?.filter(id => id !== depId) || [];
                            onUpdate({ dependencies: newDeps.length > 0 ? newDeps : null });
                          }}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">Нет зависимостей</p>
              )}

              {/* Add dependency dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-400">
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить зависимость
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-700 max-h-[300px] overflow-y-auto">
                  {allTasks
                    .filter(t => t.id !== task.id && !task.dependencies?.includes(t.id))
                    .map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => {
                          const newDeps = [...(task.dependencies || []), t.id];
                          onUpdate({ dependencies: newDeps });
                        }}
                        className="text-slate-300 hover:bg-slate-700"
                      >
                        <span className={cn(
                          "w-2 h-2 rounded-full mr-2",
                          t.status === 'completed' ? "bg-emerald-500" : "bg-slate-500"
                        )} />
                        <span className="truncate">{t.title}</span>
                      </DropdownMenuItem>
                    ))}
                  {allTasks.filter(t => t.id !== task.id && !task.dependencies?.includes(t.id)).length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-slate-500">Нет доступных задач</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* AI Dependency Suggestions */}
              <AIDependencySuggestions
                projectId={projectId}
                taskId={task.id}
                taskTitle={task.title}
                taskDescription={task.description || undefined}
                currentDependencies={task.dependencies || []}
                onAddDependency={(depId) => {
                  const newDeps = [...(task.dependencies || []), depId];
                  onUpdate({ dependencies: newDeps });
                }}
              />
            </div>
          </div>

          {/* AI Quick Actions */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Быстрые действия AI
            </Label>
            <QuickActionsBar
              entityType="task"
              entityId={task.id}
              projectId={projectId}
              compact
              onInsertResult={(content) => {
                const newNotes = notes ? `${notes}\n\n---\n\n${content}` : content;
                setNotes(newNotes);
                onUpdate({ notes: newNotes });
                toast.success('Результат добавлен в заметки');
              }}
            />
          </div>

          {/* AI Chat */}
          <EntityAIChat
            entityType="task"
            entityId={task.id}
            entityTitle={task.title}
            projectId={projectId}
            defaultExpanded={false}
            entityContext={taskContext}
            onInsertResult={(content) => {
              const newNotes = notes ? `${notes}\n\n---\n\n${content}` : content;
              setNotes(newNotes);
              onUpdate({ notes: newNotes });
              toast.success('Результат добавлен в заметки');
            }}
            onSaveAsDocument={handleSaveAsDocument}
          />

          {/* Custom Fields */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Кастомные поля
            </Label>
            <CustomFieldsForm projectId={projectId} taskId={task.id} />
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <Label className="text-slate-400 text-xs mb-2 block">Описание</Label>
              <p className="text-slate-300 text-sm">{task.description}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-slate-400 text-xs">Заметки</Label>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-slate-400 h-6"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Редактировать
                </Button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Добавьте заметки..."
                  className="bg-slate-900 border-slate-600 text-white min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                    <Save className="w-3 h-3 mr-1" />
                    Сохранить
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="border-slate-600">
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 rounded-lg p-3 min-h-[60px]">
                {notes ? (
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{notes}</p>
                ) : (
                  <p className="text-slate-500 text-sm italic">Нет заметок</p>
                )}
              </div>
            )}
          </div>

          {/* Summary/Document */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Итоговый документ</Label>
            <div className="bg-slate-900/50 rounded-lg p-3 min-h-[60px]">
              {summary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{summary}</Streamdown>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">Нет итогового документа. Используйте AI чат и сохраните ответ как документ.</p>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Вложения
            </Label>
            <AttachmentsPanel entityType="task" entityId={task.id} projectId={projectId} />
          </div>

          {/* Subtasks Section */}
          <SubtasksSection taskId={task.id} />

          {/* Comments Section */}
          <div>
            <Label className="text-slate-400 text-xs mb-3 block flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Комментарии
            </Label>
            <TaskComments
              taskId={task.id}
              projectId={projectId}
              onTypingStart={onTypingStart}
              onTypingStop={onTypingStop}
              typingUsers={typingUsers}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Task AI Panel */}
      <TaskAIPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        taskId={task.id}
        taskTitle={task.title}
        taskDescription={task.description}
        taskStatus={task.status}
        taskPriority={task.priority}
        projectId={projectId}
        projectName=""
        onAddToDescription={(content) => {
          const newNotes = notes ? notes + '\n\n' + content : content;
          setNotes(newNotes);
          onUpdate({ notes: newNotes });
          toast.success('Добавлено в заметки');
        }}
        onCreateSubtask={(title) => {
          toast.info(`Подзадача: ${title}`);
        }}
        onFinalize={(content) => {
          const newSummary = content.slice(0, 500);
          setSummary(newSummary);
          onUpdate({ summary: newSummary });
          toast.success('Финализировано');
        }}
      />

      {/* Confirmation dialog for overwriting existing summary document */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Итоговый документ уже существует
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              У этой задачи уже есть итоговый документ. Что вы хотите сделать?
            </AlertDialogDescription>
            {summary && (
              <div className="mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700 max-h-[120px] overflow-y-auto">
                <p className="text-xs text-slate-500 mb-1">Текущий документ:</p>
                <p className="text-xs text-slate-300 line-clamp-4">{summary}</p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={handleCancelOverwrite}
              className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-200"
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAppend}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Дополнить
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleOverwrite}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Заменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
