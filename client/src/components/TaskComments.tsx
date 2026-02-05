import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TypingIndicator } from "@/components/TypingIndicator";
import { cn } from "@/lib/utils";
import { 
  Send, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Reply,
  MessageSquare,
  Smile
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface TaskCommentsProps {
  taskId: number;
  projectId: number;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  typingUsers?: { userId: number; userName: string }[];
}

export function TaskComments({
  taskId,
  projectId,
  onTypingStart,
  onTypingStop,
  typingUsers = [],
}: TaskCommentsProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const { data: comments, refetch } = trpc.collaboration.listComments.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  const addComment = trpc.collaboration.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      setReplyingTo(null);
      refetch();
      toast.success("Комментарий добавлен");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateComment = trpc.collaboration.updateComment.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditContent("");
      refetch();
      toast.success("Комментарий обновлён");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteComment = trpc.collaboration.deleteComment.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Комментарий удалён");
    },
    onError: (error) => toast.error(error.message),
  });

  const addReaction = trpc.collaboration.addReaction.useMutation({
    onSuccess: () => refetch(),
    onError: (error) => toast.error(error.message),
  });

  // Handle typing indicator with debounce
  const handleTypingChange = useCallback((value: string) => {
    setNewComment(value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing if not already
    if (value.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart?.();
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop?.();
      }
    }, 2000);
  }, [onTypingStart, onTypingStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        onTypingStop?.();
      }
    };
  }, [onTypingStop]);

  // Stop typing when comment is submitted
  const handleSubmit = () => {
    if (!newComment.trim()) return;

    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    addComment.mutate({
      taskId,
      content: newComment.trim(),
      parentId: replyingTo ?? undefined,
    });
  };

  const handleEdit = (commentId: number) => {
    updateComment.mutate({
      commentId,
      content: editContent.trim(),
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserColor = (userId: number) => {
    const colors = [
      "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-green-500",
      "bg-teal-500", "bg-cyan-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500",
      "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
    ];
    return colors[userId % colors.length];
  };

  const commonEmojis = ["👍", "❤️", "😊", "🎉", "🤔", "👀"];

  // Filter out current user from typing users
  const otherTypingUsers = typingUsers.filter(u => u.userId !== user?.id);

  return (
    <div className="space-y-4">
      {/* Comments List */}
      <div className="space-y-3">
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "group flex gap-3 p-3 rounded-lg transition-colors",
                "hover:bg-slate-800/50"
              )}
            >
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className={cn("text-white text-xs", getUserColor(comment.userId))}>
                  {getInitials(comment.userName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    {comment.userName || "Пользователь"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </span>
                  {comment.isEdited && (
                    <span className="text-xs text-slate-500">(изменено)</span>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEdit(comment.id)}
                        disabled={!editContent.trim()}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-900"
                      >
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditContent("");
                        }}
                        className="border-slate-600"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                )}

                {/* Reactions */}
                {comment.reactions && comment.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(
                      comment.reactions.reduce((acc, r) => {
                        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => addReaction.mutate({ commentId: comment.id, emoji })}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-xs flex items-center gap-1",
                          "bg-slate-700/50 hover:bg-slate-700 transition-colors",
                          comment.reactions?.some(
                            (r) => r.emoji === emoji && r.userId === user?.id
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
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                    {/* Quick reactions */}
                    <div className="flex gap-1 p-2 border-b border-slate-700">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction.mutate({ commentId: comment.id, emoji })}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <DropdownMenuItem
                      onClick={() => setReplyingTo(comment.id)}
                      className="text-slate-300"
                    >
                      <Reply className="w-4 h-4 mr-2" />
                      Ответить
                    </DropdownMenuItem>
                    {comment.userId === user?.id && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="text-slate-300"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteComment.mutate({ commentId: comment.id })}
                          className="text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
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
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет комментариев</p>
            <p className="text-xs">Будьте первым, кто оставит комментарий</p>
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      {otherTypingUsers.length > 0 && (
        <TypingIndicator users={otherTypingUsers} className="px-3" />
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
          <Reply className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">
            Ответ на комментарий #{replyingTo}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplyingTo(null)}
            className="ml-auto h-6 text-slate-400"
          >
            Отмена
          </Button>
        </div>
      )}

      {/* New Comment Input */}
      <div className="flex gap-2">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className={cn("text-white text-xs", user?.id ? getUserColor(user.id) : "bg-slate-600")}>
            {getInitials(user?.name || null)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => handleTypingChange(e.target.value)}
            placeholder="Написать комментарий..."
            className="bg-slate-900 border-slate-600 text-white min-h-[40px] max-h-[120px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim() || addComment.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
