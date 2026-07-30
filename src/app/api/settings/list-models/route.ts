import { NextRequest, NextResponse } from "next/server";
import { apiError, isPrivateOrLocalUrl, requireAdminKey } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function handler(request: NextRequest) {
  if (!requireAdminKey(request.headers.get("x-admin-key"))) {
    return apiError("管理员密钥无效", 401, "ADMIN_REQUIRED");
  }
  const body = await parseJsonBody(request);
  const { baseUrl, apiKey, type } = body;

  if (!type) {
    return apiError("缺少供应方类型");
  }

  // 管理员已鉴权，允许查询本地/内网模型服务（如 localhost）
  // if (isPrivateOrLocalUrl(baseUrl)) {
  //   return apiError("接口地址不能指向本机或内网地址");
  // }
  try {
    const protocol = new URL(baseUrl).protocol;
    if (protocol !== "https:" && protocol !== "http:") return apiError("接口地址必须使用 HTTP 或 HTTPS");
  } catch {
    return apiError("接口地址格式不正确");
  }

  if (type === "ollama") {
    if (!baseUrl) {
      return apiError("Ollama 需要填写接口地址");
    }
    const normalized = baseUrl.replace(/\/+$/, "");
    const url = new URL(`${normalized}/api/tags`);
    const resp = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      return NextResponse.json({ error: "Ollama 返回错误" }, { status: 502 });
    }
    const data = await resp.json();
    const models: string[] = (data.models || []).map((m: { name: string }) => m.name);
    if (models.length === 0) {
      return NextResponse.json({ models: [], warning: "该接口未返回模型列表" });
    }
    return NextResponse.json({ models });
  }

  // OpenAI-compatible（包括 Anthropic 兼容接口等）
  if (!baseUrl) {
    return apiError("请填写接口地址");
  }
  if (!apiKey) {
    return apiError("请填写 API Key");
  }

  // 检查是否是 Anthropic 原生 API
  if (baseUrl.includes("api.anthropic.com")) {
    return apiError("Anthropic 原生 API 不支持模型列表查询，请手动输入模型 ID");
  }

  const normalized = baseUrl.replace(/\/+$/, "");
  let url = normalized.endsWith("/v1") ? `${normalized}/models` : `${normalized}/v1/models`;
  const resp = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const status = resp.status;
    let hint = "";
    if (status === 401) hint = "（API Key 无效或未授权）";
    else if (status === 403) hint = "（无权限访问）";
    else if (status === 404) hint = "（接口地址不正确，请检查 baseUrl）";
    else if (status === 429) hint = "（请求过于频繁，请稍后重试）";
    return NextResponse.json({
      error: `查询模型列表失败${hint}`,
    }, { status: 502 });
  }

  const data = await resp.json();
  const models: string[] = (data.data || []).map((m: { id: string }) => m.id);
  if (models.length === 0) {
    return NextResponse.json({ models: [], warning: "该接口未返回模型列表" });
  }
  return NextResponse.json({ models });
}

export const POST = withApiErrorHandling(handler);
