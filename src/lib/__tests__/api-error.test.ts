import { describe, it, expect } from "vitest";
import {
  AppError,
  ErrorCode,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  serviceUnavailable,
  parseJsonBody,
  toApiErrorResponse,
  withApiErrorHandling,
} from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";

describe("AppError", () => {
  it("创建基本错误", () => {
    const err = new AppError({
      code: ErrorCode.NOT_FOUND,
      message: "资源不存在",
    });
    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.message).toBe("资源不存在");
    expect(err.cause).toBeUndefined();
  });

  it("toJSON 只返回安全字段", () => {
    const err = new AppError({
      code: ErrorCode.INVALID_JSON,
      message: "请求体格式错误",
      cause: new Error("原始错误"),
      context: { userId: "secret123" },
    });
    const json = err.toJSON();
    expect(json).toEqual({ error: "请求体格式错误", code: "INVALID_JSON" });
    expect((json as any).cause).toBeUndefined();
    expect((json as any).context).toBeUndefined();
  });

  it("自定义 status 覆盖默认值", () => {
    const err = new AppError({
      code: ErrorCode.INVALID_PARAM,
      message: "参数错误",
      status: 422,
    });
    expect(err.status).toBe(422);
  });
});

describe("错误工厂函数", () => {
  it("badRequest 默认状态码 400", () => {
    const err = badRequest();
    expect(err.status).toBe(400);
    expect(err.code).toBe("INVALID_PARAM");
  });

  it("badRequest 支持自定义 code", () => {
    const err = badRequest("缺少字段", ErrorCode.MISSING_FIELD);
    expect(err.status).toBe(400);
    expect(err.code).toBe("MISSING_FIELD");
  });

  it("unauthorized 状态码 401", () => {
    const err = unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("AUTH_REQUIRED");
  });

  it("notFound 状态码 404", () => {
    const err = notFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("conflict 状态码 409", () => {
    const err = conflict();
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("serviceUnavailable 状态码 503", () => {
    const err = serviceUnavailable();
    expect(err.status).toBe(503);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("parseJsonBody", () => {
  it("解析有效 JSON 对象", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
      headers: { "content-type": "application/json" },
    });
    const body = await parseJsonBody(req);
    expect(body).toEqual({ name: "test" });
  });

  it("空 body 抛出 INVALID_JSON", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: null,
    });
    await expect(parseJsonBody(req)).rejects.toThrow(AppError);
    await expect(parseJsonBody(req)).rejects.toMatchObject({
      code: "INVALID_JSON",
      status: 400,
    });
  });

  it("数组 body 抛出 INVALID_JSON", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify([1, 2, 3]),
      headers: { "content-type": "application/json" },
    });
    await expect(parseJsonBody(req)).rejects.toMatchObject({
      code: "INVALID_JSON",
    });
  });

  it("畸形 JSON 抛出 INVALID_JSON", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    await expect(parseJsonBody(req)).rejects.toMatchObject({
      code: "INVALID_JSON",
    });
  });
});

describe("toApiErrorResponse", () => {
  it("AppError 返回对应状态码和 JSON", async () => {
    const err = unauthorized("请先登录");
    const res = toApiErrorResponse(err);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "请先登录", code: "AUTH_REQUIRED" });
  });

  it("未知异常脱敏为通用 500 并返回 requestId", async () => {
    const res = toApiErrorResponse(new Error("数据库连接失败"), "req-123");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("req-123");
    const body = await res.json();
    expect(body).toEqual({ error: "服务器内部错误，请稍后重试", code: "INTERNAL", requestId: "req-123" });
  });

  it("字符串异常处理", async () => {
    const res = toApiErrorResponse("some string error");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL");
  });

  it("包装器注入 requestId 并记录完成响应", async () => {
    const handler = async () => NextResponse.json({ ok: true });
    const wrapped = withApiErrorHandling(handler);
    const res = await wrapped(new NextRequest("http://localhost/api/test"), { params: Promise.resolve({}) });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});
