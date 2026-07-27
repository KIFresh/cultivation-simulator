import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";

// POST — 储蓄罐存取（金币 ⇄ 储蓄），仅移动货币，不触发其它效果
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;

    const body = (await request.json()) as { action?: string; amount?: number };
    const { action, amount } = body;
    if (action !== "deposit" && action !== "withdraw") {
      return apiError("无效操作（需 deposit / withdraw）", 400);
    }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      return apiError("金额必须为正整数", 400);
    }

    const gold = c.gold ?? 0;
    const savings = c.savings ?? 0;

    if (action === "deposit") {
      if (amt > gold) return apiError("金币不足，无法存入储蓄罐", 400);
      await prisma.cultivator.update({
        where: { id: c.id },
        data: {
          gold: { decrement: amt },
          savings: { increment: amt },
        } as Parameters<typeof prisma.cultivator.update>[0]["data"],
      });
    } else {
      if (amt > savings) return apiError("储蓄罐余额不足，无法取出", 400);
      await prisma.cultivator.update({
        where: { id: c.id },
        data: {
          gold: { increment: amt },
          savings: { decrement: amt },
        } as Parameters<typeof prisma.cultivator.update>[0]["data"],
      });
    }

    const updated = await prisma.cultivator.findUnique({ where: { id: c.id } });
    return NextResponse.json({
      success: true,
      action,
      amount: amt,
      gold: updated?.gold ?? 0,
      savings: updated?.savings ?? 0,
    });
  } catch (error) {
    logger.error("储蓄操作失败:", error);
    return apiError("操作失败", 500);
  }
}
