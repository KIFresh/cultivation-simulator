import { NextResponse } from "next/server";
import { warmupAI } from "@/lib/narrative";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// GET — 预热 AI 连接（静默执行，不阻塞响应）
async function handler() {
  // 不 await，在后台执行
  warmupAI().catch(() => {});
  return NextResponse.json({ warming: true });
}

export const GET = withApiErrorHandling(handler);
