import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSuggestion {
  title: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  subtasks?: string[];
}

interface SmartSuggestionsProps {
  projectId: number;
  sectionId: number;
  partialTitle?: string;
  onSelectSuggestion: (suggestion: TaskSuggestion) => void;
  className?: string;
}

const priorityColors = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function SmartSuggestions({
  projectId,
  sectionId,
  partialTitle,
  onSelectSuggestion,
  className,
}: SmartSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);

  const getSuggestions = trpc.aiEnhancements.getTaskSuggestions.useMutation({
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setIsExpanded(true);
    },
  });

  const handleGetSuggestions = () => {
    getSuggestions.mutate({
      projectId,
      sectionId,
      partialTitle,
    });
  };

  if (suggestions.length === 0 && !getSuggestions.isPending) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleGetSuggestions}
        className={cn("text-amber-500 hover:text-amber-400", className)}
      >
        <Sparkles className="h-4 w-4 mr-2" />
        AI Предложения
      </Button>
    );
  }

  return (
    <Card className={cn("bg-slate-800/50 border-amber-500/20", className)}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Предложения
          </CardTitle>
          <div className="flex items-center gap-2">
            {getSuggestions.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuggestions([])}
              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="py-2 px-4 space-y-2">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-amber-500/30 transition-colors cursor-pointer group"
              onClick={() => onSelectSuggestion(suggestion)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {suggestion.title}
                    </span>
                    {suggestion.priority && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          priorityColors[suggestion.priority]
                        )}
                      >
                        {suggestion.priority}
                      </Badge>
                    )}
                  </div>
                  {suggestion.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {suggestion.description}
                    </p>
                  )}
                  {suggestion.subtasks && suggestion.subtasks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestion.subtasks.slice(0, 3).map((subtask, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400"
                        >
                          {subtask}
                        </span>
                      ))}
                      {suggestion.subtasks.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{suggestion.subtasks.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Check className="h-4 w-4 text-emerald-500" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={handleGetSuggestions}
            disabled={getSuggestions.isPending}
            className="w-full mt-2 border-dashed"
          >
            {getSuggestions.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Обновить предложения
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
