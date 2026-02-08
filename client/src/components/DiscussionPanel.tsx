import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import {
  Send,
  MoreVertical,
  Edit,
  Trash2,
  Reply,
  MessageSquare,
  Smile,
  CheckCircle2,
  ListTodo,
  Sparkles,
  Pin,
  Layers,
  FileText,
  FolderOpen,
  Loader2,
  ArrowRight,
  X,
  Paperclip,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { FileUploadZone, AttachmentChip } from "@/components/attachments";

type EntityType = "project" | "block" | "section" | "task";

interface Comment {
  id: number;
  content: string;
  userId: number;
  isSummary?: boolean;
  parentId?: number | null;
  userName?: string | null;
  createdAt: Date;
  mentions?: number[] | null;
  attachmentIds?: number[] | null;
  reactions?: Array<{ emoji: string; userId: number }>;
  isEdited?: boolean;
}

interface PendingAttachment {
  id: number;
  fileName: string;
  fileUrl: string | null;
  mimeType: string;
  fileSize: number;
}

interface DiscussionPanelProps {
  entityType: EntityType;
  entityId: number;
  entityTitle: string;
  projectId: number;
  /** Callback to create a task from discussion content */
  onCreateTask?: (content: string) => void;
  /** Callback to distribute discussion summary to tasks */
  onDistributeToTasks?: (summary: string) => void;
  /** Compact mode for sidebar/inline usage */
  compact?: boolean;
  className?: string;
}

const entityIcons: Record<EntityType, typeof Layers> = {
  project: FolderOpen,
  block: Layers,
  section: FileText,
  task: ListTodo,
};

const entityLabels: Record<EntityType, string> = {
  project: "Проект",
  block: "Блок",
  section: "Раздел",
  task: "Задача",
};

const entityColors: Record<EntityType, string> = {
  project: "text-purple-400",
  block: "text-amber-400",
  section: "text-emerald-400",
  task: "text-blue-400",
};

// Helper component to display attachments in comments
function CommentAttachments({ attachmentIds }: { attachmentIds: number[] }) {
  const { data: attachments } = trpc.attachments.getMany.useQuery(
    { attachmentIds },
    { enabled: attachmentIds.length > 0 }
  );

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {attachments.map((attachment: { id: number; fileName: string; fileUrl: string | null; mimeType: string; fileSize: number }) => (
        <AttachmentChip
          key={attachment.id}
          id={attachment.id}
          fileName={attachment.fileName}
          fileUrl={attachment.fileUrl}
          mimeType={attachment.mimeType}
          fileSize={attachment.fileSize}
        />
      ))}
    </div>
  );
}

