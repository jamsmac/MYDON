import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Connection status for UI display
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

// Reconnection configuration
const RECONNECTION_CONFIG = {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,      // Start with 1s delay
  reconnectionDelayMax: 30000,  // Max 30s between attempts
  randomizationFactor: 0.5,     // Add randomness to prevent thundering herd
  timeout: 20000,               // Connection timeout
};

export interface PresenceUser {
  id: number;
  name: string;
  avatar?: string;
  color: string;
}

export interface TaskEditingInfo {
  taskId: number;
  userId: number;
  userName: string;
}

export interface TaskChangeEvent {
  type: "created" | "updated" | "deleted";
  task?: any;
  taskId?: number;
  sectionId?: number;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
}

export interface SectionChangeEvent {
  type: "updated";
  section: any;
  updatedBy: string;
}

export interface BlockChangeEvent {
  type: "updated";
  block: any;
  updatedBy: string;
}

export interface TypingUser {
  taskId: number;
  userId: number;
  userName: string;
}

interface UseSocketOptions {
  projectId?: number;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onTaskChange?: (event: TaskChangeEvent) => void;
  onSectionChange?: (event: SectionChangeEvent) => void;
  onBlockChange?: (event: BlockChangeEvent) => void;
  onTaskEditingStarted?: (info: TaskEditingInfo) => void;
  onTaskEditingStopped?: (info: { taskId: number; userId: number }) => void;
  onTaskEditingConflict?: (info: { taskId: number; editingBy: string }) => void;
  onCommentTypingStarted?: (info: TypingUser) => void;
  onCommentTypingStopped?: (info: { taskId: number; userId: number }) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onReconnectAttempt?: (attempt: number, maxAttempts: number) => void;
  onReconnectFailed?: () => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    projectId,
    onPresenceUpdate,
    onTaskChange,
    onSectionChange,
    onBlockChange,
    onTaskEditingStarted,
    onTaskEditingStopped,
    onTaskEditingConflict,
    onCommentTypingStarted,
    onCommentTypingStopped,
    onConnectionStatusChange,
    onReconnectAttempt,
    onReconnectFailed,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [editingTasks, setEditingTasks] = useState<Map<number, TaskEditingInfo>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<number, Map<number, TypingUser>>>(new Map()); // taskId -> userId -> user

