import { env } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[env.LOG_LEVEL];
}

function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog("debug")) process.stdout.write(formatMessage("debug", message, context) + "\n");
  },
  info: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog("info")) process.stdout.write(formatMessage("info", message, context) + "\n");
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog("warn")) process.stderr.write(formatMessage("warn", message, context) + "\n");
  },
  error: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog("error")) process.stderr.write(formatMessage("error", message, context) + "\n");
  },
};
