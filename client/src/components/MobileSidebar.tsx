/**
 * MobileSidebar - Mobile sidebar Sheet for ProjectView
 * Extracted from ProjectView.tsx
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ProjectSidebarContent } from '@/components/ProjectSidebarContent';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  number?: number | null;
  sections?: Array<{
    id: number;
    title: string;
    sortOrder?: number | null;
    tasks?: Array<{
      id: number;
      title: string;
      status: string | null;
      priority?: 'critical' | 'high' | 'medium' | 'low' | null;
      deadline?: Date | string | null;
      createdAt?: Date | string | null;
      description?: string | null;
      notes?: string | null;
      sortOrder?: number | null;
    }>;
  }>;
}

interface Project {
  id: number;
  name: string;
  description?: string | null;
  blocks?: ProjectBlock[];
}

interface SelectedContext {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
  content?: string;
}

interface SelectedTask {
  id: number;
  title: string;
  sectionId: number;
}

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  projectId: number;
  progress: { completed: number; total: number; percentage: number };
  expandedBlocks: Set<number>;
  expandedSections: Set<number>;
  selectedContext: SelectedContext | null;
  selectedTask: any;
  filteredTaskIds: Set<number>;
  unreadCounts?: { blockUnreads: Record<number, number>; sectionUnreads: Record<number, number> };
  allTasks: any[];
  sidebarHandlers: any;
  onToggleBlock: (id: number) => void;
  onToggleSection: (id: number) => void;
  onFilteredTasksChange: (ids: Set<number>) => void;
  getContextContent: (type: string, id: number) => string;
  onSelectContext: (ctx: SelectedContext) => void;
  onSelectTask: (task: any) => void;
  onSelectProjectChat: () => void;
}

export function MobileSidebar({
  open,
  onOpenChange,
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
  sidebarHandlers,
  onToggleBlock,
  onToggleSection,
  onFilteredTasksChange,
  getContextContent,
  onSelectContext,
  onSelectTask,
  onSelectProjectChat,
}: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 bg-slate-900 border-slate-800 [&>[data-slot=sheet-close]]:hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>Навигация</SheetTitle>
        </SheetHeader>
        <ProjectSidebarContent
          project={project}
          projectId={projectId}
          progress={progress}
          expandedBlocks={expandedBlocks}
          expandedSections={expandedSections}
          selectedContext={selectedContext}
          selectedTask={selectedTask}
          filteredTaskIds={filteredTaskIds}
          unreadCounts={unreadCounts}
          allTasks={allTasks}
          handlers={{
            ...sidebarHandlers,
            onSelectContext: (ctx: SelectedContext) => {
              onSelectContext(ctx);
              onOpenChange(false);
            },
            onSelectTask: (task: any) => {
              onSelectTask(task);
              onOpenChange(false);
            },
          }}
          onToggleBlock={onToggleBlock}
          onToggleSection={onToggleSection}
          onFilteredTasksChange={onFilteredTasksChange}
          getContextContent={getContextContent}
          onSelectProjectChat={() => {
            onSelectProjectChat();
            onOpenChange(false);
          }}
          showFilters={false}
        />
      </SheetContent>
    </Sheet>
  );
}
