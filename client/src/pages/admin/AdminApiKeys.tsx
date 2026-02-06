import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Key, Plus, Trash2, CheckCircle, XCircle, AlertTriangle, 
  RefreshCw, Eye, EyeOff, Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5" },
  { id: "anthropic", name: "Anthropic", description: "Claude 3" },
  { id: "google", name: "Google", description: "Gemini" },
  { id: "mistral", name: "Mistral", description: "Mistral Large" },
  { id: "groq", name: "Groq", description: "LLaMA, Mixtral" },
];

export default function AdminApiKeys() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showKey, setShowKey] = useState<number | null>(null);
  const [newKey, setNewKey] = useState({ provider: "", apiKey: "" });

  const { data: keys = [], isLoading } = trpc.adminIntegrations.listPlatformApiKeys.useQuery();
  const utils = trpc.useUtils();

  const addKey = trpc.adminIntegrations.addPlatformApiKey.useMutation({
    onSuccess: () => {
      toast.success("API ключ добавлен");
      utils.adminIntegrations.listPlatformApiKeys.invalidate();
      setIsAddDialogOpen(false);
      setNewKey({ provider: "", apiKey: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyKey = trpc.adminIntegrations.verifyApiKey.useMutation({
    onSuccess: (result) => {
      if (result.valid) {
        toast.success("Ключ действителен");
      } else {
        toast.error(`Ключ недействителен: ${result.error}`);
      }
      utils.adminIntegrations.listPlatformApiKeys.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleKey = trpc.adminIntegrations.toggleApiKey.useMutation({
    onSuccess: () => {
      utils.adminIntegrations.listPlatformApiKeys.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteKey = trpc.adminIntegrations.deleteApiKey.useMutation({
    onSuccess: () => {
      toast.success("API ключ удалён");
      utils.adminIntegrations.listPlatformApiKeys.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = () => {
    if (!newKey.provider || !newKey.apiKey) {
      toast.error("Выберите провайдера и введите ключ");
      return;
    }
    addKey.mutate(newKey);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "valid":
        return (
          <Badge className="bg-green-500/20 text-green-500 gap-1">
            <CheckCircle className="w-3 h-3" />
            Действителен
          </Badge>
        );
      case "invalid":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Недействителен
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            Истёк
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            Не проверен
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" />
            API Ключи
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление ключами AI провайдеров
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить ключ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить API ключ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Провайдер</Label>
                <Select
                  value={newKey.provider}
                  onValueChange={(value) => setNewKey({ ...newKey, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите провайдера" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{provider.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {provider.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>API Ключ</Label>
                <Input
                  value={newKey.apiKey}
                  onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                  placeholder="sk-..."
                  type="password"
                />
              </div>
              <Button onClick={handleAdd} className="w-full" disabled={addKey.isPending}>
                Добавить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-500">Режим платформы</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Эти ключи используются для всех пользователей платформы. 
                Пользователи также могут добавить свои ключи (BYOK) в настройках.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keys List */}
      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Нет API ключей</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Добавьте ключи AI провайдеров для работы платформы
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить первый ключ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => {
            const provider = AI_PROVIDERS.find(p => p.id === key.provider);
            return (
              <Card key={key.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Key className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">
                            {provider?.name || key.provider}
                          </h3>
                          {getStatusBadge(key.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {provider?.description}
                        </div>
                        {key.lastVerifiedAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Проверен{" "}
                            {formatDistanceToNow(new Date(key.lastVerifiedAt), {
                              addSuffix: true,
                              locale: ru,
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Stats */}
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">Запросов</div>
                        <div className="font-medium">{key.totalRequests?.toLocaleString() || 0}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">Токенов</div>
                        <div className="font-medium">{key.totalTokens?.toLocaleString() || 0}</div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 border-l pl-4">
                        <Switch
                          checked={key.isEnabled ?? false}
                          onCheckedChange={(checked) => 
                            toggleKey.mutate({ id: key.id, isEnabled: checked })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyKey.mutate({ id: key.id })}
                          disabled={verifyKey.isPending}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Проверить
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteKey.mutate({ id: key.id })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {key.lastErrorMessage && (
                    <div className="mt-3 p-2 rounded bg-red-500/10 text-red-500 text-sm">
                      {key.lastErrorMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
