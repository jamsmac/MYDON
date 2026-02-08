/**
 * Admin Skills Page - Skill management with working create modal
 * Part 8.3: Added template variables hint, testing functionality, entity type selector
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  Bot,
  Play,
  ChevronDown,
  ChevronUp,
  Info,
  Code
} from "lucide-react";

// Template variables available for skill prompts
const TEMPLATE_VARIABLES = [
  { var: "{{entityTitle}}", desc: "Название сущности (блок/раздел/задача)" },
  { var: "{{entityType}}", desc: "Тип сущности (block/section/task)" },
  { var: "{{entityData}}", desc: "JSON данные сущности (статус, приоритет и т.д.)" },
  { var: "{{projectName}}", desc: "Название проекта" },
  { var: "{{projectId}}", desc: "ID проекта" },
  { var: "{{userMessage}}", desc: "Дополнительный контекст от пользователя" },
  { var: "{{parentContext}}", desc: "Контекст родительских сущностей" },
];

export default function AdminSkills() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<number | null>(null);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<number | null>(null);
  const [testContext, setTestContext] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  const { data: skills, isLoading, refetch } = trpc.skills.list.useQuery();
  const { data: agents } = trpc.agents.list.useQuery();

  const createMutation = trpc.skills.create.useMutation({
    onSuccess: () => {
      toast.success("Скилл создан");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.skills.update.useMutation({
    onSuccess: () => {
      toast.success("Скилл обновлён");
      setEditingSkill(null);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.skills.delete.useMutation({
    onSuccess: () => {
      toast.success("Скилл удалён");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    handlerType: "llm" as "llm" | "code" | "api" | "mcp",
    systemPrompt: "",
    inputSchema: "{}",
    outputSchema: "{}",
    isActive: true,
    agentIds: [] as number[],
    entityType: "" as "" | "block" | "section" | "task",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      handlerType: "llm",
      systemPrompt: "",
      inputSchema: "{}",
      outputSchema: "{}",
      isActive: true,
      agentIds: [],
      entityType: "",
    });
  };

  // Test skill functionality
  const handleTestSkill = async () => {
    if (!selectedSkill) return;
    setIsTesting(true);
    setTestResponse("");

    type SkillItem = NonNullable<typeof skills>[number];
    const skill = skills?.find((s: SkillItem) => s.id === selectedSkill);
    if (!skill) {
      toast.error("Скилл не найден");
      setIsTesting(false);
      return;
    }

    try {
      // Build a test prompt based on skill's system prompt
      const testPrompt = (skill as any).handlerConfig?.prompt ||
        `Выполни скилл "${skill.name}". Контекст: ${testContext || 'тестовый запрос'}`;

      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [{ role: 'user', content: testPrompt }],
          taskType: 'skill',
          projectContext: testContext || undefined,
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

  const handleCreate = () => {
    if (!formData.name || !formData.slug) {
      toast.error("Заполните обязательные поля");
      return;
    }
    createMutation.mutate({
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      handlerType: formData.handlerType === "llm" ? "prompt" : 
                   formData.handlerType === "code" ? "function" : 
                   formData.handlerType as any,
      handlerConfig: {
        prompt: formData.systemPrompt,
      },
    });
  };

  const handleUpdate = () => {
    if (!editingSkill) return;
    updateMutation.mutate({ 
      id: editingSkill, 
      name: formData.name,
      description: formData.description,
      handlerType: formData.handlerType === "llm" ? "prompt" : 
                   formData.handlerType === "code" ? "function" : 
                   formData.handlerType as any,
      isActive: formData.isActive,
    });
  };

  const handleEdit = (skill: NonNullable<typeof skills>[number]) => {
    setFormData({
      name: skill.name,
      slug: skill.slug,
      description: skill.description || "",
      handlerType: (skill.handlerType || "llm") as "llm" | "code" | "api" | "mcp",
      systemPrompt: (skill as any).systemPrompt || "",
      inputSchema: JSON.stringify((skill as any).inputSchema || {}, null, 2),
      outputSchema: JSON.stringify((skill as any).outputSchema || {}, null, 2),
      isActive: skill.isActive ?? false,
      agentIds: [],
      entityType: ((skill as any).entityType || "") as "" | "block" | "section" | "task",
    });
    setEditingSkill(skill.id);
    setIsCreateOpen(true);
  };

  const handleClone = (skill: NonNullable<typeof skills>[number]) => {
    setFormData({
      name: `${skill.name} (копия)`,
      slug: `${skill.slug}-copy`,
      description: skill.description || "",
      handlerType: (skill.handlerType || "llm") as "llm" | "code" | "api" | "mcp",
      systemPrompt: (skill as any).systemPrompt || "",
      inputSchema: JSON.stringify((skill as any).inputSchema || {}, null, 2),
      outputSchema: JSON.stringify((skill as any).outputSchema || {}, null, 2),
      isActive: true,
      agentIds: [],
      entityType: ((skill as any).entityType || "") as "" | "block" | "section" | "task",
    });
    setEditingSkill(null);
    setIsCreateOpen(true);
  };

  const handleToggleActive = (skillId: number, isActive: boolean) => {
    updateMutation.mutate({ id: skillId, isActive });
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
          <h1 className="text-3xl font-bold">Скиллы</h1>
          <p className="text-muted-foreground">Переиспользуемые навыки для AI агентов</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingSkill(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Создать скилл
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSkill ? "Редактировать скилл" : "Создать скилл"}</DialogTitle>
              <DialogDescription>
                {editingSkill ? "Измените настройки скилла" : "Настройте новый скилл для агентов"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Анализ текста"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug *</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="text-analysis"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание функциональности скилла..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип обработчика</Label>
                  <Select
                    value={formData.handlerType}
                    onValueChange={(v: any) => setFormData({ ...formData, handlerType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llm">LLM (AI модель)</SelectItem>
                      <SelectItem value="code">Code (JavaScript)</SelectItem>
                      <SelectItem value="api">API (внешний сервис)</SelectItem>
                      <SelectItem value="mcp">MCP (протокол)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                  <Label>Активен</Label>
                </div>
              </div>

              {/* Entity Type Selector */}
              <div className="space-y-2">
                <Label>Тип сущности</Label>
                <Select
                  value={formData.entityType || "any"}
                  onValueChange={(v) => setFormData({ ...formData, entityType: v === "any" ? "" : v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Любой" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Любой</SelectItem>
                    <SelectItem value="block">Блок</SelectItem>
                    <SelectItem value="section">Раздел</SelectItem>
                    <SelectItem value="task">Задача</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  К каким сущностям применим этот скилл
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Системный промпт</Label>
                  <Collapsible open={showVariables} onOpenChange={setShowVariables}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                        <Info className="w-3 h-3" />
                        Переменные шаблона
                        {showVariables ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="absolute z-50 mt-1 right-0 w-80 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Доступные переменные для промпта:
                      </p>
                      <div className="space-y-1.5">
                        {TEMPLATE_VARIABLES.map((v) => (
                          <div key={v.var} className="flex items-start gap-2">
                            <code className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-400 font-mono shrink-0">
                              {v.var}
                            </code>
                            <span className="text-[10px] text-slate-400">{v.desc}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Инструкции для AI при выполнении этого скилла...&#10;&#10;Пример: Создай roadmap для {{entityType}} &quot;{{entityTitle}}&quot;.&#10;Учитывай следующие данные: {{entityData}}"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Входные параметры (JSON Schema)</Label>
                  <Textarea
                    value={formData.inputSchema}
                    onChange={(e) => setFormData({ ...formData, inputSchema: e.target.value })}
                    placeholder="{}"
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Выходные параметры (JSON Schema)</Label>
                  <Textarea
                    value={formData.outputSchema}
                    onChange={(e) => setFormData({ ...formData, outputSchema: e.target.value })}
                    placeholder="{}"
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Agent binding */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-400" />
                  Привязка к агентам
                </Label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
                  {agents?.map((agent: { id: number; name: string; nameRu: string | null }) => (
                    <Badge
                      key={agent.id}
                      variant={formData.agentIds.includes(agent.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          agentIds: formData.agentIds.includes(agent.id)
                            ? formData.agentIds.filter((id) => id !== agent.id)
                            : [...formData.agentIds, agent.id],
                        });
                      }}
                    >
                      {agent.nameRu || agent.name}
                    </Badge>
                  ))}
                  {(!agents || agents.length === 0) && (
                    <span className="text-sm text-muted-foreground">Нет доступных агентов</span>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateOpen(false);
                setEditingSkill(null);
                resetForm();
              }}>
                Отмена
              </Button>
              <Button 
                onClick={editingSkill ? handleUpdate : handleCreate} 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingSkill ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Test Skill Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              Тестировать скилл
              {selectedSkill && (() => {
                type SkillItem = NonNullable<typeof skills>[number];
                const found = skills?.find((s: SkillItem) => s.id === selectedSkill);
                return found ? (
                  <Badge variant="outline" className="ml-2">
                    {found.name}
                  </Badge>
                ) : null;
              })()}
            </DialogTitle>
            <DialogDescription>
              Проверьте работу скилла с тестовыми данными
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Контекст (опционально)</Label>
              <Textarea
                value={testContext}
                onChange={(e) => setTestContext(e.target.value)}
                placeholder="Дополнительный контекст для тестирования...&#10;Например: название проекта, статус задачи и т.д."
                rows={3}
                disabled={isTesting}
              />
            </div>
            {(testResponse || isTesting) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Результат
                  {isTesting && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                </Label>
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 min-h-[100px] max-h-[300px] overflow-y-auto">
                  {testResponse ? (
                    <div className="text-sm prose prose-invert prose-sm max-w-none">
                      <Streamdown>{testResponse}</Streamdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Выполнение скилла...
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
              onClick={handleTestSkill}
              disabled={isTesting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-2" />
              Запустить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skills Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {skills?.map((skill: NonNullable<typeof skills>[number]) => (
          <Card key={skill.id} className={!skill.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-emerald-400" />
                  <div>
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{skill.slug}</p>
                  </div>
                </div>
                <Switch
                  checked={skill.isActive ?? false}
                  onCheckedChange={(v) => handleToggleActive(skill.id, v)}
                  className="scale-75"
                />
              </div>
              <CardDescription className="line-clamp-2">
                {skill.description || "Нет описания"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Тип:</span>
                  <Badge variant="outline">{skill.handlerType}</Badge>
                </div>
                {(skill as any).entityType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Сущность:</span>
                    <Badge variant="secondary" className="text-xs">
                      {(skill as any).entityType === 'block' ? 'Блок' :
                       (skill as any).entityType === 'section' ? 'Раздел' :
                       (skill as any).entityType === 'task' ? 'Задача' : (skill as any).entityType}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Вызовов:</span>
                  <span>{skill.totalInvocations || 0}</span>
                </div>
                {/* Linked agent */}
                {(skill as any).agentId && (() => {
                  type AgentItem = NonNullable<typeof agents>[number];
                  const agentId = (skill as any).agentId;
                  const linkedAgent = agents?.find((a: AgentItem) => a.id === agentId);
                  return linkedAgent ? (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Агент:</span>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Bot className="w-3 h-3" />
                        {linkedAgent.nameRu || linkedAgent.name}
                      </Badge>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSkill(skill.id);
                    setTestContext("");
                    setTestResponse("");
                    setIsTestOpen(true);
                  }}
                >
                  <Play className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(skill)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Изменить
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClone(skill)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                {!(skill as any).isSystem && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => deleteMutation.mutate({ id: skill.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!skills || skills.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Скиллы не созданы</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать первый скилл
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
