import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProviderConfig } from "@/lib/narrative";

// GET — 读取所有配置
export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    return NextResponse.json({ settings: map });
  } catch {
    return NextResponse.json({ settings: {} });
  }
}

// POST — 保存配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { settings } = body;
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "无效的配置数据" }, { status: 400 });
    }

    // 批量更新
    const operations = Object.entries(settings).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
    await prisma.$transaction(operations);

    // 刷新运行时配置（服务端）
    await syncProviderConfig();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("保存配置失败:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}