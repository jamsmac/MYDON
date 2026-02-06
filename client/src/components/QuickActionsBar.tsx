import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import {
  Sparkles,
  ListTodo,
  FileText,
  AlertTriangle,
  BarChart3,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Split,
  Target,
  Lightbulb,
  ClipboardList,
  Zap,
  Brain,
} from "lucide-react";

type EntityType = "block" | "section" | "task";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Sparkles;
  command: "summarize" | "analyze" | "suggest" | "risks";
  color: string;
  description: string;
}

const BLOCK_ACTIONS: QuickAction[] = [
  { id: "block-roadmap", label: "Создать roadmap", icon: Target, command: "suggest", color: "text-amber-400 hover:bg-amber-500/10", description: "AI создаст план реализации блока" },
  { id: "block-decompose", label: "Декомпозировать", icon: Split, command: "suggest", color: "text-emerald-400 hover:bg-emerald-500/10", description: "Разбить блок на разделы и задачи" },
  { id: "block-risks", label: "Оценить риски", icon: AlertTriangle, command: "risks", color: "text-red-400 hover:bg-red-500/10", description: "Найти потенциальные проблемы" },
  { id: "block-report", label: "Отчёт", icon: BarChart3, command: "summarize", color: "text-blue-400 hover:bg-blue-500/10", description: "Сформировать отчёт по блоку" },
];

const SECTION_ACTIONS: QuickAction[] = [
  { id: "section-tasks", label: "Создать задачи", icon: ListTodo, command: "suggest", color: "text-emerald-400 hover:bg-emerald-500/10", description: "AI предложит задачи для раздела" },
  { id: "section-plan", label: "Сгенерировать план", icon: ClipboardList, command: "suggest", color: "text-amber-400 hover:bg-amber-500/10", description: "Создать план работ по разделу" },
  { id: "section-evaluate", label: "Оценить задачи", icon: BarChart3, command: "analyze", color: "text-blue-400 hover:bg-blue-500/10", description: "Оценить все задачи раздела" },
  { id: "section-deps", label: "Найти зависимости", icon: Layers, command: "analyze", color: "text-purple-400 hover:bg-purple-500/10", description: "Определить связи между задачами" },
];

const TASK_ACTIONS: QuickAction[] = [
  { id: "task-subtasks", label: "Подзадачи", icon: Split, command: "suggest", color: "text-emerald-400 hover:bg-emerald-500/10", description: "Разбить на подзадачи" },
  { id: "task-estimate", label: "Оценить", icon: Zap, command: "analyze", color: "text-amber-400 hover:bg-amber-500/10", description: "Оценить сложность и сроки" },
  { id: "task-risks", label: "Риски", icon: AlertTriangle, command: "risks", color: "text-red-400 hover:bg-red-500/10", description: "Найти риски задачи" },
  { id: "task-spec", label: "ТЗ", icon: FileText, command: "suggest", color: "text-blue-400 hover:bg-blue-500/10", description: "Написать техническое задание" },
  { id: "task-howto", label: "Как выполнить", icon: Lightbulb, command: "suggest", color: "text-purple-400 hover:bg-purple-500/10", description: "Пошаговая инструкция" },
];

const ACTION_MAP: Record<EntityType, QuickAction[]> = {
  block: BLOCK_ACTIONS,
  section: SECTION_ACTIONS,
  task: TASK_ACTIONS,
};

interface QuickActionsBarProps {
  entityType: EntityType;
  entityId: number;
  projectId: number;
  blockId?: number;
  sectionId?: number;
  /** Callback to insert AI result into entity notes/description */
  onInsertResult?: (content: string) => void;
  /** Callback to create tasks from AI suggestions */
  onCreateTasks?: (tasks: Array<{ title: string; description?: string }>) => void;
  className?: string;
  compact?: boolean;
}

