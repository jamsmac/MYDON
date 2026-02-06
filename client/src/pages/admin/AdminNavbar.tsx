import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Menu, Plus, GripVertical, Trash2, Eye, ExternalLink,
  MessageSquare, Trophy, Sparkles, Bell, Coins, Settings, LogOut, Link
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  Trophy: <Trophy className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Bell: <Bell className="w-4 h-4" />,
  Coins: <Coins className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  LogOut: <LogOut className="w-4 h-4" />,
  Link: <Link className="w-4 h-4" />,
};

export default function AdminNavbar() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", path: "", icon: "Link", externalUrl: "" });
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const { data: items = [], isLoading } = trpc.adminUI.getNavbarItems.useQuery();
  const utils = trpc.useUtils();

  const updateItem = trpc.adminUI.updateNavbarItem.useMutation({
    onSuccess: () => {
      utils.adminUI.getNavbarItems.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const createItem = trpc.adminUI.createNavbarItem.useMutation({
    onSuccess: () => {
      toast.success("Элемент добавлен");
      utils.adminUI.getNavbarItems.invalidate();
      setIsAddDialogOpen(false);
      setNewItem({ name: "", path: "", icon: "Link", externalUrl: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItem = trpc.adminUI.deleteNavbarItem.useMutation({
    onSuccess: () => {
      toast.success("Элемент удалён");
      utils.adminUI.getNavbarItems.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderItems = trpc.adminUI.reorderNavbarItems.useMutation({
    onSuccess: () => {
      utils.adminUI.getNavbarItems.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleToggle = (id: number, isEnabled: boolean) => {
    updateItem.mutate({ id, isEnabled });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    reorderItems.mutate({
      items: newItems.map((item, i) => ({ id: item.id, displayOrder: i + 1 })),
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    reorderItems.mutate({
      items: newItems.map((item, i) => ({ id: item.id, displayOrder: i + 1 })),
    });
  };

  const handleAddItem = () => {
    if (!newItem.name) {
      toast.error("Введите название");
      return;
    }
    createItem.mutate({
      name: newItem.name,
      path: newItem.path || undefined,
      icon: newItem.icon,
      externalUrl: newItem.externalUrl || undefined,
      isEnabled: true,
      isCustom: true,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const enabledItems = items.filter(i => i.isEnabled);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Menu className="w-6 h-6 text-primary" />
            Настройки навбара
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление элементами верхней навигации
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить ссылку
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить кастомную ссылку</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Название</Label>
                <Input
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Документация"
                />
              </div>
              <div>
                <Label>Внутренний путь (опционально)</Label>
                <Input
                  value={newItem.path}
                  onChange={(e) => setNewItem({ ...newItem, path: e.target.value })}
                  placeholder="/docs"
                />
              </div>
              <div>
                <Label>Внешняя ссылка (опционально)</Label>
                <Input
                  value={newItem.externalUrl}
                  onChange={(e) => setNewItem({ ...newItem, externalUrl: e.target.value })}
                  placeholder="https://docs.example.com"
                />
              </div>
              <div>
                <Label>Иконка</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {Object.keys(ICON_MAP).map((icon) => (
                    <Button
                      key={icon}
                      variant={newItem.icon === icon ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewItem({ ...newItem, icon })}
                    >
                      {ICON_MAP[icon]}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleAddItem} className="w-full" disabled={createItem.isPending}>
                Добавить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Элементы навигации</CardTitle>
            <CardDescription>
              Включите/отключите элементы и измените порядок
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет элементов навигации
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.isEnabled ? "bg-card" : "bg-muted/30 opacity-60"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                    {ICON_MAP[item.icon || "Link"] || <Link className="w-4 h-4" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.externalUrl || item.path || "—"}
                    </div>
                  </div>
                  
                  {item.externalUrl && (
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  )}
                  
                  <Switch
                    checked={item.isEnabled ?? false}
                    onCheckedChange={(checked) => handleToggle(item.id, checked)}
                  />
                  
                  {item.isCustom && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteItem.mutate({ id: item.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Предпросмотр навбара
            </CardTitle>
            <CardDescription>
              Как будет выглядеть навигация
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 rounded-lg p-4">
              {/* Mini navbar preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-sm">
                    M
                  </div>
                  <span className="text-white font-semibold text-sm">MYDON</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {enabledItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                      title={item.name}
                    >
                      {ICON_MAP[item.icon || "Link"] || <Link className="w-4 h-4" />}
                    </div>
                  ))}
                  {enabledItems.length > 6 && (
                    <div className="text-xs text-slate-500 ml-2">
                      +{enabledItems.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">
                Активные элементы: {enabledItems.length}
              </div>
              <div className="flex flex-wrap gap-2">
                {enabledItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-xs"
                  >
                    {ICON_MAP[item.icon || "Link"]}
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
