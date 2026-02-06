/**
 * AI Chat Page
 * Full-featured chat interface with session management and usage statistics
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Streamdown } from 'streamdown';
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  Edit2,
  MoreVertical,
  Bot,
  User,
  Zap,
  Clock,
  Database,
  Loader2,
  ChevronLeft,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { ModelSelector } from '@/components/ModelSelector';

type TaskType = 'chat' | 'reasoning' | 'coding' | 'vision' | 'translation' | 'summarization' | 'creative';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  fromCache?: boolean;
  executionTime?: number;
  timestamp: Date;
  isStreaming?: boolean;
}

const TASK_TYPE_OPTIONS: { value: TaskType; label: string; icon: string }[] = [
  { value: 'chat', label: 'Чат', icon: '💬' },
  { value: 'reasoning', label: 'Анализ', icon: '🧠' },
  { value: 'coding', label: 'Код', icon: '💻' },
  { value: 'translation', label: 'Перевод', icon: '🌐' },
  { value: 'summarization', label: 'Резюме', icon: '📝' },
  { value: 'creative', label: 'Креатив', icon: '✨' },
];

export default function AIChatPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // tRPC queries and mutations
  const utils = trpc.useUtils();
  
  const { data: sessions, isLoading: sessionsLoading } = trpc.aiRouter.getSessions.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const { data: usageStats } = trpc.aiRouter.getUsageStats.useQuery(
    { days: 30 },
    { enabled: !!user }
  );

  const { data: cacheStats } = trpc.aiRouter.getCacheStats.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: sessionMessages, isLoading: messagesLoading } = trpc.aiRouter.getSessionMessages.useQuery(
    { sessionId: currentSessionId!, limit: 100 },
    { enabled: !!currentSessionId && !!user }
  );

  const chatMutation = trpc.aiRouter.chat.useMutation({
    onSuccess: (response) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        model: response.model,
        fromCache: response.fromCache,
        executionTime: response.executionTime,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      utils.aiRouter.getSessions.invalidate();
      utils.aiRouter.getUsageStats.invalidate();
    },
    onError: (error) => {
      toast.error(`Ошибка AI: ${error.message}`);
    },
  });

  const createSessionMutation = trpc.aiRouter.createSession.useMutation({
    onSuccess: (data) => {
      setCurrentSessionId(data.sessionId);
      setMessages([]);
      utils.aiRouter.getSessions.invalidate();
      toast.success('Новый чат создан');
    },
  });

  const updateSessionMutation = trpc.aiRouter.updateSession.useMutation({
    onSuccess: () => {
      setEditingSessionId(null);
      utils.aiRouter.getSessions.invalidate();
      toast.success('Название обновлено');
    },
  });

  const deleteSessionMutation = trpc.aiRouter.deleteSession.useMutation({
    onSuccess: () => {
      if (currentSessionId === editingSessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      utils.aiRouter.getSessions.invalidate();
      toast.success('Чат удалён');
    },
  });

  // Load session messages when session changes
  useEffect(() => {
    if (sessionMessages) {
      const loadedMessages: Message[] = sessionMessages.flatMap((m) => [
        {
          id: `user-${m.id}`,
          role: 'user' as const,
          content: m.prompt,
          timestamp: new Date(m.createdAt || Date.now()),
        },
        {
          id: `assistant-${m.id}`,
          role: 'assistant' as const,
          content: m.response,
          model: m.model,
          fromCache: m.fromCache || false,
          executionTime: m.executionTime || undefined,
          timestamp: new Date(m.createdAt || Date.now()),
        },
      ]);
      setMessages(loadedMessages);
    }
  }, [sessionMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Streaming send handler
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = input.trim();
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    // Build messages array for context
    const contextMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    contextMessages.push({ role: 'user', content: messageContent });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextMessages,
          sessionId: currentSessionId || undefined,
          taskType,
        }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Stream failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let executionTime = 0;

      // Add placeholder assistant message
      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle done event
              if (data.type === 'done') {
                executionTime = data.executionTime || 0;
                continue;
              }
              
              // Handle error event
              if (data.type === 'error') {
                throw new Error(data.message || 'Stream error');
              }
              
              // Handle content delta
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setStreamingContent(fullContent);
                
                // Update the assistant message with new content
                setMessages(prev => prev.map(m => 
                  m.id === assistantId 
                    ? { ...m, content: fullContent }
                    : m
                ));
              }
            } catch (e) {
              // Skip malformed JSON
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Finalize the assistant message
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: fullContent, isStreaming: false, executionTime, model: 'gemini-2.5-flash' }
          : m
      ));

      // Invalidate queries to refresh stats
      utils.aiRouter.getSessions.invalidate();
      utils.aiRouter.getUsageStats.invalidate();

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Генерация отменена');
      } else {
        toast.error(`Ошибка AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Remove the streaming message on error
        setMessages(prev => prev.filter(m => !m.isStreaming));
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  }, [input, isStreaming, messages, currentSessionId, taskType, utils]);

  // Cancel streaming
  const handleCancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleNewChat = () => {
    createSessionMutation.mutate({ title: 'Новый чат' });
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('Удалить этот чат?')) {
      deleteSessionMutation.mutate({ sessionId });
    }
  };

  const handleUpdateSessionTitle = (sessionId: string) => {
    if (editingTitle.trim()) {
      updateSessionMutation.mutate({ sessionId, title: editingTitle.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <Bot className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Войдите для доступа к AI чату</h2>
        <Link href="/">
          <Button>На главную</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300',
          sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <Button
            onClick={handleNewChat}
            className="w-full gap-2"
            disabled={createSessionMutation.isPending}
          >
            <Plus className="w-4 h-4" />
            Новый чат
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions && sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                    currentSessionId === session.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleSelectSession(session.id)}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  {editingSessionId === session.id ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleUpdateSessionTitle(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateSessionTitle(session.id);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      className="h-6 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">
                      {session.title || 'Новый чат'}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setEditingTitle(session.title || '');
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Нет чатов. Создайте новый!
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Usage Stats */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <span>Статистика (30 дней)</span>
          </div>
          {usageStats && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground">Запросов</div>
                <div className="font-semibold">{usageStats.totals.requests}</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground">Из кеша</div>
                <div className="font-semibold">{usageStats.totals.cached}</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground">Токенов</div>
                <div className="font-semibold">{usageStats.totals.tokens.toLocaleString()}</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-muted-foreground">Стоимость</div>
                <div className="font-semibold">${usageStats.totals.cost.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-4 p-4 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <ChevronLeft className={cn('w-5 h-5 transition-transform', !sidebarOpen && 'rotate-180')} />
          </Button>
          
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">AI Ассистент</h1>
          </div>

          <div className="flex-1" />

          <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {cacheStats && (
            <Badge variant="outline" className="gap-1">
              <Database className="w-3 h-3" />
              {cacheStats.totalEntries} в кеше
            </Badge>
          )}

          <Link href="/">
            <Button variant="outline" size="sm">
              Назад
            </Button>
          </Link>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <Bot className="w-16 h-16 text-muted-foreground/50" />
              <div>
                <h2 className="text-xl font-semibold mb-2">Начните разговор</h2>
                <p className="text-muted-foreground max-w-md">
                  Задайте вопрос или выберите тип задачи для более точных ответов.
                  AI поддерживает анализ, написание кода, перевод и многое другое.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {TASK_TYPE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="sm"
                    onClick={() => setTaskType(option.value)}
                    className={cn(taskType === option.value && 'border-primary')}
                  >
                    {option.icon} {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Streamdown>{message.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {message.model && (
                          <Badge variant="secondary" className="text-xs">
                            {message.model}
                          </Badge>
                        )}
                        {message.fromCache && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Zap className="w-3 h-3" />
                            Кеш
                          </Badge>
                        )}
                        {message.executionTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {message.executionTime}ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.isStreaming && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Генерация...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите сообщение..."
                disabled={isStreaming}
                className="flex-1"
              />
              {isStreaming ? (
                <Button
                  onClick={handleCancelStream}
                  variant="destructive"
                  size="icon"
                  title="Отменить генерацию"
                >
                  <span className="w-3 h-3 bg-white rounded-sm" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={isStreaming}
                compact
              />
              <span className="text-xs text-muted-foreground">
                Enter для отправки • Shift+Enter для новой строки
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
