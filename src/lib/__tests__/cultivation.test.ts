import { describe, it, expect } from "vitest";
import {
  isAwakened,
  getCurrentRealm,
  getNextRealm,
  getRequiredExp,
  canBreakthrough,
  performBreakthrough,
  calculateMaxAge,
  formatRealmLevel,
  calculateActionExp,
  getAvailableActions,
  calculateMaxStamina,
  REALMS,
} from "../cultivation-data";

describe("cultivation", () => {
  describe("境界突破", () => {
    it("should detect awakened state correctly", () => {
      expect(isAwakened("凡人")).toBe(false);
      expect(isAwakened("炼气期")).toBe(true);
      expect(isAwakened("筑基期")).toBe(true);
    });

    it("should get next realm in sequence", () => {
      expect(getNextRealm("凡人")?.name).toBe("炼气期");
      expect(getNextRealm("炼气期")?.name).toBe("筑基期");
      expect(getNextRealm("大乘期")?.name).toBe("渡劫期");
      expect(getNextRealm("渡劫期")).toBeUndefined();
    });

    it("should calculate required exp for each level", () => {
      // 炼气期第1层: 50
      expect(getRequiredExp("炼气期", 1)).toBe(50);
      // 炼气期第5层: 50 + 4*10 = 90
      expect(getRequiredExp("炼气期", 5)).toBe(90);
      // 筑基期第1层: 600
      expect(getRequiredExp("筑基期", 1)).toBe(600);
      // 凡人: 50
      expect(getRequiredExp("凡人", 0)).toBe(50);
    });

    it("should allow breakthrough when exp is sufficient", () => {
      // 炼气期第1层需要50exp
      expect(canBreakthrough("炼气期", 1, 50, "天灵根")).toBe(true);
      expect(canBreakthrough("炼气期", 1, 49, "天灵根")).toBe(false);
    });

    it("should not allow breakthrough for 凡人", () => {
      expect(canBreakthrough("凡人", 0, 999, "天灵根")).toBe(false);
    });

    it("should not allow breakthrough at max level of last realm", () => {
      // 渡劫期只有1层，是最后境界
      expect(canBreakthrough("渡劫期", 1, 999999, "天灵根")).toBe(false);
    });

    it("should perform breakthrough within same realm", () => {
      const result = performBreakthrough("炼气期", 1, 100);
      expect(result).not.toBeNull();
      expect(result!.newRealm).toBe("炼气期");
      expect(result!.newLevel).toBe(2);
      expect(result!.newExp).toBe(50); // 100 - 50
    });

    it("should advance to next realm at max level", () => {
      // 炼气期第13层，需要50 + 12*10 = 170
      const result = performBreakthrough("炼气期", 13, 200);
      expect(result).not.toBeNull();
      expect(result!.newRealm).toBe("筑基期");
      expect(result!.newLevel).toBe(1);
      expect(result!.newExp).toBe(30); // 200 - 170
    });

    it("should return null for 凡人 breakthrough", () => {
      expect(performBreakthrough("凡人", 0, 100)).toBeNull();
    });
  });

  describe("寿元计算", () => {
    it("should calculate max age with realm base", () => {
      expect(calculateMaxAge("凡人", {})).toBe(80);
      expect(calculateMaxAge("炼气期", {})).toBe(100);
      expect(calculateMaxAge("筑基期", {})).toBe(200);
    });

    it("should add attribute bonuses", () => {
      const age = calculateMaxAge("筑基期", { root: 10, mind: 5 });
      expect(age).toBe(200 + 20 + 5); // base + root*2 + mind*1
    });

    it("should add bonus age", () => {
      expect(calculateMaxAge("凡人", {}, 30)).toBe(110);
    });
  });

  describe("境界显示", () => {
    it("should format 炼气期 layers correctly", () => {
      expect(formatRealmLevel("炼气期", 1)).toBe("第一层");
      expect(formatRealmLevel("炼气期", 5)).toBe("第五层");
      expect(formatRealmLevel("炼气期", 13)).toBe("第十三层");
    });

    it("should format other realms as 初期/中期/后期", () => {
      expect(formatRealmLevel("筑基期", 1)).toBe("初期");
      expect(formatRealmLevel("筑基期", 2)).toBe("中期");
      expect(formatRealmLevel("筑基期", 3)).toBe("后期");
    });

    it("should return empty string for 凡人", () => {
      expect(formatRealmLevel("凡人", 0)).toBe("");
    });
  });

  describe("行动经验计算", () => {
    it("should return fallback for unknown action", () => {
      expect(calculateActionExp("UNKNOWN", "天灵根")).toBe(5);
    });

    it("should calculate base exp for MEDITATE", () => {
      const exp = calculateActionExp("MEDITATE", "天灵根", { spirit: 10 });
      // 30 * 1.5 * (1 + 10*0.05) = 45 * 1.5 = 67.5 → floor 67
      expect(exp).toBeGreaterThan(0);
    });

    it("should reduce exp when injured", () => {
      const normal = calculateActionExp(
        "MEDITATE",
        "天灵根",
        { spirit: 0 },
        [],
        0,
        undefined,
        1,
        0
      );
      const injured = calculateActionExp(
        "MEDITATE",
        "天灵根",
        { spirit: 0 },
        [],
        0,
        undefined,
        1,
        1
      );
      expect(injured).toBeLessThanOrEqual(normal);
    });
  });

  describe("行动可用性", () => {
    it("should filter by age on earth", () => {
      const actions = getAvailableActions("earth", 10, "凡人");
      expect(actions.length).toBeGreaterThan(0);
      // 所有行动应该 <= 10岁
      expect(actions.every((a) => a.minAgeEarth <= 10)).toBe(true);
    });
  });

  describe("体力上限", () => {
    it("should return 5 for age <= 0", () => {
      expect(calculateMaxStamina(0)).toBe(5);
    });

    it("should return 20 for age >= 18", () => {
      expect(calculateMaxStamina(18)).toBe(20);
    });

    it("should include root bonus", () => {
      expect(calculateMaxStamina(18, { root: 10 })).toBe(25);
    });
  });

  describe("境界数据完整性", () => {
    it("should have 9 realms defined", () => {
      expect(REALMS.length).toBe(9);
      expect(REALMS[0].name).toBe("炼气期");
      expect(REALMS[8].name).toBe("渡劫期");
    });

    it("should have ascending exp requirements", () => {
      for (let i = 1; i < REALMS.length; i++) {
        expect(REALMS[i].expRequired).toBeGreaterThan(REALMS[i - 1].expRequired);
      }
    });
  });
});
