import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Shield,
  Clock,
  Link2,
  Target,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RiskDetectionPanelProps {
  projectId: number;
  className?: string;
}

const severityConfig = {
  critical: {
    label: "Критичный",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  high: {
    label: "Высокий",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: AlertTriangle,
  },
  medium: {
    label: "Средний",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  low: {
    label: "Низкий",
    color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    icon: Shield,
  },
};

const riskTypeConfig: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  blocked: { label: "Заблокировано", icon: Link2 },
  overdue: { label: "Просрочено", icon: Clock },
  dependency: { label: "Зависимость", icon: Link2 },
  resource: { label: "Ресурсы", icon: Target },
  scope: { label: "Объём", icon: Target },
  deadline: { label: "Дедлайн", icon: Clock },
  quality: { label: "Качество", icon: Shield },
};

const statusConfig = {
  open: { label: "Открыт", color: "text-red-400" },
  mitigated: { label: "Смягчён", color: "text-amber-400" },
  resolved: { label: "Решён", color: "text-emerald-400" },
  accepted: { label: "Принят", color: "text-slate-400" },
};

export function RiskDetectionPanel({
  projectId,
  className,
}: RiskDetectionPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data: risksData, refetch } = trpc.aiEnhancements.getProjectRisks.useQuery({
    projectId,
    status: statusFilter as any,
  });

  const detectRisks = trpc.aiEnhancements.detectRisks.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success(`Обнаружено ${data.risks.length} рисков`);
    },
    onError: () => {
      toast.error("Ошибка при анализе рисков");
    },
  });

  const updateStatus = trpc.aiEnhancements.updateRiskStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Статус обновлён");
    },
  });

  const risks = risksData?.risks || [];

  const summary = {
    critical: risks.filter((r) => r.severity === "critical").length,
    high: risks.filter((r) => r.severity === "high").length,
    medium: risks.filter((r) => r.severity === "medium").length,
    low: risks.filter((r) => r.severity === "low").length,
  };

  return (
    <Card className={cn("bg-slate-800/50 border-slate-700", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Обнаружение рисков
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="open">Открытые</SelectItem>
                <SelectItem value="mitigated">Смягчённые</SelectItem>
                <SelectItem value="resolved">Решённые</SelectItem>
                <SelectItem value="accepted">Принятые</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => detectRisks.mutate({ projectId })}
              disabled={detectRisks.isPending}
            >
              {detectRisks.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 mt-3">
          {summary.critical > 0 && (
            <Badge variant="outline" className={severityConfig.critical.color}>
              {summary.critical} критичных
            </Badge>
          )}
          {summary.high > 0 && (
            <Badge variant="outline" className={severityConfig.high.color}>
              {summary.high} высоких
            </Badge>
          )}
          {summary.medium > 0 && (
            <Badge variant="outline" className={severityConfig.medium.color}>
              {summary.medium} средних
            </Badge>
          )}
          {summary.low > 0 && (
            <Badge variant="outline" className={severityConfig.low.color}>
              {summary.low} низких
            </Badge>
          )}
          {risks.length === 0 && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Рисков не обнаружено
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {risks.map((risk) => {
          const severity = severityConfig[risk.severity as keyof typeof severityConfig] || severityConfig.medium;
          const riskType = riskTypeConfig[risk.riskType] || { label: risk.riskType, icon: AlertTriangle };
          const status = statusConfig[risk.status as keyof typeof statusConfig] || statusConfig.open;
          const SeverityIcon = severity.icon;
          const TypeIcon = riskType.icon;

          return (
            <div
              key={risk.id}
              className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50"
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", severity.color)}>
                  <SeverityIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{risk.title}</span>
                    <Badge variant="outline" className="text-xs">
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {riskType.label}
                    </Badge>
                  </div>
                  {risk.description && (
                    <p className="text-xs text-slate-400 mb-2">
                      {risk.description}
                    </p>
                  )}
                  {risk.recommendation && (
                    <p className="text-xs text-amber-400/80 italic">
                      💡 {risk.recommendation}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn("text-xs", status.color)}>
                      {status.label}
                    </span>
                    {risk.status === "open" && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() =>
                            updateStatus.mutate({
                              riskId: risk.id,
                              status: "mitigated",
                            })
                          }
                        >
                          Смягчить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() =>
                            updateStatus.mutate({
                              riskId: risk.id,
                              status: "resolved",
                            })
                          }
                        >
                          Решить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() =>
                            updateStatus.mutate({
                              riskId: risk.id,
                              status: "accepted",
                            })
                          }
                        >
                          Принять
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {risks.length === 0 && statusFilter !== "all" && (
          <div className="text-center py-8 text-slate-400">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Нет рисков с выбранным статусом</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="mt-2"
            >
              Показать все
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
