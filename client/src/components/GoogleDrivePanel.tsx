import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Cloud, 
  CloudOff, 
  Upload, 
  Download, 
  Trash2, 
  Link, 
  Loader2, 
  CheckCircle,
  FolderOpen,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface GoogleDrivePanelProps {
  projectId: number;
  projectName: string;
}

export function GoogleDrivePanel({ projectId, projectName }: GoogleDrivePanelProps) {
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: connectionStatus, isLoading: checkingConnection, refetch: recheckConnection } = 
    trpc.drive.checkConnection.useQuery(undefined, {
      staleTime: 60000, // Cache for 1 minute
    });

  const { data: driveFiles, isLoading: loadingFiles, refetch: refetchFiles } = 
    trpc.drive.listFiles.useQuery(undefined, {
      enabled: showFilesDialog,
    });

  const saveProject = trpc.drive.saveProject.useMutation({
    onSuccess: (result) => {
      toast.success('Проект сохранён в Google Drive', {
        description: result.path,
        action: result.link ? {
          label: 'Открыть',
          onClick: () => window.open(result.link, '_blank'),
        } : undefined,
      });
      refetchFiles();
    },
    onError: (error) => {
      toast.error('Ошибка сохранения', {
        description: error.message,
      });
    },
  });

  const deleteFile = trpc.drive.deleteFile.useMutation({
    onSuccess: () => {
      toast.success('Файл удалён из Google Drive');
      refetchFiles();
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error('Ошибка удаления', {
        description: error.message,
      });
    },
  });

  const handleSave = () => {
    saveProject.mutate({ projectId });
  };

  const handleDelete = (filename: string) => {
    if (confirm(`Удалить файл "${filename}" из Google Drive?`)) {
      deleteFile.mutate({ filename });
    }
  };

  const isConnected = connectionStatus?.connected;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isConnected ? (
            <Cloud className="w-5 h-5 text-emerald-500" />
          ) : (
            <CloudOff className="w-5 h-5 text-slate-500" />
          )}
          Google Drive
        </CardTitle>
        <CardDescription>
          {checkingConnection ? (
            'Проверка подключения...'
          ) : isConnected ? (
            <span className="text-emerald-400">Подключено</span>
          ) : (
            <span className="text-amber-400">Не подключено</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isConnected ? (
          <>
            <Button
              onClick={handleSave}
              disabled={saveProject.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {saveProject.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Сохранить в Drive
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowFilesDialog(true)}
              className="w-full border-slate-600"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Мои файлы в Drive
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-3">
              Google Drive интеграция настроена на уровне системы
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => recheckConnection()}
              disabled={checkingConnection}
            >
              {checkingConnection ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Проверить подключение
            </Button>
          </div>
        )}

        {/* Files Dialog */}
        <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
          <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Файлы в Google Drive
              </DialogTitle>
              <DialogDescription>
                Папка: MYDON_Roadmaps
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[400px] overflow-y-auto">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : driveFiles && driveFiles.length > 0 ? (
                <div className="space-y-2">
                  {driveFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(file.modTime).toLocaleString('ru-RU')} • {Math.round(file.size / 1024)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(file.name)}
                          disabled={deleteFile.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Cloud className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Нет сохранённых файлов</p>
                  <p className="text-sm">Сохраните проект, чтобы он появился здесь</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => refetchFiles()}
                disabled={loadingFiles}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingFiles ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button onClick={() => setShowFilesDialog(false)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
