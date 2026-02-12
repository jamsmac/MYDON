import React, { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Flag,
  Edit2,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface TaskContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface TaskContextMenuProps {
  taskId: number;
  taskStatus: string;
  taskPriority?: string;
  position: { x: number; y: number } | null;
  isOpen: boolean;
  onClose: () => void;
  actions: TaskContextMenuAction[];
}

export function TaskContextMenu({
  taskId,
  taskStatus,
  taskPriority,
  position,
  isOpen,
  onClose,
  actions,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) {
    return null;
  }

  // Calculate menu position to avoid going off-screen
  const menuWidth = 200;
  const menuHeight = 300;
  const padding = 8;

  let x = position.x;
  let y = position.y;

  // Adjust horizontal position
  if (x + menuWidth + padding > window.innerWidth) {
    x = window.innerWidth - menuWidth - padding;
  }

  // Adjust vertical position
  if (y + menuHeight + padding > window.innerHeight) {
    y = window.innerHeight - menuHeight - padding;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header with task info */}
        <div className="px-3 py-2 bg-muted/50 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground">Task #{taskId}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Status: <span className="capitalize">{taskStatus}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="py-1">
          {actions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No actions available</div>
          ) : (
            actions.map((action, index) => (
              <React.Fragment key={action.id}>
                <button
                  onClick={() => {
                    action.onClick();
                    onClose();
                  }}
                  disabled={action.disabled}
                  className={cn(
                    'w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors',
                    action.disabled && 'opacity-50 cursor-not-allowed',
                    action.variant === 'destructive' && 'hover:bg-destructive/10 text-destructive'
                  )}
                >
                  <span className="flex-shrink-0 w-4 h-4">{action.icon}</span>
                  <span className="flex-1 text-left">{action.label}</span>
                </button>
                {/* Add separator after status group */}
                {index === 1 && actions.length > 2 && (
                  <div className="my-1 border-t border-border" />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to generate default task context menu actions
 */
export function generateTaskContextActions(props: {
  taskId: number;
  taskStatus: string;
  onChangeStatus: (status: string) => void;
  onAddSubtask: () => void;
  onChangePriority?: () => void;
  onDelete: () => void;
  onDiscuss?: () => void;
}): TaskContextMenuAction[] {
  const {
    taskId,
    taskStatus,
    onChangeStatus,
    onAddSubtask,
    onChangePriority,
    onDelete,
    onDiscuss,
  } = props;

  const actions: TaskContextMenuAction[] = [];

  // Status actions
  if (taskStatus === 'completed') {
    actions.push({
      id: 'uncomplete',
      label: 'Mark as incomplete',
      icon: <Circle className="w-4 h-4" />,
      onClick: () => onChangeStatus('not_started'),
    });
  } else {
    actions.push({
      id: 'complete',
      label: 'Mark as complete',
      icon: <CheckCircle2 className="w-4 h-4" />,
      onClick: () => onChangeStatus('completed'),
    });
  }

  // Priority action
  if (onChangePriority) {
    actions.push({
      id: 'priority',
      label: 'Change priority',
      icon: <Flag className="w-4 h-4" />,
      onClick: onChangePriority,
    });
  }

  // Separator after status/priority
  if (actions.length > 0) {
    // Separator will be added in component
  }

  // Add subtask action
  actions.push({
    id: 'add-subtask',
    label: 'Add subtask',
    icon: <Plus className="w-4 h-4" />,
    onClick: onAddSubtask,
  });

  // Discuss action
  if (onDiscuss) {
    actions.push({
      id: 'discuss',
      label: 'Discuss',
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: onDiscuss,
    });
  }

  // Delete action
  actions.push({
    id: 'delete',
    label: 'Delete task',
    icon: <Trash2 className="w-4 h-4" />,
    onClick: onDelete,
    variant: 'destructive',
  });

  return actions;
}
