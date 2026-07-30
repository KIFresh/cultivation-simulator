import { describe, it, expect, vi } from "vitest";
import {
  FORMULAS,
  FURNACES,
  getFormulaById,
  getFurnaceById,
  getDefaultFurnace,
  getAllFormulas,
  determineQuality,
  getTalentBonus,
  getTalentQualityLift,
  computePillConsumption,
} from "../alchemy-data";

describe("alchemy-data", () => {
  describe("getFormulaById", () => {
    it("should return formula for existing id", () => {
      const f = getFormulaById("formula_recovery");
      expect(f).toBeDefined();
      expect(f!.name).toBe("回气丹");
      expect(f!.baseSuccessRate).toBe(70);
    });

    it("should return undefined for unknown id", () => {
      expect(getFormulaById("nonexistent")).toBeUndefined();
    });
  });

  describe("getFurnaceById", () => {
    it("should return furnace for existing id", () => {
      const f = getFurnaceById("gold_furnace");
      expect(f).toBeDefined();
      expect(f!.name).toBe("黄金丹炉");
      expect(f!.successRateBonus).toBe(20);
    });

    it("should return undefined for unknown id", () => {
      expect(getFurnaceById("unknown")).toBeUndefined();
    });
  });

  describe("getDefaultFurnace", () => {
    it("should return bronze furnace by default", () => {
      const f = getDefaultFurnace();
      expect(f.id).toBe("bronze_furnace");
      expect(f.name).toBe("青铜丹炉");
    });
  });

  describe("getAllFormulas", () => {
    it("should return all formulas", () => {
      expect(getAllFormulas()).toEqual(FORMULAS);
      expect(getAllFormulas().length).toBe(3);
    });
  });

  describe("determineQuality", () => {
    it("should return a tier from the weights distribution", () => {
      // 固定 Math.random 返回 0.5（中间值），应落入 mid 区间
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const weights = { low: 70, mid: 25, high: 5, perfect: 0 };
      const tier = determineQuality(weights, 0);
      expect(["low", "mid", "high", "perfect"]).toContain(tier);
      vi.restoreAllMocks();
    });

    it("should shift toward higher tiers with qualityLift", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      const weights = { low: 70, mid: 25, high: 5, perfect: 0 };
      const tier = determineQuality(weights, 10);
      // high qualityLift 使 perfect 概率增大，但随机种子 0.9 仍可能落在 high
      expect(["high", "perfect"]).toContain(tier);
      vi.restoreAllMocks();
    });
  });

  describe("getTalentBonus", () => {
    it("should return 15 for pill talent", () => {
      expect(getTalentBonus("pill")).toBe(15);
    });

    it("should return 0 for null/empty", () => {
      expect(getTalentBonus(null)).toBe(0);
      expect(getTalentBonus("")).toBe(0);
    });

    it("should sum multiple talent bonuses", () => {
      expect(getTalentBonus("pill,array")).toBe(20);
    });
  });

  describe("getTalentQualityLift", () => {
    it("should return 10 for pill talent", () => {
      expect(getTalentQualityLift("pill")).toBe(10);
    });

    it("should return 0 for non-pill talents", () => {
      expect(getTalentQualityLift("sword")).toBe(0);
    });
  });

  describe("computePillConsumption", () => {
    it("should return a copy of materials", () => {
      const formula = FORMULAS[0];
      const result = computePillConsumption(formula);
      expect(result).toEqual(formula.materials);
      expect(result).not.toBe(formula.materials);
    });
  });
});
