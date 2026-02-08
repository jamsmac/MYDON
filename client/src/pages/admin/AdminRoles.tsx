/**
 * AdminRoles - Roles and permissions management
 * Visual permissions matrix with toggles
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  Shield,
  Lock,
} from "lucide-react";

// Permission groups for display
const permissionGroups = [
  {
    label: "Проекты",
    permissions: [
      { key: "projectsCreate", label: "Создавать" },
      { key: "projectsEdit", label: "Редактировать" },
      { key: "projectsDelete", label: "Удалять" },
      { key: "projectsViewOnly", label: "Только просмотр" },
    ],
  },
  {
    label: "AI",
    permissions: [
      { key: "aiUseChat", label: "Использовать чат" },
      { key: "aiCreateAgents", label: "Создавать агентов" },
      { key: "aiConfigureSkills", label: "Настраивать скиллы" },
    ],
  },
  {
    label: "Админка",
    permissions: [
      { key: "adminAccess", label: "Доступ" },
      { key: "adminFullAccess", label: "Полный доступ" },
    ],
  },
  {
    label: "Кредиты",
    permissions: [
      { key: "creditsUnlimited", label: "Без лимита" },
      { key: "creditsLimited", label: "По лимиту" },
    ],
  },
];

type Permissions = {
  projectsCreate: boolean;
  projectsEdit: boolean;
  projectsDelete: boolean;
  projectsViewOnly: boolean;
  aiUseChat: boolean;
  aiCreateAgents: boolean;
  aiConfigureSkills: boolean;
  adminAccess: boolean;
  adminFullAccess: boolean;
  creditsUnlimited: boolean;
  creditsLimited: boolean;
};

const defaultPermissions: Permissions = {
  projectsCreate: false,
  projectsEdit: false,
  projectsDelete: false,
  projectsViewOnly: true,
  aiUseChat: true,
  aiCreateAgents: false,
  aiConfigureSkills: false,
  adminAccess: false,
  adminFullAccess: false,
  creditsUnlimited: false,
  creditsLimited: true,
};

export default function AdminRoles() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id?: number;
    name: string;
    nameRu: string;
    description: string;
    color: string;
    permissions: Permissions;
    priority: number;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: number; name: string } | null>(null);

  // Queries
  const { data: roles, isLoading, refetch } = trpc.adminUsers.getRoles.useQuery();

  // Mutations
  const createRoleMutation = trpc.adminUsers.createRole.useMutation({
    onSuccess: () => {
      toast.success("Роль создана");
      setDialogOpen(false);
      setEditingRole(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateRoleMutation = trpc.adminUsers.updateRoleDefinition.useMutation({
    onSuccess: () => {
      toast.success("Роль обновлена");
      setDialogOpen(false);
      setEditingRole(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteRoleMutation = trpc.adminUsers.deleteRole.useMutation({
    onSuccess: () => {
      toast.success("Роль удалена");
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateNew = () => {
    setEditingRole({
      name: "",
      nameRu: "",
      description: "",
      color: "#6366f1",
      permissions: { ...defaultPermissions },
      priority: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (role: NonNullable<typeof roles>[0]) => {
    setEditingRole({
      id: role.id,
      name: role.name,
      nameRu: role.nameRu || "",
      description: role.description || "",
      color: role.color || "#6366f1",
      permissions: (role.permissions as Permissions) || { ...defaultPermissions },
      priority: role.priority || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingRole) return;
    
    if (!editingRole.name) {
      toast.error("Введите название роли");
      return;
    }

    if (editingRole.id) {
      updateRoleMutation.mutate({
        roleId: editingRole.id,
        name: editingRole.name,
        nameRu: editingRole.nameRu || undefined,
        description: editingRole.description || undefined,
        color: editingRole.color,
        permissions: editingRole.permissions,
        priority: editingRole.priority,
      });
    } else {
      createRoleMutation.mutate({
        name: editingRole.name,
        nameRu: editingRole.nameRu || undefined,
        description: editingRole.description || undefined,
        color: editingRole.color,
        permissions: editingRole.permissions,
        priority: editingRole.priority,
      });
    }
  };

  const handlePermissionChange = (key: keyof Permissions, value: boolean) => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      permissions: {
        ...editingRole.permissions,
        [key]: value,
      },
    });
  };

  const handleDelete = () => {
    if (!roleToDelete) return;
    deleteRoleMutation.mutate({ roleId: roleToDelete.id });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Роли и права</h1>
            <p className="text-muted-foreground">
              Управление ролями пользователей и их правами доступа
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Создать роль
          </Button>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-[120px]" />
                  <Skeleton className="h-4 w-[180px]" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            roles?.map((role: NonNullable<typeof roles>[number]) => (
              <Card key={role.id} className="relative">
                {role.isSystem && (
                  <Badge 
                    variant="outline" 
                    className="absolute top-2 right-2 text-xs"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Системная
                  </Badge>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: role.color || "#6366f1" }}
                    />
                    <CardTitle className="text-lg">
                      {role.nameRu || role.name}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {role.description || "Нет описания"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {role.userCount} пользователей
                  </div>
                  
                  {/* Quick permissions preview */}
                  <div className="flex flex-wrap gap-1">
                    {(role.permissions as Permissions)?.adminFullAccess && (
                      <Badge variant="destructive" className="text-xs">Полный доступ</Badge>
                    )}
                    {(role.permissions as Permissions)?.adminAccess && !(role.permissions as Permissions)?.adminFullAccess && (
                      <Badge className="text-xs bg-amber-500">Админка</Badge>
                    )}
                    {(role.permissions as Permissions)?.aiCreateAgents && (
                      <Badge variant="secondary" className="text-xs">AI агенты</Badge>
                    )}
                    {(role.permissions as Permissions)?.creditsUnlimited && (
                      <Badge className="text-xs bg-emerald-500">Безлимит</Badge>
                    )}
                  </div>

                  {!role.isSystem && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(role)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Изменить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          setRoleToDelete({ id: role.id, name: role.nameRu || role.name });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Permissions Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Матрица прав
            </CardTitle>
            <CardDescription>
              Сравнение прав доступа для всех ролей
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Право</th>
                    {roles?.map((role: NonNullable<typeof roles>[number]) => (
                      <th key={role.id} className="text-center py-3 px-4 font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: role.color || "#6366f1" }}
                          />
                          {role.nameRu || role.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionGroups.map((group) => (
                    <>
                      <tr key={group.label} className="bg-muted/50">
                        <td colSpan={(roles?.length || 0) + 1} className="py-2 px-4 font-semibold text-sm">
                          {group.label}
                        </td>
                      </tr>
                      {group.permissions.map((perm) => (
                        <tr key={perm.key} className="border-b">
                          <td className="py-2 px-4 text-sm">{perm.label}</td>
                          {roles?.map((role: NonNullable<typeof roles>[number]) => (
                            <td key={role.id} className="text-center py-2 px-4">
                              {(role.permissions as Permissions)?.[perm.key as keyof Permissions] ? (
                                <Badge className="bg-emerald-500">✓</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">—</Badge>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole?.id ? "Редактировать роль" : "Создать роль"}
            </DialogTitle>
            <DialogDescription>
              Настройте название, описание и права доступа для роли
            </DialogDescription>
          </DialogHeader>
          
          {editingRole && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (EN)</Label>
                  <Input
                    value={editingRole.name}
                    onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                    placeholder="manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Название (RU)</Label>
                  <Input
                    value={editingRole.nameRu}
                    onChange={(e) => setEditingRole({ ...editingRole, nameRu: e.target.value })}
                    placeholder="Менеджер"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  placeholder="Описание роли..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Цвет</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editingRole.color}
                      onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={editingRole.color}
                      onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Приоритет</Label>
                  <Input
                    type="number"
                    value={editingRole.priority}
                    onChange={(e) => setEditingRole({ ...editingRole, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Права доступа</Label>
                
                {permissionGroups.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">{group.label}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {group.permissions.map((perm) => (
                        <div
                          key={perm.key}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <Label htmlFor={perm.key} className="cursor-pointer">
                            {perm.label}
                          </Label>
                          <Switch
                            id={perm.key}
                            checked={editingRole.permissions[perm.key as keyof Permissions]}
                            onCheckedChange={(checked) => handlePermissionChange(perm.key as keyof Permissions, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
            >
              {createRoleMutation.isPending || updateRoleMutation.isPending 
                ? "Сохранение..." 
                : "Сохранить"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить роль?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить роль "{roleToDelete?.name}"?
              Пользователи с этой ролью потеряют связанные права.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
