/**
 * SkillEngine - Central engine for executing AI skills
 *
 * Supports different handler types:
 * - prompt: Template-based LLM invocation
 * - function: Registered local function execution
 * - mcp: MCP protocol tool invocation (future)
 * - webhook: External HTTP endpoint call
 */

import { invokeLLM, type Message } from '../_core/llm';
import { getDb } from '../db';
import {
  aiSkills,
  aiAgents,
  aiRequestLogs,
  aiModelTaskAssignments,
  projects,
  blocks,
  sections,
  tasks,
  type AISkill,
  type AIAgent,
} from '../../drizzle/schema';
import { eq, and, or, sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface SkillExecutionContext {
  userId: number;
  projectId: number;
  entityType: 'project' | 'block' | 'section' | 'task';
  entityId: number;
  entityData: Record<string, unknown>;
  additionalContext?: string;
  model?: string;
  stream?: boolean;
}

export interface SkillExecutionResult {
  success: boolean;
  content: string;
  structuredData?: unknown;
  model: string;
  tokensUsed?: number;
  responseTimeMs: number;
  agentId?: number;
  skillId: number;
  error?: string;
}

// ============================================================================
// Registered Functions for function-type skills
// ============================================================================

type FunctionHandler = (ctx: SkillExecutionContext) => Promise<SkillExecutionResult>;

const REGISTERED_FUNCTIONS: Record<string, FunctionHandler> = {
  // Will be populated with: detectRisks, suggestDependencies, findSimilarTasks, etc.
};

/**
 * Register a function handler for function-type skills
 */
export function registerSkillFunction(name: string, handler: FunctionHandler): void {
  REGISTERED_FUNCTIONS[name] = handler;
}

// ============================================================================
// Entity Data Loader
// ============================================================================

async function loadEntityData(
  entityType: 'project' | 'block' | 'section' | 'task',
  entityId: number
): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) return {};

  switch (entityType) {
    case 'project': {
      const [project] = await db.select().from(projects).where(eq(projects.id, entityId));
      return project ? { ...project } : {};
    }
    case 'block': {
      const [block] = await db.select().from(blocks).where(eq(blocks.id, entityId));
      return block ? { ...block } : {};
    }
    case 'section': {
      const [section] = await db.select().from(sections).where(eq(sections.id, entityId));
      return section ? { ...section } : {};
    }
    case 'task': {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, entityId));
      return task ? { ...task } : {};
    }
    default:
      return {};
  }
}

// ============================================================================
// SkillEngine Class
// ============================================================================

export class SkillEngine {
  /**
   * Main entry point: find and execute a skill by slug
   */
  static async execute(
    skillSlug: string,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }

    const startTime = Date.now();

    // 1. Find skill by slug
    const [skill] = await db.select().from(aiSkills)
      .where(eq(aiSkills.slug, skillSlug));

    if (!skill || !skill.isActive) {
      throw new Error(`Skill "${skillSlug}" not found or inactive`);
    }

    // 2. Find agent if assigned
    let agent: AIAgent | null = null;
    if (skill.agentId) {
      const [a] = await db.select().from(aiAgents)
        .where(eq(aiAgents.id, skill.agentId));
      agent = a || null;
    }

    // 3. Resolve model (context.model > agent.modelPreference > task assignment > default)
    const model = await this.resolveModel(context, agent, skill);

    // 4. Execute skill based on handler type
    let result: SkillExecutionResult;

