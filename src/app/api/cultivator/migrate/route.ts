import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { logger } from "@/lib/logger";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";

/**
 * POST /api/cultivator/migrate
 * 迁移逻辑：新角色或老玩家缺失字段时自动初始化。
 * 替代 GET /api/cultivator 中遗留的写操作。
 */
async function handler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { userId } = body;
  if (!userId) return apiError("缺少 userId", 400);

  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const c = auth.cultivator;

  if (c.attributes) {
    return NextResponse.json({ migrated: false, message: "无需迁移" });
  }

  const defaultAttrs = { root: 10, spirit: 10, insight: 10, luck: 10, charm: 10, mind: 10 };

  if (!c.inventory || c.inventory === "[]") {
    // 全新角色
    await prisma.cultivator.update({
      where: { id: c.id },
      data: {
        attributes: JSON.stringify(defaultAttrs),
        occupation: c.occupation || "学生",
        schoolRank: c.schoolRank ?? 0,
        unlockedLocations: JSON.stringify(
          json.unlockedLocations(c.unlockedLocations)
        ),
      },
    });
  } else {
    // 老玩家迁移
    await prisma.cultivator.update({
      where: { id: c.id },
      data: { attributes: JSON.stringify(defaultAttrs) },
    });
  }

  return NextResponse.json({ migrated: true, attributes: defaultAttrs });
}

export const POST = withApiErrorHandling(handler);