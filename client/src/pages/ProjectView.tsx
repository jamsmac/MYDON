import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { EntityAIChatStoreProvider } from '@/contexts/EntityAIChatStore';
import { useSocket } from '@/hooks/useSocket';
import { PresenceAvatars } from '@/components/PresenceAvatars';
import { TaskComments } from '@/components/TaskComments';
import { SubtasksChecklist } from '@/components/SubtasksChecklist';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Plus, 
  Loader2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  FileText,
  MoreVertical,
  Trash2,
  Edit,
  Save,
  X,
  Bookmark,
  Copy,
  Download,
  FileDown,
  Cloud,
  Calendar,
  Tag
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { PriorityBadge, PrioritySelector, type Priority } from '@/components/PriorityBadge';
import { TaskDeadlineBadge, getTaskDeadlineStatus } from '@/components/TaskDeadlineBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useAIChatContext } from '@/contexts/AIChatContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAchievementTrigger } from '@/hooks/useAchievementTrigger';
import { Streamdown } from 'streamdown';
import { DraggableSidebar } from '@/components/DraggableSidebar';
import { TaskFiltersBar } from '@/components/TaskFiltersBar';
import { StreamingAIChat } from '@/components/StreamingAIChat';
import { CalendarDialog } from '@/components/CalendarDialog';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import { PitchDeckGenerator } from '@/components/PitchDeckGenerator';
import { FloatingAIButton } from '@/components/AIAssistantButton';
import CustomFieldsManager from '@/components/CustomFieldsManager';
import CustomFieldsForm from '@/components/CustomFieldsForm';
import { TaskAIPanel } from '@/components/TaskAIPanel';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { QuickActionsBar } from '@/components/QuickActionsBar';
import { type TaskInfo, type SectionInfo, type BlockInfo, type EntityType } from '@/components/SidebarContextMenu';
import { SmartTaskCreator } from '@/components/SmartTaskCreator';
import { BreadcrumbNav } from '@/components/BreadcrumbNav';
import { AIDependencySuggestions } from '@/components/AIDependencySuggestions';
import { BlockDetailPanel } from '@/components/BlockDetailPanel';
import { SectionDetailPanel } from '@/components/SectionDetailPanel';
import { EntityAIChat } from '@/components/EntityAIChat';
import { 
  SplitTaskDialog, 
  MergeTasksDialog, 
  ConvertTaskToSectionDialog,
  ConvertSectionToTaskDialog,
  BulkActionsDialog 
} from '@/components/TaskManagementDialogs';
import { LayoutTemplate, Presentation, Split, Merge, ArrowUpCircle, ArrowDownCircle, CopyPlus, CheckSquare, GripVertical, BarChart3, Sparkles, AlertTriangle, Brain, Settings } from 'lucide-react';
import { 
  DragDropProvider, 
  SortableTask, 
  SortableSection, 
  SortableContext, 
  verticalListSortingStrategy 
} from '@/components/DragDropContext';

// ============ RISK ANALYSIS CONTENT ============
type RiskItem = {
  type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  taskId?: number;
  blockId?: number;
};

