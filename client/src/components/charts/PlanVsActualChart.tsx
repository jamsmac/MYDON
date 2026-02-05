import { trpc } from "@/lib/trpc";
import { Loader2, GitCompare, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface PlanVsActualChartProps {
  projectId: number;
}

export function PlanVsActualChart({ projectId }: PlanVsActualChartProps) {
  const { data, isLoading } = trpc.analytics.getPlanVsActual.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center h-80">
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
            <GitCompare className="w-5 h-5 text-amber-500" />
            План vs Факт
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-slate-400">
          Нет блоков с дедлайнами
        </CardContent>
      </Card>
    );
  }
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, "d MMM", { locale: ru });
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "on_track":
        return <Clock className="w-4 h-4 text-blue-400" />;
      case "at_risk":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "delayed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Завершён";
      case "on_track": return "В графике";
      case "at_risk": return "Под угрозой";
      case "delayed": return "Просрочен";
      default: return status;
    }
  };
  
  const getVarianceColor = (variance: number) => {
    if (variance <= 0) return "text-emerald-400";
    if (variance <= 7) return "text-amber-400";
    return "text-red-400";
  };
  
  // Calculate summary
  const completed = data.filter(d => d.status === "completed").length;
  const onTrack = data.filter(d => d.status === "on_track").length;
  const atRisk = data.filter(d => d.status === "at_risk").length;
  const delayed = data.filter(d => d.status === "delayed").length;
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-amber-500" />
          План vs Факт
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
            Завершено: {completed}
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
            В графике: {onTrack}
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">
            Под угрозой: {atRisk}
          </span>
          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
            Просрочено: {delayed}
          </span>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 text-slate-400 font-medium">Блок</th>
                <th className="text-center py-2 text-slate-400 font-medium">План</th>
                <th className="text-center py-2 text-slate-400 font-medium">Факт</th>
                <th className="text-center py-2 text-slate-400 font-medium">Δ дней</th>
                <th className="text-center py-2 text-slate-400 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 8).map((item, index) => (
                <tr key={index} className="border-b border-slate-700/50">
                  <td className="py-2 text-white">
                    <span className="text-slate-500 mr-1">#{item.number}</span>
                    {item.block.length > 25 ? item.block.substring(0, 25) + '...' : item.block}
                  </td>
                  <td className="py-2 text-center text-slate-300">
                    {formatDate(item.plannedDate)}
                  </td>
                  <td className="py-2 text-center text-slate-300">
                    {formatDate(item.actualDate)}
                  </td>
                  <td className={`py-2 text-center font-medium ${getVarianceColor(item.daysVariance)}`}>
                    {item.daysVariance > 0 ? `+${item.daysVariance}` : item.daysVariance || "—"}
                  </td>
                  <td className="py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {data.length > 8 && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Показано 8 из {data.length} блоков
          </p>
        )}
      </CardContent>
    </Card>
  );
}
