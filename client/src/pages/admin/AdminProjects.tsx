import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Search, MoreVertical, Archive, RotateCcw, Trash2, 
  UserPlus, Download, FolderOpen, Bot,
  CheckCircle2, Clock
} from "lucide-react";

export default function AdminProjects() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [transferProject, setTransferProject] = useState<{ id: number; title: string } | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");

  // Queries
  const { data: projectsData, refetch } = trpc.adminContent.listProjects.useQuery({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter as "active" | "archived" | "completed" : undefined,
  });
  
  const projects = projectsData?.projects || [];

  const { data: users } = trpc.adminUsers.list.useQuery({});

  // Mutations
  const archiveProject = trpc.adminContent.archiveProject.useMutation({
    onSuccess: () => {
      toast.success("Проект архивирован");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const restoreProject = trpc.adminContent.restoreProject.useMutation({
    onSuccess: () => {
      toast.success("Проект восстановлен");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteProject = trpc.adminContent.deleteProject.useMutation({
    onSuccess: () => {
      toast.success("Проект удалён");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const transferOwnership = trpc.adminContent.transferProject.useMutation({
    onSuccess: () => {
      toast.success("Владелец изменён");
      setTransferProject(null);
      setNewOwnerId("");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><Clock className="w-3 h-3 mr-1" />Активный</Badge>;
      case "completed":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Завершён</Badge>;
      case "archived":
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30"><Archive className="w-3 h-3 mr-1" />Архив</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (projects.length === 0) return;
    
    const headers = ["ID", "Название", "Владелец", "Статус", "Задач", "AI запросов", "Создан"];
    const rows = projects.map((p) => [
      p.id,
      p.name,
      p.owner?.name || p.owner?.email || "—",
      p.status || "active",
      p.taskCount || 0,
      p.aiRequestCount || 0,
      new Date(p.createdAt).toLocaleDateString("ru"),
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `projects-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("Экспорт завершён");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Управление проектами</h1>
          <p className="text-muted-foreground">Все проекты платформы</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Экспорт CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">Всего проектов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {projects.filter((p) => p.status === "active").length}
                </p>
                <p className="text-xs text-muted-foreground">Активных</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {projects.filter((p) => p.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Завершённых</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Bot className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {projects.reduce((sum, p) => sum + (p.aiRequestCount || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">AI запросов</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="completed">Завершённые</SelectItem>
            <SelectItem value="archived">Архивные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Проект</TableHead>
              <TableHead>Владелец</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-center">Задач</TableHead>
              <TableHead className="text-center">Блоков</TableHead>
              <TableHead className="text-center">AI</TableHead>
              <TableHead>Создан</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="font-medium">{project.name}</div>
                  {project.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {project.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs">
                      {project.owner?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm">{project.owner?.name || project.owner?.email || "—"}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(project.status)}</TableCell>
                <TableCell className="text-center">{project.taskCount || 0}</TableCell>
                <TableCell className="text-center">{project.blockCount || 0}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-mono">
                    {project.aiRequestCount || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(project.createdAt).toLocaleDateString("ru")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {project.status !== "archived" ? (
                        <DropdownMenuItem
                          onClick={() => archiveProject.mutate({ id: project.id })}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Архивировать
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => restoreProject.mutate({ id: project.id })}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Восстановить
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setTransferProject({ id: project.id, title: project.name })}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Передать владельцу
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Удалить проект "${project.name}"? Это действие необратимо.`)) {
                            deleteProject.mutate({ id: project.id });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Проекты не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Transfer Ownership Dialog */}
      <Dialog open={!!transferProject} onOpenChange={(open) => !open && setTransferProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Передать проект</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Передать проект <strong>"{transferProject?.title}"</strong> другому пользователю
            </p>

            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите нового владельца" />
              </SelectTrigger>
              <SelectContent>
                {users?.users?.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferProject(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (transferProject && newOwnerId) {
                  transferOwnership.mutate({
                    projectId: transferProject.id,
                    newOwnerId: parseInt(newOwnerId),
                  });
                }
              }}
              disabled={!newOwnerId || transferOwnership.isPending}
            >
              Передать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
