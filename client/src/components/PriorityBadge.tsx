import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  ArrowUp, 
  Minus, 
  ArrowDown,
  Flame
} from "lucide-react";

export type Priority = "critical" | "high" | "medium" | "low";

interface PriorityBadgeProps {
  priority: Priority | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const priorityConfig: Record<Priority, {
  label: string;
  labelRu: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    label: "Critical",
    labelRu: "Критический",
    icon: Flame,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  high: {
    label: "High",
    labelRu: "Высокий",
    icon: ArrowUp,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  medium: {
    label: "Medium",
    labelRu: "Средний",
    icon: Minus,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  low: {
    label: "Low",
    labelRu: "Низкий",
    icon: ArrowDown,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
  },
};

export function PriorityBadge({ 
  priority, 
  size = "md", 
  showLabel = true,
  className 
}: PriorityBadgeProps) {
  const config = priorityConfig[priority || "medium"];
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

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        config.bgColor,
        config.borderColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.labelRu}</span>}
    </Badge>
  );
}

// Priority selector component for forms
interface PrioritySelectorProps {
  value: Priority | null | undefined;
  onChange: (priority: Priority) => void;
  className?: string;
}

export function PrioritySelector({ value, onChange, className }: PrioritySelectorProps) {
  const priorities: Priority[] = ["critical", "high", "medium", "low"];

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {priorities.map((priority) => {
        const config = priorityConfig[priority];
        const Icon = config.icon;
        const isSelected = value === priority;

        return (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200",
              "hover:scale-105 active:scale-95",
              isSelected
                ? cn(config.bgColor, config.borderColor, config.color, "ring-2 ring-offset-2 ring-offset-slate-900", 
                    priority === "critical" && "ring-red-500/50",
                    priority === "high" && "ring-orange-500/50",
                    priority === "medium" && "ring-yellow-500/50",
                    priority === "low" && "ring-slate-500/50"
                  )
                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{config.labelRu}</span>
          </button>
        );
      })}
    </div>
  );
}

// Get priority sort order (lower = higher priority)
export function getPrioritySortOrder(priority: Priority | null | undefined): number {
  const order: Record<Priority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority || "medium"];
}

// Export config for use in other components
export { priorityConfig };
