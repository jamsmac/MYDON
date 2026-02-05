import { useRoadmap } from '@/contexts/RoadmapContext';
import { useDeadlines } from '@/contexts/DeadlineContext';
import { useFilters, FilterType } from '@/contexts/FilterContext';
import { Task, Block, Section } from '@/data/roadmapData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskPanel } from './TaskPanel';
import { DeadlinePicker } from './DeadlinePicker';
import { DeadlineBadge } from './DeadlineBadge';
import { FilterBar } from './FilterBar';
import { CalendarExport } from './CalendarExport';
import { useEffect, useMemo } from 'react';
import { 
  Check, Clock, Circle, Download, FileText, 
  ChevronRight, Sparkles, ArrowRight, AlertTriangle,
  Filter, ListFilter
} from 'lucide-react';
import { toast } from 'sonner';

// Hero background image URL
const HERO_BG = 'https://private-us-east-1.manuscdn.com/sessionFile/ZKrVqRBQ1iPHNDb1ahUvEJ/sandbox/hErLbGH1b6UYwYf6q6ljeJ-img-1_1770244254000_na1fn_dGVjaHJlbnQtaGVyby1iZw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvWktyVnFSQlExaVBITkRiMWFoVXZFSi9zYW5kYm94L2hFckxiR0gxYjZVWXdZZjZxNmxqZUotaW1nLTFfMTc3MDI0NDI1NDAwMF9uYTFmbl9kR1ZqYUhKbGJuUXRhR1Z5YnkxaVp3LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=kCuZa3-E9RDkWkDle1ShvLKGIiEQC5m8G5Ob30FGXAFJgbqrPSDLpi18cAQjAKDDV6E0lypV1cX1LYUqxt8TLqpcqNci~8furuoZNqJSQDuHo46rn2IRwgE1L3DRrWqDPuYfT0hmzfgTMHx7abBHwcW6WPeZ2cbBALqD85tRxy7q07IbkKbDFPvLMDl8josAZZQD7xZrg67XeQd~Z7lS1fxX-jHi00~dePrWB1bYTatoSEQrcTKIqmedurhwgGdHX-99hmhDKXIqZdF0bJB~sG~5vfmZfijfo2jLuSqPa0l1BS4DcUFTObiXjVTK4Ig9g8je3TnePdBZxN~bt8r8gw__';

const PROGRESS_IMG = 'https://private-us-east-1.manuscdn.com/sessionFile/ZKrVqRBQ1iPHNDb1ahUvEJ/sandbox/hErLbGH1b6UYwYf6q6ljeJ-img-3_1770244254000_na1fn_dGVjaHJlbnQtcHJvZ3Jlc3MtaWxsdXN0cmF0aW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvWktyVnFSQlExaVBITkRiMWFoVXZFSi9zYW5kYm94L2hFckxiR0gxYjZVWXdZZjZxNmxqZUotaW1nLTNfMTc3MDI0NDI1NDAwMF9uYTFmbl9kR1ZqYUhKbGJuUXRjSEp2WjNKbGMzTXRhV3hzZFhOMGNtRjBhVzl1LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=BB8kR5VMCcatnU8KlYEKxK3iqH~dEH0x9NsCy6YDy50ovTecVWVtYHQnh8twKOZo9if6V-JdV5W8WzAk64mk4JQuOr2lsy-bWkGfGWPhauLYD0gecp4uENQmedfFP0PF1JsJ6J1ntex6E0XVtkxRAY64idtCvnQkt7OqbHh9IdEQUvyE81r8GDrPN2H3i73Vj0imDAFCJFMDpOrDPtjxBYcH3FPWHtVFEaevQsWi32Ry0sae-rg8CLouZqBTzZjjKP4f-v~2ZxDMTiT9lKudbVFenEk9mvzNdIefd~SLkubedq8iRtxQsnh4bqV5fvm-8ZvWmEnBwgUiHkfdKZnACQ__';

