import React, { ReactNode, useState, useRef, useCallback, type TouchEvent } from 'react';
import { Check, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobile } from '@/hooks/useMobile';
import { useLongPress } from '@/hooks/useLongPress';
import { TaskContextMenu, TaskContextMenuAction } from './TaskContextMenu';

interface SwipeableTaskCardProps {
  taskId: number;
  taskStatus: string;
  onComplete: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onUncomplete?: (taskId: number) => void;
  onChangeStatus?: (taskId: number, status: string) => void;
  onAddSubtask?: (taskId: number) => void;
  onDiscuss?: (taskId: number) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  contextMenuActions?: TaskContextMenuAction[];
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isTracking: boolean;
  isHorizontal: boolean | null;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export function SwipeableTaskCard({
  taskId,
  taskStatus,
  onComplete,
  onDelete,
  onUncomplete,
  onChangeStatus,
  onAddSubtask,
  onDiscuss,
  children,
  className,
  disabled = false,
  contextMenuActions,
}: SwipeableTaskCardProps) {
  const { isMobile } = useMobile();
  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    isTracking: false,
    isHorizontal: null,
  });

  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [actionTriggered, setActionTriggered] = useState<'complete' | 'delete' | 'uncomplete' | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCompleted = taskStatus === 'completed';

  // Long-press handler
  const longPressHandlers = useLongPress({
    duration: 300,
    disabled: disabled || !isMobile,
    onLongPress: (e) => {
      // Prevent swipe gestures during long-press
      stateRef.current.isTracking = false;
      setOffset(0);
      
      // Get position for context menu
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenuPos({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }
      setContextMenuOpen(true);
    },
  });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || disabled) return;
      const touch = e.touches[0];
      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        isTracking: true,
        isHorizontal: null,
      };
      setOffset(0);
      setIsAnimating(false);
      setActionTriggered(null);
    },
    [isMobile, disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || disabled || !stateRef.current.isTracking) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - stateRef.current.startX;
      const deltaY = touch.clientY - stateRef.current.startY;

      // Determine direction on first significant movement
      if (stateRef.current.isHorizontal === null) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 8 || absY > 8) {
          stateRef.current.isHorizontal = absX > absY;
          if (!stateRef.current.isHorizontal) {
            stateRef.current.isTracking = false;
            setOffset(0);
            return;
          }
        } else {
          return;
        }
      }

      if (!stateRef.current.isHorizontal) return;

      // Prevent vertical scrolling while swiping horizontally
      e.preventDefault();

      stateRef.current.currentX = touch.clientX;

      // Clamp the offset with rubber-band effect at edges
      let clampedOffset = deltaX;
      if (Math.abs(clampedOffset) > MAX_SWIPE) {
        const excess = Math.abs(clampedOffset) - MAX_SWIPE;
        clampedOffset = (clampedOffset > 0 ? 1 : -1) * (MAX_SWIPE + excess * 0.2);
      }

      setOffset(clampedOffset);

      // Determine which action would trigger
      if (deltaX > SWIPE_THRESHOLD) {
        setActionTriggered(isCompleted ? 'uncomplete' : 'complete');
      } else if (deltaX < -SWIPE_THRESHOLD) {
        setActionTriggered('delete');
      } else {
        setActionTriggered(null);
      }
    },
    [isMobile, disabled, isCompleted]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || disabled || !stateRef.current.isTracking) return;

    stateRef.current.isTracking = false;
    stateRef.current.isHorizontal = null;

    const deltaX = stateRef.current.currentX - stateRef.current.startX;

    if (deltaX > SWIPE_THRESHOLD) {
      // Swipe right → complete or uncomplete
      setIsAnimating(true);
      setOffset(300); // Slide off screen
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }

      setTimeout(() => {
        if (isCompleted && onUncomplete) {
          onUncomplete(taskId);
        } else {
          onComplete(taskId);
        }
        setOffset(0);
        setIsAnimating(false);
        setActionTriggered(null);
      }, 250);
      return;
    } else if (deltaX < -SWIPE_THRESHOLD) {
      // Swipe left → delete (with confirmation)
      setIsAnimating(true);
      setOffset(-300); // Slide off screen

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }

      setTimeout(() => {
        const confirmed = confirm('Удалить задачу?');
        if (confirmed) {
          onDelete(taskId);
        }
        setOffset(0);
        setIsAnimating(false);
        setActionTriggered(null);
      }, 250);
      return;
    }

    // Snap back
    setIsAnimating(true);
    setOffset(0);
    setActionTriggered(null);
    setTimeout(() => setIsAnimating(false), 200);
  }, [isMobile, disabled, isCompleted, taskId, onComplete, onDelete, onUncomplete]);

  // Build default context menu actions if not provided
  const defaultActions: TaskContextMenuAction[] = contextMenuActions || [
    {
      id: 'complete',
      label: isCompleted ? 'Mark as incomplete' : 'Mark as complete',
      icon: isCompleted ? <Undo2 className="w-4 h-4" /> : <Check className="w-4 h-4" />,
      onClick: () => {
        if (onChangeStatus) {
          onChangeStatus(taskId, isCompleted ? 'not_started' : 'completed');
        } else if (isCompleted && onUncomplete) {
          onUncomplete(taskId);
        } else if (!isCompleted) {
          onComplete(taskId);
        }
      },
    },
    ...(onAddSubtask ? [{
      id: 'add-subtask',
      label: 'Add subtask',
      icon: <Check className="w-4 h-4" />,
      onClick: () => onAddSubtask(taskId),
    }] : []),
    ...(onDiscuss ? [{
      id: 'discuss',
      label: 'Discuss',
      icon: <Check className="w-4 h-4" />,
      onClick: () => onDiscuss(taskId),
    }] : []),
    {
      id: 'delete',
      label: 'Delete task',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete(taskId),
      variant: 'destructive',
    },
  ];

  // On desktop, just render children without swipe
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  const rightActionActive = actionTriggered === 'complete' || actionTriggered === 'uncomplete';
  const leftActionActive = actionTriggered === 'delete';

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden rounded-lg", className)}
        {...longPressHandlers}
      >
      {/* Background action indicators */}
      {/* Right swipe background (complete/uncomplete) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-start pl-4 rounded-lg transition-colors duration-150",
          rightActionActive
            ? (isCompleted ? "bg-amber-500/90" : "bg-emerald-500/90")
            : (isCompleted ? "bg-amber-500/40" : "bg-emerald-500/40")
        )}
        style={{
          opacity: offset > 0 ? Math.min(offset / SWIPE_THRESHOLD, 1) : 0,
        }}
      >
        <div className={cn(
          "flex items-center gap-2 text-white transition-transform duration-150",
          rightActionActive ? "scale-110" : "scale-100"
        )}>
          {isCompleted ? (
            <>
              <Undo2 className="w-5 h-5" />
              <span className="text-xs font-medium">Вернуть</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span className="text-xs font-medium">Готово</span>
            </>
          )}
        </div>
      </div>

      {/* Left swipe background (delete) */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-end pr-4 rounded-lg transition-colors duration-150",
          leftActionActive ? "bg-red-500/90" : "bg-red-500/40"
        )}
        style={{
          opacity: offset < 0 ? Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1) : 0,
        }}
      >
        <div className={cn(
          "flex items-center gap-2 text-white transition-transform duration-150",
          leftActionActive ? "scale-110" : "scale-100"
        )}>
          <span className="text-xs font-medium">Удалить</span>
          <Trash2 className="w-5 h-5" />
        </div>
      </div>

      {/* Foreground task card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
        className="relative z-10 bg-slate-800/50 rounded-lg"
      >
        {children}
      </div>
    </div>

      {/* Context Menu */}
      <TaskContextMenu
        taskId={taskId}
        taskStatus={taskStatus}
        position={contextMenuPos}
        isOpen={contextMenuOpen}
        onClose={() => setContextMenuOpen(false)}
        actions={defaultActions}
      />
    </>
  );
}
