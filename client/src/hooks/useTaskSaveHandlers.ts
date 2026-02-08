/**
 * useTaskSaveHandlers - Handlers for saving task notes and documents
 * Extracted from ProjectView.tsx
 */

import { useCallback } from 'react';
import { toast } from 'sonner';

interface SelectedTask {
  id: number;
  notes?: string | null;
  summary?: string | null;
}

interface UseTaskSaveHandlersOptions {
  selectedTask: SelectedTask | null;
  setSelectedTask: (task: any) => void;
  updateTaskMutate: (data: { id: number; notes?: string; summary?: string }) => void;
}

export function useTaskSaveHandlers({
  selectedTask,
  setSelectedTask,
  updateTaskMutate,
}: UseTaskSaveHandlersOptions) {
  const handleSaveAsNote = useCallback((content: string) => {
    if (selectedTask) {
      const newNotes = selectedTask.notes ? `${selectedTask.notes}\n\n---\n\n${content}` : content;
      updateTaskMutate({ id: selectedTask.id, notes: newNotes });
      setSelectedTask({ ...selectedTask, notes: newNotes });
      toast.success('Сохранено как заметка');
    } else {
      toast.error('Выберите задачу для сохранения заметки');
    }
  }, [selectedTask, updateTaskMutate, setSelectedTask]);

  const handleSaveAsDocument = useCallback((content: string) => {
    if (selectedTask) {
      updateTaskMutate({ id: selectedTask.id, summary: content });
      setSelectedTask({ ...selectedTask, summary: content });
      toast.success('Сохранено как итоговый документ');
    } else {
      toast.error('Выберите задачу для сохранения документа');
    }
  }, [selectedTask, updateTaskMutate, setSelectedTask]);

  return {
    handleSaveAsNote,
    handleSaveAsDocument,
  };
}
