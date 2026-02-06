import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FolderOpen,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  BarChart3,
  Merge,
  CheckSquare,
  ArrowDownCircle,
  MoreVertical,
  Split,
  CopyPlus,
  ArrowUpCircle,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { QuickActionsBar } from "./QuickActionsBar";
import { DiscussionPanel } from "./DiscussionPanel";
import { BreadcrumbNav } from "./BreadcrumbNav";
import { EntityAIChat } from "./EntityAIChat";
import { SwipeableTaskCard } from "./SwipeableTaskCard";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface TaskData {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  deadline?: string | Date | null;
  dueDate?: string | Date | null;
  notes?: string | null;
  summary?: string | null;
  sortOrder?: number | null;
}

interface SectionDetailPanelProps {
  section: {
    id: number;
    title: string;
    description?: string | null;
    blockId: number;
    tasks?: TaskData[];
  };
  blockTitle: string;
  blockId: number;
  projectId: number;
  projectName: string;
  onSelectTask: (task: TaskData, sectionId: number) => void;
  onCreateTask: (sectionId: number) => void;
  onNavigate: (item: { type: "project" | "block" | "section" | "task"; id: number; title: string }) => void;
  onMarkRead?: (entityType: string, entityId: number) => void;
  onDeleteTask?: (taskId: number) => void;
  onUpdateTaskStatus?: (taskId: number, status: string) => void;
  onDuplicateTask?: (taskId: number) => void;
  onSplitTask?: (task: TaskData, sectionId: number) => void;
  onConvertTaskToSection?: (task: TaskData, sectionId: number) => void;
  onMergeTasks?: (sectionId: number) => void;
  onConvertSectionToTask?: (sectionId: number) => void;
  /** Selection mode for bulk actions */
  selectionMode?: boolean;
  selectedTaskIds?: number[];
  onToggleSelectionMode?: () => void;
  onToggleTaskSelection?: (taskId: number) => void;
  onBulkActions?: () => void;
}

