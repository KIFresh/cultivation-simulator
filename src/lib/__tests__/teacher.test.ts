import { describe, it, expect } from "vitest";
import {
  TEACHER_TYPE,
  TEACHER_MIN,
  TEACHER_MAX,
  shouldGenerateTeachers,
  generateTeachers,
  getTeacherRankBonus,
} from "../teacher";
import type { NpcRelationData } from "../classmate-data";

function mkRel(type?: string, intimacy = 0): Record<string, NpcRelationData> {
  return {
    某人: { intimacy, avatar: "🧒", realm: "凡人", metAt: 6, category: type ? "x" : "y", type },
  };
}

describe("shouldGenerateTeachers", () => {
  it("入学前（age<6）不生成", () => {
    expect(shouldGenerateTeachers(5, {})).toBe(false);
  });
  it("6 岁且无老师时生成", () => {
    expect(shouldGenerateTeachers(6, {})).toBe(true);
  });
  it("已存在 type:teacher 则不生成（幂等判定）", () => {
    expect(shouldGenerateTeachers(10, mkRel(TEACHER_TYPE))).toBe(false);
  });
  it("仅有同学（无老师）仍应在窗口内生成", () => {
    expect(shouldGenerateTeachers(8, mkRel("classmate"))).toBe(true);
  });
});

describe("generateTeachers", () => {
  it("age<6 时原样返回（幂等、不修改）", () => {
    const input = mkRel();
    const out = generateTeachers(4, input);
    expect(out).toBe(input);
  });
  it("首次 6 岁边界生成 1-2 名 type:teacher", () => {
    const out = generateTeachers(6, {});
    const teachers = Object.values(out).filter((r) => r.type === TEACHER_TYPE);
    const n = teachers.length;
    expect(n).toBeGreaterThanOrEqual(TEACHER_MIN);
    expect(n).toBeLessThanOrEqual(TEACHER_MAX);
    for (const t of teachers) {
      expect(t.intimacy).toBe(0);
      expect(t.realm).toBe("凡人");
      expect(t.category).toBe("师长");
    }
  });
  it("已存在老师时不重复生成（数量不变）", () => {
    const before = mkRel(TEACHER_TYPE, 30);
    const beforeCount = Object.keys(before).length;
    const out = generateTeachers(12, before);
    expect(Object.keys(out).length).toBe(beforeCount);
    expect(Object.values(out).filter((r) => r.type === TEACHER_TYPE).length).toBe(1);
  });
  it("不修改入参（返回新对象）", () => {
    const input: Record<string, NpcRelationData> = {};
    const out = generateTeachers(6, input);
    expect(input).toEqual({});
    expect(out).not.toBe(input);
  });
  it("与已有同学共存：仅追加老师，不破坏同学", () => {
    const base = mkRel("classmate");
    const out = generateTeachers(6, base);
    const teachers = Object.values(out).filter((r) => r.type === TEACHER_TYPE).length;
    const classmates = Object.values(out).filter((r) => r.type === "classmate").length;
    expect(teachers).toBeGreaterThanOrEqual(1);
    expect(classmates).toBe(1);
  });
});

describe("getTeacherRankBonus", () => {
  it("无老师返回 0", () => {
    expect(getTeacherRankBonus({})).toBe(0);
    expect(getTeacherRankBonus(mkRel("classmate", 90))).toBe(0);
  });
  it("最高好感 < 70 返回 0", () => {
    expect(getTeacherRankBonus(mkRel(TEACHER_TYPE, 69))).toBe(0);
  });
  it("最高好感达阈值(70)返回 +1", () => {
    expect(getTeacherRankBonus(mkRel(TEACHER_TYPE, 70))).toBe(1);
  });
  it("最高好感远超阈值仍返回 +1（clamp 由调用方负责）", () => {
    expect(getTeacherRankBonus(mkRel(TEACHER_TYPE, 95))).toBe(1);
  });
  it("多老师取最高好感判定", () => {
    const rels: Record<string, NpcRelationData> = {
      甲: {
        intimacy: 40,
        avatar: "🧑‍🏫",
        realm: "凡人",
        metAt: 6,
        category: "师长",
        type: TEACHER_TYPE,
      },
      乙: {
        intimacy: 75,
        avatar: "👨‍🏫",
        realm: "凡人",
        metAt: 6,
        category: "师长",
        type: TEACHER_TYPE,
      },
    };
    expect(getTeacherRankBonus(rels)).toBe(1);
  });
});
