import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  Loader2,
  Bot,
  Key,
  Check,
  X,
  Star,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Provider = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral';

const AI_PROVIDERS: { 
  id: Provider; 
  name: string; 
  description: string;
  models: string[];
  keyPrefix: string;
}[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Opus, Sonnet, Haiku',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    keyPrefix: 'sk-ant-'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    keyPrefix: 'sk-'
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini Pro, Ultra',
    models: ['gemini-pro', 'gemini-ultra'],
    keyPrefix: 'AI'
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'LLaMA, Mixtral (быстрый)',
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    keyPrefix: 'gsk_'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Medium',
    models: ['mistral-large-latest', 'mistral-medium-latest'],
    keyPrefix: ''
  }
];

function ProviderCard({ 
  provider, 
  setting, 
  onSave, 
  onSetDefault,
  onDelete,
  isLoading 
}: { 
  provider: typeof AI_PROVIDERS[0];
  setting?: {
    id: number;
    apiKey: string | null;
    model: string | null;
    isDefault: boolean | null;
    isEnabled: boolean | null;
  };
  onSave: (data: { provider: Provider; apiKey: string; model?: string }) => void;
  onSetDefault: (provider: Provider) => void;
  onDelete: (id: number) => void;
  isLoading: boolean;
}) {
  const [apiKey, setApiKey] = useState(setting?.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(setting?.model || provider.models[0]);
  const [isEditing, setIsEditing] = useState(!setting?.apiKey);

  const isConfigured = !!setting?.apiKey;
  const isDefault = setting?.isDefault;

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('Введите API ключ');
      return;
    }
    onSave({ 
      provider: provider.id, 
      apiKey: apiKey.trim(),
      model: selectedModel 
    });
    setIsEditing(false);
  };

  return (
    <Card className={cn(
      "bg-slate-800/50 border-slate-700 transition-colors",
      isDefault && "border-amber-500/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isConfigured ? "bg-emerald-500/10" : "bg-slate-700"
            )}>
              <Bot className={cn(
                "w-5 h-5",
                isConfigured ? "text-emerald-500" : "text-slate-500"
              )} />
            </div>
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                {provider.name}
                {isDefault && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                    По умолчанию
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          {isConfigured && (
            <div className="flex items-center gap-1">
              {!isDefault && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-amber-400"
                  onClick={() => onSetDefault(provider.id)}
                  title="Сделать по умолчанию"
                >
                  <Star className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-400"
                onClick={() => {
                  if (confirm('Удалить настройки этого провайдера?')) {
                    onDelete(setting!.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing || !isConfigured ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">API Ключ</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`${provider.keyPrefix}...`}
                  className="bg-slate-900 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Модель</Label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
              >
                {provider.models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Сохранить
              </Button>
              {isConfigured && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setApiKey(setting?.apiKey || '');
                    setIsEditing(false);
                  }}
                  className="border-slate-600 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Key className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-400">Ключ настроен</span>
              <span className="text-slate-500">• {setting?.model}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-slate-400 hover:text-white"
            >
              Изменить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  
  const { data: aiSettings, isLoading, refetch } = trpc.aiSettings.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const upsertSetting = trpc.aiSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success('Настройки сохранены');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const setDefault = trpc.aiSettings.setDefault.useMutation({
    onSuccess: () => {
      toast.success('Провайдер по умолчанию изменён');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const deleteSetting = trpc.aiSettings.delete.useMutation({
    onSuccess: () => {
      toast.success('Настройки удалены');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const getSettingForProvider = (providerId: Provider) => {
    return aiSettings?.find(s => s.provider === providerId);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-white ml-4">Настройки</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-3xl">
        {/* User Info */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Профиль</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
                <span className="text-amber-500 font-semibold text-lg">
                  {user?.name?.[0] || user?.email?.[0] || 'U'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{user?.name || 'Пользователь'}</p>
                <p className="text-sm text-slate-400">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Providers */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">AI Провайдеры</h2>
          <p className="text-slate-400 text-sm mb-6">
            Добавьте свои API ключи для использования AI-ассистента (BYOK режим)
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {AI_PROVIDERS.map(provider => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                setting={getSettingForProvider(provider.id)}
                onSave={(data) => upsertSetting.mutate(data)}
                onSetDefault={(p) => setDefault.mutate({ provider: p })}
                onDelete={(id) => deleteSetting.mutate({ id })}
                isLoading={upsertSetting.isPending}
              />
            ))}
          </div>
        )}

        {/* Info */}
        <Card className="bg-slate-800/30 border-slate-700 border-dashed mt-8">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="text-white font-medium mb-1">Как получить API ключ?</p>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• <strong>Anthropic:</strong> console.anthropic.com → API Keys</li>
                  <li>• <strong>OpenAI:</strong> platform.openai.com → API Keys</li>
                  <li>• <strong>Google AI:</strong> aistudio.google.com → Get API Key</li>
                  <li>• <strong>Groq:</strong> console.groq.com → API Keys</li>
                  <li>• <strong>Mistral:</strong> console.mistral.ai → API Keys</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
