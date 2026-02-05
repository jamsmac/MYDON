import { useFilters, FilterType } from '@/contexts/FilterContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ListFilter, 
  Circle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

const filterConfig: { type: FilterType; icon: React.ElementType; color: string }[] = [
  { type: 'all', icon: ListFilter, color: 'text-slate-500' },
  { type: 'not_started', icon: Circle, color: 'text-slate-400' },
  { type: 'in_progress', icon: Clock, color: 'text-amber-500' },
  { type: 'completed', icon: CheckCircle2, color: 'text-emerald-500' },
  { type: 'overdue', icon: AlertTriangle, color: 'text-red-500' },
];

export function FilterBar() {
  const { state, setFilter, getFilterLabel, getFilterCount } = useFilters();

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <Filter className="w-4 h-4 text-slate-500 mr-1" />
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Фильтр:</span>
      
      <div className="flex flex-wrap gap-1.5">
        {filterConfig.map(({ type, icon: Icon, color }) => {
          const isActive = state.activeFilter === type;
          const count = getFilterCount(type);
          
          return (
            <Button
              key={type}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type)}
              className={cn(
                'gap-1.5 h-8 text-xs font-medium transition-all',
                isActive 
                  ? type === 'overdue' 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : type === 'in_progress'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : type === 'completed'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : ''
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', !isActive && color)} />
              {getFilterLabel(type)}
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'ml-1 h-5 min-w-5 px-1.5 text-[10px] font-semibold',
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                  )}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
