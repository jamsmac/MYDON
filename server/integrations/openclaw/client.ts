/**
 * OpenClaw Gateway Client
 *
 * Provides integration with OpenClaw for:
 * - Sending messages via multiple channels
 * - Running AI agents
 * - Managing cron jobs
 * - Memory search
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { logger } from '../../utils/logger';
import type {
  OpenClawChannel,
  SendMessageOptions,
  AgentOptions,
  AgentResponse,
  CronJob,
  CronJobStatus,
  GatewayStatus,
  MemorySearchResult,
} from './types';

const execAsync = promisify(exec);

// OpenClaw CLI path with fallback search
function getOpenClawCliPath(): string {
  // 1. Use environment variable if set
  if (process.env.OPENCLAW_CLI_PATH) {
    return process.env.OPENCLAW_CLI_PATH;
  }

  // 2. Try common installation paths
  const commonPaths = [
    '/usr/local/bin/openclaw',
    '/usr/bin/openclaw',
    `${process.env.HOME}/.local/bin/openclaw`,
    `${process.env.HOME}/bin/openclaw`,
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // 3. Fall back to assuming it's in PATH
  return 'openclaw';
}

const OPENCLAW_CLI = getOpenClawCliPath();

// Default timeout for commands (seconds)
const DEFAULT_TIMEOUT = 60;

/**
 * Execute OpenClaw CLI command
 */
async function runCommand(
  args: string[],
  options?: { timeout?: number; json?: boolean }
): Promise<{ stdout: string; stderr: string }> {
  const timeout = (options?.timeout || DEFAULT_TIMEOUT) * 1000;
  const jsonFlag = options?.json ? ['--json'] : [];

  const cmd = [OPENCLAW_CLI, ...args, ...jsonFlag].join(' ');

  try {
    const result = await execAsync(cmd, { timeout });
    return result;
  } catch (error: any) {
    logger.openclaw.error(`[OpenClaw] Command failed: ${cmd}`, error.message);
    throw error;
  }
}

/**
 * Parse JSON output from CLI
 */
