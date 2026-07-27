import { describe, it, expect } from "vitest";
import {
  CLASSMATE_AVATARS,
  CLASSMATE_MIN,
  CLASSMATE_MAX,
  shouldGenerateClassmates,
  generateClassmates,
  type NpcRelationData,
} from "../classmate-data";

// 用「已有同学」表示幂等守卫；shouldGenerateClassmates 仅读取 entry.type。
const withClassmate = (): Record<string, NpcRelationData> => ({
  张三: { type: "classmate", intimacy: 0, avatar: "🧒", realm: "凡人", metAt: 6, category: "同窗" },
});

describe("shouldGenerateClassmates", () => {
  it("age 6 且无同学 → true（首批生成）", () => {
    expect(shouldGenerateClassmates(6, {})).toBe(true);
  });

  it("age 6 已有同学 → false（幂等守卫）", () => {
    expect(shouldGenerateClassmates(6, withClassmate())).toBe(false);
  });

  it("age 7 已有同学 → false（不重复生成）", () => {
    expect(shouldGenerateClassmates(7, withClassmate())).toBe(false);
  });

  it("age 15 无同学 → true（跳号兜底）", () => {
    expect(shouldGenerateClassmates(15, {})).toBe(true);
  });

  it("age 16 无同学 → false（觉醒后停止）", () => {
    expect(shouldGenerateClassmates(16, {})).toBe(false);
  });

  it("age 5 无同学 → false（未到入学年龄）", () => {
    expect(shouldGenerateClassmates(5, {})).toBe(false);
  });

  it("非 classmate 类型的既有关系不阻止生成", () => {
    const rels = {
      韩立: { type: "cultivator", intimacy: 30, avatar: "🧙", realm: "炼气期", metAt: 20, category: "熟人" },
    } as Record<string, NpcRelationData>;
    expect(shouldGenerateClassmates(6, rels)).toBe(true);
  });
});

describe("generateClassmates", () => {
  it("age 6 生成恰好 CLASSMATE_MIN 条，每条字段正确", () => {
    const result = generateClassmates(6, {});
    const entries = Object.values(result);
    expect(entries.length).toBe(CLASSMATE_MIN);
    for (const r of entries) {
      expect(r.type).toBe("classmate");
      expect(r.realm).toBe("凡人");
      expect(r.intimacy).toBe(0);
      expect(r.metAt).toBe(6);
      expect(r.category).toBe("同窗");
      expect(CLASSMATE_AVATARS).toContain(r.avatar);
    }
  });

  it("生成数量在 [MIN, MAX] 区间内（本任务恒为 3）", () => {
    const result = generateClassmates(6, {});
    const n = Object.keys(result).length;
    expect(n).toBeGreaterThanOrEqual(CLASSMATE_MIN);
    expect(n).toBeLessThanOrEqual(CLASSMATE_MAX);
  });

  it("同批次名字唯一（不放回抽取，多次运行无碰撞）", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateClassmates(6, {});
      const keys = Object.keys(result);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("已存在同学时原样返回，不新增", () => {
    const input = withClassmate();
    const result = generateClassmates(7, input);
    expect(Object.keys(result)).toEqual(["张三"]);
    expect(result).toBe(input); // 幂等：返回同一引用，未新建
  });

  it("age 16 不生成（觉醒后）", () => {
    const result = generateClassmates(16, {});
    expect(Object.keys(result).length).toBe(0);
  });

  it("不修改入参（纯函数，无副作用）", () => {
    const input: Record<string, NpcRelationData> = {};
    generateClassmates(6, input);
    expect(Object.keys(input).length).toBe(0);
  });

  it("合并回既有 relations，不覆盖旧条目", () => {
    const existing = {
      韩立: { type: "cultivator", intimacy: 30, avatar: "🧙", realm: "炼气期", metAt: 20, category: "熟人" },
    } as Record<string, NpcRelationData>;
    const result = generateClassmates(6, existing);
    expect(result["韩立"]).toEqual(existing["韩立"]);
    expect(Object.keys(result).length).toBe(CLASSMATE_MIN + 1);
  });
});
