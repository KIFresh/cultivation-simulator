// 轻量日志工具：统一前缀、按最低级别过滤。
// 服务端/客户端通用；默认 minLevel=info，debug 在生产环境被抑制。

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = "info") {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private format(level: LogLevel, args: unknown[]): string {
    const body = args
      .map((a) => (typeof a === "string" ? a : String(a)))
      .join(" ");
    return `[${level}] ${body}`;
  }

  private emit(level: LogLevel, args: unknown[]): void {
    if (!this.shouldLog(level)) return;
    // eslint-disable-next-line no-console
    console.log(this.format(level, args));
  }

  debug(...args: unknown[]): void {
    this.emit("debug", args);
  }

  info(...args: unknown[]): void {
    this.emit("info", args);
  }

  warn(...args: unknown[]): void {
    this.emit("warn", args);
  }

  error(...args: unknown[]): void {
    this.emit("error", args);
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

export const logger = new Logger();

export { Logger };
