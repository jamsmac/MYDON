import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Link2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Brain,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";

interface DependencySuggestion {
  taskId: number;
  taskTitle: string;
  taskStatus: string;
  section: string;
  block: string;
  reason: string;
  confidence: number;
}

interface AIDependencySuggestionsProps {
  projectId: number;
  taskId?: number;
  taskTitle: string;
  taskDescription?: string;
  sectionId?: number;
  currentDependencies: number[];
  onAddDependency: (taskId: number) => void;
  compact?: boolean; // For SmartTaskCreator (compact mode)
}

export function AIDependencySuggestions({
  projectId,
  taskId,
  taskTitle,
  taskDescription,
  sectionId,
  currentDependencies,
  onAddDependency,
  compact = false,
}: AIDependencySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<DependencySuggestion[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());

  const suggestDeps = trpc.aiEnhancements.suggestDependencies.useMutation({
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setReasoning(data.reasoning || "");
      setDismissedIds(new Set());
      setAcceptedIds(new Set());
    },
    onError: () => {
      toast.error("Не удалось получить AI-подсказки");
    },
  });

  const handleAnalyze = () => {
    if (!taskTitle.trim()) {
      toast.error("Введите название задачи для анализа");
      return;
    }
    suggestDeps.mutate({
      projectId,
      taskId,
      taskTitle,
      taskDescription,
      sectionId,
      currentDependencies,
    });
  };

  const handleAccept = (suggestion: DependencySuggestion) => {
    onAddDependency(suggestion.taskId);
    setAcceptedIds(prev => { const next = new Set(Array.from(prev)); next.add(suggestion.taskId); return next; });
    toast.success(`Зависимость "${suggestion.taskTitle}" добавлена`);
  };

  const handleDismiss = (taskId: number) => {
    setDismissedIds(prev => { const next = new Set(Array.from(prev)); next.add(taskId); return next; });
  };

  const handleAcceptAll = () => {
    const remaining = suggestions.filter(
      s => !dismissedIds.has(s.taskId) && !acceptedIds.has(s.taskId)
    );
    remaining.forEach(s => {
      onAddDependency(s.taskId);
      setAcceptedIds(prev => { const next = new Set(Array.from(prev)); next.add(s.taskId); return next; });
    });
    toast.success(`Добавлено ${remaining.length} зависимостей`);
  };

  const visibleSuggestions = suggestions.filter(
    s => !dismissedIds.has(s.taskId) && !acceptedIds.has(s.taskId)
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (confidence >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === "in_progress") return <Clock className="w-3.5 h-3.5 text-blue-400" />;
    return <Clock className="w-3.5 h-3.5 text-slate-500" />;
  };

  // Compact mode for SmartTaskCreator
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-600 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 px-2.5 text-xs"
            onClick={handleAnalyze}
            disabled={suggestDeps.isPending || !taskTitle.trim()}
          >
            {suggestDeps.isPending ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Link2 className="w-3 h-3 mr-1" />
            )}
            AI зависимости
          </Button>
          {acceptedIds.size > 0 && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs h-5">
              <Check className="w-3 h-3 mr-1" />
              {acceptedIds.size} добавлено
            </Badge>
          )}
        </div>

        {visibleSuggestions.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-slate-400 flex-1">AI рекомендует зависимости</span>
              {visibleSuggestions.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs text-emerald-400 hover:text-emerald-300"
                  onClick={handleAcceptAll}
                >
                  Принять все
                </Button>
              )}
            </div>
            <div className="max-h-[180px] overflow-y-auto">
              {visibleSuggestions.map((s) => (
                <div
                  key={s.taskId}
                  className="px-3 py-2 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-800/30"
                >
                  <div className="flex items-start gap-2">
                    {getStatusIcon(s.taskStatus)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{s.taskTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.reason}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] h-4 px-1", getConfidenceColor(s.confidence))}>
                        {s.confidence}%
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => handleAccept(s)}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDismiss(s.taskId)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && visibleSuggestions.length === 0 && (
          <p className="text-xs text-slate-500 italic">Все предложения обработаны</p>
        )}
      </div>
    );
  }

  // Full mode for TaskDetailPanel
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          onClick={handleAnalyze}
          disabled={suggestDeps.isPending || !taskTitle.trim()}
        >
          {suggestDeps.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          AI подсказки зависимостей
        </Button>
        {acceptedIds.size > 0 && (
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
            <Check className="w-3 h-3 mr-1" />
            {acceptedIds.size} добавлено
          </Badge>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
          {/* Header */}
          <div
            className="px-3 py-2.5 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Brain className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-300 flex-1 font-medium">
              AI анализ зависимостей
            </span>
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
              {visibleSuggestions.length} из {suggestions.length}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>

          {isExpanded && (
            <>
              {/* Reasoning */}
              {reasoning && (
                <div className="px-3 py-2 bg-slate-800/30 border-b border-slate-700/50 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-400 leading-relaxed">{reasoning}</p>
                </div>
              )}

              {/* Accept All button */}
              {visibleSuggestions.length > 1 && (
                <div className="px-3 py-2 border-b border-slate-700/50 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-3 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={handleAcceptAll}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Принять все ({visibleSuggestions.length})
                  </Button>
                </div>
              )}

              {/* Suggestions list */}
              <div className="max-h-[300px] overflow-y-auto">
                {visibleSuggestions.map((s) => (
                  <div
                    key={s.taskId}
                    className="px-3 py-3 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(s.taskStatus)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-slate-200 font-medium truncate">{s.taskTitle}</p>
                          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", getConfidenceColor(s.confidence))}>
                            {s.confidence}%
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mb-1.5">{s.reason}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                          <span>{s.block}</span>
                          <span>→</span>
                          <span>{s.section}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded",
                            s.taskStatus === "completed" ? "bg-emerald-500/10 text-emerald-500" :
                            s.taskStatus === "in_progress" ? "bg-blue-500/10 text-blue-500" :
                            "bg-slate-500/10 text-slate-500"
                          )}>
                            {s.taskStatus === "completed" ? "Завершена" :
                             s.taskStatus === "in_progress" ? "В работе" : "Не начата"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => handleAccept(s)}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Принять
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDismiss(s.taskId)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {visibleSuggestions.length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Все предложения обработаны</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {suggestDeps.isPending && (
        <div className="flex items-center gap-2 px-3 py-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-sm text-slate-400">AI анализирует зависимости проекта...</span>
        </div>
      )}
    </div>
  );
}
