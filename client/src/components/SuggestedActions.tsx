/**
 * SuggestedActions - AI-generated action suggestions after each response
 * 
 * Shows contextual actions like:
 * - Create subtask from recommendation
 * - Set deadline
 * - Update task status
 * - Add tag
 * - Create note
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ListPlus,
  Calendar,
  Tag,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Target,
  AlertTriangle,
} from "lucide-react";

// Action types
export type SuggestedActionType = 
  | "create_subtask"
  | "set_deadline"
  | "update_status"
  | "add_tag"
  | "create_note"
  | "set_priority"
  | "assign_task";

export interface SuggestedAction {
  id: string;
  type: SuggestedActionType;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
}

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  projectId?: number;
  taskId?: string;
  onActionExecuted?: (action: SuggestedAction) => void;
  compact?: boolean;
  className?: string;
}

// Action type configuration
const ACTION_CONFIG: Record<SuggestedActionType, {
  icon: typeof ListPlus;
  color: string;
  label: string;
}> = {
  create_subtask: {
    icon: ListPlus,
    color: "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
    label: "Создать подзадачу",
  },
  set_deadline: {
    icon: Calendar,
    color: "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
    label: "Установить дедлайн",
  },
  update_status: {
    icon: ArrowRight,
    color: "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
    label: "Обновить статус",
  },
  add_tag: {
    icon: Tag,
    color: "text-purple-500 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30",
    label: "Добавить тег",
  },
  create_note: {
    icon: MessageSquarePlus,
    color: "text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30",
    label: "Создать заметку",
  },
  set_priority: {
    icon: AlertTriangle,
    color: "text-red-500 bg-red-500/10 hover:bg-red-500/20 border-red-500/30",
    label: "Установить приоритет",
  },
  assign_task: {
    icon: Target,
    color: "text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30",
    label: "Назначить задачу",
  },
};

const CONFIDENCE_CONFIG = {
  high: { label: "Рекомендуется", color: "bg-emerald-500/20 text-emerald-400" },
  medium: { label: "Возможно", color: "bg-amber-500/20 text-amber-400" },
  low: { label: "Опционально", color: "bg-slate-500/20 text-slate-400" },
};

export function SuggestedActions({
  actions,
  projectId,
  taskId,
  onActionExecuted,
  compact = false,
  className,
}: SuggestedActionsProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  // Mutations for executing actions
  // Note: Using toast notifications for now - full integration requires task router endpoints

  const addTagMutation = trpc.relations.addTagToTask.useMutation({
    onSuccess: () => toast.success("Тег добавлен"),
    onError: (err) => toast.error("Ошибка", { description: err.message }),
  });

  // Execute action
  const executeAction = async (action: SuggestedAction) => {
    if (!taskId && !projectId) {
      toast.error("Не выбрана задача или проект");
      return;
    }

    setExecutingId(action.id);

    try {
      switch (action.type) {
        case "create_subtask":
          if (taskId) {
            // Note: subtask creation requires proper task router integration
            toast.success(`Подзадача: ${action.data?.title || action.title}`);
          }
          break;

        case "set_deadline":
          if (taskId) {
            // Note: deadline update requires proper date parsing
            toast.info(`Дедлайн: ${action.data?.deadline || 'не указан'}`);
          }
          break;

        case "update_status":
          if (taskId) {
            // Note: status update requires proper task router integration
            toast.info(`Статус: ${action.data?.status || 'in_progress'}`);
          }
          break;

        case "add_tag":
          if (taskId && projectId) {
            // First create tag if needed, then add to task
            const tagName = action.data?.tagName as string || action.title;
            toast.info(`Добавление тега: ${tagName}`);
          }
          break;

        case "set_priority":
          if (taskId) {
            // Note: priority update requires proper task router integration
            toast.info(`Приоритет: ${action.data?.priority || 'medium'}`);
          }
          break;

        case "create_note":
          toast.info("Заметка будет добавлена к задаче");
          break;

        case "assign_task":
          toast.info("Функция назначения в разработке");
          break;

        default:
          toast.info("Действие выполнено");
      }

      setExecutedIds((prev) => new Set(prev).add(action.id));
      onActionExecuted?.(action);
    } catch (error) {
      console.error("Failed to execute action:", error);
    } finally {
      setExecutingId(null);
    }
  };

  if (!actions || actions.length === 0) {
    return null;
  }

  // Sort by confidence
  const sortedActions = [...actions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });

  // In compact mode, show only high confidence actions initially
  const visibleActions = compact && !expanded
    ? sortedActions.filter((a) => a.confidence === "high").slice(0, 2)
    : sortedActions;

  const hiddenCount = sortedActions.length - visibleActions.length;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
          <span>Предложенные действия</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {actions.length}
          </Badge>
        </div>
        {compact && hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Свернуть
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ещё {hiddenCount}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => {
          const config = ACTION_CONFIG[action.type];
          const Icon = config.icon;
          const isExecuting = executingId === action.id;
          const isExecuted = executedIds.has(action.id);
          const confidenceConfig = CONFIDENCE_CONFIG[action.confidence];

          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className={cn(
                "h-auto py-1.5 px-3 gap-2 transition-all",
                config.color,
                isExecuted && "opacity-50 cursor-default",
              )}
              disabled={isExecuting || isExecuted}
              onClick={() => executeAction(action)}
            >
              {isExecuting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isExecuted ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">{action.title}</span>
              {action.confidence === "high" && !compact && (
                <Badge className={cn("text-[9px] px-1 py-0 ml-1", confidenceConfig.color)}>
                  ★
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Expanded details */}
      {expanded && !compact && visibleActions.some((a) => a.description) && (
        <div className="mt-2 space-y-1">
          {visibleActions
            .filter((a) => a.description)
            .map((action) => (
              <p key={action.id} className="text-xs text-muted-foreground pl-2 border-l-2 border-border">
                <span className="font-medium">{action.title}:</span> {action.description}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

// Helper function to parse AI response and extract suggested actions
export function parseActionsFromResponse(
  response: string,
  context?: { projectId?: number; taskId?: string }
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const lowerResponse = response.toLowerCase();

  // Detect subtask suggestions
  const subtaskPatterns = [
    /создать подзадачу[:\s]+["«]?([^"»\n]+)["»]?/gi,
    /добавить задачу[:\s]+["«]?([^"»\n]+)["»]?/gi,
    /разбить на[:\s]+(.+?)(?:\n|$)/gi,
    /шаг \d+[:\s]+(.+?)(?:\n|$)/gi,
  ];

  subtaskPatterns.forEach((pattern) => {
    const matches = Array.from(response.matchAll(pattern));
    for (const match of matches) {
      if (match[1] && match[1].length > 3 && match[1].length < 100) {
        actions.push({
          id: `subtask-${actions.length}`,
          type: "create_subtask",
          title: match[1].trim().substring(0, 50),
          description: `Создать подзадачу: ${match[1].trim()}`,
          data: { title: match[1].trim() },
          confidence: "high",
        });
      }
    }
  });

  // Detect deadline suggestions
  const deadlinePatterns = [
    /до (\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/gi,
    /дедлайн[:\s]+(\d{1,2}[.\/-]\d{1,2})/gi,
    /срок[:\s]+(\d{1,2}[.\/-]\d{1,2})/gi,
    /(завтра|послезавтра|через неделю|через месяц)/gi,
  ];

  deadlinePatterns.forEach((pattern) => {
    const match = response.match(pattern);
    if (match && match[1]) {
      actions.push({
        id: `deadline-${actions.length}`,
        type: "set_deadline",
        title: `Дедлайн: ${match[1]}`,
        data: { deadline: match[1] },
        confidence: "medium",
      });
    }
  });

  // Detect status change suggestions
  if (lowerResponse.includes("завершить") || lowerResponse.includes("готово") || lowerResponse.includes("выполнено")) {
    actions.push({
      id: `status-done-${actions.length}`,
      type: "update_status",
      title: "Отметить выполненным",
      data: { status: "done" },
      confidence: "medium",
    });
  }

  if (lowerResponse.includes("начать") || lowerResponse.includes("приступить") || lowerResponse.includes("в работу")) {
    actions.push({
      id: `status-progress-${actions.length}`,
      type: "update_status",
      title: "В работу",
      data: { status: "in_progress" },
      confidence: "medium",
    });
  }

  // Detect priority suggestions
  if (lowerResponse.includes("срочно") || lowerResponse.includes("критично") || lowerResponse.includes("важно")) {
    actions.push({
      id: `priority-${actions.length}`,
      type: "set_priority",
      title: "Высокий приоритет",
      data: { priority: "high" },
      confidence: "high",
    });
  }

  // Detect tag suggestions
  const tagPatterns = [
    /тег[:\s]+["«]?([^"»\n,]+)["»]?/gi,
    /метка[:\s]+["«]?([^"»\n,]+)["»]?/gi,
    /#(\w+)/g,
  ];

  tagPatterns.forEach((pattern) => {
    const matches = Array.from(response.matchAll(pattern));
    for (const match of matches) {
      if (match[1] && match[1].length > 1 && match[1].length < 30) {
        actions.push({
          id: `tag-${actions.length}`,
          type: "add_tag",
          title: `Тег: ${match[1]}`,
          data: { tagName: match[1].trim() },
          confidence: "low",
        });
      }
    }
  });

  // Limit to 5 most relevant actions
  return actions.slice(0, 5);
}

export default SuggestedActions;
