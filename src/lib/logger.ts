/**
 * 结构化日志工具。
 * 日志只保留可排查的上下文，并在输出前递归脱敏。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEY = /(?:authorization|cookie|set-cookie|api[-_]?key|token|secret|password|credential|request[-_]?body|body)/i;
const SENSITIVE_VALUE = /(api[-_]?key|authorization|token|secret|password)(\s*[:=]\s*(?:bearer\s+)?)?[^\s,;]+/gi;
const BEARER_VALUE = /(bearer\s+)[^\s,;]+/gi;
const REDACTED = "[REDACTED]";

export function redactString(value: string): string {
  return value
    .replace(SENSITIVE_VALUE, (_match, key: string, separator = "") => `${key}${separator}${REDACTED}`)
    .replace(BEARER_VALUE, (_match, prefix: string) => `${prefix}${REDACTED}`);
}

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    const safe = new Error(redactString(value.message));
    safe.name = value.name;
    if (value.stack) safe.stack = redactString(value.stack);
    return safe;
  }
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactLogValue(entry, seen);
    }
    return output;
  }
  return value;
}

class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private formatArgs(args: unknown[], prefix?: string): unknown[] {
    const result: unknown[] = [];
    if (prefix) result.push(`[${prefix.toUpperCase()}]`);
    let textParts: string[] = [];
    for (const arg of args) {
      if (typeof arg === "string") {
        textParts.push(redactString(arg));
      } else {
        if (textParts.length > 0) {
          result.push(textParts.join(" "));
          textParts = [];
        }
        result.push(redactLogValue(arg));
      }
    }
    if (textParts.length > 0) result.push(textParts.join(" "));
    return result;
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) console.debug(...this.formatArgs(args, "debug"));
  }

  info(...args: unknown[]): void {
    if (this.shouldLog("info")) console.info(...this.formatArgs(args, "info"));
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) console.warn(...this.formatArgs(args, "warn"));
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) console.error(...this.formatArgs(args, "error"));
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

export const logger = new Logger();
export { Logger };
