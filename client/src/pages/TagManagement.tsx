/**
 * Tag Management Page
 * Allows users to view, edit, archive, and reorder project tags
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import { useProjectContext } from '@/contexts/ProjectContext';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Tag, 
  Plus, 
  GripVertical, 
  Pencil, 
  Archive, 
  ArchiveRestore,
  Trash2, 
  MoreVertical,
  ArrowLeft,
  Sparkles,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from 'wouter';

// Color palette for tags
const TAG_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Slate', value: '#64748b' },
];

const TAG_TYPES = [
  { value: 'label', label: 'Метка' },
  { value: 'category', label: 'Категория' },
  { value: 'status', label: 'Статус' },
  { value: 'sprint', label: 'Спринт' },
  { value: 'epic', label: 'Эпик' },
  { value: 'component', label: 'Компонент' },
  { value: 'custom', label: 'Пользовательский' },
];

interface TagData {
  id: number;
  projectId: number | null;
  userId: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  tagType: string | null;
  usageCount: number | null;
  isArchived: boolean | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EditTagData {
  id: number;
  name: string;
  color: string;
  description: string;
  tagType: string;
}

export default function TagManagement() {
  const params = useParams<{ id: string }>();
  const { currentProject } = useProjectContext();
  const [showArchived, setShowArchived] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<EditTagData | null>(null);
  const [newTag, setNewTag] = useState({ name: '', color: '#6366f1', description: '', tagType: 'label' });
  const [draggedTag, setDraggedTag] = useState<number | null>(null);

  // Get current project ID from route params or context
  const projectId = params.id ? parseInt(params.id, 10) : currentProject?.id;

  // Fetch tags
  const { data: tags = [], refetch: refetchTags } = trpc.relations.getAllProjectTags.useQuery(
    { projectId: projectId || 0, includeArchived: showArchived },
    { enabled: !!projectId }
  );

  // Mutations
  const createTagMutation = trpc.relations.createTag.useMutation({
    onSuccess: () => {
      toast.success('Тег создан');
      refetchTags();
      setCreateDialogOpen(false);
      setNewTag({ name: '', color: '#6366f1', description: '', tagType: 'label' });
    },
    onError: () => toast.error('Ошибка создания тега'),
  });

  const updateTagMutation = trpc.relations.updateTag.useMutation({
    onSuccess: () => {
      toast.success('Тег обновлен');
      refetchTags();
      setEditDialogOpen(false);
      setEditingTag(null);
    },
    onError: () => toast.error('Ошибка обновления тега'),
  });

  const archiveTagMutation = trpc.relations.archiveTag.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.isArchived ? 'Тег архивирован' : 'Тег восстановлен');
      refetchTags();
    },
    onError: () => toast.error('Ошибка архивации тега'),
  });

  const deleteTagMutation = trpc.relations.deleteTag.useMutation({
    onSuccess: () => {
      toast.success('Тег удален');
      refetchTags();
    },
    onError: () => toast.error('Ошибка удаления тега'),
  });

  const reorderTagsMutation = trpc.relations.reorderTags.useMutation({
    onError: () => toast.error('Ошибка сортировки тегов'),
  });

  const seedDefaultTagsMutation = trpc.relations.seedDefaultTags.useMutation({
    onSuccess: (data) => {
      if (data.created > 0) {
        toast.success(`Добавлено ${data.created} тегов по умолчанию`);
        refetchTags();
      } else {
        toast.info('Все теги по умолчанию уже существуют');
      }
    },
    onError: () => toast.error('Ошибка добавления тегов'),
  });

  // Handle drag and drop
  const handleDragStart = (tagId: number) => {
    setDraggedTag(tagId);
  };

  const handleDragOver = (e: React.DragEvent, targetTagId: number) => {
    e.preventDefault();
    if (draggedTag === null || draggedTag === targetTagId) return;

    const currentTags = [...tags];
    const draggedIndex = currentTags.findIndex(t => t.id === draggedTag);
    const targetIndex = currentTags.findIndex(t => t.id === targetTagId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder
    const [removed] = currentTags.splice(draggedIndex, 1);
    currentTags.splice(targetIndex, 0, removed);

    // Update sortOrder
    const tagOrders = currentTags.map((tag, index) => ({
      tagId: tag.id,
      sortOrder: index,
    }));

    reorderTagsMutation.mutate({ projectId: projectId || 0, tagOrders });
  };

  const handleDragEnd = () => {
    setDraggedTag(null);
    refetchTags();
  };

  const handleEditTag = (tag: TagData) => {
    setEditingTag({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
      tagType: tag.tagType || 'label',
    });
    setEditDialogOpen(true);
  };

  const handleSaveTag = () => {
    if (!editingTag) return;
    updateTagMutation.mutate({
      tagId: editingTag.id,
      name: editingTag.name,
      color: editingTag.color,
      description: editingTag.description || undefined,
    });
  };

  const handleCreateTag = () => {
    if (!projectId || !newTag.name.trim()) return;
    createTagMutation.mutate({
      projectId,
      name: newTag.name.trim(),
      color: newTag.color,
      description: newTag.description || undefined,
      tagType: newTag.tagType as any,
    });
  };

  const handleSeedDefaultTags = () => {
    if (!projectId) return;
    seedDefaultTagsMutation.mutate({ projectId, useRussian: true });
  };

  // Group tags by type
  const groupedTags = tags.reduce((acc, tag) => {
    const type = tag.tagType || 'label';
    if (!acc[type]) acc[type] = [];
    acc[type].push(tag);
    return acc;
  }, {} as Record<string, TagData[]>);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Выберите проект для управления тегами</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Tag className="w-6 h-6" />
                  Управление тегами
                </h1>
                <p className="text-sm text-muted-foreground">
                  Редактируйте, архивируйте и упорядочивайте теги проекта
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="text-sm">
                  {showArchived ? <Eye className="w-4 h-4 inline mr-1" /> : <EyeOff className="w-4 h-4 inline mr-1" />}
                  Архивные
                </Label>
              </div>
              <Button variant="outline" onClick={handleSeedDefaultTags}>
                <Sparkles className="w-4 h-4 mr-2" />
                Добавить стандартные
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Новый тег
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className="grid gap-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{tags.length}</div>
                <p className="text-sm text-muted-foreground">Всего тегов</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{tags.filter(t => !t.isArchived).length}</div>
                <p className="text-sm text-muted-foreground">Активных</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{tags.filter(t => t.isArchived).length}</div>
                <p className="text-sm text-muted-foreground">Архивных</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{Object.keys(groupedTags).length}</div>
                <p className="text-sm text-muted-foreground">Типов</p>
              </CardContent>
            </Card>
          </div>

          {/* Tags by type */}
          {TAG_TYPES.map(type => {
            const typeTags = groupedTags[type.value] || [];
            if (typeTags.length === 0) return null;

            return (
              <Card key={type.value}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {type.label}
                    <Badge variant="secondary" className="ml-2">{typeTags.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {typeTags.map(tag => (
                      <div
                        key={tag.id}
                        draggable
                        onDragStart={() => handleDragStart(tag.id)}
                        onDragOver={(e) => handleDragOver(e, tag.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-move',
                          tag.isArchived && 'opacity-50',
                          draggedTag === tag.id && 'opacity-30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <div>
                            <span className="font-medium">{tag.name}</span>
                            {tag.description && (
                              <p className="text-xs text-muted-foreground">{tag.description}</p>
                            )}
                          </div>
                          {tag.isArchived && (
                            <Badge variant="outline" className="text-xs">Архив</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {tag.usageCount} использований
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTag(tag)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => archiveTagMutation.mutate({ tagId: tag.id, isArchived: !tag.isArchived })}
                              >
                                {tag.isArchived ? (
                                  <>
                                    <ArchiveRestore className="w-4 h-4 mr-2" />
                                    Восстановить
                                  </>
                                ) : (
                                  <>
                                    <Archive className="w-4 h-4 mr-2" />
                                    Архивировать
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('Удалить тег? Это действие нельзя отменить.')) {
                                    deleteTagMutation.mutate({ tagId: tag.id });
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {tags.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Нет тегов</h3>
                <p className="text-muted-foreground mb-4">
                  Создайте теги для организации задач
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={handleSeedDefaultTags}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Добавить стандартные
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Создать тег
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать тег</DialogTitle>
            <DialogDescription>
              Измените название, цвет и описание тега
            </DialogDescription>
          </DialogHeader>
          {editingTag && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={editingTag.name}
                  onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                  placeholder="Название тега"
                />
              </div>
              <div className="space-y-2">
                <Label>Цвет</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setEditingTag({ ...editingTag, color: color.value })}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        editingTag.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editingTag.description}
                  onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                  placeholder="Описание тега (необязательно)"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: editingTag.color }}
                />
                <span className="font-medium">{editingTag.name || 'Предпросмотр'}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveTag} disabled={!editingTag?.name.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать тег</DialogTitle>
            <DialogDescription>
              Добавьте новый тег для организации задач
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Название тега"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select
                value={newTag.tagType}
                onValueChange={(value) => setNewTag({ ...newTag, tagType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAG_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setNewTag({ ...newTag, color: color.value })}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      newTag.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={newTag.description}
                onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                placeholder="Описание тега (необязательно)"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: newTag.color }}
              />
              <span className="font-medium">{newTag.name || 'Предпросмотр'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTag.name.trim()}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
