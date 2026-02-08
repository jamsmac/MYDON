/**
 * MobileBlocksList - Mobile view of project blocks when no item is selected
 * Extracted from ProjectView.tsx
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ChevronRight } from 'lucide-react';

interface ProjectBlock {
  id: number;
  title: string;
  titleRu?: string | null;
  number?: number | null;
  sections?: Array<{
    id: number;
    tasks?: Array<{ id: number }>;
  }>;
}

interface MobileBlocksListProps {
  projectName: string;
  blocks: ProjectBlock[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  onSelectBlock: (block: ProjectBlock) => void;
}

export function MobileBlocksList({
  projectName,
  blocks,
  progress,
  onSelectBlock,
}: MobileBlocksListProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-white mb-4">{projectName}</h2>
        <p className="text-sm text-slate-400 mb-4">
          {progress.completed} из {progress.total} задач выполнено
        </p>
        <Progress value={progress.percentage} className="h-2 bg-slate-700 mb-6" />
        <div className="space-y-2">
          {blocks?.map((block) => (
            <button
              key={block.id}
              onClick={() => onSelectBlock(block)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-mono text-amber-400">
                  {String(block.number || 0).padStart(2, '0')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {block.titleRu || block.title}
                </p>
                <p className="text-xs text-slate-500">
                  {block.sections?.reduce((acc, s) => acc + (s.tasks?.length || 0), 0) || 0} задач
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
