import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone,
  ArrowLeft,
  Loader2,
  Check,
  ExternalLink,
  Send
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  // Get current preferences
  const { data: preferences, isLoading: prefsLoading, refetch } = trpc.notifications.getPreferences.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Get Telegram bot link
  const { data: telegramData } = trpc.notifications.getTelegramBotLink.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  // Update preferences mutation
  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success('Настройки сохранены');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка сохранения: ' + error.message);
    }
  });
  
  // Telegram mutations
  const disconnectTelegram = trpc.notifications.disconnectTelegram.useMutation({
    onSuccess: () => {
      toast.success('Telegram отключён');
      refetch();
    }
  });
  
  const testTelegram = trpc.notifications.testTelegram.useMutation({
    onSuccess: () => {
      toast.success('Тестовое уведомление отправлено');
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });
  
  const handleToggle = (key: string, value: boolean) => {
    updatePrefs.mutate({ [key]: value });
  };
  
  const handleSelectChange = (key: string, value: string) => {
    updatePrefs.mutate({ [key]: value });
  };
  
  if (authLoading || prefsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated || !preferences) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <p className="text-slate-400">Пожалуйста, войдите в систему</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Настройки уведомлений</h1>
            <p className="text-xs text-slate-500">Управление каналами и типами уведомлений</p>
          </div>
        </div>
      </header>
      
      <main className="container py-8 max-w-3xl">
        {/* Notification Channels */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              Каналы уведомлений
            </CardTitle>
            <CardDescription className="text-slate-400">
              Выберите, как вы хотите получать уведомления
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* In-App Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <Label className="text-white">В приложении</Label>
                  <p className="text-sm text-slate-400">Уведомления в центре уведомлений</p>
                </div>
              </div>
              <Switch
                checked={preferences.inAppEnabled ?? true}
                onCheckedChange={(checked) => handleToggle('inAppEnabled', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            {/* Email Notifications */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <Label className="text-white">Email</Label>
                    <p className="text-sm text-slate-400">Дайджест и важные уведомления</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.emailEnabled ?? true}
                  onCheckedChange={(checked) => handleToggle('emailEnabled', checked)}
                />
              </div>
              
              {preferences.emailEnabled && (
                <div className="ml-13 pl-13 space-y-4 border-l-2 border-slate-700 ml-5 pl-5">
                  <div className="flex items-center gap-4">
                    <Label className="text-slate-300 w-32">Частота дайджеста</Label>
                    <Select
                      value={preferences.emailDigestFrequency ?? 'daily'}
                      onValueChange={(value) => handleSelectChange('emailDigestFrequency', value)}
                    >
                      <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Отключено</SelectItem>
                        <SelectItem value="daily">Ежедневно</SelectItem>
                        <SelectItem value="weekly">Еженедельно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {preferences.emailDigestFrequency !== 'none' && (
                    <div className="flex items-center gap-4">
                      <Label className="text-slate-300 w-32">Время отправки</Label>
                      <Select
                        value={preferences.emailDigestTime ?? '09:00'}
                        onValueChange={(value) => handleSelectChange('emailDigestTime', value)}
                      >
                        <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="06:00">06:00</SelectItem>
                          <SelectItem value="08:00">08:00</SelectItem>
                          <SelectItem value="09:00">09:00</SelectItem>
                          <SelectItem value="10:00">10:00</SelectItem>
                          <SelectItem value="12:00">12:00</SelectItem>
                          <SelectItem value="18:00">18:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <Separator className="bg-slate-700" />
            
            {/* Telegram Notifications */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-500/10 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5 text-sky-500" />
                  </div>
                  <div>
                    <Label className="text-white">Telegram</Label>
                    <p className="text-sm text-slate-400">
                      {preferences.telegramEnabled && preferences.telegramUsername
                        ? `Подключён: @${preferences.telegramUsername}`
                        : 'Мгновенные уведомления в Telegram'}
                    </p>
                  </div>
                </div>
                {preferences.telegramEnabled ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testTelegram.mutate()}
                      disabled={testTelegram.isPending}
                      className="border-slate-600 text-slate-300"
                    >
                      {testTelegram.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Тест'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectTelegram.mutate()}
                      disabled={disconnectTelegram.isPending}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      Отключить
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (telegramData?.link) {
                        window.open(telegramData.link, '_blank');
                      }
                    }}
                    className="border-sky-500/50 text-sky-400 hover:bg-sky-500/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Подключить
                  </Button>
                )}
              </div>
            </div>
            
            <Separator className="bg-slate-700" />
            
            {/* Browser Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <Label className="text-white">Push-уведомления</Label>
                  <p className="text-sm text-slate-400">Уведомления в браузере</p>
                </div>
              </div>
              <Switch
                checked={preferences.pushEnabled ?? false}
                onCheckedChange={(checked) => {
                  if (checked && 'Notification' in window) {
                    Notification.requestPermission().then((permission) => {
                      if (permission === 'granted') {
                        handleToggle('pushEnabled', true);
                      } else {
                        toast.error('Разрешите уведомления в браузере');
                      }
                    });
                  } else {
                    handleToggle('pushEnabled', checked);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Notification Types */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              Типы уведомлений
            </CardTitle>
            <CardDescription className="text-slate-400">
              Выберите, о чём вы хотите получать уведомления
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Назначение задач</Label>
                <p className="text-sm text-slate-400">Когда вам назначают задачу</p>
              </div>
              <Switch
                checked={preferences.notifyTaskAssigned ?? true}
                onCheckedChange={(checked) => handleToggle('notifyTaskAssigned', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Завершение задач</Label>
                <p className="text-sm text-slate-400">Когда задача завершена</p>
              </div>
              <Switch
                checked={preferences.notifyTaskCompleted ?? true}
                onCheckedChange={(checked) => handleToggle('notifyTaskCompleted', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Просроченные задачи</Label>
                <p className="text-sm text-slate-400">Когда задача просрочена</p>
              </div>
              <Switch
                checked={preferences.notifyTaskOverdue ?? true}
                onCheckedChange={(checked) => handleToggle('notifyTaskOverdue', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Комментарии</Label>
                <p className="text-sm text-slate-400">Новые комментарии к задачам</p>
              </div>
              <Switch
                checked={preferences.notifyComments ?? true}
                onCheckedChange={(checked) => handleToggle('notifyComments', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Упоминания (@)</Label>
                <p className="text-sm text-slate-400">Когда вас упоминают в комментариях</p>
              </div>
              <Switch
                checked={preferences.notifyMentions ?? true}
                onCheckedChange={(checked) => handleToggle('notifyMentions', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Обновления проектов</Label>
                <p className="text-sm text-slate-400">Изменения в проектах</p>
              </div>
              <Switch
                checked={preferences.notifyProjectUpdates ?? true}
                onCheckedChange={(checked) => handleToggle('notifyProjectUpdates', checked)}
              />
            </div>
            
            <Separator className="bg-slate-700" />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-white">Напоминания о дедлайнах</Label>
                <p className="text-sm text-slate-400">За день до дедлайна</p>
              </div>
              <Switch
                checked={preferences.notifyDeadlines ?? true}
                onCheckedChange={(checked) => handleToggle('notifyDeadlines', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
