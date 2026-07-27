import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getItemById } from "@/lib";
import { requireCultivator, apiError } from "@/lib/auth-helpers";
import { json } from "@/lib/json-helper";
import { logger } from "@/lib/logger";

// 使用后会消耗（"用了就少一个"）的物品效果类型，统一在下方 switch 之前扣减背包数量
const CONSUMABLE_EFFECT_TYPES = ["recoverStamina", "boostAttr", "addExp"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, itemId } = body;
    if (!userId || !itemId) return apiError("缺少参数", 400);

    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const c = auth.cultivator;

    const item = getItemById(itemId);
    if (!item) return apiError("物品不存在", 400);
    if (!item.useEffect) return apiError("该物品无法使用", 400);

    const inv = json.inventory(c.inventory);
    const idx = inv.findIndex((i: any) => i.itemId === itemId);
    if (idx === -1) return apiError("背包中没有该物品", 400);

    const updateData: Record<string, any> = {};
    const effect = item.useEffect;

    // 统一扣减背包：所有「用了就少一个」的消耗品效果都在此扣一次数量。
    // 装备类（家具/衣服/首饰等的 boostAttr）同样扣减，保持原有行为；
    // 不支持的效果类型（如 tempBuff）不在此集合内，避免误扣背包。
    if (CONSUMABLE_EFFECT_TYPES.includes(effect.type)) {
      inv[idx].quantity -= 1;
      if (inv[idx].quantity <= 0) inv.splice(idx, 1);
      updateData.inventory = JSON.stringify(inv);
    }

    switch (effect.type) {
      case "recoverStamina": {
        const maxSt = 20 + (c.attributes ? Math.round((json.attributes(c.attributes).root || 0)) : 0);
        updateData.stamina = Math.min(maxSt, (c.stamina || 0) + effect.value);
        break;
      }
      case "boostAttr": {
        const attrs = json.attributes(c.attributes);
        const target = effect.targetAttr || "root";
        attrs[target] = (attrs[target] || 0) + effect.value;
        updateData.attributes = JSON.stringify(attrs);
        break;
      }
      case "addExp": {
        const newExp = (c.cultivationExp || 0) + effect.value;
        updateData.cultivationExp = newExp;
        updateData.totalExp = (c.totalExp || 0) + effect.value;
        break;
      }
      default:
        return apiError("该物品暂不支持使用", 400);
    }

    const updated = await prisma.cultivator.update({
      where: { id: c.id },
      data: updateData,
    });

    return NextResponse.json({ cultivator: updated, usedItem: itemId });
  } catch (error) {
    logger.error("使用物品失败:", error);
    return apiError("使用物品失败", 500);
  }
}
