import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import AIIntegrations from "./pages/AIIntegrations";
import Pricing from "./pages/Pricing";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import NotificationSettings from "./pages/NotificationSettings";
import TeamManagement from "./pages/TeamManagement";
import JoinProject from "./pages/JoinProject";
import Analytics from "./pages/Analytics";
import CommunityTemplates from "./pages/CommunityTemplates";

function Router() {
  return (
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
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
