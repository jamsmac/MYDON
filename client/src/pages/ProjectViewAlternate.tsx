/**
 * Project View with Alternative Views (Kanban, Table, Calendar)
 * This component provides multiple ways to view and manage project tasks
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Plus, 
  Loader2,
  MoreVertical,
  Edit,
  FileDown,
  Download,
  Cloud,
  Calendar,
  FileText,
  List,
  Kanban,
  Table2,
  GanttChart,
  Settings,
  Users
} from 'lucide-react';
import { Link, useParams, useLocation } from 'wouter';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import view components
import { KanbanBoard } from '@/components/KanbanBoard';
import { TableView, type TableViewState } from '@/components/TableView';
import { CalendarView } from '@/components/CalendarView';
import { GanttChartAdvanced } from '@/components/GanttChartAdvanced';
import { ViewSwitcher, useProjectView, type ViewType } from '@/components/ViewSwitcher';
import { SavedViewsManager, type SavedViewState, type SavedViewConfig } from '@/components/SavedViewsManager';
import type { KanbanViewState } from '@/components/KanbanBoard';

// Task type for views
interface ViewTask {
  id: number;
  title: string;
  description?: string | null;
  status: string | null;
  priority?: string | null;
  deadline?: Date | string | null;
  assignedTo?: number | null;
  sectionId: number;
  sectionTitle?: string;
  blockTitle?: string;
  sortOrder?: number | null;
  tags?: { id: number; name: string; color: string }[];
}

export default function ProjectViewAlternate() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || '0');
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  
  // View state
  const [currentView, setCurrentView] = useProjectView(projectId, 'list');
  const [selectedTask, setSelectedTask] = useState<ViewTask | null>(null);

  // Saved views state tracking
  const [tableViewState, setTableViewState] = useState<TableViewState>({
    sortField: null,
    sortDirection: 'asc',
    groupBy: 'none',
    searchQuery: '',
    customFieldFilters: [],
  });
  const [kanbanViewState, setKanbanViewState] = useState<KanbanViewState>({
    kanbanFilters: {},
    customFieldFilters: [],
  });
  const [initialTableState, setInitialTableState] = useState<TableViewState | undefined>();
  const [initialKanbanState, setInitialKanbanState] = useState<KanbanViewState | undefined>();
  const [viewKey, setViewKey] = useState(0); // Force re-mount views when loading saved view

  // Current combined state for SavedViewsManager
  const currentSavedViewState = useMemo<SavedViewState>(() => {
    if (currentView === 'table') {
      return {
        sortField: tableViewState.sortField,
        sortDirection: tableViewState.sortDirection,
        groupBy: tableViewState.groupBy,
        searchQuery: tableViewState.searchQuery,
        customFieldFilters: tableViewState.customFieldFilters,
      };
    }
    if (currentView === 'kanban') {
      return {
        kanbanFilters: kanbanViewState.kanbanFilters,
        customFieldFilters: kanbanViewState.customFieldFilters,
      };
    }
    return {};
  }, [currentView, tableViewState, kanbanViewState]);

  // Handle loading a saved view
  const handleLoadSavedView = useCallback((config: SavedViewConfig, viewType: string) => {
    // Switch view type if needed
    if (viewType !== 'all' && viewType !== currentView) {
      setCurrentView(viewType as ViewType);
    }

    // Apply config to the appropriate view
    if (viewType === 'table' || viewType === 'all') {
      setInitialTableState({
        sortField: config.sortField || null,
        sortDirection: config.sortDirection || 'asc',
        groupBy: config.groupBy || 'none',
        searchQuery: config.searchQuery || '',
        customFieldFilters: (config.customFieldFilters || []) as any,
      });
    }
    if (viewType === 'kanban' || viewType === 'all') {
      setInitialKanbanState({
        kanbanFilters: config.kanbanFilters || {},
        customFieldFilters: (config.customFieldFilters || []) as any,
      });
    }
    // Force re-mount to apply initial state
    setViewKey(k => k + 1);
  }, [currentView, setCurrentView]);

  // Fetch project data
  const { data: project, isLoading, refetch } = trpc.project.getFull.useQuery(
    { id: projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  // Fetch team members
  const { data: teamMembers } = trpc.team.getMembers.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 }
  );

  // Tags from project data
  const projectTags = useMemo(() => {
    if (!project?.blocks) return [];
    const tagMap = new Map<number, { id: number; name: string; color: string }>();
    project.blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          // Tags would be fetched separately if available
        });
      });
    });
    return Array.from(tagMap.values());
  }, [project]);

  // Mutations
  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success('Задача удалена');
      refetch();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  // Gantt chart data
  const { data: ganttData, refetch: refetchGantt } = trpc.task.getGanttData.useQuery(
    { projectId },
    { enabled: isAuthenticated && projectId > 0 && currentView === 'gantt' }
  );

  // Add dependency mutation
  const addDependency = trpc.task.addDependency.useMutation({
    onSuccess: () => {
      toast.success('Зависимость добавлена');
      refetchGantt();
    },
    onError: (error) => toast.error('Ошибка: ' + error.message)
  });

  // Flatten all tasks from project structure
  const allTasks: ViewTask[] = useMemo(() => {
    if (!project?.blocks) return [];
    
    const tasks: ViewTask[] = [];
    project.blocks.forEach(block => {
      block.sections?.forEach(section => {
        section.tasks?.forEach(task => {
          tasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            deadline: task.deadline,
            assignedTo: task.assignedTo,
            sectionId: section.id,
            sectionTitle: section.title,
            blockTitle: block.titleRu || block.title,
            sortOrder: task.sortOrder,
            // tags: task.tags, // Tags not available in current schema
          });
        });
      });
    });
    return tasks;
  }, [project]);

  // Calculate progress
  const progress = useMemo(() => {
    if (allTasks.length === 0) return 0;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / allTasks.length) * 100);
  }, [allTasks]);

  // Members for views
  const members = useMemo(() => {
    if (!teamMembers?.members) return [];
    return teamMembers.members.map(m => ({
      id: m.userId,
      name: m.user?.name || 'Unknown',
      avatar: m.user?.avatar || undefined,
    }));
  }, [teamMembers]);

  // Handle task update from views
  const handleTaskUpdate = (taskId: number, data: { status?: string; sortOrder?: number; deadline?: number | null }) => {
    const updateData: any = { id: taskId };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    updateTask.mutate(updateData);
  };

  // Handle task click
  const handleTaskClick = (task: { id: number }) => {
    // Navigate to the main project view with the task selected
    navigate(`/project/${projectId}?task=${task.id}`);
  };

  // Loading states
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Проект не найден</p>
          <Link href="/">
            <Button variant="outline">Вернуться на главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Back + Project Info */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold text-white">{project.name}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{allTasks.length} задач</span>
                  <span>•</span>
                  <span>{progress}% выполнено</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: View Switcher + Saved Views */}
          <div className="flex items-center gap-2">
            <ViewSwitcher
              projectId={projectId}
              currentView={currentView}
              onViewChange={setCurrentView}
            />
            <SavedViewsManager
              projectId={projectId}
              currentViewType={currentView}
              currentState={currentSavedViewState}
              onLoadView={handleLoadSavedView}
            />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700"
              onClick={() => navigate(`/project/${projectId}/team`)}
            >
              <Users className="w-4 h-4 mr-2" />
              Команда
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                <DropdownMenuItem 
                  className="text-slate-300"
                  onClick={() => navigate(`/project/${projectId}`)}
                >
                  <List className="w-4 h-4 mr-2" />
                  Классический вид
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem 
                  className="text-slate-300"
                  onClick={() => {
                    window.open(`/api/export/markdown/${projectId}`, '_blank');
                    toast.success('Экспорт в Markdown начат');
                  }}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Экспорт в Markdown
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-slate-300"
                  onClick={() => {
                    window.open(`/api/export/json/${projectId}`, '_blank');
                    toast.success('Экспорт в JSON начат');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Экспорт в JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="px-4 pb-2">
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      {/* Main Content - View Area */}
      <main className="flex-1 overflow-hidden">
        {currentView === 'list' && (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Классический вид</p>
              <p className="text-sm mt-1">Используйте кнопку "Классический вид" в меню</p>
              <Button
                variant="outline"
                className="mt-4 border-slate-700"
                onClick={() => navigate(`/project/${projectId}`)}
              >
                Перейти к классическому виду
              </Button>
            </div>
          </div>
        )}

        {currentView === 'kanban' && (
          <KanbanBoard
            key={`kanban-${viewKey}`}
            projectId={projectId}
            tasks={allTasks}
            members={members}
            tags={projectTags}
            onTaskUpdate={(taskId, data) => handleTaskUpdate(taskId, data as any)}
            onTaskClick={handleTaskClick}
            onViewStateChange={setKanbanViewState}
            initialViewState={initialKanbanState}
          />
        )}

        {currentView === 'table' && (
          <TableView
            key={`table-${viewKey}`}
            tasks={allTasks}
            members={members}
            projectId={projectId}
            onTaskUpdate={(taskId, data) => handleTaskUpdate(taskId, data as any)}
            onTaskClick={handleTaskClick}
            onTaskDelete={(taskId) => deleteTask.mutate({ id: taskId })}
            onViewStateChange={setTableViewState}
            initialViewState={initialTableState}
          />
        )}

        {currentView === 'calendar' && (
          <CalendarView
            tasks={allTasks}
            onTaskClick={handleTaskClick}
            onTaskUpdate={(taskId, data) => {
              if (data.deadline !== undefined) {
                updateTask.mutate({ id: taskId, deadline: data.deadline });
              }
            }}
          />
        )}

        {currentView === 'gantt' && (
          <GanttChartAdvanced
            tasks={allTasks.map(t => ({
              ...t,
              deadline: t.deadline ? new Date(t.deadline) : null,
            }))}
            dependencies={ganttData?.dependencies || []}
            onTaskClick={handleTaskClick}
            onAddDependency={(fromId, toId) => {
              addDependency.mutate({ taskId: toId, dependsOnTaskId: fromId });
            }}
          />
        )}
      </main>
    </div>
  );
}
