/**
 * TaskTagBadges - Displays tags for a task in the task list view
 * Uses tRPC to fetch tags and displays them as compact badges
 */

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface Tag {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
  tagType: string | null;
}

interface TaskTagBadgesProps {
  taskId: string;
  maxVisible?: number;
}

// Helper to extract numeric ID from string task ID (e.g., "task-1-1-1" -> 111)
function getNumericTaskId(taskId: string): number {
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

export function TaskTagBadges({ taskId, maxVisible = 3 }: TaskTagBadgesProps) {
  const numericTaskId = getNumericTaskId(taskId);
  
  const { data: tags = [], isLoading } = trpc.relations.getTaskTags.useQuery(
    { taskId: numericTaskId },
    {
      // Reduce refetching for better performance in lists
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    }
  );

  if (isLoading) {
    return null; // Don't show loading spinner in list view to avoid visual noise
  }

  if (!tags || tags.length === 0) {
    return null;
  }

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((tag: Tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-xs px-1.5 py-0 h-5"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.icon && <span className="mr-0.5">{tag.icon}</span>}
          {tag.name}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
