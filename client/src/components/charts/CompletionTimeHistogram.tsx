import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Loader2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompletionTimeHistogramProps {
  projectId: number;
}

export function CompletionTimeHistogram({ projectId }: CompletionTimeHistogramProps) {
  const { data, isLoading } = trpc.analytics.getCompletionTimeHistogram.useQuery(
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
  
  if (!data || data.data.every(d => d.count === 0)) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Время выполнения задач
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-slate-400">
          Нет завершённых задач
        </CardContent>
      </Card>
    );
  }
  
  const colors = ["#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-medium mb-1">{label}</p>
          <p className="text-sm text-amber-400">
            {payload[0].value} задач
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Время выполнения задач
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
              >
                {data.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{data.totalCompleted}</p>
            <p className="text-xs text-slate-400">Завершено задач</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{data.avgDays} дн</p>
            <p className="text-xs text-slate-400">Среднее время</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
