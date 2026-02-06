/**
 * AdminLayout - Sidebar navigation for admin panel
 * Collapsible sidebar with grouped menu items
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Bot, 
  Zap, 
  MessageSquare,
  Server,
  Activity,
  Users,
  UserCog,
  Coins,
  TrendingUp,
  Receipt,
  FolderKanban,
  FileText,
  Palette,
  Navigation,
  Languages,
  Webhook,
  Key,
  Bell,
  ScrollText,
  Shield,
  ArrowLeft,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { CSSProperties, useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Menu structure with groups - consolidated for cleaner navigation
const menuGroups = [
  {
    id: "overview",
    label: "Обзор",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
      { icon: ScrollText, label: "Логи и аналитика", path: "/admin/logs" },
    ],
  },
  {
    id: "ai",
    label: "AI Конфигурация",
    items: [
      { icon: Bot, label: "Агенты", path: "/admin/agents" },
      { icon: Zap, label: "Скиллы", path: "/admin/skills" },
      { icon: MessageSquare, label: "Промпты", path: "/admin/prompts" },
      { icon: Server, label: "MCP Серверы", path: "/admin/mcp" },
      { icon: Activity, label: "Оркестратор", path: "/admin/orchestrator" },
    ],
  },
  {
    id: "users",
    label: "Пользователи",
    items: [
      { icon: Users, label: "Список", path: "/admin/users" },
      { icon: UserCog, label: "Роли и права", path: "/admin/roles" },
    ],
  },
  {
    id: "credits",
    label: "Кредиты",
    items: [
      { icon: Coins, label: "Баланс", path: "/admin/credits" },
      { icon: TrendingUp, label: "Лимиты", path: "/admin/limits" },
      { icon: Receipt, label: "Тарифы", path: "/admin/tariffs" },
      { icon: Bot, label: "Стоимость моделей", path: "/admin/model-costs" },
    ],
  },
  {
    id: "content",
    label: "Контент",
    items: [
      { icon: FolderKanban, label: "Проекты", path: "/admin/projects" },
      { icon: FileText, label: "Шаблоны", path: "/admin/templates" },
    ],
  },
  {
    id: "settings",
    label: "Настройки",
    items: [
      { icon: Palette, label: "Брендинг", path: "/admin/branding" },
      { icon: Navigation, label: "Навбар", path: "/admin/navbar" },
      { icon: Languages, label: "Локализация", path: "/admin/localization" },
      { icon: Webhook, label: "Webhooks", path: "/admin/webhooks" },
      { icon: Key, label: "API ключи", path: "/admin/api-keys" },
      { icon: Bell, label: "Уведомления", path: "/admin/notifications" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 260;

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <Shield className="w-16 h-16 text-amber-400" />
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Войдите для продолжения
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Доступ к админ-панели требует авторизации.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Войти
          </Button>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Shield className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold">Доступ запрещён</h1>
        <p className="text-muted-foreground">Эта страница доступна только администраторам</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            На главную
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  );
}

function AdminLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isMobile = useIsMobile();
  
  // Track which groups are expanded - only expand the group containing active item
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    // Find which group contains the current path
    const activeGroup = menuGroups.find(g => 
      g.items.some(item => location === item.path || location.startsWith(item.path + "/"))
    );
    return activeGroup ? [activeGroup.id] : ["overview"];
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Find active menu item
  const activeItem = menuGroups
    .flatMap(g => g.items)
    .find(item => location === item.path || location.startsWith(item.path + "/"));

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-border/50">
        <SidebarHeader className="h-16 justify-center border-b border-border/50">
          <div className="flex items-center gap-3 px-2 transition-all w-full">
            <button
              onClick={toggleSidebar}
              className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              aria-label="Toggle navigation"
            >
              <PanelLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="font-semibold tracking-tight truncate text-amber-400">
                  Админ-панель
                </span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="gap-0 overflow-y-auto">
          {menuGroups.map((group) => (
            <SidebarGroup key={group.id} className="py-1">
              {!isCollapsed ? (
                <Collapsible
                  open={expandedGroups.includes(group.id)}
                  onOpenChange={() => toggleGroup(group.id)}
                >
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <span>{group.label}</span>
                      {expandedGroups.includes(group.id) ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="px-1">
                        {group.items.map((item) => {
                          const isActive = location === item.path || location.startsWith(item.path + "/");
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => setLocation(item.path)}
                                tooltip={item.label}
                                className={cn(
                                  "h-9 transition-all font-normal",
                                  isActive && "bg-amber-500/10 text-amber-400 border-l-2 border-amber-400"
                                )}
                              >
                                <item.icon className={cn("h-4 w-4", isActive && "text-amber-400")} />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                // Collapsed mode - show only icons
                <SidebarMenu className="px-1">
                  {group.items.map((item) => {
                    const isActive = location === item.path || location.startsWith(item.path + "/");
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={cn(
                            "h-9 transition-all",
                            isActive && "bg-amber-500/10 text-amber-400"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4", isActive && "text-amber-400")} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              )}
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-border/50">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {!isCollapsed && <span>На главную</span>}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-2">
                <Avatar className="h-9 w-9 border border-amber-500/30 shrink-0">
                  <AvatarFallback className="text-xs font-medium bg-amber-500/10 text-amber-400">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      Администратор
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="tracking-tight text-foreground font-medium">
                  {activeItem?.label ?? "Админ-панель"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 bg-background/50">{children}</main>
      </SidebarInset>
    </>
  );
}
