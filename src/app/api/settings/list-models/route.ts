import { NextRequest, NextResponse } from "next/server";
import { apiError, isPrivateOrLocalUrl } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

async function loadApiKey(type: string, index: number): Promise<string | null> {
  try {
    const allSettings = await prisma.appSetting.findMany();
    const match = allSettings.find(s => s.key === `AI_PROVIDER_${index}_KEY`);
    return match?.value || null;
  } catch {
    return null;
  }
}

async function handler(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    let { baseUrl, apiKey, type } = body;

    if (!type) {
      return apiError("缺少供应方类型");
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
      // 如果前端未提供 API Key，尝试从数据库读取已保存的 Key
      for (let i = 1; i <= 3; i++) {
        const saved = await loadApiKey(type, i);
        if (saved) {
          apiKey = saved;
          break;
        }
      }
      if (!apiKey) {
        return apiError("请填写 API Key，或先保存配置后再试");
      }
    }

    // 取消管理员鉴权后启用 SSRF 防护，拒绝本机/内网地址
    if (isPrivateOrLocalUrl(baseUrl)) {
      return apiError("接口地址不能指向本机或内网地址");
    }
    try {
      const protocol = new URL(baseUrl).protocol;
      if (protocol !== "https:" && protocol !== "http:")
        return apiError("接口地址必须使用 HTTP 或 HTTPS");
    } catch {
      return apiError("接口地址格式不正确");
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
      return NextResponse.json(
        {
          error: `查询模型列表失败${hint}`,
        },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const models: string[] = (data.data || []).map((m: { id: string }) => m.id);
    if (models.length === 0) {
      return NextResponse.json({ models: [], warning: "该接口未返回模型列表" });
    }
    return NextResponse.json({ models });
  } catch (error) {
    logger.error("list-models: 查询模型列表失败", error);
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: `查询模型列表失败: ${message}` }, { status: 500 });
  }
}

export const POST = withApiErrorHandling(handler);