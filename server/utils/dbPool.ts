/**
 * Database connection pool with retry logic and graceful shutdown
 *
 * Provides:
 * - Connection pooling with configurable limits
 * - Automatic retry with exponential backoff
 * - Health check endpoint
 * - Graceful shutdown handling
 */

import mysql from "mysql2/promise";
import type { Pool, PoolConnection } from "mysql2/promise";
import { logger } from "./logger";

// Pool configuration
const POOL_CONFIG = {
  connectionLimit: 10,
  maxIdle: 5,
  idleTimeout: 60000, // 60 seconds
  queueLimit: 0, // No limit on queued connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000, // 30 seconds
  connectTimeout: 10000, // 10 seconds
  waitForConnections: true,
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

let pool: Pool | null = null;
let isShuttingDown = false;

/**
 * Initialize the database connection pool
 */
export async function initPool(): Promise<Pool | null> {
  if (pool) return pool;
  if (isShuttingDown) return null;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.db.warn("[Database] DATABASE_URL not set");
    return null;
  }

  try {
    // Parse DATABASE_URL to extract components
    const url = new URL(dbUrl);

    pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading /
      ...POOL_CONFIG,
    });

    // Test the connection
    const connection = await pool.getConnection();
    connection.release();

    logger.db.info("[Database] Connection pool initialized successfully");
    return pool;
  } catch (error) {
    logger.db.error("[Database] Failed to initialize pool:", error as Error);
    pool = null;
    return null;
  }
}

/**
 * Get the connection pool, initializing if necessary
 */
export async function getPool(): Promise<Pool | null> {
  if (isShuttingDown) return null;
  if (!pool) {
    return await initPool();
  }
  return pool;
}

/**
 * Execute a query with automatic retry on transient failures
 */
export async function executeWithRetry<T>(
  operation: (connection: PoolConnection) => Promise<T>,
  operationName: string = "database operation"
): Promise<T> {
  const currentPool = await getPool();
  if (!currentPool) {
    throw new Error("[Database] Pool not available");
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    let connection: PoolConnection | null = null;

    try {
      connection = await currentPool.getConnection();
      const result = await operation(connection);
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
        console.error(
          `[Database] ${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}):`,
          error.message
        );
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        RETRY_CONFIG.maxDelayMs
      );

      console.warn(
        `[Database] ${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}), ` +
        `retrying in ${Math.round(delay)}ms:`,
        error.message
      );

      await sleep(delay);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  throw lastError || new Error(`[Database] ${operationName} failed after ${RETRY_CONFIG.maxRetries} attempts`);
}

/**
 * Check if an error is retryable (transient)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  // MySQL error codes that are typically transient
  const retryableCodes = [
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "PROTOCOL_CONNECTION_LOST",
    "ER_LOCK_DEADLOCK",
    "ER_LOCK_WAIT_TIMEOUT",
    "ER_TOO_MANY_CONNECTIONS",
  ];

  const errorCode = error.code || error.errno;
  return retryableCodes.includes(errorCode);
}

/**
 * Health check for the database connection
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  poolStats?: {
    totalConnections: number;
    idleConnections: number;
    waitingRequests: number;
  };
}> {
  const startTime = Date.now();

  try {
    const currentPool = await getPool();
    if (!currentPool) {
      return { healthy: false, error: "Pool not initialized" };
    }

    // Execute a simple query to test connectivity
    const connection = await currentPool.getConnection();
    await connection.query("SELECT 1");
    connection.release();

    const latencyMs = Date.now() - startTime;

    // Get pool stats (mysql2 specific)
    const poolAny = currentPool as any;
    const poolStats = {
      totalConnections: poolAny.pool?._allConnections?.length ?? 0,
      idleConnections: poolAny.pool?._freeConnections?.length ?? 0,
      waitingRequests: poolAny.pool?._connectionQueue?.length ?? 0,
    };

    return { healthy: true, latencyMs, poolStats };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Gracefully shutdown the connection pool
 */
export async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.db.info("[Database] Initiating graceful shutdown...");

  if (pool) {
    try {
      await pool.end();
      logger.db.info("[Database] Connection pool closed successfully");
    } catch (error) {
      logger.db.error("[Database] Error closing pool:", error as Error);
    }
    pool = null;
  }
}

/**
 * Register shutdown handlers for graceful termination
 */
export function registerShutdownHandlers(): void {
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Database] Received ${signal}, initiating graceful shutdown...`);
    await shutdown();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    logger.db.error("[Database] Uncaught exception:", error);
    await shutdown();
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason) => {
    logger.db.error("[Database] Unhandled rejection:", reason instanceof Error ? reason : new Error(String(reason)));
    // Don't exit on unhandled rejection, just log
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats(): {
  isInitialized: boolean;
  isShuttingDown: boolean;
} {
  return {
    isInitialized: pool !== null,
    isShuttingDown,
  };
}
