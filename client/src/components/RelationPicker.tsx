/**
 * RelationPicker - Component for creating and managing entity relations
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
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Link2,
  Unlink,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type EntityType = 'project' | 'block' | 'section' | 'task' | 'subtask';
type RelationType = 
  | 'parent_child' | 'blocks' | 'blocked_by' | 'related_to' | 'duplicate_of'
  | 'depends_on' | 'required_by' | 'subtask_of' | 'linked' | 'cloned_from' | 'moved_from';

interface RelationPickerProps {
  entityType: EntityType;
  entityId: number;
  projectId?: number;
  className?: string;
}

interface Relation {
  id: number;
  sourceType: string;
  sourceId: number;
  targetType: string;
  targetId: number;
  relationType: string;
  isBidirectional: boolean | null;
  metadata?: {
    label?: string;
    color?: string;
    notes?: string;
  } | null;
}

interface RelatedEntity {
  relation: Relation;
  entity: {
    id: number;
    name?: string;
    title?: string;
    status?: string | null;
  } | null;
  direction?: 'outgoing' | 'incoming';
}

const RELATION_TYPES: { value: RelationType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'related_to', label: 'Связано с', icon: <ArrowLeftRight className="h-4 w-4" />, color: '#6366f1' },
  { value: 'blocks', label: 'Блокирует', icon: <AlertCircle className="h-4 w-4" />, color: '#ef4444' },
  { value: 'blocked_by', label: 'Заблокировано', icon: <AlertCircle className="h-4 w-4" />, color: '#f97316' },
  { value: 'depends_on', label: 'Зависит от', icon: <ArrowLeft className="h-4 w-4" />, color: '#f59e0b' },
  { value: 'required_by', label: 'Требуется для', icon: <ArrowRight className="h-4 w-4" />, color: '#22c55e' },
  { value: 'duplicate_of', label: 'Дубликат', icon: <Link2 className="h-4 w-4" />, color: '#8b5cf6' },
  { value: 'parent_child', label: 'Родитель-потомок', icon: <ArrowRight className="h-4 w-4" />, color: '#3b82f6' },
];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  project: 'Проект',
  block: 'Блок',
  section: 'Секция',
  task: 'Задача',
  subtask: 'Подзадача',
};

export function RelationPicker({ entityType, entityId, projectId, className }: RelationPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>('related_to');
  const [targetEntityType, setTargetEntityType] = useState<EntityType>('task');
  const [searchQuery, setSearchQuery] = useState('');

  const utils = trpc.useUtils();

  // Get current relations
  const { data: relatedEntities = [], isLoading: loadingRelations } = trpc.relations.getRelatedEntities.useQuery({
    entityType,
    entityId,
  });

  // Get available tasks for linking - use empty array as fallback
  const availableTasks: { id: number; title?: string; name?: string; status?: string }[] = [];

  // Mutations
  const linkMutation = trpc.relations.linkRecords.useMutation({
    onSuccess: () => {
      utils.relations.getRelatedEntities.invalidate({ entityType, entityId });
      setOpen(false);
      toast.success('Связь создана');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка создания связи');
    },
  });

  const unlinkMutation = trpc.relations.unlinkRecords.useMutation({
    onSuccess: () => {
      utils.relations.getRelatedEntities.invalidate({ entityType, entityId });
      toast.success('Связь удалена');
    },
    onError: (error) => {
      toast.error(error.message || 'Ошибка удаления связи');
    },
  });

  const handleLink = (targetId: number) => {
    linkMutation.mutate({
      sourceType: entityType,
      sourceId: entityId,
      targetType: targetEntityType,
      targetId,
      relationType: selectedRelationType,
    });
  };

  const handleUnlink = (relation: Relation) => {
    unlinkMutation.mutate({
      sourceType: relation.sourceType as EntityType,
      sourceId: relation.sourceId,
      targetType: relation.targetType as EntityType,
      targetId: relation.targetId,
      relationType: relation.relationType as RelationType,
    });
  };

  const getRelationTypeInfo = (type: string) => {
    return RELATION_TYPES.find((rt) => rt.value === type) || RELATION_TYPES[0];
  };

  const getEntityName = (entity: RelatedEntity['entity']) => {
    if (!entity) return 'Unknown';
    return entity.name || entity.title || `#${entity.id}`;
  };

  // Filter tasks that are not already linked
  const linkedIds = new Set(
    relatedEntities.map((re: RelatedEntity) => 
      re.direction === 'outgoing' ? re.relation.targetId : re.relation.sourceId
    )
  );
  const availableForLinking = availableTasks.filter(
    (t: { id: number }) => t.id !== entityId && !linkedIds.has(t.id)
  );

  if (loadingRelations) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Display current relations */}
      {relatedEntities.length > 0 && (
        <div className="space-y-1">
          {relatedEntities.map((re: RelatedEntity) => {
            const typeInfo = getRelationTypeInfo(re.relation.relationType);
            return (
              <div
                key={re.relation.id}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group"
              >
                <Badge
                  variant="outline"
                  className="gap-1"
                  style={{ borderColor: typeInfo.color, color: typeInfo.color }}
                >
                  {typeInfo.icon}
                  {typeInfo.label}
                </Badge>
                <span className="text-sm">
                  {ENTITY_TYPE_LABELS[re.relation.targetType as EntityType]}:
                </span>
                <span className="text-sm font-medium truncate flex-1">
                  {re.entity ? getEntityName(re.entity) : `#${re.relation.targetId}`}
                </span>
                {re.entity?.status && (
                  <Badge variant="secondary" className="text-xs">
                    {re.entity.status}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleUnlink(re.relation)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add relation button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Link2 className="h-4 w-4" />
            Добавить связь
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Тип связи</label>
              <Select
                value={selectedRelationType}
                onValueChange={(v) => setSelectedRelationType(v as RelationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: rt.color }}>{rt.icon}</span>
                        {rt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Тип сущности</label>
              <Select
                value={targetEntityType}
                onValueChange={(v) => setTargetEntityType(v as EntityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Выберите {ENTITY_TYPE_LABELS[targetEntityType].toLowerCase()}</label>
              <Command className="border rounded-md">
                <CommandInput
                  placeholder="Поиск..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-40">
                  <CommandEmpty>Не найдено</CommandEmpty>
                  <CommandGroup>
                    {availableForLinking
                      .filter((t: { title?: string; name?: string }) => {
                        const name = t.title || t.name || '';
                        return name.toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .slice(0, 10)
                      .map((t: { id: number; title?: string; name?: string; status?: string }) => (
                        <CommandItem
                          key={t.id}
                          onSelect={() => handleLink(t.id)}
                          className="flex items-center gap-2"
                        >
                          <span className="truncate flex-1">{t.title || t.name}</span>
                          {t.status && (
                            <Badge variant="secondary" className="text-xs">
                              {t.status}
                            </Badge>
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {linkMutation.isPending && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Compact relation badges for display in lists
 */
export function RelationBadges({ relations, maxVisible = 2 }: { relations: Relation[]; maxVisible?: number }) {
  if (!relations || relations.length === 0) return null;

  const visibleRelations = relations.slice(0, maxVisible);
  const hiddenCount = relations.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleRelations.map((rel) => {
        const typeInfo = RELATION_TYPES.find((rt) => rt.value === rel.relationType) || RELATION_TYPES[0];
        return (
          <Badge
            key={rel.id}
            variant="outline"
            className="text-xs px-1.5 py-0 gap-1"
            style={{ borderColor: typeInfo.color, color: typeInfo.color }}
          >
            {typeInfo.icon}
          </Badge>
        );
      })}
      {hiddenCount > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
