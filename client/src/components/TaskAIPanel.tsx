import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';
import {
  MessageSquare,
  Loader2,
  Copy,
  Send,
  StopCircle,
  X,
  Sparkles,
  CheckCircle2,
  ListPlus,
  FileText,
  PenLine,
  Lightbulb,
  History,
  FolderOpen,
  ChevronDown,
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  provider?: string | null;
}

interface TaskAIPanelProps {
  open: boolean;
  onClose: () => void;
  taskId: number;
  taskTitle: string;
  taskDescription?: string | null;
  taskStatus?: string | null;
  taskPriority?: string | null;
  projectId: number;
  projectName: string;
  onAddToDescription?: (content: string) => void;
  onCreateSubtask?: (title: string) => void;
  onFinalize?: (content: string) => void;
}

export function TaskAIPanel({
  open,
  onClose,
  taskId,
  taskTitle,
  taskDescription,
  taskStatus,
  taskPriority,
  projectId,
  projectName,
  onAddToDescription,
  onCreateSubtask,
  onFinalize,
}: TaskAIPanelProps) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState('chat');
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: history, refetch } = trpc.chat.history.useQuery(
    { contextType: 'task', contextId: taskId, limit: 50 },
    { enabled: open }
  );

  // Sync history with local messages
  useEffect(() => {
    if (history) {
      setLocalMessages(history.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        provider: msg.provider,
      })));
    }
  }, [history]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, streamingContent]);

  // Focus input when panel opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = trpc.chat.send.useMutation();

  const handleSend = useCallback(async () => {
    if (!message.trim() || isStreaming) return;
    const userMsg = message.trim();
    setMessage('');

    const tempId = Date.now();
    setLocalMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg }]);

    try {
      setIsStreaming(true);
      setStreamingContent('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch('/api/trpc/chat.send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          "0": {
            json: {
              contextType: 'task',
              contextId: taskId,
              message: userMsg,
              stream: true,
            }
          }
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      const content = data?.[0]?.result?.data?.json?.content || data?.result?.data?.json?.content || '';

      setStreamingContent('');
      setLocalMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: content,
      }]);
      refetch();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error('Ошибка AI: ' + (error.message || 'Неизвестная ошибка'));
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  }, [message, isStreaming, taskId, refetch]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Скопировано');
  };

  const quickPrompts = [
    { label: 'Разбить на подзадачи', prompt: `Разбей задачу "${taskTitle}" на конкретные подзадачи с оценкой времени` },
    { label: 'Оценить сложность', prompt: `Оцени сложность задачи "${taskTitle}" по шкале 1-10 и объясни почему` },
    { label: 'Найти риски', prompt: `Какие риски и блокеры могут быть у задачи "${taskTitle}"?` },
    { label: 'Написать ТЗ', prompt: `Напиши техническое задание для задачи "${taskTitle}"` },
  ];

  // Decisions (AI suggestions)
  const decisions = localMessages
    .filter(m => m.role === 'assistant')
    .slice(-5)
    .map((m, i) => ({
      id: m.id,
      content: m.content.slice(0, 200),
      date: new Date(),
    }));

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-[420px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/95 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              AI &bull; {taskTitle}
            </h3>
            <p className="text-xs text-slate-500 truncate">{projectName}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Task Context Badge */}
      <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 flex-wrap shrink-0">
        {taskStatus && (
          <Badge variant="outline" className={cn(
            "text-xs",
            taskStatus === 'completed' && "border-emerald-500/30 text-emerald-400",
            taskStatus === 'in_progress' && "border-amber-500/30 text-amber-400",
            taskStatus === 'not_started' && "border-slate-500/30 text-slate-400",
          )}>
            {taskStatus === 'completed' ? 'Выполнена' : taskStatus === 'in_progress' ? 'В работе' : 'Не начата'}
          </Badge>
        )}
        {taskPriority && (
          <Badge variant="outline" className={cn(
            "text-xs",
            taskPriority === 'critical' && "border-red-500/30 text-red-400",
            taskPriority === 'high' && "border-orange-500/30 text-orange-400",
            taskPriority === 'medium' && "border-amber-500/30 text-amber-400",
            taskPriority === 'low' && "border-slate-500/30 text-slate-400",
          )}>
            {taskPriority === 'critical' ? 'Критический' : taskPriority === 'high' ? 'Высокий' : taskPriority === 'medium' ? 'Средний' : 'Низкий'}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full bg-slate-800/50 border-b border-slate-700 rounded-none h-10 shrink-0">
          <TabsTrigger value="chat" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            Чат
          </TabsTrigger>
          <TabsTrigger value="decisions" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <Lightbulb className="w-3.5 h-3.5 mr-1" />
            Решения
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <FolderOpen className="w-3.5 h-3.5 mr-1" />
            Файлы
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            <History className="w-3.5 h-3.5 mr-1" />
            История
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {localMessages.length === 0 && !isStreaming && (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-amber-400/30 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-4">
                  AI-ассистент в контексте задачи
                </p>
                {/* Quick Prompts */}
                <div className="space-y-2">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => { setMessage(qp.prompt); }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-amber-500/30 hover:bg-slate-800 transition-colors text-xs text-slate-300"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400 inline mr-2" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {localMessages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2",
                  msg.role === 'user'
                    ? "bg-amber-500/20 text-amber-100"
                    : "bg-slate-800 text-slate-200"
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="text-sm">
                      <Streamdown>{msg.content}</Streamdown>
                      {/* Quick Actions under AI response */}
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700">
                        {onFinalize && (
                          <button
                            onClick={() => onFinalize(msg.content)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Финализировать
                          </button>
                        )}
                        {onCreateSubtask && (
                          <button
                            onClick={() => {
                              // Extract first line as subtask title
                              const firstLine = msg.content.split('\n')[0].replace(/^[#*\-\d.]+\s*/, '').trim();
                              onCreateSubtask(firstLine.slice(0, 100));
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            <ListPlus className="w-3 h-3" />
                            Подзадачу
                          </button>
                        )}
                        {onAddToDescription && (
                          <button
                            onClick={() => onAddToDescription(msg.content)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            <PenLine className="w-3 h-3" />
                            В описание
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Копировать
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl px-3 py-2 bg-slate-800 text-slate-200">
                  {streamingContent ? (
                    <div className="text-sm">
                      <Streamdown>{streamingContent}</Streamdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Думаю...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Спросите AI о задаче..."
                className="bg-slate-800 border-slate-600 text-white text-sm placeholder:text-slate-500"
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button size="icon" variant="ghost" onClick={handleStop} className="text-red-400 hover:text-red-300 shrink-0">
                  <StopCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="icon" onClick={handleSend} disabled={!message.trim()} className="bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="flex-1 overflow-y-auto m-0 p-4">
          {decisions.length === 0 ? (
            <div className="text-center py-8">
              <Lightbulb className="w-8 h-8 text-cyan-400/30 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                AI решения появятся после диалога
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((d, i) => (
                <div key={d.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs text-slate-400">Решение #{i + 1}</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-4">{d.content}</p>
                  <div className="flex gap-1 mt-2">
                    {onFinalize && (
                      <button
                        onClick={() => onFinalize(d.content)}
                        className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      >
                        Применить
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(d.content)}
                      className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                    >
                      Копировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="flex-1 overflow-y-auto m-0 p-4">
          <div className="text-center py-8">
            <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-2">
              Файлы задачи
            </p>
            <p className="text-xs text-slate-500">
              Сохранённые AI-ответы и документы будут здесь
            </p>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 overflow-y-auto m-0 p-4">
          {localMessages.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                История диалогов пуста
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {localMessages.map((msg) => (
                <div key={msg.id} className="p-2 rounded-lg bg-slate-800/30 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      msg.role === 'user' ? "border-amber-500/30 text-amber-400" : "border-blue-500/30 text-blue-400"
                    )}>
                      {msg.role === 'user' ? 'Вы' : 'AI'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
