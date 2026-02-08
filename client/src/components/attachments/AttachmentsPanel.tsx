/**
 * AttachmentsPanel - Full attachments management panel for entities
 * Lists files, allows upload, delete, and linking from project
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Paperclip,
  Plus,
  Search,
  Folder,
  Download,
  Trash2,
  Link,
  Clock,
  FileText,
  Image,
  File,
  ChevronDown,
  X,
} from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { AttachmentChip } from "./AttachmentChip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttachmentsPanelProps {
  entityType: "project" | "block" | "section" | "task";
  entityId: number;
  projectId: number;
  compact?: boolean;
  className?: string;
}

// Attachment type from API
interface Attachment {
  id: number;
  projectId: number;
  entityType: string;
  entityId: number;
  uploadedBy: number;
  fileName: string;
  fileKey: string;
  fileUrl: string | null;
  mimeType: string;
  fileSize: number;
  description: string | null;
  createdAt: Date;
  uploaderName: string | null;
  uploaderAvatar: string | null;
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

// Format date
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function AttachmentsPanel({
  entityType,
  entityId,
  projectId,
  compact = false,
  className,
}: AttachmentsPanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Get entity attachments
  const { data: attachments, isLoading } = trpc.attachments.list.useQuery({
    entityType,
    entityId,
  });

  // Get recent project attachments
  const { data: recentAttachments } = trpc.attachments.recent.useQuery({
    projectId,
  });

  // Get all project attachments for linking
  const { data: projectAttachments } = trpc.attachments.listByProject.useQuery({
    projectId,
  });

  // Delete mutation
  const deleteMutation = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      toast.success("Файл удалён");
      utils.attachments.list.invalidate({ entityType, entityId });
      setDeleteConfirm(null);
    },
    onError: (error) => toast.error(error.message),
  });

  // Link mutation
  const linkMutation = trpc.attachments.linkToEntity.useMutation({
    onSuccess: () => {
      toast.success("Файл прикреплён");
      utils.attachments.list.invalidate({ entityType, entityId });
    },
    onError: (error) => toast.error(error.message),
  });

  // Handle upload complete
  const handleUploadComplete = () => {
    utils.attachments.list.invalidate({ entityType, entityId });
    utils.attachments.recent.invalidate({ projectId });
    utils.attachments.listByProject.invalidate({ projectId });
    toast.success("Файл загружен");
  };

  // Handle delete
  const handleDelete = (id: number) => {
    deleteMutation.mutate({ attachmentId: id });
  };

  // Handle link from project
  const handleLinkFromProject = (attachmentId: number) => {
    linkMutation.mutate({
      attachmentId,
      targetEntityType: entityType,
      targetEntityId: entityId,
    });
  };

  // Filter attachments by search
  const filteredAttachments = attachments?.filter((a: Attachment) =>
    a.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Available for linking (not already attached to this entity)
  const attachedIds = new Set(attachments?.map((a: Attachment) => a.fileKey) || []);
  const availableForLinking = projectAttachments?.filter(
    (a: Attachment) => !attachedIds.has(a.fileKey)
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Actions Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить файл
        </Button>

        {/* Link from project dropdown */}
        {availableForLinking && availableForLinking.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Folder className="h-4 w-4 mr-1" />
                Из проекта
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-y-auto">
              {recentAttachments && recentAttachments.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Недавние
                  </div>
                  {recentAttachments
                    .filter((a: Attachment) => !attachedIds.has(a.fileKey))
                    .slice(0, 3)
                    .map((attachment: Attachment) => {
                      const IconComponent = getFileIcon(attachment.mimeType);
                      return (
                        <DropdownMenuItem
                          key={attachment.id}
                          onClick={() => handleLinkFromProject(attachment.id)}
                        >
                          <IconComponent className="h-4 w-4 mr-2 text-slate-400" />
                          <span className="truncate">{attachment.fileName}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  <DropdownMenuSeparator />
                </>
              )}
              <div className="px-2 py-1 text-xs text-slate-500">
                Все файлы проекта
              </div>
              {availableForLinking.slice(0, 10).map((attachment) => {
                const IconComponent = getFileIcon(attachment.mimeType);
                return (
                  <DropdownMenuItem
                    key={attachment.id}
                    onClick={() => handleLinkFromProject(attachment.id)}
                  >
                    <IconComponent className="h-4 w-4 mr-2 text-slate-400" />
                    <span className="truncate">{attachment.fileName}</span>
                  </DropdownMenuItem>
                );
              })}
              {availableForLinking.length > 10 && (
                <div className="px-2 py-1 text-xs text-slate-500 text-center">
                  +{availableForLinking.length - 10} файлов
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Search (show if many files) */}
        {attachments && attachments.length > 5 && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Поиск файлов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <FileUploadZone
          projectId={projectId}
          entityType={entityType}
          entityId={entityId}
          mode="full"
          onUploadComplete={handleUploadComplete}
          onUploadError={(error) => toast.error(error)}
        />
      )}

      {/* Attachments List */}
      {filteredAttachments && filteredAttachments.length > 0 ? (
        <div className="space-y-2">
          {filteredAttachments.map((attachment: Attachment) => {
            const IconComponent = getFileIcon(attachment.mimeType);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700 group"
              >
                <IconComponent className="h-5 w-5 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-slate-200">{attachment.fileName}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{formatFileSize(attachment.fileSize)}</span>
                    <span>·</span>
                    <span>{formatDate(attachment.createdAt)}</span>
                    {attachment.uploaderName && (
                      <>
                        <span>·</span>
                        <span>{attachment.uploaderName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {attachment.fileUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(attachment.fileUrl!, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => setDeleteConfirm(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? "Файлы не найдены" : "Нет вложений"}
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
            <AlertDialogDescription>
              Файл будет удалён. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AttachmentsPanel;
