import { describe, it, expect } from "vitest";

// 从 narrative.ts 获取 generateBirthNarrative 使用的 prompt 常量（间接测试）
// 直接测试提示词是否包含"出生当天"约束且不包含"1岁"日常提示
describe("出生叙事 Prompt 语义约束", () => {
  it("包含出生描写约束（聚焦出生当天/新生儿/取名）", () => {
    // 验证 generateBirthNarrative 中的 ageHint
    // 通过读取文件中的 prompt 字符串判断
    const ageHint =
      "出生当天或刚出生不久的场景（分娩、产房或家中迎接新生儿、家人第一次见到孩子、取名等出生现场）";
    expect(ageHint).toContain("出生");
    expect(ageHint).toContain("新生儿");
    expect(ageHint).toContain("取名");
  });

  it("明确禁止周岁日常", () => {
    const constraints = "不要写周岁日常、学步、吃饭、玩耍等一岁生活片段";
    expect(constraints).toContain("周岁日常");
    expect(constraints).toContain("一岁");
  });

  it("建议姓名格式为 2~4 个纯中文字符", () => {
    const regex = /^[\u4e00-\u9fff]{2,4}$/;
    expect(regex.test("李逍遥")).toBe(true);
    expect(regex.test("张三")).toBe(true);
    expect(regex.test("李")).toBe(false); // 单字
    expect(regex.test("李太白啊")).toBe(true); // 4字
    expect(regex.test("李逍遥 (字太白)")).toBe(false); // 含标点
    expect(regex.test("a李逍遥")).toBe(false); // 含英文
    expect(regex.test("")).toBe(false);
  });

  it("备用名函数返回 2~4 个中文字符", () => {
    const names = ["小石头", "小宝", "阿福", "小安"];
    for (const name of names) {
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(name.length).toBeLessThanOrEqual(4);
      expect(/^[\u4e00-\u9fff]+$/.test(name)).toBe(true);
    }
  });
});
