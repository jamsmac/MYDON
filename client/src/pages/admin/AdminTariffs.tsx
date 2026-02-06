/**
 * AdminTariffs - Pricing plans management
 * CRUD for subscription plans with comparison table
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Crown,
  Zap,
  Users,
  FolderKanban,
  Bot,
  Headphones,
  Star,
} from "lucide-react";

type PlanFeatures = {
  creditsPerMonth: number;
  maxProjects: number;
  maxUsers: number;
  aiModels: string[];
  prioritySupport: boolean;
  customBranding?: boolean;
  apiAccess?: boolean;
  advancedAnalytics?: boolean;
  exportFormats?: string[];
};

const defaultFeatures: PlanFeatures = {
  creditsPerMonth: 1000,
  maxProjects: 5,
  maxUsers: 1,
  aiModels: ["gpt-4o-mini"],
  prioritySupport: false,
};

const availableModels = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-opus", name: "Claude 3 Opus" },
  { id: "gemini-pro", name: "Gemini Pro" },
  { id: "gemini-ultra", name: "Gemini Ultra" },
];

export default function AdminTariffs() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{
    id?: number;
    name: string;
    slug: string;
    nameRu: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    features: PlanFeatures;
    isActive: boolean;
    isPopular: boolean;
    sortOrder: number;
  } | null>(null);
  const [planToDelete, setPlanToDelete] = useState<{ id: number; name: string } | null>(null);

  // Queries
  const { data: plans, isLoading, refetch } = trpc.adminPricing.getPlans.useQuery();

  // Mutations
  const createMutation = trpc.adminPricing.createPlan.useMutation({
    onSuccess: () => {
      toast.success("Тариф создан");
      setDialogOpen(false);
      setEditingPlan(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.adminPricing.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Тариф обновлён");
      setDialogOpen(false);
      setEditingPlan(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.adminPricing.deletePlan.useMutation({
    onSuccess: () => {
      toast.success("Тариф удалён");
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateNew = () => {
    setEditingPlan({
      name: "",
      slug: "",
      nameRu: "",
      description: "",
      priceMonthly: 0,
      priceYearly: 0,
      currency: "USD",
      features: { ...defaultFeatures },
      isActive: true,
      isPopular: false,
      sortOrder: (plans?.length || 0) + 1,
    });
    setDialogOpen(true);
  };

  const handleEdit = (plan: NonNullable<typeof plans>[0]) => {
    setEditingPlan({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      nameRu: plan.nameRu || "",
      description: plan.description || "",
      priceMonthly: plan.priceMonthly || 0,
      priceYearly: plan.priceYearly || 0,
      currency: plan.currency || "USD",
      features: (plan.features as PlanFeatures) || { ...defaultFeatures },
      isActive: plan.isActive ?? true,
      isPopular: plan.isPopular ?? false,
      sortOrder: plan.displayOrder || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingPlan) return;
    
    if (!editingPlan.name) {
      toast.error("Введите название тарифа");
      return;
    }

    if (editingPlan.id) {
      // Update existing plan
      updateMutation.mutate({
        planId: editingPlan.id,
        name: editingPlan.name,
        nameRu: editingPlan.nameRu || undefined,
        description: editingPlan.description || undefined,
        priceMonthly: editingPlan.priceMonthly,
        priceYearly: editingPlan.priceYearly,
        features: {
          aiModels: editingPlan.features.aiModels,
          prioritySupport: editingPlan.features.prioritySupport,
          customBranding: editingPlan.features.customBranding || false,
          apiAccess: editingPlan.features.apiAccess || false,
          advancedAnalytics: editingPlan.features.advancedAnalytics || false,
          exportFormats: editingPlan.features.exportFormats || ["md", "json"],
        },
        isActive: editingPlan.isActive,
        isPopular: editingPlan.isPopular,
        displayOrder: editingPlan.sortOrder,
      });
    } else {
      // Create new plan
      createMutation.mutate({
        name: editingPlan.name,
        slug: editingPlan.slug || editingPlan.name.toLowerCase().replace(/\s+/g, '-'),
        nameRu: editingPlan.nameRu || undefined,
        description: editingPlan.description || undefined,
        priceMonthly: editingPlan.priceMonthly,
        priceYearly: editingPlan.priceYearly,
        currency: editingPlan.currency,
        features: {
          aiModels: editingPlan.features.aiModels,
          prioritySupport: editingPlan.features.prioritySupport,
          customBranding: editingPlan.features.customBranding || false,
          apiAccess: editingPlan.features.apiAccess || false,
          advancedAnalytics: editingPlan.features.advancedAnalytics || false,
          exportFormats: editingPlan.features.exportFormats || ["md", "json"],
        },
        isPopular: editingPlan.isPopular,
        displayOrder: editingPlan.sortOrder,
      });
    }
  };

  const handleDelete = () => {
    if (!planToDelete) return;
    deleteMutation.mutate({ planId: planToDelete.id });
  };

  const toggleModel = (modelId: string) => {
    if (!editingPlan) return;
    const models = editingPlan.features.aiModels;
    const newModels = models.includes(modelId)
      ? models.filter(m => m !== modelId)
      : [...models, modelId];
    setEditingPlan({
      ...editingPlan,
      features: { ...editingPlan.features, aiModels: newModels },
    });
  };

  const getPlanIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "free":
        return <Zap className="w-6 h-6" />;
      case "pro":
        return <Star className="w-6 h-6" />;
      case "enterprise":
        return <Crown className="w-6 h-6" />;
      default:
        return <Zap className="w-6 h-6" />;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Тарифные планы</h1>
            <p className="text-muted-foreground">
              Управление подписками и ценами
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Создать тариф
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-8 w-[100px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[200px]" />
                </CardContent>
              </Card>
            ))
          ) : (
            plans?.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative ${plan.isPopular ? "border-amber-500 border-2" : ""}`}
              >
                {plan.isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500">
                    Популярный
                  </Badge>
                )}
                {!plan.isActive && (
                  <Badge variant="outline" className="absolute top-2 right-2">
                    Неактивен
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
                    {getPlanIcon(plan.name)}
                  </div>
                  <CardTitle className="text-xl">
                    {plan.nameRu || plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <span className="text-4xl font-bold">
                      ${plan.priceMonthly || 0}
                    </span>
                    <span className="text-muted-foreground">
                      /мес
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      {(plan.features as PlanFeatures)?.creditsPerMonth?.toLocaleString() || 0} кредитов/мес
                    </div>
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-blue-500" />
                      {(plan.features as PlanFeatures)?.maxProjects === -1 
                        ? "Безлимит проектов" 
                        : `${(plan.features as PlanFeatures)?.maxProjects || 0} проектов`
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      {(plan.features as PlanFeatures)?.maxUsers === -1 
                        ? "Безлимит пользователей" 
                        : `${(plan.features as PlanFeatures)?.maxUsers || 0} пользователей`
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-500" />
                      {(plan.features as PlanFeatures)?.aiModels?.length || 0} AI моделей
                    </div>
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-pink-500" />
                      {(plan.features as PlanFeatures)?.prioritySupport 
                        ? "Приоритетная поддержка" 
                        : "Стандартная поддержка"
                      }
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Изменить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        setPlanToDelete({ id: plan.id, name: plan.nameRu || plan.name });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <CardTitle>Сравнение тарифов</CardTitle>
            <CardDescription>
              Детальное сравнение возможностей каждого плана
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Функция</TableHead>
                  {plans?.map((plan) => (
                    <TableHead key={plan.id} className="text-center">
                      {plan.nameRu || plan.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Цена</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      ${plan.priceMonthly || 0}/мес
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Кредиты/месяц</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      {(plan.features as PlanFeatures)?.creditsPerMonth?.toLocaleString() || 0}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Проекты</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      {(plan.features as PlanFeatures)?.maxProjects === -1 
                        ? "∞" 
                        : (plan.features as PlanFeatures)?.maxProjects || 0
                      }
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Пользователи</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      {(plan.features as PlanFeatures)?.maxUsers === -1 
                        ? "∞" 
                        : (plan.features as PlanFeatures)?.maxUsers || 0
                      }
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">AI модели</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      {(plan.features as PlanFeatures)?.aiModels?.length || 0}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Приоритетная поддержка</TableCell>
                  {plans?.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      {(plan.features as PlanFeatures)?.prioritySupport 
                        ? <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                        : <X className="w-5 h-5 text-muted-foreground mx-auto" />
                      }
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan?.id ? "Редактировать тариф" : "Создать тариф"}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры тарифного плана
            </DialogDescription>
          </DialogHeader>
          
          {editingPlan && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (EN)</Label>
                  <Input
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название (RU)</Label>
                  <Input
                    value={editingPlan.nameRu}
                    onChange={(e) => setEditingPlan({ ...editingPlan, nameRu: e.target.value })}
                    placeholder="Профессиональный"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={editingPlan.description}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  placeholder="Описание тарифа..."
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Цена/мес</Label>
                  <Input
                    type="number"
                    value={editingPlan.priceMonthly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Цена/год</Label>
                  <Input
                    type="number"
                    value={editingPlan.priceYearly}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceYearly: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Валюта</Label>
                  <Select
                    value={editingPlan.currency}
                    onValueChange={(v) => setEditingPlan({ ...editingPlan, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="RUB">RUB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Возможности</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Кредитов в месяц</Label>
                    <Input
                      type="number"
                      value={editingPlan.features.creditsPerMonth}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        features: { ...editingPlan.features, creditsPerMonth: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Макс. проектов (-1 = безлимит)</Label>
                    <Input
                      type="number"
                      value={editingPlan.features.maxProjects}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        features: { ...editingPlan.features, maxProjects: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Макс. пользователей (-1 = безлимит)</Label>
                    <Input
                      type="number"
                      value={editingPlan.features.maxUsers}
                      onChange={(e) => setEditingPlan({
                        ...editingPlan,
                        features: { ...editingPlan.features, maxUsers: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>

                {/* AI Models */}
                <div className="space-y-2">
                  <Label>Доступные AI модели</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableModels.map((model) => (
                      <Badge
                        key={model.id}
                        variant={editingPlan.features.aiModels.includes(model.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleModel(model.id)}
                      >
                        {editingPlan.features.aiModels.includes(model.id) && (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        {model.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <Label>Приоритетная поддержка</Label>
                  <Switch
                    checked={editingPlan.features.prioritySupport}
                    onCheckedChange={(v) => setEditingPlan({
                      ...editingPlan,
                      features: { ...editingPlan.features, prioritySupport: v }
                    })}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border flex-1">
                  <Label>Активен</Label>
                  <Switch
                    checked={editingPlan.isActive}
                    onCheckedChange={(v) => setEditingPlan({ ...editingPlan, isActive: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border flex-1">
                  <Label>Популярный</Label>
                  <Switch
                    checked={editingPlan.isPopular}
                    onCheckedChange={(v) => setEditingPlan({ ...editingPlan, isPopular: v })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending 
                ? "Сохранение..." 
                : "Сохранить"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить тариф?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить тариф "{planToDelete?.name}"?
              Пользователи с этим тарифом будут переведены на бесплатный план.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
