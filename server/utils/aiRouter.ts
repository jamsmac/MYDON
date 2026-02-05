/**
 * AI Router Service
 * Routes AI requests to appropriate providers with caching and fallback
 */

import { v4 as uuidv4 } from 'uuid';
import { AICache } from './aiCache';
import { 
  callOpenAI, 
  callAnthropic, 
  callGoogle, 
  callBuiltin,
  isProviderAvailable,
  getAvailableProviders,
} from './aiProviders';
import type { 
  AIProvider, 
  TaskType, 
  AIRequestOptions, 
  AIResponse,
  AIMessage,
} from './aiTypes';
import { DEFAULT_TASK_MODEL_MAPPING } from './aiTypes';
import { getDb } from '../db';
import * as schema from '../../drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';

// Fallback order for providers
const FALLBACK_ORDER: AIProvider[] = ['builtin', 'openai', 'anthropic', 'google'];

/**
 * AI Router Class
 * Handles routing, caching, logging, and fallback for AI requests
 */
export class AIRouter {
  /**
   * Main entry point for AI requests
   */
  static async chat(options: AIRequestOptions): Promise<AIResponse> {
    const startTime = Date.now();
    const taskType = options.taskType || 'chat';
    const useCache = options.useCache !== false;
    const sessionId = options.sessionId || uuidv4();

    // Generate cache key from the last user message
    const lastUserMessage = options.messages.filter(m => m.role === 'user').pop();
    const cacheKey = lastUserMessage 
      ? AICache.generateKey(lastUserMessage.content, taskType)
      : null;

    // Check cache first
    if (useCache && cacheKey) {
      const cached = await AICache.get(cacheKey);
      if (cached) {
        const response: AIResponse = {
          content: cached.response,
          model: cached.model,
          provider: 'builtin' as AIProvider,
          tokens: { prompt: 0, completion: 0, total: cached.tokens || 0 },
          cost: 0,
          fromCache: true,
          executionTime: Date.now() - startTime,
        };

        // Log cached request
        await this.logRequest(options.userId, sessionId, lastUserMessage?.content || '', response, taskType);
        
        return response;
      }
    }

    // Get the appropriate provider for this task
    const { provider, model } = this.selectProvider(taskType, options.model);
    
    // Try to call the provider with fallback
    let response: AIResponse;
    let lastError: Error | null = null;

    const providersToTry = this.getProvidersToTry(provider);
    
    for (const currentProvider of providersToTry) {
      try {
        response = await this.callProvider(currentProvider, {
          ...options,
          model: currentProvider === provider ? model : undefined,
          sessionId,
        });

        // Cache the successful response
        if (useCache && cacheKey && lastUserMessage) {
          await AICache.set(cacheKey, {
            prompt: lastUserMessage.content,
            response: response.content,
            model: response.model,
            taskType,
            tokens: response.tokens?.total,
            cost: response.cost,
          });
        }

        // Log the request
        await this.logRequest(options.userId, sessionId, lastUserMessage?.content || '', response, taskType);

        // Update usage stats
        await this.updateUsageStats(options.userId, response, false);

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`[AIRouter] Provider ${currentProvider} failed:`, error);
        continue;
      }
    }

    // All providers failed
    throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Select the best provider for a task type
   */
  private static selectProvider(taskType: TaskType, requestedModel?: string): { provider: AIProvider; model: string } {
    // If a specific model is requested, try to determine the provider
    if (requestedModel) {
      if (requestedModel.startsWith('gpt-')) {
        return { provider: 'openai', model: requestedModel };
      }
      if (requestedModel.startsWith('claude-')) {
        return { provider: 'anthropic', model: requestedModel };
      }
      if (requestedModel.startsWith('gemini-')) {
        return { provider: 'google', model: requestedModel };
      }
    }

    // Use default mapping
    return DEFAULT_TASK_MODEL_MAPPING[taskType] || DEFAULT_TASK_MODEL_MAPPING.chat;
  }

  /**
   * Get list of providers to try in order
   */
  private static getProvidersToTry(preferredProvider: AIProvider): AIProvider[] {
    const available = getAvailableProviders();
    const result: AIProvider[] = [];

    // Add preferred provider first if available
    if (available.includes(preferredProvider)) {
      result.push(preferredProvider);
    }

    // Add fallback providers
    for (const provider of FALLBACK_ORDER) {
      if (available.includes(provider) && !result.includes(provider)) {
        result.push(provider);
      }
    }

    return result;
  }

  /**
   * Call a specific provider
   */
  private static async callProvider(provider: AIProvider, options: AIRequestOptions): Promise<AIResponse> {
    switch (provider) {
      case 'openai':
        return callOpenAI(options);
      case 'anthropic':
        return callAnthropic(options);
      case 'google':
        return callGoogle(options);
      case 'builtin':
      default:
        return callBuiltin(options);
    }
  }

