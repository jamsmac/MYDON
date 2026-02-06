import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";

// Types for real-time events
export interface PresenceUser {
  id: number;
  name: string;
  avatar?: string;
  color: string;
}

export interface ProjectPresence {
  projectId: number;
  users: Map<string, PresenceUser>;
}

export interface TaskEditingState {
  taskId: number;
  userId: number;
  userName: string;
  startedAt: Date;
}

export interface TypingState {
  taskId: number;
  userId: number;
  userName: string;
  startedAt: Date;
}

// Store for active connections and presence
const projectPresence = new Map<number, Map<string, PresenceUser>>();
const taskEditingState = new Map<number, TaskEditingState>();
const typingState = new Map<number, Map<number, TypingState>>(); // taskId -> userId -> state
const socketToUser = new Map<string, { userId: number; userName: string }>();

// Generate consistent color from user ID
function getUserColor(userId: number): string {
  const colors = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
    "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
    "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
  ];
  return colors[userId % colors.length];
}

export function initializeSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: "/socket.io",
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Get session cookie from handshake
      const cookieHeader = socket.handshake.headers.cookie;
      let sessionToken: string | undefined;
      
      if (cookieHeader) {
        const cookies = parseCookieHeader(cookieHeader);
        sessionToken = cookies[COOKIE_NAME];
      }
      
      // Also check auth token passed directly
      if (!sessionToken && socket.handshake.auth.token) {
        sessionToken = socket.handshake.auth.token;
      }
      
      if (!sessionToken) {
        return next(new Error("Authentication required"));
      }

      // Verify session using SDK
      const session = await sdk.verifySession(sessionToken);
      if (!session || !session.openId) {
        return next(new Error("Invalid session"));
      }

      // Get user from database by openId
      const user = await db.getUserByOpenId(session.openId);
      if (!user) {
        return next(new Error("User not found"));
      }

      // Attach user to socket
      (socket as any).user = {
        id: user.id,
        name: user.name || user.email?.split("@")[0] || "User",
        avatar: (user as any).avatar,
      };

      next();
    } catch (error) {
      console.error("[Socket] Auth error:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`[Socket] User connected: ${user.name} (${user.id})`);
    
    socketToUser.set(socket.id, { userId: user.id, userName: user.name });

    // Join a project room
    socket.on("join:project", async (projectId: number) => {
      try {
        // Verify user has access to project (owner or collaborator)
        const project = await db.getProjectById(projectId, user.id);
        if (!project) {
          socket.emit("error", { message: "Access denied to project" });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);

        // Add to presence
        if (!projectPresence.has(projectId)) {
          projectPresence.set(projectId, new Map());
        }
        
        const presence = projectPresence.get(projectId)!;
        presence.set(socket.id, {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          color: getUserColor(user.id),
        });

        // Broadcast updated presence to all in room
        const usersInProject = Array.from(presence.values());
        // Deduplicate by user ID (same user might have multiple tabs)
        const uniqueUsers = Array.from(
          new Map(usersInProject.map(u => [u.id, u])).values()
        );
        
        io.to(roomName).emit("presence:update", {
          projectId,
          users: uniqueUsers,
        });

        console.log(`[Socket] ${user.name} joined project ${projectId}`);
      } catch (error) {
        console.error("[Socket] Join project error:", error);
        socket.emit("error", { message: "Failed to join project" });
      }
    });

    // Leave a project room
    socket.on("leave:project", (projectId: number) => {
      const roomName = `project:${projectId}`;
      socket.leave(roomName);

      // Remove from presence
      const presence = projectPresence.get(projectId);
      if (presence) {
        presence.delete(socket.id);
        
        const usersInProject = Array.from(presence.values());
        const uniqueUsers = Array.from(
          new Map(usersInProject.map(u => [u.id, u])).values()
        );
        
        io.to(roomName).emit("presence:update", {
          projectId,
          users: uniqueUsers,
        });
      }

      console.log(`[Socket] ${user.name} left project ${projectId}`);
    });

    // Task editing started
    socket.on("task:editing:start", (data: { projectId: number; taskId: number }) => {
      const { projectId, taskId } = data;
      
      // Check if someone else is already editing
      const existingEdit = taskEditingState.get(taskId);
      if (existingEdit && existingEdit.userId !== user.id) {
        socket.emit("task:editing:conflict", {
          taskId,
          editingBy: existingEdit.userName,
        });
        return;
      }

      // Set editing state
      taskEditingState.set(taskId, {
        taskId,
        userId: user.id,
        userName: user.name,
        startedAt: new Date(),
      });

      // Broadcast to others in project
      socket.to(`project:${projectId}`).emit("task:editing:started", {
        taskId,
        userId: user.id,
        userName: user.name,
      });
    });

    // Task editing stopped
    socket.on("task:editing:stop", (data: { projectId: number; taskId: number }) => {
      const { projectId, taskId } = data;
      
      const existingEdit = taskEditingState.get(taskId);
      if (existingEdit && existingEdit.userId === user.id) {
        taskEditingState.delete(taskId);
        
        socket.to(`project:${projectId}`).emit("task:editing:stopped", {
          taskId,
          userId: user.id,
        });
      }
    });

    // Task updated - broadcast to others
    socket.on("task:updated", (data: { projectId: number; task: any }) => {
      const { projectId, task } = data;
      
      // Clear editing state
      taskEditingState.delete(task.id);
      
      // Broadcast to others in project
      socket.to(`project:${projectId}`).emit("task:changed", {
        type: "updated",
        task,
        updatedBy: user.name,
      });
    });

    // Task created - broadcast to others
    socket.on("task:created", (data: { projectId: number; task: any; sectionId: number }) => {
      const { projectId, task, sectionId } = data;
      
      socket.to(`project:${projectId}`).emit("task:changed", {
        type: "created",
        task,
        sectionId,
        createdBy: user.name,
      });
    });

    // Task deleted - broadcast to others
    socket.on("task:deleted", (data: { projectId: number; taskId: number; sectionId: number }) => {
      const { projectId, taskId, sectionId } = data;
      
      // Clear editing state
      taskEditingState.delete(taskId);
      
      socket.to(`project:${projectId}`).emit("task:changed", {
        type: "deleted",
        taskId,
        sectionId,
        deletedBy: user.name,
      });
    });

    // Section updated
    socket.on("section:updated", (data: { projectId: number; section: any }) => {
      const { projectId, section } = data;
      
      socket.to(`project:${projectId}`).emit("section:changed", {
        type: "updated",
        section,
        updatedBy: user.name,
      });
    });

    // Block updated
    socket.on("block:updated", (data: { projectId: number; block: any }) => {
      const { projectId, block } = data;
      
      socket.to(`project:${projectId}`).emit("block:changed", {
        type: "updated",
        block,
        updatedBy: user.name,
      });
    });

    // Comment typing started
    socket.on("comment:typing:start", (data: { projectId: number; taskId: number }) => {
      const { projectId, taskId } = data;
      
      // Initialize typing state for this task if needed
      if (!typingState.has(taskId)) {
        typingState.set(taskId, new Map());
      }
      
      const taskTyping = typingState.get(taskId)!;
      taskTyping.set(user.id, {
        taskId,
        userId: user.id,
        userName: user.name,
        startedAt: new Date(),
      });

      // Broadcast to others in project
      socket.to(`project:${projectId}`).emit("comment:typing:started", {
        taskId,
        userId: user.id,
        userName: user.name,
      });
    });

    // Comment typing stopped
    socket.on("comment:typing:stop", (data: { projectId: number; taskId: number }) => {
      const { projectId, taskId } = data;
      
      const taskTyping = typingState.get(taskId);
      if (taskTyping) {
        taskTyping.delete(user.id);
        if (taskTyping.size === 0) {
          typingState.delete(taskId);
        }
      }

      // Broadcast to others in project
      socket.to(`project:${projectId}`).emit("comment:typing:stopped", {
        taskId,
        userId: user.id,
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${user.name}`);
      
      // Remove from all project presence
      projectPresence.forEach((presence, projectId) => {
        if (presence.has(socket.id)) {
          presence.delete(socket.id);
          
          const usersInProject = Array.from(presence.values());
          const uniqueUsers = Array.from(
            new Map(usersInProject.map(u => [u.id, u])).values()
          );
          
          io.to(`project:${projectId}`).emit("presence:update", {
            projectId,
            users: uniqueUsers,
          });
        }
      });

      // Clear any editing states for this user
      taskEditingState.forEach((state, taskId) => {
        if (state.userId === user.id) {
          taskEditingState.delete(taskId);
          // We can't easily broadcast this without knowing the project
          // The client will handle stale editing states
        }
      });

      socketToUser.delete(socket.id);
    });
  });

  setIO(io);
  console.log("[Socket] Real-time server initialized");
  return io;
}

// Global io reference for emitting events from outside socket handlers
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

export function setIO(io: Server) {
  ioInstance = io;
}

// Emit event to a specific user by userId (across all their connected sockets)
export function emitToUser(userId: number, event: string, data: any) {
  const io = getIO();
  if (!io) return;
  
  socketToUser.forEach((user, socketId) => {
    if (user.userId === userId) {
      io.to(socketId).emit(event, data);
    }
  });
}

// Export for use in other parts of the app
export { projectPresence, taskEditingState, socketToUser };
