/**
 * Admin Pages Index - Main admin entry point with routing
 */

import AdminLayout from "@/components/AdminLayout";
import { Route, Switch } from "wouter";
import { lazy, Suspense, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";

// Lazy load admin pages
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminAgents = lazy(() => import("./AdminAgents"));
const AdminSkills = lazy(() => import("./AdminSkills"));
const AdminPrompts = lazy(() => import("./AdminPrompts"));
const AdminMCP = lazy(() => import("./AdminMCP"));
const AdminUsers = lazy(() => import("./AdminUsers"));
const AdminRoles = lazy(() => import("./AdminRoles"));
const AdminCredits = lazy(() => import("./AdminCredits"));
const AdminLimits = lazy(() => import("./AdminLimits"));
const AdminTariffs = lazy(() => import("./AdminTariffs"));
const AdminModelCosts = lazy(() => import("./AdminModelCosts"));
const AdminProjects = lazy(() => import("./AdminProjects"));
const AdminTemplates = lazy(() => import("./AdminTemplates"));

// Stage 4 pages
const AdminBranding = lazy(() => import("./AdminBranding"));
const AdminNavbar = lazy(() => import("./AdminNavbar"));
const AdminLocalization = lazy(() => import("./AdminLocalization"));
const AdminWebhooks = lazy(() => import("./AdminWebhooks"));
const AdminApiKeys = lazy(() => import("./AdminApiKeys"));
const AdminNotifications = lazy(() => import("./AdminNotifications"));
const AdminLogs = lazy(() => import("./AdminLogs"));

// Placeholder pages for future implementation
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Loader2 className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground">Этот раздел находится в разработке</p>
    </div>
  );
}

function AdminLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  );
}

export default function AdminIndex() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <AdminLayout>
      {/* Global Search Button - Fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="gap-2 bg-background/80 backdrop-blur-sm"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Поиск</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-muted rounded ml-2">
            ⌘/
          </kbd>
        </Button>
      </div>

      {/* Global Search Dialog */}
      <AdminGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <Suspense fallback={<AdminLoader />}>
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          
          {/* AI Configuration */}
          <Route path="/admin/agents" component={AdminAgents} />
          <Route path="/admin/skills" component={AdminSkills} />
          <Route path="/admin/prompts" component={AdminPrompts} />
          <Route path="/admin/mcp" component={AdminMCP} />
          <Route path="/admin/orchestrator">{() => <PlaceholderPage title="Оркестратор" />}</Route>
          
          {/* Users */}
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/roles" component={AdminRoles} />
          
          {/* Credits */}
          <Route path="/admin/credits" component={AdminCredits} />
          <Route path="/admin/limits" component={AdminLimits} />
          <Route path="/admin/tariffs" component={AdminTariffs} />
          <Route path="/admin/model-costs" component={AdminModelCosts} />
          
          {/* Content */}
          <Route path="/admin/projects" component={AdminProjects} />
          <Route path="/admin/templates" component={AdminTemplates} />
          
          {/* UI Settings (Stage 4) */}
          <Route path="/admin/branding" component={AdminBranding} />
          <Route path="/admin/navbar" component={AdminNavbar} />
          <Route path="/admin/localization" component={AdminLocalization} />
          
          {/* Integrations (Stage 4) */}
          <Route path="/admin/webhooks" component={AdminWebhooks} />
          <Route path="/admin/api-keys" component={AdminApiKeys} />
          <Route path="/admin/notifications" component={AdminNotifications} />
          
          {/* Logs (Stage 4) */}
          <Route path="/admin/logs" component={AdminLogs} />
          
          {/* Fallback */}
          <Route>{() => <PlaceholderPage title="Страница не найдена" />}</Route>
        </Switch>
      </Suspense>
    </AdminLayout>
  );
}
