import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Create a comprehensive mock that handles all chained methods
const createMockDb = () => {
  const mockChain: any = {};
  const methods = ['select', 'from', 'where', 'leftJoin', 'groupBy', 'orderBy', 'limit', 'offset', 'insert', 'values', 'update', 'set', 'delete'];
  
  methods.forEach(method => {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  });
  
  // Terminal methods
  mockChain.limit = vi.fn().mockResolvedValue([]);
  mockChain.$returningId = vi.fn().mockResolvedValue([{ id: 1 }]);
  
  return mockChain;
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(createMockDb())),
}));

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Admin Credits Router", () => {
  describe("getLimitSettings", () => {
    it("should return limit settings object with default values", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.adminCredits.getLimitSettings();
      
      // With empty mock data, should return defaults
      expect(result).toHaveProperty("globalDailyLimit");
      expect(result).toHaveProperty("maxTokensPerRequest");
      expect(result).toHaveProperty("warningThreshold");
      expect(result).toHaveProperty("roleLimits");
      expect(typeof result.globalDailyLimit).toBe("number");
    });
  });
});
