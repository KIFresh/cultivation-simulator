import { describe, it, expect } from "vitest";
import {
  checkLocationConsistency,
  checkBirthConsistency,
  checkClientOverride,
  runConsistencyChecks,
  type ConsistencyViolation,
} from "@/lib/narrative-consistency";
import type { NarrativeStateSnapshot } from "@/lib/narrative-context";
import type { BirthFamilyMember } from "@/lib/narrative";

const mockSnapshot: NarrativeStateSnapshot = {
  cultivatorId: "c1",
  userId: "u1",
  name: "陈念安",
  age: 1,
  quarter: 1,
  realm: "凡人",
  realmLevel: 0,
  location: "家",
  locationId: "home",
  stamina: 100,
  maxStamina: 100,
  gold: 0,
  health: 100,
  maxAge: 100,
  toxicity: 0,
  attributes: {},
  family: [],
};

describe("checkLocationConsistency", () => {
  it("在家时不报错", () => {
    const r = checkLocationConsistency("陈念安在家里醒来。", "家", "home");
    expect(r).toBeNull();
  });

  it("在家却写到学校时报告错误", () => {
    const r = checkLocationConsistency("陈念安在学校上课。", "家", "home");
    expect(r).not.toBeNull();
    expect(r!.severity).toBe("error");
    expect(r!.field).toBe("location");
  });

  it("否定上下文不报错", () => {
    const r = checkLocationConsistency("陈念安今天没去学校。", "家", "home");
    expect(r).toBeNull();
  });

  it("在学校地点时应该通过", () => {
    const r = checkLocationConsistency("老师在黑板上写字。", "学校", "school");
    expect(r).toBeNull();
  });

  it("在学校却写在家中时报告错误", () => {
    const r = checkLocationConsistency("回到家的感觉很安心。", "学校", "school");
    expect(r).not.toBeNull();
  });
});

describe("checkBirthConsistency", () => {
  it("一致的家庭返回空数组", () => {
    const violations = checkBirthConsistency(
      {
        narrative: "陈建国看着刚出生的女儿陈念安，激动得说不出话来。刘秀梅虚弱地笑着。",
        suggestedName: "陈念安",
        family: [
          { relation: "父亲", name: "陈建国", age: 30, alive: true },
          { relation: "母亲", name: "刘秀梅", age: 28, alive: true },
        ],
      },
      mockSnapshot,
    );
    expect(violations).toHaveLength(0);
  });

  it("重复关系报错", () => {
    const violations = checkBirthConsistency(
      {
        narrative: "陈念安出生了。",
        suggestedName: "陈念安",
        family: [
          { relation: "父亲", name: "陈建国", age: 30, alive: true },
          { relation: "父亲", name: "陈国强", age: 32, alive: true }, // 两个父亲
        ],
      },
      mockSnapshot,
    );
    expect(violations.filter((v) => v.severity === "error").length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.field === "family" && v.message.includes("父亲"))).toBe(true);
  });

  it("叙文不包含建议名时仅 warning", () => {
    const violations = checkBirthConsistency(
      {
        narrative: "孩子出生了，是个女孩。",
        suggestedName: "陈念安",
        family: [
          { relation: "父亲", name: "陈建国", age: 30, alive: true },
        ],
      },
      mockSnapshot,
    );
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
    expect(violations.filter((v) => v.severity === "warning" && v.field === "suggestedName")).toHaveLength(1);
  });
});

describe("checkClientOverride", () => {
  it("body 含 name 时报 warning", () => {
    const r = checkClientOverride({ name: "测试名" }, "name");
    expect(r).not.toBeNull();
    expect(r!.severity).toBe("warning");
  });

  it("body 不含时返回 null", () => {
    const r = checkClientOverride({}, "name");
    expect(r).toBeNull();
  });
});

describe("runConsistencyChecks", () => {
  it("通过时返回 passed=true", () => {
    const report = runConsistencyChecks(
      {
        narrative: "陈念安在家中被父母照顾。",
        family: [
          { relation: "父亲", name: "陈建国", age: 30, alive: true },
        ],
      },
      mockSnapshot,
      {},
    );
    expect(report.passed).toBe(true);
  });

  it("地点不匹配时返回 passed=false", () => {
    const report = runConsistencyChecks(
      {
        narrative: "陈念安在学校上课。",
        family: [],
      },
      mockSnapshot, // location: "家"
      {},
    );
    expect(report.passed).toBe(false);
    expect(report.violations.some((v) => v.field === "location")).toBe(true);
  });

  it("客户端覆盖时包含 warning", () => {
    const report = runConsistencyChecks(
      {
        narrative: "陈念安在家。",
      },
      mockSnapshot,
      { name: "李四" },
    );
    expect(report.violations.filter((v) => v.field === "name" && v.severity === "warning")).toHaveLength(1);
  });
});
