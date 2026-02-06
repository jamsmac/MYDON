import { 
  DndContext, 
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  MessageSquare, 
  FileText, 
  CheckCircle2, 
  Circle, 
  Clock,
  Plus,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { SidebarContextMenu, useContextMenu, type TaskInfo, type SectionInfo, type BlockInfo, type EntityType } from '@/components/SidebarContextMenu';
import { InlineEditableText } from '@/components/InlineEditableText';
import { InlineDatePicker } from '@/components/InlineDatePicker';
import { PriorityBadge } from '@/components/PriorityBadge';
import { TaskDeadlineBadge, TaskDeadlineIndicator } from '@/components/TaskDeadlineBadge';
import { SubtaskProgress } from '@/components/SubtaskProgress';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, AlertTriangle, Link2 } from 'lucide-react';

// Types
interface Subtask {
  id: number;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed' | null;
}

interface Task {
  id: number;
  title: string;
  status: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  description?: string | null;
  notes?: string | null;
  summary?: string | null;
  dueDate?: Date | null;
  deadline?: Date | string | null;
  dependencies?: number[] | null;
  sortOrder?: number | null;
  subtasks?: Subtask[];
}

interface Section {
  id: number;
  title: string;
  sortOrder: number;
  tasks?: Task[];
}

interface Block {
  id: number;
  title: string;
  titleRu?: string | null;
  number: number;
  sections?: Section[];
}

type ContextType = 'project' | 'block' | 'section' | 'task';

interface ContextInfo {
  type: ContextType;
  id: number;
  title: string;
  content?: string;
}

interface DraggableSidebarProps {
  blocks: Block[];
  expandedBlocks: Set<number>;
  expandedSections: Set<number>;
  selectedContext: ContextInfo | null;
  selectedTask: Task | null;
  onToggleBlock: (id: number) => void;
  onToggleSection: (id: number) => void;
  onSelectContext: (context: ContextInfo) => void;
  onSelectTask: (task: Task & { sectionId: number }) => void;
  onCreateSection: (blockId: number) => void;
  onCreateTask: (sectionId: number) => void;
  onDeleteBlock: (id: number) => void;
  onDeleteSection: (id: number) => void;
  onMoveTask: (taskId: number, newSectionId: number, newSortOrder: number) => void;
  onMoveSection: (sectionId: number, newBlockId: number, newSortOrder: number) => void;
  onReorderTasks?: (sectionId: number, taskIds: number[]) => void;
  onReorderSections?: (blockId: number, sectionIds: number[]) => void;
  onReorderBlocks?: (blockIds: number[]) => void;
  onUpdateTaskTitle?: (taskId: number, newTitle: string) => void;
  onUpdateTaskDueDate?: (taskId: number, dueDate: Date | null) => void;
  onUpdateSectionTitle?: (sectionId: number, newTitle: string) => void;
  onUpdateBlockTitle?: (blockId: number, newTitle: string) => void;
  getContextContent: (type: string, id: number) => string;
  filteredTaskIds?: Set<number>;
  unreadCounts?: { blockUnreads: Record<number, number>; sectionUnreads: Record<number, number> };
  onContextMenuAction?: (actionId: string, entityType: EntityType, entityData: TaskInfo | SectionInfo | BlockInfo) => void;
  onDeleteTask?: (taskId: number) => void;
  onUpdateTaskStatus?: (taskId: number, status: 'not_started' | 'in_progress' | 'completed') => void;
  onUpdateTaskPriority?: (taskId: number, priority: 'critical' | 'high' | 'medium' | 'low') => void;
}

