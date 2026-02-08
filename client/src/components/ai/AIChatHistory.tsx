import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  History,
  Search,
  Download,
  User,
  Bot,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface AIChatHistoryProps {
  projectId: number;
  blockId?: number;
  sectionId?: number;
  taskId?: number;
  className?: string;
}

export function AIChatHistory({
  projectId,
  blockId,
  sectionId,
  taskId,
  className,
}: AIChatHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: historyData, isLoading } = trpc.aiEnhancements.getChatHistory.useQuery(
    { projectId, blockId, sectionId, taskId, limit: 50 },
    { enabled: isOpen }
  );

  const { data: searchData, isLoading: isSearching } = trpc.aiEnhancements.searchChatHistory.useQuery(
    { projectId, query: searchQuery, limit: 20 },
    { enabled: isOpen && searchQuery.length >= 2 }
  );

  const exportHistory = trpc.aiEnhancements.exportChatHistory.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], {
        type: data.format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-chat-history.${data.format === "json" ? "json" : "md"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("История экспортирована");
    },
  });

  const messages = searchQuery.length >= 2 ? searchData?.results : historyData?.history;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-2", className)}>
          <History className="h-4 w-4" />
          История AI
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            История диалогов с AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and export */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск в истории..."
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHistory.mutate({ projectId, format: "markdown" })}
              disabled={exportHistory.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </Button>
          </div>

          {/* Messages */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {isLoading || isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              </div>
            ) : messages && messages.length > 0 ? (
              messages.map((msg: { id: number; role: string; content: string; provider?: string | null; createdAt: Date }) => (
                <Card
                  key={msg.id}
                  className={cn(
                    "bg-slate-800/50",
                    msg.role === "user" ? "ml-8" : "mr-8"
                  )}
                >
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {msg.role === "user" ? (
                        <User className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Bot className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(msg.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "Ничего не найдено" : "История пуста"}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
