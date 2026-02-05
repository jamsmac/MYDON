/**
 * FloatingAIChatContent - Chat interface content for the floating AI button
 * 
 * Features:
 * - Message history with AI/User distinction
 * - Database persistence (saves across browser sessions)
 * - Streaming response support
 * - AIResponseActions integration
 * - Context badge showing loaded decisions
 * - Session management (list, switch, new chat)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  Send, 
  Loader2, 
  User, 
  Sparkles, 
  Brain,
  Trash2,
  MessageSquarePlus,
  History,
  ChevronLeft,
  Pin,
  Archive,
  MoreVertical,
  Check
} from "lucide-react";
import { AIResponseActions } from "./AIResponseActions";
import { SuggestedActions, parseActionsFromResponse, type SuggestedAction } from "./SuggestedActions";
import { useAIContext } from "@/hooks/useAIContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  question?: string; // For AI responses, store the original question
  suggestedActions?: SuggestedAction[]; // AI-generated action suggestions
  metadata?: {
    model?: string;
    tokens?: number;
    suggestedActions?: SuggestedAction[];
  };
}

interface Session {
  id: number;
  sessionUuid: string;
  title: string;
  messageCount: number;
  lastMessageAt: Date | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: Date;
}

interface FloatingAIChatContentProps {
  projectId?: number;
  taskId?: string;
  onNewMessage?: () => void;
  onContextLoaded?: (loaded: boolean) => void;
}

type ViewMode = "chat" | "sessions";

export function FloatingAIChatContent({
  projectId,
  taskId,
  onNewMessage,
  onContextLoaded,
}: FloatingAIChatContentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();

  // AI Context hook
  const { 
    contextString, 
    decisionCount, 
    isLoading: contextLoading,
    buildPromptWithContext 
  } = useAIContext({ projectId, taskId });

  // Notify parent about context status
  useEffect(() => {
    onContextLoaded?.(decisionCount > 0);
  }, [decisionCount, onContextLoaded]);

  // Get or create session mutation
  const getOrCreateSession = trpc.aiSession.getOrCreateSession.useMutation({
    onSuccess: (session) => {
      setCurrentSessionId(session.id);
    },
  });

  // Load messages query
  const messagesQuery = trpc.aiSession.getMessages.useQuery(
    { sessionId: currentSessionId!, limit: 100 },
    { 
      enabled: !!currentSessionId,
      staleTime: 10000,
    }
  );

  // Sessions list query
  const sessionsQuery = trpc.aiSession.listSessions.useQuery(
    { projectId, limit: 20 },
    { 
      enabled: viewMode === "sessions",
      staleTime: 30000,
    }
  );

  // Add message mutation
  const addMessageMutation = trpc.aiSession.addMessage.useMutation({
    onSuccess: () => {
      utils.aiSession.getMessages.invalidate({ sessionId: currentSessionId! });
    },
  });

  // Clear session mutation
  const clearSessionMutation = trpc.aiSession.clearSession.useMutation({
    onSuccess: () => {
      setMessages([]);
      utils.aiSession.getMessages.invalidate({ sessionId: currentSessionId! });
      toast.success("История очищена");
    },
  });

  // Update session mutation
  const updateSessionMutation = trpc.aiSession.updateSession.useMutation({
    onSuccess: () => {
      utils.aiSession.listSessions.invalidate();
    },
  });

  // Delete session mutation
  const deleteSessionMutation = trpc.aiSession.deleteSession.useMutation({
    onSuccess: () => {
      utils.aiSession.listSessions.invalidate();
      // If deleted current session, create new one
      if (currentSessionId) {
        setCurrentSessionId(null);
        getOrCreateSession.mutate({ projectId, taskId });
      }
    },
  });

  // Create new session mutation
  const createSessionMutation = trpc.aiSession.createSession.useMutation({
    onSuccess: (session) => {
      setCurrentSessionId(session.id);
      setMessages([]);
      setViewMode("chat");
      utils.aiSession.listSessions.invalidate();
    },
  });

  // Initialize session on mount or context change
  useEffect(() => {
    if (!currentSessionId) {
      getOrCreateSession.mutate({ projectId, taskId });
    }
  }, [projectId, taskId]);

  // Load messages when session changes
  useEffect(() => {
    if (messagesQuery.data) {
      const loadedMessages: Message[] = messagesQuery.data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt),
        metadata: m.metadata as Message["metadata"],
        suggestedActions: (m.metadata as any)?.suggestedActions,
      }));
      setMessages(loadedMessages);
    }
  }, [messagesQuery.data]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Suggested actions mutation
  const suggestedActionsMutation = trpc.aiDecision.generateSuggestedActions.useMutation();

  // Chat mutation
  const chatMutation = trpc.aiRouter.quickChat.useMutation({
    onSuccess: async (data) => {
      const lastUserMessage = messages.filter(m => m.role === "user").pop();
      
      // Parse actions from response (fast, local)
      const localActions = parseActionsFromResponse(data.content, taskId, projectId);
      
      // Save AI message to database
      if (currentSessionId) {
        const savedMessage = await addMessageMutation.mutateAsync({
          sessionId: currentSessionId,
          role: "assistant",
          content: data.content,
          metadata: {
            suggestedActions: localActions,
          },
        });

        const aiMessage: Message = {
          id: savedMessage.id,
          role: "assistant",
          content: data.content,
          createdAt: new Date(),
          question: lastUserMessage?.content,
          suggestedActions: localActions,
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
        onNewMessage?.();

        // Try to get AI-generated actions (slower, more accurate)
        try {
          const aiActions = await suggestedActionsMutation.mutateAsync({
            aiResponse: data.content,
            projectId,
            taskId,
          });
          
          if (aiActions && aiActions.length > 0) {
            // Update message with AI-generated actions
            setMessages(prev => prev.map(m => 
              m.id === savedMessage.id 
                ? { ...m, suggestedActions: aiActions }
                : m
            ));
          }
        } catch (error) {
          // Keep local actions if AI generation fails
          console.log("Using local action parsing");
        }
      }
    },
    onError: (error) => {
      toast.error("Ошибка AI", {
        description: error.message,
      });
      setIsLoading(false);
    },
  });

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || !currentSessionId) return;

    // Save user message to database first
    const savedUserMessage = await addMessageMutation.mutateAsync({
      sessionId: currentSessionId,
      role: "user",
      content: trimmedInput,
    });

    // Add user message to local state
    const userMessage: Message = {
      id: savedUserMessage.id,
      role: "user",
      content: trimmedInput,
      createdAt: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Build prompt with context
    const enhancedMessage = buildPromptWithContext(trimmedInput);

    // Send to AI
    chatMutation.mutate({
      message: enhancedMessage,
      taskType: "chat",
    });
  }, [input, isLoading, currentSessionId, buildPromptWithContext, chatMutation, addMessageMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    if (currentSessionId) {
      clearSessionMutation.mutate({ sessionId: currentSessionId });
    }
  };

  const handleNewChat = () => {
    createSessionMutation.mutate({ projectId, taskId });
  };

  const handleSelectSession = (session: Session) => {
    setCurrentSessionId(session.id);
    setViewMode("chat");
  };

  const handlePinSession = (sessionId: number, isPinned: boolean) => {
    updateSessionMutation.mutate({ sessionId, isPinned: !isPinned });
  };

  const handleArchiveSession = (sessionId: number) => {
    updateSessionMutation.mutate({ sessionId, isArchived: true });
    toast.success("Сессия архивирована");
  };

  const handleDeleteSession = (sessionId: number) => {
    deleteSessionMutation.mutate({ sessionId });
    toast.success("Сессия удалена");
  };

  const handleCreateSubtask = (title: string) => {
    toast.info("Создание подзадачи", {
      description: `"${title.substring(0, 50)}..."`,
    });
    // TODO: Integrate with task creation
  };

  // Sessions list view
  if (viewMode === "sessions") {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("chat")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-medium">История чатов</h3>
        </div>

        {/* Sessions list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessionsQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет сохраненных чатов</p>
              </div>
            ) : (
              sessionsQuery.data?.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                    currentSessionId === session.id && "bg-muted"
                  )}
                  onClick={() => handleSelectSession(session as Session)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {session.isPinned && (
                        <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate">{session.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.messageCount ?? 0} {(session.messageCount ?? 0) === 1 ? "сообщение" : 
                        (session.messageCount ?? 0) < 5 ? "сообщения" : "сообщений"}
                      {session.lastMessageAt && (
                        <> • {new Date(session.lastMessageAt).toLocaleDateString("ru-RU")}</>
                      )}
                    </p>
                  </div>
                  
                  {currentSessionId === session.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handlePinSession(session.id, session.isPinned ?? false);
                      }}>
                        <Pin className="h-4 w-4 mr-2" />
                        {session.isPinned ? "Открепить" : "Закрепить"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveSession(session.id);
                      }}>
                        <Archive className="h-4 w-4 mr-2" />
                        Архивировать
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* New chat button */}
        <div className="p-4 border-t border-border">
          <Button
            className="w-full gap-2"
            onClick={handleNewChat}
            disabled={createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
            Новый чат
          </Button>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Context Badge & Session Actions */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(decisionCount > 0 || contextLoading) && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {contextLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3 text-purple-500" />
                  {decisionCount} в контексте
                </>
              )}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode("sessions")}
            title="История чатов"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleNewChat}
            disabled={createSessionMutation.isPending}
            title="Новый чат"
          >
            {createSessionMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messagesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Ассистент</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Задайте вопрос о вашем проекте, задачах или попросите помощь с планированием.
              </p>
              {decisionCount > 0 && (
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
                  <Brain className="h-3 w-3 text-green-500" />
                  AI учитывает {decisionCount} прошлых решений
                </p>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-4 py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Streamdown>{message.content}</Streamdown>
                      
                      {/* Suggested Actions */}
                      {message.suggestedActions && message.suggestedActions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <SuggestedActions
                            actions={message.suggestedActions}
                            projectId={projectId}
                            taskId={taskId}
                            compact
                          />
                        </div>
                      )}
                      
                      {/* Quick Actions for AI responses */}
                      <AIResponseActions
                        question={message.question || ""}
                        aiResponse={message.content}
                        projectId={projectId}
                        taskId={taskId}
                        onCreateSubtask={handleCreateSubtask}
                        compact
                      />
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  <p className="text-xs opacity-50 mt-2">
                    {message.createdAt.toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="bg-muted rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Думаю...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-background">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={clearMessages}
              disabled={clearSessionMutation.isPending}
            >
              {clearSessionMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Очистить
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросите что-нибудь..."
            className="min-h-[44px] max-h-[120px] resize-none"
            disabled={isLoading || !currentSessionId}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !currentSessionId}
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Enter для отправки • Shift+Enter для новой строки
        </p>
      </div>
    </div>
  );
}

export default FloatingAIChatContent;
