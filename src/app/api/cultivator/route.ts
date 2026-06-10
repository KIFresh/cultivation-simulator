import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SPIRITUAL_ROOTS, type SpiritualRoot } from "@/lib";

// POST — 创建修炼者
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, cultivatorName, spiritualRoot } = body;

    if (!userName || !cultivatorName || !spiritualRoot) {
      return NextResponse.json(
        { error: "缺少必填信息" },
        { status: 400 }
      );
    }

    if (!SPIRITUAL_ROOTS[spiritualRoot as SpiritualRoot]) {
      return NextResponse.json(
        { error: "无效的灵根类型" },
        { status: 400 }
      );
    }

    // 创建用户 + 修炼者
    const user = await prisma.user.create({
      data: {
        name: userName,
        cultivator: {
          create: {
            name: cultivatorName,
            spiritualRoot,
          },
        },
      },
      include: {
        cultivator: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("创建修炼者失败:", error);
    return NextResponse.json(
      { error: "创建失败，请重试" },
      { status: 500 }
    );
  }
}

// GET — 获取修炼者信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "缺少 userId" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cultivator: {
          include: {
            events: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
        dailyTasks: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "修炼者不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("获取修炼者失败:", error);
    return NextResponse.json(
      { error: "获取失败" },
      { status: 500 }
    );
  }
}
