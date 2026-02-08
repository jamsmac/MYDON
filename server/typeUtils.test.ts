/**
 * Tests for shared type utilities
 */

import { describe, it, expect } from "vitest";
import {
  isTaskStatus,
  isTaskPriority,
  isProjectRole,
  isUserRole,
  isAIProvider,
  isChatContextType,
  asTaskStatus,
  asTaskPriority,
  asProjectRole,
  asAIProvider,
  asChatContextType,
  createTaskSelection,
  createEntityReference,
  assertDefined,
  ensureDefined,
  narrow,
  safeGet,
  safeJsonParse,
  hasProperty,
} from "@shared/lib/typeUtils";
import {
  TASK_STATUS,
  TASK_PRIORITY,
  PROJECT_ROLE,
  USER_ROLE,
  AI_PROVIDER,
  CHAT_CONTEXT_TYPE,
} from "@shared/const";

describe("typeUtils", () => {
  describe("type guards", () => {
    describe("isTaskStatus", () => {
      it("should return true for valid task statuses", () => {
        expect(isTaskStatus("not_started")).toBe(true);
        expect(isTaskStatus("in_progress")).toBe(true);
        expect(isTaskStatus("completed")).toBe(true);
      });

      it("should return false for invalid values", () => {
        expect(isTaskStatus("invalid")).toBe(false);
        expect(isTaskStatus(null)).toBe(false);
        expect(isTaskStatus(undefined)).toBe(false);
        expect(isTaskStatus(123)).toBe(false);
      });
    });

    describe("isTaskPriority", () => {
      it("should return true for valid priorities", () => {
        expect(isTaskPriority("critical")).toBe(true);
        expect(isTaskPriority("high")).toBe(true);
        expect(isTaskPriority("medium")).toBe(true);
        expect(isTaskPriority("low")).toBe(true);
      });

      it("should return false for invalid values", () => {
        expect(isTaskPriority("urgent")).toBe(false);
        expect(isTaskPriority(null)).toBe(false);
      });
    });

    describe("isProjectRole", () => {
      it("should return true for valid roles", () => {
        expect(isProjectRole("owner")).toBe(true);
        expect(isProjectRole("admin")).toBe(true);
        expect(isProjectRole("editor")).toBe(true);
        expect(isProjectRole("viewer")).toBe(true);
      });

      it("should return false for invalid roles", () => {
        expect(isProjectRole("superadmin")).toBe(false);
      });
    });

    describe("isUserRole", () => {
      it("should return true for valid user roles", () => {
        expect(isUserRole("admin")).toBe(true);
        expect(isUserRole("user")).toBe(true);
      });

      it("should return false for invalid roles", () => {
        expect(isUserRole("moderator")).toBe(false);
      });
    });

    describe("isAIProvider", () => {
      it("should return true for valid providers", () => {
        expect(isAIProvider("openai")).toBe(true);
        expect(isAIProvider("anthropic")).toBe(true);
        expect(isAIProvider("google")).toBe(true);
      });

      it("should return false for invalid providers", () => {
        expect(isAIProvider("gpt4")).toBe(false);
      });
    });

    describe("isChatContextType", () => {
      it("should return true for valid context types", () => {
        expect(isChatContextType("project")).toBe(true);
        expect(isChatContextType("block")).toBe(true);
        expect(isChatContextType("section")).toBe(true);
        expect(isChatContextType("task")).toBe(true);
      });

      it("should return false for invalid context types", () => {
        expect(isChatContextType("subtask")).toBe(false);
      });
    });
  });

  describe("safe cast helpers", () => {
    describe("asTaskStatus", () => {
      it("should return the value if valid", () => {
        expect(asTaskStatus("completed")).toBe("completed");
      });

      it("should return fallback for invalid values", () => {
        expect(asTaskStatus("invalid")).toBe(TASK_STATUS.NOT_STARTED);
        expect(asTaskStatus("invalid", TASK_STATUS.IN_PROGRESS)).toBe(TASK_STATUS.IN_PROGRESS);
      });
    });

    describe("asTaskPriority", () => {
      it("should return the value if valid", () => {
        expect(asTaskPriority("high")).toBe("high");
      });

      it("should return fallback for invalid values", () => {
        expect(asTaskPriority(null)).toBe(TASK_PRIORITY.MEDIUM);
        expect(asTaskPriority(null, TASK_PRIORITY.LOW)).toBe(TASK_PRIORITY.LOW);
      });
    });

    describe("asProjectRole", () => {
      it("should return the value if valid", () => {
        expect(asProjectRole("admin")).toBe("admin");
      });

      it("should return fallback for invalid values", () => {
        expect(asProjectRole("superuser")).toBe(PROJECT_ROLE.VIEWER);
      });
    });

    describe("asAIProvider", () => {
      it("should return the value if valid", () => {
        expect(asAIProvider("anthropic")).toBe("anthropic");
      });

      it("should return fallback for invalid values", () => {
        expect(asAIProvider("llama")).toBe(AI_PROVIDER.OPENAI);
      });
    });

    describe("asChatContextType", () => {
      it("should return the value if valid", () => {
        expect(asChatContextType("task")).toBe("task");
      });

      it("should return fallback for invalid values", () => {
        expect(asChatContextType("comment")).toBe(CHAT_CONTEXT_TYPE.PROJECT);
      });
    });
  });

  describe("entity selection helpers", () => {
    describe("createTaskSelection", () => {
      it("should create a task selection with proper types", () => {
        const task = {
          id: 1,
          title: "Test Task",
          status: "in_progress",
          priority: "high",
          sectionId: 5,
        };

        const selection = createTaskSelection(task);

        expect(selection).toEqual({
          id: 1,
          title: "Test Task",
          status: "in_progress",
          priority: "high",
          sectionId: 5,
        });
      });

      it("should use fallbacks for invalid status/priority", () => {
        const task = {
          id: 1,
          title: "Test Task",
          status: "invalid",
          priority: "invalid",
          sectionId: 5,
        };

        const selection = createTaskSelection(task);

        expect(selection.status).toBe(TASK_STATUS.NOT_STARTED);
        expect(selection.priority).toBe(TASK_PRIORITY.MEDIUM);
      });
    });

    describe("createEntityReference", () => {
      it("should create an entity reference with proper types", () => {
        const ref = createEntityReference("task", 10, "My Task");

        expect(ref).toEqual({
          type: "task",
          id: 10,
          title: "My Task",
        });
      });

      it("should use fallback for invalid type", () => {
        const ref = createEntityReference("invalid", 10, "Title");

        expect(ref.type).toBe(CHAT_CONTEXT_TYPE.PROJECT);
      });
    });
  });

  describe("assertion helpers", () => {
    describe("assertDefined", () => {
      it("should not throw for defined values", () => {
        expect(() => assertDefined("value")).not.toThrow();
        expect(() => assertDefined(0)).not.toThrow();
        expect(() => assertDefined(false)).not.toThrow();
        expect(() => assertDefined("")).not.toThrow();
      });

      it("should throw for null", () => {
        expect(() => assertDefined(null)).toThrow("Value is null or undefined");
      });

      it("should throw for undefined", () => {
        expect(() => assertDefined(undefined)).toThrow("Value is null or undefined");
      });

      it("should throw with custom message", () => {
        expect(() => assertDefined(null, "Custom error")).toThrow("Custom error");
      });
    });

    describe("ensureDefined", () => {
      it("should return defined values", () => {
        expect(ensureDefined("value")).toBe("value");
        expect(ensureDefined(0)).toBe(0);
      });

      it("should throw for null/undefined", () => {
        expect(() => ensureDefined(null)).toThrow();
        expect(() => ensureDefined(undefined)).toThrow();
      });
    });

    describe("narrow", () => {
      it("should return value when guard passes", () => {
        const result = narrow("high", isTaskPriority);
        expect(result).toBe("high");
      });

      it("should throw when guard fails", () => {
        expect(() => narrow("invalid", isTaskPriority)).toThrow("Type narrowing failed");
      });

      it("should throw with custom message", () => {
        expect(() => narrow("invalid", isTaskPriority, "Not a priority")).toThrow("Not a priority");
      });
    });
  });

  describe("safe access helpers", () => {
    describe("safeGet", () => {
      it("should return property value if exists", () => {
        expect(safeGet({ name: "test" }, "name", "default")).toBe("test");
      });

      it("should return default if property missing", () => {
        expect(safeGet({ name: "test" }, "age", 0)).toBe(0);
      });

      it("should return default for null/undefined objects", () => {
        expect(safeGet(null, "key", "default")).toBe("default");
        expect(safeGet(undefined, "key", "default")).toBe("default");
      });
    });

    describe("safeJsonParse", () => {
      it("should parse valid JSON and validate", () => {
        const validator = (v: unknown): v is { name: string } =>
          typeof v === "object" && v !== null && "name" in v;

        const result = safeJsonParse('{"name": "test"}', validator, { name: "" });
        expect(result).toEqual({ name: "test" });
      });

      it("should return default for invalid JSON", () => {
        const validator = (v: unknown): v is string => typeof v === "string";
        const result = safeJsonParse("invalid json", validator, "default");
        expect(result).toBe("default");
      });

      it("should return default when validation fails", () => {
        const validator = (v: unknown): v is number => typeof v === "number";
        const result = safeJsonParse('"string"', validator, 0);
        expect(result).toBe(0);
      });
    });

    describe("hasProperty", () => {
      it("should return true if property exists", () => {
        expect(hasProperty({ name: "test" }, "name")).toBe(true);
      });

      it("should return false if property missing", () => {
        expect(hasProperty({ name: "test" }, "age")).toBe(false);
      });

      it("should return false for non-objects", () => {
        expect(hasProperty(null, "key")).toBe(false);
        expect(hasProperty("string", "length")).toBe(false);
      });
    });
  });
});
