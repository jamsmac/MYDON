import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MessageSquare,
  UserPlus,
  Calendar,
  AlertCircle,
  FileText,
  Settings,
  X,
  Clock,
  AtSign,
  Sparkles,
  Mail,
  Users,
  Target,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationData {
  projectId?: number;
  taskId?: number;
  commentId?: number;
  userName?: string;
  userAvatar?: string;
  projectName?: string;
  taskName?: string;
  [key: string]: unknown;
}

// Notification type configurations with colors and icons
const notificationConfig: Record<string, {
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  label: string;
}> = {
  task_assigned: {
    icon: UserPlus,
    bgColor: "bg-gradient-to-br from-blue-500/20 to-blue-600/10",
    iconColor: "text-blue-400",
    borderColor: "border-l-blue-500",
    label: "Назначение",
  },
  task_completed: {
    icon: Check,
    bgColor: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10",
    iconColor: "text-emerald-400",
    borderColor: "border-l-emerald-500",
    label: "Завершено",
  },
  task_overdue: {
    icon: AlertCircle,
    bgColor: "bg-gradient-to-br from-red-500/20 to-red-600/10",
    iconColor: "text-red-400",
    borderColor: "border-l-red-500",
    label: "Просрочено",
  },
  comment_added: {
    icon: MessageSquare,
    bgColor: "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
    iconColor: "text-amber-400",
    borderColor: "border-l-amber-500",
    label: "Комментарий",
  },
  comment_mention: {
    icon: AtSign,
    bgColor: "bg-gradient-to-br from-purple-500/20 to-purple-600/10",
    iconColor: "text-purple-400",
    borderColor: "border-l-purple-500",
    label: "Упоминание",
  },
  project_invite: {
    icon: Users,
    bgColor: "bg-gradient-to-br from-indigo-500/20 to-indigo-600/10",
    iconColor: "text-indigo-400",
    borderColor: "border-l-indigo-500",
    label: "Приглашение",
  },
  project_update: {
    icon: FileText,
    bgColor: "bg-gradient-to-br from-slate-500/20 to-slate-600/10",
    iconColor: "text-slate-400",
    borderColor: "border-l-slate-500",
    label: "Обновление",
  },
  deadline_reminder: {
    icon: Calendar,
    bgColor: "bg-gradient-to-br from-orange-500/20 to-orange-600/10",
    iconColor: "text-orange-400",
    borderColor: "border-l-orange-500",
    label: "Дедлайн",
  },
  daily_digest: {
    icon: Mail,
    bgColor: "bg-gradient-to-br from-cyan-500/20 to-cyan-600/10",
    iconColor: "text-cyan-400",
    borderColor: "border-l-cyan-500",
    label: "Дайджест",
  },
  system: {
    icon: Zap,
    bgColor: "bg-gradient-to-br from-pink-500/20 to-pink-600/10",
    iconColor: "text-pink-400",
    borderColor: "border-l-pink-500",
    label: "Система",
  },
};

