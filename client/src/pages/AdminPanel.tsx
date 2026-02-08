import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Bot, 
  Zap, 
  Server, 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  Play, 
  Pause,
  Activity,
  Database,
  Shield,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("agents");

  // Check if user is admin
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Shield className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold">Доступ запрещён</h1>
        <p className="text-muted-foreground">Эта страница доступна только администраторам</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-amber-400" />
              <h1 className="text-xl font-bold">Админ-панель</h1>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-400">
            {user.name || "Admin"}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Агенты
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Скиллы
            </TabsTrigger>
            <TabsTrigger value="mcp" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              MCP
            </TabsTrigger>
            <TabsTrigger value="orchestrator" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Оркестратор
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Логи
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <AgentsSection />
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills">
            <SkillsSection />
          </TabsContent>

          {/* MCP Servers Tab */}
          <TabsContent value="mcp">
            <MCPServersSection />
          </TabsContent>

          {/* Orchestrator Tab */}
          <TabsContent value="orchestrator">
            <OrchestratorSection />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <LogsSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============ AGENTS SECTION ============
function AgentsSection() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      toast.success("Агент создан");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => {
      toast.success("Агент удалён");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [newAgent, setNewAgent] = useState({
    name: "",
    nameRu: "",
    slug: "",
    description: "",
    type: "general" as const,
    systemPrompt: "",
    modelPreference: "",
    temperature: 70,
    maxTokens: 4096,
  });

  const handleCreate = () => {
    if (!newAgent.name || !newAgent.slug) {
      toast.error("Заполните обязательные поля");
      return;
    }
    createMutation.mutate(newAgent);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">AI Агенты</h2>
          <p className="text-muted-foreground">Управление специализированными AI агентами</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Создать агента
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Новый AI агент</DialogTitle>
              <DialogDescription>Создайте специализированного агента для определённых задач</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input 
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                    placeholder="Code Agent"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input 
                    value={newAgent.slug}
                    onChange={(e) => setNewAgent({...newAgent, slug: e.target.value})}
                    placeholder="code-agent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (RU)</Label>
                  <Input 
                    value={newAgent.nameRu}
                    onChange={(e) => setNewAgent({...newAgent, nameRu: e.target.value})}
                    placeholder="Агент кода"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select 
                    value={newAgent.type} 
                    onValueChange={(v: any) => setNewAgent({...newAgent, type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="code">Код</SelectItem>
                      <SelectItem value="research">Исследование</SelectItem>
                      <SelectItem value="writing">Написание</SelectItem>
                      <SelectItem value="planning">Планирование</SelectItem>
                      <SelectItem value="analysis">Анализ</SelectItem>
                      <SelectItem value="general">Общий</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea 
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({...newAgent, description: e.target.value})}
                  placeholder="Описание возможностей агента..."
                />
              </div>
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea 
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({...newAgent, systemPrompt: e.target.value})}
                  placeholder="You are a specialized AI agent..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Предпочитаемая модель</Label>
                  <Input 
                    value={newAgent.modelPreference}
                    onChange={(e) => setNewAgent({...newAgent, modelPreference: e.target.value})}
                    placeholder="gpt-4o"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temperature (0-100)</Label>
                  <Input 
                    type="number"
                    value={newAgent.temperature}
                    onChange={(e) => setNewAgent({...newAgent, temperature: parseInt(e.target.value) || 70})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input 
                    type="number"
                    value={newAgent.maxTokens}
                    onChange={(e) => setNewAgent({...newAgent, maxTokens: parseInt(e.target.value) || 4096})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent: { id: number; name: string; description: string | null; type: string; modelPreference: string | null; totalRequests: number; isActive: boolean; isSystem: boolean }) => (
          <Card key={agent.id} className="relative group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-400" />
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                </div>
                <Badge variant={agent.isActive ? "default" : "secondary"}>
                  {agent.isActive ? "Активен" : "Неактивен"}
                </Badge>
              </div>
              <CardDescription>{agent.description || "Нет описания"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Тип:</span>
                  <Badge variant="outline">{agent.type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Модель:</span>
                  <span>{agent.modelPreference || "По умолчанию"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Запросов:</span>
                  <span>{agent.totalRequests}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" className="flex-1">
                  <Pencil className="w-3 h-3 mr-1" />
                  Изменить
                </Button>
                {!agent.isSystem && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteMutation.mutate({ id: agent.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!agents || agents.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Агенты не созданы</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============ SKILLS SECTION ============
function SkillsSection() {
  const { data: skills, isLoading, refetch } = trpc.skills.list.useQuery();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Скиллы</h2>
          <p className="text-muted-foreground">Переиспользуемые навыки для агентов</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4 mr-2" />
          Создать скилл
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {skills?.map((skill: { id: number; name: string; description: string | null; handlerType: string; totalInvocations: number; isActive: boolean }) => (
          <Card key={skill.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-lg">{skill.name}</CardTitle>
                </div>
                <Badge variant={skill.isActive ? "default" : "secondary"}>
                  {skill.isActive ? "Активен" : "Неактивен"}
                </Badge>
              </div>
              <CardDescription>{skill.description || "Нет описания"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Тип:</span>
                  <Badge variant="outline">{skill.handlerType}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Вызовов:</span>
                  <span>{skill.totalInvocations}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!skills || skills.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Скиллы не созданы</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============ MCP SERVERS SECTION ============
function MCPServersSection() {
  const { data: servers, isLoading, refetch } = trpc.mcpServers.list.useQuery();
  const testMutation = trpc.mcpServers.test.useMutation({
    onSuccess: () => toast.success("Подключение успешно"),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "error": return <XCircle className="w-4 h-4 text-red-400" />;
      case "connecting": return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">MCP Серверы</h2>
          <p className="text-muted-foreground">Подключения к внешним инструментам через Model Context Protocol</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4 mr-2" />
          Добавить сервер
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {servers?.map((server: { id: number; name: string; description: string | null; endpoint: string; protocol: string; authType: string; status: string | null; tools: unknown[] | null }) => (
          <Card key={server.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-400" />
                  <CardTitle className="text-lg">{server.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(server.status || "inactive")}
                  <Badge variant={server.status === "active" ? "default" : "secondary"}>
                    {server.status}
                  </Badge>
                </div>
              </div>
              <CardDescription>{server.description || server.endpoint}</CardDescription>
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
                    <Play className="w-3 h-3 mr-1" />
                  )}
                  Тест
                </Button>
                <Button variant="outline" size="sm">
                  <Pencil className="w-3 h-3" />
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============ ORCHESTRATOR SECTION ============
function OrchestratorSection() {
  const { data: config, isLoading, refetch } = trpc.orchestrator.getConfig.useQuery();
  const updateMutation = trpc.orchestrator.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [localConfig, setLocalConfig] = useState({
    enableAgentRouting: true,
    enableSkillMatching: true,
    enableMCPIntegration: true,
    loggingLevel: "info" as const,
    globalRateLimit: 100,
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Оркестратор</h2>
        <p className="text-muted-foreground">Настройки маршрутизации и обработки запросов</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Функции</CardTitle>
            <CardDescription>Включение/отключение возможностей оркестратора</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Маршрутизация агентов</p>
                <p className="text-sm text-muted-foreground">Автоматический выбор агента по запросу</p>
              </div>
              <Switch 
                checked={config?.enableAgentRouting ?? true}
                onCheckedChange={(v) => updateMutation.mutate({ enableAgentRouting: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Сопоставление скиллов</p>
                <p className="text-sm text-muted-foreground">Автоматический вызов скиллов</p>
              </div>
              <Switch 
                checked={config?.enableSkillMatching ?? true}
                onCheckedChange={(v) => updateMutation.mutate({ enableSkillMatching: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">MCP интеграция</p>
                <p className="text-sm text-muted-foreground">Использование внешних инструментов</p>
              </div>
              <Switch 
                checked={config?.enableMCPIntegration ?? true}
                onCheckedChange={(v) => updateMutation.mutate({ enableMCPIntegration: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Параметры</CardTitle>
            <CardDescription>Лимиты и настройки логирования</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Уровень логирования</Label>
              <Select 
                value={config?.loggingLevel || "info"}
                onValueChange={(v: any) => updateMutation.mutate({ loggingLevel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Глобальный лимит (запросов/мин)</Label>
              <Input 
                type="number"
                value={config?.globalRateLimit || 100}
                onChange={(e) => updateMutation.mutate({ globalRateLimit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Хранение логов (дней)</Label>
              <Input 
                type="number"
                value={config?.logRetentionDays || 30}
                onChange={(e) => updateMutation.mutate({ logRetentionDays: parseInt(e.target.value) || 30 })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ LOGS SECTION ============
function LogsSection() {
  const { data: logs, isLoading } = trpc.orchestrator.getLogs.useQuery({ limit: 50 });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-emerald-500">Успех</Badge>;
      case "error": return <Badge variant="destructive">Ошибка</Badge>;
      case "timeout": return <Badge variant="secondary">Таймаут</Badge>;
      case "rate_limited": return <Badge className="bg-amber-500">Лимит</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Логи запросов</h2>
        <p className="text-muted-foreground">История AI запросов и их результаты</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-4">Время</th>
                  <th className="p-4">Тип</th>
                  <th className="p-4">Модель</th>
                  <th className="p-4">Токены</th>
                  <th className="p-4">Время (мс)</th>
                  <th className="p-4">Статус</th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((log: { id: number; createdAt: string; requestType: string; model: string | null; tokensUsed: number | null; responseTimeMs: number | null; status: string | null }) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 text-sm">
                      {new Date(log.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{log.requestType}</Badge>
                    </td>
                    <td className="p-4 text-sm font-mono">{log.model || "-"}</td>
                    <td className="p-4 text-sm">{log.tokensUsed || "-"}</td>
                    <td className="p-4 text-sm">{log.responseTimeMs || "-"}</td>
                    <td className="p-4">{getStatusBadge(log.status || "success")}</td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Логи отсутствуют
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
