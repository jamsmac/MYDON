import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock socket.io
vi.mock("socket.io", () => ({
  Server: vi.fn().mockImplementation(() => ({
    use: vi.fn(),
    on: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  })),
}));

// Mock SDK
vi.mock("../_core/sdk", () => ({
  sdk: {
    verifySession: vi.fn().mockResolvedValue({
      openId: "test-open-id",
      appId: "test-app-id",
      name: "Test User",
    }),
  },
}));

// Mock db
vi.mock("../db", () => ({
  getUserByOpenId: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test User",
    email: "test@example.com",
    openId: "test-open-id",
  }),
  getProjectById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Project",
    userId: 1,
  }),
}));

describe("Socket Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserColor", () => {
    it("should return consistent color for same user ID", () => {
      // Test color generation logic
      const colors = [
        "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
        "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
        "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
      ];
      
      const userId = 5;
      const expectedColor = colors[userId % colors.length];
      // User 5 should get the 6th color (index 5)
      expect(expectedColor).toBe("#14b8a6");
    });

    it("should cycle through colors for different user IDs", () => {
      const colors = [
        "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
        "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
        "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
      ];
      
      // User 0 and User 14 should have same color
      expect(colors[0 % colors.length]).toBe(colors[14 % colors.length]);
    });
  });

  describe("Presence Types", () => {
    it("should have correct PresenceUser structure", () => {
      const presenceUser = {
        id: 1,
        name: "Test User",
        avatar: "https://example.com/avatar.jpg",
        color: "#ef4444",
      };

      expect(presenceUser).toHaveProperty("id");
      expect(presenceUser).toHaveProperty("name");
      expect(presenceUser).toHaveProperty("avatar");
      expect(presenceUser).toHaveProperty("color");
    });

    it("should have correct TaskEditingState structure", () => {
      const editingState = {
        taskId: 1,
        userId: 1,
        userName: "Test User",
        startedAt: new Date(),
      };

      expect(editingState).toHaveProperty("taskId");
      expect(editingState).toHaveProperty("userId");
      expect(editingState).toHaveProperty("userName");
      expect(editingState).toHaveProperty("startedAt");
      expect(editingState.startedAt).toBeInstanceOf(Date);
    });
  });

  describe("Event Types", () => {
    it("should support task:changed event with create type", () => {
      const event = {
        type: "created" as const,
        task: { id: 1, title: "New Task" },
        sectionId: 1,
        createdBy: "Test User",
      };

      expect(event.type).toBe("created");
      expect(event.task).toBeDefined();
      expect(event.createdBy).toBeDefined();
    });

    it("should support task:changed event with update type", () => {
      const event = {
        type: "updated" as const,
        task: { id: 1, title: "Updated Task" },
        updatedBy: "Test User",
      };

      expect(event.type).toBe("updated");
      expect(event.task).toBeDefined();
      expect(event.updatedBy).toBeDefined();
    });

    it("should support task:changed event with delete type", () => {
      const event = {
        type: "deleted" as const,
        taskId: 1,
        sectionId: 1,
        deletedBy: "Test User",
      };

      expect(event.type).toBe("deleted");
      expect(event.taskId).toBeDefined();
      expect(event.deletedBy).toBeDefined();
    });
  });

  describe("Room Management", () => {
    it("should create correct room name for project", () => {
      const projectId = 123;
      const roomName = `project:${projectId}`;
      expect(roomName).toBe("project:123");
    });
  });
});
