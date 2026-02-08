import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft,
  Loader2,
  Plus,
  Key,
  CheckCircle,
  XCircle,
  ExternalLink,
  Trash2,
  Play,
  Code,
  Search,
  Sparkles,
  Brain,
  Terminal,
  Github
} from "lucide-react";
import { Link } from "wouter";

// Provider icons mapping
const providerIcons: Record<string, React.ReactNode> = {
  claude_code: <Code className="w-6 h-6" />,
  openai_codex: <Terminal className="w-6 h-6" />,
  perplexity: <Search className="w-6 h-6" />,
  github_copilot: <Github className="w-6 h-6" />,
  gemini: <Sparkles className="w-6 h-6" />,
  deepseek: <Brain className="w-6 h-6" />,
};

export default function AIIntegrations() {
  const { user, loading: authLoading } = useAuth();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [apiKey, setApiKey] = useState("");

  const { data: integrations, isLoading: integrationsLoading, refetch } = trpc.aiIntegrations.list.useQuery();
  const { data: providers, isLoading: providersLoading } = trpc.aiIntegrations.getProviders.useQuery();
  const { data: subscription } = trpc.subscription.getMySubscription.useQuery();

  const connectMutation = trpc.aiIntegrations.connect.useMutation({
    onSuccess: (data) => {
      toast.success(data.updated ? "Интеграция обновлена" : "Интеграция подключена");
      setConnectDialogOpen(false);
      setApiKey("");
      setSelectedProvider(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = trpc.aiIntegrations.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Интеграция отключена");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.aiIntegrations.toggle.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.aiIntegrations.test.useMutation({
    onSuccess: () => toast.success("Подключение работает!"),
    onError: (err) => toast.error(err.message),
  });

  const handleConnect = () => {
    if (!selectedProvider || !apiKey) {
      toast.error("Введите API ключ");
      return;
    }
    connectMutation.mutate({
      provider: selectedProvider.id,
      apiKey,
      displayName: selectedProvider.name,
    });
  };

  if (authLoading || integrationsLoading || providersLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Check which providers are already connected
  const connectedProviderIds = integrations?.map((i: { provider: string }) => i.provider) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Настройки
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Key className="w-6 h-6 text-amber-400" />
              <h1 className="text-xl font-bold">AI Интеграции</h1>
            </div>
          </div>
          {subscription?.plan && (
            <Badge variant="outline" className="border-amber-500 text-amber-400">
              {subscription.plan.name}
            </Badge>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 space-y-8">
        {/* Info Banner */}
        <Card className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border-amber-500/20">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-amber-500/20">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Подключите свои AI инструменты</h3>
              <p className="text-sm text-muted-foreground">
                Используйте Claude Code, Codex, Perplexity и другие AI сервисы через свои API ключи
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Connected Integrations */}
        {integrations && integrations.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Подключённые интеграции</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration: { id: number; provider: string; displayName?: string | null; isEnabled: boolean; apiKey?: string | null; isActive?: boolean | null; totalRequests?: number | null; totalTokens?: number | null; lastUsedAt?: Date | null }) => (
                <Card key={integration.id} className="relative group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {providerIcons[integration.provider] || <Code className="w-6 h-6" />}
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {integration.displayName || integration.provider}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {integration.apiKey}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={integration.isActive ?? false}
                        onCheckedChange={(checked) => 
                          toggleMutation.mutate({ id: integration.id, isActive: checked })
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Запросов:</span>
                        <span>{integration.totalRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Токенов:</span>
                        <span>{integration.totalTokens?.toLocaleString() || 0}</span>
                      </div>
                      {integration.lastUsedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Последнее использование:</span>
                          <span className="text-xs">
                            {new Date(integration.lastUsedAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => testMutation.mutate({ id: integration.id })}
                        disabled={testMutation.isPending}
                      >
                        {testMutation.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 mr-1" />
                        )}
                        Тест
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => disconnectMutation.mutate({ id: integration.id })}
                        disabled={disconnectMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Available Providers */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Доступные провайдеры</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers?.map((provider) => {
              const isConnected = connectedProviderIds.includes(provider.id);
              return (
                <Card 
                  key={provider.id} 
                  className={`cursor-pointer transition-all hover:border-amber-500/50 ${
                    isConnected ? "border-emerald-500/50 bg-emerald-500/5" : ""
                  }`}
                  onClick={() => {
                    if (!isConnected) {
                      setSelectedProvider(provider);
                      setConnectDialogOpen(true);
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isConnected ? "bg-emerald-500/20" : "bg-primary/10"}`}>
                          {providerIcons[provider.id] || <Code className="w-6 h-6" />}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{provider.name}</CardTitle>
                          <CardDescription>{provider.description}</CardDescription>
                        </div>
                      </div>
                      {isConnected ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Plus className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {provider.authType === "api_key" ? "API Key" : "OAuth"}
                      </Badge>
                      <a 
                        href={provider.docsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        Документация
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Connect Dialog */}
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProvider && providerIcons[selectedProvider.id]}
                Подключить {selectedProvider?.name}
              </DialogTitle>
              <DialogDescription>
                Введите API ключ для подключения к {selectedProvider?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              {selectedProvider?.docsUrl && (
                <a 
                  href={selectedProvider.docsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-amber-400 hover:underline flex items-center gap-1"
                >
                  Как получить API ключ?
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleConnect}
                disabled={connectMutation.isPending || !apiKey}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {connectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Подключить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
