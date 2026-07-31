import { NextRequest, NextResponse } from "next/server";
import { isPrivateOrLocalUrl } from "@/lib/auth-helpers";
import { AppError, withApiErrorHandling, parseJsonBody, serviceUnavailable, badRequest } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

async function loadApiKey(index: number): Promise<string | null> {
  if (!Number.isInteger(index) || index < 1 || index > 3) return null;
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: `AI_PROVIDER_${index}_KEY` },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

async function handler(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    let { baseUrl, apiKey, type, providerIndex } = body;
    providerIndex = Number(providerIndex);
    if (!Number.isInteger(providerIndex) || providerIndex < 1 || providerIndex > 3) {
      throw badRequest("缺少有效的供应方配置槽位");
    }

    if (!type) {
      throw badRequest("缺少供应方类型");
    }

    if (type === "ollama") {
      if (!baseUrl) {
        throw badRequest("Ollama 需要填写接口地址");
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
      throw badRequest("请填写接口地址");
    }
    if (!apiKey) {
      // 如果前端未提供 API Key，尝试从数据库读取已保存的 Key
      const saved = await loadApiKey(providerIndex);
      if (saved) apiKey = saved;
      if (!apiKey) {
        throw badRequest("请填写 API Key，或先保存配置后再试");
      }
    }

    // 取消管理员鉴权后启用 SSRF 防护，拒绝本机/内网地址
    if (isPrivateOrLocalUrl(baseUrl)) {
      throw badRequest("接口地址不能指向本机或内网地址");
    }
    let protocol: string;
    try {
      protocol = new URL(baseUrl).protocol;
    } catch {
      throw badRequest("接口地址格式不正确");
    }
    if (protocol !== "https:" && protocol !== "http:") {
      throw badRequest("接口地址必须使用 HTTP 或 HTTPS");
    }

    // 检查是否是 Anthropic 原生 API
    if (baseUrl.includes("api.anthropic.com")) {
      throw badRequest("Anthropic 原生 API 不支持模型列表查询，请手动输入模型 ID");
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
      throw serviceUnavailable(`查询模型列表失败${hint}`, undefined);
    }

    const data = await resp.json();
    const models: string[] = (data.data || []).map((m: { id: string }) => m.id);
    if (models.length === 0) {
      return NextResponse.json({ models: [], warning: "该接口未返回模型列表" });
    }
    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("list-models: 查询模型列表失败", error);
    throw serviceUnavailable("查询模型列表失败", error);
  }
}

export const POST = withApiErrorHandling(handler);