import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

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

interface UseSocketOptions {
  projectId?: number;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onTaskChange?: (event: TaskChangeEvent) => void;
  onSectionChange?: (event: SectionChangeEvent) => void;
  onBlockChange?: (event: BlockChangeEvent) => void;
  onTaskEditingStarted?: (info: TaskEditingInfo) => void;
  onTaskEditingStopped?: (info: { taskId: number; userId: number }) => void;
  onTaskEditingConflict?: (info: { taskId: number; editingBy: string }) => void;
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
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [editingTasks, setEditingTasks] = useState<Map<number, TaskEditingInfo>>(new Map());

  // Initialize socket connection
  useEffect(() => {
    // Create socket connection
    const socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
      setPresenceUsers([]);
      setEditingTasks(new Map());
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error.message);
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

  // Check if a task is being edited by someone else
  const isTaskBeingEdited = useCallback((taskId: number, currentUserId?: number): TaskEditingInfo | null => {
    const editInfo = editingTasks.get(taskId);
    if (!editInfo) return null;
    if (currentUserId && editInfo.userId === currentUserId) return null;
    return editInfo;
  }, [editingTasks]);

  return {
    isConnected,
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
  };
}
