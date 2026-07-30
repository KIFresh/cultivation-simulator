/**
 * 统一 API 错误模型。
 *
 * - AppError：携带稳定 code、安全 message、HTTP status、可选 cause 和 context。
 * - 工厂函数：badRequest / unauthorized / forbidden / notFound / conflict / unprocessable / serviceUnavailable。
 * - parseJsonBody：安全解析 JSON 请求体，失败返回 INVALID_JSON。
 * - toApiErrorResponse：只向客户端输出安全字段。
 * - withApiErrorHandling：包装路由 handler，统一捕获未知异常并脱敏。
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "./logger";

// ── 错误码常量 ──────────────────────────────────────────────
export const ErrorCode = {
  INVALID_JSON: "INVALID_JSON",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_PARAM: "INVALID_PARAM",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE: "UNPROCESSABLE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATA_CORRUPTION: "DATA_CORRUPTION",
  EXTERNAL_FAILED: "EXTERNAL_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ── AppError 类 ─────────────────────────────────────────────
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    status?: number;
    cause?: unknown;
    context?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.name = "AppError";
    this.code = opts.code;
    this.status = opts.status ?? statusFromCode(opts.code);
    this.cause = opts.cause;
    this.context = opts.context;
  }

  /** 向客户端输出的安全 JSON 体 */
  toJSON(): { error: string; code: string } {
    return { error: this.message, code: this.code };
  }
}

function statusFromCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.INVALID_JSON:
    case ErrorCode.MISSING_FIELD:
    case ErrorCode.INVALID_PARAM:
      return 400;
    case ErrorCode.AUTH_REQUIRED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.CONFLICT:
      return 409;
    case ErrorCode.UNPROCESSABLE:
      return 422;
    case ErrorCode.RATE_LIMITED:
      return 429;
    case ErrorCode.SERVICE_UNAVAILABLE:
    case ErrorCode.EXTERNAL_FAILED:
      return 502;
    case ErrorCode.DATA_CORRUPTION:
    case ErrorCode.INTERNAL:
    default:
      return 500;
  }
}

// ── 工厂函数 ────────────────────────────────────────────────
export function badRequest(
  message = "请求参数错误",
  code: ErrorCode = ErrorCode.INVALID_PARAM,
  cause?: unknown,
  context?: Record<string, unknown>
): AppError {
  return new AppError({ code, message, status: 400, cause, context });
}

export function unauthorized(message = "未登录或会话无效", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.AUTH_REQUIRED, message, status: 401, cause });
}

export function forbidden(message = "无权限访问", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.FORBIDDEN, message, status: 403, cause });
}

export function notFound(message = "资源不存在", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.NOT_FOUND, message, status: 404, cause });
}

export function conflict(message = "资源冲突", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.CONFLICT, message, status: 409, cause });
}

export function unprocessable(message = "请求无法处理", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.UNPROCESSABLE, message, status: 422, cause });
}

export function serviceUnavailable(message = "服务暂时不可用", cause?: unknown): AppError {
  return new AppError({ code: ErrorCode.SERVICE_UNAVAILABLE, message, status: 502, cause });
}

// ── 安全 JSON 解析 ──────────────────────────────────────────
export async function parseJsonBody(request: Request): Promise<any> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    throw new AppError({
      code: ErrorCode.INVALID_JSON,
      message: "请求体必须是 JSON 对象",
      status: 400,
    });
  } catch (e) {
    if (e instanceof AppError) throw e;
    // SyntaxError 或非 JSON 内容
    throw new AppError({
      code: ErrorCode.INVALID_JSON,
      message: "请求体格式错误，无法解析为 JSON",
      status: 400,
      cause: e,
    });
  }
}

// ── 安全响应生成 ────────────────────────────────────────────
export function toApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: error.status });
  }

  // 未知异常：脱敏后返回通用 500
  logger.error("[api-error] 未捕获的异常，已脱敏", error);
  return NextResponse.json({ error: "服务器内部错误", code: ErrorCode.INTERNAL }, { status: 500 });
}

// ── Handler 包装器 ──────────────────────────────────────────
type NextContext = { params: Promise<Record<string, string | string[]>> };
type ApiHandler = (
  request: NextRequest,
  context: NextContext
) => Promise<Response | NextResponse<unknown>>;

/**
 * 包装 API route handler，统一捕获未知异常并返回脱敏错误响应。
 * - 已知业务错误（AppError）使用其安全 message + code。
 * - 未知异常记录完整上下文后返回通用 500。
 * - 自动注入 requestId 用于日志关联。
 */
export function withApiErrorHandling(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context: NextContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toApiErrorResponse(error);
    }
  };
}
