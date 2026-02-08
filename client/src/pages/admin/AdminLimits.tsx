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
  Paperclip,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  // Attachment limits
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(100);
  const [maxTotalStorageMB, setMaxTotalStorageMB] = useState(10000);
  const [maxFilesPerEntity, setMaxFilesPerEntity] = useState(50);
  const [maxFilesPerMessage, setMaxFilesPerMessage] = useState(10);
  const [maxFileContentForAI_KB, setMaxFileContentForAI_KB] = useState(100);
  const [allowedMimeTypes, setAllowedMimeTypes] = useState<string[]>([]);
  const [attachmentPlanOverrides, setAttachmentPlanOverrides] = useState<Record<string, { maxFileSizeMB?: number; maxTotalStorageMB?: number; maxFilesPerEntity?: number }>>({});
  const [hasAttachmentChanges, setHasAttachmentChanges] = useState(false);

  // Queries
  const { data: settings, isLoading, refetch } = trpc.adminCredits.getLimitSettings.useQuery();
  const { data: roles } = trpc.adminUsers.getRoles.useQuery();
  const { data: attachmentSettings, isLoading: isLoadingAttachments, refetch: refetchAttachments } = trpc.attachments.getAdminSettings.useQuery();

  // Mutations
  const saveMutation = trpc.adminCredits.updateLimitSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      setHasChanges(false);
      refetch();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });

  const saveAttachmentsMutation = trpc.attachments.updateAdminSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки вложений сохранены");
      setHasAttachmentChanges(false);
      refetchAttachments();
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

  // Load attachment settings
  useEffect(() => {
    if (attachmentSettings) {
      setMaxFileSizeMB(attachmentSettings.maxFileSizeMB ?? 100);
      setMaxTotalStorageMB(attachmentSettings.maxTotalStorageMB ?? 10000);
      setMaxFilesPerEntity(attachmentSettings.maxFilesPerEntity ?? 50);
      setMaxFilesPerMessage(attachmentSettings.maxFilesPerMessage ?? 10);
      setMaxFileContentForAI_KB(attachmentSettings.maxFileContentForAI_KB ?? 100);
      setAllowedMimeTypes(attachmentSettings.allowedMimeTypes ?? []);
      setAttachmentPlanOverrides(attachmentSettings.planOverrides ?? {});
    }
  }, [attachmentSettings]);

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
  const markAttachmentChanged = () => setHasAttachmentChanges(true);

  const handleSaveAttachments = () => {
    saveAttachmentsMutation.mutate({
      maxFileSizeMB,
      maxTotalStorageMB,
      maxFilesPerEntity,
      maxFilesPerMessage,
      maxFileContentForAI_KB,
      allowedMimeTypes,
      planOverrides: attachmentPlanOverrides,
    });
  };

  const handlePlanOverrideChange = (plan: string, field: string, value: number) => {
    setAttachmentPlanOverrides(prev => ({
      ...prev,
      [plan]: { ...prev[plan], [field]: value },
    }));
    markAttachmentChanged();
  };

  // MIME type categories for easier selection
  const mimeTypeCategories = {
    "PDF": ["application/pdf"],
    "Word": ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    "Excel": ["application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    "PowerPoint": ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    "Изображения": ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"],
    "Текст/Markdown": ["text/plain", "text/markdown", "text/csv"],
    "JSON": ["application/json"],
    "Архивы": ["application/zip", "application/x-rar-compressed"],
    "Видео": ["video/mp4"],
    "Аудио": ["audio/mpeg", "audio/wav"],
  };

  const toggleMimeCategory = (category: string) => {
    const types = mimeTypeCategories[category as keyof typeof mimeTypeCategories];
    const allIncluded = types.every(t => allowedMimeTypes.includes(t));

    if (allIncluded) {
      setAllowedMimeTypes(prev => prev.filter(t => !types.includes(t)));
    } else {
      setAllowedMimeTypes(prev => Array.from(new Set<string>([...prev, ...types])));
    }
    markAttachmentChanged();
  };

  const isCategoryEnabled = (category: string): boolean => {
    const types = mimeTypeCategories[category as keyof typeof mimeTypeCategories];
    return types.every(t => allowedMimeTypes.includes(t));
  };

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
                  {roles?.map((role: { id: number; name: string; nameRu: string | null; description: string | null; color: string | null }) => (
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

            {/* Attachment Limits */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Paperclip className="w-5 h-5" />
                      Лимиты вложений
                    </CardTitle>
                    <CardDescription>
                      Настройки файловых вложений и хранилища
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchAttachments()}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Сброс
                    </Button>
                    <Button size="sm" onClick={handleSaveAttachments} disabled={!hasAttachmentChanges || saveAttachmentsMutation.isPending}>
                      <Save className="w-4 h-4 mr-1" />
                      {saveAttachmentsMutation.isPending ? "..." : "Сохранить"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingAttachments ? (
                  <Skeleton className="h-[200px]" />
                ) : (
                  <>
                    {/* File Size Limit */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Макс. размер файла</Label>
                        <p className="text-sm text-muted-foreground">
                          Максимальный размер одного файла
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[maxFileSizeMB]}
                          onValueChange={([v]) => { setMaxFileSizeMB(v); markAttachmentChanged(); }}
                          min={1}
                          max={2000}
                          step={10}
                          className="w-[200px]"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={maxFileSizeMB}
                            onChange={(e) => { setMaxFileSizeMB(parseInt(e.target.value) || 1); markAttachmentChanged(); }}
                            className="w-[80px]"
                          />
                          <span className="text-muted-foreground text-sm">MB</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Total Storage Limit */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Макс. хранилище на проект</Label>
                        <p className="text-sm text-muted-foreground">
                          Общий объём файлов в проекте
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[maxTotalStorageMB]}
                          onValueChange={([v]) => { setMaxTotalStorageMB(v); markAttachmentChanged(); }}
                          min={100}
                          max={100000}
                          step={100}
                          className="w-[200px]"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={maxTotalStorageMB}
                            onChange={(e) => { setMaxTotalStorageMB(parseInt(e.target.value) || 100); markAttachmentChanged(); }}
                            className="w-[100px]"
                          />
                          <span className="text-muted-foreground text-sm">MB</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Files Per Entity */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Макс. файлов на сущность</Label>
                        <p className="text-sm text-muted-foreground">
                          Блок, секция, задача
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[maxFilesPerEntity]}
                          onValueChange={([v]) => { setMaxFilesPerEntity(v); markAttachmentChanged(); }}
                          min={1}
                          max={1000}
                          step={5}
                          className="w-[200px]"
                        />
                        <Input
                          type="number"
                          value={maxFilesPerEntity}
                          onChange={(e) => { setMaxFilesPerEntity(parseInt(e.target.value) || 1); markAttachmentChanged(); }}
                          className="w-[80px]"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Files Per Message */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Макс. файлов в сообщении</Label>
                        <p className="text-sm text-muted-foreground">
                          В обсуждениях и комментариях
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[maxFilesPerMessage]}
                          onValueChange={([v]) => { setMaxFilesPerMessage(v); markAttachmentChanged(); }}
                          min={1}
                          max={100}
                          step={1}
                          className="w-[200px]"
                        />
                        <Input
                          type="number"
                          value={maxFilesPerMessage}
                          onChange={(e) => { setMaxFilesPerMessage(parseInt(e.target.value) || 1); markAttachmentChanged(); }}
                          className="w-[80px]"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* AI Content Limit */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Макс. размер для AI-контекста</Label>
                        <p className="text-sm text-muted-foreground">
                          Текстовые файлы для анализа AI
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[maxFileContentForAI_KB]}
                          onValueChange={([v]) => { setMaxFileContentForAI_KB(v); markAttachmentChanged(); }}
                          min={1}
                          max={5000}
                          step={10}
                          className="w-[200px]"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={maxFileContentForAI_KB}
                            onChange={(e) => { setMaxFileContentForAI_KB(parseInt(e.target.value) || 1); markAttachmentChanged(); }}
                            className="w-[80px]"
                          />
                          <span className="text-muted-foreground text-sm">KB</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Allowed MIME Types */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-base">Разрешённые типы файлов</Label>
                        <p className="text-sm text-muted-foreground">
                          Выберите категории разрешённых файлов
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(mimeTypeCategories).map((category) => (
                          <Badge
                            key={category}
                            variant={isCategoryEnabled(category) ? "default" : "outline"}
                            className="cursor-pointer select-none"
                            onClick={() => toggleMimeCategory(category)}
                          >
                            {isCategoryEnabled(category) ? "✓" : ""} {category}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Plan Overrides */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-base">Переопределения по планам</Label>
                        <p className="text-sm text-muted-foreground">
                          Индивидуальные лимиты для тарифных планов
                        </p>
                      </div>
                      {["free", "pro", "enterprise"].map((plan) => (
                        <div key={plan} className="flex items-center gap-4 p-3 rounded-lg border">
                          <div className="w-24 font-medium capitalize">
                            {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Enterprise"}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Файл:</span>
                            <Input
                              type="number"
                              value={attachmentPlanOverrides[plan]?.maxFileSizeMB ?? ""}
                              placeholder={String(maxFileSizeMB)}
                              onChange={(e) => handlePlanOverrideChange(plan, "maxFileSizeMB", parseInt(e.target.value) || 0)}
                              className="w-[70px]"
                            />
                            <span className="text-xs text-muted-foreground">MB</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Хранилище:</span>
                            <Input
                              type="number"
                              value={attachmentPlanOverrides[plan]?.maxTotalStorageMB ?? ""}
                              placeholder={String(maxTotalStorageMB)}
                              onChange={(e) => handlePlanOverrideChange(plan, "maxTotalStorageMB", parseInt(e.target.value) || 0)}
                              className="w-[80px]"
                            />
                            <span className="text-xs text-muted-foreground">MB</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Файлов:</span>
                            <Input
                              type="number"
                              value={attachmentPlanOverrides[plan]?.maxFilesPerEntity ?? ""}
                              placeholder={String(maxFilesPerEntity)}
                              onChange={(e) => handlePlanOverrideChange(plan, "maxFilesPerEntity", parseInt(e.target.value) || 0)}
                              className="w-[60px]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
