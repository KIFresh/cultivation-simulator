import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { computeExchange, type ExchangeDirection } from "@/lib/exchange";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const STONE_COL: Record<string, "spiritStoneLow" | "spiritStoneMid" | "spiritStoneHigh"> = {
  low: "spiritStoneLow",
  mid: "spiritStoneMid",
  high: "spiritStoneHigh",
};

type StoneCols = { spiritStoneLow: number; spiritStoneMid: number; spiritStoneHigh: number };

// 读取灵石三档余额（绕过 FW 的 CultivatorWithUser 类型，运行时直接读 DB 行）
function readStones(c: any): StoneCols {
  return {
    spiritStoneLow: c.spiritStoneLow ?? 0,
    spiritStoneMid: c.spiritStoneMid ?? 0,
    spiritStoneHigh: c.spiritStoneHigh ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator as any;
  return NextResponse.json({
    gold: c.gold ?? 0,
    spiritStones: readStones(c),
  });
}

async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { direction, tier, amount } = body;
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator as any;

  const balances = {
    gold: c.gold ?? 0,
    low: c.spiritStoneLow ?? 0,
    mid: c.spiritStoneMid ?? 0,
    high: c.spiritStoneHigh ?? 0,
  };
  const res = computeExchange(direction as ExchangeDirection, tier, Number(amount), balances);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  const updateData: Record<string, any> = {};
  if (res.goldDelta !== 0) updateData.gold = { increment: res.goldDelta };
  if (res.stoneDelta)
    updateData[STONE_COL[res.stoneDelta.tier]] = { increment: res.stoneDelta.amount };

  const updated = await prisma.cultivator.update({ where: { id: c.id }, data: updateData });
  return NextResponse.json({
    ok: true,
    gold: updated.gold ?? 0,
    spiritStones: readStones(updated),
  });
}

export const POST = withApiErrorHandling(postHandler);
