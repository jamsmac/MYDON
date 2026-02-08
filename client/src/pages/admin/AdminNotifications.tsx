import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Mail, Send, Settings, FileText, CheckCircle, XCircle, 
  MessageSquare, Slack, AlertTriangle, Pencil
} from "lucide-react";

export default function AdminNotifications() {
  const [smtpSettings, setSmtpSettings] = useState({
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: false,
    fromEmail: "",
    fromName: "",
    isEnabled: false,
  });
  const [testEmail, setTestEmail] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const { data: emailSettings, isLoading: loadingSettings } = trpc.adminIntegrations.getEmailSettings.useQuery();
  const { data: templates = [], isLoading: loadingTemplates } = trpc.adminIntegrations.listEmailTemplates.useQuery();
  const utils = trpc.useUtils();

  const updateEmailSettings = trpc.adminIntegrations.updateEmailSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      utils.adminIntegrations.getEmailSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testEmailMutation = trpc.adminIntegrations.testEmail.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTemplate = trpc.adminIntegrations.updateEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Шаблон обновлён");
      utils.adminIntegrations.listEmailTemplates.invalidate();
      setEditingTemplate(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const initTemplates = trpc.adminIntegrations.initEmailTemplates.useMutation({
    onSuccess: (result) => {
      toast.success(`Создано ${result.created} шаблонов`);
      utils.adminIntegrations.listEmailTemplates.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (emailSettings) {
      setSmtpSettings({
        smtpHost: emailSettings.smtpHost || "",
        smtpPort: emailSettings.smtpPort || 587,
        smtpUser: emailSettings.smtpUser || "",
        smtpPassword: emailSettings.smtpPassword || "",
        smtpSecure: emailSettings.smtpSecure || false,
        fromEmail: emailSettings.fromEmail || "",
        fromName: emailSettings.fromName || "",
        isEnabled: emailSettings.isEnabled || false,
      });
    }
  }, [emailSettings]);

  const handleSaveSettings = () => {
    updateEmailSettings.mutate(smtpSettings);
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error("Введите email для теста");
      return;
    }
    testEmailMutation.mutate({ toEmail: testEmail });
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    updateTemplate.mutate({
      id: editingTemplate.id,
      name: editingTemplate.name,
      subject: editingTemplate.subject,
      bodyHtml: editingTemplate.bodyHtml,
      bodyText: editingTemplate.bodyText,
      isActive: editingTemplate.isActive,
    });
  };

  if (loadingSettings || loadingTemplates) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          Уведомления
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Настройки email и других каналов уведомлений
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Шаблоны
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Другие каналы
          </TabsTrigger>
        </TabsList>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    SMTP Настройки
                  </CardTitle>
                  <CardDescription>
                    Настройки сервера для отправки email
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Включено</Label>
                  <Switch
                    checked={smtpSettings.isEnabled}
                    onCheckedChange={(checked) => 
                      setSmtpSettings({ ...smtpSettings, isEnabled: checked })
                    }
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Хост</Label>
                  <Input
                    value={smtpSettings.smtpHost}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <Label>Порт</Label>
                  <Input
                    type="number"
                    value={smtpSettings.smtpPort}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpPort: parseInt(e.target.value) })}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Логин</Label>
                  <Input
                    value={smtpSettings.smtpUser}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpUser: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label>Пароль</Label>
                  <Input
                    type="password"
                    value={smtpSettings.smtpPassword}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email отправителя</Label>
                  <Input
                    value={smtpSettings.fromEmail}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                    placeholder="noreply@example.com"
                  />
                </div>
                <div>
                  <Label>Имя отправителя</Label>
                  <Input
                    value={smtpSettings.fromName}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromName: e.target.value })}
                    placeholder="MYDON Roadmap"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={smtpSettings.smtpSecure}
                  onCheckedChange={(checked) => 
                    setSmtpSettings({ ...smtpSettings, smtpSecure: checked })
                  }
                />
                <Label>Использовать SSL/TLS</Label>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateEmailSettings.isPending}>
                Сохранить настройки
              </Button>
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Тестовое письмо
              </CardTitle>
              <CardDescription>
                Отправьте тестовое письмо для проверки настроек
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="max-w-sm"
                />
                <Button onClick={handleTestEmail} disabled={testEmailMutation.isPending}>
                  <Send className="w-4 h-4 mr-2" />
                  Отправить тест
                </Button>
              </div>
              {emailSettings?.lastTestedAt && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {emailSettings.lastTestResult === "success" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-muted-foreground">
                    Последний тест:{" "}
                    {new Date(emailSettings.lastTestedAt).toLocaleString("ru")}
                  </span>
                  {emailSettings.lastTestError && (
                    <span className="text-red-500">— {emailSettings.lastTestError}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Шаблоны писем</h3>
              <p className="text-sm text-muted-foreground">
                Настройте содержимое автоматических писем
              </p>
            </div>
            {templates.length === 0 && (
              <Button onClick={() => initTemplates.mutate()}>
                Создать стандартные шаблоны
              </Button>
            )}
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">Нет шаблонов</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Создайте стандартные шаблоны для начала работы
                </p>
                <Button onClick={() => initTemplates.mutate()}>
                  Создать шаблоны
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates.map((template: { id: number; name: string; subject: string; isActive: boolean; variables: string[] | null }) => (
                <Card key={template.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant={template.isActive ? "default" : "secondary"}>
                            {template.isActive ? "Активен" : "Отключён"}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Тема: {template.subject}
                        </div>
                        {template.variables && (
                          <div className="flex gap-1 mt-2">
                            {(template.variables as string[]).map((v) => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Редактировать
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Edit Template Dialog */}
          <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Редактировать шаблон</DialogTitle>
              </DialogHeader>
              {editingTemplate && (
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Название</Label>
                    <Input
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Тема письма</Label>
                    <Input
                      value={editingTemplate.subject}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>HTML содержимое</Label>
                    <Textarea
                      value={editingTemplate.bodyHtml}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyHtml: e.target.value })}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>Текстовая версия</Label>
                    <Textarea
                      value={editingTemplate.bodyText || ""}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyText: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingTemplate.isActive}
                      onCheckedChange={(checked) => 
                        setEditingTemplate({ ...editingTemplate, isActive: checked })
                      }
                    />
                    <Label>Активен</Label>
                  </div>
                  <Button onClick={handleSaveTemplate} className="w-full">
                    Сохранить
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Other Channels */}
        <TabsContent value="other" className="space-y-6">
          <div className="grid gap-4">
            {/* Telegram */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">Telegram Bot</h4>
                      <p className="text-sm text-muted-foreground">
                        Уведомления через Telegram бота
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Coming soon
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Slack */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Slack className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">Slack</h4>
                      <p className="text-sm text-muted-foreground">
                        Интеграция со Slack workspace
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Coming soon
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
