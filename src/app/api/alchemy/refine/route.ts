import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCultivator, apiError, sanitizeString } from "@/lib/auth-helpers";
import { logger } from "@/lib/logger";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import {
  getFormulaById,
  getFurnaceById,
  getDefaultFurnace,
  determineQuality,
  getTalentBonus,
  getTalentQualityLift,
  getAllFormulas,
} from "@/lib/alchemy-data";

/**
 * POST /api/alchemy/refine
 * 执行炼丹操作
 * Body: { userId, formulaId }
 * 返回增量状态: { stamina, inventory, success, product, quality, furnaceBroken, expGained }
 */
async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { userId } = body;
  const formulaId = sanitizeString(body.formulaId, 50);
  if (!userId || !formulaId) return apiError("缺少必填参数", 400);

  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const { cultivator } = auth;

  // 1. 校验配方
  const formula = getFormulaById(formulaId);
  if (!formula) return apiError("配方不存在", 400);

  // 2. 校验配方是否已解锁
  const unlocked: string[] = cultivator.unlockedFormulas
    ? safeJsonParse<string[]>(cultivator.unlockedFormulas, [])
    : ["formula_recovery"];
  if (!unlocked.includes(formulaId)) return apiError("该配方尚未解锁", 400);

  // 3. 体力检查
  const STAMINA_COST = 10;
  if ((cultivator.stamina ?? 0) < STAMINA_COST)
    return apiError(`体力不足（需要${STAMINA_COST}）`, 400);

  // 4. 解析背包
  const inventory: any[] = cultivator.inventory
    ? safeJsonParse<any[]>(cultivator.inventory, [])
    : [];

  // 5. 材料检查
  for (const mat of formula.materials) {
    const invItem = inventory.find((i: any) => i.itemId === mat.itemId);
    if (!invItem || invItem.quantity < mat.amount) {
      return apiError(`${mat.name}不足（需要${mat.amount}个）`, 400);
    }
  }

  // 6. 背包空位检查（最多50格）
  const MAX_BACKPACK = 50;
  if (inventory.length >= MAX_BACKPACK) return apiError("背包已满（最多50格）", 400);

  // 7. 计算最终成功率
  const furnaceId = cultivator.furnaceEquipped || "bronze_furnace";
  const furnace = getFurnaceById(furnaceId) || getDefaultFurnace();
  const talentBonus = getTalentBonus(cultivator.talents);
  const qualityLift = getTalentQualityLift(cultivator.talents);
  const finalRate = Math.min(95, formula.baseSuccessRate + furnace.successRateBonus + talentBonus);

  // 8. 随机检定
  const roll = Math.random() * 100;
  const success = roll < finalRate;

  // 9. 执行事务
  const result = await prisma.$transaction(async (tx) => {
    // 扣除材料
    for (const mat of formula.materials) {
      const invItem = inventory.find((i: any) => i.itemId === mat.itemId);
      if (invItem) {
        invItem.quantity -= mat.amount;
        if (invItem.quantity <= 0) {
          const idx = inventory.indexOf(invItem);
          if (idx >= 0) inventory.splice(idx, 1);
        }
      }
    }

    let product: any = null;
    let quality: string | null = null;
    let furnaceBroken = false;

    if (success) {
      // 决定品质
      quality = determineQuality(furnace.qualityWeights, qualityLift);
      const productId = `${formula.productBaseId}_${quality}`;

      // 检查背包中是否已有该物品
      const existingProduct = inventory.find((i: any) => i.itemId === productId);
      if (existingProduct) {
        existingProduct.quantity += 1;
      } else {
        inventory.push({
          itemId: productId,
          name: `${formula.productName}`,
          quantity: 1,
          type: "pill",
        });
      }

      product = {
        itemId: productId,
        name: `${formula.productName}（${qualityName(quality)}）`,
        quantity: 1,
      };

      // 首次炼制成功 → 解锁关联配方（如同等级配方）
      await autoUnlockNextFormula(tx, cultivator.id, unlocked, formula.difficultyLevel);
    } else {
      // 炸炉判定（5%概率）
      if (Math.random() < 0.05 && furnaceId !== "bronze_furnace") {
        furnaceBroken = true;
        await tx.cultivator.update({
          where: { id: cultivator.id },
          data: { furnaceEquipped: "bronze_furnace" },
        });
      }
    }

    // 更新数据库
    await tx.cultivator.update({
      where: { id: cultivator.id },
      data: {
        stamina: { decrement: STAMINA_COST },
        inventory: JSON.stringify(inventory),
      },
    });

    return { product, quality, furnaceBroken };
  });

  // 10. 返回增量状态
  const newStamina = Math.max(0, (cultivator.stamina ?? 0) - STAMINA_COST);
  return NextResponse.json({
    success,
    stamina: newStamina,
    inventory,
    product: result.product,
    quality: result.quality,
    furnaceBroken: result.furnaceBroken,
    expGained: success ? formula.difficultyLevel * 10 : formula.difficultyLevel * 3,
  });
}

export const POST = withApiErrorHandling(postHandler);

// ============================================================
// 辅助函数
// ============================================================

function qualityName(q: string): string {
  const map: Record<string, string> = { low: "下品", mid: "中品", high: "上品", perfect: "极品" };
  return map[q] || q;
}

async function autoUnlockNextFormula(
  tx: any,
  cultivatorId: string,
  currentUnlocked: string[],
  difficulty: number
) {
  // 同难度配方在首次炼丹后自动解锁
  const allFormulas = getAllFormulas();
  const sameDifficulty = allFormulas.filter(
    (f) => f.difficultyLevel === difficulty && !currentUnlocked.includes(f.id)
  );
  if (sameDifficulty.length === 0) return;

  const newlyUnlocked = sameDifficulty.map((f) => f.id);
  const updatedUnlocked = [...currentUnlocked, ...newlyUnlocked];
  await tx.cultivator.update({
    where: { id: cultivatorId },
    data: { unlockedFormulas: JSON.stringify(updatedUnlocked) },
  });
}

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
