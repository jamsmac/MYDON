/**
 * useSidebarHandlers - Hook for DraggableSidebar event handlers
 * Extracted from ProjectView.tsx to reduce duplication between mobile and desktop sidebars
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { type TaskInfo, type SectionInfo, type BlockInfo, type EntityType } from '@/components/SidebarContextMenu';

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
  priority?: 'critical' | 'high' | 'medium' | 'low' | string | null;
  deadline?: Date | string | number | null;
  sortOrder?: number | null;
}

type EntityTypeUnion = 'project' | 'block' | 'section' | 'task';

interface UseSidebarHandlersOptions {
  projectId: number;
  getContextContent: (type: string, id: number) => string;
  setSelectedContext: (ctx: SelectedContext | null) => void;
  setSelectedTask: (task: SelectedTask | null) => void;
  setAIChatTask: (task: {
    id: string;
    numericId?: number;
    title: string;
    status?: string;
    priority?: string;
    deadline?: number | null;
    notes?: string;
    blockId?: string;
    sectionId?: string;
  } | null) => void;
  setDiscussionEntity: (entity: { type: EntityTypeUnion; id: number; title: string } | null) => void;
  createDialogs: {
    openSection: (blockId: number) => void;
    openTask: (sectionId: number) => void;
  };
  mutations: {
    deleteBlock: { mutate: (data: { id: number }) => void };
    deleteSection: { mutate: (data: { id: number }) => void };
    deleteTask: { mutate: (data: { id: number }) => void };
    moveTask: { mutate: (data: { id: number; sectionId: number; sortOrder: number }) => void };
    moveSection: { mutate: (data: { id: number; blockId: number; sortOrder: number }) => void };
    reorderTasks: { mutate: (data: { sectionId: number; taskIds: number[] }) => void };
    reorderSections: { mutate: (data: { blockId: number; sectionIds: number[] }) => void };
    reorderBlocks: { mutate: (data: { projectId: number; blockIds: number[] }) => void };
    updateTask: { mutate: (data: { id: number; [key: string]: unknown }) => void };
    updateSection: { mutate: (data: { id: number; title: string }) => void };
    updateBlock: { mutate: (data: { id: number; titleRu: string }) => void };
  };
}

export function useSidebarHandlers({
  projectId,
  getContextContent,
  setSelectedContext,
  setSelectedTask,
  setAIChatTask,
  setDiscussionEntity,
  createDialogs,
  mutations,
}: UseSidebarHandlersOptions) {
  const handleSelectContext = useCallback(
    (ctx: SelectedContext) => {
      setSelectedContext(ctx);
      if (ctx.type === 'block' || ctx.type === 'section' || ctx.type === 'project') {
        setSelectedTask(null);
        setAIChatTask(null);
      }
    },
    [setSelectedContext, setSelectedTask, setAIChatTask]
  );

  const handleSelectTask = useCallback(
    (task: SelectedTask) => {
      setSelectedTask(task);
      setSelectedContext({
        type: 'task',
        id: task.id,
        title: task.title,
        content: getContextContent('task', task.id),
      });
      setAIChatTask({
        id: `task-${task.id}`,
        numericId: task.id,
        title: task.title,
        status: task.status || 'not_started',
        priority: task.priority || 'medium',
        deadline: task.deadline
          ? typeof task.deadline === 'number'
            ? task.deadline
            : new Date(task.deadline as string | Date).getTime()
          : null,
        notes: task.notes || undefined,
        sectionId: String(task.sectionId),
      });
    },
    [setSelectedTask, setSelectedContext, setAIChatTask, getContextContent]
  );

  const handleDeleteBlock = useCallback(
    (id: number) => {
      if (confirm('Удалить блок?')) {
        mutations.deleteBlock.mutate({ id });
      }
    },
    [mutations.deleteBlock]
  );

  const handleDeleteSection = useCallback(
    (id: number) => {
      if (confirm('Удалить раздел?')) {
        mutations.deleteSection.mutate({ id });
      }
    },
    [mutations.deleteSection]
  );

  const handleDeleteTask = useCallback(
    (id: number) => {
      if (confirm('Удалить задачу?')) {
        mutations.deleteTask.mutate({ id });
      }
    },
    [mutations.deleteTask]
  );

  const handleContextMenuAction = useCallback(
    (actionId: string, entityType: EntityType, entityData: BlockInfo | SectionInfo | TaskInfo) => {
      if (actionId === 'discuss') {
        if (entityType === 'block') {
          const block = entityData as BlockInfo;
          setSelectedContext({
            type: 'block',
            id: block.id,
            title: block.title,
            content: getContextContent('block', block.id),
          });
          setDiscussionEntity({ type: 'block', id: block.id, title: block.title });
          setSelectedTask(null);
          setAIChatTask(null);
        } else if (entityType === 'section') {
          const section = entityData as SectionInfo;
          setSelectedContext({
            type: 'section',
            id: section.id,
            title: section.title,
            content: getContextContent('section', section.id),
          });
          setDiscussionEntity({ type: 'section', id: section.id, title: section.title });
          setSelectedTask(null);
          setAIChatTask(null);
        } else if (entityType === 'task') {
          const task = entityData as TaskInfo;
          setSelectedContext({
            type: 'task',
            id: task.id,
            title: task.title,
            content: getContextContent('task', task.id),
          });
          setDiscussionEntity({ type: 'task', id: task.id, title: task.title });
        }
      } else if (actionId === 'add-subtask' && entityType === 'task') {
        const task = entityData as TaskInfo;
        setSelectedTask({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          sectionId: task.sectionId,
        } as SelectedTask);
        setSelectedContext({
          type: 'task',
          id: task.id,
          title: task.title,
          content: getContextContent('task', task.id),
        });
      } else if (actionId === 'rename') {
        toast.info('Дважды кликните по названию для редактирования');
      } else if (actionId.startsWith('ai-')) {
        if (entityType === 'block') {
          const block = entityData as BlockInfo;
          setSelectedContext({
            type: 'block',
            id: block.id,
            title: block.title,
            content: getContextContent('block', block.id),
          });
          setSelectedTask(null);
          setAIChatTask(null);
        } else if (entityType === 'section') {
          const section = entityData as SectionInfo;
          setSelectedContext({
            type: 'section',
            id: section.id,
            title: section.title,
            content: getContextContent('section', section.id),
          });
          setSelectedTask(null);
          setAIChatTask(null);
        } else if (entityType === 'task') {
          const task = entityData as TaskInfo;
          setSelectedTask({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            sectionId: task.sectionId,
          } as SelectedTask);
          setSelectedContext({
            type: 'task',
            id: task.id,
            title: task.title,
            content: getContextContent('task', task.id),
          });
        }
        toast.info('Выберите AI действие в правой панели');
      }
    },
    [getContextContent, setSelectedContext, setSelectedTask, setAIChatTask, setDiscussionEntity]
  );

  return {
    // Selection handlers
    onSelectContext: handleSelectContext,
    onSelectTask: handleSelectTask,

    // Create handlers
    onCreateSection: createDialogs.openSection,
    onCreateTask: createDialogs.openTask,

    // Delete handlers
    onDeleteBlock: handleDeleteBlock,
    onDeleteSection: handleDeleteSection,
    onDeleteTask: handleDeleteTask,

    // Move/reorder handlers
    onMoveTask: (taskId: number, newSectionId: number, newSortOrder: number) =>
      mutations.moveTask.mutate({ id: taskId, sectionId: newSectionId, sortOrder: newSortOrder }),
    onMoveSection: (sectionId: number, newBlockId: number, newSortOrder: number) =>
      mutations.moveSection.mutate({ id: sectionId, blockId: newBlockId, sortOrder: newSortOrder }),
    onReorderTasks: (sectionId: number, taskIds: number[]) =>
      mutations.reorderTasks.mutate({ sectionId, taskIds }),
    onReorderSections: (blockId: number, sectionIds: number[]) =>
      mutations.reorderSections.mutate({ blockId, sectionIds }),
    onReorderBlocks: (blockIds: number[]) =>
      mutations.reorderBlocks.mutate({ projectId, blockIds }),

    // Update handlers
    onUpdateTaskTitle: (taskId: number, newTitle: string) =>
      mutations.updateTask.mutate({ id: taskId, title: newTitle }),
    onUpdateTaskDueDate: (taskId: number, dueDate: Date | null) =>
      mutations.updateTask.mutate({ id: taskId, dueDate: dueDate?.getTime() || null }),
    onUpdateTaskStatus: (taskId: number, status: string) =>
      mutations.updateTask.mutate({ id: taskId, status }),
    onUpdateTaskPriority: (taskId: number, priority: string) =>
      mutations.updateTask.mutate({ id: taskId, priority }),
    onUpdateSectionTitle: (sectionId: number, newTitle: string) =>
      mutations.updateSection.mutate({ id: sectionId, title: newTitle }),
    onUpdateBlockTitle: (blockId: number, newTitle: string) =>
      mutations.updateBlock.mutate({ id: blockId, titleRu: newTitle }),

    // Context menu handler
    onContextMenuAction: handleContextMenuAction,
  };
}
