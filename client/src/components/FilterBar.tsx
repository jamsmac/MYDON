import { useFilters, FilterType, TagFilter } from '@/contexts/FilterContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  ListFilter, 
  Circle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Filter,
  Tag,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface TagData {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
  tagType: string | null;
}

const filterConfig: { type: FilterType; icon: React.ElementType; color: string }[] = [
  { type: 'all', icon: ListFilter, color: 'text-slate-500' },
  { type: 'not_started', icon: Circle, color: 'text-slate-400' },
  { type: 'in_progress', icon: Clock, color: 'text-amber-500' },
  { type: 'completed', icon: CheckCircle2, color: 'text-emerald-500' },
  { type: 'overdue', icon: AlertTriangle, color: 'text-red-500' },
];

export function FilterBar() {
  const { 
    state, 
    setFilter, 
    getFilterLabel, 
    getFilterCount,
    addTagFilter,
    removeTagFilter,
    clearTagFilters,
    setTagFilterMode,
    isTagSelected,
  } = useFilters();
  
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Fetch available tags
  const { data: availableTags = [] } = trpc.relations.getTags.useQuery({});

  const handleTagSelect = (tag: TagData) => {
    if (isTagSelected(tag.id)) {
      removeTagFilter(tag.id);
    } else {
      addTagFilter({ id: tag.id, name: tag.name, color: tag.color });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status filters */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <Filter className="w-4 h-4 text-slate-500 mr-1" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Статус:</span>
        
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

      {/* Tag filters */}
      <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <Tag className="w-4 h-4 text-slate-500 mr-1" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Теги:</span>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Selected tags */}
          {state.selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pr-1 h-7"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => removeTagFilter(tag.id)}
                className="ml-1 rounded-full hover:bg-black/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Tag selector popover */}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
              >
                <Tag className="w-3 h-3" />
                {state.selectedTags.length === 0 ? 'Выбрать теги' : 'Добавить'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Поиск тегов..." />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Теги не найдены
                    </div>
                  </CommandEmpty>
                  <CommandGroup heading="Доступные теги">
                    {availableTags.map((tag: TagData) => (
                      <CommandItem
                        key={tag.id}
                        onSelect={() => handleTagSelect(tag)}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                        {isTagSelected(tag.id) && (
                          <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {state.selectedTags.length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            clearTagFilters();
                            setTagPopoverOpen(false);
                          }}
                          className="flex items-center gap-2 text-red-600"
                        >
                          <X className="h-4 w-4" />
                          <span>Очистить фильтр</span>
                        </CommandItem>
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Filter mode toggle */}
          {state.selectedTags.length > 1 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
              <span className="text-xs text-muted-foreground">Режим:</span>
              <Button
                variant={state.tagFilterMode === 'any' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setTagFilterMode('any')}
              >
                Любой
              </Button>
              <Button
                variant={state.tagFilterMode === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setTagFilterMode('all')}
              >
                Все
              </Button>
            </div>
          )}

          {/* Clear all button */}
          {state.selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={clearTagFilters}
            >
              <X className="w-3 h-3 mr-1" />
              Сбросить
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
