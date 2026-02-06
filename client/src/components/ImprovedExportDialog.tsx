/**
 * Improved Export Dialog Component
 * Provides multiple export formats with preview and options
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Download, 
  FileJson, 
  FileText, 
  Table2, 
  FileCode,
  Loader2,
  Check,
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: typeof FileJson;
  extension: string;
  endpoint: string;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'json',
    name: 'JSON',
    description: 'Полный экспорт со всеми данными. Идеально для резервного копирования и переноса.',
    icon: FileJson,
    extension: '.json',
    endpoint: '/api/export/json',
  },
  {
    id: 'csv',
    name: 'CSV',
    description: 'Таблица задач для Excel/Google Sheets. Только задачи без вложенной структуры.',
    icon: Table2,
    extension: '.csv',
    endpoint: '/api/export/csv',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Документ в формате Markdown. Подходит для документации и GitHub.',
    icon: FileText,
    extension: '.md',
    endpoint: '/api/export/markdown',
  },
  {
    id: 'html',
    name: 'HTML',
    description: 'Отчёт в HTML формате. Можно открыть в браузере или конвертировать в PDF.',
    icon: FileCode,
    extension: '.html',
    endpoint: '/api/export/html',
  },
];

interface ImprovedExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
}

export function ImprovedExportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ImprovedExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeNotes: true,
    includeSubtasks: true,
    includeCompletedOnly: false,
  });

  const currentFormat = EXPORT_FORMATS.find(f => f.id === selectedFormat);

  const handleExport = async () => {
    if (!currentFormat) return;

    setIsExporting(true);
    try {
      // Build URL with options as query params
      const url = new URL(`${currentFormat.endpoint}/${projectId}`, window.location.origin);
      if (exportOptions.includeCompletedOnly) {
        url.searchParams.set('completedOnly', 'true');
      }

      // Trigger download
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${projectName.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_export${currentFormat.extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success(`Экспорт в ${currentFormat.name} завершён`);
      onOpenChange(false);
    } catch (error) {
      toast.error('Ошибка экспорта');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" />
            Экспорт проекта
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Выберите формат экспорта для проекта "{projectName}"
          </DialogDescription>
        </DialogHeader>

        {/* Format Selection */}
        <div className="grid grid-cols-2 gap-3 py-4">
          {EXPORT_FORMATS.map(format => {
            const Icon = format.icon;
            const isSelected = selectedFormat === format.id;

            return (
              <Card
                key={format.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected
                    ? "bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/30"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                )}
                onClick={() => setSelectedFormat(format.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-purple-500/20" : "bg-slate-700/50"
                    )}>
                      <Icon className={cn(
                        "w-5 h-5",
                        isSelected ? "text-purple-400" : "text-slate-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={cn(
                          "font-medium",
                          isSelected ? "text-white" : "text-slate-300"
                        )}>
                          {format.name}
                        </h4>
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-500">
                          {format.extension}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {format.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Export Options */}
        <div className="space-y-3 py-2 border-t border-slate-700">
          <h4 className="text-sm font-medium text-slate-300">Опции экспорта</h4>
          
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeNotes"
              checked={exportOptions.includeNotes}
              onCheckedChange={(checked) => 
                setExportOptions(prev => ({ ...prev, includeNotes: !!checked }))
              }
            />
            <Label htmlFor="includeNotes" className="text-sm text-slate-400 cursor-pointer">
              Включить заметки и документы
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="includeSubtasks"
              checked={exportOptions.includeSubtasks}
              onCheckedChange={(checked) => 
                setExportOptions(prev => ({ ...prev, includeSubtasks: !!checked }))
              }
            />
            <Label htmlFor="includeSubtasks" className="text-sm text-slate-400 cursor-pointer">
              Включить подзадачи
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="completedOnly"
              checked={exportOptions.includeCompletedOnly}
              onCheckedChange={(checked) => 
                setExportOptions(prev => ({ ...prev, includeCompletedOnly: !!checked }))
              }
            />
            <Label htmlFor="completedOnly" className="text-sm text-slate-400 cursor-pointer">
              Только завершённые задачи
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700"
          >
            Отмена
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Экспортировать {currentFormat?.name}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImprovedExportDialog;
