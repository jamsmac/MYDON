import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Palette, RotateCcw, Save, Sun, Moon, Eye } from "lucide-react";

export default function AdminBranding() {
  const [platformName, setPlatformName] = useState("MYDON Roadmap Hub");
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [hasChanges, setHasChanges] = useState(false);

  const { data: branding, isLoading } = trpc.adminUI.getBranding.useQuery();
  const utils = trpc.useUtils();

  const updateBranding = trpc.adminUI.updateBranding.useMutation({
    onSuccess: () => {
      toast.success("Настройки брендинга сохранены");
      utils.adminUI.getBranding.invalidate();
      setHasChanges(false);
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (branding) {
      setPlatformName(branding.platformName || "MYDON Roadmap Hub");
      setPrimaryColor(branding.primaryColor || "#f59e0b");
      setAccentColor(branding.accentColor || "#10b981");
      setTheme(branding.theme as "dark" | "light" || "dark");
    }
  }, [branding]);

  const handleSave = () => {
    updateBranding.mutate({
      platformName,
      primaryColor,
      accentColor,
      theme,
    });
  };

  const handleReset = () => {
    setPlatformName("MYDON Roadmap Hub");
    setPrimaryColor("#f59e0b");
    setAccentColor("#10b981");
    setTheme("dark");
    setHasChanges(true);
  };

  const handleChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setHasChanges(true);
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
            <Palette className="w-6 h-6 text-primary" />
            Брендинг
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Настройте внешний вид платформы
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Сбросить
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateBranding.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-6">
          {/* Platform Name */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Название платформы</CardTitle>
              <CardDescription>
                Отображается в заголовке и на страницах
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={platformName}
                onChange={(e) => handleChange(setPlatformName, e.target.value)}
                placeholder="MYDON Roadmap Hub"
              />
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Цветовая схема</CardTitle>
              <CardDescription>
                Основные цвета интерфейса
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Основной цвет</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => handleChange(setPrimaryColor, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => handleChange(setPrimaryColor, e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Акцентный цвет</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => handleChange(setAccentColor, e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => handleChange(setAccentColor, e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Тема по умолчанию</CardTitle>
              <CardDescription>
                Выберите светлую или тёмную тему
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    {theme === "dark" ? "Тёмная тема" : "Светлая тема"}
                  </span>
                </div>
                <Switch
                  checked={theme === "light"}
                  onCheckedChange={(checked) => handleChange(setTheme, checked ? "light" : "dark")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Предпросмотр
            </CardTitle>
            <CardDescription>
              Как будет выглядеть интерфейс
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`rounded-lg border overflow-hidden ${
                theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
              }`}
            >
              {/* Mini Header */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: theme === "dark" ? "#334155" : "#e2e8f0" }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    M
                  </div>
                  <span className="font-semibold text-sm">{platformName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="px-3 py-1 rounded text-xs text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Кнопка
                  </div>
                </div>
              </div>

              {/* Mini Content */}
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div
                    className="w-16 h-16 rounded"
                    style={{ backgroundColor: theme === "dark" ? "#1e293b" : "#f1f5f9" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-3 rounded w-3/4"
                      style={{ backgroundColor: theme === "dark" ? "#334155" : "#e2e8f0" }}
                    />
                    <div
                      className="h-3 rounded w-1/2"
                      style={{ backgroundColor: theme === "dark" ? "#334155" : "#e2e8f0" }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div
                    className="px-3 py-1.5 rounded text-xs text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Основной
                  </div>
                  <div
                    className="px-3 py-1.5 rounded text-xs"
                    style={{
                      backgroundColor: theme === "dark" ? "#334155" : "#e2e8f0",
                      color: theme === "dark" ? "#94a3b8" : "#64748b",
                    }}
                  >
                    Вторичный
                  </div>
                </div>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="mt-4 flex gap-2">
              <div className="flex-1 text-center">
                <div
                  className="h-8 rounded mb-1"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs text-muted-foreground">Основной</span>
              </div>
              <div className="flex-1 text-center">
                <div
                  className="h-8 rounded mb-1"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="text-xs text-muted-foreground">Акцент</span>
              </div>
              <div className="flex-1 text-center">
                <div
                  className="h-8 rounded mb-1"
                  style={{ backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff", border: "1px solid #334155" }}
                />
                <span className="text-xs text-muted-foreground">Фон</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
