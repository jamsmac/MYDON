/**
 * Type utilities to reduce 'any' casts across the codebase
 *
 * Provides:
 * - Type guards for enums
 * - Type-safe assertion helpers
 * - Utility types for common patterns
 */

import {
  TASK_STATUS,
  TASK_PRIORITY,
  PROJECT_ROLE,
  USER_ROLE,
  NOTIFICATION_TYPE,
  ACTIVITY_TYPE,
  AI_PROVIDER,
  CHAT_CONTEXT_TYPE,
  EXPORT_FORMAT,
  type TaskStatus,
  type TaskPriority,
  type ProjectRole,
  type UserRole,
  type NotificationType,
  type ActivityType,
  type AIProvider,
  type ChatContextType,
  type ExportFormat,
} from "../const";

// ============ TYPE GUARDS ============

/**
 * Check if a string is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && Object.values(TASK_STATUS).includes(value as TaskStatus);
}

/**
 * Check if a string is a valid TaskPriority
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && Object.values(TASK_PRIORITY).includes(value as TaskPriority);
}

/**
 * Check if a string is a valid ProjectRole
 */
export function isProjectRole(value: unknown): value is ProjectRole {
  return typeof value === "string" && Object.values(PROJECT_ROLE).includes(value as ProjectRole);
}

/**
 * Check if a string is a valid UserRole
 */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && Object.values(USER_ROLE).includes(value as UserRole);
}

/**
 * Check if a string is a valid NotificationType
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && Object.values(NOTIFICATION_TYPE).includes(value as NotificationType);
}

/**
 * Check if a string is a valid ActivityType
 */
export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && Object.values(ACTIVITY_TYPE).includes(value as ActivityType);
}

/**
 * Check if a string is a valid AIProvider
 */
export function isAIProvider(value: unknown): value is AIProvider {
  return typeof value === "string" && Object.values(AI_PROVIDER).includes(value as AIProvider);
}

/**
 * Check if a string is a valid ChatContextType
 */
export function isChatContextType(value: unknown): value is ChatContextType {
  return typeof value === "string" && Object.values(CHAT_CONTEXT_TYPE).includes(value as ChatContextType);
}

/**
 * Check if a string is a valid ExportFormat
 */
export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && Object.values(EXPORT_FORMAT).includes(value as ExportFormat);
}

// ============ SAFE CAST HELPERS ============

/**
 * Cast to TaskStatus with fallback
 */
export function asTaskStatus(value: unknown, fallback: TaskStatus = TASK_STATUS.NOT_STARTED): TaskStatus {
  return isTaskStatus(value) ? value : fallback;
}

/**
 * Cast to TaskPriority with fallback
 */
export function asTaskPriority(value: unknown, fallback: TaskPriority = TASK_PRIORITY.MEDIUM): TaskPriority {
  return isTaskPriority(value) ? value : fallback;
}

/**
 * Cast to ProjectRole with fallback
 */
export function asProjectRole(value: unknown, fallback: ProjectRole = PROJECT_ROLE.VIEWER): ProjectRole {
  return isProjectRole(value) ? value : fallback;
}

/**
 * Cast to UserRole with fallback
 */
export function asUserRole(value: unknown, fallback: UserRole = USER_ROLE.USER): UserRole {
  return isUserRole(value) ? value : fallback;
}

/**
 * Cast to AIProvider with fallback
 */
export function asAIProvider(value: unknown, fallback: AIProvider = AI_PROVIDER.OPENAI): AIProvider {
  return isAIProvider(value) ? value : fallback;
}

/**
 * Cast to ChatContextType with fallback
 */
export function asChatContextType(value: unknown, fallback: ChatContextType = CHAT_CONTEXT_TYPE.PROJECT): ChatContextType {
  return isChatContextType(value) ? value : fallback;
}

/**
 * Cast to ExportFormat with fallback
 */
export function asExportFormat(value: unknown, fallback: ExportFormat = EXPORT_FORMAT.MARKDOWN): ExportFormat {
  return isExportFormat(value) ? value : fallback;
}

// ============ UTILITY TYPES ============

/**
 * Make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Make all properties mutable (remove readonly)
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Deep partial - makes all nested properties optional
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Extract non-nullable keys from an object type
 */
export type NonNullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? never : undefined extends T[K] ? never : K;
}[keyof T];

/**
 * Pick only non-nullable properties
 */
export type NonNullablePick<T> = Pick<T, NonNullableKeys<T>>;

/**
 * Make nullable properties optional and remove null
 */
export type NullableToOptional<T> = {
  [K in keyof T as null extends T[K] ? K : never]?: Exclude<T[K], null>;
} & {
  [K in keyof T as null extends T[K] ? never : K]: T[K];
};

/**
 * Strict extract - ensures T extends U
 */
export type StrictExtract<T, U extends T> = U;

/**
 * Type for objects with string keys and values of type V
 */
export type StringRecord<V = unknown> = Record<string, V>;

/**
 * Type for form data objects
 */
export type FormData<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

// ============ ENTITY SELECTION TYPES ============

/**
 * Minimal task selection for UI state
 */
export interface TaskSelection {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  sectionId: number;
}

/**
 * Create a task selection from a task-like object
 */
export function createTaskSelection(task: {
  id: number;
  title: string;
  status: string;
  priority: string;
  sectionId: number;
}): TaskSelection {
  return {
    id: task.id,
    title: task.title,
    status: asTaskStatus(task.status),
    priority: asTaskPriority(task.priority),
    sectionId: task.sectionId,
  };
}

/**
 * Entity reference for discussions and other UI state
 */
export interface EntityReference {
  type: ChatContextType;
  id: number;
  title: string;
}

/**
 * Create an entity reference from a context object
 */
export function createEntityReference(
  type: string,
  id: number,
  title: string
): EntityReference {
  return {
    type: asChatContextType(type),
    id,
    title,
  };
}

// ============ ASSERTION HELPERS ============

/**
 * Assert that a value is not null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = "Value is null or undefined"
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Assert and return a non-null value (for inline use)
 */
export function ensureDefined<T>(
  value: T | null | undefined,
  message = "Value is null or undefined"
): T {
  assertDefined(value, message);
  return value;
}

/**
 * Narrow type with a type guard and return the value
 */
export function narrow<T, U extends T>(
  value: T,
  guard: (v: T) => v is U,
  message = "Type narrowing failed"
): U {
  if (!guard(value)) {
    throw new Error(message);
  }
  return value;
}

// ============ SAFE ACCESS HELPERS ============

/**
 * Safely get a property from an unknown object
 */
export function safeGet<T>(
  obj: unknown,
  key: string,
  defaultValue: T
): T {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return defaultValue;
}

/**
 * Safely parse JSON with type checking
 */
export function safeJsonParse<T>(
  json: string,
  validator: (value: unknown) => value is T,
  defaultValue: T
): T {
  try {
    const parsed = JSON.parse(json);
    return validator(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return obj !== null && typeof obj === "object" && key in obj;
}
