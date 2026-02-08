/**
 * AI Chat Panel Component
 * Context-aware AI chat for projects, blocks, sections, and tasks
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { MessageSquare, Loader2, Copy, Bookmark, Save } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface AIChatPanelProps {
  contextType: 'project' | 'block' | 'section' | 'task';
  contextId: number;
  contextTitle: string;
  contextContent?: string;
  onSaveAsNote?: (content: string) => void;
  onSaveAsDocument?: (content: string) => void;
}

export function AIChatPanel({
  contextType,
  contextId,
  contextTitle,
  contextContent,
  onSaveAsNote,
  onSaveAsDocument
}: AIChatPanelProps) {
  const [message, setMessage] = useState('');
  const { data: history, refetch } = trpc.chat.history.useQuery({
    contextType,
    contextId,
    limit: 50
  });

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage('');
      refetch();
    },
    onError: (error) => {
      toast.error('Ошибка: ' + error.message);
    }
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({
      contextType,
      contextId,
      content: message.trim(),
      projectContext: contextContent
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано в буфер обмена');
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col">
      <CardHeader className="border-b border-slate-700 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <CardTitle className="text-sm text-white">AI Ассистент</CardTitle>
        </div>
        <p className="text-xs text-slate-500 mt-1">Контекст: {contextTitle}</p>
        {contextContent && (
          <p className="text-xs text-emerald-500 mt-1">✓ Контекст загружен</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea className="flex-1 p-4">
          {history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "p-3 rounded-lg text-sm relative group",
                    msg.role === 'user'
                      ? "bg-amber-500/10 text-amber-100 ml-8"
                      : "bg-slate-700/50 text-slate-300 mr-4"
                  )}
                >
                  <p className="text-xs text-slate-500 mb-1">
                    {msg.role === 'user' ? 'Вы' : 'AI'}
                    {msg.provider && ` (${msg.provider})`}
                  </p>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>

                  {/* Action buttons for AI messages */}
                  {msg.role === 'assistant' && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => copyToClipboard(msg.content)}
                        title="Копировать"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {onSaveAsNote && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-amber-400"
                          onClick={() => onSaveAsNote(msg.content)}
                          title="Сохранить как заметку"
                        >
                          <Bookmark className="w-3 h-3" />
                        </Button>
                      )}
                      {onSaveAsDocument && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-emerald-400"
                          onClick={() => onSaveAsDocument(msg.content)}
                          title="Сохранить как документ"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="bg-slate-700/50 text-slate-300 mr-4 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">AI</p>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Начните диалог с AI</p>
              <p className="text-xs mt-2">AI видит контекст текущего элемента</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Задайте вопрос..."
              className="bg-slate-900 border-slate-600 text-white text-sm"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={sendMessage.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={sendMessage.isPending || !message.trim()}
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Отправить'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
