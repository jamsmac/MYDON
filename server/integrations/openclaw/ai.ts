/**
 * OpenClaw AI Provider
 *
 * Uses OpenClaw agents as an AI backend with automatic fallback
 * to direct API calls when OpenClaw is unavailable.
 */

import { getOpenClawClient, isOpenClawAvailable } from './client';
import { invokeLLM } from '../../_core/llm';
import { logger } from '../../utils/logger';
import type { InvokeParams, InvokeResult, Message } from '../../_core/llm';
import type { ThinkingLevel, AgentResponse } from './types';

/**
 * Options for OpenClaw AI invocation
 */
export interface OpenClawAIOptions {
  /** Agent ID to use (optional, uses default agent if not specified) */
  agentId?: string;
  /** Session ID for conversation continuity */
  sessionId?: string;
  /** Thinking level for complex reasoning */
  thinking?: ThinkingLevel;
  /** Timeout in seconds */
  timeout?: number;
  /** Force use of OpenClaw even if it might be slower */
  forceOpenClaw?: boolean;
  /** Force fallback to direct API */
  forceFallback?: boolean;
}

/**
 * Extended invoke result with OpenClaw metadata
 */
export interface OpenClawInvokeResult extends InvokeResult {
  provider: 'openclaw' | 'direct';
  sessionId?: string;
  tokensUsed?: number;
}

/**
 * Convert messages to a single prompt string
 */
function messagesToPrompt(messages: Message[]): string {
  return messages
    .map(msg => {
      const content = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .map(part => typeof part === 'string' ? part : (part as any).text || '')
              .join('\n')
          : '';

      switch (msg.role) {
        case 'system':
          return `[System]: ${content}`;
        case 'user':
          return `[User]: ${content}`;
        case 'assistant':
          return `[Assistant]: ${content}`;
        default:
          return content;
      }
    })
    .join('\n\n');
}

/**
 * Convert OpenClaw agent response to InvokeResult format
 */
