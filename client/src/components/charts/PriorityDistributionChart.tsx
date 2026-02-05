import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Loader2, PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PriorityDistributionChartProps {
  projectId: number;
}

export function PriorityDistributionChart({ projectId }: PriorityDistributionChartProps) {
  const { data, isLoading } = trpc.analytics.getPriorityDistribution.useQuery(
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
  
  if (!data || data.every(d => d.count === 0)) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-amber-500" />
            Распределение по приоритетам
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-slate-400">
          Нет задач для отображения
        </CardContent>
      </Card>
    );
  }
  
  // Filter out zero values for better visualization
  const chartData = data.filter(d => d.count > 0);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 font-medium mb-1">{item.label}</p>
          <p className="text-sm" style={{ color: item.color }}>
            {item.count} задач ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };
  
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Don't show label for small slices
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
  
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-amber-500" />
          Распределение по приоритетам
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={90}
                innerRadius={40}
                dataKey="count"
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-700">
          {data.map((item) => (
            <div key={item.priority} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-slate-400">
                {'label' in item ? item.label : item.priority}: <span className="text-white font-medium">{item.count}</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
