import { isProd } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (isProd && level === "debug") return;
  const timestamp = new Date().toISOString();
  const payload = context ? [`[${timestamp}] ${message}`, context] : [`[${timestamp}] ${message}`];
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(...payload);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(...payload);
  } else if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(...payload);
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