function agentResponseToInvokeResult(
  response: AgentResponse,
  sessionId?: string
): OpenClawInvokeResult {
  const message = response.message || response.error || '';

  return {
    provider: 'openclaw',
    id: `openclaw-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: 'openclaw-agent',
    sessionId: response.sessionId || sessionId,
    tokensUsed: response.tokensUsed,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: message,
        },
        finish_reason: response.success ? 'stop' : 'error',
      },
    ],
    usage: response.tokensUsed
      ? {
          prompt_tokens: 0, // Not tracked by OpenClaw
          completion_tokens: response.tokensUsed,
          total_tokens: response.tokensUsed,
        }
      : undefined,
  };
}

/**
 * Invoke AI via OpenClaw with automatic fallback
 *
 * @param params Standard LLM invoke parameters
 * @param options OpenClaw-specific options
 * @returns AI response in standard format
 */
export async function invokeAI(
  params: InvokeParams,
  options?: OpenClawAIOptions
): Promise<OpenClawInvokeResult> {
  const client = getOpenClawClient();

  // Check if we should use OpenClaw
  const shouldUseOpenClaw =
    !options?.forceFallback &&
    client.isEnabled() &&
    (options?.forceOpenClaw || await isOpenClawAvailable());

  if (!shouldUseOpenClaw) {
    // Fallback to direct API
    const result = await invokeLLM(params);
    return {
      ...result,
      provider: 'direct',
    };
  }

  // Use OpenClaw agent
  try {
    const prompt = messagesToPrompt(params.messages);

    const response = await client.runAgent(prompt, {
      agentId: options?.agentId,
      sessionId: options?.sessionId,
      thinking: options?.thinking || 'medium',
      timeout: options?.timeout || 120,
    });

    if (!response.success) {
      logger.openclaw.warn('[OpenClaw AI] Agent failed, falling back to direct API', { error: response.error });
      const result = await invokeLLM(params);
      return { ...result, provider: 'direct' };
    }

    return agentResponseToInvokeResult(response, options?.sessionId);
  } catch (error) {
    logger.openclaw.error('[OpenClaw AI] Error, falling back to direct API:', error as Error);
    const result = await invokeLLM(params);
    return { ...result, provider: 'direct' };
  }
}

/**
 * Simple text completion via OpenClaw
 *
 * @param prompt Text prompt
 * @param options OpenClaw options
 * @returns Generated text
 */
export async function complete(
  prompt: string,
  options?: OpenClawAIOptions
): Promise<string> {
  const result = await invokeAI(
    {
      messages: [{ role: 'user', content: prompt }],
    },
    options
  );

  const content = result.choices[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/**
 * Chat completion with conversation history
 *
 * @param messages Conversation messages
 * @param options OpenClaw options
 * @returns Assistant response
 */
export async function chat(
  messages: Message[],
  options?: OpenClawAIOptions
): Promise<{ response: string; sessionId?: string }> {
  const result = await invokeAI({ messages }, options);

  const content = result.choices[0]?.message?.content;
  return {
    response: typeof content === 'string' ? content : '',
    sessionId: result.sessionId,
  };
}

/**
 * Structured output via OpenClaw
 *
 * @param prompt Prompt for structured output
 * @param schema JSON schema for output
 * @param options OpenClaw options
 * @returns Parsed JSON result
 */
export async function structured<T>(
  prompt: string,
  schema: { name: string; schema: Record<string, unknown> },
  options?: OpenClawAIOptions
): Promise<T | null> {
  const fullPrompt = `${prompt}

Please respond with valid JSON matching this schema:
${JSON.stringify(schema.schema, null, 2)}

Important: Return ONLY valid JSON, no other text.`;

  const result = await invokeAI(
    {
      messages: [{ role: 'user', content: fullPrompt }],
    },
    options
  );

  const content = result.choices[0]?.message?.content;
  if (typeof content !== 'string') return null;

  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return JSON.parse(content) as T;
  } catch {
    logger.openclaw.warn('[OpenClaw AI] Failed to parse structured response', { content });
    return null;
  }
}

/**
 * Task-specific AI operations
 */
export const taskAI = {
  /**
   * Generate task breakdown from a description
   */
  async breakdown(
    description: string,
    options?: OpenClawAIOptions
  ): Promise<{ subtasks: string[]; estimatedHours?: number } | null> {
    const prompt = `Analyze this task and break it down into subtasks:

"${description}"

Provide a breakdown with:
1. List of specific, actionable subtasks
2. Estimated total hours to complete

Respond in Russian.`;

    return structured<{ subtasks: string[]; estimatedHours?: number }>(
      prompt,
      {
        name: 'task_breakdown',
        schema: {
          type: 'object',
          properties: {
            subtasks: { type: 'array', items: { type: 'string' } },
            estimatedHours: { type: 'number' },
          },
          required: ['subtasks'],
        },
      },
      { ...options, thinking: 'high' }
    );
  },

  /**
   * Suggest priority based on task details
   */
  async suggestPriority(
    title: string,
    description?: string,
    deadline?: Date,
    options?: OpenClawAIOptions
  ): Promise<'low' | 'medium' | 'high' | 'critical' | null> {
    const prompt = `Determine the priority for this task:

Title: ${title}
${description ? `Description: ${description}` : ''}
${deadline ? `Deadline: ${deadline.toISOString()}` : 'No deadline'}

Consider urgency, importance, and deadline proximity.
Return one of: "low", "medium", "high", "critical"`;

    const result = await complete(prompt, { ...options, thinking: 'low' });
    const priority = result.toLowerCase().trim();

    if (['low', 'medium', 'high', 'critical'].includes(priority)) {
      return priority as 'low' | 'medium' | 'high' | 'critical';
    }

    // Try to extract from response
    const match = result.match(/\b(low|medium|high|critical)\b/i);
    return match ? (match[1].toLowerCase() as 'low' | 'medium' | 'high' | 'critical') : null;
  },

  /**
   * Generate daily standup summary
   */
  async generateStandup(
    completedYesterday: { title: string; id: number }[],
    plannedToday: { title: string; id: number; priority?: string }[],
    blockers: { title: string; reason?: string }[],
    options?: OpenClawAIOptions
  ): Promise<string> {
    const prompt = `Generate a daily standup summary in Russian.

Completed yesterday:
${completedYesterday.map(t => `- ${t.title} (#${t.id})`).join('\n') || '- Nothing'}

Planned for today:
${plannedToday.map(t => `- ${t.title} (#${t.id})${t.priority ? ` [${t.priority}]` : ''}`).join('\n') || '- Nothing planned'}

Blockers:
${blockers.map(b => `- ${b.title}${b.reason ? `: ${b.reason}` : ''}`).join('\n') || '- No blockers'}

Format nicely with emojis. Be concise.`;

    return complete(prompt, options);
  },
};

/**
 * Project-specific AI operations
 */
export const projectAI = {
  /**
   * Analyze project progress and provide insights
   */
  async analyzeProgress(
    stats: {
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
      upcomingDeadlines: number;
    },
    options?: OpenClawAIOptions
  ): Promise<string> {
    const completionRate = stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0;

    const prompt = `Analyze this project status and provide brief insights in Russian:

- Total tasks: ${stats.totalTasks}
- Completed: ${stats.completedTasks} (${completionRate}%)
- Overdue: ${stats.overdueTasks}
- Upcoming deadlines (7 days): ${stats.upcomingDeadlines}

Provide:
1. Overall health assessment (🟢/🟡/🔴)
2. Key observations (2-3 bullet points)
3. One actionable recommendation`;

    return complete(prompt, options);
  },

  /**
   * Suggest optimal task ordering
   */
  async suggestOrdering(
    tasks: { id: number; title: string; priority?: string; deadline?: Date }[],
    options?: OpenClawAIOptions
  ): Promise<number[]> {
    const prompt = `Given these tasks, suggest the optimal order to work on them.
Consider priority, deadlines, and logical dependencies.

Tasks:
${tasks.map(t => `- ID ${t.id}: ${t.title} (priority: ${t.priority || 'none'}, deadline: ${t.deadline?.toISOString() || 'none'})`).join('\n')}

Return a JSON array of task IDs in the recommended order.`;

    const result = await complete(prompt, { ...options, thinking: 'medium' });

    try {
      const match = result.match(/\[[\d,\s]+\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      // Return original order if parsing fails
    }

    return tasks.map(t => t.id);
  },
};
