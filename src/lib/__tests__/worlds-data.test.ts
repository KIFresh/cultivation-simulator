import { describe, it, expect } from "vitest";
import { WORLDS, getWorldById, getWorldAIPrompt, getWorlds } from "../worlds-data";

// ============================================================
// WORLDS 常量数据验证
// ============================================================
describe("WORLDS 常量数据", () => {
  it("世界观列表不为空", () => {
    expect(WORLDS.length).toBeGreaterThan(0);
  });

  it("所有世界观有唯一id", () => {
    const ids = WORLDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("所有世界观有必填字段", () => {
    for (const world of WORLDS) {
      expect(world.id).toBeTruthy();
      expect(world.name).toBeTruthy();
      expect(world.icon).toBeTruthy();
      expect(world.tag).toBeTruthy();
      expect(world.tagColor).toBeTruthy();
      expect(world.description).toBeTruthy();
      expect(world.playerDescription).toBeTruthy();
      expect(world.aiPrompt).toBeTruthy();
    }
  });

  it("tagColor 是合法颜色名称", () => {
    const validColors = [
      "blue",
      "red",
      "green",
      "yellow",
      "purple",
      "orange",
      "gray",
      "slate",
      "zinc",
    ];
    for (const world of WORLDS) {
      expect(validColors).toContain(world.tagColor);
    }
  });

  it("所有世界观有标签", () => {
    for (const world of WORLDS) {
      expect(world.tag.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// getWorldById — 查找世界观
// ============================================================
describe("getWorldById", () => {
  it("获取存在的世界观", () => {
    const world = getWorldById("earth");
    expect(world).toBeDefined();
    expect(world?.name).toBe("地球");
  });

  it("获取不存在的世界观返回undefined", () => {
    expect(getWorldById("不存在")).toBeUndefined();
  });

  it("大小写敏感", () => {
    expect(getWorldById("EARTH")).toBeUndefined();
  });
});

// ============================================================
// getWorldAIPrompt — 获取世界观AI提示词
// ============================================================
describe("getWorldAIPrompt", () => {
  it("存在id时返回对应prompt", () => {
    const prompt = getWorldAIPrompt("earth");
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(50);
  });

  it("不存在id时返回空字符串", () => {
    expect(getWorldAIPrompt("不存在")).toBe("");
  });

  it("无id时返回空字符串", () => {
    expect(getWorldAIPrompt()).toBe("");
  });

  it("undefined id返回空字符串", () => {
    expect(getWorldAIPrompt(undefined)).toBe("");
  });
});

describe("getWorlds", () => {
  it("返回所有世界观列表", () => {
    const worlds = getWorlds();
    expect(Array.isArray(worlds)).toBe(true);
    expect(worlds.length).toBe(WORLDS.length);
  });

  it("每个世界观有必需的字段", () => {
    const worlds = getWorlds();
    worlds.forEach((w) => {
      expect(w.id).toBeDefined();
      expect(w.name).toBeDefined();
    });
  });
});
