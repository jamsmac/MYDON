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
  Calendar
} from 'lucide-react';
import { GanttChart } from '@/components/GanttChart';
import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const { data: projects, isLoading: projectsLoading, refetch } = trpc.project.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Проект создан');
      setCreateDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      refetch();
      navigate(`/project/${project.id}`);
    },
    onError: (error) => {
      toast.error('Ошибка создания проекта: ' + error.message);
    }
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
            <CardTitle className="text-2xl text-white">MAYDON Roadmap Hub</CardTitle>
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
              <h1 className="text-lg font-semibold text-white font-mono">MAYDON</h1>
              <p className="text-xs text-slate-500">Roadmap Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
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

          <Card className="bg-slate-800/50 border-slate-700">
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

          <Card className="bg-slate-800/50 border-slate-700">
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

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-sm text-slate-400">Просроченных</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Мои проекты</h2>
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

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
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
    </div>
  );
}
