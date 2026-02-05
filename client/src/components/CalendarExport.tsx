import { useRoadmap } from '@/contexts/RoadmapContext';
import { useDeadlines } from '@/contexts/DeadlineContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Calendar, 
  Download, 
  ExternalLink,
  CalendarPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  exportDeadlinesToIcs, 
  exportSingleDeadlineToIcs,
  generateGoogleCalendarUrl 
} from '@/lib/icsExport';
import { Block } from '@/data/roadmapData';

interface CalendarExportProps {
  variant?: 'all' | 'single';
  block?: Block;
}

export function CalendarExport({ variant = 'all', block }: CalendarExportProps) {
  const { state, getBlockProgress } = useRoadmap();
  const { state: deadlineState, getBlockDeadline } = useDeadlines();

  const handleExportAll = () => {
    try {
      exportDeadlinesToIcs(state.blocks, deadlineState.deadlines, getBlockProgress);
      toast.success('Календарь экспортирован', {
        description: 'Файл .ics скачан. Импортируйте его в Google Calendar.',
      });
    } catch (error) {
      toast.error('Ошибка экспорта', {
        description: error instanceof Error ? error.message : 'Не удалось экспортировать календарь',
      });
    }
  };

  const handleExportSingle = () => {
    if (!block) return;
    
    const deadline = getBlockDeadline(block.id);
    if (!deadline) {
      toast.error('Дедлайн не установлен', {
        description: 'Сначала установите дедлайн для этого блока',
      });
      return;
    }

    const progress = getBlockProgress(block.id);
    exportSingleDeadlineToIcs(block, deadline, progress);
    toast.success('Дедлайн экспортирован', {
      description: 'Файл .ics скачан',
    });
  };

  const handleOpenGoogleCalendar = () => {
    if (!block) return;
    
    const deadline = getBlockDeadline(block.id);
    if (!deadline) {
      toast.error('Дедлайн не установлен', {
        description: 'Сначала установите дедлайн для этого блока',
      });
      return;
    }

    const progress = getBlockProgress(block.id);
    const url = generateGoogleCalendarUrl(block, deadline, progress);
    window.open(url, '_blank');
  };

  // Count blocks with deadlines
  const blocksWithDeadlines = state.blocks.filter(b => deadlineState.deadlines[b.id]);

  if (variant === 'single' && block) {
    const hasDeadline = !!getBlockDeadline(block.id);
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            disabled={!hasDeadline}
          >
            <Calendar className="w-4 h-4" />
            Календарь
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Экспорт в календарь</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportSingle}>
            <Download className="w-4 h-4 mr-2" />
            Скачать .ics файл
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenGoogleCalendar}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Открыть в Google Calendar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          disabled={blocksWithDeadlines.length === 0}
        >
          <CalendarPlus className="w-4 h-4" />
          Экспорт в календарь
          {blocksWithDeadlines.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
              {blocksWithDeadlines.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          Экспорт дедлайнов
          <p className="text-xs font-normal text-muted-foreground mt-1">
            {blocksWithDeadlines.length} из {state.blocks.length} блоков с дедлайнами
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportAll}>
          <Download className="w-4 h-4 mr-2" />
          Скачать все дедлайны (.ics)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Блоки с дедлайнами:
        </DropdownMenuLabel>
        {blocksWithDeadlines.map(block => {
          const deadline = deadlineState.deadlines[block.id];
          const date = new Date(deadline.deadline);
          return (
            <DropdownMenuItem 
              key={block.id}
              onClick={() => {
                const progress = getBlockProgress(block.id);
                exportSingleDeadlineToIcs(block, deadline, progress);
                toast.success(`Дедлайн "${block.titleRu}" экспортирован`);
              }}
              className="flex items-center justify-between"
            >
              <span className="truncate flex-1">{block.titleRu}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </span>
            </DropdownMenuItem>
          );
        })}
        {blocksWithDeadlines.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            Нет установленных дедлайнов
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
