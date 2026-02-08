import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Webhook, Plus, Play, Trash2, History, CheckCircle, XCircle, 
  Clock, AlertTriangle, Eye, Copy, ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

const EVENT_CATEGORIES = {
  project: {
    label: "Проекты",
    events: ["project.created", "project.completed", "project.archived"],
  },
  task: {
    label: "Задачи",
    events: ["task.created", "task.completed", "task.overdue"],
  },
  ai: {
    label: "AI",
    events: ["ai.request", "ai.decision_finalized"],
  },
  user: {
    label: "Пользователи",
    events: ["user.registered", "user.invited"],
  },
  credits: {
    label: "Кредиты",
    events: ["credits.low", "credits.depleted"],
  },
};

export default function AdminWebhooks() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<number | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    secret: "",
    events: [] as string[],
  });

  const { data: webhooks = [], isLoading } = trpc.adminIntegrations.listWebhooks.useQuery();
  const { data: webhookEvents = [] } = trpc.adminIntegrations.getWebhookEvents.useQuery();
  const { data: history = [] } = trpc.adminIntegrations.getWebhookHistory.useQuery(
    { webhookId: selectedWebhookId! },
    { enabled: !!selectedWebhookId }
  );
  const utils = trpc.useUtils();

  const createWebhook = trpc.adminIntegrations.createWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook создан");
      utils.adminIntegrations.listWebhooks.invalidate();
      setIsCreateDialogOpen(false);
      setNewWebhook({ name: "", url: "", secret: "", events: [] });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWebhook = trpc.adminIntegrations.updateWebhook.useMutation({
    onSuccess: () => {
      utils.adminIntegrations.listWebhooks.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteWebhook = trpc.adminIntegrations.deleteWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook удалён");
      utils.adminIntegrations.listWebhooks.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testWebhook = trpc.adminIntegrations.testWebhook.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Тест успешен (${result.responseStatus}, ${result.duration}ms)`);
      } else {
        toast.error(`Тест неудачен: ${result.error || `HTTP ${result.responseStatus}`}`);
      }
      utils.adminIntegrations.listWebhooks.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleToggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error("Заполните все обязательные поля");
      return;
    }
    createWebhook.mutate(newWebhook);
  };

  const handleShowHistory = (webhookId: number) => {
    setSelectedWebhookId(webhookId);
    setIsHistoryDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="w-6 h-6 text-primary" />
            Webhooks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Настройте уведомления о событиях платформы
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Создать Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Создать Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Название</Label>
                <Input
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                  placeholder="Уведомления в Slack"
                />
              </div>
              <div>
                <Label>URL</Label>
                <Input
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
              <div>
                <Label>Секретный ключ (опционально)</Label>
                <Input
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                  placeholder="Для подписи запросов"
                  type="password"
                />
              </div>
              <div>
                <Label className="mb-2 block">События</Label>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {Object.entries(EVENT_CATEGORIES).map(([key, category]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        {category.label}
                      </div>
                      <div className="space-y-2">
                        {category.events.map((event) => (
                          <div key={event} className="flex items-center gap-2">
                            <Checkbox
                              id={event}
                              checked={newWebhook.events.includes(event)}
                              onCheckedChange={() => handleToggleEvent(event)}
                            />
                            <label htmlFor={event} className="text-sm cursor-pointer">
                              {event}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createWebhook.isPending}>
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Нет настроенных webhooks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Создайте webhook для получения уведомлений о событиях
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Создать первый Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook: { id: number; name: string; url: string; isActive: boolean | null; failureCount: number | null; events: unknown; lastTriggeredAt: string | null }) => (
            <Card key={webhook.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{webhook.name}</h3>
                      <Badge variant={webhook.isActive ? "default" : "secondary"}>
                        {webhook.isActive ? "Активен" : "Приостановлен"}
                      </Badge>
                      {webhook.failureCount && webhook.failureCount > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {webhook.failureCount} ошибок
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <ExternalLink className="w-4 h-4" />
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        {webhook.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(webhook.url);
                          toast.success("URL скопирован");
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(webhook.events as string[])?.slice(0, 5).map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {(webhook.events as string[])?.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{(webhook.events as string[]).length - 5}
                        </Badge>
                      )}
                    </div>
                    
                    {webhook.lastTriggeredAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Последний вызов:{" "}
                        {formatDistanceToNow(new Date(webhook.lastTriggeredAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.isActive ?? false}
                      onCheckedChange={(checked) => 
                        updateWebhook.mutate({ id: webhook.id, isActive: checked })
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testWebhook.mutate({ id: webhook.id })}
                      disabled={testWebhook.isPending}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Тест
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShowHistory(webhook.id)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      История
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteWebhook.mutate({ id: webhook.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История вызовов</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет истории вызовов
              </div>
            ) : (
              history.map((delivery: { id: number; event: string; success: boolean; responseStatus: number | null; duration: number | null; error: string | null; createdAt: string | null }) => (
                <div
                  key={delivery.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  {delivery.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {delivery.event}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        HTTP {delivery.responseStatus}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {delivery.duration}ms
                      </span>
                    </div>
                    {delivery.error && (
                      <div className="text-xs text-red-500 mt-1 truncate">
                        {delivery.error}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {delivery.createdAt && formatDistanceToNow(new Date(delivery.createdAt), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
