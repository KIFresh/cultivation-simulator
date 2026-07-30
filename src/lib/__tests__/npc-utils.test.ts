import { describe, it, expect } from "vitest";
import { mergeNpcs } from "@/lib/npc-utils";

describe("mergeNpcs", () => {
  it("家庭成员与地点 NPC 同名时仅保留家庭成员", () => {
    const family = [
      { id: "f1", name: "李建国", relation: "父亲", age: 45 },
    ];
    const npcs = [
      { name: "李建国", locationId: "home", avatar: "👨" },
    ];
    const result = mergeNpcs(family, npcs);
    expect(result).toHaveLength(1);
    expect(result[0]._src).toBe("family");
    expect(result[0].name).toBe("李建国");
  });

  it("地点 NPC 关系名与家庭关系冲突时跳过", () => {
    const family = [
      { id: "f2", name: "王母", relation: "母亲", age: 42 },
    ];
    const npcs = [
      { name: "母亲", locationId: "market", avatar: "👩" },
    ];
    const result = mergeNpcs(family, npcs);
    expect(result).toHaveLength(1);
    expect(result[0]._src).toBe("family");
  });

  it("不冲突的家庭成员和地点 NPC 均保留", () => {
    const family = [
      { id: "f3", name: "张父", relation: "父亲", age: 50 },
    ];
    const npcs = [
      { name: "赵铁柱", locationId: "school", avatar: "🧑" },
      { name: "孙小花", locationId: "market", avatar: "👩" },
    ];
    const result = mergeNpcs(family, npcs);
    expect(result).toHaveLength(3);
    expect(result[0]._src).toBe("family");
    expect(result[1]._src).toBe("location");
    expect(result[2]._src).toBe("location");
  });

  it("每个输出项都有唯一、稳定的 _key", () => {
    const family = [
      { id: "f4", name: "陈父", relation: "父亲", age: 48 },
      { id: "f5", name: "陈母", relation: "母亲", age: 46 },
    ];
    const npcs = [
      { name: "李老师", locationId: "school", avatar: "👨‍🏫" },
    ];
    const result = mergeNpcs(family, npcs);
    const keys = result.map((r) => r._key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("family-f4");
    expect(keys).toContain("family-f5");
    expect(keys).toContain("location-李老师");
  });

  it("家庭成员 id 缺失时生成确定性 _key", () => {
    const family = [
      { name: "无id父", relation: "父亲", age: 40 },
    ];
    const result = mergeNpcs(family, []);
    expect(result).toHaveLength(1);
    expect(result[0]._key).toBe("family-无id父");
  });

  it("空数组返回空数组", () => {
    expect(mergeNpcs([], [])).toHaveLength(0);
  });

  it("null/undefined 输入容错", () => {
    expect(mergeNpcs(undefined as any, undefined as any)).toHaveLength(0);
    expect(mergeNpcs(null as any, null as any)).toHaveLength(0);
  });

  it("同一地点的多个 NPC 生成不同的 _key", () => {
    const npcs = [
      { name: "父亲", locationId: "home", avatar: "👨" },
      { name: "母亲", locationId: "home", avatar: "👩" },
      { name: "爷爷", locationId: "home", avatar: "👴" },
    ];
    const result = mergeNpcs([], npcs);
    const keys = result.map((r) => r._key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result).toHaveLength(3);
  });

  it("同名地点 NPC 按输入顺序追加计数后缀保证唯一", () => {
    const npcs = [
      { name: "陌生人", locationId: "market" },
      { name: "陌生人", locationId: "market" },
      { name: "陌生人", locationId: "market" },
    ];
    const result = mergeNpcs([], npcs);
    const keys = result.map((r) => r._key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result).toHaveLength(3);
  });
});