import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCombat, type PlayerCombatData } from "@/lib/combat-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, enemyId, locationId } = body;

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

    const cultivator = user.cultivator;

    // 检查每日战斗次数上限
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const combatCount = await prisma.gameEvent.count({
      where: { cultivatorId: cultivator.id, type: "COMBAT", createdAt: { gte: today } },
    });
    if (combatCount >= 5) {
      return NextResponse.json({ error: "今日战斗次数已达上限（5次）" }, { status: 400 });
    }

    // 获取装备物品
    const inventory: { itemId: string }[] = [];
    try {
      const parsed = JSON.parse(cultivator.inventory || "[]");
      for (const item of parsed) {
        if (item.equipped) inventory.push({ itemId: item.itemId });
      }
    } catch {}

    // 获取功法记录
    const techniqueRecords = await prisma.cultivatorTechnique.findMany({
      where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
    });

    const player: PlayerCombatData = {
      cultivator: {
        id: cultivator.id,
        name: cultivator.name,
        realm: cultivator.realm,
        realmLevel: cultivator.realmLevel,
        gold: cultivator.gold ?? 50,
        reincarnationCount: cultivator.reincarnationCount || 0,
        injuryDebuff: cultivator.injuryDebuff || 0,
      },
      attributes: {},
      equippedItems: inventory,
      techniqueRecords: techniqueRecords.map((r) => ({
        techniqueId: r.techniqueId,
        level: r.level,
      })),
    };

    // 尝试从 localStorage 获取属性（请求体可能携带）
    if (body.attributes) {
      player.attributes = body.attributes;
    }

    const result = await resolveCombat(player, enemyId, locationId);

    return NextResponse.json({ ...result });
  } catch (error) {
    console.error("战斗失败:", error);
    return NextResponse.json({ error: "战斗失败" }, { status: 500 });
  }
}