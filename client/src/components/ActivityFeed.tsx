import { trpc } from "@/lib/trpc";
import { 
  Activity, 
  CheckCircle2, 
  Plus, 
  Edit3, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  MessageSquare,
  Clock,
  AlertTriangle,
  Target,
  Users,
  Loader2,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "wouter";

// Action type to icon/color mapping
const actionConfig: Record<string, { 
  icon: typeof Activity; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  task_created: { 
    icon: Plus, 
    color: "text-green-400", 
    bgColor: "bg-green-500/20",
    label: "создал(а) задачу"
  },
  task_updated: { 
    icon: Edit3, 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/20",
    label: "обновил(а) задачу"
  },
  task_completed: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bgColor: "bg-emerald-500/20",
    label: "завершил(а) задачу"
  },
  task_deleted: { 
    icon: Trash2, 
    color: "text-red-400", 
    bgColor: "bg-red-500/20",
    label: "удалил(а) задачу"
  },
  subtask_created: { 
    icon: Plus, 
    color: "text-cyan-400", 
    bgColor: "bg-cyan-500/20",
    label: "добавил(а) подзадачу"
  },
  subtask_completed: { 
    icon: CheckCircle2, 
    color: "text-cyan-400", 
    bgColor: "bg-cyan-500/20",
    label: "завершил(а) подзадачу"
  },
  comment_added: { 
    icon: MessageSquare, 
    color: "text-purple-400", 
    bgColor: "bg-purple-500/20",
    label: "добавил(а) комментарий"
  },
  comment_edited: { 
    icon: Edit3, 
    color: "text-purple-400", 
    bgColor: "bg-purple-500/20",
    label: "изменил(а) комментарий"
  },
  member_invited: { 
    icon: UserPlus, 
    color: "text-amber-400", 
    bgColor: "bg-amber-500/20",
    label: "пригласил(а) участника"
  },
  member_joined: { 
    icon: Users, 
    color: "text-amber-400", 
    bgColor: "bg-amber-500/20",
    label: "присоединился к проекту"
  },
  member_removed: { 
    icon: UserMinus, 
    color: "text-red-400", 
    bgColor: "bg-red-500/20",
    label: "удалил(а) участника"
  },
  block_created: { 
    icon: Plus, 
    color: "text-indigo-400", 
    bgColor: "bg-indigo-500/20",
    label: "создал(а) блок"
  },
  block_updated: { 
    icon: Edit3, 
    color: "text-indigo-400", 
    bgColor: "bg-indigo-500/20",
    label: "обновил(а) блок"
  },
  section_created: { 
    icon: Plus, 
    color: "text-teal-400", 
    bgColor: "bg-teal-500/20",
    label: "создал(а) раздел"
  },
  section_updated: { 
    icon: Edit3, 
    color: "text-teal-400", 
    bgColor: "bg-teal-500/20",
    label: "обновил(а) раздел"
  },
  project_updated: { 
    icon: Edit3, 
    color: "text-slate-400", 
    bgColor: "bg-slate-500/20",
    label: "обновил(а) проект"
  },
  deadline_set: { 
    icon: Clock, 
    color: "text-orange-400", 
    bgColor: "bg-orange-500/20",
    label: "установил(а) дедлайн"
  },
  priority_changed: { 
    icon: AlertTriangle, 
    color: "text-yellow-400", 
    bgColor: "bg-yellow-500/20",
    label: "изменил(а) приоритет"
  },
  assignment_changed: { 
    icon: Target, 
    color: "text-pink-400", 
    bgColor: "bg-pink-500/20",
    label: "назначил(а) задачу"
  },
};

interface ActivityFeedProps {
  projectId?: number;
  limit?: number;
  showProjectName?: boolean;
  compact?: boolean;
}

