/**
 * AdminLimits - Credit limits and policies management
 * Sliders and inputs for configuring limits
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Save,
  RefreshCw,
  AlertTriangle,
  Ban,
  Bell,
  Gauge,
  Users,
  FolderKanban,
  Zap,
  Shield,
} from "lucide-react";

export default function AdminLimits() {
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form state
  const [globalDailyLimit, setGlobalDailyLimit] = useState(1000);
  const [maxTokensPerRequest, setMaxTokensPerRequest] = useState(4000);
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [blockOnLimit, setBlockOnLimit] = useState(true);
  const [allowOverage, setAllowOverage] = useState(false);
  
  // Role limits
  const [roleLimits, setRoleLimits] = useState<Record<string, number>>({
    admin: -1, // unlimited
    manager: 500,
    user: 100,
    viewer: 10,
  });

  // Queries
  const { data: settings, isLoading, refetch } = trpc.adminCredits.getLimitSettings.useQuery();
  const { data: roles } = trpc.adminUsers.getRoles.useQuery();

  // Mutation
  const saveMutation = trpc.adminCredits.updateLimitSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      setHasChanges(false);
      refetch();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setGlobalDailyLimit(settings.globalDailyLimit || 1000);
      setMaxTokensPerRequest(settings.maxTokensPerRequest || 4000);
      setWarningThreshold(settings.warningThreshold || 80);
      setBlockOnLimit(settings.blockOnLimit ?? true);
      setAllowOverage(settings.allowOverage ?? false);
      if (settings.roleLimits) {
        setRoleLimits(settings.roleLimits as Record<string, number>);
      }
    }
  }, [settings]);

  const handleSave = () => {
    saveMutation.mutate({
      globalDailyLimit,
      maxTokensPerRequest,
      warningThreshold,
      blockOnLimit,
      allowOverage,
      roleLimits,
    });
  };

  const handleRoleLimitChange = (role: string, value: number) => {
    setRoleLimits(prev => ({ ...prev, [role]: value }));
    setHasChanges(true);
  };

  const markChanged = () => setHasChanges(true);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Политики лимитов</h1>
            <p className="text-muted-foreground">
              Настройка ограничений использования кредитов
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Сбросить
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[200px]" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Global Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Глобальные лимиты
                </CardTitle>
                <CardDescription>
                  Общие ограничения для всех пользователей
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Дневной лимит на пользователя</Label>
                      <p className="text-sm text-muted-foreground">
                        Максимум кредитов в день (по умолчанию)
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[globalDailyLimit]}
                        onValueChange={([v]) => { setGlobalDailyLimit(v); markChanged(); }}
                        max={10000}
                        step={100}
                        className="w-[200px]"
                      />
                      <Input
                        type="number"
                        value={globalDailyLimit}
                        onChange={(e) => { setGlobalDailyLimit(parseInt(e.target.value) || 0); markChanged(); }}
                        className="w-[100px]"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Макс. токенов на запрос</Label>
                      <p className="text-sm text-muted-foreground">
                        Ограничение токенов для одного AI запроса
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[maxTokensPerRequest]}
                        onValueChange={([v]) => { setMaxTokensPerRequest(v); markChanged(); }}
                        max={32000}
                        step={500}
                        className="w-[200px]"
                      />
                      <Input
                        type="number"
                        value={maxTokensPerRequest}
                        onChange={(e) => { setMaxTokensPerRequest(parseInt(e.target.value) || 0); markChanged(); }}
                        className="w-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role-based Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Лимиты по ролям
                </CardTitle>
                <CardDescription>
                  Индивидуальные лимиты для каждой роли (-1 = безлимит)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {roles?.map((role) => (
                    <div key={role.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: role.color || "#6366f1" }}
                        />
                        <div>
                          <Label className="text-base">{role.nameRu || role.name}</Label>
                          <p className="text-sm text-muted-foreground">
                            {role.description || "Нет описания"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {roleLimits[role.name] === -1 ? (
                          <span className="text-emerald-500 font-medium flex items-center gap-1">
                            <Zap className="w-4 h-4" />
                            Безлимит
                          </span>
                        ) : (
                          <Slider
                            value={[roleLimits[role.name] || 100]}
                            onValueChange={([v]) => handleRoleLimitChange(role.name, v)}
                            max={5000}
                            step={10}
                            className="w-[150px]"
                          />
                        )}
                        <Input
                          type="number"
                          value={roleLimits[role.name] ?? 100}
                          onChange={(e) => handleRoleLimitChange(role.name, parseInt(e.target.value) || 0)}
                          className="w-[100px]"
                          placeholder="-1 = безлимит"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRoleLimitChange(role.name, roleLimits[role.name] === -1 ? 100 : -1)}
                        >
                          {roleLimits[role.name] === -1 ? "Ограничить" : "Безлимит"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notifications & Blocking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Уведомления и блокировка
                </CardTitle>
                <CardDescription>
                  Настройки предупреждений при достижении лимитов
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Порог предупреждения
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Уведомить при достижении % от лимита
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[warningThreshold]}
                      onValueChange={([v]) => { setWarningThreshold(v); markChanged(); }}
                      max={100}
                      step={5}
                      className="w-[200px]"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={warningThreshold}
                        onChange={(e) => { setWarningThreshold(parseInt(e.target.value) || 0); markChanged(); }}
                        className="w-[80px]"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      Блокировать при 100%
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Запретить AI запросы при исчерпании лимита
                    </p>
                  </div>
                  <Switch
                    checked={blockOnLimit}
                    onCheckedChange={(v) => { setBlockOnLimit(v); markChanged(); }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-500" />
                      Разрешить превышение
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Позволить использование сверх лимита (с предупреждением)
                    </p>
                  </div>
                  <Switch
                    checked={allowOverage}
                    onCheckedChange={(v) => { setAllowOverage(v); markChanged(); }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Project Limits (placeholder) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="w-5 h-5" />
                  Лимиты по проектам
                </CardTitle>
                <CardDescription>
                  Ограничения кредитов для отдельных проектов
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FolderKanban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Лимиты по проектам настраиваются в карточке каждого проекта</p>
                  <Button variant="link" className="mt-2">
                    Перейти к проектам →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
