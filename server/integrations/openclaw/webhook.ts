/**
 * OpenClaw Webhook Handler
 *
 * Receives incoming messages from OpenClaw Gateway
 * and routes them to appropriate command handlers.
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getDb } from '../../db';
import { users } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { parseCommand, getCommandHandler } from './commands';
import { getOpenClawClient } from './client';
import type { OpenClawChannel } from './types';
import { logger } from '../../utils/logger';

/**
 * Webhook payload from OpenClaw
 */
export interface WebhookPayload {
  /** Message ID */
  id: string;
  /** Channel (telegram, whatsapp, etc.) */
  channel: OpenClawChannel;
  /** Sender identifier (phone, chat ID, etc.) */
  sender: string;
  /** Sender name if available */
  senderName?: string;
  /** Message text */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Media attachments */
  media?: string[];
  /** Reply to message ID */
  replyTo?: string;
  /** Raw payload from channel */
  raw?: unknown;
}

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean;
  handled: boolean;
  error?: string;
}

/**
 * Find user by channel identifier
 */
async function findUserByChannelId(
  channel: OpenClawChannel,
  identifier: string
): Promise<{ userId: number; userName?: string } | null> {
  const db = await getDb();
  if (!db) return null;

  // Search in openclaw_preferences for matching channel config
  const result = await db.execute(
    `SELECT op.userId, u.name
     FROM openclaw_preferences op
     JOIN users u ON u.id = op.userId
     WHERE op.enabled = true
     AND JSON_EXTRACT(op.channels, ?) IS NOT NULL`,
    [`$.${channel}.chatId`]
  ) as any;

  // Try to match the identifier
  const rows = result?.[0] || [];
  if (rows.length > 0) {
    for (const row of rows) {
      // For now, return first enabled user
      // TODO: Match specific chatId/phone from preferences
      return { userId: row.userId, userName: row.name || undefined };
    }
  }

  return null;
}

/**
 * Handle incoming webhook from OpenClaw
 */
export async function handleWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const payload = req.body as WebhookPayload;

    // Validate payload
    if (!payload.channel || !payload.sender || !payload.message) {
      res.status(400).json({
        success: false,
        handled: false,
        error: 'Invalid payload: missing channel, sender, or message',
      });
      return;
    }

    logger.webhook.info(`[OpenClaw Webhook] Received from ${payload.channel}:${payload.sender}: ${payload.message}`);

    // Find user by channel identifier
    const user = await findUserByChannelId(payload.channel, payload.sender);

    if (!user) {
      logger.webhook.info(`[OpenClaw Webhook] No user found for ${payload.channel}:${payload.sender}`);

      // Send helpful response
      const client = getOpenClawClient();
      if (client.isEnabled()) {
        await client.sendMessage({
          channel: payload.channel,
          target: payload.sender,
          message: '❓ Я не знаю кто вы. Пожалуйста, привяжите этот канал в настройках MYDON.',
        });
      }

      res.json({ success: true, handled: false });
      return;
    }

    // Parse command
    const cmd = parseCommand(payload.message);

    // If not a command, treat as general message
    if (cmd.command === 'unknown' && !payload.message.startsWith('/')) {
      logger.webhook.info(`[OpenClaw Webhook] Not a command, ignoring`);
      res.json({ success: true, handled: false });
      return;
    }

    // Execute command
    const handler = getCommandHandler();
    const result = await handler.execute(cmd, {
      userId: user.userId,
      userName: user.userName,
      channel: payload.channel,
      chatId: payload.sender,
    });

    // Send response back
    const client = getOpenClawClient();
    if (client.isEnabled()) {
      await client.sendMessage({
        channel: payload.channel,
        target: payload.sender,
        message: result.message,
      });
    }

    res.json({
      success: true,
      handled: true,
    });
  } catch (error) {
    logger.webhook.error('[OpenClaw Webhook] Error:', error as Error);
    res.status(500).json({
      success: false,
      handled: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * Expected header format: sha256=<hex_digest>
 * The signature is computed over the raw request body
 */
export function verifyWebhookSignature(
  req: Request,
  secret: string
): boolean {
  const signature = req.headers['x-openclaw-signature'];
  if (!signature || typeof signature !== 'string') {
    logger.webhook.warn('[OpenClaw Webhook] Missing signature header');
    return false;
  }

  // Parse signature format: sha256=<hex_digest>
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    logger.webhook.warn('[OpenClaw Webhook] Invalid signature format');
    return false;
  }

  const providedHash = parts[1];

  // Compute expected signature from request body
  // Note: req.body should be the raw body string for HMAC verification
  // Express json middleware may have already parsed it, so we use JSON.stringify
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      logger.webhook.warn('[OpenClaw Webhook] Signature length mismatch');
      return false;
    }

    const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    if (!isValid) {
      logger.webhook.warn('[OpenClaw Webhook] Signature verification failed');
    }
    return isValid;
  } catch (error) {
    logger.webhook.error('[OpenClaw Webhook] Signature verification error:', error as Error);
    return false;
  }
}

/**
 * Express middleware for webhook
 */
export function webhookMiddleware(secret?: string) {
  return async (req: Request, res: Response, next: () => void) => {
    // Verify signature if secret is configured
    if (secret && !verifyWebhookSignature(req, secret)) {
      res.status(401).json({
        success: false,
        handled: false,
        error: 'Invalid signature',
      });
      return;
    }

    await handleWebhook(req, res);
  };
}