// Distribute dialog for selecting which tasks to create
function DistributeDialog({
  open,
  onClose,
  suggestedTasks,
  sections: availableSections,
  onConfirm,
  isCreating,
}: {
  open: boolean;
  onClose: () => void;
  suggestedTasks: Array<{ title: string; description: string; sectionId: number | null; priority: string }>;
  sections: Array<{ id: number; title: string; blockTitle: string }>;
  onConfirm: (tasks: Array<{ title: string; description?: string; sectionId: number; priority: string }>) => void;
  isCreating: boolean;
}) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(
    new Set(suggestedTasks.map((_, i) => i))
  );
  const [taskSections, setTaskSections] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    suggestedTasks.forEach((t, i) => {
      if (t.sectionId && availableSections.some(s => s.id === t.sectionId)) {
        map[i] = t.sectionId;
      } else if (availableSections.length > 0) {
        map[i] = availableSections[0].id;
      }
    });
    return map;
  });

  useEffect(() => {
    setSelectedTasks(new Set(suggestedTasks.map((_, i) => i)));
    const map: Record<number, number> = {};
    suggestedTasks.forEach((t, i) => {
      if (t.sectionId && availableSections.some(s => s.id === t.sectionId)) {
        map[i] = t.sectionId;
      } else if (availableSections.length > 0) {
        map[i] = availableSections[0].id;
      }
    });
    setTaskSections(map);
  }, [suggestedTasks, availableSections]);

  const handleConfirm = () => {
    const tasksToCreate = suggestedTasks
      .filter((_, i) => selectedTasks.has(i))
      .map((t, i) => ({
        title: t.title,
        description: t.description,
        sectionId: taskSections[suggestedTasks.indexOf(t)] || availableSections[0]?.id || 0,
        priority: t.priority || "medium",
      }))
      .filter(t => t.sectionId > 0);
    onConfirm(tasksToCreate);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Распределение по задачам
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            AI проанализировал обсуждение и предложил задачи. Выберите, какие создать.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
          <div className="space-y-3 pr-2">
            {suggestedTasks.map((task, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  selectedTasks.has(idx)
                    ? "bg-slate-700/50 border-amber-500/30"
                    : "bg-slate-800/50 border-slate-700 opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedTasks.has(idx)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedTasks);
                      if (checked) next.add(idx);
                      else next.delete(idx);
                      setSelectedTasks(next);
                    }}
                    className="mt-0.5 border-slate-500"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{task.title}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          task.priority === "critical" && "border-red-500 text-red-400",
                          task.priority === "high" && "border-orange-500 text-orange-400",
                          task.priority === "medium" && "border-amber-500 text-amber-400",
                          task.priority === "low" && "border-slate-500 text-slate-400"
                        )}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <Select
                        value={String(taskSections[idx] || "")}
                        onValueChange={(v) => setTaskSections(prev => ({ ...prev, [idx]: Number(v) }))}
                      >
                        <SelectTrigger className="h-7 text-xs bg-slate-900 border-slate-600 text-white w-[250px]">
                          <SelectValue placeholder="Выберите раздел" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {availableSections.map(s => (
                            <SelectItem key={s.id} value={String(s.id)} className="text-slate-300 text-xs">
                              {s.blockTitle} → {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between border-t border-slate-700 pt-3">
          <span className="text-xs text-slate-400">
            Выбрано: {selectedTasks.size} из {suggestedTasks.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
              Отмена
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedTasks.size === 0 || isCreating}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ListTodo className="w-4 h-4 mr-2" />
              )}
              Создать {selectedTasks.size} {selectedTasks.size === 1 ? "задачу" : selectedTasks.size < 5 ? "задачи" : "задач"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscussionPanel({
  entityType,
  entityId,
  entityTitle,
  projectId,
  onCreateTask,
  onDistributeToTasks,
  compact = false,
  className,
}: DiscussionPanelProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<Array<{ title: string; description: string; sectionId: number | null; priority: string }>>([]);
  const [availableSections, setAvailableSections] = useState<Array<{ id: number; title: string; blockTitle: string }>>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: comments, refetch } = trpc.collaboration.listDiscussions.useQuery(
    { entityType, entityId },
    { enabled: entityId > 0 }
  );

  const addDiscussion = trpc.collaboration.addDiscussion.useMutation({
    onSuccess: () => {
      setNewComment("");
      setReplyingTo(null);
      setPendingAttachments([]);
      refetch();
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const updateComment = trpc.collaboration.updateComment.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditContent("");
      refetch();
      toast.success("Обновлено");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deleteComment = trpc.collaboration.deleteComment.useMutation({
    onSuccess: () => refetch(),
    onError: (error: any) => toast.error(error.message),
  });

  const addReaction = trpc.collaboration.addReaction.useMutation({
    onSuccess: () => refetch(),
    onError: (error: any) => toast.error(error.message),
  });

  // AI Finalize mutation
  const finalizeMutation = trpc.collaboration.finalizeDiscussion.useMutation({
    onSuccess: (data) => {
      refetch();
      toast.success("Обсуждение финализировано AI");
    },
    onError: (error: any) => toast.error(`Ошибка финализации: ${error.message}`),
  });

  // AI Distribute mutation
  const distributeMutation = trpc.collaboration.distributeDiscussion.useMutation({
    onSuccess: (data) => {
      if (data.tasks && data.tasks.length > 0) {
        setSuggestedTasks(data.tasks);
        setAvailableSections(data.sections || []);
        setDistributeOpen(true);
      } else {
        toast.info("AI не нашёл задач для создания из обсуждения");
      }
    },
    onError: (error: any) => toast.error(`Ошибка распределения: ${error.message}`),
  });

  // Create tasks from distribution
  const createTasksMutation = trpc.collaboration.createTasksFromDiscussion.useMutation({
    onSuccess: (data) => {
      setDistributeOpen(false);
      setSuggestedTasks([]);
      toast.success(`Создано ${data.count} задач`);
    },
    onError: (error: any) => toast.error(`Ошибка создания задач: ${error.message}`),
  });

  const handleSubmit = useCallback(() => {
    if (!newComment.trim() && pendingAttachments.length === 0) return;
    addDiscussion.mutate({
      entityType,
      entityId,
      content: newComment.trim() || "(файлы)",
      parentId: replyingTo ?? undefined,
      attachmentIds: pendingAttachments.length > 0 ? pendingAttachments.map(a => a.id) : undefined,
    });
  }, [newComment, entityType, entityId, replyingTo, addDiscussion, pendingAttachments]);

  // Handle attachment upload complete
  const handleAttachmentUpload = useCallback((attachment: { id: number; fileName: string; fileUrl: string | null }) => {
    setPendingAttachments(prev => [...prev, { ...attachment, mimeType: '', fileSize: 0 }]);
  }, []);

  // Remove pending attachment
  const removePendingAttachment = useCallback((id: number) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAIFinalize = useCallback(() => {
    finalizeMutation.mutate({
      entityType,
      entityId,
      entityTitle,
    });
  }, [entityType, entityId, entityTitle, finalizeMutation]);

  const handleAIDistribute = useCallback(() => {
    distributeMutation.mutate({
      entityType,
      entityId,
      entityTitle,
      projectId,
    });
  }, [entityType, entityId, entityTitle, projectId, distributeMutation]);

  const handleEdit = (commentId: number) => {
    updateComment.mutate({ commentId, content: editContent.trim() });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getUserColor = (userId: number) => {
    const colors = [
      "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-green-500",
      "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500",
      "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500",
    ];
    return colors[userId % colors.length];
  };

  const commonEmojis = ["👍", "❤️", "😊", "🎉", "🤔", "👀"];
  const EntityIcon = entityIcons[entityType];
  const summaryMessages = comments?.filter((c: Comment) => c.isSummary) || [];
  const regularMessages = comments?.filter((c: Comment) => !c.isSummary) || [];

  return (
    <div className={cn("flex flex-col", compact ? "h-full" : "h-full max-h-[600px]", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
        <EntityIcon className={cn("w-5 h-5", entityColors[entityType])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs border-slate-600", entityColors[entityType])}>
              {entityLabels[entityType]}
            </Badge>
            <span className="text-sm font-medium text-white truncate">{entityTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {comments && comments.length > 0 && (
            <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-xs">
              {comments.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700/30 bg-slate-800/20 overflow-x-auto">
        {onCreateTask && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 whitespace-nowrap"
            onClick={() => {
              const lastMessage = regularMessages[regularMessages.length - 1];
              if (lastMessage) {
                onCreateTask(lastMessage.content);
              } else {
                toast.info("Напишите сообщение, чтобы создать задачу");
              }
            }}
          >
            <ListTodo className="w-3.5 h-3.5 mr-1" />
            Создать задачу
          </Button>
        )}
        {regularMessages.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 whitespace-nowrap"
            onClick={handleAIFinalize}
            disabled={finalizeMutation.isPending}
          >
            {finalizeMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1" />
            )}
            AI Финализация
          </Button>
        )}
        {regularMessages.length >= 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 whitespace-nowrap"
            onClick={handleAIDistribute}
            disabled={distributeMutation.isPending}
          >
            {distributeMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 mr-1" />
            )}
            Распределить
          </Button>
        )}
      </div>

      {/* Pinned Summaries */}
      {summaryMessages.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-700/30 bg-amber-500/5 max-h-[200px] overflow-y-auto">
          {summaryMessages.map((summary: Comment) => (
            <div key={summary.id} className="flex items-start gap-2 py-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-300 prose prose-invert prose-xs max-w-none">
                <Streamdown>{summary.content}</Streamdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {regularMessages.length > 0 ? (
            regularMessages.map((comment: Comment) => (
              <div
                key={comment.id}
                className={cn(
                  "group flex gap-2.5 p-2.5 rounded-lg transition-colors",
                  "hover:bg-slate-800/50"
                )}
              >
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className={cn("text-white text-[10px]", getUserColor(comment.userId))}>
                    {getInitials(comment.userName || null)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-white">
                      {comment.userName || "Пользователь"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </span>
                    {comment.isEdited && (
                      <span className="text-[10px] text-slate-500">(ред.)</span>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="bg-slate-900 border-slate-600 text-white min-h-[50px] text-xs"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleEdit(comment.id)}
                          disabled={!editContent.trim()}
                          className="h-6 px-2 text-xs bg-amber-500 hover:bg-amber-600 text-slate-900"
                        >
                          Сохранить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingId(null); setEditContent(""); }}
                          className="h-6 px-2 text-xs text-slate-400"
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  )}

                  {/* Attachments */}
                  {comment.attachmentIds && comment.attachmentIds.length > 0 && (
                    <CommentAttachments attachmentIds={comment.attachmentIds} />
                  )}

                  {/* Reactions */}
                  {comment.reactions && comment.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(
                        comment.reactions.reduce((acc: Record<string, number>, r: { emoji: string; userId: number }) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([emoji, count]: [string, number]) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction.mutate({ commentId: comment.id, emoji })}
                          className={cn(
                            "px-1 py-0.5 rounded text-[10px] flex items-center gap-0.5",
                            "bg-slate-700/50 hover:bg-slate-700 transition-colors",
                            comment.reactions?.some(
                              (r: any) => r.emoji === emoji && r.userId === user?.id
                            ) && "ring-1 ring-amber-500"
                          )}
                        >
                          <span>{emoji}</span>
                          <span className="text-slate-400">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                      <div className="flex gap-1 p-1.5 border-b border-slate-700">
                        {commonEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => addReaction.mutate({ commentId: comment.id, emoji })}
                            className="p-0.5 hover:bg-slate-700 rounded transition-colors text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <DropdownMenuItem
                        onClick={() => setReplyingTo(comment.id)}
                        className="text-slate-300 text-xs"
                      >
                        <Reply className="w-3.5 h-3.5 mr-2" />
                        Ответить
                      </DropdownMenuItem>
                      {onCreateTask && (
                        <DropdownMenuItem
                          onClick={() => onCreateTask(comment.content)}
                          className="text-emerald-400 text-xs"
                        >
                          <ListTodo className="w-3.5 h-3.5 mr-2" />
                          Создать задачу
                        </DropdownMenuItem>
                      )}
                      {comment.userId === user?.id && (
                        <>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditContent(comment.content);
                            }}
                            className="text-slate-300 text-xs"
                          >
                            <Edit className="w-3.5 h-3.5 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm("Удалить сообщение?")) {
                                deleteComment.mutate({ commentId: comment.id });
                              }
                            }}
                            className="text-red-400 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-500">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Начните обсуждение</p>
              <p className="text-[10px] mt-1 text-slate-600">
                Обсудите вопросы по {entityLabels[entityType].toLowerCase()}у
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border-t border-slate-700/30">
          <Reply className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Ответ на #{replyingTo}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplyingTo(null)}
            className="ml-auto h-5 px-1.5 text-xs text-slate-400"
          >
            ✕
          </Button>
        </div>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-slate-700/50 bg-slate-800/10">
          {pendingAttachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              id={attachment.id}
              fileName={attachment.fileName}
              fileUrl={attachment.fileUrl}
              mimeType={attachment.mimeType}
              fileSize={attachment.fileSize}
              canDelete
              onDelete={removePendingAttachment}
            />
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-slate-700/50 bg-slate-800/20">
        <Avatar className="w-7 h-7 flex-shrink-0">
          <AvatarFallback className={cn("text-white text-[10px]", user?.id ? getUserColor(user.id) : "bg-slate-600")}>
            {getInitials(user?.name || null)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-1.5 items-start">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать сообщение..."
            className="bg-slate-900 border-slate-600 text-white min-h-[36px] max-h-[100px] text-xs resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <FileUploadZone
            projectId={projectId}
            entityType={entityType}
            entityId={entityId}
            mode="compact"
            onUploadComplete={handleAttachmentUpload}
            onUploadError={(error) => toast.error(error)}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={(!newComment.trim() && pendingAttachments.length === 0) || addDiscussion.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-9 w-9 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Distribute Dialog */}
      <DistributeDialog
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        suggestedTasks={suggestedTasks}
        sections={availableSections}
        onConfirm={(tasks) => createTasksMutation.mutate({ tasks: tasks.map(t => ({ ...t, priority: t.priority as "critical" | "high" | "medium" | "low" })) })}
        isCreating={createTasksMutation.isPending}
      />
    </div>
  );
}
