import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeIndicatorProps {
  currentIndex: number;
  totalItems: number;
  canGoLeft: boolean;
  canGoRight: boolean;
  labels?: string[];
  className?: string;
}

export function SwipeIndicator({
  currentIndex,
  totalItems,
  canGoLeft,
  canGoRight,
  labels,
  className,
}: SwipeIndicatorProps) {
  if (totalItems <= 1) return null;

  return (
    <div className={cn("flex items-center justify-center gap-2 py-2", className)}>
      {/* Left arrow */}
      <div className={cn(
        "transition-opacity duration-200",
        canGoRight ? "opacity-60" : "opacity-0"
      )}>
        <ChevronLeft className="w-4 h-4 text-slate-400" />
      </div>

      {/* Dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalItems }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-300",
              i === currentIndex
                ? "w-6 h-2 bg-amber-500"
                : "w-2 h-2 bg-slate-600 hover:bg-slate-500"
            )}
          />
        ))}
      </div>

      {/* Right arrow */}
      <div className={cn(
        "transition-opacity duration-200",
        canGoLeft ? "opacity-60" : "opacity-0"
      )}>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>

      {/* Current label */}
      {labels && labels[currentIndex] && (
        <span className="text-xs text-slate-500 ml-2 truncate max-w-[120px]">
          {currentIndex + 1}/{totalItems}
        </span>
      )}
    </div>
  );
}
