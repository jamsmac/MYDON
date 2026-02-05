import { cn } from "@/lib/utils";
import { Edit3 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditingIndicatorProps {
  userName: string;
  color?: string;
  className?: string;
  size?: "sm" | "md";
}

export function EditingIndicator({
  userName,
  color = "#f59e0b",
  className,
  size = "sm",
}: EditingIndicatorProps) {
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-medium animate-pulse",
            sizeClasses[size],
            className
          )}
          style={{
            backgroundColor: `${color}20`,
            color: color,
            border: `1px solid ${color}40`,
          }}
        >
          <Edit3 className={cn(size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3")} />
          <span className="truncate max-w-[80px]">{userName}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-slate-800 border-slate-700">
        <p className="text-white text-xs">
          {userName} редактирует этот элемент
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

interface TaskEditingOverlayProps {
  userName: string;
  onWaitClick?: () => void;
  onForceEditClick?: () => void;
}

export function TaskEditingOverlay({
  userName,
  onWaitClick,
  onForceEditClick,
}: TaskEditingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="text-center p-4">
        <div className="flex items-center justify-center gap-2 text-amber-400 mb-3">
          <Edit3 className="w-5 h-5 animate-pulse" />
          <span className="font-medium">{userName}</span>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          уже редактирует эту задачу
        </p>
        <div className="flex gap-2 justify-center">
          {onWaitClick && (
            <button
              onClick={onWaitClick}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
            >
              Подождать
            </button>
          )}
          {onForceEditClick && (
            <button
              onClick={onForceEditClick}
              className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-md transition-colors"
            >
              Редактировать всё равно
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
