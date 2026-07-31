import { describe, it, expect } from "vitest";
import { safeFetch, fetchWithTimeout, isError } from "@/lib/client-api";
import { vi } from "vitest";

describe("safeFetch", () => {
  it("返回错误时不暴露原始响应或异常", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "失败", code: "INTERNAL", requestId: "req-123" }), {
        status: 500,
        headers: { "x-request-id": "req-123" },
      })
    ));
    const result = await safeFetch("/api/test");
    expect(result).toEqual({ ok: false, status: 500, code: "HTTP_500", message: "服务器内部错误，请稍后重试", requestId: "req-123" });
    vi.unstubAllGlobals();
  });

  it("未知服务端错误不直接展示响应文本", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "数据库密码 secret=bad", code: "UNKNOWN" }), { status: 500 })
    ));
    const result = await safeFetch("/api/test");
    expect(result).toMatchObject({ code: "HTTP_500", message: "服务器内部错误，请稍后重试" });
    vi.unstubAllGlobals();
  });

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
