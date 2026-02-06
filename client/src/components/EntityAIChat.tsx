import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';
import {
  Sparkles,
  Loader2,
  Copy,
  Send,
  StopCircle,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface EntityAIChatProps {
  entityType: 'block' | 'section' | 'task';
  entityId: number;
  entityTitle: string;
  projectId: number;
  /** Quick prompts specific to this entity type */
  quickPrompts?: Array<{ label: string; prompt: string }>;
  /** Whether to start expanded */
  defaultExpanded?: boolean;
  /** Callback when AI generates content that can be used */
  onInsertResult?: (content: string) => void;
  /** Callback when AI generates content to save as document/summary */
  onSaveAsDocument?: (content: string) => void;
  /** Structured context about the entity (status, priority, deadline, etc.) */
  entityContext?: string;
}

const defaultBlockPrompts = (title: string) => [
  { label: 'Создать roadmap', prompt: `Создай детальный roadmap для блока "${title}" с этапами, сроками и метриками` },
  { label: 'Декомпозировать', prompt: `Разбей блок "${title}" на конкретные разделы и задачи с оценкой трудозатрат` },
  { label: 'Оценить риски', prompt: `Какие основные риски у блока "${title}" и как их минимизировать?` },
  { label: 'Сформировать отчёт', prompt: `Сформируй отчёт о текущем состоянии блока "${title}" с рекомендациями` },
];

const defaultSectionPrompts = (title: string) => [
  { label: 'Создать задачи', prompt: `Предложи список задач для раздела "${title}" с приоритетами и оценкой времени` },
  { label: 'Составить план', prompt: `Составь детальный план работ для раздела "${title}" с этапами и зависимостями` },
  { label: 'Оценить раздел', prompt: `Оцени текущее состояние раздела "${title}" и предложи улучшения` },
  { label: 'Найти зависимости', prompt: `Какие зависимости и блокеры могут быть у раздела "${title}"?` },
];

const defaultTaskPrompts = (title: string) => [
  { label: 'Разбить на подзадачи', prompt: `Разбей задачу "${title}" на конкретные подзадачи с оценкой времени` },
  { label: 'Оценить сложность', prompt: `Оцени сложность и трудозатраты задачи "${title}". Какие навыки нужны?` },
  { label: 'Найти риски', prompt: `Какие риски и блокеры могут возникнуть при выполнении задачи "${title}"?` },
  { label: 'Написать ТЗ', prompt: `Напиши техническое задание для задачи "${title}" с критериями приёмки` },
  { label: 'Как выполнить', prompt: `Опиши пошаговый план выполнения задачи "${title}" с рекомендациями и ресурсами` },
];

export function EntityAIChat({
  entityType,
  entityId,
  entityTitle,
  projectId,
  quickPrompts,
  defaultExpanded = true,
  onInsertResult,
  onSaveAsDocument,
  entityContext,
}: EntityAIChatProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompts = quickPrompts || (
    entityType === 'block' 
      ? defaultBlockPrompts(entityTitle) 
      : entityType === 'section' 
        ? defaultSectionPrompts(entityTitle) 
        : defaultTaskPrompts(entityTitle)
  );

  const { data: history, refetch } = trpc.chat.history.useQuery(
    { contextType: entityType, contextId: entityId, limit: 50 },
    { enabled: expanded }
  );

  // Sync history with local messages
  useEffect(() => {
    if (history) {
      setLocalMessages(history.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })));
    }
  }, [history]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [expanded]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isStreaming) return;
    const userMsg = message.trim();
    setMessage('');

    const tempId = Date.now();
    setLocalMessages(prev => [...prev, { id: tempId, role: 'user', content: userMsg }]);

    try {
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch('/api/trpc/chat.send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          "0": {
            json: {
              contextType: entityType,
              contextId: entityId,
              content: userMsg,
              projectContext: entityContext,
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
      abortControllerRef.current = null;
    }
  }, [message, isStreaming, entityType, entityId, entityContext, refetch]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Скопировано');
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-200">
            AI-ассистент
          </span>
          {localMessages.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
              {localMessages.filter(m => m.role === 'assistant').length} ответов
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-slate-700">
          {/* Messages area */}
          <div
            ref={scrollRef}
            className={cn(
              "overflow-y-auto px-4 py-3 space-y-3",
              localMessages.length > 0 ? "max-h-[350px] min-h-[120px]" : ""
            )}
          >
            {localMessages.length === 0 && !isStreaming && (
              <div className="py-2">
                <p className="text-xs text-slate-500 mb-3">
                  Задайте вопрос или выберите быстрое действие:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {prompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => setMessage(qp.prompt)}
                      className="text-left px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-amber-500/30 hover:bg-slate-800 transition-colors text-xs text-slate-300"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400 inline mr-1.5" />
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {localMessages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2",
                  msg.role === 'user'
                    ? "bg-amber-500/20 text-amber-100"
                    : "bg-slate-900/60 text-slate-200"
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="text-sm">
                      <Streamdown>{msg.content}</Streamdown>
                      {/* Action buttons under AI response */}
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700/50">
                        <button
                          onClick={() => handleCopy(msg.content)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-400 hover:bg-slate-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Копировать
                        </button>
                        {onInsertResult && (
                          <button
                            onClick={() => onInsertResult(msg.content)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            В заметки
                          </button>
                        )}
                        {onSaveAsDocument && (
                          <button
                            onClick={() => onSaveAsDocument(msg.content)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            Как документ
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-xl px-3 py-2 bg-slate-900/60 text-slate-200">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Думаю...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-slate-700/50">
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
                placeholder={entityType === 'block' ? 'Спросите AI о блоке...' : entityType === 'section' ? 'Спросите AI о разделе...' : 'Спросите AI о задаче...'}
                className="bg-slate-900/60 border-slate-600 text-white text-sm placeholder:text-slate-500"
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
        </div>
      )}
    </div>
  );
}
