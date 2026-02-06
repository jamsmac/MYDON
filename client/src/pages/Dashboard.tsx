import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  FolderKanban, 
  Settings, 
  LogOut, 
  Loader2,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Calendar,
  Upload,
  Search,
  X,
  Sparkles,
  Trophy,
  Bot,
  Brain,
  Shield,
  CreditCard
} from 'lucide-react';
import { GanttChart } from '@/components/GanttChart';
import { ImportDialog } from '@/components/ImportDialog';
import { CreditsWidget } from '@/components/CreditsWidget';
import { UsageStats } from '@/components/UsageStats';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { AIGoalGenerator } from '@/components/AIGoalGenerator';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import { DailyBriefing } from '@/components/DailyBriefing';
import { NotificationCenter } from '@/components/NotificationCenter';
import { OverdueTasksWidget } from '@/components/OverdueTasksWidget';
import { ActivityFeed } from '@/components/ActivityFeed';
import { FloatingAIButton } from '@/components/AIAssistantButton';
import { ProjectsFilterModal, CreditsModal, AIDecisionsModal } from '@/components/DashboardModals';
import { Link, useLocation } from 'wouter';
import { Coins, Lightbulb } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { useKeyboardShortcuts, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts';
import { LayoutTemplate } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAchievementTrigger } from '@/hooks/useAchievementTrigger';

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [dailyBriefingOpen, setDailyBriefingOpen] = useState(false);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptType, setUpgradePromptType] = useState<'project' | 'ai'>('project');
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [projectsModalFilter, setProjectsModalFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [aiDecisionsModalOpen, setAiDecisionsModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenAI: () => setAiAssistantOpen(true),
    onNewProject: () => setCreateDialogOpen(true),
    onSearch: () => searchInputRef.current?.focus(),
  });

  const { data: projects, isLoading: projectsLoading, refetch } = trpc.project.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Filter projects based on selected status and search query
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    // First filter by status
    let filtered = projects;
    switch (statusFilter) {
      case 'active':
        filtered = projects.filter(p => p.status === 'active');
        break;
      case 'completed':
        filtered = projects.filter(p => p.status === 'completed');
        break;
      case 'overdue':
        filtered = projects.filter(p => {
          if (!p.targetDate) return false;
          return new Date(p.targetDate) < new Date() && p.status !== 'completed';
        });
        break;
    }
    
    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [projects, statusFilter, searchQuery]);

  // Fetch overdue tasks from server
  const { data: overdueTasksData } = trpc.task.getOverdue.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Transform overdue tasks for widget
  const overdueTasks = useMemo(() => {
    if (!overdueTasksData) return [];
    return overdueTasksData.map(task => ({
      ...task,
      priority: task.priority as 'critical' | 'high' | 'medium' | 'low' | null,
    }));
  }, [overdueTasksData]);

  // Get filter label for display
  const getFilterLabel = () => {
    switch (statusFilter) {
      case 'active': return 'Активные проекты';
      case 'completed': return 'Завершённые проекты';
      case 'overdue': return 'Просроченные проекты';
      default: return 'Мои проекты';
    }
  };

  const { handleAchievementResult } = useAchievementTrigger();

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Проект создан');
      setCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      refetch();
      // Check for new achievements
      handleAchievementResult(project);
      navigate(`/project/${project.id}`);
    },
    onError: (error) => {
      if (error.message.includes('лимит') || error.message.includes('Лимит')) {
        setUpgradePromptType('project');
        setUpgradePromptOpen(true);
      } else {
        toast.error('Ошибка создания проекта: ' + error.message);
      }
    }
  });

  const utils = trpc.useUtils();
  const updateTaskMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.getOverdue.invalidate();
    },
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Введите название проекта');
      return;
    }
    createProject.mutate({
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
    });
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl text-white">MYDON Roadmap Hub</CardTitle>
            <CardDescription className="text-slate-400">
              Платформа управления проектами с AI-ассистентом
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Войти
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white font-mono">MYDON</h1>
              <p className="text-xs text-slate-500">Roadmap Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/ai-chat">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary hover:text-primary/80 hover:bg-primary/10"
                title="AI Chat"
              >
                <Bot className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/achievements">
              <Button
                variant="ghost"
                size="icon"
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                title="Achievements"
              >
                <Trophy className="w-5 h-5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              onClick={() => setDailyBriefingOpen(true)}
              title="Daily Briefing"
            >
              <Sparkles className="w-5 h-5" />
            </Button>
            <NotificationCenter />
            <CreditsWidget />
            <UsageStats />
            <Link href="/decisions">
              <Button variant="ghost" size="icon" className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10" title="AI Решения">
                <Brain className="w-5 h-5" />
              </Button>
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10" title="Админ-панель">
                  <Shield className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <Link href="/payments">
              <Button variant="ghost" size="icon" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" title="Биллинг">
                <CreditCard className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <Settings className="w-5 h-5" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-white"
              onClick={() => logout()}
            >
              <LogOut className="w-5 h-5" />
            </Button>
            <div className="ml-2 px-3 py-1.5 bg-slate-800 rounded-lg">
              <span className="text-sm text-slate-300">{user?.name || user?.email || 'User'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card 
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-blue-500/50 ${statusFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            onClick={() => { setProjectsModalFilter('all'); setProjectsModalOpen(true); setStatusFilter('all'); }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{projects?.length || 0}</p>
                  <p className="text-sm text-slate-400">Проектов</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-amber-500/50 ${statusFilter === 'active' ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}
            onClick={() => { setProjectsModalFilter('active'); setProjectsModalOpen(true); setStatusFilter('active'); }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {projects?.filter(p => p.status === 'active').length || 0}
                  </p>
                  <p className="text-sm text-slate-400">Активных</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-emerald-500/50 ${statusFilter === 'completed' ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}`}
            onClick={() => { setProjectsModalFilter('completed'); setProjectsModalOpen(true); setStatusFilter('completed'); }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {projects?.filter(p => p.status === 'completed').length || 0}
                  </p>
                  <p className="text-sm text-slate-400">Завершённых</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-red-500/50 ${statusFilter === 'overdue' ? 'ring-2 ring-red-500 border-red-500' : ''}`}
            onClick={() => { setProjectsModalFilter('overdue'); setProjectsModalOpen(true); setStatusFilter('overdue'); }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {projects?.filter(p => {
                      if (!p.targetDate) return false;
                      return new Date(p.targetDate) < new Date() && p.status !== 'completed';
                    }).length || 0}
                  </p>
                  <p className="text-sm text-slate-400">Просроченных</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credits Card */}
          <Card 
            className="bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-purple-500/50"
            onClick={() => setCreditsModalOpen(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">—</p>
                  <p className="text-sm text-slate-400">Кредитов</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Decisions Card */}
          <Card 
            className="bg-slate-800/50 border-slate-700 cursor-pointer transition-all hover:border-cyan-500/50"
            onClick={() => setAiDecisionsModalOpen(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">—</p>
                  <p className="text-sm text-slate-400">AI Решений</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Tasks Widget */}
        {overdueTasks.length > 0 && (
          <div className="mb-8">
            <OverdueTasksWidget
              tasks={overdueTasks}
              onTaskClick={(taskId, projectId) => navigate(`/project/${projectId}?task=${taskId}`)}
              onMarkComplete={async (taskId) => {
                try {
                  await updateTaskMutation.mutateAsync({ id: taskId, status: 'completed' });
                  toast.success('Задача отмечена как выполненная');
                } catch (error) {
                  toast.error('Не удалось обновить задачу');
                }
              }}
              onRescheduleToday={async (taskId) => {
                try {
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  await updateTaskMutation.mutateAsync({ id: taskId, deadline: today.getTime() });
                  toast.success('Дедлайн перенесён на сегодня');
                } catch (error) {
                  toast.error('Не удалось обновить дедлайн');
                }
              }}
            />
          </div>
        )}

        {/* Activity Feed Section */}
        <div className="mb-8">
          <ActivityFeed limit={15} showProjectName={true} />
        </div>

        {/* Timeline Section */}
        {projects && projects.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-semibold text-white">Timeline</h2>
            </div>
            <GanttChart 
              blocks={projects.map(p => ({
                id: p.id,
                title: p.name,
                progress: 0,
                status: p.status || undefined,
              }))}
              onBlockClick={(id) => navigate(`/project/${id}`)}
            />
          </div>
        )}

        {/* Projects Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">{getFilterLabel()}</h2>
            {statusFilter !== 'all' && (
              <button 
                onClick={() => setStatusFilter('all')}
                className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors"
              >
                Сбросить фильтр
              </button>
            )}
          </div>
          
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Поиск проектов... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500"
              onClick={() => setAiGeneratorOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Генератор
            </Button>
            <Button 
              variant="outline" 
              className="border-violet-500/50 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500"
              onClick={() => setTemplateLibraryOpen(true)}
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Шаблоны
            </Button>
            <Button 
              variant="outline" 
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Импорт
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                <Plus className="w-4 h-4 mr-2" />
                Новый проект
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Создать проект</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Название</Label>
                  <Input
                    id="name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Например: TechRent Uzbekistan"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Описание</Label>
                  <Textarea
                    id="description"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Краткое описание проекта..."
                    className="bg-slate-900 border-slate-600 text-white"
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleCreateProject}
                  disabled={createProject.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {createProject.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Создать
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Import Dialog */}
        <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        
        {/* AI Goal Generator */}
        <AIGoalGenerator 
          open={aiGeneratorOpen} 
          onOpenChange={setAiGeneratorOpen}
          onProjectCreated={() => {
            refetch();
            setAiGeneratorOpen(false);
          }}
        />

        {/* Template Library */}
        <TemplateLibrary 
          open={templateLibraryOpen} 
          onOpenChange={(open) => {
            setTemplateLibraryOpen(open);
            if (!open) refetch();
          }}
        />

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredProjects && filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${project.color}20` }}
                      >
                        <FolderKanban 
                          className="w-6 h-6" 
                          style={{ color: project.color || '#f59e0b' }}
                        />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <CardTitle className="text-white mt-4">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="text-slate-400 line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Прогресс</span>
                        <span className="text-slate-300">0%</span>
                      </div>
                      <Progress value={0} className="h-2 bg-slate-700" />
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {project.status === 'active' && '🟢 Активен'}
                          {project.status === 'completed' && '✅ Завершён'}
                          {project.status === 'archived' && '📦 В архиве'}
                        </span>
                        <span>
                          {project.updatedAt && new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : searchQuery ? (
          <Card className="bg-slate-800/30 border-slate-700 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ничего не найдено</h3>
              <p className="text-slate-400 text-center mb-4">
                По запросу «{searchQuery}» проекты не найдены
              </p>
              <Button 
                onClick={() => setSearchQuery('')}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <X className="w-4 h-4 mr-2" />
                Очистить поиск
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/30 border-slate-700 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Нет проектов</h3>
              <p className="text-slate-400 text-center mb-4">
                Создайте первый проект для начала работы
              </p>
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать проект
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Daily Briefing Dialog */}
      <DailyBriefing 
        open={dailyBriefingOpen} 
        onOpenChange={setDailyBriefingOpen} 
      />

      {/* Dashboard Modals */}
      <ProjectsFilterModal
        open={projectsModalOpen}
        onOpenChange={setProjectsModalOpen}
        projects={projects || []}
        filterType={projectsModalFilter}
      />
      <CreditsModal open={creditsModalOpen} onOpenChange={setCreditsModalOpen} />
      <AIDecisionsModal open={aiDecisionsModalOpen} onOpenChange={setAiDecisionsModalOpen} />

      {/* Floating AI Assistant Button */}
      <FloatingAIButton open={aiAssistantOpen} onOpenChange={setAiAssistantOpen} />
      {/* Upgrade Prompt Dialog */}
      <UpgradePrompt
        open={upgradePromptOpen}
        onOpenChange={setUpgradePromptOpen}
        type={upgradePromptType}
      />
    </div>
  );
}
