import { trpc } from "@/lib/trpc";
import { Loader2, Calendar, Target, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ProjectedCompletionProps {
  projectId: number;
}

export function ProjectedCompletion({ projectId }: ProjectedCompletionProps) {
  const { data, isLoading } = trpc.analytics.getProjectedCompletion.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            Прогноз завершения
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32 text-slate-400">
          Недостаточно данных
        </CardContent>
      </Card>
    );
  }
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "Не указана";
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "d MMMM yyyy", { locale: ru });
  };
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-500" />
          Прогноз завершения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicator */}
        <div className={`flex items-center gap-3 p-3 rounded-lg ${
          data.onTrack 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          {data.onTrack ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Проект в графике</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">Проект отстаёт от графика</span>
            </>
          )}
        </div>
        
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Целевая дата</span>
            </div>
            <p className="text-sm font-medium text-white">
              {formatDate(data.targetDate)}
            </p>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Прогнозируемая</span>
            </div>
            <p className={`text-sm font-medium ${
              data.onTrack ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {data.projectedDate ? formatDate(data.projectedDate) : "Нет данных"}
            </p>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Осталось задач</span>
            </div>
            <p className="text-sm font-medium text-amber-400">
              {data.remainingTasks}
            </p>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Осталось недель</span>
            </div>
            <p className="text-sm font-medium text-indigo-400">
              {data.weeksRemaining || "—"}
            </p>
          </div>
        </div>
        
        {/* Velocity info */}
        <div className="text-center pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-400">
            Текущая скорость: <span className="text-amber-400 font-medium">{data.avgVelocity}</span> задач/неделю
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
