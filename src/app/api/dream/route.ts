import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { pickDream } from "@/lib/dream-events";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// 梦境预兆：纯氛围 + 命运预告。无 DB 写入，不改动任何数值。
async function postHandler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;
  const dream = pickDream(cultivator.spiritualRoot ?? "chaos", cultivator.age ?? 1);
  return NextResponse.json({ dream });
}
export const POST = withApiErrorHandling(postHandler);
