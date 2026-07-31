import { describe, it, expect, vi } from "vitest";
import { Logger, logger, redactLogValue, redactString } from "@/lib/logger";

describe("Logger", () => {
  const log = new Logger("debug");

  it("保留 Error 对象结构", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error(new Error("test error"));
    const args = spy.mock.calls[0];
    expect(args.some((a) => a instanceof Error)).toBe(true);
    spy.mockRestore();
  });

  it("保留对象结构", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    log.info("test", { key: "value" });
    const args = spy.mock.calls[0];
    expect(args.some((a) => typeof a === "object" && a !== null)).toBe(true);
    spy.mockRestore();
  });

  it("debug 级别不输出到 info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.setMinLevel("error");
    logger.info("should not be logged");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    logger.setMinLevel("info");
  });

  it("脱敏敏感字段和 Authorization 字符串", () => {
    const safeText = redactString("Authorization: Bearer secret-token token=abc secret=def password=pw");
    expect(safeText).toContain("[REDACTED]");
    expect(safeText).not.toContain("secret-token");
    expect(safeText).not.toContain("abc");
    expect(safeText).not.toContain("def");
    expect(safeText).not.toContain("pw");
    expect(redactLogValue({ apiKey: "secret", nested: { password: "pw" } })).toEqual({
      apiKey: "[REDACTED]",
      nested: { password: "[REDACTED]" },
    });
  });

  it("脱敏 Error 的 message 和 stack", () => {
    const error = new Error("apiKey=secret");
    const safe = redactLogValue(error) as Error;
    expect(safe.message).toBe("apiKey=[REDACTED]");
    expect(safe.stack).not.toContain("apiKey=secret");
  });

  it("warn 使用 console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("test warning");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
