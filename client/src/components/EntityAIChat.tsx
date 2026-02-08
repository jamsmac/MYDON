import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';
import { useEntityAIChatStore } from '@/contexts/EntityAIChatStore';
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
  Trash2,
  Paperclip,
  Upload,
  FolderOpen,
  X,
  ClipboardPaste,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileUploadZone, AttachmentChip } from '@/components/attachments';

interface MessageMetadata {
  agentName?: string | null;
  agentId?: number | null;
  model?: string | null;
  executionTime?: number;
}

interface Message {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  metadata?: MessageMetadata;
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
  { label: '📎 Анализ документов', prompt: `Проанализируй прикреплённые документы блока "${title}" и сделай выводы, рекомендации и план действий` },
];

const defaultSectionPrompts = (title: string) => [
  { label: 'Создать задачи', prompt: `Предложи список задач для раздела "${title}" с приоритетами и оценкой времени` },
  { label: 'Составить план', prompt: `Составь детальный план работ для раздела "${title}" с этапами и зависимостями` },
  { label: 'Оценить раздел', prompt: `Оцени текущее состояние раздела "${title}" и предложи улучшения` },
  { label: 'Найти зависимости', prompt: `Какие зависимости и блокеры могут быть у раздела "${title}"?` },
  { label: '📎 Анализ материалов', prompt: `Изучи прикреплённые материалы раздела "${title}" и предложи конкретные задачи на их основе` },
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
  { label: '📎 Анализ файлов', prompt: `Проанализируй прикреплённые файлы задачи "${title}". Сделай саммари, выдели ключевые моменты и сформируй рекомендации.` },
  { label: '📎 План из документа', prompt: `На основе прикреплённых документов создай пошаговый план действий для задачи "${title}" с ответственными и сроками.` },
];

// Mapping from quick prompt labels to skill slugs for skill-based execution
const PROMPT_TO_SKILL: Record<string, string> = {
  // Block prompts
  'Создать roadmap': 'block-roadmap',
  'Декомпозировать': 'block-decompose',
  'Оценить риски': 'block-risks',
  'Сформировать отчёт': 'block-report',
  // Section prompts
  'Создать задачи': 'section-tasks',
  'Составить план': 'section-plan',
  'Оценить раздел': 'section-evaluate',
  'Найти зависимости': 'section-deps',
  // Task prompts
  '💬 Обсудить': 'task-discuss',
  '🔍 Проработать': 'task-research',
  '📄 Создать документ': 'task-document',
  '📊 Составить таблицу': 'task-table',
  '📋 План действий': 'task-actionplan',
  '📑 Подготовить презентацию': 'task-presentation',
  '⚡ Подзадачи': 'task-subtasks',
  '⚠️ Риски': 'task-risks',
};

