import { describe, it, expect } from "vitest";
import type { HouseholdIncome } from "@/lib/family-career";
import {
  calcPocketMoney,
  calcSavingsInterest,
  SAVINGS_INTEREST_RATE,
  type ParentLike,
} from "../savings";

const parent = (intimacy: number, incomeLevel: number): ParentLike => ({
  intimacy,
  incomeLevel,
});

describe("calcPocketMoney — 学段基础值", () => {
  it("小学基础 45（默认父母系数 1×1）", () => {
    const r = calcPocketMoney("小学", []);
    expect(r.base).toBe(45);
    expect(r.granted).toBe(45);
  });

  it("初中基础 90", () => {
    expect(calcPocketMoney("初中", []).granted).toBe(90);
  });

  it("高中基础 135", () => {
    expect(calcPocketMoney("高中", []).granted).toBe(135);
  });

  it("大学基础 180", () => {
    expect(calcPocketMoney("大学", []).granted).toBe(180);
  });

  it("无学段（如幼儿/觉醒后）发放 0", () => {
    const r = calcPocketMoney("幼儿园", []);
    expect(r.base).toBe(0);
    expect(r.granted).toBe(0);
  });

  it("空学段名发放 0", () => {
    expect(calcPocketMoney(null, []).granted).toBe(0);
    expect(calcPocketMoney(undefined, []).granted).toBe(0);
  });
});

describe("calcPocketMoney — 父母亲密度系数", () => {
  it("亲密度 <50 ×0.5", () => {
    const r = calcPocketMoney("小学", [parent(30, 1)]);
    expect(r.intimacyMult).toBe(0.5);
    expect(r.granted).toBe(Math.round(45 * 0.5));
  });

  it("亲密度 >80 ×1.5", () => {
    const r = calcPocketMoney("小学", [parent(90, 1)]);
    expect(r.intimacyMult).toBe(1.5);
    expect(r.granted).toBe(Math.round(45 * 1.5));
  });

  it("亲密度居中 ×1", () => {
    const r = calcPocketMoney("小学", [parent(65, 1)]);
    expect(r.intimacyMult).toBe(1);
    expect(r.granted).toBe(45);
  });

  it("多父母取平均亲密度", () => {
    // (40 + 100) / 2 = 70 → ×1
    const r = calcPocketMoney("小学", [parent(40, 1), parent(100, 1)]);
    expect(r.intimacyMult).toBe(1);
    expect(r.granted).toBe(45);
  });
});

describe("calcPocketMoney — 父母收入系数", () => {
  it("高收入（≥2）×1.5", () => {
    const r = calcPocketMoney("小学", [parent(50, 2)]);
    expect(r.incomeMult).toBe(1.5);
    expect(r.granted).toBe(Math.round(45 * 1.5));
  });

  it("低收入（≤0）×0.7", () => {
    const r = calcPocketMoney("小学", [parent(50, 0)]);
    expect(r.incomeMult).toBe(0.7);
    expect(r.granted).toBe(Math.round(45 * 0.7));
  });

  it("中等收入（1）×1", () => {
    const r = calcPocketMoney("小学", [parent(50, 1)]);
    expect(r.incomeMult).toBe(1);
  });

  it("双系数叠加（亲密<50 ×0.5，收入高 ×1.5）", () => {
    const r = calcPocketMoney("初中", [parent(30, 2)]);
    expect(r.intimacyMult).toBe(0.5);
    expect(r.incomeMult).toBe(1.5);
    expect(r.granted).toBe(Math.round(90 * 0.5 * 1.5));
  });

  it("缺省 incomeLevel 视为 1（×1）", () => {
    const r = calcPocketMoney("小学", [parent(50, undefined as unknown as number)]);
    expect(r.incomeMult).toBe(1);
  });

  it("统一 HouseholdIncome 档位覆盖父母排列顺序", () => {
    const household: HouseholdIncome = { monthlyIncome: 9000, contributingMembers: 2, incomeLevel: 2 };
    const firstLow = calcPocketMoney("小学", [parent(50, 0), parent(50, 2)], household);
    const firstHigh = calcPocketMoney("小学", [parent(50, 2), parent(50, 0)], household);
    expect(firstLow.incomeMult).toBe(1.5);
    expect(firstLow.granted).toBe(firstHigh.granted);
  });
});

describe("calcSavingsInterest — 年化利息", () => {
  it("无储蓄不计息", () => {
    expect(calcSavingsInterest(0)).toBe(0);
    expect(calcSavingsInterest(null)).toBe(0);
    expect(calcSavingsInterest(undefined)).toBe(0);
  });

  it("100 金 → 5 金（5%）", () => {
    expect(calcSavingsInterest(100)).toBe(5);
  });

  it("23 金 → 向下取整 1 金", () => {
    expect(calcSavingsInterest(23)).toBe(Math.round(23 * SAVINGS_INTEREST_RATE));
  });
});
