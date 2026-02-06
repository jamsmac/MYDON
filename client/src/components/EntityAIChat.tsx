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
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
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
  { label: '💬 Обсудить', prompt: `Давай обсудим задачу "${title}". Какие ключевые вопросы нужно проработать? Предложи темы для обсуждения и возможные решения.` },
  { label: '🔍 Проработать', prompt: `Проведи глубокий анализ задачи "${title}". Исследуй тему, собери ключевые факты, лучшие практики и рекомендации.` },
  { label: '📄 Создать документ', prompt: `Создай структурированный документ по задаче "${title}". Включи цели, описание, требования, критерии приёмки и сроки.` },
  { label: '📊 Составить таблицу', prompt: `Составь таблицу (в формате Markdown) для задачи "${title}" с ключевыми параметрами, метриками, ответственными и сроками.` },
  { label: '📋 План действий', prompt: `Напиши пошаговый план действий для задачи "${title}" с конкретными шагами, ответственными, сроками и ожидаемыми результатами.` },
  { label: '📑 Подготовить презентацию', prompt: `Подготовь структуру презентации по задаче "${title}". Предложи слайды с заголовками, ключевыми тезисами и визуальными элементами.` },
  { label: '⚡ Подзадачи', prompt: `Разбей задачу "${title}" на конкретные подзадачи с оценкой времени и приоритетами.` },
  { label: '⚠️ Риски', prompt: `Какие риски и блокеры могут возникнуть при выполнении задачи "${title}"? Как их минимизировать?` },
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

    const tempUserId = `user-${Date.now()}`;
    setLocalMessages(prev => [...prev, { id: tempUserId, role: 'user', content: userMsg }]);

    const assistantId = `assistant-${Date.now()}`;

    try {
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Build messages array for the streaming endpoint
      // Include recent conversation history for context
      const conversationHistory = localMessages
        .filter(m => !m.isStreaming)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      // Build entity-specific system context
      let projectContext = '';
      if (entityContext) {
        projectContext = entityContext;
      }
      if (entityType && entityTitle) {
        const entityLabel = entityType === 'block' ? 'блок' : entityType === 'section' ? 'раздел' : 'задача';
        projectContext = `Текущий контекст: ${entityLabel} "${entityTitle}".\n${projectContext || ''}`;
      }

      const messages_payload = [
        ...conversationHistory,
        { role: 'user', content: userMsg },
      ];

      // Add empty streaming assistant message
      setLocalMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }]);

      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages_payload,
          taskType: 'chat',
          projectContext: projectContext || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка запроса');
      }

      if (!response.body) throw new Error('Нет тела ответа');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'done') continue;
              if (data.type === 'error') throw new Error(data.message);
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setLocalMessages(prev => prev.map(m =>
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

      // Mark streaming as complete
      setLocalMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: fullContent, isStreaming: false } : m
      ));

      // Also save the message via tRPC for persistence
      try {
        await fetch('/api/trpc/chat.send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            "0": {
              json: {
                contextType: entityType,
                contextId: entityId,
                content: userMsg,
                projectContext: projectContext || undefined,
                // Pass the AI response to save it in history
                _streamedResponse: fullContent,
              }
            }
          }),
        });
        refetch();
      } catch {
        // Non-critical: history save failed but user already has the response
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Mark partial content as complete on cancel
        setLocalMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, isStreaming: false, content: m.content || '*(Генерация отменена)*' }
            : m
        ));
        toast.info('Генерация отменена');
      } else {
        // Remove the empty assistant message on error
        setLocalMessages(prev => prev.filter(m => m.id !== assistantId));
        toast.error('Ошибка AI: ' + (error.message || 'Неизвестная ошибка'));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [message, isStreaming, entityType, entityId, entityTitle, entityContext, localMessages, refetch]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Скопировано');
  };

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prompt);
    // Auto-send after a short delay so user sees what's being sent
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-entity-ai-input]');
      if (input) {
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(event);
      }
    }, 100);
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
              {localMessages.filter(m => m.role === 'assistant' && !m.isStreaming).length} ответов
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 animate-pulse">
              генерация...
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
              localMessages.length > 0 ? "max-h-[400px] min-h-[120px]" : ""
            )}
          >
            {localMessages.length === 0 && !isStreaming && (
              <div className="py-2">
                <p className="text-xs text-slate-500 mb-3">
                  {entityType === 'task'
                    ? 'Выберите действие или задайте свой вопрос:'
                    : 'Задайте вопрос или выберите быстрое действие:'}
                </p>
                <div className={cn(
                  "grid gap-2",
                  entityType === 'task' ? "grid-cols-2" : "grid-cols-2"
                )}>
                  {prompts.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(qp.prompt)}
                      className="text-left px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-amber-500/30 hover:bg-slate-800 transition-colors text-xs text-slate-300"
                    >
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
                      {msg.content ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : msg.isStreaming ? (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Думаю...</span>
                        </div>
                      ) : null}
                      {/* Action buttons - only show when not streaming */}
                      {!msg.isStreaming && msg.content && (
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
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-slate-700/50">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                data-entity-ai-input
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
