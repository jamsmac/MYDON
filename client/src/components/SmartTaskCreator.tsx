import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { PrioritySelector, PriorityBadge, type Priority } from "@/components/PriorityBadge";
import { cn } from "@/lib/utils";
import { AIDependencySuggestions } from "@/components/AIDependencySuggestions";
import { toast } from "sonner";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Plus,
  Loader2,
  Sparkles,
  Calendar,
  ListPlus,
  X,
  ChevronDown,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Target,
  Lightbulb,
} from "lucide-react";

interface SmartTaskCreatorProps {
  open: boolean;
  onClose: () => void;
  sectionId: number;
  projectId: number;
  sectionTitle?: string;
  onCreateTask: (task: {
    title: string;
    description?: string;
    priority?: Priority;
    dueDate?: number;
    dependencies?: number[];
  }) => void;
  isCreating?: boolean;
}

interface AISuggestion {
  title: string;
  description?: string;
  priority?: string;
  subtasks?: string[];
}

const QUICK_DEADLINES = [
  { label: "Сегодня", fn: () => new Date() },
  { label: "Завтра", fn: () => addDays(new Date(), 1) },
  { label: "Через 3 дня", fn: () => addDays(new Date(), 3) },
  { label: "Через неделю", fn: () => addWeeks(new Date(), 1) },
  { label: "Через 2 недели", fn: () => addWeeks(new Date(), 2) },
  { label: "Через месяц", fn: () => addMonths(new Date(), 1) },
];

