import React, { useState } from 'react';
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
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { GripVertical, CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Task {
  id: number;
  title: string;
  status: string | null;
  sectionId: number;
  sortOrder: number | null;
}

interface Section {
  id: number;
  title: string;
  blockId: number;
  sortOrder: number | null;
  tasks: Task[];
}

interface Block {
  id: number;
  title: string;
  sections: Section[];
}

// Sortable Task Item
interface SortableTaskProps {
  task: Task;
  onTaskClick?: (task: Task) => void;
  isOverlay?: boolean;
}

export function SortableTask({ task, onTaskClick, isOverlay }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusIcon = task.status === 'completed' ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
  ) : task.status === 'in_progress' ? (
    <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
  ) : (
    <Circle className="w-5 h-5 text-slate-500 flex-shrink-0" />
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-slate-800/50 border-slate-700 hover:border-slate-600 cursor-pointer mb-2 transition-all",
        isDragging && "opacity-50 border-amber-500/50",
        isOverlay && "shadow-2xl border-amber-500 rotate-2"
      )}
      onClick={() => !isDragging && onTaskClick?.(task)}
    >
      <CardContent className="py-3 px-4 flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-2 hover:bg-slate-700/50 rounded touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-slate-500" />
        </button>
        {statusIcon}
        <span className="text-slate-300 flex-1 truncate">{task.title}</span>
      </CardContent>
    </Card>
  );
}

// Sortable Section Item
interface SortableSectionProps {
  section: Section;
  children: React.ReactNode;
  onSectionClick?: (section: Section) => void;
  isOverlay?: boolean;
}

export function SortableSection({ section, children, onSectionClick, isOverlay }: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `section-${section.id}`,
    data: {
      type: 'section',
      section,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-4 transition-all",
        isDragging && "opacity-50",
        isOverlay && "shadow-2xl"
      )}
    >
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg mb-2 cursor-pointer",
          "bg-slate-800/30 hover:bg-slate-800/50 border border-transparent",
          isDragging && "border-amber-500/50"
        )}
        onClick={() => !isDragging && onSectionClick?.(section)}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-700/50 rounded touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-slate-500" />
        </button>
        <span className="text-slate-200 font-medium flex-1">{section.title}</span>
        <span className="text-xs text-slate-500">{section.tasks?.length || 0} задач</span>
      </div>
      <div className="pl-6">
        {children}
      </div>
    </div>
  );
}

// Droppable Section (for receiving tasks)
interface DroppableSectionProps {
  sectionId: number;
  children: React.ReactNode;
  isOver?: boolean;
}

export function DroppableSection({ sectionId, children, isOver }: DroppableSectionProps) {
  return (
    <div 
      className={cn(
        "min-h-[60px] rounded-lg transition-all p-2 -m-2",
        isOver && "bg-amber-500/10 border-2 border-dashed border-amber-500/50"
      )}
      data-section-id={sectionId}
    >
      {children}
    </div>
  );
}

// Main Drag Drop Provider
interface DragDropProviderProps {
  blocks: Block[];
  onTaskMove: (taskId: number, newSectionId: number, newSortOrder: number) => void;
  onTaskReorder: (sectionId: number, taskIds: number[]) => void;
  onSectionReorder: (blockId: number, sectionIds: number[]) => void;
  onTaskClick?: (task: Task) => void;
  onSectionClick?: (section: Section) => void;
  children?: React.ReactNode;
}

