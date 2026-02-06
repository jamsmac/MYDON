/**
 * AdminModelCosts - AI model pricing management
 * Inline editing for model costs with plan restrictions
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Save,
  RefreshCw,
  Bot,
  Coins,
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
} from "lucide-react";

export default function AdminModelCosts() {
  const [hasChanges, setHasChanges] = useState(false);
  const [editedModels, setEditedModels] = useState<Record<number, {
    inputCost: number;
    outputCost: number;
    isEnabled: boolean;
    allowedPlans: string[];
  }>>({});

  // Queries
  const { data: models, isLoading, refetch } = trpc.adminPricing.getModelPricing.useQuery();
  const { data: plans } = trpc.adminPricing.getPlans.useQuery();

  // Initialize edited models from data
  useEffect(() => {
    if (models) {
      const initial: typeof editedModels = {};
      models.forEach((model) => {
        initial[model.id] = {
          inputCost: parseFloat(model.inputCostPer1K) || 0,
          outputCost: parseFloat(model.outputCostPer1K) || 0,
          isEnabled: model.isEnabled ?? true,
          allowedPlans: (model.planRestrictions as any)?.allowedPlanIds?.map(String) || [],
        };
      });
      setEditedModels(initial);
    }
  }, [models]);

  // Mutation
  const updateMutation = trpc.adminPricing.updateModelPricing.useMutation({
    onSuccess: () => {
      toast.success("Стоимость моделей обновлена");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = async () => {
    // Update each model individually
    for (const [id, data] of Object.entries(editedModels)) {
      await updateMutation.mutateAsync({
        modelId: parseInt(id),
        inputCostPer1K: data.inputCost.toString(),
        outputCostPer1K: data.outputCost.toString(),
        isEnabled: data.isEnabled,
      });
    }
  };

  const handleInputChange = (modelId: number, field: 'inputCost' | 'outputCost', value: number) => {
    setEditedModels(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleToggleEnabled = (modelId: number) => {
    setEditedModels(prev => ({
      ...prev,
      [modelId]: { ...prev[modelId], isEnabled: !prev[modelId].isEnabled },
    }));
    setHasChanges(true);
  };

  const handleTogglePlan = (modelId: number, planName: string) => {
    setEditedModels(prev => {
      const current = prev[modelId].allowedPlans;
      const newPlans = current.includes(planName)
        ? current.filter(p => p !== planName)
        : [...current, planName];
      return {
        ...prev,
        [modelId]: { ...prev[modelId], allowedPlans: newPlans },
      };
    });
    setHasChanges(true);
  };

  const getProviderBadge = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case "openai":
        return <Badge className="bg-emerald-500">OpenAI</Badge>;
      case "anthropic":
        return <Badge className="bg-amber-500">Anthropic</Badge>;
      case "google":
        return <Badge className="bg-blue-500">Google</Badge>;
      default:
        return <Badge variant="outline">{provider}</Badge>;
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "premium":
        return <Crown className="w-4 h-4 text-amber-500" />;
      case "standard":
        return <Sparkles className="w-4 h-4 text-blue-500" />;
      default:
        return <Zap className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Стоимость моделей</h1>
            <p className="text-muted-foreground">
              Настройка цен за использование AI моделей
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего моделей</CardTitle>
              <Bot className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{models?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Активных</CardTitle>
              <Check className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(editedModels).filter(m => m.isEnabled).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Средняя стоимость</CardTitle>
              <Coins className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(editedModels).length > 0
                  ? (Object.values(editedModels).reduce((sum, m) => sum + m.inputCost + m.outputCost, 0) / 
                     (Object.values(editedModels).length * 2)).toFixed(2)
                  : 0
                } кр/1K
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Models Table */}
        <Card>
          <CardHeader>
            <CardTitle>Таблица стоимости</CardTitle>
            <CardDescription>
              Редактируйте стоимость прямо в таблице. Изменения применятся после сохранения.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Модель</TableHead>
                  <TableHead>Провайдер</TableHead>
                  <TableHead>Уровень</TableHead>
                  <TableHead className="text-right">Input (кр/1K)</TableHead>
                  <TableHead className="text-right">Output (кр/1K)</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead>Доступно в тарифах</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                    </TableRow>
                  ))
                ) : models?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Модели не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  models?.map((model) => (
                    <TableRow key={model.id} className={!editedModels[model.id]?.isEnabled ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{model.modelDisplayName || model.modelName}</div>
                            <div className="text-xs text-muted-foreground">{model.modelName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getProviderBadge(model.provider || "")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTierIcon((model as any).tier || "")}
                          <span className="capitalize">{(model as any).tier || "basic"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={editedModels[model.id]?.inputCost ?? parseFloat(model.inputCostPer1K) ?? 0}
                          onChange={(e) => handleInputChange(model.id, 'inputCost', parseFloat(e.target.value) || 0)}
                          className="w-[80px] text-right ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={editedModels[model.id]?.outputCost ?? parseFloat(model.outputCostPer1K) ?? 0}
                          onChange={(e) => handleInputChange(model.id, 'outputCost', parseFloat(e.target.value) || 0)}
                          className="w-[80px] text-right ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={editedModels[model.id]?.isEnabled ?? model.isEnabled ?? true}
                          onCheckedChange={() => handleToggleEnabled(model.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {plans?.map((plan) => (
                            <Badge
                              key={plan.id}
                              variant={editedModels[model.id]?.allowedPlans?.includes(plan.name) ? "default" : "outline"}
                              className="cursor-pointer text-xs"
                              onClick={() => handleTogglePlan(model.id, plan.name)}
                            >
                              {editedModels[model.id]?.allowedPlans?.includes(plan.name) && (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              {plan.nameRu || plan.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Легенда</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Premium — топовые модели</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>Standard — сбалансированные</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span>Basic — быстрые и дешёвые</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
