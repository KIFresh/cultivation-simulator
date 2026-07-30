// 跨阶段货币兑换：金币 ⇄ 灵石（下/中/上三档）。
// 双向同率，无套利：买 1 下品花 200 金、卖 1 下品得 200 金。

export type StoneTier = "low" | "mid" | "high";
export type ExchangeDirection = "goldToStone" | "stoneToGold";

export interface ExchangeBalances {
  gold: number;
  low: number;
  mid: number;
  high: number;
}

export interface StoneDelta {
  tier: StoneTier;
  amount: number;
}

export interface ExchangeResult {
  ok: boolean;
  goldDelta: number;
  stoneDelta: StoneDelta | null;
  error?: string;
}

/** 各档灵石折合金币的汇率（集中常量）。 */
export const GOLD_PER_STONE: Record<StoneTier, number> = {
  low: 200,
  mid: 2000,
  high: 10000,
};

export function tierLabel(tier: StoneTier): string {
  switch (tier) {
    case "low":
      return "下品灵石";
    case "mid":
      return "中品灵石";
    case "high":
      return "上品灵石";
  }
}

const VALID_TIERS: StoneTier[] = ["low", "mid", "high"];

/**
 * 计算一次兑换的增量。
 * - direction: goldToStone（金币换灵石） / stoneToGold（灵石换金币）
 * - tier: 灵石品级
 * - amount: 兑换数量（正整数）
 * - balances: 当前余额
 */
export function computeExchange(
  direction: ExchangeDirection,
  tier: string,
  amount: number,
  balances: ExchangeBalances
): ExchangeResult {
  if (!VALID_TIERS.includes(tier as StoneTier)) {
    return { ok: false, goldDelta: 0, stoneDelta: null, error: "无效的灵石品级" };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, goldDelta: 0, stoneDelta: null, error: "兑换数量必须为正整数" };
  }

  const t = tier as StoneTier;
  const rate = GOLD_PER_STONE[t];

  if (direction === "goldToStone") {
    const cost = rate * amount;
    if (balances.gold < cost) {
      return { ok: false, goldDelta: 0, stoneDelta: null, error: "金币不足" };
    }
    return { ok: true, goldDelta: -cost, stoneDelta: { tier: t, amount } };
  }

  // stoneToGold
  const have = balances[t];
  if (have < amount) {
    return { ok: false, goldDelta: 0, stoneDelta: null, error: "灵石不足" };
  }
  return { ok: true, goldDelta: rate * amount, stoneDelta: { tier: t, amount: -amount } };
}