function parseJsonOutput<T>(stdout: string): T | null {
  try {
    // Find JSON in output (may have other text before/after)
    const jsonMatch = stdout.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * OpenClaw Client Class
 */
export class OpenClawClient {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.OPENCLAW_ENABLED === 'true';
  }

  /**
   * Check if OpenClaw integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get gateway status
   */
  async getGatewayStatus(): Promise<GatewayStatus> {
    try {
      const { stdout } = await runCommand(['gateway', 'status']);

      const running = stdout.includes('Runtime: running');
      const portMatch = stdout.match(/port=(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : 18789;

      return {
        running,
        port,
        url: `http://127.0.0.1:${port}`,
        version: stdout.match(/OpenClaw ([\d.]+)/)?.[1],
      };
    } catch {
      return { running: false, port: 18789, url: 'http://127.0.0.1:18789' };
    }
  }

  /**
   * Send a message via OpenClaw
   */
  async sendMessage(options: SendMessageOptions): Promise<boolean> {
    if (!this.enabled) {
      logger.openclaw.warn('[OpenClaw] Integration disabled, skipping message');
      return false;
    }

    const args = [
      'message', 'send',
      '--channel', options.channel,
      '--target', options.target,
      '--message', `"${options.message.replace(/"/g, '\\"')}"`,
    ];

    if (options.media && options.media.length > 0) {
      options.media.forEach(m => args.push('--media', m));
    }

    try {
      await runCommand(args);
      logger.openclaw.info(`[OpenClaw] Message sent via ${options.channel} to ${options.target}`);
      return true;
    } catch (error) {
      logger.openclaw.error(`[OpenClaw] Failed to send message:`, error as Error);
      return false;
    }
  }

  /**
   * Run an AI agent
   */
  async runAgent(message: string, options?: AgentOptions): Promise<AgentResponse> {
    if (!this.enabled) {
      return { success: false, error: 'OpenClaw integration disabled' };
    }

    const args = ['agent', '--message', `"${message.replace(/"/g, '\\"')}"`];

    if (options?.agentId) {
      args.push('--agent', options.agentId);
    }
    if (options?.sessionId) {
      args.push('--session-id', options.sessionId);
    }
    if (options?.thinking) {
      args.push('--thinking', options.thinking);
    }
    if (options?.timeout) {
      args.push('--timeout', options.timeout.toString());
    }
    if (options?.deliver) {
      args.push('--deliver');
      if (options.replyChannel) {
        args.push('--reply-channel', options.replyChannel);
      }
      if (options.replyTo) {
        args.push('--reply-to', options.replyTo);
      }
    }

    try {
      const { stdout } = await runCommand(args, {
        timeout: options?.timeout || 300,
        json: true
      });

      const result = parseJsonOutput<any>(stdout);

      return {
        success: true,
        message: result?.response || result?.message || stdout,
        sessionId: result?.sessionId,
        tokensUsed: result?.tokensUsed,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Agent execution failed',
      };
    }
  }

  /**
   * Add a cron job
   */
  async addCronJob(job: CronJob): Promise<string | null> {
    if (!this.enabled) return null;

    const args = [
      'cron', 'add',
      '--name', job.name,
      '--schedule', `"${job.schedule}"`,
      '--command', `"${job.command}"`,
    ];

    try {
      const { stdout } = await runCommand(args);
      const idMatch = stdout.match(/id[:\s]+([a-zA-Z0-9-]+)/i);
      return idMatch?.[1] || job.name;
    } catch (error) {
      logger.openclaw.error(`[OpenClaw] Failed to add cron job:`, error as Error);
      return null;
    }
  }

  /**
   * Remove a cron job
   */
  async removeCronJob(jobId: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await runCommand(['cron', 'rm', jobId]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List cron jobs
   */
  async listCronJobs(): Promise<CronJobStatus[]> {
    if (!this.enabled) return [];

    try {
      const { stdout } = await runCommand(['cron', 'list'], { json: true });
      const jobs = parseJsonOutput<any[]>(stdout);

      if (!jobs) return [];

      return jobs.map(job => ({
        id: job.id || job.name,
        name: job.name,
        schedule: job.schedule,
        enabled: job.enabled !== false,
        lastRun: job.lastRun ? new Date(job.lastRun) : undefined,
        nextRun: job.nextRun ? new Date(job.nextRun) : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Enable/disable a cron job
   */
  async setCronJobEnabled(jobId: string, enabled: boolean): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await runCommand(['cron', enabled ? 'enable' : 'disable', jobId]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Search memory
   */
  async searchMemory(query: string, limit = 5): Promise<MemorySearchResult[]> {
    if (!this.enabled) return [];

    try {
      const { stdout } = await runCommand(
        ['memory', 'search', `"${query}"`, '--limit', limit.toString()],
        { json: true }
      );

      const results = parseJsonOutput<any[]>(stdout);

      if (!results) return [];

      return results.map(r => ({
        id: r.id,
        content: r.content || r.text,
        score: r.score || 0,
        metadata: r.metadata,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Broadcast message to multiple targets
   */
  async broadcast(
    channel: OpenClawChannel,
    targets: string[],
    message: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      const success = await this.sendMessage({ channel, target, message });
      if (success) sent++;
      else failed++;
    }

    return { sent, failed };
  }
}

// Singleton instance
let clientInstance: OpenClawClient | null = null;

/**
 * Get OpenClaw client instance
 */
export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient();
  }
  return clientInstance;
}

/**
 * Check if OpenClaw is available
 */
export async function isOpenClawAvailable(): Promise<boolean> {
  try {
    const client = getOpenClawClient();
    const status = await client.getGatewayStatus();
    return status.running;
  } catch {
    return false;
  }
}
