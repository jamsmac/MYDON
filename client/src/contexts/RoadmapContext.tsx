import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { roadmapData, Block, Task, Section } from '@/data/roadmapData';

interface RoadmapState {
  blocks: Block[];
  selectedBlockId: string | null;
  selectedSectionId: string | null;
  selectedTaskId: string | null;
  searchQuery: string;
}

interface RoadmapContextType {
  state: RoadmapState;
  selectBlock: (blockId: string | null) => void;
  selectSection: (sectionId: string | null) => void;
  selectTask: (taskId: string | null) => void;
  setSearchQuery: (query: string) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  updateTaskNotes: (taskId: string, notes: string) => void;
  updateTaskSummary: (taskId: string, summary: string) => void;
  getBlockProgress: (blockId: string) => { completed: number; total: number; percentage: number };
  getOverallProgress: () => { completed: number; total: number; percentage: number };
  getSelectedBlock: () => Block | null;
  getSelectedSection: () => Section | null;
  getSelectedTask: () => Task | null;
  exportBlockSummary: (blockId: string) => string;
  exportAllSummaries: () => string;
}

const STORAGE_KEY = 'techrent-roadmap-state';

const RoadmapContext = createContext<RoadmapContextType | null>(null);

export function RoadmapProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RoadmapState>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          blocks: mergeWithDefaults(parsed.blocks),
        };
      } catch {
        // Fall back to defaults
      }
    }
    return {
      blocks: roadmapData,
      selectedBlockId: null,
      selectedSectionId: null,
      selectedTaskId: null,
      searchQuery: '',
    };
  });

  // Merge saved state with default data (in case new tasks were added)
  function mergeWithDefaults(savedBlocks: Block[]): Block[] {
    return roadmapData.map(defaultBlock => {
      const savedBlock = savedBlocks.find(b => b.id === defaultBlock.id);
      if (!savedBlock) return defaultBlock;
      
      return {
        ...defaultBlock,
        sections: defaultBlock.sections.map(defaultSection => {
          const savedSection = savedBlock.sections.find(s => s.id === defaultSection.id);
          if (!savedSection) return defaultSection;
          
          return {
            ...defaultSection,
            tasks: defaultSection.tasks.map(defaultTask => {
              const savedTask = savedSection.tasks.find(t => t.id === defaultTask.id);
              if (!savedTask) return defaultTask;
              
              return {
                ...defaultTask,
                status: savedTask.status,
                notes: savedTask.notes,
                summary: savedTask.summary,
                subtasks: defaultTask.subtasks?.map(defaultSubtask => {
                  const savedSubtask = savedTask.subtasks?.find(st => st.id === defaultSubtask.id);
                  if (!savedSubtask) return defaultSubtask;
                  return {
                    ...defaultSubtask,
                    status: savedSubtask.status,
                    notes: savedSubtask.notes,
                    summary: savedSubtask.summary,
                  };
                }),
              };
            }),
          };
        }),
      };
    });
  }

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const selectBlock = useCallback((blockId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedBlockId: blockId,
      selectedSectionId: null,
      selectedTaskId: null,
    }));
  }, []);

  const selectSection = useCallback((sectionId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedSectionId: sectionId,
      selectedTaskId: null,
    }));
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedTaskId: taskId,
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({
      ...prev,
      searchQuery: query,
    }));
  }, []);

  const findAndUpdateTask = (
    blocks: Block[],
    taskId: string,
    updater: (task: Task) => Task
  ): Block[] => {
    return blocks.map(block => ({
      ...block,
      sections: block.sections.map(section => ({
        ...section,
        tasks: section.tasks.map(task => {
          if (task.id === taskId) {
            return updater(task);
          }
          if (task.subtasks) {
            return {
              ...task,
              subtasks: task.subtasks.map(subtask => 
                subtask.id === taskId ? updater(subtask) : subtask
              ),
            };
          }
          return task;
        }),
      })),
    }));
  };

  const updateTaskStatus = useCallback((taskId: string, status: Task['status']) => {
    setState(prev => ({
      ...prev,
      blocks: findAndUpdateTask(prev.blocks, taskId, task => ({ ...task, status })),
    }));
  }, []);

  const updateTaskNotes = useCallback((taskId: string, notes: string) => {
    setState(prev => ({
      ...prev,
      blocks: findAndUpdateTask(prev.blocks, taskId, task => ({ ...task, notes })),
    }));
  }, []);

  const updateTaskSummary = useCallback((taskId: string, summary: string) => {
    setState(prev => ({
      ...prev,
      blocks: findAndUpdateTask(prev.blocks, taskId, task => ({ ...task, summary })),
    }));
  }, []);

  const countTasks = (tasks: Task[]): { completed: number; total: number } => {
    let completed = 0;
    let total = 0;
    
    tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          total++;
          if (subtask.status === 'completed') completed++;
        });
      } else {
        total++;
        if (task.status === 'completed') completed++;
      }
    });
    
    return { completed, total };
  };

  const getBlockProgress = useCallback((blockId: string) => {
    const block = state.blocks.find(b => b.id === blockId);
    if (!block) return { completed: 0, total: 0, percentage: 0 };
    
    let completed = 0;
    let total = 0;
    
    block.sections.forEach(section => {
      const counts = countTasks(section.tasks);
      completed += counts.completed;
      total += counts.total;
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [state.blocks]);

  const getOverallProgress = useCallback(() => {
    let completed = 0;
    let total = 0;
    
    state.blocks.forEach(block => {
      block.sections.forEach(section => {
        const counts = countTasks(section.tasks);
        completed += counts.completed;
        total += counts.total;
      });
    });
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [state.blocks]);

  const getSelectedBlock = useCallback(() => {
    return state.blocks.find(b => b.id === state.selectedBlockId) || null;
  }, [state.blocks, state.selectedBlockId]);

  const getSelectedSection = useCallback(() => {
    const block = getSelectedBlock();
    if (!block) return null;
    return block.sections.find(s => s.id === state.selectedSectionId) || null;
  }, [getSelectedBlock, state.selectedSectionId]);

  const getSelectedTask = useCallback(() => {
    const block = getSelectedBlock();
    if (!block) return null;
    
    for (const section of block.sections) {
      for (const task of section.tasks) {
        if (task.id === state.selectedTaskId) return task;
        if (task.subtasks) {
          const subtask = task.subtasks.find(st => st.id === state.selectedTaskId);
          if (subtask) return subtask;
        }
      }
    }
    return null;
  }, [getSelectedBlock, state.selectedTaskId]);

  const exportBlockSummary = useCallback((blockId: string) => {
    const block = state.blocks.find(b => b.id === blockId);
    if (!block) return '';
    
    let output = `# ${block.titleRu}\n\n`;
    output += `**Длительность:** ${block.duration}\n\n`;
    
    const progress = getBlockProgress(blockId);
    output += `**Прогресс:** ${progress.completed}/${progress.total} (${progress.percentage}%)\n\n`;
    
    block.sections.forEach(section => {
      output += `## ${section.title}\n\n`;
      
      section.tasks.forEach(task => {
        const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⬜';
        output += `### ${statusEmoji} ${task.title}\n\n`;
        
        if (task.notes) {
          output += `**Заметки:**\n${task.notes}\n\n`;
        }
        
        if (task.summary) {
          output += `**Итог:**\n${task.summary}\n\n`;
        }
        
        if (task.subtasks && task.subtasks.length > 0) {
          output += `**Подзадачи:**\n`;
          task.subtasks.forEach(subtask => {
            const subStatusEmoji = subtask.status === 'completed' ? '✅' : subtask.status === 'in_progress' ? '🔄' : '⬜';
            output += `- ${subStatusEmoji} ${subtask.title}\n`;
            if (subtask.summary) {
              output += `  - Итог: ${subtask.summary}\n`;
            }
          });
          output += '\n';
        }
      });
    });
    
    return output;
  }, [state.blocks, getBlockProgress]);

  const exportAllSummaries = useCallback(() => {
    const overall = getOverallProgress();
    let output = `# TechRent Uzbekistan - Дорожная карта\n\n`;
    output += `**Общий прогресс:** ${overall.completed}/${overall.total} (${overall.percentage}%)\n\n`;
    output += `---\n\n`;
    
    state.blocks.forEach(block => {
      output += exportBlockSummary(block.id);
      output += `---\n\n`;
    });
    
    return output;
  }, [state.blocks, getOverallProgress, exportBlockSummary]);

  return (
    <RoadmapContext.Provider
      value={{
        state,
        selectBlock,
        selectSection,
        selectTask,
        setSearchQuery,
        updateTaskStatus,
        updateTaskNotes,
        updateTaskSummary,
        getBlockProgress,
        getOverallProgress,
        getSelectedBlock,
        getSelectedSection,
        getSelectedTask,
        exportBlockSummary,
        exportAllSummaries,
      }}
    >
      {children}
    </RoadmapContext.Provider>
  );
}

export function useRoadmap() {
  const context = useContext(RoadmapContext);
  if (!context) {
    throw new Error('useRoadmap must be used within a RoadmapProvider');
  }
  return context;
}
