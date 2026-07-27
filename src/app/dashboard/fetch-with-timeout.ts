/**
 * 带超时的 fetch，默认 60 秒后中断，防止 AI 阻塞导致按钮永久禁用
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
