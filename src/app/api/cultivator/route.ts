import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SPIRITUAL_ROOTS, type SpiritualRoot } from "@/lib";
import { hashPassword } from "@/lib/auth";

// POST — 创建修炼者
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, cultivatorName, spiritualRoot, password, worldId } = body;

    if (!userName || !cultivatorName || !spiritualRoot) {
      return NextResponse.json({ error: "缺少必填信息" }, { status: 400 });
    }

    if (!SPIRITUAL_ROOTS[spiritualRoot as SpiritualRoot]) {
      return NextResponse.json({ error: "无效的灵根类型" }, { status: 400 });
    }

    // 新场景：已有 user，只创建 cultivator
    if (body.userId) {
      const existingUser = await prisma.user.findUnique({
        where: { id: body.userId },
        include: { cultivator: true },
      });
      if (!existingUser) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      if (existingUser.cultivator) {
        return NextResponse.json({ error: "该用户已有修炼者" }, { status: 409 });
      }

      const user = await prisma.user.update({
        where: { id: body.userId },
        data: {
          cultivator: {
            create: {
              name: body.cultivatorName,
              spiritualRoot: body.spiritualRoot,
              worldId: body.worldId || "earth",
            },
          },
        },
        include: { cultivator: true },
      });

      return NextResponse.json({ user });
    }

    const existing = await prisma.user.findUnique({ where: { name: userName } });
    if (existing) return NextResponse.json({ error: "该账号名已被占用" }, { status: 409 });

    const hashedPassword = password ? hashPassword(password) : undefined;

    const user = await prisma.user.create({
      data: {
        name: userName,
        password: hashedPassword ? `${hashedPassword.salt}:${hashedPassword.hash}` : undefined,
        cultivator: {
          create: { name: cultivatorName, spiritualRoot, worldId: worldId || "earth" },
        },
      },
      include: { cultivator: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("创建修炼者失败:", error);
    return NextResponse.json({ error: "创建失败，请重试" }, { status: 500 });
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
