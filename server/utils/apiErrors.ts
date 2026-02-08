/**
 * Standardized API error utilities for tRPC
 *
 * Provides:
 * - Consistent error format with bilingual messages
 * - Pre-built error factories for common scenarios
 * - Type-safe error creation
 */

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

// Standardized error response format
export interface ApiErrorResponse {
  code: TRPC_ERROR_CODE_KEY;
  message: string;      // English message
  messageRu: string;    // Russian message
  details?: Record<string, unknown>;
}

// Error creation options
export interface ErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * Create a TRPCError with standardized format
 */
export function createApiError(
  response: ApiErrorResponse,
  options?: ErrorOptions
): TRPCError {
  return new TRPCError({
    code: response.code,
    message: response.messageRu, // Use Russian as primary message
    cause: options?.cause,
  });
}

// ============ NOT FOUND ERRORS ============

export const notFoundErrors = {
  project: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Project${id ? ` #${id}` : ""} not found`,
      messageRu: `Проект${id ? ` #${id}` : ""} не найден`,
    }),

  block: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Block${id ? ` #${id}` : ""} not found`,
      messageRu: `Блок${id ? ` #${id}` : ""} не найден`,
    }),

  section: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Section${id ? ` #${id}` : ""} not found`,
      messageRu: `Раздел${id ? ` #${id}` : ""} не найден`,
    }),

  task: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Task${id ? ` #${id}` : ""} not found`,
      messageRu: `Задача${id ? ` #${id}` : ""} не найдена`,
    }),

  subtask: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Subtask${id ? ` #${id}` : ""} not found`,
      messageRu: `Подзадача${id ? ` #${id}` : ""} не найдена`,
    }),

  user: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `User${id ? ` #${id}` : ""} not found`,
      messageRu: `Пользователь${id ? ` #${id}` : ""} не найден`,
    }),

  template: (id?: number): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `Template${id ? ` #${id}` : ""} not found`,
      messageRu: `Шаблон${id ? ` #${id}` : ""} не найден`,
    }),

  resource: (resourceType: string, id?: number | string): TRPCError =>
    createApiError({
      code: "NOT_FOUND",
      message: `${resourceType}${id ? ` #${id}` : ""} not found`,
      messageRu: `Ресурс${id ? ` #${id}` : ""} не найден`,
    }),
};

// ============ FORBIDDEN ERRORS ============

export const forbiddenErrors = {
  noAccess: (): TRPCError =>
    createApiError({
      code: "FORBIDDEN",
      message: "You do not have access to this resource",
      messageRu: "У вас нет доступа к этому ресурсу",
    }),

  insufficientRole: (requiredRole: string): TRPCError =>
    createApiError({
      code: "FORBIDDEN",
      message: `This action requires ${requiredRole} role`,
      messageRu: `Для этого действия требуется роль ${requiredRole}`,
    }),

  notOwner: (): TRPCError =>
    createApiError({
      code: "FORBIDDEN",
      message: "Only the owner can perform this action",
      messageRu: "Только владелец может выполнить это действие",
    }),

  notAdmin: (): TRPCError =>
    createApiError({
      code: "FORBIDDEN",
      message: "Admin access required",
      messageRu: "Требуется доступ администратора",
    }),

  limitReached: (limitType: string): TRPCError =>
    createApiError({
      code: "FORBIDDEN",
      message: `${limitType} limit reached`,
      messageRu: `Достигнут лимит: ${limitType}`,
    }),
};

// ============ UNAUTHORIZED ERRORS ============

export const unauthorizedErrors = {
  notAuthenticated: (): TRPCError =>
    createApiError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      messageRu: "Требуется авторизация",
    }),

  invalidToken: (): TRPCError =>
    createApiError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired token",
      messageRu: "Недействительный или просроченный токен",
    }),

  sessionExpired: (): TRPCError =>
    createApiError({
      code: "UNAUTHORIZED",
      message: "Session expired, please login again",
      messageRu: "Сессия истекла, пожалуйста, войдите снова",
    }),
};

// ============ VALIDATION ERRORS ============

export const validationErrors = {
  invalidInput: (field?: string): TRPCError =>
    createApiError({
      code: "BAD_REQUEST",
      message: field ? `Invalid input: ${field}` : "Invalid input",
      messageRu: field ? `Некорректные данные: ${field}` : "Некорректные данные",
    }),

  required: (field: string): TRPCError =>
    createApiError({
      code: "BAD_REQUEST",
      message: `${field} is required`,
      messageRu: `Поле ${field} обязательно`,
    }),

  tooLong: (field: string, maxLength: number): TRPCError =>
    createApiError({
      code: "BAD_REQUEST",
      message: `${field} must be at most ${maxLength} characters`,
      messageRu: `${field} должно содержать не более ${maxLength} символов`,
    }),

  tooShort: (field: string, minLength: number): TRPCError =>
    createApiError({
      code: "BAD_REQUEST",
      message: `${field} must be at least ${minLength} characters`,
      messageRu: `${field} должно содержать не менее ${minLength} символов`,
    }),

  invalidFormat: (field: string, expectedFormat: string): TRPCError =>
    createApiError({
      code: "BAD_REQUEST",
      message: `${field} has invalid format. Expected: ${expectedFormat}`,
      messageRu: `${field} имеет неверный формат. Ожидается: ${expectedFormat}`,
    }),
};

// ============ CONFLICT ERRORS ============

export const conflictErrors = {
  alreadyExists: (resourceType: string): TRPCError =>
    createApiError({
      code: "CONFLICT",
      message: `${resourceType} already exists`,
      messageRu: `${resourceType} уже существует`,
    }),

  duplicate: (field: string): TRPCError =>
    createApiError({
      code: "CONFLICT",
      message: `Duplicate value for ${field}`,
      messageRu: `Дублирующееся значение для ${field}`,
    }),

  alreadyMember: (): TRPCError =>
    createApiError({
      code: "CONFLICT",
      message: "User is already a member",
      messageRu: "Пользователь уже является участником",
    }),

  cannotDeleteWithChildren: (parentType: string, childType: string): TRPCError =>
    createApiError({
      code: "CONFLICT",
      message: `Cannot delete ${parentType} with existing ${childType}`,
      messageRu: `Невозможно удалить ${parentType} с существующими ${childType}`,
    }),
};

// ============ RATE LIMIT ERRORS ============

export const rateLimitErrors = {
  tooManyRequests: (): TRPCError =>
    createApiError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests, please try again later",
      messageRu: "Слишком много запросов, попробуйте позже",
    }),

  aiLimitReached: (): TRPCError =>
    createApiError({
      code: "TOO_MANY_REQUESTS",
      message: "AI request limit reached",
      messageRu: "Достигнут лимит AI запросов",
    }),
};

// ============ INTERNAL ERRORS ============

export const internalErrors = {
  database: (): TRPCError =>
    createApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database error occurred",
      messageRu: "Произошла ошибка базы данных",
    }),

  externalService: (serviceName: string): TRPCError =>
    createApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${serviceName} service is unavailable`,
      messageRu: `Сервис ${serviceName} недоступен`,
    }),

  unexpected: (): TRPCError =>
    createApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      messageRu: "Произошла непредвиденная ошибка",
    }),
};

// ============ HELPER FUNCTIONS ============

/**
 * Check if error is a TRPCError
 */
export function isTRPCError(error: unknown): error is TRPCError {
  return error instanceof TRPCError;
}

/**
 * Convert any error to TRPCError
 */
export function toTRPCError(error: unknown): TRPCError {
  if (isTRPCError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message,
    cause: error,
  });
}

/**
 * Create error from database error code
 */
export function fromDatabaseError(error: unknown): TRPCError {
  const code = (error as any)?.code;

  switch (code) {
    case "ER_DUP_ENTRY":
      return conflictErrors.alreadyExists("Resource");
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return notFoundErrors.resource("Referenced resource");
    case "ER_ROW_IS_REFERENCED":
    case "ER_ROW_IS_REFERENCED_2":
      return conflictErrors.cannotDeleteWithChildren("resource", "references");
    default:
      return internalErrors.database();
  }
}
