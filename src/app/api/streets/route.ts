import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { generateStreetOmen, type DistrictKey } from "@/lib/street-omen";

// 街头机缘：按「角色 id + 年龄 + 季度 + 街区」种子生成，无 DB 写入，不改任何数值。
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;
    const season = (c as { quarter?: number }).quarter ?? 1;
    const body = await request.json().catch(() => ({} as { district?: string }));
    const district = (body.district as DistrictKey) || "oldtown";
    const omen = generateStreetOmen({ id: c.id, age: c.age ?? 1, quarter: season, district });
    return NextResponse.json({
      omen,
      cultivator: { id: c.id, age: c.age ?? 1, quarter: season },
    });
  } catch (error) {
    return NextResponse.json({ error: "无法感知街角" }, { status: 500 });
  }
}
