/**
 * FinalizeDecisionModal - Modal for finalizing AI conversation outcomes
 * 
 * Allows users to save AI decisions with structured data for future reference
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  Plus, 
  X, 
  AlertCircle,
  Lightbulb,
  ListTodo,
  Tag,
  Zap
} from "lucide-react";

interface KeyPoint {
  id: string;
  text: string;
  priority?: "high" | "medium" | "low";
}

interface ActionItem {
  id: string;
  title: string;
  assignee?: string;
  deadline?: string;
  status: "pending" | "done" | "cancelled";
  createSubtask?: boolean;
}

interface FinalizeDecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: string;
  aiResponse: string;
  projectId?: number;
  taskId?: string;
  blockId?: string;
  sessionId?: number;
  onFinalized?: (decisionId: number) => void;
}

const DECISION_TYPES = [
  { value: "technical", label: "🔧 Техническое", description: "Технические решения и архитектура" },
  { value: "business", label: "💼 Бизнес", description: "Бизнес-решения и стратегия" },
  { value: "design", label: "🎨 Дизайн", description: "UX/UI и визуальный дизайн" },
  { value: "process", label: "📋 Процесс", description: "Процессы и методология" },
  { value: "architecture", label: "🏗️ Архитектура", description: "Системная архитектура" },
  { value: "other", label: "📝 Другое", description: "Прочие решения" },
] as const;

const IMPORTANCE_LEVELS = [
  { value: "critical", label: "🔴 Критично", color: "bg-red-500" },
  { value: "high", label: "🟠 Высокий", color: "bg-orange-500" },
  { value: "medium", label: "🟡 Средний", color: "bg-yellow-500" },
  { value: "low", label: "🟢 Низкий", color: "bg-green-500" },
] as const;

export function FinalizeDecisionModal({
  open,
  onOpenChange,
  question,
  aiResponse,
  projectId,
  taskId,
  blockId,
  sessionId,
  onFinalized,
}: FinalizeDecisionModalProps) {
  // Form state
  const [finalDecision, setFinalDecision] = useState("");
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisionType, setDecisionType] = useState<string>("other");
  const [importance, setImportance] = useState<string>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Mutations
  const finalizeMutation = trpc.aiDecision.finalize.useMutation({
    onSuccess: (data) => {
      toast.success("Решение финализировано!", {
        description: "Оно будет учитываться в будущих AI-ответах",
      });
      onFinalized?.(data.id);
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Ошибка сохранения", {
        description: error.message,
      });
    },
  });

  const generateSummaryMutation = trpc.aiDecision.generateSummary.useMutation({
    onSuccess: (data) => {
      setFinalDecision(data.finalDecision);
      setKeyPoints(data.keyPoints || []);
      setActionItems((data.actionItems || []).map((item: { id: string; title: string; status: "pending" | "done" | "cancelled" }) => ({
        ...item,
        createSubtask: false,
      })));
      setDecisionType(data.suggestedType || "other");
      setTags(data.suggestedTags || []);
      setIsGenerating(false);
      toast.success("Анализ завершён", {
        description: "Проверьте и отредактируйте результаты",
      });
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error("Ошибка анализа", {
        description: error.message,
      });
    },
  });

  // Auto-generate summary when modal opens
  useEffect(() => {
    if (open && question && aiResponse && !finalDecision) {
      handleGenerateSummary();
    }
  }, [open]);

  const resetForm = () => {
    setFinalDecision("");
    setKeyPoints([]);
    setActionItems([]);
    setDecisionType("other");
    setImportance("medium");
    setTags([]);
    setNewTag("");
  };

  const handleGenerateSummary = () => {
    setIsGenerating(true);
    generateSummaryMutation.mutate({ question, aiResponse });
  };

  const handleFinalize = () => {
    if (!finalDecision.trim()) {
      toast.error("Введите финальное решение");
      return;
    }

    finalizeMutation.mutate({
      sessionId,
      projectId,
      taskId,
      blockId,
      question,
      aiResponse,
      finalDecision,
      keyPoints,
      actionItems: actionItems.map(({ createSubtask, ...item }) => item),
      decisionType: decisionType as "technical" | "business" | "design" | "process" | "architecture" | "other",
      tags,
      importance: importance as "critical" | "high" | "medium" | "low",
    });
  };

  // Key points management
  const addKeyPoint = () => {
    setKeyPoints([...keyPoints, { id: Date.now().toString(), text: "", priority: "medium" }]);
  };

  const updateKeyPoint = (id: string, updates: Partial<KeyPoint>) => {
    setKeyPoints(keyPoints.map(kp => kp.id === id ? { ...kp, ...updates } : kp));
  };

  const removeKeyPoint = (id: string) => {
    setKeyPoints(keyPoints.filter(kp => kp.id !== id));
  };

  // Action items management
  const addActionItem = () => {
    setActionItems([...actionItems, { 
      id: Date.now().toString(), 
      title: "", 
      status: "pending",
      createSubtask: false 
    }]);
  };

  const updateActionItem = (id: string, updates: Partial<ActionItem>) => {
    setActionItems(actionItems.map(ai => ai.id === id ? { ...ai, ...updates } : ai));
  };

  const removeActionItem = (id: string) => {
    setActionItems(actionItems.filter(ai => ai.id !== id));
  };

  // Tags management
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Финализировать итоги
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original Question Preview */}
          <div className="bg-muted/50 rounded-lg p-3 border">
            <Label className="text-xs text-muted-foreground mb-1 block">Исходный вопрос</Label>
            <p className="text-sm line-clamp-2">{question}</p>
          </div>

          {/* Final Decision */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Финальное решение
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                AI анализ
              </Button>
            </div>
            <Textarea
              value={finalDecision}
              onChange={(e) => setFinalDecision(e.target.value)}
              placeholder="Краткое резюме принятого решения..."
              className="min-h-[80px]"
            />
          </div>

          {/* Key Points */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Ключевые пункты
              </Label>
              <Button variant="ghost" size="sm" onClick={addKeyPoint}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {keyPoints.map((kp) => (
                <div key={kp.id} className="flex items-center gap-2">
                  <Select
                    value={kp.priority || "medium"}
                    onValueChange={(v) => updateKeyPoint(kp.id, { priority: v as "high" | "medium" | "low" })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 High</SelectItem>
                      <SelectItem value="medium">🟡 Med</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={kp.text}
                    onChange={(e) => updateKeyPoint(kp.id, { text: e.target.value })}
                    placeholder="Ключевой пункт..."
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeKeyPoint(kp.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {keyPoints.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Нет ключевых пунктов
                </p>
              )}
            </div>
          </div>

          {/* Action Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-blue-500" />
                Действия
              </Label>
              <Button variant="ghost" size="sm" onClick={addActionItem}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            </div>
            <div className="space-y-2">
              {actionItems.map((ai) => (
                <div key={ai.id} className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                  <Input
                    value={ai.title}
                    onChange={(e) => updateActionItem(ai.id, { title: e.target.value })}
                    placeholder="Действие..."
                    className="flex-1"
                  />
                  {taskId && (
                    <div className="flex items-center gap-1">
                      <Checkbox
                        id={`subtask-${ai.id}`}
                        checked={ai.createSubtask}
                        onCheckedChange={(checked) => 
                          updateActionItem(ai.id, { createSubtask: checked as boolean })
                        }
                      />
                      <Label htmlFor={`subtask-${ai.id}`} className="text-xs cursor-pointer">
                        Подзадача
                      </Label>
                    </div>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => removeActionItem(ai.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {actionItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Нет действий
                </p>
              )}
            </div>
          </div>

          {/* Type and Importance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Тип решения</Label>
              <Select value={decisionType} onValueChange={setDecisionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Важность</Label>
              <Select value={importance} onValueChange={setImportance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-500" />
              Теги
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Добавить тег..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-500/10 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500" />
            <p>
              Финализированные решения будут автоматически добавляться в контекст 
              будущих AI-запросов по этому проекту/задаче.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleFinalize}
            disabled={finalizeMutation.isPending || !finalDecision.trim()}
          >
            {finalizeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Финализировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FinalizeDecisionModal;
