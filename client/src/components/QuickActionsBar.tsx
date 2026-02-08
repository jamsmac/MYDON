import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  Bot,
  Cpu,
} from "lucide-react";

type EntityType = "block" | "section" | "task";

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Sparkles;
  skillSlug: string; // Maps to ai_skills.slug
  color: string;
  description: string;
}

// Structured data types from skill execution
interface SubtaskItem {
  title: string;
  description?: string;
  estimatedHours?: number;
  priority?: "high" | "medium" | "low";
}

interface TaskItem {
  title: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  estimatedHours?: number;
}

interface SkillResult {
  success: boolean;
  content: string;
  structuredData?: {
    subtasks?: SubtaskItem[];
    tasks?: TaskItem[];
  };
  model: string;
  tokensUsed?: number;
  responseTimeMs: number;
  agentId?: number;
  skillId: number;
}

const BLOCK_ACTIONS: QuickAction[] = [
  { id: "block-roadmap", label: "Создать roadmap", icon: Target, skillSlug: "block-roadmap", color: "text-amber-400 hover:bg-amber-500/10", description: "AI создаст план реализации блока" },
  { id: "block-decompose", label: "Декомпозировать", icon: Split, skillSlug: "block-decompose", color: "text-emerald-400 hover:bg-emerald-500/10", description: "Разбить блок на разделы и задачи" },
  { id: "block-risks", label: "Оценить риски", icon: AlertTriangle, skillSlug: "block-risks", color: "text-red-400 hover:bg-red-500/10", description: "Найти потенциальные проблемы" },
  { id: "block-report", label: "Отчёт", icon: BarChart3, skillSlug: "block-report", color: "text-blue-400 hover:bg-blue-500/10", description: "Сформировать отчёт по блоку" },
];

const SECTION_ACTIONS: QuickAction[] = [
  { id: "section-tasks", label: "Создать задачи", icon: ListTodo, skillSlug: "section-tasks", color: "text-emerald-400 hover:bg-emerald-500/10", description: "AI предложит задачи для раздела" },
  { id: "section-plan", label: "Сгенерировать план", icon: ClipboardList, skillSlug: "section-plan", color: "text-amber-400 hover:bg-amber-500/10", description: "Создать план работ по разделу" },
  { id: "section-evaluate", label: "Оценить задачи", icon: BarChart3, skillSlug: "section-evaluate", color: "text-blue-400 hover:bg-blue-500/10", description: "Оценить все задачи раздела" },
  { id: "section-deps", label: "Найти зависимости", icon: Layers, skillSlug: "section-deps", color: "text-purple-400 hover:bg-purple-500/10", description: "Определить связи между задачами" },
];

