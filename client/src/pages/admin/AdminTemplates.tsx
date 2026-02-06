import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Search, Plus, Edit, Trash2, Eye, Copy, 
  LayoutTemplate, Briefcase, Code, Megaphone, 
  GraduationCap, LayoutGrid, Globe, Lock
} from "lucide-react";

export default function AdminTemplates() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categoryId: undefined as number | undefined,
    isPublic: true,
  });

  // Queries
  const { data: templatesData, refetch } = trpc.adminContent.listTemplates.useQuery({
    search: search || undefined,
    categoryId: categoryFilter !== "all" ? parseInt(categoryFilter) : undefined,
  });
  
  const templates = templatesData?.templates || [];

  const { data: categories } = trpc.adminContent.listCategories.useQuery();

  // Mutations
  const updateTemplate = trpc.adminContent.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success("Шаблон обновлён");
      setEditingTemplate(null);
      resetForm();
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTemplate = trpc.adminContent.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Шаблон удалён");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const togglePublic = trpc.adminContent.toggleTemplatePublic.useMutation({
    onSuccess: () => {
      toast.success("Статус изменён");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      categoryId: undefined,
      isPublic: true,
    });
  };

  const handleUpdate = () => {
    if (!editingTemplate) return;
    updateTemplate.mutate({
      id: editingTemplate.id,
      name: formData.name,
      description: formData.description,
      categoryId: formData.categoryId,
      isPublic: formData.isPublic,
    });
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      categoryId: template.categoryId || undefined,
      isPublic: template.isPublic ?? true,
    });
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return "Без категории";
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || "Без категории";
  };

  // Count structure elements
  const getStructureCounts = (template: any) => {
    const structure = template.structure as any;
    if (!structure?.blocks) return { blocks: 0, sections: 0, tasks: 0 };
    
    let sections = 0;
    let tasks = 0;
    
    for (const block of structure.blocks) {
      if (block.sections) {
        sections += block.sections.length;
        for (const section of block.sections) {
          if (section.tasks) {
            tasks += section.tasks.length;
          }
        }
      }
    }
    
    return { blocks: structure.blocks.length, sections, tasks };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Шаблоны проектов</h1>
          <p className="text-muted-foreground">Готовые шаблоны для быстрого старта</p>
        </div>
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
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const counts = getStructureCounts(template);
          return (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                     <LayoutGrid className="w-4 h-4 text-primary" />                    </div>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {getCategoryName(template.categoryId)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {template.isPublic ? (
                      <Badge variant="outline" className="text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        Публичный
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Приватный
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description || "Без описания"}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{counts.blocks} блоков</span>
                  <span>{counts.sections} разделов</span>
                  <span>{counts.tasks} задач</span>
                </div>

                <div className="flex gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTemplate(template)}
                    title="Предпросмотр"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(template)}
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePublic.mutate({ id: template.id })}
                    title={template.isPublic ? "Сделать приватным" : "Сделать публичным"}
                  >
                    {template.isPublic ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Удалить шаблон?")) {
                        deleteTemplate.mutate({ id: template.id });
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
        
        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Шаблоны не найдены</p>
            <p className="text-xs mt-2">Создайте шаблон из существующего проекта</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => {
        if (!open) {
          setEditingTemplate(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать шаблон</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Бизнес-план стартапа"
              />
            </div>

            <div className="space-y-2">
              <Label>Категория</Label>
              <Select
                value={formData.categoryId?.toString() || "none"}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  categoryId: value === "none" ? undefined : parseInt(value) 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без категории</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Подробное описание шаблона..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
              <Label>Публичный шаблон</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingTemplate(null);
              resetForm();
            }}>
              Отмена
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateTemplate.isPending}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm">{previewTemplate?.description || "Без описания"}</p>
            </div>

            {previewTemplate && (() => {
              const counts = getStructureCounts(previewTemplate);
              return (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-card rounded-lg border">
                    <p className="text-2xl font-bold">{counts.blocks}</p>
                    <p className="text-xs text-muted-foreground">Блоков</p>
                  </div>
                  <div className="p-4 bg-card rounded-lg border">
                    <p className="text-2xl font-bold">{counts.sections}</p>
                    <p className="text-xs text-muted-foreground">Разделов</p>
                  </div>
                  <div className="p-4 bg-card rounded-lg border">
                    <p className="text-2xl font-bold">{counts.tasks}</p>
                    <p className="text-xs text-muted-foreground">Задач</p>
                  </div>
                </div>
              );
            })()}

            <p className="text-xs text-muted-foreground text-center">
              Структура шаблона будет скопирована при создании проекта
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
