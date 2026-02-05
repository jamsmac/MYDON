import { useRoadmap } from '@/contexts/RoadmapContext';
import { useDeadlines } from '@/contexts/DeadlineContext';
import { cn } from '@/lib/utils';
import { 
  Search, Target, Calculator, Presentation, Scale, Banknote, 
  Rocket, Megaphone, Calendar, TrendingUp, Network, Compass,
  ChevronRight, ChevronDown, Check, AlertTriangle, Clock
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeadlineIndicator } from '@/components/DeadlineBadge';

const iconMap: Record<string, React.ElementType> = {
  search: Search,
  target: Target,
  calculator: Calculator,
  presentation: Presentation,
  scale: Scale,
  banknote: Banknote,
  rocket: Rocket,
  megaphone: Megaphone,
  calendar: Calendar,
  'trending-up': TrendingUp,
  network: Network,
  compass: Compass,
};

export function Sidebar() {
  const { state, selectBlock, selectSection, getBlockProgress, getOverallProgress, setSearchQuery } = useRoadmap();
  const { getDeadlineStatus, getDaysRemaining } = useDeadlines();
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const overall = getOverallProgress();

  const toggleBlock = (blockId: string) => {
    const newExpanded = new Set(expandedBlocks);
    if (newExpanded.has(blockId)) {
      newExpanded.delete(blockId);
    } else {
      newExpanded.add(blockId);
    }
    setExpandedBlocks(newExpanded);
  };

  const handleBlockClick = (blockId: string) => {
    selectBlock(blockId);
    if (!expandedBlocks.has(blockId)) {
      toggleBlock(blockId);
    }
  };

  // Count blocks with deadlines
  const overdueCount = state.blocks.filter(b => getDeadlineStatus(b.id) === 'overdue').length;
  const dueSoonCount = state.blocks.filter(b => getDeadlineStatus(b.id) === 'due_soon').length;

  return (
    <aside className="w-80 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-sm">TechRent</h1>
            <p className="text-xs text-sidebar-foreground/60">Roadmap Manager</p>
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-sidebar-foreground/70">Общий прогресс</span>
            <span className="font-mono font-medium text-amber-400">{overall.percentage}%</span>
          </div>
          <div className="progress-gauge bg-sidebar-accent">
            <div 
              className="progress-gauge-fill"
              style={{ width: `${overall.percentage}%` }}
            />
          </div>
          <p className="text-xs text-sidebar-foreground/50 mt-1">
            {overall.completed} из {overall.total} задач
          </p>
        </div>

        {/* Deadline Alerts */}
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div className="flex gap-2 mb-4">
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-md text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span>{overdueCount} просрочено</span>
              </div>
            )}
            {dueSoonCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 rounded-md text-xs text-amber-400">
                <Clock className="w-3 h-3" />
                <span>{dueSoonCount} скоро</span>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
          <Input
            placeholder="Поиск задач..."
            value={state.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40 h-9"
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 custom-scrollbar">
        <nav className="p-2">
          {state.blocks.map((block) => {
            const Icon = iconMap[block.icon] || Target;
            const progress = getBlockProgress(block.id);
            const isExpanded = expandedBlocks.has(block.id);
            const isSelected = state.selectedBlockId === block.id;
            const deadlineStatus = getDeadlineStatus(block.id);
            const daysRemaining = getDaysRemaining(block.id);
            
            return (
              <div key={block.id} className="mb-1">
                <button
                  onClick={() => handleBlockClick(block.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                    isSelected 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "hover:bg-sidebar-accent/50",
                    deadlineStatus === 'overdue' && "ring-1 ring-red-500/50",
                    deadlineStatus === 'due_soon' && "ring-1 ring-amber-500/50"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBlock(block.id);
                    }}
                    className="p-0.5 hover:bg-sidebar-border rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  <div className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 relative",
                    progress.percentage === 100 
                      ? "bg-emerald-500/20 text-emerald-400"
                      : progress.percentage > 0
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-sidebar-border text-sidebar-foreground/60"
                  )}>
                    {progress.percentage === 100 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {/* Deadline indicator dot */}
                    {deadlineStatus !== 'no_deadline' && progress.percentage < 100 && (
                      <span className={cn(
                        "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar",
                        deadlineStatus === 'overdue' && "bg-red-500",
                        deadlineStatus === 'due_soon' && "bg-amber-500 animate-pulse",
                        deadlineStatus === 'on_track' && "bg-slate-400"
                      )} />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-sidebar-foreground/50">
                        {String(block.number).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {block.titleRu}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-sidebar-border rounded-full overflow-hidden">
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
                      <span className="text-xs text-sidebar-foreground/50 font-mono">
                        {progress.percentage}%
                      </span>
                    </div>
                    {/* Deadline info */}
                    {deadlineStatus !== 'no_deadline' && daysRemaining !== null && (
                      <div className={cn(
                        "text-xs mt-0.5",
                        deadlineStatus === 'overdue' && "text-red-400",
                        deadlineStatus === 'due_soon' && "text-amber-400",
                        deadlineStatus === 'on_track' && "text-sidebar-foreground/50"
                      )}>
                        {deadlineStatus === 'overdue' 
                          ? `Просрочено на ${Math.abs(daysRemaining)} дн.`
                          : daysRemaining === 0 
                            ? 'Дедлайн сегодня!'
                            : `${daysRemaining} дн. до дедлайна`
                        }
                      </div>
                    )}
                  </div>
                </button>

                {/* Sections */}
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-0.5 animate-slide-in">
                    {block.sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => {
                          selectBlock(block.id);
                          selectSection(section.id);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors",
                          state.selectedSectionId === section.id
                            ? "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                        )}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                        <span className="truncate">{section.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          TechRent Uzbekistan © 2026
        </p>
      </div>
    </aside>
  );
}
