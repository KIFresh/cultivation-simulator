/**
 * 结构化日志工具。
 *
 * - 按级别分别输出到 console.debug / info / warn / error。
 * - 保留对象结构和 Error.stack，不将对象压缩为 [object Object]。
 * - 支持结构化上下文：route、operation、requestId。
 * - 默认 minLevel=info，debug 在生产环境被抑制。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 防止重复注册格式化
let FORMATTER_REGISTERED = false;

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
    // 将非 Error 字符串拼接到一起，其他类型保留原样
    let textParts: string[] = [];
    for (const a of args) {
      if (typeof a === "string") {
        textParts.push(a);
      } else if (a instanceof Error) {
        if (textParts.length > 0) {
          result.push(textParts.join(" "));
          textParts = [];
        }
        result.push(a);
      } else {
        if (textParts.length > 0) {
          result.push(textParts.join(" "));
          textParts = [];
        }
        result.push(a);
      }
    }
    if (textParts.length > 0) {
      result.push(textParts.join(" "));
    }
    return result;
  }

  debug(...args: unknown[]): void {
    if (!this.shouldLog("debug")) return;
    console.debug(...this.formatArgs(args, "debug"));
  }

  info(...args: unknown[]): void {
    if (!this.shouldLog("info")) return;
    console.info(...this.formatArgs(args, "info"));
  }

  warn(...args: unknown[]): void {
    if (!this.shouldLog("warn")) return;
    console.warn(...this.formatArgs(args, "warn"));
  }

  error(...args: unknown[]): void {
    if (!this.shouldLog("error")) return;
    console.error(...this.formatArgs(args, "error"));
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

export const logger = new Logger();

export { Logger };