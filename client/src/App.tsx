import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2 } from "lucide-react";
import { AchievementNotificationProvider } from "@/components/gamification/AchievementNotificationProvider";
import { AIChatWidget } from "@/components/AIChatWidget";
import { ProjectContextProvider } from "@/contexts/ProjectContext";

// Eager load critical pages
import Dashboard from "./pages/Dashboard";
import NotFound from "@/pages/NotFound";

// Lazy load secondary pages for better initial bundle size
const ProjectView = lazy(() => import("./pages/ProjectView"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AIIntegrations = lazy(() => import("./pages/AIIntegrations"));
const Pricing = lazy(() => import("./pages/Pricing"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const JoinProject = lazy(() => import("./pages/JoinProject"));
const Analytics = lazy(() => import("./pages/Analytics"));
const CommunityTemplates = lazy(() => import("./pages/CommunityTemplates"));
const WebhooksManagement = lazy(() => import("./pages/WebhooksManagement"));
const ApiKeysManagement = lazy(() => import("./pages/ApiKeysManagement"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const GamificationPage = lazy(() => import("./pages/GamificationPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const TagManagement = lazy(() => import("./pages/TagManagement"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-slate-400 text-sm">Загрузка...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/project/:id" component={ProjectView} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/integrations" component={AIIntegrations} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/subscription/success" component={SubscriptionSuccess} />
        <Route path="/settings/notifications" component={NotificationSettings} />
        <Route path="/project/:id/team" component={TeamManagement} />
        <Route path="/project/:id/analytics" component={Analytics} />
        <Route path="/join/:code" component={JoinProject} />
        <Route path="/templates" component={CommunityTemplates} />
        <Route path="/settings/webhooks" component={WebhooksManagement} />
        <Route path="/settings/api-keys" component={ApiKeysManagement} />
        <Route path="/api-docs" component={ApiDocs} />
        <Route path="/achievements" component={GamificationPage} />
        <Route path="/ai-chat" component={AIChatPage} />
        <Route path="/project/:id/tags" component={TagManagement} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ProjectContextProvider>
        <TooltipProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: "'Inter', system-ui, sans-serif",
              },
            }}
          />
          <Router />
          <AchievementNotificationProvider />
          <AIChatWidget />
        </TooltipProvider>
        </ProjectContextProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
