/**
 * Decision Log Dashboard - View all finalized AI decisions
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  Search, Download, Calendar, List, LayoutGrid, Brain, Sparkles,
  CheckCircle2, Clock, Archive, AlertTriangle, ChevronRight, FileText,
  Tag, Loader2, RefreshCw, MoreVertical, Trash2, Eye
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const TYPE_CONFIG = {
  technical: { label: "Техническое", icon: "🔧", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  business: { label: "Бизнес", icon: "💼", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  design: { label: "Дизайн", icon: "🎨", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  process: { label: "Процесс", icon: "📋", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  architecture: { label: "Архитектура", icon: "🏗️", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  other: { label: "Другое", icon: "📝", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

const STATUS_CONFIG = {
  active: { label: "Активное", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500" },
  implemented: { label: "Реализовано", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-500" },
  obsolete: { label: "Устарело", icon: Archive, color: "bg-slate-500/10 text-slate-500" },
  superseded: { label: "Заменено", icon: RefreshCw, color: "bg-amber-500/10 text-amber-500" },
};

const IMPORTANCE_CONFIG = {
  critical: { label: "Критично", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  high: { label: "Высокий", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  medium: { label: "Средний", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  low: { label: "Низкий", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

type ViewMode = "list" | "grid" | "timeline";
type DecisionType = "technical" | "business" | "design" | "process" | "architecture" | "other";
type DecisionStatus = "active" | "implemented" | "obsolete" | "superseded";
type Importance = "critical" | "high" | "medium" | "low";

interface KeyPoint { id: string; text: string; priority?: "high" | "medium" | "low"; }
interface ActionItem { id: string; title: string; status: "pending" | "done" | "cancelled"; }
interface Decision {
  id: number; question: string; aiResponse: string; finalDecision: string;
  keyPoints: KeyPoint[]; actionItems: ActionItem[]; decisionType: DecisionType | null;
  tags: string[]; importance: Importance | null; status: DecisionStatus | null;
  createdAt: Date | null;
}

export default function DecisionLogDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<DecisionType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<DecisionStatus | "all">("all");
  const [filterImportance, setFilterImportance] = useState<Importance | "all">("all");
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: decisions, isLoading, refetch } = trpc.aiDecision.getDecisions.useQuery({
    limit: 100,
    status: filterStatus !== "all" ? filterStatus : undefined,
    decisionType: filterType !== "all" ? filterType : undefined,
  });

  const { data: stats } = trpc.aiDecision.getStats.useQuery({});

  const updateMutation = trpc.aiDecision.updateDecision.useMutation({
    onSuccess: () => { toast.success("Решение обновлено"); refetch(); },
    onError: (error) => { toast.error("Ошибка", { description: error.message }); },
  });

  const deleteMutation = trpc.aiDecision.deleteDecision.useMutation({
    onSuccess: () => { toast.success("Решение удалено"); refetch(); setIsDetailOpen(false); },
    onError: (error) => { toast.error("Ошибка", { description: error.message }); },
  });

  const filteredDecisions = useMemo(() => {
    if (!decisions) return [];
    return decisions.filter((d) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches = d.question.toLowerCase().includes(query) ||
          d.finalDecision.toLowerCase().includes(query) ||
          d.aiResponse.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (filterImportance !== "all" && d.importance !== filterImportance) return false;
      return true;
    });
  }, [decisions, searchQuery, filterImportance]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Decision[]> = {};
    filteredDecisions.forEach((d) => {
      const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString("ru-RU", {
        year: "numeric", month: "long", day: "numeric",
      }) : "Без даты";
      if (!groups[date]) groups[date] = [];
      groups[date].push(d as Decision);
    });
    return groups;
  }, [filteredDecisions]);

  const exportAsMarkdown = () => {
    if (!filteredDecisions.length) { toast.error("Нет решений для экспорта"); return; }
    let md = "# Журнал AI Решений\n\n";
    md += `Экспортировано: ${new Date().toLocaleDateString("ru-RU")}\n\n`;
    filteredDecisions.forEach((d, i) => {
      const tc = TYPE_CONFIG[d.decisionType || "other"];
      md += `## ${i + 1}. ${d.finalDecision.substring(0, 80)}\n`;
      md += `**Тип:** ${tc.icon} ${tc.label}\n`;
      md += `### Вопрос\n${d.question}\n\n`;
      md += `### Решение\n${d.finalDecision}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-decisions-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Экспорт завершён");
  };

  const handleStatusChange = (id: number, status: DecisionStatus) => updateMutation.mutate({ id, status });
  const handleDelete = (id: number) => { if (confirm("Удалить это решение?")) deleteMutation.mutate({ id }); };

  const renderCard = (d: Decision) => {
    const tc = TYPE_CONFIG[d.decisionType || "other"];
    const sc = STATUS_CONFIG[d.status || "active"];
    const ic = IMPORTANCE_CONFIG[d.importance || "medium"];
    const SI = sc.icon;
    return (
      <Card key={d.id} className="cursor-pointer hover:shadow-md hover:border-purple-500/30"
        onClick={() => { setSelectedDecision(d); setIsDetailOpen(true); }}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs", tc.color)}>{tc.icon} {tc.label}</Badge>
              <Badge variant="outline" className={cn("text-xs", sc.color)}><SI className="h-3 w-3 mr-1" />{sc.label}</Badge>
              <Badge variant="outline" className={cn("text-xs", ic.color)}>{ic.label}</Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDecision(d); setIsDetailOpen(true); }}>
                  <Eye className="h-4 w-4 mr-2" />Просмотр
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(d.id, "implemented"); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />Реализовано
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(d.id, "obsolete"); }}>
                  <Archive className="h-4 w-4 mr-2" />Устарело
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CardTitle className="text-base line-clamp-2 mt-2">{d.finalDecision}</CardTitle>
          <CardDescription className="line-clamp-2">{d.question}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {d.keyPoints && (d.keyPoints as KeyPoint[]).length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Ключевые пункты:</p>
              <ul className="text-xs space-y-1">
                {(d.keyPoints as KeyPoint[]).slice(0, 2).map((kp) => (
                  <li key={kp.id} className="flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <span className="line-clamp-1">{kp.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.tags && (d.tags as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {(d.tags as string[]).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs"><Tag className="h-2.5 w-2.5 mr-1" />{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {d.createdAt ? new Date(d.createdAt).toLocaleDateString("ru-RU") : "—"}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-r from-purple-600/5 to-indigo-600/5">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Журнал AI Решений</h1>
                <p className="text-muted-foreground">Все финализированные решения</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Обновить</Button>
              <Button onClick={exportAsMarkdown}><Download className="h-4 w-4 mr-2" />Экспорт</Button>
            </div>
          </div>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <Card className="bg-background/50"><CardContent className="pt-4">
                <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" />
                  <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Всего</p></div>
                </div>
              </CardContent></Card>
              <Card className="bg-background/50"><CardContent className="pt-4">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div><p className="text-2xl font-bold">{stats.byStatus?.active || 0}</p><p className="text-xs text-muted-foreground">Активных</p></div>
                </div>
              </CardContent></Card>
              <Card className="bg-background/50"><CardContent className="pt-4">
                <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" />
                  <div><p className="text-2xl font-bold">{stats.byStatus?.implemented || 0}</p><p className="text-xs text-muted-foreground">Реализовано</p></div>
                </div>
              </CardContent></Card>
              <Card className="bg-background/50"><CardContent className="pt-4">
                <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />
                  <div><p className="text-2xl font-bold">{stats.byImportance?.critical || 0}</p><p className="text-xs text-muted-foreground">Критичных</p></div>
                </div>
              </CardContent></Card>
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-border bg-background/50 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as DecisionType | "all")}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Тип" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {Object.entries(TYPE_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as DecisionStatus | "all")}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterImportance} onValueChange={(v) => setFilterImportance(v as Importance | "all")}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Важность" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любая</SelectItem>
                {Object.entries(IMPORTANCE_CONFIG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
              <Button variant={viewMode === "timeline" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("timeline")}><Calendar className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-500" /></div>
        ) : filteredDecisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4"><FileText className="h-8 w-8 text-muted-foreground" /></div>
            <h3 className="font-semibold text-lg mb-2">Нет решений</h3>
            <p className="text-muted-foreground max-w-md">Финализируйте AI ответы, чтобы они появились здесь</p>
          </div>
        ) : viewMode === "timeline" ? (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([date, decs]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Calendar className="h-4 w-4 text-purple-500" /></div>
                  <h2 className="font-semibold">{date}</h2>
                  <Badge variant="secondary">{decs.length}</Badge>
                </div>
                <div className="ml-4 border-l-2 border-border pl-6 space-y-4">{decs.map(renderCard)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4")}>
            {filteredDecisions.map((d) => renderCard(d as Decision))}
          </div>
        )}
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedDecision && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant="outline" className={cn("text-xs", TYPE_CONFIG[selectedDecision.decisionType || "other"].color)}>
                    {TYPE_CONFIG[selectedDecision.decisionType || "other"].icon} {TYPE_CONFIG[selectedDecision.decisionType || "other"].label}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", STATUS_CONFIG[selectedDecision.status || "active"].color)}>
                    {STATUS_CONFIG[selectedDecision.status || "active"].label}
                  </Badge>
                </div>
                <DialogTitle>{selectedDecision.finalDecision}</DialogTitle>
                <DialogDescription>
                  {selectedDecision.createdAt ? new Date(selectedDecision.createdAt).toLocaleDateString("ru-RU", {
                    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  }) : "—"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" />Вопрос</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedDecision.question}</p>
                  </div>
                  {selectedDecision.keyPoints && (selectedDecision.keyPoints as KeyPoint[]).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Ключевые пункты</h4>
                      <ul className="space-y-2">
                        {(selectedDecision.keyPoints as KeyPoint[]).map((kp) => (
                          <li key={kp.id} className="flex items-start gap-2 text-sm">
                            <Badge variant="outline" className="text-xs mt-0.5">•</Badge>
                            <span>{kp.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Полный ответ AI</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4">
                      <Streamdown>{selectedDecision.aiResponse}</Streamdown>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(selectedDecision.id, "implemented")} disabled={selectedDecision.status === "implemented"}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />Реализовано
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(selectedDecision.id, "obsolete")} disabled={selectedDecision.status === "obsolete"}>
                    <Archive className="h-4 w-4 mr-2" />Устарело
                  </Button>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedDecision.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />Удалить
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