function RiskAnalysisContent({ projectId }: { projectId: number }) {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const detectRisks = trpc.aiEnhancements.detectRisks.useMutation({
    onSuccess: (data) => {
      setRisks(data.risks);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
    }
  });
  
  // Run detection on mount
  if (!detectRisks.isPending && risks.length === 0 && isLoading) {
    detectRisks.mutate({ projectId });
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Анализируем риски...</span>
      </div>
    );
  }
  
  if (!risks || risks.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">Риски не обнаружены</p>
        <p className="text-slate-500 text-sm mt-1">Проект в хорошем состоянии</p>
      </div>
    );
  }
  
  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/20 border-red-500 text-red-400',
    high: 'bg-orange-500/20 border-orange-500 text-orange-400',
    medium: 'bg-amber-500/20 border-amber-500 text-amber-400',
    low: 'bg-blue-500/20 border-blue-500 text-blue-400',
  };
  
  const severityLabels: Record<string, string> = {
    critical: 'Критический',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
  };
  
  return (
    <div className="space-y-3">
      {risks.map((risk: RiskItem, index: number) => (
        <div
          key={index}
          className={cn(
            "p-4 rounded-lg border",
            severityColors[risk.severity] || severityColors.medium
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <span className="font-medium text-white">{risk.type}</span>
            <span className="text-xs px-2 py-1 rounded bg-slate-800">
              {severityLabels[risk.severity] || risk.severity}
            </span>
          </div>
          <p className="text-sm text-slate-300 mb-2">{risk.description}</p>
          {risk.recommendation && (
            <p className="text-xs text-emerald-400 mt-2">
              Рекомендация: {risk.recommendation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ AI CHAT PANEL ============
function AIChatPanel({ 
  contextType, 
  contextId, 
  contextTitle,
  contextContent,
  onSaveAsNote,
  onSaveAsDocument
}: { 
  contextType: 'project' | 'block' | 'section' | 'task';
  contextId: number;
  contextTitle: string;
  contextContent?: string;
  onSaveAsNote?: (content: string) => void;
  onSaveAsDocument?: (content: string) => void;
}) {
  const [message, setMessage] = useState('');
  const { data: history, refetch } = trpc.chat.history.useQuery({
    contextType,
    contextId,
    limit: 50
  });

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage('');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({
      contextType,
      contextId,
      content: message.trim(),
      projectContext: contextContent
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано в буфер обмена');
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="border-b border-slate-700 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <CardTitle className="text-sm text-white">AI Ассистент</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Контекст: {contextTitle}</p>
        {contextContent && (
          <p className="text-xs text-emerald-500 mt-1">✓ Контекст загружен</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea className="flex-1 p-4">
          {history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "p-3 rounded-lg text-sm relative group",
                    msg.role === 'user' 
                      ? "bg-amber-500/10 text-amber-100 ml-8" 
                      : "bg-slate-700/50 text-slate-300 mr-4"
                  )}
                >
                  <p className="text-xs text-slate-500 mb-1">
                    {msg.role === 'user' ? 'Вы' : 'AI'}
                    {msg.provider && ` (${msg.provider})`}
                  </p>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                  
                  {/* Action buttons for AI messages */}
                  {msg.role === 'assistant' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => copyToClipboard(msg.content)}
                        title="Копировать"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {onSaveAsNote && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-amber-400"
                          onClick={() => onSaveAsNote(msg.content)}
                          title="Сохранить как заметку"
                        >
                          <Bookmark className="w-3 h-3" />
                        </Button>
                      )}
                      {onSaveAsDocument && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-emerald-400"
                          onClick={() => onSaveAsDocument(msg.content)}
                          title="Сохранить как документ"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="bg-slate-700/50 text-slate-300 mr-4 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">AI</p>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Начните диалог с AI</p>
              <p className="text-xs mt-2">AI видит контекст текущего элемента</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Задайте вопрос..."
              className="bg-slate-900 border-slate-600 text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={sendMessage.isPending}
            />
            <Button 
              onClick={handleSend}
              disabled={sendMessage.isPending || !message.trim()}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Отправить'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

// ============ TASK DETAIL PANEL ============
function TaskDetailPanel({
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
}: {
  task: {
    id: number;
    title: string;
    description?: string | null;
    status: string | null;
    priority?: 'critical' | 'high' | 'medium' | 'low' | null;
    notes?: string | null;
    summary?: string | null;
    deadline?: Date | string | null;
    dependencies?: number[] | null;
  };
  projectId: number;
  allTasks: { id: number; title: string; status: string | null }[];
  onClose: () => void;
  onUpdate: (data: { 
    status?: 'not_started' | 'in_progress' | 'completed'; 
    priority?: 'critical' | 'high' | 'medium' | 'low';
    notes?: string; 
    summary?: string;
    deadline?: number | null;
    dependencies?: number[] | null;
  }) => void;
  onSaveNote: (content: string) => void;
  onSaveDocument: (content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: { userId: number; userName: string }[];
}) {
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

  const statusOptions: { value: 'not_started' | 'in_progress' | 'completed'; label: string; icon: typeof Circle; color: string }[] = [
    { value: 'not_started', label: 'Не начато', icon: Circle, color: 'text-slate-500' },
    { value: 'in_progress', label: 'В работе', icon: Clock, color: 'text-amber-500' },
    { value: 'completed', label: 'Готово', icon: CheckCircle2, color: 'text-emerald-500' },
  ];

  const currentStatus = statusOptions.find(s => s.value === task.status) || statusOptions[0];

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
            title="AI Ассистент"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Status */}
          <div>
            <Label className="text-slate-400 text-xs mb-2 block">Статус</Label>
            <div className="flex gap-2">
              {statusOptions.map((option) => {
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

// ============ MAIN COMPONENT ============
export default function ProjectView() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || '0');
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  
  // Real-time collaboration
  const {
    isConnected,
    presenceUsers,
    editingTasks,
    startEditingTask,
    stopEditingTask,
    emitTaskUpdated,
    emitTaskCreated,
    emitTaskDeleted,
    isTaskBeingEdited,
    startTypingComment,
    stopTypingComment,
    getTypingUsersForTask,
  } = useSocket({
    projectId: isAuthenticated ? projectId : undefined,
    onTaskChange: (event) => {
      // Refetch project data when someone else makes changes
      if (event.type === 'created') {
        toast.info(`${event.createdBy} создал новую задачу`);
      } else if (event.type === 'updated') {
        toast.info(`${event.updatedBy} обновил задачу`);
      } else if (event.type === 'deleted') {
        toast.info(`${event.deletedBy} удалил задачу`);
      }
      refetch();
    },
    onTaskEditingConflict: (info) => {
      toast.warning(`${info.editingBy} уже редактирует эту задачу`);
    },
  });
  
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [selectedContext, setSelectedContext] = useState<{
    type: 'project' | 'block' | 'section' | 'task';
    id: number;
    title: string;
    content?: string;
  } | null>(null);
  const [selectedTask, setSelectedTask] = useState<{
    id: number;
    title: string;
    description?: string | null;
    status: string | null;
    notes?: string | null;
    summary?: string | null;
    sectionId: number;
    sortOrder?: number | null;
  } | null>(null);

  // Dialog states
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockTitleRu, setNewBlockTitleRu] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [targetBlockId, setTargetBlockId] = useState<number | null>(null);
  const [targetSectionId, setTargetSectionId] = useState<number | null>(null);

  // Task management dialog states
  const [splitTaskOpen, setSplitTaskOpen] = useState(false);
  const [mergeTasksOpen, setMergeTasksOpen] = useState(false);
  const [convertToSectionOpen, setConvertToSectionOpen] = useState(false);
  const [convertToTaskOpen, setConvertToTaskOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<{ id: number; title: string; sectionId: number; status: string } | null>(null);
  const [selectedSectionForAction, setSelectedSectionForAction] = useState<{ id: number; title: string; blockId: number; tasks: any[] } | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [discussionEntity, setDiscussionEntity] = useState<{ type: 'project' | 'block' | 'section' | 'task'; id: number; title: string } | null>(null);

  const { data: project, isLoading, refetch } = trpc.project.getFull.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  // Unread discussion counts
  const { data: unreadCounts, refetch: refetchUnread } = trpc.collaboration.getUnreadCounts.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0, refetchInterval: 30000 }
  );
  const markReadMutation = trpc.collaboration.markDiscussionRead.useMutation({
    onSuccess: () => refetchUnread(),
  });

  // Set project context for AI chat
  const { setCurrentProject, clearProject } = useProjectContext();
  const { setProject: setAIChatProject, setTask: setAIChatTask, clearContext: clearAIChatContext } = useAIChatContext();
  
  useEffect(() => {
    if (project) {
      // Calculate task counts
      let totalTasks = 0;
      let completedTasks = 0;
      const recentTasks: Array<{ id: number; title: string; status: string; priority: string }> = [];
      const phases: Array<{ id: number; name: string; status: string; tasksCount: number }> = [];
      
      project.blocks?.forEach(block => {
        let blockTasks = 0;
        block.sections?.forEach(section => {
          section.tasks?.forEach(task => {
            totalTasks++;
            blockTasks++;
            if (task.status === 'completed') {
              completedTasks++;
            }
            if (recentTasks.length < 10) {
              recentTasks.push({
                id: task.id,
                title: task.title,
                status: task.status || 'not_started',
                priority: task.priority || 'medium'
              });
            }
          });
        });
        phases.push({
          id: block.id,
          name: block.title,
          status: 'in_progress',
          tasksCount: blockTasks
        });
      });
      
      setCurrentProject({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        status: project.status || 'active',
        tasksCount: totalTasks,
        completedTasksCount: completedTasks,
        phases,
        recentTasks
      });
      
      // Also set AI chat context
      setAIChatProject({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        status: project.status || 'active'
      });
    }
    
    return () => {
      clearProject();
      clearAIChatContext();
    };
  }, [project, setCurrentProject, clearProject, setAIChatProject, clearAIChatContext]);

  // Mutations
  const createBlock = trpc.block.create.useMutation({
    onSuccess: () => {
      toast.success('Блок создан');
      setCreateBlockOpen(false);
      setNewBlockTitle('');
      setNewBlockTitleRu('');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const deleteBlock = trpc.block.delete.useMutation({
    onSuccess: () => {
      toast.success('Блок удалён');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const updateBlock = trpc.block.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Блок обновлён');
    },
    onError: (error) => toast.error('Ошибка обновления: ' + error.message)
  });

  const createSection = trpc.section.create.useMutation({
    onSuccess: () => {
      toast.success('Раздел создан');
      setCreateSectionOpen(false);
      setNewSectionTitle('');
      setTargetBlockId(null);
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const deleteSection = trpc.section.delete.useMutation({
    onSuccess: () => {
      toast.success('Раздел удалён');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const createTask = trpc.task.create.useMutation({
    onSuccess: (data, variables) => {
      toast.success('Задача создана');
      // Emit real-time create to other users
      if (data) {
        emitTaskCreated(data, variables.sectionId);
      }
      setCreateTaskOpen(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setTargetSectionId(null);
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const { handleAchievementResult } = useAchievementTrigger();

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (data, variables) => {
      // Emit real-time update to other users
      emitTaskUpdated(variables);
      refetch();
      // Check for new achievements
      handleAchievementResult(data);
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: (data, variables) => {
      toast.success('Задача удалена');
      // Emit real-time delete to other users
      if (selectedTask) {
        emitTaskDeleted(variables.id, selectedTask.sectionId);
      }
      setSelectedTask(null);
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => {
      toast.success('Задача перемещена');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const moveSection = trpc.section.move.useMutation({
    onSuccess: () => {
      toast.success('Раздел перемещён');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const duplicateTask = trpc.task.duplicate.useMutation({
    onSuccess: () => {
      toast.success('Задача дублирована');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const reorderTasks = trpc.task.reorder.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => toast.error('Ошибка переупорядочивания: ' + error.message)
  });

  const reorderSections = trpc.section.reorder.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => toast.error('Ошибка переупорядочивания: ' + error.message)
  });

  const reorderBlocks = trpc.block.reorder.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => toast.error('Ошибка переупорядочивания блоков: ' + error.message)
  });

  const updateSection = trpc.section.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Раздел обновлён');
    },
    onError: (error) => toast.error('Ошибка обновления: ' + error.message)
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success('Проект удалён');
      navigate('/');
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  // Google Drive integration
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showPitchDeckDialog, setShowPitchDeckDialog] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [showCustomFieldsDialog, setShowCustomFieldsDialog] = useState(false);
  
  const saveToDrive = trpc.drive.saveProject.useMutation({
    onSuccess: (result) => {
      toast.success('Проект сохранён в Google Drive', {
        description: result.path,
        action: result.link ? {
          label: 'Открыть',
          onClick: () => window.open(result.link, '_blank'),
        } : undefined,
      });
    },
    onError: (error) => toast.error('Ошибка сохранения: ' + error.message)
  });

  const exportToGoogleDocs = trpc.drive.exportToGoogleDocs.useMutation({
    onSuccess: (result) => {
      toast.success('Проект экспортирован в Google Docs', {
        description: result.path,
        action: result.link ? {
          label: 'Открыть',
          onClick: () => window.open(result.link, '_blank'),
        } : undefined,
      });
    },
    onError: (error) => toast.error('Ошибка экспорта: ' + error.message)
  });

  const toggleBlock = (blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const toggleSection = (sectionId: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Calculate progress
  const progress = useMemo(() => {
    if (!project?.blocks) return { total: 0, completed: 0, percentage: 0 };
    
    let total = 0;
    let completed = 0;
    
    project.blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          total++;
          if (task.status === 'completed') completed++;
        });
      });
    });
    
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [project]);

  // Get all tasks for dependencies selection and filtering
  const allTasks = useMemo(() => {
    if (!project?.blocks) return [];
    const tasks: { 
      id: number; 
      title: string; 
      status: string | null;
      priority?: 'critical' | 'high' | 'medium' | 'low' | null;
      deadline?: Date | string | null;
      createdAt?: Date | string | null;
    }[] = [];
    project.blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          tasks.push({ 
            id: task.id, 
            title: task.title, 
            status: task.status,
            priority: task.priority as any,
            deadline: task.deadline,
            createdAt: task.createdAt
          });
        });
      });
    });
    return tasks;
  }, [project]);

  // Filtered task IDs based on filters
  const [filteredTaskIds, setFilteredTaskIds] = useState<Set<number>>(new Set());

  // Build context content for AI
  const getContextContent = (type: string, id: number): string => {
    if (!project) return '';
    
    if (type === 'project') {
      return `Проект: ${project.name}\nОписание: ${project.description || 'Нет описания'}\nБлоков: ${project.blocks?.length || 0}`;
    }
    
    if (type === 'block') {
      const block = project.blocks?.find(b => b.id === id);
      if (!block) return '';
      const sections = block.sections?.map(s => `- ${s.title} (${s.tasks?.length || 0} задач)`).join('\n') || 'Нет разделов';
      return `Блок: ${block.titleRu || block.title}\nРазделы:\n${sections}`;
    }
    
    if (type === 'section') {
      for (const block of project.blocks || []) {
        const section = block.sections?.find(s => s.id === id);
        if (section) {
          const tasks = section.tasks?.map(t => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}`).join('\n') || 'Нет задач';
          return `Раздел: ${section.title}\nБлок: ${block.titleRu || block.title}\nЗадачи:\n${tasks}`;
        }
      }
    }
    
    if (type === 'task') {
      for (const block of project.blocks || []) {
        for (const section of block.sections || []) {
          const task = section.tasks?.find(t => t.id === id);
          if (task) {
            return `Задача: ${task.title}\nСтатус: ${task.status}\nОписание: ${task.description || 'Нет описания'}\nЗаметки: ${task.notes || 'Нет заметок'}\nРаздел: ${section.title}\nБлок: ${block.titleRu || block.title}`;
          }
        }
      }
    }
    
    return '';
  };

  // Handle save AI response as note
  const handleSaveAsNote = (content: string) => {
    if (selectedTask) {
      const currentNotes = selectedTask.notes || '';
      const newNotes = currentNotes ? `${currentNotes}\n\n---\n\n${content}` : content;
      updateTask.mutate({ id: selectedTask.id, notes: newNotes });
      setSelectedTask({ ...selectedTask, notes: newNotes });
      toast.success('Сохранено как заметка');
    } else {
      toast.error('Выберите задачу для сохранения заметки');
    }
  };

  // Handle save AI response as document
  const handleSaveAsDocument = (content: string) => {
    if (selectedTask) {
      updateTask.mutate({ id: selectedTask.id, summary: content });
      setSelectedTask({ ...selectedTask, summary: content });
      toast.success('Сохранено как итоговый документ');
    } else {
      toast.error('Выберите задачу для сохранения документа');
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Проект не найден</p>
          <Link href="/">
            <Button variant="outline">Вернуться на главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <EntityAIChatStoreProvider>
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/95">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white mb-3">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-white truncate">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 flex-shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem className="text-slate-300">
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-slate-300"
                  onClick={() => {
                    window.open(`/api/export/markdown/${projectId}`, '_blank');
                    toast.success('Экспорт в Markdown начат');
                  }}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Экспорт в Markdown
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-slate-300"
                  onClick={() => {
                    window.open(`/api/export/html/${projectId}`, '_blank');
                    toast.success('Экспорт в HTML начат');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт в HTML/PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-blue-400"
                  onClick={() => {
                    saveToDrive.mutate({ projectId });
                  }}
                  disabled={saveToDrive.isPending}
                >
                  <Cloud className="w-4 h-4 mr-2" />
                  {saveToDrive.isPending ? 'Сохранение...' : 'Сохранить в Google Drive'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-purple-400"
                  onClick={() => {
                    exportToGoogleDocs.mutate({ projectId });
                  }}
                  disabled={exportToGoogleDocs.isPending}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {exportToGoogleDocs.isPending ? 'Экспорт...' : 'Экспорт в Google Docs'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-emerald-400"
                  onClick={() => setShowCalendarDialog(true)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Добавить в Google Calendar
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-orange-400"
                  onClick={async () => {
                    // First save to Google Drive
                    toast.info('Сохранение в Google Drive...');
                    try {
                      await saveToDrive.mutateAsync({ projectId });
                      // Then open NotebookLM
                      window.open('https://notebooklm.google.com/', '_blank');
                      toast.success('Проект сохранён! Добавьте файл из Google Drive в NotebookLM', {
                        description: 'Папка: MYDON_Roadmaps',
                        duration: 10000,
                      });
                    } catch (e) {
                      toast.error('Ошибка сохранения');
                    }
                  }}
                  disabled={saveToDrive.isPending}
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  Создать источник в NotebookLM
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-cyan-400"
                  onClick={() => navigate(`/project/${projectId}/analytics`)}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Аналитика
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-indigo-400"
                  onClick={() => navigate(`/project/${projectId}/tags`)}
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Управление тегами
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-teal-400"
                  onClick={() => setShowCustomFieldsDialog(true)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Кастомные поля
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-pink-400"
                  onClick={() => setShowAIAssistant(true)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Ассистент
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-orange-400"
                  onClick={() => setShowRiskPanel(true)}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Анализ рисков
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-violet-400"
                  onClick={() => setShowSaveTemplateDialog(true)}
                >
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Сохранить как шаблон
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-amber-400"
                  onClick={() => setShowPitchDeckDialog(true)}
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Создать Pitch Deck
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-cyan-400"
                  onClick={() => navigate(`/project/${projectId}/views`)}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Альтернативные виды
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-red-400"
                  onClick={() => {
                    if (confirm('Удалить проект?')) {
                      deleteProject.mutate({ id: projectId });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">Прогресс</span>
              <span className="text-white font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2 bg-slate-700" />
            <p className="text-xs text-slate-500 mt-1">
              {progress.completed} из {progress.total} задач
            </p>
          </div>

          {/* Online Users */}
          {presenceUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <PresenceAvatars users={presenceUsers} size="sm" />
            </div>
          )}
        </div>

        {/* Blocks List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Project AI Chat */}
            <button
              onClick={() => {
                setSelectedTask(null);
                setSelectedContext({ 
                  type: 'project', 
                  id: project.id, 
                  title: project.name,
                  content: getContextContent('project', project.id)
                });
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-2 transition-colors",
                selectedContext?.type === 'project' && selectedContext?.id === project.id
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              AI чат проекта
            </button>

            {/* Task Filters */}
            {allTasks.length > 0 && (
              <TaskFiltersBar
                tasks={allTasks}
                projectId={projectId}
                onFilteredTasksChange={setFilteredTaskIds}
                className="mb-2"
              />
            )}

            {/* Draggable Blocks with Sections and Tasks */}
            {project.blocks && project.blocks.length > 0 ? (
              <DraggableSidebar
                blocks={project.blocks.map(b => ({
                  ...b,
                  sections: b.sections?.map(s => ({
                    ...s,
                    sortOrder: s.sortOrder || 0,
                    tasks: s.tasks?.map(t => ({
                      ...t,
                      sortOrder: t.sortOrder || 0
                    }))
                  }))
                }))}
                expandedBlocks={expandedBlocks}
                expandedSections={expandedSections}
                selectedContext={selectedContext}
                selectedTask={selectedTask}
                onToggleBlock={toggleBlock}
                onToggleSection={toggleSection}
                onSelectContext={(ctx) => {
                  setSelectedContext(ctx);
                  if (ctx.type === 'block' || ctx.type === 'section' || ctx.type === 'project') {
                    setSelectedTask(null);
                    setAIChatTask(null);
                  }
                }}
                onSelectTask={(task) => {
                  setSelectedTask(task);
                  setSelectedContext({
                    type: 'task',
                    id: task.id,
                    title: task.title,
                    content: getContextContent('task', task.id)
                  });
                  // Set AI chat task context
                  setAIChatTask({
                    id: `task-${task.id}`,
                    numericId: task.id,
                    title: task.title,
                    status: task.status || 'not_started',
                    priority: task.priority || 'medium',
                    deadline: task.deadline ? (typeof task.deadline === 'number' ? task.deadline : new Date(task.deadline).getTime()) : null,
                    notes: task.notes || undefined,
                    sectionId: String(task.sectionId)
                  });
                }}
                onCreateSection={(blockId) => {
                  setTargetBlockId(blockId);
                  setCreateSectionOpen(true);
                }}
                onCreateTask={(sectionId) => {
                  setTargetSectionId(sectionId);
                  setCreateTaskOpen(true);
                }}
                onDeleteBlock={(id) => {
                  if (confirm('Удалить блок?')) {
                    deleteBlock.mutate({ id });
                  }
                }}
                onDeleteSection={(id) => {
                  if (confirm('Удалить раздел?')) {
                    deleteSection.mutate({ id });
                  }
                }}
                onMoveTask={(taskId, newSectionId, newSortOrder) => {
                  moveTask.mutate({ id: taskId, sectionId: newSectionId, sortOrder: newSortOrder });
                }}
                onMoveSection={(sectionId, newBlockId, newSortOrder) => {
                  moveSection.mutate({ id: sectionId, blockId: newBlockId, sortOrder: newSortOrder });
                }}
                onReorderTasks={(sectionId, taskIds) => {
                  reorderTasks.mutate({ sectionId, taskIds });
                }}
                onReorderSections={(blockId, sectionIds) => {
                  reorderSections.mutate({ blockId, sectionIds });
                }}
                onReorderBlocks={(blockIds) => {
                  reorderBlocks.mutate({ projectId: project.id, blockIds });
                }}
                onUpdateTaskTitle={(taskId, newTitle) => {
                  updateTask.mutate({ id: taskId, title: newTitle });
                }}
                onUpdateTaskDueDate={(taskId, dueDate) => {
                  updateTask.mutate({ id: taskId, dueDate: dueDate?.getTime() || null });
                }}
                onUpdateSectionTitle={(sectionId, newTitle) => {
                  updateSection.mutate({ id: sectionId, title: newTitle });
                }}
                onUpdateBlockTitle={(blockId, newTitle) => {
                  updateBlock.mutate({ id: blockId, titleRu: newTitle });
                }}
                getContextContent={getContextContent}
                filteredTaskIds={filteredTaskIds}
                unreadCounts={unreadCounts}
                onDeleteTask={(taskId) => {
                  if (confirm('Удалить задачу?')) {
                    deleteTask.mutate({ id: taskId });
                  }
                }}
                onUpdateTaskStatus={(taskId, status) => {
                  updateTask.mutate({ id: taskId, status });
                }}
                onUpdateTaskPriority={(taskId, priority) => {
                  updateTask.mutate({ id: taskId, priority });
                }}
                onContextMenuAction={(actionId, entityType, entityData) => {
                  // Handle AI actions and complex operations from context menu
                  if (actionId === 'discuss') {
                    // Open discussion panel
                    if (entityType === 'block') {
                      const block = entityData as BlockInfo;
                      setSelectedContext({ type: 'block', id: block.id, title: block.title, content: getContextContent('block', block.id) });
                      setDiscussionEntity({ type: 'block', id: block.id, title: block.title });
                      setSelectedTask(null);
                      setAIChatTask(null);
                    } else if (entityType === 'section') {
                      const section = entityData as SectionInfo;
                      setSelectedContext({ type: 'section', id: section.id, title: section.title, content: getContextContent('section', section.id) });
                      setDiscussionEntity({ type: 'section', id: section.id, title: section.title });
                      setSelectedTask(null);
                      setAIChatTask(null);
                    } else if (entityType === 'task') {
                      const task = entityData as TaskInfo;
                      setSelectedContext({ type: 'task', id: task.id, title: task.title, content: getContextContent('task', task.id) });
                      setDiscussionEntity({ type: 'task', id: task.id, title: task.title });
                    }
                  } else if (actionId === 'add-subtask' && entityType === 'task') {
                    const task = entityData as TaskInfo;
                    setSelectedTask({ id: task.id, title: task.title, status: task.status, priority: task.priority, sectionId: task.sectionId } as any);
                    setSelectedContext({ type: 'task', id: task.id, title: task.title, content: getContextContent('task', task.id) });
                  } else if (actionId === 'rename') {
                    toast.info('Дважды кликните по названию для редактирования');
                  } else if (actionId.startsWith('ai-')) {
                    // AI actions - open the context and trigger QuickActionsBar action
                    if (entityType === 'block') {
                      const block = entityData as BlockInfo;
                      setSelectedContext({ type: 'block', id: block.id, title: block.title, content: getContextContent('block', block.id) });
                      setSelectedTask(null);
                      setAIChatTask(null);
                    } else if (entityType === 'section') {
                      const section = entityData as SectionInfo;
                      setSelectedContext({ type: 'section', id: section.id, title: section.title, content: getContextContent('section', section.id) });
                      setSelectedTask(null);
                      setAIChatTask(null);
                    } else if (entityType === 'task') {
                      const task = entityData as TaskInfo;
                      setSelectedTask({ id: task.id, title: task.title, status: task.status, priority: task.priority, sectionId: task.sectionId } as any);
                      setSelectedContext({ type: 'task', id: task.id, title: task.title, content: getContextContent('task', task.id) });
                    }
                    toast.info('Выберите AI действие в правой панели');
                  }
                }}
              />
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет блоков</p>
                <p className="text-xs mt-1">Создайте первый блок</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Add Block Button */}
        <div className="p-4 border-t border-slate-800">
          <Dialog open={createBlockOpen} onOpenChange={setCreateBlockOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300">
                <Plus className="w-4 h-4 mr-2" />
                Добавить блок
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Новый блок</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Название</Label>
                  <Input
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    placeholder="Research & Analysis"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Название (RU)</Label>
                  <Input
                    value={newBlockTitleRu}
                    onChange={(e) => setNewBlockTitleRu(e.target.value)}
                    placeholder="Исследование и анализ"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <Button 
                  onClick={() => {
                    if (!newBlockTitle.trim()) {
                      toast.error('Введите название');
                      return;
                    }
                    createBlock.mutate({
                      projectId,
                      number: (project.blocks?.length || 0) + 1,
                      title: newBlockTitle.trim(),
                      titleRu: newBlockTitleRu.trim() || undefined,
                    });
                  }}
                  disabled={createBlock.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {createBlock.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Создать
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex min-w-0">
        {/* Task Detail or Welcome */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              projectId={projectId}
              allTasks={allTasks}
              onClose={() => {
                setSelectedTask(null);
                setAIChatTask(null); // Clear AI chat task context
              }}
              onUpdate={(data) => {
                updateTask.mutate({ id: selectedTask.id, ...data });
                setSelectedTask({ ...selectedTask, ...data });
              }}
              onSaveNote={handleSaveAsNote}
              onSaveDocument={handleSaveAsDocument}
              onTypingStart={() => startTypingComment(selectedTask.id)}
              onTypingStop={() => stopTypingComment(selectedTask.id)}
              typingUsers={getTypingUsersForTask(selectedTask.id, user?.id)}
            />
          ) : selectedContext ? (
            <ScrollArea className="flex-1">
            {selectedContext.type === 'block' && (() => {
              const block = project.blocks?.find(b => b.id === selectedContext.id);
              if (!block) return null;
              return (
                <BlockDetailPanel
                  block={block}
                  projectId={projectId}
                  projectName={project.name}
                  onSelectSection={(sectionId, sectionTitle) => {
                    setSelectedContext({
                      type: 'section',
                      id: sectionId,
                      title: sectionTitle,
                      content: getContextContent('section', sectionId)
                    });
                    setSelectedTask(null);
                  }}
                  onSelectTask={(taskId, taskTitle, sectionId) => {
                    const task = block.sections?.flatMap(s => s.tasks || []).find(t => t.id === taskId);
                    if (task) {
                      setSelectedTask({ ...task, sectionId } as any);
                      setSelectedContext({
                        type: 'task',
                        id: taskId,
                        title: taskTitle,
                        content: getContextContent('task', taskId)
                      });
                    }
                  }}
                  onCreateSection={(blockId) => {
                    setTargetBlockId(blockId);
                    setCreateSectionOpen(true);
                  }}
                  onNavigate={(item) => {
                    setSelectedContext({
                      type: item.type,
                      id: item.id,
                      title: item.title,
                      content: getContextContent(item.type, item.id)
                    });
                    if (item.type !== 'task') setSelectedTask(null);
                  }}
                  onMarkRead={(entityType, entityId) => {
                    markReadMutation.mutate({ entityType: entityType as any, entityId });
                  }}
                />
              );
            })()}

            {selectedContext.type === 'section' && (() => {
              const block = project.blocks?.find(b => b.sections?.some(s => s.id === selectedContext.id));
              const section = block?.sections?.find(s => s.id === selectedContext.id);
              if (!block || !section) return null;
              return (
                <SectionDetailPanel
                  section={{ ...section, blockId: block.id }}
                  blockTitle={block.titleRu || block.title}
                  blockId={block.id}
                  projectId={projectId}
                  projectName={project.name}
                  onSelectTask={(task, sectionId) => {
                    setSelectedTask({ ...task, sectionId } as any);
                    setSelectedContext({
                      type: 'task',
                      id: task.id,
                      title: task.title,
                      content: getContextContent('task', task.id)
                    });
                  }}
                  onCreateTask={(sectionId) => {
                    setTargetSectionId(sectionId);
                    setCreateTaskOpen(true);
                  }}
                  onNavigate={(item) => {
                    setSelectedContext({
                      type: item.type,
                      id: item.id,
                      title: item.title,
                      content: getContextContent(item.type, item.id)
                    });
                    if (item.type !== 'task') setSelectedTask(null);
                  }}
                  onMarkRead={(entityType, entityId) => {
                    markReadMutation.mutate({ entityType: entityType as any, entityId });
                  }}
                  onDeleteTask={(taskId) => {
                    deleteTask.mutate({ id: taskId });
                  }}
                  onDuplicateTask={(taskId) => {
                    duplicateTask.mutate({ taskId });
                  }}
                  onSplitTask={(task, sectionId) => {
                    setSelectedTaskForAction({ id: task.id, title: task.title, sectionId, status: task.status || 'not_started' });
                    setSplitTaskOpen(true);
                  }}
                  onConvertTaskToSection={(task, sectionId) => {
                    setSelectedTaskForAction({ id: task.id, title: task.title, sectionId, status: task.status || 'not_started' });
                    setConvertToSectionOpen(true);
                  }}
                  onMergeTasks={(sectionId) => {
                    const sec = project.blocks.flatMap(b => b.sections).find(s => s.id === sectionId);
                    if (sec) {
                      setSelectedSectionForAction({
                        id: sec.id,
                        title: sec.title,
                        blockId: block.id,
                        tasks: sec.tasks || []
                      });
                      setMergeTasksOpen(true);
                    }
                  }}
                  onConvertSectionToTask={(sectionId) => {
                    const sec = project.blocks.flatMap(b => b.sections).find(s => s.id === sectionId);
                    if (sec) {
                      setSelectedSectionForAction({
                        id: sec.id,
                        title: sec.title,
                        blockId: block.id,
                        tasks: sec.tasks || []
                      });
                      setConvertToTaskOpen(true);
                    }
                  }}
                  selectionMode={selectionMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelectionMode={() => {
                    setSelectionMode(!selectionMode);
                    if (selectionMode) setSelectedTaskIds([]);
                  }}
                  onToggleTaskSelection={(taskId) => {
                    setSelectedTaskIds(prev =>
                      prev.includes(taskId)
                        ? prev.filter(id => id !== taskId)
                        : [...prev, taskId]
                    );
                  }}
                  onBulkActions={() => setBulkActionsOpen(true)}
                />
              );
            })()}

            {/* Fallback for project-level or other context types */}
            {selectedContext.type !== 'block' && selectedContext.type !== 'section' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-2">{selectedContext.title}</h2>
              
              {/* Quick Action Buttons for all entity types */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "border-slate-600 text-blue-400 hover:bg-blue-500/10"
                  )}
                  onClick={() => {
                    if (discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id) {
                      setDiscussionEntity(null);
                    } else {
                      setDiscussionEntity({ type: selectedContext.type as any, id: selectedContext.id, title: selectedContext.title });
                      // Mark as read when opening discussion
                      markReadMutation.mutate({ entityType: selectedContext.type as any, entityId: selectedContext.id });
                    }
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Обсудить
                </Button>
                {selectedContext.type !== 'project' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-purple-400 hover:bg-purple-500/10"
                    onClick={() => {
                      // Open AI chat for this context
                    }}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    AI чат
                  </Button>
                )}
              </div>

              {/* AI Quick Actions Bar */}
              {selectedContext.type !== 'project' && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-slate-400">Быстрые действия AI</span>
                  </div>
                  <QuickActionsBar
                    entityType={selectedContext.type as 'block' | 'section' | 'task'}
                    entityId={selectedContext.id}
                    projectId={projectId}
                    onInsertResult={(content) => {
                      navigator.clipboard.writeText(content);
                      toast.success('Скопировано в буфер обмена');
                    }}
                  />
                </div>
              )}

            </div>
            )}
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Выберите блок, раздел или задачу</p>
                <p className="text-sm mt-2">или создайте новый блок</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Panel removed - now contextual per task via TaskAIPanel */}
      </main>

      {/* Create Section Dialog */}
      <Dialog open={createSectionOpen} onOpenChange={setCreateSectionOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Новый раздел</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Название раздела</Label>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Например: Анализ рынка"
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <Button 
              onClick={() => {
                if (!newSectionTitle.trim() || !targetBlockId) {
                  toast.error('Введите название');
                  return;
                }
                createSection.mutate({
                  blockId: targetBlockId,
                  title: newSectionTitle.trim(),
                });
              }}
              disabled={createSection.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {createSection.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      {/* Smart Task Creator */}
      <SmartTaskCreator
        open={createTaskOpen}
        onClose={() => {
          setCreateTaskOpen(false);
          setTargetSectionId(null);
        }}
        sectionId={targetSectionId || 0}
        projectId={projectId}
        sectionTitle={targetSectionId ? project.blocks?.flatMap(b => b.sections).find(s => s.id === targetSectionId)?.title : undefined}
        onCreateTask={(task) => {
          if (!targetSectionId) return;
          createTask.mutate({
            sectionId: targetSectionId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            deadline: task.dueDate || undefined,
          });
        }}
        isCreating={createTask.isPending}
      />

      {/* Google Calendar Dialog */}
      <CalendarDialog
        open={showCalendarDialog}
        onOpenChange={setShowCalendarDialog}
        projectId={projectId}
        projectName={project.name}
        tasks={project.blocks.flatMap(block =>
          block.sections.flatMap(section =>
            section.tasks.map(task => ({
              id: task.id,
              title: task.title,
              description: task.description,
            }))
          )
        )}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
        projectId={projectId}
        projectName={project.name}
      />

      {/* Pitch Deck Generator */}
      <PitchDeckGenerator
        open={showPitchDeckDialog}
        onOpenChange={setShowPitchDeckDialog}
        projectId={projectId}
        projectName={project.name}
      />

      {/* Floating AI Assistant Button */}
      <FloatingAIButton />
      
      {/* AI Assistant Dialog */}
      <Dialog open={showAIAssistant} onOpenChange={setShowAIAssistant}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              AI Ассистент
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Используйте AI для анализа проекта, генерации идей и получения рекомендаций
            </DialogDescription>
          </DialogHeader>
          <div className="h-[500px]">
            <StreamingAIChat
              contextType="project"
              contextId={projectId}
              contextTitle={project.name}
              contextContent={getContextContent('project', projectId)}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Risk Detection Panel */}
      <Dialog open={showRiskPanel} onOpenChange={setShowRiskPanel}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Анализ рисков
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Выявленные риски и проблемы в проекте
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <RiskAnalysisContent projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Fields Manager Dialog */}
      <Dialog open={showCustomFieldsDialog} onOpenChange={setShowCustomFieldsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-teal-400" />
              Кастомные поля
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Создавайте пользовательские поля для задач: текст, числа, даты, формулы и многое другое
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
            <CustomFieldsManager projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Management Dialogs */}
      <SplitTaskDialog
        open={splitTaskOpen}
        onOpenChange={setSplitTaskOpen}
        task={selectedTaskForAction}
        onSuccess={() => refetch()}
      />

      <MergeTasksDialog
        open={mergeTasksOpen}
        onOpenChange={setMergeTasksOpen}
        section={selectedSectionForAction}
        onSuccess={() => refetch()}
      />

      <ConvertTaskToSectionDialog
        open={convertToSectionOpen}
        onOpenChange={setConvertToSectionOpen}
        task={selectedTaskForAction}
        onSuccess={() => refetch()}
      />

      <ConvertSectionToTaskDialog
        open={convertToTaskOpen}
        onOpenChange={setConvertToTaskOpen}
        section={selectedSectionForAction}
        sections={project.blocks.flatMap(b => b.sections.map(s => ({ ...s, blockId: b.id })))}
        onSuccess={() => refetch()}
      />

      <BulkActionsDialog
        open={bulkActionsOpen}
        onOpenChange={setBulkActionsOpen}
        selectedTaskIds={selectedTaskIds}
        onSuccess={() => refetch()}
        onClearSelection={() => {
          setSelectedTaskIds([]);
          setSelectionMode(false);
        }}
      />
    </div>
    </EntityAIChatStoreProvider>
  );
}
