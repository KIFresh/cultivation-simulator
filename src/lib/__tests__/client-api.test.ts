import { describe, it, expect } from "vitest";
import { safeFetch, fetchWithTimeout, isError } from "@/lib/client-api";

describe("safeFetch", () => {
  it("网络错误返回 NETWORK_ERROR", async () => {
    // 一个不存在的域名
    const result = await safeFetch("http://192.0.2.1:9999/nonexistent", {
      signal: AbortSignal.timeout(100),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NETWORK_ERROR");
    }
  });
});

describe("fetchWithTimeout", () => {
  it("超时返回 NETWORK_ERROR", async () => {
    // 使用一个会挂起的请求
    const controller = new AbortController();
    const result = await fetchWithTimeout("http://192.0.2.1:9999/slow", {
      timeoutMs: 50,
      signal: controller.signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NETWORK_ERROR");
    }
  });
});

describe("isError", () => {
  it("正确判断错误结果", () => {
    const errResult = { ok: false as const, status: 500, code: "INTERNAL", message: "error" };
    expect(isError(errResult)).toBe(true);
  });
});
