import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { generateStreetOmen, type DistrictKey } from "@/lib/street-omen";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// 街头机缘：按「角色 id + 年龄 + 季度 + 街区」种子生成，无 DB 写入，不改任何数值。
async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;
  const season = (c as { quarter?: number }).quarter ?? 1;
  const body = await parseJsonBody(request).catch(() => ({}) as Record<string, unknown>);
  const district = (body.district as DistrictKey) || "oldtown";
  const omen = generateStreetOmen({ id: c.id, age: c.age ?? 1, quarter: season, district });
  return NextResponse.json({
    omen,
    cultivator: { id: c.id, age: c.age ?? 1, quarter: season },
  });
}

export const POST = withApiErrorHandling(handler);
