import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Block {
  id: number;
  title: string;
  titleRu?: string | null;
  deadline?: string | null;
  progress?: number;
  status?: string;
}

interface GanttChartProps {
  blocks: Block[];
  projectStartDate?: Date;
  onBlockClick?: (blockId: number) => void;
}

type ViewMode = 'week' | 'month' | 'quarter';

export function GanttChart({ blocks, projectStartDate, onBlockClick }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [viewOffset, setViewOffset] = useState(0);

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = projectStartDate || new Date(now.getFullYear(), now.getMonth(), 1);
    
    let daysToShow: number;
    switch (viewMode) {
      case 'week':
        daysToShow = 14;
        break;
      case 'month':
        daysToShow = 60;
        break;
      case 'quarter':
        daysToShow = 120;
        break;
    }

    const offsetDays = viewOffset * (daysToShow / 2);
    const rangeStart = new Date(start);
    rangeStart.setDate(rangeStart.getDate() + offsetDays);
    
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + daysToShow);

    return { start: rangeStart, end: rangeEnd, days: daysToShow };
  }, [viewMode, viewOffset, projectStartDate]);

  // Generate day columns
  const dayColumns = useMemo(() => {
    const columns: Date[] = [];
    const current = new Date(dateRange.start);
    
    while (current <= dateRange.end) {
      columns.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return columns;
  }, [dateRange]);

  // Calculate block positions
  const blockPositions = useMemo(() => {
    return blocks.map((block, index) => {
      // Default: spread blocks evenly across the timeline
      const totalDays = dateRange.days;
      const blockDuration = Math.max(7, Math.floor(totalDays / blocks.length));
      
      let startDay = index * Math.floor(totalDays / blocks.length);
      let endDay = startDay + blockDuration;

      // If block has a deadline, use it
      if (block.deadline) {
        const deadline = new Date(block.deadline);
        const diffTime = deadline.getTime() - dateRange.start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays <= totalDays) {
          endDay = diffDays;
          startDay = Math.max(0, endDay - blockDuration);
        }
      }

      const progress = block.progress || 0;
      const isOverdue = block.deadline && new Date(block.deadline) < new Date() && progress < 100;

      return {
        ...block,
        startDay,
        endDay,
        duration: endDay - startDay,
        progress,
        isOverdue,
      };
    });
  }, [blocks, dateRange]);

  // Format date for header
  const formatHeaderDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric',
      month: 'short'
    });
  };

  // Get month headers
  const monthHeaders = useMemo(() => {
    const months: { month: string; startIndex: number; span: number }[] = [];
    let currentMonth = '';
    let startIndex = 0;

    dayColumns.forEach((date, index) => {
      const monthStr = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      
      if (monthStr !== currentMonth) {
        if (currentMonth) {
          months.push({
            month: currentMonth,
            startIndex,
            span: index - startIndex,
          });
        }
        currentMonth = monthStr;
        startIndex = index;
      }
    });

    // Add last month
    if (currentMonth) {
      months.push({
        month: currentMonth,
        startIndex,
        span: dayColumns.length - startIndex,
      });
    }

    return months;
  }, [dayColumns]);

  const cellWidth = viewMode === 'week' ? 40 : viewMode === 'month' ? 24 : 16;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="border-b border-slate-700 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-white">Timeline</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => setViewMode(prev => 
                  prev === 'quarter' ? 'month' : prev === 'month' ? 'week' : 'week'
                )}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-400 w-16 text-center">
                {viewMode === 'week' ? '2 недели' : viewMode === 'month' ? '2 месяца' : 'Квартал'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => setViewMode(prev => 
                  prev === 'week' ? 'month' : prev === 'month' ? 'quarter' : 'quarter'
                )}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Navigation */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white"
              onClick={() => setViewOffset(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => setViewOffset(0)}
            >
              Сегодня
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white"
              onClick={() => setViewOffset(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-max">
          {/* Month headers */}
          <div className="flex border-b border-slate-700">
            <div className="w-48 flex-shrink-0 bg-slate-900/50 px-3 py-2">
              <span className="text-xs text-slate-500">Блок</span>
            </div>
            <div className="flex">
              {monthHeaders.map((header, index) => (
                <div
                  key={index}
                  className="border-l border-slate-700 px-2 py-2 bg-slate-900/30"
                  style={{ width: header.span * cellWidth }}
                >
                  <span className="text-xs text-slate-400 font-medium capitalize">
                    {header.month}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day headers */}
          <div className="flex border-b border-slate-700">
            <div className="w-48 flex-shrink-0 bg-slate-900/50 px-3 py-1">
              <span className="text-xs text-slate-600">Дата</span>
            </div>
            <div className="flex">
              {dayColumns.map((date, index) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex-shrink-0 text-center py-1 border-l border-slate-800",
                      isWeekend && "bg-slate-900/30",
                      isToday && "bg-amber-500/10"
                    )}
                    style={{ width: cellWidth }}
                  >
                    <span className={cn(
                      "text-[10px]",
                      isToday ? "text-amber-400 font-bold" : "text-slate-600"
                    )}>
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Block rows */}
          {blockPositions.map((block, index) => (
            <div
              key={block.id}
              className="flex border-b border-slate-800 hover:bg-slate-800/30 transition-colors cursor-pointer"
              onClick={() => onBlockClick?.(block.id)}
            >
              {/* Block name */}
              <div className="w-48 flex-shrink-0 px-3 py-2 flex items-center gap-2">
                <span className="text-amber-500 font-mono text-xs">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-slate-300 truncate">
                  {block.titleRu || block.title}
                </span>
              </div>

              {/* Timeline bar */}
              <div className="flex relative" style={{ height: 40 }}>
                {dayColumns.map((date, dayIndex) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "flex-shrink-0 border-l border-slate-800/50",
                        isWeekend && "bg-slate-900/20",
                        isToday && "bg-amber-500/5"
                      )}
                      style={{ width: cellWidth }}
                    />
                  );
                })}

                {/* Block bar */}
                {block.startDay >= 0 && block.startDay < dayColumns.length && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden"
                    style={{
                      left: block.startDay * cellWidth + 2,
                      width: Math.max(block.duration * cellWidth - 4, 20),
                    }}
                  >
                    {/* Background */}
                    <div className={cn(
                      "absolute inset-0 rounded-md",
                      block.isOverdue 
                        ? "bg-red-500/30 border border-red-500/50" 
                        : "bg-slate-700/50 border border-slate-600/50"
                    )} />
                    
                    {/* Progress fill */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-l-md",
                        block.isOverdue ? "bg-red-500/50" : "bg-emerald-500/50"
                      )}
                      style={{ width: `${block.progress}%` }}
                    />
                    
                    {/* Progress text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-white drop-shadow">
                        {block.progress}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Today marker */}
                {dayColumns.findIndex(d => d.toDateString() === new Date().toDateString()) >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500/50"
                    style={{
                      left: dayColumns.findIndex(d => d.toDateString() === new Date().toDateString()) * cellWidth + cellWidth / 2,
                    }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {blocks.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет блоков для отображения</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
