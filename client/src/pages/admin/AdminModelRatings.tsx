/**
 * AdminModelRatings - AI Model ratings and task assignments management
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Trophy,
  RefreshCw,
  Plus,
  Settings,
  Zap,
  Brain,
  Code,
  Sparkles,
  FileText,
  BarChart3,
  MessageSquare,
  Loader2,
  Edit,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Provider color map
const providerColors: Record<string, string> = {
  anthropic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  openai: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  google: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  meta: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  mistral: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  deepseek: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

// Rating category icons
const categoryIcons: Record<string, React.ReactNode> = {
  ratingReasoning: <Brain className="w-4 h-4" />,
  ratingCoding: <Code className="w-4 h-4" />,
  ratingCreative: <Sparkles className="w-4 h-4" />,
  ratingPlanning: <BarChart3 className="w-4 h-4" />,
  ratingDocumentation: <FileText className="w-4 h-4" />,
  ratingChat: <MessageSquare className="w-4 h-4" />,
};

// Rating category labels
const categoryLabels: Record<string, string> = {
  ratingReasoning: "Анализ",
  ratingCoding: "Код",
  ratingCreative: "Креатив",
  ratingTranslation: "Перевод",
  ratingSummarization: "Саммари",
  ratingPlanning: "Планирование",
  ratingRiskAnalysis: "Риски",
  ratingDataAnalysis: "Данные",
  ratingDocumentation: "Документы",
  ratingChat: "Чат",
};

export default function AdminModelRatings() {
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [editingRatingId, setEditingRatingId] = useState<number | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModel, setNewModel] = useState({ modelName: "", provider: "" });

  const utils = trpc.useUtils();

  // Queries
  const { data: ratings, isLoading: loadingRatings } = trpc.adminModelRatings.list.useQuery();
  const { data: assignments, isLoading: loadingAssignments } = trpc.adminModelRatings.getAssignments.useQuery();

  // Mutations
  const updateRating = trpc.adminModelRatings.update.useMutation({
    onSuccess: () => {
      utils.adminModelRatings.list.invalidate();
      toast.success("Рейтинг обновлён");
      setEditingRatingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const createRating = trpc.adminModelRatings.create.useMutation({
    onSuccess: () => {
      utils.adminModelRatings.list.invalidate();
      toast.success("Модель добавлена");
      setShowAddModel(false);
      setNewModel({ modelName: "", provider: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRating = trpc.adminModelRatings.delete.useMutation({
    onSuccess: () => {
      utils.adminModelRatings.list.invalidate();
      toast.success("Модель удалена");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAssignment = trpc.adminModelRatings.updateAssignment.useMutation({
    onSuccess: () => {
      utils.adminModelRatings.getAssignments.invalidate();
      toast.success("Назначение обновлено");
      setEditingAssignmentId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const recalculate = trpc.adminModelRatings.recalculateFromLogs.useMutation({
    onSuccess: (data) => {
      utils.adminModelRatings.list.invalidate();
      toast.success(`Метрики пересчитаны для ${data.modelsUpdated} моделей`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Define rating type
  type Rating = NonNullable<typeof ratings>[number];
  type Assignment = NonNullable<typeof assignments>[number];

  // Filter ratings by provider
  const filteredRatings = ratings?.filter((r: Rating) =>
    providerFilter === "all" || r.provider === providerFilter
  ) || [];

  // Get unique providers
  const providers: string[] = Array.from(new Set(ratings?.map((r: Rating) => r.provider) || []));

  // Rating color based on value
  const getRatingColor = (value: number | null) => {
    if (value === null) return "text-slate-500";
    if (value >= 90) return "text-emerald-400";
    if (value >= 75) return "text-amber-400";
    if (value >= 50) return "text-slate-300";
    return "text-red-400";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Рейтинги AI-моделей</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculate.mutate()}
            disabled={recalculate.isPending}
            className="border-slate-600"
          >
            {recalculate.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Пересчитать метрики
          </Button>
          <Dialog open={showAddModel} onOpenChange={setShowAddModel}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                <Plus className="w-4 h-4 mr-2" />
                Добавить модель
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Новая модель</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Название модели</Label>
                  <Input
                    value={newModel.modelName}
                    onChange={(e) => setNewModel(prev => ({ ...prev, modelName: e.target.value }))}
                    placeholder="anthropic/claude-3.5-sonnet"
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Провайдер</Label>
                  <Select
                    value={newModel.provider}
                    onValueChange={(v) => setNewModel(prev => ({ ...prev, provider: v }))}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue placeholder="Выберите провайдера" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="meta">Meta</SelectItem>
                      <SelectItem value="mistral">Mistral</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => createRating.mutate(newModel)}
                  disabled={!newModel.modelName || !newModel.provider || createRating.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {createRating.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Добавить
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Provider Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={providerFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setProviderFilter("all")}
          className={providerFilter === "all" ? "bg-amber-500 text-slate-900" : "border-slate-600"}
        >
          Все
        </Button>
        {providers.map(provider => (
          <Button
            key={provider}
            variant={providerFilter === provider ? "default" : "outline"}
            size="sm"
            onClick={() => setProviderFilter(provider)}
            className={cn(
              providerFilter === provider ? "bg-amber-500 text-slate-900" : "border-slate-600",
            )}
          >
            {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </Button>
        ))}
      </div>

      {/* Ratings Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Рейтинги моделей
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRatings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Модель</TableHead>
                  <TableHead className="text-slate-400 text-center">Общий</TableHead>
                  <TableHead className="text-slate-400 text-center">Планир</TableHead>
                  <TableHead className="text-slate-400 text-center">Анализ</TableHead>
                  <TableHead className="text-slate-400 text-center">Код</TableHead>
                  <TableHead className="text-slate-400 text-center">Креатив</TableHead>
                  <TableHead className="text-slate-400 text-center">Скорость</TableHead>
                  <TableHead className="text-slate-400 text-center">Запросы</TableHead>
                  <TableHead className="text-slate-400"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRatings.map((rating: Rating) => (
                  <TableRow key={rating.id} className="border-slate-700/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", providerColors[rating.provider] || "bg-slate-700")}>
                          {rating.provider}
                        </Badge>
                        <span className="text-white font-medium text-sm">
                          {rating.modelName.split("/").pop()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">{rating.modelName}</span>
                    </TableCell>
                    <TableCell className={cn("text-center font-bold", getRatingColor(rating.overallRating))}>
                      {rating.overallRating}
                    </TableCell>
                    <TableCell className={cn("text-center", getRatingColor(rating.ratingPlanning))}>
                      {rating.ratingPlanning}
                    </TableCell>
                    <TableCell className={cn("text-center", getRatingColor(rating.ratingReasoning))}>
                      {rating.ratingReasoning}
                    </TableCell>
                    <TableCell className={cn("text-center", getRatingColor(rating.ratingCoding))}>
                      {rating.ratingCoding}
                    </TableCell>
                    <TableCell className={cn("text-center", getRatingColor(rating.ratingCreative))}>
                      {rating.ratingCreative}
                    </TableCell>
                    <TableCell className={cn("text-center", getRatingColor(rating.speedRating))}>
                      {rating.speedRating}
                    </TableCell>
                    <TableCell className="text-center text-slate-400 text-sm">
                      {rating.totalRequests}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
                            <DialogHeader>
                              <DialogTitle className="text-white">
                                Редактировать: {rating.modelName.split("/").pop()}
                              </DialogTitle>
                            </DialogHeader>
                            <RatingEditor
                              rating={rating}
                              onSave={(updates) => updateRating.mutate({ id: rating.id, ...updates })}
                              isPending={updateRating.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          onClick={() => {
                            if (confirm(`Удалить модель ${rating.modelName}?`)) {
                              deleteRating.mutate({ id: rating.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Task Assignments */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            Назначения моделей на задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAssignments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Категория</TableHead>
                  <TableHead className="text-slate-400">Сущность</TableHead>
                  <TableHead className="text-slate-400">Модель</TableHead>
                  <TableHead className="text-slate-400">Агент</TableHead>
                  <TableHead className="text-slate-400">Тип</TableHead>
                  <TableHead className="text-slate-400"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments?.map((assignment: Assignment) => (
                  <TableRow key={assignment.id} className="border-slate-700/50">
                    <TableCell className="text-white font-medium">
                      {assignment.taskCategory}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {assignment.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {assignment.primaryModelName.split("/").pop()}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {assignment.agentName || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          assignment.isManualOverride
                            ? "border-amber-500/50 text-amber-400"
                            : "border-emerald-500/50 text-emerald-400"
                        )}
                      >
                        {assignment.isManualOverride ? "M" : "A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-800 border-slate-700">
                          <DialogHeader>
                            <DialogTitle className="text-white">
                              Редактировать: {assignment.taskCategory}
                            </DialogTitle>
                          </DialogHeader>
                          <AssignmentEditor
                            assignment={assignment}
                            models={ratings || []}
                            onSave={(updates) => updateAssignment.mutate({ id: assignment.id, ...updates })}
                            isPending={updateAssignment.isPending}
                          />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-slate-500 mt-3">
            A = Auto (по рейтингу), M = Manual Override
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Rating type for editor
interface RatingData {
  id: number;
  modelName: string;
  provider: string;
  overallRating: number | null;
  ratingReasoning: number | null;
  ratingCoding: number | null;
  ratingCreative: number | null;
  ratingPlanning: number | null;
  ratingDocumentation: number | null;
  ratingChat: number | null;
  speedRating: number | null;
  costEfficiency: number | null;
}

// Rating Editor Component
interface RatingEditorProps {
  rating: RatingData;
  onSave: (updates: Record<string, number>) => void;
  isPending: boolean;
}

function RatingEditor({ rating, onSave, isPending }: RatingEditorProps) {
  const [values, setValues] = useState({
    overallRating: rating.overallRating || 50,
    ratingReasoning: rating.ratingReasoning || 50,
    ratingCoding: rating.ratingCoding || 50,
    ratingCreative: rating.ratingCreative || 50,
    ratingPlanning: rating.ratingPlanning || 50,
    ratingDocumentation: rating.ratingDocumentation || 50,
    ratingChat: rating.ratingChat || 50,
    speedRating: rating.speedRating || 50,
    costEfficiency: rating.costEfficiency || 50,
  });

  const categories = [
    { key: "overallRating", label: "Общий рейтинг", icon: <Trophy className="w-4 h-4" /> },
    { key: "ratingReasoning", label: "Анализ/Логика", icon: <Brain className="w-4 h-4" /> },
    { key: "ratingCoding", label: "Код", icon: <Code className="w-4 h-4" /> },
    { key: "ratingCreative", label: "Креатив", icon: <Sparkles className="w-4 h-4" /> },
    { key: "ratingPlanning", label: "Планирование", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "ratingDocumentation", label: "Документы", icon: <FileText className="w-4 h-4" /> },
    { key: "ratingChat", label: "Чат", icon: <MessageSquare className="w-4 h-4" /> },
    { key: "speedRating", label: "Скорость", icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4 pt-4">
      {categories.map(cat => (
        <div key={cat.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 flex items-center gap-2">
              {cat.icon}
              {cat.label}
            </Label>
            <span className="text-amber-400 font-bold">{values[cat.key as keyof typeof values]}</span>
          </div>
          <Slider
            value={[values[cat.key as keyof typeof values]]}
            onValueChange={([v]) => setValues(prev => ({ ...prev, [cat.key]: v }))}
            min={0}
            max={100}
            step={1}
            className="[&_[role=slider]]:bg-amber-500"
          />
        </div>
      ))}
      <Button
        onClick={() => onSave(values)}
        disabled={isPending}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 mt-4"
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
        Сохранить
      </Button>
    </div>
  );
}

// Assignment type for editor
interface AssignmentData {
  id: number;
  taskCategory: string;
  entityType: string | null;
  primaryModelName: string;
  fallbackModelName: string | null;
  agentId: number | null;
  skillId: number | null;
  isManualOverride: boolean | null;
}

// Assignment Editor Component
interface AssignmentEditorProps {
  assignment: AssignmentData;
  models: RatingData[];
  onSave: (updates: Record<string, unknown>) => void;
  isPending: boolean;
}

function AssignmentEditor({ assignment, models, onSave, isPending }: AssignmentEditorProps) {
  const [values, setValues] = useState({
    primaryModelName: assignment.primaryModelName,
    fallbackModelName: assignment.fallbackModelName || "",
    isManualOverride: assignment.isManualOverride || false,
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Основная модель</Label>
        <Select
          value={values.primaryModelName}
          onValueChange={(v) => setValues(prev => ({ ...prev, primaryModelName: v }))}
        >
          <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {models.map(m => (
              <SelectItem key={m.id} value={m.modelName}>
                {m.modelName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Fallback модель</Label>
        <Select
          value={values.fallbackModelName}
          onValueChange={(v) => setValues(prev => ({ ...prev, fallbackModelName: v }))}
        >
          <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
            <SelectValue placeholder="Не выбрана" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="">Не выбрана</SelectItem>
            {models.map(m => (
              <SelectItem key={m.id} value={m.modelName}>
                {m.modelName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="manualOverride"
          checked={values.isManualOverride}
          onChange={(e) => setValues(prev => ({ ...prev, isManualOverride: e.target.checked }))}
          className="rounded border-slate-600 bg-slate-900 text-amber-500"
        />
        <Label htmlFor="manualOverride" className="text-slate-300">
          Manual Override (не переопределяется авто-рейтингом)
        </Label>
      </div>

      <Button
        onClick={() => onSave(values)}
        disabled={isPending}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 mt-4"
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
        Сохранить
      </Button>
    </div>
  );
}
