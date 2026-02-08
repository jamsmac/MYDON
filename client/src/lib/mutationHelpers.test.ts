/**
 * Tests for mutation helper utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMutationHandlers, mutationHandlers, taskMutations, withCallbacks } from "./mutationHelpers";
import { toast } from "sonner";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("mutationHelpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMutationHandlers", () => {
    it("should show success toast on success", () => {
      const handlers = createMutationHandlers({
        successMessage: "Operation successful",
      });

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Operation successful");
    });

    it("should not show success toast when showSuccessToast is false", () => {
      const handlers = createMutationHandlers({
        successMessage: "Operation successful",
        showSuccessToast: false,
      });

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).not.toHaveBeenCalled();
    });

    it("should show error toast on error", () => {
      const handlers = createMutationHandlers({});
      const error = new Error("Something went wrong");

      handlers.onError?.(error, "variables", undefined);

      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });

    it("should use custom error message when provided", () => {
      const handlers = createMutationHandlers({
        errorMessage: "Custom error message",
      });
      const error = new Error("Original error");

      handlers.onError?.(error, "variables", undefined);

      expect(toast.error).toHaveBeenCalledWith("Custom error message");
    });

    it("should not show error toast when showErrorToast is false", () => {
      const handlers = createMutationHandlers({
        showErrorToast: false,
      });
      const error = new Error("Error");

      handlers.onError?.(error, "variables", undefined);

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should call onSuccessCallback", () => {
      const callback = vi.fn();
      const handlers = createMutationHandlers({
        onSuccessCallback: callback,
      });

      handlers.onSuccess?.("data", "variables", undefined);

      expect(callback).toHaveBeenCalledWith("data", "variables");
    });

    it("should call onErrorCallback", () => {
      const callback = vi.fn();
      const handlers = createMutationHandlers({
        onErrorCallback: callback,
        showErrorToast: false,
      });
      const error = new Error("Error");

      handlers.onError?.(error, "variables", undefined);

      expect(callback).toHaveBeenCalledWith(error, "variables");
    });

    it("should call onSettledCallback", () => {
      const callback = vi.fn();
      const handlers = createMutationHandlers({
        onSettledCallback: callback,
      });

      handlers.onSettled?.("data", null, "variables", undefined);

      expect(callback).toHaveBeenCalledWith("data", null, "variables");
    });

    it("should support dynamic success message function", () => {
      const handlers = createMutationHandlers({
        successMessage: (data: { name: string }) => `Created ${data.name}`,
      });

      handlers.onSuccess?.({ name: "Task 1" }, "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Created Task 1");
    });

    it("should support dynamic error message function", () => {
      const handlers = createMutationHandlers({
        errorMessage: (error: Error) => `Failed: ${error.message}`,
      });
      const error = new Error("Network error");

      handlers.onError?.(error, "variables", undefined);

      expect(toast.error).toHaveBeenCalledWith("Failed: Network error");
    });
  });

  describe("mutationHandlers presets", () => {
    it("should provide create handler", () => {
      const handlers = mutationHandlers.create("Задача");

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Задача создан");
    });

    it("should provide update handler", () => {
      const handlers = mutationHandlers.update("Проект");

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Проект обновлен");
    });

    it("should provide delete handler", () => {
      const handlers = mutationHandlers.delete("Блок");

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Блок удален");
    });

    it("should provide move handler", () => {
      const handlers = mutationHandlers.move("Раздел");

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Раздел перемещен");
    });

    it("should provide silent handler (no success toast)", () => {
      const handlers = mutationHandlers.silent();

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("entity-specific mutations", () => {
    it("should provide task create mutation", () => {
      const callback = vi.fn();
      const handlers = taskMutations.create(callback);

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Задача создан");
      expect(callback).toHaveBeenCalled();
    });

    it("should provide task complete mutation", () => {
      const handlers = taskMutations.complete();

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Задача завершена");
    });
  });

  describe("withCallbacks", () => {
    it("should combine base handlers with additional callbacks", () => {
      const additionalSuccess = vi.fn();
      const handlers = withCallbacks({
        successMessage: "Success",
        additionalOnSuccess: additionalSuccess,
      });

      handlers.onSuccess?.("data", "variables", undefined);

      expect(toast.success).toHaveBeenCalledWith("Success");
      expect(additionalSuccess).toHaveBeenCalledWith("data", "variables");
    });

    it("should call additional error callback", () => {
      const additionalError = vi.fn();
      const handlers = withCallbacks({
        additionalOnError: additionalError,
      });
      const error = new Error("Error");

      handlers.onError?.(error, "variables", undefined);

      expect(toast.error).toHaveBeenCalled();
      expect(additionalError).toHaveBeenCalledWith(error, "variables");
    });
  });
});
