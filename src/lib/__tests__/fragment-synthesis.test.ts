import { describe, it, expect } from "vitest";
import {
  checkFragmentSynthesis,
  getFragmentTechniqueIds,
  techniqueIdFromName,
} from "../fragment-synthesis";

describe("功法残页合成", () => {
  it("不足10张不能合成", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 5, equipped: false }];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.result.synthesisCount).toBe(0);
  });

  it("10张可以合成1次", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 10, equipped: false }];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.result.synthesisCount).toBe(1);
    expect(result.result.details[0].fragmentsUsed).toBe(10);
  });

  it("20张可以合成2次", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 20, equipped: false }];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.result.synthesisCount).toBe(2);
  });

  it("合成后消耗残页", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 15, equipped: false }];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.updatedInventory[0].quantity).toBe(5);
  });

  it("合成后残页为0时移除条目", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 10, equipped: false }];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.updatedInventory.length).toBe(0);
  });

  it("已有功法时标记为existing", () => {
    const inventory = [{ itemId: "fragment_basic_breathing", quantity: 10, equipped: false }];
    const result = checkFragmentSynthesis(inventory, ["basic_breathing"]);
    expect(result.result.details[0].existingTechnique).toBe(true);
    expect(result.result.details[0].profGained).toBe(20);
  });

  it("非残页物品不参与合成", () => {
    const inventory = [
      { itemId: "qi_pill", quantity: 10, equipped: false },
      { itemId: "fragment_basic_breathing", quantity: 10, equipped: false },
    ];
    const result = checkFragmentSynthesis(inventory, []);
    expect(result.result.synthesisCount).toBe(1);
  });
});

describe("获取残页功法ID", () => {
  it("提取残页对应的功法ID", () => {
    const ids = getFragmentTechniqueIds([
      "fragment_basic_breathing",
      "fragment_sword_foundation",
      "qi_pill",
    ]);
    expect(ids).toContain("basic_breathing");
    expect(ids).toContain("sword_foundation");
    expect(ids).not.toContain("qi_pill");
  });

  it("去重", () => {
    const ids = getFragmentTechniqueIds(["fragment_basic_breathing", "fragment_basic_breathing"]);
    expect(ids.length).toBe(1);
  });
});

describe("功法名称映射", () => {
  it("吐纳术映射正确", () => {
    expect(techniqueIdFromName("吐纳术")).toBe("basic_breathing");
  });

  it("基础剑诀映射正确", () => {
    expect(techniqueIdFromName("基础剑诀")).toBe("sword_foundation");
  });

  it("未知名称返回空字符串", () => {
    expect(techniqueIdFromName("不存在")).toBe("");
  });
});
