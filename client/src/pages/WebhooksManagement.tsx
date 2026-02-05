import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Webhook,
  Plus,
  MoreVertical,
  Trash2,
  RefreshCw,
  Play,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

// Webhook event categories
const EVENT_CATEGORIES = {
  task: ["task.created", "task.updated", "task.completed", "task.deleted"],
  subtask: ["subtask.created", "subtask.completed"],
  project: ["project.created", "project.updated"],
  block: ["block.created", "block.updated"],
  section: ["section.created", "section.updated"],
  member: ["member.invited", "member.joined", "member.removed"],
  deadline: ["deadline.approaching", "deadline.passed"],
};

export default function WebhooksManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<number | null>(null);
  const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: [] as string[],
    generateSecret: true,
  });

  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.webhook.list.useQuery();
  const { data: availableEvents } = trpc.webhook.getAvailableEvents.useQuery();
  const { data: deliveries } = trpc.webhook.getDeliveries.useQuery(
    { webhookId: selectedWebhook!, limit: 50 },
    { enabled: !!selectedWebhook }
  );

  const createMutation = trpc.webhook.create.useMutation({
    onSuccess: (data) => {
      toast.success("Webhook создан", {
        description: `Секретный ключ: ${data.secret?.substring(0, 20)}...`,
      });
      setIsCreateOpen(false);
      setNewWebhook({ name: "", url: "", events: [], generateSecret: true });
      utils.webhook.list.invalidate();
    },
    onError: (error) => {
      toast.error("Ошибка создания", { description: error.message });
    },
  });

  const updateMutation = trpc.webhook.update.useMutation({
    onSuccess: () => {
      toast.success("Webhook обновлён");
      utils.webhook.list.invalidate();
    },
  });

  const deleteMutation = trpc.webhook.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook удалён");
      utils.webhook.list.invalidate();
    },
  });

  const testMutation = trpc.webhook.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Тест успешен", {
          description: `Статус: ${result.statusCode}, Время: ${result.duration}ms`,
        });
      } else {
        toast.error("Тест не прошёл", { description: result.error });
      }
    },
  });

  const regenerateSecretMutation = trpc.webhook.regenerateSecret.useMutation({
    onSuccess: (data) => {
      toast.success("Секрет обновлён", {
        description: `Новый ключ: ${data.secret.substring(0, 20)}...`,
      });
      utils.webhook.list.invalidate();
    },
  });

  const handleEventToggle = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    const categoryEvents = EVENT_CATEGORIES[category as keyof typeof EVENT_CATEGORIES] || [];
    const allSelected = categoryEvents.every((e) => newWebhook.events.includes(e));

    setNewWebhook((prev) => ({
      ...prev,
      events: allSelected
        ? prev.events.filter((e) => !categoryEvents.includes(e))
        : Array.from(new Set([...prev.events, ...categoryEvents])),
    }));
  };

  const handleCreate = () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error("Заполните все поля");
      return;
    }
    createMutation.mutate(newWebhook);
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
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Настройте уведомления о событиях в ваших проектах
          </p>
        </div>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="deliveries" disabled={!selectedWebhook}>
            История доставок
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {webhooks?.length || 0} webhook(s) настроено
            </p>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Создать Webhook</DialogTitle>
                  <DialogDescription>
                    Webhook будет отправлять POST-запросы на указанный URL при выбранных событиях
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Название</Label>
                    <Input
                      id="name"
                      placeholder="Мой webhook"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      placeholder="https://example.com/webhook"
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook((prev) => ({ ...prev, url: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="secret"
                      checked={newWebhook.generateSecret}
                      onCheckedChange={(checked) =>
                        setNewWebhook((prev) => ({ ...prev, generateSecret: checked }))
                      }
                    />
                    <Label htmlFor="secret">Генерировать секретный ключ для подписи</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>События</Label>
                    <ScrollArea className="h-64 border rounded-md p-4">
                      {Object.entries(EVENT_CATEGORIES).map(([category, events]) => (
                        <div key={category} className="mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Checkbox
                              id={`cat-${category}`}
                              checked={events.every((e) => newWebhook.events.includes(e))}
                              onCheckedChange={() => handleCategoryToggle(category)}
                            />
                            <Label htmlFor={`cat-${category}`} className="font-semibold capitalize">
                              {category}
                            </Label>
                          </div>
                          <div className="ml-6 space-y-1">
                            {events.map((event) => (
                              <div key={event} className="flex items-center space-x-2">
                                <Checkbox
                                  id={event}
                                  checked={newWebhook.events.includes(event)}
                                  onCheckedChange={() => handleEventToggle(event)}
                                />
                                <Label htmlFor={event} className="text-sm font-normal">
                                  {event}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">
                      Выбрано событий: {newWebhook.events.length}
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Webhook className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{webhook.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {webhook.url}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.isActive ?? false}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({ id: webhook.id, isActive: checked })
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => testMutation.mutate({ id: webhook.id })}>
                              <Play className="w-4 h-4 mr-2" />
                              Тестировать
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedWebhook(webhook.id)}>
                              <Clock className="w-4 h-4 mr-2" />
                              История доставок
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => regenerateSecretMutation.mutate({ id: webhook.id })}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Обновить секрет
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate({ id: webhook.id })}
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
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(webhook.events as string[])?.slice(0, 5).map((event) => (
                        <Badge key={event} variant="secondary">
                          {event}
                        </Badge>
                      ))}
                      {(webhook.events as string[])?.length > 5 && (
                        <Badge variant="outline">
                          +{(webhook.events as string[]).length - 5}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {webhook.lastTriggeredAt && (
                        <span>
                          Последний вызов:{" "}
                          {formatDistanceToNow(new Date(webhook.lastTriggeredAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </span>
                      )}
                      {(webhook.failureCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="w-4 h-4" />
                          {webhook.failureCount} ошибок
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
                <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет webhooks</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Создайте webhook для получения уведомлений о событиях в ваших проектах
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Создать первый Webhook
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deliveries">
          {selectedWebhook && deliveries && (
            <Card>
              <CardHeader>
                <CardTitle>История доставок</CardTitle>
                <CardDescription>
                  Последние {deliveries.length} доставок для выбранного webhook
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Статус</TableHead>
                      <TableHead>Событие</TableHead>
                      <TableHead>Код ответа</TableHead>
                      <TableHead>Время</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          {delivery.success ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{delivery.event}</Badge>
                        </TableCell>
                        <TableCell>{delivery.responseStatus || "—"}</TableCell>
                        <TableCell>{delivery.duration}ms</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(delivery.createdAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
