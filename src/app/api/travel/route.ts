import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcTravelCostByMode, type TravelModeId } from "@/lib";
import { previewRob, applyRobResult, parseMilestonesJson } from "@/lib/travel-rob";

// POST — 旅行：扣除体力/金币，更新位置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, locationId, staminaCost, goldCost, useTaxi, travelMode } = body;

    if (!userId || !locationId) {
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
    // service 端权威计价：忽略客户端传入的 staminaCost/goldCost
    const mode: TravelModeId = travelMode || (useTaxi ? "taxi" : "walk");
    const { staminaCost: sCostCalc, goldCost: gCostCalc } = calcTravelCostByMode(c.location || "home", locationId, mode);
    const sCost = sCostCalc;
    const gCost = gCostCalc;

    if (c.stamina < sCost) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }
    if ((c.gold ?? 0) < gCost) {
      return NextResponse.json({ error: "金币不足" }, { status: 400 });
    }

    // 夺宝预览（事务外只读）
    const robPreview = previewRob({
      cultivator: {
        realm: c.realm,
        location: c.location,
        inventory: c.inventory,
        milestones: c.milestones,
      },
    });

    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: {
        stamina: { decrement: sCost },
        gold: { decrement: gCost },
        location: locationId,
      },
    });

    // 若触发夺宝，执行战斗 + 原子结算
    let robResult: { win: boolean; lostItemId?: string } | undefined;
    if (robPreview.triggered) {
      const { resolveCombat } = await import("@/lib/combat-engine");
      const safeAttrs: Record<string, number> = (() => {
        try { return JSON.parse(c.attributes || "{}"); } catch { return {}; }
      })();
      const inventory = (() => {
        try { return JSON.parse(c.inventory || "[]"); } catch { return []; }
      })();
      const targetEnemy = { id: "rob_rival", name: robPreview.enemyName || "夺宝者", realm: c.realm, combatPower: robPreview.enemyCombatPower || 1000, rarity: "精英" as const, locationIds: ["market"] };
      const combatResult = await resolveCombat(
        {
          cultivator: {
            id: c.id,
            name: c.name,
            realm: c.realm,
            realmLevel: c.realmLevel,
            gold: c.gold ?? 50,
            reincarnationCount: c.reincarnationCount || 0,
            injuryDebuff: c.injuryDebuff || 0,
            mindDemon: c.mindDemon || 0,
          },
          attributes: safeAttrs,
          equippedItems: [],
          inventory,
          techniqueRecords: [],
        },
        targetEnemy.id,
        "market",
      );
      const win = combatResult.win;
      const lostItemId = win ? undefined : robPreview.targetItemId;
      robResult = { win, lostItemId };
      // 战败扣物
      if (!win && lostItemId) {
        const newInv = inventory.filter((e: any) => e.itemId !== lostItemId);
        const msPatch = applyRobResult({
          cultivator: { realm: c.realm, location: c.location, inventory: c.inventory, milestones: c.milestones },
        }, false, lostItemId).milestonesPatch;
        const currentMs = parseMilestonesJson(c.milestones);
        await prisma.cultivator.update({
          where: { id: c.id },
          data: { inventory: JSON.stringify(newInv), milestones: JSON.stringify({ ...currentMs, ...msPatch }) },
        });
      }
    }

    return NextResponse.json({
      cultivator: updated,
      locationId,
      staminaCost: sCost,
      goldCost: gCost,
      travelMode: mode,
      rob: robPreview.triggered ? { ...robPreview, ...robResult } : null,
    });
  } catch (error) {
    console.error("旅行失败:", error);
    return NextResponse.json({ error: "旅行失败" }, { status: 500 });
  }
}
