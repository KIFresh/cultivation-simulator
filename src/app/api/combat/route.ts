import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCombat, type PlayerCombatData } from "@/lib/combat-engine";
import { requireCultivator, sanitizeString } from "@/lib/auth-helpers";
import {
  applyEffects,
  clampEffectsArray,
  type NarrativeEffect,
  type ClampConfig,
} from "@/lib/narrative-effects";
import { parseAttributes, parseInventory, mergeInventoryItems } from "@/lib/inventory-utils";
import { withApiErrorHandling, badRequest, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const enemyId = sanitizeString(body.enemyId, 50) ?? undefined;
  const locationId = sanitizeString(body.locationId, 50) ?? undefined;

  // 检查每日战斗次数上限
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const combatCount = await prisma.gameEvent.count({
    where: { cultivatorId: cultivator.id, type: "COMBAT", createdAt: { gte: today } },
  });
  if (combatCount >= 5) {
    return NextResponse.json(badRequest("今日战斗次数已达上限（5次）", "RATE_LIMITED").toJSON(), {
      status: 400,
    });
  }

  // 获取装备物品（解析失败安全回退）
  const inventory: { itemId: string; quantity: number; equipped: boolean }[] = [];
  try {
    const parsed = JSON.parse(cultivator.inventory || "[]");
    for (const item of parsed) {
      inventory.push({
        itemId: item.itemId,
        quantity: item.quantity ?? 1,
        equipped: !!item.equipped,
      });
    }
  } catch (e) {
    logger.warn("战斗: 解析库存失败，使用空数组", { cultivatorId: cultivator.id, cause: e });
  }

  // 获取功法记录
  const techniqueRecords = await prisma.cultivatorTechnique.findMany({
    where: { cultivatorId: cultivator.id, equipSlot: { not: null } },
  });

  const player: PlayerCombatData = {
    cultivator: {
      id: cultivator.id,
      name: cultivator.name,
      realm: cultivator.realm,
      realmLevel: cultivator.realmLevel,
      gold: cultivator.gold ?? 50,
      reincarnationCount: cultivator.reincarnationCount || 0,
      injuryDebuff: cultivator.injuryDebuff || 0,
      mindDemon: cultivator.mindDemon || 0,
    },
    attributes: parseAttributes(cultivator.attributes),
    equippedItems: inventory.filter((i) => i.equipped),
    inventory,
    techniqueRecords: techniqueRecords.map((r) => ({
      techniqueId: r.techniqueId,
      level: r.level,
    })),
  };

  const result = await resolveCombat(player, enemyId, locationId);

  // 持久化战斗结果
  let updatedCultivator: any = null;
  if (result.enemy && result.enemy.id !== "none") {
    const effects: NarrativeEffect[] = [];

    if (result.win && result.loot) {
      if (result.loot.gold !== 0) effects.push({ kind: "gold", delta: result.loot.gold });
    }
    if (!result.win && result.penalty) {
      if (result.penalty.goldLoss > 0) {
        effects.push({
          kind: "gold",
          delta: -Math.min(result.penalty.goldLoss, cultivator.gold ?? 50),
        });
      }
      if (result.penalty.mindDemonDelta) {
        effects.push({ kind: "mindDemon", delta: result.penalty.mindDemonDelta });
      }
    }

    const clampConfig: ClampConfig = {
      currentGold: cultivator.gold ?? 0,
      currentStamina: cultivator.stamina,
      maxStamina: 100,
      maxGoldAbsDelta: 10_000,
    };
    const clamped = clampEffectsArray(effects, clampConfig);

    await prisma.$transaction(async (tx: any) => {
      if (clamped.length > 0) {
        await applyEffects(clamped, tx, {
          cultivatorId: cultivator.id,
          currentGold: cultivator.gold ?? 0,
          currentStamina: cultivator.stamina,
          maxStamina: 100,
          cultivatorAge: cultivator.age,
        });
      }

      const extraData: Record<string, any> = {};
      if (result.win && result.loot) {
        if (result.loot.exp > 0) {
          extraData.cultivationExp = { increment: result.loot.exp };
          extraData.totalExp = { increment: result.loot.exp };
        }
        if (result.loot.items && result.loot.items.length > 0) {
          const currentInv = parseInventory(cultivator.inventory);
          const mergedInv = mergeInventoryItems(currentInv, result.loot.items);
          extraData.inventory = JSON.stringify(mergedInv);
        }
      }
      if (!result.win && result.penalty) {
        if (result.penalty.injuryDebuff > 0) extraData.injuryDebuff = result.penalty.injuryDebuff;
        if (result.penalty.lifespanLoss > 0) {
          extraData.maxAge = Math.max(1, (cultivator.maxAge ?? 80) - result.penalty.lifespanLoss);
        }
        if (result.penalty.itemLoss && result.penalty.itemLoss.length > 0) {
          const currentInv = JSON.parse(cultivator.inventory || "[]");
          for (const lostId of result.penalty.itemLoss) {
            const idx = currentInv.findIndex((i: any) => i.itemId === lostId && !i.equipped);
            if (idx !== -1) {
              currentInv[idx].quantity = (currentInv[idx].quantity ?? 1) - 1;
              if (currentInv[idx].quantity <= 0) currentInv.splice(idx, 1);
            }
          }
          extraData.inventory = JSON.stringify(currentInv);
        }
      }
      if (Object.keys(extraData).length > 0) {
        updatedCultivator = await tx.cultivator.update({
          where: { id: cultivator.id },
          data: extraData,
        });
      }

      await tx.gameEvent.create({
        data: {
          cultivatorId: cultivator.id,
          type: "COMBAT",
          title: result.win ? "战斗胜利" : "战斗失败",
          narrative: result.narrative,
          reward: JSON.stringify({
            win: result.win,
            style: result.style,
            enemy: result.enemy.name,
          }),
        },
      });
    });
  }

  return NextResponse.json({
    ...result,
    ...(updatedCultivator ? { cultivator: updatedCultivator } : {}),
  });
}

export const POST = withApiErrorHandling(handler);
