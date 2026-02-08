/**
 * MainContentArea - Main content panel for ProjectView
 * Renders TaskDetailPanel, BlockDetailPanel, SectionDetailPanel, or fallback views
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { TaskDetailPanel, TaskUpdateData } from '@/components/TaskDetailPanel';
import { BlockDetailPanel } from '@/components/BlockDetailPanel';
import { SectionDetailPanel } from '@/components/SectionDetailPanel';
import { QuickActionsBar } from '@/components/QuickActionsBar';
import { MobileBlocksList } from '@/components/MobileBlocksList';
import { EmptyStatePanel } from '@/components/EmptyStatePanel';
import { MessageSquare, Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  number?: number | null;
  sections?: ProjectSection[];
}

interface ProjectSection {
  id: number;
  title: string;
  tasks?: ProjectTask[];
}

interface ProjectTask {
  id: number;
  title: string;
  status: string | null;
  description?: string | null;
  notes?: string | null;
  priority?: string | null;
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
  description?: string | null;
  status: string | null;
  notes?: string | null;
  summary?: string | null;
  sectionId: number;
}

interface DiscussionEntity {
  type: 'project' | 'block' | 'section' | 'task';
  id: number;
  title: string;
}

interface DetailPanelHandlers {
  onSelectSection: (sectionId: number, sectionTitle: string) => void;
  onSelectTaskFromBlock: (taskId: number, taskTitle: string, sectionId: number, block: ProjectBlock) => void;
  onSelectTask: (task: ProjectTask, sectionId: number) => void;
  onCreateSection: (blockId: number) => void;
  onCreateTask: (sectionId: number) => void;
  onNavigate: (item: { type: string; id: number; title: string }) => void;
  onMarkRead: (entityType: string, entityId: number) => void;
  onDeleteTask: (taskId: number, confirm?: boolean) => void;
  onUpdateTaskStatus: (taskId: number, status: string) => void;
  onDuplicateTask: (taskId: number) => void;
  onSplitTask: (task: ProjectTask, sectionId: number) => void;
  onConvertTaskToSection: (task: ProjectTask, sectionId: number) => void;
  onMergeTasks: (sectionId: number, blockId: number) => void;
  onConvertSectionToTask: (sectionId: number, blockId: number) => void;
}

interface MainContentAreaProps {
  project: {
    id: number;
    name: string;
    blocks: ProjectBlock[];
  };
  projectId: number;
  isMobile: boolean;
  selectedTask: SelectedTask | null;
  selectedContext: SelectedContext | null;
  allTasks: Array<{ id: number; title: string; status: string | null }>;
  discussionEntity: DiscussionEntity | null;
  selectionMode: boolean;
  selectedTaskIds: number[];
  progress: { completed: number; total: number; percentage: number };
  handlers: DetailPanelHandlers;
  // Task panel specific
  onCloseTask: () => void;
  onUpdateTask: (data: TaskUpdateData) => void;
  onSaveNote: (content: string) => void;
  onSaveDocument: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  typingUsers: Array<{ userId: number; userName: string }>;
  // Discussion/selection specific
  setDiscussionEntity: (entity: DiscussionEntity | null) => void;
  onToggleSelectionMode: () => void;
  onToggleTaskSelection: (taskId: number) => void;
  onBulkActions: () => void;
  // Mobile specific
  getContextContent: (type: string, id: number) => string;
  setSelectedContext: (ctx: SelectedContext | null) => void;
  setSelectedTask: (task: SelectedTask | null) => void;
  setMobileShowDetail: (show: boolean) => void;
}

export function MainContentArea({
  project,
  projectId,
  isMobile,
  selectedTask,
  selectedContext,
  allTasks,
  discussionEntity,
  selectionMode,
  selectedTaskIds,
  progress,
  handlers,
  onCloseTask,
  onUpdateTask,
  onSaveNote,
  onSaveDocument,
  onTypingStart,
  onTypingStop,
  typingUsers,
  setDiscussionEntity,
  onToggleSelectionMode,
  onToggleTaskSelection,
  onBulkActions,
  getContextContent,
  setSelectedContext,
  setSelectedTask,
  setMobileShowDetail,
}: MainContentAreaProps) {
  // Task detail view
  if (selectedTask) {
    return (
      <TaskDetailPanel
        task={selectedTask}
        projectId={projectId}
        allTasks={allTasks}
        onClose={onCloseTask}
        onUpdate={onUpdateTask}
        onSaveNote={onSaveNote}
        onSaveDocument={onSaveDocument}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        typingUsers={typingUsers}
      />
    );
  }

  // Block/Section/Project context view
  if (selectedContext) {
    return (
      <ScrollArea className="flex-1">
        {selectedContext.type === 'block' && (() => {
          const block = project.blocks?.find((b) => b.id === selectedContext.id);
          if (!block) return null;
          // Normalize block to ensure number is always defined for BlockDetailPanel
          const normalizedBlock = { ...block, number: block.number ?? 0 };
          return (
            <BlockDetailPanel
              block={normalizedBlock}
              projectId={projectId}
              projectName={project.name}
              onSelectSection={handlers.onSelectSection}
              onSelectTask={(taskId, taskTitle, sectionId) =>
                handlers.onSelectTaskFromBlock(taskId, taskTitle, sectionId, block)
              }
              onCreateSection={handlers.onCreateSection}
              onNavigate={handlers.onNavigate}
              onMarkRead={handlers.onMarkRead}
              onDeleteTask={(taskId) => handlers.onDeleteTask(taskId, true)}
              onUpdateTaskStatus={(taskId, status) =>
                handlers.onUpdateTaskStatus(taskId, status as "not_started" | "in_progress" | "completed")
              }
            />
          );
        })()}

        {selectedContext.type === 'section' && (() => {
          const block = project.blocks?.find((b) =>
            b.sections?.some((s) => s.id === selectedContext.id)
          );
          const section = block?.sections?.find((s) => s.id === selectedContext.id);
          if (!block || !section) return null;
          return (
            <SectionDetailPanel
              section={{ ...section, blockId: block.id }}
              blockTitle={block.titleRu || block.title}
              blockId={block.id}
              projectId={projectId}
              projectName={project.name}
              onSelectTask={handlers.onSelectTask}
              onCreateTask={handlers.onCreateTask}
              onNavigate={handlers.onNavigate}
              onMarkRead={handlers.onMarkRead}
              onDeleteTask={(taskId) => handlers.onDeleteTask(taskId, false)}
              onDuplicateTask={handlers.onDuplicateTask}
              onSplitTask={handlers.onSplitTask}
              onConvertTaskToSection={handlers.onConvertTaskToSection}
              onMergeTasks={(sectionId) => handlers.onMergeTasks(sectionId, block.id)}
              onConvertSectionToTask={(sectionId) => handlers.onConvertSectionToTask(sectionId, block.id)}
              selectionMode={selectionMode}
              selectedTaskIds={selectedTaskIds}
              onToggleSelectionMode={onToggleSelectionMode}
              onToggleTaskSelection={onToggleTaskSelection}
              onBulkActions={onBulkActions}
              onUpdateTaskStatus={(taskId, status) =>
                handlers.onUpdateTaskStatus(taskId, status as "not_started" | "in_progress" | "completed")
              }
            />
          );
        })()}

        {/* Fallback for project-level context */}
        {selectedContext.type !== 'block' && selectedContext.type !== 'section' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-2">{selectedContext.title}</h2>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "border-slate-600 text-blue-400 hover:bg-blue-500/10"
                )}
                onClick={() => {
                  if (discussionEntity?.type === selectedContext.type && discussionEntity?.id === selectedContext.id) {
                    setDiscussionEntity(null);
                  } else {
                    setDiscussionEntity({
                      type: selectedContext.type,
                      id: selectedContext.id,
                      title: selectedContext.title
                    });
                    handlers.onMarkRead(selectedContext.type, selectedContext.id);
                  }
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Обсудить
              </Button>
              {selectedContext.type !== 'project' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-purple-400 hover:bg-purple-500/10"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  AI чат
                </Button>
              )}
            </div>

            {/* AI Quick Actions Bar */}
            {selectedContext.type !== 'project' && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-slate-400">Быстрые действия AI</span>
                </div>
                <QuickActionsBar
                  entityType={selectedContext.type as 'block' | 'section' | 'task'}
                  entityId={selectedContext.id}
                  projectId={projectId}
                  onInsertResult={(content) => {
                    navigator.clipboard.writeText(content);
                    toast.success('Скопировано в буфер обмена');
                  }}
                />
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    );
  }

  // Mobile blocks list or desktop empty state
  if (isMobile) {
    return (
      <MobileBlocksList
        projectName={project.name}
        blocks={project.blocks || []}
        progress={progress}
        onSelectBlock={(block) => {
          setSelectedContext({
            type: 'block',
            id: block.id,
            title: block.titleRu || block.title,
            content: getContextContent('block', block.id)
          });
          setSelectedTask(null);
          setMobileShowDetail(true);
        }}
      />
    );
  }

  return <EmptyStatePanel />;
}
