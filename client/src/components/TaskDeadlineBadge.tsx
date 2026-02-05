import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  AlertCircle, 
  Clock, 
  CalendarX
} from "lucide-react";
import { formatDistanceToNow, differenceInDays, format, isToday, isTomorrow, isPast } from "date-fns";
import { ru } from "date-fns/locale";

export type TaskDeadlineStatus = "overdue" | "urgent" | "soon" | "normal" | "none";

interface TaskDeadlineBadgeProps {
  deadline: Date | string | null | undefined;
  size?: "sm" | "md" | "lg";
  showRelative?: boolean;
  className?: string;
}

export function getTaskDeadlineStatus(deadline: Date | string | null | undefined): TaskDeadlineStatus {
  if (!deadline) return "none";
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysUntil = differenceInDays(deadlineDate, now);

  if (isPast(deadlineDate) && !isToday(deadlineDate)) {
    return "overdue";
  }
  if (isToday(deadlineDate) || isTomorrow(deadlineDate)) {
    return "urgent";
  }
  if (daysUntil <= 3) {
    return "soon";
  }
  return "normal";
}

const statusConfig: Record<TaskDeadlineStatus, {
  icon: typeof Calendar;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  overdue: {
    icon: CalendarX,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  urgent: {
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  soon: {
    icon: Clock,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  normal: {
    icon: Calendar,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  none: {
    icon: Calendar,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
  },
};

export function TaskDeadlineBadge({ 
  deadline, 
  size = "md", 
  showRelative = true,
  className 
}: TaskDeadlineBadgeProps) {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const status = getTaskDeadlineStatus(deadlineDate);
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-5 text-xs gap-1 px-1.5",
    md: "h-6 text-xs gap-1.5 px-2",
    lg: "h-7 text-sm gap-2 px-2.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  const getDisplayText = () => {
    if (isToday(deadlineDate)) return "Сегодня";
    if (isTomorrow(deadlineDate)) return "Завтра";
    
    if (showRelative) {
      return formatDistanceToNow(deadlineDate, { 
        addSuffix: true, 
        locale: ru 
      });
    }
    
    return format(deadlineDate, "d MMM", { locale: ru });
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size],
        status === "overdue" && "animate-pulse",
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{getDisplayText()}</span>
    </Badge>
  );
}

// Compact deadline indicator (just icon + color)
interface TaskDeadlineIndicatorProps {
  deadline: Date | string | null | undefined;
  className?: string;
}

export function TaskDeadlineIndicator({ deadline, className }: TaskDeadlineIndicatorProps) {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const status = getTaskDeadlineStatus(deadlineDate);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-center justify-center w-5 h-5 rounded-full",
        config.bgColor,
        className
      )}
      title={format(deadlineDate, "d MMMM yyyy", { locale: ru })}
    >
      <Icon className={cn("w-3 h-3", config.color)} />
    </div>
  );
}

// Export config for use in other components
export { statusConfig as taskDeadlineStatusConfig };