// Sortable Task Item
function SortableTask({ 
  task, 
  sectionId,
  isSelected,
  onSelect,
  onUpdateTitle,
  onUpdateDueDate,
  onContextMenu
}: { 
  task: Task; 
  sectionId: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTitle?: (taskId: number, newTitle: string) => void;
  onUpdateDueDate?: (taskId: number, dueDate: Date | null) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `task-${task.id}`,
    data: { type: 'task', task, sectionId }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 group",
        isDragging && "z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <div
        onClick={onSelect}
        onContextMenu={onContextMenu}
        className={cn(
          "flex-1 flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors cursor-pointer",
          isSelected
            ? "bg-slate-700 text-white"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        )}
      >
        {task.status === 'completed' ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        ) : task.status === 'in_progress' ? (
          <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
        ) : (
          <Circle className="w-3 h-3 text-slate-500 flex-shrink-0" />
        )}
        <InlineEditableText
          value={task.title}
          onSave={(newTitle) => onUpdateTitle?.(task.id, newTitle)}
          className="truncate text-left flex-1"
          disabled={!onUpdateTitle}
        />
        {/* Priority indicator */}
        {task.priority && task.priority !== 'medium' && (
          <PriorityBadge priority={task.priority} size="sm" showLabel={false} />
        )}
        {/* Dependencies indicator */}
        {task.dependencies && task.dependencies.length > 0 && (
          <span className="flex items-center text-amber-500" title={`${task.dependencies.length} зависимостей`}>
            <Link2 className="w-3 h-3" />
          </span>
        )}
        {/* Subtask progress indicator */}
        {task.subtasks && task.subtasks.length > 0 && (
          <SubtaskProgress
            completed={task.subtasks.filter(s => s.status === 'completed').length}
            total={task.subtasks.length}
            showIcon={false}
          />
        )}
        {/* Deadline indicator */}
        {task.deadline && (
          <TaskDeadlineIndicator deadline={task.deadline} />
        )}
        {/* Due date indicator */}
        {!task.deadline && task.dueDate && (
          <span className="text-[10px] text-slate-500 flex-shrink-0">
            {format(new Date(task.dueDate), 'd MMM', { locale: ru })}
          </span>
        )}
      </div>
    </div>
  );
}

