import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Sun, 
  Moon, 
  Sunrise, 
  Sunset,
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Loader2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'wouter';

interface DailyBriefingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyBriefing({ open, onOpenChange }: DailyBriefingProps) {
  const { data: briefing, isLoading } = trpc.briefing.get.useQuery(undefined, {
    enabled: open,
  });
  
  const utils = trpc.useUtils();
  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.briefing.get.invalidate();
    },
  });

  const getTimeIcon = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return <Sunrise className="w-6 h-6 text-amber-400" />;
    if (hour >= 12 && hour < 17) return <Sun className="w-6 h-6 text-yellow-400" />;
    if (hour >= 17 && hour < 21) return <Sunset className="w-6 h-6 text-orange-400" />;
    return <Moon className="w-6 h-6 text-blue-400" />;
  };

  const getPaceIcon = (pace: string) => {
    switch (pace) {
      case 'ahead': return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case 'behind': return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'on-track': return <Minus className="w-4 h-4 text-amber-400" />;
      default: return null;
    }
  };

  const getPaceBadge = (pace: string) => {
    switch (pace) {
      case 'ahead': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Опережаете</Badge>;
      case 'behind': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Отстаёте</Badge>;
      case 'on-track': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">По плану</Badge>;
      default: return null;
    }
  };

  const handleTaskComplete = (taskId: number) => {
    updateTask.mutate({ id: taskId, status: 'completed' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            {getTimeIcon()}
            <span className="text-slate-100">Daily Briefing</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : briefing ? (
          <div className="space-y-6">
            {/* Greeting */}
            <div className="text-center py-4 bg-gradient-to-r from-slate-800/50 to-slate-800/30 rounded-lg border border-slate-700/50">
              <h2 className="text-2xl font-bold text-slate-100 mb-1">
                {briefing.greeting}! 👋
              </h2>
              <p className="text-slate-400 capitalize">{briefing.date}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-slate-100">{briefing.stats.totalProjects}</div>
                <div className="text-xs text-slate-400">Проектов</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-amber-400">{briefing.stats.activeProjects}</div>
                <div className="text-xs text-slate-400">Активных</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-emerald-400">{briefing.stats.completedProjects}</div>
                <div className="text-xs text-slate-400">Завершено</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700/50">
                <div className="text-2xl font-bold text-red-400">{briefing.stats.overdueCount}</div>
                <div className="text-xs text-slate-400">Просрочено</div>
              </div>
            </div>

            {/* Overdue Warning */}
            {briefing.overdueTasks.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-red-400">
                    Просроченные задачи ({briefing.overdueTasks.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {briefing.overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.taskId} className="flex items-center justify-between bg-red-500/5 rounded p-2">
                      <div>
                        <div className="text-sm text-slate-200">{task.taskTitle}</div>
                        <div className="text-xs text-slate-400">{task.projectName}</div>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {task.daysOverdue} дн. назад
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Tasks */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-slate-100">
                  Задачи на сегодня
                </h3>
                <Badge variant="outline" className="ml-auto border-slate-600 text-slate-300">
                  {briefing.todaysTasks.filter(t => !t.isCompleted).length} осталось
                </Badge>
              </div>
              
              {briefing.todaysTasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400/50" />
                  <p>Все задачи выполнены! 🎉</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {briefing.todaysTasks.slice(0, 10).map((task) => (
                    <div 
                      key={task.taskId} 
                      className={`flex items-center gap-3 p-2 rounded transition-colors ${
                        task.isCompleted 
                          ? 'bg-emerald-500/10 opacity-60' 
                          : 'bg-slate-700/30 hover:bg-slate-700/50'
                      }`}
                    >
                      <Checkbox
                        checked={task.isCompleted}
                        onCheckedChange={() => !task.isCompleted && handleTaskComplete(task.taskId)}
                        disabled={task.isCompleted || updateTask.isPending}
                        className="border-slate-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {task.taskTitle}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {task.projectName} → {task.blockTitle}
                        </div>
                      </div>
                      <Link href={`/project/${task.projectId}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Project Progress */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-slate-100">Прогресс проектов</h3>
              </div>
              
              <div className="space-y-4">
                {briefing.projectProgress.map((project) => (
                  <div key={project.projectId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/project/${project.projectId}`}>
                        <span className="text-sm text-slate-200 hover:text-amber-400 transition-colors cursor-pointer">
                          {project.projectName}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2">
                        {getPaceIcon(project.pace)}
                        {getPaceBadge(project.pace)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress 
                        value={project.progressPercent} 
                        className="flex-1 h-2 bg-slate-700"
                      />
                      <span className="text-sm font-medium text-slate-300 w-12 text-right">
                        {project.progressPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{project.completedTasks} из {project.totalTasks} задач</span>
                      {project.estimatedCompletion && (
                        <span>Прогноз: {project.estimatedCompletion}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Motivational Footer */}
            <div className="text-center py-3 text-slate-400 text-sm">
              {briefing.stats.overdueCount === 0 && briefing.todaysTasks.length === 0 ? (
                <span>Отличная работа! Вы на верном пути 🚀</span>
              ) : briefing.stats.overdueCount > 0 ? (
                <span>Начните с просроченных задач — это освободит голову 💪</span>
              ) : (
                <span>Сфокусируйтесь на одной задаче за раз ✨</span>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
