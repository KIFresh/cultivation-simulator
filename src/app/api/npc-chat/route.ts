import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function postHandler(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await parseJsonBody(request);
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });
    }

    if (cultivator.stamina < 1) {
      return NextResponse.json({ error: "行动力不足" }, { status: 400 });
    }

    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: { stamina: { decrement: 1 } },
    });

    return NextResponse.json({ cultivator: updated });
  } catch (error) {
    logger.error("NPC 对话失败:", error);
    return NextResponse.json({ error: "对话失败" }, { status: 500 });
  }
}

export const POST = withApiErrorHandling(postHandler);