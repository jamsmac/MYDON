import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VelocityChartProps {
  projectId: number;
  weeks?: number;
}

export function VelocityChart({ projectId, weeks = 8 }: VelocityChartProps) {
  const { data, isLoading } = trpc.analytics.getVelocityData.useQuery(
    { projectId, weeks },
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
  
  if (!data || data.data.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Velocity (задачи/неделя)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-slate-400">
          Недостаточно данных для отображения
        </CardContent>
      </Card>
    );
  }
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Velocity (задачи/неделя)
          <span className="text-sm font-normal text-slate-400 ml-2">
            (последние {weeks} недель)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="week" 
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-slate-300">{value}</span>}
              />
              <Bar
                dataKey="completed"
                name="Выполнено за неделю"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="average"
                name="Скользящее среднее"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{data.avgVelocity}</p>
            <p className="text-xs text-slate-400">Средняя скорость</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{data.totalCompleted}</p>
            <p className="text-xs text-slate-400">Всего выполнено</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-400">
              {data.data.length > 0 ? Math.max(...data.data.map(d => d.completed)) : 0}
            </p>
            <p className="text-xs text-slate-400">Макс. за неделю</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
