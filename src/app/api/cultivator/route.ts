import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SPIRITUAL_ROOTS, type SpiritualRoot } from "@/lib";
import { hashPassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import { calculateMaxStamina } from "@/lib/cultivation-data";

/** 登录/注册成功后向响应写入 HttpOnly 签名会话 cookie */
function setSessionCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });
  return response;
}

// POST — 创建修炼者 + 记忆操作
async function postHandler(request: NextRequest) {
  try {
    const body = await parseJsonBody(request);
    const { action, ...rest } = body;

    // 更新记忆条目
    if (action === "updateMemory") {
      const auth = await requireCultivator(request);
      if ("error" in auth) return auth.error;
      if (!rest.storyEntries) {
        return NextResponse.json({ error: "缺少参数" }, { status: 400 });
      }
      const updated = await prisma.cultivator.update({
        where: { id: auth.cultivator.id },
        data: {
          storyEntries: JSON.stringify(rest.storyEntries),
          storyEntriesUpdatedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        entries: JSON.parse(updated.storyEntries || '[]'),
      });
    }

    // 手动压缩记忆
    if (action === "compressMemory") {
      const auth = await requireCultivator(request);
      if ("error" in auth) return auth.error;
      const cultivator = await prisma.cultivator.findUnique({
        where: { id: auth.cultivator.id },
      });
      if (!cultivator) {
        return NextResponse.json({ error: "不存在" }, { status: 404 });
      }

      const { compressStorySummary, createEntry } = await import("@/lib/narrative");
      let entries: import("@/lib/narrative").StoryEntry[] = [];
      try {
        entries = JSON.parse(cultivator.storyEntries || '[]');
        if (!Array.isArray(entries)) entries = [];
      } catch {
        entries = [];
      }

      const importantEntries = entries.filter(e => e.important);
      const normalEntries = entries.filter(e => !e.important);

      if (normalEntries.length === 0) {
        return NextResponse.json({ success: true, entries: importantEntries, compressed: false, message: "没有可压缩的普通记忆" });
      }

      const compressedText = await compressStorySummary(entries, cultivator.name);
      const compressedEntry = createEntry("记忆凝练", compressedText, false);

      const newEntries = [...importantEntries, compressedEntry];

      await prisma.cultivator.update({
        where: { id: auth.cultivator.id },
        data: {
          storyEntries: JSON.stringify(newEntries),
          storyEntriesUpdatedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, entries: newEntries, compressed: true, message: "记忆已压缩" });
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

    // 已有用户路径：原子创建修炼者 + 初始功法
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: body.userId },
        data: {
          cultivator: {
            create: {
              name: body.cultivatorName,
              spiritualRoot: body.spiritualRoot,
              worldId: body.worldId || "earth",
              worldYear: 2025,
              attributes: body.attributes ? JSON.stringify(body.attributes) : undefined,
              gender: body.gender,
              stamina: calculateMaxStamina(1, body.attributes),
            },
          },
        },
        include: { cultivator: true },
      });

      if (user.cultivator) {
        await tx.cultivatorTechnique.create({
          data: {
            cultivatorId: user.cultivator.id,
            techniqueId: "basic_breathing",
            equipSlot: 1,
            level: 1,
            proficiency: 0,
          },
        });
      }

      return user;
    });

    return setSessionCookie(NextResponse.json({ user: result }), result.id);
    }

    // 新建用户路径：必须有 userName
    if (!userName) {
      return NextResponse.json({ error: "缺少必填信息" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { name: userName } });
    if (existing) return NextResponse.json({ error: "该账号名已被占用" }, { status: 409 });

    const pwdHash = password ? hashPassword(password) : undefined;

    // 原子创建用户 + 修炼者 + 初始功法
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: userName,
          password: pwdHash ? `${pwdHash.salt}:${pwdHash.hash}` : undefined,
          cultivator: {
            create: {
              name: cultivatorName,
              spiritualRoot,
              worldId: worldId || "earth",
              worldYear: 2025,
              attributes: body.attributes ? JSON.stringify(body.attributes) : undefined,
              gender: body.gender,
              stamina: calculateMaxStamina(1, body.attributes),
            },
          },
        },
        include: { cultivator: true },
      });

      if (user.cultivator) {
        await tx.cultivatorTechnique.create({
          data: {
            cultivatorId: user.cultivator.id,
            techniqueId: "basic_breathing",
            equipSlot: 1,
            level: 1,
            proficiency: 0,
          },
        });
      }

      return user;
    });

    return setSessionCookie(NextResponse.json({ user: result }), result.id);
  } catch (error) {
    logger.error("创建修炼者失败:", error);
    return NextResponse.json({ error: "创建失败，请重试" }, { status: 500 });
  }
}

export const POST = withApiErrorHandling(postHandler);

// PATCH — 更新位置（旅行消耗）
async function patchHandler(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const body = await parseJsonBody(request);
    const { location, stamina, gold } = body;

    const updateData: Record<string, unknown> = {};
    if (location) updateData.location = location;
    if (typeof stamina === "number") updateData.stamina = stamina;
    if (typeof gold === "number") updateData.gold = gold;

    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: updateData,
    });

    return NextResponse.json({ cultivator: updated });
  } catch (error) {
    logger.error("更新修炼者失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export const PATCH = withApiErrorHandling(patchHandler);

// GET — 获取修炼者信息
async function getHandler(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const user = await prisma.user.findUnique({
      where: { id: cultivator.userId },
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
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    // 自动解析 storyEntries JSON
    if (user.cultivator?.storyEntries) {
      (user.cultivator as any).storyEntries = JSON.parse(user.cultivator.storyEntries);
    }

    return NextResponse.json({ user });
  } catch (error) {
    logger.error("获取修炼者失败:", error);
    return NextResponse.json(
      { error: "获取失败" },
      { status: 500 }
    );
  }
}

export const GET = withApiErrorHandling(getHandler);