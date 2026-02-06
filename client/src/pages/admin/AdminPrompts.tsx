import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Plus, Search, Edit, Trash2, Copy, History, 
  MessageSquare, Sparkles, Code, Languages, 
  Palette, FileText, Bot, Send, Loader2, X
} from "lucide-react";

const CATEGORIES = [
  { value: "analysis", label: "Анализ", icon: Sparkles },
  { value: "code", label: "Код", icon: Code },
  { value: "translation", label: "Перевод", icon: Languages },
  { value: "creative", label: "Креатив", icon: Palette },
  { value: "custom", label: "Кастомный", icon: FileText },
];

interface Prompt {
  id: number;
  name: string;
  slug: string;
  category: string;
  content: string;
  description: string | null;
  version: number;
  isActive: boolean;
  variables: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PromptVersion {
  id: number;
  promptId: number;
  version: number;
  content: string;
  changedBy: number | null;
  changeNote: string | null;
  createdAt: Date;
}

export default function AdminPrompts() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [historyPrompt, setHistoryPrompt] = useState<any>(null);
  const [testPrompt, setTestPrompt] = useState<any>(null);
  const [testInput, setTestInput] = useState("");
  const [testMessages, setTestMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isTestLoading, setIsTestLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    category: "custom",
    content: "",
    description: "",
    isActive: true,
  });

  // Queries
  const { data: prompts, refetch } = trpc.adminPrompts.list.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter as any : undefined,
  });

  const { data: versions } = trpc.adminPrompts.getVersionHistory.useQuery(
    { promptId: historyPrompt?.id ?? 0 },
    { enabled: !!historyPrompt }
  );

  // Mutations
  const createPrompt = trpc.adminPrompts.create.useMutation({
    onSuccess: () => {
      toast.success("Промпт создан");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePrompt = trpc.adminPrompts.update.useMutation({
    onSuccess: () => {
      toast.success("Промпт обновлён");
      setEditingPrompt(null);
      resetForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePrompt = trpc.adminPrompts.delete.useMutation({
    onSuccess: () => {
      toast.success("Промпт удалён");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const testPromptMutation = trpc.adminPrompts.testPrompt.useMutation({
    onSuccess: (data) => {
      if (data.success && data.response) {
        setTestMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      } else if (data.error) {
        toast.error(data.error);
      }
      setIsTestLoading(false);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setIsTestLoading(false);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      category: "custom",
      content: "",
      description: "",
      isActive: true,
    });
  };

  const handleCreate = () => {
    createPrompt.mutate({
      name: formData.name,
      slug: formData.slug,
      category: formData.category as "analysis" | "code" | "translation" | "creative" | "custom",
      content: formData.content,
      description: formData.description,
      isActive: formData.isActive,
    });
  };

  const handleUpdate = () => {
    if (!editingPrompt) return;
    updatePrompt.mutate({
      id: editingPrompt.id,
      name: formData.name,
      slug: formData.slug,
      category: formData.category as "analysis" | "code" | "translation" | "creative" | "custom",
      content: formData.content,
      description: formData.description,
      isActive: formData.isActive,
    });
  };

  const handleEdit = (prompt: any) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      slug: prompt.slug,
      category: prompt.category,
      content: prompt.content,
      description: prompt.description || "",
      isActive: prompt.isActive,
    });
  };

  const handleClone = (prompt: any) => {
    setFormData({
      name: `${prompt.name} (копия)`,
      slug: `${prompt.slug}-copy`,
      category: prompt.category,
      content: prompt.content,
      description: prompt.description || "",
      isActive: false,
    });
    setIsCreateOpen(true);
  };

  const handleTestSend = () => {
    if (!testPrompt || !testInput.trim()) return;
    
    setTestMessages((prev) => [...prev, { role: "user", content: testInput }]);
    setIsTestLoading(true);
    
    testPromptMutation.mutate({
      content: testPrompt.content,
      testMessage: testInput,
    });
    
    setTestInput("");
  };

  const openTestChat = (prompt: any) => {
    setTestPrompt(prompt);
    setTestMessages([]);
    setTestInput("");
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat ? cat.icon : FileText;
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat ? cat.label : category;
  };

  // Highlight variables in prompt content
  const highlightVariables = (content: string) => {
    return content.replace(/\{\{(\w+)\}\}/g, '<span class="text-amber-400 font-mono bg-amber-400/10 px-1 rounded">{{$1}}</span>');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Библиотека промптов</h1>
          <p className="text-muted-foreground">Управление системными промптами и шаблонами</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Создать промпт
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts?.map((prompt) => {
          const CategoryIcon = getCategoryIcon(prompt.category);
          return (
            <Card key={prompt.id} className={`${!prompt.isActive ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CategoryIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{prompt.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">{prompt.slug}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={prompt.isActive ? "default" : "secondary"}>
                    v{prompt.version}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {prompt.description || "Без описания"}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {getCategoryLabel(prompt.category)}
                  </Badge>
                  {prompt.variables && prompt.variables.length > 0 && (
                    <span>{prompt.variables.length} переменных</span>
                  )}
                </div>

                <div className="flex gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(prompt)}
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClone(prompt)}
                    title="Клонировать"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistoryPrompt(prompt)}
                    title="История версий"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openTestChat(prompt)}
                    title="Тестировать"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Удалить промпт?")) {
                        deletePrompt.mutate({ id: prompt.id });
                      }
                    }}
                    title="Удалить"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingPrompt} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingPrompt(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "Редактировать промпт" : "Создать промпт"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Анализ задачи"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="task-analysis"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <span className="text-sm">
                    {formData.isActive ? "Активен" : "Неактивен"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание промпта"
              />
            </div>

            <div className="space-y-2">
              <Label>Текст промпта</Label>
              <p className="text-xs text-muted-foreground">
                Используйте {"{{переменная}}"} для динамических значений
              </p>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Ты — AI-ассистент для анализа задач проекта..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingPrompt(null);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button
              onClick={editingPrompt ? handleUpdate : handleCreate}
              disabled={createPrompt.isPending || updatePrompt.isPending}
            >
              {(createPrompt.isPending || updatePrompt.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingPrompt ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!historyPrompt} onOpenChange={(open) => !open && setHistoryPrompt(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>История версий: {historyPrompt?.name}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {versions?.map((version) => (
                <Card key={version.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge>v{version.version}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString("ru")}
                    </span>
                  </div>
                  {version.changeNote && (
                    <p className="text-sm text-muted-foreground mb-2">{version.changeNote}</p>
                  )}
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                    {version.content}
                  </pre>
                </Card>
              ))}
              {(!versions || versions.length === 0) && (
                <p className="text-center text-muted-foreground py-4">
                  История версий пуста
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Test Chat Dialog */}
      <Dialog open={!!testPrompt} onOpenChange={(open) => !open && setTestPrompt(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Тест: {testPrompt?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* System prompt preview */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Системный промпт:</p>
              <p 
                className="text-sm line-clamp-3"
                dangerouslySetInnerHTML={{ 
                  __html: highlightVariables(testPrompt?.content || "") 
                }}
              />
            </div>

            {/* Chat messages */}
            <ScrollArea className="h-64 border rounded-lg p-3">
              <div className="space-y-3">
                {testMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isTestLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                )}
                {testMessages.length === 0 && !isTestLoading && (
                  <p className="text-center text-muted-foreground py-8">
                    Отправьте сообщение для тестирования промпта
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Введите тестовое сообщение..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleTestSend()}
              />
              <Button onClick={handleTestSend} disabled={isTestLoading || !testInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
