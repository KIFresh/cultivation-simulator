import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// P1#5 健康收尾：床（安睡回血）+ 诊所（花金回血）。纯结算，无 AI 叙事，确定性行为。
const REST_STAMINA_COST = 1;
const REST_HEALTH_BASE = 20;
const REST_HEALTH_BED_BONUS = 10;
const CLINIC_GOLD_COST = 15;
const CLINIC_HEALTH_GAIN = 50;

function hasBedFurniture(cultivator: { properties: string | null }): boolean {
  const props: any[] = json.properties(cultivator.properties);
  const livingProp = props.find((p: any) => p.selfLiving);
  return !!livingProp?.furniture?.includes("bed");
}

async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { userId, mode } = body;
  if (!userId || (mode !== "rest" && mode !== "clinic")) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  if (mode === "rest") {
    if (cultivator.stamina < REST_STAMINA_COST) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }
    const gain = REST_HEALTH_BASE + (hasBedFurniture(cultivator) ? REST_HEALTH_BED_BONUS : 0);
    const healAmount = Math.min(100 - (cultivator.health ?? 100), gain);
    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: { health: { increment: healAmount }, stamina: { decrement: REST_STAMINA_COST } },
    });
    const narrative = hasBedFurniture(cultivator)
      ? { title: "榻上安眠", narrative: "你在舒适的床榻上酣睡一夜，气血大为恢复。", mood: "静" }
      : { title: "闭目养神", narrative: "你闭目养神歇息片刻，气血有所恢复。", mood: "静" };
    return NextResponse.json({ cultivator: updated, narrative, healthDelta: healAmount });
  }

  // clinic：花金回血
  const gold = cultivator.gold ?? 0;
  if (gold < CLINIC_GOLD_COST) {
    return NextResponse.json({ error: "金币不足" }, { status: 400 });
  }
  const oldHealth = cultivator.health ?? 100;
  const newHealth = Math.min(100, oldHealth + CLINIC_HEALTH_GAIN);
  const updated = await prisma.cultivator.update({
    where: { id: cultivator.id },
    data: { health: newHealth, gold: { decrement: CLINIC_GOLD_COST } },
  });
  const narrative = {
    title: "延医问诊",
    narrative: "你延请郎中问诊，大夫妙手回春，气血恢复了不少。",
    mood: "静",
  };
  return NextResponse.json({
    cultivator: updated,
    narrative,
    healthDelta: newHealth - oldHealth,
    goldChanged: -CLINIC_GOLD_COST,
  });
}

export const POST = withApiErrorHandling(postHandler);
