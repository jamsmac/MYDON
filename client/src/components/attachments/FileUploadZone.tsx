/**
 * FileUploadZone - Universal file upload component
 * Supports drag & drop and click-to-upload with validation
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Paperclip, Upload, X, FileText, Image, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  projectId: number;
  entityType: "project" | "block" | "section" | "task";
  entityId: number;
  mode?: "full" | "compact";
  onUploadComplete?: (attachment: { id: number; fileName: string; fileUrl: string | null; mimeType: string; fileSize: number }) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
}

interface PendingFile {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

// Get icon for file type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("text")) return FileText;
  return File;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadZone({
  projectId,
  entityType,
  entityId,
  mode = "full",
  onUploadComplete,
  onUploadError,
  disabled = false,
  maxFiles = 10,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get settings for validation
  const { data: settings } = trpc.attachments.getSettings.useQuery();

  // Upload mutation
  const uploadMutation = trpc.attachments.upload.useMutation({
    onSuccess: (attachment) => {
      onUploadComplete?.(attachment);
    },
    onError: (error) => {
      onUploadError?.(error.message);
    },
  });

  // Validate file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (!settings) return { valid: true }; // Allow if settings not loaded yet

    const maxSizeBytes = (settings.maxFileSizeMB ?? 100) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `Файл слишком большой (макс. ${settings.maxFileSizeMB} MB)` };
    }

    if (settings.allowedMimeTypes && !settings.allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: `Тип файла ${file.type} не разрешён` };
    }

    return { valid: true };
  }, [settings]);

  // Process files for upload
  const processFiles = useCallback(async (files: File[]) => {
    const newPendingFiles: PendingFile[] = files.slice(0, maxFiles).map(file => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      status: "pending" as const,
    }));

    setPendingFiles(prev => [...prev, ...newPendingFiles]);

    // Upload each file
    for (const pendingFile of newPendingFiles) {
      const validation = validateFile(pendingFile.file);
      if (!validation.valid) {
        setPendingFiles(prev =>
          prev.map(pf =>
            pf.file === pendingFile.file
              ? { ...pf, status: "error" as const, error: validation.error }
              : pf
          )
        );
        continue;
      }

      setPendingFiles(prev =>
        prev.map(pf =>
          pf.file === pendingFile.file ? { ...pf, status: "uploading" as const } : pf
        )
      );

      try {
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // Remove data:... prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile.file);
        });

        await uploadMutation.mutateAsync({
          projectId,
          entityType,
          entityId,
          fileData: base64,
          fileName: pendingFile.file.name,
          mimeType: pendingFile.file.type,
        });

        setPendingFiles(prev =>
          prev.map(pf =>
            pf.file === pendingFile.file ? { ...pf, status: "done" as const } : pf
          )
        );

        // Remove completed file after a delay
        setTimeout(() => {
          setPendingFiles(prev => prev.filter(pf => pf.file !== pendingFile.file));
        }, 1000);
      } catch (error) {
        setPendingFiles(prev =>
          prev.map(pf =>
            pf.file === pendingFile.file
              ? { ...pf, status: "error" as const, error: (error as Error).message }
              : pf
          )
        );
      }
    }
  }, [projectId, entityType, entityId, maxFiles, validateFile, uploadMutation]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Remove pending file
  const removePendingFile = (file: File) => {
    setPendingFiles(prev => prev.filter(pf => pf.file !== file));
  };

  // Compact mode - button with popover
  if (mode === "compact") {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn("h-8 w-8", className)}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
              isDragging ? "border-amber-500 bg-amber-500/10" : "border-slate-700 hover:border-slate-600",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={settings?.allowedMimeTypes?.join(",")}
              onChange={handleFileChange}
              disabled={disabled}
              className="hidden"
            />

            <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-400 mb-2">
              Перетащите файлы сюда
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              Выбрать файл
            </Button>
            <p className="text-xs text-slate-500 mt-2">
              Макс. размер: {settings?.maxFileSizeMB ?? 100} MB
            </p>
          </div>

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingFiles.map((pf, idx) => {
                const IconComponent = getFileIcon(pf.file.type);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 text-xs",
                      pf.status === "error" && "bg-red-900/20"
                    )}
                  >
                    <IconComponent className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate flex-1">{pf.file.name}</span>
                    {pf.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    )}
                    {pf.status === "error" && (
                      <span className="text-red-400 truncate">{pf.error}</span>
                    )}
                    {pf.status === "done" && (
                      <span className="text-emerald-400">OK</span>
                    )}
                    {(pf.status === "pending" || pf.status === "error") && (
                      <button
                        onClick={() => removePendingFile(pf.file)}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Full mode - drag & drop zone
  return (
    <div className={className}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-amber-500 bg-amber-500/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-600",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={settings?.allowedMimeTypes?.join(",")}
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />

        <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
        <p className="text-slate-300 mb-1">Перетащите файлы сюда</p>
        <p className="text-sm text-slate-500 mb-4">или</p>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Upload className="h-4 w-4 mr-2" />
          Выбрать файлы
        </Button>
        <p className="text-xs text-slate-500 mt-4">
          Макс. размер файла: {settings?.maxFileSizeMB ?? 100} MB
        </p>
      </div>

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {pendingFiles.map((pf, idx) => {
            const IconComponent = getFileIcon(pf.file.type);
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-slate-800/50",
                  pf.status === "error" && "bg-red-900/20"
                )}
              >
                <IconComponent className="h-5 w-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{pf.file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(pf.file.size)}</p>
                </div>
                {pf.status === "uploading" && (
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                )}
                {pf.status === "error" && (
                  <span className="text-sm text-red-400 truncate max-w-[150px]">{pf.error}</span>
                )}
                {pf.status === "done" && (
                  <span className="text-sm text-emerald-400">Загружено</span>
                )}
                {(pf.status === "pending" || pf.status === "error") && (
                  <button
                    onClick={() => removePendingFile(pf.file)}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FileUploadZone;
