import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Languages, Search, Plus, Download, Upload, Check, Pencil, Trash2,
  Globe
} from "lucide-react";

const LANGUAGES = [
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "uz", name: "O'zbekcha", flag: "🇺🇿" },
];

export default function AdminLocalization() {
  const [selectedLocale, setSelectedLocale] = useState<"ru" | "en" | "uz">("ru");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newString, setNewString] = useState({ key: "", value: "", context: "" });
  const [importJson, setImportJson] = useState("");

  const { data: languages } = trpc.adminUI.getLanguages.useQuery();
  const { data: stringsData, isLoading } = trpc.adminUI.getLocalizationStrings.useQuery({
    locale: selectedLocale,
    search: search || undefined,
    limit: 100,
  });
  const utils = trpc.useUtils();

  const setDefaultLanguage = trpc.adminUI.setDefaultLanguage.useMutation({
    onSuccess: () => {
      toast.success("Язык по умолчанию изменён");
      utils.adminUI.getLanguages.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateString = trpc.adminUI.updateLocalizationString.useMutation({
    onSuccess: () => {
      toast.success("Строка обновлена");
      utils.adminUI.getLocalizationStrings.invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const createString = trpc.adminUI.createLocalizationString.useMutation({
    onSuccess: () => {
      toast.success("Строка добавлена");
      utils.adminUI.getLocalizationStrings.invalidate();
      setIsAddDialogOpen(false);
      setNewString({ key: "", value: "", context: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteString = trpc.adminUI.deleteLocalizationString.useMutation({
    onSuccess: () => {
      toast.success("Строка удалена");
      utils.adminUI.getLocalizationStrings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportLocalization = trpc.adminUI.exportLocalization.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `localization_${selectedLocale}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Файл экспортирован");
    },
    onError: (err) => toast.error(err.message),
  });

  const importLocalization = trpc.adminUI.importLocalization.useMutation({
    onSuccess: (data) => {
      toast.success(`Импортировано: ${data.imported} строк`);
      utils.adminUI.getLocalizationStrings.invalidate();
      setIsImportDialogOpen(false);
      setImportJson("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEdit = (id: number, value: string) => {
    setEditingId(id);
    setEditValue(value);
  };

  const handleSaveEdit = () => {
    if (editingId === null) return;
    updateString.mutate({ id: editingId, value: editValue });
  };

  const handleAddString = () => {
    if (!newString.key || !newString.value) {
      toast.error("Заполните ключ и значение");
      return;
    }
    createString.mutate({
      key: newString.key,
      locale: selectedLocale,
      value: newString.value,
      context: newString.context || undefined,
    });
  };

  const handleImport = () => {
    try {
      JSON.parse(importJson);
      importLocalization.mutate({
        locale: selectedLocale,
        json: importJson,
      });
    } catch {
      toast.error("Некорректный JSON");
    }
  };

  // Calculate progress per language (mock data for now)
  const languageProgress = useMemo(() => {
    const total = stringsData?.total || 0;
    return LANGUAGES.map(lang => ({
      ...lang,
      progress: lang.code === "ru" ? 100 : lang.code === "en" ? 75 : 45,
      count: lang.code === "ru" ? total : Math.floor(total * (lang.code === "en" ? 0.75 : 0.45)),
    }));
  }, [stringsData?.total]);

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
            <Languages className="w-6 h-6 text-primary" />
            Локализация
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление переводами интерфейса
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportLocalization.mutate({ locale: selectedLocale })}>
            <Download className="w-4 h-4 mr-2" />
            Экспорт JSON
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Импорт JSON
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Импорт локализации</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>JSON данные</Label>
                  <Textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder='{"key": "value", ...}'
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={handleImport} className="w-full" disabled={importLocalization.isPending}>
                  Импортировать в {LANGUAGES.find(l => l.code === selectedLocale)?.name}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Добавить строку
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Добавить строку перевода</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Ключ</Label>
                  <Input
                    value={newString.key}
                    onChange={(e) => setNewString({ ...newString, key: e.target.value })}
                    placeholder="common.save"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Значение ({LANGUAGES.find(l => l.code === selectedLocale)?.name})</Label>
                  <Textarea
                    value={newString.value}
                    onChange={(e) => setNewString({ ...newString, value: e.target.value })}
                    placeholder="Сохранить"
                  />
                </div>
                <div>
                  <Label>Контекст (опционально)</Label>
                  <Input
                    value={newString.context}
                    onChange={(e) => setNewString({ ...newString, context: e.target.value })}
                    placeholder="Кнопка сохранения формы"
                  />
                </div>
                <Button onClick={handleAddString} className="w-full" disabled={createString.isPending}>
                  Добавить
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Language Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {languageProgress.map((lang) => (
          <Card key={lang.code} className={selectedLocale === lang.code ? "ring-2 ring-primary" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                </div>
                {languages?.defaultLanguage === lang.code ? (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                    По умолчанию
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefaultLanguage.mutate({ language: lang.code as "ru" | "en" | "uz" })}
                  >
                    Сделать основным
                  </Button>
                )}
              </div>
              <Progress value={lang.progress} className="h-2 mb-1" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{lang.progress}% переведено</span>
                <span>{lang.count} строк</span>
              </div>
              <Button
                variant={selectedLocale === lang.code ? "default" : "outline"}
                size="sm"
                className="w-full mt-3"
                onClick={() => setSelectedLocale(lang.code as "ru" | "en" | "uz")}
              >
                {selectedLocale === lang.code ? <Check className="w-4 h-4 mr-2" /> : null}
                Редактировать
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Strings Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Строки перевода — {LANGUAGES.find(l => l.code === selectedLocale)?.name}
              </CardTitle>
              <CardDescription>
                Всего: {stringsData?.total || 0} строк
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по ключу или тексту..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Ключ</th>
                  <th className="text-left p-3 font-medium">Значение</th>
                  <th className="text-left p-3 font-medium w-32">Действия</th>
                </tr>
              </thead>
              <tbody>
                {stringsData?.strings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      Нет строк для отображения
                    </td>
                  </tr>
                ) : (
                  stringsData?.strings.map((str: { id: number; key: string; value: string; context: string | null }) => (
                    <tr key={str.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {str.key}
                        </code>
                        {str.context && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {str.context}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {editingId === str.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="text-sm"
                              autoFocus
                            />
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-foreground">{str.value}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {editingId !== str.id && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(str.id, str.value)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteString.mutate({ id: str.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
