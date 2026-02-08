/**
 * OpenClaw Integration
 *
 * Provides AI agents, multi-channel messaging, and automation
 * via OpenClaw Gateway.
 */

export * from './types';
export * from './client';
export * from './notifications';
export * from './triggers';
export * from './ai';
export * from './commands';
export * from './webhook';
export * from './cron';
export * from './memory';
export * from './smartFeatures';

// Re-export main utilities
export { getOpenClawClient, isOpenClawAvailable } from './client';
export { getNotificationService } from './notifications';
export { getNotificationTriggers, getUserNotificationPrefs } from './triggers';
export { invokeAI, complete, chat, structured, taskAI, projectAI } from './ai';
export { parseCommand, getCommandHandler } from './commands';
export { handleWebhook, webhookMiddleware } from './webhook';
export { getCronManager, MYDON_CRON_JOBS } from './cron';
export { getMemoryManager } from './memory';
export { getSmartFeatures } from './smartFeatures';