export function DragDropProvider({
  blocks,
  onTaskMove,
  onTaskReorder,
  onSectionReorder,
  onTaskClick,
  onSectionClick,
  children,
}: DragDropProviderProps) {
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

  const findTask = (id: string): Task | undefined => {
    const taskId = parseInt(id.replace('task-', ''));
    for (const block of blocks) {
      for (const section of block.sections) {
        const task = section.tasks?.find(t => t.id === taskId);
        if (task) return task;
      }
    }
    return undefined;
  };

  const findSection = (id: string): Section | undefined => {
    const sectionId = parseInt(id.replace('section-', ''));
    for (const block of blocks) {
      const section = block.sections.find(s => s.id === sectionId);
      if (section) return section;
    }
    return undefined;
  };

  const findSectionByTaskId = (taskId: number): Section | undefined => {
    for (const block of blocks) {
      for (const section of block.sections) {
        if (section.tasks?.some(t => t.id === taskId)) {
          return section;
        }
      }
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = String(active.id);
    
    if (id.startsWith('task-')) {
      setActiveType('task');
      setActiveItem(findTask(id) || null);
    } else if (id.startsWith('section-')) {
      setActiveType('section');
      setActiveItem(findSection(id) || null);
    }
    setActiveId(active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Only handle task dragging over sections or other tasks
    if (!activeIdStr.startsWith('task-')) return;

    const activeTaskId = parseInt(activeIdStr.replace('task-', ''));
    const activeSection = findSectionByTaskId(activeTaskId);
    
    let overSectionId: number | null = null;
    
    if (overIdStr.startsWith('section-')) {
      overSectionId = parseInt(overIdStr.replace('section-', ''));
    } else if (overIdStr.startsWith('task-')) {
      const overTaskId = parseInt(overIdStr.replace('task-', ''));
      const overSection = findSectionByTaskId(overTaskId);
      overSectionId = overSection?.id || null;
    }

    // If moving to a different section, handle it
    if (overSectionId && activeSection && activeSection.id !== overSectionId) {
      // This will be handled in dragEnd
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setActiveType(null);
    setActiveItem(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Handle task reordering/moving
    if (activeIdStr.startsWith('task-')) {
      const activeTaskId = parseInt(activeIdStr.replace('task-', ''));
      const activeSection = findSectionByTaskId(activeTaskId);
      
      if (!activeSection) return;

      // Determine target section
      let targetSectionId: number;
      let targetTaskId: number | null = null;

      if (overIdStr.startsWith('section-')) {
        targetSectionId = parseInt(overIdStr.replace('section-', ''));
      } else if (overIdStr.startsWith('task-')) {
        targetTaskId = parseInt(overIdStr.replace('task-', ''));
        const targetSection = findSectionByTaskId(targetTaskId);
        if (!targetSection) return;
        targetSectionId = targetSection.id;
      } else {
        return;
      }

      // Same section - reorder
      if (activeSection.id === targetSectionId) {
        const tasks = activeSection.tasks || [];
        const oldIndex = tasks.findIndex(t => t.id === activeTaskId);
        const newIndex = targetTaskId 
          ? tasks.findIndex(t => t.id === targetTaskId)
          : tasks.length;
        
        if (oldIndex !== newIndex && oldIndex !== -1) {
          const newOrder = arrayMove(tasks, oldIndex, newIndex);
          onTaskReorder(activeSection.id, newOrder.map(t => t.id));
        }
      } else {
        // Different section - move task
        const targetSection = blocks
          .flatMap(b => b.sections)
          .find(s => s.id === targetSectionId);
        
        if (targetSection) {
          const targetTasks = targetSection.tasks || [];
          const newSortOrder = targetTaskId
            ? targetTasks.findIndex(t => t.id === targetTaskId)
            : targetTasks.length;
          
          onTaskMove(activeTaskId, targetSectionId, Math.max(0, newSortOrder));
        }
      }
    }

    // Handle section reordering
    if (activeIdStr.startsWith('section-') && overIdStr.startsWith('section-')) {
      const activeSectionId = parseInt(activeIdStr.replace('section-', ''));
      const overSectionId = parseInt(overIdStr.replace('section-', ''));

      // Find the block containing these sections
      for (const block of blocks) {
        const activeIndex = block.sections.findIndex(s => s.id === activeSectionId);
        const overIndex = block.sections.findIndex(s => s.id === overSectionId);

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          const newOrder = arrayMove(block.sections, activeIndex, overIndex);
          onSectionReorder(block.id, newOrder.map(s => s.id));
          break;
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      
      <DragOverlay>
        {activeId && activeType === 'task' && activeItem && (
          <SortableTask 
            task={activeItem as Task} 
            isOverlay 
          />
        )}
        {activeId && activeType === 'section' && activeItem && (
          <div className="bg-slate-800 border border-amber-500 rounded-lg p-3 shadow-2xl rotate-2">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-amber-500" />
              <span className="text-slate-200 font-medium">{(activeItem as Section).title}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// Export utilities
export { SortableContext, verticalListSortingStrategy };
