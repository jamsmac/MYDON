import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface NotificationData {
  projectId?: number;
  taskId?: number;
  commentId?: number;
  [key: string]: unknown;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  data: NotificationData | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "task_assigned":
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case "task_completed":
      return <Check className="h-4 w-4 text-emerald-500" />;
    case "task_overdue":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "comment_added":
    case "comment_mention":
      return <MessageSquare className="h-4 w-4 text-amber-500" />;
    case "project_invite":
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case "project_update":
      return <FileText className="h-4 w-4 text-slate-500" />;
    case "deadline_reminder":
      return <Calendar className="h-4 w-4 text-orange-500" />;
    default:
      return <Bell className="h-4 w-4 text-slate-400" />;
  }
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  
  // Fetch notifications
  const { data: notificationsData, refetch } = trpc.notifications.list.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );
  
  // Get unread count
  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 15000 } // Refetch every 15 seconds
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
  
  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ id: notification.id });
    }
    
    // Navigate based on notification type
    const data = notification.data as NotificationData | null;
    if (data?.projectId) {
      window.location.href = `/roadmap/${data.projectId}`;
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Уведомления</h3>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending || unreadCount === 0}
                  className="h-8 px-2"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Прочитать все
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  className="h-8 px-2 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Notifications list */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-20" />
              <p>Нет уведомлений</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.isRead ? "font-semibold" : ""}`}>
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate({ id: notification.id });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {notification.message && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm"
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
