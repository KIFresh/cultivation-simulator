import { NextRequest, NextResponse } from "next/server";
import { warmupAI } from "@/lib/narrative";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { requireCultivator } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";

// GET — 预热 AI 连接（静默执行，不阻塞响应）
async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if (auth.error) return auth.error;
  // 不 await，在后台执行
  warmupAI().catch(() => {});
  return NextResponse.json({ warming: true });
}

export const GET = withApiErrorHandling(handler);
