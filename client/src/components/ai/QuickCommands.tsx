import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  Loader2,
  FileText,
  Search,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface QuickCommandsProps {
  projectId: number;
  blockId?: number;
  sectionId?: number;
  taskId?: number;
  className?: string;
}

const commands = [
  {
    name: "summarize",
    label: "/summarize",
    description: "Краткое резюме",
    icon: FileText,
  },
  {
    name: "analyze",
    label: "/analyze",
    description: "SWOT анализ",
    icon: Search,
  },
  {
    name: "suggest",
    label: "/suggest",
    description: "Предложения",
    icon: Lightbulb,
  },
  {
    name: "risks",
    label: "/risks",
    description: "Анализ рисков",
    icon: AlertTriangle,
  },
] as const;

export function QuickCommands({
  projectId,
  blockId,
  sectionId,
  taskId,
  className,
}: QuickCommandsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");

  const processCommand = trpc.aiEnhancements.processCommand.useMutation({
    onSuccess: (data) => {
      setResult(data.result);
      setActiveCommand(data.command);
      toast.success(`Команда /${data.command} выполнена`);
    },
    onError: () => {
      toast.error("Ошибка при выполнении команды");
    },
  });

  const handleCommand = (command: typeof commands[number]["name"]) => {
    processCommand.mutate({
      command,
      projectId,
      blockId,
      sectionId,
      taskId,
      additionalContext: additionalContext || undefined,
    });
  };

  const contextLabel = taskId
    ? "задачи"
    : sectionId
    ? "секции"
    : blockId
    ? "блока"
    : "проекта";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          <Command className="h-4 w-4" />
          AI Команды
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Быстрые команды
              </CardTitle>
              {result && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setActiveCommand(null);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Анализ {contextLabel}
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {!result ? (
              <>
                {/* Command buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {commands.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <Button
                        key={cmd.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleCommand(cmd.name)}
                        disabled={processCommand.isPending}
                        className="justify-start gap-2 h-auto py-2"
                      >
                        <Icon className="h-4 w-4 text-amber-500" />
                        <div className="text-left">
                          <div className="font-mono text-xs">{cmd.label}</div>
                          <div className="text-xs text-slate-400">
                            {cmd.description}
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>

                {/* Additional context */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">
                    Дополнительный контекст (опционально)
                  </label>
                  <Input
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Например: фокус на сроках..."
                    className="h-8 text-sm"
                  />
                </div>

                {processCommand.isPending && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Result display */}
                <div className="p-3 rounded-lg bg-slate-800/50 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-amber-500">
                      /{activeCommand}
                    </span>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Streamdown>{result}</Streamdown>
                  </div>
                </div>

                {/* Run another command */}
                <div className="flex gap-2">
                  {commands.map((cmd) => (
                    <Button
                      key={cmd.name}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCommand(cmd.name)}
                      disabled={processCommand.isPending}
                      className="flex-1 text-xs"
                    >
                      {cmd.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
