/**
 * Admin Pages Index - Main admin entry point with routing
 */

import AdminLayout from "@/components/AdminLayout";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load admin pages
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminAgents = lazy(() => import("./AdminAgents"));
const AdminSkills = lazy(() => import("./AdminSkills"));
const AdminMCP = lazy(() => import("./AdminMCP"));
const AdminUsers = lazy(() => import("./AdminUsers"));
const AdminRoles = lazy(() => import("./AdminRoles"));
const AdminCredits = lazy(() => import("./AdminCredits"));
const AdminLimits = lazy(() => import("./AdminLimits"));
const AdminTariffs = lazy(() => import("./AdminTariffs"));
const AdminModelCosts = lazy(() => import("./AdminModelCosts"));

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
  return (
    <AdminLayout>
      <Suspense fallback={<AdminLoader />}>
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/agents" component={AdminAgents} />
          <Route path="/admin/skills" component={AdminSkills} />
          <Route path="/admin/prompts">{() => <PlaceholderPage title="Промпты" />}</Route>
          <Route path="/admin/mcp" component={AdminMCP} />
          <Route path="/admin/orchestrator">{() => <PlaceholderPage title="Оркестратор" />}</Route>
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/roles" component={AdminRoles} />
          <Route path="/admin/credits" component={AdminCredits} />
          <Route path="/admin/limits" component={AdminLimits} />
          <Route path="/admin/tariffs" component={AdminTariffs} />
          <Route path="/admin/model-costs" component={AdminModelCosts} />
          <Route path="/admin/projects">{() => <PlaceholderPage title="Проекты" />}</Route>
          <Route path="/admin/templates">{() => <PlaceholderPage title="Шаблоны" />}</Route>
          <Route path="/admin/branding">{() => <PlaceholderPage title="Брендинг" />}</Route>
          <Route path="/admin/navbar">{() => <PlaceholderPage title="Навбар" />}</Route>
          <Route path="/admin/localization">{() => <PlaceholderPage title="Локализация" />}</Route>
          <Route path="/admin/webhooks">{() => <PlaceholderPage title="Webhooks" />}</Route>
          <Route path="/admin/api-keys">{() => <PlaceholderPage title="API ключи" />}</Route>
          <Route path="/admin/notifications">{() => <PlaceholderPage title="Уведомления" />}</Route>
          <Route path="/admin/logs">{() => <PlaceholderPage title="Логи и аналитика" />}</Route>
          <Route>{() => <PlaceholderPage title="Страница не найдена" />}</Route>
        </Switch>
      </Suspense>
    </AdminLayout>
  );
}
