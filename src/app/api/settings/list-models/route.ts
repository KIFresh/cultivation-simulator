import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey, type } = body;

    if (!type) {
      return NextResponse.json({ error: "缺少供应方类型" }, { status: 400 });
    }

    if (type === "ollama") {
      if (!baseUrl) {
        return NextResponse.json({ error: "Ollama 需要填写接口地址" }, { status: 400 });
      }
      const url = baseUrl.replace(/\/+$/, "") + "/api/tags";
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) {
        return NextResponse.json({ error: `Ollama 返回错误: ${resp.status}` }, { status: 502 });
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
      return NextResponse.json({ error: "请填写接口地址" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "请填写 API Key" }, { status: 400 });
    }

    // 检查是否是 Anthropic 原生 API
    if (baseUrl.includes("api.anthropic.com")) {
      return NextResponse.json({ error: "Anthropic 原生 API 不支持模型列表查询，请手动输入模型 ID" }, { status: 400 });
    }

    const url = baseUrl.replace(/\/+$/, "") + "/v1/models";
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json({
        error: `查询模型列表失败 (${resp.status})${text ? ": " + text.slice(0, 200) : ""}`,
      }, { status: 502 });
    }

    const data = await resp.json();
    const models: string[] = (data.data || []).map((m: { id: string }) => m.id);
    if (models.length === 0) {
      return NextResponse.json({ models: [], warning: "该接口未返回模型列表" });
    }
    return NextResponse.json({ models });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: `连接失败: ${msg}` }, { status: 502 });
  }
}