// Sortable Section Item
function SortableSection({
  section,
  blockId,
  isExpanded,
  isSelected,
  selectedTaskId,
  onToggle,
  onSelectContext,
  onSelectTask,
  onCreateTask,
  onDelete,
  onMoveTask,
  onUpdateTaskTitle,
  onUpdateTaskDueDate,
  onUpdateTitle,
  getContextContent,
  filteredTaskIds,
  unreadCounts,
  onSectionContextMenu,
  onTaskContextMenu,
}: {
  section: Section;
  blockId: number;
  isExpanded: boolean;
  isSelected: boolean;
  selectedTaskId: number | null;
  onToggle: () => void;
  onSelectContext: () => void;
  onSelectTask: (task: Task & { sectionId: number }) => void;
  onCreateTask: () => void;
  onDelete: () => void;
  onMoveTask: (taskId: number, newSectionId: number, newSortOrder: number) => void;
  onUpdateTaskTitle?: (taskId: number, newTitle: string) => void;
  onUpdateTaskDueDate?: (taskId: number, dueDate: Date | null) => void;
  onUpdateTitle?: (sectionId: number, newTitle: string) => void;
  getContextContent: (type: string, id: number) => string;
  filteredTaskIds?: Set<number>;
  unreadCounts?: { blockUnreads: Record<number, number>; sectionUnreads: Record<number, number> };
  onSectionContextMenu?: (e: React.MouseEvent) => void;
  onTaskContextMenu?: (e: React.MouseEvent, task: Task, sectionId: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ 
    id: `section-${section.id}`,
    data: { type: 'section', section, blockId }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const taskIds = useMemo(() => 
    section.tasks?.map(t => `task-${t.id}`) || [], 
    [section.tasks]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "z-50",
        isOver && "ring-2 ring-amber-500/50 rounded"
      )}
    >
      <div className="flex items-center group">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div
          onClick={() => { onToggle(); onSelectContext(); }}
          onContextMenu={onSectionContextMenu}
          className={cn(
            "flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer",
            isSelected
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          )}
          <FileText className="w-3 h-3" />
          <InlineEditableText
            value={section.title}
            onSave={(newTitle) => onUpdateTitle?.(section.id, newTitle)}
            className="truncate flex-1 text-left"
            disabled={!onUpdateTitle}
          />
          <span className="text-slate-600">
            {section.tasks?.length || 0}
          </span>
          {unreadCounts?.sectionUnreads?.[section.id] && unreadCounts.sectionUnreads[section.id] > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-500 text-white animate-in fade-in">
              {unreadCounts.sectionUnreads[section.id] > 99 ? '99+' : unreadCounts.sectionUnreads[section.id]}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-500"
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700">
            <DropdownMenuItem 
              className="text-slate-300"
              onClick={onCreateTask}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить задачу
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-blue-400"
              onClick={onSelectContext}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Обсудить раздел
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-slate-300"
              onClick={onSelectContext}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              AI чат раздела
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem 
              className="text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить раздел
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Tasks */}
      {isExpanded && (
        <div className="ml-4 pl-2 border-l border-slate-800">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {section.tasks
              ?.filter(task => !filteredTaskIds || filteredTaskIds.size === 0 || filteredTaskIds.has(task.id))
              .map(task => (
              <SortableTask
                key={task.id}
                task={task}
                sectionId={section.id}
                isSelected={selectedTaskId === task.id}
                onSelect={() => onSelectTask({ ...task, sectionId: section.id })}
                onUpdateTitle={onUpdateTaskTitle}
                onUpdateDueDate={onUpdateTaskDueDate}
                onContextMenu={(e) => onTaskContextMenu?.(e, task, section.id)}
              />
            ))}
          </SortableContext>
          
          {/* Add task button */}
          <button
            onClick={onCreateTask}
            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors ml-4"
          >
            <Plus className="w-3 h-3" />
            Добавить задачу
          </button>
        </div>
      )}
    </div>
  );
}

// Sortable Block Item
function SortableBlock({
  block,
  header,
  expandedContent,
}: {
  block: Block;
  header: React.ReactNode;
  expandedContent?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `block-${block.id}`,
    data: { type: 'block', block },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("mb-1", isDragging && "z-50")}>
      <div className="flex items-center group">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {header}
      </div>
      {expandedContent}
    </div>
  );
}

// Block Drag Overlay
function BlockDragOverlay({ block, index }: { block: Block; index: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 text-white text-sm shadow-lg border border-amber-500">
      <GripVertical className="w-4 h-4 text-amber-500" />
      <span className="text-amber-500 font-mono text-xs">{String(index + 1).padStart(2, '0')}</span>
      <span>{block.titleRu || block.title}</span>
      <span className="text-slate-400 text-xs">({block.sections?.length || 0} разделов)</span>
    </div>
  );
}

// Drag Overlay Components
function TaskDragOverlay({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 text-white text-xs shadow-lg border border-amber-500">
      {task.status === 'completed' ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
      ) : task.status === 'in_progress' ? (
        <Clock className="w-3 h-3 text-amber-500" />
      ) : (
        <Circle className="w-3 h-3 text-slate-500" />
      )}
      <span>{task.title}</span>
    </div>
  );
}

function SectionDragOverlay({ section }: { section: Section }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-700 text-white text-xs shadow-lg border border-amber-500">
      <FileText className="w-3 h-3" />
      <span>{section.title}</span>
      <span className="text-slate-400">({section.tasks?.length || 0} задач)</span>
    </div>
  );
}

