/**
 * AdminUsers - User management page
 * Table with filters, search, and actions
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Shield,
  Ban,
  Trash2,
  Coins,
  Mail,
  RefreshCw,
  X,
  Users,
  UserCheck,
  Clock,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialogs
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string } | null>(null);
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("3"); // Default to "user" role
  const [inviteCreditLimit, setInviteCreditLimit] = useState("1000");
  const [inviteMessage, setInviteMessage] = useState("");
  
  // Credits form
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsReason, setCreditsReason] = useState("");

  // Queries
  const { data: usersData, isLoading, refetch } = trpc.adminUsers.list.useQuery({
    search: search || undefined,
    role: roleFilter !== "all" ? roleFilter as "user" | "admin" : undefined,
    limit: 50,
    offset: 0,
  });

  const { data: roles } = trpc.adminUsers.getRoles.useQuery();
  const { data: invitations, refetch: refetchInvitations } = trpc.adminUsers.getInvitations.useQuery({});

  // Mutations
  const updateRoleMutation = trpc.adminUsers.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Роль пользователя обновлена");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleBlockMutation = trpc.adminUsers.toggleBlock.useMutation({
    onSuccess: () => {
      toast.success("Статус пользователя изменён");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.adminUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("Пользователь удалён");
      setDeleteDialogOpen(false);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const addCreditsMutation = trpc.adminUsers.addCredits.useMutation({
    onSuccess: (data) => {
      toast.success(`Кредиты начислены. Новый баланс: ${data.newBalance}`);
      setCreditsDialogOpen(false);
      setCreditsAmount("");
      setCreditsReason("");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const createInvitationMutation = trpc.adminUsers.createInvitation.useMutation({
    onSuccess: () => {
      toast.success("Приглашение отправлено");
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteMessage("");
      refetchInvitations();
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelInvitationMutation = trpc.adminUsers.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Приглашение отменено");
      refetchInvitations();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error("Введите email");
      return;
    }
    createInvitationMutation.mutate({
      email: inviteEmail,
      roleId: parseInt(inviteRole),
      creditLimit: parseInt(inviteCreditLimit),
      message: inviteMessage || undefined,
    });
  };

  const handleAddCredits = () => {
    if (!selectedUser || !creditsAmount || !creditsReason) {
      toast.error("Заполните все поля");
      return;
    }
    addCreditsMutation.mutate({
      userId: selectedUser.id,
      amount: parseInt(creditsAmount),
      reason: creditsReason,
    });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate({ userId: selectedUser.id });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge variant="destructive">Админ</Badge>;
      case "manager":
        return <Badge className="bg-amber-500">Менеджер</Badge>;
      default:
        return <Badge variant="secondary">Пользователь</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500">Активен</Badge>;
      case "blocked":
        return <Badge variant="destructive">Заблокирован</Badge>;
      default:
        return <Badge variant="outline">Ожидает</Badge>;
    }
  };

  // Stats
  const totalUsers = usersData?.total || 0;
  const activeUsers = usersData?.users?.filter(u => u.status === "active").length || 0;
  const pendingInvitations = invitations?.filter(i => i.status === "pending").length || 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>
            <p className="text-muted-foreground">
              Управление пользователями и приглашениями
            </p>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Пригласить
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Активных</CardTitle>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Приглашений</CardTitle>
              <Mail className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingInvitations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">AI запросов</CardTitle>
              <Activity className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usersData?.users?.reduce((sum, u) => sum + u.aiRequests, 0) || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все роли</SelectItem>
              <SelectItem value="admin">Админ</SelectItem>
              <SelectItem value="user">Пользователь</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="blocked">Заблокированные</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Users Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Кредиты</TableHead>
                <TableHead>AI запросов</TableHead>
                <TableHead>Регистрация</TableHead>
                <TableHead>Последний вход</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : usersData?.users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Пользователи не найдены
                  </TableCell>
                </TableRow>
              ) : (
                usersData?.users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback>
                            {user.name?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.name || "Без имени"}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role || "user")}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-500" />
                        {user.credits || 0}
                      </div>
                    </TableCell>
                    <TableCell>{user.aiRequests}</TableCell>
                    <TableCell>
                      {user.createdAt && format(new Date(user.createdAt), "d MMM yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      {user.lastSignedIn 
                        ? format(new Date(user.lastSignedIn), "d MMM HH:mm", { locale: ru })
                        : "—"
                      }
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              updateRoleMutation.mutate({
                                userId: user.id,
                                role: user.role === "admin" ? "user" : "admin",
                              });
                            }}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                            {user.role === "admin" ? "Снять админа" : "Сделать админом"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser({ id: user.id, name: user.name || "" });
                              setCreditsDialogOpen(true);
                            }}
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            Начислить кредиты
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              toggleBlockMutation.mutate({
                                userId: user.id,
                                blocked: (user.status as string) !== "blocked",
                              });
                            }}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            {(user.status as string) === "blocked" ? "Разблокировать" : "Заблокировать"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedUser({ id: user.id, name: user.name || "" });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pending Invitations */}
        {invitations && invitations.filter(i => i.status === "pending").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Ожидающие приглашения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invitations
                  .filter(i => i.status === "pending")
                  .map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{invitation.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {invitation.roleName} • {invitation.creditLimit} кредитов
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {invitation.expiresAt && format(new Date(invitation.expiresAt), "d MMM", { locale: ru })}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelInvitationMutation.mutate({ invitationId: invitation.id })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пригласить пользователя</DialogTitle>
            <DialogDescription>
              Отправьте приглашение по email для регистрации на платформе
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Роль</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.nameRu || role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Лимит кредитов</Label>
                <Input
                  type="number"
                  value={inviteCreditLimit}
                  onChange={(e) => setInviteCreditLimit(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Сообщение (опционально)</Label>
              <Textarea
                placeholder="Персональное приглашение..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleInvite} disabled={createInvitationMutation.isPending}>
              {createInvitationMutation.isPending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Начислить кредиты</DialogTitle>
            <DialogDescription>
              Добавить кредиты пользователю {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Количество кредитов</Label>
              <Input
                type="number"
                placeholder="100"
                value={creditsAmount}
                onChange={(e) => setCreditsAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Причина</Label>
              <Textarea
                placeholder="Бонус за активность..."
                value={creditsReason}
                onChange={(e) => setCreditsReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddCredits} disabled={addCreditsMutation.isPending}>
              {addCreditsMutation.isPending ? "Начисление..." : "Начислить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить пользователя {selectedUser?.name}?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