// Attached file for AI context
interface AttachedFile {
  id: number;
  fileName: string;
  fileUrl: string | null;
  mimeType: string;
  fileSize: number;
  content?: string; // Text content for text files
}

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
  const [initialized, setInitialized] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachPopover, setShowAttachPopover] = useState(false);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pastedContext, setPastedContext] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use the shared store for cross-entity persistence
  const chatStore = useEntityAIChatStore();

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

  // Get entity attachments for selection
  const { data: entityAttachments } = trpc.attachments.list.useQuery(
    { entityType, entityId },
    { enabled: expanded }
  );

  // Get attachment settings for AI content limit
  const { data: attachmentSettings } = trpc.attachments.getSettings.useQuery(
    undefined,
    { enabled: expanded }
  );

  // Initialize messages: first from store (instant), then merge with DB history
  useEffect(() => {
    const storedMessages = chatStore.getMessages(entityType, entityId);
    if (storedMessages.length > 0) {
      setLocalMessages(storedMessages);
      setInitialized(true);
    }
  }, [entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge DB history with stored messages (DB may have older messages not in store)
  useEffect(() => {
    if (!history || history.length === 0) {
      if (!initialized) setInitialized(true);
      return;
    }
    
    const dbMessages: Message[] = history.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    setLocalMessages(prev => {
      // If we have no local messages yet, use DB history
      if (prev.length === 0) return dbMessages;

      // Merge: keep DB messages that aren't already in local, then append local-only messages
      const dbIds = new Set(dbMessages.map(m => String(m.id)));
      const localIds = new Set(prev.map(m => String(m.id)));
      
      // DB messages not in local
      const newFromDb = dbMessages.filter(m => !localIds.has(String(m.id)));
      // Local messages not in DB (session-only, e.g. from streaming)
      const localOnly = prev.filter(m => !dbIds.has(String(m.id)));
      
      // Combine: DB history first, then local-only additions
      if (newFromDb.length === 0) return prev; // No new DB messages
      
      return [...dbMessages, ...localOnly];
    });
    setInitialized(true);
  }, [history]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist messages to store whenever they change (debounced via effect)
  useEffect(() => {
    if (initialized && localMessages.length > 0) {
      chatStore.setMessages(entityType, entityId, localMessages);
    }
  }, [localMessages, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build file context for AI
  const buildFileContext = useCallback(() => {
    if (attachedFiles.length === 0) return '';

    const maxContentKB = attachmentSettings?.maxFileContentForAI_KB ?? 100;
    const maxContentBytes = maxContentKB * 1024;
    const textMimeTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];

    const fileContextParts: string[] = [];

    for (const file of attachedFiles) {
      const isTextFile = textMimeTypes.some(t => file.mimeType.startsWith(t.split('/')[0]) || file.mimeType === t);
      const isSmallEnough = file.fileSize <= maxContentBytes;

      if (isTextFile && isSmallEnough && file.content) {
        fileContextParts.push(
          `--- Содержимое файла "${file.fileName}" ---\n${file.content}\n---`
        );
      } else {
        const sizeStr = file.fileSize < 1024 * 1024
          ? `${(file.fileSize / 1024).toFixed(1)} KB`
          : `${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`;
        fileContextParts.push(
          `[Прикреплён файл: "${file.fileName}" (${file.mimeType}, ${sizeStr})]`
        );
      }
    }

    return fileContextParts.join('\n\n');
  }, [attachedFiles, attachmentSettings]);

  const handleSend = useCallback(async () => {
    const hasText = message.trim().length > 0;
    const hasFiles = attachedFiles.length > 0;
    if ((!hasText && !hasFiles) || isStreaming) return;

    // Build user message with file context
    let userMsg = message.trim();
    const fileContext = buildFileContext();

    // If only files, add a default prompt
    if (!hasText && hasFiles) {
      userMsg = 'Проанализируй прикреплённые файлы и дай рекомендации.';
    }

    if (fileContext) {
      userMsg = `${userMsg}\n\n${fileContext}`;
    }

    // Store display message (what user sees in chat)
    const displayMessage = hasText ? message.trim() : `📎 Прикреплено файлов: ${attachedFiles.length}`;

    setMessage('');
    setAttachedFiles([]); // Clear attached files after sending

    const tempUserId = `user-${Date.now()}`;
    // Show display message in UI (without file context)
    setLocalMessages(prev => [...prev, { id: tempUserId, role: 'user', content: displayMessage }]);

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

      // Get selected model from localStorage
      const selectedModel = localStorage.getItem('selectedAIModel') || undefined;

      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages_payload,
          taskType: 'chat',
          projectContext: projectContext || undefined,
          model: selectedModel,
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
      let messageMetadata: MessageMetadata | undefined;

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
                // Capture agent metadata from final event
                messageMetadata = {
                  agentName: data.agentName,
                  agentId: data.agentId,
                  model: data.model,
                  executionTime: data.executionTime,
                };
                continue;
              }
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

      // Mark streaming as complete with metadata
      setLocalMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: fullContent, isStreaming: false, metadata: messageMetadata } : m
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
  }, [message, isStreaming, entityType, entityId, entityTitle, entityContext, localMessages, refetch, buildFileContext, attachedFiles]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Скопировано');
  };

  const handleClearChat = () => {
    setLocalMessages([]);
    chatStore.clearMessages(entityType, entityId);
    toast.success('Чат очищен');
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

  // Handle file attachment from new upload
  const handleAttachFromUpload = async (attachment: { id: number; fileName: string; fileUrl: string | null; mimeType: string; fileSize: number }) => {
    // Check if already attached
    if (attachedFiles.some(f => f.id === attachment.id)) {
      toast.info('Файл уже прикреплён');
      return;
    }

    // Get file content for text files
    let content: string | undefined;
    const textMimeTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    const maxContentKB = attachmentSettings?.maxFileContentForAI_KB ?? 100;
    const isTextFile = textMimeTypes.some(t => attachment.mimeType.startsWith(t.split('/')[0]) || attachment.mimeType === t);
    const isSmallEnough = attachment.fileSize <= maxContentKB * 1024;

    if (isTextFile && isSmallEnough) {
      try {
        const result = await fetch(`/api/attachments/${attachment.id}/content`, {
          credentials: 'include',
        });
        if (result.ok) {
          content = await result.text();
        }
      } catch {
        // Non-critical: continue without content
      }
    }

    setAttachedFiles(prev => [...prev, {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      content,
    }]);
    setShowAttachPopover(false);
    toast.success('Файл прикреплён к сообщению');
  };

  // Handle file attachment from existing entity attachments
  const handleAttachFromExisting = async (att: NonNullable<typeof entityAttachments>[number]) => {
    // Check if already attached
    if (attachedFiles.some(f => f.id === att.id)) {
      toast.info('Файл уже прикреплён');
      return;
    }

    // Get file content for text files
    let content: string | undefined;
    const textMimeTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    const maxContentKB = attachmentSettings?.maxFileContentForAI_KB ?? 100;
    const isTextFile = textMimeTypes.some(t => att.mimeType.startsWith(t.split('/')[0]) || att.mimeType === t);
    const isSmallEnough = att.fileSize <= maxContentKB * 1024;

    if (isTextFile && isSmallEnough) {
      try {
        const result = await fetch(`/api/attachments/${att.id}/content`, {
          credentials: 'include',
        });
        if (result.ok) {
          content = await result.text();
        }
      } catch {
        // Non-critical: continue without content
      }
    }

    setAttachedFiles(prev => [...prev, {
      id: att.id,
      fileName: att.fileName,
      fileUrl: att.fileUrl,
      mimeType: att.mimeType,
      fileSize: att.fileSize,
      content,
    }]);
    setShowAttachPopover(false);
    toast.success('Файл прикреплён к сообщению');
  };

  // Remove attached file
  const removeAttachedFile = (id: number) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Handle paste context from external AI
  const handlePasteContext = () => {
    if (!pastedContext.trim()) {
      toast.error('Вставьте текст контекста');
      return;
    }

    // Add as an assistant message with special metadata
    const contextMessage: Message = {
      id: `imported-${Date.now()}`,
      role: 'assistant',
      content: pastedContext.trim(),
      metadata: {
        agentName: 'Импорт',
        model: 'external',
      },
    };

    setLocalMessages(prev => [...prev, contextMessage]);
    setPastedContext('');
    setShowPasteDialog(false);
    toast.success('Контекст добавлен в чат');
  };

  // Paste from clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedContext(text);
        toast.success('Текст вставлен из буфера обмена');
      }
    } catch {
      toast.error('Не удалось прочитать буфер обмена');
    }
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
                      {/* Agent metadata */}
                      {!msg.isStreaming && msg.metadata?.agentName && (
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                          <span>🤖 {msg.metadata.agentName}</span>
                          {msg.metadata.model && (
                            <span>· {msg.metadata.model.split('/').pop()}</span>
                          )}
                          {msg.metadata.executionTime && (
                            <span>· {msg.metadata.executionTime}ms</span>
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
          <div className="px-4 py-3 border-t border-slate-700/50 space-y-2">
            {/* Attached files display */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachedFiles.map((file) => (
                  <AttachmentChip
                    key={file.id}
                    id={file.id}
                    fileName={file.fileName}
                    mimeType={file.mimeType}
                    fileSize={file.fileSize}
                    fileUrl={file.fileUrl}
                    canDelete
                    onDelete={() => removeAttachedFile(file.id)}
                  />
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* Attach file button */}
              <Popover open={showAttachPopover} onOpenChange={setShowAttachPopover}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "text-slate-400 hover:text-amber-400 shrink-0",
                      attachedFiles.length > 0 && "text-amber-400"
                    )}
                    aria-label={`Прикрепить файл${attachedFiles.length > 0 ? ` (прикреплено: ${attachedFiles.length})` : ''}`}
                    disabled={isStreaming}
                  >
                    <Paperclip className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3 bg-slate-800 border-slate-700" align="start">
                  <div className="space-y-3">
                    {/* Upload new file */}
                    <div>
                      <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        Загрузить файл
                      </p>
                      <FileUploadZone
                        projectId={projectId}
                        entityType={entityType}
                        entityId={entityId}
                        onUploadComplete={handleAttachFromUpload}
                        mode="compact"
                      />
                    </div>

                    {/* Select from existing attachments */}
                    {entityAttachments && entityAttachments.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" />
                          Прикреплённые файлы
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {entityAttachments.map((att: { id: number; fileName: string; fileUrl: string | null; mimeType: string; fileSize: number }) => (
                            <button
                              key={att.id}
                              onClick={() => handleAttachFromExisting(att)}
                              disabled={attachedFiles.some(f => f.id === att.id)}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                                attachedFiles.some(f => f.id === att.id)
                                  ? "bg-amber-500/10 text-amber-400 cursor-not-allowed"
                                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                              )}
                            >
                              <span className="truncate block">{att.fileName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No attachments hint */}
                    {(!entityAttachments || entityAttachments.length === 0) && (
                      <p className="text-xs text-slate-500">
                        Нет прикреплённых файлов. Загрузите новый файл выше.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

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
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleStop}
                  className="text-red-400 hover:text-red-300 shrink-0"
                  aria-label="Остановить генерацию"
                >
                  <StopCircle className="w-4 h-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!message.trim() && attachedFiles.length === 0}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 shrink-0"
                  aria-label="Отправить сообщение"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </Button>
              )}
              {/* Paste context button */}
              {!isStreaming && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowPasteDialog(true)}
                  className="text-slate-500 hover:text-blue-400 shrink-0"
                  aria-label="Вставить контекст из внешнего AI"
                >
                  <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
                </Button>
              )}
              {/* Clear chat button - only show when there are messages */}
              {localMessages.length > 0 && !isStreaming && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleClearChat}
                  className="text-slate-500 hover:text-red-400 shrink-0"
                  aria-label="Очистить историю чата"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paste Context Dialog */}
      <Dialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
        <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ClipboardPaste className="w-5 h-5 text-blue-400" />
              Вставить контекст из внешнего AI
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Вставьте ответ от ChatGPT, Claude или другого AI для продолжения работы
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Текст контекста
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasteFromClipboard}
                  className="h-7 text-xs border-slate-600"
                >
                  <ClipboardPaste className="w-3 h-3 mr-1" />
                  Вставить из буфера
                </Button>
              </div>
              <textarea
                value={pastedContext}
                onChange={(e) => setPastedContext(e.target.value)}
                placeholder="Вставьте сюда текст от внешнего AI...&#10;&#10;Это может быть:&#10;- Результат исследования&#10;- Сгенерированный документ&#10;- Анализ или рекомендации&#10;- Любой другой полезный контент"
                rows={10}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <p className="text-xs text-slate-500">
                Контекст будет добавлен в историю чата и учтён в последующих запросах
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasteDialog(false);
                setPastedContext('');
              }}
              className="border-slate-600"
            >
              Отмена
            </Button>
            <Button
              onClick={handlePasteContext}
              disabled={!pastedContext.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Добавить контекст
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