// Main Draggable Sidebar Component
export function DraggableSidebar({
  blocks,
  expandedBlocks,
  expandedSections,
  selectedContext,
  selectedTask,
  onToggleBlock,
  onToggleSection,
  onSelectContext,
  onSelectTask,
  onCreateSection,
  onCreateTask,
  onDeleteBlock,
  onDeleteSection,
  onMoveTask,
  onMoveSection,
  onReorderTasks,
  onReorderSections,
  onReorderBlocks,
  onUpdateTaskTitle,
  onUpdateTaskDueDate,
  onUpdateSectionTitle,
  onUpdateBlockTitle,
  getContextContent,
  filteredTaskIds,
  unreadCounts,
  onContextMenuAction,
  onDeleteTask,
  onUpdateTaskStatus,
  onUpdateTaskPriority,
}: DraggableSidebarProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'section' | 'block' | null>(null);
  const [activeItem, setActiveItem] = useState<Task | Section | Block | null>(null);
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  const handleContextMenuAction = useCallback((actionId: string, entityType: EntityType, entityData: TaskInfo | SectionInfo | BlockInfo) => {
    // Handle built-in actions
    if (entityType === 'block') {
      const block = entityData as BlockInfo;
      if (actionId === 'add-section') {
        onCreateSection(block.id);
        return;
      }
      if (actionId === 'delete') {
        onDeleteBlock(block.id);
        return;
      }
      if (actionId === 'discuss' || actionId === 'ai-chat') {
        onSelectContext({
          type: 'block',
          id: block.id,
          title: block.title,
          content: getContextContent('block', block.id)
        });
        return;
      }
    } else if (entityType === 'section') {
      const section = entityData as SectionInfo;
      if (actionId === 'add-task') {
        onCreateTask(section.id);
        return;
      }
      if (actionId === 'delete') {
        onDeleteSection(section.id);
        return;
      }
      if (actionId === 'discuss' || actionId === 'ai-chat') {
        onSelectContext({
          type: 'section',
          id: section.id,
          title: section.title,
          content: getContextContent('section', section.id)
        });
        return;
      }
    } else if (entityType === 'task') {
      const task = entityData as TaskInfo;
      if (actionId === 'open') {
        onSelectTask({ id: task.id, title: task.title, status: task.status, priority: task.priority, sectionId: task.sectionId } as Task & { sectionId: number });
        return;
      }
      if (actionId === 'delete') {
        onDeleteTask?.(task.id);
        return;
      }
      if (actionId.startsWith('status-')) {
        const status = actionId.replace('status-', '') as 'not_started' | 'in_progress' | 'completed';
        onUpdateTaskStatus?.(task.id, status);
        return;
      }
      if (actionId.startsWith('priority-')) {
        const priority = actionId.replace('priority-', '') as 'critical' | 'high' | 'medium' | 'low';
        onUpdateTaskPriority?.(task.id, priority);
        return;
      }
    }
    // Forward to parent for AI actions and other complex actions
    onContextMenuAction?.(actionId, entityType, entityData);
  }, [onCreateSection, onDeleteBlock, onSelectContext, getContextContent, onCreateTask, onDeleteSection, onSelectTask, onDeleteTask, onUpdateTaskStatus, onUpdateTaskPriority, onContextMenuAction]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    
    if (data?.type === 'task') {
      setActiveType('task');
      setActiveItem(data.task);
    } else if (data?.type === 'section') {
      setActiveType('section');
      setActiveItem(data.section);
    } else if (data?.type === 'block') {
      setActiveType('block');
      setActiveItem(data.block);
    }
    setActiveId(active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      setActiveItem(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    // Handle task movement
    if (activeData?.type === 'task' && overData) {
      const taskId = activeData.task.id;
      const sourceSectionId = activeData.sectionId;
      
      let targetSectionId: number;

      if (overData.type === 'task') {
        targetSectionId = overData.sectionId;
      } else if (overData.type === 'section') {
        targetSectionId = overData.section.id;
      } else {
        setActiveId(null);
        setActiveType(null);
        setActiveItem(null);
        return;
      }

      // Same section - reorder tasks
      if (sourceSectionId === targetSectionId && onReorderTasks) {
        const section = blocks
          .flatMap(b => b.sections || [])
          .find(s => s.id === sourceSectionId);
        
        if (section?.tasks) {
          const oldIndex = section.tasks.findIndex(t => t.id === taskId);
          const newIndex = overData.type === 'task' 
            ? section.tasks.findIndex(t => t.id === overData.task.id)
            : section.tasks.length;
          
          if (oldIndex !== -1 && oldIndex !== newIndex) {
            const newOrder = arrayMove(section.tasks, oldIndex, newIndex);
            onReorderTasks(sourceSectionId, newOrder.map(t => t.id));
          }
        }
      } else if (sourceSectionId !== targetSectionId) {
        // Different section - move task
        const targetSection = blocks
          .flatMap(b => b.sections || [])
          .find(s => s.id === targetSectionId);
        const newSortOrder = overData.type === 'task'
          ? (targetSection?.tasks?.findIndex(t => t.id === overData.task.id) ?? 0)
          : (targetSection?.tasks?.length || 0);
        onMoveTask(taskId, targetSectionId, newSortOrder);
      }
    }

    // Handle block reordering
    if (activeData?.type === 'block' && overData?.type === 'block' && onReorderBlocks) {
      const activeBlockId = activeData.block.id;
      const overBlockId = overData.block.id;
      
      if (activeBlockId !== overBlockId) {
        const oldIndex = blocks.findIndex(b => b.id === activeBlockId);
        const newIndex = blocks.findIndex(b => b.id === overBlockId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(blocks, oldIndex, newIndex);
          onReorderBlocks(newOrder.map(b => b.id));
        }
      }
    }

    // Handle section movement
    if (activeData?.type === 'section' && overData) {
      const sectionId = activeData.section.id;
      const sourceBlockId = activeData.blockId;
      
      if (overData.type === 'section') {
        const targetBlockId = overData.blockId;
        
        // Same block - reorder sections
        if (sourceBlockId === targetBlockId && onReorderSections) {
          const block = blocks.find(b => b.id === sourceBlockId);
          if (block?.sections) {
            const oldIndex = block.sections.findIndex(s => s.id === sectionId);
            const newIndex = block.sections.findIndex(s => s.id === overData.section.id);
            
            if (oldIndex !== -1 && oldIndex !== newIndex) {
              const newOrder = arrayMove(block.sections, oldIndex, newIndex);
              onReorderSections(sourceBlockId, newOrder.map(s => s.id));
            }
          }
        } else if (sourceBlockId !== targetBlockId) {
          // Different block - move section
          const newSortOrder = overData.section.sortOrder;
          onMoveSection(sectionId, targetBlockId, newSortOrder);
        }
      }
    }

    setActiveId(null);
    setActiveType(null);
    setActiveItem(null);
  };

  // Get all block IDs for sortable context
  const allBlockIds = useMemo(() =>
    blocks.map(b => `block-${b.id}`),
    [blocks]
  );

  // Get all section IDs for sortable context
  const allSectionIds = useMemo(() => 
    blocks.flatMap(b => b.sections?.map(s => `section-${s.id}`) || []),
    [blocks]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-2">
        <SortableContext items={allBlockIds} strategy={verticalListSortingStrategy}>
        {blocks.map((block, index) => (
          <SortableBlock key={block.id} block={block}
            header={
            <div className="flex-1 flex items-center">
              <div
                onClick={() => { onToggleBlock(block.id); onSelectContext({ type: 'block', id: block.id, title: block.titleRu || block.title, content: getContextContent('block', block.id) }); }}
                onContextMenu={(e) => openContextMenu(e, 'block', {
                  id: block.id,
                  title: block.titleRu || block.title,
                  sectionCount: block.sections?.length || 0,
                } as BlockInfo)}
                className="flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {expandedBlocks.has(block.id) ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-amber-500 font-mono text-xs">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <InlineEditableText
                  value={block.titleRu || block.title}
                  onSave={(newTitle) => onUpdateBlockTitle?.(block.id, newTitle)}
                  className="text-slate-300 flex-1 truncate"
                  disabled={!onUpdateBlockTitle}
                />
                {unreadCounts?.blockUnreads?.[block.id] && unreadCounts.blockUnreads[block.id] > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-bold rounded-full bg-blue-500 text-white animate-in fade-in">
                    {unreadCounts.blockUnreads[block.id] > 99 ? '99+' : unreadCounts.blockUnreads[block.id]}
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-500"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-700">
                  <DropdownMenuItem 
                    className="text-slate-300"
                    onClick={() => onCreateSection(block.id)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить раздел
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-blue-400"
                    onClick={() => onSelectContext({ 
                      type: 'block', 
                      id: block.id, 
                      title: block.titleRu || block.title,
                      content: getContextContent('block', block.id)
                    })}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Обсудить блок
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem 
                    className="text-red-400"
                    onClick={() => onDeleteBlock(block.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить блок
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            }
            expandedContent={
            expandedBlocks.has(block.id) ? (
              <div className="ml-6 pl-4 border-l border-slate-700">
                {/* Sections with Drag and Drop */}
                <SortableContext items={allSectionIds} strategy={verticalListSortingStrategy}>
                  {block.sections && block.sections.length > 0 ? (
                    block.sections.map(section => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        blockId={block.id}
                        isExpanded={expandedSections.has(section.id)}
                        isSelected={selectedContext?.type === 'section' && selectedContext?.id === section.id}
                        selectedTaskId={selectedTask?.id || null}
                        onToggle={() => onToggleSection(section.id)}
                        onSelectContext={() => onSelectContext({
                          type: 'section',
                          id: section.id,
                          title: section.title,
                          content: getContextContent('section', section.id)
                        })}
                        onSelectTask={onSelectTask}
                        onCreateTask={() => onCreateTask(section.id)}
                        onDelete={() => onDeleteSection(section.id)}
                        onMoveTask={onMoveTask}
                        onUpdateTaskTitle={onUpdateTaskTitle}
                        onUpdateTaskDueDate={onUpdateTaskDueDate}
                        onUpdateTitle={onUpdateSectionTitle}
                        getContextContent={getContextContent}
                        filteredTaskIds={filteredTaskIds}
                        unreadCounts={unreadCounts}
                        onSectionContextMenu={(e) => openContextMenu(e, 'section', {
                          id: section.id,
                          title: section.title,
                          blockId: block.id,
                          taskCount: section.tasks?.length || 0,
                        } as SectionInfo)}
                        onTaskContextMenu={(e, task, sectionId) => openContextMenu(e, 'task', {
                          id: task.id,
                          title: task.title,
                          status: task.status,
                          priority: task.priority,
                          sectionId,
                        } as TaskInfo)}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-slate-600 px-3 py-2">Нет разделов</p>
                  )}
                </SortableContext>
                
                {/* Add section button */}
                <button
                  onClick={() => onCreateSection(block.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Добавить раздел
                </button>
              </div>
            ) : undefined
            }
          />
        ))}
        </SortableContext>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeType === 'task' && activeItem && (
          <TaskDragOverlay task={activeItem as Task} />
        )}
        {activeId && activeType === 'section' && activeItem && (
          <SectionDragOverlay section={activeItem as Section} />
        )}
        {activeId && activeType === 'block' && activeItem && (
          <BlockDragOverlay block={activeItem as Block} index={blocks.findIndex(b => b.id === (activeItem as Block).id)} />
        )}
      </DragOverlay>

      {/* Context Menu */}
      {contextMenu && (
        <SidebarContextMenu
          position={contextMenu.position}
          entityType={contextMenu.entityType}
          entityData={contextMenu.entityData}
          onClose={closeContextMenu}
          onAction={handleContextMenuAction}
        />
      )}
    </DndContext>
  );
}
