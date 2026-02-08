/**
 * Lightweight structured logging utility
 *
 * Provides:
 * - Log levels (debug, info, warn, error)
 * - Contextual logging with module names
 * - Environment-based log filtering
 * - Structured JSON output for production
 */

// Log levels in order of severity
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// Map string log levels to enum
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.SILENT,
};

// Get log level from environment
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_MAP) {
    return LOG_LEVEL_MAP[envLevel];
  }
  // Default: DEBUG in development, INFO in production
  return process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
}

const currentLogLevel = getLogLevel();
const isProduction = process.env.NODE_ENV === "production";

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Format log entry for output
function formatLogEntry(entry: LogEntry): string {
  if (isProduction) {
    // JSON output for production (easy to parse by log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable output for development
  const { timestamp, level, module, message, data, error } = entry;
  let output = `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;

  if (data && Object.keys(data).length > 0) {
    output += ` ${JSON.stringify(data)}`;
  }

  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack && !isProduction) {
      output += `\n  Stack: ${error.stack}`;
    }
  }

  return output;
}

// Create a log entry
function createLogEntry(
  level: string,
  module: string,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };

  if (data) {
    entry.data = data;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }

  return entry;
}

// Logger class
class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error) {
    if (level < currentLogLevel) return;

    const levelName = LogLevel[level].toLowerCase();
    const entry = createLogEntry(levelName, this.module, message, data, error);
    const formatted = formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>, error?: Error) {
    this.log(LogLevel.WARN, message, data, error);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, data, error);
  }

  // Create a child logger with additional context
  child(subModule: string): Logger {
    return new Logger(`${this.module}:${subModule}`);
  }
}

// Factory function to create loggers
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Pre-configured loggers for common modules
export const logger = {
  // Core modules
  db: createLogger("Database"),
  auth: createLogger("Auth"),
  api: createLogger("API"),
  trpc: createLogger("tRPC"),

  // Feature modules
  ai: createLogger("AI"),
  skill: createLogger("Skill"),
  socket: createLogger("Socket"),
  stripe: createLogger("Stripe"),
  export: createLogger("Export"),
  import: createLogger("Import"),
  webhook: createLogger("Webhook"),
  notifications: createLogger("Notifications"),
  openclaw: createLogger("OpenClaw"),
  cron: createLogger("Cron"),
  memory: createLogger("Memory"),

  // Create custom logger
  create: createLogger,
};

// Default export for simple usage
export default logger;

// Type exports
export type { Logger };
