// 储蓄罐：零花钱计算（学段基础值 × 父母亲密度 × 家庭收入）与年化利息。
// 被 __tests__/savings.test.ts 使用。

import type { HouseholdIncome } from "./family-career";

export interface ParentLike {
  intimacy: number;
  incomeLevel: number;
}

export const SAVINGS_INTEREST_RATE = 0.05;

export interface PocketMoneyResult {
  base: number;
  granted: number;
  intimacyMult: number;
  incomeMult: number;
}

const STAGE_BASE: Record<string, number> = {
  小学: 45,
  初中: 90,
  高中: 135,
  大学: 180,
};

export function calcPocketMoney(
  stage: string | null | undefined,
  parents: ParentLike[],
  householdIncome?: HouseholdIncome,
): PocketMoneyResult {
  const base = stage && STAGE_BASE[stage] ? STAGE_BASE[stage] : 0;

  // 亲密度系数
  let intimacyMult = 1;
  if (parents.length > 0) {
    const avg = parents.reduce((s, p) => s + p.intimacy, 0) / parents.length;
    if (avg < 50) intimacyMult = 0.5;
    else if (avg > 80) intimacyMult = 1.5;
    else intimacyMult = 1;
  }

  // 收入系数：跨年结算传入全户统一档位，旧调用回退到首位家人。
  let incomeMult = 1;
  const sample = parents[0];
  const incomeLevel = householdIncome?.incomeLevel ?? (sample ? sample.incomeLevel : 1);
  if (typeof incomeLevel === "number") {
    if (incomeLevel >= 2) incomeMult = 1.5;
    else if (incomeLevel <= 0) incomeMult = 0.7;
    else incomeMult = 1;
  }

  const granted = Math.round(base * intimacyMult * incomeMult);
  return { base, granted, intimacyMult, incomeMult };
}

/** 年化利息：本金 × 5%，向下取整；空值返回 0。 */
export function calcSavingsInterest(amount: number | null | undefined): number {
  if (!amount || typeof amount !== "number" || amount <= 0) return 0;
  return Math.round(amount * SAVINGS_INTEREST_RATE);
}
