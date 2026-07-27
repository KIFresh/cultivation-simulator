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

    // 轮回转世
    if (action === "reincarnate") {
      if (!rest.userId) {
        return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
      }

      const cultivator = await prisma.cultivator.findUnique({
        where: { userId: rest.userId },
      });
      if (!cultivator) {
        return NextResponse.json({ error: "修炼者不存在" }, { status: 404 });
      }

      const newCount = (cultivator.reincarnationCount || 0) + 1;

      const updated = await prisma.cultivator.update({
        where: { userId: rest.userId },
        data: {
          realm: "凡人",
          realmLevel: 0,
          cultivationExp: 0,
          totalExp: 0,
          stamina: 20,
          breakthroughCount: 0,
          age: 1,
          gold: 50,
          location: null,
          inventory: null,
          npcRelations: null,
          title: null,
          maxAge: null,
          bonusAge: 0,
          storyEntries: "[]",
          storyEntriesUpdatedAt: new Date(),
          reincarnationCount: newCount,
          talents: JSON.stringify(["前世记忆"]),
          injuryDebuff: 0,
        },
      });

      // 轮回时清理功法
      await prisma.cultivatorTechnique.deleteMany({
        where: { cultivatorId: cultivator.id },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        cultivator: updated,
        reincarnationCount: newCount,
      });
    }

    const { cultivatorName, spiritualRoot, password, worldId } = body;
    const userName = body.userName;

    if (!cultivatorName || !spiritualRoot) {
      return NextResponse.json({ error: "缺少必填信息" }, { status: 400 });
    }

    if (!SPIRITUAL_ROOTS[spiritualRoot as SpiritualRoot]) {
      return NextResponse.json({ error: "无效的灵根类型" }, { status: 400 });
    }

    // 新场景：已有 user，只创建 cultivator（有 userId 时不需要 userName）
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

      // 初始赠送吐纳术
      if (user.cultivator) {
        await prisma.cultivatorTechnique.create({
          data: {
            cultivatorId: user.cultivator.id,
            techniqueId: "basic_breathing",
            equipSlot: 1,
            level: 1,
            proficiency: 0,
          },
        });
      }

      return NextResponse.json({ user });
    }

    // 新建用户路径：必须有 userName
    if (!userName) {
      return NextResponse.json({ error: "缺少必填信息" }, { status: 400 });
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

    // 初始赠送吐纳术
    if (user.cultivator) {
      await prisma.cultivatorTechnique.create({
        data: {
          cultivatorId: user.cultivator.id,
          techniqueId: "basic_breathing",
          equipSlot: 1,
          level: 1,
          proficiency: 0,
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("创建修炼者失败:", error);
    return NextResponse.json({ error: "创建失败，请重试" }, { status: 500 });
  }
}

// PATCH — 更新位置（旅行消耗）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, location, stamina, gold } = body;

    if (!userId) {
      return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { cultivator: true },
    });
    if (!user?.cultivator) {
      return NextResponse.json({ error: "请先创建修炼者" }, { status: 400 });
    }

    const c = user.cultivator;
    const updateData: Record<string, unknown> = {};
    if (location) updateData.location = location;
    if (typeof stamina === "number") updateData.stamina = stamina;
    if (typeof gold === "number") updateData.gold = gold;

    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: updateData,
    });

    return NextResponse.json({ cultivator: updated });
  } catch (error) {
    console.error("更新位置失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
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