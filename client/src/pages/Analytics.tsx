import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  BarChart3, 
  Download, 
  FileText, 
  FileSpreadsheet,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Chart components
import { BurnupChart } from "@/components/charts/BurnupChart";
import { VelocityChart } from "@/components/charts/VelocityChart";
import { BlockCompletionChart } from "@/components/charts/BlockCompletionChart";
import { ProjectedCompletion } from "@/components/charts/ProjectedCompletion";
import { PriorityDistributionChart } from "@/components/charts/PriorityDistributionChart";
import { CompletionTimeHistogram } from "@/components/charts/CompletionTimeHistogram";
import { PlanVsActualChart } from "@/components/charts/PlanVsActualChart";
import { TopLongestTasks } from "@/components/charts/TopLongestTasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Analytics() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const projectId = parseInt(params.id || "0");
  
  const { data: project, isLoading: projectLoading } = trpc.project.get.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );
  
  const utils = trpc.useUtils();
  
  const pdfExport = trpc.analyticsExport.generatePdfReport.useMutation({
    onSuccess: (data) => {
      // Create and download file
      const blob = new Blob([data.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Отчёт успешно сгенерирован");
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    }
  });
  
  const excelExport = trpc.analyticsExport.generateExcelData.useMutation({
    onSuccess: (data) => {
      // Create and download CSV file
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано ${data.rowCount} записей`);
    },
    onError: (error) => {
      toast.error(`Ошибка: ${error.message}`);
    }
  });
  
  const handleRefresh = () => {
    utils.analytics.invalidate();
    toast.success("Данные обновлены");
  };
  
  const handleExportPdf = () => {
    pdfExport.mutate({
      projectId,
      includeCharts: true,
      includeTaskList: true,
      includeBlockDetails: true,
    });
  };
  
  const handleExportExcel = () => {
    excelExport.mutate({
      projectId,
      includeSubtasks: false,
    });
  };
  
  if (projectLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Проект не найден</p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            На главную
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation(`/project/${projectId}`)}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Аналитика
                </h1>
                <p className="text-sm text-slate-400">{project.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="border-slate-700 text-slate-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Обновить
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Экспорт
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                  <DropdownMenuItem 
                    onClick={handleExportPdf}
                    disabled={pdfExport.isPending}
                    className="text-slate-300 focus:bg-slate-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {pdfExport.isPending ? "Генерация..." : "Отчёт (Markdown)"}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleExportExcel}
                    disabled={excelExport.isPending}
                    className="text-slate-300 focus:bg-slate-700"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {excelExport.isPending ? "Экспорт..." : "Данные (CSV)"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container py-6">
        {/* Progress Dashboard */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Прогресс проекта</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BurnupChart projectId={projectId} />
            <VelocityChart projectId={projectId} />
          </div>
        </section>
        
        {/* Completion & Projection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Завершение и прогноз</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BlockCompletionChart projectId={projectId} />
            </div>
            <ProjectedCompletion projectId={projectId} />
          </div>
        </section>
        
        {/* Statistics */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Статистика задач</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PriorityDistributionChart projectId={projectId} />
            <CompletionTimeHistogram projectId={projectId} />
          </div>
        </section>
        
        {/* Plan vs Actual & Top Tasks */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Анализ выполнения</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlanVsActualChart projectId={projectId} />
            <TopLongestTasks projectId={projectId} />
          </div>
        </section>
      </main>
    </div>
  );
}
