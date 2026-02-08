/**
 * AttachmentChip - Compact inline file display
 * Shows file icon, truncated name, size, and optional delete button
 */

import { File, FileText, Image, FileSpreadsheet, Presentation, Video, Music, Archive, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AttachmentChipProps {
  id: number;
  fileName: string;
  fileUrl: string | null;
  mimeType: string;
  fileSize: number;
  canDelete?: boolean;
  onDelete?: (id: number) => void;
  onClick?: () => void;
  className?: string;
}

// Get appropriate icon for file type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return Presentation;
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("archive")) return Archive;
  if (mimeType.includes("text") || mimeType.includes("document")) return FileText;
  return File;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Truncate filename
function truncateFileName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;

  const ext = name.includes(".") ? name.split(".").pop() : "";
  const baseName = ext ? name.slice(0, -(ext.length + 1)) : name;

  const availableLength = maxLength - (ext ? ext.length + 4 : 3); // 4 for "...ext", 3 for "..."

  if (availableLength <= 0) return name.substring(0, maxLength - 3) + "...";

  return baseName.substring(0, availableLength) + "..." + (ext ? `.${ext}` : "");
}

export function AttachmentChip({
  id,
  fileName,
  fileUrl,
  mimeType,
  fileSize,
  canDelete = false,
  onDelete,
  onClick,
  className,
}: AttachmentChipProps) {
  const IconComponent = getFileIcon(mimeType);
  const displayName = truncateFileName(fileName);
  const isClickable = !!fileUrl || !!onClick;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (fileUrl) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const chip = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg",
        "bg-slate-700/50 border border-slate-600 text-xs",
        isClickable && "cursor-pointer hover:bg-slate-600/50 transition-colors",
        className
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <IconComponent className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <span className="text-slate-200 truncate max-w-[120px]">{displayName}</span>
      <span className="text-slate-500">{formatFileSize(fileSize)}</span>
      {canDelete && onDelete && (
        <button
          onClick={handleDelete}
          className="ml-0.5 p-0.5 rounded hover:bg-slate-500/50 transition-colors"
        >
          <X className="h-3 w-3 text-slate-400 hover:text-slate-200" />
        </button>
      )}
    </div>
  );

  // Wrap with tooltip if name is truncated
  if (fileName !== displayName) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {chip}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="break-all">{fileName}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return chip;
}

export default AttachmentChip;
