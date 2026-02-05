import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, FileJson, Download, Loader2, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';

interface ImportedSubtask {
  title: string;
  completed?: boolean;
}

interface ImportedTask {
  title: string;
  description?: string;
  status?: string;
  subtasks?: ImportedSubtask[];
}

interface ImportedSection {
  title: string;
  tasks?: ImportedTask[];
}

interface ImportedBlock {
  number: string;
  title: string;
  titleRu?: string;
  sections?: ImportedSection[];
}

interface ImportedProject {
  name: string;
  description?: string;
  blocks: ImportedBlock[];
}

interface ImportStats {
  blocks: number;
  sections: number;
  tasks: number;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<ImportedProject | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ projectId: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setError(null);
    setPreview(null);

    try {
      const text = await file.text();
      setContent(text);
      await handlePreview(text, file.name);
    } catch (err) {
      setError('Не удалось прочитать файл');
    }
  };

  const handlePreview = async (text: string, fname?: string) => {
    if (!text.trim()) {
      setError('Содержимое пустое');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text, filename: fname || filename })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка парсинга');
      }

      setPreview(data.preview);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка парсинга файла');
      setPreview(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!content.trim()) {
      setError('Нет содержимого для импорта');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/import/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, filename })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка импорта');
      }

      setSuccess({ projectId: data.projectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  const handleGoToProject = () => {
    if (success) {
      onOpenChange(false);
      setLocation(`/project/${success.projectId}`);
    }
  };

  const handleDownloadTemplate = async (format: 'markdown' | 'json') => {
    try {
      const response = await fetch('/api/import/templates', {
        credentials: 'include'
      });
      const templates = await response.json();
      
      const content = format === 'markdown' ? templates.markdown : templates.json;
      const filename = format === 'markdown' ? 'roadmap-template.md' : 'roadmap-template.json';
      const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json';
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Не удалось скачать шаблон');
    }
  };

  const resetState = () => {
    setContent('');
    setFilename('');
    setPreview(null);
    setStats(null);
    setError(null);
    setSuccess(null);
    setLoading(false);
    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Импорт Roadmap
          </DialogTitle>
          <DialogDescription>
            Загрузите файл Markdown или JSON с структурой проекта
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Проект успешно импортирован!</h3>
            <p className="text-muted-foreground mb-6">
              Создано {stats?.blocks} блоков, {stats?.sections} разделов, {stats?.tasks} задач
            </p>
            <Button onClick={handleGoToProject} className="bg-emerald-600 hover:bg-emerald-700">
              Открыть проект
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'paste')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Загрузить файл</TabsTrigger>
                <TabsTrigger value="paste">Вставить текст</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-amber-500/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown,.json,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-1">
                    {filename || 'Перетащите файл или нажмите для выбора'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Поддерживаются форматы: .md, .json
                  </p>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate('markdown')}>
                    <FileText className="w-4 h-4 mr-1" />
                    Скачать шаблон MD
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate('json')}>
                    <FileJson className="w-4 h-4 mr-1" />
                    Скачать шаблон JSON
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <Textarea
                  placeholder="Вставьте содержимое Markdown или JSON файла..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[150px] max-h-[200px] font-mono text-sm bg-slate-800 border-slate-600 text-white"
                />
                <Button 
                  variant="outline" 
                  onClick={() => handlePreview(content)}
                  disabled={!content.trim() || loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Анализ...
                    </>
                  ) : (
                    'Предпросмотр'
                  )}
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {preview && stats && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-2">{preview.name}</h4>
                  {preview.description && (
                    <p className="text-sm text-muted-foreground mb-3">{preview.description}</p>
                  )}
                  <div className="flex gap-4 text-sm">
                    <span className="text-amber-500">{stats.blocks} блоков</span>
                    <span className="text-blue-500">{stats.sections} разделов</span>
                    <span className="text-emerald-500">{stats.tasks} задач</span>
                  </div>
                </div>

                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {preview.blocks.map((block, idx) => (
                    <div key={idx} className="p-2 bg-slate-800/50 rounded text-sm">
                      <span className="text-amber-500 font-mono mr-2">{block.number}.</span>
                      <span>{block.title}</span>
                      {block.titleRu && (
                        <span className="text-muted-foreground ml-2">/ {block.titleRu}</span>
                      )}
                      {block.sections && block.sections.length > 0 && (
                        <span className="text-muted-foreground ml-2">
                          ({block.sections.length} разд., {block.sections.reduce((acc, s) => acc + (s.tasks?.length || 0), 0)} задач)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!preview || importing}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Импорт...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Импортировать
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