export function SmartTaskCreator({
  open,
  onClose,
  sectionId,
  projectId,
  sectionTitle,
  onCreateTask,
  isCreating = false,
}: SmartTaskCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [showDescription, setShowDescription] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);
  const [selectedDependencies, setSelectedDependencies] = useState<number[]>([]);
  
  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [aiPriority, setAiPriority] = useState<{ priority: Priority; confidence: number; reason: string } | null>(null);
  const [loadingPriority, setLoadingPriority] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSuggestions = trpc.aiEnhancements.getTaskSuggestions.useMutation({
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions || []);
      setLoadingSuggestions(false);
    },
    onError: () => {
      setLoadingSuggestions(false);
    },
  });

  const detectPriority = trpc.aiEnhancements.detectPriority.useMutation({
    onSuccess: (data) => {
      setAiPriority({
        priority: data.priority as Priority,
        confidence: data.confidence,
        reason: data.reason,
      });
      setLoadingPriority(false);
    },
    onError: () => {
      setLoadingPriority(false);
    },
  });

  // Auto-detect priority when title changes
  useEffect(() => {
    if (title.length < 5) {
      setAiPriority(null);
      return;
    }
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      setLoadingPriority(true);
      detectPriority.mutate({
        title,
        description: description || undefined,
        deadline: dueDate,
      });
    }, 800);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [title]);

  // Load suggestions when dialog opens
  const handleLoadSuggestions = useCallback(() => {
    setLoadingSuggestions(true);
    getSuggestions.mutate({
      projectId,
      sectionId,
      partialTitle: title || undefined,
      context: sectionTitle,
    });
  }, [projectId, sectionId, title, sectionTitle]);

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Введите название задачи");
      return;
    }
    onCreateTask({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: priority || undefined,
      dueDate: dueDate ? dueDate.getTime() : undefined,
      dependencies: selectedDependencies.length > 0 ? selectedDependencies : undefined,
    });
  };

  const handleUseSuggestion = (suggestion: AISuggestion) => {
    setTitle(suggestion.title);
    if (suggestion.description) {
      setDescription(suggestion.description);
      setShowDescription(true);
    }
    if (suggestion.priority) {
      setPriority(suggestion.priority as Priority);
    }
    setAiSuggestions([]);
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority(null);
    setDueDate(undefined);
    setShowDescription(false);
    setShowDeadline(false);
    setAiSuggestions([]);
    setAiPriority(null);
    setSelectedDependencies([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-400" />
            Новая задача
          </DialogTitle>
          {sectionTitle && (
            <DialogDescription className="text-slate-400">
              Раздел: {sectionTitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title with AI suggestions */}
          <div className="space-y-2">
            <Label className="text-slate-300">Название задачи</Label>
            <div className="relative">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Провести исследование конкурентов"
                className="bg-slate-900 border-slate-600 text-white pr-10"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-amber-400 hover:text-amber-300"
                onClick={handleLoadSuggestions}
                disabled={loadingSuggestions}
                title="AI предложит задачи"
              >
                {loadingSuggestions ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {/* AI Suggestions dropdown */}
            {aiSuggestions.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-slate-400">AI предлагает</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-auto text-slate-500"
                    onClick={() => setAiSuggestions([])}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                      onClick={() => handleUseSuggestion(suggestion)}
                    >
                      <div className="flex items-start gap-2">
                        <Target className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{suggestion.title}</p>
                          {suggestion.description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">{suggestion.description}</p>
                          )}
                          {suggestion.subtasks && suggestion.subtasks.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <ListPlus className="w-3 h-3 text-slate-500" />
                              <span className="text-xs text-slate-500">{suggestion.subtasks.length} подзадач</span>
                            </div>
                          )}
                        </div>
                        {suggestion.priority && (
                          <PriorityBadge priority={suggestion.priority as Priority} size="sm" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Priority Suggestion */}
          {(aiPriority || loadingPriority) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
              {loadingPriority ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="text-xs text-slate-400">AI определяет приоритет...</span>
                </>
              ) : aiPriority ? (
                <>
                  <Brain className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-slate-400">AI рекомендует:</span>
                  <PriorityBadge priority={aiPriority.priority} size="sm" />
                  <span className="text-xs text-slate-500">({aiPriority.confidence}%)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs text-amber-400 hover:text-amber-300 ml-auto"
                    onClick={() => setPriority(aiPriority.priority)}
                  >
                    Применить
                  </Button>
                </>
              ) : null}
            </div>
          )}

          {/* Priority Selector */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm">Приоритет</Label>
            <PrioritySelector
              value={priority}
              onChange={(p) => setPriority(p)}
            />
          </div>

          {/* Quick Deadline Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-sm">Дедлайн</Label>
              {dueDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs text-slate-400 hover:text-red-400"
                  onClick={() => setDueDate(undefined)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Убрать
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DEADLINES.map((qd) => {
                const date = qd.fn();
                const isSelected = dueDate && format(dueDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
                return (
                  <Button
                    key={qd.label}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 text-xs border-slate-600",
                      isSelected
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                        : "text-slate-400 hover:text-white"
                    )}
                    onClick={() => setDueDate(date)}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {qd.label}
                  </Button>
                );
              })}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs border-slate-600 text-slate-400 hover:text-white"
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    {dueDate ? format(dueDate, "d MMM", { locale: ru }) : "Выбрать"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* AI Dependency Suggestions */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm">Зависимости</Label>
            <AIDependencySuggestions
              projectId={projectId}
              taskTitle={title}
              taskDescription={description || undefined}
              sectionId={sectionId}
              currentDependencies={selectedDependencies}
              onAddDependency={(depId) => {
                setSelectedDependencies(prev => [...prev, depId]);
              }}
              compact
            />
            {selectedDependencies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDependencies.map(depId => (
                  <Badge
                    key={depId}
                    variant="outline"
                    className="text-xs text-amber-400 border-amber-500/30 gap-1"
                  >
                    #{depId}
                    <button
                      onClick={() => setSelectedDependencies(prev => prev.filter(id => id !== depId))}
                      className="hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Description */}
          {!showDescription ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-300 h-7 px-2"
              onClick={() => setShowDescription(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Добавить описание
            </Button>
          ) : (
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Детальное описание задачи..."
                className="bg-slate-900 border-slate-600 text-white min-h-[80px]"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400"
            onClick={handleClose}
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Создать задачу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