  /**
   * Log request to database
   */
  private static async logRequest(
    userId: number | undefined,
    sessionId: string,
    prompt: string,
    response: AIResponse,
    taskType: string
  ): Promise<void> {
    if (!userId) return;

    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(schema.aiRequests).values({
        userId,
        sessionId,
        prompt,
        response: response.content,
        model: response.model,
        taskType,
        tokens: response.tokens?.total || null,
        cost: response.cost?.toString() || null,
        fromCache: response.fromCache,
        executionTime: response.executionTime,
      });
    } catch (error) {
      console.error('[AIRouter] Failed to log request:', error);
    }
  }

  /**
   * Update daily usage statistics
   */
  private static async updateUsageStats(
    userId: number | undefined,
    response: AIResponse,
    fromCache: boolean
  ): Promise<void> {
    if (!userId) return;

    const db = await getDb();
    if (!db) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Try to find existing stats for today
      const existing = await db
        .select()
        .from(schema.aiUsageStats)
        .where(
          and(
            eq(schema.aiUsageStats.userId, userId),
            sql`DATE(${schema.aiUsageStats.date}) = ${today}`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing stats
        const stats = existing[0];
        const modelUsage = (stats.modelUsage as Record<string, number>) || {};
        modelUsage[response.model] = (modelUsage[response.model] || 0) + 1;

        await db
          .update(schema.aiUsageStats)
          .set({
            totalRequests: (stats.totalRequests || 0) + 1,
            cachedRequests: (stats.cachedRequests || 0) + (fromCache ? 1 : 0),
            totalTokens: (stats.totalTokens || 0) + (response.tokens?.total || 0),
            totalCost: ((parseFloat(stats.totalCost?.toString() || '0')) + (response.cost || 0)).toFixed(4),
            modelUsage,
          })
          .where(eq(schema.aiUsageStats.id, stats.id));
      } else {
        // Create new stats for today
        await db.insert(schema.aiUsageStats).values({
          userId,
          date: new Date(today),
          totalRequests: 1,
          cachedRequests: fromCache ? 1 : 0,
          totalTokens: response.tokens?.total || 0,
          totalCost: (response.cost || 0).toFixed(4),
          modelUsage: { [response.model]: 1 },
        });
      }
    } catch (error) {
      console.error('[AIRouter] Failed to update usage stats:', error);
    }
  }

  /**
   * Create or get a chat session
   */
  static async getOrCreateSession(
    userId: number,
    sessionId?: string,
    projectId?: number,
    title?: string
  ): Promise<string> {
    const db = await getDb();
    if (!db) return sessionId || uuidv4();

    const id = sessionId || uuidv4();

    try {
      // Check if session exists
      const existing = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, id))
        .limit(1);

      if (existing.length === 0) {
        // Create new session
        await db.insert(schema.aiSessions).values({
          id,
          userId,
          title: title || 'New Chat',
          projectId: projectId || null,
          messageCount: 0,
        });
      }

      return id;
    } catch (error) {
      console.error('[AIRouter] Failed to create session:', error);
      return id;
    }
  }

  /**
   * Update session after a message
   */
  static async updateSession(sessionId: string): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db
        .update(schema.aiSessions)
        .set({
          lastMessageAt: new Date(),
          messageCount: sql`${schema.aiSessions.messageCount} + 1`,
        })
        .where(eq(schema.aiSessions.id, sessionId));
    } catch (error) {
      console.error('[AIRouter] Failed to update session:', error);
    }
  }

  /**
   * Get user's chat sessions
   */
  static async getUserSessions(userId: number, limit: number = 20) {
    const db = await getDb();
    if (!db) return [];

    try {
      const sessions = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.userId, userId))
        .orderBy(sql`${schema.aiSessions.lastMessageAt} DESC`)
        .limit(limit);

      return sessions;
    } catch (error) {
      console.error('[AIRouter] Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get usage statistics for a user
   */
  static async getUserStats(userId: number, days: number = 30) {
    const db = await getDb();
    if (!db) return { daily: [], totals: { requests: 0, tokens: 0, cost: 0, cached: 0 } };

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await db
        .select()
        .from(schema.aiUsageStats)
        .where(
          and(
            eq(schema.aiUsageStats.userId, userId),
            sql`${schema.aiUsageStats.date} >= ${startDate.toISOString().split('T')[0]}`
          )
        )
        .orderBy(sql`${schema.aiUsageStats.date} ASC`);

      const totals = stats.reduce(
        (acc, s) => ({
          requests: acc.requests + (s.totalRequests || 0),
          tokens: acc.tokens + (s.totalTokens || 0),
          cost: acc.cost + parseFloat(s.totalCost?.toString() || '0'),
          cached: acc.cached + (s.cachedRequests || 0),
        }),
        { requests: 0, tokens: 0, cost: 0, cached: 0 }
      );

      return { daily: stats, totals };
    } catch (error) {
      console.error('[AIRouter] Failed to get user stats:', error);
      return { daily: [], totals: { requests: 0, tokens: 0, cost: 0, cached: 0 } };
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    return AICache.getStats();
  }

  /**
   * Get available providers
   */
  static getProviders() {
    return getAvailableProviders();
  }
}

// Export convenience function
export const aiChat = AIRouter.chat.bind(AIRouter);