export function SectionDetailPanel({
  section,
  blockTitle,
  blockId,
  projectId,
  projectName,
  onSelectTask,
  onCreateTask,
  onNavigate,
  onMarkRead,
  onDeleteTask,
  onUpdateTaskStatus,
  onDuplicateTask,
  onSplitTask,
  onConvertTaskToSection,
  onMergeTasks,
  onConvertSectionToTask,
  selectionMode = false,
  selectedTaskIds = [],
  onToggleSelectionMode,
  onToggleTaskSelection,
  onBulkActions,
}: SectionDetailPanelProps) {
  const [showDiscussion, setShowDiscussion] = useState(false);

  const tasks = section.tasks || [];

  // Calculate section statistics
  const stats = useMemo(() => {
    let completedTasks = 0;
    let inProgressTasks = 0;
    let notStartedTasks = 0;
    let overdueTasks = 0;
    let criticalTasks = 0;
    let highTasks = 0;
    const now = new Date();

    tasks.forEach((task) => {
      if (task.status === "completed") completedTasks++;
      else if (task.status === "in_progress") inProgressTasks++;
      else notStartedTasks++;

      if (task.priority === "critical") criticalTasks++;
      if (task.priority === "high") highTasks++;

      if ((task.deadline || task.dueDate) && task.status !== "completed") {
        const deadline = new Date((task.deadline || task.dueDate) as string);
        if (deadline < now) overdueTasks++;
      }
    });

    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    return { totalTasks: tasks.length, completedTasks, inProgressTasks, notStartedTasks, overdueTasks, criticalTasks, highTasks, progress };
  }, [tasks]);

  // Build rich context string for AI chat
  const sectionContext = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Раздел: "${section.title}"`);
    if (section.description) parts.push(`Описание: ${section.description}`);
    parts.push(`Блок: "${blockTitle}"`);
    parts.push(`Прогресс: ${stats.progress}% (${stats.completedTasks} из ${stats.totalTasks} задач)`);
    parts.push(`В работе: ${stats.inProgressTasks}, Не начато: ${stats.notStartedTasks}, Просрочено: ${stats.overdueTasks}`);
    if (stats.criticalTasks > 0 || stats.highTasks > 0) {
      parts.push(`Критических задач: ${stats.criticalTasks}, Высокоприоритетных: ${stats.highTasks}`);
    }
    if (tasks.length > 0) {
      const taskList = tasks.slice(0, 15).map(t => {
        const statusLabel = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '⏳' : '○';
        return `${statusLabel} "${t.title}"`;
      }).join(', ');
      parts.push(`Задачи: ${taskList}${tasks.length > 15 ? ` и ещё ${tasks.length - 15}...` : ''}`);
    }
    return parts.join('\n');
  }, [section, blockTitle, stats, tasks]);

  const breadcrumbs = [
    { type: "project" as const, id: projectId, title: projectName },
    { type: "block" as const, id: blockId, title: blockTitle },
    { type: "section" as const, id: section.id, title: section.title },
  ];

  const getStatusIcon = (status: string | null) => {
    if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    if (status === "in_progress") return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    return <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />;
  };

  const getPriorityBadge = (priority: string | null | undefined) => {
    if (!priority) return null;
    const colors: Record<string, string> = {
      critical: "border-red-500/30 text-red-400 bg-red-500/10",
      high: "border-orange-500/30 text-orange-400 bg-orange-500/10",
      medium: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
      low: "border-slate-500/30 text-slate-400 bg-slate-500/10",
    };
    const labels: Record<string, string> = {
      critical: "Критический",
      high: "Высокий",
      medium: "Средний",
      low: "Низкий",
    };
    return (
      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", colors[priority])}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-5">
      {/* Breadcrumb */}
      <BreadcrumbNav items={breadcrumbs} onNavigate={onNavigate} />

      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="truncate">{section.title}</span>
        </h2>
        {section.description && (
          <p className="text-sm text-slate-400 mt-1 ml-7">{section.description}</p>
        )}
      </div>

      {/* Progress Card */}
      <Card className="bg-slate-800/60 border-slate-700">
        <CardContent className="py-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Прогресс</span>
            <span className="text-sm font-bold text-emerald-400">{stats.progress}%</span>
          </div>
          <Progress value={stats.progress} className="h-2 mb-3" />
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.totalTasks}</div>
              <div className="text-[10px] text-slate-500">Всего</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">{stats.completedTasks}</div>
              <div className="text-[10px] text-slate-500">Готово</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400">{stats.inProgressTasks}</div>
              <div className="text-[10px] text-slate-500">В работе</div>
            </div>
            <div className="text-center">
              <div className={cn("text-lg font-bold", stats.overdueTasks > 0 ? "text-red-400" : "text-slate-500")}>
                {stats.overdueTasks}
              </div>
              <div className="text-[10px] text-slate-500">Просрочено</div>
            </div>
          </div>
          {(stats.criticalTasks > 0 || stats.highTasks > 0) && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700/50">
              {stats.criticalTasks > 0 && (
                <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {stats.criticalTasks} критических
                </Badge>
              )}
              {stats.highTasks > 0 && (
                <Badge variant="outline" className="border-orange-500/30 text-orange-400 bg-orange-500/10 text-[10px]">
                  {stats.highTasks} высоких
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={showDiscussion ? "default" : "outline"}
          size="sm"
          className={cn(
            showDiscussion
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "border-slate-600 text-blue-400 hover:bg-blue-500/10"
          )}
          onClick={() => {
            setShowDiscussion(!showDiscussion);
            if (!showDiscussion && onMarkRead) {
              onMarkRead("section", section.id);
            }
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Обсудить
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300"
          onClick={() => onCreateTask(section.id)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить задачу
        </Button>
        {onMergeTasks && tasks.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300"
            onClick={() => onMergeTasks(section.id)}
          >
            <Merge className="w-4 h-4 mr-2 text-emerald-400" />
            Объединить
          </Button>
        )}
        {onToggleSelectionMode && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "border-slate-600",
              selectionMode ? "bg-amber-500/20 text-amber-400 border-amber-500" : "text-slate-300"
            )}
            onClick={onToggleSelectionMode}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            {selectionMode ? "Отменить выбор" : "Выбрать задачи"}
          </Button>
        )}
        {selectedTaskIds.length > 0 && onBulkActions && (
          <Button
            variant="default"
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            onClick={onBulkActions}
          >
            Действия ({selectedTaskIds.length})
          </Button>
        )}
        {onConvertSectionToTask && (
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300"
            onClick={() => onConvertSectionToTask(section.id)}
          >
            <ArrowDownCircle className="w-4 h-4 mr-2 text-purple-400" />
            В задачу
          </Button>
        )}
      </div>

      {/* AI Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-slate-400">Быстрые действия AI</span>
        </div>
        <QuickActionsBar
          entityType="section"
          entityId={section.id}
          projectId={projectId}
          blockId={blockId}
          onInsertResult={(content) => {
            navigator.clipboard.writeText(content);
            toast.success("Скопировано в буфер обмена");
          }}
          compact
        />
      </div>

      {/* Embedded AI Chat */}
      <EntityAIChat
        entityType="section"
        entityId={section.id}
        entityTitle={section.title}
        projectId={projectId}
        entityContext={sectionContext}
        onInsertResult={(content) => {
          navigator.clipboard.writeText(content);
          toast.success("Результат AI скопирован в буфер обмена");
        }}
      />

      {/* Discussion Panel */}
      {showDiscussion && (
        <DiscussionPanel
          entityType="section"
          entityId={section.id}
          entityTitle={section.title}
          projectId={projectId}
        />
      )}

      {/* Tasks List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Задачи ({tasks.length})
          </h3>
        </div>
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <SwipeableTaskCard
                key={task.id}
                taskId={task.id}
                taskStatus={task.status || 'not_started'}
                onComplete={(id) => {
                  if (onUpdateTaskStatus) {
                    onUpdateTaskStatus(id, 'completed');
                    toast.success('Задача завершена');
                  }
                }}
                onDelete={(id) => {
                  if (onDeleteTask) {
                    onDeleteTask(id);
                    toast.success('Задача удалена');
                  }
                }}
                onUncomplete={(id) => {
                  if (onUpdateTaskStatus) {
                    onUpdateTaskStatus(id, 'not_started');
                    toast.info('Задача возвращена');
                  }
                }}
                disabled={selectionMode}
              >
              <Card
                className={cn(
                  "bg-slate-800/50 border-slate-700 hover:border-slate-600 cursor-pointer transition-colors border-0 shadow-none",
                  selectedTaskIds.includes(task.id) && "border-amber-500/50 bg-amber-500/5"
                )}
                onClick={() => {
                  if (selectionMode && onToggleTaskSelection) {
                    onToggleTaskSelection(task.id);
                  } else {
                    onSelectTask(task, section.id);
                  }
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {selectionMode && (
                      <Checkbox
                        checked={selectedTaskIds.includes(task.id)}
                        onCheckedChange={() => onToggleTaskSelection?.(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-slate-500"
                      />
                    )}
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "text-sm block truncate",
                          task.status === "completed" ? "text-slate-500 line-through" : "text-slate-200"
                        )}
                      >
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {getPriorityBadge(task.priority)}
                        {(task.deadline || task.dueDate) && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date((task.deadline || task.dueDate) as string), "d MMM", { locale: ru })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Task Actions Dropdown */}
                    {!selectionMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          {onSplitTask && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onSplitTask(task, section.id);
                              }}
                              className="text-slate-300 focus:text-white focus:bg-slate-700"
                            >
                              <Split className="w-4 h-4 mr-2 text-amber-400" />
                              Разделить на подзадачи
                            </DropdownMenuItem>
                          )}
                          {onDuplicateTask && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateTask(task.id);
                              }}
                              className="text-slate-300 focus:text-white focus:bg-slate-700"
                            >
                              <CopyPlus className="w-4 h-4 mr-2 text-blue-400" />
                              Дублировать
                            </DropdownMenuItem>
                          )}
                          {onConvertTaskToSection && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onConvertTaskToSection(task, section.id);
                              }}
                              className="text-slate-300 focus:text-white focus:bg-slate-700"
                            >
                              <ArrowUpCircle className="w-4 h-4 mr-2 text-purple-400" />
                              Преобразовать в раздел
                            </DropdownMenuItem>
                          )}
                          {onDeleteTask && (
                            <>
                              <DropdownMenuSeparator className="bg-slate-700" />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Удалить задачу?")) {
                                    onDeleteTask(task.id);
                                  }
                                }}
                                className="text-red-400 focus:text-red-300 focus:bg-slate-700"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Удалить
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
              </SwipeableTaskCard>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Нет задач</p>
              <p className="text-xs mt-1">Добавьте первую задачу в этот раздел</p>
            </div>
          )}

          {/* Add Task Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 border-slate-600 text-slate-400 border-dashed"
            onClick={() => onCreateTask(section.id)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить задачу
          </Button>
        </div>
      </div>
    </div>
  );
}
