import { useRoadmap } from '@/contexts/RoadmapContext';
import { useDeadlines } from '@/contexts/DeadlineContext';
import { Task } from '@/data/roadmapData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskPanel } from './TaskPanel';
import { DeadlinePicker } from './DeadlinePicker';
import { DeadlineBadge } from './DeadlineBadge';
import { 
  Check, Clock, Circle, Download, FileText, 
  ChevronRight, Sparkles, ArrowRight, AlertTriangle
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

  const selectedBlock = getSelectedBlock();
  const selectedSection = getSelectedSection();
  const selectedTask = getSelectedTask();

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

        {/* Tasks List */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {selectedBlock.sections.map((section) => (
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
                    />
                  ))}
                </div>
              </div>
            ))}
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
}

function TaskCard({ task, isSelected, onClick }: TaskCardProps) {
  const { updateTaskStatus } = useRoadmap();
  
  const getStatusConfig = (status: Task['status']) => {
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
        isSelected && "ring-2 ring-primary shadow-lg"
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
            <h3 className={cn(
              "font-medium text-foreground",
              task.status === 'completed' && "line-through text-muted-foreground"
            )}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Subtasks progress */}
            {totalSubtasks > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
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
  const overall = getOverallProgress();

  // Count urgent deadlines
  const overdueBlocks = state.blocks.filter(b => getDeadlineStatus(b.id) === 'overdue');
  const dueSoonBlocks = state.blocks.filter(b => getDeadlineStatus(b.id) === 'due_soon');

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
              <div className="flex items-center gap-3 px-4 py-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">
                    {overdueBlocks.length} {overdueBlocks.length === 1 ? 'блок просрочен' : 'блоков просрочено'}
                  </p>
                  <p className="text-sm text-red-600">
                    {overdueBlocks.map(b => b.titleRu).join(', ')}
                  </p>
                </div>
              </div>
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
        {/* Quick Actions */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-mono text-xl font-semibold">Блоки дорожной карты</h2>
          <Button variant="outline" onClick={onExportAll}>
            <Download className="w-4 h-4 mr-2" />
            Экспорт всего отчета
          </Button>
        </div>

        {/* Blocks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.blocks.map((block) => {
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
