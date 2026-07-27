// ============================================================
// 修仙模拟器 — 灵石修炼增幅（🟡-3）
// ============================================================
// 设计决策（设计急救清单 🟡末项，用户 2026-07-23 拍板：甲 增幅）：
//   - 灵石分下/中/上三品，各品均可作为修炼资源消耗，增幅随品级递增（下<中<上）。
//   - 灵石在修炼里定位为「增幅」而非「门槛」：不烧灵石也能修炼（保底免费修行）。
//   - 灵石与行动点叠加：烧灵石不省行动点、只增产。
//
// 本模块为纯计算，不触碰 DB / schema。三档灵石库存由调用方以
// SpiritStoneInventory 传入（DB 三档列 spiritStoneLow/Mid/High 待主理人
// 加入 schema 后由调用方填充）。
// ============================================================

export type SpiritStoneTier = "none" | "low" | "mid" | "high";

// 各品灵石对修炼产出的倍率（下<中<上）
export const SPIRIT_STONE_TIER_MULT: Record<SpiritStoneTier, number> = {
  none: 1,
  low: 1.2,
  mid: 1.6,
  high: 2.2,
};

// 三档灵石库存（模拟 DB 列；实际值由调用方从 schema 读取）
export interface SpiritStoneInventory {
  low: number;
  mid: number;
  high: number;
}

// 取得某档灵石对应的修炼产出倍率
export function getCultivationTierMult(tier: SpiritStoneTier): number {
  return SPIRIT_STONE_TIER_MULT[tier];
}

// 校验某档灵石是否可消耗（数量足够）
export function canConsumeStone(tier: SpiritStoneTier, inv: SpiritStoneInventory): boolean {
  if (tier === "none") return true;
  return inv[tier] > 0;
}

// 计算本次修炼的灵石消耗：返回产出倍率 + 扣减后的库存 + 是否实际烧了灵石。
// 不烧也能练（保底免费）：tier=none 或该档库存不足时 applied=false、倍率=1。
export function consumeStoneForCultivation(
  tier: SpiritStoneTier,
  inv: SpiritStoneInventory
): { mult: number; remaining: SpiritStoneInventory; applied: boolean } {
  if (tier === "none" || inv[tier] <= 0) {
    return { mult: 1, remaining: inv, applied: false };
  }
  const remaining: SpiritStoneInventory = { ...inv, [tier]: inv[tier] - 1 };
  return { mult: SPIRIT_STONE_TIER_MULT[tier], remaining, applied: true };
}

// 便捷封装：直接算「基础产出 × 档位倍率」并扣库存。
// 修炼产出取整（避免浮点倍率 2.2 等导致的精度尾巴）。
export function calcCultivationWithStone(
  baseGain: number,
  tier: SpiritStoneTier,
  inv: SpiritStoneInventory
): { gain: number; remaining: SpiritStoneInventory; applied: boolean } {
  const { mult, remaining, applied } = consumeStoneForCultivation(tier, inv);
  return { gain: Math.round(baseGain * mult), remaining, applied };
}
