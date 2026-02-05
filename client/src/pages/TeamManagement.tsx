import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  Edit3, 
  Eye, 
  MoreVertical,
  Copy,
  Trash2,
  Mail,
  Link as LinkIcon,
  Check,
  Loader2,
  ArrowLeft,
  Clock,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

// Role configuration
const roleConfig = {
  owner: { 
    label: "Владелец", 
    icon: Crown, 
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    description: "Полный доступ ко всем функциям"
  },
  admin: { 
    label: "Администратор", 
    icon: Shield, 
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    description: "Управление участниками и настройками"
  },
  editor: { 
    label: "Редактор", 
    icon: Edit3, 
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    description: "Редактирование задач и контента"
  },
  viewer: { 
    label: "Наблюдатель", 
    icon: Eye, 
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    description: "Только просмотр"
  },
};

export default function TeamManagement() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const projectId = parseInt(params.id || "0");
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Fetch project info
  const { data: project } = trpc.project.get.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );
  
  // Fetch team members
  const { data: teamData, isLoading, refetch } = trpc.team.getMembers.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  // Fetch pending invitations
  const { data: pendingInvites, refetch: refetchInvites } = trpc.team.getPendingInvites.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  // Mutations
  const inviteMutation = trpc.team.inviteMember.useMutation({
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      setGeneratedLink(fullUrl);
      refetchInvites();
      toast.success("Приглашение создано");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const updateRoleMutation = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Роль обновлена");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Участник удален");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const cancelInviteMutation = trpc.team.cancelInvite.useMutation({
    onSuccess: () => {
      refetchInvites();
      toast.success("Приглашение отменено");
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Helpers
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  const getAvatarColor = (name: string | null) => {
    if (!name) return "bg-slate-600";
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
      "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500"
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  const formatTime = (date: Date | string | null) => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true, locale: ru });
  };
  
  const handleInvite = () => {
    inviteMutation.mutate({
      projectId,
      email: inviteEmail || undefined,
      role: inviteRole,
    });
  };
  
  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Ссылка скопирована");
    }
  };
  
  const resetInviteDialog = () => {
    setInviteEmail("");
    setInviteRole("editor");
    setGeneratedLink(null);
    setCopiedLink(false);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/project/${projectId}`)}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  Команда проекта
                </h1>
                <p className="text-sm text-slate-400">{project?.name}</p>
              </div>
            </div>
            
            <Button
              onClick={() => {
                resetInviteDialog();
                setInviteDialogOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Пригласить
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Members list */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  Участники ({(teamData?.members?.length || 0) + (teamData?.owner ? 1 : 0)})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Owner */}
                {teamData?.owner && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-amber-500/20">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-white font-medium",
                      getAvatarColor(teamData.owner.name)
                    )}>
                      {teamData.owner.avatar ? (
                        <img 
                          src={teamData.owner.avatar} 
                          alt={teamData.owner.name || ""} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        getInitials(teamData.owner.name)
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {teamData.owner.name || "Без имени"}
                      </p>
                      <p className="text-sm text-slate-400 truncate">
                        {teamData.owner.email}
                      </p>
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      roleConfig.owner.bgColor,
                      roleConfig.owner.color
                    )}>
                      <Crown className="w-3.5 h-3.5" />
                      {roleConfig.owner.label}
                    </div>
                  </div>
                )}
                
                {/* Members */}
                {teamData?.members?.map((member) => {
                  const role = roleConfig[member.role as keyof typeof roleConfig] || roleConfig.viewer;
                  const RoleIcon = role.icon;
                  
                  return (
                    <div 
                      key={member.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-white font-medium",
                        getAvatarColor(member.user?.name || null)
                      )}>
                        {member.user?.avatar ? (
                          <img 
                            src={member.user.avatar} 
                            alt={member.user.name || ""} 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getInitials(member.user?.name || null)
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {member.user?.name || "Без имени"}
                        </p>
                        <p className="text-sm text-slate-400 truncate">
                          {member.user?.email}
                        </p>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        role.bgColor,
                        role.color
                      )}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {role.label}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem
                            onClick={() => updateRoleMutation.mutate({
                              memberId: member.id,
                              projectId,
                              role: "admin"
                            })}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            <Shield className="w-4 h-4 mr-2 text-blue-400" />
                            Сделать админом
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateRoleMutation.mutate({
                              memberId: member.id,
                              projectId,
                              role: "editor"
                            })}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            <Edit3 className="w-4 h-4 mr-2 text-green-400" />
                            Сделать редактором
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateRoleMutation.mutate({
                              memberId: member.id,
                              projectId,
                              role: "viewer"
                            })}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            <Eye className="w-4 h-4 mr-2 text-slate-400" />
                            Сделать наблюдателем
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => removeMemberMutation.mutate({
                              memberId: member.id,
                              projectId
                            })}
                            className="text-red-400 focus:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить из команды
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
                
                {(!teamData?.members || teamData.members.length === 0) && (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Пока нет участников</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Пригласите коллег для совместной работы
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Pending invitations */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Ожидающие приглашения
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingInvites && pendingInvites.length > 0 ? (
                  pendingInvites.map((invite) => (
                    <div 
                      key={invite.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30"
                    >
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                        {invite.email ? (
                          <Mail className="w-4 h-4 text-slate-400" />
                        ) : (
                          <LinkIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">
                          {invite.email || "Ссылка-приглашение"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {roleConfig[invite.role as keyof typeof roleConfig]?.label || invite.role}
                          {" • "}
                          {formatTime(invite.createdAt)}
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInviteMutation.mutate({ invitationId: invite.id })}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Нет ожидающих приглашений</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Role descriptions */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-base">Роли и права</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(roleConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-start gap-3">
                      <div className={cn(
                        "p-1.5 rounded",
                        config.bgColor
                      )}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{config.label}</p>
                        <p className="text-xs text-slate-400">{config.description}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Пригласить участника</DialogTitle>
            <DialogDescription className="text-slate-400">
              Создайте ссылку-приглашение или отправьте приглашение на email
            </DialogDescription>
          </DialogHeader>
          
          {!generatedLink ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Email (необязательно)</Label>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-500">
                    Оставьте пустым для создания общей ссылки-приглашения
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-200">Роль</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="admin" className="text-slate-200">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-400" />
                          Администратор
                        </div>
                      </SelectItem>
                      <SelectItem value="editor" className="text-slate-200">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-green-400" />
                          Редактор
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer" className="text-slate-200">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-slate-400" />
                          Наблюдатель
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  className="border-slate-600 text-slate-300"
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={inviteMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Создать приглашение
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">Ссылка-приглашение:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-amber-400 bg-slate-800 px-3 py-2 rounded truncate">
                      {generatedLink}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="border-slate-600 shrink-0"
                    >
                      {copiedLink ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <p className="text-sm text-slate-400">
                  Отправьте эту ссылку коллеге. Ссылка действительна 7 дней.
                </p>
              </div>
              
              <DialogFooter>
                <Button
                  onClick={() => {
                    resetInviteDialog();
                    setInviteDialogOpen(false);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                >
                  Готово
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
