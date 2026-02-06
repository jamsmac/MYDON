import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  Search, User, FolderKanban, Bot, Sparkles, FileText, Settings,
  ArrowRight, Command
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  users: <User className="w-4 h-4" />,
  projects: <FolderKanban className="w-4 h-4" />,
  agents: <Bot className="w-4 h-4" />,
  skills: <Sparkles className="w-4 h-4" />,
  prompts: <FileText className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  users: "Пользователи",
  projects: "Проекты",
  agents: "AI Агенты",
  skills: "Навыки",
  prompts: "Промпты",
  settings: "Настройки",
};

interface AdminGlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminGlobalSearch({ open, onOpenChange }: AdminGlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();

  const { data: results, isLoading } = trpc.adminLogs.globalSearch.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  const allResults = results?.results || [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex]);
    }
  }, [allResults, selectedIndex]);

  const handleSelect = (result: typeof allResults[0]) => {
    onOpenChange(false);
    setQuery("");
    setLocation(result.url);
  };

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по админке..."
            className="border-0 focus-visible:ring-0 p-0 text-base"
            autoFocus
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
            <Command className="w-3 h-3" />
            <span>/</span>
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Введите минимум 2 символа для поиска</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <Badge key={key} variant="outline" className="gap-1">
                    {CATEGORY_ICONS[key]}
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Поиск...</p>
            </div>
          ) : allResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Ничего не найдено по запросу "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {allResults.map((result: { id: number; category: string; title: string; subtitle: string; url: string }, index: number) => (
                <button
                  key={`${result.category}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    index === selectedIndex ? "bg-primary/20" : "bg-muted"
                  }`}>
                    {CATEGORY_ICONS[result.category] || <Search className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {result.subtitle}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {CATEGORY_LABELS[result.category] || result.category}
                  </Badge>
                  {index === selectedIndex && (
                    <ArrowRight className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background rounded border">↓</kbd>
              навигация
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background rounded border">Enter</kbd>
              выбрать
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background rounded border">Esc</kbd>
            закрыть
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
