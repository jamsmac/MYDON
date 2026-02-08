/**
 * Mutation helper utilities for tRPC mutations
 *
 * Provides:
 * - Standardized success/error toast notifications
 * - Type-safe mutation option builders
 * - Common mutation patterns
 */

import { toast } from "sonner";
import type { UseMutationOptions } from "@tanstack/react-query";

// Error message extractor
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Произошла ошибка";
}

// Mutation handler options
export interface MutationHandlerOptions<TData = unknown, TVariables = unknown> {
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  errorMessage?: string | ((error: unknown, variables: TVariables) => string);
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  onSuccessCallback?: (data: TData, variables: TVariables) => void;
  onErrorCallback?: (error: unknown, variables: TVariables) => void;
  onSettledCallback?: (data: TData | undefined, error: unknown | null, variables: TVariables) => void;
}

/**
 * Create mutation handlers with toast notifications
 *
 * @example
 * const updateTask = trpc.task.update.useMutation(
 *   createMutationHandlers({
 *     successMessage: "Задача обновлена",
 *     onSuccessCallback: () => refetch(),
 *   })
 * );
 */
export function createMutationHandlers<TData = unknown, TVariables = unknown>(
  options: MutationHandlerOptions<TData, TVariables> = {}
): Pick<UseMutationOptions<TData, unknown, TVariables>, "onSuccess" | "onError" | "onSettled"> {
  const {
    successMessage,
    errorMessage,
    showSuccessToast = !!successMessage,
    showErrorToast = true,
    onSuccessCallback,
    onErrorCallback,
    onSettledCallback,
  } = options;

  return {
    onSuccess: (data, variables) => {
      if (showSuccessToast && successMessage) {
        const message =
          typeof successMessage === "function"
            ? successMessage(data, variables)
            : successMessage;
        toast.success(message);
      }
      onSuccessCallback?.(data, variables);
    },

    onError: (error, variables) => {
      if (showErrorToast) {
        const message =
          typeof errorMessage === "function"
            ? errorMessage(error, variables)
            : errorMessage || getErrorMessage(error);
        toast.error(message);
      }
      onErrorCallback?.(error, variables);
    },

    onSettled: (data, error, variables) => {
      onSettledCallback?.(data, error, variables);
    },
  };
}

/**
 * Pre-configured handlers for common operations
 */
export const mutationHandlers = {
  // Create operations
  create: <TData = unknown, TVariables = unknown>(
    entityName: string,
    options?: Omit<MutationHandlerOptions<TData, TVariables>, "successMessage">
  ) =>
    createMutationHandlers<TData, TVariables>({
      successMessage: `${entityName} создан`,
      ...options,
    }),

  // Update operations
  update: <TData = unknown, TVariables = unknown>(
    entityName: string,
    options?: Omit<MutationHandlerOptions<TData, TVariables>, "successMessage">
  ) =>
    createMutationHandlers<TData, TVariables>({
      successMessage: `${entityName} обновлен`,
      ...options,
    }),

  // Delete operations
  delete: <TData = unknown, TVariables = unknown>(
    entityName: string,
    options?: Omit<MutationHandlerOptions<TData, TVariables>, "successMessage">
  ) =>
    createMutationHandlers<TData, TVariables>({
      successMessage: `${entityName} удален`,
      ...options,
    }),

  // Move/reorder operations
  move: <TData = unknown, TVariables = unknown>(
    entityName: string,
    options?: Omit<MutationHandlerOptions<TData, TVariables>, "successMessage">
  ) =>
    createMutationHandlers<TData, TVariables>({
      successMessage: `${entityName} перемещен`,
      ...options,
    }),

  // Silent operation (no success toast, only error)
  silent: <TData = unknown, TVariables = unknown>(
    options?: Omit<MutationHandlerOptions<TData, TVariables>, "showSuccessToast">
  ) =>
    createMutationHandlers<TData, TVariables>({
      showSuccessToast: false,
      ...options,
    }),
};

/**
 * Entity-specific mutation handlers
 */
export const taskMutations = {
  create: (onSuccess?: () => void) =>
    mutationHandlers.create("Задача", { onSuccessCallback: onSuccess }),
  update: (onSuccess?: () => void) =>
    mutationHandlers.update("Задача", { onSuccessCallback: onSuccess }),
  delete: (onSuccess?: () => void) =>
    mutationHandlers.delete("Задача", { onSuccessCallback: onSuccess }),
  complete: (onSuccess?: () => void) =>
    createMutationHandlers({
      successMessage: "Задача завершена",
      onSuccessCallback: onSuccess,
    }),
};

export const projectMutations = {
  create: (onSuccess?: () => void) =>
    mutationHandlers.create("Проект", { onSuccessCallback: onSuccess }),
  update: (onSuccess?: () => void) =>
    mutationHandlers.update("Проект", { onSuccessCallback: onSuccess }),
  delete: (onSuccess?: () => void) =>
    mutationHandlers.delete("Проект", { onSuccessCallback: onSuccess }),
};

export const sectionMutations = {
  create: (onSuccess?: () => void) =>
    mutationHandlers.create("Раздел", { onSuccessCallback: onSuccess }),
  update: (onSuccess?: () => void) =>
    mutationHandlers.update("Раздел", { onSuccessCallback: onSuccess }),
  delete: (onSuccess?: () => void) =>
    mutationHandlers.delete("Раздел", { onSuccessCallback: onSuccess }),
};

export const blockMutations = {
  create: (onSuccess?: () => void) =>
    mutationHandlers.create("Блок", { onSuccessCallback: onSuccess }),
  update: (onSuccess?: () => void) =>
    mutationHandlers.update("Блок", { onSuccessCallback: onSuccess }),
  delete: (onSuccess?: () => void) =>
    mutationHandlers.delete("Блок", { onSuccessCallback: onSuccess }),
};

/**
 * Optimistic update helper
 * Use with useMutation's onMutate for optimistic UI updates
 */
export function createOptimisticUpdate<TData, TContext>(
  updateFn: (variables: TData) => TContext,
  rollbackFn: (context: TContext | undefined) => void
) {
  return {
    onMutate: async (variables: TData): Promise<TContext> => {
      return updateFn(variables);
    },
    onError: (_error: unknown, _variables: TData, context: TContext | undefined) => {
      rollbackFn(context);
    },
  };
}

/**
 * Merge mutation handlers with additional callbacks
 * Simpler alternative - creates new handlers that include both toast and custom callback
 */
export function withCallbacks<TData = unknown, TVariables = unknown>(
  options: MutationHandlerOptions<TData, TVariables> & {
    additionalOnSuccess?: (data: TData, variables: TVariables) => void;
    additionalOnError?: (error: unknown, variables: TVariables) => void;
  }
): Pick<UseMutationOptions<TData, unknown, TVariables>, "onSuccess" | "onError" | "onSettled"> {
  const baseHandlers = createMutationHandlers<TData, TVariables>(options);

  return {
    onSuccess: (data, variables) => {
      // Call base handler (shows toast)
      if (baseHandlers.onSuccess) {
        (baseHandlers.onSuccess as (data: TData, variables: TVariables) => void)(data, variables);
      }
      // Call additional callback
      options.additionalOnSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Call base handler (shows toast)
      if (baseHandlers.onError) {
        (baseHandlers.onError as (error: unknown, variables: TVariables) => void)(error, variables);
      }
      // Call additional callback
      options.additionalOnError?.(error, variables);
    },
    onSettled: baseHandlers.onSettled,
  };
}
