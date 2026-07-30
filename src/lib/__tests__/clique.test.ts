import { describe, it, expect } from "vitest";
import { decideClique, getCliqueBonus, getCliqueInfo, CLIQUE_INFO } from "@/lib/clique";

describe("decideClique (属性阈值 → 圈子映射)", () => {
  it("6 岁前不分配圈子", () => {
    expect(decideClique({ insight: 80, root: 80 }, 5)).toBeNull();
  });
  it("16 岁后不再分配圈子", () => {
    expect(decideClique({ insight: 80, root: 80 }, 16)).toBeNull();
  });
  it("悟性突出 → 学霸圈", () => {
    expect(decideClique({ insight: 70, root: 40 }, 10)).toBe("nerd");
  });
  it("根骨突出 → 体育圈", () => {
    expect(decideClique({ insight: 40, root: 70 }, 10)).toBe("sport");
  });
  it("两项都低且已上小学 → 混混圈", () => {
    expect(decideClique({ insight: 20, root: 20 }, 9)).toBe("delinquent");
  });
  it("无明显突出 → 普通圈", () => {
    expect(decideClique({ insight: 45, root: 45 }, 9)).toBe("normal");
  });
  it("边界年龄 6 与 15 仍分配", () => {
    expect(decideClique({ insight: 60, root: 40 }, 6)).toBe("nerd");
    expect(decideClique({ insight: 60, root: 40 }, 15)).toBe("nerd");
  });
});

describe("getCliqueBonus (年度加成数值)", () => {
  it("学霸圈 +0.3 悟性", () => {
    expect(getCliqueBonus("nerd")).toEqual({ insight: 0.3 });
  });
  it("体育圈 +0.3 根骨", () => {
    expect(getCliqueBonus("sport")).toEqual({ root: 0.3 });
  });
  it("混混圈 +0.2 魅力 / -0.1 心性", () => {
    expect(getCliqueBonus("delinquent")).toEqual({ charm: 0.2, mind: -0.1 });
  });
  it("普通圈 +0.1 心性", () => {
    expect(getCliqueBonus("normal")).toEqual({ mind: 0.1 });
  });
  it("无圈子返回空对象", () => {
    expect(getCliqueBonus(null)).toEqual({});
    expect(getCliqueBonus(undefined)).toEqual({});
  });
});

describe("getCliqueInfo", () => {
  it("返回正确展示信息", () => {
    expect(getCliqueInfo("nerd")?.name).toBe("学霸圈");
    expect(getCliqueInfo(null)).toBeNull();
  });
  it("CLIQUE_INFO 含四个圈子且加成与文档一致", () => {
    expect(Object.keys(CLIQUE_INFO).sort()).toEqual(
      ["delinquent", "nerd", "normal", "sport"].sort()
    );
  });
});
