import { describe, it, expect, vi } from "vitest";
import {
  SPIRITUAL_ROOTS,
  getRootInfo,
  isAwakened,
  REALMS,
  getCurrentRealm,
  getNextRealm,
  getRequiredExp,
  canBreakthrough,
  performBreakthrough,
  calculateMaxAge,
  formatRealmLevel,
  getAvailableActions,
  getActionById,
  getLocationActionBonus,
  calculateActionExp,
  getItemById,
  ITEMS,
  getShopItems,
  getSchoolStage,
  getSchoolGrade,
  getDefaultOccupation,
  getNPCsAtLocation,
  calculateSchoolRank,
  getSchoolName,
  LOCATIONS,
  getUnlockedLocations,
  calcTravelCost,
  calcTravelCostByMode,
  calculateMaxStamina,
  calculateYearlyAttributeGrowth,
  parseOccupationFromNarrative,
  getAvailableActivities,
  applyActivityEffects,
  getStartingGold,
  dbToSchoolRank,
  schoolRankToDb,
  ACTIONS,
  getRealmIndex,
  isRealmSufficient,
  getActionsWithLockInfo,
} from "../cultivation-data";

describe("cultivation-data", () => {
  // ── 灵根系统 ──
  describe("SPIRITUAL_ROOTS", () => {
    it("should return old root info by name", () => {
      const info = SPIRITUAL_ROOTS["天灵根"];
      expect(info).toBeDefined();
      expect(info.speedBonus).toBe(1.5);
      expect(info.rarity).toBe(5);
    });

    it("should return composite root info for element_quality key", () => {
      const info = SPIRITUAL_ROOTS["金_上品"];
      expect(info).toBeDefined();
      expect(info.speedBonus).toBe(1.6);
    });

    it("should return undefined for unknown key", () => {
      expect(SPIRITUAL_ROOTS["nonexistent"]).toBeUndefined();
    });
  });

  describe("getRootInfo", () => {
    it("should return base info for known root", () => {
      const info = getRootInfo("天灵根");
      expect(info.speedBonus).toBe(1.5);
    });

    it("should apply past-life memory bonus", () => {
      const info = getRootInfo("天灵根", ["前世记忆"], 3);
      expect(info.speedBonus).toBeCloseTo(1.5 * 1.3);
    });

    it("should return fallback for unknown root", () => {
      const info = getRootInfo("unknown");
      expect(info.speedBonus).toBe(1.0);
    });
  });

  // ── 境界系统 ──
  describe("isAwakened", () => {
    it("should return false for 凡人", () => expect(isAwakened("凡人")).toBe(false));
    it("should return true for any realm", () => expect(isAwakened("炼气期")).toBe(true));
  });

  describe("getCurrentRealm", () => {
    it("should return realm data for valid realm", () => {
      const r = getCurrentRealm("筑基期");
      expect(r).toBeDefined();
      expect(r!.name).toBe("筑基期");
    });
    it("should return undefined for 凡人", () => expect(getCurrentRealm("凡人")).toBeUndefined());
  });

  describe("getNextRealm", () => {
    it("should return 炼气期 for 凡人", () => {
      expect(getNextRealm("凡人")?.name).toBe("炼气期");
    });
    it("should return undefined for 渡劫期", () => {
      expect(getNextRealm("渡劫期")).toBeUndefined();
    });
  });

  describe("getRequiredExp", () => {
    it("should return 50 for 凡人", () => expect(getRequiredExp("凡人", 0)).toBe(50));
    it("should calculate exp for realm level", () => {
      expect(getRequiredExp("炼气期", 1)).toBe(50); // 50 + 0*10
      expect(getRequiredExp("炼气期", 2)).toBe(60); // 50 + 1*10
    });
  });

  describe("canBreakthrough", () => {
    it("should return false for 凡人", () => {
      expect(canBreakthrough("凡人", 0, 100, "天灵根")).toBe(false);
    });
    it("should return true when exp meets threshold", () => {
      expect(canBreakthrough("炼气期", 1, 100, "天灵根")).toBe(true);
    });
    it("should return false when exp too low", () => {
      expect(canBreakthrough("炼气期", 1, 10, "天灵根")).toBe(false);
    });
  });

  describe("performBreakthrough", () => {
    it("should return null for 凡人", () => {
      expect(performBreakthrough("凡人", 0, 100)).toBeNull();
    });
    it("should advance level within same realm", () => {
      const result = performBreakthrough("炼气期", 1, 100);
      expect(result).not.toBeNull();
      expect(result!.newRealm).toBe("炼气期");
      expect(result!.newLevel).toBe(2);
    });
    it("should advance to next realm at max level", () => {
      // 炼气期 max level = 13, expRequired=50, expIncrement=10
      // 第13层需要 50 + 12*10 = 170
      const result = performBreakthrough("炼气期", 13, 200);
      expect(result).not.toBeNull();
      expect(result!.newRealm).toBe("筑基期");
      expect(result!.newLevel).toBe(1);
    });
  });

  // ── 寿元系统 ──
  describe("calculateMaxAge", () => {
    it("should return base lifespan for 凡人", () => {
      expect(calculateMaxAge("凡人", {})).toBe(80);
    });
    it("should include root and mind bonuses", () => {
      const age = calculateMaxAge("筑基期", { root: 10, mind: 5 });
      expect(age).toBeGreaterThan(200);
    });
    it("should include bonusAge", () => {
      expect(calculateMaxAge("凡人", {}, 50)).toBe(130);
    });
  });

  // ── 境界显示 ──
  describe("formatRealmLevel", () => {
    it("should return empty for 凡人", () => expect(formatRealmLevel("凡人", 0)).toBe(""));
    it("should return 炼气期 layer labels", () => {
      expect(formatRealmLevel("炼气期", 1)).toBe("第一层");
      expect(formatRealmLevel("炼气期", 13)).toBe("第十三层");
    });
    it("should return 初期/中期/后期 for other realms", () => {
      expect(formatRealmLevel("筑基期", 1)).toBe("初期");
      expect(formatRealmLevel("筑基期", 3)).toBe("后期");
    });
  });

  // ── 行动系统 ──
  describe("getAvailableActions", () => {
    it("should filter by age and realm for earth world", () => {
      const actions = getAvailableActions("earth", 10, "凡人");
      expect(actions.every((a) => a.minAgeEarth <= 10)).toBe(true);
      expect(actions.some((a) => a.minRealm && a.minRealm !== "凡人")).toBe(false);
    });
    it("should return all actions for non-earth world", () => {
      const actions = getAvailableActions("other", 1, "凡人");
      expect(actions.length).toBe(ACTIONS.length);
    });
    it("should include Spirit Sense for 结丹期", () => {
      const actions = getAvailableActions("earth", 20, "结丹期");
      expect(actions.some((a) => a.id === "SPIRIT_SENSE")).toBe(true);
    });
    it("should not return high-realm actions for unknown realm", () => {
      const actions = getAvailableActions("earth", 20, "unknown_realm");
      expect(actions.some((a) => a.id === "SPIRIT_SENSE")).toBe(false);
    });
  });

  describe("getActionById", () => {
    it("should find action by id", () => {
      expect(getActionById("MEDITATE")?.name).toBe("打坐修炼");
    });
    it("should return undefined for unknown", () => {
      expect(getActionById("NONEXISTENT")).toBeUndefined();
    });
  });

  describe("getLocationActionBonus", () => {
    it("should return 1 for unknown location", () => {
      expect(getLocationActionBonus("nowhere", "MEDITATE")).toBe(1);
    });
  });

  describe("calculateActionExp", () => {
    it("should return fallback 5 for unknown action", () => {
      expect(calculateActionExp("UNKNOWN", "天灵根")).toBe(5);
    });
    it("should calculate exp for known action", () => {
      const exp = calculateActionExp("MEDITATE", "天灵根", { spirit: 10 });
      expect(exp).toBeGreaterThan(0);
    });
    it("should halve exp when injured", () => {
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

  // ── 物品系统 ──
  describe("getItemById", () => {
    it("should return item by id", () => {
      expect(getItemById("wooden_sword")?.name).toBe("木剑");
    });
    it("should return undefined for unknown", () => {
      expect(getItemById("nonexistent")).toBeUndefined();
    });
  });

  describe("getShopItems", () => {
    it("should return items with resolved item data", () => {
      const items = getShopItems();
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].item).toBeDefined();
    });
  });

  // ── 学校系统 ──
  describe("getSchoolStage", () => {
    it("should return correct stage for age", () => {
      expect(getSchoolStage(8)?.name).toBe("小学");
      expect(getSchoolStage(16)?.name).toBe("高中");
    });
    it("should return null for out-of-range age", () => {
      expect(getSchoolStage(1)).toBeNull();
      expect(getSchoolStage(25)).toBeNull();
    });
  });

  describe("getSchoolGrade", () => {
    it("should calculate grade", () => {
      const stage = getSchoolStage(8)!;
      expect(getSchoolGrade(8, stage)).toBe(3);
    });
  });

  describe("getDefaultOccupation", () => {
    it("should return 婴儿 for age < 3", () => expect(getDefaultOccupation(1)).toBe("婴儿"));
    it("should return 学生 for age 3-21", () => expect(getDefaultOccupation(16)).toBe("学生"));
    it("should return 散修 for age >= 22", () => expect(getDefaultOccupation(22)).toBe("散修"));
  });

  // ── NPC 系统 ──
  describe("getNPCsAtLocation", () => {
    it("should return NPCs for known location", () => {
      const npcs = getNPCsAtLocation("school");
      expect(npcs.length).toBeGreaterThan(0);
    });
    it("should return empty for unknown location", () => {
      expect(getNPCsAtLocation("nowhere")).toEqual([]);
    });
  });

  describe("calculateSchoolRank", () => {
    it("should return 普通 for low attributes", () => {
      expect(calculateSchoolRank(10, { insight: 1 })).toBe("普通");
    });
    it("should return 名校 for high attributes", () => {
      expect(
        calculateSchoolRank(18, {
          insight: 20,
          mind: 15,
          root: 10,
          spirit: 10,
          luck: 10,
          charm: 10,
        })
      ).toBe("名校");
    });
  });

  // ── 地点系统 ──
  describe("getUnlockedLocations", () => {
    it("should return age-appropriate locations", () => {
      const locs = getUnlockedLocations(10, false);
      expect(locs.every((l) => l.unlockAge <= 10)).toBe(true);
    });
    it("should include requireAwakened locations when awakened", () => {
      const locs = getUnlockedLocations(16, true);
      expect(locs.some((l) => l.id === "wild")).toBe(true);
    });
    it("should include narratively unlocked locations", () => {
      const locs = getUnlockedLocations(5, false, ["wild"]);
      expect(locs.some((l) => l.id === "wild")).toBe(true);
    });
  });

  describe("calcTravelCost", () => {
    it("should compute distance between locations", () => {
      const cost = calcTravelCost("home", "wild");
      expect(cost).toBeGreaterThan(0);
    });
    it("should return 1 for unknown location", () => {
      expect(calcTravelCost("home", "nowhere")).toBe(1);
    });
  });

  describe("calcTravelCostByMode", () => {
    it("should return stamina and gold costs", () => {
      const costs = calcTravelCostByMode("home", "wild", "walk");
      expect(costs.staminaCost).toBeGreaterThan(0);
      expect(costs.goldCost).toBe(0);
    });
  });

  // ── 体力系统 ──
  describe("calculateMaxStamina", () => {
    it("should return 5 for age <= 0", () => expect(calculateMaxStamina(0)).toBe(5));
    it("should return 20 for age >= 18", () => expect(calculateMaxStamina(18)).toBe(20));
    it("should include root bonus", () => {
      expect(calculateMaxStamina(18, { root: 10 })).toBe(25);
    });
    it("should preserve root bonus at the initial age", () => {
      expect(calculateMaxStamina(1, { root: 2 })).toBe(7);
    });
  });

  // ── 属性成长 ──
  describe("calculateYearlyAttributeGrowth", () => {
    it("should return same attributes for age >= 18", () => {
      const result = calculateYearlyAttributeGrowth(18, 20, { root: 10 });
      expect(result).toEqual({ root: 10 });
    });
    it("should grow attributes for children", () => {
      const result = calculateYearlyAttributeGrowth(0, 1, {
        root: 5,
        spirit: 5,
        insight: 5,
        luck: 5,
        charm: 5,
        mind: 5,
      });
      expect(result.root).toBeGreaterThanOrEqual(5);
    });
  });

  // ── 职业解析 ──
  describe("parseOccupationFromNarrative", () => {
    it("should detect 辍学", () =>
      expect(parseOccupationFromNarrative("他决定辍学", "")).toBe("辍学"));
    it("should detect 炼丹师", () =>
      expect(parseOccupationFromNarrative("开始炼丹", "")).toBe("炼丹师"));
    it("should return null for no match", () =>
      expect(parseOccupationFromNarrative("平凡的一天", "")).toBeNull());
  });

  // ── 日常活动 ──
  describe("getAvailableActivities", () => {
    it("should filter by age and awakening", () => {
      const acts = getAvailableActivities(8, false);
      expect(acts.every((a) => a.minAge <= 8)).toBe(true);
      expect(acts.some((a) => a.id === "cultivate")).toBe(false);
    });
  });

  describe("applyActivityEffects", () => {
    it("should apply attribute growth", () => {
      const activity = {
        id: "exercise",
        name: "锻炼",
        icon: "🏃",
        description: "",
        staminaCost: 3,
        goldDelta: 0,
        attrGrowth: [["root", 1.5] as [string, number]],
        minAge: 3,
      };
      const result = applyActivityEffects(activity, { root: 5 });
      expect(result.root).toBe(6.5);
    });
  });

  // ── 工具函数 ──
  describe("getStartingGold", () => {
    it("should return 50", () => expect(getStartingGold()).toBe(50));
  });

  describe("dbToSchoolRank / schoolRankToDb", () => {
    it("should convert bidirectionally", () => {
      expect(dbToSchoolRank(0)).toBe("普通");
      expect(dbToSchoolRank(1)).toBe("重点");
      expect(dbToSchoolRank(2)).toBe("名校");
      expect(schoolRankToDb("普通")).toBe(0);
      expect(schoolRankToDb("名校")).toBe(2);
    });
    it("should return fallback for unknown", () => {
      expect(dbToSchoolRank(99)).toBe("普通");
      expect(schoolRankToDb("unknown" as any)).toBe(0);
    });
  });

  describe("getRealmIndex", () => {
    it("凡人返回 0", () => expect(getRealmIndex("凡人")).toBe(0));
    it("炼气期返回 1", () => expect(getRealmIndex("炼气期")).toBe(1));
    it("筑基期返回 2", () => expect(getRealmIndex("筑基期")).toBe(2));
    it("未知境界返回 -1", () => expect(getRealmIndex("未知境界")).toBe(-1));
  });

  describe("isRealmSufficient", () => {
    it("凡人满足凡人门槛", () => expect(isRealmSufficient("凡人", "凡人")).toBe(true));
    it("炼气期满足凡人门槛", () => expect(isRealmSufficient("炼气期", "凡人")).toBe(true));
    it("凡人不满足炼气期门槛", () => expect(isRealmSufficient("凡人", "炼气期")).toBe(false));
    it("未知境界不满足门槛", () => expect(isRealmSufficient("未知", "炼气期")).toBe(false));
    it("未知门槛保守放行", () => expect(isRealmSufficient("凡人", "未知")).toBe(true));
  });

  describe("getActionsWithLockInfo", () => {
    it("earth 世界凡人返回行动，基础行动无锁定", () => {
      const actions = getActionsWithLockInfo("earth", 16, "凡人");
      expect(actions.length).toBeGreaterThan(0);
      const unlocked = actions.filter((a) => !a.locked);
      expect(unlocked.length).toBeGreaterThan(0);
    });
    it("筑基期行动对凡人标记 locked", () => {
      const actions = getActionsWithLockInfo("earth", 16, "凡人");
      const locked = actions.filter((a) => a.locked);
      locked.forEach((a) => {
        expect(a.lockReason).toContain("需要");
        expect(a.requiredRealm).toBeDefined();
      });
    });
    it("非 earth 世界返回全部行动无锁定", () => {
      const actions = getActionsWithLockInfo("heaven", 16, "凡人");
      expect(actions.every((a) => !a.locked)).toBe(true);
    });
  });
});
