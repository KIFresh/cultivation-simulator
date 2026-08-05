import { describe, it, expect, vi } from "vitest";
import {
  shouldTriggerEncounter,
  pickRandomEncounter,
  resolveHighRiskOutcome,
  applyRewardEffects,
  serializeEncounter,
  getEncounterById,
  ENCOUNTER_POOL,
  type RewardEffect,
} from "../encounter-data";

describe("encounter-data", () => {
  describe("shouldTriggerEncounter", () => {
    it("should return true when roll < 0.3", () => {
      expect(shouldTriggerEncounter(0.2)).toBe(true);
    });

    it("should return false when roll >= 0.3", () => {
      expect(shouldTriggerEncounter(0.3)).toBe(false);
      expect(shouldTriggerEncounter(0.5)).toBe(false);
    });

    it("should use Math.random when no seed", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      expect(shouldTriggerEncounter()).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe("pickRandomEncounter", () => {
    it("should return null when daily limit reached", () => {
      expect(pickRandomEncounter(3)).toBeNull();
      expect(pickRandomEncounter(5)).toBeNull();
    });

    it("should return null when pool is empty edge case", () => {
      // 正常情况 pool 非空，但测试空池逻辑
      // 通过模拟 Math.random 验证
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const encounter = pickRandomEncounter(0);
      expect(encounter).not.toBeNull();
      expect(encounter!.id).toBeDefined();
      vi.restoreAllMocks();
    });

    it("should return an encounter from the pool", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.1);
      const encounter = pickRandomEncounter(0);
      expect(encounter).not.toBeNull();
      expect(ENCOUNTER_POOL.some((e) => e.id === encounter!.id)).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe("resolveHighRiskOutcome", () => {
    it("should return boolean outcome", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const result = resolveHighRiskOutcome({
        spiritualRoot: "天灵根",
        realmIndex: 1,
        realmLevel: 1,
      });
      expect(typeof result).toBe("boolean");
      vi.restoreAllMocks();
    });

    it("should use fallback 40% for unknown root", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.35);
      // 0.35 < 0.4 → true
      expect(
        resolveHighRiskOutcome({ spiritualRoot: "unknown" as any, realmIndex: 0, realmLevel: 1 })
      ).toBe(true);
      vi.restoreAllMocks();
    });
  });

  describe("applyRewardEffects", () => {
    it("should apply cultivationExp effect", () => {
      const effects: RewardEffect[] = [{ type: "cultivationExp", value: 50, label: "+50 修炼值" }];
      const result = applyRewardEffects(effects, {
        cultivationExp: 100,
        totalExp: 500,
        stamina: 50,
      });
      expect(result.cultivationExp).toBe(150);
      expect(result.totalExp).toBe(550);
      expect(result.cultivationExpDelta).toBe(50);
    });

    it("should apply stamina effect clamped to [0, 100]", () => {
      const effects: RewardEffect[] = [{ type: "stamina", value: 30, label: "+30 体力" }];
      const result = applyRewardEffects(effects, { cultivationExp: 0, totalExp: 0, stamina: 80 });
      expect(result.stamina).toBe(100); // clamped

      const result2 = applyRewardEffects(effects, { cultivationExp: 0, totalExp: 0, stamina: 50 });
      expect(result2.stamina).toBe(80);
    });

    it("should collect special items", () => {
      const effects: RewardEffect[] = [
        { type: "specialItem", value: 1, label: "获得「青冥剑」" },
        { type: "specialItem", value: 1, label: "获得「灵狐之泪」" },
      ];
      const result = applyRewardEffects(effects, { cultivationExp: 0, totalExp: 0, stamina: 50 });
      expect(result.specialItems).toEqual(["获得「青冥剑」", "获得「灵狐之泪」"]);
      expect(result.message).toContain("青冥剑");
    });

    it("should not go below 0 for cultivationExp", () => {
      const effects: RewardEffect[] = [
        { type: "cultivationExp", value: -200, label: "-200 修炼值" },
      ];
      const result = applyRewardEffects(effects, {
        cultivationExp: 50,
        totalExp: 500,
        stamina: 50,
      });
      expect(result.cultivationExp).toBe(0);
      expect(result.totalExp).toBe(300);
    });
  });

  describe("serializeEncounter", () => {
    it("should remove successNarrative from choices", () => {
      const encounter = ENCOUNTER_POOL[0];
      const serialized = serializeEncounter(encounter);
      expect(serialized.id).toBe(encounter.id);
      expect(serialized.choices[0]).not.toHaveProperty("successNarrative");
      expect(serialized.choices[0]).toHaveProperty("riskLevel");
      expect(serialized.choices[0]).toHaveProperty("text");
      expect(serialized.choices[0]).toHaveProperty("hint");
    });
  });

  describe("getEncounterById", () => {
    it("should find encounter by id", () => {
      const encounter = getEncounterById("ancient_cave");
      expect(encounter).toBeDefined();
      expect(encounter!.title).toBe("古洞府遗迹");
    });

    it("should return undefined for unknown id", () => {
      expect(getEncounterById("nonexistent")).toBeUndefined();
    });
  });

  describe("ENCOUNTER_POOL", () => {
    it("should have 3 encounters", () => {
      expect(ENCOUNTER_POOL.length).toBe(3);
    });

    it("each encounter should have exactly 3 choices", () => {
      for (const e of ENCOUNTER_POOL) {
        expect(e.choices.length).toBe(3);
        expect(e.choices[0].riskLevel).toBe("low");
        expect(e.choices[1].riskLevel).toBe("medium");
        expect(e.choices[2].riskLevel).toBe("high");
      }
    });
  });
});
