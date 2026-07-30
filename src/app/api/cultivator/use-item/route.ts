import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getItemById, TECHNIQUES } from "@/lib";
import { requireCultivator } from "@/lib/auth-helpers";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

// POST — 使用物品
async function postHandler(request: NextRequest) {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;
    const body = await parseJsonBody(request);
    const { itemId, quantity = 1 } = body;

    if (!itemId) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const item = getItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "物品不存在" }, { status: 400 });
    }

    if (!item.useEffect) {
      return NextResponse.json({ error: "该物品无法使用" }, { status: 400 });
    }

    const inventory: { itemId: string; quantity: number; equipped: boolean }[] =
      JSON.parse(cultivator.inventory || "[]");

    // 检查背包
    const slot = inventory.find((s) => s.itemId === itemId);
    if (!slot || slot.quantity < quantity) {
      return NextResponse.json({ error: "物品不足" }, { status: 400 });
    }

    const effect = item.useEffect;
    let updateData: Record<string, unknown> = {};
    let message = "";

    switch (effect.type) {
      case "recoverStamina": {
        updateData.stamina = { increment: effect.value * quantity };
        message = `体力 +${effect.value * quantity}`;
        break;
      }

      case "addExp": {
        const gained = effect.value * quantity;
        updateData.cultivationExp = { increment: gained };
        updateData.totalExp = { increment: gained };
        message = `修炼值 +${gained}`;
        break;
      }

      case "boostAttr": {
        // 属性存储在 localStorage，后端只记录使用了该物品
        // 前端在响应后自行更新 localStorage
        message = `${item.description}已使用，${effect.targetAttr || "属性"} +${effect.value * quantity}`;
        break;
      }

      case "tempBuff": {
        if (itemId === "breakthrough_pill") {
          updateData.breakthroughBuff = { increment: effect.value * quantity };
          message = `下次突破概率 +${effect.value * quantity}%`;
        } else if (itemId === "talisman_shield") {
          message = "护身符已祭炼，请及时运用";
        }
        break;
      }

      case "learnTechnique": {
        // 功法玉简：关联的 techniqueId 由物品 id 映射
        const techniqueMap: Record<string, string> = {
          ancient_tome: "sword_foundation",
        };
        const techId = techniqueMap[itemId];
        if (!techId || !TECHNIQUES[techId]) {
          return NextResponse.json({ error: "无法领悟此功法" }, { status: 400 });
        }
        // 检查是否已有
        const existing = await prisma.cultivatorTechnique.findFirst({
          where: { cultivatorId: cultivator.id, techniqueId: techId },
        });
        if (existing) {
          return NextResponse.json({ error: "已掌握该功法" }, { status: 400 });
        }
        await prisma.cultivatorTechnique.create({
          data: {
            cultivatorId: cultivator.id,
            techniqueId: techId,
            equipSlot: null,
            level: 1,
            proficiency: 0,
          },
        });
        message = `领悟了「${TECHNIQUES[techId].name}」！`;
        break;
      }

      default:
        return NextResponse.json({ error: "未知物品效果" }, { status: 400 });
    }

    // 减少背包数量
    const newInventory = inventory
      .map((s) =>
        s.itemId === itemId ? { ...s, quantity: s.quantity - quantity } : s
      )
      .filter((s) => s.quantity > 0);

    updateData.inventory = JSON.stringify(newInventory);

    const updated = await prisma.cultivator.update({
      where: { id: cultivator.id },
      data: updateData as any,
    });

    return NextResponse.json({
      success: true,
      message,
      cultivator: updated,
    });
}

export const POST = withApiErrorHandling(postHandler);