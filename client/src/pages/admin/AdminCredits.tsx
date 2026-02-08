/**
 * AdminCredits - Credits balance and transaction history
 * Stats, charts, and transaction table with filters
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Activity,
  Download,
  RefreshCw,
  Calendar,
  Bot,
  Gift,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function AdminCredits() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Queries
  const { data: stats, isLoading: statsLoading } = trpc.adminCredits.getStats.useQuery();
  const { data: chartData, isLoading: chartLoading } = trpc.adminCredits.getChartData.useQuery({ period });
  const { data: transactionsData, isLoading: transactionsLoading, refetch } = trpc.adminCredits.getTransactions.useQuery({
    type: typeFilter !== "all" ? typeFilter as "initial" | "bonus" | "purchase" | "ai_request" | "ai_generate" | "refund" : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 50,
    offset: 0,
  });

  // Export mutation
  const { data: exportData, refetch: exportCsv } = trpc.adminCredits.exportTransactions.useQuery(
    { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: false }
  );

  const handleExport = async () => {
    const result = await exportCsv();
    if (result.data?.csv) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано ${result.data.count} транзакций`);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "ai_request":
        return <Badge className="bg-blue-500"><Bot className="w-3 h-3 mr-1" />AI запрос</Badge>;
      case "ai_generate":
        return <Badge className="bg-purple-500"><Bot className="w-3 h-3 mr-1" />Генерация</Badge>;
      case "bonus":
        return <Badge className="bg-emerald-500"><Gift className="w-3 h-3 mr-1" />Бонус</Badge>;
      case "purchase":
        return <Badge className="bg-amber-500"><CreditCard className="w-3 h-3 mr-1" />Покупка</Badge>;
      case "refund":
        return <Badge variant="outline"><ArrowUpRight className="w-3 h-3 mr-1" />Возврат</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Баланс и история</h1>
            <p className="text-muted-foreground">
              Статистика кредитов и история транзакций
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Экспорт CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего в обороте</CardTitle>
              <Coins className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.totalInCirculation?.toLocaleString() || 0}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Потрачено сегодня</CardTitle>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-500">
                    -{stats?.today?.spent?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.today?.transactions || 0} транзакций
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">За неделю</CardTitle>
              <Activity className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.week?.spent?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    +{stats?.week?.earned?.toLocaleString() || 0} начислено
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">За месяц</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.month?.spent?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    +{stats?.month?.earned?.toLocaleString() || 0} начислено
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Динамика расхода</CardTitle>
                <CardDescription>Потрачено и начислено кредитов</CardDescription>
              </div>
              <Select value={period} onValueChange={(v) => setPeriod(v as "day" | "week" | "month")}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">День</SelectItem>
                  <SelectItem value="week">Неделя</SelectItem>
                  <SelectItem value="month">Месяц</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => format(new Date(value), "d MMM", { locale: ru })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(value) => format(new Date(value), "d MMMM yyyy", { locale: ru })}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="spent"
                    name="Потрачено"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="earned"
                    name="Начислено"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>История транзакций</CardTitle>
                <CardDescription>
                  {transactionsData?.total || 0} транзакций
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[150px]"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[150px]"
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="ai_request">AI запрос</SelectItem>
                    <SelectItem value="ai_generate">Генерация</SelectItem>
                    <SelectItem value="bonus">Бонус</SelectItem>
                    <SelectItem value="purchase">Покупка</SelectItem>
                    <SelectItem value="refund">Возврат</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Модель</TableHead>
                  <TableHead className="text-right">Токены</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Баланс</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                    </TableRow>
                  ))
                ) : transactionsData?.transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Транзакции не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  transactionsData?.transactions?.map((tx: { id: number; createdAt: string | null; userName: string | null; userEmail: string | null; type: string | null; description: string | null; model: string | null; tokensUsed: number | null; amount: number | null; balance: number | null }) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {tx.createdAt && format(new Date(tx.createdAt), "d MMM HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{tx.userName || "—"}</div>
                          <div className="text-muted-foreground text-xs">{tx.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(tx.type || "")}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {tx.description || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.model || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {tx.tokensUsed?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={tx.amount && tx.amount < 0 ? "text-red-500" : "text-emerald-500"}>
                          {tx.amount && tx.amount > 0 ? "+" : ""}{tx.amount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {tx.balance}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
