/**
 * Structured error handling utilities
 *
 * Provides:
 * - Severity levels for errors
 * - Contextual error logging
 * - Error categorization
 * - Consistent error format
 */

// Severity levels for errors
export enum ErrorSeverity {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  CRITICAL = "critical",
}

// Error categories
export enum ErrorCategory {
  DATABASE = "database",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  VALIDATION = "validation",
  EXTERNAL_SERVICE = "external_service",
  BUSINESS_LOGIC = "business_logic",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

// Error context interface
export interface ErrorContext {
  operation: string;
  userId?: number;
  entityType?: string;
  entityId?: number | string;
  additionalData?: Record<string, unknown>;
}

// Structured error log entry
export interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: ErrorContext;
}

/**
 * Format error for logging
 */
function formatError(error: unknown): ErrorLogEntry["error"] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      code: (error as any).code,
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return { name: "Unknown", message: String(error) };
}

/**
 * Create a structured error log entry
 */
function createLogEntry(
  severity: ErrorSeverity,
  category: ErrorCategory,
  message: string,
  context: ErrorContext,
  error?: unknown
): ErrorLogEntry {
  return {
    timestamp: new Date().toISOString(),
    severity,
    category,
    message,
    error: formatError(error),
    context,
  };
}

/**
 * Log error with full context
 */
function logError(entry: ErrorLogEntry): void {
  const logPrefix = `[${entry.category.toUpperCase()}]`;
  const contextStr = entry.context.operation;

  const logMessage = `${logPrefix} ${contextStr}: ${entry.message}`;

  switch (entry.severity) {
    case ErrorSeverity.DEBUG:
      console.debug(logMessage, entry);
      break;
    case ErrorSeverity.INFO:
      console.info(logMessage, entry);
      break;
    case ErrorSeverity.WARN:
      console.warn(logMessage, entry);
      break;
    case ErrorSeverity.ERROR:
    case ErrorSeverity.CRITICAL:
      console.error(logMessage, entry);
      break;
  }
}

/**
 * Main error handler function
 * Use this instead of empty catch blocks
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    rethrow?: boolean;
    customMessage?: string;
  } = {}
): void {
  const {
    severity = ErrorSeverity.ERROR,
    category = categorizeError(error),
    rethrow = false,
    customMessage,
  } = options;

  const message = customMessage || getErrorMessage(error);
  const entry = createLogEntry(severity, category, message, context, error);

  logError(entry);

  if (rethrow) {
    throw error;
  }
}

/**
 * Create a safe wrapper for async operations
 * Logs errors but returns undefined instead of throwing
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, { severity: ErrorSeverity.WARN });
    return defaultValue;
  }
}

/**
 * Create a safe wrapper for sync operations
 */
export function safeSync<T>(
  operation: () => T,
  context: ErrorContext,
  defaultValue?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    handleError(error, context, { severity: ErrorSeverity.WARN });
    return defaultValue;
  }
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Categorize error based on its type and message
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (!error) return ErrorCategory.UNKNOWN;

  const errorStr = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorCode = (error as any)?.code;

  // Database errors
  if (
    errorCode?.startsWith("ER_") ||
    errorStr.includes("database") ||
    errorStr.includes("connection") ||
    errorStr.includes("mysql") ||
    errorStr.includes("sql")
  ) {
    return ErrorCategory.DATABASE;
  }

  // Authentication errors
  if (
    errorStr.includes("unauthorized") ||
    errorStr.includes("unauthenticated") ||
    errorStr.includes("token") ||
    errorStr.includes("session")
  ) {
    return ErrorCategory.AUTHENTICATION;
  }

  // Authorization errors
  if (
    errorStr.includes("forbidden") ||
    errorStr.includes("permission") ||
    errorStr.includes("access denied")
  ) {
    return ErrorCategory.AUTHORIZATION;
  }

  // Validation errors
  if (
    errorStr.includes("validation") ||
    errorStr.includes("invalid") ||
    errorStr.includes("required")
  ) {
    return ErrorCategory.VALIDATION;
  }

  // Network/external service errors
  if (
    errorStr.includes("timeout") ||
    errorStr.includes("network") ||
    errorStr.includes("fetch") ||
    errorStr.includes("econnrefused") ||
    errorCode === "ECONNREFUSED" ||
    errorCode === "ETIMEDOUT"
  ) {
    return ErrorCategory.EXTERNAL_SERVICE;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Create a context builder for a specific module
 */
export function createErrorContextBuilder(module: string) {
  return (
    operation: string,
    options?: Partial<Omit<ErrorContext, "operation">>
  ): ErrorContext => ({
    operation: `${module}.${operation}`,
    ...options,
  });
}

/**
 * Pre-built context builders for common modules
 */
export const dbContext = createErrorContextBuilder("Database");
export const authContext = createErrorContextBuilder("Auth");
export const aiContext = createErrorContextBuilder("AI");
export const exportContext = createErrorContextBuilder("Export");
export const importContext = createErrorContextBuilder("Import");
export const webhookContext = createErrorContextBuilder("Webhook");
export const stripeContext = createErrorContextBuilder("Stripe");

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return (error as any)?.code === code;
}

/**
 * Check if error is a known transient error that might resolve on retry
 */
export function isTransientError(error: unknown): boolean {
  const transientCodes = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ER_LOCK_DEADLOCK",
    "ER_LOCK_WAIT_TIMEOUT",
    "ER_TOO_MANY_CONNECTIONS",
  ];

  const code = (error as any)?.code;
  return transientCodes.includes(code);
}
