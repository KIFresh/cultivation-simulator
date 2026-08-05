import type { HouseholdIncome } from "./family-career";

export interface AllowanceParent {
  intimacy: number;
  incomeLevel: number | null | undefined;
}

const AGE_BASE: Array<{ maxAge: number; base: number }> = [
  // 幼儿可获得象征性零花钱；实际是否发放仍由关系、收入、语气与额度共同决定。
  { maxAge: 3, base: 1 },
  { maxAge: 6, base: 8 },
  { maxAge: 12, base: 24 },
  { maxAge: 15, base: 48 },
  { maxAge: 21, base: 72 },
];

export function getAllowanceAgeBase(age: number): number {
  return AGE_BASE.find((band) => age <= band.maxAge)?.base ?? 96;
}

export function getHouseholdIncomeMultiplier(
  parents: AllowanceParent[],
  householdIncome?: HouseholdIncome
): number {
  if (parents.length === 0) return 0;
  // 新结算路径传入全户统一档位；保留旧参数回退以兼容历史调用。
  const incomeLevel =
    householdIncome?.incomeLevel ?? Math.max(...parents.map((parent) => parent.incomeLevel ?? 1));
  if (incomeLevel <= 0) return 0.7;
  if (incomeLevel >= 2) return 1.5;
  return 1;
}

export function getHouseholdIntimacyMultiplier(parents: AllowanceParent[]): number {
  if (parents.length === 0) return 0;
  const average = parents.reduce((total, parent) => total + parent.intimacy, 0) / parents.length;
  if (average < 20) return 0.4;
  if (average < 50) return 0.75;
  if (average >= 80) return 1.2;
  return 1;
}

/** 跨年生成一次的可领取零花钱总额。 */
export function calculateAnnualFamilyAllowance(
  age: number,
  parents: AllowanceParent[],
  householdIncome?: HouseholdIncome
): number {
  const base = getAllowanceAgeBase(age);
  if (base <= 0 || parents.length === 0) return 0;
  return Math.max(
    1,
    Math.floor(
      base *
        getHouseholdIncomeMultiplier(parents, householdIncome) *
        getHouseholdIntimacyMultiplier(parents)
    )
  );
}
