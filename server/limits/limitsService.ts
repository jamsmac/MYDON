import { getDb } from '../db';
import { users, projects, aiUsageTracking } from '../../drizzle/schema';
import { eq, and, count } from 'drizzle-orm';
import { getPlanLimits, isUnlimited, PlanLimits } from './config';
import { TRPCError } from '@trpc/server';

export interface UsageStats {
  projectCount: number;
  projectLimit: number;
  aiRequestsToday: number;
  aiRequestsLimit: number;
  plan: string;
  limits: PlanLimits;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getUserUsageStats(userId: number): Promise<UsageStats> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
  }

  // Get user's subscription plan
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];
  
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
  }

  const plan = user.subscriptionPlan || 'free';
  const limits = getPlanLimits(plan);

  // Count user's projects
  const projectCountResult = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.userId, userId));
  const projectCount = projectCountResult[0]?.count || 0;

  // Get today's AI usage
  const today = getTodayDate();
  const usageResult = await db
    .select()
    .from(aiUsageTracking)
    .where(and(
      eq(aiUsageTracking.userId, userId),
      eq(aiUsageTracking.date, today)
    ))
    .limit(1);
  const aiRequestsToday = usageResult[0]?.requestCount || 0;

  return {
    projectCount,
    projectLimit: limits.maxProjects,
    aiRequestsToday,
    aiRequestsLimit: limits.maxAiRequestsPerDay,
    plan,
    limits,
  };
}

export async function checkProjectLimit(userId: number): Promise<{ allowed: boolean; message?: string }> {
  const stats = await getUserUsageStats(userId);
  
  if (isUnlimited(stats.projectLimit)) {
    return { allowed: true };
  }

  if (stats.projectCount >= stats.projectLimit) {
    return {
      allowed: false,
      message: `Достигнут лимит проектов (${stats.projectLimit}). Перейдите на платный план для создания большего количества проектов.`,
    };
  }

  return { allowed: true };
}

export async function checkAiRequestLimit(userId: number): Promise<{ allowed: boolean; message?: string; remaining?: number }> {
  const stats = await getUserUsageStats(userId);
  
  if (isUnlimited(stats.aiRequestsLimit)) {
    return { allowed: true, remaining: -1 };
  }

  const remaining = stats.aiRequestsLimit - stats.aiRequestsToday;
  
  if (remaining <= 0) {
    return {
      allowed: false,
      message: `Достигнут дневной лимит AI запросов (${stats.aiRequestsLimit}). Перейдите на платный план для безлимитного использования AI.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

export async function incrementAiUsage(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = getTodayDate();
  
  // Try to update existing record
  const existingResult = await db
    .select()
    .from(aiUsageTracking)
    .where(and(
      eq(aiUsageTracking.userId, userId),
      eq(aiUsageTracking.date, today)
    ))
    .limit(1);

  if (existingResult[0]) {
    // Update existing record
    await db
      .update(aiUsageTracking)
      .set({ requestCount: existingResult[0].requestCount + 1 })
      .where(eq(aiUsageTracking.id, existingResult[0].id));
  } else {
    // Create new record
    await db.insert(aiUsageTracking).values({
      userId,
      date: today,
      requestCount: 1,
    });
  }
}

export async function checkFeatureAccess(userId: number, feature: keyof PlanLimits): Promise<boolean> {
  const stats = await getUserUsageStats(userId);
  const value = stats.limits[feature];
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  return true;
}