  // Update connection status and notify
  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionStatusChange?.(status);
  }, [onConnectionStatusChange]);

  // Initialize socket connection
  useEffect(() => {
    // Create socket connection with reconnection config
    const socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      ...RECONNECTION_CONFIG,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setIsConnected(true);
      setReconnectAttempt(0);
      updateConnectionStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
      setPresenceUsers([]);
      setEditingTasks(new Map());

      // If server disconnected, we'll try to reconnect automatically
      if (reason === "io server disconnect") {
        // Server initiated disconnect, manually reconnect
        socket.connect();
      }
      updateConnectionStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
      updateConnectionStatus("reconnecting");
    });

    // Reconnection events
    socket.io.on("reconnect_attempt", (attempt) => {
      console.log(`[Socket] Reconnection attempt ${attempt}/${RECONNECTION_CONFIG.reconnectionAttempts}`);
      setReconnectAttempt(attempt);
      updateConnectionStatus("reconnecting");
      onReconnectAttempt?.(attempt, RECONNECTION_CONFIG.reconnectionAttempts);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log(`[Socket] Reconnected after ${attempt} attempts`);
      setReconnectAttempt(0);
      updateConnectionStatus("connected");
    });

    socket.io.on("reconnect_failed", () => {
      console.error("[Socket] Reconnection failed after max attempts");
      updateConnectionStatus("disconnected");
      onReconnectFailed?.();
    });

    socket.io.on("reconnect_error", (error) => {
      console.error("[Socket] Reconnection error:", error.message);
    });

    // Presence updates
    socket.on("presence:update", (data: { projectId: number; users: PresenceUser[] }) => {
      setPresenceUsers(data.users);
      onPresenceUpdate?.(data.users);
    });

    // Task changes
    socket.on("task:changed", (event: TaskChangeEvent) => {
      onTaskChange?.(event);
    });

    // Section changes
    socket.on("section:changed", (event: SectionChangeEvent) => {
      onSectionChange?.(event);
    });

    // Block changes
    socket.on("block:changed", (event: BlockChangeEvent) => {
      onBlockChange?.(event);
    });

    // Task editing events
    socket.on("task:editing:started", (info: TaskEditingInfo) => {
      setEditingTasks((prev) => {
        const next = new Map(prev);
        next.set(info.taskId, info);
        return next;
      });
      onTaskEditingStarted?.(info);
    });

    socket.on("task:editing:stopped", (info: { taskId: number; userId: number }) => {
      setEditingTasks((prev) => {
        const next = new Map(prev);
        next.delete(info.taskId);
        return next;
      });
      onTaskEditingStopped?.(info);
    });

    socket.on("task:editing:conflict", (info: { taskId: number; editingBy: string }) => {
      onTaskEditingConflict?.(info);
    });

    // Comment typing events
    socket.on("comment:typing:started", (info: TypingUser) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (!next.has(info.taskId)) {
          next.set(info.taskId, new Map());
        }
        next.get(info.taskId)!.set(info.userId, info);
        return next;
      });
      onCommentTypingStarted?.(info);
    });

    socket.on("comment:typing:stopped", (info: { taskId: number; userId: number }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const taskTyping = next.get(info.taskId);
        if (taskTyping) {
          taskTyping.delete(info.userId);
          if (taskTyping.size === 0) {
            next.delete(info.taskId);
          }
        }
        return next;
      });
      onCommentTypingStopped?.(info);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Join/leave project room when projectId changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !projectId) return;

    socket.emit("join:project", projectId);

    return () => {
      socket.emit("leave:project", projectId);
      setPresenceUsers([]);
      setEditingTasks(new Map());
    };
  }, [projectId, isConnected]);

  // Emit task editing started
  const startEditingTask = useCallback((taskId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("task:editing:start", { projectId, taskId });
  }, [projectId]);

  // Emit task editing stopped
  const stopEditingTask = useCallback((taskId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("task:editing:stop", { projectId, taskId });
  }, [projectId]);

  // Emit task updated
  const emitTaskUpdated = useCallback((task: any) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("task:updated", { projectId, task });
  }, [projectId]);

  // Emit task created
  const emitTaskCreated = useCallback((task: any, sectionId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("task:created", { projectId, task, sectionId });
  }, [projectId]);

  // Emit task deleted
  const emitTaskDeleted = useCallback((taskId: number, sectionId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("task:deleted", { projectId, taskId, sectionId });
  }, [projectId]);

  // Emit section updated
  const emitSectionUpdated = useCallback((section: any) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("section:updated", { projectId, section });
  }, [projectId]);

  // Emit block updated
  const emitBlockUpdated = useCallback((block: any) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("block:updated", { projectId, block });
  }, [projectId]);

  // Emit comment typing started
  const startTypingComment = useCallback((taskId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("comment:typing:start", { projectId, taskId });
  }, [projectId]);

  // Emit comment typing stopped
  const stopTypingComment = useCallback((taskId: number) => {
    const socket = socketRef.current;
    if (!socket || !projectId) return;

    socket.emit("comment:typing:stop", { projectId, taskId });
  }, [projectId]);

  // Get typing users for a task
  const getTypingUsersForTask = useCallback((taskId: number, currentUserId?: number): TypingUser[] => {
    const taskTyping = typingUsers.get(taskId);
    if (!taskTyping) return [];
    
    const users = Array.from(taskTyping.values());
    if (currentUserId) {
      return users.filter(u => u.userId !== currentUserId);
    }
    return users;
  }, [typingUsers]);

  // Check if a task is being edited by someone else
  const isTaskBeingEdited = useCallback((taskId: number, currentUserId?: number): TaskEditingInfo | null => {
    const editInfo = editingTasks.get(taskId);
    if (!editInfo) return null;
    if (currentUserId && editInfo.userId === currentUserId) return null;
    return editInfo;
  }, [editingTasks]);

  // Manual reconnect function for UI retry button
  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket && !socket.connected) {
      console.log("[Socket] Manual reconnect triggered");
      updateConnectionStatus("connecting");
      socket.connect();
    }
  }, [updateConnectionStatus]);

  return {
    isConnected,
    connectionStatus,
    reconnectAttempt,
    presenceUsers,
    editingTasks,
    startEditingTask,
    stopEditingTask,
    emitTaskUpdated,
    emitTaskCreated,
    emitTaskDeleted,
    emitSectionUpdated,
    emitBlockUpdated,
    isTaskBeingEdited,
    typingUsers,
    startTypingComment,
    stopTypingComment,
    getTypingUsersForTask,
    reconnect,
  };
}