export function MainContent() {
  const { 
    state, 
    getSelectedBlock, 
    getSelectedSection,
    getSelectedTask,
    selectTask,
    getBlockProgress,
    getOverallProgress,
    exportBlockSummary,
    exportAllSummaries
  } = useRoadmap();
  const { getDeadlineStatus, getDaysRemaining, getBlockDeadline } = useDeadlines();
  const { state: filterState, setFilterCounts } = useFilters();

  const selectedBlock = getSelectedBlock();
  const selectedSection = getSelectedSection();
  const selectedTask = getSelectedTask();

  // Calculate filter counts for all tasks
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: 0,
      not_started: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    };

    const countTasksRecursive = (tasks: Task[], blockId: string) => {
      const isBlockOverdue = getDeadlineStatus(blockId) === 'overdue';
      
      tasks.forEach(task => {
        counts.all++;
        
        if (task.status === 'not_started') counts.not_started++;
        else if (task.status === 'in_progress') counts.in_progress++;
        else if (task.status === 'completed') counts.completed++;
        
        // Count as overdue if block is overdue and task is not completed
        if (isBlockOverdue && task.status !== 'completed') {
          counts.overdue++;
        }

        if (task.subtasks) {
          task.subtasks.forEach(subtask => {
            counts.all++;
            
            if (subtask.status === 'not_started') counts.not_started++;
            else if (subtask.status === 'in_progress') counts.in_progress++;
            else if (subtask.status === 'completed') counts.completed++;
            
            if (isBlockOverdue && subtask.status !== 'completed') {
              counts.overdue++;
            }
          });
        }
      });
    };

    state.blocks.forEach(block => {
      block.sections.forEach(section => {
        countTasksRecursive(section.tasks, block.id);
      });
    });

    return counts;
  }, [state.blocks, getDeadlineStatus]);

  // Update filter counts in context
  useEffect(() => {
    setFilterCounts(filterCounts);
  }, [filterCounts, setFilterCounts]);

  // Filter tasks based on active filter
  const filterTasks = (tasks: Task[], blockId: string): Task[] => {
    if (filterState.activeFilter === 'all') return tasks;
    
    const isBlockOverdue = getDeadlineStatus(blockId) === 'overdue';
    
    return tasks.filter(task => {
      const matchesFilter = checkTaskMatchesFilter(task, isBlockOverdue);
      
      // Also check if any subtask matches
      if (task.subtasks && task.subtasks.length > 0) {
        const hasMatchingSubtask = task.subtasks.some(st => checkTaskMatchesFilter(st, isBlockOverdue));
        return matchesFilter || hasMatchingSubtask;
      }
      
      return matchesFilter;
    });
  };

  const checkTaskMatchesFilter = (task: Task, isBlockOverdue: boolean): boolean => {
    switch (filterState.activeFilter) {
      case 'not_started':
        return task.status === 'not_started';
      case 'in_progress':
        return task.status === 'in_progress';
      case 'completed':
        return task.status === 'completed';
      case 'overdue':
        return isBlockOverdue && task.status !== 'completed';
      default:
        return true;
    }
  };

  // Filter sections to only show those with matching tasks
  const filterSections = (sections: Section[], blockId: string): Section[] => {
    if (filterState.activeFilter === 'all') return sections;
    
    return sections.map(section => ({
      ...section,
      tasks: filterTasks(section.tasks, blockId)
    })).filter(section => section.tasks.length > 0);
  };

  const handleExportBlock = () => {
    if (!selectedBlock) return;
    const content = exportBlockSummary(selectedBlock.id);
    downloadMarkdown(content, `${selectedBlock.id}-summary.md`);
    toast.success('Документ экспортирован');
  };

  const handleExportAll = () => {
    const content = exportAllSummaries();
    downloadMarkdown(content, 'techrent-roadmap-full.md');
    toast.success('Полный отчет экспортирован');
  };

  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Welcome screen when no block is selected
  if (!selectedBlock) {
    return <WelcomeScreen onExportAll={handleExportAll} />;
  }

  const blockProgress = getBlockProgress(selectedBlock.id);
  const deadlineStatus = getDeadlineStatus(selectedBlock.id);
  const daysRemaining = getDaysRemaining(selectedBlock.id);
  const deadline = getBlockDeadline(selectedBlock.id);
  
  // Get filtered sections
  const filteredSections = filterSections(selectedBlock.sections, selectedBlock.id);
  const hasFilteredResults = filteredSections.some(s => s.tasks.length > 0);

  return (
    <div className="flex-1 flex h-screen overflow-hidden">
      {/* Main content area */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300",
        selectedTask ? "w-1/2" : "w-full"
      )}>
        {/* Block Header */}
        <header className={cn(
          "p-6 border-b border-border bg-card",
          deadlineStatus === 'overdue' && "bg-red-50 border-red-200",
          deadlineStatus === 'due_soon' && "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="font-mono">
                  Блок {String(selectedBlock.number).padStart(2, '0')}
                </Badge>
                <Badge variant="secondary">{selectedBlock.duration}</Badge>
                <DeadlineBadge blockId={selectedBlock.id} />
              </div>
              <h1 className="font-mono text-2xl font-bold text-foreground">
                {selectedBlock.titleRu}
              </h1>
              <p className="text-muted-foreground mt-1">{selectedBlock.title}</p>
              
              {/* Deadline warning */}
              {deadlineStatus === 'overdue' && (
                <div className="flex items-center gap-2 mt-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Блок просрочен на {Math.abs(daysRemaining!)} дней
                  </span>
                </div>
              )}
              {deadlineStatus === 'due_soon' && daysRemaining !== null && (
                <div className="flex items-center gap-2 mt-2 text-amber-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {daysRemaining === 0 ? 'Дедлайн сегодня!' : `До дедлайна ${daysRemaining} дней`}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Прогресс</p>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {blockProgress.percentage}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {blockProgress.completed}/{blockProgress.total} задач
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <DeadlinePicker blockId={selectedBlock.id} blockTitle={selectedBlock.titleRu} />
                <CalendarExport variant="single" block={selectedBlock} />
                <Button variant="outline" size="sm" onClick={handleExportBlock}>
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт
                </Button>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className={cn(
              "progress-gauge h-3",
              deadlineStatus === 'overdue' && "bg-red-200"
            )}>
              <div 
                className={cn(
                  "progress-gauge-fill",
                  deadlineStatus === 'overdue' && "!bg-red-500"
                )}
                style={{ width: `${blockProgress.percentage}%` }}
              />
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="p-4 border-b border-border bg-background">
          <FilterBar />
        </div>

        {/* Tasks List */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {!hasFilteredResults ? (
              <div className="text-center py-12">
                <ListFilter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Нет задач по выбранному фильтру
                </h3>
                <p className="text-muted-foreground">
                  Попробуйте выбрать другой фильтр или снять ограничения
                </p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <div key={section.id} className="space-y-3">
                  <h2 className={cn(
                    "font-mono font-semibold text-lg sticky top-0 bg-background py-2 z-10",
                    selectedSection?.id === section.id && "text-primary"
                  )}>
                    {section.title}
                  </h2>
                  
                  <div className="grid gap-3">
                    {section.tasks.map((task) => (
                      <TaskCard 
                        key={task.id}
                        task={task}
                        isSelected={selectedTask?.id === task.id}
                        onClick={() => selectTask(task.id)}
                        isBlockOverdue={deadlineStatus === 'overdue'}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Task Panel */}
      {selectedTask && (
        <div className="w-1/2 border-l border-border">
          <TaskPanel 
            task={selectedTask} 
            onClose={() => selectTask(null)} 
          />
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  isBlockOverdue?: boolean;
}

function TaskCard({ task, isSelected, onClick, isBlockOverdue = false }: TaskCardProps) {
  const { updateTaskStatus } = useRoadmap();
  
  const isTaskOverdue = isBlockOverdue && task.status !== 'completed';
  
  const getStatusConfig = (status: Task['status']) => {
    if (isTaskOverdue) {
      return { 
        label: 'Просрочено', 
        icon: AlertTriangle, 
        className: 'bg-red-100 text-red-700',
        ringClass: 'ring-red-500'
      };
    }
    
    switch (status) {
      case 'completed':
        return { 
          label: 'Готов', 
          icon: Check, 
          className: 'bg-emerald-100 text-emerald-700',
          ringClass: 'ring-emerald-500'
        };
      case 'in_progress':
        return { 
          label: 'В работе', 
          icon: Clock, 
          className: 'bg-amber-100 text-amber-700',
          ringClass: 'ring-amber-500'
        };
      default:
        return { 
          label: 'Не начато', 
          icon: Circle, 
          className: 'bg-slate-100 text-slate-600',
          ringClass: 'ring-slate-400'
        };
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const StatusIcon = statusConfig.icon;
  
  const completedSubtasks = task.subtasks?.filter(st => st.status === 'completed').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: Task['status'] = 
      task.status === 'not_started' ? 'in_progress' :
      task.status === 'in_progress' ? 'completed' : 'not_started';
    updateTaskStatus(task.id, nextStatus);
  };

  return (
    <Card 
      className={cn(
        "task-card cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary shadow-lg",
        isTaskOverdue && "border-red-300 bg-red-50/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status indicator */}
          <button
            onClick={handleStatusClick}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
              statusConfig.className,
              "hover:ring-2 hover:ring-offset-2",
              statusConfig.ringClass
            )}
          >
            <StatusIcon className={cn(
              "w-5 h-5",
              task.status === 'completed' && "animate-check-bounce"
            )} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn(
                "font-medium text-foreground",
                task.status === 'completed' && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h3>
              {isTaskOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Просрочено
                </Badge>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Subtasks progress */}
            {totalSubtasks > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className={cn(
                  "flex-1 h-1.5 rounded-full overflow-hidden",
                  isTaskOverdue ? "bg-red-200" : "bg-muted"
                )}>
                  <div 
                    className={cn(
                      "h-full transition-all duration-300",
                      isTaskOverdue 
                        ? "bg-red-500"
                        : "bg-gradient-to-r from-amber-500 to-emerald-500"
                    )}
                    style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </div>
            )}

            {/* Indicators */}
            <div className="flex items-center gap-2 mt-2">
              {task.notes && (
                <Badge variant="outline" className="text-xs gap-1">
                  <FileText className="w-3 h-3" />
                  Заметки
                </Badge>
              )}
              {task.summary && (
                <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <Sparkles className="w-3 h-3" />
                  Итог
                </Badge>
              )}
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function WelcomeScreen({ onExportAll }: { onExportAll: () => void }) {
  const { state, getOverallProgress, selectBlock, getBlockProgress } = useRoadmap();
  const { getDeadlineStatus, getDaysRemaining, getBlockDeadline } = useDeadlines();
  const { state: filterState, setFilter, getFilterLabel, setFilterCounts } = useFilters();
  const overall = getOverallProgress();

  // Count urgent deadlines
  const overdueBlocks = state.blocks.filter(b => getDeadlineStatus(b.id) === 'overdue');
  const dueSoonBlocks = state.blocks.filter(b => getDeadlineStatus(b.id) === 'due_soon');

  // Calculate filter counts for welcome screen
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: 0,
      not_started: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
    };

    state.blocks.forEach(block => {
      const isBlockOverdue = getDeadlineStatus(block.id) === 'overdue';
      
      block.sections.forEach(section => {
        section.tasks.forEach(task => {
          counts.all++;
          
          if (task.status === 'not_started') counts.not_started++;
          else if (task.status === 'in_progress') counts.in_progress++;
          else if (task.status === 'completed') counts.completed++;
          
          if (isBlockOverdue && task.status !== 'completed') {
            counts.overdue++;
          }

          if (task.subtasks) {
            task.subtasks.forEach(subtask => {
              counts.all++;
              
              if (subtask.status === 'not_started') counts.not_started++;
              else if (subtask.status === 'in_progress') counts.in_progress++;
              else if (subtask.status === 'completed') counts.completed++;
              
              if (isBlockOverdue && subtask.status !== 'completed') {
                counts.overdue++;
              }
            });
          }
        });
      });
    });

    return counts;
  }, [state.blocks, getDeadlineStatus]);

  // Update filter counts
  useEffect(() => {
    setFilterCounts(filterCounts);
  }, [filterCounts, setFilterCounts]);

  // Filter blocks based on active filter
  const filteredBlocks = useMemo(() => {
    if (filterState.activeFilter === 'all') return state.blocks;
    
    return state.blocks.filter(block => {
      const isBlockOverdue = getDeadlineStatus(block.id) === 'overdue';
      
      // Check if any task in the block matches the filter
      return block.sections.some(section => 
        section.tasks.some(task => {
          const taskMatches = checkTaskMatchesFilter(task.status, isBlockOverdue);
          const subtaskMatches = task.subtasks?.some(st => 
            checkTaskMatchesFilter(st.status, isBlockOverdue)
          );
          return taskMatches || subtaskMatches;
        })
      );
    });
  }, [state.blocks, filterState.activeFilter, getDeadlineStatus]);

  const checkTaskMatchesFilter = (status: Task['status'], isBlockOverdue: boolean): boolean => {
    switch (filterState.activeFilter) {
      case 'not_started':
        return status === 'not_started';
      case 'in_progress':
        return status === 'in_progress';
      case 'completed':
        return status === 'completed';
      case 'overdue':
        return isBlockOverdue && status !== 'completed';
      default:
        return true;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Hero Section */}
      <div 
        className="relative h-80 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 to-slate-900/90" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-mono text-4xl font-bold text-white mb-4">
            TechRent Uzbekistan
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl">
            Дорожная карта запуска компании по аренде спецтехники с интеграцией в экосистему MAYDON
          </p>
          
          {/* Overall Progress */}
          <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-6 min-w-[300px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300">Общий прогресс</span>
              <span className="font-mono text-2xl font-bold text-amber-400">
                {overall.percentage}%
              </span>
            </div>
            <div className="progress-gauge h-3 bg-white/20">
              <div 
                className="progress-gauge-fill"
                style={{ width: `${overall.percentage}%` }}
              />
            </div>
            <p className="text-sm text-slate-400 mt-2">
              {overall.completed} из {overall.total} задач выполнено
            </p>
          </div>
        </div>
      </div>

      {/* Deadline Alerts */}
      {(overdueBlocks.length > 0 || dueSoonBlocks.length > 0) && (
        <div className="p-4 bg-gradient-to-r from-red-50 to-amber-50 border-b border-amber-200">
          <div className="container flex flex-wrap gap-4">
            {overdueBlocks.length > 0 && (
              <button 
                onClick={() => setFilter('overdue')}
                className="flex items-center gap-3 px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
              >
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="text-left">
                  <p className="font-medium text-red-800">
                    {overdueBlocks.length} {overdueBlocks.length === 1 ? 'блок просрочен' : 'блоков просрочено'}
                  </p>
                  <p className="text-sm text-red-600">
                    Нажмите для фильтрации
                  </p>
                </div>
              </button>
            )}
            {dueSoonBlocks.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">
                    {dueSoonBlocks.length} {dueSoonBlocks.length === 1 ? 'блок скоро' : 'блоков скоро'}
                  </p>
                  <p className="text-sm text-amber-600">
                    {dueSoonBlocks.map(b => b.titleRu).join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-8">
        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar />
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-mono text-xl font-semibold">
            Блоки дорожной карты
            {filterState.activeFilter !== 'all' && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredBlocks.length} из {state.blocks.length})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <CalendarExport variant="all" />
            <Button variant="outline" onClick={onExportAll}>
              <Download className="w-4 h-4 mr-2" />
              Экспорт отчета
            </Button>
          </div>
        </div>

        {/* Blocks Grid */}
        {filteredBlocks.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Нет блоков по выбранному фильтру
            </h3>
            <p className="text-muted-foreground mb-4">
              Попробуйте выбрать другой фильтр
            </p>
            <Button variant="outline" onClick={() => setFilter('all')}>
              Показать все блоки
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBlocks.map((block) => {
              const progress = getBlockProgress(block.id);
              const deadlineStatus = getDeadlineStatus(block.id);
              const daysRemaining = getDaysRemaining(block.id);
              const deadline = getBlockDeadline(block.id);

              return (
                <Card 
                  key={block.id}
                  className={cn(
                    "task-card cursor-pointer group",
                    deadlineStatus === 'overdue' && "ring-2 ring-red-400 bg-red-50",
                    deadlineStatus === 'due_soon' && "ring-2 ring-amber-400 bg-amber-50"
                  )}
                  onClick={() => selectBlock(block.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono">
                        {String(block.number).padStart(2, '0')}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {deadline && (
                          <DeadlineBadge blockId={block.id} size="sm" />
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {block.duration}
                        </Badge>
                      </div>
                    </div>
                    <CardTitle className="font-mono text-lg mt-2 group-hover:text-primary transition-colors">
                      {block.titleRu}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {block.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex-1 h-2 bg-muted rounded-full overflow-hidden",
                        deadlineStatus === 'overdue' && "bg-red-200"
                      )}>
                        <div 
                          className={cn(
                            "h-full transition-all duration-300",
                            deadlineStatus === 'overdue' 
                              ? "bg-red-500"
                              : "bg-gradient-to-r from-amber-500 to-emerald-500"
                          )}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-muted-foreground">
                        {progress.percentage}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        {progress.completed}/{progress.total} задач
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Progress Illustration */}
        <div className="mt-12 rounded-xl overflow-hidden">
          <img 
            src={PROGRESS_IMG} 
            alt="TechRent Progress" 
            className="w-full h-64 object-cover"
          />
        </div>
      </div>
    </div>
  );
}
