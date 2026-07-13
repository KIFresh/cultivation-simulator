import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SPIRITUAL_ROOTS, type SpiritualRoot } from "@/lib";
import { hashPassword } from "@/lib/auth";

// POST — 创建修炼者 + 记忆操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...rest } = body;

    // 更新记忆条目
    if (action === "updateMemory") {
      if (!rest.userId || !rest.storyEntries) {
        return NextResponse.json({ error: "缺少参数" }, { status: 400 });
      }
      const cultivator = await prisma.cultivator.update({
        where: { userId: rest.userId },
        data: {
          storyEntries: JSON.stringify(rest.storyEntries),
          storyEntriesUpdatedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        entries: JSON.parse(cultivator.storyEntries || '[]'),
      });
    }

    // 手动压缩记忆
    if (action === "compressMemory") {
      const cultivator = await prisma.cultivator.findUnique({
        where: { userId: rest.userId },
      });
      if (!cultivator) {
        return NextResponse.json({ error: "不存在" }, { status: 404 });
      }

      const { compressStorySummary, createEntry } = await import("@/lib/narrative");
      const entries: import("@/lib/narrative").StoryEntry[] = JSON.parse(cultivator.storyEntries || '[]');
      const importantEntries = entries.filter(e => e.important);
      const normalEntries = entries.filter(e => !e.important);

      if (normalEntries.length === 0) {
        return NextResponse.json({ entries, message: "无非重要条目需要压缩" });
      }

      const compressedText = await compressStorySummary(entries, cultivator.name);
      const compressedEntry = createEntry("📜 记忆凝练", compressedText, false);

      const newEntries = [...importantEntries, compressedEntry];

      await prisma.cultivator.update({
        where: { userId: rest.userId },
        data: {
          storyEntries: JSON.stringify(newEntries),
          storyEntriesUpdatedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, entries: newEntries });
    }

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

    const pwdHash = password ? hashPassword(password) : undefined;

    const user = await prisma.user.create({
      data: {
        name: userName,
        password: pwdHash ? `${pwdHash.salt}:${pwdHash.hash}` : undefined,
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

    // 自动解析 storyEntries JSON
    if (user.cultivator?.storyEntries) {
      (user.cultivator as any).storyEntries = JSON.parse(user.cultivator.storyEntries);
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