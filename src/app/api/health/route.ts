import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 健康检查 —— 改完线上配置(数据库地址/令牌)后打这个接口即可确认线上是否连通，
// 不用拿登录去试。用 SELECT 1 验证连接，0 行读，可被监控高频轮询而不消耗 Turso 配额。
export const dynamic = "force-dynamic"; // 禁止缓存，每次实查

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "unknown",
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
