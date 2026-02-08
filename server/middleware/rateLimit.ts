/**
 * In-memory rate limiting middleware
 *
 * For production, consider using Redis-based rate limiting for distributed deployments.
 * This implementation is suitable for single-server deployments.
 */

import { TRPCError } from "@trpc/server";

// Rate limit configurations by category
export const RATE_LIMIT_CONFIG = {
  // Default rate limit for most operations
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Слишком много запросов. Пожалуйста, подождите минуту.",
  },

  // AI operations (expensive)
  ai: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: "Превышен лимит AI запросов. Пожалуйста, подождите минуту.",
  },

  // Authentication operations (prevent brute force)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: "Слишком много попыток входа. Попробуйте через 15 минут.",
  },

  // Mutation operations (create, update, delete)
  mutation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: "Слишком много операций изменения. Пожалуйста, подождите.",
  },

  // Export operations (resource-intensive)
  export: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Слишком много запросов на экспорт. Пожалуйста, подождите.",
  },

  // Import operations (resource-intensive)
  import: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: "Слишком много запросов на импорт. Пожалуйста, подождите.",
  },
};

export type RateLimitCategory = keyof typeof RATE_LIMIT_CONFIG;

// In-memory store for rate limiting
// Maps: userId/ip -> category -> { count, windowStart }
const rateLimitStore = new Map<string, Map<string, { count: number; windowStart: number }>>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const storeEntries = Array.from(rateLimitStore.entries());
  for (const [key, categories] of storeEntries) {
    const categoryEntries = Array.from(categories.entries());
    for (const [category, data] of categoryEntries) {
      const config = RATE_LIMIT_CONFIG[category as RateLimitCategory];
      if (now - data.windowStart > config.windowMs) {
        categories.delete(category);
      }
    }
    if (categories.size === 0) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check and update rate limit for a user/IP
 * Returns true if request should be allowed, throws TRPCError if rate limited
 */
export function checkRateLimit(
  identifier: string,
  category: RateLimitCategory = "default"
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = RATE_LIMIT_CONFIG[category];
  const now = Date.now();

  // Get or create user's rate limit data
  let userLimits = rateLimitStore.get(identifier);
  if (!userLimits) {
    userLimits = new Map();
    rateLimitStore.set(identifier, userLimits);
  }

  // Get or create category data
  let categoryData = userLimits.get(category);

  // Check if window has expired
  if (!categoryData || now - categoryData.windowStart > config.windowMs) {
    categoryData = { count: 0, windowStart: now };
    userLimits.set(category, categoryData);
  }

  // Check rate limit
  const remaining = config.maxRequests - categoryData.count - 1;
  const resetAt = categoryData.windowStart + config.windowMs;

  if (categoryData.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment counter
  categoryData.count++;

  return { allowed: true, remaining: Math.max(0, remaining), resetAt };
}

/**
 * Rate limit middleware for tRPC
 * Use this as a middleware in tRPC procedures
 */
export function createRateLimitMiddleware(category: RateLimitCategory = "default") {
  return async ({ ctx, next }: { ctx: { user?: { id: number } | null }; next: () => Promise<any> }) => {
    // Use user ID if authenticated, otherwise fall back to a generic key
    const identifier = ctx.user?.id ? `user:${ctx.user.id}` : "anonymous";

    const result = checkRateLimit(identifier, category);

    if (!result.allowed) {
      const config = RATE_LIMIT_CONFIG[category];
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: config.message,
      });
    }

    return next();
  };
}

/**
 * Helper to determine rate limit category based on procedure name
 */
export function getCategoryForProcedure(procedureName: string): RateLimitCategory {
  // AI-related procedures
  if (
    procedureName.includes("ai") ||
    procedureName.includes("chat") ||
    procedureName.includes("generate") ||
    procedureName.includes("analyze")
  ) {
    return "ai";
  }

  // Auth-related procedures
  if (procedureName.includes("auth") || procedureName.includes("login") || procedureName.includes("register")) {
    return "auth";
  }

  // Export procedures
  if (procedureName.includes("export")) {
    return "export";
  }

  // Import procedures
  if (procedureName.includes("import")) {
    return "import";
  }

  // Mutation procedures (create, update, delete)
  if (
    procedureName.includes("create") ||
    procedureName.includes("update") ||
    procedureName.includes("delete") ||
    procedureName.includes("remove") ||
    procedureName.includes("add") ||
    procedureName.includes("set")
  ) {
    return "mutation";
  }

  return "default";
}

/**
 * Express middleware for rate limiting non-tRPC routes
 */
export function expressRateLimitMiddleware(category: RateLimitCategory = "default") {
  return (req: any, res: any, next: any) => {
    // Use user ID from session if available, otherwise use IP
    const userId = req.user?.id;
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    const result = checkRateLimit(identifier, category);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_CONFIG[category].maxRequests);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      const config = RATE_LIMIT_CONFIG[category];
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        error: config.message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      });
    }

    next();
  };
}

/**
 * Reset rate limit for a specific user (useful for admin operations)
 */
export function resetRateLimit(identifier: string, category?: RateLimitCategory): void {
  if (category) {
    const userLimits = rateLimitStore.get(identifier);
    if (userLimits) {
      userLimits.delete(category);
    }
  } else {
    rateLimitStore.delete(identifier);
  }
}

/**
 * Get current rate limit stats (for monitoring/debugging)
 */
export function getRateLimitStats(): { totalUsers: number; totalEntries: number } {
  let totalEntries = 0;
  const storeValues = Array.from(rateLimitStore.values());
  for (const categories of storeValues) {
    totalEntries += categories.size;
  }
  return {
    totalUsers: rateLimitStore.size,
    totalEntries,
  };
}
