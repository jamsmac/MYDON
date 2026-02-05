/**
 * FloatingAIChatContent - Chat interface content for the floating AI button
 * 
 * Features:
 * - Message history with AI/User distinction
 * - Streaming response support
 * - AIResponseActions integration
 * - Context badge showing loaded decisions
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
  RotateCcw
} from "lucide-react";
import { AIResponseActions } from "./AIResponseActions";
import { useAIContext } from "@/hooks/useAIContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  question?: string; // For AI responses, store the original question
}

interface FloatingAIChatContentProps {
  projectId?: number;
  taskId?: string;
  onNewMessage?: () => void;
  onContextLoaded?: (loaded: boolean) => void;
}

const STORAGE_KEY = "floating-ai-chat-messages";
const MAX_STORED_MESSAGES = 50;

export function FloatingAIChatContent({
  projectId,
  taskId,
  onNewMessage,
  onContextLoaded,
}: FloatingAIChatContentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Load messages from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages(parsed.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    try {
      const toStore = messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.error("Failed to save messages:", e);
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Chat mutation
  const chatMutation = trpc.aiRouter.quickChat.useMutation({
    onSuccess: (data) => {
      const lastUserMessage = messages.filter(m => m.role === "user").pop();
      
      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
        question: lastUserMessage?.content,
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
      onNewMessage?.();
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
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedInput,
      timestamp: new Date(),
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
  }, [input, isLoading, buildPromptWithContext, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("История очищена");
  };

  const handleCreateSubtask = (title: string) => {
    toast.info("Создание подзадачи", {
      description: `"${title.substring(0, 50)}..."`,
    });
    // TODO: Integrate with task creation
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Context Badge */}
      {(decisionCount > 0 || contextLoading) && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <Badge variant="secondary" className="gap-1 text-xs">
            {contextLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Загрузка контекста...
              </>
            ) : (
              <>
                <Brain className="h-3 w-3 text-purple-500" />
                {decisionCount} {decisionCount === 1 ? "решение" : 
                  decisionCount < 5 ? "решения" : "решений"} в контексте
              </>
            )}
          </Badge>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
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
                    {message.timestamp.toLocaleTimeString("ru-RU", {
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
            >
              <Trash2 className="h-3 w-3" />
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
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
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
