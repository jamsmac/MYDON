import crypto from 'crypto';
import { getDb } from '../db';
import * as schema from '../../drizzle/schema';
import { eq, lt, desc } from 'drizzle-orm';
import { logger } from './logger';

const TTL_MAP = {
  reasoning: 7 * 24 * 60 * 60 * 1000,
  coding: 7 * 24 * 60 * 60 * 1000,
  vision: 24 * 60 * 60 * 1000,
  chat: 1 * 60 * 60 * 1000,
  translation: 3 * 24 * 60 * 60 * 1000,
  default: 3 * 60 * 60 * 1000,
};

export class AICache {
  static generateKey(prompt: string, taskType: string): string {
    const normalized = `${prompt.trim().toLowerCase()}:${taskType}`;
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  static async get(cacheKey: string) {
    const db = await getDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(schema.aiCache)
      .where(eq(schema.aiCache.cacheKey, cacheKey))
      .limit(1);

    if (results.length === 0) return null;

    const entry = results[0];

    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      await this.delete(cacheKey);
      return null;
    }

    await db
      .update(schema.aiCache)
      .set({ hitCount: (entry.hitCount || 0) + 1 })
      .where(eq(schema.aiCache.cacheKey, cacheKey));

    return entry;
  }

  static async set(cacheKey: string, data: {
    prompt: string;
    response: string;
    model: string;
    taskType?: string;
    tokens?: number;
    cost?: number;
  }) {
    const db = await getDb();
    if (!db) return;

    const ttl = TTL_MAP[data.taskType as keyof typeof TTL_MAP] || TTL_MAP.default;
    const expiresAt = new Date(Date.now() + ttl);

    await db.insert(schema.aiCache).values({
      cacheKey,
      prompt: data.prompt,
      response: data.response,
      model: data.model,
      taskType: data.taskType || 'chat',
      tokens: data.tokens || null,
      cost: data.cost?.toString() || null,
      expiresAt,
      hitCount: 0,
    });
  }

  static async delete(cacheKey: string) {
    const db = await getDb();
    if (!db) return;

    await db.delete(schema.aiCache).where(eq(schema.aiCache.cacheKey, cacheKey));
  }

  static async cleanup(): Promise<number> {
    try {
      const db = await getDb();
      if (!db) return 0;

      const result = await db.delete(schema.aiCache).where(lt(schema.aiCache.expiresAt, new Date()));
      return (result as any).rowsAffected || 0;
    } catch (error: any) {
      // Table might not exist yet - ignore gracefully
      if (error?.cause?.code === 'ER_NO_SUCH_TABLE') {
        return 0;
      }
      logger.ai.warn("AI Cache cleanup failed", { error: error.message });
      return 0;
    }
  }

  static async getStats() {
    const db = await getDb();
    if (!db) return { totalEntries: 0, totalHits: 0, avgHitsPerEntry: '0', cacheSize: '0 KB' };

    const entries = await db.select().from(schema.aiCache);
    const totalEntries = entries.length;
    const totalHits = entries.reduce((sum: number, e: { hitCount: number | null }) => sum + (e.hitCount || 0), 0);
    const avgHitsPerEntry = totalEntries ? (totalHits / totalEntries).toFixed(1) : '0';
    const totalChars = entries.reduce((sum: number, e: { prompt: string | null; response: string | null }) => sum + (e.prompt?.length || 0) + (e.response?.length || 0), 0);
    const cacheSize = `${(totalChars / 1024).toFixed(2)} KB`;

    return { totalEntries, totalHits, avgHitsPerEntry, cacheSize };
  }

  static async getSessionContext(sessionId: string, limit: number = 10) {
    const db = await getDb();
    if (!db) return [];

    const messages = await db
      .select()
      .from(schema.aiRequests)
      .where(eq(schema.aiRequests.sessionId, sessionId))
      .orderBy(desc(schema.aiRequests.createdAt))
      .limit(limit);

    return messages.reverse().flatMap((m: { prompt: string | null; response: string | null }) => [
      { role: 'user' as const, content: m.prompt },
      { role: 'assistant' as const, content: m.response },
    ]);
  }
}

// Auto-cleanup expired cache entries every hour
if (process.env.AI_CACHE_ENABLED !== 'false') {
  setInterval(async () => {
    try {
      const deleted = await AICache.cleanup();
      if (deleted > 0) logger.ai.info("AI Cache cleanup", { deleted });
    } catch (error: any) {
      // Ignore cleanup errors - don't crash the server
      logger.ai.warn("AI Cache cleanup interval error", { error: error.message });
    }
  }, 60 * 60 * 1000);
}
