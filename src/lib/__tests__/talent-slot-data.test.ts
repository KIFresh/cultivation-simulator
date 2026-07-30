import { describe, it, expect } from "vitest";
import {
  MAX_SLOTS,
  UNLOCK_COSTS,
  computeTalentBonuses,
  upgradeCost,
  parseTalentSlots,
} from "../talent-slot-data";

describe("常量对齐决策 A", () => {
  it("槽上限 3、解锁成本 [2,5,12]", () => {
    expect(MAX_SLOTS).toBe(3);
    expect(UNLOCK_COSTS).toEqual([2, 5, 12]);
  });
  it("upgradeCost：约解锁成本 60% × 等级，封底 1", () => {
    expect(upgradeCost(0, 1)).toBe(1); // round(2×0.6×1)=1
    expect(upgradeCost(1, 3)).toBe(9); // round(5×0.6×3)=9
    expect(upgradeCost(2, 1)).toBe(7); // round(12×0.6×1)=7
  });
});

describe("parseTalentSlots", () => {
  it("null/undefined/empty → []", () => {
    expect(parseTalentSlots(null)).toEqual([]);
    expect(parseTalentSlots(undefined)).toEqual([]);
    expect(parseTalentSlots("")).toEqual([]);
  });
  it("invalid JSON → []", () => {
    expect(parseTalentSlots("{not json")).toEqual([]);
  });
  it("valid JSON → parsed", () => {
    expect(parseTalentSlots('[{"type":"daoti","level":3}]')).toEqual([{ type: "daoti", level: 3 }]);
  });
});

describe("computeTalentBonuses", () => {
  it("empty → all zero", () => {
    expect(computeTalentBonuses("[]")).toEqual({
      cultivationSpeed: 0,
      breakthroughRate: 0,
      combatPower: 0,
      gatherYield: 0,
    });
  });
  it("道体 level 5 → cultivationSpeed 15 (cap)", () => {
    expect(computeTalentBonuses('[{"type":"daoti","level":5}]').cultivationSpeed).toBe(15);
  });
  it("道体 level 10 → capped at 15", () => {
    expect(computeTalentBonuses('[{"type":"daoti","level":10}]').cultivationSpeed).toBe(15);
  });
  it("通明 level 5 → breakthroughRate 10 (cap)", () => {
    expect(computeTalentBonuses('[{"type":"tongming","level":5}]').breakthroughRate).toBe(10);
  });
  it("战魂 level 5 → combatPower 15 (cap)", () => {
    expect(computeTalentBonuses('[{"type":"zhanhun","level":5}]').combatPower).toBe(15);
  });
  it("灵慧 level 5 → gatherYield 20 (cap)", () => {
    expect(computeTalentBonuses('[{"type":"linghui","level":5}]').gatherYield).toBe(20);
  });
  it("combines multiple slots", () => {
    const b = computeTalentBonuses(
      '[{"type":"daoti","level":2},{"type":"tongming","level":3},{"type":"zhanhun","level":1},{"type":"linghui","level":1}]'
    );
    expect(b.cultivationSpeed).toBe(6); // 3×2
    expect(b.breakthroughRate).toBe(6); // 2×3
    expect(b.combatPower).toBe(3); // 3×1
    expect(b.gatherYield).toBe(4); // 4×1
  });
  it("ignores gengu/changsheng (applied at reincarnation, not cross-system)", () => {
    const b = computeTalentBonuses('[{"type":"gengu","level":5},{"type":"changsheng","level":5}]');
    expect(b.cultivationSpeed + b.breakthroughRate + b.combatPower + b.gatherYield).toBe(0);
  });
  it("unknown type ignored", () => {
    expect(computeTalentBonuses('[{"type":"ghost","level":3}]')).toEqual({
      cultivationSpeed: 0,
      breakthroughRate: 0,
      combatPower: 0,
      gatherYield: 0,
    });
  });
});
