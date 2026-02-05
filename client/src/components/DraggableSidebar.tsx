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
import { useState, useMemo } from 'react';
import { InlineEditableText } from '@/components/InlineEditableText';
import { InlineDatePicker } from '@/components/InlineDatePicker';
import { PriorityBadge } from '@/components/PriorityBadge';
import { TaskDeadlineBadge, TaskDeadlineIndicator } from '@/components/TaskDeadlineBadge';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, AlertTriangle, Link2 } from 'lucide-react';

// Types
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
  onUpdateTaskTitle?: (taskId: number, newTitle: string) => void;
  onUpdateTaskDueDate?: (taskId: number, dueDate: Date | null) => void;
  onUpdateSectionTitle?: (sectionId: number, newTitle: string) => void;
  onUpdateBlockTitle?: (blockId: number, newTitle: string) => void;
  getContextContent: (type: string, id: number) => string;
  filteredTaskIds?: Set<number>;
}

// Sortable Task Item
function SortableTask({ 
  task, 
  sectionId,
  isSelected,
  onSelect,
  onUpdateTitle,
  onUpdateDueDate
}: { 
  task: Task; 
  sectionId: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTitle?: (taskId: number, newTitle: string) => void;
  onUpdateDueDate?: (taskId: number, dueDate: Date | null) => void;
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
          onClick={onToggle}
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
  onUpdateTaskTitle,
  onUpdateTaskDueDate,
  onUpdateSectionTitle,
  onUpdateBlockTitle,
  getContextContent,
  filteredTaskIds,
}: DraggableSidebarProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'section' | null>(null);
  const [activeItem, setActiveItem] = useState<Task | Section | null>(null);

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
        {blocks.map((block, index) => (
          <div key={block.id} className="mb-1">
            {/* Block Header */}
            <div className="flex items-center group">
              <div
                onClick={() => onToggleBlock(block.id)}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-800 transition-colors cursor-pointer"
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
            
            {/* Expanded Block Content */}
            {expandedBlocks.has(block.id) && (
              <div className="ml-6 pl-4 border-l border-slate-700">
                {/* Block AI Chat */}
                <button
                  onClick={() => onSelectContext({ 
                    type: 'block', 
                    id: block.id, 
                    title: block.titleRu || block.title,
                    content: getContextContent('block', block.id)
                  })}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors",
                    selectedContext?.type === 'block' && selectedContext?.id === block.id
                      ? "bg-amber-500/20 text-amber-400"
                      : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  )}
                >
                  <MessageSquare className="w-3 h-3" />
                  AI чат блока
                </button>
                
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
            )}
          </div>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeType === 'task' && activeItem && (
          <TaskDragOverlay task={activeItem as Task} />
        )}
        {activeId && activeType === 'section' && activeItem && (
          <SectionDragOverlay section={activeItem as Section} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
