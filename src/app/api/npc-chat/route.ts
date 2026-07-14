import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message } = body;

    if (!userId || !message) {
      return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cultivator: true },
    });
    if (!user?.cultivator) {
      return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });
    }

    const c = user.cultivator;
    if (c.stamina < 1) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }

    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: { stamina: { decrement: 1 } },
    });

    return NextResponse.json({ cultivator: updated });
  } catch (error) {
    console.error("NPC 对话失败:", error);
    return NextResponse.json({ error: "对话失败" }, { status: 500 });
  }
}