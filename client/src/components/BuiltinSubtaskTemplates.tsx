import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  BarChart3,
  FileText,
  Eye,
  TestTube2,
  Loader2,
  Sparkles,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

type TemplateKey = "research" | "analysis" | "documentation" | "review" | "testing";

interface BuiltinTemplate {
  key: TemplateKey;
  title: string;
  titleRu: string;
  icon: typeof Search;
  color: string;
  bgColor: string;
  borderColor: string;
  items: string[];
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: "research",
    title: "Research",
    titleRu: "Исследование",
    icon: Search,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    items: [
      "Определить цели и вопросы исследования",
      "Собрать данные из открытых источников",
      "Провести интервью / опросы",
      "Проанализировать конкурентов",
      "Составить отчёт с выводами",
      "Подготовить презентацию результатов",
    ],
  },
  {
    key: "analysis",
    title: "Analysis",
    titleRu: "Анализ",
    icon: BarChart3,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    items: [
      "Определить метрики и KPI для анализа",
      "Собрать и подготовить данные",
      "Провести количественный анализ",
      "Провести качественный анализ",
      "Выявить тренды и паттерны",
      "Сформулировать рекомендации",
      "Оформить аналитический отчёт",
    ],
  },
  {
    key: "documentation",
    title: "Documentation",
    titleRu: "Документация",
    icon: FileText,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    items: [
      "Определить структуру документа",
      "Написать введение и обзор",
      "Описать основные разделы",
      "Добавить примеры и иллюстрации",
      "Провести вычитку и редактуру",
      "Согласовать с заинтересованными сторонами",
      "Опубликовать финальную версию",
    ],
  },
  {
    key: "review",
    title: "Review",
    titleRu: "Ревью",
    icon: Eye,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    items: [
      "Ознакомиться с материалом / кодом",
      "Проверить соответствие требованиям",
      "Оценить качество и полноту",
      "Составить список замечаний",
      "Обсудить замечания с автором",
      "Проверить исправления",
      "Утвердить результат",
    ],
  },
  {
    key: "testing",
    title: "Testing",
    titleRu: "Тестирование",
    icon: TestTube2,
    color: "text-rose-400",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    items: [
      "Составить тест-план",
      "Подготовить тестовые данные",
      "Провести функциональное тестирование",
      "Провести регрессионное тестирование",
      "Проверить граничные случаи",
      "Зафиксировать найденные баги",
      "Провести повторное тестирование после исправлений",
      "Подготовить отчёт о тестировании",
    ],
  },
];

interface BuiltinSubtaskTemplatesProps {
  taskId: number;
  onApplied: () => void;
  compact?: boolean;
}

export function BuiltinSubtaskTemplates({
  taskId,
  onApplied,
  compact = false,
}: BuiltinSubtaskTemplatesProps) {
  const [loadingKey, setLoadingKey] = useState<TemplateKey | null>(null);
  const [previewKey, setPreviewKey] = useState<TemplateKey | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const utils = trpc.useUtils();

  const applyBuiltin = trpc.subtask.applyBuiltinTemplate.useMutation({
    onSuccess: (data) => {
      toast.success(`Шаблон «${data.templateTitle}» применён (${data.count} подзадач)`);
      utils.subtask.list.invalidate({ taskId });
      onApplied();
      setLoadingKey(null);
      setPopoverOpen(false);
    },
    onError: (error) => {
      toast.error("Ошибка: " + error.message);
      setLoadingKey(null);
    },
  });

  const handleApply = (key: TemplateKey) => {
    setLoadingKey(key);
    applyBuiltin.mutate({ taskId, templateKey: key });
  };

  const previewTemplate = previewKey
    ? BUILTIN_TEMPLATES.find((t) => t.key === previewKey)
    : null;

  if (compact) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5 border-slate-600 text-slate-400 hover:text-white"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Быстрые шаблоны
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80 p-0 bg-slate-800 border-slate-700"
          align="end"
        >
          <div className="px-3 py-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">
                Быстрые шаблоны подзадач
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Выберите шаблон для автоматического создания подзадач
            </p>
          </div>

          {/* Template list or preview */}
          {previewTemplate ? (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-slate-400"
                  onClick={() => setPreviewKey(null)}
                >
                  ← Назад
                </Button>
                <span className="text-sm font-medium text-white">
                  {previewTemplate.titleRu}
                </span>
              </div>
              <div className="space-y-1.5 mb-3">
                {previewTemplate.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => handleApply(previewTemplate.key)}
                disabled={loadingKey !== null}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 h-8 text-sm"
              >
                {loadingKey === previewTemplate.key ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Применить ({previewTemplate.items.length} подзадач)
              </Button>
            </div>
          ) : (
            <div className="p-2">
              {BUILTIN_TEMPLATES.map((template) => {
                const Icon = template.icon;
                const isLoading = loadingKey === template.key;
                return (
                  <div
                    key={template.key}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50 transition-colors group"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        template.bgColor
                      )}
                    >
                      <Icon className={cn("w-4 h-4", template.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium">
                        {template.titleRu}
                      </div>
                      <div className="text-xs text-slate-500">
                        {template.items.length} подзадач
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                        onClick={() => setPreviewKey(template.key)}
                      >
                        Просмотр
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        onClick={() => handleApply(template.key)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Применить"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Full-size variant (for empty state)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-slate-300">
          Быстрые шаблоны
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {BUILTIN_TEMPLATES.map((template) => {
          const Icon = template.icon;
          const isLoading = loadingKey === template.key;
          return (
            <button
              key={template.key}
              onClick={() => handleApply(template.key)}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                "hover:scale-[1.01] active:scale-[0.99]",
                template.borderColor,
                template.bgColor,
                "hover:brightness-110"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  "bg-slate-800/50"
                )}
              >
                {isLoading ? (
                  <Loader2 className={cn("w-5 h-5 animate-spin", template.color)} />
                ) : (
                  <Icon className={cn("w-5 h-5", template.color)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200">
                  {template.titleRu}
                </div>
                <div className="text-xs text-slate-500">
                  {template.items.length} подзадач: {template.items.slice(0, 2).join(", ")}...
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs flex-shrink-0", template.borderColor, template.color)}
              >
                {template.items.length}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