const TASK_ACTIONS: QuickAction[] = [
  { id: "task-subtasks", label: "Подзадачи", icon: Split, skillSlug: "task-subtasks", color: "text-emerald-400 hover:bg-emerald-500/10", description: "Разбить на подзадачи" },
  { id: "task-estimate", label: "Оценить", icon: Zap, skillSlug: "task-estimate", color: "text-amber-400 hover:bg-amber-500/10", description: "Оценить сложность и сроки" },
  { id: "task-risks", label: "Риски", icon: AlertTriangle, skillSlug: "task-risks", color: "text-red-400 hover:bg-red-500/10", description: "Найти риски задачи" },
  { id: "task-spec", label: "ТЗ", icon: FileText, skillSlug: "task-spec", color: "text-blue-400 hover:bg-blue-500/10", description: "Написать техническое задание" },
  { id: "task-howto", label: "Как выполнить", icon: Lightbulb, skillSlug: "task-howto", color: "text-purple-400 hover:bg-purple-500/10", description: "Пошаговая инструкция" },
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
  const [skillResult, setSkillResult] = useState<SkillResult | null>(null);
  const [copied, setCopied] = useState(false);

  // For structured results (subtasks/tasks checkboxes)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Use skillExecution instead of aiEnhancements
  const executeSkill = trpc.skillExecution.execute.useMutation({
    onSuccess: (data) => {
      const result = data as SkillResult;
      setAiResult(result.content);
      setSkillResult(result);
      setResultDialogOpen(true);
      setActiveAction(null);

      // Pre-select all items if structured data
      if (result.structuredData?.subtasks) {
        setSelectedItems(new Set(result.structuredData.subtasks.map((_, i) => i)));
      } else if (result.structuredData?.tasks) {
        setSelectedItems(new Set(result.structuredData.tasks.map((_, i) => i)));
      }
    },
    onError: (error) => {
      toast.error(`Ошибка AI: ${error.message}`);
      setActiveAction(null);
    },
  });

  const actions = ACTION_MAP[entityType] || [];

  const handleAction = (action: QuickAction) => {
    setActiveAction(action.id);
    setAiResultTitle(action.label);
    setSkillResult(null);
    setSelectedItems(new Set());

    // Get selected model from localStorage if available
    const selectedModel = localStorage.getItem('selectedAIModel') || undefined;

    executeSkill.mutate({
      skillSlug: action.skillSlug,
      projectId,
      entityType,
      entityId,
      model: selectedModel,
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
            <DialogDescription className="text-slate-400 flex items-center gap-2">
              Результат AI-анализа
              {/* Agent and Model badges */}
              {skillResult && (
                <span className="flex items-center gap-1.5 ml-2">
                  {skillResult.agentId && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      <Bot className="w-3 h-3 mr-1" />
                      Агент #{skillResult.agentId}
                    </Badge>
                  )}
                  {skillResult.model && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      <Cpu className="w-3 h-3 mr-1" />
                      {skillResult.model.split('/').pop()}
                    </Badge>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            {/* Structured subtasks result */}
            {skillResult?.structuredData?.subtasks && skillResult.structuredData.subtasks.length > 0 ? (
              <div className="space-y-2 pr-2">
                <p className="text-sm text-slate-400 mb-3">
                  AI предложил {skillResult.structuredData.subtasks.length} подзадач:
                </p>
                {skillResult.structuredData.subtasks.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedItems.has(idx)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedItems);
                        if (checked) {
                          newSet.add(idx);
                        } else {
                          newSet.delete(idx);
                        }
                        setSelectedItems(newSet);
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium">{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.estimatedHours && (
                          <Badge variant="outline" className="text-xs border-slate-600">
                            {item.estimatedHours}ч
                          </Badge>
                        )}
                        {item.priority && (
                          <Badge
                            variant="outline"
                            className={cn("text-xs", {
                              "border-red-500 text-red-400": item.priority === "high",
                              "border-amber-500 text-amber-400": item.priority === "medium",
                              "border-slate-500 text-slate-400": item.priority === "low",
                            })}
                          >
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : skillResult?.structuredData?.tasks && skillResult.structuredData.tasks.length > 0 ? (
              <div className="space-y-2 pr-2">
                <p className="text-sm text-slate-400 mb-3">
                  AI предложил {skillResult.structuredData.tasks.length} задач:
                </p>
                {skillResult.structuredData.tasks.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedItems.has(idx)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedItems);
                        if (checked) {
                          newSet.add(idx);
                        } else {
                          newSet.delete(idx);
                        }
                        setSelectedItems(newSet);
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium">{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.estimatedHours && (
                          <Badge variant="outline" className="text-xs border-slate-600">
                            {item.estimatedHours}ч
                          </Badge>
                        )}
                        {item.priority && (
                          <Badge
                            variant="outline"
                            className={cn("text-xs", {
                              "border-red-500 text-red-400": item.priority === "critical",
                              "border-orange-500 text-orange-400": item.priority === "high",
                              "border-amber-500 text-amber-400": item.priority === "medium",
                              "border-slate-500 text-slate-400": item.priority === "low",
                            })}
                          >
                            {item.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none pr-2">
                <Streamdown>{aiResult}</Streamdown>
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between border-t border-slate-700 pt-3">
            <div className="flex gap-2">
              {/* Create selected items button */}
              {skillResult?.structuredData?.subtasks && selectedItems.size > 0 && (
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    // TODO: Create subtasks via mutation
                    toast.info(`Создание ${selectedItems.size} подзадач (в разработке)`);
                  }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Создать выбранные ({selectedItems.size})
                </Button>
              )}
              {skillResult?.structuredData?.tasks && selectedItems.size > 0 && onCreateTasks && (
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    const tasks = skillResult.structuredData!.tasks!;
                    const selectedTasks = Array.from(selectedItems).map(idx => ({
                      title: tasks[idx].title,
                      description: tasks[idx].description,
                    }));
                    onCreateTasks(selectedTasks);
                    setResultDialogOpen(false);
                    toast.success(`Создано ${selectedTasks.length} задач`);
                  }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Создать выбранные ({selectedItems.size})
                </Button>
              )}
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

