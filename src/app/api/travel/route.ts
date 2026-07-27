import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcTravelCostByMode, type TravelModeId } from "@/lib";

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
    // service 端权威计价：以出行方式为准（兼容旧 useTaxi 参数）
    const mode: TravelModeId = travelMode || (useTaxi ? "taxi" : "walk");
    const { staminaCost: sCostCalc, goldCost: gCostCalc } = calcTravelCostByMode(c.location || "home", locationId, mode);
    const sCost = Math.max(0, Number(staminaCost) || sCostCalc);
    const gCost = Math.max(0, Number(goldCost) || gCostCalc);

    if (c.stamina < sCost) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }
    if ((c.gold ?? 0) < gCost) {
      return NextResponse.json({ error: "金币不足" }, { status: 400 });
    }

    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: {
        stamina: { decrement: sCost },
        gold: { decrement: gCost },
        location: locationId,
      },
    });

    return NextResponse.json({
      cultivator: updated,
      locationId,
      staminaCost: sCost,
      goldCost: gCost,
      travelMode: mode,
    });
  } catch (error) {
    console.error("旅行失败:", error);
    return NextResponse.json({ error: "旅行失败" }, { status: 500 });
  }
}