export function ActivityFeed({ 
  projectId, 
  limit = 20, 
  showProjectName = true,
  compact = false 
}: ActivityFeedProps) {
  // Use dashboard activity if no projectId, otherwise project-specific
  const dashboardQuery = trpc.team.getDashboardActivity.useQuery(
    { limit },
    { enabled: !projectId }
  );
  
  const projectQuery = trpc.team.getProjectActivity.useQuery(
    { projectId: projectId!, limit },
    { enabled: !!projectId }
  );
  
  const { data: activities, isLoading } = projectId ? projectQuery : dashboardQuery;
  
  // Get initials from name
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  // Generate color from name
  const getAvatarColor = (name: string | null) => {
    if (!name) return "bg-slate-600";
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
      "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500"
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };
  
  // Format time
  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true, locale: ru });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }
  
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-400">Нет активности</p>
        <p className="text-sm text-slate-500 mt-1">
          Действия команды будут отображаться здесь
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      {activities.map((activity) => {
        const config = actionConfig[activity.action] || {
          icon: Activity,
          color: "text-slate-400",
          bgColor: "bg-slate-500/20",
          label: activity.action
        };
        const Icon = config.icon;
        
        return (
          <div
            key={activity.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/30 transition-colors group",
              compact && "p-2"
            )}
          >
            {/* User avatar */}
            <div className={cn(
              "rounded-full flex items-center justify-center text-white font-medium shrink-0",
              compact ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm",
              getAvatarColor(activity.user?.name || null)
            )}>
              {activity.user?.avatar ? (
                <img 
                  src={activity.user.avatar} 
                  alt={activity.user.name || ""} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(activity.user?.name || null)
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "font-medium text-slate-200",
                  compact && "text-sm"
                )}>
                  {activity.user?.name || "Пользователь"}
                </span>
                <span className={cn(
                  "text-slate-400",
                  compact && "text-sm"
                )}>
                  {config.label}
                </span>
                {/* Action icon */}
                <span className={cn(
                  "p-1 rounded",
                  config.bgColor
                )}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </span>
              </div>
              
              {/* Entity title */}
              {activity.entityTitle && (
                <p className={cn(
                  "text-slate-300 mt-0.5 truncate",
                  compact ? "text-sm" : "text-sm"
                )}>
                  "{activity.entityTitle}"
                </p>
              )}
              
              {/* Project name and time */}
              <div className="flex items-center gap-2 mt-1">
                {showProjectName && 'project' in activity && (activity as any).project && (
                  <Link 
                    href={`/project/${(activity as any).project.id}`}
                    className="text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
                  >
                    {(activity as any).project.name}
                  </Link>
                )}
                {showProjectName && 'project' in activity && (activity as any).project && (
                  <span className="text-slate-600">•</span>
                )}
                <span className="text-xs text-slate-500">
                  {formatTime(activity.createdAt)}
                </span>
              </div>
            </div>
            
            {/* Navigate arrow */}
            {'project' in activity && (activity as any).project && (
              <Link 
                href={`/project/${(activity as any).project.id}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-700 rounded"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact activity item for sidebar
interface ActivityItemProps {
  action: string;
  userName: string | null;
  entityTitle: string | null;
  createdAt: Date | string;
}

export function ActivityItem({ action, userName, entityTitle, createdAt }: ActivityItemProps) {
  const config = actionConfig[action] || {
    icon: Activity,
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    label: action
  };
  const Icon = config.icon;
  
  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true, locale: ru });
  };
  
  return (
    <div className="flex items-start gap-2 py-2">
      <span className={cn("p-1 rounded shrink-0", config.bgColor)}>
        <Icon className={cn("w-3 h-3", config.color)} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 truncate">
          <span className="font-medium">{userName || "Пользователь"}</span>
          {" "}{config.label}
        </p>
        {entityTitle && (
          <p className="text-xs text-slate-500 truncate">"{entityTitle}"</p>
        )}
        <p className="text-xs text-slate-600 mt-0.5">{formatTime(createdAt)}</p>
      </div>
    </div>
  );
}
