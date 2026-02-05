import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityDetectorProps {
  title: string;
  description?: string;
  deadline?: Date;
  currentPriority?: "critical" | "high" | "medium" | "low";
  onAccept: (priority: "critical" | "high" | "medium" | "low") => void;
  className?: string;
}

const priorityConfig = {
  critical: {
    label: "Критичный",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: "🔴",
  },
  high: {
    label: "Высокий",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: "🟠",
  },
  medium: {
    label: "Средний",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: "🟡",
  },
  low: {
    label: "Низкий",
    color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    icon: "⚪",
  },
};

export function PriorityDetector({
  title,
  description,
  deadline,
  currentPriority,
  onAccept,
  className,
}: PriorityDetectorProps) {
  const [detectedPriority, setDetectedPriority] = useState<{
    priority: "critical" | "high" | "medium" | "low";
    confidence: number;
    reason: string;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const detectPriority = trpc.aiEnhancements.detectPriority.useMutation({
    onSuccess: (data) => {
      if (data.priority !== currentPriority) {
        setDetectedPriority(data);
        setIsDismissed(false);
      }
    },
  });

  // Auto-detect when title changes significantly
  useEffect(() => {
    if (title.length > 10 && !detectPriority.isPending) {
      const timer = setTimeout(() => {
        detectPriority.mutate({ title, description, deadline });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [title, description, deadline]);

  if (!detectedPriority || isDismissed || detectedPriority.priority === currentPriority) {
    return null;
  }

  const config = priorityConfig[detectedPriority.priority];

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-amber-500/20",
        className
      )}
    >
      <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">AI предлагает:</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn("text-xs cursor-help", config.color)}
              >
                {config.icon} {config.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">
                {detectedPriority.reason}
                <br />
                <span className="text-slate-400">
                  Уверенность: {detectedPriority.confidence}%
                </span>
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onAccept(detectedPriority.priority);
            setDetectedPriority(null);
          }}
          className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-400"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-6 w-6 p-0 text-slate-400 hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
