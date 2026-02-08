/**
 * useProjectMutations - Hook for all project-related mutations
 * Extracted from ProjectView.tsx for cleaner code organization
 */

import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAchievementTrigger } from '@/hooks/useAchievementTrigger';

interface UseProjectMutationsOptions {
  projectId: number;
  onRefetch: () => void;
  onTaskCreated?: (data: unknown, sectionId: number) => void;
  onTaskUpdated?: (variables: unknown) => void;
  onTaskDeleted?: (taskId: number, sectionId: number) => void;
  onBlockCreated?: () => void;
  onSectionCreated?: () => void;
  onTaskCreatedSuccess?: () => void;
  onProjectDeleted?: () => void;
}

export function useProjectMutations({
  projectId,
  onRefetch,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onBlockCreated,
  onSectionCreated,
  onTaskCreatedSuccess,
  onProjectDeleted,
}: UseProjectMutationsOptions) {
  const { handleAchievementResult } = useAchievementTrigger();

  // Block mutations
  const createBlock = trpc.block.create.useMutation({
    onSuccess: () => {
      toast.success('Блок создан');
      onBlockCreated?.();
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const updateBlock = trpc.block.update.useMutation({
    onSuccess: () => {
      onRefetch();
      toast.success('Блок обновлён');
    },
    onError: (error) => toast.error('Ошибка обновления: ' + error.message),
  });

  const deleteBlock = trpc.block.delete.useMutation({
    onSuccess: () => {
      toast.success('Блок удалён');
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const reorderBlocks = trpc.block.reorder.useMutation({
    onSuccess: () => onRefetch(),
    onError: (error) => toast.error('Ошибка переупорядочивания блоков: ' + error.message),
  });

  // Section mutations
  const createSection = trpc.section.create.useMutation({
    onSuccess: () => {
      toast.success('Раздел создан');
      onSectionCreated?.();
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const updateSection = trpc.section.update.useMutation({
    onSuccess: () => {
      onRefetch();
      toast.success('Раздел обновлён');
    },
    onError: (error) => toast.error('Ошибка обновления: ' + error.message),
  });

  const deleteSection = trpc.section.delete.useMutation({
    onSuccess: () => {
      toast.success('Раздел удалён');
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const moveSection = trpc.section.move.useMutation({
    onSuccess: () => {
      toast.success('Раздел перемещён');
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const reorderSections = trpc.section.reorder.useMutation({
    onSuccess: () => onRefetch(),
    onError: (error) => toast.error('Ошибка переупорядочивания: ' + error.message),
  });

  // Task mutations
  const createTask = trpc.task.create.useMutation({
    onSuccess: (data, variables) => {
      toast.success('Задача создана');
      if (data) {
        onTaskCreated?.(data, variables.sectionId);
      }
      onTaskCreatedSuccess?.();
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (data, variables) => {
      onTaskUpdated?.(variables);
      onRefetch();
      handleAchievementResult(data);
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: (data, variables) => {
      toast.success('Задача удалена');
      onTaskDeleted?.(variables.id, 0); // sectionId needs to be passed separately if needed
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => {
      toast.success('Задача перемещена');
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const duplicateTask = trpc.task.duplicate.useMutation({
    onSuccess: () => {
      toast.success('Задача дублирована');
      onRefetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  const reorderTasks = trpc.task.reorder.useMutation({
    onSuccess: () => onRefetch(),
    onError: (error) => toast.error('Ошибка переупорядочивания: ' + error.message),
  });

  // Project mutations
  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success('Проект удалён');
      onProjectDeleted?.();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message),
  });

  // Google Drive mutations
  const saveToDrive = trpc.drive.saveProject.useMutation({
    onSuccess: (result) => {
      toast.success('Проект сохранён в Google Drive', {
        description: result.path,
        action: result.link
          ? {
              label: 'Открыть',
              onClick: () => window.open(result.link, '_blank'),
            }
          : undefined,
      });
    },
    onError: (error) => toast.error('Ошибка сохранения: ' + error.message),
  });

  const exportToGoogleDocs = trpc.drive.exportToGoogleDocs.useMutation({
    onSuccess: (result) => {
      toast.success('Проект экспортирован в Google Docs', {
        description: result.path,
        action: result.link
          ? {
              label: 'Открыть',
              onClick: () => window.open(result.link, '_blank'),
            }
          : undefined,
      });
    },
    onError: (error) => toast.error('Ошибка экспорта: ' + error.message),
  });

  // Helper functions
  const handleDeleteBlock = useCallback(
    (id: number) => {
      if (confirm('Удалить блок?')) {
        deleteBlock.mutate({ id });
      }
    },
    [deleteBlock]
  );

  const handleDeleteSection = useCallback(
    (id: number) => {
      if (confirm('Удалить раздел?')) {
        deleteSection.mutate({ id });
      }
    },
    [deleteSection]
  );

  const handleDeleteTask = useCallback(
    (id: number) => {
      if (confirm('Удалить задачу?')) {
        deleteTask.mutate({ id });
      }
    },
    [deleteTask]
  );

  const handleDeleteProject = useCallback(() => {
    if (confirm('Удалить проект?')) {
      deleteProject.mutate({ id: projectId });
    }
  }, [deleteProject, projectId]);

  return {
    // Block
    createBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    handleDeleteBlock,

    // Section
    createSection,
    updateSection,
    deleteSection,
    moveSection,
    reorderSections,
    handleDeleteSection,

    // Task
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    duplicateTask,
    reorderTasks,
    handleDeleteTask,

    // Project
    deleteProject,
    handleDeleteProject,

    // Drive
    saveToDrive,
    exportToGoogleDocs,

    // Helpers
    handleSaveToNotebookLM: async () => {
      toast.info('Сохранение в Google Drive...');
      try {
        await saveToDrive.mutateAsync({ projectId });
        window.open('https://notebooklm.google.com/', '_blank');
        toast.success('Проект сохранён! Добавьте файл из Google Drive в NotebookLM', {
          description: 'Папка: MYDON_Roadmaps',
          duration: 10000,
        });
      } catch {
        toast.error('Ошибка сохранения');
      }
    },
  };
}
