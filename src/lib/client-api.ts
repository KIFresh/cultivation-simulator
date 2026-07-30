/**
 * 客户端安全请求工具。
 *
 * - 统一处理网络错误、超时、非 JSON 响应、res.ok === false 的标准错误体。
 * - 返回安全的默认用户提示与可供调用方判断的 code/status。
 * - fetchWithTimeout 保留调用者传入的 init.signal，使用组合 signal。
 */

// ── 统一错误类型 ────────────────────────────────────────────
export interface ApiClientError {
  ok: false;
  status: number;
  code: string;
  message: string;
  raw?: unknown;
}

export interface ApiClientSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export type ApiClientResult<T> = ApiClientSuccess<T> | ApiClientError;

/** 安全的默认用户提示映射 */
function defaultMessage(status: number, code?: string): string {
  if (status === 401) return "未登录或会话已过期，请重新登录";
  if (status === 403) return "无权限执行此操作";
  if (status === 404) return "请求的资源不存在";
  if (status === 409) return "操作冲突，请刷新后重试";
  if (status === 422) return "请求数据不合法";
  if (status === 429) return "操作过于频繁，请稍后重试";
  if (status >= 500) return "服务器内部错误，请稍后重试";
  return "请求失败，请检查网络连接";
}

// ── 安全 fetch ──────────────────────────────────────────────
/**
 * 安全 fetch，返回统一结果类型。
 * 网络错误、超时、非 JSON 响应、业务错误均被捕获。
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<ApiClientResult<T>> {
  try {
    const res = await fetch(url, init);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const body = (data as Record<string, unknown>) ?? {};
      const code = (body.code as string) || "";
      const message = (body.error as string) || defaultMessage(res.status, code);
      return {
        ok: false,
        status: res.status,
        code: code || `HTTP_${res.status}`,
        message,
        raw: data,
      };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (error) {
    // 网络错误、AbortError、超时
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "请求被取消"
        : "网络连接失败，请检查网络";
    return {
      ok: false,
      status: 0,
      code: "NETWORK_ERROR",
      message,
      raw: error,
    };
  }
}

// ── 带超时的 fetch ─────────────────────────────────────────
/**
 * 带超时的 fetch。保留调用者传入的 init.signal（组合信号）。
 * timeoutMs 默认 15 秒，传 0 禁用超时。
 */
export async function fetchWithTimeout<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<ApiClientResult<T>> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  if (timeoutMs <= 0 || typeof AbortSignal.timeout !== "function") {
    return safeFetch<T>(url, init);
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const userSignal = init?.signal;

  // 组合信号：用户取消或超时任一触发则中止
  const combinedSignal = userSignal
    ? AbortSignal.any([timeoutSignal, userSignal])
    : timeoutSignal;

  try {
    return await safeFetch<T>(url, { ...init, signal: combinedSignal });
  } finally {
    // 不清理，AbortSignal 自动管理
  }
}

// ── 辅助函数 ────────────────────────────────────────────────
/** 判断结果是否为错误 */
export function isError<T>(result: ApiClientResult<T>): result is ApiClientError {
  return !result.ok;
}

/** 从结果中提取错误信息，或返回默认提示 */
export function getErrorMessage(result: ApiClientError, fallback?: string): string {
  return result.message || fallback || defaultMessage(result.status, result.code);
}