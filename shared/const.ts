// ============ SESSION & AUTH ============
export const COOKIE_NAME = "app_session_id";
export const REFRESH_COOKIE_NAME = "app_refresh_token";

// Token lifetimes
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours for session token
export const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days for refresh token
export const DEV_SESSION_TTL_MS = ONE_YEAR_MS; // Dev mode uses longer session for convenience

export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// ============ TASK STATUS ============
export const TASK_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TASK_STATUS.NOT_STARTED]: 'Не начато',
  [TASK_STATUS.IN_PROGRESS]: 'В работе',
  [TASK_STATUS.COMPLETED]: 'Завершено',
};

// ============ TASK PRIORITY ============
export const TASK_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TASK_PRIORITY.CRITICAL]: 'Критический',
  [TASK_PRIORITY.HIGH]: 'Высокий',
  [TASK_PRIORITY.MEDIUM]: 'Средний',
  [TASK_PRIORITY.LOW]: 'Низкий',
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  TASK_PRIORITY.CRITICAL,
  TASK_PRIORITY.HIGH,
  TASK_PRIORITY.MEDIUM,
  TASK_PRIORITY.LOW,
];

// ============ USER ROLES ============
export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

// ============ PROJECT MEMBER ROLES ============
export const PROJECT_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type ProjectRole = typeof PROJECT_ROLE[keyof typeof PROJECT_ROLE];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  [PROJECT_ROLE.OWNER]: 'Владелец',
  [PROJECT_ROLE.ADMIN]: 'Администратор',
  [PROJECT_ROLE.EDITOR]: 'Редактор',
  [PROJECT_ROLE.VIEWER]: 'Наблюдатель',
};

// Role hierarchy (higher index = more permissions)
export const PROJECT_ROLE_HIERARCHY: ProjectRole[] = [
  PROJECT_ROLE.VIEWER,
  PROJECT_ROLE.EDITOR,
  PROJECT_ROLE.ADMIN,
  PROJECT_ROLE.OWNER,
];

// ============ SUBSCRIPTION TIERS ============
export const SUBSCRIPTION_TIER = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIER[keyof typeof SUBSCRIPTION_TIER];

// ============ LIMITS ============
export const LIMITS = {
  // Free tier limits
  FREE_PROJECTS: 3,
  FREE_AI_REQUESTS_PER_DAY: 10,
  FREE_TEAM_MEMBERS: 1,
  FREE_STORAGE_MB: 100,

  // Pro tier limits
  PRO_PROJECTS: 20,
  PRO_AI_REQUESTS_PER_DAY: 100,
  PRO_TEAM_MEMBERS: 5,
  PRO_STORAGE_MB: 1000,

  // General limits
  MAX_BLOCKS_PER_PROJECT: 50,
  MAX_SECTIONS_PER_BLOCK: 30,
  MAX_TASKS_PER_SECTION: 100,
  MAX_SUBTASKS_PER_TASK: 50,
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 10000,
  MAX_COMMENT_LENGTH: 5000,
  MAX_FILE_SIZE_MB: 10,
  MAX_IMPORT_FILE_SIZE_MB: 5,
} as const;

// ============ NOTIFICATION TYPES ============
export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_COMMENT: 'task_comment',
  TASK_MENTION: 'task_mention',
  PROJECT_INVITE: 'project_invite',
  DEADLINE_REMINDER: 'deadline_reminder',
  ACHIEVEMENT: 'achievement',
  SYSTEM: 'system',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

// ============ ACTIVITY LOG TYPES ============
export const ACTIVITY_TYPE = {
  // Project activities
  PROJECT_CREATED: 'project_created',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_DELETED: 'project_deleted',

  // Block activities
  BLOCK_CREATED: 'block_created',
  BLOCK_UPDATED: 'block_updated',
  BLOCK_DELETED: 'block_deleted',

  // Section activities
  SECTION_CREATED: 'section_created',
  SECTION_UPDATED: 'section_updated',
  SECTION_DELETED: 'section_deleted',

  // Task activities
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  TASK_DELETED: 'task_deleted',
  TASK_STATUS_CHANGED: 'task_status_changed',
  TASK_ASSIGNED: 'task_assigned',

  // Member activities
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',
  MEMBER_ROLE_CHANGED: 'member_role_changed',

  // Comment activities
  COMMENT_ADDED: 'comment_added',
  COMMENT_DELETED: 'comment_deleted',
} as const;

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE];

// ============ AI PROVIDERS ============
export const AI_PROVIDER = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
} as const;

export type AIProvider = typeof AI_PROVIDER[keyof typeof AI_PROVIDER];

// ============ CHAT CONTEXT TYPES ============
export const CHAT_CONTEXT_TYPE = {
  PROJECT: 'project',
  BLOCK: 'block',
  SECTION: 'section',
  TASK: 'task',
} as const;

export type ChatContextType = typeof CHAT_CONTEXT_TYPE[keyof typeof CHAT_CONTEXT_TYPE];

// ============ EXPORT FORMATS ============
export const EXPORT_FORMAT = {
  MARKDOWN: 'markdown',
  HTML: 'html',
  JSON: 'json',
  CSV: 'csv',
  PPTX: 'pptx',
} as const;

export type ExportFormat = typeof EXPORT_FORMAT[keyof typeof EXPORT_FORMAT];
