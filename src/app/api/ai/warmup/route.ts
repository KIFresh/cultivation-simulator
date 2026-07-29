import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const { narrative = "这是一次预热的叙述生成。" } = body;

    const res = await fetch(`${request.nextUrl.origin}/api/narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ACTION",
        narrative,
        worldId: cultivator.worldId,
        cultivator,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || "预热失败" }, { status: res.status });
    }

    return NextResponse.json({ ok: true, narrative: data.narrative });
  } catch (error) {
    console.error("AI 预热失败:", error);
    return NextResponse.json({ error: "AI 预热失败" }, { status: 500 });
  }
}
