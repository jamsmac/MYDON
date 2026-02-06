/**
 * CSV Import Dialog - Import tasks from CSV with column mapping
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CSVImportDialogProps {
  projectId: number;
  sectionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Available task fields for mapping
const TASK_FIELDS = [
  { value: 'title', label: 'Название', required: true },
  { value: 'description', label: 'Описание', required: false },
  { value: 'status', label: 'Статус', required: false },
  { value: 'priority', label: 'Приоритет', required: false },
  { value: 'deadline', label: 'Дедлайн', required: false },
  { value: 'estimatedHours', label: 'Оценка (часы)', required: false },
  { value: 'tags', label: 'Теги', required: false },
  { value: 'ignore', label: '— Пропустить —', required: false },
];

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  [csvColumn: string]: string;
}

export function CSVImportDialog({ 
  projectId, 
  sectionId, 
  open, 
  onOpenChange,
  onSuccess 
}: CSVImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [csvData, setCsvData] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importProgress, setImportProgress] = useState(0);
  
  const utils = trpc.useUtils();
  
  const createTask = trpc.task.create.useMutation();
  
  // Parse CSV file
  const parseCSV = (text: string): ParsedCSV => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Файл пуст');
    }
    
    // Simple CSV parsing (handles basic cases)
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
          if (inQuotes && row[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      
      return result;
    };
    
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);
    
    return { headers, rows };
  };
  
  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        setCsvData(parsed);
        
        // Auto-map columns by name matching
        const autoMapping: ColumnMapping = {};
        for (const header of parsed.headers) {
          const lowerHeader = header.toLowerCase();
          
          if (lowerHeader.includes('название') || lowerHeader.includes('title') || lowerHeader.includes('name') || lowerHeader.includes('задача')) {
            autoMapping[header] = 'title';
          } else if (lowerHeader.includes('описание') || lowerHeader.includes('description')) {
            autoMapping[header] = 'description';
          } else if (lowerHeader.includes('статус') || lowerHeader.includes('status')) {
            autoMapping[header] = 'status';
          } else if (lowerHeader.includes('приоритет') || lowerHeader.includes('priority')) {
            autoMapping[header] = 'priority';
          } else if (lowerHeader.includes('дедлайн') || lowerHeader.includes('deadline') || lowerHeader.includes('срок') || lowerHeader.includes('дата')) {
            autoMapping[header] = 'deadline';
          } else if (lowerHeader.includes('час') || lowerHeader.includes('hour') || lowerHeader.includes('оценка') || lowerHeader.includes('estimate')) {
            autoMapping[header] = 'estimatedHours';
          } else if (lowerHeader.includes('тег') || lowerHeader.includes('tag') || lowerHeader.includes('метк')) {
            autoMapping[header] = 'tags';
          } else {
            autoMapping[header] = 'ignore';
          }
        }
        
        setMapping(autoMapping);
        setStep('mapping');
      } catch (error) {
        toast.error(`Ошибка парсинга CSV: ${(error as Error).message}`);
      }
    };
    
    reader.readAsText(file);
  }, []);
  
  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileUpload({ target: input } as any);
    }
  }, [handleFileUpload]);
  
  // Parse value based on field type
  const parseValue = (value: string, field: string): any => {
    if (!value || value.trim() === '') return null;
    
    switch (field) {
      case 'status':
        const lowerStatus = value.toLowerCase();
        if (lowerStatus.includes('выполн') || lowerStatus.includes('done') || lowerStatus.includes('completed')) {
          return 'completed';
        } else if (lowerStatus.includes('процесс') || lowerStatus.includes('progress') || lowerStatus.includes('работ')) {
          return 'in_progress';
        }
        return 'not_started';
        
      case 'priority':
        const lowerPriority = value.toLowerCase();
        if (lowerPriority.includes('высок') || lowerPriority.includes('high') || lowerPriority === '1') {
          return 'high';
        } else if (lowerPriority.includes('низк') || lowerPriority.includes('low') || lowerPriority === '3') {
          return 'low';
        }
        return 'medium';
        
      case 'deadline':
        // Try to parse date
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
        // Try Russian format DD.MM.YYYY
        const parts = value.split(/[./-]/);
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          const parsed = new Date(year, month - 1, day);
          if (!isNaN(parsed.getTime())) {
            return parsed;
          }
        }
        return null;
        
      case 'estimatedHours':
        const num = parseFloat(value.replace(',', '.'));
        return isNaN(num) ? null : num;
        
      case 'tags':
        return value.split(/[,;]/).map(t => t.trim()).filter(Boolean);
        
      default:
        return value;
    }
  };
  
  // Get preview data
  const getPreviewTasks = () => {
    if (!csvData) return [];
    
    return csvData.rows.slice(0, 5).map((row, index) => {
      const task: Record<string, any> = { _rowIndex: index };
      
      csvData.headers.forEach((header, colIndex) => {
        const field = mapping[header];
        if (field && field !== 'ignore') {
          task[field] = parseValue(row[colIndex], field);
        }
      });
      
      return task;
    });
  };
  
  // Import tasks
  const handleImport = async () => {
    if (!csvData) return;
    
    setStep('importing');
    setImportProgress(0);
    
    const total = csvData.rows.length;
    let imported = 0;
    let failed = 0;
    
    for (const row of csvData.rows) {
      try {
        const taskData: any = {
          sectionId,
          title: '',
        };
        
        csvData.headers.forEach((header, colIndex) => {
          const field = mapping[header];
          if (field && field !== 'ignore') {
            const value = parseValue(row[colIndex], field);
            if (value !== null) {
              taskData[field] = value;
            }
          }
        });
        
        // Skip rows without title
        if (!taskData.title || taskData.title.trim() === '') {
          failed++;
          continue;
        }
        
        await createTask.mutateAsync(taskData);
        imported++;
      } catch (error) {
        failed++;
        console.error('Import error:', error);
      }
      
      setImportProgress(Math.round(((imported + failed) / total) * 100));
    }
    
    utils.task.list.invalidate({ sectionId });
    
    toast.success(`Импортировано: ${imported} задач${failed > 0 ? `, пропущено: ${failed}` : ''}`);
    
    onSuccess?.();
    handleClose();
  };
  
  const handleClose = () => {
    setStep('upload');
    setCsvData(null);
    setMapping({});
    setImportProgress(0);
    onOpenChange(false);
  };
  
  // Check if mapping is valid
  const isMappingValid = () => {
    return Object.values(mapping).includes('title');
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            Импорт из CSV
          </DialogTitle>
        </DialogHeader>
        
        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2 border-b border-slate-700">
          {['upload', 'mapping', 'preview'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-4 h-4 text-slate-600" />}
              <Badge
                variant={step === s ? 'default' : 'outline'}
                className={cn(
                  step === s 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' 
                    : 'border-slate-600 text-slate-500'
                )}
              >
                {i + 1}. {s === 'upload' ? 'Загрузка' : s === 'mapping' ? 'Маппинг' : 'Превью'}
              </Badge>
            </div>
          ))}
        </div>
        
        <ScrollArea className="flex-1">
          {/* Upload step */}
          {step === 'upload' && (
            <div 
              className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-700 rounded-lg m-4 hover:border-slate-600 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400 mb-4">
                Перетащите CSV файл сюда или
              </p>
              <label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" className="border-slate-700 cursor-pointer" asChild>
                  <span>Выберите файл</span>
                </Button>
              </label>
              <p className="text-xs text-slate-500 mt-4">
                Поддерживается: CSV с разделителями запятая или точка с запятой
              </p>
            </div>
          )}
          
          {/* Mapping step */}
          {step === 'mapping' && csvData && (
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-400">
                Сопоставьте колонки CSV с полями задач. Поле "Название" обязательно.
              </p>
              
              <div className="space-y-3">
                {csvData.headers.map((header) => (
                  <div key={header} className="flex items-center gap-4">
                    <div className="w-1/3">
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {header}
                      </Badge>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                    <div className="flex-1">
                      <Select
                        value={mapping[header] || 'ignore'}
                        onValueChange={(v) => setMapping({ ...mapping, [header]: v })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {TASK_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              <span className={field.required ? 'text-amber-400' : ''}>
                                {field.label}
                                {field.required && ' *'}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              
              {!isMappingValid() && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Выберите колонку для поля "Название"
                </div>
              )}
            </div>
          )}
          
          {/* Preview step */}
          {step === 'preview' && csvData && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Превью первых 5 задач из {csvData.rows.length}
                </p>
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Готово к импорту
                </Badge>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Название</TableHead>
                    <TableHead className="text-slate-400">Статус</TableHead>
                    <TableHead className="text-slate-400">Приоритет</TableHead>
                    <TableHead className="text-slate-400">Дедлайн</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPreviewTasks().map((task, i) => (
                    <TableRow key={i} className="border-slate-700">
                      <TableCell className="text-slate-200">{task.title || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                          {task.status || 'not_started'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            task.priority === 'high' && 'border-red-500/50 text-red-400',
                            task.priority === 'medium' && 'border-amber-500/50 text-amber-400',
                            task.priority === 'low' && 'border-slate-500/50 text-slate-400',
                          )}
                        >
                          {task.priority || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Importing step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
              <p className="text-slate-300 mb-2">Импорт задач...</p>
              <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">{importProgress}%</p>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="border-t border-slate-700 pt-4">
          {step !== 'importing' && (
            <Button variant="outline" onClick={handleClose} className="border-slate-700">
              Отмена
            </Button>
          )}
          
          {step === 'mapping' && (
            <Button 
              onClick={() => setStep('preview')}
              disabled={!isMappingValid()}
            >
              Далее
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')} className="border-slate-700">
                Назад
              </Button>
              <Button onClick={handleImport}>
                Импортировать {csvData?.rows.length} задач
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CSVImportDialog;
