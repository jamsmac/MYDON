import { trpc } from "@/lib/trpc";
import { Loader2, Timer, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopLongestTasksProps {
  projectId: number;
}

interface TaskData {
  id: number;
  title: string;
  status: string | null;
  days: number;
  sectionTitle?: string;
}

export function TopLongestTasks({ projectId }: TopLongestTasksProps) {
  const { data, isLoading } = trpc.analytics.getTopLongestTasks.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-500" />
            Топ-5 самых долгих задач
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-slate-400">
          Нет данных о задачах
        </CardContent>
      </Card>
    );
  }
  
  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "in_progress":
        return <PlayCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };
  
  const formatDuration = (days: number) => {
    if (days < 7) return `${days} дн`;
    if (days < 30) return `${Math.floor(days / 7)} нед`;
    return `${Math.floor(days / 30)} мес`;
  };
  
  const maxDays = Math.max(...data.map((t: TaskData) => t.days));

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Timer className="w-5 h-5 text-amber-500" />
          Топ-5 самых долгих задач
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((task: TaskData, index: number) => (
          <div key={task.id} className="flex items-center gap-3">
            {/* Rank */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0 ? 'bg-amber-500/20 text-amber-400' :
              index === 1 ? 'bg-slate-500/20 text-slate-300' :
              index === 2 ? 'bg-orange-500/20 text-orange-400' :
              'bg-slate-700/50 text-slate-500'
            }`}>
              {index + 1}
            </div>
            
            {/* Task info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(task.status || 'not_started')}
                <span className="text-sm text-white truncate">
                  {task.title}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    task.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${(task.days / maxDays) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Duration */}
            <div className="text-right">
              <span className={`text-sm font-medium ${
                task.days > 30 ? 'text-red-400' :
                task.days > 14 ? 'text-amber-400' :
                'text-slate-300'
              }`}>
                {formatDuration(task.days)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
