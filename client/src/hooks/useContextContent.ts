/**
 * useContextContent - Builds context content for AI chat
 * Extracted from ProjectView.tsx
 */

import { useCallback } from 'react';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
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
}

interface Project {
  id: number;
  name: string;
  description?: string | null;
  blocks?: ProjectBlock[];
}

export function useContextContent(project: Project | null | undefined) {
  const getContextContent = useCallback((type: string, id: number): string => {
    if (!project) return '';

    if (type === 'project') {
      const desc = project.description || 'Нет описания';
      const blocksCount = project.blocks?.length || 0;
      return `Проект: ${project.name}\nОписание: ${desc}\nБлоков: ${blocksCount}`;
    }

    if (type === 'block') {
      const block = project.blocks?.find((b) => b.id === id);
      if (!block) return '';
      const sections = block.sections?.map((s) => `- ${s.title} (${s.tasks?.length || 0} задач)`).join('\n') || 'Нет разделов';
      return `Блок: ${block.titleRu || block.title}\nРазделы:\n${sections}`;
    }

    if (type === 'section') {
      for (const block of project.blocks || []) {
        const section = block.sections?.find((s) => s.id === id);
        if (section) {
          const tasks = section.tasks?.map((t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}`).join('\n') || 'Нет задач';
          return `Раздел: ${section.title}\nБлок: ${block.titleRu || block.title}\nЗадачи:\n${tasks}`;
        }
      }
    }

    if (type === 'task') {
      for (const block of project.blocks || []) {
        for (const section of block.sections || []) {
          const task = section.tasks?.find((t) => t.id === id);
          if (task) {
            const desc = task.description || 'Нет описания';
            const notes = task.notes || 'Нет заметок';
            return `Задача: ${task.title}\nСтатус: ${task.status}\nОписание: ${desc}\nЗаметки: ${notes}\nРаздел: ${section.title}\nБлок: ${block.titleRu || block.title}`;
          }
        }
      }
    }

    return '';
  }, [project]);

  return getContextContent;
}
