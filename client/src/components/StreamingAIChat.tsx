import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';
import {
  MessageSquare,
  Loader2,
  Copy,
  Bookmark,
  Save,
  Send,
  StopCircle
} from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  provider?: string | null;
}

interface StreamingAIChatProps {
  contextType: 'project' | 'block' | 'section' | 'task';
  contextId: number;
  contextTitle: string;
  contextContent?: string;
  onSaveAsNote?: (content: string) => void;
  onSaveAsDocument?: (content: string) => void;
}

export function StreamingAIChat({
  contextType,
  contextId,
  contextTitle,
  contextContent,
  onSaveAsNote,
  onSaveAsDocument
}: StreamingAIChatProps) {
  const [message, setMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: history, refetch } = trpc.chat.history.useQuery({
    contextType,
    contextId,
    limit: 50
  });

  // Sync history with local messages
  useEffect(() => {
    if (history) {
      setLocalMessages(history.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        provider: msg.provider
      })));
    }
  }, [history]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, streamingContent]);

  const handleSend = async () => {
    if (!message.trim() || isStreaming) return;

    const userMessage = message.trim();
    setMessage('');
    setIsStreaming(true);
    setStreamingContent('');

    // Add user message to local state immediately
    const tempUserMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: userMessage
    };
    setLocalMessages(prev => [...prev, tempUserMsg]);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          contextType,
          contextId,
          content: userMessage,
          projectContext: contextContent
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // Check for done event with message ID
              if (parsed.type === 'done') {
                // Refresh history to get proper IDs
                refetch();
                continue;
              }

              // Check for error
              if (parsed.type === 'error') {
                toast.error(parsed.message || 'Stream error');
                continue;
              }

              // Extract content from delta
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                setStreamingContent(fullContent);
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      // Add assistant message to local state
      if (fullContent) {
        const assistantMsg: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: fullContent,
          provider: 'manus'
        };
        setLocalMessages(prev => [...prev, assistantMsg]);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info('Генерация остановлена');
      } else {
        toast.error('Ошибка: ' + error.message);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
          {isStreaming && (
            <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Генерация...
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">Контекст: {contextTitle}</p>
        {contextContent && (
          <p className="text-xs text-emerald-500 mt-1">✓ Контекст загружен</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {localMessages.length > 0 || streamingContent ? (
            <div className="space-y-4">
              {localMessages.map((msg) => (
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

              {/* Streaming message */}
              {streamingContent && (
                <div className="bg-slate-700/50 text-slate-300 mr-4 p-3 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">AI (manus)</p>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Streamdown>{streamingContent}</Streamdown>
                  </div>
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
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                onClick={handleStop}
                size="sm"
                variant="destructive"
                className="bg-red-500 hover:bg-red-600"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!message.trim()}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-slate-900"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
