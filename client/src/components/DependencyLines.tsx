import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Task {
  id: number;
  title: string;
  status: string | null;
  dependencies?: number[] | null;
  deadline?: Date | string | null;
}

interface Block {
  id: number;
  title: string;
  titleRu?: string | null;
  deadline?: string | null;
  progress?: number;
  sections?: {
    id: number;
    tasks?: Task[];
  }[];
}

interface DependencyLine {
  fromBlockId: number;
  toBlockId: number;
  fromTaskId: number;
  toTaskId: number;
  fromTaskTitle: string;
  toTaskTitle: string;
  isCompleted: boolean;
  isBlocking: boolean;
}

interface DependencyLinesProps {
  blocks: Block[];
  blockPositions: {
    id: number;
    startDay: number;
    endDay: number;
    rowIndex: number;
  }[];
  cellWidth: number;
  rowHeight: number;
}

export function DependencyLines({ blocks, blockPositions, cellWidth, rowHeight }: DependencyLinesProps) {
  // Calculate all dependency lines between blocks
  const dependencyLines = useMemo(() => {
    const lines: DependencyLine[] = [];
    const taskToBlockMap = new Map<number, number>();
    const taskStatusMap = new Map<number, string | null>();
    const taskTitleMap = new Map<number, string>();

    // Build maps of task -> block and task -> status
    blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          taskToBlockMap.set(task.id, block.id);
          taskStatusMap.set(task.id, task.status);
          taskTitleMap.set(task.id, task.title);
        });
      });
    });

    // Find all dependencies
    blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
              const depBlockId = taskToBlockMap.get(depId);
              if (depBlockId && depBlockId !== block.id) {
                const depStatus = taskStatusMap.get(depId);
                const isCompleted = depStatus === 'completed';
                const isBlocking = !isCompleted && task.status !== 'completed';

                lines.push({
                  fromBlockId: depBlockId,
                  toBlockId: block.id,
                  fromTaskId: depId,
                  toTaskId: task.id,
                  fromTaskTitle: taskTitleMap.get(depId) || '',
                  toTaskTitle: task.title,
                  isCompleted,
                  isBlocking,
                });
              }
            });
          }
        });
      });
    });

    return lines;
  }, [blocks]);

  if (dependencyLines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 10 }}
    >
      <defs>
        {/* Arrow markers */}
        <marker
          id="arrow-completed"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#10b981" />
        </marker>
        <marker
          id="arrow-blocking"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
        </marker>
        <marker
          id="arrow-pending"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#6b7280" />
        </marker>
      </defs>

      {dependencyLines.map((line, index) => {
        const fromPos = blockPositions.find(p => p.id === line.fromBlockId);
        const toPos = blockPositions.find(p => p.id === line.toBlockId);

        if (!fromPos || !toPos) return null;

        // Calculate line coordinates
        const fromX = (fromPos.endDay * cellWidth) + 192; // 192 = block name column width
        const fromY = (fromPos.rowIndex * rowHeight) + (rowHeight / 2);
        const toX = (toPos.startDay * cellWidth) + 192;
        const toY = (toPos.rowIndex * rowHeight) + (rowHeight / 2);

        // Create curved path
        const midX = (fromX + toX) / 2;
        const controlOffset = Math.abs(toY - fromY) / 4;

        const pathD = `
          M ${fromX} ${fromY}
          C ${fromX + controlOffset} ${fromY},
            ${midX} ${fromY},
            ${midX} ${(fromY + toY) / 2}
          S ${toX - controlOffset} ${toY},
            ${toX} ${toY}
        `;

        const strokeColor = line.isCompleted 
          ? '#10b981' 
          : line.isBlocking 
            ? '#ef4444' 
            : '#6b7280';

        const markerId = line.isCompleted 
          ? 'arrow-completed' 
          : line.isBlocking 
            ? 'arrow-blocking' 
            : 'arrow-pending';

        return (
          <g key={index} className="pointer-events-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray={line.isCompleted ? 'none' : '4,4'}
                  markerEnd={`url(#${markerId})`}
                  className="cursor-pointer hover:stroke-[3] transition-all"
                  opacity={0.7}
                />
              </TooltipTrigger>
              <TooltipContent className="bg-slate-800 border-slate-700">
                <div className="text-xs">
                  <div className="font-medium text-white mb-1">
                    {line.isCompleted ? '✓ Выполнено' : line.isBlocking ? '⚠ Блокирует' : '○ Ожидает'}
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-300">{line.fromTaskTitle}</span>
                    <span className="mx-1">→</span>
                    <span className="text-slate-300">{line.toTaskTitle}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </g>
        );
      })}
    </svg>
  );
}

// Helper component to show dependency legend
export function DependencyLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-400">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-emerald-500" />
        <span>Выполнено</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{ borderBottom: '2px dashed' }} />
        <span>Блокирует</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-slate-500 border-dashed" style={{ borderBottom: '2px dashed' }} />
        <span>Ожидает</span>
      </div>
    </div>
  );
}
