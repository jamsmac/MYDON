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
    icon: Target,
    color: "text-red-500 bg-red-500/10 hover:bg-red-500/20 border-red-500/30",
    label: "Установить приоритет",
  },
  assign_task: {
    icon: CheckCircle2,
    color: "text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30",
    label: "Назначить задачу",
  },
};

const CONFIDENCE_CONFIG = {
  high: { label: "Рекомендуется", color: "bg-emerald-500/20 text-emerald-400" },
  medium: { label: "Возможно", color: "bg-amber-500/20 text-amber-400" },
  low: { label: "Опционально", color: "bg-slate-500/20 text-slate-400" },
};

// Helper to convert string taskId to number
function parseTaskId(taskId: string | undefined): number | null {
  if (!taskId) return null;
  
  // Handle format like "task-1-2-3" -> extract last number as task ID
  const parts = taskId.split("-");
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num)) return num;
  }
  
  // Try direct parse
  const direct = parseInt(taskId, 10);
  if (!isNaN(direct)) return direct;
  
  return null;
}

// Helper to parse deadline string to timestamp
function parseDeadlineToTimestamp(deadlineStr: string): number | null {
  const now = new Date();
  const lowerDeadline = deadlineStr.toLowerCase();
  
  // Handle relative dates
  if (lowerDeadline.includes("завтра")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    return tomorrow.getTime();
  }
  if (lowerDeadline.includes("послезавтра")) {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(18, 0, 0, 0);
    return dayAfter.getTime();
  }
  if (lowerDeadline.includes("через неделю")) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(18, 0, 0, 0);
    return nextWeek.getTime();
  }
  if (lowerDeadline.includes("через месяц")) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setHours(18, 0, 0, 0);
    return nextMonth.getTime();
  }
  
  // Try to parse date patterns like "15.02", "15/02/2026", "15-02-2026"
  const datePatterns = [
    /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/,
    /(\d{1,2})[.\/-](\d{1,2})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = deadlineStr.match(pattern);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
      const year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
      const fullYear = year < 100 ? 2000 + year : year;
      
      const date = new Date(fullYear, month, day, 18, 0, 0, 0);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  
  return null;
}

// Map status strings to valid enum values
function mapStatusToEnum(status: string): "not_started" | "in_progress" | "completed" {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes("done") || lowerStatus.includes("готов") || lowerStatus.includes("выполн") || lowerStatus.includes("completed")) {
    return "completed";
  }
  if (lowerStatus.includes("progress") || lowerStatus.includes("работ") || lowerStatus.includes("начат")) {
    return "in_progress";
  }
  return "not_started";
}

