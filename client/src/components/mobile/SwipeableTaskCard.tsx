import { useState, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check, Trash2, Edit, MoreHorizontal } from "lucide-react";

interface SwipeAction {
  icon: typeof Check;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface SwipeableTaskCardProps {
  children: ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  className?: string;
  disabled?: boolean;
}

export function SwipeableTaskCard({
  children,
  onComplete,
  onDelete,
  onEdit,
  className,
  disabled = false,
}: SwipeableTaskCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const leftActions: SwipeAction[] = onComplete
    ? [
        {
          icon: Check,
          label: "Готово",
          color: "text-white",
          bgColor: "bg-emerald-500",
          onClick: onComplete,
        },
      ]
    : [];

  const rightActions: SwipeAction[] = [
    ...(onEdit
      ? [
          {
            icon: Edit,
            label: "Изменить",
            color: "text-white",
            bgColor: "bg-blue-500",
            onClick: onEdit,
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            icon: Trash2,
            label: "Удалить",
            color: "text-white",
            bgColor: "bg-red-500",
            onClick: onDelete,
          },
        ]
      : []),
  ];

  const ACTION_WIDTH = 72;
  const maxLeftOffset = leftActions.length * ACTION_WIDTH;
  const maxRightOffset = rightActions.length * ACTION_WIDTH;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDragging) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;

    // Limit offset
    const newOffset = Math.max(
      -maxRightOffset,
      Math.min(maxLeftOffset, diff + offset)
    );
    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsDragging(false);

    const diff = currentX.current - startX.current;

    // Snap to action or reset
    if (diff > ACTION_WIDTH / 2 && leftActions.length > 0) {
      setOffset(maxLeftOffset);
    } else if (diff < -ACTION_WIDTH / 2 && rightActions.length > 0) {
      setOffset(-maxRightOffset);
    } else {
      setOffset(0);
    }
  };

  const handleActionClick = (action: SwipeAction) => {
    action.onClick();
    setOffset(0);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Left actions (swipe right to reveal) */}
      {leftActions.length > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 flex"
          style={{ width: maxLeftOffset }}
        >
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                action.bgColor,
                action.color
              )}
              style={{ width: ACTION_WIDTH }}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions (swipe left to reveal) */}
      {rightActions.length > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 flex"
          style={{ width: maxRightOffset }}
        >
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center gap-1",
                action.bgColor,
                action.color
              )}
              style={{ width: ACTION_WIDTH }}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className={cn(
          "relative bg-background transition-transform",
          isDragging ? "transition-none" : "duration-200"
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Swipe hint indicator */}
      {offset === 0 && !isDragging && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 opacity-30">
          <MoreHorizontal className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
