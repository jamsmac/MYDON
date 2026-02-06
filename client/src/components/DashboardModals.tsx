import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, FolderKanban, ChevronRight, Clock, CheckCircle2, 
  AlertCircle, Coins, Lightbulb, X, Archive
} from 'lucide-react';
import { useLocation } from 'wouter';

// Types
interface ProjectItem {
  id: number;
  name: string;
  description?: string | null;
  status?: string | null;
  color?: string | null;
  targetDate?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
}

// ============ Projects Modal ============
export function ProjectsFilterModal({
  open,
  onOpenChange,
  projects,
  filterType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectItem[];
  filterType: 'all' | 'active' | 'completed' | 'overdue';
}) {
  const [search, setSearch] = useState('');
  const [, navigate] = useLocation();

  const titleMap = {
    all: 'Все проекты',
    active: 'Активные проекты',
    completed: 'Завершённые проекты',
    overdue: 'Просроченные проекты',
  };

  const iconMap = {
    all: <FolderKanban className="w-5 h-5 text-blue-400" />,
    active: <Clock className="w-5 h-5 text-amber-400" />,
    completed: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    overdue: <AlertCircle className="w-5 h-5 text-red-400" />,
  };

  const colorMap = {
    all: 'border-blue-500/30',
    active: 'border-amber-500/30',
    completed: 'border-emerald-500/30',
    overdue: 'border-red-500/30',
  };

  const filtered = useMemo(() => {
    let list = projects || [];
    
    // Filter by type
    switch (filterType) {
      case 'active':
        list = list.filter(p => p.status === 'active');
        break;
      case 'completed':
        list = list.filter(p => p.status === 'completed');
        break;
      case 'overdue':
        list = list.filter(p => {
          if (!p.targetDate) return false;
          return new Date(p.targetDate) < new Date() && p.status !== 'completed';
        });
        break;
    }
    
    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    
    return list;
  }, [projects, filterType, search]);

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">Активен</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">Завершён</Badge>;
      case 'archived':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-xs">Архив</Badge>;
      default:
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-xs">Черновик</Badge>;
    }
  };

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case 'active': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'archived': return <Archive className="w-4 h-4 text-slate-400" />;
      default: return <FolderKanban className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-[calc(100vw-2rem)] sm:max-w-xl overflow-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {iconMap[filterType]}
            {titleMap[filterType]}
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 ml-2">
              {filtered.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Поиск проектов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Project List */}
        <ScrollArea className="max-h-[400px] w-full">
          <div className="space-y-2 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">
                  {search ? 'Проекты не найдены' : 'Нет проектов в этой категории'}
                </p>
              </div>
            ) : (
              filtered.map(project => (
                <div
                  key={project.id}
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/project/${project.id}`);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border ${colorMap[filterType]} hover:bg-slate-800 cursor-pointer transition-all group overflow-hidden`}
                >
                  {/* Icon */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${project.color || '#f59e0b'}15` }}
                  >
                    <FolderKanban 
                      className="w-5 h-5" 
                      style={{ color: project.color || '#f59e0b' }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 overflow-hidden w-0">
                    <div className="flex items-center gap-2 mb-1 max-w-full">
                      <h4 className="text-sm font-medium text-white truncate min-w-0">{project.name}</h4>
                      <span className="shrink-0">{getStatusBadge(project.status)}</span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-slate-400 truncate w-full block">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <Progress value={0} className="h-1.5 bg-slate-700 flex-1 max-w-[120px]" />
                      <span className="text-xs text-slate-500">
                        {project.updatedAt && new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============ Credits Modal ============
export function CreditsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Coins className="w-5 h-5 text-purple-400" />
            Баланс кредитов
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-purple-500/20 text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">—</div>
            <p className="text-slate-400 text-sm">Доступных кредитов</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Использовано</p>
              <p className="text-lg font-semibold text-white">—</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Лимит</p>
              <p className="text-lg font-semibold text-white">—</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Кредиты используются для AI-функций: генерация, анализ, рекомендации
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ AI Decisions Modal ============
export function AIDecisionsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lightbulb className="w-5 h-5 text-cyan-400" />
            AI Решения
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-slate-800/50 rounded-xl p-6 border border-cyan-500/20 text-center">
            <Lightbulb className="w-10 h-10 text-cyan-400/50 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              AI решения будут отображаться здесь по мере использования AI-ассистента в проектах
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 text-center">
              <p className="text-lg font-semibold text-cyan-400">0</p>
              <p className="text-xs text-slate-400">Принято</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 text-center">
              <p className="text-lg font-semibold text-amber-400">0</p>
              <p className="text-xs text-slate-400">В ожидании</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 text-center">
              <p className="text-lg font-semibold text-slate-400">0</p>
              <p className="text-xs text-slate-400">Отклонено</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