// Generate avatar from name
function getAvatarInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Avatar colors based on name hash
function getAvatarColor(name?: string): string {
  if (!name) return "from-slate-500 to-slate-600";
  const colors = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-purple-500 to-purple-600",
    "from-pink-500 to-pink-600",
    "from-indigo-500 to-indigo-600",
    "from-cyan-500 to-cyan-600",
    "from-orange-500 to-orange-600",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Group notifications by date
function groupByDate(notifications: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  const today: any[] = [];
  const yesterday: any[] = [];
  const earlier: any[] = [];

  notifications.forEach((n) => {
    const date = new Date(n.createdAt);
    if (isToday(date)) {
      today.push(n);
    } else if (isYesterday(date)) {
      yesterday.push(n);
    } else {
      earlier.push(n);
    }
  });

  if (today.length > 0) groups.push({ label: "Сегодня", items: today });
  if (yesterday.length > 0) groups.push({ label: "Вчера", items: yesterday });
  if (earlier.length > 0) groups.push({ label: "Ранее", items: earlier });

  return groups;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  // Fetch notifications
  const { data: notificationsData, refetch } = trpc.notifications.list.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 30000 }
  );

  // Get unread count
  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 15000 }
  );

  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const clearAllMutation = trpc.notifications.clearAll.useMutation({
    onSuccess: () => refetch(),
  });

  const notifications = notificationsData?.items || [];

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (!filter) return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  // Group by date
  const groupedNotifications = useMemo(
    () => groupByDate(filteredNotifications),
    [filteredNotifications]
  );

  // Get unique notification types for filter
  const notificationTypes = useMemo(() => {
    const types = new Set(notifications.map((n) => n.type));
    return Array.from(types);
  }, [notifications]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification.id });
    }

    const data = notification.data as NotificationData | null;
    if (data?.projectId) {
      setOpen(false);
      window.location.href = `/project/${data.projectId}`;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-slate-800 transition-colors"
        >
          <Bell className="h-5 w-5 text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs flex items-center justify-center font-bold shadow-lg shadow-red-500/30 animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0 bg-slate-900 border-slate-700 shadow-2xl shadow-black/50"
        align="end"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Bell className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Уведомления</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-slate-400">
                    {unreadCount} непрочитанных
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    disabled={markAllAsReadMutation.isPending || unreadCount === 0}
                    className="h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearAllMutation.mutate()}
                    disabled={clearAllMutation.isPending}
                    className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filter chips */}
          {notificationTypes.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <Badge
                variant={filter === null ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs transition-all",
                  filter === null
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                    : "bg-transparent border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                )}
                onClick={() => setFilter(null)}
              >
                Все
              </Badge>
              {notificationTypes.map((type) => {
                const config = notificationConfig[type] || notificationConfig.system;
                return (
                  <Badge
                    key={type}
                    variant={filter === type ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-all",
                      filter === type
                        ? `${config.iconColor} bg-opacity-20 border-current`
                        : "bg-transparent border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                    )}
                    onClick={() => setFilter(type)}
                  >
                    {config.label}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="h-[420px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-500">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 opacity-30" />
              </div>
              <p className="font-medium">Нет уведомлений</p>
              <p className="text-sm text-slate-600 mt-1">
                Здесь появятся ваши уведомления
              </p>
            </div>
          ) : (
            <div>
              {groupedNotifications.map((group) => (
                <div key={group.label}>
                  {/* Date group header */}
                  <div className="sticky top-0 z-10 px-4 py-2 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                  </div>

                  {/* Notifications in group */}
                  {group.items.map((notification) => {
                    const config =
                      notificationConfig[notification.type] ||
                      notificationConfig.system;
                    const Icon = config.icon;
                    const data = notification.data as NotificationData | null;
                    const hasUser = data?.userName;

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "group relative px-4 py-3 cursor-pointer transition-all duration-200",
                          "hover:bg-slate-800/50",
                          "border-l-2",
                          config.borderColor,
                          !notification.isRead && "bg-slate-800/30"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar or Icon */}
                          <div className="relative flex-shrink-0">
                            {hasUser ? (
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br",
                                  getAvatarColor(data?.userName)
                                )}
                              >
                                {getAvatarInitials(data?.userName)}
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center",
                                  config.bgColor
                                )}
                              >
                                <Icon className={cn("h-5 w-5", config.iconColor)} />
                              </div>
                            )}
                            {/* Type badge on avatar */}
                            {hasUser && (
                              <div
                                className={cn(
                                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-md flex items-center justify-center",
                                  config.bgColor,
                                  "border-2 border-slate-900"
                                )}
                              >
                                <Icon
                                  className={cn("h-2.5 w-2.5", config.iconColor)}
                                />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p
                                  className={cn(
                                    "text-sm leading-tight",
                                    !notification.isRead
                                      ? "font-semibold text-white"
                                      : "text-slate-300"
                                  )}
                                >
                                  {notification.title}
                                </p>
                                {notification.message && (
                                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                    {notification.message}
                                  </p>
                                )}
                                {/* Context info */}
                                {(data?.projectName || data?.taskName) && (
                                  <div className="flex items-center gap-2 mt-2">
                                    {data?.projectName && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400">
                                        <Target className="h-3 w-3" />
                                        {data.projectName}
                                      </span>
                                    )}
                                    {data?.taskName && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-xs text-slate-400">
                                        <FileText className="h-3 w-3" />
                                        {data.taskName}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Delete button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMutation.mutate({ id: notification.id });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Time */}
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: ru,
                              })}
                            </p>
                          </div>

                          {/* Unread indicator */}
                          {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mt-2 shrink-0 shadow-lg shadow-blue-500/50" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => {
              setOpen(false);
              window.location.href = "/settings/notifications";
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Настройки уведомлений
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
