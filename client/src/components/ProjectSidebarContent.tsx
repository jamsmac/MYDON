/**
 * ProjectSidebarContent - Shared sidebar content for mobile and desktop
 * Contains progress bar and DraggableSidebar with all handlers
 */

import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DraggableSidebar } from '@/components/DraggableSidebar';
import { TaskFiltersBar } from '@/components/TaskFiltersBar';
import { type EntityType, type TaskInfo, type SectionInfo, type BlockInfo } from '@/components/SidebarContextMenu';
import { MessageSquare, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  sections?: ProjectSection[];
  number?: number | null;
}

interface ProjectSection {
  id: number;
  title: string;
  tasks?: ProjectTask[];
  sortOrder?: number | null;
}

interface ProjectTask {
  id: number;
  title: string;
  status: string | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  deadline?: Date | string | null;
  description?: string | null;
  notes?: string | null;
  summary?: string | null;
  sortOrder?: number | null;
  sectionId?: number;
}

interface SelectedContext {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
  content?: string;
}

interface Progress {
  completed: number;
  total: number;
  percentage: number;
}

interface SidebarHandlers {
  onSelectContext: (ctx: SelectedContext) => void;
  onSelectTask: (task: ProjectTask & { sectionId: number }) => void;
  onCreateSection: (blockId: number) => void;
  onCreateTask: (sectionId: number) => void;
  onDeleteBlock: (id: number) => void;
  onDeleteSection: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onMoveTask: (taskId: number, newSectionId: number, newSortOrder: number) => void;
  onMoveSection: (sectionId: number, newBlockId: number, newSortOrder: number) => void;
  onReorderTasks: (sectionId: number, taskIds: number[]) => void;
  onReorderSections: (blockId: number, sectionIds: number[]) => void;
  onReorderBlocks: (blockIds: number[]) => void;
  onUpdateTaskTitle: (taskId: number, newTitle: string) => void;
  onUpdateTaskDueDate: (taskId: number, dueDate: Date | null) => void;
  onUpdateTaskStatus: (taskId: number, status: 'not_started' | 'in_progress' | 'completed') => void;
  onUpdateTaskPriority: (taskId: number, priority: 'critical' | 'high' | 'medium' | 'low') => void;
  onUpdateSectionTitle: (sectionId: number, newTitle: string) => void;
  onUpdateBlockTitle: (blockId: number, newTitle: string) => void;
  onContextMenuAction: (actionId: string, entityType: EntityType, entityData: TaskInfo | SectionInfo | BlockInfo) => void;
}

interface ProjectSidebarContentProps {
  project: {
    id: number;
    name: string;
    description?: string | null;
    blocks: ProjectBlock[];
  };
  projectId: number;
  progress: Progress;
  expandedBlocks: Set<number>;
  expandedSections: Set<number>;
  selectedContext: SelectedContext | null;
  selectedTask: ProjectTask | null;
  filteredTaskIds: Set<number>;
  unreadCounts?: { blockUnreads: Record<number, number>; sectionUnreads: Record<number, number> };
  allTasks: Array<{ id: number; title: string; status: string | null; priority?: 'critical' | 'high' | 'medium' | 'low' | null; deadline?: Date | string | null }>;
  handlers: SidebarHandlers;
  onToggleBlock: (id: number) => void;
  onToggleSection: (id: number) => void;
  onFilteredTasksChange: (ids: Set<number>) => void;
  getContextContent: (type: string, id: number) => string;
  onSelectProjectChat: () => void;
  showFilters?: boolean;
  headerExtra?: React.ReactNode;
  hideHeader?: boolean;
}

export function ProjectSidebarContent({
  project,
  projectId,
  progress,
  expandedBlocks,
  expandedSections,
  selectedContext,
  selectedTask,
  filteredTaskIds,
  unreadCounts,
  allTasks,
  handlers,
  onToggleBlock,
  onToggleSection,
  onFilteredTasksChange,
  getContextContent,
  onSelectProjectChat,
  showFilters = true,
  headerExtra,
  hideHeader = false,
}: ProjectSidebarContentProps) {
  const normalizedBlocks = project.blocks.map((b, index) => ({
    ...b,
    number: b.number ?? index + 1,
    sections: b.sections?.map((s) => ({
      ...s,
      sortOrder: s.sortOrder || 0,
      tasks: s.tasks?.map((t) => ({
        ...t,
        sortOrder: t.sortOrder || 0,
      })),
    })),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header with progress (optional) */}
      {!hideHeader && (
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
              )}
            </div>
            {headerExtra}
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-400">Прогресс</span>
              <span className="text-white font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2 bg-slate-700" />
            <p className="text-xs text-slate-500 mt-1">
              {progress.completed} из {progress.total} задач
            </p>
          </div>
        </div>
      )}

      {/* Blocks list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Project AI Chat button */}
          <button
            onClick={onSelectProjectChat}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-2 transition-colors",
              selectedContext?.type === 'project' && selectedContext?.id === project.id
                ? "bg-amber-500/20 text-amber-400"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            AI чат проекта
          </button>

          {/* Task Filters */}
          {showFilters && allTasks.length > 0 && (
            <TaskFiltersBar
              tasks={allTasks}
              projectId={projectId}
              onFilteredTasksChange={onFilteredTasksChange}
              className="mb-2"
            />
          )}

          {/* Draggable Blocks */}
          {project.blocks && project.blocks.length > 0 ? (
            <DraggableSidebar
              blocks={normalizedBlocks}
              expandedBlocks={expandedBlocks}
              expandedSections={expandedSections}
              selectedContext={selectedContext}
              selectedTask={selectedTask}
              onToggleBlock={onToggleBlock}
              onToggleSection={onToggleSection}
              onSelectContext={handlers.onSelectContext}
              onSelectTask={handlers.onSelectTask}
              onCreateSection={handlers.onCreateSection}
              onCreateTask={handlers.onCreateTask}
              onDeleteBlock={handlers.onDeleteBlock}
              onDeleteSection={handlers.onDeleteSection}
              onMoveTask={handlers.onMoveTask}
              onMoveSection={handlers.onMoveSection}
              onReorderTasks={handlers.onReorderTasks}
              onReorderSections={handlers.onReorderSections}
              onReorderBlocks={handlers.onReorderBlocks}
              onUpdateTaskTitle={handlers.onUpdateTaskTitle}
              onUpdateTaskDueDate={handlers.onUpdateTaskDueDate}
              onUpdateSectionTitle={handlers.onUpdateSectionTitle}
              onUpdateBlockTitle={handlers.onUpdateBlockTitle}
              getContextContent={getContextContent}
              filteredTaskIds={filteredTaskIds}
              unreadCounts={unreadCounts}
              onDeleteTask={handlers.onDeleteTask}
              onUpdateTaskStatus={handlers.onUpdateTaskStatus}
              onUpdateTaskPriority={handlers.onUpdateTaskPriority}
              onContextMenuAction={handlers.onContextMenuAction}
            />
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет блоков</p>
              <p className="text-xs mt-1">Создайте первый блок</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
