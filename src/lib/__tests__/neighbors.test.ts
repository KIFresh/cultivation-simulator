import { describe, it, expect } from "vitest";
import {
  rollInitialNeighbors,
  interactNeighbor,
  isNeighbor,
  clampIntimacy,
  type NeighborNpc,
} from "@/lib/neighbors";

const sample: NeighborNpc = {
  name: "王大妈",
  avatar: "👵",
  realm: "热心肠的居委会大妈",
  intimacy: 10,
  category: "邻里",
  metAt: 6,
  type: "neighbor",
};

describe("rollInitialNeighbors", () => {
  it("生成 2-4 个邻居且同种子可复现", () => {
    const a = rollInitialNeighbors("id-x", 6);
    const b = rollInitialNeighbors("id-x", 6);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a).toEqual(b);
    expect(a.every((n) => n.type === "neighbor" && n.category === "邻里")).toBe(true);
  });
});

describe("interactNeighbor", () => {
  it("gossip 免费 + 亲密度3 + 魅力1", () => {
    const r = interactNeighbor(sample, "gossip");
    expect(r.intimacyDelta).toBe(3);
    expect(r.goldDelta).toBe(0);
    expect(r.attr).toBe("charm");
  });
  it("gift 花费5 + 亲密度8", () => {
    const r = interactNeighbor(sample, "gift");
    expect(r.goldDelta).toBe(-5);
    expect(r.intimacyDelta).toBe(8);
  });
  it("help 获10金币 + 亲密度5 + 心智1", () => {
    const r = interactNeighbor(sample, "help");
    expect(r.goldDelta).toBe(10);
    expect(r.attr).toBe("mind");
  });
});

describe("isNeighbor / clampIntimacy", () => {
  it("isNeighbor 识别邻居与拒绝其它", () => {
    expect(isNeighbor(sample)).toBe(true);
    expect(isNeighbor({ type: "classmate" })).toBe(false);
    expect(isNeighbor(null)).toBe(false);
  });
  it("clampIntimacy 夹紧 0-100", () => {
    expect(clampIntimacy(120)).toBe(100);
    expect(clampIntimacy(-5)).toBe(0);
    expect(clampIntimacy(55)).toBe(55);
  });
});

describe("命格影响邻居初遇好感", () => {
  it("无命格 → 基础 10", () => {
    expect(rollInitialNeighbors("id-x", 6).every((n) => n.intimacy === 10)).toBe(true);
  });
  it("紫微 → 初遇 14", () => {
    expect(rollInitialNeighbors("id-x", 6, "紫微").every((n) => n.intimacy === 14)).toBe(true);
  });
  it("孤辰 → 初遇 7", () => {
    expect(rollInitialNeighbors("id-x", 6, "孤辰").every((n) => n.intimacy === 7)).toBe(true);
  });
  it("桃花 → 初遇 15", () => {
    expect(rollInitialNeighbors("id-x", 6, "桃花").every((n) => n.intimacy === 15)).toBe(true);
  });
});
