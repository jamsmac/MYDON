/**
 * useTaskTagsCache - Hook to cache task tags for filtering
 * Provides a way to check if a task has specific tags without individual API calls
 */

import { trpc } from '@/lib/trpc';
import { useMemo } from 'react';

interface Tag {
  id: number;
  name: string;
  color: string;
}

// Helper to extract numeric ID from string task ID
export function getNumericTaskId(taskId: string): number {
  const numbers = taskId.replace(/\D/g, '');
  if (numbers) {
    return parseInt(numbers, 10);
  }
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Hook to get all task-tag associations for filtering
 * Returns a map of taskId -> tags[]
 */
export function useTaskTagsCache() {
  // Fetch all task tags in one query
  const { data: allTaskTags = [], isLoading } = trpc.relations.getAllTaskTags.useQuery(
    undefined,
    {
      staleTime: 60000, // 1 minute cache
      refetchOnWindowFocus: false,
    }
  );

  // Build a map of taskId -> tags for quick lookup
  const taskTagsMap = useMemo(() => {
    const map = new Map<number, Tag[]>();
    
    for (const item of allTaskTags) {
      if (!map.has(item.taskId)) {
        map.set(item.taskId, []);
      }
      map.get(item.taskId)!.push({
        id: item.tag.id,
        name: item.tag.name,
        color: item.tag.color,
      });
    }
    
    return map;
  }, [allTaskTags]);

  /**
   * Check if a task has any of the specified tags (OR mode)
   */
  const taskHasAnyTag = (taskId: string, tagIds: number[]): boolean => {
    if (tagIds.length === 0) return true;
    
    const numericId = getNumericTaskId(taskId);
    const taskTags = taskTagsMap.get(numericId) || [];
    
    return taskTags.some(tag => tagIds.includes(tag.id));
  };

  /**
   * Check if a task has all of the specified tags (AND mode)
   */
  const taskHasAllTags = (taskId: string, tagIds: number[]): boolean => {
    if (tagIds.length === 0) return true;
    
    const numericId = getNumericTaskId(taskId);
    const taskTags = taskTagsMap.get(numericId) || [];
    const taskTagIds = taskTags.map(t => t.id);
    
    return tagIds.every(tagId => taskTagIds.includes(tagId));
  };

  /**
   * Get tags for a specific task
   */
  const getTaskTags = (taskId: string): Tag[] => {
    const numericId = getNumericTaskId(taskId);
    return taskTagsMap.get(numericId) || [];
  };

  return {
    isLoading,
    taskHasAnyTag,
    taskHasAllTags,
    getTaskTags,
    taskTagsMap,
  };
}
