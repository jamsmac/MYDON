import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Circle,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  FileText,
  ListPlus,
  Target,
  BarChart3,
  Layers,
  Zap,
  Shield,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types
type EntityType = 'block' | 'section' | 'task';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface TaskInfo {
  id: number;
  title: string;
  status: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  sectionId: number;
}

interface SectionInfo {
  id: number;
  title: string;
  blockId: number;
  taskCount: number;
}

interface BlockInfo {
  id: number;
  title: string;
  sectionCount: number;
}

interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
  separator?: boolean;
  submenu?: ContextMenuAction[];
  onClick?: () => void;
  disabled?: boolean;
}

// ============ Context Menu Item ============
function ContextMenuItem({ 
  action, 
  onClose 
}: { 
  action: ContextMenuAction; 
  onClose: () => void;
}) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  if (action.separator) {
    return <div className="h-px bg-slate-700 my-1" />;
  }

  const handleClick = () => {
    if (action.submenu) {
      setShowSubmenu(!showSubmenu);
      return;
    }
    if (action.onClick && !action.disabled) {
      action.onClick();
      onClose();
    }
  };

  return (
    <div ref={itemRef} className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => action.submenu && setShowSubmenu(true)}
        onMouseLeave={() => action.submenu && setShowSubmenu(false)}
        disabled={action.disabled}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors text-left",
          action.disabled
            ? "text-slate-600 cursor-not-allowed"
            : action.color || "text-slate-300 hover:bg-slate-700 hover:text-white"
        )}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {action.icon}
        </span>
        <span className="flex-1 truncate">{action.label}</span>
        {action.submenu && (
          <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {/* Submenu */}
      {action.submenu && showSubmenu && (
        <div
          className="absolute left-full top-0 ml-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-[60]"
          onMouseEnter={() => setShowSubmenu(true)}
          onMouseLeave={() => setShowSubmenu(false)}
        >
          {action.submenu.map((subAction) => (
            <ContextMenuItem
              key={subAction.id}
              action={subAction}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Main Context Menu ============
export function SidebarContextMenu({
  position,
  entityType,
  entityData,
  onClose,
  onAction,
}: {
  position: ContextMenuPosition;
  entityType: EntityType;
  entityData: TaskInfo | SectionInfo | BlockInfo;
  onClose: () => void;
  onAction: (actionId: string, entityType: EntityType, entityData: TaskInfo | SectionInfo | BlockInfo) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + rect.width > viewportWidth - 10) {
        x = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight - 10) {
        y = viewportHeight - rect.height - 10;
      }
      if (x < 10) x = 10;
      if (y < 10) y = 10;

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const handleAction = useCallback((actionId: string) => {
    onAction(actionId, entityType, entityData);
  }, [onAction, entityType, entityData]);

  // Build actions based on entity type
  const actions: ContextMenuAction[] = [];

  if (entityType === 'block') {
    const block = entityData as BlockInfo;
    actions.push(
      {
        id: 'discuss',
        label: 'Обсудить блок',
        icon: <MessageSquare className="w-4 h-4" />,
        color: 'text-blue-400 hover:bg-blue-500/10',
        onClick: () => handleAction('discuss'),
      },
      {
        id: 'ai-chat',
        label: 'AI чат блока',
        icon: <Sparkles className="w-4 h-4" />,
        color: 'text-amber-400 hover:bg-amber-500/10',
        onClick: () => handleAction('ai-chat'),
      },
      {
        id: 'ai-actions',
        label: 'AI действия',
        icon: <Zap className="w-4 h-4" />,
        color: 'text-purple-400 hover:bg-purple-500/10',
        submenu: [
          {
            id: 'ai-roadmap',
            label: 'Создать дорожную карту',
            icon: <Target className="w-4 h-4" />,
            onClick: () => handleAction('ai-roadmap'),
          },
          {
            id: 'ai-decompose',
            label: 'Декомпозировать блок',
            icon: <Layers className="w-4 h-4" />,
            onClick: () => handleAction('ai-decompose'),
          },
          {
            id: 'ai-risks',
            label: 'Анализ рисков',
            icon: <AlertTriangle className="w-4 h-4" />,
            onClick: () => handleAction('ai-risks'),
          },
          {
            id: 'ai-report',
            label: 'Сформировать отчёт',
            icon: <BarChart3 className="w-4 h-4" />,
            onClick: () => handleAction('ai-report'),
          },
        ],
      },
      { id: 'sep1', label: '', icon: null, separator: true },
      {
        id: 'add-section',
        label: 'Добавить раздел',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => handleAction('add-section'),
      },
      {
        id: 'rename',
        label: 'Переименовать',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => handleAction('rename'),
      },
      {
        id: 'copy-title',
        label: 'Копировать название',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          navigator.clipboard.writeText(block.title);
          toast.success('Название скопировано');
        },
      },
      { id: 'sep2', label: '', icon: null, separator: true },
      {
        id: 'delete',
        label: 'Удалить блок',
        icon: <Trash2 className="w-4 h-4" />,
        color: 'text-red-400 hover:bg-red-500/10',
        onClick: () => handleAction('delete'),
      },
    );
  } else if (entityType === 'section') {
    const section = entityData as SectionInfo;
    actions.push(
      {
        id: 'discuss',
        label: 'Обсудить раздел',
        icon: <MessageSquare className="w-4 h-4" />,
        color: 'text-blue-400 hover:bg-blue-500/10',
        onClick: () => handleAction('discuss'),
      },
      {
        id: 'ai-chat',
        label: 'AI чат раздела',
        icon: <Sparkles className="w-4 h-4" />,
        color: 'text-amber-400 hover:bg-amber-500/10',
        onClick: () => handleAction('ai-chat'),
      },
      {
        id: 'ai-actions',
        label: 'AI действия',
        icon: <Zap className="w-4 h-4" />,
        color: 'text-purple-400 hover:bg-purple-500/10',
        submenu: [
          {
            id: 'ai-create-tasks',
            label: 'Создать задачи',
            icon: <ListPlus className="w-4 h-4" />,
            onClick: () => handleAction('ai-create-tasks'),
          },
          {
            id: 'ai-plan',
            label: 'Сгенерировать план',
            icon: <Target className="w-4 h-4" />,
            onClick: () => handleAction('ai-plan'),
          },
          {
            id: 'ai-evaluate',
            label: 'Оценить раздел',
            icon: <BarChart3 className="w-4 h-4" />,
            onClick: () => handleAction('ai-evaluate'),
          },
          {
            id: 'ai-find-deps',
            label: 'Найти зависимости',
            icon: <Shield className="w-4 h-4" />,
            onClick: () => handleAction('ai-find-deps'),
          },
        ],
      },
      { id: 'sep1', label: '', icon: null, separator: true },
      {
        id: 'add-task',
        label: 'Добавить задачу',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => handleAction('add-task'),
      },
      {
        id: 'rename',
        label: 'Переименовать',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => handleAction('rename'),
      },
      {
        id: 'copy-title',
        label: 'Копировать название',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          navigator.clipboard.writeText(section.title);
          toast.success('Название скопировано');
        },
      },
      { id: 'sep2', label: '', icon: null, separator: true },
      {
        id: 'delete',
        label: 'Удалить раздел',
        icon: <Trash2 className="w-4 h-4" />,
        color: 'text-red-400 hover:bg-red-500/10',
        onClick: () => handleAction('delete'),
      },
    );
  } else if (entityType === 'task') {
    const task = entityData as TaskInfo;
    actions.push(
      {
        id: 'open',
        label: 'Открыть задачу',
        icon: <ArrowRight className="w-4 h-4" />,
        onClick: () => handleAction('open'),
      },
      {
        id: 'discuss',
        label: 'Обсудить задачу',
        icon: <MessageSquare className="w-4 h-4" />,
        color: 'text-blue-400 hover:bg-blue-500/10',
        onClick: () => handleAction('discuss'),
      },
      {
        id: 'ai-actions',
        label: 'AI действия',
        icon: <Sparkles className="w-4 h-4" />,
        color: 'text-amber-400 hover:bg-amber-500/10',
        submenu: [
          {
            id: 'ai-subtasks',
            label: 'Создать подзадачи',
            icon: <ListPlus className="w-4 h-4" />,
            onClick: () => handleAction('ai-subtasks'),
          },
          {
            id: 'ai-estimate',
            label: 'Оценить сложность',
            icon: <BarChart3 className="w-4 h-4" />,
            onClick: () => handleAction('ai-estimate'),
          },
          {
            id: 'ai-risks',
            label: 'Анализ рисков',
            icon: <AlertTriangle className="w-4 h-4" />,
            onClick: () => handleAction('ai-risks'),
          },
          {
            id: 'ai-spec',
            label: 'Написать ТЗ',
            icon: <FileText className="w-4 h-4" />,
            onClick: () => handleAction('ai-spec'),
          },
          {
            id: 'ai-howto',
            label: 'Как выполнить',
            icon: <BookOpen className="w-4 h-4" />,
            onClick: () => handleAction('ai-howto'),
          },
        ],
      },
      { id: 'sep1', label: '', icon: null, separator: true },
      {
        id: 'status',
        label: 'Изменить статус',
        icon: task.status === 'completed' 
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : task.status === 'in_progress'
          ? <Clock className="w-4 h-4 text-amber-500" />
          : <Circle className="w-4 h-4 text-slate-500" />,
        submenu: [
          {
            id: 'status-not_started',
            label: 'Не начата',
            icon: <Circle className="w-4 h-4 text-slate-500" />,
            onClick: () => handleAction('status-not_started'),
            disabled: task.status === 'not_started',
          },
          {
            id: 'status-in_progress',
            label: 'В работе',
            icon: <Clock className="w-4 h-4 text-amber-500" />,
            onClick: () => handleAction('status-in_progress'),
            disabled: task.status === 'in_progress',
          },
          {
            id: 'status-completed',
            label: 'Завершена',
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
            onClick: () => handleAction('status-completed'),
            disabled: task.status === 'completed',
          },
        ],
      },
      {
        id: 'priority',
        label: 'Изменить приоритет',
        icon: <AlertTriangle className="w-4 h-4" />,
        submenu: [
          {
            id: 'priority-critical',
            label: 'Критический',
            icon: <span className="w-2 h-2 rounded-full bg-red-500" />,
            onClick: () => handleAction('priority-critical'),
            disabled: task.priority === 'critical',
          },
          {
            id: 'priority-high',
            label: 'Высокий',
            icon: <span className="w-2 h-2 rounded-full bg-orange-500" />,
            onClick: () => handleAction('priority-high'),
            disabled: task.priority === 'high',
          },
          {
            id: 'priority-medium',
            label: 'Средний',
            icon: <span className="w-2 h-2 rounded-full bg-amber-500" />,
            onClick: () => handleAction('priority-medium'),
            disabled: task.priority === 'medium',
          },
          {
            id: 'priority-low',
            label: 'Низкий',
            icon: <span className="w-2 h-2 rounded-full bg-blue-500" />,
            onClick: () => handleAction('priority-low'),
            disabled: task.priority === 'low',
          },
        ],
      },
      {
        id: 'add-subtask',
        label: 'Добавить подзадачу',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => handleAction('add-subtask'),
      },
      { id: 'sep2', label: '', icon: null, separator: true },
      {
        id: 'copy-title',
        label: 'Копировать название',
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          navigator.clipboard.writeText(task.title);
          toast.success('Название скопировано');
        },
      },
      { id: 'sep3', label: '', icon: null, separator: true },
      {
        id: 'delete',
        label: 'Удалить задачу',
        icon: <Trash2 className="w-4 h-4" />,
        color: 'text-red-400 hover:bg-red-500/10',
        onClick: () => handleAction('delete'),
      },
    );
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[55] min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-700 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
          {entityType === 'block' ? 'Блок' : entityType === 'section' ? 'Раздел' : 'Задача'}
        </span>
        <p className="text-xs text-slate-300 truncate mt-0.5">
          {entityData.title}
        </p>
      </div>

      {/* Actions */}
      {actions.map((action) => (
        <ContextMenuItem
          key={action.id}
          action={action}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

// ============ Hook for context menu state ============
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    entityType: EntityType;
    entityData: TaskInfo | SectionInfo | BlockInfo;
  } | null>(null);

  const openContextMenu = useCallback((
    e: React.MouseEvent,
    entityType: EntityType,
    entityData: TaskInfo | SectionInfo | BlockInfo,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      entityType,
      entityData,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, openContextMenu, closeContextMenu };
}

// Export types for use in DraggableSidebar
export type { TaskInfo, SectionInfo, BlockInfo, EntityType, ContextMenuPosition };
