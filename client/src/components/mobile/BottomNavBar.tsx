import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  FolderKanban,
  CheckSquare,
  Bell,
  User,
  Plus,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

interface NavItem {
  href: string;
  icon: typeof Home;
  label: string;
  badge?: number;
}

interface BottomNavBarProps {
  onNewProject?: () => void;
  className?: string;
}

export function BottomNavBar({ onNewProject, className }: BottomNavBarProps) {
  const [location] = useLocation();

  // Get unread notifications count
  const { data: notificationsData } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const navItems: NavItem[] = [
    { href: "/", icon: Home, label: "Главная" },
    { href: "/projects", icon: FolderKanban, label: "Проекты" },
    { href: "/my-tasks", icon: CheckSquare, label: "Задачи" },
    {
      href: "/notifications",
      icon: Bell,
      label: "Уведомления",
      badge: typeof notificationsData === 'number' ? notificationsData : 0,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-around h-16 px-2",
        className
      )}
    >
      {navItems.slice(0, 2).map((item) => (
        <NavButton
          key={item.href}
          item={item}
          isActive={isActive(item.href)}
        />
      ))}

      {/* Center FAB button */}
      <div className="relative -mt-6">
        <Button
          size="lg"
          onClick={onNewProject}
          className="h-14 w-14 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/25"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {navItems.slice(2).map((item) => (
        <NavButton
          key={item.href}
          item={item}
          isActive={isActive(item.href)}
        />
      ))}
    </div>
  );
}

function NavButton({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link href={item.href}>
      <button
        className={cn(
          "flex flex-col items-center justify-center w-16 h-full gap-0.5 transition-colors",
          isActive
            ? "text-amber-500"
            : "text-slate-400 hover:text-slate-300"
        )}
      >
        <div className="relative">
          <Icon className="h-5 w-5" />
          {item.badge && item.badge > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
        <span className="text-[10px] font-medium">{item.label}</span>
      </button>
    </Link>
  );
}

// Compact version for project view
export function ProjectBottomNav({
  projectId,
  onAddTask,
  className,
}: {
  projectId: number;
  onAddTask?: () => void;
  className?: string;
}) {
  const [location] = useLocation();

  const projectNavItems = [
    { href: `/project/${projectId}`, icon: LayoutGrid, label: "Обзор" },
    { href: `/project/${projectId}/tasks`, icon: CheckSquare, label: "Задачи" },
    { href: `/project/${projectId}/analytics`, icon: Home, label: "Аналитика" },
    { href: `/project/${projectId}/team`, icon: User, label: "Команда" },
  ];

  return (
    <div
      className={cn(
        "flex items-center justify-around h-14 px-2 bg-slate-900/95",
        className
      )}
    >
      {projectNavItems.slice(0, 2).map((item) => (
        <Link key={item.href} href={item.href}>
          <button
            className={cn(
              "flex flex-col items-center justify-center w-14 h-full gap-0.5 transition-colors",
              location === item.href
                ? "text-amber-500"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        </Link>
      ))}

      {/* Center add button */}
      <Button
        size="sm"
        onClick={onAddTask}
        className="h-10 w-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900"
      >
        <Plus className="h-5 w-5" />
      </Button>

      {projectNavItems.slice(2).map((item) => (
        <Link key={item.href} href={item.href}>
          <button
            className={cn(
              "flex flex-col items-center justify-center w-14 h-full gap-0.5 transition-colors",
              location === item.href
                ? "text-amber-500"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        </Link>
      ))}
    </div>
  );
}
