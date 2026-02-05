import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { useSocket } from '@/hooks/useSocket';
import { PresenceAvatars } from '@/components/PresenceAvatars';
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
  Calendar
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import { Streamdown } from 'streamdown';
import { DraggableSidebar } from '@/components/DraggableSidebar';
import { StreamingAIChat } from '@/components/StreamingAIChat';
import { CalendarDialog } from '@/components/CalendarDialog';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import { PitchDeckGenerator } from '@/components/PitchDeckGenerator';
import { FloatingAIButton } from '@/components/AIAssistantButton';
import { 
  SplitTaskDialog, 
  MergeTasksDialog, 
  ConvertTaskToSectionDialog,
  ConvertSectionToTaskDialog,
  BulkActionsDialog 
} from '@/components/TaskManagementDialogs';
import { LayoutTemplate, Presentation, Split, Merge, ArrowUpCircle, ArrowDownCircle, CopyPlus, CheckSquare, GripVertical } from 'lucide-react';
import { 
  DragDropProvider, 
  SortableTask, 
  SortableSection, 
  SortableContext, 
  verticalListSortingStrategy 
} from '@/components/DragDropContext';

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

// ============ TASK DETAIL PANEL ============
function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onSaveNote,
  onSaveDocument
}: {
  task: {
    id: number;
    title: string;
    description?: string | null;
    status: string | null;
    notes?: string | null;
    summary?: string | null;
  };
  onClose: () => void;
  onUpdate: (data: { status?: 'not_started' | 'in_progress' | 'completed'; notes?: string; summary?: string }) => void;
  onSaveNote: (content: string) => void;
  onSaveDocument: (content: string) => void;
}) {
  const [notes, setNotes] = useState(task.notes || '');
  const [summary, setSummary] = useState(task.summary || '');
  const [isEditing, setIsEditing] = useState(false);

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

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white truncate flex-1">{task.title}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400">
          <X className="w-4 h-4" />
        </Button>
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
        </div>
      </ScrollArea>
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

  const { data: project, isLoading, refetch } = trpc.project.getFull.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

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

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (data, variables) => {
      // Emit real-time update to other users
      emitTaskUpdated(variables);
      refetch();
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
                onSelectContext={setSelectedContext}
                onSelectTask={(task) => {
                  setSelectedTask(task);
                  setSelectedContext({
                    type: 'task',
                    id: task.id,
                    title: task.title,
                    content: getContextContent('task', task.id)
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
              onClose={() => setSelectedTask(null)}
              onUpdate={(data) => {
                updateTask.mutate({ id: selectedTask.id, ...data });
                setSelectedTask({ ...selectedTask, ...data });
              }}
              onSaveNote={handleSaveAsNote}
              onSaveDocument={handleSaveAsDocument}
            />
          ) : selectedContext ? (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-2">{selectedContext.title}</h2>
              <p className="text-sm text-slate-400 mb-4">
                {selectedContext.type === 'project' && 'Используйте AI чат справа для работы с проектом'}
                {selectedContext.type === 'block' && 'Используйте AI чат справа для работы с блоком'}
                {selectedContext.type === 'section' && 'Выберите задачу или используйте AI чат'}
              </p>
              
              {/* Section Action Buttons */}
              {selectedContext.type === 'section' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                    onClick={() => {
                      const section = project.blocks
                        .flatMap(b => b.sections)
                        .find(s => s.id === selectedContext.id);
                      if (section) {
                        setSelectedSectionForAction({
                          id: section.id,
                          title: section.title,
                          blockId: project.blocks.find(b => b.sections.some(s => s.id === section.id))?.id || 0,
                          tasks: section.tasks || []
                        });
                        setMergeTasksOpen(true);
                      }
                    }}
                  >
                    <Merge className="w-4 h-4 mr-2 text-emerald-400" />
                    Объединить задачи
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border-slate-600",
                      selectionMode ? "bg-amber-500/20 text-amber-400 border-amber-500" : "text-slate-300"
                    )}
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      if (selectionMode) {
                        setSelectedTaskIds([]);
                      }
                    }}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {selectionMode ? 'Отменить выбор' : 'Выбрать задачи'}
                  </Button>
                  {selectedTaskIds.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                      onClick={() => setBulkActionsOpen(true)}
                    >
                      Действия ({selectedTaskIds.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                    onClick={() => {
                      const section = project.blocks
                        .flatMap(b => b.sections)
                        .find(s => s.id === selectedContext.id);
                      if (section) {
                        const block = project.blocks.find(b => b.sections.some(s => s.id === section.id));
                        setSelectedSectionForAction({
                          id: section.id,
                          title: section.title,
                          blockId: block?.id || 0,
                          tasks: section.tasks || []
                        });
                        setConvertToTaskOpen(true);
                      }
                    }}
                  >
                    <ArrowDownCircle className="w-4 h-4 mr-2 text-purple-400" />
                    Преобразовать в задачу
                  </Button>
                </div>
              )}
              
              {/* Show tasks for selected section */}
              {selectedContext.type === 'section' && (
                <div className="space-y-2">
                  {project.blocks?.map(block => 
                    block.sections?.map(section => {
                      if (section.id !== selectedContext.id) return null;
                      return (
                        <div key={section.id}>
                          {section.tasks && section.tasks.length > 0 ? (
                            section.tasks.map(task => (
                              <Card 
                                key={task.id} 
                                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 cursor-pointer mb-2"
                                onClick={() => {
                                  if (selectionMode) {
                                    setSelectedTaskIds(prev => 
                                      prev.includes(task.id) 
                                        ? prev.filter(id => id !== task.id)
                                        : [...prev, task.id]
                                    );
                                  } else {
                                    setSelectedTask({
                                      ...task,
                                      sectionId: section.id
                                    });
                                    setSelectedContext({
                                      type: 'task',
                                      id: task.id,
                                      title: task.title,
                                      content: getContextContent('task', task.id)
                                    });
                                  }
                                }}
                              >
                                <CardContent className="py-3 px-4 flex items-center gap-3">
                                  {selectionMode && (
                                    <Checkbox
                                      checked={selectedTaskIds.includes(task.id)}
                                      onCheckedChange={() => {
                                        setSelectedTaskIds(prev => 
                                          prev.includes(task.id) 
                                            ? prev.filter(id => id !== task.id)
                                            : [...prev, task.id]
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border-slate-500"
                                    />
                                  )}
                                  {task.status === 'completed' ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  ) : task.status === 'in_progress' ? (
                                    <Clock className="w-5 h-5 text-amber-500" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-slate-500" />
                                  )}
                                  <span className="text-slate-300 flex-1">{task.title}</span>
                                  
                                  {/* Task Actions Dropdown */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTaskForAction({ ...task, sectionId: section.id, status: task.status || 'not_started' });
                                          setSplitTaskOpen(true);
                                        }}
                                        className="text-slate-300 focus:text-white focus:bg-slate-700"
                                      >
                                        <Split className="w-4 h-4 mr-2 text-amber-400" />
                                        Разделить на подзадачи
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          duplicateTask.mutate({ taskId: task.id });
                                        }}
                                        className="text-slate-300 focus:text-white focus:bg-slate-700"
                                      >
                                        <CopyPlus className="w-4 h-4 mr-2 text-blue-400" />
                                        Дублировать
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTaskForAction({ ...task, sectionId: section.id, status: task.status || 'not_started' });
                                          setConvertToSectionOpen(true);
                                        }}
                                        className="text-slate-300 focus:text-white focus:bg-slate-700"
                                      >
                                        <ArrowUpCircle className="w-4 h-4 mr-2 text-purple-400" />
                                        Преобразовать в раздел
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-slate-700" />
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Удалить задачу?')) {
                                            deleteTask.mutate({ id: task.id });
                                          }
                                        }}
                                        className="text-red-400 focus:text-red-300 focus:bg-slate-700"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Удалить
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </CardContent>
                              </Card>
                            ))
                          ) : (
                            <p className="text-slate-500 text-sm">Нет задач в этом разделе</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 border-slate-600 text-slate-400"
                            onClick={() => {
                              setTargetSectionId(section.id);
                              setCreateTaskOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Добавить задачу
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
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

        {/* AI Chat Panel */}
        {selectedContext && (
          <div className="w-96 border-l border-slate-800 flex-shrink-0">
            <StreamingAIChat
              contextType={selectedContext.type}
              contextId={selectedContext.id}
              contextTitle={selectedContext.title}
              contextContent={selectedContext.content}
              onSaveAsNote={selectedTask ? handleSaveAsNote : undefined}
              onSaveAsDocument={selectedTask ? handleSaveAsDocument : undefined}
            />
          </div>
        )}
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
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Новая задача</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Название задачи</Label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Например: Провести исследование конкурентов"
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Описание (опционально)</Label>
              <Textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Детальное описание задачи..."
                className="bg-slate-900 border-slate-600 text-white"
                rows={3}
              />
            </div>
            <Button 
              onClick={() => {
                if (!newTaskTitle.trim() || !targetSectionId) {
                  toast.error('Введите название');
                  return;
                }
                createTask.mutate({
                  sectionId: targetSectionId,
                  title: newTaskTitle.trim(),
                  description: newTaskDescription.trim() || undefined,
                });
              }}
              disabled={createTask.isPending}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {createTask.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
  );
}
