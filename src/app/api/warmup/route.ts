import { NextResponse } from "next/server";
import { warmupAI } from "@/lib/narrative";

// GET — 预热 AI 连接（静默执行，不阻塞响应）
export async function GET() {
  // 不 await，在后台执行
  warmupAI().catch(() => {});
  return NextResponse.json({ warming: true });
}