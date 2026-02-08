/**
 * DesktopSidebar - Desktop sidebar for ProjectView
 * Extracted from ProjectView.tsx
 */

import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft } from 'lucide-react';
import { PresenceAvatars } from '@/components/PresenceAvatars';
import { ProjectActionsDropdown } from '@/components/ProjectActionsDropdown';
import { ProjectSidebarContent } from '@/components/ProjectSidebarContent';
import { CreateBlockDialog } from '@/components/CreateEntityDialogs';

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

interface PresenceUser {
  id: number;
  name: string;
  color?: string;
}

interface DesktopSidebarProps {
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
  presenceUsers: any[];
  sidebarHandlers: any;
  onToggleBlock: (id: number) => void;
  onToggleSection: (id: number) => void;
  onFilteredTasksChange: (ids: Set<number>) => void;
  getContextContent: (type: string, id: number) => string;
  onSelectProjectChat: () => void;
  // Actions dropdown
  onNavigate: (path: string) => void;
  onSaveToDrive: () => void;
  onExportToGoogleDocs: () => void;
  onOpenCalendar: () => void;
  onOpenCustomFields: () => void;
  onOpenAIAssistant: () => void;
  onOpenRiskPanel: () => void;
  onOpenSaveTemplate: () => void;
  onOpenPitchDeck: () => void;
  onDeleteProject: () => void;
  onSaveToNotebookLM: () => Promise<void>;
  isSavingToDrive: boolean;
  isExportingToGoogleDocs: boolean;
  // Create block dialog
  createBlockOpen: boolean;
  setCreateBlockOpen: (open: boolean) => void;
  newBlockTitle: string;
  newBlockTitleRu: string;
  setNewBlockTitle: (title: string) => void;
  setNewBlockTitleRu: (title: string) => void;
  onCreateBlock: () => void;
  isCreatingBlock: boolean;
}

export function DesktopSidebar({
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
  presenceUsers,
  sidebarHandlers,
  onToggleBlock,
  onToggleSection,
  onFilteredTasksChange,
  getContextContent,
  onSelectProjectChat,
  onNavigate,
  onSaveToDrive,
  onExportToGoogleDocs,
  onOpenCalendar,
  onOpenCustomFields,
  onOpenAIAssistant,
  onOpenRiskPanel,
  onOpenSaveTemplate,
  onOpenPitchDeck,
  onDeleteProject,
  onSaveToNotebookLM,
  isSavingToDrive,
  isExportingToGoogleDocs,
  createBlockOpen,
  setCreateBlockOpen,
  newBlockTitle,
  newBlockTitleRu,
  setNewBlockTitle,
  setNewBlockTitleRu,
  onCreateBlock,
  isCreatingBlock,
}: DesktopSidebarProps) {
  return (
    <aside className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/95">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white mb-3">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">{project.description}</p>
            )}
          </div>
          <ProjectActionsDropdown
            projectId={projectId}
            onNavigate={onNavigate}
            onSaveToDrive={onSaveToDrive}
            onExportToGoogleDocs={onExportToGoogleDocs}
            onOpenCalendar={onOpenCalendar}
            onOpenCustomFields={onOpenCustomFields}
            onOpenAIAssistant={onOpenAIAssistant}
            onOpenRiskPanel={onOpenRiskPanel}
            onOpenSaveTemplate={onOpenSaveTemplate}
            onOpenPitchDeck={onOpenPitchDeck}
            onDeleteProject={onDeleteProject}
            isSavingToDrive={isSavingToDrive}
            isExportingToGoogleDocs={isExportingToGoogleDocs}
            onSaveToNotebookLM={onSaveToNotebookLM}
          />
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Прогресс</span>
            <span className="text-white font-medium">{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-2 bg-slate-700" />
          <p className="text-xs text-slate-500 mt-1">
            {progress.completed} из {progress.total} задач
          </p>
        </div>

        {/* Online Users */}
        {presenceUsers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <PresenceAvatars users={presenceUsers} size="sm" />
          </div>
        )}
      </div>

      {/* Blocks List */}
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
        handlers={sidebarHandlers}
        onToggleBlock={onToggleBlock}
        onToggleSection={onToggleSection}
        onFilteredTasksChange={onFilteredTasksChange}
        getContextContent={getContextContent}
        onSelectProjectChat={onSelectProjectChat}
        showFilters={true}
        hideHeader={true}
      />

      {/* Add Block Button */}
      <div className="p-4 border-t border-slate-800">
        <CreateBlockDialog
          open={createBlockOpen}
          onOpenChange={setCreateBlockOpen}
          title={newBlockTitle}
          titleRu={newBlockTitleRu}
          onTitleChange={setNewBlockTitle}
          onTitleRuChange={setNewBlockTitleRu}
          onSubmit={onCreateBlock}
          isPending={isCreatingBlock}
        />
      </div>
    </aside>
  );
}
