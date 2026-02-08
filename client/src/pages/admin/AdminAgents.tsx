/**
 * Admin Agents Page - Enhanced agent management with skills/MCP binding
 * Part 8.2: Added model preference selector, agent statistics, improved testing
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
import { Streamdown } from "streamdown";
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
  Play,
  Clock,
  CheckCircle,
  TrendingUp
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
  const { data: modelRatings } = trpc.adminModelRatings.list.useQuery();

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

  const [newAgent, setNewAgent] = useState<{
    name: string;
    nameRu: string;
    slug: string;
    description: string;
    type: "research" | "analysis" | "code" | "general" | "writing" | "planning";
    systemPrompt: string;
    modelPreference: string;
    temperature: number;
    maxTokens: number;
    isActive: boolean;
    skillIds: number[];
    mcpServerIds: number[];
    triggerPatterns: string;
  }>({
    name: "",
    nameRu: "",
    slug: "",
    description: "",
    type: "general",
    systemPrompt: "",
    modelPreference: "",
    temperature: 70,
    maxTokens: 4096,
    isActive: true,
    skillIds: [],
    mcpServerIds: [],
    triggerPatterns: "",
  });

  const handleCreate = () => {
    if (!newAgent.name || !newAgent.slug) {
      toast.error("Заполните обязательные поля");
      return;
    }
    const triggerPatterns = newAgent.triggerPatterns
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    createMutation.mutate({
      name: newAgent.name,
      nameRu: newAgent.nameRu,
      slug: newAgent.slug,
      description: newAgent.description,
      type: newAgent.type,
      systemPrompt: newAgent.systemPrompt,
      modelPreference: newAgent.modelPreference || undefined,
      temperature: newAgent.temperature,
      maxTokens: newAgent.maxTokens,
      triggerPatterns: triggerPatterns.length > 0 ? triggerPatterns : undefined,
    });
  };

  const handleClone = (agent: NonNullable<typeof agents>[number]) => {
    if (!agent) return;
    const patterns = (agent.triggerPatterns as string[] | null) || [];
    setNewAgent({
      name: `${agent.name} (копия)`,
      nameRu: agent.nameRu ? `${agent.nameRu} (копия)` : "",
      slug: `${agent.slug}-copy`,
      description: agent.description || "",
      type: agent.type as "research" | "analysis" | "code" | "general" | "writing" | "planning",
      systemPrompt: agent.systemPrompt || "",
      modelPreference: agent.modelPreference || "",
      temperature: (agent.temperature || 0.7) * 100,
      maxTokens: agent.maxTokens || 4096,
      isActive: true,
      skillIds: [],
      mcpServerIds: [],
      triggerPatterns: patterns.join('\n'),
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

    type AgentItem = NonNullable<typeof agents>[number];
    const agent = agents?.find((a: AgentItem) => a.id === selectedAgent);
    if (!agent) {
      toast.error("Агент не найден");
      setIsTesting(false);
      return;
    }

    try {
      // Use the streaming endpoint with agent's model preference
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [{ role: 'user', content: testMessage }],
          taskType: 'chat',
          model: agent.modelPreference || undefined,
          projectContext: agent.systemPrompt ? `System: ${agent.systemPrompt}` : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка запроса');
      }

      if (!response.body) throw new Error('Нет тела ответа');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'done') continue;
              if (data.type === 'error') throw new Error(data.message);
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setTestResponse(fullContent);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err: any) {
      toast.error("Ошибка тестирования: " + (err.message || "Неизвестная ошибка"));
    } finally {
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

              {/* Model Preference Selector */}
              <div className="space-y-2">
                <Label>Предпочитаемая модель</Label>
                <Select
                  value={newAgent.modelPreference || "auto"}
                  onValueChange={(v) => setNewAgent({ ...newAgent, modelPreference: v === "auto" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Авто (по рейтингу)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Авто (по рейтингу задачи)</SelectItem>
                    {modelRatings?.map((model: { id: number; modelName: string; provider: string }) => (
                      <SelectItem key={model.id} value={model.modelName}>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {model.provider}
                          </Badge>
                          {model.modelName.split('/').pop()}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Если не указано, модель выбирается автоматически по типу задачи
                </p>
              </div>

              {/* Trigger Patterns */}
              <div className="space-y-2">
                <Label>Триггер-паттерны (regex)</Label>
                <Textarea
                  value={newAgent.triggerPatterns}
                  onChange={(e) => setNewAgent({ ...newAgent, triggerPatterns: e.target.value })}
                  placeholder="план|roadmap|стратегия&#10;анализ|исследование&#10;(каждый паттерн на новой строке)"
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Паттерны для автоматического выбора агента по сообщению пользователя
                </p>
              </div>
              
              {/* Skills binding */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Привязанные скиллы
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                  {skills?.map((skill: { id: number; name: string }) => (
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
                  {mcpServers?.map((server: { id: number; name: string }) => (
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber-400" />
              Тестировать агента
              {selectedAgent && (() => {
                type AgentItem = NonNullable<typeof agents>[number];
                const found = agents?.find((a: AgentItem) => a.id === selectedAgent);
                return found ? (
                  <Badge variant="outline" className="ml-2">
                    {found.nameRu || found.name}
                  </Badge>
                ) : null;
              })()}
            </DialogTitle>
            <DialogDescription>
              Отправьте тестовое сообщение и проверьте ответ агента
              {selectedAgent && (() => {
                type AgentItem = NonNullable<typeof agents>[number];
                const found = agents?.find((a: AgentItem) => a.id === selectedAgent);
                return found?.modelPreference ? (
                  <span className="block text-xs mt-1">
                    Модель: {found.modelPreference}
                  </span>
                ) : null;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Сообщение</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Введите тестовое сообщение для агента..."
                rows={3}
                disabled={isTesting}
              />
            </div>
            {(testResponse || isTesting) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Ответ агента
                  {isTesting && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                </Label>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 min-h-[100px] max-h-[300px] overflow-y-auto">
                  {testResponse ? (
                    <div className="text-sm prose prose-invert prose-sm max-w-none">
                      <Streamdown>{testResponse}</Streamdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Генерация ответа...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsTestOpen(false);
              setTestResponse("");
            }}>
              Закрыть
            </Button>
            <Button
              onClick={handleTestAgent}
              disabled={isTesting || !testMessage.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-2" />
              Тест
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agents Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent: NonNullable<typeof agents>[number]) => (
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
                {agent.modelPreference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Модель:</span>
                    <span className="text-xs truncate max-w-[120px]" title={agent.modelPreference}>
                      {agent.modelPreference.split('/').pop()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Температура:</span>
                  <span>{((agent.temperature || 0.7) * 100).toFixed(0)}%</span>
                </div>

                {/* Agent Statistics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/50">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                    </div>
                    <div className="text-sm font-medium">{(agent as any).totalInvocations || 0}</div>
                    <div className="text-[10px] text-muted-foreground">вызовов</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="text-sm font-medium">
                      {(agent as any).avgResponseTime ? `${Math.round((agent as any).avgResponseTime)}ms` : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">время</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <div className="text-sm font-medium">
                      {(agent as any).successRate ? `${Math.round((agent as any).successRate)}%` : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">успех</div>
                  </div>
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
