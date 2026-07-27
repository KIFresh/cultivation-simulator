import { NextRequest, NextResponse } from "next/server";
import { isPrivateOrLocalUrl, apiError } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey, type } = body;

    if (!type) {
      return apiError("缺少供应方类型");
    }

    // SSRF 防护：禁止内网地址
    if (baseUrl && isPrivateOrLocalUrl(baseUrl)) {
      return apiError("禁止访问内网地址");
    }

    if (type === "ollama") {
      if (!baseUrl) {
        return apiError("Ollama 需要填写接口地址");
      }
      const url = baseUrl.replace(/\/+$/, "") + "/api/tags";
      const resp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
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

    // 智能拼接 /v1/models：baseUrl 可能已含 /v1
    let url = baseUrl.replace(/\/+$/, "");
    if (!url.endsWith("/v1")) url += "/v1";
    url += "/models";
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
  } catch {
    return NextResponse.json({ error: "连接失败" }, { status: 502 });
  }
}
