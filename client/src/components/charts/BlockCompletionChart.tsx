import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Loader2, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BlockCompletionChartProps {
  projectId: number;
}

export function BlockCompletionChart({ projectId }: BlockCompletionChartProps) {
  const { data, isLoading } = trpc.analytics.getBlockCompletionRates.useQuery(
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
            <LayoutGrid className="w-5 h-5 text-amber-500" />
            Completion Rate по блокам
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-slate-400">
          Нет блоков для отображения
        </CardContent>
      </Card>
    );
  }
  
  // Prepare data for chart
  const chartData = data.map(block => ({
    name: `Блок ${block.number}`,
    title: block.title.length > 20 ? block.title.substring(0, 20) + '...' : block.title,
    rate: block.rate,
    completed: block.completed,
    total: block.total,
  }));
  
  const getBarColor = (rate: number) => {
    if (rate >= 80) return "#10b981"; // green
    if (rate >= 50) return "#f59e0b"; // amber
    if (rate >= 20) return "#f97316"; // orange
    return "#64748b"; // gray
  };
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-medium mb-1">{item.name}</p>
          <p className="text-xs text-slate-400 mb-2">{item.title}</p>
          <p className="text-sm text-emerald-400">
            Выполнено: {item.completed} / {item.total}
          </p>
          <p className="text-sm text-amber-400">
            Прогресс: {item.rate}%
          </p>
        </div>
      );
    }
    return null;
  };
  
  // Calculate overall stats
  const totalTasks = data.reduce((sum, b) => sum + b.total, 0);
  const completedTasks = data.reduce((sum, b) => sum + b.completed, 0);
  const avgRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-amber-500" />
          Completion Rate по блокам
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis 
                type="number" 
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis 
                type="category" 
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="rate" 
                radius={[0, 4, 4, 0]}
                barSize={20}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.rate)} />
                ))}
                <LabelList 
                  dataKey="rate" 
                  position="right" 
                  fill="#94a3b8"
                  fontSize={11}
                  formatter={(value: number) => `${value}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-400">{data.length}</p>
            <p className="text-xs text-slate-400">Блоков</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{completedTasks}</p>
            <p className="text-xs text-slate-400">Выполнено</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{avgRate}%</p>
            <p className="text-xs text-slate-400">Общий прогресс</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
