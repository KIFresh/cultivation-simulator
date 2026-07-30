import { describe, it, expect, vi } from "vitest";
import { Logger, logger } from "@/lib/logger";

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

  it("warn 使用 console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    log.warn("test warning");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
