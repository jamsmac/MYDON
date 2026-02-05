import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Download,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface ExecutiveSummaryProps {
  projectId: number;
  projectName: string;
  className?: string;
}

interface SummaryData {
  id: number;
  title: string;
  summary: string;
  keyMetrics: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    progress: number;
    blocksTotal: number;
    risksOpen: number;
  };
  achievements: string[];
  challenges: string[];
  recommendations: string[];
}

export function ExecutiveSummary({
  projectId,
  projectName,
  className,
}: ExecutiveSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const generateSummary = trpc.aiEnhancements.generateExecutiveSummary.useMutation({
    onSuccess: (data) => {
      setSummaryData(data as SummaryData);
      toast.success("Отчёт сгенерирован");
    },
    onError: () => {
      toast.error("Ошибка при генерации отчёта");
    },
  });

  const handleGenerate = () => {
    generateSummary.mutate({ projectId });
  };

  const handleExport = () => {
    if (!summaryData) return;

    const markdown = `# ${summaryData.title}

## Обзор
${summaryData.summary}

## Ключевые метрики
- Всего задач: ${summaryData.keyMetrics.totalTasks}
- Выполнено: ${summaryData.keyMetrics.completedTasks} (${summaryData.keyMetrics.progress}%)
- В работе: ${summaryData.keyMetrics.inProgressTasks}
- Просрочено: ${summaryData.keyMetrics.overdueTasks}
- Открытых рисков: ${summaryData.keyMetrics.risksOpen}

## Достижения
${summaryData.achievements.map((a) => `- ${a}`).join("\n")}

## Текущие вызовы
${summaryData.challenges.map((c) => `- ${c}`).join("\n")}

## Рекомендации
${summaryData.recommendations.map((r) => `- ${r}`).join("\n")}

---
Сгенерировано: ${new Date().toLocaleString("ru-RU")}
`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive-summary-${projectName.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Отчёт экспортирован");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          onClick={() => {
            setIsOpen(true);
            if (!summaryData) {
              handleGenerate();
            }
          }}
        >
          <FileText className="h-4 w-4" />
          Executive Summary
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Executive Summary: {projectName}
          </DialogTitle>
        </DialogHeader>

        {generateSummary.isPending ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-4" />
            <p className="text-slate-400">Генерация отчёта...</p>
          </div>
        ) : summaryData ? (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="bg-slate-800/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-500">
                    {summaryData.keyMetrics.progress}%
                  </div>
                  <div className="text-xs text-slate-400">Прогресс</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">
                    {summaryData.keyMetrics.completedTasks}/
                    {summaryData.keyMetrics.totalTasks}
                  </div>
                  <div className="text-xs text-slate-400">Задач</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-amber-500">
                    {summaryData.keyMetrics.inProgressTasks}
                  </div>
                  <div className="text-xs text-slate-400">В работе</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50">
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    "text-2xl font-bold",
                    summaryData.keyMetrics.overdueTasks > 0 ? "text-red-500" : "text-slate-400"
                  )}>
                    {summaryData.keyMetrics.overdueTasks}
                  </div>
                  <div className="text-xs text-slate-400">Просрочено</div>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <Card className="bg-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  Обзор
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{summaryData.summary}</Streamdown>
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            {summaryData.achievements.length > 0 && (
              <Card className="bg-slate-800/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Достижения
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summaryData.achievements.map((achievement, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-emerald-500">✓</span>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Challenges */}
            {summaryData.challenges.length > 0 && (
              <Card className="bg-slate-800/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Текущие вызовы
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summaryData.challenges.map((challenge, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-amber-500">!</span>
                        {challenge}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {summaryData.recommendations.length > 0 && (
              <Card className="bg-slate-800/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-500" />
                    Рекомендации
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {summaryData.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generateSummary.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить
              </Button>
              <Button variant="default" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Экспорт
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <p>Нажмите кнопку для генерации отчёта</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
