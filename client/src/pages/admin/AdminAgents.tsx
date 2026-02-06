/**
 * Admin Agents Page - Enhanced agent management with skills/MCP binding
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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { 
  Bot, 
  Plus, 
  Pencil, 
  Trash2, 
  Copy,
  MessageSquare,
  Loader2,
  Zap,
  Server,
  Play
} from "lucide-react";

export default function AdminAgents() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();
  const { data: skills } = trpc.skills.list.useQuery();
  const { data: mcpServers } = trpc.mcpServers.list.useQuery();

  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      toast.success("Агент создан");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.agents.update.useMutation({
    onSuccess: () => {
      toast.success("Агент обновлён");
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
    isActive: true,
    skillIds: [] as number[],
    mcpServerIds: [] as number[],
  });

  const handleCreate = () => {
    if (!newAgent.name || !newAgent.slug) {
      toast.error("Заполните обязательные поля");
      return;
    }
    createMutation.mutate({
      ...newAgent,
      temperature: newAgent.temperature / 100,
    });
  };

  const handleClone = (agent: typeof agents extends (infer T)[] | undefined ? T : never) => {
    if (!agent) return;
    setNewAgent({
      name: `${agent.name} (копия)`,
      nameRu: agent.nameRu ? `${agent.nameRu} (копия)` : "",
      slug: `${agent.slug}-copy`,
      description: agent.description || "",
      type: agent.type as any,
      systemPrompt: agent.systemPrompt || "",
      modelPreference: agent.modelPreference || "",
      temperature: (agent.temperature || 0.7) * 100,
      maxTokens: agent.maxTokens || 4096,
      isActive: true,
      skillIds: [],
      mcpServerIds: [],
    });
    setIsCreateOpen(true);
  };

  const handleToggleActive = (agentId: number, isActive: boolean) => {
    updateMutation.mutate({ id: agentId, isActive });
  };

  const handleTestAgent = async () => {
    if (!selectedAgent || !testMessage.trim()) return;
    setIsTesting(true);
    setTestResponse("");
    
    try {
      // Simple test - would need a test endpoint
      toast.info("Тестирование агента...");
      setTimeout(() => {
        setTestResponse("Тестовый ответ от агента. Для полноценного тестирования используйте AI чат.");
        setIsTesting(false);
      }, 1500);
    } catch (err) {
      toast.error("Ошибка тестирования");
      setIsTesting(false);
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
          <h1 className="text-3xl font-bold">AI Агенты</h1>
          <p className="text-muted-foreground">Управление специализированными AI агентами</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Создать агента
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать агента</DialogTitle>
              <DialogDescription>Настройте нового AI агента</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (EN) *</Label>
                  <Input
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="Project Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название (RU)</Label>
                  <Input
                    value={newAgent.nameRu}
                    onChange={(e) => setNewAgent({ ...newAgent, nameRu: e.target.value })}
                    placeholder="Менеджер проектов"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input
                    value={newAgent.slug}
                    onChange={(e) => setNewAgent({ ...newAgent, slug: e.target.value })}
                    placeholder="project-manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select
                    value={newAgent.type}
                    onValueChange={(v: any) => setNewAgent({ ...newAgent, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Общий</SelectItem>
                      <SelectItem value="planning">Планирование</SelectItem>
                      <SelectItem value="analysis">Анализ</SelectItem>
                      <SelectItem value="creative">Креатив</SelectItem>
                      <SelectItem value="technical">Технический</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="Описание агента и его специализации..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Системный промпт</Label>
                <Textarea
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  placeholder="You are a helpful AI assistant..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Температура: {newAgent.temperature}%</Label>
                  <Slider
                    value={[newAgent.temperature]}
                    onValueChange={(v) => setNewAgent({ ...newAgent, temperature: v[0] })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={newAgent.maxTokens}
                    onChange={(e) => setNewAgent({ ...newAgent, maxTokens: parseInt(e.target.value) || 4096 })}
                  />
                </div>
              </div>
              
              {/* Skills binding */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Привязанные скиллы
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                  {skills?.map((skill) => (
                    <Badge
                      key={skill.id}
                      variant={newAgent.skillIds.includes(skill.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewAgent({
                          ...newAgent,
                          skillIds: newAgent.skillIds.includes(skill.id)
                            ? newAgent.skillIds.filter((id) => id !== skill.id)
                            : [...newAgent.skillIds, skill.id],
                        });
                      }}
                    >
                      {skill.name}
                    </Badge>
                  ))}
                  {(!skills || skills.length === 0) && (
                    <span className="text-sm text-muted-foreground">Нет доступных скиллов</span>
                  )}
                </div>
              </div>

              {/* MCP Servers binding */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  Привязанные MCP серверы
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                  {mcpServers?.map((server) => (
                    <Badge
                      key={server.id}
                      variant={newAgent.mcpServerIds.includes(server.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewAgent({
                          ...newAgent,
                          mcpServerIds: newAgent.mcpServerIds.includes(server.id)
                            ? newAgent.mcpServerIds.filter((id) => id !== server.id)
                            : [...newAgent.mcpServerIds, server.id],
                        });
                      }}
                    >
                      {server.name}
                    </Badge>
                  ))}
                  {(!mcpServers || mcpServers.length === 0) && (
                    <span className="text-sm text-muted-foreground">Нет доступных серверов</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={newAgent.isActive}
                  onCheckedChange={(v) => setNewAgent({ ...newAgent, isActive: v })}
                />
                <Label>Активен</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Test Agent Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Тестировать агента</DialogTitle>
            <DialogDescription>Отправьте тестовое сообщение агенту</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Сообщение</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Введите тестовое сообщение..."
                rows={3}
              />
            </div>
            {testResponse && (
              <div className="space-y-2">
                <Label>Ответ агента</Label>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {testResponse}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={handleTestAgent} disabled={isTesting || !testMessage.trim()}>
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-2" />
              Тест
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agents Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => (
          <Card key={agent.id} className={!agent.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-amber-400" />
                  <div>
                    <CardTitle className="text-lg">{agent.nameRu || agent.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{agent.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={agent.isActive ?? false}
                    onCheckedChange={(v) => handleToggleActive(agent.id, v)}
                    className="scale-75"
                  />
                </div>
              </div>
              <CardDescription className="line-clamp-2">
                {agent.description || "Нет описания"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Тип:</span>
                  <Badge variant="outline">{agent.type}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Температура:</span>
                  <span>{((agent.temperature || 0.7) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Вызовов:</span>
                  <span>{(agent as any).totalInvocations || 0}</span>
                </div>
                
                {/* Bound skills */}
                {(agent as any).skills && (agent as any).skills.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Скиллы:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(agent as any).skills.map((skill: any) => (
                        <Badge key={skill.id} variant="secondary" className="text-xs">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bound MCP servers */}
                {(agent as any).mcpServers && (agent as any).mcpServers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Server className="w-3 h-3" /> MCP:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(agent as any).mcpServers.map((server: any) => (
                        <Badge key={server.id} variant="secondary" className="text-xs">
                          {server.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAgent(agent.id);
                    setTestMessage("");
                    setTestResponse("");
                    setIsTestOpen(true);
                  }}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Тест
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClone(agent)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm">
                  <Pencil className="w-3 h-3" />
                </Button>
                {!agent.isSystem && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
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
