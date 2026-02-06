/**
 * AdminBreadcrumbs - Navigation breadcrumbs for admin panel
 * Shows current location path with clickable links
 */

import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

// Breadcrumb mapping for all admin routes
const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  "/admin": { label: "Dashboard" },
  "/admin/logs": { label: "Логи и аналитика", parent: "/admin" },
  
  // AI Configuration
  "/admin/agents": { label: "Агенты", parent: "/admin" },
  "/admin/skills": { label: "Скиллы", parent: "/admin" },
  "/admin/prompts": { label: "Промпты", parent: "/admin" },
  "/admin/mcp": { label: "MCP Серверы", parent: "/admin" },
  "/admin/orchestrator": { label: "Оркестратор", parent: "/admin" },
  
  // Users
  "/admin/users": { label: "Пользователи", parent: "/admin" },
  "/admin/roles": { label: "Роли и права", parent: "/admin" },
  
  // Credits
  "/admin/credits": { label: "Баланс кредитов", parent: "/admin" },
  "/admin/limits": { label: "Лимиты", parent: "/admin" },
  "/admin/tariffs": { label: "Тарифы", parent: "/admin" },
  "/admin/model-costs": { label: "Стоимость моделей", parent: "/admin" },
  
  // Content
  "/admin/projects": { label: "Проекты", parent: "/admin" },
  "/admin/templates": { label: "Шаблоны", parent: "/admin" },
  
  // Settings
  "/admin/branding": { label: "Брендинг", parent: "/admin" },
  "/admin/navbar": { label: "Навбар", parent: "/admin" },
  "/admin/localization": { label: "Локализация", parent: "/admin" },
  "/admin/webhooks": { label: "Webhooks", parent: "/admin" },
  "/admin/api-keys": { label: "API ключи", parent: "/admin" },
  "/admin/notifications": { label: "Уведомления", parent: "/admin" },
};

// Get group label for a path
function getGroupLabel(path: string): string | null {
  const groupMap: Record<string, string[]> = {
    "AI Конфигурация": ["/admin/agents", "/admin/skills", "/admin/prompts", "/admin/mcp", "/admin/orchestrator"],
    "Пользователи": ["/admin/users", "/admin/roles"],
    "Кредиты": ["/admin/credits", "/admin/limits", "/admin/tariffs", "/admin/model-costs"],
    "Контент": ["/admin/projects", "/admin/templates"],
    "Настройки": ["/admin/branding", "/admin/navbar", "/admin/localization", "/admin/webhooks", "/admin/api-keys", "/admin/notifications"],
  };
  
  for (const [group, paths] of Object.entries(groupMap)) {
    if (paths.includes(path)) {
      return group;
    }
  }
  return null;
}

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

export function AdminBreadcrumbs() {
  const [location] = useLocation();
  
  // Build breadcrumb trail
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    
    // Always start with Admin home
    items.push({ label: "Админ-панель", path: "/admin", isLast: location === "/admin" });
    
    if (location === "/admin") {
      return items;
    }
    
    // Add group label if applicable
    const groupLabel = getGroupLabel(location);
    if (groupLabel) {
      items.push({ label: groupLabel, path: "", isLast: false });
    }
    
    // Add current page
    const currentPage = breadcrumbMap[location];
    if (currentPage) {
      items.push({ label: currentPage.label, path: location, isLast: true });
    }
    
    return items;
  };
  
  const breadcrumbs = buildBreadcrumbs();
  
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link href="/admin">
        <button className="p-1 hover:bg-accent rounded transition-colors">
          <Home className="h-4 w-4" />
        </button>
      </Link>
      
      {breadcrumbs.slice(1).map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          {item.path && !item.isLast ? (
            <Link href={item.path}>
              <button className={cn(
                "px-2 py-1 rounded transition-colors hover:bg-accent hover:text-foreground",
                item.isLast && "text-foreground font-medium"
              )}>
                {item.label}
              </button>
            </Link>
          ) : (
            <span className={cn(
              "px-2 py-1",
              item.isLast ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
