import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Lightbulb,
  FileText,
  ListTodo,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAssistantButtonProps {
  // Context for the AI assistant
  context?: {
    type: "project" | "block" | "section" | "task";
    id: number;
    title?: string;
    content?: string;
  };
  // Position of the button
  position?: "fixed" | "inline";
  // Custom class name
  className?: string;
  // Size variant
  size?: "sm" | "md" | "lg";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Quick action suggestions based on context
const getQuickActions = (contextType?: string) => {
  const baseActions = [
    { icon: Lightbulb, label: "Предложить идеи", prompt: "Предложи идеи для улучшения" },
    { icon: FileText, label: "Написать описание", prompt: "Напиши подробное описание" },
  ];

  switch (contextType) {
    case "project":
      return [
        ...baseActions,
        { icon: ListTodo, label: "Создать план", prompt: "Создай детальный план реализации проекта" },
        { icon: Wand2, label: "Анализ рисков", prompt: "Проанализируй возможные риски проекта" },
      ];
    case "block":
      return [
        ...baseActions,
        { icon: ListTodo, label: "Разбить на задачи", prompt: "Разбей этот этап на конкретные задачи" },
        { icon: Wand2, label: "Оценить сроки", prompt: "Оцени реалистичные сроки выполнения" },
      ];
    case "section":
      return [
        ...baseActions,
        { icon: ListTodo, label: "Добавить задачи", prompt: "Предложи задачи для этого раздела" },
      ];
    case "task":
      return [
        ...baseActions,
        { icon: ListTodo, label: "Создать подзадачи", prompt: "Разбей задачу на подзадачи" },
        { icon: Wand2, label: "Как выполнить?", prompt: "Объясни как лучше выполнить эту задачу" },
      ];
    default:
      return baseActions;
  }
};

export function AIAssistantButton({ 
  context, 
  position = "fixed", 
  className,
  size = "md"
}: AIAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const routeMutation = trpc.orchestrator.route.useMutation({
    onSuccess: (data) => {
      const responseContent = typeof data.response === 'string' 
        ? data.response 
        : JSON.stringify(data.response);
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsLoading(false);
    },
  });

  const handleSend = (customPrompt?: string) => {
    const messageText = customPrompt || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    routeMutation.mutate({
      message: messageText,
      context: context ? {
        type: context.type,
        id: context.id,
        content: context.content || context.title,
      } : undefined,
    });
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickActions = getQuickActions(context?.type);

  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-14 h-14",
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
          sizeClasses[size],
          position === "fixed" && "fixed bottom-6 right-6 z-50",
          className
        )}
        size="icon"
      >
        <Sparkles className={cn(iconSizes[size], "text-white")} />
      </Button>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent 
          className={cn(
            "p-0 gap-0 transition-all duration-300",
            isExpanded 
              ? "max-w-4xl h-[90vh]" 
              : "max-w-lg h-[600px]"
          )}
        >
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base">AI Ассистент</DialogTitle>
                {context && (
                  <p className="text-xs text-muted-foreground">
                    {context.type === "project" && "Проект: "}
                    {context.type === "block" && "Этап: "}
                    {context.type === "section" && "Раздел: "}
                    {context.type === "task" && "Задача: "}
                    {context.title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-6">
                {/* Welcome Message */}
                <div className="text-center py-8">
                  <div className="inline-flex p-4 rounded-full bg-gradient-to-r from-amber-500/20 to-emerald-500/20 mb-4">
                    <Sparkles className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Чем могу помочь?</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Я могу помочь с планированием, анализом, написанием текстов и многим другим
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">Быстрые действия</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-3 px-3"
                        onClick={() => handleSend(action.prompt)}
                      >
                        <action.icon className="w-4 h-4 mr-2 text-amber-400" />
                        <span className="text-sm">{action.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      message.role === "user" 
                        ? "bg-primary" 
                        : "bg-gradient-to-r from-amber-500 to-amber-600"
                    )}>
                      {message.role === "user" ? (
                        <User className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 max-w-[80%] rounded-lg px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      {message.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                      {message.role === "assistant" && (
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleCopy(message.content, message.id)}
                          >
                            {copiedId === message.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишите сообщение..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export a simple floating version for global use
export function FloatingAIButton() {
  return <AIAssistantButton position="fixed" size="lg" />;
}
