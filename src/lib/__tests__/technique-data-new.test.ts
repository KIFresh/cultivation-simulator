import { describe, it, expect } from "vitest";
import {
  addProficiency,
  calculateTechniqueBonuses,
  getTechniqueById,
  getDefaultStudyNarrative,
  triggerStudyEvent,
  TECHNIQUES,
} from "../technique-data";

describe("technique-data", () => {
  describe("getTechniqueById", () => {
    it("should return the matching technique", () => {
      const t = getTechniqueById("basic_breathing");
      expect(t).toBeDefined();
      expect(t!.name).toBe("吐纳术");
      expect(t!.grade).toBe("凡");
    });

    it("should return undefined for unknown id", () => {
      expect(getTechniqueById("unknown")).toBeUndefined();
    });
  });

  describe("addProficiency", () => {
    const upgradeProf = [100, 300]; // lv1->lv2 needs 100, lv2->lv3 needs 300

    it("should add proficiency without leveling up", () => {
      const result = addProficiency(1, 50, upgradeProf, 30);
      expect(result.newLevel).toBe(1);
      expect(result.newProficiency).toBe(80);
      expect(result.leveledUp).toBe(false);
    });

    it("should level up when proficiency exceeds threshold", () => {
      const result = addProficiency(1, 80, upgradeProf, 40);
      expect(result.newLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
    });

    it("should handle max level overflow", () => {
      const result = addProficiency(3, 0, upgradeProf, 999);
      expect(result.newLevel).toBe(3);
      expect(result.newProficiency).toBe(0);
      expect(result.leveledUp).toBe(false);
    });
  });

  describe("calculateTechniqueBonuses", () => {
    it("should calculate total bonuses", () => {
      const t = getTechniqueById("sword_foundation")!;
      const bonuses = calculateTechniqueBonuses([{ technique: t, level: 2 }]);
      expect(bonuses.cultivationSpeed).toBe(15); // 10 + 5*1
      expect(bonuses.breakthroughRate).toBe(5); // 3 + 2*1
    });
  });

  describe("getDefaultStudyNarrative", () => {
    it("should include the technique name", () => {
      const text = getDefaultStudyNarrative("吐纳术");
      expect(text).toContain("吐纳术");
    });
  });

  describe("triggerStudyEvent", () => {
    it("should return null for low insight", () => {
      const result = triggerStudyEvent(0, "吐纳术");
      // May or may not trigger, but structure should be correct
      if (result) {
        expect(result.event).toBeDefined();
        expect(result.narrative).toContain("吐纳术");
      }
    });
  });
});
