/**
 * TagSelector - Component for selecting and managing tags on tasks
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Plus, X, Tag, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TagSelectorProps {
  taskId: number;
  projectId?: number;
  className?: string;
  compact?: boolean;
}

interface Tag {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
  tagType: string | null;
}

export function TagSelector({ taskId, projectId, className, compact = false }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const utils = trpc.useUtils();

  // Get available tags
  const { data: availableTags = [], isLoading: loadingTags } = trpc.relations.getTags.useQuery({
    projectId,
  });

  // Get task's current tags
  const { data: taskTags = [], isLoading: loadingTaskTags } = trpc.relations.getTaskTags.useQuery({
    taskId,
  });

  // Mutations
  const addTagMutation = trpc.relations.addTagToTask.useMutation({
    onSuccess: () => {
      utils.relations.getTaskTags.invalidate({ taskId });
      toast.success('Тег добавлен');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка добавления тега');
    },
  });

  const removeTagMutation = trpc.relations.removeTagFromTask.useMutation({
    onSuccess: () => {
      utils.relations.getTaskTags.invalidate({ taskId });
      toast.success('Тег удалён');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка удаления тега');
    },
  });

  const createTagMutation = trpc.relations.createTag.useMutation({
    onSuccess: (data) => {
      utils.relations.getTags.invalidate({ projectId });
      // Auto-add new tag to task
      addTagMutation.mutate({ taskId, tagId: data.id as number });
      setNewTagName('');
      setShowCreateForm(false);
      toast.success('Тег создан');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка создания тега');
    },
  });

  const handleAddTag = (tagId: number) => {
    addTagMutation.mutate({ taskId, tagId });
  };

  const handleRemoveTag = (tagId: number) => {
    removeTagMutation.mutate({ taskId, tagId });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    createTagMutation.mutate({
      name: newTagName.trim(),
      color: newTagColor,
      projectId,
      tagType: 'label',
    });
  };

  const isTagSelected = (tagId: number) => {
    return taskTags.some((t: Tag) => t.id === tagId);
  };

  const colorOptions = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  ];

  if (loadingTags || loadingTaskTags) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {/* Display current tags */}
      {taskTags.map((tag: Tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="gap-1 pr-1"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
        >
          {tag.icon && <span>{tag.icon}</span>}
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="ml-1 rounded-full hover:bg-black/10 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 gap-1 text-muted-foreground hover:text-foreground',
              compact && 'px-1'
            )}
          >
            <Plus className="h-3 w-3" />
            {!compact && <span className="text-xs">Тег</span>}
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
                {availableTags.map((tag: Tag) => (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => {
                      if (isTagSelected(tag.id)) {
                        handleRemoveTag(tag.id);
                      } else {
                        handleAddTag(tag.id);
                      }
                    }}
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
              <CommandSeparator />
              <CommandGroup>
                {!showCreateForm ? (
                  <CommandItem
                    onSelect={() => setShowCreateForm(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Создать новый тег</span>
                  </CommandItem>
                ) : (
                  <div className="p-2 space-y-2">
                    <Input
                      placeholder="Название тега"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateTag();
                        }
                      }}
                    />
                    <div className="flex flex-wrap gap-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                            newTagColor === color ? 'border-foreground' : 'border-transparent'
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewTagColor(color)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim() || createTagMutation.isPending}
                      >
                        {createTagMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Создать'
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewTagName('');
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Compact tag display for lists
 */
export function TagBadges({ tags, maxVisible = 3 }: { tags: Tag[]; maxVisible?: number }) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-xs px-1.5 py-0"
          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
        >
          {tag.name}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
