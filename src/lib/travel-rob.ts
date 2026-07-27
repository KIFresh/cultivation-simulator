// travel-rob.ts — 坊市越阶夺宝纯逻辑
// ═══════════════════════════════════════════════════════════════════════════
// 规则：
// 1. 玩家从 market 离开时触发检查
// 2. 背包中存在越境购买（minRealm > cultivator.realm）且无遮掩手段（talisman_shield）时，15% 概率触发
// 3. 敌方战力 = 目标物品价格 × 3（可配置系数）
// 4. 每日最多一次（milestones JSON 记录 robDate/robCount）
// 5. 战败时丢失最高价值越境物品

import { SHOP_ITEMS, REALM_ORDER, ITEMS } from "./cultivation-data";
import type { Enemy } from "./enemy-data";

const ROB_CHANCE = 0.15;
const ENEMY_POWER_COEFF = 3;
const CONCEAL_ITEM = "talisman_shield";

function realmIndex(realm: string): number {
  const idx = REALM_ORDER.indexOf(realm);
  return idx >= 0 ? idx : 0;
}

function parseInventory(raw: string | null | undefined): { itemId: string; quantity: number; equipped: boolean }[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function parseMilestones(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

export interface RobContext {
  cultivator: { realm: string; location: string | null; inventory: string | null; milestones: string | null };
}

export interface RobPreview {
  triggered: boolean;
  enemyName?: string;
  enemyCombatPower?: number;
  targetItemId?: string;
  targetItemName?: string;
  robCount?: number;
}

/**
 * 预览是否触发夺宝（不修改任何状态）
 */
export function previewRob(ctx: RobContext): RobPreview {
  if (ctx.cultivator.location !== "market") return { triggered: false };
  const inv = parseInventory(ctx.cultivator.inventory);
  const ms = parseMilestones(ctx.cultivator.milestones);
  const today = todayKey();
  if (ms.robDate === today) return { triggered: false, robCount: ms.robCount || 0 };
  // 寻找越境物品（minRealm > cultivator.realm 且不是遮掩物品）
  const overpriced = SHOP_ITEMS.filter((s) => {
    if (!s.minRealm) return false;
    if (s.itemId === CONCEAL_ITEM) return false;
    return realmIndex(s.minRealm) > realmIndex(ctx.cultivator.realm);
  });
  const target = overpriced.find((s) => inv.some((e) => e.itemId === s.itemId));
  if (!target) return { triggered: false };
  const item = ITEMS[target.itemId];
  return {
    triggered: true,
    enemyName: "夺宝者",
    enemyCombatPower: target.price * ENEMY_POWER_COEFF,
    targetItemId: target.itemId,
    targetItemName: item?.name || target.itemId,
    robCount: ms.robCount || 0,
  };
}

/**
 * 执行夺宝（在事务内调用）
 * 返回需要更新的 milestones 片段 + 是否丢失物品
 */
export function applyRobResult(
  ctx: RobContext,
  win: boolean,
  targetItemId: string,
): { milestonesPatch: Record<string, any>; lostItemId?: string } {
  const today = todayKey();
  const ms = parseMilestones(ctx.cultivator.milestones);
  const patch: Record<string, any> = {};
  patch.robDate = today;
  patch.robCount = (ms.robCount || 0) + 1;
  if (!win) {
    return { milestonesPatch: patch, lostItemId: targetItemId };
  }
  return { milestonesPatch: patch };
}
