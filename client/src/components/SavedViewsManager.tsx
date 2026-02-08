/**
 * Saved Views Manager Component
 * Allows users to save, load, edit, and delete view presets (filter/sort/group configurations)
 * Integrates into the project views header next to ViewSwitcher
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Bookmark,
  BookmarkPlus,
  Star,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  Layers,
  Table2,
  Kanban,
  Calendar,
  GanttChart,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
// SavedViewConfig type - matches the schema definition
export interface SavedViewConfig {
  viewType?: string;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  groupBy?: string;
  searchQuery?: string;
  kanbanFilters?: {
    priority?: string;
    assignee?: number;
    tag?: number;
  };
  customFieldFilters?: Array<{
    id: string;
    fieldId: number;
    operator: string;
    value: string;
  }>;
  calendarMode?: 'month' | 'week';
  ganttZoom?: string;
}

// View type icons mapping
const VIEW_TYPE_ICONS: Record<string, typeof Table2> = {
  table: Table2,
  kanban: Kanban,
  calendar: Calendar,
  gantt: GanttChart,
  all: Globe,
};

const VIEW_TYPE_LABELS: Record<string, string> = {
  table: 'Таблица',
  kanban: 'Канбан',
  calendar: 'Календарь',
  gantt: 'Гант',
  all: 'Все виды',
};

// Color options for saved views
const COLOR_OPTIONS = [
  { value: 'blue', label: 'Синий', class: 'bg-blue-500' },
  { value: 'green', label: 'Зелёный', class: 'bg-emerald-500' },
  { value: 'amber', label: 'Жёлтый', class: 'bg-amber-500' },
  { value: 'red', label: 'Красный', class: 'bg-red-500' },
  { value: 'purple', label: 'Фиолетовый', class: 'bg-purple-500' },
  { value: 'pink', label: 'Розовый', class: 'bg-pink-500' },
  { value: 'cyan', label: 'Голубой', class: 'bg-cyan-500' },
  { value: 'orange', label: 'Оранжевый', class: 'bg-orange-500' },
];

function getColorClass(color: string | null | undefined): string {
  return COLOR_OPTIONS.find(c => c.value === color)?.class || 'bg-slate-500';
}

interface SavedView {
  id: number;
  name: string;
  viewType: string;
  isDefault: boolean;
  config: SavedViewConfig;
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedViewState {
  // Table view state
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
  groupBy?: string;
  searchQuery?: string;
  // Kanban filters
  kanbanFilters?: {
    priority?: string;
    assignee?: number;
    tag?: number;
  };
  // Custom field filters
  customFieldFilters?: Array<{
    id: string;
    fieldId: number;
    operator: string;
    value: string;
  }>;
  // Calendar
  calendarMode?: 'month' | 'week';
  // Gantt
  ganttZoom?: string;
}

interface SavedViewsManagerProps {
  projectId: number;
  currentViewType: string;
  currentState: SavedViewState;
  onLoadView: (config: SavedViewConfig, viewType: string) => void;
}

export function SavedViewsManager({
  projectId,
  currentViewType,
  currentState,
  onLoadView,
}: SavedViewsManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  
  // Save dialog state
  const [saveName, setSaveName] = useState('');
  const [saveViewType, setSaveViewType] = useState<string>(currentViewType);
  const [saveColor, setSaveColor] = useState('blue');

  // Active view tracking
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Fetch saved views
  const { data: savedViews = [], isLoading } = trpc.savedViews.getByProject.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  // Mutations
  const createView = trpc.savedViews.create.useMutation({
    onSuccess: () => {
      toast.success('Вид сохранён');
      utils.savedViews.invalidate();
      setShowSaveDialog(false);
      setSaveName('');
    },
    onError: () => toast.error('Ошибка при сохранении вида'),
  });

  const updateView = trpc.savedViews.update.useMutation({
    onSuccess: () => {
      toast.success('Вид обновлён');
      utils.savedViews.invalidate();
      setEditingId(null);
    },
    onError: () => toast.error('Ошибка при обновлении'),
  });

  const deleteView = trpc.savedViews.delete.useMutation({
    onSuccess: () => {
      toast.success('Вид удалён');
      utils.savedViews.invalidate();
      setShowDeleteConfirm(null);
      if (activeViewId === showDeleteConfirm) {
        setActiveViewId(null);
      }
    },
    onError: () => toast.error('Ошибка при удалении'),
  });

  const setDefault = trpc.savedViews.setDefault.useMutation({
    onSuccess: () => {
      toast.success('Вид по умолчанию обновлён');
      utils.savedViews.invalidate();
    },
    onError: () => toast.error('Ошибка при обновлении'),
  });

  // Count active filters in current state
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentState.sortField) count++;
    if (currentState.groupBy && currentState.groupBy !== 'none') count++;
    if (currentState.searchQuery) count++;
    if (currentState.customFieldFilters && currentState.customFieldFilters.length > 0) {
      count += currentState.customFieldFilters.length;
    }
    if (currentState.kanbanFilters) {
      if (currentState.kanbanFilters.priority) count++;
      if (currentState.kanbanFilters.assignee) count++;
      if (currentState.kanbanFilters.tag) count++;
    }
    return count;
  }, [currentState]);

  // Handle save current view
  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;
    
    const config: SavedViewConfig = {
      viewType: saveViewType,
      ...currentState,
    };

    createView.mutate({
      projectId,
      name: saveName.trim(),
      viewType: saveViewType as any,
      config,
      color: saveColor,
    });
  }, [saveName, saveViewType, saveColor, currentState, projectId, createView]);

  // Handle load view
  const handleLoadView = useCallback((view: any) => {
    setActiveViewId(view.id);
    onLoadView(view.config as SavedViewConfig, view.viewType);
    setIsOpen(false);
    toast.success(`Вид "${view.name}" загружен`);
  }, [onLoadView]);

  // Handle update config of existing view
  const handleUpdateConfig = useCallback((viewId: number) => {
    const config: SavedViewConfig = {
      viewType: currentViewType,
      ...currentState,
    };
    updateView.mutate({ id: viewId, config });
    toast.success('Конфигурация вида обновлена');
  }, [currentState, currentViewType, updateView]);

  // Handle rename
  const handleStartEdit = useCallback((view: any) => {
    setEditingId(view.id);
    setEditName(view.name);
  }, []);

  const handleFinishEdit = useCallback(() => {
    if (editingId && editName.trim()) {
      updateView.mutate({ id: editingId, name: editName.trim() });
    }
    setEditingId(null);
  }, [editingId, editName, updateView]);

  // Handle toggle default
  const handleToggleDefault = useCallback((view: any) => {
    setDefault.mutate({
      id: view.isDefault ? 0 : view.id,
      projectId,
    });
  }, [projectId, setDefault]);

  // Open save dialog
  const handleOpenSaveDialog = useCallback(() => {
    setSaveName('');
    setSaveViewType(currentViewType);
    setSaveColor('blue');
    setShowSaveDialog(true);
    setIsOpen(false);
  }, [currentViewType]);

  // Describe what's in a config
  const describeConfig = (config: SavedViewConfig): string => {
    const parts: string[] = [];
    if (config.sortField) parts.push(`Сорт: ${config.sortField}`);
    if (config.groupBy && config.groupBy !== 'none') parts.push(`Группа: ${config.groupBy}`);
    if (config.searchQuery) parts.push(`Поиск: "${config.searchQuery}"`);
    if (config.customFieldFilters && config.customFieldFilters.length > 0) {
      parts.push(`${config.customFieldFilters.length} фильтр(ов)`);
    }
    if (config.kanbanFilters) {
      const kf = config.kanbanFilters;
      if (kf.priority) parts.push(`Приоритет: ${kf.priority}`);
    }
    if (config.calendarMode) parts.push(`Режим: ${config.calendarMode}`);
    if (config.ganttZoom) parts.push(`Масштаб: ${config.ganttZoom}`);
    return parts.length > 0 ? parts.join(' · ') : 'Без фильтров';
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 border-slate-700 hover:bg-slate-800",
              activeViewId && "border-purple-500/50 bg-purple-500/10",
              savedViews.length > 0 && "pr-2"
            )}
          >
            <Bookmark className={cn(
              "w-4 h-4",
              activeViewId ? "text-purple-400 fill-purple-400" : "text-slate-400"
            )} />
            <span className="text-sm text-slate-300">
              {activeViewId
                ? savedViews.find((v: SavedView) => v.id === activeViewId)?.name || 'Виды'
                : 'Виды'
              }
            </span>
            {savedViews.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-slate-700 text-slate-400">
                {savedViews.length}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 bg-slate-800 border-slate-700 p-0" 
          align="start"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Сохранённые виды</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
              onClick={handleOpenSaveDialog}
            >
              <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
              Сохранить
            </Button>
          </div>

          {/* Active filter info */}
          {activeFilterCount > 0 && (
            <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700/50">
              <p className="text-[11px] text-slate-500">
                Текущий вид: {activeFilterCount} настроек активно
              </p>
            </div>
          )}

          {/* Views list */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                Загрузка...
              </div>
            ) : savedViews.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-400">Нет сохранённых видов</p>
                <p className="text-xs text-slate-500 mt-1">
                  Настройте фильтры и сохраните вид
                </p>
              </div>
            ) : (
              savedViews.map((view: SavedView) => {
                const ViewIcon = VIEW_TYPE_ICONS[view.viewType] || Globe;
                const isActive = activeViewId === view.id;
                const isEditing = editingId === view.id;

                return (
                  <div
                    key={view.id}
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2.5 border-b border-slate-700/30 transition-colors",
                      isActive
                        ? "bg-purple-500/10"
                        : "hover:bg-slate-700/30 cursor-pointer"
                    )}
                    onClick={() => !isEditing && handleLoadView(view)}
                  >
                    {/* Color dot + icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={cn(
                        "w-6 h-6 rounded flex items-center justify-center",
                        getColorClass(view.color),
                        "bg-opacity-20"
                      )}>
                        <ViewIcon className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-6 text-xs bg-slate-900 border-slate-600 text-white px-1.5"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishEdit();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-emerald-400 hover:text-emerald-300"
                            onClick={(e) => { e.stopPropagation(); handleFinishEdit(); }}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-300"
                            onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-sm font-medium truncate",
                              isActive ? "text-purple-300" : "text-slate-200"
                            )}>
                              {view.name}
                            </span>
                            {view.isDefault && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                            )}
                            {isActive && (
                              <Badge className="h-4 px-1 text-[9px] bg-purple-500/20 text-purple-300 border-purple-500/30">
                                активен
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {VIEW_TYPE_LABELS[view.viewType] || 'Все'} · {describeConfig(view.config as SavedViewConfig)}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions (visible on hover) */}
                    {!isEditing && (
                      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          title={view.isDefault ? 'Убрать из по умолчанию' : 'Сделать по умолчанию'}
                          onClick={(e) => { e.stopPropagation(); handleToggleDefault(view); }}
                        >
                          <Star className={cn(
                            "w-3 h-3",
                            view.isDefault && "fill-amber-400"
                          )} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Обновить конфигурацию"
                          onClick={(e) => { e.stopPropagation(); handleUpdateConfig(view.id); }}
                        >
                          <Bookmark className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-slate-300 hover:bg-slate-600/50"
                          title="Переименовать"
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(view); }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          title="Удалить"
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(view.id); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Clear active view */}
          {activeViewId && (
            <div className="px-3 py-2 border-t border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-slate-400 hover:text-slate-300"
                onClick={() => { setActiveViewId(null); setIsOpen(false); }}
              >
                <X className="w-3 h-3 mr-1" />
                Сбросить активный вид
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Сохранить вид</DialogTitle>
            <DialogDescription className="text-slate-400">
              Сохраните текущие настройки фильтров, сортировки и группировки как именованный вид
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Название</label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Например: Мои задачи по приоритету"
                className="bg-slate-900 border-slate-700 text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveName.trim()) handleSave();
                }}
              />
            </div>

            {/* View type */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Применяется к</label>
              <Select value={saveViewType} onValueChange={setSaveViewType}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-300">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Все виды
                    </div>
                  </SelectItem>
                  <SelectItem value="table" className="text-slate-300">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4" />
                      Таблица
                    </div>
                  </SelectItem>
                  <SelectItem value="kanban" className="text-slate-300">
                    <div className="flex items-center gap-2">
                      <Kanban className="w-4 h-4" />
                      Канбан
                    </div>
                  </SelectItem>
                  <SelectItem value="calendar" className="text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Календарь
                    </div>
                  </SelectItem>
                  <SelectItem value="gantt" className="text-slate-300">
                    <div className="flex items-center gap-2">
                      <GanttChart className="w-4 h-4" />
                      Гант
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Цвет</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSaveColor(color.value)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all",
                      color.class,
                      saveColor === color.value
                        ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110"
                        : "opacity-60 hover:opacity-100"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Current config preview */}
            <div className="bg-slate-900/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-slate-400">Сохраняемые настройки:</p>
              {activeFilterCount === 0 ? (
                <p className="text-xs text-slate-500">Нет активных фильтров (будет сохранён вид по умолчанию)</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {currentState.sortField && (
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      Сорт: {currentState.sortField} {currentState.sortDirection}
                    </Badge>
                  )}
                  {currentState.groupBy && currentState.groupBy !== 'none' && (
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      Группа: {currentState.groupBy}
                    </Badge>
                  )}
                  {currentState.searchQuery && (
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      Поиск: "{currentState.searchQuery}"
                    </Badge>
                  )}
                  {currentState.customFieldFilters?.map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      Фильтр #{i + 1}
                    </Badge>
                  ))}
                  {currentState.kanbanFilters?.priority && (
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      Приоритет: {currentState.kanbanFilters.priority}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => setShowSaveDialog(false)}
            >
              Отмена
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSave}
              disabled={!saveName.trim() || createView.isPending}
            >
              {createView.isPending ? 'Сохранение...' : 'Сохранить вид'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm !== null} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Удалить сохранённый вид?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Это действие нельзя отменить. Вид будет удалён навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => showDeleteConfirm && deleteView.mutate({ id: showDeleteConfirm })}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SavedViewsManager;