export function QuickActionsBar({
  entityType,
  entityId,
  projectId,
  blockId,
  sectionId,
  onInsertResult,
  onCreateTasks,
  className,
  compact = false,
}: QuickActionsBarProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [aiResultTitle, setAiResultTitle] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const processCommand = trpc.aiEnhancements.processCommand.useMutation({
    onSuccess: (data) => {
      setAiResult(data.result);
      setResultDialogOpen(true);
      setActiveAction(null);
    },
    onError: (error: any) => {
      toast.error(`Ошибка AI: ${error.message}`);
      setActiveAction(null);
    },
  });

  const actions = ACTION_MAP[entityType] || [];

  const handleAction = (action: QuickAction) => {
    setActiveAction(action.id);
    setAiResultTitle(action.label);
    
    // Map action to context-specific prompt
    const additionalContext = getAdditionalContext(action.id, entityType);
    
    processCommand.mutate({
      command: action.command,
      projectId,
      blockId: entityType === "block" ? entityId : blockId,
      sectionId: entityType === "section" ? entityId : sectionId,
      taskId: entityType === "task" ? entityId : undefined,
      additionalContext,
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Скопировано");
  };

  const handleInsert = () => {
    if (onInsertResult) {
      onInsertResult(aiResult);
      setResultDialogOpen(false);
      toast.success("Результат вставлен");
    }
  };

  return (
    <>
      <div className={cn(
        "flex flex-wrap gap-1.5",
        compact ? "gap-1" : "gap-1.5",
        className
      )}>
        {actions.map((action) => {
          const Icon = action.icon;
          const isActive = activeAction === action.id;
          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className={cn(
                "border-slate-600/50 bg-transparent transition-all",
                action.color,
                compact ? "h-7 px-2 text-xs" : "h-8 px-3 text-xs",
                isActive && "opacity-70"
              )}
              onClick={() => handleAction(action)}
              disabled={isActive}
              title={action.description}
            >
              {isActive ? (
                <Loader2 className={cn("animate-spin mr-1", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              ) : (
                <Icon className={cn("mr-1", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              )}
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* AI Result Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-amber-400" />
              {aiResultTitle}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Результат AI-анализа
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            <div className="prose prose-sm prose-invert max-w-none pr-2">
              <Streamdown>{aiResult}</Streamdown>
            </div>
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between border-t border-slate-700 pt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-2 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Копировать
              </Button>
              {onInsertResult && (
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                  onClick={handleInsert}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Вставить в заметки
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400"
              onClick={() => setResultDialogOpen(false)}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper to generate context-specific prompts
function getAdditionalContext(actionId: string, entityType: EntityType): string {
  switch (actionId) {
    case "block-roadmap":
      return "Создай детальный roadmap для этого блока. Включи этапы, сроки и ключевые вехи. Формат: markdown с таблицей.";
    case "block-decompose":
      return "Декомпозируй блок на разделы и задачи. Для каждого раздела предложи 3-5 задач. Формат: markdown со списками.";
    case "block-risks":
      return "Определи 5-7 ключевых рисков блока. Для каждого: описание, вероятность (высокая/средняя/низкая), влияние, стратегия митигации.";
    case "block-report":
      return "Сформируй краткий отчёт по блоку: прогресс, ключевые достижения, проблемы, следующие шаги.";
    case "section-tasks":
      return "Предложи 5-8 задач для этого раздела. Для каждой: название, описание, приоритет. Формат: нумерованный список.";
    case "section-plan":
      return "Создай план работ по разделу: последовательность задач, зависимости, оценка сроков. Формат: markdown.";
    case "section-evaluate":
      return "Оцени все задачи раздела: сложность (1-10), примерные сроки, необходимые ресурсы. Формат: таблица.";
    case "section-deps":
      return "Определи зависимости между задачами раздела. Какие задачи блокируют другие? Формат: список связей.";
    case "task-subtasks":
      return "Разбей задачу на 3-7 подзадач. Для каждой: название, описание, оценка времени. Формат: нумерованный список.";
    case "task-estimate":
      return "Оцени задачу: сложность (1-10), примерное время, необходимые навыки, возможные блокеры.";
    case "task-risks":
      return "Определи риски задачи: технические, организационные, внешние. Для каждого — стратегия митигации.";
    case "task-spec":
      return "Напиши техническое задание для задачи: цель, требования, критерии приёмки, ограничения.";
    case "task-howto":
      return "Объясни пошагово, как лучше выполнить эту задачу. Включи рекомендации и лучшие практики.";
    default:
      return "";
  }
}