    try {
      switch (skill.handlerType) {
        case 'prompt':
          result = await this.executePromptSkill(skill, agent, context, model);
          break;
        case 'function':
          result = await this.executeFunctionSkill(skill, context);
          break;
        case 'mcp':
          result = await this.executeMCPSkill(skill, context);
          break;
        case 'webhook':
          result = await this.executeWebhookSkill(skill, context);
          break;
        default:
          throw new Error(`Unknown handler type: ${skill.handlerType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result = {
        success: false,
        content: '',
        model: model || 'unknown',
        responseTimeMs: Date.now() - startTime,
        skillId: skill.id,
        error: errorMessage,
      };
    }

    result.responseTimeMs = Date.now() - startTime;
    result.skillId = skill.id;
    if (agent) result.agentId = agent.id;

    // 5. Log execution
    await this.logExecution(context, skill, agent, result);

    // 6. Update skill statistics
    try {
      await db.update(aiSkills).set({
        totalInvocations: sql`${aiSkills.totalInvocations} + 1`,
        avgExecutionTime: sql`CAST(((COALESCE(${aiSkills.avgExecutionTime}, 0) * COALESCE(${aiSkills.totalInvocations}, 0) + ${result.responseTimeMs}) / (COALESCE(${aiSkills.totalInvocations}, 0) + 1)) AS SIGNED)`,
      }).where(eq(aiSkills.id, skill.id));
    } catch {
      // Ignore stats update errors
    }

    return result;
  }

  /**
   * Execute a prompt-type skill: substitute variables and invoke LLM
   */
  private static async executePromptSkill(
    skill: AISkill,
    agent: AIAgent | null,
    context: SkillExecutionContext,
    model: string
  ): Promise<SkillExecutionResult> {
    const handlerConfig = skill.handlerConfig as { prompt?: string } | null;
    const promptTemplate = handlerConfig?.prompt || '';

    // Build prompt from template
    const skillPrompt = this.buildPromptFromTemplate(promptTemplate, context);

    // System prompt from agent or default
    const systemPrompt = agent?.systemPrompt ||
      'Ты — AI-ассистент для управления проектами MYDON. Отвечай на русском языке. Формат: markdown.';

    // Prepare messages
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (context.additionalContext) {
      messages.push({
        role: 'user',
        content: `Контекст: ${context.additionalContext}`,
      });
    }

    messages.push({ role: 'user', content: skillPrompt });

    // Invoke LLM
    const response = await invokeLLM({
      model,
      messages,
      maxTokens: agent?.maxTokens || 4096,
      // If skill has outputSchema, use JSON schema response format
      ...(skill.outputSchema ? {
        response_format: {
          type: 'json_schema' as const,
          json_schema: {
            name: skill.slug,
            schema: skill.outputSchema as Record<string, unknown>,
          },
        },
      } : {}),
    });

    const content = typeof response.choices[0]?.message?.content === 'string'
      ? response.choices[0].message.content
      : '';

    let structuredData: unknown = undefined;
    if (skill.outputSchema && content) {
      try {
        structuredData = JSON.parse(content);
      } catch {
        // Keep content as-is if not valid JSON
      }
    }

    return {
      success: true,
      content,
      structuredData,
      model: response.model,
      tokensUsed: response.usage?.total_tokens,
      responseTimeMs: 0,
      skillId: skill.id,
    };
  }

  /**
   * Build prompt from template with variable substitution
   */
  private static buildPromptFromTemplate(
    template: string,
    context: SkillExecutionContext
  ): string {
    const data = context.entityData;

    return template
      .replace(/\{\{entityType\}\}/g, context.entityType)
      .replace(/\{\{entityId\}\}/g, String(context.entityId))
      .replace(/\{\{entityTitle\}\}/g, String(data.title || data.name || ''))
      .replace(/\{\{entityDescription\}\}/g, String(data.description || ''))
      .replace(/\{\{entityStatus\}\}/g, String(data.status || ''))
      .replace(/\{\{entityPriority\}\}/g, String(data.priority || ''))
      .replace(/\{\{entityDeadline\}\}/g, String(data.deadline || data.dueDate || ''))
      .replace(/\{\{projectId\}\}/g, String(context.projectId))
      .replace(/\{\{userId\}\}/g, String(context.userId))
      .replace(/\{\{entityData\}\}/g, JSON.stringify(data, null, 2));
  }

  /**
   * Resolve model based on priority chain
   */
  private static async resolveModel(
    context: SkillExecutionContext,
    agent: AIAgent | null,
    skill: AISkill
  ): Promise<string> {
    // 1. Manual user override
    if (context.model) return context.model;

    // 2. Agent preference
    if (agent?.modelPreference) return agent.modelPreference;

    // 3. Task assignment from ai_model_task_assignments
    const db = await getDb();
    if (db) {
      try {
        // Try exact entity type match first
        const [exactMatch] = await db.select()
          .from(aiModelTaskAssignments)
          .where(and(
            eq(aiModelTaskAssignments.taskCategory, skill.slug),
            eq(aiModelTaskAssignments.entityType, context.entityType),
            eq(aiModelTaskAssignments.isActive, true)
          ));

        if (exactMatch?.primaryModelName) return exactMatch.primaryModelName;

        // Fallback to 'any' entity type
        const [anyMatch] = await db.select()
          .from(aiModelTaskAssignments)
          .where(and(
            eq(aiModelTaskAssignments.taskCategory, skill.slug),
            eq(aiModelTaskAssignments.entityType, 'any'),
            eq(aiModelTaskAssignments.isActive, true)
          ));

        if (anyMatch?.primaryModelName) return anyMatch.primaryModelName;
      } catch {
        // Ignore lookup errors, fall through to default
      }
    }

    // 4. Default model (invokeLLM will use its default)
    return 'google/gemini-2.0-flash-001';
  }

  /**
   * Execute a function-type skill
   */
  private static async executeFunctionSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const handlerConfig = skill.handlerConfig as { functionName?: string } | null;
    const functionName = handlerConfig?.functionName;

    if (!functionName) {
      throw new Error('No functionName in skill handler config');
    }

    const handler = REGISTERED_FUNCTIONS[functionName];
    if (!handler) {
      throw new Error(`Function "${functionName}" not registered`);
    }

    return handler(context);
  }

  /**
   * Execute an MCP-type skill (Model Context Protocol)
   */
  private static async executeMCPSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const handlerConfig = skill.handlerConfig as {
      mcpServerId?: number;
      mcpToolName?: string;
    } | null;

    const { mcpServerId, mcpToolName } = handlerConfig || {};

    if (!mcpServerId || !mcpToolName) {
      throw new Error('MCP handler config incomplete: requires mcpServerId and mcpToolName');
    }

    // TODO: Implement MCP protocol (see Part 7 of SKILLS_AGENTS spec)
    throw new Error('MCP execution not yet implemented');
  }

  /**
   * Execute a webhook-type skill
   */
  private static async executeWebhookSkill(
    skill: AISkill,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const handlerConfig = skill.handlerConfig as {
      webhookUrl?: string;
      webhookMethod?: string;
    } | null;

    const { webhookUrl, webhookMethod } = handlerConfig || {};

    if (!webhookUrl) {
      throw new Error('No webhookUrl in skill handler config');
    }

    const response = await fetch(webhookUrl, {
      method: webhookMethod || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillSlug: skill.slug,
        context: {
          entityType: context.entityType,
          entityId: context.entityId,
          entityData: context.entityData,
          projectId: context.projectId,
          userId: context.userId,
        },
      }),
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = { content: await response.text() };
    }

    const dataObj = data as { content?: string };

    return {
      success: response.ok,
      content: dataObj.content || JSON.stringify(data),
      structuredData: data,
      model: 'webhook',
      responseTimeMs: 0,
      skillId: skill.id,
    };
  }

  /**
   * Log skill execution to ai_request_logs
   */
  private static async logExecution(
    context: SkillExecutionContext,
    skill: AISkill,
    agent: AIAgent | null,
    result: SkillExecutionResult
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(aiRequestLogs).values({
        userId: context.userId,
        requestType: 'skill',
        skillId: skill.id,
        agentId: agent?.id || null,
        model: result.model,
        input: JSON.stringify({
          entityType: context.entityType,
          entityId: context.entityId,
          additionalContext: context.additionalContext,
        }),
        output: result.content.substring(0, 65000), // Limit to TEXT field size
        tokensUsed: result.tokensUsed || 0,
        responseTimeMs: result.responseTimeMs,
        status: result.success ? 'success' : 'error',
        errorMessage: result.error || null,
      });
    } catch {
      // Ignore logging errors
    }
  }
}

// ============================================================================
// Utility exports
// ============================================================================

export { loadEntityData };