// Map priority strings to valid enum values
function mapPriorityToEnum(priority: string): "critical" | "high" | "medium" | "low" {
  const lowerPriority = priority.toLowerCase();
  if (lowerPriority.includes("critical") || lowerPriority.includes("критич")) {
    return "critical";
  }
  if (lowerPriority.includes("high") || lowerPriority.includes("высок") || lowerPriority.includes("срочн") || lowerPriority.includes("важн")) {
    return "high";
  }
  if (lowerPriority.includes("low") || lowerPriority.includes("низк")) {
    return "low";
  }
  return "medium";
}

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

  // Real mutations for executing actions
  const createSubtaskMutation = trpc.subtask.create.useMutation({
    onSuccess: () => toast.success("Подзадача создана"),
    onError: (err) => toast.error("Ошибка создания подзадачи", { description: err.message }),
  });

  const updateTaskMutation = trpc.task.update.useMutation({
    onSuccess: () => toast.success("Задача обновлена"),
    onError: (err) => toast.error("Ошибка обновления задачи", { description: err.message }),
  });

  const addTagMutation = trpc.relations.addTagToTask.useMutation({
    onSuccess: () => toast.success("Тег добавлен"),
    onError: (err) => toast.error("Ошибка добавления тега", { description: err.message }),
  });

  const createTagMutation = trpc.relations.createTag.useMutation();

  // Execute action
  const executeAction = async (action: SuggestedAction) => {
    const numericTaskId = parseTaskId(taskId);
    
    if (!numericTaskId && !projectId) {
      toast.error("Не выбрана задача или проект");
      return;
    }

    setExecutingId(action.id);

    try {
      switch (action.type) {
        case "create_subtask":
          if (numericTaskId) {
            const subtaskTitle = (action.data?.title as string) || action.title;
            await createSubtaskMutation.mutateAsync({
              taskId: numericTaskId,
              title: subtaskTitle.substring(0, 500),
            });
          } else {
            toast.info(`Подзадача: ${action.data?.title || action.title}`);
          }
          break;

        case "set_deadline":
          if (numericTaskId) {
            const deadlineStr = (action.data?.deadline as string) || "";
            const timestamp = parseDeadlineToTimestamp(deadlineStr);
            
            if (timestamp) {
              await updateTaskMutation.mutateAsync({
                id: numericTaskId,
                deadline: timestamp,
              });
            } else {
              toast.info(`Дедлайн: ${deadlineStr} (не удалось распознать дату)`);
            }
          }
          break;

        case "update_status":
          if (numericTaskId) {
            const statusStr = (action.data?.status as string) || "in_progress";
            const status = mapStatusToEnum(statusStr);
            await updateTaskMutation.mutateAsync({
              id: numericTaskId,
              status,
            });
          }
          break;

        case "add_tag":
          if (numericTaskId && projectId) {
            const tagName = (action.data?.tagName as string) || action.title.replace(/^Тег:\s*/i, "");
            
            // First create the tag (or get existing)
            try {
              const newTag = await createTagMutation.mutateAsync({
                projectId,
                name: tagName.trim().substring(0, 50),
                color: "#6366f1", // Default indigo color
              });
              
              // Then add tag to task using the tag ID
              if (newTag && newTag.id) {
                await addTagMutation.mutateAsync({
                  taskId: numericTaskId,
                  tagId: newTag.id,
                });
              }
            } catch (err) {
              // Tag might already exist, try to find and add it
              toast.info(`Тег "${tagName}" добавлен или уже существует`);
            }
          } else {
            toast.info(`Добавление тега: ${action.data?.tagName || action.title}`);
          }
          break;

        case "set_priority":
          if (numericTaskId) {
            const priorityStr = (action.data?.priority as string) || "medium";
            const priority = mapPriorityToEnum(priorityStr);
            await updateTaskMutation.mutateAsync({
              id: numericTaskId,
              priority,
            });
          }
          break;

        case "create_note":
          if (numericTaskId) {
            const noteContent = (action.data?.content as string) || action.title;
            // Append note to task notes field
            await updateTaskMutation.mutateAsync({
              id: numericTaskId,
              notes: noteContent.substring(0, 5000),
            });
          } else {
            toast.info("Заметка будет добавлена к задаче");
          }
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

  const highPriorityActions = actions.filter((a) => a.confidence === "high");
  const otherActions = actions.filter((a) => a.confidence !== "high");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Предложенные действия</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {actions.length}
          </Badge>
        </div>
        {compact && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Скрыть
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Показать
              </>
            )}
          </Button>
        )}
      </div>

      {/* Actions */}
      {expanded && (
        <div className="space-y-1.5">
          {/* High priority actions */}
          {highPriorityActions.length > 0 && (
            <div className="space-y-1">
              {highPriorityActions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
                  executing={executingId === action.id}
                  executed={executedIds.has(action.id)}
                  onExecute={() => executeAction(action)}
                />
              ))}
            </div>
          )}

          {/* Other actions */}
          {otherActions.length > 0 && (
            <div className="space-y-1">
              {otherActions.map((action) => (
                <ActionButton
                  key={action.id}
                  action={action}
                  executing={executingId === action.id}
                  executed={executedIds.has(action.id)}
                  onExecute={() => executeAction(action)}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual action button component
function ActionButton({
  action,
  executing,
  executed,
  onExecute,
  compact = false,
}: {
  action: SuggestedAction;
  executing: boolean;
  executed: boolean;
  onExecute: () => void;
  compact?: boolean;
}) {
  const config = ACTION_CONFIG[action.type];
  const confidenceConfig = CONFIDENCE_CONFIG[action.confidence];
  const Icon = config.icon;

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "w-full justify-start gap-2 border transition-all",
        config.color,
        executed && "opacity-50 cursor-default",
        compact ? "h-7 text-xs" : "h-8 text-sm"
      )}
      onClick={onExecute}
      disabled={executing || executed}
    >
      {executing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : executed ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      <span className="truncate flex-1 text-left">{action.title}</span>
      {!compact && (
        <Badge
          variant="secondary"
          className={cn("text-[10px] px-1.5 py-0", confidenceConfig.color)}
        >
          {confidenceConfig.label}
        </Badge>
      )}
    </Button>
  );
}

// Helper to parse actions from AI response text (for local fast parsing)
export function parseActionsFromResponse(response: string, taskId?: string, projectId?: number): SuggestedAction[] {
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
