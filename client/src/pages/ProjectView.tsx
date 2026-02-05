import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
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
  Settings,
  MoreVertical,
  Calendar,
  Trash2,
  Edit
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// AI Chat Panel Component
function AIChatPanel({ 
  contextType, 
  contextId, 
  contextTitle 
}: { 
  contextType: 'project' | 'block' | 'section' | 'task';
  contextId: number;
  contextTitle: string;
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
      content: message.trim()
    });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="border-b border-slate-700 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <CardTitle className="text-sm text-white">AI Ассистент</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Контекст: {contextTitle}</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          {history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    msg.role === 'user' 
                      ? "bg-amber-500/10 text-amber-100 ml-8" 
                      : "bg-slate-700/50 text-slate-300 mr-8"
                  )}
                >
                  <p className="text-xs text-slate-500 mb-1">
                    {msg.role === 'user' ? 'Вы' : 'AI'}
                    {msg.provider && ` (${msg.provider})`}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Начните диалог с AI</p>
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

export default function ProjectView() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || '0');
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());
  const [selectedContext, setSelectedContext] = useState<{
    type: 'project' | 'block' | 'section' | 'task';
    id: number;
    title: string;
  } | null>(null);

  // Block creation dialog
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockTitleRu, setNewBlockTitleRu] = useState('');

  const { data: project, isLoading, refetch } = trpc.project.getFull.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  const createBlock = trpc.block.create.useMutation({
    onSuccess: () => {
      toast.success('Блок создан');
      setCreateBlockOpen(false);
      setNewBlockTitle('');
      setNewBlockTitleRu('');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success('Проект удалён');
      navigate('/');
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const toggleBlock = (blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
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
            <div>
              <h1 className="text-lg font-semibold text-white">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-800 border-slate-700">
                <DropdownMenuItem className="text-slate-300">
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </DropdownMenuItem>
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
        </div>

        {/* Blocks List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Project-level chat button */}
            <button
              onClick={() => setSelectedContext({ 
                type: 'project', 
                id: project.id, 
                title: project.name 
              })}
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

            {/* Blocks */}
            {project.blocks && project.blocks.length > 0 ? (
              project.blocks.map((block, index) => (
                <div key={block.id} className="mb-1">
                  <button
                    onClick={() => toggleBlock(block.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-800 transition-colors"
                  >
                    {expandedBlocks.has(block.id) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <span className="text-amber-500 font-mono text-xs">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-slate-300 flex-1 truncate">{block.title}</span>
                  </button>
                  
                  {expandedBlocks.has(block.id) && (
                    <div className="ml-6 pl-4 border-l border-slate-700">
                      {/* Block chat */}
                      <button
                        onClick={() => setSelectedContext({ 
                          type: 'block', 
                          id: block.id, 
                          title: block.title 
                        })}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors",
                          selectedContext?.type === 'block' && selectedContext?.id === block.id
                            ? "bg-amber-500/20 text-amber-400"
                            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                        )}
                      >
                        <MessageSquare className="w-3 h-3" />
                        AI чат блока
                      </button>
                      
                      {/* Sections */}
                      {block.sections?.map(section => (
                        <button
                          key={section.id}
                          onClick={() => setSelectedContext({ 
                            type: 'section', 
                            id: section.id, 
                            title: section.title 
                          })}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors",
                            selectedContext?.type === 'section' && selectedContext?.id === section.id
                              ? "bg-slate-700 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                          )}
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate">{section.title}</span>
                          <span className="ml-auto text-slate-600">
                            {section.tasks?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет блоков</p>
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
                  <Label className="text-slate-300">Название (EN)</Label>
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
      <main className="flex-1 flex">
        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          {selectedContext ? (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                {selectedContext.title}
              </h2>
              {selectedContext.type === 'section' && (
                <div className="space-y-2">
                  {/* Show tasks for selected section */}
                  {project.blocks?.map(block => 
                    block.sections?.map(section => {
                      if (section.id !== selectedContext.id) return null;
                      return section.tasks?.map(task => (
                        <Card 
                          key={task.id} 
                          className="bg-slate-800/50 border-slate-700 hover:border-slate-600 cursor-pointer"
                          onClick={() => setSelectedContext({
                            type: 'task',
                            id: task.id,
                            title: task.title
                          })}
                        >
                          <CardContent className="py-3 px-4 flex items-center gap-3">
                            {task.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : task.status === 'in_progress' ? (
                              <Clock className="w-5 h-5 text-amber-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-500" />
                            )}
                            <span className="text-slate-300 flex-1">{task.title}</span>
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          </CardContent>
                        </Card>
                      ));
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Выберите блок или раздел для просмотра</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        {selectedContext && (
          <div className="w-96 border-l border-slate-800 p-4">
            <AIChatPanel
              contextType={selectedContext.type}
              contextId={selectedContext.id}
              contextTitle={selectedContext.title}
            />
          </div>
        )}
      </main>
    </div>
  );
}
