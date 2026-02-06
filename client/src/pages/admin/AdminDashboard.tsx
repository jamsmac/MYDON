/**
 * Admin Dashboard - Main overview page
 * Stats cards, charts, recent activity, system status
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  MessageSquare, 
  Coins, 
  FolderKanban, 
  AlertTriangle,
  Bot,
  UserPlus,
  ScrollText,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminDashboard() {
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = trpc.admin.getDashboardStats.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const { data: recentLogs, isLoading: logsLoading } = trpc.orchestrator.getLogs.useQuery({ limit: 5 });
  
  const { data: systemStatus } = trpc.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Stats cards data
  const statsCards = [
    {
      title: "Пользователей",
      value: stats?.totalUsers ?? 0,
      change: stats?.usersChange ?? 0,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "AI запросов сегодня",
      value: stats?.aiRequestsToday ?? 0,
      change: stats?.aiRequestsChange ?? 0,
      icon: MessageSquare,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Кредитов потрачено",
      value: stats?.creditsSpentToday ?? 0,
      change: stats?.creditsChange ?? 0,
      icon: Coins,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Активных проектов",
      value: stats?.activeProjects ?? 0,
      change: stats?.projectsChange ?? 0,
      icon: FolderKanban,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Ошибок сегодня",
      value: stats?.errorsToday ?? 0,
      change: stats?.errorsChange ?? 0,
      icon: AlertTriangle,
      color: stats?.errorsToday && stats.errorsToday > 0 ? "text-red-400" : "text-muted-foreground",
      bgColor: stats?.errorsToday && stats.errorsToday > 0 ? "bg-red-500/10" : "bg-muted/50",
    },
  ];

  // Quick actions
  const quickActions = [
    { label: "Создать агента", icon: Bot, href: "/admin/agents", color: "bg-amber-500 hover:bg-amber-600" },
    { label: "Пригласить пользователя", icon: UserPlus, href: "/admin/users", color: "bg-blue-500 hover:bg-blue-600" },
    { label: "Посмотреть логи", icon: ScrollText, href: "/admin/logs", color: "bg-slate-600 hover:bg-slate-700" },
  ];

  // API providers status
  const apiProviders = systemStatus?.providers ?? [
    { name: "OpenAI", status: "unknown" },
    { name: "Anthropic", status: "unknown" },
    { name: "Database", status: "unknown" },
  ];

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Обзор состояния платформы</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  {stat.change !== 0 && (
                    <div className={`flex items-center gap-1 text-xs ${stat.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {stat.change > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>{stat.change > 0 ? "+" : ""}{stat.change}%</span>
                    </div>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credits Chart Placeholder */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              Расход кредитов за 7 дней
            </CardTitle>
            <CardDescription>Динамика использования AI кредитов</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center border border-dashed border-border rounded-lg">
              <div className="text-center text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">График будет доступен после накопления данных</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>Статус системы</CardTitle>
            <CardDescription>API провайдеры и сервисы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiProviders.map((provider: { name: string; status: string }) => (
              <div key={provider.name} className="flex items-center justify-between">
                <span className="text-sm">{provider.name}</span>
                <div className="flex items-center gap-2">
                  {provider.status === "online" ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                        Online
                      </Badge>
                    </>
                  ) : provider.status === "offline" ? (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <Badge variant="outline" className="border-red-500 text-red-400">
                        Offline
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      <Badge variant="outline">
                        Проверка...
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent AI Requests */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Последние AI запросы</CardTitle>
            <CardDescription>5 последних запросов к AI</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : recentLogs && recentLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-2">Время</th>
                      <th className="pb-2">Тип</th>
                      <th className="pb-2">Модель</th>
                      <th className="pb-2">Токены</th>
                      <th className="pb-2">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(log.createdAt), "HH:mm:ss", { locale: ru })}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {log.requestType}
                          </Badge>
                        </td>
                        <td className="py-2 font-mono text-xs">{log.model || "-"}</td>
                        <td className="py-2">{log.tokensUsed || "-"}</td>
                        <td className="py-2">
                          {log.status === "success" ? (
                            <Badge className="bg-emerald-500 text-xs">OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Err</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Нет данных о запросах</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Частые операции</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button className={`w-full justify-start gap-2 ${action.color}`}>
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
