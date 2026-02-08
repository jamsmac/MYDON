import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Key,
  Plus,
  MoreVertical,
  Trash2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  ArrowLeft,
  Shield,
  Activity,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";

const SCOPE_GROUPS = {
  projects: ["projects:read", "projects:write"],
  tasks: ["tasks:read", "tasks:write"],
  blocks: ["blocks:read", "blocks:write"],
  sections: ["sections:read", "sections:write"],
  subtasks: ["subtasks:read", "subtasks:write"],
  analytics: ["analytics:read"],
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "projects:read": "Просмотр проектов",
  "projects:write": "Создание и редактирование проектов",
  "tasks:read": "Просмотр задач",
  "tasks:write": "Создание и редактирование задач",
  "blocks:read": "Просмотр блоков",
  "blocks:write": "Создание и редактирование блоков",
  "sections:read": "Просмотр секций",
  "sections:write": "Создание и редактирование секций",
  "subtasks:read": "Просмотр подзадач",
  "subtasks:write": "Создание и редактирование подзадач",
  "analytics:read": "Просмотр аналитики",
};

export default function ApiKeysManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [newKey, setNewKey] = useState({
    name: "",
    scopes: [] as string[],
    rateLimit: 1000,
  });

  const utils = trpc.useUtils();
  const { data: apiKeys, isLoading } = trpc.apiKeys.list.useQuery();
  const { data: keyDetails } = trpc.apiKeys.get.useQuery(
    { id: selectedKeyId! },
    { enabled: !!selectedKeyId }
  );

  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setShowKey(data.key);
      toast.success("API ключ создан");
      setIsCreateOpen(false);
      setNewKey({ name: "", scopes: [], rateLimit: 1000 });
      utils.apiKeys.list.invalidate();
    },
    onError: (error) => {
      toast.error("Ошибка создания", { description: error.message });
    },
  });

  const updateMutation = trpc.apiKeys.update.useMutation({
    onSuccess: () => {
      toast.success("API ключ обновлён");
      utils.apiKeys.list.invalidate();
    },
  });

  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      toast.success("API ключ удалён");
      setDeleteConfirm(null);
      utils.apiKeys.list.invalidate();
    },
  });

  const regenerateMutation = trpc.apiKeys.regenerate.useMutation({
    onSuccess: (data) => {
      setShowKey(data.key);
      toast.success("Ключ обновлён");
      utils.apiKeys.list.invalidate();
    },
  });

  const handleScopeToggle = (scope: string) => {
    setNewKey((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handleGroupToggle = (group: string) => {
    const groupScopes = SCOPE_GROUPS[group as keyof typeof SCOPE_GROUPS] || [];
    const allSelected = groupScopes.every((s) => newKey.scopes.includes(s));
    setNewKey((prev) => ({
      ...prev,
      scopes: allSelected
        ? prev.scopes.filter((s) => !groupScopes.includes(s))
        : Array.from(new Set([...prev.scopes, ...groupScopes])),
    }));
  };

  const handleCreate = () => {
    if (!newKey.name || newKey.scopes.length === 0) {
      toast.error("Заполните все поля");
      return;
    }
    createMutation.mutate({
      name: newKey.name,
      scopes: newKey.scopes as any,
      rateLimit: newKey.rateLimit,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Скопировано");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">API Ключи</h1>
          <p className="text-muted-foreground">Управляйте доступом к REST API</p>
        </div>
      </div>

      {showKey && (
        <Card className="mb-6 border-green-500 bg-green-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              Новый API ключ создан
            </CardTitle>
            <CardDescription>Скопируйте ключ сейчас — он больше не будет показан!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-background rounded-md font-mono text-sm break-all">
                {showKey}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(showKey)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => setShowKey(null)}>
              Понятно, я сохранил ключ
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{apiKeys?.length || 0} из 10 ключей</p>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button disabled={(apiKeys?.length || 0) >= 10}>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать ключ
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Создать API ключ</DialogTitle>
                  <DialogDescription>API ключ для доступа к REST API</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input
                      placeholder="Мой API ключ"
                      value={newKey.name}
                      onChange={(e) => setNewKey((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Limit (запросов/час): {newKey.rateLimit}</Label>
                    <Slider
                      value={[newKey.rateLimit]}
                      onValueChange={([value]) => setNewKey((prev) => ({ ...prev, rateLimit: value }))}
                      min={100}
                      max={10000}
                      step={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Права доступа</Label>
                    <ScrollArea className="h-64 border rounded-md p-4">
                      {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
                        <div key={group} className="mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Checkbox
                              checked={scopes.every((s) => newKey.scopes.includes(s))}
                              onCheckedChange={() => handleGroupToggle(group)}
                            />
                            <Label className="font-semibold capitalize">{group}</Label>
                          </div>
                          <div className="ml-6 space-y-1">
                            {scopes.map((scope) => (
                              <div key={scope} className="flex items-center space-x-2">
                                <Checkbox
                                  checked={newKey.scopes.includes(scope)}
                                  onCheckedChange={() => handleScopeToggle(scope)}
                                />
                                <Label className="text-sm font-normal">
                                  {SCOPE_DESCRIPTIONS[scope]}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key: { id: number; name: string; keyPreview?: string | null; keyPrefix?: string | null; isActive?: boolean | null; scopes?: string[] | null; rateLimit?: number | null; lastUsedAt?: Date | null; createdAt: Date }) => (
                <Card
                  key={key.id}
                  className={`cursor-pointer ${selectedKeyId === key.id ? "border-primary" : ""}`}
                  onClick={() => setSelectedKeyId(key.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{key.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {key.keyPrefix}...
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={key.isActive ? "default" : "secondary"}>
                          {key.isActive ? "Активен" : "Отключён"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMutation.mutate({ id: key.id, isActive: !key.isActive });
                              }}
                            >
                              {key.isActive ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                              {key.isActive ? "Отключить" : "Включить"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                regenerateMutation.mutate({ id: key.id });
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Перегенерировать
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(key.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(key.scopes as string[])?.slice(0, 4).map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                      {(key.scopes as string[])?.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{(key.scopes as string[]).length - 4}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Лимит: {key.rateLimit}/час
                      {key.lastUsedAt && (
                        <span className="ml-4">
                          Использован: {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true, locale: ru })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет API ключей</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Создайте API ключ для доступа к REST API
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать первый ключ
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {keyDetails ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Использование
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Текущий час</span>
                      <span>{keyDetails.usage.currentHour} / {keyDetails.rateLimit}</span>
                    </div>
                    <Progress value={(keyDetails.usage.currentHour / (keyDetails.rateLimit || 1000)) * 100} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">За 24 часа</p>
                      <p className="text-2xl font-bold">{keyDetails.usage.last24Hours}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ср. время</p>
                      <p className="text-2xl font-bold">{keyDetails.usage.avgResponseTime}ms</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Права доступа
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {(keyDetails.scopes as string[])?.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Информация
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Создан</span>
                    <span>{format(new Date(keyDetails.createdAt), "dd MMM yyyy", { locale: ru })}</span>
                  </div>
                  {keyDetails.lastUsedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Последнее использование</span>
                      <span>{formatDistanceToNow(new Date(keyDetails.lastUsedAt), { addSuffix: true, locale: ru })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Выберите ключ для просмотра</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить API ключ?</AlertDialogTitle>
            <AlertDialogDescription>
              Все приложения, использующие этот ключ, потеряют доступ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
