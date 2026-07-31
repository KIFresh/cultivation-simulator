import { describe, it, expect, vi } from "vitest";
import { Logger, logger, redactLogValue, redactString } from "@/lib/logger";

describe("Logger", () => {
  const log = new Logger("debug");

  it("将 Error 转为可序列化对象并保留堆栈", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("test error");
    log.error(error);
    const args = spy.mock.calls[0];
    const safe = args.find((a) => typeof a === "object" && a !== null) as Record<string, unknown>;
    expect(safe).toMatchObject({ name: "Error", message: "test error" });
    expect(safe.stack).toContain("Error: test error");
    expect(JSON.stringify(args)).toContain("test error");
    spy.mockRestore();
  });

  it("保留自定义 Error 诊断字段并脱敏", () => {
    const error = new Error("ALL_PROVIDERS_FAILED") as Error & { failures?: unknown; apiKey?: string };
    error.failures = [{ provider: "openai", code: "EMPTY_RESPONSE" }];
    error.apiKey = "secret-key";
    const safe = redactLogValue(error) as Record<string, unknown>;
    expect(safe.failures).toEqual([{ provider: "openai", code: "EMPTY_RESPONSE" }]);
    expect(safe.apiKey).toBe("[REDACTED]");
  });

  it("保留 cause 并处理 Error 循环引用", () => {
    const cause = new Error("root cause");
    const error = new Error("wrapper", { cause }) as Error & { self?: unknown };
    error.self = error;
    const safe = redactLogValue(error) as Record<string, any>;
    expect(safe.cause).toMatchObject({ name: "Error", message: "root cause" });
    expect(safe.self).toBe("[Circular]");
  });

  it("处理数组循环并保留重复引用", () => {
    const shared = { code: "EMPTY_RESPONSE" };
    const values: unknown[] = [shared, shared];
    values.push(values);
    const safe = redactLogValue(values) as unknown[];
    expect(safe[0]).toEqual({ code: "EMPTY_RESPONSE" });
    expect(safe[1]).toEqual({ code: "EMPTY_RESPONSE" });
    expect(safe[2]).toBe("[Circular]");
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
    expect(redactString('{"apiKey":"secret","nested":{"token":"value"}}')).toBe(
      '{"apiKey":"[REDACTED]","nested":{"token":"[REDACTED]"}}'
    );
  });

  it("脱敏 Error 的 message 和 stack", () => {
    const error = new Error("apiKey=secret");
    const safe = redactLogValue(error) as Error;
    expect(safe.message).toBe("apiKey=[REDACTED]");
    expect(safe.stack).not.toContain("apiKey=secret");
  });

  it("脱敏 Error 名称", () => {
    const error = new Error("failure");
    error.name = "apiKey=secret";
    const safe = redactLogValue(error) as Record<string, unknown>;
    expect(safe.name).toBe("apiKey=[REDACTED]");
  });

  it("warn 使用 console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("test warning");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
