import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { pickDream } from "@/lib/dream-events";

// 梦境预兆：纯氛围 + 命运预告。无 DB 写入，不改动任何数值。
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const dream = pickDream(cultivator.spiritualRoot ?? "chaos", cultivator.age ?? 1);
    return NextResponse.json({ dream });
  } catch (error) {
    return NextResponse.json({ error: "入梦失败" }, { status: 500 });
  }
}
