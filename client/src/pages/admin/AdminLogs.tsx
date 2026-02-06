import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Activity, Search, Download, CheckCircle, XCircle,
  Clock, User, Cpu, DollarSign, Zap, TrendingUp, BarChart3
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminLogs() {
  const [filters, setFilters] = useState({
    userId: undefined as number | undefined,
    type: undefined as string | undefined,
    model: undefined as string | undefined,
    status: undefined as string | undefined,
    dateFrom: format(subDays(new Date(), 7), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
  });
  const [search, setSearch] = useState("");

  const { data: logsData, isLoading } = trpc.adminLogs.getAILogs.useQuery({
    userId: filters.userId,
    model: filters.model,
    requestType: filters.type,
    status: filters.status as "success" | "error" | "timeout" | "rate_limited" | undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    limit: 50,
  });

  const { data: analytics } = trpc.adminLogs.getAIStats.useQuery({ days: 30 });
  const { data: topUsers = [] } = trpc.adminLogs.getTopUsersByRequests.useQuery({ limit: 5, days: 30 });
  const { data: modelUsage = [] } = trpc.adminLogs.getModelUsageBreakdown.useQuery({ days: 30 });
  const { data: recentErrors = [] } = trpc.adminLogs.getRecentErrors.useQuery({ limit: 5 });

  const exportLogsMutation = trpc.adminLogs.exportLogs.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs_${filters.dateFrom}_${filters.dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Логи экспортированы");
    },
    onError: (err) => toast.error(err.message),
  });

  // Simple bar chart component
  const BarChart = ({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) => (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-24 text-xs text-muted-foreground truncate">{item.label}</span>
          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="w-12 text-xs text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );

  // Pie chart component (CSS-based)
  const PieChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;
    const segments = data.map(d => {
      const angle = (d.value / total) * 360;
      const segment = { ...d, startAngle: currentAngle, angle };
      currentAngle += angle;
      return segment;
    });

    return (
      <div className="flex items-center gap-4">
        <div
          className="w-24 h-24 rounded-full relative"
          style={{
            background: `conic-gradient(${segments
              .map(s => `${s.color} ${s.startAngle}deg ${s.startAngle + s.angle}deg`)
              .join(", ")})`,
          }}
        />
        <div className="space-y-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
              <span>{d.label}</span>
              <span className="text-muted-foreground">({Math.round((d.value / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Логи и аналитика
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Мониторинг AI запросов и системных событий
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportLogsMutation.mutate({
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
          })}
          disabled={exportLogsMutation.isPending}
        >
          <Download className="w-4 h-4 mr-2" />
          Экспорт CSV
        </Button>
      </div>

      {/* Recent Errors Alert */}
      {recentErrors.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-500">
              <XCircle className="w-4 h-4" />
              Недавние ошибки ({recentErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentErrors.slice(0, 3).map((error: any) => (
              <div
                key={error.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="destructive">{error.status}</Badge>
                  <div>
                    <div className="font-medium text-sm">{error.model || "Unknown model"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-md">
                      {error.errorMessage || "No error message"}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {error.createdAt && formatDistanceToNow(new Date(error.createdAt), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics?.totalRequests?.toLocaleString() || 0}</div>
                <div className="text-xs text-muted-foreground">Всего запросов</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{analytics?.errorRate && typeof analytics.errorRate === 'string' ? (100 - parseFloat(analytics.errorRate)).toFixed(1) : 100}%</div>
                <div className="text-xs text-muted-foreground">Успешных</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{typeof analytics?.avgResponseTime === 'number' ? analytics.avgResponseTime.toFixed(0) : 0}ms</div>
                <div className="text-xs text-muted-foreground">Среднее время</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{typeof analytics?.avgCreditsPerRequest === 'number' ? analytics.avgCreditsPerRequest.toFixed(1) : 0}</div>
                <div className="text-xs text-muted-foreground">Кредитов/запрос</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Топ-5 пользователей по запросам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUsers.length > 0 ? (
              <BarChart
                data={topUsers.map((u: any) => ({ label: u.userName || `User ${u.userId}`, value: u.requestCount }))}
                maxValue={Math.max(...topUsers.map((u: any) => u.requestCount))}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>

        {/* Model Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Расход по моделям
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelUsage.length > 0 ? (
              <PieChart
                data={modelUsage.map((m: any, i: number) => ({
                  label: m.model || "Unknown",
                  value: m.requestCount,
                  color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5],
                }))}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">Нет данных</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="pl-9"
              />
            </div>
            <Select
              value={filters.type || "all"}
              onValueChange={(v) => setFilters({ ...filters, type: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="code">Code</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="success">Успешно</SelectItem>
                <SelectItem value="error">Ошибка</SelectItem>
                <SelectItem value="timeout">Таймаут</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-40"
            />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Логи запросов
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              Показано: {logsData?.logs.length || 0} из {logsData?.total || 0}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Статус</th>
                  <th className="text-left p-3 font-medium">Пользователь</th>
                  <th className="text-left p-3 font-medium">Тип</th>
                  <th className="text-left p-3 font-medium">Модель</th>
                  <th className="text-left p-3 font-medium">Токены</th>
                  <th className="text-left p-3 font-medium">Время</th>
                  <th className="text-left p-3 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody>
                {logsData?.logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Нет логов для отображения
                    </td>
                  </tr>
                ) : (
                  logsData?.logs.map((log: any) => (
                    <tr key={log.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">{getStatusIcon(log.status)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                            {log.userId?.toString().charAt(0) || "?"}
                          </div>
                          <span className="truncate max-w-[100px]">User {log.userId}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{log.requestType || "—"}</Badge>
                      </td>
                      <td className="p-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {log.model || "—"}
                        </code>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {log.tokensUsed?.toLocaleString() || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {log.responseTime ? `${log.responseTime}ms` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {log.createdAt && formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
