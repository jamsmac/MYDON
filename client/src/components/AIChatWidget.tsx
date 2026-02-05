/**
 * AI Chat Widget
 * Floating button with popup quick input and dockable side panel
 * Best practices: accessible, keyboard shortcuts, smooth animations
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useOptionalProjectContext } from '@/contexts/ProjectContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Streamdown } from 'streamdown';
import {
  Bot,
  X,
  Send,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  PanelRightClose,
  Loader2,
  User,
  Sparkles,
  MessageSquare,
  Zap,
  Clock,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TaskType = 'chat' | 'reasoning' | 'coding' | 'translation' | 'summarization' | 'creative';
type ChatMode = 'closed' | 'popup' | 'docked' | 'fullscreen';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  executionTime?: number;
}

const TASK_OPTIONS: { value: TaskType; label: string; icon: string }[] = [
  { value: 'chat', label: 'Чат', icon: '💬' },
  { value: 'reasoning', label: 'Анализ', icon: '🧠' },
  { value: 'coding', label: 'Код', icon: '💻' },
  { value: 'translation', label: 'Перевод', icon: '🌐' },
  { value: 'summarization', label: 'Резюме', icon: '📝' },
  { value: 'creative', label: 'Креатив', icon: '✨' },
];

// Persist chat mode preference
const STORAGE_KEY = 'ai-chat-mode';
const getStoredMode = (): ChatMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['popup', 'docked', 'fullscreen'].includes(stored)) {
      return stored as ChatMode;
    }
  } catch {}
  return 'closed';
};

const setStoredMode = (mode: ChatMode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
};

export function AIChatWidget() {
  const { user } = useAuth();
  const projectContext = useOptionalProjectContext();
  const [mode, setMode] = useState<ChatMode>('closed');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (mode !== 'closed') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // Keyboard shortcut: Ctrl+K to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setMode(prev => prev === 'closed' ? 'popup' : 'closed');
      }
      if (e.key === 'Escape' && mode !== 'closed') {
        setMode('closed');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const changeMode = (newMode: ChatMode) => {
    setMode(newMode);
    if (newMode !== 'closed') {
      setStoredMode(newMode);
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming || !user) return;

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

    const contextMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    contextMessages.push({ role: 'user', content: messageContent });

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: contextMessages, 
          taskType,
          projectContext: projectContext?.getContextSummary() || undefined,
        }),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Stream failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let executionTime = 0;

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
              if (data.type === 'done') {
                executionTime = data.executionTime || 0;
                continue;
              }
              if (data.type === 'error') throw new Error(data.message);
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ));
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: fullContent, isStreaming: false, executionTime }
          : m
      ));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Генерация отменена');
      } else {
        toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Unknown'}`);
        setMessages(prev => prev.filter(m => !m.isStreaming));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [input, isStreaming, messages, taskType, user]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Чат очищен');
  };

  if (!user) return null;

  // Floating button (always visible when closed)
  const FloatingButton = () => (
    <button
      onClick={() => changeMode('popup')}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-14 h-14 rounded-full',
        'bg-gradient-to-br from-primary to-primary/80',
        'shadow-lg shadow-primary/25',
        'flex items-center justify-center',
        'hover:scale-110 active:scale-95',
        'transition-all duration-200',
        'group'
      )}
      title="AI Ассистент (Ctrl+K)"
    >
      <Bot className="w-6 h-6 text-primary-foreground group-hover:scale-110 transition-transform" />
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
    </button>
  );

  // Quick popup input (compact modal)
  const PopupChat = () => (
    <div className="fixed bottom-24 right-6 z-50 w-96 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">AI Ассистент</span>
            {projectContext?.currentProject && (
              <Badge variant="secondary" className="text-xs gap-1 max-w-[120px] truncate">
                <FolderKanban className="w-3 h-3" />
                {projectContext.currentProject.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => changeMode('docked')}
              title="Закрепить сбоку"
            >
              <PanelRightOpen className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => changeMode('fullscreen')}
              title="На весь экран"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setMode('closed')}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages (compact) */}
        <ScrollArea className="h-64">
          <div className="p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Задайте вопрос AI</p>
                <p className="text-xs mt-1">Ctrl+K для быстрого доступа</p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {msg.role === 'assistant' ? (
                      <Streamdown>{msg.content || '...'}</Streamdown>
                    ) : (
                      msg.content
                    )}
                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex gap-2">
            <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
              <SelectTrigger className="w-24 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.icon} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите запрос..."
              disabled={isStreaming}
              className="flex-1 h-9 text-sm"
            />
            {isStreaming ? (
              <Button size="icon" variant="destructive" className="h-9 w-9" onClick={handleCancel}>
                <span className="w-2.5 h-2.5 bg-white rounded-sm" />
              </Button>
            ) : (
              <Button size="icon" className="h-9 w-9" onClick={handleSend} disabled={!input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Docked side panel
  const DockedPanel = () => (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-96 bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">AI Ассистент</span>
          {projectContext?.currentProject && (
            <Badge variant="secondary" className="text-xs gap-1 max-w-[140px] truncate">
              <FolderKanban className="w-3 h-3" />
              {projectContext.currentProject.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Очистить">
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMode('fullscreen')} title="Развернуть">
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMode('popup')} title="Свернуть">
            <PanelRightClose className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMode('closed')}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Начните разговор</p>
              <p className="text-sm mt-1">Выберите тип задачи для лучших результатов</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {TASK_OPTIONS.map(opt => (
                  <Badge
                    key={opt.value}
                    variant={taskType === opt.value ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setTaskType(opt.value)}
                  >
                    {opt.icon} {opt.label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  msg.role === 'user' ? 'bg-primary' : 'bg-primary/10'
                )}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-primary-foreground" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {msg.role === 'assistant' ? (
                    <Streamdown>{msg.content || '...'}</Streamdown>
                  ) : (
                    msg.content
                  )}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-5 bg-primary/50 animate-pulse ml-1" />
                  )}
                  {msg.executionTime && !msg.isStreaming && (
                    <div className="flex items-center gap-1 mt-2 text-xs opacity-60">
                      <Clock className="w-3 h-3" />
                      {msg.executionTime}ms
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите запрос..."
            disabled={isStreaming}
            className="flex-1"
          />
          {isStreaming ? (
            <Button variant="destructive" size="icon" onClick={handleCancel}>
              <span className="w-3 h-3 bg-white rounded-sm" />
            </Button>
          ) : (
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Fullscreen mode
  const FullscreenPanel = () => (
    <div className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">AI Ассистент</h1>
          {projectContext?.currentProject && (
            <Badge variant="secondary" className="text-sm gap-1.5">
              <FolderKanban className="w-4 h-4" />
              {projectContext.currentProject.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={clearChat}>
            Очистить
          </Button>
          <Button variant="ghost" size="icon" onClick={() => changeMode('docked')} title="Закрепить сбоку">
            <PanelRightOpen className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => changeMode('popup')} title="Свернуть">
            <Minimize2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMode('closed')}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[calc(100vh-160px)]">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <Bot className="w-20 h-20 mx-auto mb-6 opacity-20" />
              <h2 className="text-2xl font-semibold mb-2">Чем могу помочь?</h2>
              <p className="mb-6">Выберите тип задачи или просто задайте вопрос</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {TASK_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    variant={taskType === opt.value ? 'default' : 'outline'}
                    onClick={() => setTaskType(opt.value)}
                  >
                    {opt.icon} {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={cn('flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  msg.role === 'user' ? 'bg-primary' : 'bg-primary/10'
                )}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-primary-foreground" />
                  ) : (
                    <Bot className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className={cn(
                  'max-w-[75%] rounded-2xl px-5 py-4',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Streamdown>{msg.content || '...'}</Streamdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-5 bg-primary/50 animate-pulse ml-1" />
                  )}
                  {msg.executionTime && !msg.isStreaming && (
                    <div className="flex items-center gap-1 mt-3 text-xs opacity-60">
                      <Clock className="w-3 h-3" />
                      {msg.executionTime}ms
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите ваш запрос..."
            disabled={isStreaming}
            className="flex-1 h-12 text-base"
          />
          {isStreaming ? (
            <Button variant="destructive" size="lg" onClick={handleCancel}>
              <span className="w-4 h-4 bg-white rounded-sm mr-2" />
              Отмена
            </Button>
          ) : (
            <Button size="lg" onClick={handleSend} disabled={!input.trim()}>
              <Send className="w-5 h-5 mr-2" />
              Отправить
            </Button>
          )}
        </div>
        <p className="max-w-4xl mx-auto text-center text-xs text-muted-foreground mt-2">
          Enter для отправки • Ctrl+K для быстрого доступа • Esc для закрытия
        </p>
      </div>
    </div>
  );

  return (
    <>
      {mode === 'closed' && <FloatingButton />}
      {mode === 'popup' && (
        <>
          <FloatingButton />
          <PopupChat />
        </>
      )}
      {mode === 'docked' && <DockedPanel />}
      {mode === 'fullscreen' && <FullscreenPanel />}
    </>
  );
}
