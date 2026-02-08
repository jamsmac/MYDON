/**
 * OpenClaw Integration Types
 */

// Supported messaging channels
export type OpenClawChannel =
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'slack'
  | 'signal'
  | 'imessage'
  | 'msteams'
  | 'mattermost'
  | 'matrix';

// Agent thinking levels
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high';

// Message send options
export interface SendMessageOptions {
  channel: OpenClawChannel;
  target: string; // phone number, chat id, channel id, etc.
  message: string;
  media?: string[]; // file paths for attachments
}

// Agent run options
export interface AgentOptions {
  agentId?: string;
  sessionId?: string;
  thinking?: ThinkingLevel;
  timeout?: number; // seconds
  deliver?: boolean;
  replyChannel?: OpenClawChannel;
  replyTo?: string;
}

// Agent response
export interface AgentResponse {
  success: boolean;
  message?: string;
  error?: string;
  sessionId?: string;
  tokensUsed?: number;
}

// Cron job definition
export interface CronJob {
  name: string;
  schedule: string; // cron expression
  command: string;
  enabled?: boolean;
}

// Cron job status
export interface CronJobStatus {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

// Notification types for MYDON
export type NotificationType =
  | 'deadline_warning'
  | 'deadline_urgent'
  | 'deadline_reminder'
  | 'task_assigned'
  | 'task_completed'
  | 'task_comment'
  | 'task_mention'
  | 'blocker_added'
  | 'status_changed'
  | 'daily_digest'
  | 'weekly_report';

// Channel configuration
export interface ChannelConfig {
  enabled: boolean;
  chatId?: string; // Telegram
  phone?: string; // WhatsApp
  channelId?: string; // Discord, Slack
}

// User notification preferences
export interface NotificationPreferences {
  channels: Partial<Record<OpenClawChannel, ChannelConfig>>;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
  preferences: {
    [key in NotificationType]?: {
      enabled: boolean;
      channels: OpenClawChannel[];
    };
  };
}

// Gateway status
export interface GatewayStatus {
  running: boolean;
  port: number;
  url: string;
  version?: string;
}

// Memory search result
export interface MemorySearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}
