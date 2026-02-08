/**
 * Admin MCP Servers Page - MCP server management with working create modal
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Server, 
  Plus, 
  Pencil, 
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wifi
} from "lucide-react";

export default function AdminMCP() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<number | null>(null);

  const { data: servers, isLoading, refetch } = trpc.mcpServers.list.useQuery();

  const createMutation = trpc.mcpServers.create.useMutation({
    onSuccess: () => {
      toast.success("MCP сервер добавлен");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.mcpServers.update.useMutation({
    onSuccess: () => {
      toast.success("MCP сервер обновлён");
      setEditingServer(null);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.mcpServers.delete.useMutation({
    onSuccess: () => {
      toast.success("MCP сервер удалён");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.mcpServers.test.useMutation({
    onSuccess: () => toast.success("Подключение успешно"),
    onError: (err) => toast.error(`Ошибка подключения: ${err.message}`),
  });

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    endpoint: "",
    protocol: "http" as "http" | "websocket" | "stdio",
    authType: "none" as "none" | "api_key" | "oauth" | "basic",
    authToken: "",
    description: "",
    status: "inactive" as "active" | "inactive" | "error" | "connecting",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      endpoint: "",
      protocol: "http",
      authType: "none",
      authToken: "",
      description: "",
      status: "inactive",
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.endpoint) {
      toast.error("Заполните обязательные поля");
      return;
    }

    createMutation.mutate({
      name: formData.name,
      slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
      endpoint: formData.endpoint,
      protocol: formData.protocol,
      authType: formData.authType,
      description: formData.description,
      authConfig: formData.authToken ? { apiKey: formData.authToken } : undefined,
    });
  };

  const handleUpdate = () => {
    if (!editingServer) return;

    updateMutation.mutate({ 
      id: editingServer, 
      name: formData.name,
      endpoint: formData.endpoint,
      protocol: formData.protocol,
      authType: formData.authType,
      description: formData.description,
      status: formData.status,
      authConfig: formData.authToken ? { apiKey: formData.authToken } : undefined,
    });
  };

  const handleEdit = (server: NonNullable<typeof servers>[number]) => {
    setFormData({
      name: server.name,
      slug: server.slug || "",
      endpoint: server.endpoint,
      protocol: server.protocol as any,
      authType: server.authType as any,
      authToken: server.authConfig?.apiKey || "",
      description: server.description || "",
      status: (server.status || "inactive") as any,
    });
    setEditingServer(server.id);
    setIsCreateOpen(true);
  };

  const handleToggleEnabled = (serverId: number, enabled: boolean) => {
    updateMutation.mutate({ id: serverId, status: enabled ? "active" : "inactive" });
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "active": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "error": return <XCircle className="w-4 h-4 text-red-400" />;
      case "connecting": return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-500">Online</Badge>;
      case "error": return <Badge variant="destructive">Offline</Badge>;
      case "connecting": return <Badge className="bg-amber-500">Connecting</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">MCP Серверы</h1>
          <p className="text-muted-foreground">Подключения к внешним инструментам через Model Context Protocol</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingServer(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Добавить сервер
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingServer ? "Редактировать сервер" : "Добавить MCP сервер"}</DialogTitle>
              <DialogDescription>
                {editingServer ? "Измените настройки сервера" : "Настройте подключение к MCP серверу"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My MCP Server"
                />
              </div>

              <div className="space-y-2">
                <Label>URL / Endpoint *</Label>
                <Input
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="https://mcp.example.com/api"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип транспорта</Label>
                  <Select
                    value={formData.protocol}
                    onValueChange={(v: any) => setFormData({ ...formData, protocol: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                      <SelectItem value="stdio">STDIO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Авторизация</Label>
                  <Select
                    value={formData.authType}
                    onValueChange={(v: any) => setFormData({ ...formData, authType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без авторизации</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.authType !== "none" && (
                <div className="space-y-2">
                  <Label>
                    {formData.authType === "api_key" ? "API Key" : 
                     formData.authType === "oauth" ? "OAuth Credentials" : "Credentials"}
                  </Label>
                  <Input
                    type="password"
                    value={formData.authToken}
                    onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
                    placeholder="••••••••••••"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание сервера..."
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.status === "active"}
                  onCheckedChange={(v) => setFormData({ ...formData, status: v ? "active" : "inactive" })}
                />
                <Label>Включён</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateOpen(false);
                setEditingServer(null);
                resetForm();
              }}>
                Отмена
              </Button>
              <Button 
                onClick={editingServer ? handleUpdate : handleCreate} 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingServer ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Servers Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {servers?.map((server: NonNullable<typeof servers>[number]) => (
          <Card key={server.id} className={server.status !== "active" ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  <div>
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {server.endpoint}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(server.status)}
                  {getStatusBadge(server.status)}
                </div>
              </div>
              <CardDescription className="line-clamp-2">
                {server.description || "Нет описания"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Протокол:</span>
                  <Badge variant="outline">{server.protocol}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Авторизация:</span>
                  <span>{server.authType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Инструментов:</span>
                  <span>{server.tools?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Включён:</span>
                  <Switch
                    checked={server.status === "active"}
                    onCheckedChange={(v) => handleToggleEnabled(server.id, v)}
                    className="scale-75"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => testMutation.mutate({ id: server.id })}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Wifi className="w-3 h-3 mr-1" />
                  )}
                  Тест
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(server)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => deleteMutation.mutate({ id: server.id })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!servers || servers.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">MCP серверы не настроены</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить первый сервер
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
