/**
 * Usage Page - Cost Tracking for Users
 * Shows credit balance, usage history, and statistics
 */

import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Bot,
  MessageSquare,
  Code,
  FileText,
  BarChart3,
  Calendar,
  ArrowLeft,
  CreditCard,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

// Request type icons
const REQUEST_TYPE_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageSquare className="h-4 w-4" />,
  analysis: <BarChart3 className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  translation: <FileText className="h-4 w-4" />,
  summarization: <FileText className="h-4 w-4" />,
  creative: <Zap className="h-4 w-4" />,
};

// Time period options
const TIME_PERIODS = [
  { value: '7', label: 'Последние 7 дней' },
  { value: '14', label: 'Последние 14 дней' },
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
];

export default function UsagePage() {
  const { user, loading: authLoading } = useAuth();
  const [timePeriod, setTimePeriod] = useState('30');

  // Fetch usage data
  const { data: usageStats, isLoading: statsLoading } = trpc.usage.getStats.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: balanceData, isLoading: balanceLoading } = trpc.usage.getBalance.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: recentRequestsData, isLoading: requestsLoading } = trpc.usage.getRecentRequests.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  const { data: dailyUsage, isLoading: dailyLoading } = trpc.usage.getSpendingHistory.useQuery(
    { days: parseInt(timePeriod) },
    { enabled: !!user }
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Войдите для просмотра статистики</p>
      </div>
    );
  }

  const isLoading = statsLoading || requestsLoading || dailyLoading || balanceLoading;
  const recentRequests = recentRequestsData?.requests || [];

  // Calculate max value for chart
  const maxDailyCredits = dailyUsage 
    ? Math.max(...dailyUsage.map((d: { totalCost: number }) => Number(d.totalCost) || 0), 1) 
    : 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Использование AI</h1>
                <p className="text-sm text-muted-foreground">
                  Статистика расхода кредитов и история запросов
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Текущий баланс</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    {isLoading ? '...' : (balanceData?.credits ?? 0).toLocaleString()}
                  </span>
                  <span className="text-lg text-muted-foreground">кредитов</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Всего потрачено: {(balanceData?.totalSpent ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button disabled className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Пополнить кредиты
                </Button>
                <p className="text-xs text-muted-foreground text-center">Скоро</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Zap className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Всего запросов</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : (usageStats?.totalRequests ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Coins className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Потрачено кредитов</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : (balanceData?.totalSpent ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Средняя стоимость</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : usageStats?.avgCostPerRequest ?? '0.00'}
                    <span className="text-sm font-normal text-muted-foreground ml-1">кр</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Bot className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Топ модель</p>
                  <p className="text-lg font-bold truncate max-w-[150px]">
                    {isLoading ? '...' : (usageStats?.mostUsedModel || 'Нет данных')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Расход кредитов по дням</CardTitle>
            <CardDescription>
              График использования за последние {timePeriod} дней
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailyUsage && dailyUsage.length > 0 ? (
              <div className="h-[200px] flex items-end gap-1">
                {dailyUsage.map((day: { date: string; totalCost: number; requestCount: number }, index: number) => {
                  const credits = Number(day.totalCost) || 0;
                  const height = (credits / maxDailyCredits) * 100;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-full max-w-[24px] bg-primary/80 rounded-t transition-all hover:bg-primary"
                          style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                        />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {credits.toFixed(1)} кр
                        </div>
                      </div>
                      {index % Math.ceil(dailyUsage.length / 7) === 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(day.date), 'dd.MM', { locale: ru })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Нет данных за выбранный период
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Последние запросы</CardTitle>
            <CardDescription>
              История AI запросов с детализацией по токенам и стоимости
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата/Время</TableHead>
                    <TableHead>Модель</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Токены</TableHead>
                    <TableHead className="text-right">Стоимость</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : recentRequests && recentRequests.length > 0 ? (
                    recentRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(request.createdAt), 'dd MMM', { locale: ru })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(request.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {request.model || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {REQUEST_TYPE_ICONS[request.requestType || 'chat'] || <MessageSquare className="h-4 w-4" />}
                            <span className="capitalize">{request.requestType || 'chat'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <span className="text-green-600">{request.tokensUsed?.toLocaleString() || 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono">
                            {Number(request.creditsCost || 0).toFixed(2)} кр
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Нет запросов за выбранный период
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
