import { ListChecks, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SubtaskProgressProps {
  completed: number;
  total: number;
  className?: string;
  showIcon?: boolean;
}

export function SubtaskProgress({ 
  completed, 
  total, 
  className,
  showIcon = true 
}: SubtaskProgressProps) {
  if (total === 0) return null;

  const isAllComplete = completed === total;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isAllComplete 
              ? "text-emerald-500" 
              : completed > 0 
                ? "text-amber-500" 
                : "text-slate-500",
            className
          )}
        >
          {showIcon && (
            isAllComplete ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <ListChecks className="w-3 h-3" />
            )
          )}
          <span>{completed}/{total}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-slate-800 border-slate-700">
        <div className="text-xs">
          <p className="font-medium">Подзадачи: {progressPercent}%</p>
          <p className="text-slate-400">
            {completed} из {total} выполнено
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
